from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    ALGORITHM: str = "RS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    PRIVATE_KEY_PATH: str = "private.pem"
    PUBLIC_KEY_PATH: str = "public.pem"

    class Config:
        env_file = ".env"

settings = Settings()
