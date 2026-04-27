from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
import uvicorn

app = FastAPI()

# ---------------------------------------------------------
# Simulated Backend Database
# Contains the last known spawn coordinates (x, y) for Gazebo
# These are updated live as the robot moves
# ---------------------------------------------------------
ROBOT_DATABASE = {
    "ROB-100": {
        "namespace": "rob100",
        "x": 2.0,
        "y": 1.5
    },
    "ROB-200": {
        "namespace": "rob200",
        "x": -3.0,
        "y": -1.0
    },
    "ROB-300": {
        "namespace": "rob300",
        "x": 5.0,
        "y": 0.0
    }
}

class PoseUpdate(BaseModel):
    x: float
    y: float

# ---------------------------------------------------------
# HTML Frontend (Embedded)
# ---------------------------------------------------------
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

        /* ── Chatter ──────────────────────────────────────── */
        .chatter-btn {
            width: 100%; padding: 8px 14px; font-size: 0.88em;
            background: #0d6efd; color: white;
            border: none; border-radius: 6px; cursor: pointer; font-weight: 600;
        }
        .chatter-btn:hover { background: #0b5ed7; }
        .chatter-btn:disabled { background: #ced4da; color: #adb5bd; cursor: not-allowed; }
        .action-log { font-size: 0.78em; color: #6c757d; font-style: italic; margin-top: 8px; min-height: 2.5em; }

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
        <button class="connect-btn" onclick="fetchRobotAndConnect()">Initialize &amp; Connect</button>
        <div id="backend-info-display" class="db-pill">
            <strong id="db-namespace">—</strong> &nbsp;·&nbsp; spawn <span id="db-coords">—</span>
        </div>
    </div>

    <div class="status-strip">
        <span id="active-namespace-display" class="ns-tag">No Active Target</span>
        <span>ROSBridge:</span>
        <span id="status" class="badge disconnected">Offline</span>
        <span class="ping-label">Ping:</span>
        <span id="latency-display" class="badge warning">Waiting...</span>
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
                        <div class="ctrl-label">D-Pad</div>
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

        <div class="card">
            <div class="card-title">Test Comms</div>
            <button id="pub-button" class="chatter-btn" onclick="publishMessage()" disabled>Send /chatter Message</button>
            <div id="action-log" class="action-log">Connect to a robot first...</div>
        </div>

    </div><script>
        // ── State ─────────────────────────────────────────────────────────────
        let ros             = null;
        let odomTopic       = null;
        let poseTopic       = null;
        let chatterTopic    = null;
        let cmdVelTopic     = null;
        let imuTopic        = null;
        let cameraInfoTopic = null;
        let scanTopic             = null;
        let scanPointsTopic       = null;
        let pingTopic             = null;
        let collisionStatusTopic  = null;
        let scanClosestTopic      = null;

        let pingInterval     = null;
        let watchdogInterval = null;
        let poseSaveInterval = null;

        // ── Frame-synced velocity state ───────────────────────────────────────
        let desiredLinear   = 0;
        let desiredAngular  = 0;

        let lastTelemetryTime = 0;
        let lastPoseSave      = 0;
        let counter           = 1;
        let radarDirty        = false;
        let latestScan        = null;
        let lastPoseData      = null;
        let currentNamespace  = "";
        let currentRobotId    = "";
        let joystickActive    = false;
        let activeKeys        = new Set();

        const robot_ip   = window.location.hostname;
        const statusSpan = document.getElementById("status");
        const latencySpan = document.getElementById("latency-display");
        function safeSet(id, val) {
            const el = document.getElementById(id);
            if (el) el.innerText = val;
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
            // Keep the readout snappy — update UI immediately without waiting for frame
            document.getElementById("cmdvel-linear").innerText  = linear.toFixed(2);
            document.getElementById("cmdvel-angular").innerText = angular.toFixed(2);
        }

        // Emergency stop is the one exception: publishes immediately regardless of frame clock.
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
            sendKeyVel();   // recalculates; zeros out automatically if no keys held
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
                if (!joystickActive) return;
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

        // ── Core Flow: Fetch → Spawn or Connect ───────────────────────────────
        async function fetchRobotAndConnect() {
            const robotId     = document.getElementById("robot-id-input").value.trim();
            const infoDisplay = document.getElementById("backend-info-display");
            if (!robotId) return alert("Please enter a Robot ID (e.g., ROB-100)");

            try {
                const response = await fetch('/api/robot/' + robotId);
                if (!response.ok) throw new Error("Robot ID not found in the backend database.");

                const data = await response.json();
                const targetNamespace = data.namespace;
                currentRobotId = robotId;

                // Default to origin if no prior position data exists
                const spawnX = (data.x != null) ? data.x : 0.0;
                const spawnY = (data.y != null) ? data.y : 0.0;

                infoDisplay.style.display = "block";
                document.getElementById("db-namespace").innerText = targetNamespace;
                document.getElementById("db-coords").innerText    = "x: " + spawnX.toFixed(2) + ", y: " + spawnY.toFixed(2);

                if (!ros || !ros.isConnected) {
                    if (ros) { try { ros.close(); } catch(e) {} }
                    ros = new ROSLIB.Ros({ url: 'ws://' + robot_ip + ':9090' });
                    await new Promise((resolve, reject) => {
                        const onConn  = () => { ros.off('error', onErr); resolve(); };
                        const onErr   = () => { ros.off('connection', onConn); reject(new Error("ROSBridge connection failed. Is it running on port 9090?")); };
                        ros.on('connection', onConn);
                        ros.on('error',      onErr);
                    });
                }

                ros.getTopics(function(topicList) {
                    const expectedTopic = '/' + targetNamespace + '/odom';
                    if (topicList.topics.includes(expectedTopic)) {
                        document.getElementById("action-log").innerHTML =
                            "Robot already in simulation. Connecting to existing instance...";
                        connectToIsolatedRobot(targetNamespace);
                    } else {
                        document.getElementById("action-log").innerHTML =
                            "Robot not found. Spawning at (" + spawnX.toFixed(2) + ", " + spawnY.toFixed(2) + ")...";
                        var spawnTopic = new ROSLIB.Topic({ ros, name: '/spawn_signal_topic', messageType: 'std_msgs/msg/String' });
                        spawnTopic.publish(new ROSLIB.Message({ data: targetNamespace + "," + spawnX + "," + spawnY }));
                        setTimeout(() => connectToIsolatedRobot(targetNamespace), 3000);
                    }
                });

            } catch (err) {
                alert(err.message);
                infoDisplay.style.display = "none";
                disconnectCurrentRobot();
            }
        }

        // ── Connect ───────────────────────────────────────────────────────────
        function connectToIsolatedRobot(namespace) {
            disconnectCurrentRobot();
            currentNamespace = namespace;

            document.getElementById("active-namespace-display").innerText = "Listening to: /" + namespace;
            document.getElementById("cam-topic-label").innerText =
                "Topic: /" + namespace + "/camera/image_raw (MJPEG via web_video_server)";

            if (!ros) ros = new ROSLIB.Ros({ url: 'ws://' + robot_ip + ':9090' });

            statusSpan.innerHTML = "Bridge Open. Waiting for Telemetry...";
            statusSpan.className = "status warning";

            setupNamespacedTopics();
            startWatchdog();

            // Flush latest pose to backend every 5 s
            if (poseSaveInterval) clearInterval(poseSaveInterval);
            poseSaveInterval = setInterval(function() {
                if (currentRobotId && lastPoseData) {
                    fetch('/api/robot/' + currentRobotId + '/pose', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(lastPoseData)
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
                document.getElementById("pub-button").disabled = true;
                setControlsEnabled(false);
            });
        }

        // ── Topic Setup ───────────────────────────────────────────────────────
        function setupNamespacedTopics() {
            const ns = currentNamespace;

            function markOnline() {
                lastTelemetryTime = Date.now();
                if (statusSpan.className !== "status connected") {
                    statusSpan.innerHTML = "Target Online & Connected!";
                    statusSpan.className = "status connected";
                    document.getElementById("pub-button").disabled = false;
                    setControlsEnabled(true);
                    document.getElementById("action-log").innerHTML = "Ready to send targeted messages.";
                }
            }

            // /odom
            odomTopic = new ROSLIB.Topic({ ros, name: '/' + ns + '/odom', messageType: 'nav_msgs/msg/Odometry', throttle_rate: 100, queue_length: 1 });
            odomTopic.subscribe(function(msg) {
                markOnline();
                if (msg.pose && msg.pose.pose && msg.pose.pose.position) {
                    document.getElementById("odom-x").innerText = msg.pose.pose.position.x.toFixed(2);
                    document.getElementById("odom-y").innerText = msg.pose.pose.position.y.toFixed(2);
                }
            });

            // /model/pose
            poseTopic = new ROSLIB.Topic({ ros, name: '/model/' + ns + '/pose', messageType: 'geometry_msgs/msg/Pose', throttle_rate: 200, queue_length: 1 });
            poseTopic.subscribe(function(msg) {
                markOnline();
                if (msg.position) {
                    const x = msg.position.x, y = msg.position.y;
                    document.getElementById("pose-x").innerText = x.toFixed(2);
                    document.getElementById("pose-y").innerText = y.toFixed(2);
                    lastPoseData = { x, y };
                }
            });

            // /cmd_vel  — publisher only
            cmdVelTopic = new ROSLIB.Topic({ ros, name: '/' + ns + '/cmd_vel_web', messageType: 'geometry_msgs/msg/Twist' });

            // 1. Route the video stream natively via web_video_server (Port 8080)
            const videoStream      = document.getElementById('video-stream');
            const camPlaceholder   = document.getElementById('cam-placeholder');
            
            const streamUrl = 'http://' + robot_ip + ':8080/stream?topic=/' + ns + '/camera/image_raw';
            videoStream.src = streamUrl;
            
            videoStream.onload = function() {
                videoStream.style.display = 'block';
                camPlaceholder.style.display = 'none';
            };
            
            videoStream.onerror = function() {
                camPlaceholder.innerText = "Error loading MJPEG stream. Is web_video_server running on port 8080?";
                camPlaceholder.style.display = 'flex';
                videoStream.style.display = 'none';
            };

            // 2. Independent /cmd_vel publishing loop (~15 Hz)
            if (window.controlInterval) clearInterval(window.controlInterval);
            
            window.controlInterval = setInterval(function() {
                if (cmdVelTopic && (desiredLinear !== 0 || desiredAngular !== 0 || activeKeys.size > 0 || joystickActive)) {
                    cmdVelTopic.publish(new ROSLIB.Message({
                        linear:  { x: desiredLinear,  y: 0, z: 0 },
                        angular: { x: 0, y: 0, z: desiredAngular }
                    }));
                }
            }, 66); // 66ms = ~15 Hz

            // /imu
            imuTopic = new ROSLIB.Topic({ ros, name: '/' + ns + '/imu', messageType: 'sensor_msgs/msg/Imu', throttle_rate: 100, queue_length: 1 });
            imuTopic.subscribe(function(msg) {
                if (msg.linear_acceleration) {
                    safeSet("imu-ax", msg.linear_acceleration.x.toFixed(3));
                    safeSet("imu-ay", msg.linear_acceleration.y.toFixed(3));
                    safeSet("imu-az", msg.linear_acceleration.z.toFixed(3));
                }
                if (msg.angular_velocity) {
                    safeSet("imu-gx", msg.angular_velocity.x.toFixed(3));
                    safeSet("imu-gy", msg.angular_velocity.y.toFixed(3));
                    safeSet("imu-gz", msg.angular_velocity.z.toFixed(3));
                }
            });

            // /camera/camera_info
            cameraInfoTopic = new ROSLIB.Topic({ ros, name: '/' + ns + '/camera/camera_info', messageType: 'sensor_msgs/msg/CameraInfo', throttle_rate: 1000, queue_length: 1 });
            cameraInfoTopic.subscribe(function(msg) {
                safeSet("cam-res",  msg.width + " x " + msg.height);
                safeSet("cam-dist", msg.distortion_model || "---");
                if (msg.k && msg.k.length >= 6) {
                    safeSet("cam-fx", msg.k[0].toFixed(2));
                    safeSet("cam-fy", msg.k[4].toFixed(2));
                    safeSet("cam-cx", msg.k[2].toFixed(2));
                    safeSet("cam-cy", msg.k[5].toFixed(2));
                }
            });

            // /scan
            scanTopic = new ROSLIB.Topic({ ros, name: '/' + ns + '/scan', messageType: 'sensor_msgs/msg/LaserScan', throttle_rate: 100, queue_length: 1 });
            scanTopic.subscribe(function(msg) {
                latestScan = msg;
                if (!radarDirty) {
                    radarDirty = true;
                    requestAnimationFrame(drawRadar);
                }
                // Closest-obstacle calculation has been moved to RobotController.
                // scan-closest is updated via the /scan_closest topic below.
                const ranges = msg.ranges || [];
                const deg = ((msg.angle_max - msg.angle_min) * 180 / Math.PI).toFixed(1);
                safeSet("scan-count",    ranges.length);
                safeSet("scan-rmin",     msg.range_min.toFixed(2) + " m");
                safeSet("scan-rmax",     msg.range_max.toFixed(2) + " m");
                safeSet("scan-coverage", deg + " deg");
            });

        function drawRadar() {
            radarDirty = false;
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

            ctx.strokeStyle = "#1f3d1f";
            ctx.lineWidth = 1;
            for (let i = 1; i <= 4; i++) {
                ctx.beginPath();
                ctx.arc(cx, cy, R * i / 4, 0, 2 * Math.PI);
                ctx.stroke();
            }
            ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();

            const ranges = msg.ranges || [];
            const scale = R / msg.range_max;
            let validCount = 0;
            for (let i = 0; i < ranges.length; i++) {
                const r = ranges[i];
                if (!isFinite(r) || r < msg.range_min || r > msg.range_max) continue;
                validCount++;
                const angle = msg.angle_min + i * msg.angle_increment;
                const px = cx + Math.sin(angle) * r * scale;
                const py = cy - Math.cos(angle) * r * scale;
                const ratio = r / msg.range_max;
                const red   = Math.floor(255 * (1 - ratio));
                const green = Math.floor(180 * ratio + 60);
                ctx.fillStyle = "rgb(" + red + "," + green + ",40)";
                ctx.fillRect(px - 1, py - 1, 3, 3);
            }

            ctx.fillStyle = "#00ff88";
            ctx.beginPath();
            ctx.arc(cx, cy, 4, 0, 2 * Math.PI);
            ctx.fill();

            const legend = document.getElementById("radar-legend");
            if (legend) legend.innerText = validCount + " pts · " + msg.range_max.toFixed(1) + " m range";
        }

            // /scan_closest — Float32 published by RobotController; drives the "Closest" readout
            scanClosestTopic = new ROSLIB.Topic({
                ros, name: '/' + ns + '/scan_closest',
                messageType: 'std_msgs/msg/Float32',
                throttle_rate: 100, queue_length: 1
            });
            scanClosestTopic.subscribe(function(msg) {
                safeSet("scan-closest", msg.data >= 0 ? msg.data.toFixed(2) + " m" : "---");
            });

            // /collision_status — String published by RobotController ("OK" or "BLOCKED: …")
            collisionStatusTopic = new ROSLIB.Topic({
                ros, name: '/' + ns + '/collision_status',
                messageType: 'std_msgs/msg/String'
            });
            collisionStatusTopic.subscribe(function(msg) {
                const el = document.getElementById("collision-status");
                if (!el) return;
                if (msg.data === "OK") {
                    el.innerText  = "Path Clear";
                    el.className  = "badge connected";
                } else {
                    el.innerText  = "⚠ " + msg.data;
                    el.className  = "badge disconnected";
                }
            });

            // /scan/points
            scanPointsTopic = new ROSLIB.Topic({ ros, name: '/' + ns + '/scan/points', messageType: 'sensor_msgs/msg/PointCloud2', throttle_rate: 200, queue_length: 1 });
            scanPointsTopic.subscribe(function(msg) {
                const fields = (msg.fields || []).map(f => f.name).join(", ");
                safeSet("pts-count",  (msg.width || 0) * (msg.height || 0));
                safeSet("pts-fields", fields || "---");
                safeSet("pts-width",  msg.width  || "---");
                safeSet("pts-height", msg.height || "---");
            });

            // /chatter
            chatterTopic = new ROSLIB.Topic({ ros, name: '/' + ns + '/chatter', messageType: 'std_msgs/msg/String' });

            // /web_ping
            pingTopic = new ROSLIB.Topic({ ros, name: '/' + ns + '/web_ping', messageType: 'std_msgs/msg/String' });
            pingTopic.subscribe(function(msg) {
                const lat = (Date.now() - parseInt(msg.data)) / 2;
                if (!isNaN(lat)) {
                    latencySpan.innerHTML = "<span class='metric'>" + lat.toFixed(0) + " ms</span>";
                    latencySpan.className = lat < 50 ? "status connected" : lat < 150 ? "status warning" : "status disconnected";
                }
            });
            pingInterval = setInterval(function() {
                if (ros && ros.isConnected)
                    pingTopic.publish(new ROSLIB.Message({ data: Date.now().toString() }));
            }, 1000);
        }

        // ── Watchdog ──────────────────────────────────────────────────────────
        function startWatchdog() {
            if (watchdogInterval) clearInterval(watchdogInterval);
            lastTelemetryTime = Date.now();
            watchdogInterval = setInterval(function() {
                if (Date.now() - lastTelemetryTime > 10000) {
                    statusSpan.innerHTML = "Target Lost / Not Spawning";
                    statusSpan.className = "status disconnected";
                    document.getElementById("pub-button").disabled = true;
                    setControlsEnabled(false);
                    ["odom-x","odom-y","pose-x","pose-y"].forEach(id => safeSet(id, "---"));
                    latencySpan.innerHTML = "Waiting for ping...";
                    latencySpan.className = "status warning";
                }
            }, 1000);
        }

        // ── Disconnect / Reset All ────────────────────────────────────────────
        function disconnectCurrentRobot() {
            emergencyStop();
            if (watchdogInterval) { clearInterval(watchdogInterval); watchdogInterval = null; }
            if (pingInterval)     { clearInterval(pingInterval);     pingInterval     = null; }
            if (poseSaveInterval) { clearInterval(poseSaveInterval); poseSaveInterval = null; }
            if (window.controlInterval) { clearInterval(window.controlInterval); window.controlInterval = null; }

            [odomTopic, poseTopic, imuTopic, cameraInfoTopic, scanTopic, scanPointsTopic, pingTopic, collisionStatusTopic, scanClosestTopic]
                .forEach(t => { if (t) t.unsubscribe(); });

            if (ros) { try { ros.close(); } catch(e) {} ros = null; }

            odomTopic = poseTopic = chatterTopic = cmdVelTopic = null;
            imuTopic  = cameraInfoTopic = scanTopic = scanPointsTopic = pingTopic = null;
            collisionStatusTopic = scanClosestTopic = null;
            lastTelemetryTime = 0;
            lastPoseSave      = 0;
            lastPoseData      = null;
            radarDirty        = false;
            latestScan        = null;

            ["odom-x","odom-y","pose-x","pose-y"].forEach(id => safeSet(id, "---"));
            ["imu-ax","imu-ay","imu-az","imu-gx","imu-gy","imu-gz"].forEach(id => safeSet(id, "---"));
            ["cam-res","cam-dist","cam-fx","cam-fy","cam-cx","cam-cy"].forEach(id => safeSet(id, "---"));
            ["scan-count","scan-rmin","scan-rmax","scan-closest","scan-coverage"].forEach(id => safeSet(id, "---"));
            const collEl = document.getElementById("collision-status");
            if (collEl) { collEl.innerText = "---"; collEl.className = "badge warning"; }
            ["pts-count","pts-fields","pts-width","pts-height"].forEach(id => safeSet(id, "---"));
            safeSet("cmdvel-linear",  "0.00");
            safeSet("cmdvel-angular", "0.00");

            document.getElementById("pub-button").disabled = true;
            setControlsEnabled(false);
            safeSet("active-namespace-display", "No Active Target");
            safeSet("cam-topic-label", "Topic: N/A");

            const vid = document.getElementById("video-stream");
            const camPlaceholder = document.getElementById("cam-placeholder");
            if (vid) { 
                vid.src = ""; 
                vid.style.display = 'none'; 
            }
            if (camPlaceholder) {
                camPlaceholder.style.display = 'flex';
                camPlaceholder.innerText = "Awaiting robot connection...";
            }

            latencySpan.innerHTML = "Waiting for connection...";
            latencySpan.className = "status warning";
        }

        // ── Chatter Test ──────────────────────────────────────────────────────
        function publishMessage() {
            if (!ros || !chatterTopic) return;
            var msg = new ROSLIB.Message({ data: "Command sent to /" + currentNamespace + "! Count: " + counter });
            chatterTopic.publish(msg);
            document.getElementById("action-log").innerHTML =
                "Published to <strong>/" + currentNamespace + "/chatter</strong>: " + msg.data;
            counter++;
        }
    </script>
</body>
</html>
"""

@app.get("/")
async def get_dashboard():
    return HTMLResponse(html_content)

@app.get("/api/robot/{robot_id}")
async def get_robot_info(robot_id: str):
    clean_id = robot_id.strip().upper()
    if clean_id in ROBOT_DATABASE:
        return ROBOT_DATABASE[clean_id]
    raise HTTPException(status_code=404, detail="Robot ID not found")

@app.post("/api/robot/{robot_id}/pose")
async def update_robot_pose(robot_id: str, payload: PoseUpdate):
    clean_id = robot_id.strip().upper()
    if clean_id not in ROBOT_DATABASE:
        raise HTTPException(status_code=404, detail="Robot ID not found")
    ROBOT_DATABASE[clean_id]["x"] = payload.x
    ROBOT_DATABASE[clean_id]["y"] = payload.y
    return {"status": "updated", "x": payload.x, "y": payload.y}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)