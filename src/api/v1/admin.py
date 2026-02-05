"""
Admin API Endpoints

Comprehensive admin endpoints for managing users, courses, documents, and viewing analytics.
All endpoints require admin authentication.
"""
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timedelta
from pydantic import BaseModel, EmailStr, Field

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, delete

from src.db.session import get_db
from src.db.models import (
    Student, StudentRole, Course, CourseType, Document, 
    DocumentChunk, Enrollment, Org, QueryAnalytics, InvitationStatus
)
from src.api.deps import AdminUser
from src.services.auth import get_password_hash

router = APIRouter(prefix="/admin", tags=["admin"])


# ==================== Response Models ====================

class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: Optional[str]
    org_id: UUID
    role: str
    is_active: bool
    created_at: datetime
    courses_count: int = 0
    invitation_status: Optional[str] = None


class UserCreateRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = None
    org_id: UUID
    role: str = Field(default="student", pattern="^(student|admin)$")


class CourseAdminResponse(BaseModel):
    id: UUID
    name: str
    org_id: UUID
    course_type: str
    total_sessions: int
    total_chunks: int
    documents_count: int
    enrollments_count: int
    created_at: datetime


class CourseCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    org_id: UUID
    course_type: str = Field(default="standard", pattern="^(micro|standard|certification)$")


class DocumentResponse(BaseModel):
    id: UUID
    course_id: UUID
    course_name: str
    title: str
    session_id: Optional[str]
    content_type: str
    source_uri: str
    chunks_count: int
    created_at: datetime


class DocumentChunkResponse(BaseModel):
    id: UUID
    document_id: UUID
    course_id: UUID
    session_id: Optional[str]
    chunk_index: int
    text: str
    assignment_allowed: bool
    slide_number: Optional[int]
    slide_title: Optional[str]
    embedding_id: Optional[UUID]
    created_at: datetime


class AnalyticsSummary(BaseModel):
    total_queries: int
    queries_today: int
    avg_confidence: float
    hallucinations_detected: int
    assignments_blocked: int
    avg_response_time_ms: float
    popular_topics: List[dict]
    daily_usage: List[dict]
    active_users: int = 0  # Unique users in the time period


class DashboardStats(BaseModel):
    total_users: int
    total_admins: int
    total_students: int
    total_courses: int
    total_documents: int
    total_chunks: int
    total_queries: int
    queries_today: int
    active_users_today: int


# ==================== Dashboard Stats ====================

@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    admin: AdminUser,
    db: AsyncSession = Depends(get_db)
):
    """Get overall dashboard statistics."""
    today = datetime.utcnow().date()
    
    # Users counts
    users_query = select(func.count(Student.id)).where(Student.org_id == admin.org_id)
    total_users = (await db.execute(users_query)).scalar() or 0
    
    admins_query = select(func.count(Student.id)).where(
        Student.org_id == admin.org_id,
        Student.role == StudentRole.ADMIN.value
    )
    total_admins = (await db.execute(admins_query)).scalar() or 0
    
    # Courses count
    courses_query = select(func.count(Course.id)).where(Course.org_id == admin.org_id)
    total_courses = (await db.execute(courses_query)).scalar() or 0
    
    # Documents count
    docs_query = (
        select(func.count(Document.id))
        .join(Course)
        .where(Course.org_id == admin.org_id)
    )
    total_documents = (await db.execute(docs_query)).scalar() or 0
    
    # Chunks count
    chunks_query = (
        select(func.count(DocumentChunk.id))
        .join(Course)
        .where(Course.org_id == admin.org_id)
    )
    total_chunks = (await db.execute(chunks_query)).scalar() or 0
    
    # Query analytics
    queries_query = (
        select(func.count(QueryAnalytics.id))
        .join(Course)
        .where(Course.org_id == admin.org_id)
    )
    total_queries = (await db.execute(queries_query)).scalar() or 0
    
    queries_today_query = (
        select(func.count(QueryAnalytics.id))
        .join(Course)
        .where(
            Course.org_id == admin.org_id,
            func.date(QueryAnalytics.created_at) == today
        )
    )
    queries_today = (await db.execute(queries_today_query)).scalar() or 0
    
    # Active users today (unique students with queries today)
    active_today_query = (
        select(func.count(func.distinct(QueryAnalytics.student_id)))
        .join(Course)
        .where(
            Course.org_id == admin.org_id,
            func.date(QueryAnalytics.created_at) == today,
            QueryAnalytics.student_id.isnot(None)
        )
    )
    active_users_today = (await db.execute(active_today_query)).scalar() or 0
    
    # Explicit student count query
    students_query = select(func.count(Student.id)).where(
        Student.org_id == admin.org_id,
        Student.role == StudentRole.STUDENT.value
    )
    total_students = (await db.execute(students_query)).scalar() or 0
    
    return DashboardStats(
        total_users=total_users,
        total_admins=total_admins,
        total_students=total_students,
        total_courses=total_courses,
        total_documents=total_documents,
        total_chunks=total_chunks,
        total_queries=total_queries,
        queries_today=queries_today,
        active_users_today=active_users_today
    )


# ==================== User Management ====================

@router.get("/users", response_model=List[UserResponse])
async def list_users(
    admin: AdminUser,
    db: AsyncSession = Depends(get_db),
    search: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0)
):
    """List all users in the organization."""
    query = (
        select(
            Student,
            func.count(Enrollment.id).label('courses_count')
        )
        .outerjoin(Enrollment)
        .where(Student.org_id == admin.org_id)
        .group_by(Student.id)
        .order_by(desc(Student.created_at))
        .limit(limit)
        .offset(offset)
    )
    
    if search:
        query = query.where(
            (Student.email.ilike(f"%{search}%")) |
            (Student.full_name.ilike(f"%{search}%"))
        )
    
    if role:
        query = query.where(Student.role == role)
    
    result = await db.execute(query)
    users_data = result.all()
    
    return [
        UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            org_id=user.org_id,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at,
            courses_count=courses_count,
            invitation_status=user.invitation_status
        )
        for user, courses_count in users_data
    ]


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    request: UserCreateRequest,
    admin: AdminUser,
    db: AsyncSession = Depends(get_db)
):
    """Create a new user."""
    # Check if email already exists
    existing = await db.execute(
        select(Student).where(Student.email == request.email)
    )
    if existing.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create user - always use admin's org_id to prevent privilege escalation
    user = Student(
        email=request.email,
        full_name=request.full_name,
        hashed_password=get_password_hash(request.password),
        org_id=admin.org_id,
        role=request.role,
        is_active=True
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        org_id=user.org_id,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        courses_count=0
    )


# ==================== Bulk Import ====================

class BulkImportRow(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    course_name: str


class BulkImportRequest(BaseModel):
    students: List[BulkImportRow]


class ImportedStudent(BaseModel):
    email: str
    full_name: Optional[str]
    course_name: str
    status: str  # "created", "existing", "enrolled", "error"
    message: Optional[str] = None


class BulkImportResponse(BaseModel):
    total: int
    created: int
    existing: int
    errors: int
    students: List[ImportedStudent]


@router.post("/users/bulk-import", response_model=BulkImportResponse)
async def bulk_import_students(
    request: BulkImportRequest,
    admin: AdminUser,
    db: AsyncSession = Depends(get_db)
):
    """
    Bulk import students from CSV data.
    
    - Creates accounts for new students in PENDING status
    - Generates unique invitation tokens (for later sending invites)
    - Enrolls students in specified courses
    - Skips existing emails (but enrolls them if not already enrolled)
    """
    import secrets
    
    def generate_token():
        """Generate a secure random token."""
        return secrets.token_urlsafe(32)
    
    # Get all courses for lookup
    courses_result = await db.execute(
        select(Course).where(Course.org_id == admin.org_id)
    )
    courses = {c.name.lower(): c for c in courses_result.scalars().all()}
    
    results = []
    created_count = 0
    existing_count = 0
    error_count = 0
    
    for row in request.students:
        # Find course (if provided)
        course = None
        if row.course_name and row.course_name.strip():
            course = courses.get(row.course_name.lower())
            if not course:
                results.append(ImportedStudent(
                    email=row.email,
                    full_name=row.full_name,
                    course_name=row.course_name,
                    status="error",
                    message=f"Course not found: {row.course_name}"
                ))
                error_count += 1
                continue
        
        # Check if user exists
        existing_user = await db.execute(
            select(Student).where(Student.email == row.email)
        )
        user = existing_user.scalars().first()
        
        if user:
            # User exists - check enrollment if course provided
            if course:
                existing_enrollment = await db.execute(
                    select(Enrollment).where(
                        Enrollment.student_id == user.id,
                        Enrollment.course_id == course.id
                    )
                )
                if not existing_enrollment.scalars().first():
                    # Enroll in course
                    enrollment = Enrollment(student_id=user.id, course_id=course.id)
                    db.add(enrollment)
                    results.append(ImportedStudent(
                        email=row.email,
                        full_name=user.full_name,
                        course_name=row.course_name,
                        status="enrolled",
                        message="Existing user enrolled in course"
                    ))
                else:
                    results.append(ImportedStudent(
                        email=row.email,
                        full_name=user.full_name,
                        course_name=row.course_name,
                        status="existing",
                        message="User already exists and enrolled"
                    ))
            else:
                results.append(ImportedStudent(
                    email=row.email,
                    full_name=user.full_name,
                    course_name=row.course_name,
                    status="existing",
                    message="User already exists"
                ))
            existing_count += 1
        else:
            # Create new user with pending invitation
            token = generate_token()
            expires_at = datetime.utcnow() + timedelta(hours=72)
            
            new_user = Student(
                email=row.email,
                full_name=row.full_name,
                hashed_password=None,  # No password until they accept invitation
                org_id=admin.org_id,
                role=StudentRole.STUDENT.value,
                is_active=False,  # Inactive until they set password
                invitation_token=token,
                invitation_status=InvitationStatus.PENDING.value,
                invitation_expires_at=expires_at
            )
            db.add(new_user)
            await db.flush()  # Get the user ID
            
            # Enroll in course if provided
            if course:
                enrollment = Enrollment(student_id=new_user.id, course_id=course.id)
                db.add(enrollment)
            
            results.append(ImportedStudent(
                email=row.email,
                full_name=row.full_name,
                course_name=row.course_name,
                status="created",
                message=f"Account created with pending invitation{' and enrolled' if course else ''}"
            ))
            created_count += 1
    
    await db.commit()
    
    return BulkImportResponse(
        total=len(request.students),
        created=created_count,
        existing=existing_count,
        errors=error_count,
        students=results
    )


class PendingUserResponse(BaseModel):
    id: UUID
    email: str
    full_name: Optional[str]
    invitation_status: str
    invitation_expires_at: Optional[datetime]
    courses: List[str]
    created_at: datetime


@router.get("/users/pending", response_model=List[PendingUserResponse])
async def list_pending_users(
    admin: AdminUser,
    db: AsyncSession = Depends(get_db)
):
    """List all users with pending invitations."""
    result = await db.execute(
        select(Student)
        .where(
            Student.org_id == admin.org_id,
            Student.invitation_status == InvitationStatus.PENDING.value
        )
        .order_by(desc(Student.created_at))
    )
    users = result.scalars().all()
    
    response = []
    for user in users:
        # Get enrolled courses
        courses_result = await db.execute(
            select(Course.name)
            .join(Enrollment, Enrollment.course_id == Course.id)
            .where(Enrollment.student_id == user.id)
        )
        courses = [c for c in courses_result.scalars().all()]
        
        response.append(PendingUserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            invitation_status=user.invitation_status,
            invitation_expires_at=user.invitation_expires_at,
            courses=courses,
            created_at=user.created_at
        ))
    
    return response


@router.post("/users/{user_id}/resend-invitation")
async def resend_invitation(
    user_id: UUID,
    admin: AdminUser,
    db: AsyncSession = Depends(get_db)
):
    """Regenerate invitation token for a pending user."""
    import secrets
    
    result = await db.execute(
        select(Student).where(
            Student.id == user_id,
            Student.org_id == admin.org_id,
            Student.invitation_status == InvitationStatus.PENDING.value
        )
    )
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Pending user not found")
    
    # Generate new token
    new_token = secrets.token_urlsafe(32)
    user.invitation_token = new_token
    user.invitation_expires_at = datetime.utcnow() + timedelta(hours=72)
    
    await db.commit()
    
    return {
        "success": True,
        "message": "Invitation token regenerated",
        "invitation_token": new_token,  # Returned for dev/testing - in production, send via email
        "expires_at": user.invitation_expires_at
    }


@router.patch("/users/{user_id}/toggle-status")
async def toggle_user_status(
    user_id: UUID,
    admin: AdminUser,
    db: AsyncSession = Depends(get_db)
):
    """Toggle user active status."""
    result = await db.execute(
        select(Student).where(
            Student.id == user_id,
            Student.org_id == admin.org_id
        )
    )
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent admins from deactivating themselves
    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate own account"
        )
    
    user.is_active = not user.is_active
    await db.commit()
    
    return {"success": True, "is_active": user.is_active}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: UUID,
    admin: AdminUser,
    db: AsyncSession = Depends(get_db)
):
    """Delete a user permanently (hard delete)."""
    result = await db.execute(
        select(Student).where(
            Student.id == user_id,
            Student.org_id == admin.org_id
        )
    )
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    # Delete related data first (enrollments, query_analytics)
    await db.execute(
        delete(Enrollment).where(Enrollment.student_id == user_id)
    )
    await db.execute(
        delete(QueryAnalytics).where(QueryAnalytics.student_id == user_id)
    )
    
    # Now delete the user
    await db.delete(user)
    await db.commit()
    
    return {"success": True, "message": "User deleted permanently"}


# ==================== Course Management ====================

@router.get("/courses", response_model=List[CourseAdminResponse])
async def list_courses(
    admin: AdminUser,
    db: AsyncSession = Depends(get_db),
    search: Optional[str] = Query(None),
    course_type: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0)
):
    """List all courses in the organization with stats."""
    # Build base query with filters BEFORE pagination
    query = (
        select(
            Course,
            func.count(func.distinct(Document.id)).label('documents_count'),
            func.count(func.distinct(Enrollment.id)).label('enrollments_count')
        )
        .outerjoin(Document)
        .outerjoin(Enrollment)
        .where(Course.org_id == admin.org_id)
    )
    
    # Apply filters before group_by and pagination
    if search:
        query = query.where(Course.name.ilike(f"%{search}%"))
    
    if course_type:
        query = query.where(Course.course_type == course_type)
    
    # Apply group_by, order_by, and pagination last
    query = (
        query
        .group_by(Course.id)
        .order_by(desc(Course.created_at))
        .limit(limit)
        .offset(offset)
    )
    
    result = await db.execute(query)
    courses_data = result.all()
    
    return [
        CourseAdminResponse(
            id=course.id,
            name=course.name,
            org_id=course.org_id,
            course_type=course.course_type,
            total_sessions=course.total_sessions,
            total_chunks=course.total_chunks,
            documents_count=docs_count,
            enrollments_count=enrollments_count,
            created_at=course.created_at
        )
        for course, docs_count, enrollments_count in courses_data
    ]


@router.post("/courses", response_model=CourseAdminResponse, status_code=status.HTTP_201_CREATED)
async def create_course(
    request: CourseCreateRequest,
    admin: AdminUser,
    db: AsyncSession = Depends(get_db)
):
    """Create a new course."""
    # Always use admin's org_id to prevent privilege escalation
    course = Course(
        name=request.name,
        org_id=admin.org_id,
        course_type=request.course_type,
        total_sessions=0,
        total_chunks=0
    )
    db.add(course)
    await db.commit()
    await db.refresh(course)
    
    return CourseAdminResponse(
        id=course.id,
        name=course.name,
        org_id=course.org_id,
        course_type=course.course_type,
        total_sessions=course.total_sessions,
        total_chunks=course.total_chunks,
        documents_count=0,
        enrollments_count=0,
        created_at=course.created_at
    )


class CourseUpdateRequest(BaseModel):
    name: Optional[str] = None
    course_type: Optional[str] = None


@router.put("/courses/{course_id}", response_model=CourseAdminResponse)
async def update_course(
    course_id: UUID,
    update_data: CourseUpdateRequest,
    admin: AdminUser,
    db: AsyncSession = Depends(get_db)
):
    """Update a course's details."""
    result = await db.execute(
        select(Course).where(
            Course.id == course_id,
            Course.org_id == admin.org_id
        )
    )
    course = result.scalars().first()
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Update fields if provided
    if update_data.name is not None:
        course.name = update_data.name
    if update_data.course_type is not None:
        course.course_type = update_data.course_type
    
    await db.commit()
    await db.refresh(course)
    
    # Get counts
    docs_count = (await db.execute(
        select(func.count(Document.id)).where(Document.course_id == course_id)
    )).scalar() or 0
    
    enrollments_count = (await db.execute(
        select(func.count(Enrollment.id)).where(Enrollment.course_id == course_id)
    )).scalar() or 0
    
    return CourseAdminResponse(
        id=course.id,
        name=course.name,
        org_id=course.org_id,
        course_type=course.course_type,
        total_sessions=course.total_sessions,
        total_chunks=course.total_chunks,
        documents_count=docs_count,
        enrollments_count=enrollments_count,
        created_at=course.created_at
    )


@router.delete("/courses/{course_id}")
async def delete_course(
    course_id: UUID,
    admin: AdminUser,
    db: AsyncSession = Depends(get_db)
):
    """Delete a course and all associated data."""
    result = await db.execute(
        select(Course).where(
            Course.id == course_id,
            Course.org_id == admin.org_id
        )
    )
    course = result.scalars().first()
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Delete in order: chunks -> documents -> enrollments -> course
    await db.execute(
        delete(DocumentChunk).where(DocumentChunk.course_id == course_id)
    )
    await db.execute(
        delete(Document).where(Document.course_id == course_id)
    )
    await db.execute(
        delete(Enrollment).where(Enrollment.course_id == course_id)
    )
    await db.delete(course)
    await db.commit()
    
    return {"success": True, "message": "Course deleted"}


# ==================== Document Management ====================

@router.get("/documents", response_model=List[DocumentResponse])
async def list_documents(
    admin: AdminUser,
    db: AsyncSession = Depends(get_db),
    course_id: Optional[UUID] = Query(None),
    content_type: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0)
):
    """List all documents with optional filtering."""
    # Build base query with explicit select_from to avoid join ambiguity
    query = (
        select(
            Document,
            Course.name.label('course_name'),
            func.count(DocumentChunk.id).label('chunks_count')
        )
        .select_from(Document)
        .join(Course, Document.course_id == Course.id)
        .outerjoin(DocumentChunk, DocumentChunk.document_id == Document.id)
        .where(Course.org_id == admin.org_id)
    )
    
    # Apply filters before group_by and pagination
    if course_id:
        query = query.where(Document.course_id == course_id)
    
    if content_type:
        query = query.where(Document.content_type == content_type)
    
    # Apply group_by, order_by, and pagination last
    query = (
        query
        .group_by(Document.id, Course.name)
        .order_by(desc(Document.created_at))
        .limit(limit)
        .offset(offset)
    )
    
    result = await db.execute(query)
    docs_data = result.all()
    
    return [
        DocumentResponse(
            id=doc.id,
            course_id=doc.course_id,
            course_name=course_name,
            title=doc.title,
            session_id=doc.session_id,
            content_type=doc.content_type,
            source_uri=doc.source_uri,
            chunks_count=chunks_count,
            created_at=doc.created_at
        )
        for doc, course_name, chunks_count in docs_data
    ]


@router.get("/documents/{document_id}/chunks", response_model=List[DocumentChunkResponse])
async def get_document_chunks(
    document_id: UUID,
    admin: AdminUser,
    db: AsyncSession = Depends(get_db),
    limit: int = Query(100, le=500),
    offset: int = Query(0)
):
    """Get all chunks for a specific document."""
    # First verify the document belongs to admin's org
    doc_query = (
        select(Document)
        .join(Course, Document.course_id == Course.id)
        .where(Document.id == document_id, Course.org_id == admin.org_id)
    )
    doc_result = await db.execute(doc_query)
    document = doc_result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Get chunks for this document
    chunks_query = (
        select(DocumentChunk)
        .where(DocumentChunk.document_id == document_id)
        .order_by(DocumentChunk.chunk_index)
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(chunks_query)
    chunks = result.scalars().all()
    
    return [
        DocumentChunkResponse(
            id=chunk.id,
            document_id=chunk.document_id,
            course_id=chunk.course_id,
            session_id=chunk.session_id,
            chunk_index=chunk.chunk_index,
            text=chunk.text,
            assignment_allowed=chunk.assignment_allowed,
            slide_number=chunk.slide_number,
            slide_title=chunk.slide_title,
            embedding_id=chunk.embedding_id,
            created_at=chunk.created_at
        )
        for chunk in chunks
    ]


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: UUID,
    admin: AdminUser,
    db: AsyncSession = Depends(get_db)
):
    """Delete a document and all its chunks (also removes from Qdrant)."""
    from src.db.qdrant import qdrant_client
    from src.core.config import settings
    
    # Verify the document belongs to admin's org
    doc_query = (
        select(Document)
        .join(Course, Document.course_id == Course.id)
        .where(Document.id == document_id, Course.org_id == admin.org_id)
    )
    doc_result = await db.execute(doc_query)
    document = doc_result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Get chunk IDs for Qdrant deletion
    chunk_ids_query = (
        select(DocumentChunk.embedding_id)
        .where(
            DocumentChunk.document_id == document_id,
            DocumentChunk.embedding_id.isnot(None)
        )
    )
    chunk_ids_result = await db.execute(chunk_ids_query)
    embedding_ids = [str(eid) for eid in chunk_ids_result.scalars().all()]
    
    # Delete from Qdrant if enabled
    if settings.USE_QDRANT and embedding_ids:
        try:
            from qdrant_client.http import models as qdrant_models
            qdrant_client.delete(
                collection_name=settings.QDRANT_COLLECTION_NAME,
                points_selector=qdrant_models.PointIdsList(
                    points=embedding_ids
                )
            )
        except Exception as e:
            # Log but don't fail if Qdrant deletion fails
            import logging
            logging.error(f"Failed to delete from Qdrant: {e}")
    
    # Delete chunks from PostgreSQL
    await db.execute(
        delete(DocumentChunk).where(DocumentChunk.document_id == document_id)
    )
    
    # Delete document from PostgreSQL
    await db.execute(
        delete(Document).where(Document.id == document_id)
    )
    
    await db.commit()
    
    return {"message": "Document deleted successfully", "deleted_embeddings": len(embedding_ids)}


# ==================== Analytics ====================

@router.get("/analytics", response_model=AnalyticsSummary)
async def get_analytics(
    admin: AdminUser,
    db: AsyncSession = Depends(get_db),
    course_id: Optional[UUID] = Query(None),
    days: int = Query(7, le=90)
):
    """Get analytics summary for the organization."""
    start_date = datetime.utcnow() - timedelta(days=days)
    today = datetime.utcnow().date()
    
    # Base filter
    base_filter = [Course.org_id == admin.org_id]
    if course_id:
        base_filter.append(QueryAnalytics.course_id == course_id)
    
    # Total queries
    total_query = (
        select(func.count(QueryAnalytics.id))
        .join(Course)
        .where(*base_filter, QueryAnalytics.created_at >= start_date)
    )
    total_queries = (await db.execute(total_query)).scalar() or 0
    
    # Queries today
    today_query = (
        select(func.count(QueryAnalytics.id))
        .join(Course)
        .where(*base_filter, func.date(QueryAnalytics.created_at) == today)
    )
    queries_today = (await db.execute(today_query)).scalar() or 0
    
    # Average confidence
    confidence_query = (
        select(func.avg(QueryAnalytics.confidence_score))
        .join(Course)
        .where(*base_filter, QueryAnalytics.created_at >= start_date)
    )
    avg_confidence = (await db.execute(confidence_query)).scalar() or 0.0
    
    # Hallucinations count
    hallucinations_query = (
        select(func.count(QueryAnalytics.id))
        .join(Course)
        .where(
            *base_filter,
            QueryAnalytics.created_at >= start_date,
            QueryAnalytics.was_hallucination_detected == True
        )
    )
    hallucinations = (await db.execute(hallucinations_query)).scalar() or 0
    
    # Assignments blocked
    blocked_query = (
        select(func.count(QueryAnalytics.id))
        .join(Course)
        .where(
            *base_filter,
            QueryAnalytics.created_at >= start_date,
            QueryAnalytics.was_assignment_blocked == True
        )
    )
    blocked = (await db.execute(blocked_query)).scalar() or 0
    
    # Average response time
    time_query = (
        select(func.avg(QueryAnalytics.response_time_ms))
        .join(Course)
        .where(*base_filter, QueryAnalytics.created_at >= start_date)
    )
    avg_time = (await db.execute(time_query)).scalar() or 0.0
    
    # Popular topics
    topics_query = (
        select(
            QueryAnalytics.query_topic,
            func.count(QueryAnalytics.id).label('count')
        )
        .join(Course)
        .where(
            *base_filter,
            QueryAnalytics.created_at >= start_date,
            QueryAnalytics.query_topic.isnot(None)
        )
        .group_by(QueryAnalytics.query_topic)
        .order_by(desc('count'))
        .limit(5)
    )
    topics_result = await db.execute(topics_query)
    popular_topics = [
        {"topic": topic, "count": count}
        for topic, count in topics_result.all()
    ]
    
    # Daily usage for chart
    daily_query = (
        select(
            func.date(QueryAnalytics.created_at).label('date'),
            func.count(QueryAnalytics.id).label('queries')
        )
        .join(Course)
        .where(*base_filter, QueryAnalytics.created_at >= start_date)
        .group_by(func.date(QueryAnalytics.created_at))
        .order_by('date')
    )
    daily_result = await db.execute(daily_query)
    daily_usage = [
        {"date": str(date), "queries": count}
        for date, count in daily_result.all()
    ]
    
    # Active users (unique students with queries in the time period)
    active_users_query = (
        select(func.count(func.distinct(QueryAnalytics.student_id)))
        .join(Course)
        .where(
            *base_filter,
            QueryAnalytics.created_at >= start_date,
            QueryAnalytics.student_id.isnot(None)
        )
    )
    active_users = (await db.execute(active_users_query)).scalar() or 0
    
    return AnalyticsSummary(
        total_queries=total_queries,
        queries_today=queries_today,
        avg_confidence=round(avg_confidence, 1),
        hallucinations_detected=hallucinations,
        assignments_blocked=blocked,
        avg_response_time_ms=round(avg_time, 0),
        popular_topics=popular_topics,
        daily_usage=daily_usage,
        active_users=active_users
    )


# ==================== Enrollment Management ====================

class EnrollmentRequest(BaseModel):
    student_id: UUID
    course_id: UUID


@router.post("/enrollments")
async def enroll_user(
    request: EnrollmentRequest,
    admin: AdminUser,
    db: AsyncSession = Depends(get_db)
):
    """Enroll a user in a course."""
    # Verify student and course exist in org
    student = await db.execute(
        select(Student).where(
            Student.id == request.student_id,
            Student.org_id == admin.org_id
        )
    )
    if not student.scalars().first():
        raise HTTPException(status_code=404, detail="Student not found")
    
    course = await db.execute(
        select(Course).where(
            Course.id == request.course_id,
            Course.org_id == admin.org_id
        )
    )
    if not course.scalars().first():
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Check if already enrolled
    existing = await db.execute(
        select(Enrollment).where(
            Enrollment.student_id == request.student_id,
            Enrollment.course_id == request.course_id
        )
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Already enrolled")
    
    enrollment = Enrollment(student_id=request.student_id, course_id=request.course_id)
    db.add(enrollment)
    await db.commit()
    
    return {"success": True, "message": "User enrolled successfully"}


@router.delete("/enrollments")
async def unenroll_user(
    student_id: UUID,
    course_id: UUID,
    admin: AdminUser,
    db: AsyncSession = Depends(get_db)
):
    """Remove a user from a course."""
    # Verify student belongs to admin's organization
    student_result = await db.execute(
        select(Student).where(
            Student.id == student_id,
            Student.org_id == admin.org_id
        )
    )
    if not student_result.scalars().first():
        raise HTTPException(status_code=404, detail="Student not found in organization")
    
    # Verify course belongs to admin's organization
    course_result = await db.execute(
        select(Course).where(
            Course.id == course_id,
            Course.org_id == admin.org_id
        )
    )
    if not course_result.scalars().first():
        raise HTTPException(status_code=404, detail="Course not found in organization")
    
    # Now fetch the enrollment
    result = await db.execute(
        select(Enrollment).where(
            Enrollment.student_id == student_id,
            Enrollment.course_id == course_id
        )
    )
    enrollment = result.scalars().first()
    
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    
    await db.delete(enrollment)
    await db.commit()
    
    return {"success": True, "message": "User unenrolled"}


# ==================== Organization Info ====================

@router.get("/organization")
async def get_organization(
    admin: AdminUser,
    db: AsyncSession = Depends(get_db)
):
    """Get organization info."""
    result = await db.execute(
        select(Org).where(Org.id == admin.org_id)
    )
    org = result.scalars().first()
    
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    return {
        "id": org.id,
        "name": org.name,
        "created_at": org.created_at
    }
