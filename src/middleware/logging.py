"""
Request/Response Logging Middleware.

Features:
- Log all requests with timing
- Log response status codes
- Structured logging for analysis
- Performance monitoring
- PII anonymization for user_id and client_ip with HMAC-SHA256
"""
import time
import logging
import hmac
import hashlib
from typing import Optional
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from src.core.config import settings, TRUSTED_PROXIES

logger = logging.getLogger(__name__)


def anonymize_pii(value: Optional[str]) -> Optional[str]:
    """
    Anonymize PII using HMAC-SHA256 with secret salt.
    
    Returns a deterministic hash for correlation while protecting raw PII.
    Uses full hash output (64 hex chars) with secret salt to resist rainbow tables.
    
    SECURITY: The PII_SALT must be set in configuration and never committed to source control.
    """
    if not value:
        return None
    
    # Use HMAC-SHA256 with secret salt for stronger protection
    return hmac.new(
        settings.PII_SALT.encode(),
        value.encode(),
        hashlib.sha256
    ).hexdigest()


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Log all HTTP requests with timing and metadata.
    
    Security features:
    - Trusted proxy validation for X-Forwarded-For
    - PII anonymization for user_id and client_ip
    - Exception handling with proper logging
    """
    
    async def dispatch(self, request: Request, call_next):
        # Start timing
        start_time = time.time()
        
        # Get request metadata
        request_id = getattr(request.state, "request_id", "unknown")
        
        # Get client IP with trusted proxy validation
        client_ip = request.client.host if request.client else "unknown"
        peer_ip = client_ip
        
        # Only trust X-Forwarded-For if request comes from trusted proxy
        if peer_ip in TRUSTED_PROXIES:
            forwarded = request.headers.get("X-Forwarded-For")
            if forwarded:
                # Take leftmost IP (original client) when behind trusted proxy
                client_ip = forwarded.split(",")[0].strip()
        
        # Get user if authenticated
        user_id = None
        if hasattr(request.state, "user") and request.state.user:
            user_id = str(request.state.user.id)
        
        # Anonymize PII for logging
        client_ip_hash = anonymize_pii(client_ip)
        user_id_hash = anonymize_pii(user_id) if user_id else None
        
        response = None
        exception_occurred = False
        
        try:
            # Process request
            response = await call_next(request)
        except Exception as e:
            exception_occurred = True
            logger.error(
                f"Exception during request processing: {str(e)}",
                exc_info=True,
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "client_ip_hash": client_ip_hash,
                    "user_id_hash": user_id_hash
                }
            )
            raise
        finally:
            # Calculate duration
            duration_ms = (time.time() - start_time) * 1000
            
            # Log request (always, even if exception occurred)
            log_data = {
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code if response else None,
                "duration_ms": round(duration_ms, 2),
                "client_ip_hash": client_ip_hash,
                "user_id_hash": user_id_hash,
                "user_agent": request.headers.get("User-Agent", "unknown"),
                "exception": exception_occurred
            }
            
            # Log level based on status code or exception
            if exception_occurred or (response and response.status_code >= 500):
                logger.error("Request failed", extra=log_data)
            elif response and response.status_code >= 400:
                logger.warning("Request error", extra=log_data)
            else:
                logger.info("Request completed", extra=log_data)
            
            # Add performance warning for slow requests
            if duration_ms > 5000:  # 5 seconds
                logger.warning(
                    f"Slow request detected: {duration_ms}ms",
                    extra=log_data
                )
        
        # Add timing header
        if response:
            response.headers["X-Response-Time"] = f"{duration_ms}ms"
        
        return response
