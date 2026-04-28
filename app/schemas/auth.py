from pydantic import BaseModel, EmailStr

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class TokenRefreshRequest(BaseModel):
    # Sektörel olarak genelde refresh_token gönderilir
    refresh_token: str
