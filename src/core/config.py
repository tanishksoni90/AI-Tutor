from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from typing import Set

class Settings(BaseSettings):
    PROJECT_NAME: str
    API_V1_STR: str = "/api/v1"
    ENV_MODE: str = "dev"

    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "aitutor"
    POSTGRES_PORT: int = 5432

    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333
    QDRANT_COLLECTION_NAME: str = "course_knowledge"
    
    # supports 768, 1536, 3072
    EMBEDDING_MODEL: str = "gemini-embedding-001"
    EMBEDDING_DIM: int = 1536  
    
    # Gemini API
    GEMINI_API_KEY: str = ""
    
    # JWT Authentication
    JWT_SECRET_KEY: str = "your-secret-key-change-in-production"  # i can use CryptContext(schemes=["bcrypt"], deprecated="auto").token_urlsafe(32)
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    
    # Security - PII hashing salt (MUST be set in production, never commit to repo)
    PII_SALT: str = "change-this-salt-in-production"

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"
    )


# Centralized trusted proxy configuration
# Configure based on your infrastructure (load balancers, reverse proxies)
TRUSTED_PROXIES: Set[str] = {
    "127.0.0.1",
    "::1",
    # Add your load balancer/proxy IPs here:
    # "10.0.0.1",
    # "172.16.0.1",
}

@lru_cache
def get_settings() -> Settings:
    return Settings()

settings = get_settings()