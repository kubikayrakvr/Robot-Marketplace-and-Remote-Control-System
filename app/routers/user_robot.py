from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.robot import RobotInventory, UserRobot
from app.models.audit import AuditLog # Log tablomuz

@router.post("/tanimla")
def activate_robot(code: str, nickname: str, db: Session = Depends(get_db), user = Depends(get_current_user)):
    # 1. FOR UPDATE ile satırı kilitliyoruz. İşlem bitene kadar kimse bu koda dokunamaz!
    item = db.query(RobotInventory).filter(
        RobotInventory.activation_code == code
    ).with_for_update().first()

    # 2. Varlık Kontrolü
    if not item:
        raise HTTPException(status_code=404, detail="Geçersiz aktivasyon kodu!")

    # 3. Senin uyardığın o kritik 'is_activated' kontrolü
    if item.is_activated:
        # Siber Güvenlik Notu: Burada 400 dönmek, brute-force denemelerini admin panelinde izlemek için önemli.
        raise HTTPException(status_code=400, detail="Bu cihaz zaten aktive edilmiş!")

    try:
        # 4. GÜNCELLEME: Önce bayrağı kaldırıyoruz (Senin önerin)
        item.is_activated = True
        
        # 5. Zimmetleme kaydı oluştur
        new_ownership = UserRobot(
            user_id=user.id,
            inventory_id=item.id,
            nickname=nickname
        )
        db.add(new_ownership)

        # 6. AUDIT LOG: Bu işlemi 'izlenebilir' kılmak için log atıyoruz
        log_entry = AuditLog(
            user_id=user.id,
            action="ROBOT_ACTIVATION_SUCCESS",
            details={"serial": item.serial_number, "nickname": nickname}
        )
        db.add(log_entry)

        # 7. COMMIT: Tüm işlemler aynı anda veritabanına işlenir. 
        # Birinde hata olursa (rollback) hiçbir değişiklik kaydedilmez.
        db.commit()
        
        return {"status": "success", "message": f"{nickname} artık senin kontrolünde!"}

    except Exception as e:
        db.rollback() # Hata anında temizlik
        raise HTTPException(status_code=500, detail="Aktivasyon sırasında sistemsel bir hata oluştu.")
