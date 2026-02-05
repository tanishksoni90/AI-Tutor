"""add_invitation_fields_to_student

Revision ID: 3ee40869684c
Revises: c3d4e5f6a7b8
Create Date: 2026-02-04 15:52:11.451817

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '3ee40869684c'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add invitation fields to students table."""
    # Add invitation columns
    op.add_column('students', sa.Column('invitation_token', sa.String(length=64), nullable=True))
    op.add_column('students', sa.Column('invitation_status', sa.String(), server_default='active', nullable=False))
    op.add_column('students', sa.Column('invitation_expires_at', sa.DateTime(timezone=True), nullable=True))
    
    # Create unique index on invitation_token
    op.create_unique_constraint('uq_students_invitation_token', 'students', ['invitation_token'])
    
    # Make hashed_password nullable (for pending invitations)
    op.alter_column('students', 'hashed_password', nullable=True)


def downgrade() -> None:
    """Remove invitation fields from students table."""
    # Make hashed_password non-nullable again
    op.alter_column('students', 'hashed_password', nullable=False)
    
    # Drop unique constraint
    op.drop_constraint('uq_students_invitation_token', 'students', type_='unique')
    
    # Drop invitation columns
    op.drop_column('students', 'invitation_expires_at')
    op.drop_column('students', 'invitation_status')
    op.drop_column('students', 'invitation_token')
