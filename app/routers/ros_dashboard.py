import asyncio
import json
import time
import uuid
import threading
import websockets
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
import httpx

from app.database import SessionLocal
from app.models.audit import AuditLog
from app.models.robot import RobotCatalog

router = APIRouter(prefix="/ros", tags=["ROS Dashboard"])

# ── Session store ──────────────────────────────────────────────────────────────
_sessions: dict[str, dict] = {}
_active_ws: dict[str, WebSocket] = {}
_claim_lock = asyncio.Lock()
_loop = None

SESSION_TIMEOUT_S = 15.0
ROSBRIDGE_URL = "ws://host.docker.internal:9090"


def _load_robot_database() -> dict:
    db = SessionLocal()
    try:
        robots = db.query(RobotCatalog).filter(
            RobotCatalog.ros_namespace.isnot(None)
        ).all()
        result = {}
        for r in robots:
            ns = r.ros_namespace
            num = ns.replace("rob", "")
            key = f"ROB-{num}"
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


# ── Rosbridge client ───────────────────────────────────────────────────────────

async def _rosbridge_subscribe(robot_id: str, namespace: str):
    """Rosbridge'e bağlanır, odom/imu topic'lerine subscribe olur, FastAPI WS'e yayar."""
    topics = [
        {"topic": f"/{namespace}/odom", "type": "nav_msgs/Odometry", "msg_type": "odom"},
        {"topic": f"/{namespace}/imu",  "type": "sensor_msgs/Imu",   "msg_type": "imu"},
    ]
    while True:
        try:
            async with websockets.connect(ROSBRIDGE_URL) as ws:
                print(f"[rosbridge] {robot_id} bağlandı")

                for t in topics:
                    sub_msg = json.dumps({
                        "op": "subscribe",
                        "topic": t["topic"],
                        "type": t["type"],
                        "throttle_rate": 200,  # ms
                    })
                    await ws.send(sub_msg)

                async for raw in ws:
                    msg = json.loads(raw)
                    if msg.get("op") != "publish":
                        continue

                    topic = msg.get("topic", "")
                    data_msg = msg.get("msg", {})
                    payload = {"robot_id": robot_id}

                    if f"/{namespace}/odom" in topic:
                        pos = data_msg.get("pose", {}).get("pose", {}).get("position", {})
                        payload["type"] = "odom"
                        payload["x"] = round(pos.get("x", 0), 3)
                        payload["y"] = round(pos.get("y", 0), 3)

                    elif f"/{namespace}/imu" in topic:
                        av = data_msg.get("angular_velocity", {})
                        payload["type"] = "imu"
                        payload["gz"] = round(av.get("z", 0), 3)

                    else:
                        continue

                    # FastAPI WS'e yayar
                    client_ws = _active_ws.get(robot_id)
                    if client_ws:
                        try:
                            await client_ws.send_json(payload)
                        except Exception:
                            _active_ws.pop(robot_id, None)

        except Exception as e:
            print(f"[rosbridge] {robot_id} bağlantı hatası: {e} — 3s sonra tekrar denenecek")
            await asyncio.sleep(3)


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
    target_url = f"http://host.docker.internal:8090/stream?topic=/{namespace}/camera/image_raw"

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


# ── Startup ────────────────────────────────────────────────────────────────────

async def ros_startup(loop: asyncio.AbstractEventLoop):
    global _loop, ROBOT_DATABASE
    _loop = loop
    ROBOT_DATABASE = _load_robot_database()
    asyncio.create_task(_reap_sessions())

    # Her robot için rosbridge subscriber başlat
    for rid, info in ROBOT_DATABASE.items():
        asyncio.create_task(_rosbridge_subscribe(rid, info["namespace"]))
        print(f"[rosbridge] {rid} için subscriber başlatıldı")
