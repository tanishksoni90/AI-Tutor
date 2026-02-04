"""
AI Tutor Backend - Production-Ready FastAPI Application.

Features:
- Multi-tenant RAG system
- Adaptive retrieval strategies
- Rate limiting and security
- Comprehensive monitoring
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.core.config import settings
from src.core.validation import validate_or_exit
from src.api.v1.auth import router as auth_router
from src.api.v1.tutor import router as tutor_router
from src.api.v1.ingestion import router as ingestion_router
from src.api.v1.health import router as health_router
from src.api.v1.courses import router as courses_router
from src.middleware.rate_limiting import RateLimitMiddleware
from src.middleware.error_handling import ErrorHandlingMiddleware, create_http_exception_handler
from src.middleware.logging import RequestLoggingMiddleware
from src.middleware.cors import get_cors_config

# Configure logging
logging.basicConfig(
    level=logging.INFO if settings.ENV_MODE == "prod" else logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    
    Startup:
    - Validate configuration
    - Initialize connections
    - Log startup info
    
    Shutdown:
    - Cleanup resources
    """
    # Startup
    logger.info("=" * 60)
    logger.info("🚀 AI Tutor Backend Starting...")
    logger.info("=" * 60)
    
    # Validate configuration
    validate_or_exit()
    
    logger.info("✓ All systems ready")
    logger.info(f"📚 API Docs: {settings.API_V1_STR}/docs")
    logger.info("=" * 60)
    
    yield
    
    # Shutdown
    logger.info("Shutting down AI Tutor Backend...")


def create_application() -> FastAPI:
    """
    Create and configure FastAPI application.
    
    Includes:
    - Middleware (rate limiting, error handling, logging, CORS)
    - API routers
    - Enhanced documentation
    """
    application = FastAPI(
        title=settings.PROJECT_NAME,
        description=(
            "🎓 AI Tutor Backend - Intelligent tutoring system with adaptive RAG\n\n"
            "## Features\n"
            "- 🔐 Multi-tenant authentication & authorization\n"
            "- 📚 Course-scoped retrieval with enrollment validation\n"
            "- 🧠 Adaptive RAG strategies (micro/standard/certification courses)\n"
            "- 🎯 Self-reflective validation to prevent hallucinations\n"
            "- 📊 Contextual chunking for better comprehension\n"
            "- 🔍 Reranking and query expansion\n"
            "- ⚡ Rate limiting and comprehensive monitoring\n\n"
            "## Rate Limits\n"
            "- Tutor queries: 60/minute\n"
            "- Ingestion: 10/hour\n"
            "- Auth: 5 login attempts/minute\n\n"
            "## Response Headers\n"
            "- `X-Request-ID`: Unique request identifier\n"
            "- `X-Response-Time`: Request processing time\n"
            "- `X-RateLimit-*`: Rate limit information\n"
        ),
        version="0.1.0",
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
        docs_url=f"{settings.API_V1_STR}/docs",
        redoc_url=f"{settings.API_V1_STR}/redoc",
        lifespan=lifespan,
        # Additional metadata
        contact={
            "name": "Adda247 Engineering",
            "email": "engineering@adda247.com"
        },
        license_info={
            "name": "Proprietary"
        }
    )
    
    # ============================================
    # Exception Handlers (register before middleware)
    # ============================================
    create_http_exception_handler(application)
    
    # ============================================
    # Middleware (order matters!)
    # NOTE: Middleware added FIRST runs LAST (wraps inner middleware)
    # Execution order: CORS -> Rate Limiting -> Logging -> Error Handling -> Route Handler
    # ============================================
    
    # 1. CORS - Added first, runs first (outermost layer)
    cors_config = get_cors_config()
    application.add_middleware(
        CORSMiddleware,
        **cors_config
    )
    
    # 2. Rate limiting - Prevent abuse before processing
    application.add_middleware(RateLimitMiddleware)
    
    # 3. Request logging - Log all requests
    application.add_middleware(RequestLoggingMiddleware)
    
    # 4. Error handling - Added last, runs last (catches errors from all middleware)
    application.add_middleware(ErrorHandlingMiddleware)
    
    # ============================================
    # Routers
    # ============================================
    
    # Health checks (no prefix)
    application.include_router(health_router)
    
    # API v1 routes
    application.include_router(
        auth_router, 
        prefix=settings.API_V1_STR,
        tags=["Authentication"]
    )
    application.include_router(
        tutor_router, 
        prefix=settings.API_V1_STR,
        tags=["Tutor"]
    )
    application.include_router(
        ingestion_router, 
        prefix=settings.API_V1_STR,
        tags=["Ingestion"]
    )
    application.include_router(
        courses_router, 
        prefix=settings.API_V1_STR,
        tags=["Courses"]
    )
    
    # ============================================
    # Root endpoint
    # ============================================
    
    @application.get("/", tags=["Root"])
    async def root():
        """API root - provides basic service information."""
        return {
            "service": settings.PROJECT_NAME,
            "version": "0.1.0",
            "status": "running",
            "environment": settings.ENV_MODE,
            "docs": f"{settings.API_V1_STR}/docs",
            "health": "/health/detailed"
        }
    
    return application


app = create_application()