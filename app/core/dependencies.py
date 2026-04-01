from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.core.security import decode_token
# Buraya Redis bağlantısını eklediğini varsayıyoruz (Örn: redis_client)
# from app.core.redis import redis_client 

bearer_scheme = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = decode_token(token)

    # 1. GÜVENLİK KONTROLÜ: Token geçerli mi? (RS256 ile doğrulanır)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz veya süresi dolmuş token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 2. GÜVENLİK KONTROLÜ: JTI (Blacklist) Kontrolü
    # Eğer bu token logout yapılmışsa veya çalınıp iptal edilmişse Redis'te kayıtlıdır.
    jti = payload.get("jti")
    # if redis_client.get(f"blacklist:{jti}"): # Eğer Redis kullanıyorsan bu satırı aç
    #    raise HTTPException(status_code=401, detail="Bu oturum sonlandırılmış (Token Blacklisted)")

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Token içeriği hatalı")

    # 3. VERİTABANI KONTROLÜ: Kullanıcı hala var mı ve aktif mi?
    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Hesap devre dışı bırakılmış")

    return user

def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    # 4. YETKİ KONTROLÜ: RBAC (Role Based Access Control)
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gereklidir",
        )
    return current_user
