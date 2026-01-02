from typing import Optional
from sqlalchemy import select
from src.db.repository.base import BaseRepository
from src.db.models import Student

class StudentRepository(BaseRepository[Student]):
    async def get_by_email(self, email: str) -> Optional[Student]:
        query = select(self.model).where(self.model.email == email)
        result = await self.db.execute(query)
        return result.scalars().first()