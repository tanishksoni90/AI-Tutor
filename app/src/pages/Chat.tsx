import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Send,
  Bot,
  User,
  FileText,
  ChevronDown,
  Check,
  Copy,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  BookOpen,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useChatStore } from '@/store/chatStore';
import { api } from '@/lib/api';
import type { ChatMessage } from '@/types';

// Default course data (used as fallback)
const defaultCourse = {
  id: 'course-1',
  name: 'Loading...',
  course_type: 'standard' as const,
  sessions: [] as { session_id: string; title: string; document_count: number }[],
};

const suggestedQuestions = [
  'What is the main concept covered in this course?',
  'Can you explain the key topics?',
  'How does this relate to practical applications?',
  'What are the prerequisites for this topic?',
];

function SourceBadge({ confidence }: { confidence?: string }) {
  const colors = {
    validated: 'bg-green-500/20 text-green-400 border-green-500/30',
    no_context: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    generated: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };

  const labels = {
    validated: 'Source Verified',
    no_context: 'No Context Found',
    generated: 'AI Generated',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colors[confidence as keyof typeof colors] || colors.generated}`}>
      <Check className="w-3 h-3" />
      {labels[confidence as keyof typeof labels] || 'Generated'}
    </span>
  );
}

function SourceCard({ source, index }: { source: { chunk_id: string; relevance_score: number; slide_number: number | null; slide_title: string | null; session_id: string | null }; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border/50 hover:border-primary/30 transition-colors cursor-pointer group"
    >
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-sm font-medium truncate">{source.slide_title || 'Untitled'}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {source.slide_number && (
            <>
              <span className="text-xs text-muted-foreground">Slide {source.slide_number}</span>
              <span className="text-xs text-muted-foreground">•</span>
            </>
          )}
          {source.session_id && (
            <span className="text-xs text-muted-foreground">{source.session_id}</span>
          )}
          <span className="text-xs text-primary">{(source.relevance_score * 100).toFixed(0)}% match</span>
        </div>
      </div>
    </motion.div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const [copied, setCopied] = useState(false);
  const [showSources, setShowSources] = useState(true);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-4 ${message.type === 'user' ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${
        message.type === 'user' 
          ? 'bg-primary' 
          : 'bg-gradient-to-br from-primary to-accent'
      }`}>
        {message.type === 'user' ? (
          <User className="w-4 h-4 text-primary-foreground" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Message Content */}
      <div className={`flex-1 max-w-[85%] ${message.type === 'user' ? 'text-right' : ''}`}>
        <div className={`inline-block text-left px-4 py-3 rounded-2xl ${
          message.type === 'user'
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary border border-border/50'
        }`}>
          {message.type === 'assistant' ? (
            <div className="markdown-content prose prose-invert prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <SyntaxHighlighter
                        style={vscDarkPlus}
                        language={match[1]}
                        PreTag="div"
                        {...props}
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm">{message.content}</p>
          )}
        </div>

        {/* Actions for AI messages */}
        {message.type === 'assistant' && !message.isLoading && (
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title="Copy response"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title="Regenerate response"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title="Helpful"
            >
              <ThumbsUp className="w-4 h-4" />
            </button>
            <button
              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title="Not helpful"
            >
              <ThumbsDown className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Sources */}
        {message.type === 'assistant' && message.sources && message.sources.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setShowSources(!showSources)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              <FileText className="w-4 h-4" />
              {message.sources.length} sources
              <ChevronDown className={`w-4 h-4 transition-transform ${showSources ? 'rotate-180' : ''}`} />
            </button>
            
            <AnimatePresence>
              {showSources && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  {message.sources.map((source, idx) => (
                    <SourceCard key={source.chunk_id} source={source} index={idx} />
                  ))}
                  <div className="flex items-center gap-2 mt-2">
                    <SourceBadge confidence={message.confidence} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex gap-4"
    >
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
        <Bot className="w-4 h-4 text-white" />
      </div>
      <div className="bg-secondary border border-border/50 rounded-2xl px-4 py-3">
        <div className="flex gap-1">
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </motion.div>
  );
}

function ChatContent() {
  const { courseId } = useParams<{ courseId: string }>();
  const [inputValue, setInputValue] = useState('');
  const [sessionFilter, setSessionFilter] = useState<string>('');
  const [responseMode, setResponseMode] = useState<'strict' | 'enhanced'>('enhanced');
  const [course, setCourse] = useState(defaultCourse);
  const [courseLoading, setCourseLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const { 
    sessions, 
    currentSession, 
    isLoading, 
    sendMessage, 
    createSession, 
    setCurrentSession 
  } = useChatStore();

  // Fetch course data
  useEffect(() => {
    if (courseId) {
      setCourseLoading(true);
      api.getCourse(courseId)
        .then((data) => {
          setCourse(data);
        })
        .catch((err) => {
          console.error('Failed to load course:', err);
        })
        .finally(() => {
          setCourseLoading(false);
        });
    }
  }, [courseId]);

  // Get or create session for this course
  // Re-run when sessions changes to keep currentSession in sync
  useEffect(() => {
    if (courseId) {
      const existingSession = sessions.find((s) => s.course_id === courseId);
      if (existingSession) {
        setCurrentSession(existingSession);
      } else {
        createSession(courseId);
      }
    }
  }, [courseId, sessions]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentSession?.messages, isLoading]);

  const handleSend = async () => {
    if (!inputValue.trim() || !courseId) return;
    
    await sendMessage(courseId, inputValue, sessionFilter || undefined, responseMode);
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    setInputValue(question);
    inputRef.current?.focus();
  };

  const messages = currentSession?.messages || [];

  return (
    <div className="flex h-screen">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-card/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold">{courseLoading ? 'Loading...' : course.name}</h1>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {course.course_type}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {course.sessions?.length || 0} sessions
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Session Filter */}
            <select
              value={sessionFilter}
              onChange={(e) => setSessionFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-secondary border border-border/50 text-sm focus:border-primary/50 outline-none"
            >
              <option value="">All Sessions</option>
              {(course.sessions || []).map((session) => (
                <option key={session.session_id} value={session.session_id}>
                  {session.session_id}: {session.title}
                </option>
              ))}
            </select>
            
            {/* Response Mode Toggle */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary border border-border/50">
              <span className="text-xs text-muted-foreground">Mode:</span>
              <button
                onClick={() => setResponseMode('strict')}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  responseMode === 'strict'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Answers only from course material - no elaboration"
              >
                Strict
              </button>
              <button
                onClick={() => setResponseMode('enhanced')}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  responseMode === 'enhanced'
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="AI can elaborate and explain in more detail"
              >
                Enhanced
              </button>
            </div>
            
            <Button variant="outline" size="sm">
              <Sparkles className="w-4 h-4 mr-2" />
              New Chat
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Start a conversation</h3>
              <p className="text-muted-foreground text-sm max-w-sm mb-6">
                Ask any question about {course.name} and get instant, accurate answers.
              </p>
              
              {/* Suggested Questions */}
              <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                {suggestedQuestions.map((question, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestedQuestion(question)}
                    className="px-4 py-2 text-sm rounded-full bg-secondary border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-colors"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence>
            {messages.map((message) => (
              <MessageBubble 
                key={message.id} 
                message={message}
              />
            ))}
          </AnimatePresence>

          {isLoading && <TypingIndicator />}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-border/50 p-4 bg-card/50">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-3 items-end">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything about this course..."
                  rows={1}
                  className="w-full px-4 py-3 rounded-xl bg-background border border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none min-h-[48px] max-h-[120px]"
                  style={{ height: 'auto' }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                  }}
                />
                <div className="absolute right-3 bottom-3 text-xs text-muted-foreground">
                  {inputValue.length}/2000
                </div>
              </div>
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading}
                className="px-4 py-3 h-12 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground mt-2">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Chat() {
  return (
    <DashboardLayout>
      <ChatContent />
    </DashboardLayout>
  );
}
