"""Add slide metadata to document chunks

Revision ID: a1b2c3d4e5f6
Revises: 54e6eeabb697
Create Date: 2025-12-29

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '54e6eeabb697'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add slide_number and slide_title columns to document_chunks."""
    op.add_column('document_chunks', sa.Column('slide_number', sa.Integer(), nullable=True))
    op.add_column('document_chunks', sa.Column('slide_title', sa.String(), nullable=True))


def downgrade() -> None:
    """Remove slide metadata columns."""
    op.drop_column('document_chunks', 'slide_title')
    op.drop_column('document_chunks', 'slide_number')
