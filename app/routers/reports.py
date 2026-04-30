from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.report import UserReport
from app.schemas.report import ReportCreate, ReportResponse
from app.core.dependencies import get_current_user

router = APIRouter(prefix="/api/reports", tags=["reports"])

@router.post("/", response_model=ReportResponse)
def create_report(
    data: ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    new_report = UserReport(
        user_id=current_user.id,
        title=data.title,
        description=data.description
    )
    db.add(new_report)
    db.commit()
    db.refresh(new_report)
    return new_report

@router.get("/my-reports", response_model=list[ReportResponse])
def get_my_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(UserReport).filter(UserReport.user_id == current_user.id).order_by(UserReport.created_at.desc()).all()
