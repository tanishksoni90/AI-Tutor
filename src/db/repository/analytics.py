"""
Analytics Repository - Long-term storage for query analytics.
Stores metadata only, not full conversation text.
"""
import json
from uuid import UUID
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy import select, func, and_, Integer
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import QueryAnalytics, Course
from src.db.repository.base import BaseRepository


class AnalyticsRepository(BaseRepository[QueryAnalytics]):
    """Repository for query analytics operations."""
    
    def __init__(self, session: AsyncSession):
        super().__init__(QueryAnalytics, session)
    
    async def log_query(
        self,
        course_id: UUID,
        query_length: int,
        response_length: int,
        student_id: Optional[UUID] = None,
        session_token: Optional[str] = None,
        query_topic: Optional[str] = None,
        confidence_score: Optional[int] = None,
        sources: Optional[List[Dict[str, Any]]] = None,
        was_hallucination_detected: bool = False,
        was_assignment_blocked: bool = False,
        context_messages_count: int = 0,
        response_time_ms: Optional[int] = None,
    ) -> QueryAnalytics:
        """
        Log a query for analytics.
        
        Args:
            course_id: The course being queried
            query_length: Character count of the question
            response_length: Character count of the response
            student_id: Optional student ID (can be None for privacy)
            session_token: Anonymous session identifier
            query_topic: AI-extracted topic category
            confidence_score: Response confidence (0-100)
            sources: List of sources used [{"slide": 24, "title": "..."}]
            was_hallucination_detected: If self-reflection caught hallucination
            was_assignment_blocked: If assignment safety blocked the question
            context_messages_count: Number of previous messages in context
            response_time_ms: Response latency in milliseconds
        """
        analytics = QueryAnalytics(
            course_id=course_id,
            student_id=student_id,
            session_token=session_token,
            query_topic=query_topic,
            query_length=query_length,
            response_length=response_length,
            confidence_score=confidence_score,
            sources_count=len(sources) if sources else 0,
            sources_used=json.dumps(sources) if sources else None,
            was_hallucination_detected=was_hallucination_detected,
            was_assignment_blocked=was_assignment_blocked,
            context_messages_count=context_messages_count,
            response_time_ms=response_time_ms,
        )
        
        self.session.add(analytics)
        await self.session.commit()
        await self.session.refresh(analytics)
        return analytics
    
    async def get_course_stats(
        self,
        course_id: UUID,
        days: int = 30
    ) -> Dict[str, Any]:
        """Get aggregated statistics for a course."""
        since = datetime.utcnow() - timedelta(days=days)
        
        query = select(
            func.count(QueryAnalytics.id).label('total_queries'),
            func.avg(QueryAnalytics.confidence_score).label('avg_confidence'),
            func.avg(QueryAnalytics.response_time_ms).label('avg_response_time'),
            func.sum(func.cast(QueryAnalytics.was_hallucination_detected, Integer)).label('hallucinations'),
            func.sum(func.cast(QueryAnalytics.was_assignment_blocked, Integer)).label('blocked_queries'),
            func.count(func.distinct(QueryAnalytics.student_id)).label('unique_students'),
            func.count(func.distinct(QueryAnalytics.session_token)).label('unique_sessions'),
        ).where(
            and_(
                QueryAnalytics.course_id == course_id,
                QueryAnalytics.created_at >= since
            )
        )
        
        result = await self.session.execute(query)
        row = result.first()
        
        return {
            'total_queries': row.total_queries or 0,
            'avg_confidence': round(row.avg_confidence or 0, 1),
            'avg_response_time_ms': round(row.avg_response_time or 0),
            'hallucinations_caught': row.hallucinations or 0,
            'assignment_blocks': row.blocked_queries or 0,
            'unique_students': row.unique_students or 0,
            'unique_sessions': row.unique_sessions or 0,
            'period_days': days,
        }
    
    async def get_popular_topics(
        self,
        course_id: UUID,
        limit: int = 10,
        days: int = 30
    ) -> List[Dict[str, Any]]:
        """Get most queried topics for a course."""
        since = datetime.utcnow() - timedelta(days=days)
        
        query = select(
            QueryAnalytics.query_topic,
            func.count(QueryAnalytics.id).label('count'),
            func.avg(QueryAnalytics.confidence_score).label('avg_confidence')
        ).where(
            and_(
                QueryAnalytics.course_id == course_id,
                QueryAnalytics.created_at >= since,
                QueryAnalytics.query_topic.isnot(None)
            )
        ).group_by(QueryAnalytics.query_topic).order_by(
            func.count(QueryAnalytics.id).desc()
        ).limit(limit)
        
        result = await self.session.execute(query)
        
        return [
            {
                'topic': row.query_topic,
                'query_count': row.count,
                'avg_confidence': round(row.avg_confidence or 0, 1)
            }
            for row in result.all()
        ]
    
    async def get_daily_usage(
        self,
        course_id: UUID,
        days: int = 14
    ) -> List[Dict[str, Any]]:
        """Get daily query counts for a course."""
        since = datetime.utcnow() - timedelta(days=days)
        
        query = select(
            func.date(QueryAnalytics.created_at).label('date'),
            func.count(QueryAnalytics.id).label('queries'),
            func.count(func.distinct(QueryAnalytics.student_id)).label('students')
        ).where(
            and_(
                QueryAnalytics.course_id == course_id,
                QueryAnalytics.created_at >= since
            )
        ).group_by(func.date(QueryAnalytics.created_at)).order_by(
            func.date(QueryAnalytics.created_at)
        )
        
        result = await self.session.execute(query)
        
        return [
            {
                'date': str(row.date),
                'queries': row.queries,
                'unique_students': row.students
            }
            for row in result.all()
        ]
    
    async def get_low_confidence_queries(
        self,
        course_id: UUID,
        threshold: int = 70,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Get queries with low confidence scores (potential problem areas)."""
        query = select(
            QueryAnalytics.query_topic,
            QueryAnalytics.confidence_score,
            QueryAnalytics.sources_count,
            QueryAnalytics.created_at
        ).where(
            and_(
                QueryAnalytics.course_id == course_id,
                QueryAnalytics.confidence_score < threshold,
                QueryAnalytics.confidence_score.isnot(None)
            )
        ).order_by(QueryAnalytics.created_at.desc()).limit(limit)
        
        result = await self.session.execute(query)
        
        return [
            {
                'topic': row.query_topic,
                'confidence': row.confidence_score,
                'sources_found': row.sources_count,
                'timestamp': row.created_at.isoformat()
            }
            for row in result.all()
        ]
