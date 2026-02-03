import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  ArrowRight,
  Search,
  Calendar,
  Clock,
  BookOpen,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useChatStore } from '@/store/chatStore';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface ChatHistoryItem {
  id: string;
  course_id: string;
  course_name: string;
  preview: string;
  timestamp: string;
  message_count: number;
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function ChatHistoryCard({ item, index }: { item: ChatHistoryItem; index: number }) {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ x: 4 }}
    >
      <Card 
        className="border-border/50 hover:border-primary/30 transition-all duration-300 cursor-pointer hover:shadow-md"
        onClick={() => navigate(`/chat/${item.course_id}`)}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="font-medium truncate">{item.preview}</p>
                <Badge variant="outline" className="flex-shrink-0 text-xs">
                  <BookOpen className="w-3 h-3 mr-1" />
                  {item.course_name}
                </Badge>
              </div>
              
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(item.timestamp)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTime(item.timestamp)}
                </span>
                {item.message_count && (
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    {item.message_count} messages
                  </span>
                )}
              </div>
            </div>
            
            {/* Arrow */}
            <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ChatHistoryContent() {
  const { sessions, clearSessions } = useChatStore();
  const [history, setHistory] = useState<ChatHistoryItem[]>([]);
  const [courseNames, setCourseNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Load course names for the sessions
  useEffect(() => {
    const loadCourseNames = async () => {
      setIsLoading(true);
      try {
        // Get enrolled courses to map course_id -> name
        const courses = await api.getEnrolledCourses();
        const nameMap: Record<string, string> = {};
        courses.forEach((course: any) => {
          nameMap[course.id] = course.name;
        });
        setCourseNames(nameMap);
      } catch (error) {
        console.error('Failed to load course names:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadCourseNames();
  }, []);

  // Convert chat store sessions to history items
  useEffect(() => {
    const historyItems: ChatHistoryItem[] = sessions
      .filter(session => session.messages.length > 0) // Only sessions with messages
      .map(session => {
        // Find first user message as preview
        const firstUserMessage = session.messages.find(m => m.type === 'user');
        return {
          id: session.id,
          course_id: session.course_id,
          course_name: courseNames[session.course_id] || 'Unknown Course',
          preview: firstUserMessage?.content || 'No messages',
          timestamp: session.updated_at?.toString() || session.created_at.toString(),
          message_count: session.messages.length,
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    setHistory(historyItems);
  }, [sessions, courseNames]);

  const filteredHistory = history.filter((item) =>
    item.preview.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.course_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by date
  const groupedHistory = filteredHistory.reduce((acc, item) => {
    const date = formatDate(item.timestamp);
    if (!acc[date]) acc[date] = [];
    acc[date].push(item);
    return acc;
  }, {} as Record<string, ChatHistoryItem[]>);

  const handleClearHistory = () => {
    clearSessions();
    toast.success('Chat history cleared', {
      description: 'All your conversation history has been removed.'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Chat History</h1>
              <p className="text-muted-foreground">
                {history.length} conversation{history.length !== 1 ? 's' : ''} saved
              </p>
            </div>
          </div>
          
          {history.length > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleClearHistory}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear History
            </Button>
          )}
        </div>
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mb-6"
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </motion.div>

      {/* Chat History List */}
      {filteredHistory.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <MessageSquare className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-medium mb-2">No conversations yet</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery ? 'No conversations match your search' : 'Start a conversation with the AI Tutor in one of your courses'}
          </p>
          <Button variant="outline" onClick={() => window.location.href = '/courses'}>
            Go to My Courses
          </Button>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedHistory).map(([date, items], groupIndex) => (
            <motion.div
              key={date}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: groupIndex * 0.1 }}
            >
              <h3 className="text-sm font-medium text-muted-foreground mb-3 px-1">{date}</h3>
              <div className="space-y-2">
                {items.map((item, index) => (
                  <ChatHistoryCard key={item.id} item={item} index={index} />
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Info Banner */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 p-4 rounded-lg bg-primary/5 border border-primary/10"
      >
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">💡 Note:</strong> Chat history is stored temporarily in your browser session. 
          Only anonymized analytics are saved to help improve the AI Tutor experience.
        </p>
      </motion.div>
    </div>
  );
}

export function ChatHistory() {
  return (
    <DashboardLayout>
      <ChatHistoryContent />
    </DashboardLayout>
  );
}
