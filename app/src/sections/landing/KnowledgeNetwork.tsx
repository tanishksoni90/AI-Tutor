import { useRef, useEffect } from 'react';

interface ParticleNetworkProps {
  color?: 'orange' | 'gray';
  className?: string;
}

export function KnowledgeNetwork({ color = 'orange', className = '' }: ParticleNetworkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Colors based on theme
    const colors = {
      orange: {
        particle: 'rgba(249, 115, 22, 0.8)',
        particleGlow: 'rgba(249, 115, 22, 0.3)',
        connection: (alpha: number) => `rgba(249, 115, 22, ${alpha})`,
        highlight: 'rgba(251, 146, 60, 1)',
      },
      gray: {
        particle: 'rgba(156, 163, 175, 0.6)',
        particleGlow: 'rgba(156, 163, 175, 0.2)',
        connection: (alpha: number) => `rgba(156, 163, 175, ${alpha})`,
        highlight: 'rgba(209, 213, 219, 1)',
      },
    };

    const theme = colors[color];

    // Set canvas size
    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    // Mouse tracking
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      };
    };
    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    // Particle system with enhanced properties
    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      baseSize: number;
      pulse: number;
      pulseSpeed: number;
    }

    const particles: Particle[] = [];
    const particleCount = 80;
    const connectionDistance = 120;
    const mouseRadius = 150;

    // Initialize particles
    for (let i = 0; i < particleCount; i++) {
      const size = Math.random() * 2 + 1;
      particles.push({
        x: Math.random() * canvas.offsetWidth,
        y: Math.random() * canvas.offsetHeight,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size,
        baseSize: size,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.02 + Math.random() * 0.02,
      });
    }

    let animationId: number;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      const mouse = mouseRef.current;

      // Update and draw particles
      particles.forEach((particle, i) => {
        // Mouse interaction
        if (mouse.active) {
          const dx = mouse.x - particle.x;
          const dy = mouse.y - particle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < mouseRadius) {
            const force = (mouseRadius - distance) / mouseRadius;
            particle.vx -= (dx / distance) * force * 0.02;
            particle.vy -= (dy / distance) * force * 0.02;
          }
        }

        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Friction
        particle.vx *= 0.99;
        particle.vy *= 0.99;

        // Pulse animation
        particle.pulse += particle.pulseSpeed;
        particle.size = particle.baseSize + Math.sin(particle.pulse) * 0.5;

        // Bounce off edges with padding
        const padding = 20;
        if (particle.x < padding) {
          particle.x = padding;
          particle.vx *= -0.5;
        }
        if (particle.x > canvas.offsetWidth - padding) {
          particle.x = canvas.offsetWidth - padding;
          particle.vx *= -0.5;
        }
        if (particle.y < padding) {
          particle.y = padding;
          particle.vy *= -0.5;
        }
        if (particle.y > canvas.offsetHeight - padding) {
          particle.y = canvas.offsetHeight - padding;
          particle.vy *= -0.5;
        }

        // Draw connections first (behind particles)
        particles.slice(i + 1).forEach((other) => {
          const dx = particle.x - other.x;
          const dy = particle.y - other.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < connectionDistance) {
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(other.x, other.y);
            const alpha = 0.2 * (1 - distance / connectionDistance);
            ctx.strokeStyle = theme.connection(alpha);
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        });

        // Draw particle glow
        const gradient = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, particle.size * 3
        );
        gradient.addColorStop(0, theme.particleGlow);
        gradient.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw particle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = theme.particle;
        ctx.fill();

        // Highlight particles near mouse
        if (mouse.active) {
          const dx = mouse.x - particle.x;
          const dy = mouse.y - particle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < mouseRadius) {
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size + 2, 0, Math.PI * 2);
            ctx.strokeStyle = theme.highlight;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationId);
    };
  }, [color]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 z-0 ${className}`}
      style={{ background: 'transparent', width: '100%', height: '100%' }}
    />
  );
}
