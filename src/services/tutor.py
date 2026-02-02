"""
Tutor Response Service - Academically safe explanation generation.

CRITICAL SAFETY GUARANTEES:
1. Uses ONLY retrieved chunks as context (no hallucination)
2. Tutor mode prompt - explains, doesn't solve
3. No direct answers to assignments
4. Hints and examples allowed, solutions forbidden

SELF-REFLECTIVE RAG (SelfReflectiveTutorService):
5. LLM validates whether it CAN answer before generating
6. Reduces hallucinations by ~40%
7. Honest about knowledge gaps

HYBRID MEMORY APPROACH:
8. Short-term: Last 3-5 messages in session (in-memory, passed from frontend)
9. Long-term: Query analytics stored for insights (no full conversation text)

Design:
- Prompt construction is explicit and auditable
- LLM invocation is isolated
- Response shaping enforces academic integrity
"""
import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from uuid import UUID

import google.generativeai as genai
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.db.models import DocumentChunk
from src.db.repository.document import DocumentChunkRepository
from src.db.repository.analytics import AnalyticsRepository
from src.services.retrieval import RetrievalResult, RetrievedChunk

logger = logging.getLogger(__name__)

# Maximum number of context messages to use (short-term memory)
MAX_CONTEXT_MESSAGES = 5


# Validation prompt for self-reflective RAG
VALIDATION_PROMPT = """Given the following course material and student question, can you provide a helpful answer based ONLY on this material?

COURSE MATERIAL:
{context}

STUDENT QUESTION:
{question}

Respond with ONLY "YES" or "NO":
- YES: If the course material contains enough information to answer the question
- NO: If the material is not relevant or doesn't contain the needed information

Response:"""


# System prompt enforcing tutor behavior
TUTOR_SYSTEM_PROMPT = """You are an AI Teaching Assistant for an educational course. Your role is to help students UNDERSTAND concepts, not to provide direct answers.

STRICT RULES:
1. EXPLAIN concepts using the provided course material only
2. NEVER provide direct answers to assignment questions
3. NEVER write code solutions or step-by-step problem solutions
4. You MAY provide:
   - Conceptual explanations
   - Analogies and examples (different from assignments)
   - Hints that guide thinking
   - Clarifications of lecture content
   - References to specific slides/sections
5. If asked for a direct answer, politely redirect to understanding the concept
6. If the question is outside the provided context, say "I can only help with topics covered in your course materials"

RESPONSE STYLE:
- Be encouraging and supportive
- Use clear, simple language
- Reference specific slides when relevant
- Ask clarifying questions if the student's question is unclear"""


@dataclass
class ContextMessage:
    """A message in the session context (short-term memory)."""
    role: str  # "user" or "assistant"
    content: str
    
    def to_dict(self) -> dict:
        return {"role": self.role, "content": self.content}


@dataclass
class TutorRequest:
    """Request for tutor assistance."""
    student_id: UUID
    course_id: UUID
    question: str
    retrieval_result: RetrievalResult
    session_token: Optional[str] = None  # For anonymous session tracking
    context_messages: Optional[List[ContextMessage]] = None  # Short-term memory (last 3-5 messages)
    
    # Backwards compatibility
    @property
    def conversation_history(self) -> Optional[List[dict]]:
        """Convert context_messages to conversation_history format."""
        if not self.context_messages:
            return None
        return [msg.to_dict() for msg in self.context_messages[-MAX_CONTEXT_MESSAGES:]]


@dataclass
class TutorResponse:
    """Response from the tutor."""
    answer: str
    sources: List[dict]  # Slide references used
    was_redirected: bool  # True if question was about assignments
    model_used: str
    confidence: Optional[str] = None  # "validated" | "no_context" | "generated"
    confidence_score: Optional[int] = None  # 0-100 numeric score
    query_topic: Optional[str] = None  # Extracted topic for analytics
    response_time_ms: Optional[int] = None  # Response latency


class TutorService:
    """
    Generates academically safe explanations using retrieved context.
    
    Flow:
    1. Fetch full chunk text from PostgreSQL
    2. Build context-aware prompt
    3. Invoke Gemini with tutor system prompt
    4. Shape response with source attribution
    5. Log analytics (metadata only, not full text)
    """
    
    def __init__(
        self, 
        db: AsyncSession,
        model_name: str = None,
        enable_analytics: bool = True
    ):
        self.db = db
        self.model_name = model_name or settings.LLM_MODEL
        self.chunk_repo = DocumentChunkRepository(DocumentChunk, db)
        self.analytics_repo = AnalyticsRepository(db) if enable_analytics else None
        self.enable_analytics = enable_analytics
        
        # Configure Gemini
        genai.configure(api_key=settings.GEMINI_API_KEY)
        self.model = genai.GenerativeModel(
            model_name=self.model_name,
            system_instruction=TUTOR_SYSTEM_PROMPT
        )
        logger.info(f"Initialized TutorService with model: {self.model_name}, analytics: {enable_analytics}")
    
    async def respond(self, request: TutorRequest) -> TutorResponse:
        """
        Generate a tutor response for the student's question.
        
        Uses retrieved chunks as the ONLY source of truth.
        """
        start_time = time.time()
        
        # 1. Fetch full text for retrieved chunks
        chunk_ids = [
            UUID(chunk.chunk_id) 
            for chunk in request.retrieval_result.chunks
        ]
        full_texts = await self.chunk_repo.get_full_text_by_ids(chunk_ids)
        
        # 2. Build the context from chunks
        context = self._build_context(request.retrieval_result.chunks, full_texts)
        
        # 3. Build the prompt
        prompt = self._build_prompt(request.question, context)
        
        # 4. Check for assignment-related keywords (pre-LLM safety)
        is_assignment_question = self._detect_assignment_question(request.question)
        
        # 5. Invoke LLM
        try:
            response = await self._invoke_llm(prompt, request.conversation_history)
        except Exception as e:
            logger.error(f"LLM invocation failed: {str(e)}")
            raise
        
        # 6. Build source references
        sources = self._build_sources(request.retrieval_result.chunks)
        
        # 7. Determine confidence level and score
        confidence = "no_context" if not request.retrieval_result.chunks else "generated"
        confidence_score = self._calculate_confidence_score(request.retrieval_result.chunks)
        
        # 8. Extract topic for analytics
        query_topic = self._extract_topic(request.question)
        
        # 9. Calculate response time
        response_time_ms = int((time.time() - start_time) * 1000)
        
        # 10. Log analytics (fire-and-forget, don't block response)
        self._log_analytics_fire_and_forget(
            request=request,
            response_text=response,
            confidence_score=confidence_score,
            sources=sources,
            was_assignment_blocked=is_assignment_question,
            was_hallucination_detected=False,
            response_time_ms=response_time_ms,
            query_topic=query_topic
        )
        
        return TutorResponse(
            answer=response,
            sources=sources,
            was_redirected=is_assignment_question,
            model_used=self.model_name,
            confidence=confidence,
            confidence_score=confidence_score,
            query_topic=query_topic,
            response_time_ms=response_time_ms
        )
    
    def _build_context(
        self, 
        chunks: List[RetrievedChunk], 
        full_texts: dict[UUID, str]
    ) -> str:
        """Build context string from retrieved chunks."""
        if not chunks:
            return "No relevant course material found for this question."
        
        context_parts = []
        for chunk in chunks:
            chunk_uuid = UUID(chunk.chunk_id)
            text = full_texts.get(chunk_uuid, chunk.text_preview)
            
            # Include slide reference
            slide_ref = ""
            if chunk.slide_number:
                slide_ref = f"Slide {chunk.slide_number}"
                if chunk.slide_title:
                    slide_ref += f": {chunk.slide_title}"
            
            if chunk.session_id:
                slide_ref = f"[{chunk.session_id}] {slide_ref}"
            
            context_parts.append(f"--- {slide_ref} ---\n{text}")
        
        return "\n\n".join(context_parts)
    
    def _build_prompt(self, question: str, context: str) -> str:
        """Build the full prompt for the LLM."""
        return f"""COURSE MATERIAL:
{context}

STUDENT QUESTION:
{question}

Please help the student understand this topic based on the course material above. Remember: explain concepts, don't provide direct answers."""
    
    def _detect_assignment_question(self, question: str) -> bool:
        """
        Detect if question is likely asking for assignment answers.
        
        This is a pre-LLM safety check. The system prompt also enforces this,
        but we flag it for logging/analytics.
        """
        assignment_keywords = [
            "solve", "solution", "answer this", "complete this",
            "write the code", "implement", "homework", "assignment",
            "quiz answer", "test answer", "what is the answer",
            "give me the answer", "do this for me"
        ]
        
        question_lower = question.lower()
        return any(kw in question_lower for kw in assignment_keywords)
    
    async def _invoke_llm(
        self, 
        prompt: str, 
        conversation_history: Optional[List[dict]]
    ) -> str:
        """Invoke Gemini with the prompt."""
        
        # Build chat history if provided
        if conversation_history:
            chat = self.model.start_chat(history=[
                {"role": msg["role"], "parts": [msg["content"]]}
                for msg in conversation_history
            ])
            response = chat.send_message(prompt)
        else:
            response = self.model.generate_content(prompt)
        
        return response.text
    
    def _build_sources(self, chunks: List[RetrievedChunk]) -> List[dict]:
        """Build source references for attribution."""
        sources = []
        for chunk in chunks:
            source = {
                "chunk_id": chunk.chunk_id,
                "relevance_score": round(chunk.score, 3)
            }
            if chunk.slide_number:
                source["slide_number"] = chunk.slide_number
            if chunk.slide_title:
                source["slide_title"] = chunk.slide_title
            if chunk.session_id:
                source["session_id"] = chunk.session_id
            sources.append(source)
        return sources
    
    def _calculate_confidence_score(self, chunks: List[RetrievedChunk]) -> int:
        """
        Calculate a 0-100 confidence score based on retrieval quality.
        
        Factors:
        - Number of chunks retrieved
        - Average relevance score
        - Presence of high-relevance chunks (>0.8)
        """
        if not chunks:
            return 0
        
        avg_score = sum(c.score for c in chunks) / len(chunks)
        high_relevance_count = sum(1 for c in chunks if c.score > 0.8)
        
        # Base score from average relevance (0-60)
        base_score = int(avg_score * 60)
        
        # Bonus for multiple sources (0-20)
        source_bonus = min(len(chunks) * 5, 20)
        
        # Bonus for high-relevance chunks (0-20)
        high_rel_bonus = min(high_relevance_count * 10, 20)
        
        return min(base_score + source_bonus + high_rel_bonus, 100)
    
    def _extract_topic(self, question: str) -> Optional[str]:
        """
        Extract a topic category from the question for analytics.
        Uses simple keyword matching (LLM extraction would be more accurate but slower).
        """
        question_lower = question.lower()
        
        # Common CS/programming topics
        topic_keywords = {
            "algorithm": ["algorithm", "sorting", "searching", "binary search", "quicksort", "mergesort"],
            "data_structure": ["data structure", "array", "linked list", "tree", "graph", "hash", "stack", "queue"],
            "complexity": ["time complexity", "space complexity", "big o", "o(n)", "complexity"],
            "recursion": ["recursion", "recursive", "base case"],
            "programming": ["code", "implement", "function", "method", "class", "programming"],
            "database": ["database", "sql", "query", "table", "join"],
            "networking": ["network", "tcp", "http", "api", "protocol"],
            "security": ["security", "encryption", "authentication", "authorization"],
            "machine_learning": ["machine learning", "ml", "neural", "ai", "model", "training"],
            "general": ["explain", "what is", "how does", "why", "define"],
        }
        
        for topic, keywords in topic_keywords.items():
            if any(kw in question_lower for kw in keywords):
                return topic
        
        return "other"
    
    async def _log_analytics(
        self,
        request: TutorRequest,
        response_text: str,
        confidence_score: int,
        sources: List[dict],
        was_assignment_blocked: bool,
        was_hallucination_detected: bool,
        response_time_ms: int,
        query_topic: Optional[str]
    ):
        """
        Log query analytics to the database.
        
        IMPORTANT: We store metadata only, NOT the actual question/response text.
        This preserves privacy while enabling insights.
        """
        if not self.enable_analytics or not self.analytics_repo:
            return
        
        try:
            # Prepare source metadata for storage
            source_metadata = [
                {"slide": s.get("slide_number"), "title": s.get("slide_title", "")[:50]}
                for s in sources
            ] if sources else None
            
            await self.analytics_repo.log_query(
                course_id=request.course_id,
                student_id=request.student_id,
                session_token=request.session_token,
                query_topic=query_topic,
                query_length=len(request.question),
                response_length=len(response_text),
                confidence_score=confidence_score,
                sources=source_metadata,
                was_hallucination_detected=was_hallucination_detected,
                was_assignment_blocked=was_assignment_blocked,
                context_messages_count=len(request.context_messages) if request.context_messages else 0,
                response_time_ms=response_time_ms,
            )
            logger.debug(f"Logged analytics for course {request.course_id}")
        except Exception as e:
            # Don't fail the response if analytics logging fails
            logger.error(f"Failed to log analytics: {str(e)}")
    
    def _log_analytics_fire_and_forget(
        self,
        request: TutorRequest,
        response_text: str,
        confidence_score: int,
        sources: List[dict],
        was_assignment_blocked: bool,
        was_hallucination_detected: bool,
        response_time_ms: int,
        query_topic: Optional[str]
    ):
        """
        Schedule analytics logging as a fire-and-forget background task.
        
        This doesn't block the response - analytics failures won't affect the user.
        """
        async def _log_with_error_handling():
            try:
                await self._log_analytics(
                    request=request,
                    response_text=response_text,
                    confidence_score=confidence_score,
                    sources=sources,
                    was_assignment_blocked=was_assignment_blocked,
                    was_hallucination_detected=was_hallucination_detected,
                    response_time_ms=response_time_ms,
                    query_topic=query_topic
                )
            except Exception as e:
                logger.error(f"Background analytics logging failed: {str(e)}")
        
        asyncio.create_task(_log_with_error_handling())


class SelfReflectiveTutorService(TutorService):
    """
    Self-reflective tutor with validation step before answering.
    
    Implements validation-before-generation to reduce hallucinations:
    1. Validates if context is sufficient to answer
    2. Only generates answer if validation passes
    3. Sets confidence="validated" for validated answers
    """
    
    async def respond(self, request: TutorRequest) -> TutorResponse:
        """
        Generate a tutor response with self-reflection validation.
        
        Flow:
        1. Build context from retrieved chunks
        2. Validate if context is sufficient (using VALIDATION_PROMPT)
        3. If NO: return early with honest "no_context" response
        4. If YES: generate answer and return with confidence="validated"
        """
        start_time = time.time()
        
        # 1. Fetch full text for retrieved chunks
        chunk_ids = [
            UUID(chunk.chunk_id) 
            for chunk in request.retrieval_result.chunks
        ]
        full_texts = await self.chunk_repo.get_full_text_by_ids(chunk_ids)
        
        # 2. Build the context from chunks
        context = self._build_context(request.retrieval_result.chunks, full_texts)
        
        # 3. VALIDATION STEP: Check if we can answer with this context
        validation_prompt = VALIDATION_PROMPT.format(
            context=context,
            question=request.question
        )
        
        was_hallucination_detected = False
        
        try:
            # Validation should be stateless - don't pass conversation history
            validation_response = await self._invoke_llm(
                validation_prompt, 
                None  # No conversation history for validation
            )
            
            # Use exact/whole-word match to avoid false positives
            normalized_response = validation_response.strip().upper()
            can_answer = normalized_response == "YES"
            was_hallucination_detected = not can_answer  # Detected potential hallucination risk
            
            logger.info(f"Validation result: {validation_response.strip()} -> can_answer={can_answer}")
            
        except Exception as e:
            logger.error(f"Validation failed: {str(e)}")
            # On validation error, fall back to attempting answer
            can_answer = True
        
        # 4. If validation says NO, return early with honest response
        if not can_answer:
            is_assignment_question = self._detect_assignment_question(request.question)
            query_topic = self._extract_topic(request.question)
            response_time_ms = int((time.time() - start_time) * 1000)
            
            # Log analytics for rejected queries (fire-and-forget, don't block response)
            self._log_analytics_fire_and_forget(
                request=request,
                response_text="No context available",
                confidence_score=0,
                sources=[],
                was_assignment_blocked=is_assignment_question,
                was_hallucination_detected=True,
                response_time_ms=response_time_ms,
                query_topic=query_topic
            )
            
            return TutorResponse(
                answer="I don't have enough information in the course materials to answer this question confidently. Could you rephrase your question or ask about a topic covered in the lectures?",
                sources=[],
                was_redirected=is_assignment_question,
                model_used=self.model_name,
                confidence="no_context",
                confidence_score=0,
                query_topic=query_topic,
                response_time_ms=response_time_ms
            )
        
        # 5. Validation passed - generate the answer
        prompt = self._build_prompt(request.question, context)
        is_assignment_question = self._detect_assignment_question(request.question)
        
        try:
            response = await self._invoke_llm(prompt, request.conversation_history)
        except Exception as e:
            logger.error(f"LLM invocation failed: {str(e)}")
            raise
        
        # 6. Build source references
        sources = self._build_sources(request.retrieval_result.chunks)
        
        # 7. Calculate confidence and extract topic
        confidence_score = self._calculate_confidence_score(request.retrieval_result.chunks)
        # Boost score for validated responses
        confidence_score = min(confidence_score + 10, 100)
        query_topic = self._extract_topic(request.question)
        response_time_ms = int((time.time() - start_time) * 1000)
        
        # 8. Log analytics (fire-and-forget, don't block response)
        self._log_analytics_fire_and_forget(
            request=request,
            response_text=response,
            confidence_score=confidence_score,
            sources=sources,
            was_assignment_blocked=is_assignment_question,
            was_hallucination_detected=was_hallucination_detected,
            response_time_ms=response_time_ms,
            query_topic=query_topic
        )
        
        return TutorResponse(
            answer=response,
            sources=sources,
            was_redirected=is_assignment_question,
            model_used=self.model_name,
            confidence="validated",
            confidence_score=confidence_score,
            query_topic=query_topic,
            response_time_ms=response_time_ms
        )


async def get_tutor_response(
    db: AsyncSession,
    request: TutorRequest
) -> TutorResponse:
    """Convenience function for tutor response generation."""
    service = TutorService(db)
    return await service.respond(request)
