import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  ArrowRight,
  Sparkles,
  GraduationCap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ChatLayout } from '@/components/chat/ChatLayout';
import { api } from '@/lib/api';

interface Course {
  id: string;
  name: string;
  course_type: 'micro' | 'standard' | 'certification';
  total_sessions: number;
  total_chunks: number;
  progress?: number;
  sessions: { session_id: string; title: string; document_count: number }[];
}

const typeColors: Record<string, string> = {
  micro: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  standard: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
  certification: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
};

function CoursesContent() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .getEnrolledCourses()
      .then(setCourses)
      .catch(console.error)
      .finally(() => setIsLoading(false));
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

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">My Courses</h1>
              <p className="text-sm text-muted-foreground">{courses.length} enrolled course{courses.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </motion.div>

        {courses.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground">No courses enrolled yet</p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {courses.map((course, idx) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08 }}
                whileHover={{ y: -2 }}
              >
                <button
                  onClick={() => navigate(`/chat/${course.id}`)}
                  className="w-full text-left p-5 rounded-2xl border border-border/30 bg-secondary/20 hover:bg-secondary/40 hover:border-border/50 transition-all group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className={`text-[10px] ${typeColors[course.course_type] || ''}`}>
                          {course.course_type}
                        </Badge>
                      </div>
                      <h3 className="text-base font-semibold mb-1.5 truncate">{course.name}</h3>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5" />
                          {course.total_sessions} sessions
                        </span>
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5" />
                          {course.total_chunks} topics
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium group-hover:bg-primary group-hover:text-primary-foreground transition-all flex items-center gap-1.5">
                        Start Chat
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function CoursesPage() {
  return (
    <ChatLayout>
      <CoursesContent />
    </ChatLayout>
  );
}
