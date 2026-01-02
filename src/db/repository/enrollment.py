"""Enrollment repository for student-course access validation."""
from typing import Optional, List
from uuid import UUID
from sqlalchemy import select, and_

from src.db.repository.base import BaseRepository
from src.db.models import Enrollment, Course


class EnrollmentRepository(BaseRepository[Enrollment]):
    """Repository for Enrollment operations."""
    
    async def get_by_student_and_course(
        self, 
        student_id: UUID, 
        course_id: UUID
    ) -> Optional[Enrollment]:
        """Check if student is enrolled in a specific course."""
        query = select(self.model).where(
            and_(
                self.model.student_id == student_id,
                self.model.course_id == course_id
            )
        )
        result = await self.db.execute(query)
        return result.scalars().first()
    
    async def get_student_courses(self, student_id: UUID) -> List[Course]:
        """Get all courses a student is enrolled in."""
        query = (
            select(Course)
            .join(Enrollment, Enrollment.course_id == Course.id)
            .where(Enrollment.student_id == student_id)
        )
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def is_enrolled(self, student_id: UUID, course_id: UUID) -> bool:
        """Quick check if student has access to course."""
        enrollment = await self.get_by_student_and_course(student_id, course_id)
        return enrollment is not None
