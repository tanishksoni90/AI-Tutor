import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Plus,
  MessageSquare,
  Search as SearchIcon,
  GraduationCap,
  Home,
  BookOpen,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Trash2,
  Sparkles,
  X,
  Search,
  Mic,
  BrainCircuit,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { api } from '@/lib/api';

interface ChatHistoryEntry {
  id: string;
  courseId: string;
  mode: 'doubt-clearing' | 'learning';
  modeName: string;
  preview: string;
  timestamp: Date;
  messageCount: number;
}

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'Previous 7 Days';
  if (diffDays < 30) return 'Previous 30 Days';
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function ChatItem({
  entry,
  isActive,
  onDelete,
}: {
  entry: ChatHistoryEntry;
  isActive: boolean;
  onDelete: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const route = entry.mode === 'learning' ? '/learning' : '/doubt-clearing';

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="group relative"
    >
      <button
        onClick={() => navigate(route)}
        className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all duration-200 flex items-center gap-2.5 ${
          isActive
            ? 'bg-secondary text-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
        }`}
      >
        {entry.mode === 'learning' 
          ? <Sparkles className="w-4 h-4 flex-shrink-0 opacity-60 text-emerald-500" />
          : <Search className="w-4 h-4 flex-shrink-0 opacity-60 text-blue-500" />
        }
        <span className="truncate flex-1">{entry.preview}</span>
      </button>

      {/* Hover actions */}
      <div
        className={`absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 transition-opacity ${
          showMenu ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="p-1 rounded-md hover:bg-muted transition-colors"
        >
          <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[140px]"
            onMouseLeave={() => setShowMenu(false)}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(entry.id);
                setShowMenu(false);
              }}
              className="w-full text-left px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function ChatSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const { user, logout } = useAuthStore();
  const { sessions, clearSessionMessages } = useChatStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Determine current mode from URL
  const currentMode = location.pathname.includes('/learning') ? 'learning' 
    : location.pathname.includes('/doubt-clearing') ? 'doubt-clearing' 
    : null;

  // Build chat history from sessions
  const chatHistory = useMemo<ChatHistoryEntry[]>(() => {
    return sessions
      .filter((s) => s.messages.length > 0)
      .map((session) => {
        const firstUserMsg = session.messages.find((m) => m.type === 'user');
        const isLearning = session.course_id === 'general-learning';
        return {
          id: session.id,
          courseId: session.course_id,
          mode: isLearning ? 'learning' as const : 'doubt-clearing' as const,
          modeName: isLearning ? 'AI Tutor' : 'Doubt Clearing',
          preview: firstUserMsg?.content || 'New conversation',
          timestamp: new Date(session.updated_at || session.created_at),
          messageCount: session.messages.length,
        };
      })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [sessions]);

  // Filter by search
  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return chatHistory;
    const q = searchQuery.toLowerCase();
    return chatHistory.filter(
      (entry) =>
        entry.preview.toLowerCase().includes(q) ||
        entry.modeName.toLowerCase().includes(q)
    );
  }, [chatHistory, searchQuery]);

  // Group by date
  const groupedHistory = useMemo(() => {
    const groups: Record<string, ChatHistoryEntry[]> = {};
    filteredHistory.forEach((entry) => {
      const label = formatRelativeDate(entry.timestamp);
      if (!groups[label]) groups[label] = [];
      groups[label].push(entry);
    });
    return groups;
  }, [filteredHistory]);

  const handleNewChat = () => {
    if (currentMode === 'learning') {
      clearSessionMessages('general-learning');
      navigate('/learning');
    } else if (currentMode === 'doubt-clearing') {
      // We need the enrolled course ID for doubt clearing
      api.getEnrolledCourses()
        .then((courses) => {
          if (courses.length > 0) {
            clearSessionMessages(courses[0].id);
          }
        })
        .catch(console.error);
      navigate('/doubt-clearing');
    } else {
      // From dashboard, default to doubt-clearing
      navigate('/doubt-clearing');
    }
  };

  const handleDeleteChat = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      clearSessionMessages(session.course_id);
    }
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 68 : 280 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="relative h-screen bg-sidebar flex flex-col border-r border-sidebar-border overflow-hidden flex-shrink-0"
    >
      {/* Top Section: Logo + New Chat */}
      <div className="flex-shrink-0 p-3 space-y-2">
        {/* Logo & Collapse */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-orange-400 flex items-center justify-center flex-shrink-0 shadow-md shadow-primary/20">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-lg font-bold gradient-text truncate"
              >
                AI Tutor
              </motion.span>
            )}
          </div>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors flex-shrink-0"
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* New Chat Button */}
        <Button
          onClick={handleNewChat}
          variant="outline"
          className={`w-full border-border/60 hover:bg-secondary/80 gap-2 transition-all ${
            isCollapsed ? 'px-0 justify-center' : 'justify-start'
          }`}
          size={isCollapsed ? 'icon' : 'default'}
        >
          <Plus className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span className="text-sm">New Chat</span>}
        </Button>
      </div>

      {/* Search (when not collapsed) */}
      {!isCollapsed && (
        <div className="px-3 pb-2 flex-shrink-0">
          <AnimatePresence>
            {isSearching ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="relative"
              >
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search chats..."
                  className="w-full pl-8 pr-8 py-1.5 text-sm bg-secondary/50 border border-border/50 rounded-lg outline-none focus:border-primary/40 transition-colors"
                />
                <button
                  onClick={() => {
                    setIsSearching(false);
                    setSearchQuery('');
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted"
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </motion.div>
            ) : (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => setIsSearching(true)}
                className="flex items-center gap-2 w-full px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/50 transition-colors"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search</span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-2">
        {isCollapsed ? (
          // Collapsed: just show chat icons
          <div className="space-y-1 pt-1">
            {chatHistory.slice(0, 8).map((entry) => (
              <button
                key={entry.id}
                onClick={() => navigate(entry.mode === 'learning' ? '/learning' : '/doubt-clearing')}
                className={`w-full p-2 rounded-lg flex items-center justify-center transition-colors ${
                  currentMode === entry.mode
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                }`}
                title={entry.preview}
              >
                {entry.mode === 'learning' 
                  ? <Sparkles className="w-4 h-4 text-emerald-500" />
                  : <Search className="w-4 h-4 text-blue-500" />
                }
              </button>
            ))}
          </div>
        ) : (
          // Expanded: grouped chat list
          <div className="space-y-4">
            {Object.keys(groupedHistory).length === 0 ? (
              <div className="text-center py-8 px-4">
                <div className="w-10 h-10 rounded-xl bg-secondary/60 flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="w-5 h-5 text-muted-foreground/50" />
                </div>
                <p className="text-xs text-muted-foreground/60">
                  {searchQuery ? 'No matching chats' : 'No conversations yet'}
                </p>
                {!searchQuery && (
                  <p className="text-xs text-muted-foreground/40 mt-1">
                    Start by asking a question
                  </p>
                )}
              </div>
            ) : (
              Object.entries(groupedHistory).map(([label, entries]) => (
                <div key={label}>
                  <p className="px-3 py-1 text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wider">
                    {label}
                  </p>
                  <div className="space-y-0.5">
                    {entries.map((entry) => (
                      <ChatItem
                        key={entry.id}
                        entry={entry}
                        isActive={currentMode === entry.mode}
                        onDelete={handleDeleteChat}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="flex-shrink-0 border-t border-sidebar-border p-2 space-y-1">
        {/* Nav Links */}
        {[
          { label: 'Dashboard', href: '/dashboard', icon: Home },
          { label: 'Doubt Clearing', href: '/doubt-clearing', icon: Search },
          { label: 'AI Tutor', href: '/learning', icon: Sparkles },
          { label: 'Settings', href: '/settings', icon: Settings },
        ].map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                isCollapsed ? 'justify-center' : ''
              } ${
                isActive
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`
            }
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {!isCollapsed && <span>{item.label}</span>}
          </NavLink>
        ))}

        {/* User Section */}
        <div className="pt-1 mt-1 border-t border-sidebar-border/50">
          <div className={`flex items-center gap-2.5 px-3 py-2 ${isCollapsed ? 'justify-center' : ''}`}>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/80 to-orange-400/80 flex items-center justify-center flex-shrink-0 text-white text-xs font-semibold">
              {user?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate leading-tight">
                  {user?.full_name || user?.email}
                </p>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors flex-shrink-0"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.aside>
  );
}
