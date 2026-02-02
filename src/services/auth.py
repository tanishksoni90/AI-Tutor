"""
Authentication Service - JWT + Password hashing.

Features:
- Password hashing with bcrypt
- JWT token generation and validation
- User authentication
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.db.models import Student, StudentRole
from src.db.repository.student import StudentRepository

logger = logging.getLogger(__name__)

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class TokenData(BaseModel):
    """Data encoded in JWT token."""
    student_id: UUID
    org_id: UUID
    email: str
    role: str


class Token(BaseModel):
    """Token response."""
    access_token: str
    token_type: str = "bearer"


def _truncate_password_to_bcrypt_limit(password: str) -> str:
    """
    Truncate password to bcrypt's 72-byte limit using byte-aware truncation.
    
    bcrypt only uses the first 72 bytes of a password. This function ensures
    consistent truncation by operating on bytes rather than characters, which
    is important for multi-byte characters (e.g., UTF-8 encoded text).
    """
    password_bytes = password.encode('utf-8')
    if len(password_bytes) <= 72:
        return password
    # Truncate to 72 bytes and decode safely (ignore incomplete multi-byte chars)
    truncated_bytes = password_bytes[:72]
    return truncated_bytes.decode('utf-8', errors='ignore')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    # bcrypt has a 72 byte limit, truncate if needed using byte-aware truncation
    truncated_password = _truncate_password_to_bcrypt_limit(plain_password)
    return pwd_context.verify(truncated_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password."""
    # bcrypt has a 72 byte limit, truncate if needed using byte-aware truncation
    truncated_password = _truncate_password_to_bcrypt_limit(password)
    return pwd_context.hash(truncated_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
        )
    
    to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(
        to_encode, 
        settings.JWT_SECRET_KEY, 
        algorithm=settings.JWT_ALGORITHM
    )
    return encoded_jwt


def decode_access_token(token: str) -> Optional[TokenData]:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(
            token, 
            settings.JWT_SECRET_KEY, 
            algorithms=[settings.JWT_ALGORITHM]
        )
        
        student_id = payload.get("sub")
        org_id = payload.get("org_id")
        email = payload.get("email")
        role = payload.get("role")
        
        if student_id is None:
            return None
            
        return TokenData(
            student_id=UUID(student_id),
            org_id=UUID(org_id),
            email=email,
            role=role
        )
    except JWTError as e:
        logger.warning(f"JWT decode error: {str(e)}")
        return None


class AuthService:
    """Authentication service for user management."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.student_repo = StudentRepository(Student, db)
    
    async def authenticate_user(self, email: str, password: str) -> Optional[Student]:
        """Authenticate user by email and password."""
        student = await self.student_repo.get_by_email(email)
        
        if not student:
            return None
        
        if not student.is_active:
            return None
            
        if not verify_password(password, student.hashed_password):
            return None
            
        return student
    
    async def create_user(
        self,
        email: str,
        password: str,
        org_id: UUID,
        full_name: Optional[str] = None,
        role: StudentRole = StudentRole.STUDENT
    ) -> Student:
        """Create a new user with hashed password."""
        # Check if user already exists
        existing = await self.student_repo.get_by_email(email)
        if existing:
            raise ValueError(f"User with email {email} already exists")
        
        hashed_password = get_password_hash(password)
        
        student = await self.student_repo.create({
            "email": email,
            "hashed_password": hashed_password,
            "org_id": org_id,
            "full_name": full_name,
            "role": role.value,
            "is_active": True
        })
        
        return student
    
    def create_token_for_user(self, student: Student) -> Token:
        """Create JWT token for authenticated user."""
        access_token = create_access_token(
            data={
                "sub": str(student.id),
                "org_id": str(student.org_id),
                "email": student.email,
                "role": student.role
            }
        )
        return Token(access_token=access_token)
