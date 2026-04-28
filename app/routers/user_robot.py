from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.robot import RobotInventory, UserRobot
from app.models.audit import AuditLog

# Eksik olan router tanımı:
router = APIRouter(prefix="/api/user-robots", tags=["user-robots"])

@router.post("/tanimla")
def activate_robot(code: str, nickname: str, db: Session = Depends(get_db), user = Depends(get_current_user)):
    """
    Kullanıcının aktivasyon koduyla robotu kendi hesabına tanımlamasını sağlar.
    'with_for_update' kullanarak veri tutarlılığını (race condition) engelliyoruz.
    """
    # 1. FOR UPDATE ile satırı kilitliyoruz.
    item = db.query(RobotInventory).filter(
        RobotInventory.activation_code == code
    ).with_for_update().first()

    if not item:
        raise HTTPException(status_code=404, detail="Geçersiz aktivasyon kodu!")

    if item.is_activated:
        raise HTTPException(status_code=400, detail="Bu cihaz zaten aktive edilmiş!")

    try:
        # 2. Önce aktivasyon bayrağını kaldırıyoruz
        item.is_activated = True
        
        # 3. Kullanıcı ile robot eşleşmesini (zimmet) oluştur
        new_ownership = UserRobot(
            user_id=user.id,
            inventory_id=item.id,
            nickname=nickname
        )
        db.add(new_ownership)

        # 4. Siber güvenlik için audit log atıyoruz
        log_entry = AuditLog(
            user_id=user.id,
            action="ROBOT_ACTIVATION_SUCCESS",
            details={"serial": item.serial_number, "nickname": nickname}
        )
        db.add(log_entry)

        # 5. Tüm işlemleri tek seferde commit ediyoruz
        db.commit()
        
        return {"status": "success", "message": f"{nickname} artık senin kontrolünde!"}

    except Exception as e:
        db.rollback()
        print(f"Hata detayı: {str(e)}")
        raise HTTPException(status_code=500, detail="Aktivasyon sırasında sistemsel bir hata oluştu.")
