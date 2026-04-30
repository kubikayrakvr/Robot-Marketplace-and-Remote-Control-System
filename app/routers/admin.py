import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.robot import RobotCatalog, RobotInventory
from app.models.audit import AuditLog
from app.schemas.user import UserResponse, UserUpdate
from app.schemas.robot import (
    RobotCreate, RobotResponse, RobotUpdate, 
    PhysicalRobotCreate, PhysicalRobotUnitResponse
)
from app.core.dependencies import get_current_admin
from pydantic import BaseModel

router = APIRouter(prefix="/api/admin", tags=["admin"])

# --- KULLANICI YÖNETİMİ ---

@router.get("/kullanıcılar", response_model=list[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Sistemdeki tüm kullanıcıları listeler"""
    return db.query(User).all()

@router.get("/kullanıcılar/bilgi/{user_id}", response_model=UserResponse)
def get_user_info(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Belirli bir kullanıcının detaylarını getirir"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    return user

class UserAdminUpdate(BaseModel):
    is_active: bool | None = None
    is_admin: bool | None = None
    username: str | None = None
    email: str | None = None

@router.patch("/kullanıcılar/düzenle/{user_id}", response_model=UserResponse)
def update_user_by_admin(
    user_id: int,
    data: UserAdminUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Kullanıcı bilgilerini, yetkilerini veya aktiflik durumunu günceller/siler(deaktif eder)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    if user_id == current_admin.id and data.is_admin is False:
        raise HTTPException(status_code=400, detail="Kendi admin yetkinizi kaldıramazsınız")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)
    return user

# --- ROBOT KATALOG YÖNETİMİ ---

@router.get("/robots", response_model=list[RobotResponse])
def list_robot_catalog(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin)
):
    """Mağazadaki tüm robot modellerini listeler"""
    return db.query(RobotCatalog).all()

@router.post("/robots/ekle", response_model=RobotResponse)
def create_catalog_item(
    data: RobotCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin)
):
    """Mağazaya yeni bir robot modeli ekler"""
    new_robot = RobotCatalog(
        name=data.name,
        type=data.model_type,
        price=data.price,
        description=getattr(data, "description", None)
    )
    db.add(new_robot)
    db.commit()
    db.refresh(new_robot)
    return new_robot

@router.patch("/robots/düzenle/{robot_id}", response_model=RobotResponse)
def update_catalog_item(
    robot_id: int,
    data: RobotUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin)
):
    """Katalogdaki robotun fiyat, isim vb. bilgilerini günceller"""
    robot = db.query(RobotCatalog).filter(RobotCatalog.id == robot_id).first()
    if not robot:
        raise HTTPException(status_code=404, detail="Robot modeli bulunamadı")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(robot, key, value)

    db.commit()
    db.refresh(robot)
    return robot

# --- ENVANTER VE AKTİVASYON KODU ÜRETİMİ ---

@router.post("/robots/envanter-olustur", response_model=list[PhysicalRobotUnitResponse])
def generate_inventory_units(
    data: PhysicalRobotCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin)
):
    """
    Fabrika çıkışı: Robotlara seri numarası ve kutu üzeri aktivasyon kodu atar.
    Bu kodlar olmadan kullanıcı robotunu tanımlayamaz.
    """
    catalog_item = db.query(RobotCatalog).filter(RobotCatalog.id == data.model_id).first()
    if not catalog_item:
        raise HTTPException(status_code=404, detail="Geçersiz katalog ID")

    generated_units = []
    for _ in range(data.quantity):
        serial_no = f"RBT-{catalog_item.id}-{secrets.token_hex(4)}"
        activation_key = secrets.token_urlsafe(12)
        
        new_unit = RobotInventory(
            serial_number=serial_no,
            catalog_id=catalog_item.id,
            activation_code=activation_key,
            is_activated=False
        )
        db.add(new_unit)
        generated_units.append(new_unit)

    # stock_count'u güncelle
    catalog_item.stock_count = db.query(RobotInventory).filter(
        RobotInventory.catalog_id == data.model_id,
        RobotInventory.is_activated == False
    ).count()

    db.commit()
    for unit in generated_units:
        db.refresh(unit)
    return generated_units

    # --- SİSTEM LOGLARI ---

@router.get("/log")
def get_audit_logs(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
    limit: int = 100
):
    """Sistemdeki tüm kullanıcı hareketlerini (aktivasyon, login vb.) listeler"""
    return db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit).all()
