import { useEffect, useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronDown,
  Globe,
  Mic,
  MicOff,
  AlertCircle,
} from 'lucide-react';
import { VoiceVisualizer } from './VoiceVisualizer';
import { useSpeechRecognition, SUPPORTED_LANGUAGES } from '@/hooks/useSpeechRecognition';
import { useGeminiTTS } from '@/hooks/useGeminiTTS';
import { useVoiceStore } from '@/store/voiceStore';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import type { ChatMode } from '@/types';

interface VoiceModeProps {
  courseId: string;
  courseName: string;
  sessionFilter?: string;
  responseMode?: 'strict' | 'enhanced';
  chatMode?: ChatMode;
}

export function VoiceMode({
  courseId,
  courseName,
  sessionFilter,
  responseMode = 'enhanced',
  chatMode = 'doubt-clearing',
}: VoiceModeProps) {
  const {
    isOpen,
    state,
    language,
    userTranscript,
    interimTranscript,
    aiResponse,
    audioLevel,
    lastSpokenMessageId,
    close,
    setState,
    setLanguage,
    setUserTranscript,
    setInterimTranscript,
    setAiResponse,
    setAudioLevel,
    setLastSpokenMessageId,
    resetTranscripts,
  } = useVoiceStore();

  const { sendMessage, isLoading, currentSession } = useChatStore();
  const { user } = useAuthStore();
  const [showLanguages, setShowLanguages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const prevLoadingRef = useRef(false);
  const hasAutoStartedRef = useRef(false);
  const isOpenRef = useRef(false);
  const stateRef = useRef(state);

  // Keep refs in sync
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
  useEffect(() => { stateRef.current = state; }, [state]);

  // ── Shared TTS callbacks ──
  const ttsCallbacks = {
    onStart: () => {
      setState('speaking');
    },
    onEnd: () => {
      // After speaking, auto-resume listening for next question
      if (isOpenRef.current) {
        setState('listening');
        resetTranscripts();
        resetSTT();
        startListening();
      }
    },
    onError: (err: string) => {
      console.error('TTS error:', err);
      // On TTS failure, resume listening so conversation continues
      if (isOpenRef.current) {
        setState('listening');
        resetTranscripts();
        resetSTT();
        startListening();
      }
    },
  };

  // ── Gemini TTS (HD quality) ──
  const geminiTTS = useGeminiTTS({
    voice: 'Aoede',
    ...ttsCallbacks,
  });

  // ── TTS (Gemini HD voice) ──
  const { isSpeaking, isLoading: ttsLoading, speak, enqueue, flush, stop: stopSpeaking } = geminiTTS;

  // ── Streaming sentence detector ──
  // Track how much of the assistant message we've already sent to TTS
  const spokenLenRef = useRef(0);
  const streamingMsgIdRef = useRef<string | null>(null);

  // ── Direct send function (uses transcript from argument, not state) ──
  const doSend = useCallback(
    (text: string) => {
      if (!text.trim() || stateRef.current === 'processing') return;

      stopListeningRef.current?.();
      setState('processing');
      setAiResponse('');
      // Reset streaming sentence tracker for new message
      spokenLenRef.current = 0;
      streamingMsgIdRef.current = null;
      sendMessage(courseId, text.trim(), sessionFilter || undefined, responseMode, true, chatMode);
    },
    [courseId, sessionFilter, responseMode, sendMessage, chatMode]
  );

  // Refs for functions needed inside speech recognition callbacks
  const stopListeningRef = useRef<(() => void) | null>(null);

  // ── Speech Recognition ──
  const {
    isListening,
    isSupported: sttSupported,
    transcript: rawTranscript,
    interimTranscript: rawInterim,
    start: startListening,
    stop: stopListening,
    resetTranscript: resetSTT,
    audioStream,
  } = useSpeechRecognition({
    language,
    continuous: true,
    interimResults: true,
    onFinalTranscript: (text) => {
      setUserTranscript(text);
    },
    onSilence: (transcript) => {
      // Auto-send when user stops speaking — fully hands-free!
      // The transcript is passed directly, no stale closure issue.
      doSend(transcript);
    },
    onError: (err) => {
      if (err === 'not-allowed' || err === 'microphone-blocked') {
        setError('Microphone access denied. Please allow microphone access in your browser settings.');
      }
    },
  });

  // Keep ref in sync for use inside TTS callbacks
  useEffect(() => {
    stopListeningRef.current = stopListening;
  }, [stopListening]);

  // Sync transcript to store for display
  useEffect(() => {
    if (rawTranscript) setUserTranscript(rawTranscript);
  }, [rawTranscript]);

  useEffect(() => {
    setInterimTranscript(rawInterim);
  }, [rawInterim]);

  // ── Audio level analysis for visualizer ──
  useEffect(() => {
    if (!audioStream) {
      setAudioLevel(0);
      return;
    }

    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;

    const source = ctx.createMediaStreamSource(audioStream);
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const updateLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const normalized = Math.min(rms / 128, 1);
      setAudioLevel(normalized);
      animFrameRef.current = requestAnimationFrame(updateLevel);
    };

    updateLevel();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      source.disconnect();
      ctx.close();
    };
  }, [audioStream]);

  // ── Auto-start listening when opened ──
  useEffect(() => {
    if (isOpen && !hasAutoStartedRef.current) {
      hasAutoStartedRef.current = true;
      setState('listening');
      startListening();
    }
    if (!isOpen) {
      hasAutoStartedRef.current = false;
    }
  }, [isOpen]);

  // ── Stream-to-Speech: extract sentences as LLM streams, send to TTS immediately ──
  useEffect(() => {
    if (!isOpen || state !== 'processing') return;

    const messages = currentSession?.messages || [];
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.type !== 'assistant') return;

    const content = lastMsg.content || '';

    // Track which message we're streaming
    if (streamingMsgIdRef.current !== lastMsg.id) {
      streamingMsgIdRef.current = lastMsg.id;
      spokenLenRef.current = 0;
    }

    // Extract new text since last TTS enqueue
    const newText = content.slice(spokenLenRef.current);
    if (!newText) return;

    // Find complete sentences in the new text
    // Match sentences ending with . ! ? । followed by space or end of new content
    const sentencePattern = /[^.!?।]*[.!?।]+[\s]*/g;
    let match: RegExpExecArray | null;
    let lastEnd = 0;

    while ((match = sentencePattern.exec(newText)) !== null) {
      const sentence = newText.slice(lastEnd, match.index + match[0].length).trim();
      if (sentence.length >= 15) {
        // Enqueue complete sentence — TTS starts fetching immediately
        enqueue(sentence);
        spokenLenRef.current += match.index + match[0].length - lastEnd;
        lastEnd = match.index + match[0].length;
      }
    }

    // Update aiResponse display
    if (content) {
      setAiResponse(content);
    }
  }, [currentSession?.messages, isOpen, state, enqueue]);

  // ── On response complete: flush remaining text to TTS ──
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = isLoading;

    if (wasLoading && !isLoading && isOpen && state === 'processing') {
      const messages = currentSession?.messages || [];
      const lastMsg = messages[messages.length - 1];

      if (
        lastMsg &&
        lastMsg.type === 'assistant' &&
        lastMsg.content &&
        lastMsg.id !== lastSpokenMessageId
      ) {
        setLastSpokenMessageId(lastMsg.id);
        setAiResponse(lastMsg.content);

        // Enqueue any remaining text that didn't end with sentence punctuation
        const remaining = lastMsg.content.slice(spokenLenRef.current).trim();
        if (remaining) {
          enqueue(remaining);
        }

        // Mark stream as done — after last sentence plays, onEnd will fire
        stopListening();
        flush();
      }
    }
  }, [isLoading, isOpen, state, currentSession?.messages]);

  // ── Close handler ──
  const handleClose = useCallback(() => {
    stopListening();
    stopSpeaking();
    setAudioLevel(0);
    close();
  }, [stopListening, stopSpeaking]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
      // Space to interrupt TTS and start listening
      if (e.key === ' ' && (state === 'speaking' || ttsLoading)) {
        e.preventDefault();
        stopSpeaking();
        setState('listening');
        resetTranscripts();
        resetSTT();
        startListening();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, state, ttsLoading, handleClose]);

  // ── Handle tap on orb ──
  const handleOrbTap = useCallback(() => {
    if (state === 'listening') {
      // If there's a transcript, send it
      if (rawTranscript.trim()) {
        doSend(rawTranscript);
      }
    } else if (state === 'speaking' || ttsLoading) {
      // Interrupt AI speech, resume listening
      stopSpeaking();
      setState('listening');
      resetTranscripts();
      resetSTT();
      startListening();
    }
  }, [state, rawTranscript, ttsLoading, doSend, stopSpeaking, startListening]);

  if (!isOpen) return null;

  // ── Unsupported browser ──
  if (!sttSupported) {
    return (
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="text-center px-8 max-w-md">
          <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">
            Voice Mode Not Supported
          </h2>
          <p className="text-white/60 mb-6">
            Your browser doesn't support speech recognition. Please use{' '}
            <span className="text-white font-medium">Google Chrome</span> for
            the best voice experience with Indian language support.
          </p>
          <button
            onClick={handleClose}
            className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    );
  }

  // Voice state determines the effective display state
  const displayState = ttsLoading ? 'processing' : state;

  const statusText =
    displayState === 'listening'
      ? rawTranscript.trim()
        ? 'Listening... will send automatically when you pause'
        : 'Listening... speak now'
      : displayState === 'processing'
      ? isSpeaking ? 'Speaking...' : 'Thinking...'
      : displayState === 'speaking'
      ? 'Speaking... tap to interrupt'
      : 'Ready';

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === language);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-gradient-to-b from-black/95 via-black/90 to-black/95 backdrop-blur-xl"
        initial={{ opacity: 0, scale: 1.05 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3 }}
      >
        {/* ── Top bar ── */}
        <div className="w-full flex items-center justify-between px-6 pt-6 pb-2">
          {/* Language selector */}
          <div className="relative">
            <button
              onClick={() => setShowLanguages(!showLanguages)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-sm transition-colors"
            >
              <Globe className="w-4 h-4" />
              <span>{currentLang?.label || language}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${showLanguages ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Language dropdown */}
            <AnimatePresence>
              {showLanguages && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute top-12 left-0 w-64 max-h-80 overflow-y-auto rounded-xl bg-zinc-900 border border-white/10 shadow-2xl z-10 scrollbar-thin"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setLanguage(lang.code);
                        setShowLanguages(false);
                        if (isListening) {
                          stopListening();
                          setTimeout(() => startListening(), 200);
                        }
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors flex items-center gap-3 ${
                        language === lang.code
                          ? 'text-primary bg-primary/5'
                          : 'text-white/70'
                      }`}
                    >
                      <span className="text-lg">{lang.flag}</span>
                      <span>{lang.label}</span>
                      {language === lang.code && (
                        <span className="ml-auto text-primary text-xs">✓</span>
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Course name */}
          <div className="text-white/40 text-sm font-medium truncate max-w-[150px] hidden sm:block">
            {courseName}
          </div>

          {/* Close button */}
          <button
            onClick={handleClose}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Main content ── */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-8">
          {/* Greeting */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-white/30 text-sm mb-8 text-center"
          >
            Voice mode • {user?.full_name?.split(' ')[0] || 'Student'}
          </motion.p>

          {/* ── Visualizer ── */}
          <div onClick={handleOrbTap} className="cursor-pointer">
            <VoiceVisualizer state={displayState} audioLevel={audioLevel} />
          </div>

          {/* ── Status ── */}
          <motion.div
            key={displayState}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 text-center"
          >
            <p className="text-white/50 text-sm">{statusText}</p>
          </motion.div>

          {/* ── Transcript display ── */}
          <div className="mt-6 w-full max-w-lg min-h-[60px]">
            {/* User transcript */}
            {(userTranscript || interimTranscript) && displayState !== 'speaking' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
              >
                <p className="text-white/80 text-base leading-relaxed">
                  {userTranscript}
                  {interimTranscript && (
                    <span className="text-white/40"> {interimTranscript}</span>
                  )}
                </p>
              </motion.div>
            )}

            {/* AI response (while speaking) */}
            {(displayState === 'speaking' || (displayState === 'processing' && aiResponse)) && aiResponse && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center max-h-32 overflow-y-auto scrollbar-thin"
              >
                <p className="text-white/60 text-sm leading-relaxed">
                  {aiResponse.slice(0, 400)}
                  {aiResponse.length > 400 && '...'}
                </p>
              </motion.div>
            )}
          </div>

          {/* Error display */}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center max-w-md"
            >
              {error}
            </motion.div>
          )}
        </div>

        {/* ── Bottom controls ── */}
        <div className="w-full flex items-center justify-center gap-4 px-6 pb-8 pt-4">
          {/* Mute/unmute mic */}
          <button
            onClick={() => {
              if (isListening) {
                stopListening();
              } else {
                resetTranscripts();
                resetSTT();
                startListening();
                setState('listening');
              }
            }}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              isListening
                ? 'bg-white/10 hover:bg-white/15 text-white'
                : 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
            }`}
            title={isListening ? 'Mute mic' : 'Unmute mic'}
          >
            {isListening ? (
              <Mic className="w-5 h-5" />
            ) : (
              <MicOff className="w-5 h-5" />
            )}
          </button>

          {/* End voice mode */}
          <button
            onClick={handleClose}
            className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-500/30 transition-all hover:scale-105 active:scale-95"
            title="End voice mode"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* ── Keyboard hint ── */}
        <div className="pb-4">
          <p className="text-white/20 text-[11px] text-center">
            Hands-free • auto-sends after you pause speaking
            {(state === 'speaking' || ttsLoading) && (
              <>
                {' '} · <kbd className="px-1.5 py-0.5 rounded bg-white/5 text-white/30 font-mono text-[10px]">Space</kbd> to interrupt
              </>
            )}
            {' '} · <kbd className="px-1.5 py-0.5 rounded bg-white/5 text-white/30 font-mono text-[10px]">Esc</kbd> to close
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
