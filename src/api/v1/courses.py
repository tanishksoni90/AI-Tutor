"""
Courses API Endpoints

Endpoints for retrieving course information for authenticated users.
"""
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from src.db.session import get_db
from src.db.models import Course, Enrollment, Document, DocumentChunk
from src.api.deps import CurrentUser
from src.db.repository.enrollment import EnrollmentRepository

router = APIRouter(prefix="/courses", tags=["courses"])


# Response Models
class CourseSessionResponse(BaseModel):
    """Session info within a course."""
    session_id: str
    title: str
    document_count: int


class CourseResponse(BaseModel):
    """Course information response."""
    id: UUID
    name: str
    org_id: UUID
    course_type: str
    total_sessions: int
    total_chunks: int


class EnrolledCourseResponse(CourseResponse):
    """Enrolled course with additional info."""
    progress: Optional[int] = None
    last_activity: Optional[str] = None
    sessions: List[CourseSessionResponse] = []


@router.get("/enrolled", response_model=List[EnrolledCourseResponse])
async def get_enrolled_courses(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all courses the current user is enrolled in.
    
    Returns course details with session information.
    """
    enrollment_repo = EnrollmentRepository(Enrollment, db)
    courses = await enrollment_repo.get_student_courses(current_user.id)
    
    # Batch query for all sessions across all enrolled courses (avoid N+1)
    course_ids = [course.id for course in courses]
    sessions_by_course: dict = {}
    
    if course_ids:
        session_query = (
            select(
                Document.course_id,
                Document.session_id,
                func.count(Document.id).label('doc_count')
            )
            .where(Document.course_id.in_(course_ids))
            .where(Document.session_id.isnot(None))
            .group_by(Document.course_id, Document.session_id)
        )
        session_result = await db.execute(session_query)
        sessions_data = session_result.all()
        
        # Group sessions by course_id
        for row in sessions_data:
            if row.course_id not in sessions_by_course:
                sessions_by_course[row.course_id] = []
            sessions_by_course[row.course_id].append(
                CourseSessionResponse(
                    session_id=row.session_id or "Unknown",
                    title=row.session_id or "Unknown Session",
                    document_count=row.doc_count
                )
            )
    
    result = []
    for course in courses:
        sessions = sessions_by_course.get(course.id, [])
        
        result.append(EnrolledCourseResponse(
            id=course.id,
            name=course.name,
            org_id=course.org_id,
            course_type=course.course_type,
            total_sessions=course.total_sessions,
            total_chunks=course.total_chunks,
            progress=None,  # Can be implemented later
            last_activity=None,  # Can be implemented later
            sessions=sessions
        ))
    
    return result


@router.get("/{course_id}", response_model=EnrolledCourseResponse)
async def get_course(
    course_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific course by ID.
    
    Validates that user is enrolled in the course.
    """
    # Get course first to avoid leaking existence info
    course_query = select(Course).where(Course.id == course_id)
    course_result = await db.execute(course_query)
    course = course_result.scalars().first()
    
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found"
        )
    
    # Check enrollment only if course exists
    enrollment_repo = EnrollmentRepository(Enrollment, db)
    is_enrolled = await enrollment_repo.is_enrolled(current_user.id, course_id)
    if not is_enrolled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not enrolled in this course"
        )
    
    # Get sessions
    session_query = (
        select(
            Document.session_id,
            func.count(Document.id).label('doc_count')
        )
        .where(Document.course_id == course_id)
        .where(Document.session_id.isnot(None))
        .group_by(Document.session_id)
    )
    session_result = await db.execute(session_query)
    sessions_data = session_result.all()
    
    sessions = [
        CourseSessionResponse(
            session_id=s.session_id or "Unknown",
            title=s.session_id or "Unknown Session",
            document_count=s.doc_count
        )
        for s in sessions_data
    ]
    
    return EnrolledCourseResponse(
        id=course.id,
        name=course.name,
        org_id=course.org_id,
        course_type=course.course_type,
        total_sessions=course.total_sessions,
        total_chunks=course.total_chunks,
        progress=None,
        last_activity=None,
        sessions=sessions
    )
