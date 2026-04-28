# Kullanıcıların admin yetkisi olmadan 
# marketteki robot modellerini görebilmesi için 
# bu router gereklidir.

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.robot import RobotCatalog
from app.schemas.robot import RobotResponse

router = APIRouter(prefix="/api/robots", tags=["robots"])

@router.get("/market", response_model=list[RobotResponse])
def get_market_robots(db: Session = Depends(get_db)):
    """Tüm kullanıcıların erişebildiği mağaza listesi"""
    return db.query(RobotCatalog).all()
