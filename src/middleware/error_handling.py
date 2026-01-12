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
            
        except HTTPException as exc:
            # FastAPI HTTPException - pass through with structured format
            return self._create_error_response(
                request_id=request_id,
                status_code=exc.status_code,
                error_code=f"HTTP_{exc.status_code}",
                message=exc.detail,
                details=getattr(exc, "details", None)
            )
            
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
        """Create structured error response."""
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
