import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, Zap, Shield, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Animated particles component
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(30)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-primary/30 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0, 1, 0],
            scale: [0, 1, 0],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 3,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

const asciiFrames = [
  `
   ┌─────────────────────────────────────┐
   │  🤖 AI TUTOR                        │
   │                                     │
   │  > What is binary search?           │
   │                                     │
   │  Binary search is a divide-and-     │
   │  conquer algorithm that finds a     │
   │  target in O(log n) time...         │
   │                                     │
   │  📚 Sources: Slide 24, 25           │
   └─────────────────────────────────────┘
  `,
  `
   ┌─────────────────────────────────────┐
   │  🤖 AI TUTOR                        │
   │                                     │
   │  > Explain quicksort algorithm      │
   │                                     │
   │  Quicksort uses a pivot to partition│
   │  array into subarrays, recursively  │
   │  sorting each part...               │
   │                                     │
   │  📚 Sources: Slide 18, 19, 20       │
   └─────────────────────────────────────┘
  `,
  `
   ┌─────────────────────────────────────┐
   │  🤖 AI TUTOR                        │
   │                                     │
   │  > What is time complexity?         │
   │                                     │
   │  Time complexity measures how       │
   │  runtime grows with input size...   │
   │                                     │
   │  📚 Sources: Slide 5, 6             │
   └─────────────────────────────────────┘
  `,
];

export function Hero() {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    const text = asciiFrames[currentFrame];
    let charIndex = 0;
    setDisplayText('');
    setIsTyping(true);

    const typeInterval = setInterval(() => {
      if (charIndex < text.length) {
        setDisplayText(text.slice(0, charIndex + 1));
        charIndex++;
      } else {
        setIsTyping(false);
        clearInterval(typeInterval);
        
        // Wait before showing next frame
        setTimeout(() => {
          setCurrentFrame((prev) => (prev + 1) % asciiFrames.length);
        }, 3000);
      }
    }, 15);

    return () => clearInterval(typeInterval);
  }, [currentFrame]);

  const scrollToDemo = () => {
    const demoSection = document.getElementById('demo');
    if (demoSection) {
      demoSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const scrollToFeatures = () => {
    const featuresSection = document.getElementById('features');
    if (featuresSection) {
      featuresSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-white pt-20">
      {/* Animated background */}
      <div className="absolute inset-0">
        {/* Dot pattern */}
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #000 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }} />
        </div>
        
        {/* Floating gradient orbs */}
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full opacity-30"
          style={{
            background: 'radial-gradient(circle, rgba(249, 115, 22, 0.15) 0%, transparent 70%)',
            right: '-10%',
            top: '-20%',
            filter: 'blur(60px)',
          }}
          animate={{
            x: [0, 50, 0],
            y: [0, 30, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute w-[400px] h-[400px] rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(249, 115, 22, 0.2) 0%, transparent 70%)',
            left: '-5%',
            bottom: '10%',
            filter: 'blur(40px)',
          }}
          animate={{
            x: [0, -30, 0],
            y: [0, -40, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        
        {/* Floating particles */}
        <FloatingParticles />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Text */}
          <div className="text-left">
            {/* Badge with pulse animation */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-6"
            >
              <motion.span 
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-50 border border-orange-100 text-primary text-xs font-medium relative overflow-hidden"
                whileHover={{ scale: 1.05 }}
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-100 to-transparent"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                />
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                >
                  <Sparkles className="w-3.5 h-3.5 relative z-10" />
                </motion.div>
                <span className="relative z-10">Powered by Advanced RAG Technology</span>
              </motion.span>
            </motion.div>

            {/* Main Headline with animated gradient */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 text-gray-900"
            >
              Turn course materials into
              <motion.span 
                className="text-primary relative inline-block"
                whileHover={{ scale: 1.05 }}
              >
                {' AI-ready'}
                <motion.span
                  className="absolute bottom-0 left-0 w-full h-1 bg-primary/30 rounded-full"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.8, delay: 0.5 }}
                />
              </motion.span> answers
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg sm:text-xl text-gray-600 max-w-xl mb-8"
            >
              Power your learning with accurate, source-backed answers from your course materials. No hallucinations, every answer verified.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-start gap-4 mb-8"
            >
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  size="lg"
                  className="group bg-primary hover:bg-primary/90 text-white px-8 py-6 text-base rounded-xl shadow-lg shadow-orange-200 hover:shadow-xl hover:shadow-orange-300 transition-all duration-300 relative overflow-hidden"
                  onClick={scrollToDemo}
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                  />
                  <span className="relative z-10 flex items-center">
                    Get Started
                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  size="lg"
                  variant="outline"
                  className="px-8 py-6 text-base rounded-xl border-gray-200 hover:bg-gray-50 hover:border-primary/30 transition-all duration-300"
                  onClick={scrollToFeatures}
                >
                  See How It Works
                </Button>
              </motion.div>
            </motion.div>

            {/* Quick feature pills */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-wrap gap-3"
            >
              {[
                { icon: Zap, text: 'Instant answers' },
                { icon: Shield, text: 'Source verified' },
                { icon: Brain, text: 'AI-powered' },
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-100 text-xs text-gray-600"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + idx * 0.1 }}
                  whileHover={{ scale: 1.05, borderColor: 'rgba(249, 115, 22, 0.3)' }}
                >
                  <item.icon className="w-3 h-3 text-primary" />
                  {item.text}
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Right Column - ASCII Animation */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="hidden lg:block"
          >
            <div className="relative">
              {/* Terminal Window */}
              <div className="bg-gray-900 rounded-xl overflow-hidden shadow-2xl">
                {/* Terminal Header */}
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-800 border-b border-gray-700">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="ml-4 text-xs text-gray-400">ai-tutor — bash</span>
                </div>
                
                {/* Terminal Content */}
                <div className="p-6 font-mono text-sm">
                  <pre className="text-green-400 whitespace-pre-wrap leading-relaxed">
                    {displayText}
                    {isTyping && <span className="animate-pulse">▊</span>}
                  </pre>
                </div>
              </div>

              {/* Floating badges with enhanced animations */}
              <motion.div
                animate={{ 
                  y: [0, -10, 0],
                  rotate: [0, 2, -2, 0],
                }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                whileHover={{ scale: 1.1 }}
                className="absolute -top-4 -right-4 bg-white rounded-xl shadow-lg px-4 py-2.5 border border-gray-100 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <motion.span 
                    className="w-2 h-2 rounded-full bg-green-500"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                  <span className="text-xs font-medium text-gray-700">99% Accuracy</span>
                </div>
              </motion.div>
              
              <motion.div
                animate={{ 
                  y: [0, 10, 0],
                  rotate: [0, -2, 2, 0],
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                whileHover={{ scale: 1.1 }}
                className="absolute -bottom-4 -left-4 bg-white rounded-xl shadow-lg px-4 py-2.5 border border-gray-100 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Shield className="w-3 h-3 text-primary" />
                  <span className="text-xs font-medium text-gray-700">Source Verified</span>
                </div>
              </motion.div>
              
              {/* New floating badge */}
              <motion.div
                animate={{ 
                  x: [0, 5, 0],
                  y: [0, -5, 0],
                }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                whileHover={{ scale: 1.1 }}
                className="absolute top-1/2 -right-8 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl shadow-lg px-4 py-2.5 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-3 h-3 text-white" />
                  <span className="text-xs font-medium text-white">Instant</span>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* Stats section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-20 pt-12 border-t border-gray-100"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: '99%', label: 'Answer Accuracy', delay: 0 },
              { value: '<1s', label: 'Response Time', delay: 0.1 },
              { value: '0', label: 'Hallucinations', delay: 0.2 },
              { value: '24/7', label: 'Available', delay: 0.3 },
            ].map((stat) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.6 + stat.delay }}
                className="text-center"
              >
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: stat.delay }}
                  className="text-3xl md:text-4xl font-bold text-primary mb-2"
                >
                  {stat.value}
                </motion.div>
                <p className="text-sm text-gray-500">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
