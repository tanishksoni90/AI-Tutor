"""
Courses API Endpoints

Endpoints for retrieving course information for authenticated users.
"""
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timedelta
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from src.db.session import get_db
from src.db.models import Course, Enrollment, Document, DocumentChunk, QueryAnalytics
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
    
    result = []
    for course in courses:
        # Get sessions (unique session_ids from documents)
        session_query = (
            select(
                Document.session_id,
                func.count(Document.id).label('doc_count')
            )
            .where(Document.course_id == course.id)
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
    enrollment_repo = EnrollmentRepository(Enrollment, db)
    
    # Check enrollment
    is_enrolled = await enrollment_repo.is_enrolled(current_user.id, course_id)
    if not is_enrolled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not enrolled in this course"
        )
    
    # Get course
    course_query = select(Course).where(Course.id == course_id)
    course_result = await db.execute(course_query)
    course = course_result.scalars().first()
    
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found"
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


# Response model for student stats
class StudentStatsResponse(BaseModel):
    """Student learning statistics from backend analytics."""
    questions_asked: int
    unique_sessions: int
    study_streak_days: int
    active_days: List[str] = []


@router.get("/stats/me", response_model=StudentStatsResponse)
async def get_my_stats(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db)
):
    """
    Get statistics for the current student.
    
    Returns real data from QueryAnalytics table.
    """
    # Total questions asked
    questions_query = (
        select(func.count(QueryAnalytics.id))
        .where(QueryAnalytics.student_id == current_user.id)
    )
    questions_asked = (await db.execute(questions_query)).scalar() or 0
    
    # Unique session tokens
    sessions_query = (
        select(func.count(func.distinct(QueryAnalytics.session_token)))
        .where(QueryAnalytics.student_id == current_user.id)
        .where(QueryAnalytics.session_token.isnot(None))
    )
    unique_sessions = (await db.execute(sessions_query)).scalar() or 0
    
    # Get active days (days with at least one query)
    active_days_query = (
        select(func.date(QueryAnalytics.created_at))
        .where(QueryAnalytics.student_id == current_user.id)
        .group_by(func.date(QueryAnalytics.created_at))
        .order_by(func.date(QueryAnalytics.created_at).desc())
        .limit(30)  # Last 30 active days
    )
    active_days_result = await db.execute(active_days_query)
    active_days = [str(d[0]) for d in active_days_result.all()]
    
    # Calculate study streak
    study_streak = 0
    if active_days:
        today = datetime.utcnow().date()
        consecutive_days = 0
        check_date = today
        
        for day_str in active_days:
            day = datetime.strptime(day_str, "%Y-%m-%d").date()
            if day == check_date:
                consecutive_days += 1
                check_date = check_date - timedelta(days=1)
            elif day < check_date:
                # Gap in activity, streak broken
                break
        
        study_streak = consecutive_days
    
    return StudentStatsResponse(
        questions_asked=questions_asked,
        unique_sessions=unique_sessions,
        study_streak_days=study_streak,
        active_days=active_days[:7]  # Return last 7 active days
    )
