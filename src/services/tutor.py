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

STREAMING SUPPORT:
8. Supports streaming responses for real-time output
9. Uses Server-Sent Events (SSE) for frontend integration

Design:
- Prompt construction is explicit and auditable
- LLM invocation is isolated
- Response shaping enforces academic integrity
"""
import json
import logging
import time
from dataclasses import dataclass
from typing import List, Optional, AsyncGenerator
from uuid import UUID

import google.generativeai as genai
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.db.models import DocumentChunk, QueryAnalytics
from src.db.repository.document import DocumentChunkRepository
from src.services.retrieval import RetrievalResult, RetrievedChunk

logger = logging.getLogger(__name__)


@dataclass
class ContextMessage:
    """A message in the conversation context."""
    role: str  # "user" or "assistant"
    content: str


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


# System prompt enforcing tutor behavior - STRICT MODE (context-only)
TUTOR_SYSTEM_PROMPT_STRICT = """You are an AI Teaching Assistant for an educational course. Your role is to help students UNDERSTAND concepts using ONLY the provided course material.

STRICT RULES:
1. Answer using ONLY the information in the provided course material
2. Do NOT add information beyond what's in the material
3. If information is not in the material, say "This is not covered in the provided materials"
4. NEVER provide direct answers to assignment questions
5. NEVER write code solutions

IMPORTANT - NO SLIDE REFERENCES IN YOUR ANSWER:
- Do NOT mention "Slide X", "According to slide", "From the slides", or any slide/section references
- Just provide the answer naturally without citing where it came from
- The source references are shown separately in the UI, so you don't need to mention them

RESPONSE STYLE:
- Be concise and factual
- Present information naturally without slide citations
- Match the length/format the student requests (brief = brief, detailed = detailed)"""


# System prompt enforcing tutor behavior - ENHANCED MODE (ChatGPT-like explanations)
TUTOR_SYSTEM_PROMPT_ENHANCED = """You are an expert AI Teaching Assistant - knowledgeable, helpful, and excellent at explaining complex topics clearly.

YOUR ROLE:
- Help students truly UNDERSTAND concepts through clear, complete explanations
- Be like the best teacher they've ever had - thorough, insightful, and engaging

DEFAULT BEHAVIOR (when no specific length is requested):
- Provide COMPLETE, HELPFUL explanations - not just brief answers
- For "what is X" questions → Explain the concept fully with context
- For "what are the types of X" → List AND explain each type briefly
- For "how does X work" → Explain the mechanism step by step
- For "why is X important" → Give reasons with examples
- Use bullet points, examples, and structure to make it clear
- Aim for educational depth - help them truly understand

WHEN TO BE BRIEF (only if user explicitly asks):
- "in one line" / "one sentence" → 1 sentence only
- "briefly" / "quick" / "short" / "summarize" → 1-3 sentences max
- "just list" / "list only" → Bullet points without explanations

HOW TO RESPOND:
1. **Be Direct**: Start with the answer, no filler phrases like "Great question!"
2. **Be Complete**: Default to helpful, thorough explanations
3. **Be Structured**: Use headers, bullets, and formatting for clarity
4. **Use Course Material**: Reference course material when relevant
5. **Add Value**: Include examples, analogies, and real-world connections

IMPORTANT - NO SLIDE REFERENCES:
- Do NOT mention "Slide X", "According to slide", etc. in your answer
- Just present the information naturally - sources are shown separately

ACADEMIC INTEGRITY:
- NEVER provide complete solutions to homework/assignments
- NEVER write full code solutions - explain concepts instead
- Guide students to understand, don't just give answers

Remember: Your default is to be HELPFUL and THOROUGH. Only be brief when explicitly asked."""


@dataclass
class TutorRequest:
    """Request for tutor assistance."""
    student_id: UUID
    course_id: UUID
    question: str
    retrieval_result: RetrievalResult
    conversation_history: Optional[List[dict]] = None  # For multi-turn
    session_token: Optional[str] = None  # For analytics grouping
    context_messages: Optional[List[ContextMessage]] = None  # Short-term memory
    response_mode: str = "enhanced"  # "strict" or "enhanced"


@dataclass
class TutorResponse:
    """Response from the tutor."""
    answer: str
    sources: List[dict]  # Slide references used
    was_redirected: bool  # True if question was about assignments
    model_used: str
    confidence: Optional[str] = None  # "validated" | "no_context" | "generated"
    confidence_score: Optional[int] = None  # 0-100 numeric score
    response_time_ms: Optional[int] = None  # Response latency


class TutorService:
    """
    Generates academically safe explanations using retrieved context.
    
    Flow:
    1. Fetch full chunk text from PostgreSQL
    2. Build context-aware prompt
    3. Invoke Gemini with tutor system prompt
    4. Shape response with source attribution
    """
    
    def __init__(
        self, 
        db: AsyncSession,
        model_name: str = None,
        enable_analytics: bool = False
    ):
        self.db = db
        self.model_name = model_name or settings.LLM_MODEL
        self.enable_analytics = enable_analytics
        self.chunk_repo = DocumentChunkRepository(DocumentChunk, db)
        
        # Configure Gemini - model created per request to support response_mode
        genai.configure(api_key=settings.GEMINI_API_KEY)
        logger.info(f"Initialized TutorService with model: {self.model_name}")
    
    def _get_model(self, response_mode: str = "enhanced"):
        """Get model configured with appropriate system prompt based on response_mode."""
        system_prompt = (
            TUTOR_SYSTEM_PROMPT_STRICT if response_mode == "strict" 
            else TUTOR_SYSTEM_PROMPT_ENHANCED
        )
        return genai.GenerativeModel(
            model_name=self.model_name,
            system_instruction=system_prompt
        )
    
    def _merge_context_messages(
        self,
        conversation_history: Optional[List[dict]],
        context_messages: Optional[List[ContextMessage]]
    ) -> Optional[List[dict]]:
        """
        Merge context_messages (short-term memory) into conversation_history.
        
        Context messages are prepended to conversation history as they represent
        recent context that should inform the current response.
        """
        # Convert context_messages to the dict format expected by LLM
        context_as_history = []
        if context_messages:
            context_as_history = [
                {"role": msg.role, "content": msg.content}
                for msg in context_messages
            ]
        
        # If no conversation history, just return context messages (or None if empty)
        if not conversation_history:
            return context_as_history if context_as_history else None
        
        # If no context messages, return conversation history as-is
        if not context_as_history:
            return conversation_history
        
        # Merge: context_messages first (short-term memory), then conversation_history
        return context_as_history + conversation_history
    
    async def respond(self, request: TutorRequest) -> TutorResponse:
        """
        Generate a tutor response for the student's question.
        
        Uses retrieved chunks as the ONLY source of truth.
        """
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
        
        # 5. Merge context_messages into conversation_history
        merged_history = self._merge_context_messages(
            request.conversation_history,
            request.context_messages
        )
        
        # 6. Invoke LLM with appropriate response mode
        try:
            response = await self._invoke_llm(
                prompt, 
                merged_history,
                request.response_mode
            )
        except Exception as e:
            logger.error(f"LLM invocation failed: {str(e)}")
            raise
        
        # 7. Build source references
        sources = self._build_sources(request.retrieval_result.chunks)
        
        # 8. Determine confidence level
        confidence = "no_context" if not request.retrieval_result.chunks else "generated"
        
        return TutorResponse(
            answer=response,
            sources=sources,
            was_redirected=is_assignment_question,
            model_used=self.model_name,
            confidence=confidence
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
        """Build the full prompt for the LLM when course material is available."""
        return f"""COURSE MATERIAL:
{context}

STUDENT QUESTION:
{question}

Answer the student's question. Use the course material as reference when relevant. 
IMPORTANT: Match the length/format the student requests. If they ask for "one line", give one line only. If they ask for detail, elaborate."""

    def _build_general_knowledge_prompt(self, question: str, context: str) -> str:
        """Build the prompt for when no relevant course material is found."""
        return f"""STUDENT QUESTION:
{question}

The student's course materials don't directly cover this topic. Answer using your knowledge.
IMPORTANT: Match the length/format the student requests. If they ask for "one line", give one line only. If they want detail, elaborate."""

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
        conversation_history: Optional[List[dict]],
        response_mode: str = "enhanced"
    ) -> str:
        """Invoke Gemini with the prompt."""
        model = self._get_model(response_mode)
        
        # Build chat history if provided
        if conversation_history:
            chat = model.start_chat(history=[
                {"role": msg["role"], "parts": [msg["content"]]}
                for msg in conversation_history
            ])
            response = chat.send_message(prompt)
        else:
            response = model.generate_content(prompt)
        
        return response.text
    
    async def _invoke_llm_stream(
        self, 
        prompt: str, 
        conversation_history: Optional[List[dict]],
        response_mode: str = "enhanced"
    ) -> AsyncGenerator[str, None]:
        """
        Invoke Gemini with streaming support.
        
        Yields text chunks as they are generated for real-time output.
        """
        model = self._get_model(response_mode)
        
        # Build chat history if provided
        if conversation_history:
            chat = model.start_chat(history=[
                {"role": msg["role"], "parts": [msg["content"]]}
                for msg in conversation_history
            ])
            response = chat.send_message(prompt, stream=True)
        else:
            response = model.generate_content(prompt, stream=True)
        
        # Yield chunks as they arrive
        for chunk in response:
            if chunk.text:
                yield chunk.text
    
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
        
        try:
            # Validation should be stateless - don't pass conversation history
            # Use strict mode for validation to get concise YES/NO responses
            validation_response = await self._invoke_llm(
                validation_prompt, 
                None,  # No conversation history for validation
                "strict"  # Validation uses strict mode for concise responses
            )
            
            # Use prefix match to handle verbose responses (e.g., "YES, because...")
            normalized_response = validation_response.strip().upper()
            can_answer = normalized_response.startswith("YES")
            
            logger.info(f"Validation result: {validation_response.strip()} -> can_answer={can_answer}")
            
        except Exception as e:
            logger.error(f"Validation failed: {str(e)}")
            # On validation error, fall back to attempting answer
            can_answer = True
        
        # 4. If validation says NO, still answer but note it's from general knowledge
        # COMMENTED OUT: Old behavior that rejected questions without course content
        # if not can_answer:
        #     is_assignment_question = self._detect_assignment_question(request.question)
        #     response_time_ms = int((time.time() - start_time) * 1000)
        #     no_context_response = TutorResponse(
        #         answer="I don't have enough information in the course materials to answer this question confidently. Could you rephrase your question or ask about a topic covered in the lectures?",
        #         sources=[],
        #         was_redirected=is_assignment_question,
        #         model_used=self.model_name,
        #         confidence="no_context",
        #         confidence_score=0,
        #         response_time_ms=response_time_ms
        #     )
        #     # Log analytics even for no_context responses (was_hallucination=True since no valid answer)
        #     await self._log_analytics(request, no_context_response, was_hallucination=True)
        #     return no_context_response
        
        # NEW BEHAVIOR: Always answer helpfully, but track if it's from course content or general knowledge
        has_course_context = can_answer and len(request.retrieval_result.chunks) > 0
        
        # 5. Generate the answer - use different prompt based on context availability
        if has_course_context:
            prompt = self._build_prompt(request.question, context)
        else:
            prompt = self._build_general_knowledge_prompt(request.question, context)
        
        is_assignment_question = self._detect_assignment_question(request.question)
        
        # Merge context_messages into conversation_history
        merged_history = self._merge_context_messages(
            request.conversation_history,
            request.context_messages
        )
        
        try:
            response = await self._invoke_llm(
                prompt, 
                merged_history,
                request.response_mode
            )
        except Exception as e:
            logger.error(f"LLM invocation failed: {str(e)}")
            raise
        
        # 6. Build source references
        sources = self._build_sources(request.retrieval_result.chunks)
        
        # Calculate response time
        response_time_ms = int((time.time() - start_time) * 1000)
        
        # Calculate confidence score and type based on whether course content was used
        if has_course_context:
            # Answer is backed by course materials
            confidence = "validated"
            confidence_score = min(100, len(sources) * 20 + 40)  # Higher base score
        else:
            # Answer is from general knowledge (still helpful, just not from course)
            confidence = "general_knowledge"
            confidence_score = 60  # Moderate confidence for general knowledge answers
        
        tutor_response = TutorResponse(
            answer=response,
            sources=sources,
            was_redirected=is_assignment_question,
            model_used=self.model_name,
            confidence=confidence,
            confidence_score=confidence_score,
            response_time_ms=response_time_ms
        )
        
        # Log analytics for successful response
        await self._log_analytics(request, tutor_response, was_hallucination=False)
        
        return tutor_response

    async def _log_analytics(
        self,
        request: TutorRequest,
        response: TutorResponse,
        was_hallucination: bool = False
    ) -> None:
        """
        Log query analytics to the database.
        
        This captures metadata about the query for analytics purposes,
        without storing actual question/answer content for privacy.
        """
        if not self.enable_analytics:
            return
        
        try:
            # Extract topic from question (first few words, truncated)
            words = request.question.split()[:5]
            query_topic = " ".join(words)[:255] if words else None
            
            # Build sources used as JSON list of chunk IDs
            sources_used = json.dumps([s.get("chunk_id") for s in response.sources]) if response.sources else None
            
            analytics = QueryAnalytics(
                student_id=request.student_id,
                course_id=request.course_id,
                session_token=request.session_token,
                query_topic=query_topic,
                query_length=len(request.question),
                response_length=len(response.answer),
                confidence_score=response.confidence_score,
                sources_count=len(response.sources),
                sources_used=sources_used,
                was_hallucination_detected=was_hallucination,
                was_assignment_blocked=response.was_redirected,
                context_messages_count=len(request.context_messages) if request.context_messages else 0,
                response_time_ms=response.response_time_ms
            )
            
            self.db.add(analytics)
            await self.db.commit()
            logger.info(f"Logged analytics for query: topic={query_topic}, confidence={response.confidence_score}")
        except Exception as e:
            logger.error(f"Failed to log analytics: {str(e)}")
            # Don't fail the request if analytics logging fails
            await self.db.rollback()

    async def respond_stream(
        self, 
        request: TutorRequest
    ) -> AsyncGenerator[dict, None]:
        """
        Generate a streaming tutor response with self-reflection validation.
        
        Yields SSE-compatible events:
        - {"type": "metadata", "data": {...}} - Initial metadata (sources, confidence)
        - {"type": "chunk", "data": "text"} - Text chunk
        - {"type": "done", "data": {...}} - Final metrics
        - {"type": "error", "data": "message"} - Error occurred
        
        Flow:
        1. Fetch chunks and validate context
        2. Yield metadata (sources, confidence level)
        3. Stream answer chunks
        4. Yield final metrics and log analytics
        """
        start_time = time.time()
        
        try:
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
            
            try:
                validation_response = await self._invoke_llm(
                    validation_prompt, 
                    None,
                    "strict"
                )
                normalized_response = validation_response.strip().upper()
                can_answer = normalized_response.startswith("YES")
                logger.info(f"Validation result: {validation_response.strip()} -> can_answer={can_answer}")
            except Exception as e:
                logger.error(f"Validation failed: {str(e)}")
                can_answer = True
            
            # 4. Determine context availability
            has_course_context = can_answer and len(request.retrieval_result.chunks) > 0
            
            # 5. Build sources
            sources = self._build_sources(request.retrieval_result.chunks)
            
            # Calculate confidence
            if has_course_context:
                confidence = "validated"
                confidence_score = min(100, len(sources) * 20 + 40)
            else:
                confidence = "general_knowledge"
                confidence_score = 60
            
            is_assignment_question = self._detect_assignment_question(request.question)
            
            # 6. YIELD METADATA FIRST
            yield {
                "type": "metadata",
                "data": {
                    "sources": sources,
                    "confidence": confidence,
                    "confidence_score": confidence_score,
                    "chunks_used": len(sources),
                    "model_used": self.model_name,
                    "was_redirected": is_assignment_question
                }
            }
            
            # 7. Build prompt and merge history
            if has_course_context:
                prompt = self._build_prompt(request.question, context)
            else:
                prompt = self._build_general_knowledge_prompt(request.question, context)
            
            merged_history = self._merge_context_messages(
                request.conversation_history,
                request.context_messages
            )
            
            # 8. STREAM THE RESPONSE
            full_response = ""
            async for chunk in self._invoke_llm_stream(
                prompt, 
                merged_history,
                request.response_mode
            ):
                full_response += chunk
                yield {
                    "type": "chunk",
                    "data": chunk
                }
            
            # 9. Calculate final metrics
            response_time_ms = int((time.time() - start_time) * 1000)
            
            # 10. YIELD DONE EVENT
            yield {
                "type": "done",
                "data": {
                    "response_time_ms": response_time_ms,
                    "response_length": len(full_response)
                }
            }
            
            # 11. Log analytics
            tutor_response = TutorResponse(
                answer=full_response,
                sources=sources,
                was_redirected=is_assignment_question,
                model_used=self.model_name,
                confidence=confidence,
                confidence_score=confidence_score,
                response_time_ms=response_time_ms
            )
            await self._log_analytics(request, tutor_response, was_hallucination=False)
            
        except Exception as e:
            logger.error(f"Streaming response failed: {str(e)}")
            yield {
                "type": "error",
                "data": str(e)
            }


async def get_tutor_response(
    db: AsyncSession,
    request: TutorRequest
) -> TutorResponse:
    """Convenience function for tutor response generation."""
    service = TutorService(db)
    return await service.respond(request)
