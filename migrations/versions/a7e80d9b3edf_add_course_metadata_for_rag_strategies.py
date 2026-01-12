"""add_course_metadata_for_rag_strategies

Revision ID: a7e80d9b3edf
Revises: b2c3d4e5f6a7
Create Date: 2026-01-12 12:38:58.238179

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7e80d9b3edf'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Add course metadata for adaptive RAG strategies."""
    # Add course metadata columns
    op.add_column('courses', sa.Column('course_type', sa.String(), nullable=False, server_default='standard'))
    op.add_column('courses', sa.Column('total_sessions', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('courses', sa.Column('total_chunks', sa.Integer(), nullable=False, server_default='0'))
    
    # Backfill total_chunks for existing courses
    # This will be updated by ingestion service going forward
    op.execute("""
        UPDATE courses
        SET total_chunks = (
            SELECT COUNT(*) 
            FROM document_chunks 
            WHERE document_chunks.course_id = courses.id
        )
    """)
    
    # Backfill total_sessions for existing courses
    op.execute("""
        UPDATE courses
        SET total_sessions = (
            SELECT COUNT(DISTINCT session_id)
            FROM documents
            WHERE documents.course_id = courses.id
              AND session_id IS NOT NULL
        )
    """)
    
    # Infer course_type based on document count
    op.execute("""
        UPDATE courses
        SET course_type = CASE
            WHEN (SELECT COUNT(*) FROM documents WHERE course_id = courses.id) < 30 
                THEN 'micro'
            WHEN (SELECT COUNT(*) FROM documents WHERE course_id = courses.id) > 150 
                THEN 'certification'
            ELSE 'standard'
        END
    """)


def downgrade() -> None:
    """Downgrade schema - Remove course metadata columns."""
    op.drop_column('courses', 'total_chunks')
    op.drop_column('courses', 'total_sessions')
    op.drop_column('courses', 'course_type')
