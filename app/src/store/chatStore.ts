import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatMessage, ChatSession, StreamMetadata, StreamDone } from '@/types';
import { api } from '@/lib/api';

/**
 * HYBRID MEMORY APPROACH
 * 
 * Short-term memory: Last 5 messages kept in session state for follow-ups.
 * These are passed to the API for context but NOT stored long-term.
 * 
 * Long-term storage: We only persist session metadata (course_id, timestamps).
 * The backend stores analytics (topic, confidence) but NOT conversation text.
 * 
 * On page refresh/close: Messages are cleared (short-term only).
 * 
 * STREAMING SUPPORT:
 * - Messages are streamed progressively for better UX
 * - Metadata (sources, confidence) arrives first
 * - Text chunks are appended in real-time
 */

// Maximum messages to keep for context (short-term memory)
const MAX_CONTEXT_MESSAGES = 5;

interface ContextMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatState {
  // In-memory sessions (short-term, cleared on refresh)
  sessions: ChatSession[];
  currentSession: ChatSession | null;
  isLoading: boolean;
  error: string | null;
  
  // Session tokens for analytics grouping (generated per course session)
  sessionTokens: Record<string, string>;
  
  // Actions
  createSession: (courseId: string) => string;
  addMessage: (sessionId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  updateMessageContent: (sessionId: string, messageId: string, update: Partial<ChatMessage>) => void;
  appendMessageChunk: (sessionId: string, messageId: string, chunk: string) => void;
  sendMessage: (courseId: string, question: string, sessionFilter?: string, responseMode?: 'strict' | 'enhanced') => Promise<void>;
  setCurrentSession: (session: ChatSession | null) => void;
  clearSessions: () => void;
  clearSessionMessages: (courseId: string) => void;
  getSessionByCourseId: (courseId: string) => ChatSession | undefined;
  getContextMessages: (courseId: string) => ContextMessage[];
  getSessionToken: (courseId: string) => string;
}

const generateId = () => Math.random().toString(36).substring(2, 15);
const generateSessionToken = () => `session_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      sessions: [],
      currentSession: null,
      isLoading: false,
      error: null,
      sessionTokens: {},

      createSession: (courseId: string) => {
        const sessionId = generateId();
        const newSession: ChatSession = {
          id: sessionId,
          course_id: courseId,
          messages: [],
          created_at: new Date(),
          updated_at: new Date(),
        };
        
        // Generate a new session token for analytics
        const sessionToken = generateSessionToken();
        
        set((state) => ({
          sessions: [...state.sessions, newSession],
          currentSession: newSession,
          sessionTokens: { ...state.sessionTokens, [courseId]: sessionToken },
        }));
        
        return sessionId;
      },

      addMessage: (sessionId: string, messageData) => {
        const message: ChatMessage = {
          ...messageData,
          id: generateId(),
          timestamp: new Date(),
        };

        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  messages: [...session.messages, message],
                  updated_at: new Date(),
                }
              : session
          ),
          currentSession: state.currentSession?.id === sessionId
            ? {
                ...state.currentSession,
                messages: [...state.currentSession.messages, message],
                updated_at: new Date(),
              }
            : state.currentSession,
        }));
        
        return message.id;
      },

      updateMessageContent: (sessionId: string, messageId: string, update: Partial<ChatMessage>) => {
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  messages: session.messages.map((msg) =>
                    msg.id === messageId ? { ...msg, ...update } : msg
                  ),
                  updated_at: new Date(),
                }
              : session
          ),
          currentSession: state.currentSession?.id === sessionId
            ? {
                ...state.currentSession,
                messages: state.currentSession.messages.map((msg) =>
                  msg.id === messageId ? { ...msg, ...update } : msg
                ),
                updated_at: new Date(),
              }
            : state.currentSession,
        }));
      },

      appendMessageChunk: (sessionId: string, messageId: string, chunk: string) => {
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  messages: session.messages.map((msg) =>
                    msg.id === messageId 
                      ? { ...msg, content: (msg.content || '') + chunk }
                      : msg
                  ),
                }
              : session
          ),
          currentSession: state.currentSession?.id === sessionId
            ? {
                ...state.currentSession,
                messages: state.currentSession.messages.map((msg) =>
                  msg.id === messageId 
                    ? { ...msg, content: (msg.content || '') + chunk }
                    : msg
                ),
              }
            : state.currentSession,
        }));
      },

      sendMessage: async (courseId: string, question: string, sessionFilter?: string, responseMode: 'strict' | 'enhanced' = 'enhanced') => {
        let session = get().getSessionByCourseId(courseId);
        
        if (!session) {
          const sessionId = get().createSession(courseId);
          session = get().sessions.find((s) => s.id === sessionId);
        }

        if (!session) return;

        // Add user message
        get().addMessage(session.id, {
          type: 'user',
          content: question,
        });

        // Get context messages for follow-up support (short-term memory)
        const contextMessages = get().getContextMessages(courseId);
        const sessionToken = get().getSessionToken(courseId);

        // Add assistant message placeholder (for streaming)
        const assistantId = generateId();
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === session!.id
              ? {
                  ...sess,
                  messages: [
                    ...sess.messages,
                    {
                      id: assistantId,
                      type: 'assistant',
                      content: '',
                      timestamp: new Date(),
                      isLoading: true,
                    },
                  ],
                }
              : sess
          ),
          currentSession: s.currentSession?.id === session!.id
            ? {
                ...s.currentSession,
                messages: [
                  ...s.currentSession.messages,
                  {
                    id: assistantId,
                    type: 'assistant',
                    content: '',
                    timestamp: new Date(),
                    isLoading: true,
                  },
                ],
              }
            : s.currentSession,
        }));

        set({ isLoading: true, error: null });

        try {
          // Use streaming API
          await api.askTutorStream(
            {
              course_id: courseId,
              question,
              session_filter: sessionFilter,
              top_k: 5,
              enable_validation: true,
              context_messages: contextMessages.length > 0 ? contextMessages : undefined,
              session_token: sessionToken,
              response_mode: responseMode,
            },
            {
              onMetadata: (metadata) => {
                // Update message with metadata (sources, confidence)
                // Keep isLoading true to show typing cursor while streaming
                get().updateMessageContent(session!.id, assistantId, {
                  sources: metadata.sources,
                  confidence: metadata.confidence,
                  confidenceScore: metadata.confidence_score,
                  isLoading: true, // Keep true - cursor shows while streaming
                });
              },
              onChunk: (chunk) => {
                // Append text chunk to message
                get().appendMessageChunk(session!.id, assistantId, chunk);
              },
              onDone: (done) => {
                // Update final metrics and hide cursor
                get().updateMessageContent(session!.id, assistantId, {
                  responseTimeMs: done.response_time_ms,
                  isLoading: false, // Now hide the cursor
                });
                set({ isLoading: false });
              },
              onError: (error) => {
                // Update message with error
                get().updateMessageContent(session!.id, assistantId, {
                  content: 'Sorry, I encountered an error while processing your question. Please try again.',
                  isLoading: false,
                });
                set({ error, isLoading: false });
              },
            }
          );
        } catch (err: any) {
          // Handle connection errors
          get().updateMessageContent(session!.id, assistantId, {
            content: 'Sorry, I encountered an error while processing your question. Please try again.',
            isLoading: false,
          });
          set({ error: err.message, isLoading: false });
        }
      },

      setCurrentSession: (session) => {
        set({ currentSession: session });
      },

      clearSessions: () => {
        set({ sessions: [], currentSession: null, sessionTokens: {} });
      },

      clearSessionMessages: (courseId: string) => {
        // Clear messages for a specific course (start fresh conversation)
        const newToken = generateSessionToken();
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.course_id === courseId
              ? { ...session, messages: [], updated_at: new Date() }
              : session
          ),
          currentSession: state.currentSession?.course_id === courseId
            ? { ...state.currentSession, messages: [], updated_at: new Date() }
            : state.currentSession,
          sessionTokens: { ...state.sessionTokens, [courseId]: newToken },
        }));
      },

      getSessionByCourseId: (courseId: string) => {
        return get().sessions.find((s) => s.course_id === courseId);
      },

      getContextMessages: (courseId: string) => {
        /**
         * Get the last N messages for context (short-term memory).
         * This enables follow-up questions like "explain that more simply".
         */
        const session = get().sessions.find((s) => s.course_id === courseId);
        if (!session) return [];

        // Get last MAX_CONTEXT_MESSAGES messages, excluding loading states
        const validMessages = session.messages.filter(
          (msg) => !msg.isLoading && msg.content
        );

        return validMessages.slice(-MAX_CONTEXT_MESSAGES).map((msg) => ({
          role: msg.type as 'user' | 'assistant',
          content: msg.content,
        }));
      },

      getSessionToken: (courseId: string) => {
        /**
         * Get or create a session token for analytics grouping.
         * This helps track query patterns within a study session.
         */
        const state = get();
        if (!state.sessionTokens[courseId]) {
          const newToken = generateSessionToken();
          set((s) => ({
            sessionTokens: { ...s.sessionTokens, [courseId]: newToken },
          }));
          return newToken;
        }
        return state.sessionTokens[courseId];
      },
    }),
    {
      name: 'chat-storage',
      // Only persist session metadata, NOT messages (short-term memory)
      partialize: (state) => ({ 
        sessions: state.sessions.map(s => ({
          ...s,
          // Clear messages on persist - they're short-term only
          messages: [],
        })),
        sessionTokens: state.sessionTokens,
      }),
    }
  )
);
