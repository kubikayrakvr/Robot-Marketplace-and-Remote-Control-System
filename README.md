

fastapi + uvicorn → framework ve sunucu
sqlalchemy → veritabanı ORM (SQL yazmak yerine Python class'ları kullanacaksın)
psycopg2-binary → PostgreSQL sürücüsü
python-jose → JWT token üretmek/doğrulamak için
passlib[bcrypt] → şifre hash'lemek için
python-dotenv → .env dosyasından gizli bilgileri okumak için
pydantic[email] → e-posta format doğrulaması için

```
genel mimari:
USER BROWSER (React.js)
              │
              │ (HTTP/WebSocket)
              ▼
    ┌───────────────────────────┐
    │      FASTAPI BACKEND      │
    │  (Uvicorn + PostgreSQL)   │
    │  - Auth: JWT (python-jose)│
    │  - DB: SQLAlchemy (ORM)   │
    └─────────────┬─────────────┘
                  │
          [ SSH TUNNEL ]
                  │
                  ▼
    ┌───────────────────────────┐
    │       LOCAL MACHINE       │
    │  - ROSBridge (JSON-RPC)   │
    │  - Camera Stream (MJPEG)  │
    └───────────────────────────┘
```
Veritabanı Güncellemeleri:
docker exec sat0_postgres psql -U user -d robot_db < migrations.sql
