"""
Batch ingest all PDFs from a course folder.

Usage:
    USE_LOCAL_EMBEDDINGS=true USE_SQLITE=true USE_QDRANT=false \
        poetry run python scripts/batch_ingest_course.py

Features:
- Auto-detects Pre-read, Post-read, Session Deck from filenames
- Creates course with proper metadata
- Processes all PDFs sequentially
- Progress tracking and error handling
"""
import asyncio
import sys
import os
import re
from pathlib import Path
from typing import List, Dict, Any
import uuid

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from src.db.session import AsyncSessionLocal, engine
from src.db.models import Course, Org
from src.db.repository.course import CourseRepository
from src.db.repository.org import OrgRepository
from src.services.ingestion import IngestionService, IngestionRequest


# Course metadata
COURSE_NAME = "NextGen - AI Masterclass (Bengali #901)"
COURSE_TYPE = "certification"  # Large course with 20+ sessions
# Use environment variable with fallback to project-relative path
DATA_FOLDER = os.environ.get('DATA_FOLDER', os.path.join(os.path.dirname(__file__), '..', 'data'))


def parse_filename(filename: str) -> Dict[str, Any]:
    """
    Parse PDF filename to extract metadata.
    
    Examples:
    - 4411138-AI_Types_Ecosystem__and_Implementation_Strategy_-_Session_Deck.pdf
    - 4411134-AI_Types_Ecosystem_and_Implementation_Strategy_-_Pre_Read.pdf
    - 4411150-AI_Types_Ecosystem_and_Implementation_Strategy_-_Post_Read.pdf
    """
    name = filename.replace('.pdf', '')
    
    # Extract file ID (first part before dash)
    parts = name.split('-', 1)
    file_id = parts[0] if len(parts) > 1 else "unknown"
    
    # Determine content type
    name_lower = name.lower()
    if 'pre_read' in name_lower or 'pre-read' in name_lower:
        content_type = 'pre_read'
    elif 'post_read' in name_lower or 'post-read' in name_lower or 'cheat_sheet' in name_lower:
        content_type = 'post_read'
    elif 'session_deck' in name_lower or 'session-deck' in name_lower:
        content_type = 'slide'
    else:
        content_type = 'slide'  # Default to slide
    
    # Clean title - remove file ID, content type markers
    title = parts[1] if len(parts) > 1 else name
    title = re.sub(r'_(Session_Deck|Pre_Read|Post_Read|Post-Read|Pre-Read|Cheat_sheet)', '', title, flags=re.IGNORECASE)
    title = title.replace('_', ' ').strip(' -')
    
    # Extract session number from filename if possible
    session_match = re.search(r'(\d+)', file_id)
    session_id = f"session_{session_match.group(1)}" if session_match else file_id
    
    return {
        'filename': filename,
        'file_id': file_id,
        'title': title,
        'content_type': content_type,
        'session_id': session_id,
        'assignment_allowed': content_type == 'slide'  # Only slides for assignments
    }


async def get_or_create_course(session) -> uuid.UUID:
    """Get existing course or create new one."""
    org_repo = OrgRepository(Org, session)
    course_repo = CourseRepository(Course, session)
    
    # Use test org
    test_org_id = uuid.UUID('00000000-0000-0000-0000-000000000001')
    org = await org_repo.get(test_org_id)
    
    if not org:
        print("ERROR: Test org not found. Run setup_test_db.py first")
        sys.exit(1)
    
    # Check if course exists
    courses = await course_repo.get_by_org(test_org_id)
    for course in courses:
        if course.name == COURSE_NAME:
            print(f"Using existing course: {course.name} (ID: {course.id})")
            return course.id
    
    # Create new course
    course = Course(
        id=uuid.uuid4(),
        org_id=test_org_id,
        name=COURSE_NAME,
        course_type=COURSE_TYPE,
        total_sessions=0,
        total_chunks=0
    )
    session.add(course)
    await session.commit()
    await session.refresh(course)
    
    print(f"Created course: {course.name} (ID: {course.id})")
    return course.id


async def ingest_pdf(
    pdf_path: str,
    course_id: uuid.UUID,
    metadata: Dict[str, str],
    session
) -> Dict:
    """Ingest a single PDF."""
    service = IngestionService(session)
    
    request = IngestionRequest(
        course_id=course_id,
        title=metadata['title'],
        source_uri=pdf_path,
        content_type=metadata['content_type'],
        session_id=metadata['session_id'],
        assignment_allowed=metadata['assignment_allowed']
    )
    
    try:
        metrics = await service.ingest(request)
        return {
            'filename': metadata['filename'],
            'success': metrics.success,
            'slides': metrics.slides_extracted,
            'chunks': metrics.chunks_created,
            'embeddings': metrics.embeddings_generated,
            'error': metrics.error
        }
    except Exception as e:
        return {
            'filename': metadata['filename'],
            'success': False,
            'error': str(e)
        }


async def main():
    print("=" * 80)
    print(f"BATCH COURSE INGESTION: {COURSE_NAME}")
    print("=" * 80)
    
    # 1. Scan data folder
    data_path = Path(DATA_FOLDER)
    if not data_path.exists():
        print(f"ERROR: Data folder not found: {DATA_FOLDER}")
        return
    
    pdf_files = sorted(data_path.glob("*.pdf"))
    print(f"\nFound {len(pdf_files)} PDF files")
    
    # 2. Parse filenames
    pdf_metadata = []
    for pdf_file in pdf_files:
        metadata = parse_filename(pdf_file.name)
        metadata['path'] = str(pdf_file)
        pdf_metadata.append(metadata)
    
    # Show summary
    print(f"\nContent breakdown:")
    content_types = {}
    for meta in pdf_metadata:
        ct = meta['content_type']
        content_types[ct] = content_types.get(ct, 0) + 1
    for ct, count in content_types.items():
        print(f"  {ct}: {count} files")
    
    # 3. Get or create course
    async with AsyncSessionLocal() as session:
        course_id = await get_or_create_course(session)
    
    # 4. Process PDFs
    print(f"\n{'='*80}")
    print("PROCESSING PDFs (this will take a while...)")
    print("="*80)
    
    results = []
    total = len(pdf_metadata)
    
    for i, metadata in enumerate(pdf_metadata, 1):
        print(f"\n[{i}/{total}] {metadata['filename']}")
        print(f"  Type: {metadata['content_type']}, Session: {metadata['session_id']}")
        
        async with AsyncSessionLocal() as session:
            result = await ingest_pdf(
                metadata['path'],
                course_id,
                metadata,
                session
            )
            results.append(result)
        
        if result['success']:
            print(f"  ✅ {result['slides']} slides → {result['chunks']} chunks → {result['embeddings']} embeddings")
        else:
            error_text = (result.get('error') or 'Unknown error')[:100]
            print(f"  ❌ ERROR: {error_text}")
    
    # 5. Summary
    print(f"\n{'='*80}")
    print("SUMMARY")
    print("="*80)
    
    successful = [r for r in results if r['success']]
    failed = [r for r in results if not r['success']]
    
    total_slides = sum(r.get('slides', 0) for r in successful)
    total_chunks = sum(r.get('chunks', 0) for r in successful)
    total_embeddings = sum(r.get('embeddings', 0) for r in successful)
    
    print(f"\n✅ Success: {len(successful)}/{total} files")
    print(f"❌ Failed: {len(failed)} files")
    print(f"\n📊 Total:")
    print(f"  Slides extracted: {total_slides}")
    print(f"  Chunks created: {total_chunks}")
    print(f"  Embeddings generated: {total_embeddings}")
    
    if failed:
        print(f"\n❌ Failed files:")
        for r in failed:
            error_preview = (r.get('error') or 'Unknown error')[:80]
            print(f"  - {r['filename']}: {error_preview}")
    
    print(f"\n{'='*80}")
    print(f"Course ID: {course_id}")
    print(f"Ready for querying with Gemini 2.0 Flash!")
    print("="*80)
    
    # Cleanup
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
