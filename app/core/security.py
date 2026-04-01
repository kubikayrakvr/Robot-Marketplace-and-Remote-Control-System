from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.config import settings
import uuid

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

# app/core/security.py

def create_access_token(data: dict) -> str:
    with open(settings.PRIVATE_KEY_PATH, "r") as f:
        private_key = f.read()
    
    to_encode = data.copy()
    to_encode.update({"jti": str(uuid.uuid4())})
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    
    # BURASI KRİTİK: Algorithm=settings.ALGORITHM (RS256) olduğundan emin ol
    return jwt.encode(to_encode, private_key, algorithm="RS256")

def decode_token(token: str) -> dict | None:
    with open(settings.PUBLIC_KEY_PATH, "r") as f:
        public_key = f.read()
    try:
        # DECODE EDERKEN: algorithms parametresi liste almalıdır
        return jwt.decode(token, public_key, algorithms=["RS256"])
    except JWTError as e:
        print(f"JWT Decode Hatası: {e}") # Hata ayıklama için
        return None
