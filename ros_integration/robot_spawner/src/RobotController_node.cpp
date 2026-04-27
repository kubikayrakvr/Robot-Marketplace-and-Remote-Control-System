#include <memory>
#include "rclcpp/rclcpp.hpp"
#include "robot_spawner/RobotController.hpp" // Update if your package name is different

int main(int argc, char * argv[])
{
    rclcpp::init(argc, argv);
    rclcpp::spin(std::make_shared<RobotController>());
    rclcpp::shutdown();
    return 0;
}