from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey
from sqlalchemy.sql import func
from app.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False) # 'ROBOT_ACTIVATED', 'LOGIN_FAILED' vb.
    ip_address = Column(String)
    details = Column(JSON) # Ekstra bilgileri (seri no vb.) burada tutacağız
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
