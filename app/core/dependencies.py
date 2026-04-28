import redis
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.core.security import decode_token

# Redis: Docker ağında 'redis' ismiyle çözümlenir
redis_client = redis.Redis(host='redis', port=6379, db=0, decode_responses=True)

bearer_scheme = HTTPBearer()

def get_current_token_payload(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> dict:
    """Token'ı decode eder ve payload döner. Blacklist kontrolünü burada yaparız."""
    token = credentials.credentials
    payload = decode_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz veya süresi dolmuş token",
        )

    # GÜVENLİK: Blacklist Kontrolü
    jti = payload.get("jti")
    if redis_client.get(f"blacklist:{jti}"):
        raise HTTPException(status_code=401, detail="Oturum sonlandırılmış. Lütfen tekrar giriş yapın.")

    return payload

def get_current_user(
    payload: dict = Depends(get_current_token_payload),
    db: Session = Depends(get_db)
) -> User:
    """Aktif kullanıcıyı döner."""
    user_id = payload.get("sub")
    if payload.get("type") != "access": # Sadece access token ile işlem yapılabilir
        raise HTTPException(status_code=401, detail="Hatalı token tipi")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı veya pasif")

    return user

def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Bu işlem için Admin yetkisi gereklidir")
    return current_user
