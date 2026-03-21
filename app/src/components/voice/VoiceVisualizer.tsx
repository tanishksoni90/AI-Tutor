import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Mic, Loader2, Volume2 } from 'lucide-react';
import type { VoiceState } from '@/store/voiceStore';

interface VoiceVisualizerProps {
  state: VoiceState;
  audioLevel: number; // 0 to 1
}

const STATE_CONFIG = {
  idle: {
    color: 'rgba(156, 163, 175, 1)',
    glowColor: 'rgba(156, 163, 175, 0.15)',
    ringColor: 'rgba(156, 163, 175, 0.1)',
    gradient: ['#9ca3af', '#6b7280'],
  },
  listening: {
    color: 'rgba(249, 115, 22, 1)',
    glowColor: 'rgba(249, 115, 22, 0.2)',
    ringColor: 'rgba(249, 115, 22, 0.08)',
    gradient: ['#f97316', '#ea580c'],
  },
  processing: {
    color: 'rgba(139, 92, 246, 1)',
    glowColor: 'rgba(139, 92, 246, 0.2)',
    ringColor: 'rgba(139, 92, 246, 0.08)',
    gradient: ['#8b5cf6', '#7c3aed'],
  },
  speaking: {
    color: 'rgba(16, 185, 129, 1)',
    glowColor: 'rgba(16, 185, 129, 0.2)',
    ringColor: 'rgba(16, 185, 129, 0.08)',
    gradient: ['#10b981', '#059669'],
  },
};

export function VoiceVisualizer({ state, audioLevel }: VoiceVisualizerProps) {
  const config = STATE_CONFIG[state];
  const smoothLevel = useRef(0);

  // Smooth audio level for visual
  useEffect(() => {
    const ease = 0.15;
    smoothLevel.current += (audioLevel - smoothLevel.current) * ease;
  }, [audioLevel]);

  const level = Math.max(audioLevel, 0);
  const isActive = state === 'listening' || state === 'speaking';

  return (
    <div className="relative w-56 h-56 md:w-64 md:h-64 flex items-center justify-center">
      {/* ── Ambient glow ── */}
      <motion.div
        className="absolute inset-0 rounded-full blur-3xl"
        animate={{
          scale: isActive ? [1.2, 1.4 + level * 0.4, 1.2] : [1.0, 1.1, 1.0],
          opacity: isActive ? [0.15, 0.25 + level * 0.15, 0.15] : [0.05, 0.1, 0.05],
        }}
        transition={{
          duration: state === 'processing' ? 1.5 : 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{ background: config.glowColor }}
      />

      {/* ── Ring 4 (outermost) ── */}
      <motion.div
        className="absolute rounded-full border"
        style={{
          width: '100%',
          height: '100%',
          borderColor: config.ringColor,
        }}
        animate={{
          scale: isActive
            ? [1.0, 1.05 + level * 0.15, 1.0]
            : state === 'processing'
            ? [1.0, 1.04, 1.0]
            : 1.0,
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: state === 'processing' ? 1.8 : 2.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* ── Ring 3 ── */}
      <motion.div
        className="absolute rounded-full border"
        style={{
          width: '82%',
          height: '82%',
          borderColor: config.ringColor,
        }}
        animate={{
          scale: isActive
            ? [1.0, 1.04 + level * 0.12, 1.0]
            : state === 'processing'
            ? [1.0, 1.03, 1.0]
            : 1.0,
          opacity: [0.4, 0.6, 0.4],
        }}
        transition={{
          duration: state === 'processing' ? 1.5 : 2.2,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 0.15,
        }}
      />

      {/* ── Ring 2 ── */}
      <motion.div
        className="absolute rounded-full border-2"
        style={{
          width: '66%',
          height: '66%',
          borderColor: `${config.color}22`,
        }}
        animate={{
          scale: isActive
            ? [1.0, 1.03 + level * 0.08, 1.0]
            : state === 'processing'
            ? [1.0, 1.02, 1.0]
            : 1.0,
          opacity: [0.5, 0.7, 0.5],
          rotate: state === 'processing' ? [0, 360] : 0,
        }}
        transition={{
          duration: state === 'processing' ? 3 : 1.8,
          repeat: Infinity,
          ease: state === 'processing' ? 'linear' : 'easeInOut',
          delay: 0.3,
        }}
      />

      {/* ── Ring 1 (innermost ring) ── */}
      <motion.div
        className="absolute rounded-full border-2"
        style={{
          width: '52%',
          height: '52%',
          borderColor: `${config.color}33`,
        }}
        animate={{
          scale: isActive
            ? [1.0, 1.02 + level * 0.06, 1.0]
            : state === 'processing'
            ? [1.0, 1.015, 1.0]
            : 1.0,
          opacity: [0.6, 0.85, 0.6],
          rotate: state === 'processing' ? [360, 0] : 0,
        }}
        transition={{
          duration: state === 'processing' ? 2.5 : 1.5,
          repeat: Infinity,
          ease: state === 'processing' ? 'linear' : 'easeInOut',
          delay: 0.1,
        }}
      />

      {/* ── Pulsing wave rings (listening/speaking only) ── */}
      {isActive && (
        <>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={`wave-${i}`}
              className="absolute rounded-full border"
              style={{
                width: '42%',
                height: '42%',
                borderColor: config.color,
              }}
              initial={{ scale: 1, opacity: 0.4 }}
              animate={{
                scale: [1, 1.8 + level * 0.6],
                opacity: [0.3 + level * 0.2, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeOut',
                delay: i * 0.6,
              }}
            />
          ))}
        </>
      )}

      {/* ── Center orb ── */}
      <motion.div
        className="relative z-10 w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center cursor-pointer"
        style={{
          background: `linear-gradient(135deg, ${config.gradient[0]}, ${config.gradient[1]})`,
          boxShadow: `0 0 30px ${config.glowColor}, 0 8px 32px rgba(0,0,0,0.3)`,
        }}
        animate={{
          scale: isActive ? [1, 1.02 + level * 0.04, 1] : [1, 1.01, 1],
        }}
        transition={{
          duration: 1.2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        whileTap={{ scale: 0.95 }}
      >
        {/* Inner highlight */}
        <div
          className="absolute inset-1 rounded-full opacity-20"
          style={{
            background:
              'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.4), transparent 60%)',
          }}
        />

        {/* Icon */}
        {state === 'processing' ? (
          <Loader2 className="w-8 h-8 md:w-10 md:h-10 text-white animate-spin" />
        ) : state === 'speaking' ? (
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          >
            <Volume2 className="w-8 h-8 md:w-10 md:h-10 text-white" />
          </motion.div>
        ) : (
          <Mic className="w-8 h-8 md:w-10 md:h-10 text-white" />
        )}
      </motion.div>
    </div>
  );
}
