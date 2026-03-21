import { motion } from 'framer-motion';
import { Brain, Layers, FileText, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { useCanvasStore } from '@/store/canvasStore';
import { api } from '@/lib/api';
import type { CanvasToolType, QuizData, FlashCardDeck, StudyNote } from '@/types';

interface LearningToolbarProps {
  courseId: string;
  sessionFilter?: string;
}

const tools = [
  {
    type: 'quiz' as const,
    icon: Brain,
    label: 'Quiz Me',
    color: 'hover:bg-violet-500/10 hover:text-violet-500 hover:border-violet-500/20',
    activeColor: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
    description: 'Generate a quiz',
  },
  {
    type: 'flashcards' as const,
    icon: Layers,
    label: 'Flashcards',
    color: 'hover:bg-amber-500/10 hover:text-amber-500 hover:border-amber-500/20',
    activeColor: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    description: 'Create flashcards',
  },
  {
    type: 'notes' as const,
    icon: FileText,
    label: 'Study Notes',
    color: 'hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500/20',
    activeColor: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    description: 'Summarize notes',
  },
];

export function LearningToolbar({ courseId, sessionFilter }: LearningToolbarProps) {
  const {
    isOpen,
    activeTool,
    isGenerating,
    open,
    close,
    setGenerating,
    setError,
    setQuizData,
    setFlashcardData,
    setNotesData,
  } = useCanvasStore();

  const handleToolClick = async (toolType: CanvasToolType) => {
    if (!toolType) return;

    // If clicking the same tool that's already open with content, just toggle panel
    if (isOpen && activeTool === toolType) {
      close();
      return;
    }

    // Open the panel and set the tool
    open(toolType);
    setGenerating(true);

    try {
      const response = await api.generateLearningTool({
        course_id: courseId,
        tool_type: toolType,
        session_filter: sessionFilter || undefined,
        num_items: toolType === 'quiz' ? 5 : toolType === 'flashcards' ? 8 : undefined,
      });

      switch (response.tool_type) {
        case 'quiz':
          setQuizData(response.data as QuizData);
          break;
        case 'flashcards':
          setFlashcardData(response.data as FlashCardDeck);
          break;
        case 'notes':
          setNotesData(response.data as StudyNote);
          break;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate content. Please try again.');
    }
  };

  const togglePanel = () => {
    if (isOpen) {
      close();
    } else if (activeTool) {
      open(activeTool);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-1 mb-2"
    >
      {tools.map((tool) => {
        const Icon = tool.icon;
        const isActive = isOpen && activeTool === tool.type;

        return (
          <button
            key={tool.type}
            onClick={() => handleToolClick(tool.type)}
            disabled={isGenerating}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all disabled:opacity-40 ${
              isActive
                ? tool.activeColor
                : `border-transparent text-muted-foreground ${tool.color}`
            }`}
            title={tool.description}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{tool.label}</span>
          </button>
        );
      })}

      {/* Toggle canvas panel button */}
      {(activeTool && (useCanvasStore.getState().quizData ||
        useCanvasStore.getState().flashcardData ||
        useCanvasStore.getState().notesData)) && (
        <button
          onClick={togglePanel}
          className="ml-auto p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title={isOpen ? 'Hide panel' : 'Show panel'}
        >
          {isOpen ? (
            <PanelRightClose className="w-4 h-4" />
          ) : (
            <PanelRightOpen className="w-4 h-4" />
          )}
        </button>
      )}
    </motion.div>
  );
}
