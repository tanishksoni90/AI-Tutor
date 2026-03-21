"""
Text-to-Speech API Endpoint.

POST /api/v1/tutor/tts — Convert text to natural speech using Gemini TTS.
Returns WAV audio bytes for browser playback.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel, Field

from src.api.deps import CurrentUser
from src.services.tts import tts_service, AVAILABLE_VOICES

router = APIRouter(prefix="/tutor", tags=["tutor"])
logger = logging.getLogger(__name__)


class TTSRequest(BaseModel):
    """Request to synthesize speech from text."""
    text: str = Field(..., min_length=1, max_length=5000, description="Text to synthesize")
    voice: str = Field(default="Aoede", description="Voice name")
    strip_markdown: bool = Field(default=True, description="Strip markdown formatting")


class TTSVoicesResponse(BaseModel):
    """Available TTS voices."""
    voices: dict[str, str]
    default: str


@router.post("/tts", response_class=Response)
async def text_to_speech(
    request: TTSRequest,
    current_user: CurrentUser,
):
    """
    Convert text to natural speech using Gemini TTS.
    
    Returns WAV audio suitable for browser playback.
    Supports multilingual text including Hindi and Indian languages.
    """
    try:
        wav_data = tts_service.synthesize(
            text=request.text,
            voice=request.voice,
            strip_markdown=request.strip_markdown,
        )

        return Response(
            content=wav_data,
            media_type="audio/wav",
            headers={
                "Cache-Control": "no-cache",
                "Content-Disposition": "inline",
            },
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"TTS endpoint error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate speech. Please try again.",
        )


@router.get("/tts/voices")
async def list_voices(current_user: CurrentUser):
    """List available TTS voices."""
    return TTSVoicesResponse(
        voices=AVAILABLE_VOICES,
        default="Aoede",
    )
