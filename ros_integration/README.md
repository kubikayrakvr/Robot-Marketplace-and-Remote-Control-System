# Web-ROS Integration — Multi-Robot Fleet Dashboard

A full-stack system developed with ROS Jazzy for controlling and monitoring a fleet of TurtleBot3 robots through a browser. A **FastAPI** backend bridges between web clients and ROS 2, while a **C++ RobotController** node enforces exclusive session ownership and collision safety directly on the ROS side.

---

## Architecture Overview

```
Browser (roslibjs + Dashboard UI)
        │  WebSocket (rosbridge :9090)   ← cmd_vel_web, session/heartbeat
        │  REST / WebSocket (:8000)      ← claim, heartbeat, telemetry WS
        │  MJPEG stream (:8090)          ← gated camera proxy
        ▼
  FastAPI Server  ←──── ros_web_integration_prototype.py
        │  ROS 2 subscriptions (Odom, IMU, LaserScan, Pose, Status)
        │
  ROS 2 Graph
  ├── rosbridge_server        (WebSocket ↔ ROS bridge)
  ├── web_video_server        (MJPEG camera stream)
  ├── RobotSpawner node       (spawns robots into Gazebo on demand)
  │     └── per-robot:
  │           ├── ros_gz_bridge   (Gazebo ↔ ROS topics)
  │           └── RobotController (C++ — session guard + collision safety)
  └── Gazebo (gz sim)
```

### Session Flow

1. Browser calls `POST /api/robot/{id}/claim` → FastAPI issues a UUID token.
2. Browser publishes the token to `/{ns}/session/heartbeat` via rosbridge at ~3 Hz.
3. `RobotController` validates every incoming `AuthorizedTwist` message against the stored token — motion is blocked if the token is missing or wrong.
4. If heartbeats stop for 15 s, both FastAPI (reaper task) and `RobotController` (watchdog timer) independently expire the session and halt the robot.

---

## Custom Messages (`web_ros_custom_msgs`)

The `AuthorizedTwist` message bundles a session token with a velocity command so the C++ node can authenticate and execute in a single callback.

```
# web_ros_custom_msgs/msg/AuthorizedTwist.msg
string token
geometry_msgs/Twist command
```

Build the package before anything else:

```bash
cd ~/your_ws
colcon build --packages-select web_ros_custom_msgs
source install/setup.bash
```

---

## 1. ROSBridge Suite

Provides the WebSocket bridge that lets the browser publish/subscribe to ROS topics using `roslibjs`.

### Option A — rosbridge only

```bash
ros2 launch rosbridge_server rosbridge_websocket_launch.xml
```

### Option B — rosbridge + web_video_server (recommended)

Use the provided combined launch file, which starts both services together:

```bash
ros2 launch rosbridge_server rosbridge_endpoints_launch.xml
```

Default ports:

| Service | Port |
|---|---|
| ROSBridge WebSocket | 9090 |
| Web Video Server (MJPEG) | 8090 |

You can override either at launch time:

```bash
ros2 launch rosbridge_server rosbridge_endpoints_launch.xml \
    rosbridge_port:=9090 video_port:=8090
```

---

## 2. TurtleBot3 Gazebo Simulation

### 2.1 Install dependencies

The simulation stack requires the TurtleBot3 core packages, the Gazebo (gz-sim) integration layer, and the ROS–Gazebo bridge that the spawner uses to wire up per-robot topics.

```bash
sudo apt update
sudo apt install -y \
    ros-jazzy-turtlebot3* \
    ros-jazzy-ros-gz* \
    ros-jazzy-nav2-msgs
```

Launch the world:

```bash
cd ~/turtlebot3_ws && source install/setup.bash

ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py
```
---

## 3. Robot Spawner Package

The `robot_spawner` package contains two nodes that work together.

### 3.1 Build

```bash
cd ~/your_ws
colcon build --packages-select robot_spawner
source install/setup.bash
```

### 3.2 RobotSpawner (Python)

Listens on `/spawn_signal_topic` for `"namespace,x,y"` strings. When a signal arrives it:
1. Injects the namespace into the robot SDF and calls the Gazebo spawn service.
2. Starts a `ros_gz_bridge` process for all sensors and actuators.
3. Starts a `RobotController` process namespaced to the new robot.

All child processes are managed in process groups so they can be cleanly killed on despawn.

```bash
ros2 launch robot_spawner robot_spawner.launch.py
```

To spawn a robot at runtime, publish a single message:

```bash
ros2 topic pub --once /spawn_signal_topic std_msgs/msg/String \
    "data: 'rob100,2.0,1.5'"
```

### 3.3 RobotController (C++)

Runs once per robot, under its namespace (e.g. `/rob100`). Key responsibilities:

| Feature | Detail |
|---|---|
| Session guard | Blocks `cmd_vel_web` commands whose token doesn't match the current owner |
| Heartbeat watchdog | Expires the session after 15 s without a heartbeat pulse |
| cmd_vel watchdog | Sends zero velocity if no valid command arrives within 350 ms |
| Collision safety | Reads `/scan` and blocks forward motion < 0.35 m, reverse < 0.75 m |
| Status broadcasts | Publishes `session/status` (`FREE` / `OCCUPIED:<prefix>` / `EXPIRED`) and `collision_status` |

Topics (all relative to the robot's namespace):

| Topic | Direction | Type |
|---|---|---|
| `cmd_vel_web` | Sub | `AuthorizedTwist` |
| `session/heartbeat` | Sub | `std_msgs/String` |
| `scan` | Sub | `sensor_msgs/LaserScan` |
| `cmd_vel` | Pub | `geometry_msgs/Twist` |
| `scan_closest` | Pub | `std_msgs/Float32` |
| `collision_status` | Pub | `std_msgs/String` |
| `session/status` | Pub | `std_msgs/String` |

---

## 4. FastAPI Backend

`ros_web_integration_prototype.py` serves the web dashboard and acts as the secure relay between the browser and the ROS graph.

### Install dependencies

```bash
pip install fastapi uvicorn httpx rclpy
```

### Run

```bash
python3 ros_web_integration_prototype.py
# Dashboard available at http://localhost:8000
```

### REST API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/robot/{id}` | None | Robot info + session status |
| `POST` | `/api/robot/{id}/claim` | None | Claim exclusive control → `{ "token": "..." }` or `423` |
| `DELETE` | `/api/robot/{id}/claim` | `X-Session-Token` header | Release control |
| `POST` | `/api/robot/{id}/release` | `X-Session-Token` header or `?token=` | `sendBeacon`-compatible release |
| `POST` | `/api/robot/{id}/heartbeat` | `X-Session-Token` header | Refresh session TTL (call every ~5 s) |
| `POST` | `/api/robot/{id}/pose` | None | Update stored world position |

### Streaming Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/robot/{id}/stream?token=<token>` | Token-gated MJPEG camera proxy — stream is cut immediately if ownership changes |
| `WS /api/robot/{id}/ws?token=<token>` | Secure WebSocket for real-time telemetry (Odom, IMU, LaserScan, collision status) |

### Robot Database

Pre-registered robots — edit `ROBOT_DATABASE` in the script to add or remove entries:

```python
ROBOT_DATABASE = {
    "ROB-100": {"namespace": "rob100", "x": 2.0,  "y": 1.5 },
    "ROB-200": {"namespace": "rob200", "x": -3.0, "y": -1.0},
    "ROB-300": {"namespace": "rob300", "x": 5.0,  "y": 0.0 },
}
```

---

## 5. Remote Access (Cloud Tunneling)

Forward all three service ports from your local machine to your cloud server over SSH. Run this on your local machine:

```bash
ssh -R 9090:localhost:9090 \
    -R 8090:localhost:8090 \
    -R 8000:localhost:8000 \
    root@YOUR_CLOUD_IP
```

Port summary:

| Port | Service |
|---|---|
| 9090 | ROSBridge WebSocket |
| 8090 | Web Video Server (MJPEG) |
| 8000 | FastAPI Dashboard |

---

## 6. Typical Startup Order

Run each of the following in a separate terminal, sourcing your workspace first (`source install/setup.bash`):

```bash
# 1. Gazebo simulation
ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py

# 2. ROSBridge + Web Video Server
ros2 launch rosbridge_server rosbridge_endpoints_launch.xml

# 3. Robot Spawner (spawns bots and starts per-robot controllers)
ros2 launch robot_spawner robot_spawner.launch.py

# 4. FastAPI backend
python3 ros_web_integration_prototype.py
```

Then open `http://localhost:8000` (or `http://YOUR_CLOUD_IP:8000`) in your browser.


