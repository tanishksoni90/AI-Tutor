"""Document and DocumentChunk repositories."""
from typing import List, Optional
from uuid import UUID
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload

from src.db.repository.base import BaseRepository
from src.db.models import Document, DocumentChunk


class DocumentRepository(BaseRepository[Document]):
    """Repository for Document operations."""
    
    async def get_by_course(self, course_id: UUID) -> List[Document]:
        """Get all documents for a course."""
        query = select(self.model).where(self.model.course_id == course_id)
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def get_by_source_uri(self, source_uri: str) -> Optional[Document]:
        """Get document by source URI (for idempotency check)."""
        query = select(self.model).where(self.model.source_uri == source_uri)
        result = await self.db.execute(query)
        return result.scalars().first()
    
    async def get_with_chunks(self, document_id: UUID) -> Optional[Document]:
        """Get document with its chunks loaded."""
        query = (
            select(self.model)
            .where(self.model.id == document_id)
            .options(selectinload(self.model.chunks))
        )
        result = await self.db.execute(query)
        return result.scalars().first()
    
    async def delete_with_chunks(self, document_id: UUID) -> bool:
        """Delete document and all its chunks (cascade)."""
        doc = await self.get(document_id)
        if doc:
            await self.db.delete(doc)
            await self.db.commit()
            return True
        return False


class DocumentChunkRepository(BaseRepository[DocumentChunk]):
    """Repository for DocumentChunk operations."""
    
    async def get_by_document(self, document_id: UUID) -> List[DocumentChunk]:
        """Get all chunks for a document, ordered by chunk_index."""
        query = (
            select(self.model)
            .where(self.model.document_id == document_id)
            .order_by(self.model.chunk_index)
        )
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def get_by_course(self, course_id: UUID) -> List[DocumentChunk]:
        """Get all chunks for a course."""
        query = select(self.model).where(self.model.course_id == course_id)
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def get_by_ids(self, chunk_ids: List[UUID]) -> List[DocumentChunk]:
        """Get multiple chunks by their IDs."""
        if not chunk_ids:
            return []
        query = select(self.model).where(self.model.id.in_(chunk_ids))
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def get_full_text_by_ids(self, chunk_ids: List[UUID]) -> dict[UUID, str]:
        """Get full text content for multiple chunks."""
        chunks = await self.get_by_ids(chunk_ids)
        return {chunk.id: chunk.text for chunk in chunks}
    
    async def bulk_create(self, chunks_data: List[dict]) -> List[DocumentChunk]:
        """Create multiple chunks in a single transaction."""
        chunks = [self.model(**data) for data in chunks_data]
        self.db.add_all(chunks)
        await self.db.commit()
        for chunk in chunks:
            await self.db.refresh(chunk)
        return chunks
    
    async def update_embedding_ids(self, chunk_id_to_embedding_id: dict[UUID, UUID]) -> int:
        """Update embedding_id for multiple chunks."""
        updated = 0
        for chunk_id, embedding_id in chunk_id_to_embedding_id.items():
            chunk = await self.get(chunk_id)
            if chunk:
                chunk.embedding_id = embedding_id
                self.db.add(chunk)
                updated += 1
        await self.db.commit()
        return updated
    
    async def delete_by_document(self, document_id: UUID) -> int:
        """Delete all chunks for a document."""
        query = delete(self.model).where(self.model.document_id == document_id)
        result = await self.db.execute(query)
        await self.db.commit()
        return result.rowcount
