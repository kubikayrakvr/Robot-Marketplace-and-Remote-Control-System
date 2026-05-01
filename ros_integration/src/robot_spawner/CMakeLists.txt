cmake_minimum_required(VERSION 3.8)
project(robot_spawner)

if(CMAKE_COMPILER_IS_GNUCXX OR CMAKE_CXX_COMPILER_ID MATCHES "Clang")
  add_compile_options(-Wall -Wextra -Wpedantic)
endif()

# ── Dependencies ───────────────────────────────────────────────────────
find_package(ament_cmake        REQUIRED)
find_package(ament_cmake_python REQUIRED) 
find_package(rclcpp             REQUIRED)
find_package(std_msgs           REQUIRED)
find_package(geometry_msgs      REQUIRED)
find_package(sensor_msgs        REQUIRED)
find_package(web_ros_custom_msgs REQUIRED)

# ── RobotController (C++) ──────────────────────────────────────────────
add_executable(robot_controller_node
  src/RobotController.cpp
  src/RobotController_node.cpp)

target_include_directories(robot_controller_node PUBLIC
  $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
  $<INSTALL_INTERFACE:include>)

ament_target_dependencies(robot_controller_node
  rclcpp geometry_msgs sensor_msgs std_msgs web_ros_custom_msgs)

# ── RobotSpawner (Python) ──────────────────────────────────────────────
install(PROGRAMS
  scripts/robot_spawner_node.py
  DESTINATION lib/${PROJECT_NAME})

# ── Install rules ──────────────────────────────────────────────────────
install(TARGETS robot_controller_node
  RUNTIME DESTINATION lib/${PROJECT_NAME})

install(DIRECTORY include/
  DESTINATION include)

install(DIRECTORY launch
  DESTINATION share/${PROJECT_NAME})

install(DIRECTORY config
  DESTINATION share/${PROJECT_NAME})

install(DIRECTORY models
  DESTINATION share/${PROJECT_NAME})

# ── Testing ────────────────────────────────────────────────────────────
if(BUILD_TESTING)
  find_package(ament_lint_auto REQUIRED)
  set(ament_cmake_copyright_FOUND TRUE)
  set(ament_cmake_cpplint_FOUND    TRUE)
  ament_lint_auto_find_test_dependencies()
endif()

ament_package()