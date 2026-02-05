"""Check what's in the database."""
import asyncio
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from src.db.session import AsyncSessionLocal
from sqlalchemy import select, func
from src.db.models import Document, DocumentChunk, Course, Org

async def check_db():
    async with AsyncSessionLocal() as session:
        # Check orgs
        orgs = (await session.execute(select(Org))).scalars().all()
        print(f'Orgs: {len(orgs)}')
        for o in orgs:
            print(f'  - {o.name} (id: {o.id})')
        
        # Check courses  
        courses = (await session.execute(select(Course))).scalars().all()
        print(f'\nCourses: {len(courses)}')
        for c in courses:
            print(f'  - {c.name} (org_id: {c.org_id})')
        
        # Check documents
        docs = (await session.execute(select(Document))).scalars().all()
        print(f'\nDocuments: {len(docs)}')
        for d in docs[:5]:  # Show first 5
            print(f'  - {d.title}')
        if len(docs) > 5:
            print(f'  ... and {len(docs) - 5} more')
        
        # Check chunks
        chunks_count = (await session.execute(select(func.count(DocumentChunk.id)))).scalar()
        print(f'\nDocumentChunks: {chunks_count}')

if __name__ == '__main__':
    asyncio.run(check_db())
