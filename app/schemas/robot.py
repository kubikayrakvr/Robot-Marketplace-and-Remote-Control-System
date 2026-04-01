from pydantic import BaseModel, Field
from typing import Optional

class RobotCreate(BaseModel):
    name: str = Field(..., min_length=2)
    model_type: str
    price: float = Field(..., gt=0)
    stock_count: int = Field(default=0, ge=0)
    is_available: bool = True

class RobotUpdate(BaseModel): # Yeni: Esnek güncelleme şeması
    name: Optional[str] = None
    model_type: Optional[str] = None
    price: Optional[float] = None
    stock_count: Optional[int] = None
    is_available: Optional[bool] = None

class RobotResponse(RobotCreate):
    id: int
    class Config:
        from_attributes = True

class PhysicalRobotCreate(BaseModel):
    model_id: int
    quantity: int = Field(1, ge=1, le=100) # Tek seferde max 100 adet üretilebilir

class PhysicalRobotUnitResponse(BaseModel):
    id: int
    serial_number: str
    activation_code: str # Bu sadece üretim anında admin'e gösterilir!
    model_id: int
    is_activated: bool

    class Config:
        from_attributes = True
