from pydantic import BaseModel, Field, ConfigDict
from typing import Optional

class RobotCreate(BaseModel):
    # Pydantic v2'deki 'model_' korumasını bu sınıflar için kapatıyoruz
    model_config = ConfigDict(protected_namespaces=())
    
    name: str = Field(..., min_length=2)
    model_type: str
    price: float = Field(..., gt=0)
    stock_count: int = Field(default=0, ge=0)
    is_available: bool = True

class RobotUpdate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    
    name: Optional[str] = None
    model_type: Optional[str] = None
    price: Optional[float] = None
    stock_count: Optional[int] = None
    is_available: Optional[bool] = None

class RobotResponse(RobotCreate):
    id: int
    # from_attributes=True, SQLAlchemy modellerini Pydantic'e çevirmek için şarttır
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

class PhysicalRobotCreate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    
    model_id: int
    quantity: int = Field(1, ge=1, le=100)

class PhysicalRobotUnitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())
    
    id: int
    serial_number: str
    activation_code: str
    model_id: int
    is_activated: bool
