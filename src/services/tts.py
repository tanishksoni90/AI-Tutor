"""
Text-to-Speech Service using Google Gemini TTS.

Uses the `gemini-2.5-flash-preview-tts` model for natural, human-like speech.
Supports multiple voices and Indian languages (Hindi, English, etc.)

The Gemini TTS model returns raw PCM audio at 24kHz, 16-bit mono.
We wrap it in a WAV container for browser playback.
"""
import io
import re
import wave
import logging
import time
from typing import Optional

from google import genai
from google.genai import types

from src.core.config import settings

logger = logging.getLogger(__name__)

# Available Gemini TTS voices (all support multilingual including Hindi)
AVAILABLE_VOICES = {
    "Kore": "Firm, bright female voice",
    "Puck": "Upbeat, lively male voice",
    "Charon": "Calm, informative male voice",
    "Fenrir": "Excitable, energetic male voice",
    "Aoede": "Warm, bright female voice",
    "Leda": "Youthful, perky female voice",
    "Orus": "Firm, steady male voice",
    "Zephyr": "Bright, lively nonbinary voice",
}

# Default voice for tutor - warm and clear
DEFAULT_VOICE = "Aoede"

# PCM sample rate returned by Gemini TTS
SAMPLE_RATE = 24000
SAMPLE_WIDTH = 2  # 16-bit
CHANNELS = 1  # Mono


def strip_markdown_for_speech(text: str) -> str:
    """
    Strip markdown formatting to produce clean text for TTS.
    Converts markdown to natural speech text.
    """
    # Remove code blocks entirely (not useful in speech)
    text = re.sub(r'```[\s\S]*?```', ' Code block omitted. ', text)
    # Remove inline code backticks
    text = re.sub(r'`([^`]+)`', r'\1', text)
    # Remove bold/italic markers
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
    text = re.sub(r'\*([^*]+)\*', r'\1', text)
    text = re.sub(r'__([^_]+)__', r'\1', text)
    text = re.sub(r'_([^_]+)_', r'\1', text)
    # Remove headers
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
    # Remove links, keep text
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    # Remove images
    text = re.sub(r'!\[([^\]]*)\]\([^)]+\)', r'\1', text)
    # Remove horizontal rules
    text = re.sub(r'^[-*_]{3,}$', '', text, flags=re.MULTILINE)
    # Remove bullet points (keep text)
    text = re.sub(r'^[\s]*[-*+]\s+', '', text, flags=re.MULTILINE)
    # Remove numbered list markers
    text = re.sub(r'^[\s]*\d+\.\s+', '', text, flags=re.MULTILINE)
    # Remove blockquotes
    text = re.sub(r'^>\s+', '', text, flags=re.MULTILINE)
    # Collapse whitespace
    text = re.sub(r'\n{2,}', '. ', text)
    text = re.sub(r'\n', ' ', text)
    text = re.sub(r'\s{2,}', ' ', text)
    return text.strip()


def pcm_to_wav(pcm_data: bytes) -> bytes:
    """Wrap raw PCM audio data in a WAV container."""
    buf = io.BytesIO()
    with wave.open(buf, 'w') as wf:
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(SAMPLE_WIDTH)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(pcm_data)
    return buf.getvalue()


class GeminiTTSService:
    """Text-to-Speech service using Google Gemini 2.5 Flash TTS."""

    def __init__(self):
        self._client: Optional[genai.Client] = None

    @property
    def client(self) -> genai.Client:
        """Lazy-init the Gemini client."""
        if self._client is None:
            if not settings.GEMINI_API_KEY:
                raise ValueError("GEMINI_API_KEY is not set")
            self._client = genai.Client(api_key=settings.GEMINI_API_KEY)
        return self._client

    def synthesize(
        self,
        text: str,
        voice: str = DEFAULT_VOICE,
        strip_markdown: bool = True,
    ) -> bytes:
        """
        Convert text to speech using Gemini TTS.

        Args:
            text: The text to synthesize.
            voice: Voice name (e.g., 'Kore', 'Puck', 'Aoede').
            strip_markdown: Whether to strip markdown formatting first.

        Returns:
            WAV audio bytes.
        """
        if strip_markdown:
            text = strip_markdown_for_speech(text)

        # Truncate very long texts (TTS works best under ~4000 chars)
        if len(text) > 4000:
            text = text[:4000] + "... For the complete answer, please read the text response."

        if not text.strip():
            raise ValueError("Empty text for TTS")

        voice_name = voice if voice in AVAILABLE_VOICES else DEFAULT_VOICE

        start_time = time.time()
        logger.info(f"TTS request: {len(text)} chars, voice={voice_name}")

        try:
            response = self.client.models.generate_content(
                model='gemini-2.5-flash-preview-tts',
                contents=text,
                config=types.GenerateContentConfig(
                    response_modalities=['AUDIO'],
                    speech_config=types.SpeechConfig(
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(
                                voice_name=voice_name
                            )
                        )
                    ),
                ),
            )

            audio_part = response.candidates[0].content.parts[0].inline_data
            pcm_data = audio_part.data

            wav_data = pcm_to_wav(pcm_data)

            elapsed = time.time() - start_time
            logger.info(
                f"TTS complete: {len(wav_data)} bytes WAV, "
                f"{elapsed:.2f}s, voice={voice_name}"
            )

            return wav_data

        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"TTS failed after {elapsed:.2f}s: {e}")
            raise


# Singleton
tts_service = GeminiTTSService()
