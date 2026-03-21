import { create } from 'zustand';
import type {
  CanvasToolType,
  QuizData,
  FlashCardDeck,
  StudyNote,
} from '@/types';

interface CanvasState {
  // Panel state
  isOpen: boolean;
  activeTool: CanvasToolType;
  isGenerating: boolean;
  error: string | null;

  // Content
  quizData: QuizData | null;
  flashcardData: FlashCardDeck | null;
  notesData: StudyNote | null;

  // Quiz progress
  quizAnswers: Record<string, number>; // questionId → selectedIndex
  quizSubmitted: boolean;
  currentQuizIndex: number;

  // Flashcard progress
  currentCardIndex: number;
  flippedCards: Set<string>; // cardId → flipped

  // Actions
  open: (tool: CanvasToolType) => void;
  close: () => void;
  setActiveTool: (tool: CanvasToolType) => void;
  setGenerating: (generating: boolean) => void;
  setError: (error: string | null) => void;

  // Quiz actions
  setQuizData: (data: QuizData) => void;
  answerQuestion: (questionId: string, selectedIndex: number) => void;
  submitQuiz: () => void;
  resetQuiz: () => void;
  setCurrentQuizIndex: (index: number) => void;

  // Flashcard actions
  setFlashcardData: (data: FlashCardDeck) => void;
  nextCard: () => void;
  prevCard: () => void;
  toggleFlip: (cardId: string) => void;
  resetFlashcards: () => void;

  // Notes actions
  setNotesData: (data: StudyNote) => void;

  // Reset all
  resetAll: () => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  // Initial state
  isOpen: false,
  activeTool: null,
  isGenerating: false,
  error: null,
  quizData: null,
  flashcardData: null,
  notesData: null,
  quizAnswers: {},
  quizSubmitted: false,
  currentQuizIndex: 0,
  currentCardIndex: 0,
  flippedCards: new Set(),

  // Panel
  open: (tool) =>
    set({
      isOpen: true,
      activeTool: tool,
      error: null,
    }),

  close: () =>
    set({
      isOpen: false,
    }),

  setActiveTool: (tool) =>
    set({ activeTool: tool, error: null }),

  setGenerating: (generating) =>
    set({ isGenerating: generating }),

  setError: (error) =>
    set({ error, isGenerating: false }),

  // Quiz
  setQuizData: (data) =>
    set({
      quizData: data,
      quizAnswers: {},
      quizSubmitted: false,
      currentQuizIndex: 0,
      isGenerating: false,
      error: null,
    }),

  answerQuestion: (questionId, selectedIndex) =>
    set((state) => ({
      quizAnswers: { ...state.quizAnswers, [questionId]: selectedIndex },
    })),

  submitQuiz: () =>
    set({ quizSubmitted: true }),

  resetQuiz: () =>
    set({
      quizAnswers: {},
      quizSubmitted: false,
      currentQuizIndex: 0,
    }),

  setCurrentQuizIndex: (index) =>
    set({ currentQuizIndex: index }),

  // Flashcards
  setFlashcardData: (data) =>
    set({
      flashcardData: data,
      currentCardIndex: 0,
      flippedCards: new Set(),
      isGenerating: false,
      error: null,
    }),

  nextCard: () =>
    set((state) => {
      const total = state.flashcardData?.cards.length || 0;
      return {
        currentCardIndex: Math.min(state.currentCardIndex + 1, total - 1),
      };
    }),

  prevCard: () =>
    set((state) => ({
      currentCardIndex: Math.max(state.currentCardIndex - 1, 0),
    })),

  toggleFlip: (cardId) =>
    set((state) => {
      const newFlipped = new Set(state.flippedCards);
      if (newFlipped.has(cardId)) {
        newFlipped.delete(cardId);
      } else {
        newFlipped.add(cardId);
      }
      return { flippedCards: newFlipped };
    }),

  resetFlashcards: () =>
    set({
      currentCardIndex: 0,
      flippedCards: new Set(),
    }),

  // Notes
  setNotesData: (data) =>
    set({
      notesData: data,
      isGenerating: false,
      error: null,
    }),

  // Reset all
  resetAll: () =>
    set({
      isOpen: false,
      activeTool: null,
      isGenerating: false,
      error: null,
      quizData: null,
      flashcardData: null,
      notesData: null,
      quizAnswers: {},
      quizSubmitted: false,
      currentQuizIndex: 0,
      currentCardIndex: 0,
      flippedCards: new Set(),
    }),
}));
