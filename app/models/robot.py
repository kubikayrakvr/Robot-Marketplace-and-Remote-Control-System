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
    stock_count = Column(Integer, default=0)
    is_available = Column(Boolean, default=True)
    warranty_months = Column(Integer, default=24)
    ros_namespace = Column(String, nullable=True)

    # Katalogdan üretilen tüm fiziksel envanterleri bulmamızı sağlar
    inventories = relationship("RobotInventory", back_populates="catalog")

#şevval ekledi
class RobotInventory(Base):
    """Kutudaki gerçek cihaz (Fiziksel envanter)"""
    __tablename__ = "robot_inventory"

    id = Column(Integer, primary_key=True, index=True)
    catalog_id = Column(Integer, ForeignKey("robot_catalog.id"), nullable=False)
    serial_number = Column(String, unique=True, index=True, nullable=False)
    activation_code = Column(String, unique=True, index=True, nullable=False)
    is_activated = Column(Boolean, default=False, nullable=False)

    # ROBOT HAREKET TAKİBİ İÇİN EKLENEN KOLONLAR
    last_x = Column(Float, default=0.0)
    last_y = Column(Float, default=0.0)

    catalog = relationship("RobotCatalog", back_populates="inventories")
    user_robot = relationship("UserRobot", back_populates="inventory", uselist=False)
#şevval ekleme bitti
class UserRobot(Base):
    """Kullanıcı Sahiplik (Aktivasyon sonrası eşleşme)"""
    __tablename__ = "user_robots"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    inventory_id = Column(Integer, ForeignKey("robot_inventory.id"), unique=True, nullable=False)
    nickname = Column(String) # Kullanıcının robota verdiği özel isim
    activated_at = Column(DateTime(timezone=True), server_default=func.now())

    # Per-instance simulator state, persisted across despawns. NULL until the
    # user has driven the robot at least once; on first spawn we use the
    # default pose. battery_pct stays in sync with the synthetic battery node.
    last_x = Column(Float, nullable=True)
    last_y = Column(Float, nullable=True)
    last_theta = Column(Float, nullable=True)
    last_battery_pct = Column(Float, nullable=True)

    user = relationship("User", back_populates="owned_robots")
    inventory = relationship("RobotInventory", back_populates="user_robot")
