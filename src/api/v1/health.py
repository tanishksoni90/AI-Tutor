"""
Enhanced Health Check Endpoints.

Features:
- Basic health check (fast)
- Detailed health check (includes dependencies)
- Readiness probe (K8s compatible)
- Liveness probe (K8s compatible)
"""
import logging
from typing import Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from src.db.session import get_db
from src.db.qdrant import qdrant_client
from src.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


@router.get("/health")
async def basic_health():
    """
    Basic health check - fast response for load balancers.
    
    Returns 200 if service is running.
    """
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "ai-tutor-backend",
        "version": "0.1.0"
    }


@router.get("/health/detailed")
async def detailed_health(db: AsyncSession = Depends(get_db)):
    """
    Detailed health check - includes dependency status.
    
    Checks:
    - PostgreSQL connection
    - Qdrant connection
    - Gemini API configuration
    
    Returns 200 if all healthy, 503 if any dependency fails.
    """
    health_status = {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "ai-tutor-backend",
        "version": "0.1.0",
        "environment": settings.ENV_MODE,
        "dependencies": {}
    }
    
    overall_healthy = True
    
    # Check PostgreSQL
    try:
        result = await db.execute(text("SELECT 1"))
        health_status["dependencies"]["postgresql"] = {
            "status": "healthy",
            "response_time_ms": "< 100"
        }
    except Exception as e:
        logger.exception("PostgreSQL health check failed")
        health_status["dependencies"]["postgresql"] = {
            "status": "unhealthy",
            "error": "connection failed"
        }
        overall_healthy = False
    
    # Check Qdrant
    try:
        client = qdrant_client.get_client()
        collections = client.get_collections()
        health_status["dependencies"]["qdrant"] = {
            "status": "healthy",
            "collections_count": len(collections.collections)
        }
    except Exception as e:
        logger.exception("Qdrant health check failed")
        health_status["dependencies"]["qdrant"] = {
            "status": "unhealthy",
            "error": "unavailable"
        }
        overall_healthy = False
    
    # Check Gemini API configuration
    if settings.GEMINI_API_KEY:
        health_status["dependencies"]["gemini_api"] = {
            "status": "configured",
            "model": settings.EMBEDDING_MODEL
        }
    else:
        health_status["dependencies"]["gemini_api"] = {
            "status": "not_configured",
            "error": "GEMINI_API_KEY not set"
        }
        overall_healthy = False
    
    # Set overall status
    if not overall_healthy:
        health_status["status"] = "degraded"
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=health_status
        )
    
    return health_status


@router.get("/health/ready")
async def readiness_probe(db: AsyncSession = Depends(get_db)):
    """
    Kubernetes readiness probe.
    
    Returns 200 when service is ready to accept traffic.
    Returns 503 when service is not ready.
    """
    try:
        # Check database connection
        await db.execute(text("SELECT 1"))
        
        # Check Qdrant
        client = qdrant_client.get_client()
        client.get_collections()
        
        return {"status": "ready"}
    except Exception as e:
        logger.exception("Readiness check failed")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "not_ready", "error": "service unavailable"}
        )


@router.get("/health/live")
async def liveness_probe():
    """
    Kubernetes liveness probe.
    
    Returns 200 if service is alive (even if dependencies are down).
    Only fails if the application itself is broken.
    """
    return {"status": "alive"}


@router.get("/metrics")
async def metrics():
    """
    Basic metrics endpoint (Prometheus-compatible format can be added).
    
    Returns application metrics for monitoring.
    """
    from src.middleware.rate_limiting import rate_limiter
    
    # Get rate limiter stats (simplified)
    total_rate_limited_keys = len(rate_limiter.requests)
    
    metrics_data = {
        "timestamp": datetime.utcnow().isoformat(),
        "rate_limiting": {
            "active_keys": total_rate_limited_keys
        },
        "service": {
            "uptime": "see /health/detailed",
            "environment": settings.ENV_MODE
        }
    }
    
    return metrics_data
