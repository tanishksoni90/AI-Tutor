"""
Reranking Service - Cross-encoder reranking for improved precision.

Why Reranking Matters:
- Semantic search (bi-encoder) is FAST but has false positives
- Cross-encoder is SLOW but highly accurate
- Strategy: Bi-encoder (retrieve 15-20) → Cross-encoder (rerank to 5)

Performance:
- Bi-encoder: ~50ms for 10k chunks
- Cross-encoder: ~200ms for 20 chunks
- Total: ~250ms (acceptable for quality gain)

Use Cases:
- ALWAYS use for certification courses (large corpus)
- OPTIONAL for standard courses (>1000 chunks)
- SKIP for micro courses (overhead not justified)
"""
import logging
from dataclasses import dataclass
from typing import List, Optional
import asyncio

logger = logging.getLogger(__name__)


@dataclass
class RankedChunk:
    """A chunk with relevance score."""
    chunk_id: str
    score: float
    text_preview: str
    original_rank: int  # Position before reranking


class RerankerService:
    """
    Reranks retrieved chunks using cross-encoder for better precision.
    
    Models (options):
    1. sentence-transformers/ms-marco-MiniLM-L-12-v2 (fast, good)
    2. BAAI/bge-reranker-base (better, slower)
    3. Gemini API reranking (cloud-based, pay-per-use)
    
    Current: Using Gemini API for simplicity (no local model management)
    Future: Consider local cross-encoder for cost optimization
    """
    
    def __init__(
        self,
        model_name: str = "gemini-reranker",  # Placeholder
        enable_caching: bool = True
    ):
        self.model_name = model_name
        self.enable_caching = enable_caching
        self._cache = {} if enable_caching else None
        logger.info(f"Initialized RerankerService: model={model_name}")
    
    async def rerank(
        self,
        query: str,
        chunks: List[dict],
        top_k: int = 5
    ) -> List[RankedChunk]:
        """
        Rerank chunks by relevance to query.
        
        Args:
            query: User's question
            chunks: Retrieved chunks from vector search
            top_k: Number of top chunks to return
            
        Returns:
            Top-k chunks sorted by relevance score
        """
        if not chunks:
            return []
        
        # Check cache
        cache_key = f"{query}:{len(chunks)}"
        if self.enable_caching and cache_key in self._cache:
            logger.debug(f"Reranking cache hit: {cache_key}")
            return self._cache[cache_key][:top_k]
        
        # Score each chunk
        scored_chunks = []
        for idx, chunk in enumerate(chunks):
            score = await self._compute_relevance_score(query, chunk)
            scored_chunks.append(RankedChunk(
                chunk_id=chunk.get("chunk_id", ""),
                score=score,
                text_preview=chunk.get("text_preview", "")[:200],
                original_rank=idx
            ))
        
        # Sort by score (descending)
        scored_chunks.sort(key=lambda x: x.score, reverse=True)
        
        # Cache result
        if self.enable_caching:
            self._cache[cache_key] = scored_chunks
        
        result = scored_chunks[:top_k]
        
        # Log reranking impact
        self._log_reranking_impact(scored_chunks, top_k)
        
        return result
    
    async def _compute_relevance_score(self, query: str, chunk: dict) -> float:
        """
        Compute relevance score using cross-encoder.
        
        For now, using a simple heuristic:
        - Keyword overlap (TF-IDF-like)
        - Length penalty (prefer concise chunks)
        - Slide title match bonus
        
        TODO: Replace with actual cross-encoder model
        """
        text = chunk.get("text_preview", "").lower()
        query_lower = query.lower()
        slide_title = chunk.get("slide_title", "").lower()
        
        # 1. Keyword overlap score
        query_words = set(query_lower.split())
        text_words = set(text.split())
        overlap = len(query_words & text_words)
        keyword_score = overlap / max(len(query_words), 1)
        
        # 2. Slide title match (strong signal)
        title_bonus = 0.3 if any(word in slide_title for word in query_words) else 0
        
        # 3. Length penalty (prefer chunks that are focused)
        length_penalty = 1.0 / (1.0 + len(text) / 1000)  # Penalize very long chunks
        
        # 4. Original vector search score (from Qdrant)
        vector_score = chunk.get("score", 0.5)
        
        # Combine scores (weighted)
        final_score = (
            0.4 * vector_score +       # Vector search confidence
            0.3 * keyword_score +       # Keyword relevance
            0.2 * title_bonus +         # Slide title match
            0.1 * length_penalty        # Prefer focused chunks
        )
        
        return final_score
    
    def _log_reranking_impact(self, all_chunks: List[RankedChunk], top_k: int):
        """Log how much reranking changed the ranking."""
        if not all_chunks or len(all_chunks) <= top_k:
            return
        
        # Count how many in top-k were NOT in original top-k
        top_k_chunks = all_chunks[:top_k]
        original_top_k_ranks = {chunk.original_rank for chunk in top_k_chunks}
        
        promoted_count = sum(1 for rank in original_top_k_ranks if rank >= top_k)
        
        if promoted_count > 0:
            logger.info(
                f"Reranking promoted {promoted_count}/{top_k} chunks "
                f"that were ranked #{top_k}+ by vector search"
            )


# ============================================================================
# FUTURE: Advanced Cross-Encoder Implementation
# ============================================================================

class CrossEncoderReranker(RerankerService):
    """
    Production-grade reranker using sentence-transformers cross-encoder.
    
    Installation:
        pip install sentence-transformers
    
    Usage:
        reranker = CrossEncoderReranker()
        ranked = await reranker.rerank(query, chunks, top_k=5)
    
    DEFER: Implement when reranking becomes bottleneck
    """
    
    def __init__(self, model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"):
        super().__init__(model_name=model_name)
        # Lazy import to avoid dependency if not used
        try:
            from sentence_transformers import CrossEncoder
            self.model = CrossEncoder(model_name)
            logger.info(f"Loaded cross-encoder: {model_name}")
        except ImportError:
            logger.warning(
                "sentence-transformers not installed. "
                "Using fallback reranker. "
                "Install: pip install sentence-transformers"
            )
            self.model = None
    
    async def _compute_relevance_score(self, query: str, chunk: dict) -> float:
        """Compute score using actual cross-encoder model."""
        if self.model is None:
            # Fallback to parent implementation
            return await super()._compute_relevance_score(query, chunk)
        
        text = chunk.get("text_preview", "")
        
        # Cross-encoder takes pairs: [[query, text1], [query, text2], ...]
        # Returns relevance score
        score = self.model.predict([[query, text]])[0]
        
        return float(score)


# ============================================================================
# Example Usage
# ============================================================================

"""
# In retrieval.py:

from src.services.reranking import RerankerService
from src.services.rag_strategies import RAGStrategySelector

async def retrieve_with_reranking(request: RetrievalRequest, course_type: str, total_chunks: int):
    # 1. Get adaptive strategy
    selector = RAGStrategySelector()
    config = selector.get_strategy(course_type, total_chunks)
    
    # 2. Initial retrieval (higher top_k)
    chunks = await vector_search(
        query=request.query,
        top_k=config.initial_top_k  # e.g., 15 for certification
    )
    
    # 3. Rerank if enabled
    if config.use_reranking:
        reranker = RerankerService()
        ranked_chunks = await reranker.rerank(
            query=request.query,
            chunks=chunks,
            top_k=config.final_top_k  # e.g., 5
        )
        return ranked_chunks
    else:
        return chunks[:config.final_top_k]
"""
