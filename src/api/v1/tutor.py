"""
Tutor API Endpoints

Main endpoint: POST /api/v1/tutor/ask
- Validates enrollment (via JWT token)
- Retrieves relevant chunks
- Generates tutor response
- Returns with source attribution

Streaming endpoint: POST /api/v1/tutor/ask/stream
- Same as /ask but streams response using Server-Sent Events (SSE)
- Returns chunks in real-time for better UX

HYBRID MEMORY APPROACH:
- Short-term: Context messages passed from frontend (last 3-5 messages)
- Long-term: Query analytics stored for insights (no conversation text)
"""
import json
import logging
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db
from src.api.deps import CurrentUser
from src.services.retrieval import (
    RetrievalService, 
    RetrievalRequest, 
    AccessDeniedError
)
from src.services.tutor import SelfReflectiveTutorService, TutorRequest, ContextMessage

router = APIRouter(prefix="/tutor", tags=["tutor"])
logger = logging.getLogger(__name__)


# Request/Response Models
class ContextMessageInput(BaseModel):
    """A message in the session context (short-term memory)."""
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., max_length=5000)


class AskRequest(BaseModel):
    """Request to ask the tutor a question."""
    course_id: UUID
    question: str = Field(..., min_length=1, max_length=2000)
    session_filter: Optional[str] = None  # Optional: limit to specific session
    top_k: int = Field(default=5, ge=1, le=10)
    enable_validation: bool = Field(default=True)  # Self-reflective validation
    
    # Response mode: "strict" = context-only, "enhanced" = AI can elaborate
    response_mode: str = Field(
        default="enhanced",
        pattern="^(strict|enhanced)$",
        description="strict: answer only from sources, enhanced: AI elaborates with more detail"
    )
    
    # Short-term memory: Last few messages for follow-up context
    context_messages: Optional[List[ContextMessageInput]] = Field(
        default=None, 
        max_length=5,  # Max 5 messages for context
        description="Last 3-5 messages for follow-up context (short-term memory)"
    )
    
    # Anonymous session tracking (for analytics, not for storing conversations)
    session_token: Optional[str] = Field(
        default=None, 
        max_length=64,
        description="Optional session token for analytics grouping"
    )


class SourceReference(BaseModel):
    """Reference to source material used in response."""
    chunk_id: str
    relevance_score: float
    slide_number: Optional[int] = None
    slide_title: Optional[str] = None
    session_id: Optional[str] = None


class AskResponse(BaseModel):
    """Response from the tutor."""
    answer: str
    sources: List[SourceReference]
    chunks_used: int
    model_used: str
    confidence: Optional[str] = None  # "validated" | "no_context" | "generated"
    confidence_score: Optional[int] = None  # 0-100 numeric score
    response_time_ms: Optional[int] = None  # Response latency


class ErrorResponse(BaseModel):
    """Error response."""
    detail: str
    error_code: str


@router.post(
    "/ask",
    response_model=AskResponse,
    responses={
        401: {"description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Access denied - not enrolled"},
        400: {"model": ErrorResponse, "description": "Invalid request"},
        500: {"model": ErrorResponse, "description": "Internal error"}
    }
)
async def ask_tutor(
    request: AskRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db)
):
    """
    Ask the AI tutor a question about course material.
    
    Requires authentication. Student ID is extracted from JWT token.
    
    ## Hybrid Memory Approach
    
    **Short-term memory**: Pass `context_messages` with the last 3-5 messages
    for follow-up questions (e.g., "Can you explain that more simply?").
    This context is NOT stored - it lives only in the current session.
    
    **Long-term analytics**: We store query metadata (topic, confidence, timing)
    for insights, but NOT the actual question/answer text.
    
    ## Flow
    1. Validate student enrollment in course
    2. Retrieve relevant chunks from vector store  
    3. **Self-Reflective Validation**: Check if chunks can answer question
    4. Generate tutor response with session context
    5. Log analytics (metadata only)
    6. Return response with source attribution
    
    ## Safety guarantees
    - Student can only access enrolled course content
    - Assignment content is excluded by default
    - Tutor explains concepts, doesn't provide solutions
    - Won't fabricate answers when context is insufficient
    """
    try:
        # 1. Retrieve relevant chunks (includes enrollment validation)
        retrieval_service = RetrievalService(db)
        retrieval_request = RetrievalRequest(
            student_id=current_user.id,  # From JWT token
            course_id=request.course_id,
            query=request.question,
            top_k=request.top_k,
            exclude_assignments=True,  # Always safe mode
            session_filter=request.session_filter
        )
        
        retrieval_result = await retrieval_service.retrieve(retrieval_request)
        
        # 2. Convert context messages to internal format
        context_messages = None
        if request.context_messages:
            context_messages = [
                ContextMessage(role=msg.role, content=msg.content)
                for msg in request.context_messages
            ]
        
        # 3. Generate tutor response with self-reflective validation
        tutor_service = SelfReflectiveTutorService(
            db, 
            enable_analytics=True  # Enable analytics logging
        )
        tutor_request = TutorRequest(
            student_id=current_user.id,
            course_id=request.course_id,
            question=request.question,
            retrieval_result=retrieval_result,
            session_token=request.session_token,
            context_messages=context_messages,
            response_mode=request.response_mode  # Pass response mode to tutor
        )
        
        tutor_response = await tutor_service.respond(tutor_request)
        
        # 4. Build response
        return AskResponse(
            answer=tutor_response.answer,
            sources=[
                SourceReference(**source) 
                for source in tutor_response.sources
            ],
            chunks_used=len(tutor_response.sources),
            model_used=tutor_response.model_used,
            confidence=tutor_response.confidence,
            confidence_score=tutor_response.confidence_score,
            response_time_ms=tutor_response.response_time_ms
        )
        
    except AccessDeniedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        # Log the full error internally
        import logging
        logging.error(f"Tutor endpoint error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred processing your request"
        )


@router.get("/health")
async def tutor_health():
    """Health check for tutor service."""
    return {"status": "ok", "service": "tutor"}


@router.post(
    "/ask/stream",
    responses={
        401: {"description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Access denied - not enrolled"},
        400: {"model": ErrorResponse, "description": "Invalid request"},
        500: {"model": ErrorResponse, "description": "Internal error"}
    }
)
async def ask_tutor_stream(
    request: AskRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db)
):
    """
    Ask the AI tutor a question with streaming response.
    
    Returns a Server-Sent Events (SSE) stream with the following event types:
    
    - **metadata**: Initial metadata including sources, confidence, model_used
    - **chunk**: Text chunk of the response (stream these to build the answer)
    - **done**: Final metrics (response_time_ms, response_length)
    - **error**: Error message if something went wrong
    
    ## Example SSE Stream:
    ```
    data: {"type": "metadata", "data": {"sources": [...], "confidence": "validated"}}
    
    data: {"type": "chunk", "data": "Machine learning is"}
    
    data: {"type": "chunk", "data": " a subset of artificial"}
    
    data: {"type": "chunk", "data": " intelligence..."}
    
    data: {"type": "done", "data": {"response_time_ms": 1234}}
    ```
    
    Same authentication and enrollment validation as /ask.
    """
    
    async def generate_stream():
        """Generator for SSE stream."""
        try:
            # 1. Retrieve relevant chunks (includes enrollment validation)
            retrieval_service = RetrievalService(db)
            retrieval_request = RetrievalRequest(
                student_id=current_user.id,
                course_id=request.course_id,
                query=request.question,
                top_k=request.top_k,
                exclude_assignments=True,
                session_filter=request.session_filter
            )
            
            retrieval_result = await retrieval_service.retrieve(retrieval_request)
            
            # 2. Convert context messages
            context_messages = None
            if request.context_messages:
                context_messages = [
                    ContextMessage(role=msg.role, content=msg.content)
                    for msg in request.context_messages
                ]
            
            # 3. Create tutor service and request
            tutor_service = SelfReflectiveTutorService(
                db, 
                enable_analytics=True
            )
            tutor_request = TutorRequest(
                student_id=current_user.id,
                course_id=request.course_id,
                question=request.question,
                retrieval_result=retrieval_result,
                session_token=request.session_token,
                context_messages=context_messages,
                response_mode=request.response_mode
            )
            
            # 4. Stream the response
            async for event in tutor_service.respond_stream(tutor_request):
                # Format as SSE
                yield f"data: {json.dumps(event)}\n\n"
                
        except AccessDeniedError as e:
            error_event = {"type": "error", "data": str(e)}
            yield f"data: {json.dumps(error_event)}\n\n"
        except ValueError as e:
            error_event = {"type": "error", "data": str(e)}
            yield f"data: {json.dumps(error_event)}\n\n"
        except Exception as e:
            logger.error(f"Streaming tutor error: {str(e)}", exc_info=True)
            error_event = {"type": "error", "data": "An error occurred processing your request"}
            yield f"data: {json.dumps(error_event)}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable nginx buffering
        }
    )
