import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { 
  Shield, 
  FileText, 
  Layers,
  BrainCircuit,
  Lock,
  Zap
} from 'lucide-react';
import { useRef } from 'react';

// 3D Tilt Card Component
function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [5, -5]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-5, 5]), { stiffness: 300, damping: 30 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set((e.clientX - centerX) / rect.width);
    y.set((e.clientY - centerY) / rect.height);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const features = [
  {
    icon: BrainCircuit,
    title: 'Course-Aware Intelligence',
    description: 'AI understands your specific curriculum and provides answers tailored to your enrolled courses. No generic responses—only relevant, contextual help.',
  },
  {
    icon: Shield,
    title: 'Anti-Hallucination',
    description: 'Our self-reflective validation system ensures every answer is backed by actual course materials. Never worry about made-up information again.',
  },
  {
    icon: FileText,
    title: 'Source Attribution',
    description: 'Every answer includes references to specific slides, documents, and sections. Know exactly where the information comes from.',
  },
  {
    icon: Layers,
    title: 'Multi-Course Support',
    description: 'Seamlessly switch between all your enrolled courses. The AI maintains context and provides course-specific answers every time.',
  },
  {
    icon: Lock,
    title: 'Multi-Tenant Security',
    description: 'Organizations have completely isolated data environments. Your course materials are secure and never shared across organizations.',
  },
  {
    icon: Zap,
    title: 'Adaptive Retrieval',
    description: 'Smart retrieval strategies adapt to different course sizes and content types for optimal performance and accuracy.',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
    },
  },
};

export function Features() {
  return (
    <section id="features" className="relative py-24 lg:py-32 bg-gray-50 overflow-hidden">
      {/* Subtle animated background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 opacity-[0.03]">
          <div 
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, #000 1px, transparent 0)`,
              backgroundSize: '40px 40px',
            }}
          />
        </div>
        {/* Floating gradient orbs */}
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full opacity-30"
          style={{
            background: 'radial-gradient(circle, rgba(249, 115, 22, 0.2) 0%, transparent 70%)',
            left: '-10%',
            top: '20%',
            filter: 'blur(40px)',
          }}
          animate={{
            x: [0, 100, 0],
            y: [0, 50, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute w-[400px] h-[400px] rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(249, 115, 22, 0.2) 0%, transparent 70%)',
            right: '-5%',
            bottom: '10%',
            filter: 'blur(40px)',
          }}
          animate={{
            x: [0, -80, 0],
            y: [0, -60, 0],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
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
            [ 01 / 07 ] · Main Features
          </span>
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Developer First
          </h2>
          <p className="text-xl text-gray-500">
            Start learning smarter today
          </p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
            >
              <TiltCard>
                <motion.div
                  whileHover={{ y: -8, transition: { duration: 0.3 } }}
                  className="group relative p-6 rounded-xl bg-white border border-gray-100 hover:border-orange-200 hover:shadow-xl hover:shadow-orange-100/50 transition-all duration-300 h-full"
                >
                  {/* Hover gradient overlay */}
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-orange-50/0 to-orange-100/0 group-hover:from-orange-50/50 group-hover:to-orange-100/30 transition-all duration-300" />
                  
                  {/* Animated border glow on hover */}
                  <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="absolute inset-[-1px] rounded-xl bg-gradient-to-r from-orange-200 via-orange-300 to-orange-200 opacity-50 blur-sm" />
                  </div>
                  
                  <div className="relative z-10">
                    {/* Icon with animation */}
                    <motion.div 
                      className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center mb-4 group-hover:bg-orange-100 transition-colors"
                      whileHover={{ rotate: [0, -10, 10, 0], transition: { duration: 0.5 } }}
                    >
                      <feature.icon className="w-6 h-6 text-primary" />
                    </motion.div>

                    {/* Content */}
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {feature.description}
                    </p>
                    
                    {/* Learn more link */}
                    <motion.div 
                      className="mt-4 flex items-center gap-1 text-primary text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      initial={{ x: -10 }}
                      whileHover={{ x: 0 }}
                    >
                      <span>Learn more</span>
                      <motion.span
                        animate={{ x: [0, 4, 0] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      >
                        →
                      </motion.span>
                    </motion.div>
                  </div>
                </motion.div>
              </TiltCard>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
