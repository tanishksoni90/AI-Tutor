"""
Ingestion Orchestrator - Coordinates the full document ingestion pipeline.

Pipeline:
1. Parse PDF → extract slides
2. Chunk slides using slide-aware strategy
3. Persist Document + DocumentChunks in PostgreSQL
4. Generate embeddings via Gemini
5. Store vectors in Qdrant with metadata
6. Update chunks with embedding_ids

Features:
- Idempotency via source_uri check
- Atomic transactions (rollback on failure)
- Detailed logging and metrics
"""
import logging
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, List
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from qdrant_client.http import models as qdrant_models

from src.core.config import settings
from src.db.models import Document, DocumentChunk, Course
from src.db.repository.document import DocumentRepository, DocumentChunkRepository
from src.db.repository.course import CourseRepository
from src.db.qdrant import qdrant_client
from src.services.pdf_parser import PDFParser, SlideContent
from src.services.chunker import ContextualSlideAwareChunker, ChunkData
from src.services.embeddings import EmbeddingService, get_embedding_service

logger = logging.getLogger(__name__)


@dataclass
class IngestionMetrics:
    """Metrics from an ingestion run."""
    document_id: UUID
    source_uri: str
    slides_extracted: int
    chunks_created: int
    embeddings_generated: int
    total_characters: int
    success: bool
    error: Optional[str] = None


@dataclass 
class IngestionRequest:
    """Request to ingest a document."""
    course_id: UUID
    title: str
    source_uri: str  # S3/local path to PDF
    content_type: str  # slide, pre_read, post_read, etc.
    session_id: Optional[str] = None  # e.g., "Week 1"
    assignment_allowed: bool = True  # Can chunks be used for assignments?


class IngestionService:
    """
    Orchestrates document ingestion into RAG storage.
    
    Responsibilities:
    - Validate course exists
    - Check for duplicate ingestion (idempotency)
    - Parse PDF → chunks → embeddings → storage
    - Handle failures with proper cleanup
    
    Priority 2 Enhancement:
    - Uses ContextualSlideAwareChunker for better context
    - Includes previous slide context in chunks
    """
    
    def __init__(
        self,
        db: AsyncSession,
        embedding_service: Optional[EmbeddingService] = None,
        use_contextual_chunking: bool = True  # Feature flag
    ):
        self.db = db
        self.embedding_service = embedding_service or get_embedding_service()
        self.pdf_parser = PDFParser()
        
        # Use contextual chunker for better context awareness
        if use_contextual_chunking:
            self.chunker = ContextualSlideAwareChunker()
            logger.info("Using ContextualSlideAwareChunker (Priority 2 feature)")
        else:
            from src.services.chunker import SlideAwareChunker
            self.chunker = SlideAwareChunker()
            logger.info("Using basic SlideAwareChunker")
        
        # Repositories
        self.doc_repo = DocumentRepository(Document, db)
        self.chunk_repo = DocumentChunkRepository(DocumentChunk, db)
        self.course_repo = CourseRepository(Course, db)
    
    async def ingest(self, request: IngestionRequest) -> IngestionMetrics:
        """
        Main ingestion entry point.
        
        Returns metrics on success, raises on unrecoverable failure.
        """
        logger.info(f"Starting ingestion: {request.title} ({request.source_uri})")
        
        metrics = IngestionMetrics(
            document_id=uuid.uuid4(),  # Placeholder, updated after creation
            source_uri=request.source_uri,
            slides_extracted=0,
            chunks_created=0,
            embeddings_generated=0,
            total_characters=0,
            success=False
        )
        
        try:
            # 1. Validate course exists
            course = await self.course_repo.get(request.course_id)
            if not course:
                raise ValueError(f"Course not found: {request.course_id}")
            
            # 2. Idempotency check
            existing = await self.doc_repo.get_by_source_uri(request.source_uri)
            if existing:
                logger.warning(f"Document already ingested: {request.source_uri}")
                metrics.document_id = existing.id
                metrics.error = "Document already exists (idempotent skip)"
                metrics.success = True  # Not a failure, just skipped
                return metrics
            
            # 3. Parse PDF
            slides = self._parse_pdf(request.source_uri)
            metrics.slides_extracted = len(slides)
            logger.info(f"Extracted {len(slides)} slides")
            
            # 4. Chunk slides
            chunk_data_list = self.chunker.chunk_slides(
                slides=slides,
                session_id=request.session_id,
                assignment_allowed=request.assignment_allowed
            )
            metrics.total_characters = sum(len(c.text) for c in chunk_data_list)
            logger.info(f"Created {len(chunk_data_list)} chunks ({metrics.total_characters} chars)")
            
            # 5. Create Document in DB
            document = await self.doc_repo.create({
                "course_id": request.course_id,
                "title": request.title,
                "content_type": request.content_type,
                "source_uri": request.source_uri,
                "session_id": request.session_id
            })
            metrics.document_id = document.id
            logger.info(f"Created document: {document.id}")
            
            # 6. Create DocumentChunks in DB
            chunks = await self._create_chunks(document, request.course_id, chunk_data_list)
            metrics.chunks_created = len(chunks)
            
            # 7. Generate embeddings
            texts = [c.text for c in chunk_data_list]
            embeddings = await self.embedding_service.embed_batch(texts)
            metrics.embeddings_generated = len(embeddings)
            logger.info(f"Generated {len(embeddings)} embeddings")
            
            # 8. Store in Qdrant and update chunks with embedding_ids
            if settings.USE_QDRANT:
                await self._store_vectors(chunks, embeddings, request.course_id, request.session_id)
                logger.info("Vectors stored in Qdrant")
            else:
                logger.info("Skipping Qdrant storage (USE_QDRANT=False)")
            
            metrics.success = True
            logger.info(f"Ingestion complete: {metrics}")
            
        except Exception as e:
            logger.error(f"Ingestion failed: {str(e)}")
            metrics.error = str(e)
            metrics.success = False
            # Rollback happens automatically on session close
            raise
        
        return metrics
    
    def _parse_pdf(self, source_uri: str) -> List[SlideContent]:
        """Parse PDF from local path or URI."""
        # For Phase-1, assume local file path
        # TODO: Add S3/blob support in future
        path = Path(source_uri)
        if not path.exists():
            raise FileNotFoundError(f"PDF not found: {source_uri}")
        
        return self.pdf_parser.parse(str(path))
    
    async def _create_chunks(
        self,
        document: Document,
        course_id: UUID,
        chunk_data_list: List[ChunkData]
    ) -> List[DocumentChunk]:
        """Create DocumentChunk records in database."""
        chunks_to_create = [
            {
                "document_id": document.id,
                "course_id": course_id,
                "session_id": cd.session_id,
                "chunk_index": cd.chunk_index,
                "text": cd.text,
                "assignment_allowed": cd.assignment_allowed,
                "slide_number": cd.slide_number,
                "slide_title": cd.slide_title
            }
            for cd in chunk_data_list
        ]
        
        return await self.chunk_repo.bulk_create(chunks_to_create)
    
    async def _store_vectors(
        self,
        chunks: List[DocumentChunk],
        embeddings,
        course_id: UUID,
        session_id: Optional[str]
    ):
        """Store vectors in Qdrant and update chunk embedding_ids."""
        client = qdrant_client.get_client()
        collection = settings.QDRANT_COLLECTION_NAME
        
        points = []
        chunk_id_to_embedding_id = {}
        
        for chunk, emb_result in zip(chunks, embeddings):
            # Use chunk.id as the Qdrant point ID (converted to string for Qdrant)
            point_id = str(chunk.id)
            
            point = qdrant_models.PointStruct(
                id=point_id,
                vector=emb_result.vector,
                payload={
                    "course_id": str(course_id),
                    "document_id": str(chunk.document_id),
                    "chunk_id": str(chunk.id),
                    "session_id": session_id or "",
                    "slide_number": chunk.slide_number,
                    "slide_title": chunk.slide_title or "",
                    "assignment_allowed": chunk.assignment_allowed,
                    "text_preview": chunk.text[:200],  # For debugging
                    "embedding_model": emb_result.model,
                    "embedding_dims": emb_result.dimensions
                }
            )
            points.append(point)
            chunk_id_to_embedding_id[chunk.id] = chunk.id  # Using same ID
        
        # Batch upsert to Qdrant
        client.upsert(
            collection_name=collection,
            points=points
        )
        logger.info(f"Stored {len(points)} vectors in Qdrant")
        
        # Update chunks with embedding_id
        await self.chunk_repo.update_embedding_ids(chunk_id_to_embedding_id)


async def ingest_document(db: AsyncSession, request: IngestionRequest) -> IngestionMetrics:
    """Convenience function for document ingestion."""
    service = IngestionService(db)
    return await service.ingest(request)
