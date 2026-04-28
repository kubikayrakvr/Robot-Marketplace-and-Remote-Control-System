from sqlalchemy import Column, Integer, String, Boolean, DateTime, func
from app.database import Base
from sqlalchemy.orm import relationship

class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    username        = Column(String, unique=True, index=True, nullable=False)
    email           = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)

    is_active  = Column(Boolean, default=True)
    is_admin   = Column(Boolean, default=False) # 🛡️ Admin ayrımını yapan o kritik alan!
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 🤝 İlişki El Sıkışmaları
    cart_items = relationship("CartItem", back_populates="user", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="user", cascade="all, delete-orphan")
    # 🛡️ KRİTİK: UserRobot içindeki 'user' alanına bak diyoruz.
    owned_robots = relationship("UserRobot", back_populates="user", cascade="all, delete-orphan")
