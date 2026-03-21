import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  MessageSquare,
  BookOpen,
  ArrowRight,
  Search,
  TrendingUp,
  Zap,
  Mic,
  BrainCircuit,
  Layers,
  Sparkles,
} from 'lucide-react';
import { ChatLayout } from '@/components/chat/ChatLayout';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { api } from '@/lib/api';

function DashboardContent() {
  const { user } = useAuthStore();
  const { sessions } = useChatStore();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    questionsAsked: 0,
    activeSessions: 0,
    studyStreak: 0,
  });

  const recentConversations = useMemo(() => {
    return sessions
      .filter((s) => s.messages.length > 0)
      .map((session) => {
        const firstUserMsg = session.messages.find((m) => m.type === 'user');
        // Detect mode from session course_id
        const isLearning = session.course_id === 'general-learning';
        return {
          id: session.id,
          courseId: session.course_id,
          mode: isLearning ? 'learning' as const : 'doubt-clearing' as const,
          modeName: isLearning ? 'AI Tutor' : 'Doubt Clearing',
          preview: firstUserMsg?.content || 'No messages',
          timestamp: session.updated_at?.toString() || session.created_at.toString(),
          messageCount: session.messages.length,
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 4);
  }, [sessions]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const statsData = await api.getMyStats().catch(() => ({
          questions_asked: 0,
          unique_sessions: 0,
          study_streak_days: 0,
        }));
        setStats({
          questionsAsked: statsData.questions_asked,
          activeSessions: statsData.unique_sessions,
          studyStreak: statsData.study_streak_days,
        });
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
          <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  const userName = user?.full_name?.split(' ')[0] || 'Student';
  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-orange-400 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-primary/20">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2">
            {greeting}, {userName}!
          </h1>
          <p className="text-muted-foreground">
            How would you like to study today?
          </p>
        </motion.div>

        {/* Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-3 mb-8"
        >
          {[
            { label: 'Questions', value: stats.questionsAsked.toString(), icon: MessageSquare, color: 'text-violet-500' },
            { label: 'Sessions', value: stats.activeSessions.toString(), icon: Zap, color: 'text-amber-500' },
            {
              label: 'Streak',
              value: `${stats.studyStreak}d`,
              icon: TrendingUp,
              color: 'text-emerald-500',
            },
          ].map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + idx * 0.05 }}
              className="flex items-center gap-3 p-4 rounded-xl bg-secondary/40 border border-border/30"
            >
              <stat.icon className={`w-5 h-5 ${stat.color} flex-shrink-0`} />
              <div>
                <p className="text-xl font-bold leading-tight">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground">{stat.label}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Two Mode Cards ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8"
        >
          {/* Doubt Clearing Card */}
          <motion.button
            whileHover={{ y: -4, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/doubt-clearing')}
            className="group text-left p-6 rounded-2xl bg-gradient-to-br from-blue-500/8 via-indigo-500/5 to-violet-500/8 border border-blue-500/15 hover:border-blue-500/30 transition-all duration-300 shadow-sm hover:shadow-md hover:shadow-blue-500/5"
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center flex-shrink-0 group-hover:from-blue-500/30 group-hover:to-indigo-500/30 transition-colors">
                <Search className="w-7 h-7 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold mb-1 group-hover:text-blue-500 transition-colors">
                  Doubt Clearing
                </h3>
                <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                  Ask doubts about your course material. Get accurate answers backed by your study content.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[11px] font-medium">
                    <Layers className="w-3 h-3" />
                    RAG Pipeline
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-500 text-[11px] font-medium">
                    <BrainCircuit className="w-3 h-3" />
                    Quiz & Flashcards
                  </span>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground/30 group-hover:text-blue-500 group-hover:translate-x-1 transition-all mt-1" />
            </div>
          </motion.button>

          {/* AI Tutor / Learning Card */}
          <motion.button
            whileHover={{ y: -4, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/learning')}
            className="group text-left p-6 rounded-2xl bg-gradient-to-br from-emerald-500/8 via-teal-500/5 to-green-500/8 border border-emerald-500/15 hover:border-emerald-500/30 transition-all duration-300 shadow-sm hover:shadow-md hover:shadow-emerald-500/5"
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center flex-shrink-0 group-hover:from-emerald-500/30 group-hover:to-teal-500/30 transition-colors">
                <Sparkles className="w-7 h-7 text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold mb-1 group-hover:text-emerald-500 transition-colors">
                  AI Tutor
                </h3>
                <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                  Learn any topic with your AI companion. Get real-time responses with voice interaction.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[11px] font-medium">
                    <Zap className="w-3 h-3" />
                    Real-time Fast
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-500 text-[11px] font-medium">
                    <Mic className="w-3 h-3" />
                    Voice Mode
                  </span>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground/30 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all mt-1" />
            </div>
          </motion.button>
        </motion.div>

        {/* Recent Conversations */}
        {recentConversations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-sm font-semibold text-muted-foreground mb-3 px-1">
              Recent Conversations
            </h2>
            <div className="space-y-2">
              {recentConversations.map((chat, idx) => (
                <motion.button
                  key={chat.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + idx * 0.05 }}
                  whileHover={{ x: 4 }}
                  onClick={() => navigate(`/${chat.mode === 'learning' ? 'learning' : 'doubt-clearing'}`)}
                  className="w-full text-left p-3.5 rounded-xl bg-secondary/30 border border-border/20 hover:border-border/40 hover:bg-secondary/50 transition-all group flex items-center gap-3"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    chat.mode === 'learning' 
                      ? 'bg-emerald-500/10' 
                      : 'bg-blue-500/10'
                  }`}>
                    {chat.mode === 'learning' 
                      ? <Sparkles className="w-4 h-4 text-emerald-500/60" />
                      : <Search className="w-4 h-4 text-blue-500/60" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{chat.preview}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {chat.modeName} · {chat.messageCount} messages
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export function DashboardPage() {
  return (
    <ChatLayout>
      <DashboardContent />
    </ChatLayout>
  );
}
