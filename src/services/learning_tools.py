"""
Learning Tools Service — generates quizzes, flashcards, and study notes
from course content using RAG retrieval + Gemini LLM.
"""
import json
import logging
import uuid
from typing import Optional
from uuid import UUID

import google.generativeai as genai

from src.core.config import settings
from src.services.retrieval import RetrievalResult, RetrievedChunk

logger = logging.getLogger(__name__)

# ─── Prompts ────────────────────────────────────────────────────────

QUIZ_PROMPT = """You are an expert educational quiz creator. Based on the following course material, generate a multiple-choice quiz.

COURSE MATERIAL:
{context}

INSTRUCTIONS:
- Generate exactly {num_items} multiple-choice questions
- Each question should have exactly 4 options (A, B, C, D)
- Questions should test UNDERSTANDING, not just memorization
- Include a mix of difficulty levels: easy, medium, hard
- Provide a clear explanation for each correct answer
- Cover different aspects of the material

Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{{
  "title": "Quiz: [short topic name]",
  "topic": "[main topic covered]",
  "questions": [
    {{
      "id": "q1",
      "question": "What is ...?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 0,
      "explanation": "The correct answer is A because...",
      "difficulty": "easy"
    }}
  ]
}}"""

FLASHCARD_PROMPT = """You are an expert educational content creator. Based on the following course material, generate flashcards for study and revision.

COURSE MATERIAL:
{context}

INSTRUCTIONS:
- Generate exactly {num_items} flashcards
- Front: A clear question, term, or concept
- Back: A concise but complete answer or explanation
- Cover the most important concepts from the material
- Optionally group cards by category/topic
- Make them useful for quick revision

Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{{
  "title": "Flashcards: [short topic name]",
  "topic": "[main topic covered]",
  "cards": [
    {{
      "id": "f1",
      "front": "What is ...?",
      "back": "It is ...",
      "category": "Core Concepts"
    }}
  ]
}}"""

NOTES_PROMPT = """You are an expert educational summarizer. Based on the following course material, create comprehensive study notes.

COURSE MATERIAL:
{context}

INSTRUCTIONS:
- Create a clear, well-structured summary
- Extract 5-8 key points (most important takeaways)
- Identify important terms and provide clear definitions
- Include practical examples where relevant
- Make notes suitable for exam preparation
- Be concise but thorough

Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{{
  "title": "Study Notes: [short topic name]",
  "topic": "[main topic covered]",
  "summary": "A 2-3 paragraph overview of the material...",
  "key_points": [
    "Key point 1...",
    "Key point 2..."
  ],
  "definitions": [
    {{
      "term": "Term name",
      "definition": "Clear definition..."
    }}
  ],
  "examples": [
    "Example 1 that illustrates a concept..."
  ]
}}"""


class LearningToolsService:
    """
    Generates structured learning content (quizzes, flashcards, notes)
    from retrieved course material using Gemini LLM.
    """

    def __init__(self):
        genai.configure(api_key=settings.GEMINI_API_KEY)

    def _build_context(self, chunks: list[RetrievedChunk]) -> str:
        """Build context string from retrieved chunks."""
        parts = []
        for i, chunk in enumerate(chunks, 1):
            header = f"--- Section {i}"
            if chunk.slide_title:
                header += f": {chunk.slide_title}"
            if chunk.slide_number:
                header += f" (Slide {chunk.slide_number})"
            header += " ---"
            parts.append(f"{header}\n{chunk.text_preview}")
        return "\n\n".join(parts)

    async def generate_quiz(
        self,
        retrieval_result: RetrievalResult,
        num_items: int = 5,
        session_id: Optional[str] = None,
    ) -> dict:
        """Generate a quiz from retrieved course material."""
        context = self._build_context(retrieval_result.chunks)

        model = genai.GenerativeModel("gemini-2.0-flash")
        prompt = QUIZ_PROMPT.format(context=context, num_items=num_items)

        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.7,
                max_output_tokens=4096,
            ),
        )

        data = self._parse_json(response.text)

        # Ensure IDs
        for i, q in enumerate(data.get("questions", [])):
            if not q.get("id"):
                q["id"] = f"q{i+1}"

        if session_id:
            data["session_id"] = session_id

        return data

    async def generate_flashcards(
        self,
        retrieval_result: RetrievalResult,
        num_items: int = 8,
        session_id: Optional[str] = None,
    ) -> dict:
        """Generate flashcards from retrieved course material."""
        context = self._build_context(retrieval_result.chunks)

        model = genai.GenerativeModel("gemini-2.0-flash")
        prompt = FLASHCARD_PROMPT.format(context=context, num_items=num_items)

        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.7,
                max_output_tokens=4096,
            ),
        )

        data = self._parse_json(response.text)

        # Ensure IDs
        for i, card in enumerate(data.get("cards", [])):
            if not card.get("id"):
                card["id"] = f"f{i+1}"

        if session_id:
            data["session_id"] = session_id

        return data

    async def generate_notes(
        self,
        retrieval_result: RetrievalResult,
        session_id: Optional[str] = None,
    ) -> dict:
        """Generate study notes from retrieved course material."""
        context = self._build_context(retrieval_result.chunks)

        model = genai.GenerativeModel("gemini-2.0-flash")
        prompt = NOTES_PROMPT.format(context=context)

        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.5,
                max_output_tokens=4096,
            ),
        )

        data = self._parse_json(response.text)

        if session_id:
            data["session_id"] = session_id

        return data

    def _parse_json(self, text: str) -> dict:
        """Parse JSON from LLM response, handling markdown code fences."""
        cleaned = text.strip()

        # Remove markdown code fences
        if cleaned.startswith("```"):
            # Remove opening fence (```json or ```)
            first_newline = cleaned.index("\n")
            cleaned = cleaned[first_newline + 1 :]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]

        cleaned = cleaned.strip()

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM JSON: {e}\nRaw: {text[:500]}")
            raise ValueError(f"Failed to parse AI response as JSON: {e}")
