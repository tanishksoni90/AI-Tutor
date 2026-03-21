import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { ChatSidebar } from './ChatSidebar';
import { CanvasPanel } from '@/components/canvas/CanvasPanel';
import type { ChatMode } from '@/types';

interface ChatLayoutProps {
  children: React.ReactNode;
  mode?: ChatMode;
}

export function ChatLayout({ children, mode }: ChatLayoutProps) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
            <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
          <span className="text-sm text-muted-foreground">Loading AI Tutor...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <ChatSidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
      {/* Canvas Panel only shown in doubt-clearing mode */}
      {mode === 'doubt-clearing' && <CanvasPanel />}
    </div>
  );
}
