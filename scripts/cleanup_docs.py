"""Cleanup documents and chunks from database."""
import asyncio
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from src.db.session import AsyncSessionLocal
from src.db.models import Document, DocumentChunk
from sqlalchemy import select, delete, func

async def cleanup():
    async with AsyncSessionLocal() as session:
        # Count before
        result = await session.execute(select(func.count(Document.id)))
        doc_count = result.scalar()
        print(f'Documents before: {doc_count}')
        
        result = await session.execute(select(func.count(DocumentChunk.id)))
        chunk_count = result.scalar()
        print(f'Chunks before: {chunk_count}')
        
        # Delete chunks first (FK constraint)
        await session.execute(delete(DocumentChunk))
        await session.execute(delete(Document))
        await session.commit()
        
        print('\n✅ Cleaned up Documents and Chunks')
        
        # Verify
        result = await session.execute(select(func.count(Document.id)))
        doc_count = result.scalar()
        print(f'Documents after: {doc_count}')

if __name__ == "__main__":
    asyncio.run(cleanup())
