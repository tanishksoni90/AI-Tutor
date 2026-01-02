"""
Retrieval Service - Policy-enforced knowledge retrieval.

CRITICAL SAFETY GUARANTEES:
1. Course isolation - Student can ONLY access enrolled course content
2. Assignment safety - assignment_allowed filter applied BEFORE retrieval
3. All access is logged for audit

Design:
- Enrollment validation happens FIRST (fail fast)
- Qdrant filters enforce course_id at vector DB level
- No post-hoc filtering (policy enforced at query time)
"""
import logging
from dataclasses import dataclass, field
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from qdrant_client.http import models as qdrant_models

from src.core.config import settings
from src.db.models import Enrollment, Student
from src.db.repository.enrollment import EnrollmentRepository
from src.db.repository.student import StudentRepository
from src.db.qdrant import qdrant_client
from src.services.embeddings import EmbeddingService, get_embedding_service

logger = logging.getLogger(__name__)


class AccessDeniedError(Exception):
    """Raised when student doesn't have access to requested course."""
    pass


@dataclass
class RetrievedChunk:
    """A single retrieved chunk with metadata."""
    chunk_id: str
    document_id: str
    text_preview: str
    score: float
    slide_number: Optional[int]
    slide_title: Optional[str]
    session_id: Optional[str]


@dataclass
class RetrievalResult:
    """Result of a retrieval query."""
    query: str
    course_id: UUID
    student_id: UUID
    chunks: List[RetrievedChunk]
    total_found: int
    assignment_mode: bool  # True = exclude assignment content
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    def to_log_dict(self) -> dict:
        """Convert to dict for logging/audit."""
        return {
            "query": self.query[:100],  # Truncate for logs
            "course_id": str(self.course_id),
            "student_id": str(self.student_id),
            "chunks_retrieved": len(self.chunks),
            "chunk_ids": [c.chunk_id for c in self.chunks],
            "assignment_mode": self.assignment_mode,
            "timestamp": self.timestamp.isoformat()
        }


@dataclass
class RetrievalRequest:
    """Request for knowledge retrieval."""
    student_id: UUID
    course_id: UUID
    query: str
    top_k: int = 5
    exclude_assignments: bool = True  # Default: safe mode
    session_filter: Optional[str] = None  # Optional: filter by session


class RetrievalService:
    """
    Policy-enforced retrieval from vector store.
    
    Safety flow:
    1. Validate student enrollment (FAIL if not enrolled)
    2. Build Qdrant filter with course_id + assignment_allowed
    3. Embed query
    4. Search Qdrant
    5. Log retrieval for audit
    """
    
    def __init__(
        self,
        db: AsyncSession,
        embedding_service: Optional[EmbeddingService] = None
    ):
        self.db = db
        self.embedding_service = embedding_service or get_embedding_service()
        self.enrollment_repo = EnrollmentRepository(Enrollment, db)
        self.student_repo = StudentRepository(Student, db)
    
    async def retrieve(self, request: RetrievalRequest) -> RetrievalResult:
        """
        Main retrieval entry point with policy enforcement.
        
        Raises:
            AccessDeniedError: If student not enrolled in course
            ValueError: If query is empty
        """
        # Validate input
        if not request.query or not request.query.strip():
            raise ValueError("Query cannot be empty")
        
        # 1. POLICY CHECK: Validate enrollment FIRST
        is_enrolled = await self.enrollment_repo.is_enrolled(
            request.student_id, 
            request.course_id
        )
        
        if not is_enrolled:
            logger.warning(
                f"ACCESS DENIED: Student {request.student_id} "
                f"attempted to access course {request.course_id}"
            )
            raise AccessDeniedError(
                f"Student {request.student_id} is not enrolled in course {request.course_id}"
            )
        
        # 2. Embed the query
        query_embedding = await self.embedding_service.embed_text(request.query)
        
        # 3. Build Qdrant filter (POLICY ENFORCEMENT AT DB LEVEL)
        qdrant_filter = self._build_filter(
            course_id=request.course_id,
            exclude_assignments=request.exclude_assignments,
            session_filter=request.session_filter
        )
        
        # 4. Search Qdrant
        client = qdrant_client.get_client()
        search_result = client.search(
            collection_name=settings.QDRANT_COLLECTION_NAME,
            query_vector=query_embedding.vector,
            query_filter=qdrant_filter,
            limit=request.top_k,
            with_payload=True
        )
        
        # 5. Transform results
        chunks = [
            RetrievedChunk(
                chunk_id=hit.payload.get("chunk_id", str(hit.id)),
                document_id=hit.payload.get("document_id", ""),
                text_preview=hit.payload.get("text_preview", ""),
                score=hit.score,
                slide_number=hit.payload.get("slide_number"),
                slide_title=hit.payload.get("slide_title"),
                session_id=hit.payload.get("session_id")
            )
            for hit in search_result
        ]
        
        result = RetrievalResult(
            query=request.query,
            course_id=request.course_id,
            student_id=request.student_id,
            chunks=chunks,
            total_found=len(chunks),
            assignment_mode=request.exclude_assignments
        )
        
        # 6. Log for audit
        self._log_retrieval(result)
        
        return result
    
    def _build_filter(
        self,
        course_id: UUID,
        exclude_assignments: bool,
        session_filter: Optional[str]
    ) -> qdrant_models.Filter:
        """
        Build Qdrant filter for policy-enforced retrieval.
        
        CRITICAL: course_id filter ensures tenant isolation.
        """
        must_conditions = [
            qdrant_models.FieldCondition(
                key="course_id",
                match=qdrant_models.MatchValue(value=str(course_id))
            )
        ]
        
        # Assignment safety filter
        if exclude_assignments:
            must_conditions.append(
                qdrant_models.FieldCondition(
                    key="assignment_allowed",
                    match=qdrant_models.MatchValue(value=True)
                )
            )
        
        # Optional session filter
        if session_filter:
            must_conditions.append(
                qdrant_models.FieldCondition(
                    key="session_id",
                    match=qdrant_models.MatchValue(value=session_filter)
                )
            )
        
        return qdrant_models.Filter(must=must_conditions)
    
    def _log_retrieval(self, result: RetrievalResult):
        """Log retrieval for audit and debugging."""
        log_data = result.to_log_dict()
        logger.info(f"RETRIEVAL: {log_data}")
    
    async def get_chunk_text(self, chunk_ids: List[str]) -> dict[str, str]:
        """
        Fetch full text for retrieved chunks from Qdrant.
        
        Used by generation phase to get complete chunk content.
        """
        client = qdrant_client.get_client()
        
        # Fetch points by ID
        points = client.retrieve(
            collection_name=settings.QDRANT_COLLECTION_NAME,
            ids=chunk_ids,
            with_payload=True
        )
        
        # Note: Full text is in PostgreSQL, not Qdrant
        # This returns preview only - full text fetch needs DB query
        return {
            str(p.id): p.payload.get("text_preview", "")
            for p in points
        }


async def retrieve_knowledge(
    db: AsyncSession, 
    request: RetrievalRequest
) -> RetrievalResult:
    """Convenience function for knowledge retrieval."""
    service = RetrievalService(db)
    return await service.retrieve(request)
