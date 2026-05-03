# 🤖 RoboFleet — Hizmet Robotu Satış ve Uzaktan Yönetim Sistemi

> **YTÜ Bilgisayar Mühendisliği** · **BLM2732 Sistem Analizi ve Tasarımı** · **Bahar 2026** · **Grup 7**

RoboFleet, hizmet robotlarının satışı ve yetkilendirilmiş kullanıcılar tarafından web üzerinden düşük gecikmeli uzaktan kontrolünü sağlayan kapsamlı bir sistemdir.

---

## 📋 Genel Mimari

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
    [ rosbridge :9090 ] + [ web_video_server :8080 ]
              │
┌─────────────▼───────────────────┐
│     ROS 2 + Gazebo Simülasyonu  │
│  - TurtleBot3 (Waffle / Burger) │
│  - RobotController (C++)        │
│  - AuthorizedTwist mesajları    │
└─────────────────────────────────┘
```

**Temel Bileşenler:**
- **Frontend:** React + Vite (Kullanıcı arayüzü ve kontrol paneli)
- **Backend:** FastAPI + SQLAlchemy (REST API, WebSocket proxy)
- **Database:** PostgreSQL (İlişkisel veri yönetimi)
- **Cache:** Redis (JWT blacklist, rate limiting)
- **Simulation:** ROS 2 Jazzy + Gazebo Harmonic
- **Robot Control:** TurtleBot3 + Custom ROS C++ Node

---

## ⚙️ Sistem Gereksinimleri

### Sunucu (Backend / Frontend)

| Bileşen | Versiyon | Açıklama |
|---------|----------|----------|
| Python | 3.13-slim | Backend base image |
| FastAPI | 0.115.0 | Web çerçevesi |
| Uvicorn | 0.30.6 | ASGI sunucu |
| SQLAlchemy | 2.0.35 | ORM katmanı |
| PostgreSQL | 17 | İlişkisel veritabanı |
| Redis | 7+ (Alpine) | JWT blacklist ve rate limiting |
| Node.js | 20-slim | Frontend build aracı |
| React | 19.2.4 | UI kütüphanesi |
| React Router | 7.13.2 | Sayfa yönlendirmesi |
| Vite | 8.0.1 | Frontend bundler |
| Docker | 24+ | Konteynerleştirme |

### Robot / Simülasyon (ROS Makinesi)

- **İşletim Sistemi:** Ubuntu 24.04 LTS (ROS 2 için zorunlu)
- **ROS 2:** Jazzy
- **Simülasyon:** Gazebo Harmonic
- **Ek Paketler:** `rosbridge_suite`, `web_video_server`, ROS 2 Jazzy uyumlu TurtleBot3 paketleri

---

## 🔐 Ortam Değişkenleri (.env) ve Güvenlik

Proje kök dizininde bir `.env` dosyası oluşturun. Şablonu `.env.example` dosyasından kopyalayabilirsiniz:

```bash
cp .env.example .env
# Sonra .env dosyasını kendi değerlerinizle düzenleyin
```

**Temel Ortam Değişkenleri:**

```env
# PostgreSQL
POSTGRES_USER=robofleet_user
POSTGRES_PASSWORD=SecurePassword123!
POSTGRES_DB=robofleet_db
DATABASE_URL=postgresql://robofleet_user:SecurePassword123!@db:5432/robofleet_db

# Redis (JWT blacklist ve rate limiting)
REDIS_URL=redis://redis:6379/0

# JWT ve Güvenlik
SECRET_KEY=your-super-secret-key-change-this
ALGORITHM=RS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
PRIVATE_KEY_PATH=./private.pem
PUBLIC_KEY_PATH=./public.pem

# CORS Ayarları
CORS_ORIGINS=http://localhost:5173,http://49.13.13.48:5173,http://49.13.13.48
```

Tüm ayarlar için `.env.example` dosyasını inceleyiniz.

### RS256 Anahtar Üretimi

JWT token'ların asimetrik şifrelemeyle imzalanması için RSA anahtarlarına ihtiyaç vardır. Docker kullanıyorsanız başlangıçta otomatik üretilir. Manuel üretmek isterseniz:

```bash
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
```

---

## 🚀 Kurulum ve Çalıştırma

### Yöntem 1: Hızlı Başlangıç (Docker Compose — Önerilen)

Tüm web ve veritabanı altyapısını tek komutla ayağa kaldırmak için:

```bash
# 1. Repoyu klonlayın
git clone https://github.com/kubikayrakvr/Robot-Marketplace-and-Remote-Control-System.git
cd Robot-Marketplace-and-Remote-Control-System

# 2. Ortam değişkenlerini ayarlayın
cp .env.example .env
# İhtiyaç halinde .env dosyasını düzenleyin

# 3. Konteynerleri inşa edip başlatın
docker compose up --build -d

# 4. Veritabanı şemasını uygulayın (Gerekliyse)
docker exec sat0_postgres psql -U kullanici -d robofleet_db < migrations.sql

# 5. Sistem duruşunu kontrol edin
docker compose ps
```

### Yöntem 2: Manuel Kurulum (Geliştirici Modu)

#### 1. Redis ve PostgreSQL Başlatma

```bash
# Redis kurulumu ve başlatma
sudo apt install redis-server
redis-server

# PostgreSQL kurulumu ve veritabanı oluşturma
sudo apt install postgresql postgresql-contrib
sudo -u postgres createdb robofleet_db
sudo -u postgres psql -d robofleet_db < migrations.sql
```

#### 2. Backend (FastAPI)

```bash
# Python sanal ortamı oluşturun
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Bağımlılıkları yükleyin
pip install -r requirements.txt

# Sunucuyu başlatın (Tablolar Base.metadata.create_all() ile otomatik oluşur)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend swagger UI: http://localhost:8000/docs

#### 3. Frontend (React + Vite)

```bash
cd frontend/sat-proje
npm install
npm run dev  # http://localhost:5173
```

---

## 🤖 ROS 2 / Gazebo Simülasyonunu Başlatma

Aşağıdaki adımları Ubuntu 24.04 üzerinde ayrı terminallerde, ilgili workspace kaynaklandırılarak çalıştırın:

```bash
# ROS 2 kurulumunu kaynak al
source /opt/ros/jazzy/setup.bash
```

#### 1. ROS 2 Paketlerini Derleme (İlk kurulumda)

```bash
cd ros_integration
colcon build --packages-select robot_spawner web_ros_custom_msgs
source install/setup.bash
```

#### 2. Gazebo Simülasyon Dünyasını Başlat

```bash
ros2 launch turtlebot3_gazebo empty_world.launch.py
```

#### 3. ROSBridge WebSocket Sunucusunu Başlat

```bash
# WebSocket köprüsü (ws://localhost:9090)
ros2 launch rosbridge_server rosbridge_websocket_launch.xml
```

#### 4. Web Video Server Başlat (Kamera Akışı)

```bash
# MJPEG kamera akışı (http://localhost:8080)
ros2 run web_video_server web_video_server
```

#### 5. Robot Spawner Node'unu Başlat

```bash
ros2 launch robot_spawner robot_spawner.launch.py
```

#### 6. Robotları Haritaya Spawn Et (Test İçin)

```bash
# Waffle robot ekle
ros2 topic pub --once /spawn_signal_topic std_msgs/msg/String "data: 'rob100,2.0,1.5,waffle'"

# Burger robot ekle
ros2 topic pub --once /spawn_signal_topic std_msgs/msg/String "data: 'rob200,-3.0,0.5,burger'"
```

---

## 📡 Servisler, Portlar ve API

Sistem ayağa kalktığında aşağıdaki servisler aktif olacaktır:

| Servis | Port | Açıklama |
|--------|------|---------|
| Frontend (React) | :5173 | Kullanıcı arayüzü |
| Backend (FastAPI) | :8000 | REST API, WebSocket proxy |
| PostgreSQL | :5432 | İlişkisel Veritabanı |
| Redis | :6379 | Önbellek ve Rate Limiter |
| rosbridge | :9090 | ROS 2 WebSocket köprüsü |
| web_video_server | :8080 | MJPEG kamera akışı |

### API Dokümantasyonu ve Uygulanan Özellikler

Sistemde 43+ endpoint implement edilmiştir. Swagger UI ve ReDoc aracılığıyla tüm endpoint'leri inceleyebilirsiniz:

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

#### 🔐 Kimlik Doğrulama (auth)
- `POST /api/auth/register` — Kullanıcı kaydı
- `POST /api/auth/login` — Giriş ve JWT token üretimi (RS256)
- `POST /api/auth/logout` — Oturum kapatma (Redis blacklist)
- `POST /api/auth/refresh` — Token yenileme
- `POST /api/auth/forgot-password` — Şifre sıfırlama isteği
- `POST /api/auth/reset-password` — Şifre değiştirme

#### 👥 Kullanıcı Yönetimi (users)
- `GET /api/users/me` — Profil bilgilerini getir
- `PATCH /api/users/me` — Profil güncelle

#### 🤖 Robot Pazarlaması (robots)
- `GET /api/robots/market` — Tüm robotları listele
- `GET /api/robots/{id}` — Robot detaylarını getir

#### 🛍️ Sepet ve Siparişler (cart, orders)
- `GET /api/cart/` — Sepet tutarını göster
- `POST /api/cart/items` — Sepete ürün ekle
- `PATCH /api/cart/items/{itemId}` — Sepet ürünü güncelle
- `DELETE /api/cart/` — Sepeti boşalt
- `POST /api/orders/` — Sipariş oluştur
- `GET /api/orders/` — Kullanıcının siparişlerini listele
- `GET /api/orders/{id}` — Sipariş detaylarını getir

#### 🎮 Robot Kontrolü (user_robot, ros_dashboard)
- `GET /api/user-robot/` — Kullanıcının robotlarını listele
- `POST /api/user-robot/tanimla` — Yeni robot tanımla
- `GET /api/dashboard/robots` — Mevcut robotları göster
- `GET /api/dashboard/robot/{robot_id}` — Robot durumunu getir
- `POST /api/dashboard/robot/{robot_id}/claim` — Robotu kontrol et
- `DELETE /api/dashboard/robot/{robot_id}/claim` — Robotu bırak
- `POST /api/dashboard/robot/{robot_id}/heartbeat` — Robot kalp atışı
- `GET /api/dashboard/robot/{robot_id}/stream` — Video akışı URL'si

#### 📦 Ürün Yönetimi (products)
- `GET /api/products/` — Ürünleri listele
- `GET /api/products/{id}` — Ürün detaylarını getir

#### 📝 Raporlama (reports)
- `POST /api/reports/` — Rapor oluştur
- `GET /api/reports/my-reports` — Kendi raporlarını göster

#### 👨‍💼 Yönetim Paneli (admin)
- `GET /api/admin/kullanıcılar` — Tüm kullanıcıları listele
- `GET /api/admin/kullanıcılar/bilgi/{user_id}` — Kullanıcı bilgisi
- `PATCH /api/admin/kullanıcılar/düzenle/{user_id}` — Kullanıcıyı düzenle
- `DELETE /api/admin/kullanıcılar/{user_id}` — Kullanıcıyı sil
- `GET /api/admin/robots` — Robot kataloğu listele
- `POST /api/admin/robots/ekle` — Yeni robot ekle
- `PATCH /api/admin/robots/düzenle/{robot_id}` — Robot düzenle
- `DELETE /api/admin/robots/{robot_id}` — Robotu sil
- `GET /api/admin/log` — Tüm audit loglarını göster
- `GET /api/admin/reports` — Tüm raporları göster
- `PATCH /api/admin/reports/coz/{report_id}` — Raporu çöz
- `GET /api/admin/istatistik` — Sistem istatistikleri

**CORS Politikası:** Backend varsayılan olarak `.env` dosyasında belirtilen adreslere izin vermektedir.

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
docker exec sat0_postgres psql -U kullanici -d robofleet_db -c \
  "SELECT id, name, stock_count, ros_namespace FROM robot_catalog;"

# Son güvenlik logları ve şüpheli hareketler
docker exec sat0_postgres psql -U kullanici -d robofleet_db -c \
  "SELECT action, ip_address, timestamp FROM audit_logs ORDER BY timestamp DESC LIMIT 20;"

# Aktif kullanıcıları göster
docker exec sat0_postgres psql -U kullanici -d robofleet_db -c \
  "SELECT id, email, is_admin, is_active FROM users;"
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

```
.
├── app/                              # FastAPI Backend
│   ├── routers/                      # API endpoint'leri
│   │   ├── admin.py                  # Yönetim API'leri
│   │   ├── auth.py                   # Kimlik doğrulama
│   │   ├── cart.py                   # Sepet yönetimi
│   │   ├── orders.py                 # Siparişler
│   │   ├── products.py               # Ürün yönetimi
│   │   ├── robots.py                 # Robot kataloğu
│   │   ├── user_robot.py             # Kullanıcı robotları
│   │   └── ...
│   ├── models/                       # SQLAlchemy modelleri
│   │   ├── user.py                   # Kullanıcı modeli
│   │   ├── robot.py                  # Robot modeli
│   │   ├── shop.py                   # Mağaza modelleri
│   │   └── ...
│   ├── schemas/                      # Pydantic doğrulama şemaları
│   ├── core/                         # Güvenlik, bağımlılıklar ve auth
│   │   ├── config.py                 # Konfigürasyon
│   │   ├── security.py               # JWT ve şifreleme
│   │   ├── dependencies.py           # DI konteyner
│   │   └── limiter.py                # Rate limiting
│   ├── database.py                   # Veritabanı bağlantısı
│   └── main.py                       # Uygulamanın giriş noktası
│
├── frontend/sat-proje/src/           # React Frontend
│   ├── AdminPage/                    # Yönetim paneli bileşenleri
│   │   ├── AdminLayout.jsx           # Yönetim arayüzü
│   │   ├── AdminRobotsPage.jsx       # Robot yönetimi
│   │   └── ...
│   ├── ControlPage/                  # Joystick ve kamera kontrol arayüzü
│   ├── ShopPage/                     # Ürün satışı
│   ├── MyRobotsPage/                 # Müşteri envanteri
│   ├── LoginPage/                    # Giriş ekranı
│   ├── RegisterPage/                 # Kayıt ekranı
│   ├── context/                      # React Context (Sepet, Robot durumları)
│   ├── api/                          # API çağrıları
│   ├── components/                   # Yeniden kullanılabilir bileşenler
│   └── utils/                        # Yardımcı fonksiyonlar
│
├── ros_integration/                  # ROS 2 Paketleri
│   ├── robot_spawner/                # C++ Robot Spawner Node
│   │   ├── src/                      # C++ kaynak dosyaları
│   │   ├── launch/                   # ROS launch dosyaları
│   │   └── CMakeLists.txt
│   ├── web_ros_custom_msgs/          # Özel yetkilendirme mesaj tipleri
│   │   └── msg/
│   │       └── AuthorizedTwist.msg   # Yetkilendirilmiş hareketi mesajı
│   ├── turtlebot3_gazebo/            # TurtleBot3 simülasyon paketleri
│   ├── rosbridge_server/             # WebSocket-ROS köprüsü
│   └── web_video_server/             # Video sunucusu
│
├── scripts/                          # Yönetim ve güvenlik scriptleri
│   └── ban_malicious_ips.sh          # Kötü niyetli IP engelleme
│
├── docker-compose.yml                # Konteyner orkestrasyonu
├── Dockerfile                        # Backend konteyner yapısı
├── requirements.txt                  # Python bağımlılıkları
├── migrations.sql                    # Veritabanı şeması
└── README.md                         # Bu dosya
```

---

## ❓ Sık Karşılaşılan Sorunlar

| Sorun | Olası Çözüm |
|-------|------------|
| Backend konteyneri kapanıyor | `docker logs sat0_backend --tail 20` ile hata loglarını okuyun. `private.pem` yetkilerini kontrol edin. |
| Veritabanı bağlantı hatası | `.env` dosyasındaki kimlik bilgilerini doğrulayın ve `docker compose restart` yapın. |
| `roslib.min.js` 404 Hatası | Frontend tarafında `src/roslib.min.js` dosyasının fiziksel olarak bulunduğundan emin olun. |
| 423 Locked (Robot Meşgul) | Başka bir kullanıcı kontrol ediyordur. Oturum koptuğunda 15 saniye içinde Redis kilidi otomatik açar. |
| Teleop komutları robotta çalışmıyor | ROS makinesinde `ss -tlnp \| grep 9090` komutuyla rosbridge'in çalıştığını doğrulayın. |
| `CORS` hataları frontend'de | Backend'in `.env` dosyasında `CORS_ORIGINS` ayarını kontrol edin. |
| Docker ağ hatası | `docker network ls` ile ağları kontrol edin ve gerekirse `docker compose down && docker compose up` yapın. |

---

## 🎯 Uygulanan Özellikler

### 🔐 Güvenlik Altyapısı
- **JWT RS256:** Asimetrik şifrelemeyle imzalanmış tokenler
- **Bcrypt Hash:** Güvenli şifre depolama
- **Redis Blacklist:** Logout sonrası token geçersizleştirme
- **Rate Limiting:** Brute force saldırılarına karşı koruma (slowapi)
- **CORS Middleware:** Çapraz domain erişim kontrolü
- **Audit Logging:** Tüm işlemler ve başarısız girişler kaydediliyor
- **Otomatik IP Engelleme:** Şüpheli aktivite sonrası iptables üzerinden engelleme

### 🛍️ E-Ticaret Özellikleri
- **Robot Pazarlaması:** Kataloğu taramak ve detaylarını görmek
- **Sepet Yönetimi:** Ürünleri sepete ekleme/çıkarma
- **Sipariş Sistemi:** Sipariş oluşturma ve takip
- **Stok Yönetimi:** Robot availability kontrolü
- **Ürün Açıklamaları:** Detaylı robot bilgilendirmesi

### 🤖 Robot Kontrol Sistemi
- **Tek Kullanıcılı Kontrol:** Bir robotu aynı anda yalnızca bir kullanıcı kontrol edebilir
- **Kilit Mekanizması:** Redis üzerinden robotun durumu yönetimi (15 saniye otomatik release)
- **Canlandırma Komutları:** ROS 2 üzerinden hareket komutları
- **Canlı Video Akışı:** MJPEG üzerinden web_video_server'dan yayını
- **Telemetri:** Batarya yüzdesi, konum (x, y, theta) takibi
- **Heartbeat:** Kontrol bağlantısının sürekli kontrol edilmesi

### 📊 Yönetim Paneli
- **Kullanıcı Yönetimi:** Listelemek, düzenlemek, silmek
- **Robot Kataloğu Yönetimi:** Robot ekleme, düzenleme, silme
- **Audit Logları:** Tüm sistem aktivitelerini görüntüleme
- **Rapor Yönetimi:** Kullanıcı raporlarını görüntüleme ve çözme
- **Sistem İstatistikleri:** Toplam kullanıcı, aktif robotlar, siparişler vb.

### 📱 Frontend Bileşenleri
- **Admin Page:** Yönetim paneli (AdminLayout, AdminRobotsPage, AdminLoginPage)
- **Control Page:** Joystick ve kamera kontrol arayüzü
- **Shop Page:** Robot pazarlaması ve taraması
- **Cart Page:** Sepet yönetimi ve ürün ekleme
- **Checkout Page:** Ödeme ve sipariş tamamlama
- **My Robots Page:** Kullanıcının kendi robotlarını yönetmesi
- **Auth Pages:** Login ve Register sayfaları
- **Landing Page:** Ana sayfası
- **User Page:** Profil yönetimi

### 🗄️ Veritabanı Şeması
- **Users:** Kullanıcı hesapları ve profiller
- **Robot Catalog:** Robot modelleri ve özellikleri
- **Robot Inventory:** Seri numaralı robot örnekleri
- **User Robots:** Kullanıcıların sahip olduğu robotlar
- **Orders:** Sipariş geçmişi
- **Audit Logs:** Güvenlik ve aktivite logları
- **Reports:** Kullanıcı raporları

---

## 📚 Teknoloji Stack'i

### Backend
- **FastAPI 0.115.0:** Modern, asynchronous web çerçevesi
- **SQLAlchemy 2.0.35:** Python ORM (Object-Relational Mapping)
- **Pydantic 2.9.2:** Veri doğrulama ve serialization
- **PostgreSQL 17:** Güvenli ve ölçeklenebilir ilişkisel veritabanı
- **Redis (Alpine):** Yüksek hızlı veri yapıları ve session yönetimi
- **Passlib + Bcrypt:** Şifre hash'leme
- **Python-jose:** JWT token üretimi ve doğrulaması (RS256)
- **slowapi:** Rate limiting ve throttling
- **WebSockets:** Real-time iletişim

### Frontend
- **React 19.2.4:** Modern UI kütüphanesi
- **React Router 7.13.2:** SPA yönlendirmesi
- **Vite 8.0.1:** Ultra hızlı development server ve build tool
- **Node 20-slim:** Node.js runtime

### ROS Integration
- **ROS 2 Jazzy:** Robot işletim sistemi
- **Gazebo Harmonic:** 3D simülasyon ortamı
- **rosbridge_suite:** WebSocket üzerinden ROS iletişimi
- **web_video_server:** MJPEG video streaming
- **TurtleBot3 (Waffle/Burger):** Simüle edilmiş robot modelleri
- **Custom Messages:** AuthorizedTwist mesajı yetkilendirmeli kontrol için

### Deployment
- **Docker 24+:** Konteynerleştirme
- **Docker Compose:** Multi-container orkestrasyonu
- **Python 3.13-slim:** Minimal backend image

---

## 🤝 Katkıda Bulunma

Projeye katkıda bulunmak için:

1. Repoyu fork edin
2. Özellik dalı oluşturun (`git checkout -b feature/YeniOzellik`)
3. Değişiklikleri commit edin (`git commit -m 'YeniOzellik ekle'`)
4. Dalı push edin (`git push origin feature/YeniOzellik`)
5. Pull Request açın

---

## 📝 Lisans

Bu proje YTÜ BLM2732 dersi için geliştirilmiştir.

---

## � Ekip

| Rol | Sorumlu |
|---|---|
| Proje Yöneticisi & Sistem Analisti | Senanur DİNÇEL |
| Backend Geliştirici | Şevval ÇABUK |
| Frontend Geliştirici | Hasan Altan TURAN |
| Robotik / Simülasyon Mühendisi | Kubilay Kayra KIVRAK |
| QA / Test | Buse Selin TAVLAK |

---

## 📞 İletişim ve Destek

Sorular veya sorunlar için:
- GitHub Issues'ı kullanın
- Proje yöneticileriyle iletişime geçin

---

**Son Güncellenme:** Mayıs 2026
