from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Robot(Base):
    """
    Genel Robot Kataloğu (Model Bilgileri).
    Bu tablo, dükkandaki 'rafları' temsil eder. 
    Örn: 'AMR-V1' modeli, fiyatı ve genel özellikleri.
    """
    __tablename__ = "robots"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    model_type = Column(String)
    price = Column(Float)
    stock_count = Column(Integer, default=0)
    is_available = Column(Boolean, default=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    # İlişki: Bu modelden üretilen tüm fiziksel birimler
    units = relationship("PhysicalRobot", back_populates="model_info", cascade="all, delete-orphan")


class PhysicalRobot(Base):
    """
    Fiziksel Cihaz Envanteri.
    Fabrikadan çıkan her bir eşsiz robotun 'kimlik kartıdır'.
    Seri numarası ve aktivasyon kodu burada tutulur.
    """
    __tablename__ = "physical_robots"

    id = Column(Integer, primary_key=True, index=True)
    serial_number = Column(String, unique=True, nullable=False, index=True)
    model_id = Column(Integer, ForeignKey("robots.id"))
    
    # Güvenlik Notu: Aktivasyon kodu veritabanında hash'lenmiş olarak saklanmalıdır.
    activation_code = Column(String, nullable=False)
    is_activated = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # İlişkiler
    model_info = relationship("Robot", back_populates="units")
    ownership = relationship("UserRobot", back_populates="robot_unit", uselist=False)


class UserRobot(Base):
    """
    Sahiplik (Ownership) Tablosu.
    Kullanıcı ile fiziksel robotun eşleştiği 'tapu' kaydıdır.
    """
    __tablename__ = "user_robots"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    physical_robot_id = Column(Integer, ForeignKey("physical_robots.id"), unique=True)
    
    # Kullanıcının robota verdiği özel isim (Örn: 'SevoBot-01')
    nickname = Column(String, nullable=True)
    paired_at = Column(DateTime(timezone=True), server_default=func.now())

    # İlişkiler
    # 'User' modeli ile ilişkiyi string olarak tanımlıyoruz (Circular import önlemi)
    owner = relationship("User", backref="my_robots")
    robot_unit = relationship("PhysicalRobot", back_populates="ownership")
