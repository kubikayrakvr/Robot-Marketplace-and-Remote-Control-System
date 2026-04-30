cat > ~/Robot-Marketplace-and-Remote-Control-System/migrations.sql << 'EOF'
-- Çalıştırmak için: docker exec sat0_postgres psql -U user -d robot_db -f /migrations.sql

-- Garanti süresi
ALTER TABLE robot_catalog ADD COLUMN IF NOT EXISTS warranty_months INTEGER DEFAULT 24;

-- ROS namespace
ALTER TABLE robot_catalog ADD COLUMN IF NOT EXISTS ros_namespace VARCHAR;

-- Stok
ALTER TABLE robot_catalog ADD COLUMN IF NOT EXISTS stock_count INTEGER DEFAULT 0;
ALTER TABLE robot_catalog ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE;

-- Güvenlik soruları
ALTER TABLE users ADD COLUMN IF NOT EXISTS security_question TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS security_answer TEXT;

-- Şikayet tablosu
CREATE TABLE IF NOT EXISTS support_tickets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    robot_inventory_id INTEGER REFERENCES robot_inventory(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
EOF
