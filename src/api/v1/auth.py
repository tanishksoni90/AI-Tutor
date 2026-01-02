"""
Authentication API Endpoints

Endpoints:
- POST /auth/login - Login and get JWT token
- POST /auth/register - Register new user (admin only)
- GET /auth/me - Get current user info
"""
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db
from src.db.models import StudentRole
from src.services.auth import AuthService, Token
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
