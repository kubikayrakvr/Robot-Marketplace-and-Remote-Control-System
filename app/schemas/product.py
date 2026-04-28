from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List

class RobotSpecs(BaseModel):
    """
    Sadece güvenli teknik verilerin dışarı sızmasına izin verir.
    IP adresi, debug portu gibi hassas veriler burada tanımlanmadığı için sızamaz.
    """
    battery_type: str = Field(..., example="Li-Po")
    capacity_ah: float = Field(..., gt=0)
    weight_kg: float = Field(..., gt=0)
    sensors: List[str] = Field(default_factory=list)
    max_speed_ms: Optional[float] = None

class ProductResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    price: float = Field(..., gt=0)
    stock_count: int = Field(..., ge=0)
    specs: RobotSpecs # Artık bir dict değil, katı bir model
    is_available: bool
    version: int # Race condition kontrolü için versiyonlama

    model_config = ConfigDict(from_attributes=True)

class ProductListResponse(BaseModel):
    items: List[ProductResponse]
    total_estimate: int # Approximate count sonucu
    last_id: Optional[int] # Keyset pagination için cursor
