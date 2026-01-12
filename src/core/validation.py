"""
Configuration Validation - Ensure all required settings are present.

Validates environment configuration on startup to fail fast.
"""
import sys
import logging
from typing import List, Tuple

from src.core.config import settings

logger = logging.getLogger(__name__)


def validate_configuration() -> Tuple[bool, List[str]]:
    """
    Validate that all required configuration is present.
    
    Returns:
        (is_valid: bool, errors: List[str])
    """
    errors = []
    
    # Required settings
    if not settings.PROJECT_NAME:
        errors.append("PROJECT_NAME is not set")
    
    if not settings.GEMINI_API_KEY:
        errors.append("GEMINI_API_KEY is not set - AI features will not work")
    
    if settings.JWT_SECRET_KEY == "your-secret-key-change-in-production":
        if settings.ENV_MODE == "prod":
            errors.append("JWT_SECRET_KEY is using default value in production!")
        else:
            logger.warning(
                "JWT_SECRET_KEY is using default value. "
                "Change this in production!"
            )
    
    # Database configuration
    if not settings.POSTGRES_SERVER:
        errors.append("POSTGRES_SERVER is not set")
    
    if not settings.POSTGRES_DB:
        errors.append("POSTGRES_DB is not set")
    
    # Qdrant configuration
    if not settings.QDRANT_HOST:
        errors.append("QDRANT_HOST is not set")
    
    # Embedding configuration validation
    valid_embedding_dims = [768, 1536, 3072]
    if settings.EMBEDDING_DIM not in valid_embedding_dims:
        errors.append(
            f"EMBEDDING_DIM must be one of {valid_embedding_dims}, "
            f"got {settings.EMBEDDING_DIM}"
        )
    
    # Token expiration validation
    if settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES <= 0:
        errors.append("JWT_ACCESS_TOKEN_EXPIRE_MINUTES must be positive")
    
    is_valid = len(errors) == 0
    
    return is_valid, errors


def validate_or_exit():
    """
    Validate configuration and exit if invalid.
    
    Call this on application startup.
    """
    logger.info("Validating configuration...")
    
    is_valid, errors = validate_configuration()
    
    if not is_valid:
        logger.error("Configuration validation failed!")
        for error in errors:
            logger.error(f"  - {error}")
        
        logger.error("Please check your .env file and environment variables")
        sys.exit(1)
    
    logger.info("Configuration validation passed ✓")
    
    # Log important settings (without secrets)
    logger.info(f"Environment: {settings.ENV_MODE}")
    logger.info(f"Project: {settings.PROJECT_NAME}")
    logger.info(f"Database: {settings.POSTGRES_SERVER}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}")
    logger.info(f"Qdrant: {settings.QDRANT_HOST}:{settings.QDRANT_PORT}")
    logger.info(f"Embedding Model: {settings.EMBEDDING_MODEL} ({settings.EMBEDDING_DIM} dims)")
