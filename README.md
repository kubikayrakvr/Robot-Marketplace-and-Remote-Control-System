# 🤖 RoboFleet — Hizmet Robotu Satış ve Uzaktan Yönetim Sistemi

> BLM2732 — Sistem Analizi ve Tasarımı · Grup 7 · YTÜ · 2026

---

## Genel Mimari

```
KULLANICI TARAYICISI (React.js)
          │  (HTTP / WebSocket)
          ▼
┌─────────────────────────────────┐
│       FASTAPI BACKEND           │
│  (Uvicorn + PostgreSQL + Redis) │
│  - Auth: JWT RS256              │
│  - DB: SQLAlchemy ORM           │
│  - Session: Redis Blacklist     │
└─────────────┬───────────────────┘
              │
    [ rosbridge :9090 ] + [ web_video_server :8090 ]
              │
┌─────────────▼───────────────────┐
│     ROS 2 + Gazebo Simülasyonu  │
│  - TurtleBot3 (Waffle / Burger) │
│  - RobotController (C++)        │
│  - AuthorizedTwist mesajları    │
└─────────────────────────────────┘
```

---

## Gereksinimler

### Sunucu (Backend / Frontend)

| Bileşen | Versiyon | Açıklama |
|---|---|---|
| Python | 3.11+ | Backend dili |
| FastAPI | 0.100+ | Web çerçevesi |
| Uvicorn | 0.20+ | ASGI sunucu |
| SQLAlchemy | 2.x | ORM katmanı |
| PostgreSQL | 17 | İlişkisel veritabanı |
| Redis | 7+ | JWT blacklist önbelleği |
| Node.js | 20+ | Frontend build aracı |
| React | 18 | Kullanıcı arayüzü |
| Docker & Compose | 24+ | Konteyner yönetimi |

### Robot / Simülasyon (ROS Makinesi)

| Bileşen | Versiyon | Açıklama |
|---|---|---|
| Ubuntu | 22.04 LTS | İşletim sistemi |
| ROS 2 | Jazzy | Robot işletim sistemi |
| Gazebo | Garden | 3D simülasyon ortamı |
| rosbridge_suite | Son sürüm | WebSocket köprüsü (:9090) |
| web_video_server | Son sürüm | MJPEG kamera akışı (:8090) |
| TurtleBot3 paketleri | Jazzy uyumlu | Robot modeli ve sürücüleri |

---

## Ortam Değişkenleri (.env)

Proje kök dizininde `.env` dosyası oluşturun:

```env
POSTGRES_USER=user
POSTGRES_PASSWORD=password
POSTGRES_DB=robot_db
DATABASE_URL=postgresql://user:password@db:5432/robot_db
REDIS_URL=redis://redis:6379/0
SECRET_KEY=gizli_anahtar
ALGORITHM=RS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

---

## Kurulum ve Çalıştırma

```bash
# 1. Repoyu klonlayın
git clone https://github.com/kubikayrakvr/Robot-Marketplace-and-Remote-Control-System
cd Robot-Marketplace-and-Remote-Control-System

# 2. Ortam değişkenlerini ayarlayın
cp .env.example .env  # .env dosyasını düzenleyin

# 3. Konteynerleri başlatın
docker compose up -d

# 4. Veritabanı şemasını uygulayın
docker exec sat0_postgres psql -U user -d robot_db < migrations.sql
```

### Servisler ve Portlar

| Servis | Port | Açıklama |
|---|---|---|
| Frontend (React + Vite) | :5173 | Kullanıcı arayüzü |
| Backend (FastAPI) | :8000 | REST API + WebSocket |
| PostgreSQL | :5432 | Veritabanı |
| Redis | :6379 | Önbellek |

### Python Bağımlılıkları

```bash
pip install -r requirements.txt --break-system-packages
```

Başlıca kütüphaneler:
- `fastapi` + `uvicorn[standard]` — Web çerçevesi ve ASGI sunucu
- `sqlalchemy` + `psycopg2-binary` — ORM ve PostgreSQL sürücüsü
- `python-jose` — JWT token üretimi ve doğrulaması
- `passlib[bcrypt]` — Şifre hash'leme
- `pydantic[email]` — Veri doğrulama ve e-posta formatı
- `httpx` + `websockets` — Async HTTP istemci ve WebSocket
- `python-dateutil` — Garanti tarihi hesaplama

---

## 🤖 ROS 2 / Gazebo Simülasyonu Başlatma

Her terminal için önce workspace'i kaynak gösterin:

```bash
source /opt/ros/jazzy/setup.bash
source ~/your_ws/install/setup.bash
```

Sırayla çalıştırın (her biri ayrı terminalde):

```bash
# 1. Gazebo simülasyonu
ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py

# 2. ROSBridge WebSocket sunucusu
ros2 launch rosbridge_server rosbridge_websocket_launch.xml

# 3. Web video sunucusu
ros2 run web_video_server web_video_server --ros-args -p port:=8090

# 4. Robot spawner
ros2 launch robot_spawner robot_spawner.launch.py

# 5. Robot spawn et
ros2 topic pub --once /spawn_signal_topic std_msgs/msg/String "data: 'rob100,2.0,1.5,waffle'"
ros2 topic pub --once /spawn_signal_topic std_msgs/msg/String "data: 'rob200,-3.0,0.5,burger'"
```
---

## 🗄️ Veritabanı Yönetimi

### Şema Güncellemeleri

```bash
docker exec sat0_postgres psql -U user -d robot_db < migrations.sql
```

### Faydalı SQL Komutları

```bash
# Tüm kullanıcılar
docker exec sat0_postgres psql -U user -d robot_db -c "SELECT id, email, username, is_admin FROM users;"

# Tüm robotlar
docker exec sat0_postgres psql -U user -d robot_db -c "SELECT id, name, stock_count, ros_namespace FROM robot_catalog;"

# Son güvenlik logları
docker exec sat0_postgres psql -U user -d robot_db -c "SELECT action, ip_address, timestamp FROM audit_logs ORDER BY timestamp DESC LIMIT 20;"

# Başarısız girişler
docker exec sat0_postgres psql -U user -d robot_db -c "SELECT * FROM audit_logs WHERE action = 'LOGIN_FAILED';"

# Robot komut logları
docker exec sat0_postgres psql -U user -d robot_db -c "SELECT * FROM audit_logs WHERE action = 'ROBOT_COMMAND';"

# Şüpheli IP'ler (son 10 dakika)
docker exec sat0_postgres psql -U user -d robot_db -c "SELECT ip_address, COUNT(*) FROM audit_logs WHERE action LIKE '%FAILED%' AND timestamp > NOW() - INTERVAL '10 minutes' GROUP BY ip_address HAVING COUNT(*) >= 5;"
```

---

## 🛡️ Siber Güvenlik

### Otomatik IP Engelleme

Script 5 dakikada bir çalışarak şüpheli IP'leri otomatik engeller:

```bash
chmod +x scripts/ban_malicious_ips.sh

# Crontab'a ekleyin (crontab -e):
*/5 * * * * /bin/bash /root/Robot-Marketplace-and-Remote-Control-System/scripts/ban_malicious_ips.sh >> /var/log/robot_security.log 2>&1
```

### Banlı IP Yönetimi

```bash
# Banlı IP'leri listele
iptables -L DOCKER-USER -n --line-numbers

# IP banını kaldır
iptables -D DOCKER-USER -s <IP_ADRESI> -j DROP

# Satır numarasıyla kaldır
iptables -D DOCKER-USER <SATIR_NO>
```

---

## Admin Kullanıcısı Oluşturma

```bash
# 1. Şifre hash'i oluştur
docker exec sat0_backend python3 -c 'from app.core.security import hash_password; print(hash_password("Sifre123"))'

# 2. Veritabanına ekle
docker exec sat0_postgres psql -U user -d robot_db -c \
  "INSERT INTO users (email, username, hashed_password, is_active, is_admin) \
   VALUES ('admin@robofleet.com', 'admin', '<HASH_BURAYA>', true, true);"
```

---

## 📁 Proje Dizin Yapısı

```
├── app/                        # FastAPI backend
│   ├── routers/                # API endpoint'leri
│   ├── models/                 # SQLAlchemy modelleri
│   ├── schemas/                # Pydantic şemaları
│   └── core/                   # Güvenlik, bağımlılıklar
├── frontend/sat-proje/src/     # React frontend
│   ├── AdminPage/              # Admin paneli
│   ├── ControlPage/            # Robot kontrol paneli
│   ├── MyRobotsPage/           # Kullanıcı robot yönetimi
│   └── context/                # React context (Cart, Robot)
├── ros_integration/            # ROS 2 paketleri
│   ├── robot_spawner/          # Robot spawner node
│   └── web_ros_custom_msgs/    # AuthorizedTwist mesajı
├── scripts/                    # Yardımcı scriptler
│   └── ban_malicious_ips.sh    # Otomatik IP engelleme
├── migrations.sql              # Veritabanı şema güncellemeleri
├── docker-compose.yml          # Konteyner yapılandırması
├── requirements.txt            # Python bağımlılıkları
└── .env                        # Ortam değişkenleri (git'e dahil edilmez)
```

---

## Sık Karşılaşılan Sorunlar

| Sorun | Çözüm |
|---|---|
| Backend başlamıyor | `docker logs sat0_backend --tail 20` |
| Veritabanı bağlantı hatası | `.env` dosyasını kontrol edin, `docker compose restart` |
| `roslib.min.js` 404 hatası | `src/roslib.min.js` dosyasının mevcut olduğunu kontrol edin |
| 423 Locked (robot meşgul) | Session 15 saniye içinde otomatik serbest kalır |
| ROS topic gelmiyor | `ss -tlnp \| grep 9090` ile rosbridge kontrolü |
| Veri kaybolması | `docker compose down` yerine `docker compose restart` kullanın |

---

## Ekip

| Rol | Sorumlu |
|---|---|
| Proje Yöneticisi & Sistem Analisti | Üye 2 |
| Backend Geliştirici | Üye 3 |
| Frontend Geliştirici | Üye 4 |
| Robotik / Simülasyon Mühendisi | Üye 4 |
| Müşteri / Test | Üye 1 |

---

*YTÜ Bilgisayar Mühendisliği · BLM2732 Sistem Analizi ve Tasarımı · Bahar 2026*
