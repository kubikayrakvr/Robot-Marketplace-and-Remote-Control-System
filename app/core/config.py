from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str
    ALGORITHM: str = "RS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    PRIVATE_KEY_PATH: str = "private.pem"
    PUBLIC_KEY_PATH: str = "public.pem"

    # 🛡️ SİBER GÜVENLİK NOTU: 
    # extra="ignore" sayesinde ortamdaki (Docker/Env) yabancı değişkenler sistemi çökertmez.
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
