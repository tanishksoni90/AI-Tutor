"""Add auth fields to student

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2025-12-29

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add authentication fields to students table."""
    # Add hashed_password column (required, but we'll add with a default first)
    op.add_column('students', sa.Column('hashed_password', sa.String(), nullable=True))
    op.add_column('students', sa.Column('role', sa.String(), server_default='student', nullable=False))
    op.add_column('students', sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('students', sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True))
    
    # Update existing rows with a placeholder password hash (they'll need to reset)
    # This is bcrypt hash of 'changeme123'
    op.execute("UPDATE students SET hashed_password = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYWWQIqjSXvy' WHERE hashed_password IS NULL")
    
    # Now make hashed_password non-nullable
    op.alter_column('students', 'hashed_password', nullable=False)


def downgrade() -> None:
    """Remove authentication fields from students table."""
    op.drop_column('students', 'created_at')
    op.drop_column('students', 'is_active')
    op.drop_column('students', 'role')
    op.drop_column('students', 'hashed_password')
