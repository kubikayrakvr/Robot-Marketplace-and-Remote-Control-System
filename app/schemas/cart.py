from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional

class CartItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0, description="Miktar en az 1 olmalıdır")

class CartItemUpdate(BaseModel):
    quantity: int = Field(..., ge=0, description="0 gönderilirse ürün silinir")

class CartItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    unit_price: float
    quantity: int
    subtotal: float

    model_config = ConfigDict(from_attributes=True)

class CartTotalResponse(BaseModel):
    items: List[CartItemResponse]
    total_price: float
