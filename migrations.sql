-- Robot Marketplace Temel Tablo Yapısı
CREATE TABLE IF NOT EXISTS robot_catalog (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100),
    price FLOAT NOT NULL,
    description TEXT,
    stock_count INTEGER DEFAULT 0,
    is_available BOOLEAN DEFAULT TRUE,
    warranty_months INTEGER DEFAULT 24,
    ros_namespace VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS robot_inventory (
    id SERIAL PRIMARY KEY,
    catalog_id INTEGER REFERENCES robot_catalog(id) ON DELETE CASCADE,
    serial_number VARCHAR(100) UNIQUE,
    activation_code VARCHAR(100),
    is_activated BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    security_question TEXT,
    security_answer TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

-- Per-instance simulator state for each user_robots row.
ALTER TABLE user_robots ADD COLUMN IF NOT EXISTS last_x DOUBLE PRECISION;
ALTER TABLE user_robots ADD COLUMN IF NOT EXISTS last_y DOUBLE PRECISION;
ALTER TABLE user_robots ADD COLUMN IF NOT EXISTS last_theta DOUBLE PRECISION;
ALTER TABLE user_robots ADD COLUMN IF NOT EXISTS last_battery_pct DOUBLE PRECISION;
