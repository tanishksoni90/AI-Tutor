import enum
import uuid
from sqlalchemy import Column, String, ForeignKey, DateTime, Text, Boolean, Integer, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from src.db.base import Base

class ContentType(str, enum.Enum):
    SLIDE = "slide"
    PRE_READ = "pre_read"
    POST_READ = "post_read"
    QUIZ = "quiz"
    TRANSCRIPT = "transcript"

class Org(Base):
    __tablename__ = "orgs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    courses = relationship("Course", back_populates="org")
    students = relationship("Student", back_populates="org")

class Course(Base):
    __tablename__ = "courses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    org = relationship("Org", back_populates="courses")
    documents = relationship("Document", back_populates="course")
    enrollments = relationship("Enrollment", back_populates="course")
    chunks = relationship("DocumentChunk", back_populates="course")

class StudentRole(str, enum.Enum):
    STUDENT = "student"
    ADMIN = "admin"


class Student(Base):
    __tablename__ = "students"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False)
    email = Column(String, unique=True, nullable=False)
    full_name = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default=StudentRole.STUDENT.value, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    org = relationship("Org", back_populates="students")
    enrollments = relationship("Enrollment", back_populates="student")

class Enrollment(Base):
    """Links a Student to a Course"""
    __tablename__ = "enrollments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    student = relationship("Student", back_populates="enrollments")
    course = relationship("Course", back_populates="enrollments")

class Document(Base):
    """
    Metadata-only representation of a source file.
    NO RAW CONTENT HERE.
    """
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id"), nullable=False)
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

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id"), nullable=False) # Denormalized for fast filtering
    
    # RAG Metadata
    session_id = Column(String, nullable=True) # Denormalized from Document
    chunk_index = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    assignment_allowed = Column(Boolean, default=True, nullable=False)
    
    # Slide-Aware Chunking Metadata
    slide_number = Column(Integer, nullable=True)  # 1-indexed page/slide number
    slide_title = Column(String, nullable=True)    # Extracted slide title for context
    
    # Link to Vector DB
    embedding_id = Column(UUID(as_uuid=True), nullable=True) # The ID used in Qdrant

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    document = relationship("Document", back_populates="chunks")
    course = relationship("Course", back_populates="chunks")
