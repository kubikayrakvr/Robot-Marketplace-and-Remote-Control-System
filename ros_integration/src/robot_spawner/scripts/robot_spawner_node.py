#!/usr/bin/env python3
import asyncio
import subprocess
import os
import rclpy
from rclpy.node import Node
from std_msgs.msg import String
from ros_gz_interfaces.srv import SpawnEntity
import ament_index_python.packages as ament
import signal
import ctypes

class RobotSpawner(Node):
    def __init__(self):
            super().__init__('robot_spawner_node')

            self.declare_parameter('spawn_signal_topic', '/spawn_signal_topic')
            self.declare_parameter('sdf_package_name',   'robot_spawner')

            topic = self.get_parameter('spawn_signal_topic').get_parameter_value().string_value
            
            # Storage for process management
            self._processes: dict[str, list[subprocess.Popen]] = {}
            self._spawned:  set[str] = set()

            self._spawn_sub = self.create_subscription(
                String, topic, self._on_spawn_signal, 10)

            self.get_logger().info(f'Listening on {topic!r}')

    # ── Spawn signal (async so we can await the service future) ───────────────

    def _on_spawn_signal(self, msg: String):
        try:
            parts = msg.data.split(',')
            if len(parts) != 4:
                # Strictly enforce 4 parameters: ns, x, y, type
                raise ValueError("Payload must exactly contain ns,x,y,type")
                
            ns, x_str, y_str, robot_type = parts
            x, y = float(x_str), float(y_str)
            
        except ValueError as e:
            self.get_logger().error(f'Spawn aborted. Bad payload: {msg.data!r} ({e})')
            return

        if ns in self._spawned:
            self.get_logger().warn(f'{ns!r} already spawned — ignoring.')
            return

        sdf = self._load_sdf(ns, robot_type)
        if sdf is None:
            # File missing/cannot be opened. Abort.
            return

        # Fire and forget! 
        self._gazebo_spawn(ns, sdf, x, y)

    # ── SDF loading ───────────────────────────────────────────────────────────

    def _load_sdf(self, ns: str, robot_type: str) -> str | None:
        pkg = self.get_parameter('sdf_package_name').get_parameter_value().string_value
        share = ament.get_package_share_directory(pkg)
        
        # Dynamically build the path using the requested robot_type
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

    def _gazebo_spawn(self, ns: str, sdf: str, x: float, y: float):
        client = self.create_client(SpawnEntity, '/world/default/create')

        if not client.wait_for_service(timeout_sec=5.0):
            self.get_logger().error('Gazebo spawn service unavailable.')
            return

        req = SpawnEntity.Request()
        req.entity_factory.name            = ns
        req.entity_factory.sdf             = sdf
        req.entity_factory.pose.position.x = x
        req.entity_factory.pose.position.y = y
        req.entity_factory.pose.position.z = 0.5

        # Fire and forget with a done callback, mimicking the C++ lambda
        future = client.call_async(req)
        future.add_done_callback(lambda f: self._on_spawn_response(ns, f))

    def _on_spawn_response(self, ns: str, future):
        if future.result() is None:
            self.get_logger().error(f'Failed to initialise unit {ns!r}.')
            return
            
        self._spawned.add(ns)
        self._launch_ros_processes(ns)

    # ── ROS 2 process management via Process Groups ───────────────────────────

    def _launch_ros_processes(self, ns: str):
        """
        Dynamically launches the Gazebo bridge and the RobotController node
        by inheriting the current sourced environment.
        """
        # 1. Capture the environment from the current terminal. 
        # This ensures that your local workspace (web_ros_custom_msgs, robot_spawner)
        # is visible to the subprocess without needing to source a static path.
        current_env = os.environ.copy()

        # 2. Define the bridge command. 
        # Directionality: 
        # [ = Gz -> ROS (Sensors/Odom)
        # ] = ROS -> Gz (Actuators/Cmd_vel)
        bridge_cmd = [
            "ros2", "run", "ros_gz_bridge", "parameter_bridge",
            f"/{ns}/cmd_vel@geometry_msgs/msg/Twist]gz.msgs.Twist",
            f"/{ns}/odom@nav_msgs/msg/Odometry[gz.msgs.Odometry",
            f"/{ns}/scan@sensor_msgs/msg/LaserScan[gz.msgs.LaserScan",
            f"/{ns}/scan/points@sensor_msgs/msg/PointCloud2[gz.msgs.PointCloudPacked",
            f"/{ns}/camera/image_raw@sensor_msgs/msg/Image[gz.msgs.Image",
            f"/{ns}/camera/camera_info@sensor_msgs/msg/CameraInfo[gz.msgs.CameraInfo",
            f"/{ns}/imu@sensor_msgs/msg/Imu[gz.msgs.IMU",
            f"/{ns}/pose@geometry_msgs/msg/Pose[gz.msgs.Pose"
        ]

        # 3. Define the controller command.
        # We use the namespaced remapping (__ns:=/ns) to ensure the C++ node
        # correctly finds its local /cmd_vel_web and /session/heartbeat topics.
        controller_cmd = [
            "ros2", "run", "robot_spawner", "robot_controller_node",
            "--ros-args", "-r", f"__ns:=/{ns}"
        ]

        # 4. Launch the processes using Process Groups (os.setsid).
        # This allows the despawn_robot method to kill the entire tree cleanly later.
        try:
            self.get_logger().info(f"Starting ROS processes for namespace: {ns}")
            
            bridge_proc = subprocess.Popen(
                bridge_cmd, 
                preexec_fn=os.setsid, 
                env=current_env
            )
            
            controller_proc = subprocess.Popen(
                controller_cmd, 
                preexec_fn=os.setsid, 
                env=current_env
            )

            # Store for management
            self._processes[ns] = [bridge_proc, controller_proc]
            
        except Exception as e:
            self.get_logger().error(f"Failed to launch processes for {ns}: {str(e)}")

    # ── Despawn ───────────────────────────────────────────────────────────────

    def despawn_robot(self, ns: str):
        for proc in self._processes.pop(ns, []):
            try:
                # Kill the entire process group (bash + ros2 run + actual node)
                os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
                proc.wait(timeout=5.0)
            except subprocess.TimeoutExpired:
                self.get_logger().warn(f'Process group {proc.pid} refused to exit. Sending SIGKILL.')
                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
                proc.wait()
            except ProcessLookupError:
                pass # Process already died cleanly

        self._spawned.discard(ns)

    def despawn_all(self):
        for ns in list(self._spawned):
            self.despawn_robot(ns)


# ── Entry point ───────────────────────────────────────────────────────────────

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
        
        # ONLY shutdown if the context is still valid
        if rclpy.ok():
            rclpy.shutdown()

if __name__ == '__main__':
    main()