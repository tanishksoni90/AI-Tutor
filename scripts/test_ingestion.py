"""
Test script for the ingestion pipeline.

Usage:
    poetry run python scripts/test_ingestion.py <path_to_pdf>

Example:
    poetry run python scripts/test_ingestion.py ./test_slides.pdf
"""
import asyncio
import sys
import os
import uuid

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from src.db.session import AsyncSessionLocal, engine
from src.db.models import Org, Course
from src.db.repository.org import OrgRepository
from src.db.repository.course import CourseRepository
from src.services.ingestion import IngestionService, IngestionRequest


async def main(pdf_path: str):
    print(f"Testing ingestion pipeline with: {pdf_path}")
    
    if not os.path.exists(pdf_path):
        print(f"ERROR: File not found: {pdf_path}")
        return
    
    # Use pre-created test org and course (created via SQL script)
    test_org_id = uuid.UUID('00000000-0000-0000-0000-000000000001')
    test_course_id = uuid.UUID('00000000-0000-0000-0000-000000000002')
    
    print(f"\nUsing pre-created test data:")
    print(f"  Org ID: {test_org_id}")
    print(f"  Course ID: {test_course_id}")
    
    async with AsyncSessionLocal() as session:
        print("\n1. Running ingestion...")
        service = IngestionService(session)
        
        request = IngestionRequest(
            course_id=test_course_id,
            title="Week 1 Slides",
            source_uri=pdf_path,
            content_type="slide",
            session_id="week_1",
            assignment_allowed=True
        )
        
        try:
            metrics = await service.ingest(request)
            
            print("\n=== INGESTION METRICS ===")
            print(f"   Document ID: {metrics.document_id}")
            print(f"   Slides extracted: {metrics.slides_extracted}")
            print(f"   Chunks created: {metrics.chunks_created}")
            print(f"   Embeddings generated: {metrics.embeddings_generated}")
            print(f"   Total characters: {metrics.total_characters}")
            print(f"   Success: {metrics.success}")
            if metrics.error:
                print(f"   Error: {metrics.error}")
                
        except Exception as e:
            print(f"\n   ERROR: {str(e)}")
            import traceback
            traceback.print_exc()
        
        print("\n2. Testing idempotency (re-ingesting same file)...")
        try:
            metrics2 = await service.ingest(request)
            print(f"   Idempotency check: {metrics2.error}")
        except Exception as e:
            print(f"   ERROR: {str(e)}")
    
    # Cleanup database connections
    await engine.dispose()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: poetry run python scripts/test_ingestion.py <path_to_pdf>")
        print("Example: poetry run python scripts/test_ingestion.py ./test_slides.pdf")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    asyncio.run(main(pdf_path))
