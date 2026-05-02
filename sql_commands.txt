# Tüm kullanıcılar
docker exec sat0_postgres psql -U user -d robot_db -c "SELECT id, email, username, is_active, is_admin FROM users ORDER BY id;"

# Tüm robotlar
docker exec sat0_postgres psql -U user -d robot_db -c "SELECT id, name, type, price, stock_count, is_available, ros_namespace FROM robot_catalog;"

# Envanter
docker exec sat0_postgres psql -U user -d robot_db -c "SELECT id, catalog_id, serial_number, is_activated FROM robot_inventory ORDER BY catalog_id;"

# Kullanıcı robotları
docker exec sat0_postgres psql -U user -d robot_db -c "SELECT ur.id, ur.user_id, rc.name, ri.serial_number, ur.nickname FROM user_robots ur JOIN robot_inventory ri ON ur.inventory_id = ri.id JOIN robot_catalog rc ON ri.catalog_id = rc.id;"

# Siparişler
docker exec sat0_postgres psql -U user -d robot_db -c "SELECT o.id, u.email, o.total_amount, o.status, o.created_at FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC;"

# Son 10 güvenlik logu
docker exec sat0_postgres psql -U user -d robot_db -c "SELECT action, ip_address, details, timestamp FROM audit_logs ORDER BY timestamp DESC LIMIT 10;"

# Destek talepleri
docker exec sat0_postgres psql -U user -d robot_db -c "SELECT st.id, u.email, st.title, st.status FROM support_tickets st JOIN users u ON st.user_id = u.id;"
