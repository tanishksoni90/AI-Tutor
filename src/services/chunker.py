"""
Hierarchical, Slide-Aware Chunking Service

Key rules:
- One slide = one primary semantic unit
- If slide text is short → keep as single chunk
- If slide text is long → split within slide only
- Never split bullet groups mid-way
- Always include slide context in chunk text

Chunk parameters:
- Target size: 300-600 tokens (~1200-2400 chars)
- Overlap: 0-10% (often 0 for slides)
"""
from dataclasses import dataclass
from typing import List, Optional
from uuid import UUID
import logging

from src.services.pdf_parser import SlideContent

logger = logging.getLogger(__name__)

# Approximate: 1 token ≈ 4 characters for English
CHARS_PER_TOKEN = 4
MIN_CHUNK_TOKENS = 300
MAX_CHUNK_TOKENS = 600
MIN_CHUNK_CHARS = MIN_CHUNK_TOKENS * CHARS_PER_TOKEN  # 1200
MAX_CHUNK_CHARS = MAX_CHUNK_TOKENS * CHARS_PER_TOKEN  # 2400


@dataclass
class ChunkData:
    """Represents a single chunk ready for storage."""
    chunk_index: int
    text: str
    slide_number: int
    slide_title: Optional[str]
    session_id: Optional[str]
    assignment_allowed: bool


class SlideAwareChunker:
    """
    Chunks slide content with semantic awareness.
    
    Strategy:
    1. Process each slide independently
    2. If slide fits in one chunk → single chunk
    3. If slide is too long → split at paragraph/bullet boundaries
    4. Always prepend slide context (title) to each chunk
    """
    
    def __init__(
        self,
        min_chunk_chars: int = MIN_CHUNK_CHARS,
        max_chunk_chars: int = MAX_CHUNK_CHARS,
        include_title_in_chunk: bool = True
    ):
        self.min_chunk_chars = min_chunk_chars
        self.max_chunk_chars = max_chunk_chars
        self.include_title_in_chunk = include_title_in_chunk
    
    def chunk_slides(
        self,
        slides: List[SlideContent],
        session_id: Optional[str] = None,
        assignment_allowed: bool = True
    ) -> List[ChunkData]:
        """
        Convert slides into chunks.
        
        Args:
            slides: List of SlideContent from PDF parser
            session_id: Optional session identifier (e.g., "Week 1")
            assignment_allowed: Whether chunks can be used for assignments
            
        Returns:
            List of ChunkData ready for storage
        """
        chunks = []
        chunk_index = 0
        
        for slide in slides:
            slide_chunks = self._chunk_slide(
                slide=slide,
                start_index=chunk_index,
                session_id=session_id,
                assignment_allowed=assignment_allowed
            )
            chunks.extend(slide_chunks)
            chunk_index += len(slide_chunks)
        
        return chunks
    
    def _chunk_slide(
        self,
        slide: SlideContent,
        start_index: int,
        session_id: Optional[str],
        assignment_allowed: bool
    ) -> List[ChunkData]:
        """Process a single slide into one or more chunks."""
        
        # Build the full slide text with context
        context_prefix = self._build_context_prefix(slide)
        full_text = slide.text.strip()
        
        if not full_text:
            # Empty slide - skip or create minimal chunk
            if slide.title:
                return [ChunkData(
                    chunk_index=start_index,
                    text=context_prefix.strip(),
                    slide_number=slide.slide_number,
                    slide_title=slide.title,
                    session_id=session_id,
                    assignment_allowed=assignment_allowed
                )]
            return []
        
        # Check if slide fits in single chunk
        total_text = context_prefix + full_text if self.include_title_in_chunk else full_text
        
        if len(total_text) <= self.max_chunk_chars:
            return [ChunkData(
                chunk_index=start_index,
                text=total_text,
                slide_number=slide.slide_number,
                slide_title=slide.title,
                session_id=session_id,
                assignment_allowed=assignment_allowed
            )]
        
        # Slide is too long - split at semantic boundaries
        return self._split_long_slide(
            slide=slide,
            context_prefix=context_prefix,
            start_index=start_index,
            session_id=session_id,
            assignment_allowed=assignment_allowed
        )
    
    def _split_long_slide(
        self,
        slide: SlideContent,
        context_prefix: str,
        start_index: int,
        session_id: Optional[str],
        assignment_allowed: bool
    ) -> List[ChunkData]:
        """Split a long slide into multiple chunks at semantic boundaries."""
        chunks = []
        
        # Split by paragraphs (double newline) or single newlines
        paragraphs = self._split_into_paragraphs(slide.text)
        
        current_chunk_text = context_prefix if self.include_title_in_chunk else ""
        chunk_idx = start_index
        
        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
            
            # Check if adding this paragraph exceeds max
            test_text = current_chunk_text + "\n\n" + para if current_chunk_text else para
            
            if len(test_text) > self.max_chunk_chars and current_chunk_text:
                # Save current chunk and start new one
                chunks.append(ChunkData(
                    chunk_index=chunk_idx,
                    text=current_chunk_text.strip(),
                    slide_number=slide.slide_number,
                    slide_title=slide.title,
                    session_id=session_id,
                    assignment_allowed=assignment_allowed
                ))
                chunk_idx += 1
                
                # Start new chunk with context
                current_chunk_text = context_prefix + para if self.include_title_in_chunk else para
            else:
                current_chunk_text = test_text
        
        # Don't forget the last chunk
        if current_chunk_text.strip():
            chunks.append(ChunkData(
                chunk_index=chunk_idx,
                text=current_chunk_text.strip(),
                slide_number=slide.slide_number,
                slide_title=slide.title,
                session_id=session_id,
                assignment_allowed=assignment_allowed
            ))
        
        return chunks
    
    def _split_into_paragraphs(self, text: str) -> List[str]:
        """
        Split text into paragraphs, preserving bullet groups.
        
        Strategy:
        - Split on double newlines first
        - If still too long, split on single newlines
        - Never split mid-bullet-group
        """
        # First try double newline split
        paragraphs = text.split("\n\n")
        
        result = []
        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
                
            if len(para) <= self.max_chunk_chars:
                result.append(para)
            else:
                # Paragraph too long - split by lines but keep bullet groups
                result.extend(self._split_preserving_bullets(para))
        
        return result
    
    def _split_preserving_bullets(self, text: str) -> List[str]:
        """Split text while keeping bullet point groups together."""
        lines = text.split("\n")
        result = []
        current_group = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            is_bullet = self._is_bullet_line(line)
            
            if is_bullet:
                current_group.append(line)
            else:
                # Non-bullet line - flush bullet group if exists
                if current_group:
                    result.append("\n".join(current_group))
                    current_group = []
                result.append(line)
        
        # Flush remaining bullets
        if current_group:
            result.append("\n".join(current_group))
        
        return result
    
    def _is_bullet_line(self, line: str) -> bool:
        """Check if line is a bullet point."""
        bullet_markers = ["•", "-", "–", "—", "*", "►", "▪", "○", "●"]
        if line and line[0].isdigit() and len(line) > 1 and line[1] in ".):":
            return True
        return any(line.startswith(marker) for marker in bullet_markers)
    
    def _build_context_prefix(self, slide: SlideContent) -> str:
        """Build context prefix for chunk."""
        parts = []
        
        if slide.title:
            parts.append(f"[Slide {slide.slide_number}: {slide.title}]")
        else:
            parts.append(f"[Slide {slide.slide_number}]")
        
        if parts:
            return "\n".join(parts) + "\n\n"
        return ""
