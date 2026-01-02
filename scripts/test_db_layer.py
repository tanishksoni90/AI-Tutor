import asyncio
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from src.db.session import AsyncSessionLocal
from src.db.models import Org, Course
from src.db.repository.org import OrgRepository
from src.db.repository.course import CourseRepository

async def main():
    async with AsyncSessionLocal() as session:
        org_repo = OrgRepository(Org, session)
        course_repo = CourseRepository(Course, session)

        # 1. Create Org
        print("Creating Org...")
        org_data = {"name": "Test University"}
        org = await org_repo.create(org_data)
        print(f"Org Created: {org.id} - {org.name}")

        # 2. Create Course
        print("Creating Course...")
        course_data = {"name": "CS101: Intro to AI", "org_id": org.id}
        course = await course_repo.create(course_data)
        print(f"Course Created: {course.id} - {course.name}")

        # 3. Fetch Course by Org
        print("Fetching Courses for Org...")
        courses = await course_repo.get_by_org(org.id)
        assert len(courses) > 0
        print(f"Found {len(courses)} courses for Org {org.name}")

if __name__ == "__main__":
    asyncio.run(main())