#!/usr/bin/env python3
"""
robot_spawner_node — single ROS 2 node responsible for:

  * subscribing to /spawn_signal_topic and spawning a TurtleBot3 (waffle/burger)
    SDF model in Gazebo with a unique namespace,
  * enforcing a global capacity (max 3 active models) and reporting the result
    on /spawn_response_topic so the FastAPI backend can return HTTP 429,
  * subscribing to /despawn_signal_topic and tearing the instance back down
    (Gazebo entity + bridge + controller processes),
  * driving a synthetic per-namespace battery that depletes over time and
    publishes /{ns}/battery_state at 1 Hz.

Spawn payload format (CSV, parsed strictly):
    "{namespace},{x},{y},{theta},{robot_type},{battery_pct}"

Spawn response (JSON over std_msgs/String):
    {"namespace": "...", "status": "spawned"|"capacity_reached"|"error",
     "active_count": <int>, "limit": <int>, "reason": "..."}
"""

import json
import math
import os
import signal
import subprocess
import time

import ament_index_python.packages as ament
import rclpy
from rclpy.node import Node
from ros_gz_interfaces.srv import SpawnEntity
from std_msgs.msg import Float32, String


MAX_ACTIVE_ROBOTS = 3
DEFAULT_BATTERY_DRAIN_PCT_PER_MIN = 100.0 / 60.0    # full drain in 60 minutes
BATTERY_PUBLISH_HZ = 1.0


class RobotSpawner(Node):
    def __init__(self):
        super().__init__('robot_spawner_node')

        self.declare_parameter('spawn_signal_topic',   '/spawn_signal_topic')
        self.declare_parameter('spawn_response_topic', '/spawn_response_topic')
        self.declare_parameter('despawn_signal_topic', '/despawn_signal_topic')
        self.declare_parameter('sdf_package_name',     'robot_spawner')
        self.declare_parameter('max_active_robots',    MAX_ACTIVE_ROBOTS)
        self.declare_parameter('battery_drain_pct_per_min',
                               DEFAULT_BATTERY_DRAIN_PCT_PER_MIN)

        self._spawn_topic    = self.get_parameter('spawn_signal_topic').get_parameter_value().string_value
        self._response_topic = self.get_parameter('spawn_response_topic').get_parameter_value().string_value
        self._despawn_topic  = self.get_parameter('despawn_signal_topic').get_parameter_value().string_value
        self._max_robots     = int(self.get_parameter('max_active_robots').get_parameter_value().integer_value)
        self._drain_per_min  = float(self.get_parameter('battery_drain_pct_per_min').get_parameter_value().double_value)
        if self._drain_per_min <= 0.0:
            self._drain_per_min = DEFAULT_BATTERY_DRAIN_PCT_PER_MIN

        # active namespace → bookkeeping
        self._processes: dict[str, list[subprocess.Popen]] = {}
        self._spawned: set[str] = set()
        # battery: ns → {"start_pct": float, "start_ts": float, "pub": Publisher}
        self._battery: dict[str, dict] = {}

        self._spawn_sub = self.create_subscription(
            String, self._spawn_topic, self._on_spawn_signal, 10)
        self._despawn_sub = self.create_subscription(
            String, self._despawn_topic, self._on_despawn_signal, 10)
        self._response_pub = self.create_publisher(String, self._response_topic, 10)

        # 1 Hz battery tick: walk every active namespace, compute current %,
        # publish on /{ns}/battery_state. Cheap enough to do globally.
        self._battery_timer = self.create_timer(1.0 / BATTERY_PUBLISH_HZ, self._battery_tick)

        self.get_logger().info(
            f"Listening on {self._spawn_topic!r} and {self._despawn_topic!r}; "
            f"capacity={self._max_robots}; battery drain={self._drain_per_min:.4f} %/min"
        )

    # ── Spawn handler ─────────────────────────────────────────────────────────
    def _on_spawn_signal(self, msg: String):
        try:
            parts = msg.data.split(',')
            if len(parts) != 6:
                raise ValueError("Payload must be ns,x,y,theta,type,battery_pct")
            ns, x_str, y_str, theta_str, robot_type, battery_str = parts
            x = float(x_str); y = float(y_str); theta = float(theta_str)
            battery = float(battery_str)
        except ValueError as e:
            self.get_logger().error(f'Spawn aborted. Bad payload: {msg.data!r} ({e})')
            return

        if ns in self._spawned:
            self.get_logger().warn(f'{ns!r} already spawned — re-acknowledging.')
            self._publish_response(ns, "spawned",
                                   active_count=len(self._spawned),
                                   reason="already_active")
            return

        if len(self._spawned) >= self._max_robots:
            self.get_logger().warn(
                f'Capacity reached ({len(self._spawned)}/{self._max_robots}) '
                f'— refusing {ns!r}'
            )
            self._publish_response(ns, "capacity_reached",
                                   active_count=len(self._spawned))
            return

        sdf = self._load_sdf(ns, robot_type)
        if sdf is None:
            self._publish_response(ns, "error",
                                   active_count=len(self._spawned),
                                   reason="sdf_load_failed")
            return

        self._gazebo_spawn(ns, sdf, x, y, theta, battery)

    # ── Despawn handler ───────────────────────────────────────────────────────
    def _on_despawn_signal(self, msg: String):
        ns = msg.data.strip()
        if not ns:
            return
        if ns not in self._spawned and ns not in self._processes:
            self.get_logger().info(f'Despawn requested for unknown {ns!r}; ignoring.')
            return
        self.get_logger().info(f'Despawn requested for {ns!r}')
        self.despawn_robot(ns)

    # ── SDF loading ───────────────────────────────────────────────────────────
    def _load_sdf(self, ns: str, robot_type: str) -> str | None:
        pkg = self.get_parameter('sdf_package_name').get_parameter_value().string_value
        share = ament.get_package_share_directory(pkg)
        sdf_path = f'{share}/models/{robot_type}/model.sdf'
        try:
            with open(sdf_path) as f:
                sdf = f.read()
        except OSError as e:
            self.get_logger().error(f'Cannot open SDF for {robot_type!r} at {sdf_path}: {e}')
            return None
        if '__ROBOT_NAMESPACE__' not in sdf:
            self.get_logger().error('Placeholder __ROBOT_NAMESPACE__ missing from SDF.')
            return None
        return sdf.replace('__ROBOT_NAMESPACE__', f'/{ns}')

    # ── Gazebo spawn ──────────────────────────────────────────────────────────
    def _gazebo_spawn(self, ns: str, sdf: str, x: float, y: float,
                      theta: float, battery_pct: float):
        client = self.create_client(SpawnEntity, '/world/default/create')

        if not client.wait_for_service(timeout_sec=5.0):
            self.get_logger().error('Gazebo spawn service unavailable.')
            self._publish_response(ns, "error",
                                   active_count=len(self._spawned),
                                   reason="gazebo_service_unavailable")
            return

        req = SpawnEntity.Request()
        req.entity_factory.name            = ns
        req.entity_factory.sdf             = sdf
        req.entity_factory.pose.position.x = x
        req.entity_factory.pose.position.y = y
        req.entity_factory.pose.position.z = 0.5
        # Yaw → quaternion (rotation about Z).
        half = theta / 2.0
        req.entity_factory.pose.orientation.x = 0.0
        req.entity_factory.pose.orientation.y = 0.0
        req.entity_factory.pose.orientation.z = math.sin(half)
        req.entity_factory.pose.orientation.w = math.cos(half)

        future = client.call_async(req)
        future.add_done_callback(
            lambda f: self._on_spawn_response(ns, battery_pct, f)
        )

    def _on_spawn_response(self, ns: str, battery_pct: float, future):
        if future.result() is None:
            self.get_logger().error(f'Failed to initialise unit {ns!r}.')
            self._publish_response(ns, "error",
                                   active_count=len(self._spawned),
                                   reason="gazebo_create_returned_none")
            return

        self._spawned.add(ns)
        self._launch_ros_processes(ns)
        self._init_battery(ns, battery_pct)
        self._publish_response(ns, "spawned",
                               active_count=len(self._spawned))

    # ── Process management ────────────────────────────────────────────────────
    def _launch_ros_processes(self, ns: str):
        current_env = os.environ.copy()

        bridge_cmd = [
            "ros2", "run", "ros_gz_bridge", "parameter_bridge",
            "--ros-args", "-r", f"__node:=bridge_{ns}",
            "--",
            f"/{ns}/cmd_vel@geometry_msgs/msg/Twist]gz.msgs.Twist",
            f"/{ns}/odom@nav_msgs/msg/Odometry[gz.msgs.Odometry",
            f"/{ns}/scan@sensor_msgs/msg/LaserScan[gz.msgs.LaserScan",
            f"/{ns}/scan/points@sensor_msgs/msg/PointCloud2[gz.msgs.PointCloudPacked",
            f"/{ns}/camera/image_raw@sensor_msgs/msg/Image[gz.msgs.Image",
            f"/{ns}/camera/camera_info@sensor_msgs/msg/CameraInfo[gz.msgs.CameraInfo",
            f"/{ns}/imu@sensor_msgs/msg/Imu[gz.msgs.IMU",
            f"/model/{ns}/pose@geometry_msgs/msg/Pose[gz.msgs.Pose",
            "--ros-args", "-r", f"/model/{ns}/pose:=/{ns}/ground_truth"
        ]

        controller_cmd = [
            "ros2", "run", "robot_spawner", "robot_controller_node",
            "--ros-args", "-r", f"__ns:=/{ns}",
        ]

        try:
            self.get_logger().info(f"Starting ROS processes for namespace: {ns}")
            bridge_proc = subprocess.Popen(bridge_cmd, preexec_fn=os.setsid, env=current_env)
            controller_proc = subprocess.Popen(controller_cmd, preexec_fn=os.setsid, env=current_env)
            self._processes[ns] = [bridge_proc, controller_proc]
        except Exception as e:
            self.get_logger().error(f"Failed to launch processes for {ns}: {str(e)}")

    # ── Battery ───────────────────────────────────────────────────────────────
    def _init_battery(self, ns: str, start_pct: float):
        start_pct = max(0.0, min(100.0, float(start_pct)))
        pub = self.create_publisher(Float32, f'/{ns}/battery_state', 10)
        self._battery[ns] = {
            "start_pct": start_pct,
            "start_ts":  time.time(),
            "pub":       pub,
        }
        # Publish the initial value immediately so the dashboard isn't blank
        # for up to a second after claim.
        msg = Float32()
        msg.data = float(start_pct)
        pub.publish(msg)
        self.get_logger().info(
            f'[battery] {ns} initialised at {start_pct:.2f}% '
            f'(drain {self._drain_per_min:.4f} %/min)'
        )

    def _battery_tick(self):
        now = time.time()
        for ns, b in self._battery.items():
            elapsed_min = (now - b["start_ts"]) / 60.0
            current = max(0.0, b["start_pct"] - elapsed_min * self._drain_per_min)
            msg = Float32()
            msg.data = float(current)
            try:
                b["pub"].publish(msg)
            except Exception as e:
                self.get_logger().warn(f'[battery] publish failed for {ns}: {e}')

    # ── Despawn ───────────────────────────────────────────────────────────────
    def despawn_robot(self, ns: str):
        # Stop battery publisher first so we don't keep ticking after teardown.
        b = self._battery.pop(ns, None)
        if b is not None:
            try:
                self.destroy_publisher(b["pub"])
            except Exception:
                pass

        # Best-effort: remove the model from Gazebo via gz CLI. We don't fail
        # the despawn if this errors — process cleanup below still happens, and
        # subsequent claims for the same ns still work after entity removal.
        try:
            subprocess.run(
                ["gz", "service", "-s", "/world/default/remove",
                 "--reqtype", "gz.msgs.Entity",
                 "--reptype", "gz.msgs.Boolean",
                 "--timeout", "2000",
                 "--req", f'name: "{ns}", type: MODEL'],
                check=False, capture_output=True, timeout=4.0,
            )
        except Exception as e:
            self.get_logger().warn(f'[gz remove] {ns}: {e}')

        for proc in self._processes.pop(ns, []):
            try:
                os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
                proc.wait(timeout=5.0)
            except subprocess.TimeoutExpired:
                self.get_logger().warn(f'Process group {proc.pid} refused to exit. SIGKILL.')
                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
                proc.wait()
            except ProcessLookupError:
                pass

        self._spawned.discard(ns)
        self.get_logger().info(f'{ns!r} torn down (active={len(self._spawned)})')

    def despawn_all(self):
        for ns in list(self._spawned):
            self.despawn_robot(ns)

    # ── Helpers ───────────────────────────────────────────────────────────────
    def _publish_response(self, ns: str, status: str,
                          active_count: int, reason: str | None = None):
        payload = {
            "namespace":    ns,
            "status":       status,
            "active_count": active_count,
            "limit":        self._max_robots,
        }
        if reason:
            payload["reason"] = reason
        msg = String()
        msg.data = json.dumps(payload)
        try:
            self._response_pub.publish(msg)
        except Exception as e:
            self.get_logger().warn(f'[response] publish failed: {e}')


def main(args=None):
    rclpy.init(args=args)
    node = RobotSpawner()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.despawn_all()
        node.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == '__main__':
    main()
