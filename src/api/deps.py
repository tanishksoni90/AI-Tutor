"""
API Dependencies - Authentication and authorization.

Provides:
- get_current_user: Extract user from JWT token
- get_current_active_user: Ensure user is active
- require_admin: Ensure user has admin role
"""
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db
from src.db.models import Student, StudentRole
from src.db.repository.student import StudentRepository
from src.services.auth import decode_access_token, TokenData

# OAuth2 scheme - expects token in Authorization header
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: AsyncSession = Depends(get_db)
) -> Student:
    """
    Extract and validate current user from JWT token.
    
    Raises 401 if token is invalid or user not found.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token_data = decode_access_token(token)
    if token_data is None:
        raise credentials_exception
    
    student_repo = StudentRepository(Student, db)
    student = await student_repo.get(token_data.student_id)
    
    if student is None:
        raise credentials_exception
        
    return student


async def get_current_active_user(
    current_user: Annotated[Student, Depends(get_current_user)]
) -> Student:
    """
    Ensure current user is active.
    
    Raises 403 if user is inactive.
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user


async def require_admin(
    current_user: Annotated[Student, Depends(get_current_active_user)]
) -> Student:
    """
    Ensure current user has admin role.
    
    Raises 403 if user is not admin.
    """
    if current_user.role != StudentRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


# Type aliases for cleaner endpoint signatures
CurrentUser = Annotated[Student, Depends(get_current_active_user)]
AdminUser = Annotated[Student, Depends(require_admin)]
