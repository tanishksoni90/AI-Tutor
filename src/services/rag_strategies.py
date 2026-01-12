"""
RAG Strategy Selector - Adaptive retrieval strategies based on course characteristics.

ARCHITECTURE DECISION:
- SINGLE unified RAG system
- Adaptive behavior based on course metadata
- Strategy pattern for extensibility

Course-Adaptive Strategies:
1. MICRO courses (20-30 sessions):
   - Simple semantic search (fast, lightweight)
   - Lower top_k (3-5 chunks)
   - No reranking needed (small corpus)
   
2. CERTIFICATION courses (200+ sessions):
   - Multi-stage retrieval (semantic → rerank)
   - Query expansion for better recall
   - Higher top_k (10-15 chunks) with reranking to 5
   - Hierarchical filtering (session → slide → chunk)
   
3. STANDARD courses (30-100 sessions):
   - Balanced approach
   - Optional reranking based on query complexity
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional
from uuid import UUID
import logging

from src.db.models import CourseType

logger = logging.getLogger(__name__)


@dataclass
class RAGStrategyConfig:
    """Configuration for RAG retrieval strategy."""
    course_type: CourseType
    total_chunks: int
    
    # Retrieval parameters
    initial_top_k: int
    final_top_k: int
    use_reranking: bool
    use_query_expansion: bool
    use_hierarchical_filter: bool
    
    # Performance tuning
    enable_caching: bool
    max_context_tokens: int


class RAGStrategy(ABC):
    """Base class for RAG retrieval strategies."""
    
    @abstractmethod
    def get_config(self, total_chunks: int) -> RAGStrategyConfig:
        """Get strategy configuration based on course size."""
        pass
    
    @abstractmethod
    def should_expand_query(self, query: str) -> bool:
        """Determine if query should be expanded."""
        pass
    
    @abstractmethod
    def should_use_hierarchical(self, session_filter: Optional[str]) -> bool:
        """Determine if hierarchical retrieval should be used."""
        pass


class MicroCourseStrategy(RAGStrategy):
    """
    Strategy for small courses (20-30 sessions, ~100-300 chunks).
    
    Philosophy: Keep it simple and fast.
    - Small corpus → no reranking needed
    - Direct semantic search is sufficient
    - Lower latency is more important than marginal quality gains
    """
    
    def get_config(self, total_chunks: int) -> RAGStrategyConfig:
        return RAGStrategyConfig(
            course_type=CourseType.MICRO,
            total_chunks=total_chunks,
            initial_top_k=5,
            final_top_k=5,
            use_reranking=False,  # Not needed for small corpus
            use_query_expansion=False,  # Would add noise
            use_hierarchical_filter=False,  # Overhead not justified
            enable_caching=True,  # Small corpus → good cache hit rate
            max_context_tokens=2000  # Smaller context window
        )
    
    def should_expand_query(self, query: str) -> bool:
        return False  # Keep queries focused for small corpus
    
    def should_use_hierarchical(self, session_filter: Optional[str]) -> bool:
        return False  # Direct retrieval is fast enough


class CertificationCourseStrategy(RAGStrategy):
    """
    Strategy for large courses (200+ sessions, ~2000-10000 chunks).
    
    Philosophy: Multi-stage retrieval for precision.
    - Large corpus → reranking essential (reduce false positives)
    - Query expansion → better recall across diverse content
    - Hierarchical → reduce search space first
    - Higher computational cost justified by quality gains
    """
    
    def get_config(self, total_chunks: int) -> RAGStrategyConfig:
        # Scale initial_top_k based on corpus size
        if total_chunks > 5000:
            initial_k = 20
        elif total_chunks > 2000:
            initial_k = 15
        else:
            initial_k = 10
            
        return RAGStrategyConfig(
            course_type=CourseType.CERTIFICATION,
            total_chunks=total_chunks,
            initial_top_k=initial_k,
            final_top_k=5,  # Rerank down to best 5
            use_reranking=True,  # CRITICAL for large corpus
            use_query_expansion=True,  # Better recall
            use_hierarchical_filter=True,  # Filter by session first
            enable_caching=False,  # Large diverse queries → low hit rate
            max_context_tokens=4000  # Larger context for comprehensive answers
        )
    
    def should_expand_query(self, query: str) -> bool:
        # Expand short/vague queries for better coverage
        return len(query.split()) < 8  # Short questions need expansion
    
    def should_use_hierarchical(self, session_filter: Optional[str]) -> bool:
        return session_filter is not None  # Use if session specified


class StandardCourseStrategy(RAGStrategy):
    """
    Strategy for medium courses (30-100 sessions, ~300-2000 chunks).
    
    Philosophy: Balanced approach.
    - Moderate corpus → selective reranking
    - Dynamic strategy based on query characteristics
    """
    
    def get_config(self, total_chunks: int) -> RAGStrategyConfig:
        # Decide reranking based on corpus size threshold
        use_reranking = total_chunks > 1000
        
        return RAGStrategyConfig(
            course_type=CourseType.STANDARD,
            total_chunks=total_chunks,
            initial_top_k=10 if use_reranking else 5,
            final_top_k=5,
            use_reranking=use_reranking,
            use_query_expansion=False,  # Only for large corpus
            use_hierarchical_filter=False,  # Overhead not worth it yet
            enable_caching=True,
            max_context_tokens=3000
        )
    
    def should_expand_query(self, query: str) -> bool:
        # Only expand very short queries
        return len(query.split()) < 5
    
    def should_use_hierarchical(self, session_filter: Optional[str]) -> bool:
        return False  # Keep it simple


class RAGStrategySelector:
    """
    Selects appropriate RAG strategy based on course characteristics.
    
    Usage:
        selector = RAGStrategySelector()
        config = selector.get_strategy(course_type, total_chunks)
    """
    
    def __init__(self):
        self.strategies = {
            CourseType.MICRO: MicroCourseStrategy(),
            CourseType.CERTIFICATION: CertificationCourseStrategy(),
            CourseType.STANDARD: StandardCourseStrategy()
        }
    
    def get_strategy(self, course_type: str, total_chunks: int) -> RAGStrategyConfig:
        """
        Get optimal RAG strategy configuration.
        
        Args:
            course_type: Type of course (micro/certification/standard)
            total_chunks: Total number of chunks in the course
            
        Returns:
            RAGStrategyConfig with optimized parameters
        """
        course_type_enum = CourseType(course_type)
        strategy = self.strategies.get(course_type_enum, self.strategies[CourseType.STANDARD])
        
        config = strategy.get_config(total_chunks)
        
        logger.info(
            f"Selected RAG strategy: {course_type_enum.value} | "
            f"Total chunks: {total_chunks} | "
            f"Top-k: {config.initial_top_k}→{config.final_top_k} | "
            f"Reranking: {config.use_reranking} | "
            f"Query expansion: {config.use_query_expansion}"
        )
        
        return config
    
    def should_expand_query(self, course_type: str, query: str) -> bool:
        """Check if query should be expanded."""
        course_type_enum = CourseType(course_type)
        strategy = self.strategies.get(course_type_enum, self.strategies[CourseType.STANDARD])
        return strategy.should_expand_query(query)
    
    def should_use_hierarchical(
        self, 
        course_type: str, 
        session_filter: Optional[str]
    ) -> bool:
        """Check if hierarchical filtering should be used."""
        course_type_enum = CourseType(course_type)
        strategy = self.strategies.get(course_type_enum, self.strategies[CourseType.STANDARD])
        return strategy.should_use_hierarchical(session_filter)


# ============================================================================
# RECOMMENDED RAG TECHNIQUES FOR YOUR USE CASE
# ============================================================================

"""
PRIORITY 1 - IMPLEMENT IMMEDIATELY:
--------------------------------

1. ✅ RERANKING (for Certification courses)
   - Why: 200+ sessions = 2000-5000 chunks
   - Problem: Top-k semantic search has false positives at scale
   - Solution: Retrieve 15-20 chunks, rerank to best 5
   - Implementation: Cross-encoder model (sentence-transformers)
   - Impact: ~20-30% improvement in precision
   - Cost: +200ms latency (acceptable for quality gain)

2. ✅ QUERY EXPANSION (for Certification courses)
   - Why: Large corpus needs better recall
   - Problem: Student query may not match exact terminology
   - Solution: Generate 2-3 query variations using LLM
   - Example: "How does TCP work?" → ["TCP protocol mechanism", 
              "Transmission Control Protocol functionality", 
              "TCP connection establishment"]
   - Implementation: Simple LLM prompt before retrieval
   - Impact: ~15-25% improvement in recall
   - Cost: +300ms latency (one LLM call)

3. ✅ HIERARCHICAL RETRIEVAL (when session specified)
   - Why: Students often know "this was in Week 5"
   - Problem: Searching entire corpus when session is known
   - Solution: Filter by session_id BEFORE semantic search
   - Implementation: Already have session_id in metadata!
   - Impact: 10x faster search, better precision
   - Cost: Negligible (just metadata filter)


PRIORITY 2 - IMPLEMENT WITHIN 2-4 WEEKS:
----------------------------------------

4. ⚠️ CONTEXTUAL CHUNKING (for better context)
   - Why: Current chunks lack surrounding context
   - Problem: Chunk may reference "this concept" without defining it
   - Solution: Prepend 1-2 sentences from previous chunk as context
   - Example: Chunk starts with "This approach..." → 
              Add context: "After discussing BFS, this approach..."
   - Implementation: Modify chunker to include overlap/context
   - Impact: ~10-15% better LLM understanding
   - Cost: Minimal (just chunk processing logic)

5. ⚠️ SELF-REFLECTIVE RAG (for quality assurance)
   - Why: Sometimes retrieval fails (no relevant chunks found)
   - Problem: LLM hallucinates when chunks don't answer question
   - Solution: LLM first checks "Can I answer with this context?"
   - Implementation: Add validation step before generation
   - Impact: Reduces hallucinations by ~40%
   - Cost: +200ms latency (worth it for safety)


PRIORITY 3 - CONSIDER FOR FUTURE:
----------------------------------

6. 🔵 KNOWLEDGE GRAPH (for structured relationships)
   - Why: Course concepts have explicit relationships
   - Problem: Semantic search misses logical connections
   - Solution: Build graph: Concept A → prerequisite for → Concept B
   - Use case: "What should I learn before studying X?"
   - Implementation: Neo4j + concept extraction from slides
   - Impact: New capabilities (prerequisite chains, concept maps)
   - Cost: High (new infrastructure, extraction pipeline)
   - Verdict: DEFER - Nice to have, not critical for MVP

7. 🔵 FINE-TUNED EMBEDDINGS (domain-specific)
   - Why: General embeddings may miss domain terminology
   - Problem: "Dijkstra" and "shortest path" should be close
   - Solution: Fine-tune embedding model on course content
   - Implementation: Collect query-chunk pairs, retrain
   - Impact: ~5-10% improvement (diminishing returns)
   - Cost: High (training infrastructure, data collection)
   - Verdict: DEFER - Use Gemini embeddings first, optimize later

8. 🔵 LATE CHUNKING (chunk after embedding)
   - Why: Embedding full context preserves semantics
   - Problem: Chunking before embedding loses context
   - Solution: Embed full slides, then chunk for retrieval
   - Implementation: Requires custom embedding pipeline
   - Impact: ~5-8% improvement (theoretical)
   - Cost: High (complex implementation)
   - Verdict: DEFER - Marginal gains, high complexity


NOT RECOMMENDED FOR YOUR USE CASE:
-----------------------------------

❌ AGENTIC RAG
   - Why: Adds complexity without clear benefit
   - Your case: Fixed retrieval pattern (course content lookup)
   - Agent would add: Latency, unpredictability, cost
   - Verdict: SKIP - Over-engineering for your use case

❌ MULTI-QUERY RAG (parallel queries)
   - Why: Query expansion is simpler and sufficient
   - Your case: Single-turn Q&A, not research synthesis
   - Multi-query adds: Parallelization complexity, cost
   - Verdict: SKIP - Use query expansion instead


IMPLEMENTATION ROADMAP:
-----------------------

Week 1-2: 
  ✅ Add course_type to Course model (DONE above)
  ✅ Implement RAGStrategySelector (DONE above)
  ✅ Add reranking for certification courses

Week 3-4:
  ✅ Implement query expansion
  ✅ Enhance hierarchical filtering

Week 5-6:
  ⚠️ Add contextual chunking
  ⚠️ Implement self-reflective validation

Week 7-8:
  📊 A/B test strategies
  📊 Measure metrics (latency, precision, recall)
  📊 Tune thresholds based on real usage
"""
