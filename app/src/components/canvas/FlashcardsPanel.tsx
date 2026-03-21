import { motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Layers,
} from 'lucide-react';
import { useCanvasStore } from '@/store/canvasStore';

export function FlashcardsPanel() {
  const {
    flashcardData,
    currentCardIndex,
    flippedCards,
    nextCard,
    prevCard,
    toggleFlip,
    resetFlashcards,
  } = useCanvasStore();

  if (!flashcardData) return null;

  const { cards } = flashcardData;
  const currentCard = cards[currentCardIndex];
  const isFlipped = flippedCards.has(currentCard.id);
  const progress = ((currentCardIndex + 1) / cards.length) * 100;

  return (
    <div className="p-4 space-y-4">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">{flashcardData.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {flashcardData.topic}
          </p>
        </div>
        <button
          onClick={resetFlashcards}
          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          title="Reset cards"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>
            Card {currentCardIndex + 1} of {cards.length}
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1 bg-secondary rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Card */}
      <div
        className="relative cursor-pointer"
        style={{ perspective: '1000px' }}
        onClick={() => toggleFlip(currentCard.id)}
      >
        <motion.div
          className="relative w-full min-h-[220px]"
          style={{ transformStyle: 'preserve-3d' }}
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 rounded-2xl border-2 border-border/50 bg-gradient-to-br from-primary/5 via-background to-primary/5 p-6 flex flex-col items-center justify-center text-center shadow-sm"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Layers className="w-5 h-5 text-primary" />
            </div>
            <p className="text-sm font-medium leading-relaxed">
              {currentCard.front}
            </p>
            {currentCard.category && (
              <span className="mt-3 text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                {currentCard.category}
              </span>
            )}
            <p className="mt-4 text-[10px] text-muted-foreground/50">
              Tap to reveal answer
            </p>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-background to-primary/10 p-6 flex flex-col items-center justify-center text-center shadow-sm"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <p className="text-sm leading-relaxed text-foreground/90">
              {currentCard.back}
            </p>
            <p className="mt-4 text-[10px] text-muted-foreground/50">
              Tap to flip back
            </p>
          </div>
        </motion.div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={prevCard}
          disabled={currentCardIndex === 0}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-30 hover:bg-secondary transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>

        {/* Dots */}
        <div className="flex items-center gap-1">
          {cards.map((card, idx) => (
            <div
              key={card.id}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                idx === currentCardIndex
                  ? 'bg-primary scale-125'
                  : flippedCards.has(card.id)
                  ? 'bg-primary/40'
                  : 'bg-muted-foreground/20'
              }`}
            />
          ))}
        </div>

        <button
          onClick={nextCard}
          disabled={currentCardIndex === cards.length - 1}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-30 hover:bg-secondary transition-colors"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Keyboard hint */}
      <p className="text-center text-[10px] text-muted-foreground/40">
        Use ← → to navigate · Click card to flip
      </p>
    </div>
  );
}
