from datetime import datetime, timezone
from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.robot import RobotInventory, UserRobot, RobotCatalog
from app.models.audit import AuditLog

router = APIRouter(prefix="/api/user-robots", tags=["user-robots"])


@router.get("/")
def get_my_robots(db: Session = Depends(get_db), user=Depends(get_current_user)):
    ownerships = (
        db.query(UserRobot)
        .filter(UserRobot.user_id == user.id)
        .all()
    )

    result = []
    for ow in ownerships:
        inventory = db.query(RobotInventory).filter(RobotInventory.id == ow.inventory_id).first()
        if not inventory:
            continue
        robot_model = db.query(RobotCatalog).filter(RobotCatalog.id == inventory.catalog_id).first()

        ros_robot_id = None
        if robot_model and robot_model.ros_namespace:
            num = robot_model.ros_namespace.replace("rob", "")
            ros_robot_id = f"ROB-{num}"

        warranty_end = None
        if ow.activated_at and robot_model and robot_model.warranty_months:
            warranty_end = (ow.activated_at + relativedelta(months=robot_model.warranty_months)).isoformat()

        result.append({
            "instanceId":   str(ow.id),
            "inventoryId":  str(inventory.id),
            "modelId":      str(inventory.catalog_id),
            "name":         robot_model.name if robot_model else "Bilinmeyen",
            "icon":         getattr(robot_model, "icon", "🤖") if robot_model else "🤖",
            "description":  getattr(robot_model, "description", "") if robot_model else "",
            "serialNumber": inventory.serial_number,
            "nickname":     ow.nickname,
            "status":       "active" if inventory.is_activated else "inactive",
            "purchaseDate": ow.activated_at.isoformat() if ow.activated_at else None,
            "rosRobotId":   ros_robot_id,
            "activationCode": inventory.activation_code,
            "warrantyMonths": robot_model.warranty_months if robot_model else 24,
            "warrantyEnd": warranty_end,
        })

    return result


@router.post("/tanimla")
def activate_robot(
    serial_number: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    # Kullanıcının sahip olduğu, eşleşen seri numarasına sahip envanteri bul
    ownership = (
        db.query(UserRobot)
        .join(RobotInventory)
        .filter(
            UserRobot.user_id == user.id,
            RobotInventory.serial_number == serial_number
        )
        .with_for_update()
        .first()
    )

    if not ownership:
        raise HTTPException(status_code=404, detail="Size ait böyle bir seri numarasına sahip robot bulunamadı!")

    item = db.query(RobotInventory).filter(RobotInventory.id == ownership.inventory_id).first()

    if item.is_activated:
        raise HTTPException(status_code=400, detail="Bu cihaz zaten aktive edilmiş!")

    try:
        item.is_activated = True
        
        # Aktivasyon zamanını güncelle
        ownership.activated_at = datetime.now(timezone.utc)

        log_entry = AuditLog(
            user_id=user.id,
            action="ROBOT_ACTIVATION_SUCCESS",
            details={"serial": item.serial_number, "nickname": ownership.nickname},
        )
        db.add(log_entry)

        db.commit()
        db.refresh(ownership)

        robot_model = db.query(RobotCatalog).filter(RobotCatalog.id == item.catalog_id).first()

        ros_robot_id = None
        if robot_model and robot_model.ros_namespace:
            num = robot_model.ros_namespace.replace("rob", "")
            ros_robot_id = f"ROB-{num}"

        return {
            "status": "success",
            "message": f"{ownership.nickname} başarıyla aktive edildi ve artık kontrolünüzde!",
            "robot": {
                "instanceId":   str(ownership.id),
                "inventoryId":  str(item.id),
                "modelId":      str(item.catalog_id),
                "name":         robot_model.name if robot_model else "Bilinmeyen",
                "icon":         getattr(robot_model, "icon", "🤖") if robot_model else "🤖",
                "description":  getattr(robot_model, "description", "") if robot_model else "",
                "serialNumber": item.serial_number,
                "nickname":     ownership.nickname,
                "status":       "active",
                "rosRobotId":   ros_robot_id,
            },
        }

    except Exception as e:
        db.rollback()
        print(f"Aktivasyon hatası: {e}")
        raise HTTPException(status_code=500, detail="Aktivasyon sırasında sistemsel bir hata oluştu.")
