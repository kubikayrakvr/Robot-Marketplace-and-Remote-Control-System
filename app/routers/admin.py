import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.robot import RobotCatalog, RobotInventory
from app.models.report import UserReport
from app.models.audit import AuditLog
from app.schemas.user import UserResponse, UserUpdate
from app.schemas.robot import (
    RobotCreate, RobotResponse, RobotUpdate, 
    PhysicalRobotCreate, PhysicalRobotUnitResponse
)
from app.schemas.report import ReportResponse
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
    """Mağazaya yeni bir robot modeli ekler ve stok kadar envanter oluşturur"""
    new_robot = RobotCatalog(
        name=data.name,
        type=data.type,
        price=data.price,
        description=getattr(data, "description", None),
        stock_count=data.stock_count
    )
    db.add(new_robot)
    db.flush() # ID alabilmek için

    for _ in range(data.stock_count):
        serial_no = f"RBT-{new_robot.id}-{secrets.token_hex(4)}"
        activation_key = secrets.token_urlsafe(12)
        new_unit = RobotInventory(
            serial_number=serial_no,
            catalog_id=new_robot.id,
            activation_code=activation_key,
            is_activated=False
        )
        db.add(new_unit)

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
    
    if "stock_count" in update_data:
        from app.models.robot import UserRobot
        # Mevcut toplam (satılmış + satılmamış) envanter sayısı
        total_current = db.query(RobotInventory).filter(RobotInventory.catalog_id == robot_id).count()
        new_total = update_data["stock_count"]
        diff = new_total - total_current
        
        if diff > 0:
            # Stok artışı: Yeni birimler ekle
            for _ in range(diff):
                serial_no = f"RBT-{robot.id}-{secrets.token_hex(4)}"
                activation_key = secrets.token_urlsafe(12)
                db.add(RobotInventory(
                    serial_number=serial_no,
                    catalog_id=robot.id,
                    activation_code=activation_key,
                    is_activated=False
                ))
        elif diff < 0:
            # Stok azalışı: Önce satılmamışları, yetmezse satılmışları sil
            to_delete_count = abs(diff)
            
            # 1. Satılmamış (boştaki) robotları bul ve sil
            unsold = db.query(RobotInventory).filter(
                RobotInventory.catalog_id == robot_id,
                ~RobotInventory.user_robot.has()
            ).limit(to_delete_count).all()
            
            deleted_so_far = len(unsold)
            for u in unsold:
                db.delete(u)
            
            # 2. Eğer hala silinmesi gereken varsa, satılmış (kullanıcıdaki) robotları sil
            if deleted_so_far < to_delete_count:
                remaining_to_delete = to_delete_count - deleted_so_far
                owned = db.query(RobotInventory).filter(
                    RobotInventory.catalog_id == robot_id,
                    RobotInventory.user_robot.has()
                ).limit(remaining_to_delete).all()
                
                for o in owned:
                    # UserRobot kaydı CASCADE ile silinebilir veya manuel silinir
                    # Modellerde cascade tanımlı değilse manuel silelim
                    if o.user_robot:
                        db.delete(o.user_robot)
                    db.delete(o)

    for key, value in update_data.items():
        setattr(robot, key, value)

    db.commit()
    db.refresh(robot)
    return robot



    # --- SİSTEM LOGLARI ---

@router.get("/log")
def get_audit_logs(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
    limit: int = 100
):
    """Sistemdeki tüm kullanıcı hareketlerini (aktivasyon, login vb.) listeler"""
    return db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit).all()

# --- RAPOR YÖNETİMİ ---

@router.get("/reports", response_model=list[ReportResponse])
def list_reports(
    resolved: bool | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Kullanıcılardan gelen raporları listeler"""
    query = db.query(UserReport)
    if resolved is not None:
        query = query.filter(UserReport.is_resolved == resolved)
    
    reports = query.order_by(UserReport.created_at.desc()).all()
    
    # Username bilgisini ekle
    for r in reports:
        r.username = r.user.username
        
    return reports

@router.patch("/reports/coz/{report_id}", response_model=ReportResponse)
def resolve_report(
    report_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Bir raporu çözüldü olarak işaretler"""
    report = db.query(UserReport).filter(UserReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Rapor bulunamadı")
    
    report.is_resolved = True
    from datetime import datetime, timezone
    report.resolved_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(report)
    report.username = report.user.username
    return report

# --- ROBOT SİLME ---

@router.delete("/robots/{robot_id}")
def delete_catalog_item(
    robot_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin)
):
    robot = db.query(RobotCatalog).filter(RobotCatalog.id == robot_id).first()
    if not robot:
        raise HTTPException(status_code=404, detail="Robot modeli bulunamadı")

    # Siparişi olan robotları tamamen silmek yerine pasife al
    from app.models.shop import OrderItem
    has_orders = db.query(OrderItem).filter(OrderItem.product_id == robot_id).first()
    
    if has_orders:
        robot.is_available = False
        db.commit()
        return {"message": "Robota ait siparişler mevcut olduğundan silme yerine pasife alındı."}

    inventories = db.query(RobotInventory).filter(RobotInventory.catalog_id == robot_id).all()
    for inv in inventories:
        if inv.user_robot:
            db.delete(inv.user_robot)
        db.delete(inv)
    
    db.delete(robot)
    db.commit()
    return {"message": "Robot modeli ve bağlı tüm birimler silindi"}

# --- KULLANICI SİLME ---

@router.delete("/kullanıcılar/{user_id}")
@router.delete("/kullanıcılar/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    if user_id == current_admin.id:
        raise HTTPException(status_code=400, detail="Kendinizi silemezsiniz")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    from app.models.robot import UserRobot
    from app.models.shop import Order
    from app.models.report import UserReport
    
    db.query(UserReport).filter(UserReport.user_id == user_id).delete()
    db.query(AuditLog).filter(AuditLog.user_id == user_id).delete()
    db.query(UserRobot).filter(UserRobot.user_id == user_id).delete()
    db.query(Order).filter(Order.user_id == user_id).update({"status": "CANCELLED"})
    db.delete(user)
    db.commit()
    return {"message": "Kullanıcı silindi"}

    # UserRobot kayıtlarını sil
    db.query(UserRobot).filter(UserRobot.user_id == user_id).delete()
    # Siparişleri pasife al
    db.query(Order).filter(Order.user_id == user_id).update({"status": "CANCELLED"})
    # Kullanıcıyı sil
    db.delete(user)
    db.commit()
    return {"message": "Kullanıcı tamamen silindi"}

#---SATIŞ TAKİPİ---

@router.get("/istatistik")
def get_stats(db: Session = Depends(get_db), _: User = Depends(get_current_admin)):
    from app.models.shop import Order, OrderItem
    from sqlalchemy import func

    # Toplam sipariş sayısı ve gelir
    toplam = db.query(
        func.count(Order.id).label("siparis_sayisi"),
        func.sum(Order.total_amount).label("toplam_gelir")
    ).filter(Order.status == "PAID").first()

    # Robot bazlı satış
    robot_satis = db.query(
        RobotCatalog.name,
        func.count(OrderItem.id).label("adet"),
	func.sum(OrderItem.unit_price * OrderItem.quantity).label("gelir")
    ).join(OrderItem, OrderItem.product_id == RobotCatalog.id)\
     .join(Order, Order.id == OrderItem.order_id)\
     .filter(Order.status == "PAID")\
     .group_by(RobotCatalog.name).all()

    return {
        "siparis_sayisi": toplam.siparis_sayisi or 0,
        "toplam_gelir": float(toplam.toplam_gelir or 0),
        "robot_bazli": [
            {"robot": r.name, "adet": r.adet, "gelir": float(r.gelir)}
            for r in robot_satis
        ]
    }
