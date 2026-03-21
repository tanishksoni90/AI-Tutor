import type { 
  User, 
  AuthToken, 
  AskRequest, 
  GeneralAskRequest,
  TutorResponse,
  StreamEvent,
  StreamMetadata,
  StreamDone,
  IngestRequest, 
  IngestResponse,
  DetailedHealth,
  GenerateToolRequest,
  GenerateToolResponse,
} from '@/types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export class ApiError extends Error {
  status: number;
  
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('access_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('access_token');
  }

  loadToken(): boolean {
    const token = localStorage.getItem('access_token');
    if (token) {
      this.token = token;
      return true;
    }
    return false;
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (options.headers) {
      const opts = options.headers as Record<string, string>;
      Object.keys(opts).forEach((key) => {
        headers[key] = opts[key];
      });
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.message || error.detail || 'Request failed');
    }

    return response.json();
  }

  // ==================== Auth ====================

  async login(email: string, password: string): Promise<AuthToken> {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.message || error.detail || 'Login failed');
    }

    const data = await response.json();
    this.setToken(data.access_token);
    return data;
  }

  async getMe(): Promise<User> {
    return this.request('/api/v1/auth/me');
  }

  async register(userData: {
    email: string;
    password: string;
    full_name: string;
    org_id: string;
    role: 'student' | 'admin';
  }): Promise<User> {
    return this.request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  // ==================== Invitation (Public) ====================

  async validateInvitation(token: string): Promise<{
    email: string;
    full_name?: string;
    courses: string[];
    expires_at: string;
  }> {
    const response = await fetch(`${API_BASE}/api/v1/auth/validate-invitation/${token}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.message || error.detail || 'Invalid invitation');
    }
    return response.json();
  }

  async acceptInvitation(token: string, password: string): Promise<AuthToken> {
    const response = await fetch(`${API_BASE}/api/v1/auth/accept-invitation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.message || error.detail || 'Failed to accept invitation');
    }
    const data = await response.json();
    this.setToken(data.access_token);
    return data;
  }

  // ==================== Tutor ====================

  async askTutor(request: AskRequest): Promise<TutorResponse> {
    return this.request('/api/v1/tutor/ask', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Ask the tutor a question with streaming response.
   * 
   * @param request - The ask request
   * @param onMetadata - Callback when metadata (sources, confidence) is received
   * @param onChunk - Callback for each text chunk
   * @param onDone - Callback when streaming is complete
   * @param onError - Callback on error
   */
  async askTutorStream(
    request: AskRequest,
    callbacks: {
      onMetadata?: (metadata: StreamMetadata) => void;
      onChunk?: (chunk: string) => void;
      onDone?: (done: StreamDone) => void;
      onError?: (error: string) => void;
    }
  ): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}/api/v1/tutor/ask/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.message || error.detail || 'Request failed');
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete SSE messages
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6); // Remove 'data: ' prefix
            if (jsonStr.trim()) {
              try {
                const event: StreamEvent = JSON.parse(jsonStr);
                
                switch (event.type) {
                  case 'metadata':
                    callbacks.onMetadata?.(event.data as StreamMetadata);
                    break;
                  case 'chunk':
                    callbacks.onChunk?.(event.data as string);
                    break;
                  case 'done':
                    callbacks.onDone?.(event.data as StreamDone);
                    break;
                  case 'error':
                    callbacks.onError?.(event.data as string);
                    break;
                }
              } catch (parseError) {
                console.error('Failed to parse SSE event:', parseError, jsonStr);
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Ask the general AI tutor (Learning mode - no RAG).
   * Same SSE streaming format as askTutorStream but skips RAG pipeline.
   * Much faster responses since no embedding/retrieval step.
   */
  async askGeneralStream(
    request: GeneralAskRequest,
    callbacks: {
      onMetadata?: (metadata: StreamMetadata) => void;
      onChunk?: (chunk: string) => void;
      onDone?: (done: StreamDone) => void;
      onError?: (error: string) => void;
    }
  ): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}/api/v1/tutor/ask/general/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.message || error.detail || 'Request failed');
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            if (jsonStr.trim()) {
              try {
                const event: StreamEvent = JSON.parse(jsonStr);
                
                switch (event.type) {
                  case 'metadata':
                    callbacks.onMetadata?.(event.data as StreamMetadata);
                    break;
                  case 'chunk':
                    callbacks.onChunk?.(event.data as string);
                    break;
                  case 'done':
                    callbacks.onDone?.(event.data as StreamDone);
                    break;
                  case 'error':
                    callbacks.onError?.(event.data as string);
                    break;
                }
              } catch (parseError) {
                console.error('Failed to parse SSE event:', parseError, jsonStr);
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ==================== Health ====================

  async getHealth(): Promise<DetailedHealth> {
    return this.request('/health/detailed');
  }

  async getBasicHealth(): Promise<{ status: string }> {
    const response = await fetch(`${API_BASE}/health`);
    return response.json();
  }

  // ==================== Admin - Ingestion ====================

  async ingestDocument(request: IngestRequest): Promise<IngestResponse> {
    return this.request('/api/v1/ingestion/ingest', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async uploadAndIngestDocument(
    file: File,
    courseId: string,
    title: string,
    contentType: 'slide' | 'pre_read' | 'post_read' | 'quiz' | 'transcript',
    sessionId?: string,
    assignmentAllowed: boolean = true
  ): Promise<IngestResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('course_id', courseId);
    formData.append('title', title);
    formData.append('content_type', contentType);
    if (sessionId) {
      formData.append('session_id', sessionId);
    }
    formData.append('assignment_allowed', String(assignmentAllowed));

    const response = await fetch(`${API_BASE}/api/v1/ingestion/upload-and-ingest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        // Don't set Content-Type - browser will set it with boundary for multipart
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.message || error.detail || 'Upload failed');
    }

    return response.json();
  }

  // ==================== Admin API ====================

  async getAdminStats(): Promise<any> {
    return this.request('/api/v1/admin/stats');
  }

  async getAdminUsers(params?: { search?: string; role?: string | null }): Promise<any[]> {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append('search', params.search);
    if (params?.role) queryParams.append('role', params.role);
    const queryString = queryParams.toString();
    return this.request(`/api/v1/admin/users${queryString ? `?${queryString}` : ''}`);
  }

  async bulkImportStudents(students: { email: string; full_name?: string; course_name: string }[]): Promise<{
    total: number;
    created: number;
    existing: number;
    errors: number;
    students: { email: string; full_name?: string; course_name: string; status: string; message?: string }[];
  }> {
    return this.request('/api/v1/admin/users/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ students }),
    });
  }

  async getPendingUsers(): Promise<any[]> {
    return this.request('/api/v1/admin/users/pending');
  }

  async resendInvitation(userId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/v1/admin/users/${userId}/resend-invitation`, {
      method: 'POST',
    });
  }

  async createUser(userData: { email: string; password: string; full_name?: string; role: string }): Promise<any> {
    // Get org_id from current admin user
    const me = await this.getMe();
    return this.request('/api/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({ ...userData, org_id: me.org_id }),
    });
  }

  async toggleUserStatus(userId: string): Promise<void> {
    return this.request(`/api/v1/admin/users/${userId}/toggle-status`, {
      method: 'PUT',
    });
  }

  async deleteUser(userId: string): Promise<void> {
    return this.request(`/api/v1/admin/users/${userId}`, {
      method: 'DELETE',
    });
  }

  async getAdminCourses(): Promise<any[]> {
    return this.request('/api/v1/admin/courses');
  }

  async createCourse(courseData: { name: string; course_type: string }): Promise<any> {
    const me = await this.getMe();
    return this.request('/api/v1/admin/courses', {
      method: 'POST',
      body: JSON.stringify({ ...courseData, org_id: me.org_id }),
    });
  }

  async updateCourse(courseId: string, courseData: { name: string; course_type: string }): Promise<any> {
    return this.request(`/api/v1/admin/courses/${courseId}`, {
      method: 'PUT',
      body: JSON.stringify(courseData),
    });
  }

  async deleteCourse(courseId: string): Promise<void> {
    return this.request(`/api/v1/admin/courses/${courseId}`, {
      method: 'DELETE',
    });
  }

  async getAdminDocuments(): Promise<any[]> {
    return this.request('/api/v1/admin/documents');
  }

  async getDocumentChunks(documentId: string): Promise<any[]> {
    return this.request(`/api/v1/admin/documents/${documentId}/chunks`);
  }

  async deleteDocument(documentId: string): Promise<{ message: string; deleted_embeddings: number }> {
    return this.request(`/api/v1/admin/documents/${documentId}`, {
      method: 'DELETE',
    });
  }

  async getAdminAnalytics(): Promise<any> {
    return this.request('/api/v1/admin/analytics');
  }

  async getActivities(limit: number = 10): Promise<any[]> {
    return this.request(`/api/v1/admin/activities?limit=${limit}`);
  }

  async enrollUser(studentId: string, courseId: string): Promise<any> {
    return this.request('/api/v1/admin/enrollments', {
      method: 'POST',
      body: JSON.stringify({ student_id: studentId, course_id: courseId }),
    });
  }

  // ==================== Courses ====================

  async getEnrolledCourses(): Promise<any[]> {
    return this.request('/api/v1/courses/enrolled');
  }

  async getCourse(courseId: string): Promise<any> {
    return this.request(`/api/v1/courses/${courseId}`);
  }

  async getMyStats(): Promise<{
    questions_asked: number;
    unique_sessions: number;
    study_streak_days: number;
    active_days: number;
  }> {
    return this.request('/api/v1/courses/stats/me');
  }

  async getChatHistory(): Promise<any[]> {
    // Chat history is managed by useChatStore (client-side)
    // This method is kept for backward compatibility but returns empty
    // Use useChatStore.getState().sessions directly instead
    return [];
  }

  // ==================== TTS ====================

  /**
   * Generate natural speech from text using Gemini TTS.
   * Returns a Blob of WAV audio data.
   */
  async textToSpeech(text: string, voice: string = 'Aoede'): Promise<Blob> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}/api/v1/tutor/tts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text, voice, strip_markdown: true }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.message || error.detail || 'TTS failed');
    }

    return response.blob();
  }

  // ==================== Learning Tools ====================

  /**
   * Generate a quiz, flashcards, or study notes from course content.
   * Uses RAG to retrieve relevant content and LLM to generate structured output.
   */
  async generateLearningTool(request: GenerateToolRequest): Promise<GenerateToolResponse> {
    return this.request<GenerateToolResponse>('/api/v1/tutor/tools/generate', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }
}

export const api = new ApiClient();
