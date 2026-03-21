import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  FileText,
  ChevronDown,
  Check,
  Copy,
  ThumbsUp,
  ThumbsDown,
  BookOpen,
  Sparkles,
  Loader2,
  GraduationCap,
  ArrowUp,
  Lightbulb,
  Code,
  HelpCircle,
  Zap,
  Globe,
  Shield,
  Mic,
  Search,
  BrainCircuit,
  MessageCircle,
  Compass,
  PenTool,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ChatLayout } from '@/components/chat/ChatLayout';
import { VoiceMode } from '@/components/voice/VoiceMode';
import { LearningToolbar } from '@/components/canvas/LearningToolbar';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { useVoiceStore } from '@/store/voiceStore';
import { api } from '@/lib/api';
import type { ChatMessage, ChatMode } from '@/types';

// ─── Source Components ────────────────────────────────────────────

function SourceBadge({ confidence }: { confidence?: string }) {
  const config: Record<string, { class: string; label: string; icon: typeof Shield }> = {
    validated: { class: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', label: 'Verified from course', icon: Shield },
    no_context: { class: 'bg-amber-500/10 text-amber-500 border-amber-500/20', label: 'No context found', icon: HelpCircle },
    generated: { class: 'bg-blue-500/10 text-blue-500 border-blue-500/20', label: 'AI Generated', icon: Zap },
    general_knowledge: { class: 'bg-violet-500/10 text-violet-500 border-violet-500/20', label: 'General Knowledge', icon: Globe },
  };
  const c = config[confidence as keyof typeof config] || config.generated;
  const Icon = c.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${c.class}`}>
      <Icon className="w-3 h-3" />
      {c.label}
    </span>
  );
}

function SourceCard({
  source,
  index,
}: {
  source: {
    chunk_id: string;
    relevance_score: number;
    slide_number: number | null;
    slide_title: string | null;
    session_id: string | null;
  };
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted/40 border border-border/40 hover:border-primary/20 transition-all cursor-default group"
    >
      <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-primary text-[11px] font-bold flex-shrink-0">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <FileText className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs font-medium truncate">{source.slide_title || 'Untitled'}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {source.slide_number && (
            <span className="text-[10px] text-muted-foreground">Slide {source.slide_number}</span>
          )}
          {source.slide_number && source.session_id && (
            <span className="text-[10px] text-muted-foreground">·</span>
          )}
          {source.session_id && (
            <span className="text-[10px] text-muted-foreground">{source.session_id}</span>
          )}
          <span className="text-[10px] text-primary/80 font-medium ml-auto">
            {(source.relevance_score * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const [copied, setCopied] = useState(false);
  const [showSources, setShowSources] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (message.type === 'user') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end"
      >
        <div className="max-w-[75%] lg:max-w-[60%]">
          <div className="px-4 py-3 rounded-2xl rounded-br-md bg-primary text-primary-foreground">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
          </div>
        </div>
      </motion.div>
    );
  }

  // Assistant message
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3"
    >
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-orange-400 flex items-center justify-center flex-shrink-0 shadow-sm shadow-primary/20 mt-0.5">
        <Sparkles className="w-4 h-4 text-white" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 max-w-[85%] lg:max-w-[75%]">
        <div className="markdown-content prose prose-sm dark:prose-invert max-w-none text-foreground">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ node, inline, className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || '');
                return !inline && match ? (
                  <div className="relative group/code my-3">
                    <div className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(String(children));
                        }}
                        className="p-1 rounded bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                    <SyntaxHighlighter
                      style={vscDarkPlus}
                      language={match[1]}
                      PreTag="div"
                      customStyle={{ borderRadius: '0.75rem', fontSize: '0.8rem' }}
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  </div>
                ) : (
                  <code className={`${className} px-1 py-0.5 rounded bg-muted text-[13px]`} {...props}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
          {message.isLoading && message.content && (
            <span className="inline-block w-1.5 h-4 ml-0.5 bg-primary rounded-full animate-pulse" />
          )}
        </div>

        {/* Actions */}
        {!message.isLoading && message.content && (
          <div className="mt-2 flex items-center gap-1 -ml-1">
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground/50 hover:text-foreground transition-colors"
              title={copied ? 'Copied!' : 'Copy'}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground/50 hover:text-foreground transition-colors" title="Helpful">
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
            <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground/50 hover:text-foreground transition-colors" title="Not helpful">
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>

            {/* Sources toggle */}
            {message.sources && message.sources.length > 0 && (
              <button
                onClick={() => setShowSources(!showSources)}
                className="ml-2 flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <FileText className="w-3 h-3" />
                {message.sources.length} sources
                <ChevronDown className={`w-3 h-3 transition-transform ${showSources ? 'rotate-180' : ''}`} />
              </button>
            )}

            {message.confidence && (
              <div className="ml-1">
                <SourceBadge confidence={message.confidence} />
              </div>
            )}
          </div>
        )}

        {/* Sources Panel */}
        <AnimatePresence>
          {showSources && message.sources && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 space-y-1.5 overflow-hidden"
            >
              {message.sources.map((source, idx) => (
                <SourceCard key={source.chunk_id} source={source} index={idx} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Typing Indicator ─────────────────────────────────────────────

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3"
    >
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-orange-400 flex items-center justify-center shadow-sm shadow-primary/20">
        <Sparkles className="w-4 h-4 text-white" />
      </div>
      <div className="bg-secondary/60 border border-border/30 rounded-2xl rounded-bl-md px-4 py-3">
        <div className="flex gap-1.5 items-center">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-xs text-muted-foreground/50 ml-2">Thinking...</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Welcome Screen ───────────────────────────────────────────────

const doubtClearingSuggestions = [
  {
    icon: Lightbulb,
    label: 'Explain a concept',
    prompt: 'Can you explain the key concepts covered in this course?',
    color: 'from-amber-500/10 to-orange-500/10 hover:from-amber-500/15 hover:to-orange-500/15 border-amber-500/10',
  },
  {
    icon: Code,
    label: 'Show an example',
    prompt: 'Show me a practical example with code for the main topic',
    color: 'from-blue-500/10 to-cyan-500/10 hover:from-blue-500/15 hover:to-cyan-500/15 border-blue-500/10',
  },
  {
    icon: HelpCircle,
    label: 'Quiz me',
    prompt: 'Quiz me on the important topics from this course',
    color: 'from-violet-500/10 to-purple-500/10 hover:from-violet-500/15 hover:to-purple-500/15 border-violet-500/10',
  },
  {
    icon: BookOpen,
    label: 'Summarize topics',
    prompt: 'Give me a summary of all the topics covered in this course',
    color: 'from-emerald-500/10 to-green-500/10 hover:from-emerald-500/15 hover:to-green-500/15 border-emerald-500/10',
  },
];

const learningSuggestions = [
  {
    icon: Compass,
    label: 'Explore a topic',
    prompt: 'Explain machine learning in simple terms with real-world examples',
    color: 'from-emerald-500/10 to-teal-500/10 hover:from-emerald-500/15 hover:to-teal-500/15 border-emerald-500/10',
  },
  {
    icon: BrainCircuit,
    label: 'Deep dive',
    prompt: 'Help me understand how neural networks learn step by step',
    color: 'from-violet-500/10 to-purple-500/10 hover:from-violet-500/15 hover:to-purple-500/15 border-violet-500/10',
  },
  {
    icon: PenTool,
    label: 'Practice problem',
    prompt: 'Give me a practice problem on data structures and guide me through it',
    color: 'from-amber-500/10 to-orange-500/10 hover:from-amber-500/15 hover:to-orange-500/15 border-amber-500/10',
  },
  {
    icon: MessageCircle,
    label: 'Discuss & learn',
    prompt: 'Let\'s have a discussion about the differences between SQL and NoSQL databases',
    color: 'from-blue-500/10 to-cyan-500/10 hover:from-blue-500/15 hover:to-cyan-500/15 border-blue-500/10',
  },
];

function WelcomeScreen({
  mode,
  userName,
  onSuggestionClick,
}: {
  mode: ChatMode;
  userName: string;
  onSuggestionClick: (prompt: string) => void;
}) {
  const isDoubtClearing = mode === 'doubt-clearing';
  const suggestions = isDoubtClearing ? doubtClearingSuggestions : learningSuggestions;

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full text-center">
        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg ${
            isDoubtClearing 
              ? 'bg-gradient-to-br from-blue-500 to-indigo-500 shadow-blue-500/25'
              : 'bg-gradient-to-br from-emerald-500 to-teal-500 shadow-emerald-500/25'
          }`}>
            {isDoubtClearing 
              ? <Search className="w-7 h-7 text-white" />
              : <Sparkles className="w-7 h-7 text-white" />
            }
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">
            {isDoubtClearing ? `Clear your doubts, ${userName}! 📚` : `Hi ${userName}! Let's learn 🚀`}
          </h1>
          <p className="text-muted-foreground text-base mb-1">
            {isDoubtClearing 
              ? 'Ask anything about your course material. I\'ll answer with source references.'
              : 'I\'m your AI learning companion. Ask me anything!'
            }
          </p>
          {isDoubtClearing && (
            <p className="text-muted-foreground/60 text-sm mb-10">
              Powered by your course content with verified sources
            </p>
          )}
          {!isDoubtClearing && (
            <p className="text-muted-foreground/60 text-sm mb-10">
              Real-time responses · Voice interaction available
            </p>
          )}
        </motion.div>

        {/* Suggestion Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          {suggestions.map((suggestion, idx) => (
            <motion.button
              key={idx}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + idx * 0.08 }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSuggestionClick(suggestion.prompt)}
              className={`group text-left p-4 rounded-xl bg-gradient-to-br ${suggestion.color} border transition-all duration-300`}
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-background/60 flex items-center justify-center flex-shrink-0 group-hover:bg-background/80 transition-colors">
                  <suggestion.icon className="w-4 h-4 text-foreground/70" />
                </div>
                <div>
                  <p className="text-sm font-medium mb-0.5">{suggestion.label}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{suggestion.prompt}</p>
                </div>
              </div>
            </motion.button>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

// ─── Main Chat Component ──────────────────────────────────────────

const defaultCourse = {
  id: 'course-1',
  name: 'Loading...',
  course_type: 'standard' as const,
  sessions: [] as { session_id: string; title: string; document_count: number }[],
};

function ChatContent({ mode }: { mode: ChatMode }) {
  const isDoubtClearing = mode === 'doubt-clearing';
  const isLearning = mode === 'learning';
  
  const [inputValue, setInputValue] = useState('');
  const [sessionFilter, setSessionFilter] = useState<string>('');
  const [responseMode, setResponseMode] = useState<'strict' | 'enhanced'>('enhanced');
  const [course, setCourse] = useState(defaultCourse);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [courseLoading, setCourseLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useAuthStore();
  const { isOpen: isVoiceOpen, open: openVoice } = useVoiceStore();

  const {
    sessions,
    currentSession,
    isLoading,
    sendMessage,
    createSession,
    setCurrentSession,
  } = useChatStore();

  // Auto-detect enrolled course
  useEffect(() => {
    setCourseLoading(true);
    if (isDoubtClearing) {
      // Doubt clearing needs the enrolled course for RAG
      api.getEnrolledCourses()
        .then((courses) => {
          if (courses.length > 0) {
            const primary = courses[0];
            setCourseId(primary.id);
            setCourse(primary);
          }
        })
        .catch(console.error)
        .finally(() => setCourseLoading(false));
    } else {
      // Learning mode uses a virtual course ID
      setCourseId('general-learning');
      setCourse({
        id: 'general-learning',
        name: 'AI Tutor',
        course_type: 'standard' as const,
        sessions: [],
      });
      setCourseLoading(false);
    }
  }, [mode]);

  // Get or create session
  useEffect(() => {
    if (courseId) {
      const existing = sessions.find((s) => s.course_id === courseId);
      if (existing) {
        setCurrentSession(existing);
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
    const text = inputValue;
    setInputValue('');
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
    await sendMessage(
      courseId,
      text,
      isDoubtClearing ? sessionFilter || undefined : undefined,
      responseMode,
      false, // voiceMode
      mode   // chatMode
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (prompt: string) => {
    setInputValue(prompt);
    inputRef.current?.focus();
  };

  const messages = currentSession?.messages || [];
  const userName = user?.full_name?.split(' ')[0] || 'Student';

  return (
    <div className="flex flex-col h-full">
      {/* ── Minimal Header ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-background/80 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          {/* Mode indicator */}
          <div className={`w-6 h-6 rounded-md flex items-center justify-center ${
            isDoubtClearing ? 'bg-blue-500/15' : 'bg-emerald-500/15'
          }`}>
            {isDoubtClearing 
              ? <Search className="w-3.5 h-3.5 text-blue-500" />
              : <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            }
          </div>
          <h1 className="text-sm font-semibold truncate">
            {isDoubtClearing 
              ? (courseLoading ? 'Loading...' : course.name)
              : 'AI Tutor'
            }
          </h1>
          <Badge variant="outline" className={`text-[10px] h-5 hidden sm:flex ${
            isDoubtClearing ? 'border-blue-500/20 text-blue-500' : 'border-emerald-500/20 text-emerald-500'
          }`}>
            {isDoubtClearing ? 'Doubt Clearing' : 'Learning'}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* Response Mode Pills — only in doubt clearing mode */}
          {isDoubtClearing && (
            <div className="hidden sm:flex items-center gap-0.5 p-0.5 rounded-lg bg-secondary/60 border border-border/30">
              <button
                onClick={() => setResponseMode('strict')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  responseMode === 'strict'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Strict
              </button>
              <button
                onClick={() => setResponseMode('enhanced')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  responseMode === 'enhanced'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Enhanced
              </button>
            </div>
          )}

          {/* Session Filter — only in doubt clearing mode */}
          {isDoubtClearing && course.sessions && course.sessions.length > 0 && (
            <select
              value={sessionFilter}
              onChange={(e) => setSessionFilter(e.target.value)}
              className="px-2 py-1.5 rounded-lg bg-secondary/60 border border-border/30 text-[11px] outline-none focus:border-primary/30 max-w-[180px]"
            >
              <option value="">All Sessions</option>
              {course.sessions.map((session) => (
                <option key={session.session_id} value={session.session_id}>
                  {session.session_id}: {session.title}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* ── Messages or Welcome ── */}
      {messages.length === 0 && !isLoading ? (
        <WelcomeScreen
          mode={mode}
          userName={userName}
          onSuggestionClick={handleSuggestionClick}
        />
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            <AnimatePresence>
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
            </AnimatePresence>
            {isLoading && !messages[messages.length - 1]?.content && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* ── Input Area ── */}
      <div className="flex-shrink-0 border-t border-border/30 bg-background/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-3">
          {/* Learning Tools Toolbar — only in doubt clearing mode */}
          {isDoubtClearing && courseId && (
            <LearningToolbar
              courseId={courseId}
              sessionFilter={sessionFilter || undefined}
            />
          )}
          <div className="relative flex items-end gap-2 rounded-2xl border border-border/50 bg-secondary/30 focus-within:border-primary/30 focus-within:bg-secondary/50 transition-all shadow-sm">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isDoubtClearing 
                ? 'Ask anything about your course...'
                : 'Ask me anything — let\'s learn together...'
              }
              rows={1}
              className="flex-1 bg-transparent px-4 py-3 text-sm outline-none resize-none min-h-[44px] max-h-[200px] placeholder:text-muted-foreground/50"
              style={{ height: 'auto' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
              }}
            />
            <div className="flex items-center gap-1 pr-2 pb-2">
              {/* Voice mode button — only in learning mode */}
              {isLearning && (
                <button
                  onClick={openVoice}
                  className="w-8 h-8 rounded-lg hover:bg-secondary text-muted-foreground hover:text-emerald-500 flex items-center justify-center transition-all"
                  title="Voice mode"
                >
                  <Mic className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading}
                className={`w-8 h-8 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all shadow-sm ${
                  isDoubtClearing 
                    ? 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20'
                    : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'
                }`}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : (
                  <ArrowUp className="w-4 h-4 text-white" />
                )}
              </button>
            </div>
          </div>
          <p className="text-center text-[10px] text-muted-foreground/40 mt-2">
            {isDoubtClearing
              ? 'AI Tutor can make mistakes. Verify answers with your course material.'
              : 'AI Tutor provides general learning assistance. Verify important facts.'
            }
          </p>
        </div>
      </div>

      {/* ── Voice Mode Overlay — only in learning mode ── */}
      {isLearning && isVoiceOpen && courseId && (
        <VoiceMode
          courseId={courseId}
          courseName="AI Tutor"
          sessionFilter={undefined}
          responseMode="enhanced"
          chatMode="learning"
        />
      )}
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────

export function ChatPage({ mode }: { mode: ChatMode }) {
  return (
    <ChatLayout mode={mode}>
      <ChatContent mode={mode} />
    </ChatLayout>
  );
}
