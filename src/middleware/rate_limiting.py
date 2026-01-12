"""
Rate Limiting Middleware - Prevent abuse and ensure fair usage.

Strategy:
- Per-user rate limiting (authenticated endpoints)
- Per-IP rate limiting (unauthenticated endpoints)
- Different limits for different endpoint types
- Sliding window algorithm

Limits:
- Tutor queries: 60 per minute per user
- Ingestion: 10 per hour per admin
- Auth: 5 login attempts per minute per IP
"""
import time
import logging
from typing import Dict, Tuple, Optional
from collections import defaultdict
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class RateLimiter:
    """
    Sliding window rate limiter.
    
    Implementation:
    - Store timestamps of requests
    - Clean old requests outside window
    - Check if limit exceeded
    
    Note: In production, use Redis for distributed rate limiting
    This in-memory implementation is for single-instance deployments
    """
    
    def __init__(self):
        # Dict[key, List[timestamp]]
        self.requests: Dict[str, list] = defaultdict(list)
    
    def is_allowed(
        self, 
        key: str, 
        limit: int, 
        window_seconds: int
    ) -> Tuple[bool, Optional[int]]:
        """
        Check if request is allowed under rate limit.
        
        Args:
            key: Unique identifier (user_id, ip_address, etc.)
            limit: Maximum requests allowed
            window_seconds: Time window in seconds
            
        Returns:
            (allowed: bool, retry_after: Optional[int])
        """
        now = time.time()
        window_start = now - window_seconds
        
        # Clean old requests
        self.requests[key] = [
            ts for ts in self.requests[key] 
            if ts > window_start
        ]
        
        # Check limit
        if len(self.requests[key]) >= limit:
            # Calculate retry_after
            oldest_in_window = self.requests[key][0]
            retry_after = int(oldest_in_window + window_seconds - now) + 1
            return False, retry_after
        
        # Allow request and record timestamp
        self.requests[key].append(now)
        return True, None
    
    def get_usage(self, key: str, window_seconds: int) -> int:
        """Get current usage count for a key."""
        now = time.time()
        window_start = now - window_seconds
        
        return len([
            ts for ts in self.requests.get(key, [])
            if ts > window_start
        ])
    
    def reset(self, key: str):
        """Reset rate limit for a key."""
        if key in self.requests:
            del self.requests[key]


# Global rate limiter instance
rate_limiter = RateLimiter()


# Rate limit configurations
RATE_LIMITS = {
    # Tutor endpoints - frequent use expected
    "/api/v1/tutor/ask": {"limit": 60, "window": 60},  # 60/min
    
    # Ingestion - expensive operation
    "/api/v1/ingestion/ingest": {"limit": 10, "window": 3600},  # 10/hour
    
    # Auth endpoints - prevent brute force
    "/api/v1/auth/login": {"limit": 5, "window": 60},  # 5/min
    "/api/v1/auth/register": {"limit": 3, "window": 3600},  # 3/hour
    
    # Default for other endpoints
    "default": {"limit": 100, "window": 60}  # 100/min
}


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware.
    
    Applies different rate limits based on endpoint and user.
    """
    
    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks and docs
        if request.url.path in ["/health", "/docs", "/openapi.json", "/redoc"]:
            return await call_next(request)
        
        # Get rate limit config for this endpoint
        config = RATE_LIMITS.get(
            request.url.path, 
            RATE_LIMITS["default"]
        )
        
        # Determine rate limit key
        # Priority: user_id > ip_address
        rate_limit_key = self._get_rate_limit_key(request)
        
        # Check rate limit
        allowed, retry_after = rate_limiter.is_allowed(
            key=rate_limit_key,
            limit=config["limit"],
            window_seconds=config["window"]
        )
        
        if not allowed:
            logger.warning(
                f"Rate limit exceeded: {rate_limit_key} for {request.url.path}"
            )
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": f"Rate limit exceeded. Try again in {retry_after} seconds.",
                    "retry_after": retry_after
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(config["limit"]),
                    "X-RateLimit-Window": str(config["window"])
                }
            )
        
        # Add rate limit headers to response
        response = await call_next(request)
        
        # Add usage headers
        usage = rate_limiter.get_usage(rate_limit_key, config["window"])
        response.headers["X-RateLimit-Limit"] = str(config["limit"])
        response.headers["X-RateLimit-Remaining"] = str(config["limit"] - usage)
        response.headers["X-RateLimit-Window"] = str(config["window"])
        
        return response
    
    def _get_rate_limit_key(self, request: Request) -> str:
        """
        Get rate limit key from request.
        
        Priority:
        1. Authenticated user_id (from state if available)
        2. Client IP address
        """
        # Try to get user_id from request state (set by auth middleware)
        if hasattr(request.state, "user") and request.state.user:
            return f"user:{request.state.user.id}"
        
        # Fall back to IP address
        client_ip = request.client.host if request.client else "unknown"
        
        # Check for forwarded IP (behind proxy)
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()
        
        return f"ip:{client_ip}"
