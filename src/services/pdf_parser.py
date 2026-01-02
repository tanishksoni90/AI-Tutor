"""
PDF Parser Service using PyMuPDF (fitz)
Optimized for slide deck extraction with layout preservation.
"""
import fitz  # PyMuPDF
from dataclasses import dataclass
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)


@dataclass
class SlideContent:
    """Represents extracted content from a single slide/page."""
    slide_number: int
    title: Optional[str]
    text: str
    bullet_points: List[str]
    raw_blocks: List[dict]  # For debugging/advanced use


class PDFParser:
    """
    Extracts structured content from PDF slide decks.
    
    Design decisions:
    - Each page = one slide
    - First large text block = slide title (heuristic)
    - Preserves bullet structure
    - Returns clean, structured data for chunking
    """
    
    def __init__(self, title_font_size_threshold: float = 14.0):
        self.title_font_size_threshold = title_font_size_threshold
    
    def parse(self, pdf_path: str) -> List[SlideContent]:
        """
        Parse a PDF file and extract slide content.
        
        Args:
            pdf_path: Path to the PDF file
            
        Returns:
            List of SlideContent objects, one per page
        """
        slides = []
        
        try:
            doc = fitz.open(pdf_path)
            
            for page_num, page in enumerate(doc, start=1):
                slide = self._extract_slide(page, page_num)
                slides.append(slide)
                
            doc.close()
            
        except Exception as e:
            logger.error(f"Failed to parse PDF {pdf_path}: {str(e)}")
            raise
            
        return slides
    
    def parse_bytes(self, pdf_bytes: bytes) -> List[SlideContent]:
        """
        Parse PDF from bytes (useful for S3/blob storage).
        
        Args:
            pdf_bytes: PDF file content as bytes
            
        Returns:
            List of SlideContent objects
        """
        slides = []
        
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            
            for page_num, page in enumerate(doc, start=1):
                slide = self._extract_slide(page, page_num)
                slides.append(slide)
                
            doc.close()
            
        except Exception as e:
            logger.error(f"Failed to parse PDF bytes: {str(e)}")
            raise
            
        return slides
    
    def _extract_slide(self, page: fitz.Page, page_num: int) -> SlideContent:
        """Extract content from a single page/slide."""
        blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]
        
        title = None
        text_parts = []
        bullet_points = []
        raw_blocks = []
        
        for block in blocks:
            if block["type"] != 0:  # Skip non-text blocks (images, etc.)
                continue
                
            block_text = ""
            max_font_size = 0
            
            for line in block.get("lines", []):
                line_text = ""
                for span in line.get("spans", []):
                    span_text = span.get("text", "").strip()
                    if span_text:
                        line_text += span_text + " "
                        max_font_size = max(max_font_size, span.get("size", 0))
                
                line_text = line_text.strip()
                if line_text:
                    block_text += line_text + "\n"
            
            block_text = block_text.strip()
            if not block_text:
                continue
                
            raw_blocks.append({
                "text": block_text,
                "font_size": max_font_size,
                "bbox": block.get("bbox")
            })
            
            # Heuristic: First large text = title
            if title is None and max_font_size >= self.title_font_size_threshold:
                title = block_text.replace("\n", " ").strip()
            else:
                text_parts.append(block_text)
                
                # Detect bullet points (lines starting with common markers)
                for line in block_text.split("\n"):
                    line = line.strip()
                    if line and self._is_bullet(line):
                        bullet_points.append(self._clean_bullet(line))
        
        full_text = "\n".join(text_parts)
        
        return SlideContent(
            slide_number=page_num,
            title=title,
            text=full_text,
            bullet_points=bullet_points,
            raw_blocks=raw_blocks
        )
    
    def _is_bullet(self, line: str) -> bool:
        """Check if a line is a bullet point."""
        bullet_markers = ["•", "-", "–", "—", "*", "►", "▪", "○", "●"]
        # Also check for numbered lists
        if line and line[0].isdigit() and len(line) > 1 and line[1] in ".):":
            return True
        return any(line.startswith(marker) for marker in bullet_markers)
    
    def _clean_bullet(self, line: str) -> str:
        """Remove bullet marker from line."""
        bullet_markers = ["•", "-", "–", "—", "*", "►", "▪", "○", "●"]
        for marker in bullet_markers:
            if line.startswith(marker):
                return line[len(marker):].strip()
        # Handle numbered lists
        if line and line[0].isdigit() and len(line) > 1 and line[1] in ".):":
            return line[2:].strip()
        return line
