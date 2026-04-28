# from app.models.robot import UserRobot, RobotInventory, RobotCatalog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserResponse, UserUpdate
from app.core.dependencies import get_current_user
from app.core.security import hash_password, verify_password

router = APIRouter(prefix="/api/users", tags=["users"])

@router.get("/me", response_model=UserResponse)
def get_my_profile(current_user: User = Depends(get_current_user)):
    return current_user

@router.patch("/me", response_model=UserResponse)
def update_my_profile(
    data: UserUpdate, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """Profil bilgilerini veya şifreyi güvenli bir şekilde günceller"""
    
    # 1. Kullanıcı Adı Güncelleme
    if data.username and data.username != current_user.username:
        if db.query(User).filter(User.username == data.username).first():
            raise HTTPException(status_code=400, detail="Bu kullanıcı adı zaten alınmış")
        current_user.username = data.username

    # 2. E-posta Güncelleme (Aktivasyon maili hazırlığı)
    if data.email and data.email != current_user.email:
        if db.query(User).filter(User.email == data.email).first():
            raise HTTPException(status_code=400, detail="Bu e-posta zaten kayıtlı")
        
        current_user.email = data.email
        # KRİTİK GÜVENLİK FİXİ: E-posta değişince verification süreci başlar
        current_user.is_active = False # Aktivasyon maili gelene kadar erişim kısıtlanır

    # 3. Şifre Güncelleme
    if data.new_password:
        if not data.old_password:
            raise HTTPException(status_code=400, detail="Şifre değişimi için mevcut şifre zorunludur")
        
        if not verify_password(data.old_password, current_user.hashed_password):
            raise HTTPException(status_code=400, detail="Mevcut şifreniz hatalı")
        
        # EK GÜVENLİK: Yeni şifre eskisinden farklı olmalı
        if verify_password(data.new_password, current_user.hashed_password):
            raise HTTPException(status_code=400, detail="Yeni şifre eskisinden farklı olmalıdır")
        
        current_user.hashed_password = hash_password(data.new_password)

    db.commit()
    db.refresh(current_user)
    return current_user
