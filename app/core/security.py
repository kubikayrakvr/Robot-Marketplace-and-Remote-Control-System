from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.config import settings
import uuid

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# RAM Caching: Anahtarları uygulama başlarken belleğe alıyoruz (Disk I/O Fix)
# 🛡️ Güvenlik Notu: private.pem ve public.pem dosyalarının varlığından emin olmalısın.
with open(settings.PRIVATE_KEY_PATH, "r") as f:
    PRIVATE_KEY = f.read()

with open(settings.PUBLIC_KEY_PATH, "r") as f:
    PUBLIC_KEY = f.read()

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_token(data: dict, expires_delta: timedelta | None = None, token_type: str = "access") -> str:
    """
    V4 standartlarına uygun; access, refresh, reset veya control token üretir.
    """
    to_encode = data.copy()
    
    if not expires_delta:
        if token_type == "access":
            expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        elif token_type == "refresh":
            expires_delta = timedelta(days=7)
        else:
            expires_delta = timedelta(minutes=15)

    expire = datetime.now(timezone.utc) + expires_delta
    
    to_encode.update({
        "exp": expire,
        "jti": str(uuid.uuid4()), # 🛡️ Blacklist kontrolü için eşsiz kimlik
        "type": token_type
    })
    return jwt.encode(to_encode, PRIVATE_KEY, algorithm=settings.ALGORITHM)

def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, PUBLIC_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
