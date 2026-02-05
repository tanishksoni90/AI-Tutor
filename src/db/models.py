import enum
import uuid
from sqlalchemy import Column, String, ForeignKey, DateTime, Text, Boolean, Integer, Enum as SAEnum, TypeDecorator, CHAR
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from src.db.base import Base


# Cross-database UUID type
class UUID(TypeDecorator):
    """Platform-independent UUID type.
    Uses PostgreSQL's UUID type when available, otherwise uses CHAR(36).
    """
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(PostgreSQLUUID())
        else:
            return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == 'postgresql':
            return value
        else:
            if isinstance(value, uuid.UUID):
                return str(value)
            return value

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        else:
            if isinstance(value, uuid.UUID):
                return value
            else:
                return uuid.UUID(value)

class ContentType(str, enum.Enum):
    SLIDE = "slide"
    PRE_READ = "pre_read"
    POST_READ = "post_read"
    QUIZ = "quiz"
    TRANSCRIPT = "transcript"

class Org(Base):
    __tablename__ = "orgs"

    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    courses = relationship("Course", back_populates="org")
    students = relationship("Student", back_populates="org")

class CourseType(str, enum.Enum):
    MICRO = "micro"  # Small courses: 20-30 sessions
    CERTIFICATION = "certification"  # Large courses: 100+ sessions
    STANDARD = "standard"  # Medium courses

class Course(Base):
    __tablename__ = "courses"

    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(), ForeignKey("orgs.id"), nullable=False)
    name = Column(String, nullable=False)
    course_type = Column(String, default=CourseType.STANDARD.value, nullable=False)
    total_sessions = Column(Integer, default=0, nullable=False)  # Updated during ingestion
    total_chunks = Column(Integer, default=0, nullable=False)  # Cache for performance
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    org = relationship("Org", back_populates="courses")
    documents = relationship("Document", back_populates="course")
    enrollments = relationship("Enrollment", back_populates="course")
    chunks = relationship("DocumentChunk", back_populates="course")
    query_analytics = relationship("QueryAnalytics", back_populates="course")

class StudentRole(str, enum.Enum):
    STUDENT = "student"
    ADMIN = "admin"


class InvitationStatus(str, enum.Enum):
    ACTIVE = "active"  # Normal account, no pending invitation
    PENDING = "pending"  # Invitation sent, waiting for password setup
    EXPIRED = "expired"  # Invitation expired


class Student(Base):
    __tablename__ = "students"

    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(), ForeignKey("orgs.id"), nullable=False)
    email = Column(String, unique=True, nullable=False)
    full_name = Column(String, nullable=True)
    hashed_password = Column(String, nullable=True)  # Nullable for pending invitations
    role = Column(String, default=StudentRole.STUDENT.value, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Invitation fields
    invitation_token = Column(String(64), unique=True, nullable=True)
    invitation_status = Column(String, default=InvitationStatus.ACTIVE.value, nullable=False)
    invitation_expires_at = Column(DateTime(timezone=True), nullable=True)
    
    org = relationship("Org", back_populates="students")
    enrollments = relationship("Enrollment", back_populates="student")
    query_analytics = relationship("QueryAnalytics", back_populates="student")

class Enrollment(Base):
    """Links a Student to a Course"""
    __tablename__ = "enrollments"

    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(), ForeignKey("students.id"), nullable=False)
    course_id = Column(UUID(), ForeignKey("courses.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    student = relationship("Student", back_populates="enrollments")
    course = relationship("Course", back_populates="enrollments")

class Document(Base):
    """
    Metadata-only representation of a source file.
    NO RAW CONTENT HERE.
    """
    __tablename__ = "documents"

    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    course_id = Column(UUID(), ForeignKey("courses.id"), nullable=False)
    title = Column(String, nullable=False)
    session_id = Column(String, nullable=True) # Logical grouping (e.g., "Week 1")
    content_type = Column(String, nullable=False) # Stored as string for flexibility, validated by logic
    source_uri = Column(String, nullable=False) # S3/Blob path
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    course = relationship("Course", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")


class DocumentChunk(Base):
    """
    The atomic unit of RAG.
    Stores the actual text and links to the Vector DB.
    """
    __tablename__ = "document_chunks"

    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(), ForeignKey("documents.id"), nullable=False)
    course_id = Column(UUID(), ForeignKey("courses.id"), nullable=False) # Denormalized for fast filtering
    
    # RAG Metadata
    session_id = Column(String, nullable=True) # Denormalized from Document
    chunk_index = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    assignment_allowed = Column(Boolean, default=True, nullable=False)
    
    # Slide-Aware Chunking Metadata
    slide_number = Column(Integer, nullable=True)  # 1-indexed page/slide number
    slide_title = Column(String, nullable=True)    # Extracted slide title for context
    
    # Link to Vector DB
    embedding_id = Column(UUID(), nullable=True) # The ID used in Qdrant

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    document = relationship("Document", back_populates="chunks")
    course = relationship("Course", back_populates="chunks")


class QueryAnalytics(Base):
    """
    Analytics for tracking queries (no actual question/answer content stored).
    Used for hybrid memory approach - stores metadata only.
    """
    __tablename__ = "query_analytics"

    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(), ForeignKey("students.id"), nullable=True)
    course_id = Column(UUID(), ForeignKey("courses.id"), nullable=False)
    session_token = Column(String(64), nullable=True)  # Groups queries in same session
    query_topic = Column(String(255), nullable=True)  # Extracted topic (not the question)
    query_length = Column(Integer, nullable=False)
    response_length = Column(Integer, nullable=False)
    confidence_score = Column(Integer, nullable=True)  # 0-100
    sources_count = Column(Integer, default=0, nullable=False)
    sources_used = Column(Text, nullable=True)  # JSON list of chunk IDs
    was_hallucination_detected = Column(Boolean, default=False, nullable=False)
    was_assignment_blocked = Column(Boolean, default=False, nullable=False)
    context_messages_count = Column(Integer, default=0, nullable=False)
    response_time_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    student = relationship("Student", back_populates="query_analytics")
    course = relationship("Course", back_populates="query_analytics")
