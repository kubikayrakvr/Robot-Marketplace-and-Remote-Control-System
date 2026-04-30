from pydantic import BaseModel, ConfigDict, Field
from typing import Optional

class RobotCreate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    name: str = Field(..., min_length=2)
    type: Optional[str] = None
    price: float = Field(..., gt=0)
    stock_count: int = Field(default=0, ge=0)
    is_available: bool = True
    description: Optional[str] = None
    ros_namespace: Optional[str] = None

class RobotUpdate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    name: Optional[str] = None
    type: Optional[str] = None
    price: Optional[float] = None
    stock_count: Optional[int] = None
    is_available: Optional[bool] = None
    description: Optional[str] = None
    ros_namespace: Optional[str] = None

class RobotResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: int
    name: str
    type: Optional[str] = None
    price: float
    description: Optional[str] = None
    stock_count: int = 0
    is_available: bool = True
    ros_namespace: Optional[str] = None

class PhysicalRobotCreate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    model_id: int
    quantity: int = Field(1, ge=1, le=100)

class PhysicalRobotUnitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: int
    serial_number: str
    activation_code: str
    catalog_id: int
    is_activated: bool
