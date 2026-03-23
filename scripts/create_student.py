import asyncio
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from src.db.session import AsyncSessionLocal
from src.db.models import Org, Student, StudentRole
from src.db.repository.org import OrgRepository
from src.services.auth import AuthService

async def main(email: str, password: str, org_name: str):
    print(f"Creating student user: {email}")
    
    async with AsyncSessionLocal() as session:
        # 1. Create or get org
        org_repo = OrgRepository(Org, session)
        
        from sqlalchemy import select
        result = await session.execute(select(Org).where(Org.name == org_name))
        org = result.scalars().first()
        
        if not org:
            print(f"Creating org: {org_name}")
            org = await org_repo.create({"name": org_name})
        else:
            print(f"Using existing org: {org_name} ({org.id})")
        
        # 2. Create student user
        auth_service = AuthService(session)
        
        try:
            student = await auth_service.create_user(
                email=email,
                password=password,
                org_id=org.id,
                full_name="Demo Student",
                role=StudentRole.STUDENT
            )
            
            print(f"\n=== STUDENT CREATED ===")
            print(f"ID: {student.id}")
            print(f"Email: {student.email}")
            print(f"Org ID: {student.org_id}")
            print(f"Role: {student.role}")
            print(f"\nYou can now login at the frontend using these credentials!")
            
        except ValueError as e:
            print(f"Error: {e}")
            print("Student user may already exist.")

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: poetry run python scripts/create_student.py <email> <password> <org_name>")
        sys.exit(1)
    
    email = sys.argv[1]
    password = sys.argv[2]
    org_name = sys.argv[3]
    
    asyncio.run(main(email, password, org_name))
