import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, FileText, Sparkles, Check, Zap, Shield, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Animated Grid Background Component
function AnimatedGridBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-gray-900/95 to-gray-900" />
      
      {/* Animated grid */}
      <div className="absolute inset-0 opacity-20">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(249, 115, 22, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(249, 115, 22, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
      </div>
      
      {/* Animated dots */}
      <div className="absolute inset-0">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-primary rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              opacity: [0.2, 0.8, 0.2],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>
      
      {/* Glowing orbs */}
      <motion.div
        className="absolute w-96 h-96 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(249, 115, 22, 0.15) 0%, transparent 70%)',
          left: '10%',
          top: '20%',
        }}
        animate={{
          x: [0, 50, 0],
          y: [0, 30, 0],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute w-64 h-64 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(249, 115, 22, 0.1) 0%, transparent 70%)',
          right: '15%',
          bottom: '30%',
        }}
        animate={{
          x: [0, -30, 0],
          y: [0, -40, 0],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  );
}

interface DemoMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  sources?: { slide: number; title: string; relevance: number }[];
}

const demoConversation: DemoMessage[] = [
  {
    id: '1',
    type: 'user',
    content: 'What is binary search and how does it work?',
  },
  {
    id: '2',
    type: 'assistant',
    content: `Binary search is a divide-and-conquer algorithm that efficiently finds a target value in a sorted array.

Here's how it works:
1. Compare target with middle element
2. If equal, we found it!
3. If target < middle, search left half
4. If target > middle, search right half
5. Repeat until found or exhausted

Time Complexity: O(log n)`,
    sources: [
      { slide: 24, title: 'Binary Search Algorithm', relevance: 0.92 },
      { slide: 25, title: 'Binary Search Implementation', relevance: 0.87 },
    ],
  },
];

const suggestedQuestions = [
  'Explain quicksort algorithm',
  'What is the time complexity of merge sort?',
  'Difference between stack and queue',
];

export function Demo() {
  const [messages, setMessages] = useState<DemoMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    // Use 'nearest' to only scroll within the chat container, not the whole page
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Start demo animation on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsTyping(true);
      setTimeout(() => {
        setMessages([demoConversation[0]]);
        setIsTyping(false);
        
        setTimeout(() => {
          setIsTyping(true);
          setTimeout(() => {
            setMessages(demoConversation);
            setIsTyping(false);
          }, 1500);
        }, 500);
      }, 1000);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    
    const newMessage: DemoMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
    };
    
    setMessages([...messages, newMessage]);
    setInputValue('');
    setIsTyping(true);
    
    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'This is a demo response. In the actual application, I would provide a detailed answer based on your course materials with source references.',
        sources: [
          { slide: 1, title: 'Demo Source', relevance: 0.95 },
        ],
      }]);
    }, 1500);
  };

  const handleSuggestedQuestion = (question: string) => {
    setInputValue(question);
  };

  return (
    <section id="demo" className="relative py-24 lg:py-32 bg-gray-900 overflow-hidden">
      {/* Animated Background */}
      <AnimatedGridBackground />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <span className="inline-block text-xs font-semibold text-primary uppercase tracking-wider mb-4">
            [ 03 / 07 ] · Playground
          </span>
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Try it yourself
          </h2>
          <p className="text-xl text-gray-400">
            See AI Tutor in action
          </p>
        </motion.div>

        {/* Chat Interface */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-3xl mx-auto"
        >
          <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
            {/* Chat Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white">AI Tutor</h3>
                  <p className="text-xs text-gray-400">Data Structures & Algorithms</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-gray-400">Online</span>
              </div>
            </div>

            {/* Messages Area */}
            <div className="h-[400px] overflow-y-auto p-4 space-y-4 scrollbar-thin bg-gray-900/50">
              {/* Empty State */}
              {messages.length === 0 && !isTyping && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Sparkles className="w-12 h-12 text-gray-600 mb-3" />
                  <p className="text-gray-400">Ask a question to get started</p>
                </div>
              )}

              {/* Messages */}
              <AnimatePresence>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className={`flex gap-3 ${message.type === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${
                      message.type === 'user' 
                        ? 'bg-gray-600' 
                        : 'bg-primary'
                    }`}>
                      {message.type === 'user' ? (
                        <User className="w-4 h-4 text-white" />
                      ) : (
                        <Bot className="w-4 h-4 text-white" />
                      )}
                    </div>

                    {/* Message Content */}
                    <div className={`flex-1 max-w-[80%] ${message.type === 'user' ? 'text-right' : ''}`}>
                      <div className={`inline-block text-left px-4 py-3 rounded-xl text-sm ${
                        message.type === 'user'
                          ? 'bg-gray-700 text-white'
                          : 'bg-gray-800 text-gray-200 border border-gray-700'
                      }`}>
                        <pre className="whitespace-pre-wrap font-sans">{message.content}</pre>
                      </div>

                      {/* Sources */}
                      {message.type === 'assistant' && message.sources && message.sources.length > 0 && (
                        <div className="mt-2">
                          <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                            <FileText className="w-3 h-3" />
                            {message.sources.length} sources
                          </div>
                          <div className="space-y-1">
                            {message.sources.map((source, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2 p-2 rounded-lg bg-gray-800/50 border border-gray-700 text-xs"
                              >
                                <span className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center text-primary font-medium">
                                  {idx + 1}
                                </span>
                                <span className="text-gray-300">{source.title}</span>
                                <span className="text-gray-500">• Slide {source.slide}</span>
                                <span className="text-primary ml-auto">{(source.relevance * 100).toFixed(0)}%</span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs">
                              <Check className="w-3 h-3" />
                              Source Verified
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Typing Indicator */}
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-700 p-4 bg-gray-800/50">
              {/* Suggested Questions */}
              {messages.length === 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {suggestedQuestions.map((question, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSuggestedQuestion(question)}
                      className="px-3 py-1.5 text-xs rounded-full bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="flex gap-3">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask anything about this course..."
                  className="flex-1 px-4 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:border-primary focus:outline-none transition-colors text-sm"
                />
                <Button
                  onClick={handleSend}
                  disabled={!inputValue.trim()}
                  className="px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-wrap justify-center gap-4 mt-8"
        >
          {[
            { icon: Zap, label: 'Instant Responses', color: 'text-yellow-400' },
            { icon: Shield, label: 'Source Verified', color: 'text-green-400' },
            { icon: Clock, label: 'Available 24/7', color: 'text-blue-400' },
          ].map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.5 + idx * 0.1 }}
              whileHover={{ scale: 1.05, y: -2 }}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-800/80 border border-gray-700 backdrop-blur-sm"
            >
              <item.icon className={`w-4 h-4 ${item.color}`} />
              <span className="text-sm text-gray-300">{item.label}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
