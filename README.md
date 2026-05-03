***

# 🤖 RoboFleet — Hizmet Robotu Satış ve Uzaktan Yönetim Sistemi

> YTÜ Bilgisayar Mühendisliği · BLM2732 Sistem Analizi ve Tasarımı · Bahar 2026 · Grup 7

RoboFleet, hizmet robotlarının satışı ve yetkilendirilmiş kullanıcılar tarafından web üzerinden düşük gecikmeli uzaktan kontrolünü sağlayan kapsamlı bir sistemdir.

---

## Genel Mimari

```text
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

##  Gereksinimler

Projenin hem web hem de simülasyon ayaklarının sorunsuz çalışması için gereken minimum sistem ve yazılım gereksinimleri aşağıdadır:

### Sunucu (Backend / Frontend)
* **Python:** 3.13+
* **Node.js & npm:** Node 18+ (20+ önerilir) / npm 9+
* **Veritabanı:** PostgreSQL 17+
* **Önbellek:** Redis 7+ (JWT blacklist ve rate limiting için)
* **Konteynerleştirme:** Docker & Docker Compose (Önerilen kurulum yöntemi)

### Robot / Simülasyon (ROS Makinesi)
* **İşletim Sistemi:** Ubuntu 24.04 LTS (ROS 2 için zorunlu)
* **ROS 2:** Jazzy
* **Simülasyon:** Gazebo Harmonic
* **Ek Paketler:** `rosbridge_suite`, `web_video_server`, ROS 2 Jazzy uyumlu TurtleBot3 paketleri.

---

## ⚙️ Ortam Değişkenleri (.env) ve Güvenlik

Proje kök dizininde bir `.env` dosyası oluşturun ve aşağıdaki değişkenleri kendinize göre düzenleyin:

```env
# PostgreSQL Bağlantısı
POSTGRES_USER=kullanici
POSTGRES_PASSWORD=SIFRE
POSTGRES_DB=robofleet_db
DATABASE_URL=postgresql://kullanici:SIFRE@db:5432/robofleet_db

# Redis Bağlantısı (Docker ağı üzerinden 'redis' host adıyla çözümlenir)
REDIS_URL=redis://redis:6379/0

# JWT ve Güvenlik
SECRET_KEY=gizli_anahtar_degistirilmeli
ALGORITHM=RS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
PRIVATE_KEY_PATH=./private.pem
PUBLIC_KEY_PATH=./public.pem
```

### RS256 Anahtar Üretimi
JWT token'ların asimetrik şifrelemeyle imzalanması için RSA anahtarlarına ihtiyaç vardır. Docker kullanıyorsanız başlangıçta otomatik üretilir. Manuel üretmek isterseniz:
```bash
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
```

---

## Kurulum ve Çalıştırma

### Yöntem 1: Hızlı Başlangıç (Docker Compose — Önerilen)

Tüm web ve veritabanı altyapısını tek komutla ayağa kaldırmak için:

```bash
# 1. Repoyu klonlayın
git clone https://github.com/kubikayrakvr/Robot-Marketplace-and-Remote-Control-System.git
cd Robot-Marketplace-and-Remote-Control-System

# 2. Ortam değişkenlerini ayarlayın
cp .env.example .env

# 3. Konteynerleri inşa edip başlatın
docker compose up --build -d

# 4. Veritabanı şemasını uygulayın (Gerekliyse)
docker exec sat0_postgres psql -U kullanici -d robofleet_db < migrations.sql
```

### Yöntem 2: Manuel Kurulum (Geliştirici Modu)


**1. Redis ve PostgreSQL Başlatma:**
```bash
# Redis
sudo apt install redis-server && redis-server
# PostgreSQL
sudo apt install postgresql
sudo -u postgres createdb robofleet_db
```

**2. Backend (FastAPI):**
```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt --break-system-packages

# Sunucuyu başlat (Tablolar Base.metadata.create_all() ile otomatik oluşur)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**3. Frontend (React + Vite):**
```bash
cd frontend/sat-proje
npm install
npm run dev # http://localhost:5173
```
---

## 🤖 ROS 2 / Gazebo Simülasyonunu Başlatma

Aşağıdaki adımları **Ubuntu 24.04** üzerinde ayrı terminallerde, ilgili workspace (`~/your_ws`) kaynaklandırılarak (`source /opt/ros/jazzy/setup.bash` ve `source install/setup.bash`) çalıştırın:

```bash
# 1. Paketleri Derleme (İlk kurulumda)
cd ros_integration
colcon build --packages-select robot_spawner web_ros_custom_msgs
source install/setup.bash

# 2. Gazebo simülasyon dünyasını başlat
ros2 launch turtlebot3_gazebo empty_world.launch.py

# 3. ROSBridge WebSocket sunucusunu başlat (ws://localhost:9090)
ros2 launch rosbridge_server rosbridge_websocket_launch.xml

# 4. Kamera akışı için Web Video Server başlat (http://localhost:8090)
ros2 run web_video_server web_video_server --ros-args -p port:=8090

# 5. Robot Spawner node'unu başlat
ros2 launch robot_spawner robot_spawner.launch.py

# 6. Robotları haritaya spawn et (Test için)
ros2 topic pub --once /spawn_signal_topic std_msgs/msg/String "data: 'rob100,2.0,1.5,waffle'"
ros2 topic pub --once /spawn_signal_topic std_msgs/msg/String "data: 'rob200,-3.0,0.5,burger'"
```

---

## Servisler, Portlar ve API

Sistem ayağa kalktığında aşağıdaki servisler aktif olacaktır:

| Servis | Port | Açıklama |
| :--- | :--- | :--- |
| **Frontend** (React) | `:5173` | Kullanıcı arayüzü |
| **Backend** (FastAPI) | `:8000` | REST API, WebSocket proxy |
| **PostgreSQL** | `:5432` | İlişkisel Veritabanı |
| **Redis** | `:6379` | Önbellek ve Rate Limiter |
| **rosbridge** | `:9090` | ROS 2 WebSocket köprüsü |
| **web_video_server** | `:8090` | MJPEG kamera akışı |

**API Dokümantasyonu (Swagger UI):** Tüm 40+ endpoint'i incelemek ve test etmek için tarayıcınızda `http://localhost:8000/docs` adresine gidin.
**CORS Politikası:** Backend varsayılan olarak `http://localhost:5173`, `http://49.13.13.48:5173` ve `http://49.13.13.48` adreslerine izin vermektedir.

---

## 🗄️ Yönetim ve Güvenlik

### İlk Admin Kullanıcısını Oluşturma
Sistemi yönetmek için veritabanına doğrudan bir admin ekleyebilirsiniz:
```bash
# Şifre hash'ini üretin
docker exec sat0_backend python3 -c 'from app.core.security import hash_password; print(hash_password("Sifre123"))'

# Çıkan hash'i aşağıdaki SQL sorgusunda <HASH_BURAYA> kısmına yazarak ekleyin:
docker exec sat0_postgres psql -U kullanici -d robofleet_db -c \
  "INSERT INTO users (email, username, hashed_password, is_active, is_admin) \
   VALUES ('admin@robofleet.com', 'admin', '<HASH_BURAYA>', true, true);"
```

### Faydalı Veritabanı Komutları
```bash
# Sistemdeki robotları listele
docker exec sat0_postgres psql -U kullanici -d robofleet_db -c "SELECT id, name, stock_count, ros_namespace FROM robot_catalog;"

# Son güvenlik logları ve şüpheli hareketler
docker exec sat0_postgres psql -U kullanici -d robofleet_db -c "SELECT action, ip_address, timestamp FROM audit_logs ORDER BY timestamp DESC LIMIT 20;"
```

### 🛡️ Otomatik IP Engelleme Sistemi
Sistem, başarısız giriş denemeleri veya şüpheli hareketler tespit ettiğinde iptables üzerinden IP engelleyebilir:
```bash
chmod +x scripts/ban_malicious_ips.sh

# Crontab'a ekleyerek her 5 dakikada bir çalışmasını sağlayın (crontab -e):
*/5 * * * * /bin/bash /root/Robot-Marketplace-and-Remote-Control-System/scripts/ban_malicious_ips.sh >> /var/log/robot_security.log 2>&1

# Banlı IP'leri görmek için:
iptables -L DOCKER-USER -n --line-numbers
```

---

## 📁 Proje Dizin Yapısı

```text
├── app/                        # FastAPI Backend
│   ├── routers/                # API endpoint'leri
│   ├── models/                 # SQLAlchemy modelleri
│   ├── schemas/                # Pydantic doğrulama şemaları
│   └── core/                   # Güvenlik, bağımlılıklar ve auth
├── frontend/sat-proje/src/     # React Frontend
│   ├── AdminPage/              # Yönetim paneli bileşenleri
│   ├── ControlPage/            # Joystick ve kamera kontrol arayüzü
│   ├── MyRobotsPage/           # Müşteri envanteri
│   └── context/                # React Context (Sepet, Robot durumları)
├── ros_integration/            # ROS 2 Paketleri
│   ├── robot_spawner/          # C++ Robot Spawner Node
│   └── web_ros_custom_msgs/    # Özel yetkilendirme mesaj tipleri (AuthorizedTwist)
├── scripts/                    # Yönetim ve güvenlik scriptleri
├── docker-compose.yml          # Konteyner orkestrasyonu
└── requirements.txt            # Python kütüphaneleri
```

---

## ❓ Sık Karşılaşılan Sorunlar

| Sorun | Olası Çözüm |
| :--- | :--- |
| **Backend konteyneri kapanıyor** | `docker logs sat0_backend --tail 20` ile hata loglarını okuyun. `private.pem` yetkilerini kontrol edin. |
| **Veritabanı bağlantı hatası** | `.env` dosyasındaki kimlik bilgilerini doğrulayın ve `docker compose restart` yapın. |
| **`roslib.min.js` 404 Hatası** | Frontend tarafında `src/roslib.min.js` dosyasının fiziksel olarak bulunduğundan emin olun. |
| **423 Locked (Robot Meşgul)** | Başka bir kullanıcı kontrol ediyordur. Oturum koptuğunda 15 saniye içinde Redis kilidi otomatik açar. |
| **Teleop komutları robotta çalışmıyor** | ROS makinesinde `ss -tlnp \| grep 9090` komutuyla rosbridge'in çalıştığını doğrulayın. |

---
