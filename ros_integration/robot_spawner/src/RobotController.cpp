#include "robot_spawner/RobotController.hpp" // Update if your package name is different

using namespace std::chrono_literals;

// ── Constructor ────────────────────────────────────────────────────────────────

RobotController::RobotController()
: Node("RobotController"),
  is_stopped_(true),
  timeout_(rclcpp::Duration::from_seconds(0.35)),
  closest_distance_(std::numeric_limits<float>::infinity()),
  closest_forward_distance_(std::numeric_limits<float>::infinity()),
  closest_rear_distance_(std::numeric_limits<float>::infinity()),
  // Session starts inactive. A web client must claim it through the FastAPI
  // layer and then begin publishing heartbeats before any motion is allowed.
  session_active_(false),
  session_timeout_(rclcpp::Duration::from_seconds(15.0))
{
    last_msg_time_        = this->now();
    session_last_heartbeat_ = this->now();

    // ── Subscriptions ────────────────────────────────────────────────────────
    subscription_ = this->create_subscription<web_ros_custom_msgs::msg::AuthorizedTwist>(
        "cmd_vel_web", 10,
        std::bind(&RobotController::listener_callback, this, std::placeholders::_1));

    scan_subscription_ = this->create_subscription<sensor_msgs::msg::LaserScan>(
        "scan", 10,
        std::bind(&RobotController::scan_callback, this, std::placeholders::_1));

    // The web client publishes its session token here at ~3 Hz while connected.
    // Arriving messages set session_active_ = true and refresh the timeout clock.
    session_hb_sub_ = this->create_subscription<std_msgs::msg::String>(
        "session/heartbeat", 10,
        std::bind(&RobotController::session_heartbeat_callback, this, std::placeholders::_1));

    // ── Publishers ───────────────────────────────────────────────────────────
    publisher_          = this->create_publisher<geometry_msgs::msg::Twist>("cmd_vel",          10);
    closest_pub_        = this->create_publisher<std_msgs::msg::Float32>   ("scan_closest",     10);
    status_pub_         = this->create_publisher<std_msgs::msg::String>    ("collision_status", 10);
    session_status_pub_ = this->create_publisher<std_msgs::msg::String>    ("session/status",   10);

    // ── 20 Hz watchdog + session expiry timer ─────────────────────────────────
    timer_ = this->create_wall_timer(50ms, std::bind(&RobotController::timer_callback, this));

    // Immediately broadcast FREE so the dashboard can display initial state.
    publish_session_status();
    RCLCPP_INFO(this->get_logger(), "RobotController ready. Session: FREE");
}

// ── Session heartbeat callback ─────────────────────────────────────────────────

void RobotController::session_heartbeat_callback(const std_msgs::msg::String::SharedPtr msg)
{
    // ── Exclusivity guard ─────────────────────────────────────────────────────
    // Reject any heartbeat whose token does not match the current owner, as long
    // as an owner token is actually set.  We check !current_session_token_.empty()
    // rather than session_active_ because timer_callback clears both fields
    // together at expiry: once the old session expires the token is reset to ""
    // and this guard transparently opens the door for the next legitimate claim.
    //
    // The previous condition (session_active_ && ...) had a logical gap: during
    // the window between session_active_ being set to false (expiry) and the
    // timer_callback clearing current_session_token_ to "", the guard was off
    // while the old token was still populated, allowing a second client to slip
    // through at the ROS layer without going through the FastAPI claim flow.
    //
    // This is the last line of defence: the FastAPI claim endpoint is the primary
    // gatekeeper, but anyone with rosbridge access could otherwise publish here
    // and steal the session without going through the HTTP claim flow.
    if (!current_session_token_.empty() && msg->data != current_session_token_) {
        RCLCPP_WARN_THROTTLE(this->get_logger(), *this->get_clock(), 5000,
            "Rejected heartbeat from non-owner token [%.8s…] — session already held by [%.8s…].",
            msg->data.c_str(), current_session_token_.c_str());
        return;
    }

    const bool was_active = session_active_;

    session_active_          = true;
    session_last_heartbeat_  = this->now();

    // Only update the stored token and log when a genuinely new session starts
    // so that the steady-state path (same token, same client) stays hot.
    if (msg->data != current_session_token_) {
        current_session_token_ = msg->data;
        RCLCPP_INFO(this->get_logger(),
            "Session claimed by token prefix [%.8s…]", msg->data.c_str());
        publish_session_status();
    } else if (!was_active) {
        // Token is the same but we had expired — log resumption.
        RCLCPP_INFO(this->get_logger(), "Session resumed for token [%.8s…]", msg->data.c_str());
        publish_session_status();
    }
}

// ── Scan callback — runs every time a new LaserScan arrives ────────────────────

void RobotController::scan_callback(const sensor_msgs::msg::LaserScan::SharedPtr msg)
{
    float min_all     = std::numeric_limits<float>::infinity();
    float min_forward = std::numeric_limits<float>::infinity();
    float min_rear    = std::numeric_limits<float>::infinity();

    // The Waffle footprint radius is roughly 0.22 meters.
    // Ignore anything closer so the robot doesn't get blocked by its own chassis.
    const float ROBOT_FOOTPRINT_RADIUS = 0.22f;

    for (size_t i = 0; i < msg->ranges.size(); ++i) {
        const float r = msg->ranges[i];

        if (!std::isfinite(r) || r < msg->range_min || r > msg->range_max || r < ROBOT_FOOTPRINT_RADIUS) {
            continue;
        }

        if (r < min_all) {
            min_all = r;
        }

        float angle = msg->angle_min + static_cast<float>(i) * msg->angle_increment;
        while (angle >  M_PI) angle -= 2.0f * M_PI;
        while (angle < -M_PI) angle += 2.0f * M_PI;

        const float abs_angle = std::abs(angle);

        if (abs_angle <= SAFETY_CONE_HALF_ANGLE_RAD) {
            if (r < min_forward) min_forward = r;
        }

        if (abs_angle >= (M_PI - SAFETY_CONE_HALF_ANGLE_RAD)) {
            if (r < min_rear) min_rear = r;
        }
    }

    closest_distance_         = min_all;
    closest_forward_distance_ = min_forward;
    closest_rear_distance_    = min_rear;

    auto dist_msg = std_msgs::msg::Float32();
    dist_msg.data = std::isfinite(min_all) ? min_all : -1.0f;
    closest_pub_->publish(dist_msg);
}

// ── Collision check ────────────────────────────────────────────────────────────

bool RobotController::is_collision_imminent(const geometry_msgs::msg::Twist & cmd) const
{
    if (cmd.linear.x > 0.0 && closest_forward_distance_ < FORWARD_COLLISION_THRESHOLD_M) {
        return true;
    }
    if (cmd.linear.x < 0.0 && closest_rear_distance_ < BACKWARD_COLLISION_THRESHOLD_M) {
        return true;
    }
    return false;
}

// ── cmd_vel_web callback — gate through session check, then collision check ─────

void RobotController::listener_callback(const web_ros_custom_msgs::msg::AuthorizedTwist::SharedPtr msg)
{
    if (!session_active_ || msg->token != current_session_token_) {
        auto status_msg = std_msgs::msg::String();
        status_msg.data = "UNAUTHORIZED: Missing or invalid session token.";
        status_pub_->publish(status_msg);

        RCLCPP_WARN_THROTTLE(this->get_logger(), *this->get_clock(), 2000,
            "Blocked unauthorized command from token [%.8s…]. Current owner: [%.8s…].",
            msg->token.c_str(), current_session_token_.c_str());
        return;
    }

    // Update the watchdog since we received a valid, authorized command
    last_msg_time_ = this->now();
    is_stopped_    = false;

    auto status_msg = std_msgs::msg::String();

    // The movement data is now nested inside the 'command' field of our custom message
    if (is_collision_imminent(msg->command)) {
        const bool is_moving_forward = (msg->command.linear.x > 0.0);
        const std::string collision_type = is_moving_forward ? "FORWARD" : "REAR";
        const float blocking_dist = is_moving_forward ? closest_forward_distance_ : closest_rear_distance_;
        const float active_threshold = is_moving_forward ? FORWARD_COLLISION_THRESHOLD_M : BACKWARD_COLLISION_THRESHOLD_M;

        status_msg.data = "BLOCKED (" + collision_type + " COLLISION): obstacle at " +
                          std::to_string(blocking_dist) + " m — threshold is " +
                          std::to_string(active_threshold) + " m";

        status_pub_->publish(status_msg);
        publisher_->publish(geometry_msgs::msg::Twist()); // Send zero velocity
        is_stopped_ = true;
        return;
    }

    status_msg.data = "OK";
    status_pub_->publish(status_msg);
    
    // Publish the validated nested command to the real /cmd_vel topic
    publisher_->publish(msg->command);


}

// ── Watchdog + session expiry timer (20 Hz) ────────────────────────────────────

void RobotController::timer_callback()
{
    const auto now = this->now();

    // ── cmd_vel watchdog ─────────────────────────────────────────────────────
    if (!is_stopped_) {
        if (now - last_msg_time_ > timeout_) {
            publisher_->publish(geometry_msgs::msg::Twist());
            is_stopped_ = true;
        }
    }

    // ── Session expiry check ──────────────────────────────────────────────────
    // If the active client stops sending heartbeats (e.g. browser tab closed,
    // network dropped, or the user explicitly disconnected), we:
    //   1. Mark the session as FREE so another user can claim the robot.
    //   2. Zero velocity once (belt-and-suspenders on top of the watchdog).
    if (session_active_ && (now - session_last_heartbeat_ > session_timeout_)) {
        RCLCPP_WARN(this->get_logger(),
            "Session heartbeat timed out for token [%.8s…]. Session released.",
            current_session_token_.c_str());

        session_active_        = false;
        current_session_token_ = "";

        // Make absolutely sure the robot is stopped.
        publisher_->publish(geometry_msgs::msg::Twist());
        is_stopped_ = true;

        publish_session_status();
    }
}

// ── Session status publisher ───────────────────────────────────────────────────

void RobotController::publish_session_status()
{
    auto msg = std_msgs::msg::String();

    if (session_active_ && !current_session_token_.empty()) {
        // Expose only the first 8 characters of the token — enough to identify
        // the session in logs/UI without leaking the full credential.
        const std::string prefix = current_session_token_.size() >= 8
            ? current_session_token_.substr(0, 8)
            : current_session_token_;
        msg.data = "OCCUPIED:" + prefix;
    } else {
        msg.data = "FREE";
    }
    session_status_pub_->publish(msg);
}