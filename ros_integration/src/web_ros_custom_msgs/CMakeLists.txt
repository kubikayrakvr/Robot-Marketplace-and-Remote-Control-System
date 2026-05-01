cmake_minimum_required(VERSION 3.8)
project(web_ros_custom_msgs)

if(CMAKE_COMPILER_IS_GNUCXX OR CMAKE_CXX_COMPILER_ID MATCHES "Clang")
  add_compile_options(-Wall -Wextra -Wpedantic)
endif()

# ── 1. Required Dependencies ──────────────────────────────────────────
find_package(ament_cmake REQUIRED)
find_package(rosidl_default_generators REQUIRED) # Required for .msg files
find_package(geometry_msgs REQUIRED)           # Required because we use Twist

# ── 2. Generate Interfaces ────────────────────────────────────────────
# This tells ROS 2 to look for your .msg files and create C++ headers
rosidl_generate_interfaces(${PROJECT_NAME}
  "msg/AuthorizedTwist.msg"
  DEPENDENCIES geometry_msgs
)

# ── 3. Testing (Optional) ─────────────────────────────────────────────
if(BUILD_TESTING)
  find_package(ament_lint_auto REQUIRED)
  set(ament_cmake_copyright_FOUND TRUE)
  set(ament_cmake_cpplint_FOUND TRUE)
  ament_lint_auto_find_test_dependencies()
endif()

# ── 4. Export ─────────────────────────────────────────────────────────
ament_package()