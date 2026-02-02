import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  ArrowRight,
  Sparkles,
  Search,
  Filter,
  GraduationCap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
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

const typeColors = {
  micro: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  standard: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  certification: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

const typeLabels = {
  micro: 'Micro Course',
  standard: 'Standard Course',
  certification: 'Certification',
};

const typeDescriptions = {
  micro: 'Quick, focused learning modules',
  standard: 'Comprehensive course coverage',
  certification: 'Full certification prep',
};

function CourseCard({ course, index }: { course: Course; index: number }) {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      whileHover={{ y: -4 }}
      className="group"
    >
      <Card className="h-full border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 overflow-hidden">
        {/* Course Type Banner */}
        <div className={`h-2 w-full ${course.course_type === 'micro' ? 'bg-blue-500' : course.course_type === 'standard' ? 'bg-purple-500' : 'bg-amber-500'}`} />
        
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
                {course.progress}% complete
              </span>
            )}
          </div>
          <CardTitle className="text-lg line-clamp-2 group-hover:text-primary transition-colors">
            {course.name}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {typeDescriptions[course.course_type]}
          </p>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            {/* Course Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/50 rounded-lg p-2">
                <BookOpen className="w-4 h-4 text-primary" />
                <span>{course.total_sessions} sessions</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/50 rounded-lg p-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>{course.total_chunks} topics</span>
              </div>
            </div>
            
            {/* Progress Bar */}
            {course.progress !== undefined && (
              <div className="space-y-1">
                <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${course.progress}%` }}
                    transition={{ duration: 1, delay: index * 0.1 }}
                    className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                  />
                </div>
              </div>
            )}
            
            {/* Sessions Preview */}
            {course.sessions && course.sessions.length > 0 && (
              <div className="pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground mb-2">Recent Sessions:</p>
                <div className="space-y-1">
                  {course.sessions.slice(0, 2).map((session) => (
                    <div key={session.session_id} className="text-sm text-foreground/70 truncate">
                      • {session.title}
                    </div>
                  ))}
                </div>
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

function CoursesContent() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string | null>(null);

  useEffect(() => {
    const loadCourses = async () => {
      try {
        const coursesData = await api.getEnrolledCourses();
        setCourses(coursesData);
      } catch (error) {
        console.error('Failed to load courses:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadCourses();
  }, []);

  const filteredCourses = courses.filter((course) => {
    const matchesSearch = course.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !filterType || course.course_type === filterType;
    return matchesSearch && matchesType;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">My Courses</h1>
            <p className="text-muted-foreground">
              {courses.length} enrolled course{courses.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Search & Filter Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-4 mb-8"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={filterType === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType(null)}
            className="flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            All
          </Button>
          <Button
            variant={filterType === 'micro' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType(filterType === 'micro' ? null : 'micro')}
          >
            Micro
          </Button>
          <Button
            variant={filterType === 'standard' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType(filterType === 'standard' ? null : 'standard')}
          >
            Standard
          </Button>
          <Button
            variant={filterType === 'certification' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType(filterType === 'certification' ? null : 'certification')}
          >
            Certification
          </Button>
        </div>
      </motion.div>

      {/* Courses Grid */}
      {filteredCourses.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <GraduationCap className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-medium mb-2">No courses found</h3>
          <p className="text-muted-foreground">
            {searchQuery || filterType ? 'Try adjusting your search or filters' : 'You are not enrolled in any courses yet'}
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course, index) => (
            <CourseCard key={course.id} course={course} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Courses() {
  return (
    <DashboardLayout>
      <CoursesContent />
    </DashboardLayout>
  );
}
