"""
Embedding Service - Abstracted wrapper for embedding generation.

Supports:
- Gemini embedding API (gemini-embedding-001)
- Batch processing with rate limiting
- Model swappable via config

Design:
- Abstract base class for future model swaps
- Explicit error handling
- Logging for debugging
"""
import asyncio
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional
import google.generativeai as genai

from src.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class EmbeddingResult:
    """Result of embedding generation."""
    text: str
    vector: List[float]
    model: str
    dimensions: int


class EmbeddingService(ABC):
    """Abstract base class for embedding services."""
    
    @abstractmethod
    async def embed_text(self, text: str) -> EmbeddingResult:
        """Generate embedding for a single text."""
        pass
    
    @abstractmethod
    async def embed_batch(self, texts: List[str]) -> List[EmbeddingResult]:
        """Generate embeddings for multiple texts."""
        pass
    
    @property
    @abstractmethod
    def model_name(self) -> str:
        pass
    
    @property
    @abstractmethod
    def dimensions(self) -> int:
        pass


class GeminiEmbeddingService(EmbeddingService):
    """
    Gemini embedding implementation using gemini-embedding-001.
    
    Features:
    - Configurable output dimensions (768, 1536, 3072)
    - Batch processing with configurable batch size
    - Rate limiting to avoid API throttling
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        dimensions: Optional[int] = None,
        batch_size: int = 100,
        requests_per_minute: int = 1500
    ):
        self._api_key = api_key or settings.GEMINI_API_KEY
        self._model = model or settings.EMBEDDING_MODEL
        self._dimensions = dimensions or settings.EMBEDDING_DIM
        self._batch_size = batch_size
        self._requests_per_minute = requests_per_minute
        self._min_delay = 60.0 / requests_per_minute  # Delay between requests
        
        # Configure Gemini
        genai.configure(api_key=self._api_key)
        
        logger.info(f"Initialized GeminiEmbeddingService: model={self._model}, dims={self._dimensions}")
    
    @property
    def model_name(self) -> str:
        return self._model
    
    @property
    def dimensions(self) -> int:
        return self._dimensions
    
    async def embed_text(self, text: str) -> EmbeddingResult:
        """Generate embedding for a single text."""
        if not text or not text.strip():
            raise ValueError("Cannot embed empty text")
        
        try:
            # Gemini embedding API call
            result = await asyncio.to_thread(
                genai.embed_content,
                model=f"models/{self._model}",
                content=text,
                output_dimensionality=self._dimensions
            )
            
            vector = result['embedding']
            
            return EmbeddingResult(
                text=text,
                vector=vector,
                model=self._model,
                dimensions=len(vector)
            )
            
        except Exception as e:
            logger.error(f"Failed to embed text: {str(e)[:100]}...")
            raise
    
    async def embed_batch(self, texts: List[str]) -> List[EmbeddingResult]:
        """
        Generate embeddings for multiple texts with rate limiting.
        
        Processes in batches to avoid API limits.
        """
        if not texts:
            return []
        
        results = []
        total = len(texts)
        
        for i in range(0, total, self._batch_size):
            batch = texts[i:i + self._batch_size]
            batch_num = (i // self._batch_size) + 1
            total_batches = (total + self._batch_size - 1) // self._batch_size
            
            logger.info(f"Processing batch {batch_num}/{total_batches} ({len(batch)} texts)")
            
            batch_results = await self._embed_batch_internal(batch)
            results.extend(batch_results)
            
            # Rate limiting delay between batches
            if i + self._batch_size < total:
                await asyncio.sleep(self._min_delay * len(batch))
        
        return results
    
    async def _embed_batch_internal(self, texts: List[str]) -> List[EmbeddingResult]:
        """Internal batch embedding with Gemini's batch API."""
        try:
            # Gemini supports batch embedding
            result = await asyncio.to_thread(
                genai.embed_content,
                model=f"models/{self._model}",
                content=texts,
                output_dimensionality=self._dimensions
            )
            
            embeddings = result['embedding']
            
            return [
                EmbeddingResult(
                    text=text,
                    vector=vector,
                    model=self._model,
                    dimensions=len(vector)
                )
                for text, vector in zip(texts, embeddings)
            ]
            
        except Exception as e:
            logger.error(f"Batch embedding failed: {str(e)}")
            # Fallback to individual embedding on batch failure
            logger.info("Falling back to individual embedding...")
            results = []
            for text in texts:
                try:
                    result = await self.embed_text(text)
                    results.append(result)
                    await asyncio.sleep(self._min_delay)
                except Exception as inner_e:
                    logger.error(f"Individual embed failed: {str(inner_e)[:50]}")
                    raise
            return results


# Factory function for dependency injection
def get_embedding_service() -> EmbeddingService:
    """Get the configured embedding service."""
    return GeminiEmbeddingService()
