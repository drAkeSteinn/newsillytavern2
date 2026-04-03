'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { ChatboxTheme, ThemeColorPreset } from '@/types';
import { THEME_COLOR_PRESETS } from '@/types';

// ============================================
// Types
// ============================================

interface ThemeEffectsProps {
  theme: ChatboxTheme;
  enableAnimations: boolean;
  enableParticles: boolean;
  intensity: number; // 0-100
  className?: string;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  color: string;
  type: 'circle' | 'square' | 'star' | 'gear' | 'spark';
}

// ============================================
// Glitch Effect Component (Cyberpunk)
// ============================================

function GlitchEffect({ intensity, colors }: { intensity: number; colors: ThemeColorPreset }) {
  const glitchRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (intensity === 0) return;
    
    const interval = setInterval(() => {
      if (!glitchRef.current) return;
      
      const glitchLines = glitchRef.current.querySelectorAll('.glitch-line');
      glitchLines.forEach((line) => {
        const el = line as HTMLElement;
        if (Math.random() > 0.7) {
          el.style.transform = `translateX(${(Math.random() - 0.5) * (intensity / 5)}px)`;
          el.style.opacity = `${0.3 + Math.random() * 0.5}`;
          setTimeout(() => {
            el.style.transform = 'translateX(0)';
            el.style.opacity = '0';
          }, 50 + Math.random() * 100);
        }
      });
    }, 100);
    
    return () => clearInterval(interval);
  }, [intensity]);
  
  return (
    <div ref={glitchRef} className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Glitch lines */}
      {[...Array(10)].map((_, i) => (
        <div
          key={i}
          className="glitch-line absolute w-full h-[2px] opacity-0 transition-all"
          style={{
            top: `${(i + 1) * 10}%`,
            backgroundColor: i % 2 === 0 ? colors.primary : colors.secondary,
            boxShadow: `0 0 ${intensity / 20}px ${colors.primary}`,
          }}
        />
      ))}
      {/* Scan effect overlay */}
      <div 
        className="absolute inset-0 animate-glitch-scan"
        style={{
          background: `linear-gradient(transparent 0%, ${colors.primary}10 50%, transparent 100%)`,
          opacity: intensity / 200,
        }}
      />
    </div>
  );
}

// ============================================
// Gear Rotator Component (Steampunk)
// ============================================

function GearRotator({ intensity, colors }: { intensity: number; colors: ThemeColorPreset }) {
  const gears = useMemo(() => [
    { size: 60, x: 10, y: 20, duration: 20, direction: 1 },
    { size: 40, x: 85, y: 70, duration: 15, direction: -1 },
    { size: 50, x: 75, y: 15, duration: 25, direction: 1 },
    { size: 30, x: 5, y: 80, duration: 12, direction: -1 },
  ], []);
  
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
      {gears.map((gear, i) => (
        <svg
          key={i}
          className="absolute"
          style={{
            width: gear.size,
            height: gear.size,
            left: `${gear.x}%`,
            top: `${gear.y}%`,
            transform: `translate(-50%, -50%)`,
            animation: `gear-rotate ${gear.duration}s linear infinite ${gear.direction === -1 ? 'reverse' : 'normal'}`,
            animationPlayState: intensity > 0 ? 'running' : 'paused',
          }}
          viewBox="0 0 100 100"
        >
          <defs>
            <linearGradient id={`gear-grad-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colors.primary} />
              <stop offset="100%" stopColor={colors.secondary} />
            </linearGradient>
          </defs>
          <g fill={`url(#gear-grad-${i})`}>
            {/* Gear teeth */}
            {[...Array(8)].map((_, j) => (
              <rect
                key={j}
                x="45"
                y="0"
                width="10"
                height="15"
                transform={`rotate(${j * 45} 50 50)`}
              />
            ))}
            {/* Gear body */}
            <circle cx="50" cy="50" r="35" />
            {/* Center hole */}
            <circle cx="50" cy="50" r="12" fill={colors.background} />
          </g>
        </svg>
      ))}
    </div>
  );
}

// ============================================
// Candle Flicker Component (Gothic)
// ============================================

function CandleFlicker({ intensity, colors }: { intensity: number; colors: ThemeColorPreset }) {
  const flames = useMemo(() => [
    { x: 15, y: 90, size: 1 },
    { x: 85, y: 85, size: 0.8 },
    { x: 50, y: 95, size: 1.2 },
  ], []);
  
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Ambient glow overlay */}
      <div 
        className="absolute inset-0 animate-flicker-glow"
        style={{
          background: `radial-gradient(ellipse at 50% 100%, ${colors.secondary}20 0%, transparent 50%)`,
          opacity: intensity / 100,
        }}
      />
      
      {/* Candle flames */}
      {flames.map((flame, i) => (
        <div
          key={i}
          className="absolute animate-flicker"
          style={{
            left: `${flame.x}%`,
            bottom: `${100 - flame.y}%`,
            width: 20 * flame.size,
            height: 40 * flame.size,
            transform: 'translateX(-50%)',
            animationDelay: `${i * 0.3}s`,
            animationDuration: `${0.5 + Math.random() * 0.5}s`,
          }}
        >
          <svg viewBox="0 0 20 40" className="w-full h-full">
            <defs>
              <radialGradient id={`flame-grad-${i}`}>
                <stop offset="0%" stopColor="#fff" />
                <stop offset="30%" stopColor={colors.secondary} />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
              <filter id={`flame-blur-${i}`}>
                <feGaussianBlur stdDeviation="1" />
              </filter>
            </defs>
            <ellipse
              cx="10"
              cy="15"
              rx="6"
              ry="15"
              fill={`url(#flame-grad-${i})`}
              filter={`url(#flame-blur-${i})`}
            />
          </svg>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Scanline Overlay Component (Retro)
// ============================================

function ScanlineOverlay({ intensity, colors }: { intensity: number; colors: ThemeColorPreset }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Scanlines */}
      <div 
        className="absolute inset-0"
        style={{
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 0, 0, 0.3) 2px,
            rgba(0, 0, 0, 0.3) 4px
          )`,
          opacity: intensity / 100,
        }}
      />
      
      {/* Moving scanline */}
      <div 
        className="absolute w-full h-[4px] animate-scanline"
        style={{
          background: `linear-gradient(90deg, transparent, ${colors.primary}40, transparent)`,
          boxShadow: `0 0 10px ${colors.primary}`,
        }}
      />
      
      {/* CRT vignette */}
      <div 
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at center, transparent 50%, rgba(0, 0, 0, 0.5) 100%)`,
        }}
      />
      
      {/* Phosphor glow effect */}
      <div 
        className="absolute inset-0 animate-phosphor"
        style={{
          background: colors.primary,
          mixBlendMode: 'overlay',
          opacity: intensity / 500,
        }}
      />
    </div>
  );
}

// ============================================
// Pixel Grid Component (Pixel Art)
// ============================================

function PixelGrid({ intensity, colors }: { intensity: number; colors: ThemeColorPreset }) {
  const pixelSize = 8;
  
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Pixel grid overlay */}
      <div 
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(${colors.primary}10 1px, transparent 1px),
            linear-gradient(90deg, ${colors.primary}10 1px, transparent 1px)
          `,
          backgroundSize: `${pixelSize}px ${pixelSize}px`,
          opacity: intensity / 100,
        }}
      />
      
      {/* Floating pixel sparkles */}
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="absolute animate-pixel-bounce"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: pixelSize,
            height: pixelSize,
            backgroundColor: i % 3 === 0 ? colors.primary : i % 3 === 1 ? colors.secondary : colors.accent,
            animationDelay: `${Math.random() * 2}s`,
            animationDuration: `${2 + Math.random() * 2}s`,
            opacity: intensity / 150,
          }}
        />
      ))}
    </div>
  );
}

// ============================================
// Particle System Component
// ============================================

function ParticleSystem({ 
  theme, 
  intensity, 
  colors 
}: { 
  theme: ChatboxTheme; 
  intensity: number; 
  colors: ThemeColorPreset;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>();
  
  // Initialize particles based on theme
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Create particles
    const particleCount = Math.floor((intensity / 100) * 50);
    const getParticleType = (): Particle['type'] => {
      switch (theme) {
        case 'cyberpunk': return Math.random() > 0.5 ? 'spark' : 'circle';
        case 'steampunk': return 'gear';
        case 'gothic': return 'circle';
        case 'retro': return 'square';
        case 'pixelart': return 'square';
        default: return 'circle';
      }
    };
    
    const getParticleColor = () => {
      const colorOptions = [colors.primary, colors.secondary, colors.accent];
      return colorOptions[Math.floor(Math.random() * colorOptions.length)];
    };
    
    particlesRef.current = [...Array(particleCount)].map((_, i) => ({
      id: i,
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: 2 + Math.random() * 4,
      speedX: (Math.random() - 0.5) * 0.5,
      speedY: -0.2 - Math.random() * 0.5,
      opacity: 0.3 + Math.random() * 0.5,
      color: getParticleColor(),
      type: getParticleType(),
    }));
    
    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particlesRef.current.forEach((p) => {
        // Update position
        p.x += p.speedX * (intensity / 50);
        p.y += p.speedY * (intensity / 50);
        
        // Reset if out of bounds
        if (p.y < -10) {
          p.y = canvas.height + 10;
          p.x = Math.random() * canvas.width;
        }
        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;
        
        // Draw particle
        ctx.save();
        ctx.globalAlpha = p.opacity * (intensity / 100);
        ctx.fillStyle = p.color;
        
        switch (p.type) {
          case 'circle':
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            break;
          case 'square':
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            break;
          case 'star':
            drawStar(ctx, p.x, p.y, 5, p.size, p.size / 2);
            break;
          case 'spark':
            // Draw a small spark/glow
            const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
            gradient.addColorStop(0, p.color);
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
            ctx.fill();
            break;
          case 'gear':
            // Simple gear representation
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            ctx.fillRect(p.x - p.size, p.y - p.size / 4, p.size * 2, p.size / 2);
            ctx.fillRect(p.x - p.size / 4, p.y - p.size, p.size / 2, p.size * 2);
            break;
        }
        
        ctx.restore();
      });
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [theme, intensity, colors]);
  
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: intensity / 100 }}
    />
  );
}

// Helper function to draw stars
function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
  ctx.fill();
}

// ============================================
// Main Theme Effects Component
// ============================================

export function ThemeEffects({ 
  theme, 
  enableAnimations, 
  enableParticles, 
  intensity,
  className 
}: ThemeEffectsProps) {
  // Check for reduced motion preference
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);
  
  // Skip effects if reduced motion or animations disabled
  const shouldAnimate = enableAnimations && !prefersReducedMotion && intensity > 0;
  
  // Get theme colors
  const colors = useMemo((): ThemeColorPreset => {
    if (theme in THEME_COLOR_PRESETS) {
      return THEME_COLOR_PRESETS[theme];
    }
    return {
      primary: '#3b82f6',
      secondary: '#6366f1',
      background: '#18181b',
      accent: '#f59e0b',
    };
  }, [theme]);
  
  // Don't render for non-special themes
  const isSpecialTheme = ['cyberpunk', 'steampunk', 'gothic', 'retro', 'pixelart'].includes(theme);
  if (!isSpecialTheme) return null;
  
  return (
    <div className={cn('absolute inset-0 overflow-hidden', className)}>
      {/* Theme-specific effects */}
      {shouldAnimate && (
        <>
          {theme === 'cyberpunk' && <GlitchEffect intensity={intensity} colors={colors} />}
          {theme === 'steampunk' && <GearRotator intensity={intensity} colors={colors} />}
          {theme === 'gothic' && <CandleFlicker intensity={intensity} colors={colors} />}
          {theme === 'retro' && <ScanlineOverlay intensity={intensity} colors={colors} />}
          {theme === 'pixelart' && <PixelGrid intensity={intensity} colors={colors} />}
        </>
      )}
      
      {/* Particle system */}
      {shouldAnimate && enableParticles && (
        <ParticleSystem theme={theme} intensity={intensity} colors={colors} />
      )}
    </div>
  );
}

// ============================================
// Theme CSS Variables Hook
// ============================================

export function useThemeCSSVariables(theme: ChatboxTheme, customColors?: ChatboxAppearanceSettings['customThemeColors']) {
  return useMemo(() => {
    const preset = THEME_COLOR_PRESETS[theme];
    
    if (preset) {
      return {
        '--theme-primary': preset.primary,
        '--theme-secondary': preset.secondary,
        '--theme-background': preset.background,
        '--theme-accent': preset.accent,
      } as React.CSSProperties;
    }
    
    if (theme === 'custom' && customColors) {
      return {
        '--theme-primary': customColors.primary,
        '--theme-secondary': customColors.secondary,
        '--theme-background': customColors.background,
        '--theme-accent': customColors.accent,
      } as React.CSSProperties;
    }
    
    // Default theme colors
    const defaults: Record<string, { primary: string; secondary: string; background: string; accent: string }> = {
      default: { primary: '#3b82f6', secondary: '#6366f1', background: '#18181b', accent: '#f59e0b' },
      midnight: { primary: '#6366f1', secondary: '#8b5cf6', background: '#0f0f23', accent: '#a855f7' },
      forest: { primary: '#22c55e', secondary: '#16a34a', background: '#0a1f0a', accent: '#4ade80' },
      sunset: { primary: '#f97316', secondary: '#ef4444', background: '#1a0f0a', accent: '#fbbf24' },
      ocean: { primary: '#0ea5e9', secondary: '#06b6d4', background: '#0a1520', accent: '#38bdf8' },
      lavender: { primary: '#a855f7', secondary: '#d946ef', background: '#1a0f20', accent: '#c084fc' },
      cherry: { primary: '#ec4899', secondary: '#f43f5e', background: '#1a0a10', accent: '#f472b6' },
    };
    
    const colors = defaults[theme] || defaults.default;
    return {
      '--theme-primary': colors.primary,
      '--theme-secondary': colors.secondary,
      '--theme-background': colors.background,
      '--theme-accent': colors.accent,
    } as React.CSSProperties;
  }, [theme, customColors]);
}

// ============================================
// Theme Class Names Helper
// ============================================

export function getThemeClassNames(theme: ChatboxTheme): string {
  const baseClasses = 'transition-colors duration-300';
  
  const themeClasses: Record<string, string> = {
    cyberpunk: 'theme-cyberpunk',
    steampunk: 'theme-steampunk',
    gothic: 'theme-gothic',
    retro: 'theme-retro',
    pixelart: 'theme-pixelart',
  };
  
  return cn(baseClasses, themeClasses[theme]);
}

// ============================================
// Export theme colors helper
// ============================================

export function getThemeColors(theme: ChatboxTheme): ThemeColorPreset {
  return THEME_COLOR_PRESETS[theme] || {
    primary: '#3b82f6',
    secondary: '#6366f1',
    background: '#18181b',
    accent: '#f59e0b',
  };
}
