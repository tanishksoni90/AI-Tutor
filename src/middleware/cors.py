"""
CORS Configuration for Frontend Integration.

Configures Cross-Origin Resource Sharing for secure frontend access.
"""
from fastapi.middleware.cors import CORSMiddleware
from src.core.config import settings


def get_cors_config():
    """
    Get CORS configuration based on environment.
    
    Production: Strict whitelist of allowed origins
    Development: More permissive for local development
    """
    
    if settings.ENV_MODE == "prod":
        # Production: Only allow specific origins
        allowed_origins = [
            "https://app.adda247.com",
            "https://tutor.adda247.com",
            # Add your production frontend domains
        ]
        allow_credentials = True
        allow_methods = ["GET", "POST", "PUT", "DELETE"]
        allow_headers = ["*"]
        
    else:
        # Development: More permissive
        allowed_origins = [
            "http://localhost:3000",  # React default
            "http://localhost:5173",  # Vite default
            "http://localhost:8080",  # Vue default
            "http://127.0.0.1:3000",
            "http://127.0.0.1:5173",
        ]
        allow_credentials = True
        allow_methods = ["*"]
        allow_headers = ["*"]
    
    return {
        "allow_origins": allowed_origins,
        "allow_credentials": allow_credentials,
        "allow_methods": allow_methods,
        "allow_headers": allow_headers,
        "expose_headers": [
            "X-Request-ID",
            "X-Response-Time",
            "X-RateLimit-Limit",
            "X-RateLimit-Remaining",
            "X-RateLimit-Window"
        ]
    }
