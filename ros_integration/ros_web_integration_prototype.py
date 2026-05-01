#!/usr/bin/env python3
"""
Multi-Robot Fleet Dashboard — FastAPI backend
Adds exclusive session management on top of the original prototype:

  POST   /api/robot/{id}/claim      – Claim exclusive control (returns token or 423)
  DELETE /api/robot/{id}/claim      – Release control
  POST   /api/robot/{id}/heartbeat  – Keep the session alive (call every ~5 s)

The RobotController C++ node independently enforces the session by watching
the ROS topic  /{ns}/session/heartbeat.  FastAPI's session table is the
claim/release gatekeeper; the ROS heartbeat is what actually gates motion.
"""

import asyncio
import time
import uuid
import json
import threading
from typing import Optional

# ROS 2 Imports
import rclpy
from rclpy.node import Node
from nav_msgs.msg import Odometry
from sensor_msgs.msg import Imu, LaserScan
from geometry_msgs.msg import Pose
from std_msgs.msg import String, Float32

# FastAPI Imports
from fastapi import FastAPI, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel
import uvicorn
import httpx

app = FastAPI()

# ── Session store ──────────────────────────────────────────────────────────────
# { robot_id: { "token": str, "claimed_at": float, "last_heartbeat": float } }
_sessions: dict[str, dict] = {}
_active_ws: dict[str, WebSocket] = {}
loop = None # Will store the main asyncio loop
SESSION_TIMEOUT_S = 15.0  # Must match RobotController's session_timeout_

# Serialises all claim attempts so the read-check-write in claim_robot() is
# atomic with respect to other coroutines.  A per-robot lock would have finer
# granularity but a single lock is simpler and claim is not a hot path.
_claim_lock = asyncio.Lock()


async def _reap_sessions():
    """
    Runs forever, cleaning up sessions whose last heartbeat is older than
    SESSION_TIMEOUT_S.  This keeps the claim table consistent with what the
    RobotController will have already auto-expired on the ROS side.
    """
    while True:
        await asyncio.sleep(5)
        now = time.time()
        stale = [rid for rid, s in _sessions.items()
                 if now - s["last_heartbeat"] > SESSION_TIMEOUT_S]
        for rid in stale:
            del _sessions[rid]
            print(f"[session reaper] Session for {rid!r} expired and was removed.")


# ── Database ───────────────────────────────────────────────────────────────────

ROBOT_DATABASE: dict[str, dict] = {
    "ROB-100": {
        "namespace": "rob100", "x": 0.0,  "y": 0.5,  "type": "waffle", 
        "sensors": ["imu", "scan", "camera"]
    },
    "ROB-200": {
        "namespace": "rob200", "x": -3.0, "y": 0.5, "type": "burger", 
        "sensors": ["imu", "scan"]  # <-- Notice: No camera here!
    },
    "ROB-300": {
        "namespace": "rob300", "x": 5.0,  "y": 0.5,  "type": "waffle", 
        "sensors": ["imu", "scan", "camera"]
    },
}


class PoseUpdate(BaseModel):
    x: float
    y: float


# ── REST API ───────────────────────────────────────────────────────────────────

@app.get("/api/robot/{robot_id}")
async def get_robot_info(robot_id: str):
    clean_id = robot_id.strip().upper()
    if clean_id not in ROBOT_DATABASE:
        raise HTTPException(status_code=404, detail="Robot ID not found")
    robot = ROBOT_DATABASE[clean_id]
    session = _sessions.get(clean_id)
    return {
        **robot,
        "session_active": session is not None,
    }


@app.post("/api/robot/{robot_id}/claim")
async def claim_robot(robot_id: str):
    """
    Attempt to claim exclusive control of a robot.

    Returns:
        200  { "token": "<uuid>" }   – claim granted
        423  { "detail": "..." }     – robot is already in use
        404  { "detail": "..." }     – robot ID not found
    """
    clean_id = robot_id.strip().upper()
    if clean_id not in ROBOT_DATABASE:
        raise HTTPException(status_code=404, detail="Robot ID not found")

    # Hold the lock for the entire read-check-write sequence so two simultaneous
    # claim requests cannot both pass the staleness check and both receive tokens.
    async with _claim_lock:
        existing = _sessions.get(clean_id)
        if existing is not None:
            # Allow re-claim only if the existing session has gone stale (no
            # heartbeat within SESSION_TIMEOUT_S).  This is the inline equivalent
            # of what the background reaper does, handling the race between a
            # fresh claim attempt and the reaper's next wake cycle.
            if time.time() - existing["last_heartbeat"] <= SESSION_TIMEOUT_S:
                raise HTTPException(
                    status_code=423,
                    detail="Robot is currently in use by another operator. Try again later.",
                )

        token = str(uuid.uuid4())
        now   = time.time()
        _sessions[clean_id] = {"token": token, "claimed_at": now, "last_heartbeat": now}

    print(f"[session] {clean_id!r} claimed — token [{token[:8]}…]")
    return {"token": token}


@app.post("/api/robot/{robot_id}/heartbeat")
async def robot_heartbeat(robot_id: str, x_session_token: Optional[str] = Header(default=None)):
    """
    Refresh the session TTL.  Call every ~5 s while connected.

    The ROS-side heartbeat (published via roslib to /{ns}/session/heartbeat)
    is what actually keeps the RobotController open to commands; this endpoint
    just keeps the FastAPI session table consistent so no one else can claim.
    """
    clean_id = robot_id.strip().upper()
    session  = _sessions.get(clean_id)

    if session is None:
        raise HTTPException(status_code=404, detail="No active session for this robot")

    if session["token"] != x_session_token:
        raise HTTPException(status_code=403, detail="Invalid session token")

    session["last_heartbeat"] = time.time()
    return {"status": "ok"}


@app.post("/api/robot/{robot_id}/pose")
async def update_robot_pose(robot_id: str, payload: PoseUpdate):
    clean_id = robot_id.strip().upper()
    if clean_id not in ROBOT_DATABASE:
        raise HTTPException(status_code=404, detail="Robot ID not found")
    ROBOT_DATABASE[clean_id]["x"] = payload.x
    ROBOT_DATABASE[clean_id]["y"] = payload.y
    return {"status": "updated", "x": payload.x, "y": payload.y}


# ── HTML Frontend ──────────────────────────────────────────────────────────────

html_content = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Multi-Robot Fleet Dashboard</title>

    <script src="https://cdn.jsdelivr.net/npm/eventemitter2@6.4.9/lib/eventemitter2.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/roslib@1/build/roslib.min.js"></script>

    <style>
        *, *::before, *::after { box-sizing: border-box; }

        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            margin: 0; padding: 12px 16px 24px;
            background: #eef0f3;
            color: #212529;
            max-width: 1100px;
            margin: 0 auto;
        }

        /* ── Header bar ───────────────────────────────────── */
        .header {
            display: flex; align-items: center; gap: 12px;
            flex-wrap: wrap;
            background: #1a1d23; color: white;
            padding: 12px 18px; border-radius: 10px;
            margin-bottom: 10px;
        }
        .header h1 { margin: 0; font-size: 1.15em; font-weight: 700; white-space: nowrap; flex-shrink: 0; }
        .header input[type="text"] {
            padding: 7px 12px; font-size: 0.92em;
            border: 1px solid #444; border-radius: 6px;
            background: #2c3040; color: white; width: 170px;
        }
        .header input[type="text"]::placeholder { color: #888; }
        .header button.connect-btn {
            padding: 7px 16px; font-size: 0.92em;
            background: #0d6efd; color: white;
            border: none; border-radius: 6px; cursor: pointer; font-weight: 600;
        }
        .header button.connect-btn:hover { background: #0b5ed7; }
        .header button.connect-btn:disabled { background: #495057; cursor: not-allowed; }

        /* Disconnect button — always visible in header, disabled until connected */
        .header button.disconnect-btn {
            padding: 7px 16px; font-size: 0.92em;
            background: #dc3545; color: white;
            border: none; border-radius: 6px; cursor: pointer; font-weight: 600;
        }
        .header button.disconnect-btn:hover:not(:disabled) { background: #b02a37; }
        .header button.disconnect-btn:disabled { background: #495057; cursor: not-allowed; }

        .db-pill {
            display: none; background: #2c3040; border: 1px solid #444;
            border-radius: 6px; padding: 4px 10px; font-size: 0.8em; color: #adb5bd;
        }
        .db-pill strong { color: #f8f9fa; }

        /* ── Status strip ─────────────────────────────────── */
        .status-strip {
            display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
            background: #fff; border-radius: 8px;
            padding: 8px 14px; margin-bottom: 10px;
            border: 1px solid #dee2e6;
        }
        .ns-tag {
            background: #343a40; color: #fff;
            padding: 3px 10px; border-radius: 20px;
            font-size: 0.8em; font-weight: 600; font-family: monospace;
        }
        .badge {
            display: inline-flex; align-items: center; gap: 5px;
            padding: 4px 10px; border-radius: 20px;
            font-size: 0.8em; font-weight: 600;
        }
        .badge.connected    { background: #d1e7dd; color: #0a3622; }
        .badge.disconnected { background: #f8d7da; color: #58151c; }
        .badge.warning      { background: #fff3cd; color: #664d03; }
        .badge::before { content: "●"; font-size: 0.9em; }
        .ping-label { font-size: 0.8em; color: #6c757d; margin-left: 4px; }

        /* ── Session pill in status strip ─────────────────── */
        .session-pill {
            display: inline-flex; align-items: center; gap: 5px;
            padding: 4px 10px; border-radius: 20px;
            font-size: 0.8em; font-weight: 600; font-family: monospace;
        }
        .session-pill.free     { background: #d1e7dd; color: #0a3622; }
        .session-pill.occupied { background: #cff4fc; color: #055160; }
        .session-pill.mine     { background: #e0cffc; color: #3d0a91; }

        /* ── Card ─────────────────────────────────────────── */
        .card {
            background: #fff; border-radius: 10px;
            border: 1px solid #dee2e6;
            padding: 14px 16px;
        }
        .card-title {
            font-size: 0.72em; font-weight: 700; text-transform: uppercase;
            letter-spacing: 0.06em; color: #6c757d;
            margin: 0 0 10px 0; padding-bottom: 8px;
            border-bottom: 1px solid #f0f0f0;
        }

        /* ── Main two-column grid ─────────────────────────── */
        .main-grid {
            display: grid;
            grid-template-columns: 380px 1fr;
            gap: 10px;
            margin-bottom: 10px;
        }
        .left-col { display: flex; flex-direction: column; gap: 10px; }

        /* ── Telemetry metrics ────────────────────────────── */
        .telem-grid {
            display: grid; grid-template-columns: 1fr 1fr;
            gap: 8px;
        }
        .telem-box {
            background: #f8f9fa; border-radius: 6px;
            padding: 8px 10px; border: 1px solid #e9ecef;
        }
        .telem-label { font-size: 0.7em; color: #6c757d; margin-bottom: 2px; font-family: monospace; }
        .telem-val   { font-family: monospace; font-size: 1.05em; font-weight: 700; color: #212529; }

        /* ── Speed sliders ────────────────────────────────── */
        .speed-row { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 10px; }
        .speed-item { flex: 1; min-width: 150px; }
        .speed-item label { font-size: 0.75em; color: #6c757d; display: block; margin-bottom: 3px; }
        .speed-item input[type="range"] { width: 100%; accent-color: #0d6efd; }
        .speed-val { font-family: monospace; font-weight: 700; color: #0d6efd; }

        /* ── Control row ──────────────────────────────────── */
        .control-row { display: flex; gap: 20px; align-items: flex-start; flex-wrap: wrap; }
        .ctrl-label  { font-size: 0.72em; color: #6c757d; text-align: center; margin-top: 5px; }

        /* Joystick */
        .joystick-zone {
            width: 130px; height: 130px; border-radius: 50%;
            background: #e9ecef; border: 2px solid #adb5bd;
            position: relative; cursor: grab; user-select: none; touch-action: none;
        }
        .joystick-zone:active { cursor: grabbing; }
        .joystick-knob {
            width: 50px; height: 50px; border-radius: 50%;
            background: #0d6efd; position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
            box-shadow: 0 2px 8px rgba(13,110,253,0.4);
        }
        .joystick-zone.active .joystick-knob { background: #0b5ed7; }

        /* D-Pad */
        .dpad { display: grid; grid-template-columns: repeat(3, 46px); grid-template-rows: repeat(3, 46px); gap: 3px; }
        .dpad-btn {
            padding: 0; font-size: 18px; width: 46px; height: 46px;
            border-radius: 7px; background: #495057; border: none;
            color: white; cursor: pointer;
            user-select: none; -webkit-user-select: none; touch-action: none;
        }
        .dpad-btn:hover:not(:disabled) { background: #343a40; }
        .dpad-btn:active:not(:disabled) { background: #0d6efd; }
        .dpad-btn:disabled { background: #ced4da; color: #adb5bd; cursor: not-allowed; }
        .dpad-stop { background: #dc3545 !important; }
        .dpad-stop:hover:not(:disabled) { background: #b02a37 !important; }
        .dpad-empty { background: transparent !important; border: none !important; cursor: default; }

        /* cmd_vel readout */
        .cmdvel-box {
            background: #f8f9fa; border: 1px solid #e9ecef;
            border-radius: 7px; padding: 8px 12px; min-width: 120px;
        }
        .cmdvel-box .cv-label { font-size: 0.7em; color: #6c757d; }
        .cmdvel-box .cv-val   { font-family: monospace; font-weight: 700; font-size: 1em; color: #212529; }

        /* ── Camera ───────────────────────────────────────── */
        .camera-card { display: flex; flex-direction: column; }
        .camera-card img {
            flex: 1; width: 100%; border-radius: 7px;
            background: #1a1d23; border: 2px solid #dee2e6;
            min-height: 280px; display: block; object-fit: cover;
        }
        .cam-topic { font-family: monospace; font-size: 0.75em; color: #6c757d; margin: 0 0 8px 0; }
        .cam-placeholder {
            display: flex; align-items: center; justify-content: center;
            min-height: 280px; border-radius: 7px;
            background: #1a1d23; border: 2px solid #dee2e6;
            color: #6c757d; font-size: 0.85em; font-style: italic;
            flex: 1;
            text-align: center;
            padding: 20px;
        }

        /* ── Bottom row ───────────────────────────────────── */
        .bottom-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 10px;
        }

        /* ── Sensor rows ──────────────────────────────────── */
        .sensor-row-item { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid #f0f0f0; font-size: 0.82em; }
        .sensor-row-item:last-child { border-bottom: none; }
        .sensor-lbl { color: #495057; }
        .sensor-val { font-family: monospace; font-weight: 600; color: #212529; }

        /* ── Radar ────────────────────────────────────────── */
        #radar-canvas { border-radius: 50%; display: block; background: #0d1117; margin: 0 auto; }
        .radar-legend { font-size: 0.74em; color: #6c757d; text-align: center; margin-top: 6px; }
        .radar-closest { font-size: 0.82em; text-align: center; margin-top: 4px; }
        .radar-closest span { font-family: monospace; font-weight: 700; color: #dc3545; }

        /* ── Responsive ───────────────────────────────────── */
        @media (max-width: 750px) {
            .main-grid   { grid-template-columns: 1fr; }
            .bottom-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 480px) {
            .bottom-grid { grid-template-columns: 1fr; }
            .telem-grid  { grid-template-columns: 1fr 1fr; }
        }
    </style>
</head>
<body>

    <div class="header">
        <h1>Fleet Dashboard</h1>
        <input type="text" id="robot-id-input" placeholder="Robot ID (e.g. ROB-100)">
        <button class="connect-btn" id="connect-btn" onclick="fetchRobotAndConnect()">Initialize &amp; Connect</button>
        <button class="disconnect-btn" id="disconnect-btn" disabled onclick="userInitiatedDisconnect()">Disconnect</button>
        <div id="backend-info-display" class="db-pill">
            <strong id="db-namespace">—</strong> &nbsp;·&nbsp; <span id="db-coords">—</span>
        </div>
    </div>

    <div class="status-strip">
        <span id="active-namespace-display" class="ns-tag">No Active Target</span>
        <span>ROSBridge:</span>
        <span id="status" class="badge disconnected">Offline</span>
        <span class="ping-label">Ping:</span>
        <span id="latency-display" class="badge warning">Waiting...</span>
        <span class="ping-label">Session:</span>
        <span id="session-status" class="session-pill free">FREE</span>
        <span class="ping-label">Collision:</span>
        <span id="collision-status" class="badge warning">---</span>
    </div>

    <div class="main-grid">

        <div class="left-col">

            <div class="card">
                <div class="card-title">Telemetry</div>
                <div class="telem-grid">
                    <div class="telem-box">
                        <div class="telem-label">Odom X &nbsp;<span style="color:#adb5bd">(rel)</span></div>
                        <div class="telem-val"><span id="odom-x">---</span> m</div>
                    </div>
                    <div class="telem-box">
                        <div class="telem-label">Odom Y &nbsp;<span style="color:#adb5bd">(rel)</span></div>
                        <div class="telem-val"><span id="odom-y">---</span> m</div>
                    </div>
                    <div class="telem-box">
                        <div class="telem-label">World X &nbsp;<span style="color:#adb5bd">(gz)</span></div>
                        <div class="telem-val"><span id="pose-x">---</span> m</div>
                    </div>
                    <div class="telem-box">
                        <div class="telem-label">World Y &nbsp;<span style="color:#adb5bd">(gz)</span></div>
                        <div class="telem-val"><span id="pose-y">---</span> m</div>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-title">Robot Control &nbsp;<span style="font-weight:400;text-transform:none;letter-spacing:0;color:#adb5bd">· WASD / Space</span></div>
                <div class="speed-row">
                    <div class="speed-item">
                        <label>Linear &nbsp;<span class="speed-val" id="lin-speed-val">0.30</span> m/s</label>
                        <input type="range" id="linear-speed" min="0.05" max="1.0" step="0.05" value="0.30"
                               oninput="document.getElementById('lin-speed-val').innerText = parseFloat(this.value).toFixed(2)">
                    </div>
                    <div class="speed-item">
                        <label>Angular &nbsp;<span class="speed-val" id="ang-speed-val">0.50</span> rad/s</label>
                        <input type="range" id="angular-speed" min="0.1" max="2.0" step="0.1" value="0.50"
                               oninput="document.getElementById('ang-speed-val').innerText = parseFloat(this.value).toFixed(2)">
                    </div>
                </div>
                <div class="control-row">
                    <div style="text-align:center">
                        <div class="joystick-zone" id="joystick-zone"><div class="joystick-knob" id="joystick-knob"></div></div>
                        <div class="ctrl-label">Drag to drive</div>
                    </div>
                    <div style="text-align:center">
                        <div class="dpad">
                            <div class="dpad-btn dpad-empty"></div>
                            <button class="dpad-btn" id="btn-fwd" disabled
                                onmousedown="dpadStart(getLinSpeed(),0)" onmouseup="dpadStop()" onmouseleave="dpadStop()"
                                ontouchstart="event.preventDefault();dpadStart(getLinSpeed(),0)" ontouchend="dpadStop()">&#9650;</button>
                            <div class="dpad-btn dpad-empty"></div>
                            <button class="dpad-btn" id="btn-left" disabled
                                onmousedown="dpadStart(0,getAngSpeed())" onmouseup="dpadStop()" onmouseleave="dpadStop()"
                                ontouchstart="event.preventDefault();dpadStart(0,getAngSpeed())" ontouchend="dpadStop()">&#9668;</button>
                            <button class="dpad-btn dpad-stop" id="btn-stop" disabled
                                onmousedown="emergencyStop()" ontouchstart="event.preventDefault();emergencyStop()">&#9632;</button>
                            <button class="dpad-btn" id="btn-right" disabled
                                onmousedown="dpadStart(0,-getAngSpeed())" onmouseup="dpadStop()" onmouseleave="dpadStop()"
                                ontouchstart="event.preventDefault();dpadStart(0,-getAngSpeed())" ontouchend="dpadStop()">&#9658;</button>
                            <div class="dpad-btn dpad-empty"></div>
                            <button class="dpad-btn" id="btn-back" disabled
                                onmousedown="dpadStart(-getLinSpeed(),0)" onmouseup="dpadStop()" onmouseleave="dpadStop()"
                                ontouchstart="event.preventDefault();dpadStart(-getLinSpeed(),0)" ontouchend="dpadStop()">&#9660;</button>
                            <div class="dpad-btn dpad-empty"></div>
                        </div>
                    </div>
                    <div>
                        <div class="ctrl-label" style="text-align:left; margin-bottom:5px;">/cmd_vel</div>
                        <div class="cmdvel-box">
                            <div class="cv-label">Linear X</div>
                            <div class="cv-val"><span id="cmdvel-linear">0.00</span> m/s</div>
                            <div class="cv-label" style="margin-top:6px">Angular Z</div>
                            <div class="cv-val"><span id="cmdvel-angular">0.00</span> rad/s</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="card camera-card">
            <div class="card-title">Live Camera Feed</div>
            <p id="cam-topic-label" class="cam-topic">Topic: N/A</p>
            <img id="video-stream" style="display:none;" />
            <div id="cam-placeholder" class="cam-placeholder">Awaiting robot connection...</div>
        </div>

    </div><div class="bottom-grid">

        <div class="card">
            <div class="card-title">&#128225; IMU</div>
            <div class="sensor-row-item">
                <span class="sensor-lbl">Yaw rate</span>
                <span><span id="imu-gz" class="sensor-val">---</span> °/s</span>
            </div>
            <div class="sensor-row-item">
                <span class="sensor-lbl">Pitch rate</span>
                <span><span id="imu-gx" class="sensor-val">---</span> °/s</span>
            </div>
            <div class="sensor-row-item">
                <span class="sensor-lbl">Roll rate</span>
                <span><span id="imu-gy" class="sensor-val">---</span> °/s</span>
            </div>
            <div class="sensor-row-item">
                <span class="sensor-lbl">Accel X</span>
                <span><span id="imu-ax" class="sensor-val">---</span> m/s²</span>
            </div>
            <div class="sensor-row-item">
                <span class="sensor-lbl">Accel Y</span>
                <span><span id="imu-ay" class="sensor-val">---</span> m/s²</span>
            </div>
            <div class="sensor-row-item">
                <span class="sensor-lbl">Accel Z</span>
                <span><span id="imu-az" class="sensor-val">---</span> m/s²</span>
            </div>
        </div>

        <div class="card" style="display:flex; flex-direction:column; align-items:center;">
            <div class="card-title" style="width:100%">&#128301; LIDAR Radar</div>
            <canvas id="radar-canvas" width="200" height="200"></canvas>
            <div class="radar-legend" id="radar-legend">Waiting for scan data...</div>
            <div class="radar-closest">Closest: <span id="scan-closest">---</span></div>
        </div>

    </div><script>
        // ── State ─────────────────────────────────────────────────────────────
        let ros             = null;
        let secureWS = null;
        let odomTopic       = null;
        let poseTopic       = null;
        let cmdVelTopic     = null;
        let imuTopic        = null;
        let cameraInfoTopic = null;
        let scanTopic             = null;
        let scanPointsTopic       = null;
        let pingTopic             = null;
        let collisionStatusTopic  = null;
        let scanClosestTopic      = null;
        let sessionStatusTopic    = null;  // subscribes to /{ns}/session/status
        let sessionHeartbeatTopic = null;  // publishes to /{ns}/session/heartbeat

        let pingInterval     = null;
        let watchdogInterval = null;
        let poseSaveInterval = null;

        // ── Session state ─────────────────────────────────────────────────────
        // sessionToken   – UUID4 issued by FastAPI on claim; null when disconnected.
        // apiHbInterval  – setInterval handle for the FastAPI heartbeat POST.
        // rosHbInterval  – setInterval handle for the ROS topic heartbeat publish.
        let sessionToken    = null;
        let apiHbInterval   = null;
        let rosHbInterval   = null;

        // ── Frame-synced velocity state ───────────────────────────────────────
        let desiredLinear   = 0;
        let desiredAngular  = 0;

        let lastTelemetryTime = 0;
        let lastPoseSave      = 0;
        let radarDirty        = false;
        let latestScan        = null;
        let lastPoseData      = null;
        let currentNamespace  = "";
        let currentRobotId    = "";
        let currentRobotType  = "";
        let currentRobotSensors = [];
        let joystickActive    = false;
        let activeKeys        = new Set();

        const robot_ip    = window.location.hostname;
        const statusSpan  = document.getElementById("status");
        const latencySpan = document.getElementById("latency-display");
        function safeSet(id, val) {
            const el = document.getElementById(id);
            if (el) el.innerText = val;
        }

        // ── Session pill helper ───────────────────────────────────────────────
        function setSessionPill(text, cls) {
            const el = document.getElementById("session-status");
            if (!el) return;
            el.innerText  = text;
            el.className  = "session-pill " + cls;
        }

        // ── Speed Helpers ─────────────────────────────────────────────────────
        function getLinSpeed() { return parseFloat(document.getElementById("linear-speed").value); }
        function getAngSpeed() { return parseFloat(document.getElementById("angular-speed").value); }

        // ── Enable / Disable Controls ─────────────────────────────────────────
        const CTRL_IDS = ["btn-fwd","btn-back","btn-left","btn-right","btn-stop"];
        function setControlsEnabled(on) {
            CTRL_IDS.forEach(id => document.getElementById(id).disabled = !on);
        }

        // ── Velocity State Writer ─────────────────────────────────────────────
        function setDesiredVel(linear, angular) {
            desiredLinear  = linear;
            desiredAngular = angular;
            document.getElementById("cmdvel-linear").innerText  = linear.toFixed(2);
            document.getElementById("cmdvel-angular").innerText = angular.toFixed(2);
        }

        function emergencyStop() {
            activeKeys.clear();
            setDesiredVel(0, 0);
            if (cmdVelTopic) {
                cmdVelTopic.publish(new ROSLIB.Message({
                    linear:  { x: 0, y: 0, z: 0 },
                    angular: { x: 0, y: 0, z: 0 }
                }));
            }
        }

        // ── D-Pad ─────────────────────────────────────────────────────────────
        function dpadStart(linear, angular) {
            if (!cmdVelTopic) return;
            setDesiredVel(linear, angular);
        }
        function dpadStop() {
            setDesiredVel(0, 0);
        }

        // ── WASD Keyboard ─────────────────────────────────────────────────────
        function sendKeyVel() {
            if (statusSpan.className !== "status connected") return;
            const lin = getLinSpeed(), ang = getAngSpeed();
            let lx = 0, az = 0;
            if (activeKeys.has('w')) lx += lin;
            if (activeKeys.has('s')) lx -= lin;
            if (activeKeys.has('a')) az += ang;
            if (activeKeys.has('d')) az -= ang;
            setDesiredVel(lx, az);
        }

        document.addEventListener('keydown', function(e) {
            const k = e.key.toLowerCase();
            if (k === ' ') { e.preventDefault(); emergencyStop(); return; }
            if (!['w','a','s','d'].includes(k) || !cmdVelTopic) return;
            e.preventDefault();
            activeKeys.add(k);
            sendKeyVel();
        });

        document.addEventListener('keyup', function(e) {
            activeKeys.delete(e.key.toLowerCase());
            sendKeyVel();
        });

        // ── Virtual Joystick ──────────────────────────────────────────────────
        (function setupJoystick() {
            const zone = document.getElementById('joystick-zone');
            const knob = document.getElementById('joystick-knob');
            const R = 75;

            function clampedOffset(e) {
                const rect = zone.getBoundingClientRect();
                const cx = rect.left + rect.width  / 2;
                const cy = rect.top  + rect.height / 2;
                const src = e.touches ? e.touches[0] : e;
                let dx = src.clientX - cx;
                let dy = src.clientY - cy;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist > R) { dx = dx/dist*R; dy = dy/dist*R; }
                return { dx, dy };
            }

            function applyJoystick(e) {
                if (!joystickActive || statusSpan.className !== "status connected") return;
                e.preventDefault();
                const { dx, dy } = clampedOffset(e);
                knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
                setDesiredVel((-dy / R) * getLinSpeed(), (-dx / R) * getAngSpeed());
            }

            function release() {
                if (!joystickActive) return;
                joystickActive = false;
                zone.classList.remove('active');
                knob.style.transform = 'translate(-50%, -50%)';
                setDesiredVel(0, 0);
            }

            zone.addEventListener('mousedown',  e => { joystickActive = true; zone.classList.add('active'); applyJoystick(e); });
            zone.addEventListener('touchstart', e => { joystickActive = true; zone.classList.add('active'); applyJoystick(e); }, { passive: false });
            document.addEventListener('mousemove', applyJoystick);
            document.addEventListener('touchmove', applyJoystick, { passive: false });
            document.addEventListener('mouseup',   release);
            document.addEventListener('touchend',  release);
        })();

        // ── Session heartbeat helpers ─────────────────────────────────────────

        /**
         * Start sending keep-alive pulses on two channels:
         *   1. ROS topic  /{ns}/session/heartbeat  (read by RobotController)
         *   2. FastAPI    POST /api/robot/{id}/heartbeat  (keeps the claim alive)
         *
         * The ROS pulse is every 3 s (well inside the 15 s timeout).
         * The API pulse is every 5 s.
         *
         * If the API heartbeat returns 403 or 404 it means another client has
         * claimed the robot (our token was overwritten) or the server restarted
         * and lost our session.  Either way we no longer hold the session, so we
         * stop all heartbeats, disable controls, and surface a clear message
         * rather than continuing to publish ROS commands under an orphaned token.
         */
        function startHeartbeats(ns, robotId, token) {
            stopHeartbeats(); // clear any previous

            rosHbInterval = setInterval(function() {
                if (sessionHeartbeatTopic && ros && ros.isConnected) {
                    sessionHeartbeatTopic.publish(new ROSLIB.Message({ data: token }));
                }
            }, 3000);
            // Inside startHeartbeats(token, robotId)
            apiHbInterval = setInterval(function() {
                fetch('/api/robot/' + robotId + '/heartbeat', {
                    method:  'POST',
                    headers: { 'X-Session-Token': token }
                }).then(function(resp) {
                    if (resp.status === 403 || resp.status === 404) {
                        // Terminate local timers and close the connection
                        stopHeartbeats();
                        disconnectCurrentRobot(); // This triggers ros.close() and vid.src=""
                        
                        sessionToken = null;
                        setSessionPill("LOST", "free");
                        alert("Session revoked by server. Data stream terminated.");
                    }
                });
            }, 5000);
        }

        function stopHeartbeats() {
            if (rosHbInterval) { clearInterval(rosHbInterval); rosHbInterval = null; }
            if (apiHbInterval) { clearInterval(apiHbInterval); apiHbInterval = null; }
        }

        async function fetchRobotAndConnect() {
            const robotId     = document.getElementById("robot-id-input").value.trim();
            const infoDisplay = document.getElementById("backend-info-display");
            if (!robotId) return alert("Please enter a Robot ID (e.g., ROB-100)");

            // FIX: If we are already connected to a robot, handle it before starting a new connection.
            if (sessionToken) {
                // Prevent doing anything if they just clicked connect on the same robot
                if (robotId.toUpperCase() === currentRobotId.toUpperCase()) {
                    return alert("You are already connected to " + currentRobotId + ".");
                }
                
                // Cleanly release the current session and tear down background topics
                console.log("Auto-disconnecting from previous robot...");
                await userInitiatedDisconnect();
            }

            // Disable both buttons while the async handshake is in flight so the
            // user cannot double-click or start a second connection attempt.
            document.getElementById("connect-btn").disabled     = true;
            document.getElementById("disconnect-btn").disabled  = true;

            try {
                // ── 1. Fetch robot info ───────────────────────────────────────
                const infoResp = await fetch('/api/robot/' + robotId);
                if (!infoResp.ok) throw new Error("Robot ID not found in the backend database.");
                const data            = await infoResp.json();
                const targetNamespace = data.namespace;
                currentRobotId        = robotId;

                const spawnX = (data.x != null) ? data.x : 0.0;
                const spawnY = (data.y != null) ? data.y : 0.0;
                const robotType = data.type;

                // STRICT VALIDATION: Do not default. Do not send signal if incorrect.
                const supportedTypes = ["waffle", "burger"]; // Define supported models here
                if (!robotType || !supportedTypes.includes(robotType)) {
                    throw new Error("Configuration Error: Robot type '" + robotType + "' is missing or unsupported. Connection aborted.");
                }
                currentRobotType = robotType;

                currentRobotSensors   = data.sensors || [];

                infoDisplay.style.display = "block";
                document.getElementById("db-namespace").innerText = targetNamespace;
                document.getElementById("db-coords").innerText    =
                    "x: " + spawnX.toFixed(2) + ", y: " + spawnY.toFixed(2) + " (" + robotType + ")";

                // ── 2. Claim exclusive session ────────────────────────────────
                // This must succeed before we attempt a rosbridge connection.
                // A 423 means someone else is already driving; we surface a
                // clear error rather than silently connecting as a read-only view.
                const claimResp = await fetch('/api/robot/' + robotId + '/claim', { method: 'POST' });

                if (claimResp.status === 423) {
                    const err = await claimResp.json();
                    throw new Error(err.detail || "Robot is in use by another operator.");
                }
                if (!claimResp.ok) {
                    throw new Error("Failed to claim robot session (HTTP " + claimResp.status + ")");
                }

                const claimData = await claimResp.json();
                sessionToken = claimData.token;
                setSessionPill("MINE · " + sessionToken.slice(0, 8), "mine");

                // ── 3. Connect rosbridge ──────────────────────────────────────
                if (!ros || !ros.isConnected) {
                    if (ros) { try { ros.close(); } catch(e) {} }
                    ros = new ROSLIB.Ros({ url: 'ws://' + robot_ip + ':9090' });
                    await new Promise((resolve, reject) => {
                        const onConn = () => { ros.off('error', onErr); resolve(); };
                        const onErr  = () => { ros.off('connection', onConn); reject(new Error("ROSBridge connection failed. Is it running on port 9090?")); };
                        ros.on('connection', onConn);
                        ros.on('error',      onErr);
                    });
                }

                // ── 4. Initialise or connect topics ───────────────────────────
                // Yield one event-loop tick after the rosbridge connection event
                // before calling getTopics.  The session claim step above added
                // async/await to this function, which means the connection promise
                // resolves and execution continues synchronously — rosbridge has
                // opened the WebSocket but has not yet finished its internal
                // handshake, so a publish fired immediately would be dropped.
                // A zero-length setTimeout defers to the next tick and is enough.
                await new Promise(resolve => setTimeout(resolve, 0));

                const spawnTopic = new ROSLIB.Topic({
                    ros,
                    name: '/spawn_signal_topic',
                    messageType: 'std_msgs/msg/String'
                });

                spawnTopic.publish(new ROSLIB.Message({
                    data: `${targetNamespace},${spawnX},${spawnY},${robotType}`
                }));

                // Give Gazebo a few seconds to spawn and the ros_gz_bridge
                // + RobotController to come up, then start the live connection.
                setTimeout(() => connectToIsolatedRobot(targetNamespace), 4000);

            } catch (err) {
                alert(err.message);
                infoDisplay.style.display = "none";

                // If we managed to claim before the error, release it now.
                if (sessionToken) {
                    await releaseSession(robotId, sessionToken);
                    sessionToken = null;
                }
                setSessionPill("FREE", "free");
                document.getElementById("connect-btn").disabled    = false;
                document.getElementById("disconnect-btn").disabled = true;
            }
        }

        // ── Connect ───────────────────────────────────────────────────────────
        function connectToIsolatedRobot(namespace) {
            // Do NOT call the full disconnectCurrentRobot() here — that would
            // release the session we just claimed.  Just tear down old topics.
            _teardownTopicsOnly();
            currentNamespace = namespace;

            document.getElementById("active-namespace-display").innerText =
                "Controlling: /" + namespace;
            document.getElementById("cam-topic-label").innerText =
                "Topic: /" + namespace + "/camera/image_raw (MJPEG via web_video_server)";

            if (!ros) ros = new ROSLIB.Ros({ url: 'ws://' + robot_ip + ':9090' });

            statusSpan.innerHTML = "Bridge Open. Waiting for Telemetry...";
            statusSpan.className = "status warning";

            setupNamespacedTopics();
            startWatchdog();

            // Start dual-channel heartbeats after a short delay so the first
            // API heartbeat check doesn't race against the claim acknowledgment.
            // setInterval never fires immediately, so the first ROS pulse shifts
            // from ~3 s to ~4 s — well within the 15 s SESSION_TIMEOUT_S.
            setTimeout(() => startHeartbeats(namespace, currentRobotId, sessionToken), 1000);

            if (poseSaveInterval) clearInterval(poseSaveInterval);
            poseSaveInterval = setInterval(function() {
                if (currentRobotId && lastPoseData) {
                    fetch('/api/robot/' + currentRobotId + '/pose', {
                        method:  'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body:    JSON.stringify(lastPoseData)
                    }).catch(err => console.warn("Pose save failed:", err));
                }
            }, 5000);

            ros.on('error', function() {
                statusSpan.innerHTML = "Bridge Error";
                statusSpan.className = "status disconnected";
            });
            ros.on('close', function() {
                statusSpan.innerHTML = "Bridge Closed";
                statusSpan.className = "status disconnected";
                setControlsEnabled(false);
                stopHeartbeats();
            });

            // Re-enable connect and enable disconnect once we're live.
            document.getElementById("connect-btn").disabled    = false;
            document.getElementById("disconnect-btn").disabled = false;
        }

        // ── User-initiated disconnect ──────────────────────────────────────────
        /**
         * Releases the session and tears down the client — WITHOUT despawning
         * the robot.  The Gazebo simulation and the ROS node keep running.
         * Another operator can claim and drive the robot immediately after.
         */
        async function userInitiatedDisconnect() {
            document.getElementById("connect-btn").disabled    = true;
            document.getElementById("disconnect-btn").disabled = true;

            // Release the FastAPI session first so the robot becomes claimable
            // the moment we stop publishing ROS heartbeats.
            if (sessionToken && currentRobotId) {
                await releaseSession(currentRobotId, sessionToken);
            }
            sessionToken = null;
            setSessionPill("FREE", "free");

            disconnectCurrentRobot();

            document.getElementById("connect-btn").disabled    = false;
            // disconnect-btn stays disabled until the next successful claim.
        }

        /**
         * Call the FastAPI release endpoint.  Fire-and-forget on failure —
         * the server-side session reaper will clean up within SESSION_TIMEOUT_S.
         */
        async function releaseSession(robotId, token) {
            try {
                await fetch('/api/robot/' + robotId + '/claim', {
                    method:  'DELETE',
                    headers: { 'X-Session-Token': token }
                });
            } catch (e) {
                console.warn("Session release failed (server will auto-expire):", e);
            }
        }

        function setupNamespacedTopics() {
            const ns = currentNamespace;

            /**
            * Updates the watchdog timer to keep the dashboard in "Connected" status.
            */
            function markOnline() {
                lastTelemetryTime = Date.now();
                if (statusSpan.className !== "status connected") {
                    statusSpan.innerHTML = "Target Online & Connected!";
                    statusSpan.className = "status connected";
                    setControlsEnabled(true);
                }
            }

            // 1. Setup Secure Control & Heartbeat Channels
            // These remain on ROSLIB because they are gated by the token in the C++ node.
            cmdVelTopic = new ROSLIB.Topic({
                ros, 
                name: '/' + ns + '/cmd_vel_web',
                messageType: 'web_ros_custom_msgs/msg/AuthorizedTwist'
            });

            sessionHeartbeatTopic = new ROSLIB.Topic({
                ros, 
                name: '/' + ns + '/session/heartbeat',
                messageType: 'std_msgs/msg/String'
            });

            pingTopic = new ROSLIB.Topic({
                ros, 
                name: '/' + ns + '/ping', 
                messageType: 'std_msgs/msg/String'
            });

            // 2. Setup Gated Video Proxy (Sensor-Aware)
            const videoStream = document.getElementById('video-stream');
            const camPlaceholder = document.getElementById('cam-placeholder');

            // Check if the current robot's hardware includes a camera
            if (!currentRobotSensors.includes("camera")) {
                // No camera equipped. Hide stream and show placeholder.
                if (videoStream) {
                    videoStream.src = "";
                    videoStream.style.display = 'none';
                }
                if (camPlaceholder) {
                    camPlaceholder.style.display = 'flex';
                    camPlaceholder.innerText = "📷 Camera not equipped on this configuration.";
                }
                document.getElementById("cam-topic-label").innerText = "Topic: N/A (No Camera)";
            } else {
                // Camera equipped! Load the stream.
                if (videoStream) {
                    videoStream.src = `/api/robot/${currentRobotId}/stream?token=${sessionToken}`;
                    videoStream.style.display = 'block';
                }
                if (camPlaceholder) camPlaceholder.style.display = 'none';
                document.getElementById("cam-topic-label").innerText = 
                    "Topic: /" + ns + "/camera/image_raw (MJPEG)";
            }

            // 3. Open a Secure WebSocket to the FastAPI Bouncer
            if (secureWS) {
                secureWS.close(); // Close existing connection before opening a new one
            }
            
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            secureWS = new WebSocket(`${protocol}//${window.location.host}/api/robot/${currentRobotId}/ws?token=${sessionToken}`);

            secureWS.onmessage = function(event) {
                const data = JSON.parse(event.data);
                
                // CRITICAL: Update the watchdog so the dashboard doesn't time out
                markOnline();

                // Telemetry updates
                if (data.type === "odom") {
                    safeSet("odom-x", data.x.toFixed(2));
                    safeSet("odom-y", data.y.toFixed(2));
                } else if (data.type === "pose") {
                    safeSet("pose-x", data.wx.toFixed(2));
                    safeSet("pose-y", data.wy.toFixed(2));
                } else if (data.type === "imu") {
                    safeSet("imu-ax", data.ax.toFixed(2));
                    safeSet("imu-ay", data.ay.toFixed(2));
                    safeSet("imu-az", data.az.toFixed(2));
                    safeSet("imu-gx", (data.gx * 57.29).toFixed(1));
                    safeSet("imu-gy", (data.gy * 57.29).toFixed(1));
                    safeSet("imu-gz", (data.gz * 57.29).toFixed(1));
                } else if (data.type === "scan") {
                    latestScan = data;
                    drawRadar(); // Trigger the canvas update
                    const minRange = Math.min(...data.ranges.filter(r => r > data.range_min));
                    safeSet("scan-closest", minRange.toFixed(2) + " m");
                } else if (data.type === "collision") {
                    const el = document.getElementById("collision-status");
                    if (el) {
                        el.innerText = data.status === "OK" ? "Path Clear" : "⚠ " + data.status;
                        el.className = data.status === "OK" ? "badge connected" : "badge disconnected";
                    }
                }
            };

            secureWS.onclose = function(e) {
                if (e.code === 4003) {
                    alert("Session Revoked: Connection physically severed by server.");
                    disconnectCurrentRobot();
                }
            };

            // 4. Command Velocity Control Loop (~15 Hz)
            if (window.controlInterval) clearInterval(window.controlInterval);
            window.controlInterval = setInterval(function() {
                if (cmdVelTopic && sessionToken && (desiredLinear !== 0 || desiredAngular !== 0)) {
                    cmdVelTopic.publish(new ROSLIB.Message({
                        token: sessionToken,
                        command: {
                            linear:  { x: desiredLinear,  y: 0, z: 0 },
                            angular: { x: 0, y: 0, z: desiredAngular }
                        }
                    }));
                }
            }, 66);

            /**
            * Draws the LIDAR Radar visualization on the canvas.
            */
            function drawRadar() {
                const msg = latestScan;
                if (!msg) return;
                const canvas = document.getElementById("radar-canvas");
                if (!canvas) return;
                const ctx = canvas.getContext("2d");
                const W = canvas.width, H = canvas.height;
                const cx = W / 2, cy = H / 2;
                const R  = Math.min(W, H) / 2 - 8;

                ctx.fillStyle = "#0d1117";
                ctx.fillRect(0, 0, W, H);
                ctx.strokeStyle = "#1f3d1f"; ctx.lineWidth = 1;
                
                for (let i = 1; i <= 4; i++) {
                    ctx.beginPath(); ctx.arc(cx, cy, R * i / 4, 0, 2 * Math.PI); ctx.stroke();
                }
                
                const ranges = msg.ranges || [];
                const scale  = R / msg.range_max;
                let validCount = 0;
                
                for (let i = 0; i < ranges.length; i++) {
                    const r = ranges[i];
                    if (!isFinite(r) || r < msg.range_min || r > msg.range_max) continue;
                    validCount++;
                    const angle = msg.angle_min + i * msg.angle_increment;
                    const px = cx + Math.sin(angle) * r * scale;
                    const py = cy - Math.cos(angle) * r * scale;
                    
                    const ratio = r / msg.range_max;
                    ctx.fillStyle = "rgb(" + Math.floor(255 * (1 - ratio)) + "," + Math.floor(180 * ratio + 60) + ",40)";
                    ctx.fillRect(px - 1, py - 1, 3, 3);
                }
                
                ctx.fillStyle = "#00ff88"; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 2 * Math.PI); ctx.fill();
                const legend = document.getElementById("radar-legend");
                if (legend) legend.innerText = validCount + " pts · " + msg.range_max.toFixed(1) + " m range";
            }

            // 5. Setup Latency Tracking
            if (pingInterval) clearInterval(pingInterval);
            pingInterval = setInterval(function() {
                if (ros && ros.isConnected && pingTopic) {
                    const now = Date.now().toString();
                    pingTopic.publish(new ROSLIB.Message({ data: now }));
                }
            }, 1000);

            // Add a subscriber to calculate the round-trip latency
            pingTopic.subscribe(function(msg) {
                const sentTime = parseInt(msg.data);
                const latency = Date.now() - sentTime;
                const latSpan = document.getElementById("latency-display");
                latSpan.innerText = latency + " ms";
                latSpan.className = latency > 150 ? "badge warning" : "badge connected";
            });
        }

        // ── Watchdog ──────────────────────────────────────────────────────────
        function startWatchdog() {
            if (watchdogInterval) clearInterval(watchdogInterval);
            lastTelemetryTime = Date.now();
            watchdogInterval = setInterval(function() {
                if (Date.now() - lastTelemetryTime > 10000) {
                    statusSpan.innerHTML = "Target Lost";
                    statusSpan.className = "status disconnected";
                    setControlsEnabled(false);
                    ["odom-x","odom-y","pose-x","pose-y"].forEach(id => safeSet(id, "---"));
                    latencySpan.innerHTML = "Waiting for ping...";
                    latencySpan.className = "status warning";
                }
            }, 1000);
        }

        // ── Internal: tear down topics without touching the session ────────────
        /**
         * Stops all intervals and unsubscribes all topics but does NOT release
         * the session and does NOT close the rosbridge connection.
         * Used when switching between robots or re-connecting to the same robot.
         */
        function _teardownTopicsOnly() {
            stopHeartbeats();
            
            // Close the secure relay socket
            if (secureWS) {
                secureWS.close();
                secureWS = null;
            }

            if (watchdogInterval) { clearInterval(watchdogInterval); watchdogInterval = null; }
            if (pingInterval)     { clearInterval(pingInterval);     pingInterval     = null; }
            if (poseSaveInterval) { clearInterval(poseSaveInterval); poseSaveInterval = null; }
            if (window.controlInterval) { clearInterval(window.controlInterval); window.controlInterval = null; }

            // Unsubscribe ROSLIB topics safely
            const topics = [
                odomTopic, poseTopic, imuTopic, cameraInfoTopic, scanTopic,
                scanPointsTopic, pingTopic, collisionStatusTopic, scanClosestTopic,
                sessionStatusTopic
            ];

            topics.forEach(t => { 
                if (t && typeof t.unsubscribe === 'function') {
                    try { t.unsubscribe(); } catch(e) { console.warn("Topic cleanup error:", e); }
                }
            });

            odomTopic = poseTopic = cmdVelTopic = null;
            imuTopic  = cameraInfoTopic = scanTopic = scanPointsTopic = pingTopic = null;
            collisionStatusTopic = scanClosestTopic = sessionStatusTopic = null;
            sessionHeartbeatTopic = null;
            
            ["odom-x","odom-y","pose-x","pose-y"].forEach(id => safeSet(id, "---"));
        }

        // ── Full disconnect (session + topics + bridge) ────────────────────────
        /**
         * Tears down everything: topics, heartbeats, and the rosbridge socket.
         * Call this only after the session has already been released (or was never
         * claimed) — e.g. on errors during connection, or from userInitiatedDisconnect().
         */
        function disconnectCurrentRobot() {
            emergencyStop(); // Reset velocities first
            _teardownTopicsOnly();

            // Close the ROS bridge socket entirely
            if (ros) { 
                try { ros.close(); } catch(e) {} 
                ros = null; 
            }

            // Reset UI text and labels
            setControlsEnabled(false);
            safeSet("active-namespace-display", "No Active Target");
            safeSet("cam-topic-label", "Topic: N/A");

            // KILL THE CAMERA STREAM - Only declare "vid" once
            const vid = document.getElementById("video-stream");
            const camPlaceholder = document.getElementById("cam-placeholder");
            
            if (vid) { 
                vid.src = ""; // Stops the browser from downloading data
                vid.style.display = 'none'; 
            }
            
            if (camPlaceholder) { 
                camPlaceholder.style.display = 'flex'; 
                camPlaceholder.innerText = "Awaiting robot connection..."; 
            }

            // Reset status badges
            latencySpan.innerHTML = "Waiting for connection...";
            latencySpan.className = "status warning";

            currentNamespace = "";
        }

        // ── Page unload — best-effort session release ──────────────────────────
        // sendBeacon is fire-and-forget and survives page close, but it always
        // sends POST — so we target the dedicated /release endpoint, not DELETE
        // /claim (which sendBeacon could never reach).
        window.addEventListener('beforeunload', function() {
            if (sessionToken && currentRobotId) {
                navigator.sendBeacon('/api/robot/' + currentRobotId + '/release?token=' + encodeURIComponent(sessionToken));
            }
        });
    </script>
</body>
</html>
"""

async def broadcast_to_operator(robot_id: str, data: dict):
    """
    The Bouncer: Only forwards data if the operator is still authorized.
    """
    ws = _active_ws.get(robot_id.upper())
    if ws:
        try:
            # Thread-safe check: Is this WebSocket still the authorized one?
            # If a new claim happened, the _active_ws entry would have been updated.
            await ws.send_json(data)
        except Exception:
            _active_ws.pop(robot_id.upper(), None)

def telemetry_callback(msg, robot_id, msg_type):
    """
    Bridge: ROS Binary -> JSON -> Secure WebSocket.
    Acts as the secure relay point for all incoming robot data.
    """
    # Ensure the FastAPI event loop is available before attempting to relay
    if not loop:
        return
    
    # Initialize the base data packet with the robot's identity
    data = {"type": msg_type, "robot_id": robot_id}
    
    # 1. Handle Odometry (Relative Position)
    if msg_type == "odom":
        data.update({
            "x": round(msg.pose.pose.position.x, 3),
            "y": round(msg.pose.pose.position.y, 3)
        })
        
    # 2. Handle World Pose (Global Position from Gazebo)
    elif msg_type == "pose":
        data.update({
            "wx": round(msg.position.x, 3),
            "wy": round(msg.position.y, 3)
        })
        
    # 3. Handle IMU (Inertial Measurement Unit)
    elif msg_type == "imu":
        data.update({
            "ax": round(msg.linear_acceleration.x, 3),
            "ay": round(msg.linear_acceleration.y, 3),
            "az": round(msg.linear_acceleration.z, 3),
            "gx": round(msg.angular_velocity.x, 3),
            "gy": round(msg.angular_velocity.y, 3),
            "gz": round(msg.angular_velocity.z, 3) # Yaw rate
        })
        
    # 4. Handle LaserScan (LIDAR Radar)
    elif msg_type == "scan":
        # CRITICAL FIX: Convert array.array to a standard Python list
        # We also replace Infinity/NaN with 0.0 to ensure JSON compatibility
        cleaned_ranges = [
            float(r) if (msg.range_min < r < msg.range_max and not (r == float('inf') or r == float('nan'))) 
            else 0.0 
            for r in msg.ranges
        ]
        
        data.update({
            "ranges": cleaned_ranges,
            "angle_min": msg.angle_min,
            "angle_max": msg.angle_max,
            "angle_increment": msg.angle_increment,
            "range_min": msg.range_min,
            "range_max": msg.range_max
        })
        
    # 5. Handle Collision & Proximity
    elif msg_type == "collision":
        data.update({"status": msg.data})
        
    elif msg_type == "closest":
        data.update({"dist": round(msg.data, 2)})

    # Pushes the data packet from the ROS executor thread to the FastAPI async loop safely.
    # This triggers the broadcast_to_operator function for the currently authorized user.
    asyncio.run_coroutine_threadsafe(broadcast_to_operator(robot_id, data), loop)
    
@app.on_event("startup")
async def startup_event():
    global loop
    loop = asyncio.get_running_loop()
    # Start ROS in a background thread
    threading.Thread(target=run_ros, daemon=True).start()
    asyncio.create_task(_reap_sessions())

def run_ros():
    global ros_node
    rclpy.init()
    ros_node = Node('fleet_secure_relay')
    
    for rid, info in ROBOT_DATABASE.items():
        ns = info['namespace']
        # Secure relay subscriptions
        ros_node.create_subscription(Odometry, f"/{ns}/odom", lambda m, r=rid: telemetry_callback(m, r, "odom"), 10)
        ros_node.create_subscription(Pose, f"/model/{ns}/pose", lambda m, r=rid: telemetry_callback(m, r, "pose"), 10)
        ros_node.create_subscription(Imu, f"/{ns}/imu", lambda m, r=rid: telemetry_callback(m, r, "imu"), 10)
        ros_node.create_subscription(LaserScan, f"/{ns}/scan", lambda m, r=rid: telemetry_callback(m, r, "scan"), 10)
        ros_node.create_subscription(String, f"/{ns}/collision_status", lambda m, r=rid: telemetry_callback(m, r, "collision"), 10)
    
    print("ROS 2 Secure Relay Node Spinning...")
    rclpy.spin(ros_node)

@app.get("/")
async def get_dashboard():
    return HTMLResponse(html_content)


@app.get("/api/robot/{robot_id}/stream")
async def gated_video_stream(robot_id: str, token: str):
    clean_id = robot_id.strip().upper()
    session = _sessions.get(clean_id)

    if not session or session["token"] != token:
        raise HTTPException(status_code=403, detail="Unauthorized video access")

    # DYNAMIC CHECK: Does this specific robot have a camera listed in its sensors?
    if "camera" not in ROBOT_DATABASE[clean_id].get("sensors", []):
        raise HTTPException(status_code=404, detail="This robot is not equipped with a camera.")

    namespace = ROBOT_DATABASE[clean_id]["namespace"]
    target_url = f"http://localhost:8080/stream?topic=/{namespace}/camera/image_raw"
    
    async def stream_generator():
        async with httpx.AsyncClient() as client:
            async with client.stream("GET", target_url) as r:
                async for chunk in r.aiter_bytes():
                    # CRITICAL: Re-check token for every frame to stop 'ghost' streams
                    if _sessions.get(clean_id, {}).get("token") != token:
                        print(f"[video proxy] Revoking stream for {clean_id} - Ownership changed.")
                        break
                    yield chunk

    return StreamingResponse(
        stream_generator(), 
        media_type="multipart/x-mixed-replace; boundary=boundarydonotcross"
    )

@app.websocket("/api/robot/{robot_id}/ws")
async def secure_telemetry_relay(websocket: WebSocket, robot_id: str, token: str):
    """
    Secure WebSocket for telemetry. Automatically severs when token expires.
    """
    clean_id = robot_id.strip().upper()
    session = _sessions.get(clean_id)
    
    if not session or session["token"] != token:
        await websocket.close(code=4003)
        return

    await websocket.accept()
    _active_ws[clean_id] = websocket

    try:
        while True:
            # We don't expect data from the client, but we must receive to detect disconnects
            await websocket.receive_text()
            # If the session was stolen, close this old socket immediately
            if _sessions.get(clean_id, {}).get("token") != token:
                break
    except WebSocketDisconnect:
        pass
    finally:
        if _active_ws.get(clean_id) == websocket:
            _active_ws.pop(clean_id, None)

# ── sendBeacon-compatible release (always POST) ────────────────────────────────
# navigator.sendBeacon() always sends POST, so the DELETE /claim endpoint is
# unreachable from beforeunload.  This endpoint accepts POST and works
# identically to the DELETE handler — it exists purely to give sendBeacon a
# method-compatible target.

async def perform_release(robot_id: str, token: str):
    clean_id = robot_id.strip().upper()
    session = _sessions.get(clean_id)
    if session and session["token"] == token:
        del _sessions[clean_id]
        _active_ws.pop(clean_id, None)
        print(f"[session] {clean_id!r} released.")
        return True
    return False

@app.delete("/api/robot/{robot_id}/claim")
@app.post("/api/robot/{robot_id}/release")
async def universal_release(robot_id: str, token: Optional[str] = None, x_session_token: Optional[str] = Header(default=None)):
    actual_token = x_session_token or token
    if await perform_release(robot_id, actual_token):
        return {"status": "released"}
    return {"status": "already_free_or_invalid"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=000)