

fastapi + uvicorn → framework ve sunucu
sqlalchemy → veritabanı ORM (SQL yazmak yerine Python class'ları kullanacaksın)
psycopg2-binary → PostgreSQL sürücüsü
python-jose → JWT token üretmek/doğrulamak için
passlib[bcrypt] → şifre hash'lemek için
python-dotenv → .env dosyasından gizli bilgileri okumak için
pydantic[email] → e-posta format doğrulaması için


genel mimari:
[React Frontend :5173]
        │  /api/* → proxy
        ▼
[FastAPI Backend :8080]  ←── app/main.py
        │  ros_dashboard.py (session, WebSocket, heartbeat)
        │
        │  SSH Tüneli
        ▼
[Local Makine]
   ROSBridge :9090
   Web Video  :8080 (local)
