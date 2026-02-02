import { motion } from 'framer-motion';
import { BookOpen, MessageCircle, Lightbulb, Check, ArrowRight } from 'lucide-react';
import { useState } from 'react';

const steps = [
  {
    step: 1,
    title: 'Enroll in Courses',
    description: 'Sign up and get enrolled in your courses. Your organization admin uploads all course materials including slides, documents, and reading materials.',
    icon: BookOpen,
  },
  {
    step: 2,
    title: 'Ask Any Question',
    description: 'Type your question in natural language. Ask about concepts, request explanations, or seek clarification on any topic covered in your course.',
    icon: MessageCircle,
  },
  {
    step: 3,
    title: 'Get Explained Answers',
    description: 'Receive detailed, accurate answers with source references. Every response includes slide numbers and document titles for easy verification.',
    icon: Lightbulb,
  },
];

export function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0);
  
  return (
    <section id="how-it-works" className="relative py-24 lg:py-32 bg-white overflow-hidden">
      {/* Animated background lines */}
      <div className="absolute inset-0 overflow-hidden">
        <svg className="absolute w-full h-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(249, 115, 22, 0)" />
              <stop offset="50%" stopColor="rgba(249, 115, 22, 0.1)" />
              <stop offset="100%" stopColor="rgba(249, 115, 22, 0)" />
            </linearGradient>
          </defs>
          {[...Array(5)].map((_, i) => (
            <motion.line
              key={i}
              x1="0"
              y1={`${20 + i * 20}%`}
              x2="100%"
              y2={`${20 + i * 20}%`}
              stroke="url(#lineGradient)"
              strokeWidth="1"
              initial={{ pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 2, delay: i * 0.2 }}
            />
          ))}
        </svg>
      </div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block text-xs font-semibold text-primary uppercase tracking-wider mb-4">
            [ 02 / 07 ] · Core
          </span>
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Built to outperform
          </h2>
          <p className="text-xl text-gray-500">
            Core principles, proven performance
          </p>
        </motion.div>

        {/* Steps with animated connector */}
        <div className="relative">
          {/* Connector line (desktop only) */}
          <div className="hidden lg:block absolute top-24 left-0 right-0 h-0.5 bg-gray-100">
            <motion.div
              className="h-full bg-gradient-to-r from-primary via-primary to-primary"
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
              style={{ transformOrigin: 'left' }}
            />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.2 }}
                className="relative"
                onMouseEnter={() => setActiveStep(index)}
              >
                {/* Connector arrow (desktop) */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:flex absolute top-24 -right-4 z-10 w-8 h-8 items-center justify-center">
                    <motion.div
                      animate={{ x: [0, 5, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <ArrowRight className="w-5 h-5 text-primary" />
                    </motion.div>
                  </div>
                )}
                
                <motion.div 
                  className={`p-6 rounded-xl border transition-all duration-300 ${
                    activeStep === index 
                      ? 'bg-white border-primary/30 shadow-lg shadow-orange-100/50' 
                      : 'bg-gray-50 border-gray-100 hover:border-gray-200'
                  }`}
                  whileHover={{ y: -4 }}
                >
                  {/* Step number with pulse */}
                  <div className="flex items-center gap-3 mb-4">
                    <motion.div 
                      className="relative w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white font-bold"
                      whileHover={{ scale: 1.1 }}
                    >
                      {activeStep === index && (
                        <motion.div
                          className="absolute inset-0 rounded-xl bg-primary"
                          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      )}
                      <span className="relative z-10">{step.step}</span>
                    </motion.div>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>

                  {/* Icon with animation */}
                  <motion.div 
                    className="w-14 h-14 rounded-xl bg-white border border-gray-100 flex items-center justify-center mb-4 shadow-sm"
                    animate={activeStep === index ? { rotate: [0, 5, -5, 0] } : {}}
                    transition={{ duration: 0.5 }}
                  >
                    <step.icon className="w-7 h-7 text-primary" />
                  </motion.div>

                  {/* Content */}
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    {step.title}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {step.description}
                  </p>

                  {/* Check indicator with animation */}
                  <motion.div 
                    className="mt-4 flex items-center gap-2 text-sm text-green-600"
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                  >
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Check className="w-4 h-4" />
                    </motion.div>
                    <span>Simple & Fast</span>
                  </motion.div>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Stats row with animated counters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6"
        >
          {[
            { label: 'Average Response', value: '< 3s', icon: '⚡' },
            { label: 'Accuracy Rate', value: '99%', icon: '🎯' },
            { label: 'Courses Supported', value: '10K+', icon: '📚' },
            { label: 'Students Helped', value: '50K+', icon: '🎓' },
          ].map((stat, idx) => (
            <motion.div 
              key={idx} 
              className="relative text-center p-6 rounded-xl bg-white border border-gray-100 group hover:border-primary/30 hover:shadow-lg hover:shadow-orange-100/30 transition-all duration-300"
              whileHover={{ y: -4, scale: 1.02 }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 + idx * 0.1 }}
            >
              <motion.span 
                className="text-2xl mb-2 block"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: idx * 0.2 }}
              >
                {stat.icon}
              </motion.span>
              <motion.p 
                className="text-3xl font-bold text-gray-900 mb-1"
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ type: 'spring', delay: 0.5 + idx * 0.1 }}
              >
                {stat.value}
              </motion.p>
              <p className="text-sm text-gray-500">{stat.label}</p>
              
              {/* Hover glow */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-orange-100/0 to-orange-200/0 group-hover:from-orange-50 group-hover:to-orange-100/50 transition-all duration-300 -z-10" />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
