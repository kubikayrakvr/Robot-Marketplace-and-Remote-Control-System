#pragma once

#include <rclcpp/rclcpp.hpp>
#include <geometry_msgs/msg/twist.hpp>
#include <sensor_msgs/msg/laser_scan.hpp>
#include <std_msgs/msg/float32.hpp>
#include <std_msgs/msg/string.hpp>

#include <limits>
#include <cmath>
#include <string>

#include "web_ros_custom_msgs/msg/authorized_twist.hpp"

class RobotController : public rclcpp::Node
{
public:
    RobotController();

private:
    // ── Constants ─────────────────────────────────────────────────────────────
    static constexpr float SAFETY_CONE_HALF_ANGLE_RAD    = 30.0f * M_PI / 180.0f;
    static constexpr float FORWARD_COLLISION_THRESHOLD_M  = 0.35f;
    static constexpr float BACKWARD_COLLISION_THRESHOLD_M = 0.75f;

    // ── Subscriptions ──────────────────────────────────────────────────────────
    rclcpp::Subscription<web_ros_custom_msgs::msg::AuthorizedTwist>::SharedPtr subscription_;
    rclcpp::Subscription<sensor_msgs::msg::LaserScan>::SharedPtr scan_subscription_;

    /// Receives periodic "I am alive" pulses from the active web client.
    /// The message payload carries the session token issued at claim time so
    /// the controller can log who is driving; the session is considered active
    /// as long as pulses keep arriving within session_timeout_.
    rclcpp::Subscription<std_msgs::msg::String>::SharedPtr session_hb_sub_;

    // ── Publishers ────────────────────────────────────────────────────────────
    rclcpp::Publisher<geometry_msgs::msg::Twist>::SharedPtr publisher_;
    rclcpp::Publisher<std_msgs::msg::Float32>::SharedPtr    closest_pub_;
    rclcpp::Publisher<std_msgs::msg::String>::SharedPtr     status_pub_;

    /// Broadcasts the current session state so the frontend and any monitoring
    /// tool can display it.  Possible values:
    ///   "FREE"                      – no one is connected
    ///   "OCCUPIED:<token_prefix>"   – a client holds the session
    ///   "EXPIRED"                   – heartbeats stopped; session cleared
    rclcpp::Publisher<std_msgs::msg::String>::SharedPtr session_status_pub_;

    // ── Timer ──────────────────────────────────────────────────────────────────
    rclcpp::TimerBase::SharedPtr timer_;

    // ── cmd_vel watchdog state ─────────────────────────────────────────────────
    rclcpp::Time     last_msg_time_;
    rclcpp::Duration timeout_;
    bool             is_stopped_;

    // ── Laser scan state ───────────────────────────────────────────────────────
    float closest_distance_;
    float closest_forward_distance_;
    float closest_rear_distance_;

    // ── Session state ──────────────────────────────────────────────────────────
    bool             session_active_;
    std::string      current_session_token_;
    rclcpp::Time     session_last_heartbeat_;
    rclcpp::Duration session_timeout_;   ///< How long to wait before auto-expiry

    // ── Callbacks ──────────────────────────────────────────────────────────────
    void listener_callback(const web_ros_custom_msgs::msg::AuthorizedTwist::SharedPtr msg);
    void scan_callback(const sensor_msgs::msg::LaserScan::SharedPtr msg);
    void timer_callback();

    /// Called when a heartbeat arrives on the `session/heartbeat` topic.
    void session_heartbeat_callback(const std_msgs::msg::String::SharedPtr msg);

    // ── Helpers ────────────────────────────────────────────────────────────────
    bool is_collision_imminent(const geometry_msgs::msg::Twist & cmd) const;

    /// Publish the current session state string on session_status_pub_.
    void publish_session_status();
};