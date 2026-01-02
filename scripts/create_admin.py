"""
Create an admin user for initial setup.

Usage:
    poetry run python scripts/create_admin.py <email> <password> <org_name>

Example:
    poetry run python scripts/create_admin.py admin@example.com secretpass123 "Test University"
"""
import asyncio
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from src.db.session import AsyncSessionLocal
from src.db.models import Org, Student, StudentRole
from src.db.repository.org import OrgRepository
from src.services.auth import AuthService


async def main(email: str, password: str, org_name: str):
    print(f"Creating admin user: {email}")
    
    async with AsyncSessionLocal() as session:
        # 1. Create or get org
        org_repo = OrgRepository(Org, session)
        
        # Check if org exists (simple check by name)
        from sqlalchemy import select
        result = await session.execute(select(Org).where(Org.name == org_name))
        org = result.scalars().first()
        
        if not org:
            print(f"Creating org: {org_name}")
            org = await org_repo.create({"name": org_name})
        else:
            print(f"Using existing org: {org_name} ({org.id})")
        
        # 2. Create admin user
        auth_service = AuthService(session)
        
        try:
            admin = await auth_service.create_user(
                email=email,
                password=password,
                org_id=org.id,
                full_name="Admin User",
                role=StudentRole.ADMIN
            )
            
            print(f"\n=== ADMIN CREATED ===")
            print(f"ID: {admin.id}")
            print(f"Email: {admin.email}")
            print(f"Org ID: {admin.org_id}")
            print(f"Role: {admin.role}")
            print(f"\nYou can now login at POST /api/v1/auth/login")
            
        except ValueError as e:
            print(f"Error: {e}")
            print("Admin user may already exist.")


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: poetry run python scripts/create_admin.py <email> <password> <org_name>")
        print('Example: poetry run python scripts/create_admin.py admin@example.com secretpass123 "Test University"')
        sys.exit(1)
    
    email = sys.argv[1]
    password = sys.argv[2]
    org_name = sys.argv[3]
    
    if len(password) < 8:
        print("Error: Password must be at least 8 characters")
        sys.exit(1)
    
    asyncio.run(main(email, password, org_name))
