from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.database import Base, engine
from app.routers import auth, users, admin, robots, user_robot, cart, orders, reports
from app.routers import ros_dashboard  # ← eklendi
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.limiter import limiter
from app.models import user, robot, audit, shop, report
import asyncio

# Veritabanı tablolarını oluştur
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Robot API")

@app.exception_handler(RateLimitExceeded)
async def custom_rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Aynı anda çok fazla işlem yapmaya çalıştınız. Lütfen 1 dakika bekleyip tekrar deneyin."}
    )

# Limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://49.13.13.48:5173",
        "http://49.13.13.48",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routerlar
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(admin.router)
app.include_router(robots.router)
app.include_router(user_robot.router)
app.include_router(cart.router)
app.include_router(orders.router)
app.include_router(reports.router)
app.include_router(ros_dashboard.router)  # ← eklendi

@app.on_event("startup")
async def startup_event():
    loop = asyncio.get_running_loop()
    await ros_dashboard.ros_startup(loop)

@app.get("/")
def root():
    return {"message": "Robot API çalışıyor"}
