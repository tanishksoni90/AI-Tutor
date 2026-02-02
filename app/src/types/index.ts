// ==================== Auth ====================

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  org_id: string;
  role: 'student' | 'admin';
  is_active: boolean;
}

export interface AuthToken {
  access_token: string;
  token_type: 'bearer';
}

export interface LoginCredentials {
  username: string;
  password: string;
}

// ==================== Courses ====================

export interface Course {
  id: string;
  name: string;
  org_id: string;
  course_type: 'micro' | 'standard' | 'certification';
  total_sessions: number;
  total_chunks: number;
}

export interface EnrolledCourse extends Course {
  progress?: number;
  last_activity?: string;
  sessions: CourseSession[];
}

export interface CourseSession {
  session_id: string;
  title: string;
  document_count: number;
}

// ==================== Tutor ====================

/**
 * Context message for short-term memory (follow-up support)
 */
export interface ContextMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AskRequest {
  course_id: string;
  question: string;
  session_filter?: string;
  top_k?: number;
  enable_validation?: boolean;
  
  // Short-term memory: Last few messages for follow-up context
  context_messages?: ContextMessage[];
  
  // Anonymous session tracking (for analytics, not for storing conversations)
  session_token?: string;
}

export interface SourceReference {
  chunk_id: string;
  relevance_score: number;
  slide_number: number | null;
  slide_title: string | null;
  session_id: string | null;
}

export interface TutorResponse {
  answer: string;
  sources: SourceReference[];
  chunks_used: number;
  model_used: string;
  confidence: 'validated' | 'no_context' | 'generated';
  confidence_score?: number;  // 0-100 numeric score
  response_time_ms?: number;  // Response latency
}

// ==================== Chat History (Frontend State) ====================

/**
 * HYBRID MEMORY APPROACH
 * 
 * Messages are stored in-memory for the current session (short-term).
 * On page refresh/close, messages are cleared.
 * 
 * The backend stores analytics (topic, confidence, timing) but NOT
 * the actual question/answer text for privacy.
 */

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: SourceReference[];
  confidence?: string;
  confidenceScore?: number;  // 0-100 numeric score
  responseTimeMs?: number;   // Response latency in ms
  isLoading?: boolean;
}

export interface ChatSession {
  id: string;
  course_id: string;
  messages: ChatMessage[];
  created_at: Date;
  updated_at: Date;
}

// ==================== Ingestion (Admin) ====================

export interface IngestRequest {
  course_id: string;
  title: string;
  source_uri: string;
  content_type: 'slide' | 'pre_read' | 'post_read' | 'quiz' | 'transcript';
  session_id?: string;
  assignment_allowed?: boolean;
}

export interface IngestResponse {
  document_id: string;
  slides_extracted: number;
  chunks_created: number;
  embeddings_generated: number;
  total_characters: number;
  success: boolean;
  message: string | null;
}

// ==================== Health ====================

export interface HealthStatus {
  status: 'ok' | 'error';
  timestamp: string;
  service: string;
  version: string;
}

export interface DetailedHealth extends HealthStatus {
  environment: string;
  dependencies: {
    postgresql: { status: string; response_time_ms: string };
    qdrant: { status: string; collections_count: number };
    gemini_api: { status: string; model: string };
  };
}

// ==================== UI Components ====================

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface FeatureCard {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface StepItem {
  step: number;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}
