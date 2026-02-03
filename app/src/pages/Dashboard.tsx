import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import {
  BookOpen,
  MessageSquare,
  Clock,
  TrendingUp,
  ArrowRight,
  Sparkles,
  GraduationCap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { api } from '@/lib/api';

interface Course {
  id: string;
  name: string;
  course_type: 'micro' | 'standard' | 'certification';
  total_sessions: number;
  total_chunks: number;
  progress?: number;
  last_activity?: string;
  sessions: { session_id: string; title: string; document_count: number }[];
}

function CourseCard({ course }: { course: Course }) {
  const navigate = useNavigate();
  
  const typeColors = {
    micro: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    standard: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    certification: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  };

  const typeLabels = {
    micro: 'Micro',
    standard: 'Standard',
    certification: 'Certification',
  };

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="group"
    >
      <Card className="h-full border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between mb-2">
            <Badge 
              variant="outline" 
              className={`${typeColors[course.course_type]} capitalize`}
            >
              {typeLabels[course.course_type]}
            </Badge>
            {course.progress !== undefined && (
              <span className="text-sm text-muted-foreground">
                {course.progress}%
              </span>
            )}
          </div>
          <CardTitle className="text-lg line-clamp-2">{course.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4" />
                {course.total_sessions} sessions
              </span>
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                {course.total_chunks} topics
              </span>
            </div>
            
            {course.progress !== undefined && (
              <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
                  style={{ width: `${course.progress}%` }}
                />
              </div>
            )}
            
            <Button
              onClick={() => navigate(`/chat/${course.id}`)}
              className="w-full mt-2 group/btn"
            >
              Continue Learning
              <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  trend 
}: { 
  title: string; 
  value: string; 
  icon: React.ComponentType<{ className?: string }>; 
  trend?: string;
}) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
            {trend && (
              <p className="text-sm text-green-400 mt-1 flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                {trend}
              </p>
            )}
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon className="w-6 h-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardContent() {
  const { user } = useAuthStore();
  const { sessions } = useChatStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    questionsAsked: 0,
    activeSessions: 0,
    studyStreak: 0,
  });

  // Build recent conversations from chat store
  const recentConversations = useMemo(() => {
    return sessions
      .filter(s => s.messages.length > 0)
      .map(session => {
        const firstUserMessage = session.messages.find(m => m.type === 'user');
        const course = courses.find(c => c.id === session.course_id);
        return {
          id: session.id,
          course_id: session.course_id,
          course_name: course?.name || 'Unknown Course',
          preview: firstUserMessage?.content || 'No messages',
          timestamp: session.updated_at?.toString() || session.created_at.toString(),
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 3); // Show only 3 recent conversations
  }, [sessions, courses]);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load courses and stats in parallel
        const [coursesData, statsData] = await Promise.all([
          api.getEnrolledCourses(),
          api.getMyStats().catch(() => ({ 
            questions_asked: 0, 
            unique_sessions: 0, 
            study_streak_days: 0 
          })),
        ]);
        setCourses(coursesData);
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
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold mb-2">
          Welcome back, {user?.full_name?.split(' ')[0] || 'Student'}!
        </h1>
        <p className="text-muted-foreground">
          Continue your learning journey. You have {courses.length} active courses.
        </p>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        <StatCard
          title="Enrolled Courses"
          value={courses.length.toString()}
          icon={GraduationCap}
        />
        <StatCard
          title="Questions Asked"
          value={stats.questionsAsked.toString()}
          icon={MessageSquare}
        />
        <StatCard
          title="Chat Sessions"
          value={stats.activeSessions.toString()}
          icon={BookOpen}
        />
        <StatCard
          title="Study Streak"
          value={`${stats.studyStreak} day${stats.studyStreak !== 1 ? 's' : ''}`}
          icon={Clock}
          trend={stats.studyStreak > 1 ? "Keep it up!" : undefined}
        />
      </motion.div>

      {/* Courses Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">My Courses</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/courses">
              View All
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      </motion.div>

      {/* Recent Conversations */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Recent Conversations</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/history">
              View All
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        </div>
        
        <Card className="border-border/50">
          <CardContent className="p-0">
            {recentConversations.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No conversations yet</p>
                <p className="text-sm">Start by asking a question in one of your courses</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {recentConversations.map((chat) => (
                  <Link
                    key={chat.id}
                    to={`/chat/${chat.course_id}`}
                    className="flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors cursor-pointer block"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{chat.preview}</p>
                      <p className="text-sm text-muted-foreground">
                        {chat.course_name} • {new Date(chat.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export function Dashboard() {
  return (
    <DashboardLayout>
      <DashboardContent />
    </DashboardLayout>
  );
}
