"""
ROS dashboard / per-instance simulator session manager.

Each owned robot (UserRobot row) maps to its own Gazebo instance with a unique
namespace `rob{catalog_num}_{user_robot_id}`. The frontend addresses an instance
by `rosRobotId = "ROB-{catalog_num}-{user_robot_id}"`. State (last_x, last_y,
last_theta, last_battery_pct) is persisted on user_robots, written back on
release so the next claim resumes from where the user left off.

Capacity is enforced inside the ROS spawner node (max 3 active models). The
backend awaits a reply on /spawn_response_topic; capacity_reached → HTTP 429.
"""

import asyncio
import json
import math
import re
import time
import uuid
from typing import Optional

import websockets
from fastapi import APIRouter, Header, HTTPException, WebSocket, WebSocketDisconnect, Depends, Request
from fastapi.responses import StreamingResponse
import httpx
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.models.audit import AuditLog
from app.models.robot import RobotCatalog, RobotInventory, UserRobot
from app.models.user import User
from app.core.dependencies import redis_client, get_current_user

router = APIRouter(prefix="/ros", tags=["ROS Dashboard"])

# ── Config ─────────────────────────────────────────────────────────────────────
SESSION_TIMEOUT_S = 15.0
ONLINE_THRESHOLD_S = 5.0
SPAWN_RESPONSE_TIMEOUT_S = 10.0
STREAM_STARTUP_GRACE_S = 12.0   # max seconds to wait for the camera bridge to come up
DEFAULT_SPAWN = (1.0, 0.0, 0.0)        # x, y, theta when last_* is NULL
DEFAULT_BATTERY_PCT = 100.0

ROSBRIDGE_URL = "ws://host.docker.internal:9090"
SPAWN_SIGNAL_TOPIC = "/spawn_signal_topic"
SPAWN_RESPONSE_TOPIC = "/spawn_response_topic"
DESPAWN_SIGNAL_TOPIC = "/despawn_signal_topic"

# Sensor capability per SDF model. Mirrors what's actually wired in the spawner
# bridge command — burgers do not have a camera, waffles do.
_TYPE_SENSORS: dict[str, list[str]] = {
    "waffle": ["imu", "scan", "camera"],
    "burger": ["imu", "scan"],
}
_NS_BASE_TO_TYPE: dict[str, str] = {
    "rob100": "waffle",
    "rob200": "burger",
}
_DEFAULT_TYPE = "burger"
# NOTE: ROB-300 / namespace "rob300" was retired. Adding a new lab requires a
# fresh entry here AND in init_catalog.py FLEET.

# ── Active session state ───────────────────────────────────────────────────────
# robot_id (e.g. "ROB-100-7") → instance dict
_instances: dict[str, dict] = {}
_active_ws: dict[str, WebSocket] = {}     # frontend telemetry sockets
_last_seen: dict[str, float] = {}         # latest telemetry timestamp
_claim_lock = asyncio.Lock()
_loop: Optional[asyncio.AbstractEventLoop] = None

_ROBOT_ID_RE = re.compile(r"^ROB-(\d+)-(\d+)$")


def _parse_robot_id(robot_id: str) -> tuple[int, int]:
    m = _ROBOT_ID_RE.match(robot_id.strip().upper())
    if not m:
        raise HTTPException(status_code=400, detail=f"Geçersiz robot id formatı: {robot_id!r} (örn. ROB-100-7).")
    return int(m.group(1)), int(m.group(2))


def _instance_namespace(catalog_num: int, user_robot_id: int) -> str:
    return f"rob{catalog_num}_{user_robot_id}"


def _instance_robot_id(catalog_num: int, user_robot_id: int) -> str:
    return f"ROB-{catalog_num}-{user_robot_id}"


def _resolve_owned_instance(db: Session, user: User, robot_id: str) -> dict:
    """Validate ownership and assemble everything spawn/release need."""
    catalog_num, user_robot_id = _parse_robot_id(robot_id)
    ow = (
        db.query(UserRobot)
          .filter(UserRobot.id == user_robot_id, UserRobot.user_id == user.id)
          .first()
    )
    if not ow:
        raise HTTPException(status_code=404, detail="Bu robota erişim yetkiniz yok.")
    inv = db.query(RobotInventory).filter(RobotInventory.id == ow.inventory_id).first()
    cat = db.query(RobotCatalog).filter(RobotCatalog.id == inv.catalog_id).first() if inv else None
    if not inv or not cat or not cat.ros_namespace:
        raise HTTPException(status_code=404, detail="Robot katalog kaydı eksik.")
    base_ns = cat.ros_namespace
    base_num_str = base_ns.replace("rob", "")
    if not base_num_str.isdigit() or int(base_num_str) != catalog_num:
        raise HTTPException(status_code=400, detail="Robot id, kayıtlı katalog ile eşleşmiyor.")
    robot_type = _NS_BASE_TO_TYPE.get(base_ns, _DEFAULT_TYPE)
    return {
        "robot_id": robot_id.strip().upper(),
        "namespace": _instance_namespace(catalog_num, user_robot_id),
        "user_robot_id": user_robot_id,
        "catalog_num": catalog_num,
        "user_robot": ow,
        "inventory": inv,
        "catalog": cat,
        "type": robot_type,
        "sensors": _TYPE_SENSORS.get(robot_type, ["imu"]),
    }


def _spawn_pose_and_battery(ow: UserRobot) -> tuple[float, float, float, float]:
    x = ow.last_x if ow.last_x is not None else DEFAULT_SPAWN[0]
    y = ow.last_y if ow.last_y is not None else DEFAULT_SPAWN[1]
    theta = ow.last_theta if ow.last_theta is not None else DEFAULT_SPAWN[2]
    battery = ow.last_battery_pct if ow.last_battery_pct is not None else DEFAULT_BATTERY_PCT
    return x, y, theta, battery


def _log_security_event(db: Session, action: str, details: dict, ip: Optional[str] = None, user_id: Optional[int] = None):
    log = AuditLog(action=action, details=details, ip_address=ip, user_id=user_id)
    db.add(log)
    db.commit()


def _is_online(robot_id: str) -> bool:
    last = _last_seen.get(robot_id)
    return last is not None and (time.time() - last) < ONLINE_THRESHOLD_S


def _quat_to_yaw(qx: float, qy: float, qz: float, qw: float) -> float:
    siny_cosp = 2.0 * (qw * qz + qx * qy)
    cosy_cosp = 1.0 - 2.0 * (qy * qy + qz * qz)
    return math.atan2(siny_cosp, cosy_cosp)


# ── Spawn / despawn dispatcher ─────────────────────────────────────────────────
_spawn_ws: Optional["websockets.WebSocketClientProtocol"] = None
_spawn_ws_ready = asyncio.Event()
_spawn_lock = asyncio.Lock()
_pending_spawns: dict[str, asyncio.Future] = {}  # namespace → future


async def _dispatcher_loop() -> None:
    """Single persistent rosbridge client used to publish spawn/despawn signals
    and to receive spawn-response messages back from the spawner node."""
    global _spawn_ws
    while True:
        try:
            async with websockets.connect(ROSBRIDGE_URL) as ws:
                # Outgoing: spawn + despawn
                await ws.send(json.dumps({
                    "op": "advertise",
                    "topic": SPAWN_SIGNAL_TOPIC,
                    "type": "std_msgs/msg/String",
                }))
                await ws.send(json.dumps({
                    "op": "advertise",
                    "topic": DESPAWN_SIGNAL_TOPIC,
                    "type": "std_msgs/msg/String",
                }))
                # Incoming: spawn responses (success / capacity_reached)
                await ws.send(json.dumps({
                    "op": "subscribe",
                    "topic": SPAWN_RESPONSE_TOPIC,
                    "type": "std_msgs/msg/String",
                }))
                await asyncio.sleep(0.3)
                _spawn_ws = ws
                _spawn_ws_ready.set()
                print(f"[spawn] dispatcher connected; advertised {SPAWN_SIGNAL_TOPIC}, "
                      f"{DESPAWN_SIGNAL_TOPIC}; subscribed {SPAWN_RESPONSE_TOPIC}")

                async for raw in ws:
                    try:
                        msg = json.loads(raw)
                    except Exception:
                        continue
                    if msg.get("op") == "publish" and msg.get("topic") == SPAWN_RESPONSE_TOPIC:
                        try:
                            data = json.loads(msg.get("msg", {}).get("data", "{}"))
                        except Exception:
                            continue
                        ns = data.get("namespace")
                        fut = _pending_spawns.pop(ns, None) if ns else None
                        if fut and not fut.done():
                            fut.set_result(data)
                    elif msg.get("op") == "status":
                        level = msg.get("level", "info")
                        if level in ("warning", "error"):
                            print(f"[spawn] rosbridge {level}: {msg.get('msg', '')}")

        except Exception as e:
            print(f"[spawn] dispatcher disconnected: {e!r} — retry in 3s")
        finally:
            _spawn_ws = None
            _spawn_ws_ready.clear()
            # Fail any in-flight futures so callers don't hang forever.
            for ns, fut in list(_pending_spawns.items()):
                if not fut.done():
                    fut.set_exception(RuntimeError("dispatcher_disconnected"))
            _pending_spawns.clear()
            await asyncio.sleep(3)


async def _publish_spawn_signal(
    namespace: str,
    x: float,
    y: float,
    theta: float,
    robot_type: str,
    battery_pct: float,
) -> dict:
    """Publish a spawn request and await the spawner's response.

    Returns the parsed response dict, or raises:
      - HTTPException(429) if capacity_reached
      - HTTPException(503) if dispatcher unavailable / response timeout
      - HTTPException(500) if spawner reports a different failure
    """
    # Round to keep payload short and parser-friendly.
    payload = f"{namespace},{x:.4f},{y:.4f},{theta:.4f},{robot_type},{battery_pct:.2f}"
    try:
        await asyncio.wait_for(_spawn_ws_ready.wait(), timeout=3.0)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=503, detail="ROS spawn dispatcher hazır değil.")

    ws = _spawn_ws
    if ws is None:
        raise HTTPException(status_code=503, detail="ROS spawn dispatcher bağlı değil.")

    fut: asyncio.Future = asyncio.get_running_loop().create_future()
    _pending_spawns[namespace] = fut

    async with _spawn_lock:
        try:
            await ws.send(json.dumps({
                "op": "publish",
                "topic": SPAWN_SIGNAL_TOPIC,
                "msg": {"data": payload},
            }))
            print(f"[spawn] dispatched: {payload!r}")
        except Exception as e:
            _pending_spawns.pop(namespace, None)
            raise HTTPException(status_code=503, detail=f"Spawn yayını başarısız: {e}")

    try:
        resp = await asyncio.wait_for(fut, timeout=SPAWN_RESPONSE_TIMEOUT_S)
    except asyncio.TimeoutError:
        _pending_spawns.pop(namespace, None)
        raise HTTPException(status_code=503, detail="Spawner yanıt vermedi (timeout).")

    status_str = resp.get("status") or ("success" if resp.get("success") else "error")
    if status_str == "spawned" or status_str == "success":
        return resp
    if status_str == "capacity_reached":
        raise HTTPException(
            status_code=429,
            detail=f"Simülasyon kapasitesi dolu (en fazla {resp.get('limit', 3)} aktif robot).",
        )
    raise HTTPException(status_code=500, detail=f"Spawner hata: {resp.get('reason') or status_str}")


async def _publish_despawn_signal(namespace: str) -> None:
    if not _spawn_ws_ready.is_set() or _spawn_ws is None:
        print(f"[spawn] dispatcher not ready, despawn skipped: {namespace!r}")
        return
    async with _spawn_lock:
        try:
            await _spawn_ws.send(json.dumps({
                "op": "publish",
                "topic": DESPAWN_SIGNAL_TOPIC,
                "msg": {"data": namespace},
            }))
            print(f"[spawn] despawn dispatched: {namespace!r}")
        except Exception as e:
            print(f"[spawn] despawn publish failed for {namespace!r}: {e!r}")


# ── Per-instance telemetry subscriber ──────────────────────────────────────────
def _topic_specs(ns: str) -> list[dict]:
    return [
        {"topic": f"/{ns}/odom",             "type": "nav_msgs/Odometry",     "throttle_rate": 200},
        {"topic": f"/{ns}/imu",              "type": "sensor_msgs/Imu",       "throttle_rate": 100},
        {"topic": f"/{ns}/scan",             "type": "sensor_msgs/LaserScan", "throttle_rate": 200},
        {"topic": f"/{ns}/ground_truth",     "type": "geometry_msgs/Pose",    "throttle_rate": 200},
        {"topic": f"/{ns}/collision_status", "type": "std_msgs/String",       "throttle_rate": 0},
        {"topic": f"/{ns}/ping",             "type": "std_msgs/String",       "throttle_rate": 0},
        {"topic": f"/{ns}/battery_state",    "type": "std_msgs/Float32",      "throttle_rate": 0},
    ]


def _shape_payload(robot_id: str, ns: str, topic: str, m: dict) -> Optional[dict]:
    base = {"robot_id": robot_id}
    if topic == f"/{ns}/odom":
        pos = m.get("pose", {}).get("pose", {}).get("position", {})
        return {**base, "type": "odom",
                "x": round(pos.get("x", 0.0), 3),
                "y": round(pos.get("y", 0.0), 3)}
    if topic == f"/{ns}/imu":
        la = m.get("linear_acceleration", {})
        av = m.get("angular_velocity", {})
        return {**base, "type": "imu",
                "ax": round(la.get("x", 0.0), 3),
                "ay": round(la.get("y", 0.0), 3),
                "az": round(la.get("z", 0.0), 3),
                "gx": round(av.get("x", 0.0), 3),
                "gy": round(av.get("y", 0.0), 3),
                "gz": round(av.get("z", 0.0), 3)}
    if topic == f"/{ns}/scan":
        return {**base, "type": "scan",
                "ranges": list(m.get("ranges", [])),
                "angle_min":       m.get("angle_min", 0.0),
                "angle_max":       m.get("angle_max", 0.0),
                "angle_increment": m.get("angle_increment", 0.0),
                "range_min":       m.get("range_min", 0.0),
                "range_max":       m.get("range_max", 0.0)}
    if topic == f"/{ns}/ground_truth":
        pos = m.get("position", {})
        ori = m.get("orientation", {})
        yaw = _quat_to_yaw(ori.get("x", 0.0), ori.get("y", 0.0), ori.get("z", 0.0), ori.get("w", 1.0))
        return {**base, "type": "pose",
                "wx":      round(pos.get("x", 0.0), 3),
                "wy":      round(pos.get("y", 0.0), 3),
                "heading": round(yaw, 4)}
    if topic == f"/{ns}/collision_status":
        return {**base, "type": "collision", "status": m.get("data", "")}
    if topic == f"/{ns}/ping":
        return {**base, "type": "ping", "data": m.get("data", "")}
    if topic == f"/{ns}/battery_state":
        return {**base, "type": "battery", "pct": round(float(m.get("data", 0.0)), 2)}
    return None


async def _rosbridge_subscribe(robot_id: str, namespace: str, stop_event: asyncio.Event):
    """Subscribe to a single instance's telemetry. Lifetime is bounded by
    stop_event — released when the session ends so we don't accumulate
    subscribers."""
    specs = _topic_specs(namespace)
    while not stop_event.is_set():
        try:
            async with websockets.connect(ROSBRIDGE_URL) as ws:
                print(f"[rosbridge] {robot_id} bağlandı — {len(specs)} topic")
                for t in specs:
                    await ws.send(json.dumps({
                        "op":           "subscribe",
                        "topic":         t["topic"],
                        "type":          t["type"],
                        "throttle_rate": t["throttle_rate"],
                    }))

                async def _reader():
                    async for raw in ws:
                        msg = json.loads(raw)
                        if msg.get("op") != "publish":
                            continue
                        payload = _shape_payload(robot_id, namespace, msg.get("topic", ""), msg.get("msg", {}))
                        if payload is None:
                            continue

                        _last_seen[robot_id] = time.time()

                        # Cache pose/battery in Redis so /release can persist
                        # the final values without an extra round-trip.
                        if payload["type"] == "odom":
                            redis_client.set(f"active_pos:{robot_id}",
                                             json.dumps({"x": payload["x"], "y": payload["y"]}))
                        elif payload["type"] == "pose":
                            redis_client.set(f"active_pose:{robot_id}",
                                             json.dumps({"wx": payload["wx"], "wy": payload["wy"],
                                                         "heading": payload["heading"]}))
                        elif payload["type"] == "battery":
                            redis_client.set(f"active_battery:{robot_id}",
                                             json.dumps({"pct": payload["pct"]}))

                        client_ws = _active_ws.get(robot_id)
                        if client_ws is None:
                            continue
                        try:
                            await client_ws.send_json(payload)
                        except Exception:
                            _active_ws.pop(robot_id, None)

                reader_task = asyncio.create_task(_reader())
                stop_task = asyncio.create_task(stop_event.wait())
                done, pending = await asyncio.wait(
                    {reader_task, stop_task},
                    return_when=asyncio.FIRST_COMPLETED,
                )
                for t in pending:
                    t.cancel()
                if stop_event.is_set():
                    return

        except Exception as e:
            print(f"[rosbridge] {robot_id} bağlantı hatası: {e} — 3s sonra tekrar denenecek")
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=3)
                return
            except asyncio.TimeoutError:
                continue


async def _persist_and_clear(robot_id: str) -> None:
    """Read final pose+battery from Redis and write back to user_robots."""
    pose_raw = redis_client.get(f"active_pose:{robot_id}")
    pos_raw = redis_client.get(f"active_pos:{robot_id}")
    bat_raw = redis_client.get(f"active_battery:{robot_id}")

    final_x = final_y = final_theta = final_battery = None
    if pose_raw:
        try:
            d = json.loads(pose_raw)
            final_x = d.get("wx")
            final_y = d.get("wy")
            final_theta = d.get("heading")
        except Exception:
            pass
    if (final_x is None or final_y is None) and pos_raw:
        try:
            d = json.loads(pos_raw)
            final_x = final_x if final_x is not None else d.get("x")
            final_y = final_y if final_y is not None else d.get("y")
        except Exception:
            pass
    if bat_raw:
        try:
            final_battery = json.loads(bat_raw).get("pct")
        except Exception:
            pass

    if final_x is None and final_y is None and final_battery is None:
        return  # Nothing to persist (robot never sent telemetry).

    db = SessionLocal()
    try:
        _, user_robot_id = _parse_robot_id(robot_id)
        ow = db.query(UserRobot).filter(UserRobot.id == user_robot_id).first()
        if ow:
            if final_x is not None:
                ow.last_x = float(final_x)
            if final_y is not None:
                ow.last_y = float(final_y)
            if final_theta is not None:
                ow.last_theta = float(final_theta)
            if final_battery is not None:
                ow.last_battery_pct = float(final_battery)
            db.commit()
            _log_security_event(
                db, "ROBOT_RELEASED_WITH_STATE",
                {
                    "robot_id": robot_id,
                    "x": ow.last_x, "y": ow.last_y, "theta": ow.last_theta,
                    "battery": ow.last_battery_pct,
                },
                user_id=ow.user_id,
            )
    finally:
        db.close()
        for k in ("active_pos", "active_pose", "active_battery"):
            redis_client.delete(f"{k}:{robot_id}")


# ── Session reaper ─────────────────────────────────────────────────────────────
async def _reap_sessions():
    while True:
        await asyncio.sleep(5)
        now = time.time()
        stale = [rid for rid, s in _instances.items()
                 if now - s["last_heartbeat"] > SESSION_TIMEOUT_S]
        for rid in stale:
            print(f"[session reaper] {rid!r} süresi doldu, despawn ediliyor.")
            await _teardown_instance(rid, persist=True)


async def _teardown_instance(robot_id: str, persist: bool) -> None:
    info = _instances.pop(robot_id, None)
    if not info:
        return
    if persist:
        try:
            await _persist_and_clear(robot_id)
        except Exception as e:
            print(f"[release] persist failed for {robot_id}: {e!r}")
    # Stop subscriber.
    stop_event = info.get("stop_event")
    if stop_event is not None:
        stop_event.set()
    # Close client websocket, if any.
    ws = _active_ws.pop(robot_id, None)
    if ws is not None:
        try:
            await ws.close()
        except Exception:
            pass
    # Tell ROS to despawn.
    await _publish_despawn_signal(info["namespace"])


# ── REST endpoints ─────────────────────────────────────────────────────────────
@router.get("/robots")
def list_robots(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """List the current user's owned robots with simulator state."""
    ownerships = db.query(UserRobot).filter(UserRobot.user_id == user.id).all()
    out = []
    for ow in ownerships:
        inv = db.query(RobotInventory).filter(RobotInventory.id == ow.inventory_id).first()
        if not inv:
            continue
        cat = db.query(RobotCatalog).filter(RobotCatalog.id == inv.catalog_id).first()
        if not cat or not cat.ros_namespace:
            continue
        base_num_str = cat.ros_namespace.replace("rob", "")
        if not base_num_str.isdigit():
            continue
        rid = _instance_robot_id(int(base_num_str), ow.id)
        ns = _instance_namespace(int(base_num_str), ow.id)
        rtype = _NS_BASE_TO_TYPE.get(cat.ros_namespace, _DEFAULT_TYPE)

        # Battery: use live cached value when an instance is active, else the
        # last persisted figure (defaulting to a fresh 100% on first claim).
        live_bat = redis_client.get(f"active_battery:{rid}")
        battery_pct = None
        if live_bat:
            try:
                battery_pct = float(json.loads(live_bat).get("pct"))
            except Exception:
                battery_pct = None
        if battery_pct is None:
            battery_pct = ow.last_battery_pct if ow.last_battery_pct is not None else DEFAULT_BATTERY_PCT

        out.append({
            "id": rid,
            "namespace": ns,
            "name": cat.name,
            "type": rtype,
            "sensors": _TYPE_SENSORS.get(rtype, ["imu"]),
            "online": _is_online(rid),
            "session_active": rid in _instances,
            "battery_pct": round(battery_pct, 2),
            "last_x": ow.last_x,
            "last_y": ow.last_y,
        })
    return out


@router.get("/robot/{robot_id}")
def get_robot(robot_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    info = _resolve_owned_instance(db, user, robot_id)
    rid = info["robot_id"]
    ow = info["user_robot"]

    live_bat = redis_client.get(f"active_battery:{rid}")
    battery_pct = None
    if live_bat:
        try:
            battery_pct = float(json.loads(live_bat).get("pct"))
        except Exception:
            battery_pct = None
    if battery_pct is None:
        battery_pct = ow.last_battery_pct if ow.last_battery_pct is not None else DEFAULT_BATTERY_PCT

    return {
        "id": rid,
        "namespace": info["namespace"],
        "name": info["catalog"].name,
        "type": info["type"],
        "sensors": info["sensors"],
        "online": _is_online(rid),
        "session_active": rid in _instances,
        "battery_pct": round(battery_pct, 2),
        "last_x": ow.last_x,
        "last_y": ow.last_y,
    }


@router.post("/robot/{robot_id}/claim")
async def claim_robot(
    request: Request,
    robot_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    info = _resolve_owned_instance(db, user, robot_id)
    rid = info["robot_id"]
    ns = info["namespace"]
    ow: UserRobot = info["user_robot"]

    # Refuse to spawn a flat battery — frontend already greys out the button,
    # but enforce server-side too.
    saved_battery = ow.last_battery_pct if ow.last_battery_pct is not None else DEFAULT_BATTERY_PCT
    if saved_battery <= 0.0:
        _log_security_event(db, "ROBOT_CLAIM_BLOCKED_FLAT_BATTERY",
                            {"robot_id": rid}, request.client.host, user.id)
        raise HTTPException(status_code=409, detail="Robot bataryası boş — şarj olmadan başlatılamaz.")

    async with _claim_lock:
        existing = _instances.get(rid)
        if existing and time.time() - existing["last_heartbeat"] <= SESSION_TIMEOUT_S:
            _log_security_event(db, "ROBOT_CLAIM_CONFLICT",
                                {"robot_id": rid}, request.client.host, user.id)
            raise HTTPException(status_code=423, detail="Robot şu an başka bir oturumda kullanılıyor.")

        x, y, theta, battery = _spawn_pose_and_battery(ow)

        # Publish spawn + await response. If the spawner refuses (capacity) we
        # propagate a clean 429; nothing is registered locally.
        try:
            await _publish_spawn_signal(ns, x, y, theta, info["type"], battery)
        except HTTPException as e:
            if e.status_code == 429:
                _log_security_event(db, "ROBOT_CLAIM_CAPACITY",
                                    {"robot_id": rid}, request.client.host, user.id)
            raise

        token = str(uuid.uuid4())
        now = time.time()
        stop_event = asyncio.Event()
        _instances[rid] = {
            "token": token,
            "claimed_at": now,
            "last_heartbeat": now,
            "namespace": ns,
            "user_robot_id": ow.id,
            "user_id": user.id,
            "robot_type": info["type"],
            "stop_event": stop_event,
            "subscriber_task": None,
        }
        _instances[rid]["subscriber_task"] = asyncio.create_task(
            _rosbridge_subscribe(rid, ns, stop_event)
        )

        _log_security_event(db, "ROBOT_CLAIMED",
                            {"robot_id": rid, "namespace": ns, "token_prefix": token[:8]},
                            request.client.host, user.id)

    print(f"[session] {rid!r} claim edildi (ns={ns}) — token [{token[:8]}…]")
    return {
        "token": token,
        "namespace": ns,
        "battery_pct": round(battery, 2),
        "spawn_x": x, "spawn_y": y, "spawn_theta": theta,
    }


@router.post("/robot/{robot_id}/heartbeat")
async def heartbeat(robot_id: str, x_session_token: Optional[str] = Header(default=None)):
    rid = robot_id.strip().upper()
    session = _instances.get(rid)
    if not session:
        raise HTTPException(status_code=404, detail="Aktif oturum yok")
    if session["token"] != x_session_token:
        raise HTTPException(status_code=403, detail="Geçersiz oturum tokeni")
    session["last_heartbeat"] = time.time()
    return {"status": "ok"}


@router.delete("/robot/{robot_id}/claim")
@router.post("/robot/{robot_id}/release")
async def release_robot(
    robot_id: str,
    token: Optional[str] = None,
    x_session_token: Optional[str] = Header(default=None),
):
    actual_token = x_session_token or token
    rid = robot_id.strip().upper()
    session = _instances.get(rid)

    if not session or session["token"] != actual_token:
        return {"status": "already_free_or_invalid"}

    await _teardown_instance(rid, persist=True)
    print(f"[session] {rid!r} serbest bırakıldı.")
    return {"status": "released"}


# ── WebSocket (frontend telemetry) ─────────────────────────────────────────────
@router.websocket("/robot/{robot_id}/ws")
async def telemetry_ws(websocket: WebSocket, robot_id: str, token: str):
    rid = robot_id.strip().upper()
    session = _instances.get(rid)

    if not session or session["token"] != token:
        db = SessionLocal()
        _log_security_event(db, "UNAUTHORIZED_WS_ACCESS",
                            {"robot_id": rid, "attempted_token": token})
        db.close()
        await websocket.close(code=4003)
        return

    await websocket.accept()
    _active_ws[rid] = websocket
    print(f"[ws] {rid!r} bağlandı.")

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("command"):
                    db = SessionLocal()
                    db.add(AuditLog(
                        action="ROBOT_COMMAND",
                        details={"robot_id": rid, "command": msg["command"]},
                    ))
                    db.commit()
                    db.close()
            except Exception:
                pass
            if _instances.get(rid, {}).get("token") != token:
                break
    except WebSocketDisconnect:
        pass
    finally:
        if _active_ws.get(rid) == websocket:
            _active_ws.pop(rid, None)
        print(f"[ws] {rid!r} bağlantısı kesildi.")


# ── Video stream ───────────────────────────────────────────────────────────────
@router.get("/robot/{robot_id}/stream")
async def video_stream(robot_id: str, token: str):
    rid = robot_id.strip().upper()
    session = _instances.get(rid)
    if not session or session["token"] != token:
        raise HTTPException(status_code=403, detail="Yetkisiz video erişimi")

    namespace = session["namespace"]
    target_url = f"http://172.17.0.1:8080/stream?topic=/{namespace}/camera/image_raw"

    async def stream_generator():
        deadline = time.time() + STREAM_STARTUP_GRACE_S
        # read=None is mandatory for MJPEG — the connection is held open
        # indefinitely and frames arrive whenever the camera publishes.
        # The 5s default httpx read timeout would kill the stream after
        # the first quiet period, which races against bridge startup.
        timeout = httpx.Timeout(connect=5.0, read=None)

        while True:
            # Session was revoked while waiting to retry — stop immediately.
            if _instances.get(rid, {}).get("token") != token:
                return

            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    async with client.stream("GET", target_url) as r:
                        async for chunk in r.aiter_bytes():
                            if _instances.get(rid, {}).get("token") != token:
                                return
                            yield chunk
                return  # clean end-of-stream

            except (httpx.ConnectError, httpx.ReadTimeout, httpx.RemoteProtocolError) as e:
                # Bridge subprocess not up yet, or no frames during startup —
                # retry every second until the grace window expires.
                if time.time() > deadline:
                    print(f"[stream] {rid}: bridge did not become ready within "
                          f"{STREAM_STARTUP_GRACE_S}s ({e!r}); giving up.")
                    return
                await asyncio.sleep(1.0)

            except Exception as e:
                print(f"[stream] {rid}: unexpected stream error: {e!r}")
                return

    return StreamingResponse(
        stream_generator(),
        media_type="multipart/x-mixed-replace; boundary=boundarydonotcross",
    )


# ── Startup ────────────────────────────────────────────────────────────────────
async def ros_startup(loop: asyncio.AbstractEventLoop):
    global _loop
    _loop = loop
    asyncio.create_task(_reap_sessions())
    asyncio.create_task(_dispatcher_loop())
    print("[ros] startup tasks scheduled (dispatcher + reaper)")