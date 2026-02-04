import asyncio
from sqlalchemy import text
from src.db.session import engine

async def check_db():
    async with engine.connect() as conn:
        # Check documents
        result = await conn.execute(text('SELECT id, course_id, session_id FROM documents LIMIT 5'))
        rows = result.fetchall()
        print('Documents:')
        for row in rows:
            print(f'  {row}')
        
        # Check document_chunks for session_id
        result = await conn.execute(text('SELECT id, course_id, session_id FROM document_chunks LIMIT 5'))
        rows = result.fetchall()
        print('\nDocument Chunks:')
        for row in rows:
            print(f'  {row}')
            
        # Check courses
        result = await conn.execute(text('SELECT id, name, total_sessions FROM courses'))
        rows = result.fetchall()
        print('\nCourses:')
        for row in rows:
            print(f'  {row}')

asyncio.run(check_db())
