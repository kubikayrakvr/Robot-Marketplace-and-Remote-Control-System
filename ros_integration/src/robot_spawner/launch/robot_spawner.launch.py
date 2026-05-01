import os
from launch import LaunchDescription
from launch.substitutions import PathJoinSubstitution
from launch_ros.actions import Node
from launch_ros.substitutions import FindPackageShare

def generate_launch_description():

    param_file = PathJoinSubstitution([
        FindPackageShare('robot_spawner'),
        'config',
        'params.yaml'
    ])

    # Bridges /world/default/create so the Python spawner can call it as a ROS service
    spawn_bridge = Node(
        package='ros_gz_bridge',
        executable='parameter_bridge',
        name='gz_spawn_bridge',
        arguments=[
            '/world/default/create'
            '@ros_gz_interfaces/srv/SpawnEntity'
            '@gz.msgs.EntityFactory'
            '@gz.msgs.Boolean'
        ],
        output='screen'
    )

    spawner_node = Node(
        package='robot_spawner',
        executable='robot_spawner_node.py',  # ← updated from robot_spawner_node
        name='robot_spawner_node',
        parameters=[param_file],
        output='screen'
    )

    return LaunchDescription([
        spawn_bridge,
        spawner_node
    ])