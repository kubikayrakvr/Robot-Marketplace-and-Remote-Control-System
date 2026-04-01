import secrets
import string
from app.models.robot import PhysicalRobot
from app.schemas.robot import PhysicalRobotCreate, PhysicalRobotUnitResponse
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserResponse, UserUpdate
from app.core.dependencies import get_current_admin
from pydantic import BaseModel
from app.models.robot import Robot
from app.schemas.robot import RobotCreate, RobotResponse, RobotUpdate

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users", response_model=list[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    return db.query(User).all()


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    return user


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    if data.username:
        user.username = data.username
    if data.email:
        user.email = data.email
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    if user_id == current_admin.id:
        raise HTTPException(status_code=400, detail="Kendinizi silemezsiniz")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    db.delete(user)
    db.commit()

class UserAdminUpdate(BaseModel):
    is_active: bool | None = None
    is_admin: bool | None = None

@router.patch("/users/{user_id}/role", response_model=UserResponse)
def update_user_role(
    user_id: int,
    data: UserAdminUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    if user_id == current_admin.id:
        raise HTTPException(status_code=400, detail="Kendi rolünüzü değiştiremezsiniz")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    if data.is_active is not None:
        user.is_active = data.is_active
    if data.is_admin is not None:
        user.is_admin = data.is_admin
    db.commit()
    db.refresh(user)
    return user

@router.post("/robots/ekle", response_model=RobotResponse)
def create_new_robot(
    data: RobotCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    new_robot = Robot(
        name=data.name,
        model_type=data.model_type,
        price=data.price,
        stock_count=data.stock_count,
        is_available=data.is_available # Eksik olan buydu!
    )
    db.add(new_robot)
    db.commit()
    db.refresh(new_robot)
    return new_robot

@router.patch("/robots/{robot_id}", response_model=RobotResponse)
def update_robot_master(
    robot_id: int,
    data: RobotUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    robot = db.query(Robot).filter(Robot.id == robot_id).first()
    if not robot:
        raise HTTPException(status_code=404, detail="Robot bulunamadı")

    # Sadece gönderilen alanları güncelle (exclude_unset=True)
    update_data = data.model_dump(exclude_unset=True)
    
    # Siber Güvenlik: Mantıksal Stok Kontrolü
    if "stock_count" in update_data and update_data["stock_count"] < 0:
        raise HTTPException(status_code=400, detail="Stok negatif olamaz")

    for key, value in update_data.items():
        setattr(robot, key, value)

    db.commit()
    db.refresh(robot)
    return robot

@router.post("/physical-robots/generate", response_model=list[PhysicalRobotUnitResponse])
def generate_physical_robots(
    data: PhysicalRobotCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    # 1. Model var mı kontrol et
    model = db.query(Robot).filter(Robot.id == data.model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Geçersiz model ID")

    generated_units = []
    
    for _ in range(data.quantity):
        # 2. Cryptographically Secure Serial Number (CSRNG)
        # Format: RBT-[MODEL_ID]-[8 haneli rastgele hex]
        # Örn: RBT-1-a7b3c9d2
        random_suffix = secrets.token_hex(4)
        serial_no = f"RBT-{model.id}-{random_suffix}"
        
        # 3. Yüksek Entropili Aktivasyon Kodu
        # Kutuların içine kazınacak olan o 'gizli' kod.
        # En az 12 karakter, harf ve rakam karışık.
        activation_key = secrets.token_urlsafe(12)
        
        new_unit = PhysicalRobot(
            serial_number=serial_no,
            model_id=model.id,
            activation_code=activation_key, # Sektörde bu hash'lenir, şimdilik admin görsün diye plain tutuyoruz.
            is_activated=False
        )
        
        db.add(new_unit)
        generated_units.append(new_unit)

    try:
        db.commit()
        for unit in generated_units:
            db.refresh(unit)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Üretim sırasında DB hatası")

    return generated_units
