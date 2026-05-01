# app/routers/ros_dashboard.py
import asyncio
import json
import time
import uuid
import threading
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
import httpx

from app.database import SessionLocal
from app.models.audit import AuditLog
from app.models.robot import RobotCatalog
# ── ROS (opsiyonel) ────────────────────────────────────────────────────────────
try:
    import rclpy
    from rclpy.node import Node
    from nav_msgs.msg import Odometry
    from sensor_msgs.msg import Imu, LaserScan
    from std_msgs.msg import String
    ROS_AVAILABLE = True
except ImportError:
    ROS_AVAILABLE = False
    print("[ros_dashboard] ROS 2 bulunamadı — web-only modda çalışıyor")

router = APIRouter(prefix="/ros", tags=["ROS Dashboard"])

# ── Session store ──────────────────────────────────────────────────────────────
_sessions: dict[str, dict] = {}
_active_ws: dict[str, WebSocket] = {}
_claim_lock = asyncio.Lock()
_ros_node = None
_loop = None

SESSION_TIMEOUT_S = 15.0


def _load_robot_database() -> dict:
    """
    DB'den ros_namespace tanımlı robotları yükler.
    rob100 → ROB-100, rob200 → ROB-200
    """
    db = SessionLocal()
    try:
        robots = db.query(RobotCatalog).filter(
            RobotCatalog.ros_namespace.isnot(None)
        ).all()
        result = {}
        for r in robots:
            # rob100 → ROB-100
            ns = r.ros_namespace  # "rob100"
            num = ns.replace("rob", "")  # "100"
            key = f"ROB-{num}"  # "ROB-100"
            result[key] = {
                "namespace": ns,
                "name": r.name,
                "catalog_id": r.id,
                "x": 0.0,
                "y": 0.0,
            }
        print(f"[ros_dashboard] {len(result)} robot yüklendi: {list(result.keys())}")
        return result
    finally:
        db.close()


ROBOT_DATABASE: dict = {}


# ── Session reaper ─────────────────────────────────────────────────────────────
async def _reap_sessions():
    while True:
        await asyncio.sleep(5)
        now = time.time()
        stale = [
            rid for rid, s in _sessions.items()
            if now - s["last_heartbeat"] > SESSION_TIMEOUT_S
        ]
        for rid in stale:
            del _sessions[rid]
            print(f"[session reaper] {rid!r} süresi doldu, silindi.")


# ── REST Endpointleri ──────────────────────────────────────────────────────────

@router.get("/robots")
async def list_robots():
    result = []
    for rid, info in ROBOT_DATABASE.items():
        session = _sessions.get(rid)
        result.append({
            "id": rid,
            "namespace": info["namespace"],
            "name": info.get("name", rid),
            "x": info["x"],
            "y": info["y"],
            "session_active": session is not None,
        })
    return result


@router.get("/robot/{robot_id}")
async def get_robot(robot_id: str):
    clean_id = robot_id.strip().upper()
    if clean_id not in ROBOT_DATABASE:
        raise HTTPException(status_code=404, detail="Robot bulunamadı")
    robot = ROBOT_DATABASE[clean_id]
    session = _sessions.get(clean_id)
    return {**robot, "id": clean_id, "session_active": session is not None}


@router.post("/robot/{robot_id}/claim")
async def claim_robot(robot_id: str):
    clean_id = robot_id.strip().upper()
    if clean_id not in ROBOT_DATABASE:
        raise HTTPException(status_code=404, detail="Robot bulunamadı")

    async with _claim_lock:
        existing = _sessions.get(clean_id)
        if existing and time.time() - existing["last_heartbeat"] <= SESSION_TIMEOUT_S:
            raise HTTPException(
                status_code=423,
                detail="Robot şu an başka bir operatör tarafından kullanılıyor."
            )
        token = str(uuid.uuid4())
        now = time.time()
        _sessions[clean_id] = {"token": token, "claimed_at": now, "last_heartbeat": now}

    print(f"[session] {clean_id!r} claim edildi — token [{token[:8]}…]")
    return {"token": token}


@router.post("/robot/{robot_id}/heartbeat")
async def heartbeat(robot_id: str, x_session_token: Optional[str] = Header(default=None)):
    clean_id = robot_id.strip().upper()
    session = _sessions.get(clean_id)
    if not session:
        raise HTTPException(status_code=404, detail="Aktif session yok")
    if session["token"] != x_session_token:
        raise HTTPException(status_code=403, detail="Geçersiz session token")
    session["last_heartbeat"] = time.time()
    return {"status": "ok"}


@router.delete("/robot/{robot_id}/claim")
@router.post("/robot/{robot_id}/release")
async def release_robot(
    robot_id: str,
    token: Optional[str] = None,
    x_session_token: Optional[str] = Header(default=None)
):
    actual_token = x_session_token or token
    clean_id = robot_id.strip().upper()
    session = _sessions.get(clean_id)
    if session and session["token"] == actual_token:
        del _sessions[clean_id]
        _active_ws.pop(clean_id, None)
        print(f"[session] {clean_id!r} serbest bırakıldı.")
        return {"status": "released"}
    return {"status": "already_free_or_invalid"}


# ── WebSocket ──────────────────────────────────────────────────────────────────

@router.websocket("/robot/{robot_id}/ws")
async def telemetry_ws(websocket: WebSocket, robot_id: str, token: str):
    clean_id = robot_id.strip().upper()
    session = _sessions.get(clean_id)

    if not session or session["token"] != token:
        await websocket.close(code=4003)
        return

    await websocket.accept()
    _active_ws[clean_id] = websocket
    print(f"[ws] {clean_id!r} bağlandı.")

    try:
        while True:
            data = await websocket.receive_text()
            # Komut loglama
            try:
                msg = json.loads(data)
                if msg.get("command"):
                    db = SessionLocal()
                    log = AuditLog(
                        action="ROBOT_COMMAND",
                        details={"robot_id": clean_id, "command": msg["command"]}
                    )
                    db.add(log)
                    db.commit()
                    db.close()
            except Exception:
                pass
            if _sessions.get(clean_id, {}).get("token") != token:
                break
    except WebSocketDisconnect:
        pass
    finally:
        if _active_ws.get(clean_id) == websocket:
            _active_ws.pop(clean_id, None)
        print(f"[ws] {clean_id!r} bağlantısı kesildi.")

# ── Video Stream ───────────────────────────────────────────────────────────────

@router.get("/robot/{robot_id}/stream")
async def video_stream(robot_id: str, token: str):
    clean_id = robot_id.strip().upper()
    session = _sessions.get(clean_id)
    if not session or session["token"] != token:
        raise HTTPException(status_code=403, detail="Yetkisiz video erişimi")

    namespace = ROBOT_DATABASE[clean_id]["namespace"]
    target_url = f"http://localhost:8090/stream?topic=/{namespace}/camera/image_raw"

    async def stream_generator():
        async with httpx.AsyncClient() as client:
            async with client.stream("GET", target_url) as r:
                async for chunk in r.aiter_bytes():
                    if _sessions.get(clean_id, {}).get("token") != token:
                        break
                    yield chunk

    return StreamingResponse(
        stream_generator(),
        media_type="multipart/x-mixed-replace; boundary=boundarydonotcross"
    )


# ── ROS Broadcast ──────────────────────────────────────────────────────────────

async def _broadcast(robot_id: str, data: dict):
    ws = _active_ws.get(robot_id.upper())
    if ws:
        try:
            await ws.send_json(data)
        except Exception:
            _active_ws.pop(robot_id.upper(), None)


def _telemetry_callback(msg, robot_id: str, msg_type: str):
    if not _loop:
        return
    data = {"type": msg_type, "robot_id": robot_id}

    if msg_type == "odom":
        data.update({
            "x": round(msg.pose.pose.position.x, 3),
            "y": round(msg.pose.pose.position.y, 3),
        })
    elif msg_type == "imu":
        data.update({"gz": round(msg.angular_velocity.z, 3)})
    elif msg_type == "scan":
        cleaned = [
            float(r) if (msg.range_min < r < msg.range_max and r != float('inf')) else 0.0
            for r in msg.ranges
        ]
        data.update({
            "ranges": cleaned,
            "angle_min": msg.angle_min,
            "angle_max": msg.angle_max,
            "angle_increment": msg.angle_increment,
        })

    asyncio.run_coroutine_threadsafe(_broadcast(robot_id, data), _loop)


def _run_ros():
    global _ros_node
    rclpy.init()
    _ros_node = Node('fleet_dashboard_relay')
    for rid, info in ROBOT_DATABASE.items():
        ns = info['namespace']
        _ros_node.create_subscription(
            Odometry, f"/{ns}/odom",
            lambda m, r=rid: _telemetry_callback(m, r, "odom"), 10)
        _ros_node.create_subscription(
            Imu, f"/{ns}/imu",
            lambda m, r=rid: _telemetry_callback(m, r, "imu"), 10)
        _ros_node.create_subscription(
            LaserScan, f"/{ns}/scan",
            lambda m, r=rid: _telemetry_callback(m, r, "scan"), 10)
    print("[ROS] Fleet Dashboard Relay başlatıldı.")
    rclpy.spin(_ros_node)


# ── Startup ────────────────────────────────────────────────────────────────────

async def ros_startup(loop: asyncio.AbstractEventLoop):
    global _loop, ROBOT_DATABASE
    _loop = loop
    ROBOT_DATABASE = _load_robot_database()
    asyncio.create_task(_reap_sessions())
    if ROS_AVAILABLE:
        threading.Thread(target=_run_ros, daemon=True).start()
        print("[ROS] ROS 2 node başlatıldı.")
    else:
        print("[ROS] ROS 2 yok — web-only modda çalışıyor.")
