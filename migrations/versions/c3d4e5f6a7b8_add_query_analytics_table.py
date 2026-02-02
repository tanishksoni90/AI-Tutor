"""Add query analytics table for hybrid memory approach

Revision ID: c3d4e5f6a7b8
Revises: a7e80d9b3edf
Create Date: 2026-02-02 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'a7e80d9b3edf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create query_analytics table for long-term analytics storage
    op.create_table(
        'query_analytics',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('student_id', UUID(as_uuid=True), sa.ForeignKey('students.id'), nullable=True),
        sa.Column('course_id', UUID(as_uuid=True), sa.ForeignKey('courses.id'), nullable=False),
        sa.Column('session_token', sa.String(64), nullable=True),
        sa.Column('query_topic', sa.String(255), nullable=True),
        sa.Column('query_length', sa.Integer, nullable=False),
        sa.Column('response_length', sa.Integer, nullable=False),
        sa.Column('confidence_score', sa.Integer, nullable=True),
        sa.Column('sources_count', sa.Integer, server_default=sa.text('0'), nullable=False),
        sa.Column('sources_used', sa.Text, nullable=True),
        sa.Column('was_hallucination_detected', sa.Boolean, server_default=sa.text('false'), nullable=False),
        sa.Column('was_assignment_blocked', sa.Boolean, server_default=sa.text('false'), nullable=False),
        sa.Column('context_messages_count', sa.Integer, server_default=sa.text('0'), nullable=False),
        sa.Column('response_time_ms', sa.Integer, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    
    # Create indexes for common queries
    op.create_index('ix_query_analytics_course_id', 'query_analytics', ['course_id'])
    op.create_index('ix_query_analytics_student_id', 'query_analytics', ['student_id'])
    op.create_index('ix_query_analytics_created_at', 'query_analytics', ['created_at'])
    op.create_index('ix_query_analytics_session_token', 'query_analytics', ['session_token'])


def downgrade() -> None:
    op.drop_index('ix_query_analytics_session_token', 'query_analytics')
    op.drop_index('ix_query_analytics_created_at', 'query_analytics')
    op.drop_index('ix_query_analytics_student_id', 'query_analytics')
    op.drop_index('ix_query_analytics_course_id', 'query_analytics')
    op.drop_table('query_analytics')
