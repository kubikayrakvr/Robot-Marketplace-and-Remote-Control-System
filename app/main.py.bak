from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import Base, engine
from app.routers import auth, users, admin, robots, user_robot, cart, orders # cart ve orders eklendi
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.limiter import limiter
from app.models import user, robot, audit, shop # shop eklendi

# Veritabanı tablolarını oluştur
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Robot API")

# Limiter'ı uygulamaya bağla
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS Ayarları
app.add_middleware(
    CORSMiddleware,
	allow_origins=[
        "http://localhost:5173", # Kendi bilgisayarında test ederken
        "http://49.13.13.48:5173", # Sunucudaki frontend
        "http://49.13.13.48" # Eğer portsuz yayınlıyorsan
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routerları bağla
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(admin.router)
app.include_router(robots.router)
app.include_router(user_robot.router)
app.include_router(cart.router)    # Yeni
app.include_router(orders.router)  # Yeni

@app.get("/")
def root():
    return {"message": "Robot API çalışıyor"}
