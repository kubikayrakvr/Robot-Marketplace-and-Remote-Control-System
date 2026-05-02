import asyncio
import json
import math
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
SPAWN_SIGNAL_TOPIC = "/spawn_signal_topic"

# Physical fleet profile, keyed by ros_namespace. RobotCatalog.type stores
# Turkish display labels for the shop UI, so it cannot double as the spawner
# model identifier — we map namespace → model here instead.
_NS_TO_TYPE: dict[str, str] = {
    "rob100": "waffle",
    "rob200": "burger",
    "rob300": "waffle",
}
_DEFAULT_TYPE = "burger"

# Sensor inventory by robot model. Keys must match the directory name under
# ros_integration/src/robot_spawner/models/{type}/model.sdf.
_TYPE_SENSORS: dict[str, list[str]] = {
    "waffle": ["imu", "scan", "camera"],
    "burger": ["imu", "scan"],
}


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
            robot_type = _NS_TO_TYPE.get(ns, _DEFAULT_TYPE)
            result[key] = {
                "namespace": ns,
                "name": r.name,
                "type": robot_type,
                "sensors": _TYPE_SENSORS.get(robot_type, ["imu"]),
                "catalog_id": r.id,
                "x": 0.0,
                "y": 0.0,
            }
        print(f"[ros_dashboard] {len(result)} robot yüklendi: {list(result.keys())}")
        return result
    finally:
        db.close()


# ── Spawn signal dispatch ──────────────────────────────────────────────────────
#
# A single persistent rosbridge connection is maintained for spawn dispatches.
# Opening a fresh socket per claim turned out to be racy — rosbridge sometimes
# processed the publish before the advertise was fully registered, dropping
# the message silently. With a long-lived socket the advertise runs once at
# startup and every subsequent claim is a single publish op on a known-good
# topic. The connection self-heals on drop with backoff.

_spawn_ws: Optional["websockets.WebSocketClientProtocol"] = None
_spawn_ws_ready = asyncio.Event()
_spawn_lock = asyncio.Lock()


async def _spawn_dispatcher_loop() -> None:
    """
    Background task: keeps a rosbridge connection open for spawn publishes.
    On disconnect, retries every 3 s. The advertise is sent once per
    successful (re)connect so subsequent publishes are unambiguous.
    """
    global _spawn_ws
    while True:
        try:
            async with websockets.connect(ROSBRIDGE_URL) as ws:
                # Advertise the topic up front, in fully-qualified ROS 2 form.
                # The short ROS 1 form ("std_msgs/String") is silently rejected
                # by newer rosbridge_suite builds — that was the original
                # failure mode where claims looked successful but no message
                # ever reached the spawner.
                await ws.send(json.dumps({
                    "op": "advertise",
                    "topic": SPAWN_SIGNAL_TOPIC,
                    "type": "std_msgs/msg/String",
                }))
                # Give rosbridge a moment to register the advertisement.
                await asyncio.sleep(0.3)
                _spawn_ws = ws
                _spawn_ws_ready.set()
                print(f"[spawn] dispatcher connected, advertised {SPAWN_SIGNAL_TOPIC}")

                # Drain rosbridge replies — it sends `op:status` frames for
                # any errors. Logging them surfaces protocol-level rejections
                # that would otherwise be invisible.
                async for raw in ws:
                    try:
                        msg = json.loads(raw)
                    except Exception:
                        continue
                    if msg.get("op") == "status":
                        level = msg.get("level", "info")
                        text  = msg.get("msg", "")
                        if level in ("warning", "error"):
                            print(f"[spawn] rosbridge {level}: {text}")

        except Exception as e:
            print(f"[spawn] dispatcher disconnected: {e!r} — yeniden deneniyor 3s")
        finally:
            _spawn_ws = None
            _spawn_ws_ready.clear()
            await asyncio.sleep(3)


async def _publish_spawn_signal(
    namespace: str, x: float, y: float, robot_type: str
) -> None:
    """
    Publish a spawn directive on the long-lived dispatcher socket. Bounded
    by a 3 s wait for the socket to come up — if the dispatcher is still
    reconnecting we log and skip rather than blocking the claim response.
    The spawner node deduplicates by namespace, so re-claims are harmless.
    """
    payload = f"{namespace},{x},{y},{robot_type}"

    try:
        await asyncio.wait_for(_spawn_ws_ready.wait(), timeout=3.0)
    except asyncio.TimeoutError:
        print(f"[spawn] dispatcher not ready, skipped: {payload!r}")
        return

    ws = _spawn_ws
    if ws is None:
        print(f"[spawn] dispatcher socket vanished, skipped: {payload!r}")
        return

    # Serialise concurrent publishes — websockets.send is not safe to call
    # from multiple coroutines on the same connection without a lock.
    async with _spawn_lock:
        try:
            await ws.send(json.dumps({
                "op": "publish",
                "topic": SPAWN_SIGNAL_TOPIC,
                "msg": {"data": payload},
            }))
            print(f"[spawn] dispatched: {payload!r}")
        except Exception as e:
            print(f"[spawn] publish failed for {namespace!r}: {e!r}")


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

# Per-topic rosbridge subscription spec. throttle_rate is the minimum gap (ms)
# between forwarded messages — 0 means forward every message. We deliberately
# leave /scan and /imu at modest throttles to bound websocket bandwidth, and
# leave event-driven topics (collision_status, ping) unthrottled.
def _topic_specs(ns: str) -> list[dict]:
    return [
        {"topic": f"/{ns}/odom",             "type": "nav_msgs/Odometry",     "throttle_rate": 200},
        {"topic": f"/{ns}/imu",              "type": "sensor_msgs/Imu",       "throttle_rate": 100},
        {"topic": f"/{ns}/scan",             "type": "sensor_msgs/LaserScan", "throttle_rate": 200},
        {"topic": f"/{ns}/ground_truth",     "type": "geometry_msgs/Pose",    "throttle_rate": 200},
        {"topic": f"/{ns}/collision_status", "type": "std_msgs/String",       "throttle_rate": 0},
        {"topic": f"/{ns}/ping",             "type": "std_msgs/String",       "throttle_rate": 0},
    ]


def _quat_to_yaw(qx: float, qy: float, qz: float, qw: float) -> float:
    """Yaw (rotation around Z) extracted from a quaternion — used for 2D heading."""
    siny_cosp = 2.0 * (qw * qz + qx * qy)
    cosy_cosp = 1.0 - 2.0 * (qy * qy + qz * qz)
    return math.atan2(siny_cosp, cosy_cosp)


def _shape_payload(robot_id: str, ns: str, topic: str, m: dict) -> Optional[dict]:
    """
    Convert a rosbridge `publish` message into the JSON shape the frontend
    consumes over the FastAPI relay WS. Returns None when the topic is not
    one we forward — the caller should drop those.
    """
    base = {"robot_id": robot_id}

    if topic == f"/{ns}/odom":
        pos = m.get("pose", {}).get("pose", {}).get("position", {})
        return {
            **base, "type": "odom",
            "x": round(pos.get("x", 0.0), 3),
            "y": round(pos.get("y", 0.0), 3),
        }

    if topic == f"/{ns}/imu":
        la = m.get("linear_acceleration", {})
        av = m.get("angular_velocity", {})
        return {
            **base, "type": "imu",
            "ax": round(la.get("x", 0.0), 3),
            "ay": round(la.get("y", 0.0), 3),
            "az": round(la.get("z", 0.0), 3),
            "gx": round(av.get("x", 0.0), 3),
            "gy": round(av.get("y", 0.0), 3),
            "gz": round(av.get("z", 0.0), 3),
        }

    if topic == f"/{ns}/scan":
        # ranges is typically 360 floats. We pass the array through as a list —
        # FastAPI's send_json will re-serialise on the way out. At 5 Hz with
        # 360 points, this is ~12 KB/s per client — fine for one operator.
        return {
            **base, "type": "scan",
            "ranges": list(m.get("ranges", [])),
            "angle_min":       m.get("angle_min", 0.0),
            "angle_max":       m.get("angle_max", 0.0),
            "angle_increment": m.get("angle_increment", 0.0),
            "range_min":       m.get("range_min", 0.0),
            "range_max":       m.get("range_max", 0.0),
        }

    if topic == f"/{ns}/ground_truth":
        # Gazebo bridges this as geometry_msgs/Pose (NOT Odometry), so there's
        # no nested .pose.pose — we read position/orientation directly.
        pos = m.get("position", {})
        ori = m.get("orientation", {})
        yaw = _quat_to_yaw(
            ori.get("x", 0.0), ori.get("y", 0.0),
            ori.get("z", 0.0), ori.get("w", 1.0),
        )
        return {
            **base, "type": "pose",
            "wx":      round(pos.get("x", 0.0), 3),
            "wy":      round(pos.get("y", 0.0), 3),
            "heading": round(yaw, 4),
        }

    if topic == f"/{ns}/collision_status":
        return {**base, "type": "collision", "status": m.get("data", "")}

    if topic == f"/{ns}/ping":
        # Opaque echo: we forward the timestamp string the frontend originally
        # published (via roslibjs) so it can compute RTT on receive.
        return {**base, "type": "ping", "data": m.get("data", "")}

    return None


async def _rosbridge_subscribe(robot_id: str, namespace: str):
    """
    Subscribes to every relevant ROS topic for `namespace` over a single
    rosbridge WebSocket and forwards shaped payloads onto whichever client
    WebSocket is currently authorised for `robot_id`. Reconnects with backoff
    on disconnect.
    """
    specs = _topic_specs(namespace)

    while True:
        try:
            async with websockets.connect(ROSBRIDGE_URL) as ws:
                print(f"[rosbridge] {robot_id} bağlandı — {len(specs)} topic")

                for t in specs:
                    await ws.send(json.dumps({
                        "op":            "subscribe",
                        "topic":         t["topic"],
                        "type":          t["type"],
                        "throttle_rate": t["throttle_rate"],
                    }))

                async for raw in ws:
                    msg = json.loads(raw)
                    if msg.get("op") != "publish":
                        continue

                    payload = _shape_payload(
                        robot_id, namespace,
                        msg.get("topic", ""), msg.get("msg", {}),
                    )
                    if payload is None:
                        continue

                    client_ws = _active_ws.get(robot_id)
                    if client_ws is None:
                        # Nobody listening — drop on the floor (cheap).
                        continue
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
    return [
        {**info, "id": rid, "session_active": _sessions.get(rid) is not None}
        for rid, info in ROBOT_DATABASE.items()
    ]


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

    # Backend-authoritative spawn dispatch: the frontend never sees the
    # spawn topic, so a tampered client can't request a different SDF or
    # an arbitrary spawn position. The spawner's internal `_spawned` set
    # makes re-claims safe.
    info = ROBOT_DATABASE[clean_id]
    await _publish_spawn_signal(info["namespace"], info["x"], info["y"], info["type"])

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
    target_url = f"http://host.docker.internal:8080/stream?topic=/{namespace}/camera/image_raw"

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

    # Persistent rosbridge connection for spawn dispatches. Started before
    # subscribers so the advertise can complete during the time it takes
    # the per-robot subscribers to connect.
    asyncio.create_task(_spawn_dispatcher_loop())
    print("[spawn] dispatcher görevi başlatıldı")

    # Her robot için rosbridge subscriber başlat
    for rid, info in ROBOT_DATABASE.items():
        asyncio.create_task(_rosbridge_subscribe(rid, info["namespace"]))
        print(f"[rosbridge] {rid} için subscriber başlatıldı")
