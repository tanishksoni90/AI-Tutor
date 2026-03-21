import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Trophy,
  Target,
  Lightbulb,
} from 'lucide-react';
import { useCanvasStore } from '@/store/canvasStore';
import type { QuizQuestion } from '@/types';

function QuestionCard({
  question,
  index,
  total,
  selectedAnswer,
  submitted,
  onAnswer,
}: {
  question: QuizQuestion;
  index: number;
  total: number;
  selectedAnswer?: number;
  submitted: boolean;
  onAnswer: (idx: number) => void;
}) {
  const [showExplanation, setShowExplanation] = useState(false);
  const isCorrect = selectedAnswer === question.correct_index;

  const difficultyColors = {
    easy: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    medium: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    hard: 'bg-red-500/10 text-red-500 border-red-500/20',
  };

  return (
    <motion.div
      key={question.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      {/* Question header */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">
          Question {index + 1} of {total}
        </span>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${difficultyColors[question.difficulty]}`}
        >
          {question.difficulty}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-secondary rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${((index + 1) / total) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Question text */}
      <p className="text-sm font-medium leading-relaxed">{question.question}</p>

      {/* Options */}
      <div className="space-y-2">
        {question.options.map((option, optIdx) => {
          const isSelected = selectedAnswer === optIdx;
          const isCorrectOption = optIdx === question.correct_index;

          let optionStyle = 'border-border/50 hover:border-primary/40 hover:bg-primary/5';
          if (submitted) {
            if (isCorrectOption) {
              optionStyle = 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
            } else if (isSelected && !isCorrect) {
              optionStyle = 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400';
            } else {
              optionStyle = 'border-border/30 opacity-50';
            }
          } else if (isSelected) {
            optionStyle = 'border-primary bg-primary/10 shadow-sm';
          }

          return (
            <motion.button
              key={optIdx}
              whileHover={!submitted ? { scale: 1.01 } : {}}
              whileTap={!submitted ? { scale: 0.99 } : {}}
              onClick={() => !submitted && onAnswer(optIdx)}
              disabled={submitted}
              className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all duration-200 flex items-center gap-3 ${optionStyle}`}
            >
              <span
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                  isSelected && !submitted
                    ? 'border-primary bg-primary text-primary-foreground'
                    : submitted && isCorrectOption
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : submitted && isSelected
                    ? 'border-red-500 bg-red-500 text-white'
                    : 'border-muted-foreground/30'
                }`}
              >
                {submitted && isCorrectOption ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : submitted && isSelected ? (
                  <XCircle className="w-4 h-4" />
                ) : (
                  String.fromCharCode(65 + optIdx)
                )}
              </span>
              <span className="text-sm">{option}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Explanation (shown after submit) */}
      {submitted && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="overflow-hidden"
        >
          <button
            onClick={() => setShowExplanation(!showExplanation)}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-1"
          >
            <Lightbulb className="w-3.5 h-3.5" />
            {showExplanation ? 'Hide' : 'Show'} explanation
          </button>
          <AnimatePresence>
            {showExplanation && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 px-3 py-2.5 rounded-lg bg-primary/5 border border-primary/10 text-xs leading-relaxed text-muted-foreground"
              >
                {question.explanation}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </motion.div>
  );
}

function ScoreCard({
  score,
  total,
  onRetry,
}: {
  score: number;
  total: number;
  onRetry: () => void;
}) {
  const percentage = Math.round((score / total) * 100);
  const emoji =
    percentage >= 80
      ? '🎉'
      : percentage >= 60
      ? '👍'
      : percentage >= 40
      ? '💪'
      : '📚';

  const message =
    percentage >= 80
      ? 'Excellent! You really know this material!'
      : percentage >= 60
      ? 'Good job! Keep reviewing the tricky parts.'
      : percentage >= 40
      ? "Not bad, but there's room to improve."
      : 'Time to review! Go through the material again.';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center text-center py-6 space-y-4"
    >
      <div className="text-5xl">{emoji}</div>
      <div>
        <h3 className="text-lg font-bold">Quiz Complete!</h3>
        <p className="text-muted-foreground text-sm mt-1">{message}</p>
      </div>

      <div className="flex items-center gap-6 mt-2">
        <div className="text-center">
          <div className="flex items-center gap-1.5 text-emerald-500">
            <Trophy className="w-4 h-4" />
            <span className="text-2xl font-bold">{score}</span>
          </div>
          <span className="text-[10px] text-muted-foreground">Correct</span>
        </div>
        <div className="w-px h-8 bg-border" />
        <div className="text-center">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Target className="w-4 h-4" />
            <span className="text-2xl font-bold">{total}</span>
          </div>
          <span className="text-[10px] text-muted-foreground">Total</span>
        </div>
        <div className="w-px h-8 bg-border" />
        <div className="text-center">
          <span
            className={`text-2xl font-bold ${
              percentage >= 60 ? 'text-emerald-500' : 'text-amber-500'
            }`}
          >
            {percentage}%
          </span>
          <br />
          <span className="text-[10px] text-muted-foreground">Score</span>
        </div>
      </div>

      <button
        onClick={onRetry}
        className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        <RotateCcw className="w-4 h-4" />
        Try Again
      </button>
    </motion.div>
  );
}

export function QuizPanel() {
  const {
    quizData,
    quizAnswers,
    quizSubmitted,
    currentQuizIndex,
    answerQuestion,
    submitQuiz,
    resetQuiz,
    setCurrentQuizIndex,
  } = useCanvasStore();

  if (!quizData) return null;

  const { questions } = quizData;
  const currentQ = questions[currentQuizIndex];
  const allAnswered = questions.every((q) => quizAnswers[q.id] !== undefined);

  const score = questions.reduce(
    (acc, q) => acc + (quizAnswers[q.id] === q.correct_index ? 1 : 0),
    0
  );

  // Show score card after submission
  if (quizSubmitted) {
    return (
      <div className="p-4">
        <ScoreCard score={score} total={questions.length} onRetry={resetQuiz} />

        {/* Review all questions */}
        <div className="mt-6 space-y-6 border-t border-border/40 pt-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Review
          </h4>
          {questions.map((q, idx) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={idx}
              total={questions.length}
              selectedAnswer={quizAnswers[q.id]}
              submitted={true}
              onAnswer={() => {}}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Title */}
      <div>
        <h3 className="text-sm font-semibold">{quizData.title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Topic: {quizData.topic}
        </p>
      </div>

      {/* Current question */}
      <AnimatePresence mode="wait">
        <QuestionCard
          key={currentQ.id}
          question={currentQ}
          index={currentQuizIndex}
          total={questions.length}
          selectedAnswer={quizAnswers[currentQ.id]}
          submitted={false}
          onAnswer={(idx) => answerQuestion(currentQ.id, idx)}
        />
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => setCurrentQuizIndex(currentQuizIndex - 1)}
          disabled={currentQuizIndex === 0}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-30 hover:bg-secondary transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Previous
        </button>

        {currentQuizIndex < questions.length - 1 ? (
          <button
            onClick={() => setCurrentQuizIndex(currentQuizIndex + 1)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-secondary transition-colors"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={submitQuiz}
            disabled={!allAnswered}
            className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Submit Quiz
          </button>
        )}
      </div>

      {/* Question dots */}
      <div className="flex items-center justify-center gap-1.5 pt-1">
        {questions.map((q, idx) => (
          <button
            key={q.id}
            onClick={() => setCurrentQuizIndex(idx)}
            className={`w-2 h-2 rounded-full transition-all ${
              idx === currentQuizIndex
                ? 'bg-primary scale-125'
                : quizAnswers[q.id] !== undefined
                ? 'bg-primary/40'
                : 'bg-muted-foreground/20'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
