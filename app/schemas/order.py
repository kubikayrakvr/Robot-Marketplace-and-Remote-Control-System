from pydantic import BaseModel, ConfigDict, computed_field
from typing import List, Optional
from datetime import datetime
from decimal import Decimal

class OrderCreate(BaseModel):
    payment_method: str = "credit_card"
    address: str = "Varsayılan Adres"

class OrderItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: int
    quantity: int
    unit_price: Decimal
    product_name: Optional[str] = "Bilinmeyen"
    subtotal: Optional[Decimal] = None

class OrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    total_amount: Decimal
    status: str
    created_at: datetime
    items: List[OrderItemResponse]
