import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Brain,
  Layers,
  FileText,
  Loader2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { useCanvasStore } from '@/store/canvasStore';
import { QuizPanel } from './QuizPanel';
import { FlashcardsPanel } from './FlashcardsPanel';
import { NotesPanel } from './NotesPanel';
import type { CanvasToolType } from '@/types';

const toolConfig: Record<
  string,
  {
    icon: typeof Brain;
    label: string;
    color: string;
    bg: string;
    border: string;
  }
> = {
  quiz: {
    icon: Brain,
    label: 'Quiz',
    color: 'text-violet-500',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
  },
  flashcards: {
    icon: Layers,
    label: 'Flashcards',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  notes: {
    icon: FileText,
    label: 'Study Notes',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
};

export function CanvasPanel() {
  const {
    isOpen,
    activeTool,
    isGenerating,
    error,
    quizData,
    flashcardData,
    notesData,
    close,
    setActiveTool,
  } = useCanvasStore();

  if (!isOpen) return null;

  const currentConfig = activeTool ? toolConfig[activeTool] : null;
  const hasContent =
    (activeTool === 'quiz' && quizData) ||
    (activeTool === 'flashcards' && flashcardData) ||
    (activeTool === 'notes' && notesData);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: 420, opacity: 1 }}
        exit={{ width: 0, opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="h-full border-l border-border/40 bg-background flex flex-col overflow-hidden flex-shrink-0"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-background/80 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-lg ${
                currentConfig?.bg || 'bg-primary/10'
              } flex items-center justify-center`}
            >
              {currentConfig ? (
                <currentConfig.icon
                  className={`w-4 h-4 ${currentConfig.color}`}
                />
              ) : (
                <Sparkles className="w-4 h-4 text-primary" />
              )}
            </div>
            <span className="text-sm font-semibold">
              {currentConfig?.label || 'Learning Tools'}
            </span>
          </div>
          <button
            onClick={close}
            className="w-7 h-7 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tool tabs */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-border/30 bg-secondary/20 flex-shrink-0">
          {(Object.entries(toolConfig) as [string, (typeof toolConfig)[string]][]).map(
            ([key, config]) => {
              const isActive = activeTool === key;
              const Icon = config.icon;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTool(key as CanvasToolType)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                    isActive
                      ? `${config.bg} ${config.color} shadow-sm`
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {config.label}
                </button>
              );
            }
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {/* Loading state */}
          {isGenerating && (
            <div className="flex flex-col items-center justify-center h-full gap-4 px-8">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
                <motion.div
                  className="absolute inset-0 rounded-2xl border-2 border-primary/30"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">
                  Generating {currentConfig?.label || 'content'}...
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Analyzing your course material with AI
                </p>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && !isGenerating && (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-8">
              <AlertCircle className="w-10 h-10 text-red-500/60" />
              <div className="text-center">
                <p className="text-sm font-medium text-red-500">
                  Generation Failed
                </p>
                <p className="text-xs text-muted-foreground mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Content panels */}
          {!isGenerating && !error && hasContent && (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTool}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {activeTool === 'quiz' && <QuizPanel />}
                {activeTool === 'flashcards' && <FlashcardsPanel />}
                {activeTool === 'notes' && <NotesPanel />}
              </motion.div>
            </AnimatePresence>
          )}

          {/* Empty state */}
          {!isGenerating && !error && !hasContent && (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-8 text-center">
              <div
                className={`w-14 h-14 rounded-2xl ${
                  currentConfig?.bg || 'bg-primary/10'
                } flex items-center justify-center`}
              >
                {currentConfig ? (
                  <currentConfig.icon
                    className={`w-7 h-7 ${currentConfig.color}`}
                  />
                ) : (
                  <Sparkles className="w-7 h-7 text-primary" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium">
                  {currentConfig
                    ? `Generate ${currentConfig.label}`
                    : 'Choose a Learning Tool'}
                </p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[250px]">
                  {activeTool === 'quiz'
                    ? 'Use the toolbar below the chat to generate a quiz from your course material'
                    : activeTool === 'flashcards'
                    ? 'Generate flashcards to help memorize key concepts from your course'
                    : activeTool === 'notes'
                    ? 'Create structured study notes with key points and definitions'
                    : 'Select a tool above or use the chat toolbar to get started'}
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
