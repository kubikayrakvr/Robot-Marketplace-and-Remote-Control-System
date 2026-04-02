# Web-ROS Integration

Explanation for running the ROS side of the project.

## ROSBridge Suite

### Clone and build the suite
```bash
git clone https://github.com/RobotWebTools/rosbridge_suite.git
colcon build --packages-select rosbridge_server rosbridge_msgs rosbridge_library
source install/setup.bash
ros2 launch rosbridge_server rosbridge_websocket_launch.xml 
```

## TurtleBot3 Gazebo Simulation

1. Setup simulation workspace
```bash
mkdir -p ~/turtlebot3_ws/src/
sudo apt update
sudo apt install ros-humble-turtlebot3-msgs ros-humble-turtlebot3
cd ~/turtlebot3_ws/src/
git clone -b humble https://github.com/ROBOTIS-GIT/turtlebot3_simulations.git
cd ~/turtlebot3_ws && colcon build --symlink-install
```

2. Launch the world
```bash
cd ~/turtlebot3_ws
source install/setup.bash
export TURTLEBOT3_MODEL=waffle_pi
ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py 
```

3. Teleop (Keyboard Control)
```bash
cd ~/turtlebot3_ws
source install/setup.bash
export TURTLEBOT3_MODEL=waffle_pi
ros2 run turtlebot3_teleop teleop_keyboard
```

## Web Video Server

1. Install and run the video server (Default port: 8080)
```bash
sudo apt update
sudo apt install ros-humble-web-video-server
ros2 run web_video_server web_video_server
```

## Remote Access (Cloud Tunneling)

You must create an SSH tunnel from your local machine (where the simulation is running) to the cloud server to bridge the data:

Run this on your local computer:
```bash
ssh -R 9090:localhost:9090 -R 8080:localhost:8080 root@YOUR_CLOUD_IP
```

Default Port Mapping:

    9090: ROSBridge WebSocket

    8080: Web Video Server

    8000: FastAPI Web Dashboard