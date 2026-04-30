from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.robot import RobotCatalog

router = APIRouter(prefix="/api/robots", tags=["robots"])

@router.get("/market")
def get_market_robots(db: Session = Depends(get_db)):
    robots = db.query(RobotCatalog).filter(RobotCatalog.is_available == True).all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "description": getattr(r, "description", ""),
            "price": r.price,
            "type": getattr(r, "type", ""),
            "icon": getattr(r, "icon", "🤖"),
            "stock_count": getattr(r, "stock_count", 0),
            "is_available": getattr(r, "is_available", True),
        }
        for r in robots
    ]
