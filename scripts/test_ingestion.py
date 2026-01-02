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

from src.db.session import AsyncSessionLocal
from src.db.models import Org, Course
from src.db.repository.org import OrgRepository
from src.db.repository.course import CourseRepository
from src.services.ingestion import IngestionService, IngestionRequest


async def main(pdf_path: str):
    print(f"Testing ingestion pipeline with: {pdf_path}")
    
    if not os.path.exists(pdf_path):
        print(f"ERROR: File not found: {pdf_path}")
        return
    
    async with AsyncSessionLocal() as session:
        # Setup: Create test org and course
        org_repo = OrgRepository(Org, session)
        course_repo = CourseRepository(Course, session)
        
        print("\n1. Creating test org...")
        org = await org_repo.create({"name": "Test University"})
        print(f"   Created org: {org.id}")
        
        print("\n2. Creating test course...")
        course = await course_repo.create({
            "name": "CS101: Introduction to AI",
            "org_id": org.id
        })
        print(f"   Created course: {course.id}")
        
        print("\n3. Running ingestion...")
        service = IngestionService(session)
        
        request = IngestionRequest(
            course_id=course.id,
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
        
        print("\n4. Testing idempotency (re-ingesting same file)...")
        try:
            metrics2 = await service.ingest(request)
            print(f"   Idempotency check: {metrics2.error}")
        except Exception as e:
            print(f"   ERROR: {str(e)}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: poetry run python scripts/test_ingestion.py <path_to_pdf>")
        print("Example: poetry run python scripts/test_ingestion.py ./test_slides.pdf")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    asyncio.run(main(pdf_path))
