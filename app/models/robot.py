from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class RobotCatalog(Base):
    """Mağazadaki ürün sayfası (Ürün kataloğu)"""
    __tablename__ = "robot_catalog"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String)
    price = Column(Float, nullable=False)
    description = Column(String)

    # Katalogdan üretilen tüm fiziksel envanterleri bulmamızı sağlar
    inventories = relationship("RobotInventory", back_populates="catalog")

class RobotInventory(Base):
    """Kutudaki gerçek cihaz (Fiziksel envanter)"""
    __tablename__ = "robot_inventory"

    id = Column(Integer, primary_key=True, index=True)
    catalog_id = Column(Integer, ForeignKey("robot_catalog.id"), nullable=False)
    serial_number = Column(String, unique=True, index=True, nullable=False)
    activation_code = Column(String, unique=True, index=True, nullable=False)
    is_activated = Column(Boolean, default=False, nullable=False)

    catalog = relationship("RobotCatalog", back_populates="inventories")
    # uselist=False çünkü her kutunun tek bir 'tapu' kaydı (UserRobot) olabilir
    user_robot = relationship("UserRobot", back_populates="inventory", uselist=False)

class UserRobot(Base):
    """Kullanıcı Sahiplik (Aktivasyon sonrası eşleşme)"""
    __tablename__ = "user_robots"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    inventory_id = Column(Integer, ForeignKey("robot_inventory.id"), unique=True, nullable=False)
    nickname = Column(String) # Kullanıcının robota verdiği özel isim
    activated_at = Column(DateTime(timezone=True), server_default=func.now())

    inventory = relationship("RobotInventory", back_populates="user_robot")
