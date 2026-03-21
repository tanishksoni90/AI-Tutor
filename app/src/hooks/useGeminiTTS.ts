import { useState, useRef, useCallback } from 'react';
import { api } from '@/lib/api';

interface UseGeminiTTSOptions {
  voice?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

interface UseGeminiTTSReturn {
  isSpeaking: boolean;
  isLoading: boolean;
  /** Legacy single-shot: split text into sentences, queue them, flush. */
  speak: (text: string) => void;
  /** Queue a single sentence for sequential playback. Starts immediately if idle. */
  enqueue: (sentence: string) => void;
  /** Mark the stream as done — after last queued sentence plays, onEnd fires. */
  flush: () => void;
  /** Stop all playback, clear queue, reset state. */
  stop: () => void;
}

/**
 * Gemini TTS hook with sentence-level queued playback.
 *
 * Instead of waiting for the entire LLM response, callers feed
 * sentences one at a time via `enqueue()`. The hook fetches audio for
 * the first sentence immediately (user hears speech within ~2s) and
 * plays subsequent sentences back-to-back.
 *
 * Flow:
 *   enqueue("First sentence.")  → fetch audio → play → onStart fires
 *   enqueue("Second sentence.") → pre-fetched while first plays
 *   flush()                     → mark stream done
 *   last audio ends             → onEnd fires → resume listening
 */
export function useGeminiTTS(
  options: UseGeminiTTSOptions = {}
): UseGeminiTTSReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const queueRef = useRef<string[]>([]);
  const busyRef = useRef(false);
  const firstSentenceRef = useRef(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);
  const streamDoneRef = useRef(false);

  // Stable ref for callbacks so processQueue doesn't go stale
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  /**
   * Process the next sentence in the queue.
   * Fetches audio, plays it, then recurses to drain the queue.
   */
  const processQueue = useCallback(async () => {
    if (cancelledRef.current) return;

    const next = queueRef.current.shift();
    if (!next) {
      // Queue empty
      busyRef.current = false;
      if (streamDoneRef.current) {
        // All done — fire onEnd
        setIsSpeaking(false);
        setIsLoading(false);
        firstSentenceRef.current = true;
        streamDoneRef.current = false;
        optionsRef.current.onEnd?.();
      }
      return;
    }

    busyRef.current = true;

    // Show loading spinner only for the first sentence
    if (firstSentenceRef.current) {
      setIsLoading(true);
    }

    try {
      const blob = await api.textToSpeech(next, optionsRef.current.voice || 'Aoede');
      if (cancelledRef.current) return;

      cleanupAudio();
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      await new Promise<void>((resolve, reject) => {
        audio.onplay = () => {
          if (firstSentenceRef.current) {
            firstSentenceRef.current = false;
            setIsLoading(false);
            setIsSpeaking(true);
            optionsRef.current.onStart?.();
          }
        };
        audio.onended = () => {
          cleanupAudio();
          resolve();
        };
        audio.onerror = () => {
          cleanupAudio();
          reject(new Error('Audio playback failed'));
        };
        audio.play().catch(reject);
      });

      // Sentence done — process next
      if (!cancelledRef.current) {
        processQueue();
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || cancelledRef.current) return;
      console.error('TTS sentence error:', err);
      // Skip failed sentence, try next
      if (!cancelledRef.current) {
        processQueue();
      }
    }
  }, [cleanupAudio]);

  /**
   * Add a sentence to the queue. Starts processing immediately if idle.
   */
  const enqueue = useCallback(
    (sentence: string) => {
      if (!sentence.trim() || cancelledRef.current) return;
      queueRef.current.push(sentence.trim());
      if (!busyRef.current) {
        processQueue();
      }
    },
    [processQueue]
  );

  /**
   * Mark the stream as done.
   * After the last queued sentence finishes playing, onEnd fires.
   */
  const flush = useCallback(() => {
    streamDoneRef.current = true;
    // If already idle, fire onEnd now
    if (!busyRef.current && queueRef.current.length === 0) {
      setIsSpeaking(false);
      setIsLoading(false);
      firstSentenceRef.current = true;
      streamDoneRef.current = false;
      optionsRef.current.onEnd?.();
    }
  }, []);

  /**
   * Legacy single-shot speak — splits into sentences, queues all, flushes.
   */
  const speak = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      // Reset state for fresh playback
      cancelledRef.current = false;
      streamDoneRef.current = false;
      firstSentenceRef.current = true;
      queueRef.current = [];
      cleanupAudio();

      const sentences = splitSentences(text);
      for (const s of sentences) {
        enqueue(s);
      }
      flush();
    },
    [enqueue, flush, cleanupAudio]
  );

  /**
   * Stop everything — clear queue, stop audio, reset.
   */
  const stop = useCallback(() => {
    cancelledRef.current = true;
    queueRef.current = [];
    streamDoneRef.current = false;
    firstSentenceRef.current = true;
    busyRef.current = false;
    cleanupAudio();
    setIsSpeaking(false);
    setIsLoading(false);
    // Reset cancelled after a tick so future enqueue() calls work
    setTimeout(() => {
      cancelledRef.current = false;
    }, 0);
  }, [cleanupAudio]);

  return { isSpeaking, isLoading, speak, enqueue, flush, stop };
}

// ── Sentence splitting ──

/**
 * Split text into sentences at natural boundaries.
 * Merges very short fragments to avoid excessive API calls.
 */
function splitSentences(text: string): string[] {
  const raw = text.match(/[^.!?।]+[.!?।]+[\s]*/g) || [text];

  const merged: string[] = [];
  let buffer = '';

  for (const part of raw) {
    buffer += part;
    if (buffer.length >= 40) {
      merged.push(buffer.trim());
      buffer = '';
    }
  }

  if (buffer.trim()) {
    if (merged.length > 0 && buffer.trim().length < 30) {
      merged[merged.length - 1] += ' ' + buffer.trim();
    } else {
      merged.push(buffer.trim());
    }
  }

  return merged.filter(Boolean);
}
