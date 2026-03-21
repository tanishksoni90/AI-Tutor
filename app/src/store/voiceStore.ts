import { create } from 'zustand';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking';

interface VoiceStore {
  // Core state
  isOpen: boolean;
  state: VoiceState;
  language: string;

  // Transcripts
  userTranscript: string;
  interimTranscript: string;
  aiResponse: string;

  // Audio visualization
  audioLevel: number;

  // Settings
  autoSendOnSilence: boolean;
  speakResponses: boolean;

  // Tracking which message is being handled in voice mode
  lastSpokenMessageId: string | null;

  // Actions
  open: () => void;
  close: () => void;
  setState: (state: VoiceState) => void;
  setLanguage: (language: string) => void;
  setUserTranscript: (transcript: string) => void;
  setInterimTranscript: (interim: string) => void;
  setAiResponse: (response: string) => void;
  setAudioLevel: (level: number) => void;
  setLastSpokenMessageId: (id: string | null) => void;
  resetTranscripts: () => void;
  toggleAutoSend: () => void;
  toggleSpeakResponses: () => void;
}

export const useVoiceStore = create<VoiceStore>()((set) => ({
  isOpen: false,
  state: 'idle',
  language: 'en-IN',

  userTranscript: '',
  interimTranscript: '',
  aiResponse: '',

  audioLevel: 0,

  autoSendOnSilence: true,
  speakResponses: true,

  lastSpokenMessageId: null,

  open: () => set({ isOpen: true, state: 'listening' }),
  close: () =>
    set({
      isOpen: false,
      state: 'idle',
      userTranscript: '',
      interimTranscript: '',
      aiResponse: '',
      audioLevel: 0,
    }),

  setState: (state) => set({ state }),
  setLanguage: (language) => set({ language }),
  setUserTranscript: (userTranscript) => set({ userTranscript }),
  setInterimTranscript: (interimTranscript) => set({ interimTranscript }),
  setAiResponse: (aiResponse) => set({ aiResponse }),
  setAudioLevel: (audioLevel) => set({ audioLevel }),
  setLastSpokenMessageId: (lastSpokenMessageId) => set({ lastSpokenMessageId }),

  resetTranscripts: () =>
    set({ userTranscript: '', interimTranscript: '', aiResponse: '' }),

  toggleAutoSend: () =>
    set((s) => ({ autoSendOnSilence: !s.autoSendOnSilence })),
  toggleSpeakResponses: () =>
    set((s) => ({ speakResponses: !s.speakResponses })),
}));
