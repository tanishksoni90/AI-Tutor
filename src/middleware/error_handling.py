"""
Enhanced Error Handling Middleware.

Features:
- Structured error responses
- Error logging with context
- Error tracking (prepared for Sentry integration)
- Request ID tracking
- Development vs. production error details
"""
import logging
import traceback
import uuid
from typing import Optional
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from pydantic import BaseModel

from src.core.config import settings

logger = logging.getLogger(__name__)


class ErrorDetail(BaseModel):
    """Structured error response."""
    error_code: str
    message: str
    details: Optional[dict] = None
    request_id: Optional[str] = None
    timestamp: str
    
    # Only in development
    trace: Optional[str] = None


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """
    Global error handling middleware.
    
    Catches all unhandled exceptions and returns structured responses.
    Note: HTTPException should be handled via app.exception_handler decorators
    for proper FastAPI integration.
    """
    
    async def dispatch(self, request: Request, call_next):
        # Generate request ID for tracking
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        
        try:
            response = await call_next(request)
            
            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id
            
            return response
            
        except Exception as exc:
            # Unhandled exception - log and return 500
            logger.error(
                f"Unhandled exception in request {request_id}",
                exc_info=True,
                extra={
                    "request_id": request_id,
                    "path": request.url.path,
                    "method": request.method,
                    "client": request.client.host if request.client else None
                }
            )
            
            # In production, don't leak internal errors
            if settings.ENV_MODE == "prod":
                message = "An internal error occurred. Please try again later."
                trace = None
            else:
                message = str(exc)
                trace = traceback.format_exc()
            
            return self._create_error_response(
                request_id=request_id,
                status_code=500,
                error_code="INTERNAL_SERVER_ERROR",
                message=message,
                trace=trace
            )
    
    def _create_error_response(
        self,
        request_id: str,
        status_code: int,
        error_code: str,
        message: str,
        details: Optional[dict] = None,
        trace: Optional[str] = None
    ) -> JSONResponse:
        """Create structured error response (instance method for middleware)."""
        return _create_error_response(
            request_id=request_id,
            status_code=status_code,
            error_code=error_code,
            message=message,
            details=details,
            trace=trace
        )


# Custom exception classes
class CourseNotFoundError(HTTPException):
    """Course not found."""
    def __init__(self, course_id: str):
        super().__init__(
            status_code=404,
            detail=f"Course {course_id} not found"
        )


class EnrollmentRequiredError(HTTPException):
    """Student not enrolled in course."""
    def __init__(self, student_id: str, course_id: str):
        super().__init__(
            status_code=403,
            detail=f"Student {student_id} is not enrolled in course {course_id}"
        )


class InvalidDocumentError(HTTPException):
    """Invalid document format or content."""
    def __init__(self, message: str):
        super().__init__(
            status_code=400,
            detail=f"Invalid document: {message}"
        )


class ServiceUnavailableError(HTTPException):
    """External service unavailable."""
    def __init__(self, service: str):
        super().__init__(
            status_code=503,
            detail=f"Service unavailable: {service}"
        )


# Exception handlers to be registered with FastAPI app
def create_http_exception_handler(app):
    """
    Create and register HTTPException handler.
    
    Usage in main.py:
        from src.middleware.error_handling import create_http_exception_handler
        create_http_exception_handler(app)
    """
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
        
        # Extract details from exception if available
        details = None
        if hasattr(exc, "details"):
            details = exc.details
        elif isinstance(exc.detail, dict):
            details = exc.detail
        
        # If detail is a dict, use it as structured details and extract message
        message = exc.detail
        if isinstance(exc.detail, dict):
            message = exc.detail.get("message", str(exc.detail))
        
        return _create_error_response(
            request_id=request_id,
            status_code=exc.status_code,
            error_code=f"HTTP_{exc.status_code}",
            message=message,
            details=details
        )
    
    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
        
        logger.error(
            f"Unhandled exception in request {request_id}",
            exc_info=True,
            extra={
                "request_id": request_id,
                "path": request.url.path,
                "method": request.method,
                "client": request.client.host if request.client else None
            }
        )
        
        if settings.ENV_MODE == "prod":
            message = "An internal error occurred. Please try again later."
            trace = None
        else:
            message = str(exc)
            trace = traceback.format_exc()
        
        return _create_error_response(
            request_id=request_id,
            status_code=500,
            error_code="INTERNAL_SERVER_ERROR",
            message=message,
            trace=trace
        )


def _create_error_response(
    request_id: str,
    status_code: int,
    error_code: str,
    message: str,
    details: Optional[dict] = None,
    trace: Optional[str] = None
) -> JSONResponse:
    """Create structured error response (shared helper)."""
    from datetime import datetime
    
    error_detail = ErrorDetail(
        error_code=error_code,
        message=message,
        details=details,
        request_id=request_id,
        timestamp=datetime.utcnow().isoformat(),
        trace=trace if settings.ENV_MODE != "prod" else None
    )
    
    return JSONResponse(
        status_code=status_code,
        content=error_detail.model_dump(exclude_none=True),
        headers={"X-Request-ID": request_id}
    )
