from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional

class ReportCreate(BaseModel):
    title: str
    description: str

class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    title: str
    description: str
    is_resolved: bool
    created_at: datetime
    resolved_at: Optional[datetime] = None
    
    # Optionally include username for admin panel
    username: Optional[str] = None
