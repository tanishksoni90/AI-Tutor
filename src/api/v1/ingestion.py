"""
Ingestion API Endpoints

Admin endpoint for document ingestion.
Protected by admin authentication.
"""
import os
import uuid as uuid_module
from pathlib import Path
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db
from src.db.models import ActivityLog, ActivityType
from src.api.deps import AdminUser
from src.services.ingestion import IngestionService, IngestionRequest

router = APIRouter(prefix="/ingestion", tags=["ingestion"])

# Ensure uploads directory exists
UPLOAD_DIR = Path("data/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


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


class UploadResponse(BaseModel):
    """Response from file upload."""
    filename: str
    source_uri: str
    size_bytes: int


@router.post(
    "/upload",
    response_model=UploadResponse,
    responses={
        401: {"description": "Not authenticated"},
        403: {"description": "Admin access required"},
        400: {"description": "Invalid file type"},
    }
)
async def upload_document(
    admin: AdminUser,
    file: UploadFile = File(...),
):
    """
    Upload a PDF file for later ingestion.
    
    Returns the source_uri to use in the /ingest endpoint.
    """
    # Validate file type
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are allowed"
        )
    
    # Generate unique filename to avoid collisions
    unique_id = uuid_module.uuid4().hex[:8]
    safe_filename = f"{unique_id}_{file.filename}"
    file_path = UPLOAD_DIR / safe_filename
    
    # Save file
    try:
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}"
        )
    
    return UploadResponse(
        filename=file.filename,
        source_uri=str(file_path),
        size_bytes=len(content)
    )


@router.post(
    "/upload-and-ingest",
    response_model=IngestResponse,
    responses={
        401: {"description": "Not authenticated"},
        403: {"description": "Admin access required"},
        400: {"description": "Invalid request or file"},
        500: {"description": "Ingestion failed"}
    }
)
async def upload_and_ingest(
    admin: AdminUser,
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
    course_id: str = Form(...),
    title: str = Form(...),
    content_type: str = Form(...),
    session_id: Optional[str] = Form(None),
    assignment_allowed: bool = Form(True),
):
    """
    Upload a PDF and immediately ingest it.
    
    Combined endpoint for convenience.
    """
    # Validate file type
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are allowed"
        )
    
    # Generate unique filename
    unique_id = uuid_module.uuid4().hex[:8]
    safe_filename = f"{unique_id}_{file.filename}"
    file_path = UPLOAD_DIR / safe_filename
    
    # Save file
    try:
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}"
        )
    
    # Now ingest
    try:
        service = IngestionService(db)
        
        ingestion_request = IngestionRequest(
            course_id=UUID(course_id),
            title=title,
            source_uri=str(file_path),
            content_type=content_type,
            session_id=session_id if session_id else None,
            assignment_allowed=assignment_allowed
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
        # Clean up uploaded file on failure
        if file_path.exists():
            os.remove(file_path)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File not found: {str(e)}"
        )
    except ValueError as e:
        if file_path.exists():
            os.remove(file_path)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        if file_path.exists():
            os.remove(file_path)
        import logging
        logging.error(f"Ingestion error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ingestion failed: {str(e)}"
        )


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
        
        # Log the activity if successful
        if metrics.success:
            activity = ActivityLog(
                org_id=admin.org_id,
                activity_type=ActivityType.DOCUMENT_UPLOADED.value,
                actor_email=admin.email,
                target_name=request.title
            )
            db.add(activity)
            await db.commit()
        
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
