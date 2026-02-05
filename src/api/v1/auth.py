"""
Authentication API Endpoints

Endpoints:
- POST /auth/login - Login and get JWT token
- POST /auth/register - Register new user (admin only)
- GET /auth/me - Get current user info
- GET /auth/validate-invitation - Check if invitation token is valid
- POST /auth/accept-invitation - Accept invitation and set password
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.db.session import get_db
from src.db.models import Student, StudentRole, InvitationStatus, Course, Enrollment
from src.services.auth import AuthService, Token, get_password_hash
from src.api.deps import CurrentUser, AdminUser

router = APIRouter(prefix="/auth", tags=["auth"])


# Request/Response Models
class UserCreate(BaseModel):
    """Request to create a new user."""
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = None
    org_id: UUID
    role: str = Field(default="student", pattern="^(student|admin)$")


class UserResponse(BaseModel):
    """User info response."""
    id: UUID
    email: str
    full_name: Optional[str]
    org_id: UUID
    role: str
    is_active: bool


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """
    Login with email and password to get JWT token.
    
    Use the token in Authorization header: `Bearer <token>`
    """
    auth_service = AuthService(db)
    
    student = await auth_service.authenticate_user(
        email=form_data.username,  # OAuth2 form uses 'username' field
        password=form_data.password
    )
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return auth_service.create_token_for_user(student)


@router.post(
    "/register", 
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED
)
async def register_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = None  # Requires admin authentication
):
    """
    Register a new user. Requires admin authentication.
    
    Only admins can create new users to prevent unauthorized signups.
    """
    auth_service = AuthService(db)
    
    try:
        role = StudentRole.ADMIN if user_data.role == "admin" else StudentRole.STUDENT
        
        student = await auth_service.create_user(
            email=user_data.email,
            password=user_data.password,
            org_id=user_data.org_id,
            full_name=user_data.full_name,
            role=role
        )
        
        return UserResponse(
            id=student.id,
            email=student.email,
            full_name=student.full_name,
            org_id=student.org_id,
            role=student.role,
            is_active=student.is_active
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: CurrentUser):
    """Get current authenticated user's info."""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        org_id=current_user.org_id,
        role=current_user.role,
        is_active=current_user.is_active
    )


# ==================== Invitation Endpoints ====================

class InvitationInfoResponse(BaseModel):
    """Info about a pending invitation."""
    email: str
    full_name: Optional[str]
    courses: list[str]
    expires_at: datetime


class AcceptInvitationRequest(BaseModel):
    """Request to accept invitation and set password."""
    token: str
    password: str = Field(..., min_length=8)


@router.get("/validate-invitation/{token}")
async def validate_invitation(
    token: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Validate an invitation token and return user info.
    
    This is a public endpoint - no authentication required.
    Used by the set-password page to verify token before showing form.
    """
    result = await db.execute(
        select(Student).where(
            Student.invitation_token == token,
            Student.invitation_status == InvitationStatus.PENDING.value
        )
    )
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired invitation token"
        )
    
    # Check if expired
    if user.invitation_expires_at and user.invitation_expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Invitation has expired. Please contact admin for a new invitation."
        )
    
    # Get enrolled courses
    courses_result = await db.execute(
        select(Course.name)
        .join(Enrollment, Enrollment.course_id == Course.id)
        .where(Enrollment.student_id == user.id)
    )
    courses = [c for c in courses_result.scalars().all()]
    
    return InvitationInfoResponse(
        email=user.email,
        full_name=user.full_name,
        courses=courses,
        expires_at=user.invitation_expires_at
    )


@router.post("/accept-invitation", response_model=Token)
async def accept_invitation(
    request: AcceptInvitationRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Accept invitation and set password.
    
    This is a public endpoint - no authentication required.
    After setting password, returns a JWT token so user is auto-logged in.
    """
    result = await db.execute(
        select(Student).where(
            Student.invitation_token == request.token,
            Student.invitation_status == InvitationStatus.PENDING.value
        )
    )
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired invitation token"
        )
    
    # Check if expired
    if user.invitation_expires_at and user.invitation_expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Invitation has expired. Please contact admin for a new invitation."
        )
    
    # Set password and activate account
    user.hashed_password = get_password_hash(request.password)
    user.invitation_status = InvitationStatus.ACTIVE.value
    user.invitation_token = None  # Clear token (single-use)
    user.invitation_expires_at = None
    user.is_active = True
    
    await db.commit()
    await db.refresh(user)
    
    # Return JWT token so user is auto-logged in
    auth_service = AuthService(db)
    return auth_service.create_token_for_user(user)
