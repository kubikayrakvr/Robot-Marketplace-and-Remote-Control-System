from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.audit import AuditLog  # 🛡️ Siber güvenlik loglaması için eklendi
from app.schemas.user import UserRegister, UserResponse, UserLogin
from app.schemas.auth import ForgotPasswordRequest, ResetPasswordRequest, TokenRefreshRequest
from app.schemas.token import Token
from app.core.security import hash_password, verify_password, create_token, decode_token
from app.core.dependencies import get_current_user, get_current_token_payload, redis_client, bearer_scheme
from app.core.limiter import limiter

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/register", response_model=UserResponse)
def register(data: UserRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="E-posta zaten kayıtlı")
    
    new_user = User(
        email=data.email,
        username=data.username,
        hashed_password=hash_password(data.password)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # 🛡️ Başarılı kayıt işlemini loglayalım
    reg_log = AuditLog(
        user_id=new_user.id,
        action="USER_REGISTERED",
        details={"username": new_user.username, "email": new_user.email}
    )
    db.add(reg_log)
    db.commit()
    
    return new_user

@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
def login(request: Request, data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    
    # 🛡️ SİBER GÜVENLİK: Şifre yanlışsa veya kullanıcı yoksa başarısız denemeyi logla
    if not user or not verify_password(data.password, user.hashed_password):
        failed_log = AuditLog(
            user_id=user.id if user else None, # Kullanıcı yoksa ID boş kalır[cite: 16]
            action="LOGIN_FAILED",
            ip_address=request.client.host,
            details={"attempted_email": data.email, "reason": "Hatalı şifre veya kullanıcı bulunamadı"}
        )
        db.add(failed_log)
        db.commit()
        raise HTTPException(status_code=401, detail="Hatalı bilgiler")
    
    access_token = create_token(data={"sub": str(user.id)}, token_type="access")
    refresh_token = create_token(data={"sub": str(user.id)}, token_type="refresh")
    
    # 🛡️ Başarılı girişi loglayalım[cite: 16, 20]
    success_log = AuditLog(
        user_id=user.id,
        action="LOGIN_SUCCESS",
        ip_address=request.client.host
    )
    db.add(success_log)
    db.commit()
    
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}

@router.post("/logout")
def logout(payload: dict = Depends(get_current_token_payload)):
    """Token'ı Redis Blacklist'e ekleyerek geçersiz kılar"""
    jti = payload.get("jti")
    exp = payload.get("exp")
    
    # Token'ın kalan süresi kadar Redis'te tut (TTL)
    ttl = int(exp - datetime.now(timezone.utc).timestamp())
    if ttl > 0:
        redis_client.setex(f"blacklist:{jti}", ttl, "true")
        
    return {"message": "Oturum başarıyla kapatıldı"}

@router.post("/refresh", response_model=Token)
def refresh_access_token(data: TokenRefreshRequest, db: Session = Depends(get_db)):
    """Sadece geçerli bir refresh_token ile yeni access_token verir"""
    payload = decode_token(data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Geçersiz refresh token")
    
    user_id = payload.get("sub")
    access_token = create_token(data={"sub": user_id}, token_type="access")
    # Refresh token'ı da döndürebiliriz (Token Rotation için)
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/forgot-password")
@limiter.limit("3/hour")
def forgot_password(request: Request, data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if user:
        reset_token = create_token(data={"sub": str(user.id)}, token_type="password_reset")
        # Gerçek SMTP entegrasyonu gelene kadar simülasyon:
        print(f"DEBUG: Password Reset Token for {user.email}: {reset_token}")
        
        # 🛡️ Şifre sıfırlama isteğini logla[cite: 16]
        db.add(AuditLog(
            user_id=user.id,
            action="PASSWORD_RESET_REQUESTED",
            ip_address=request.client.host
        ))
        db.commit()
        
    return {"message": "Sıfırlama linki e-posta adresinize gönderildi (varsa)."}

@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    payload = decode_token(data.reset_token)
    if not payload or payload.get("type") != "password_reset":
        raise HTTPException(status_code=400, detail="Geçersiz veya süresi dolmuş sıfırlama token'ı")
    
    user = db.query(User).filter(User.id == int(payload.get("sub"))).first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    user.hashed_password = hash_password(data.new_password)
    
    # 🛡️ Şifre değişim başarısını logla[cite: 16]
    db.add(AuditLog(
        user_id=user.id,
        action="PASSWORD_RESET_SUCCESS"
    ))
    
    db.commit()
    return {"message": "Şifreniz başarıyla güncellendi."}
