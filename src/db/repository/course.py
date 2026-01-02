from typing import List
from uuid import UUID
from sqlalchemy import select
from src.db.repository.base import BaseRepository
from src.db.models import Course

class CourseRepository(BaseRepository[Course]):
    async def get_by_org(self, org_id: UUID) -> List[Course]:
        query = select(self.model).where(self.model.org_id == org_id)
        result = await self.db.execute(query)
        return result.scalars().all()