"""
Ingestion API Endpoints

Admin endpoint for document ingestion.
Protected by admin authentication.
"""
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db
from src.api.deps import AdminUser
from src.services.ingestion import IngestionService, IngestionRequest

router = APIRouter(prefix="/ingestion", tags=["ingestion"])


class IngestRequest(BaseModel):
    """Request to ingest a document."""
    course_id: UUID
    title: str = Field(..., min_length=1, max_length=500)
    source_uri: str = Field(..., min_length=1)  # Path to PDF
    content_type: str = Field(..., pattern="^(slide|pre_read|post_read|quiz|transcript)$")
    session_id: Optional[str] = None
    assignment_allowed: bool = True


class IngestResponse(BaseModel):
    """Response from ingestion."""
    document_id: UUID
    slides_extracted: int
    chunks_created: int
    embeddings_generated: int
    total_characters: int
    success: bool
    message: Optional[str] = None


@router.post(
    "/ingest",
    response_model=IngestResponse,
    responses={
        401: {"description": "Not authenticated"},
        403: {"description": "Admin access required"},
        400: {"description": "Invalid request or file not found"},
        500: {"description": "Ingestion failed"}
    }
)
async def ingest_document(
    request: IngestRequest,
    admin: AdminUser,  # Requires admin authentication
    db: AsyncSession = Depends(get_db)
):
    """
    Ingest a PDF document into the RAG system.
    
    Requires admin authentication.
    
    Flow:
    1. Parse PDF using PyMuPDF
    2. Chunk using slide-aware strategy
    3. Store in PostgreSQL
    4. Generate embeddings via Gemini
    5. Store vectors in Qdrant
    
    Idempotency: Re-ingesting same source_uri will skip (not error).
    """
    try:
        service = IngestionService(db)
        
        ingestion_request = IngestionRequest(
            course_id=request.course_id,
            title=request.title,
            source_uri=request.source_uri,
            content_type=request.content_type,
            session_id=request.session_id,
            assignment_allowed=request.assignment_allowed
        )
        
        metrics = await service.ingest(ingestion_request)
        
        return IngestResponse(
            document_id=metrics.document_id,
            slides_extracted=metrics.slides_extracted,
            chunks_created=metrics.chunks_created,
            embeddings_generated=metrics.embeddings_generated,
            total_characters=metrics.total_characters,
            success=metrics.success,
            message=metrics.error
        )
        
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File not found: {str(e)}"
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        import logging
        logging.error(f"Ingestion error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ingestion failed: {str(e)}"
        )


@router.get("/health")
async def ingestion_health():
    """Health check for ingestion service."""
    return {"status": "ok", "service": "ingestion"}
