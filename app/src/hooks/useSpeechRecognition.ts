import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Supported Indian languages for Speech Recognition.
 * These all work with Chrome's Web Speech API via Google's cloud STT.
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'en-IN', label: 'English (India)', flag: '🇮🇳' },
  { code: 'hi-IN', label: 'हिन्दी (Hindi)', flag: '🇮🇳' },
  { code: 'bn-IN', label: 'বাংলা (Bengali)', flag: '🇮🇳' },
  { code: 'ta-IN', label: 'தமிழ் (Tamil)', flag: '🇮🇳' },
  { code: 'te-IN', label: 'తెలుగు (Telugu)', flag: '🇮🇳' },
  { code: 'mr-IN', label: 'मराठी (Marathi)', flag: '🇮🇳' },
  { code: 'gu-IN', label: 'ગુજરાતી (Gujarati)', flag: '🇮🇳' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ (Kannada)', flag: '🇮🇳' },
  { code: 'ml-IN', label: 'മലയാളം (Malayalam)', flag: '🇮🇳' },
  { code: 'pa-IN', label: 'ਪੰਜਾਬੀ (Punjabi)', flag: '🇮🇳' },
  { code: 'ur-IN', label: 'اردو (Urdu)', flag: '🇮🇳' },
  { code: 'or-IN', label: 'ଓଡ଼ିଆ (Odia)', flag: '🇮🇳' },
] as const;

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

interface UseSpeechRecognitionOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  /** Called after user stops speaking and final transcript is available */
  onFinalTranscript?: (transcript: string) => void;
  /** Called when silence is detected — receives the full transcript */
  onSilence?: (transcript: string) => void;
  onError?: (error: string) => void;
}

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  start: () => void;
  stop: () => void;
  resetTranscript: () => void;
  /** Audio stream for visualization */
  audioStream: MediaStream | null;
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isListeningRef = useRef(false);
  const shouldRestartRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptRef = useRef('');

  // Store callbacks in refs to avoid stale closures
  const callbacksRef = useRef(options);
  callbacksRef.current = options;

  // Keep ref in sync
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // Initialize SpeechRecognition
  useEffect(() => {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = options.continuous ?? true;
    recognition.interimResults = options.interimResults ?? true;
    recognition.lang = options.language || 'en-IN';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = '';
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      if (finalText) {
        const newTranscript = (transcriptRef.current + ' ' + finalText).trim();
        transcriptRef.current = newTranscript;
        setTranscript(newTranscript);
        setInterimTranscript('');
        callbacksRef.current.onFinalTranscript?.(newTranscript);

        // Reset silence timer on new speech
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        // Start silence detection (1.5s after last final result)
        silenceTimerRef.current = setTimeout(() => {
          if (isListeningRef.current && transcriptRef.current.trim()) {
            callbacksRef.current.onSilence?.(transcriptRef.current);
          }
        }, 1500);
      }

      if (interimText) {
        setInterimTranscript(interimText);
      }
    };

    recognition.onend = () => {
      // Auto-restart if we should still be listening
      if (shouldRestartRef.current && isListeningRef.current) {
        try {
          recognition.start();
        } catch {
          // Already started or browser blocked
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const ignoredErrors = ['no-speech', 'aborted'];
      if (!ignoredErrors.includes(event.error)) {
        callbacksRef.current.onError?.(event.error);
        if (event.error === 'not-allowed') {
          setIsListening(false);
          isListeningRef.current = false;
          shouldRestartRef.current = false;
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      shouldRestartRef.current = false;
      recognition.abort();
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, [options.language]);

  const start = useCallback(async () => {
    if (!recognitionRef.current) return;

    try {
      // Request microphone access and keep stream for audio visualization
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);

      // Update language in case it changed
      recognitionRef.current.lang = options.language || 'en-IN';

      transcriptRef.current = '';
      setTranscript('');
      setInterimTranscript('');
      shouldRestartRef.current = true;
      setIsListening(true);
      recognitionRef.current.start();
    } catch (err) {
      options.onError?.('microphone-blocked');
    }
  }, [options.language]);

  const stop = useCallback(() => {
    shouldRestartRef.current = false;
    setIsListening(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    // Stop audio stream tracks
    if (audioStream) {
      audioStream.getTracks().forEach((track) => track.stop());
      setAudioStream(null);
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
  }, [audioStream]);

  const resetTranscript = useCallback(() => {
    transcriptRef.current = '';
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    start,
    stop,
    resetTranscript,
    audioStream,
  };
}
