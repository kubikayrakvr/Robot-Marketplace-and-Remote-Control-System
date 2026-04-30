from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    username: str
    is_active: bool
    is_admin: bool
    security_question: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3)
    email: Optional[EmailStr] = None
    old_password: Optional[str] = None # Şifre değişimi için zorunlu doğrulama
    new_password: Optional[str] = Field(None, min_length=6)
    security_question: Optional[str] = None
    security_answer: Optional[str] = None


class UserRegister(BaseModel):
    email: EmailStr
    username: str
    password: str
    security_question: str
    security_answer: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class SecurityResetRequest(BaseModel):
    email: EmailStr

class SecurityResetConfirm(BaseModel):
    email: EmailStr
    security_answer: str
    new_password: str = Field(..., min_length=6)
