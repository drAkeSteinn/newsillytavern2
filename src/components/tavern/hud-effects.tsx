'use client';

/**
 * HUD Visual Effects Components
 * 
 * Provides animated visual effects for HUD elements:
 * - Value change detection and feedback
 * - Enhanced progress bars with gradients and shine
 * - Enhanced circular gauges with glow and particles
 * - SVG animated effects (ripples, sparkles, energy waves)
 * - Style-specific enhancements (neon, fantasy, retro, holographic)
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

// ============================================
// Color Configuration (for inline styles)
// ============================================

const COLOR_MAP: Record<string, { base: string; light: string; dark: string; glow: string }> = {
  red: { base: '#ef4444', light: '#f87171', dark: '#dc2626', glow: 'rgba(239, 68, 68, 0.4)' },
  green: { base: '#22c55e', light: '#4ade80', dark: '#16a34a', glow: 'rgba(34, 197, 94, 0.4)' },
  blue: { base: '#3b82f6', light: '#60a5fa', dark: '#2563eb', glow: 'rgba(59, 130, 246, 0.4)' },
  yellow: { base: '#eab308', light: '#facc15', dark: '#ca8a04', glow: 'rgba(234, 179, 8, 0.4)' },
  purple: { base: '#a855f7', light: '#c084fc', dark: '#9333ea', glow: 'rgba(168, 85, 247, 0.4)' },
  orange: { base: '#f97316', light: '#fb923c', dark: '#ea580c', glow: 'rgba(249, 115, 22, 0.4)' },
  pink: { base: '#ec4899', light: '#f472b6', dark: '#db2777', glow: 'rgba(236, 72, 153, 0.4)' },
  cyan: { base: '#06b6d4', light: '#22d3ee', dark: '#0891b2', glow: 'rgba(6, 182, 212, 0.4)' },
  default: { base: '#94a3b8', light: '#cbd5e1', dark: '#64748b', glow: 'rgba(148, 163, 184, 0.4)' },
};

const BG_COLOR_MAP: Record<string, string> = {
  red: 'rgba(239, 68, 68, 0.2)',
  green: 'rgba(34, 197, 94, 0.2)',
  blue: 'rgba(59, 130, 246, 0.2)',
  yellow: 'rgba(234, 179, 8, 0.2)',
  purple: 'rgba(168, 85, 247, 0.2)',
  orange: 'rgba(249, 115, 22, 0.2)',
  pink: 'rgba(236, 72, 153, 0.2)',
  cyan: 'rgba(6, 182, 212, 0.2)',
  default: 'rgba(148, 163, 184, 0.2)',
};

// ============================================
// Hooks
// ============================================

/**
 * Hook to detect value changes and trigger effects
 * Uses a pure state-based pattern
 */
export function useValueChange<T>(value: T): { changed: boolean; direction: 'increase' | 'decrease' | 'none'; previousValue: T | undefined } {
  const [previousValue, setPreviousValue] = useState<T | undefined>(undefined);
  const [changed, setChanged] = useState(false);
  const [direction, setDirection] = useState<'increase' | 'decrease' | 'none'>('none');
  
  // Store the current value for comparison in next render
  const currentRef = useRef<T>(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Use effect to compare and update - this runs after render
  useEffect(() => {
    const prev = currentRef.current;
    
    if (prev !== value) {
      setPreviousValue(prev);
      setChanged(true);
      
      if (typeof value === 'number' && typeof prev === 'number') {
        setDirection(value > prev ? 'increase' : 'decrease');
      } else {
        setDirection('none');
      }
      
      // Reset changed after animation
      timeoutRef.current = setTimeout(() => setChanged(false), 600);
      currentRef.current = value;
    } else {
      currentRef.current = value;
    }
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value]);

  return { changed, direction, previousValue };
}

/**
 * Hook for animated number counting
 * Uses requestAnimationFrame for smooth animations
 */
export function useAnimatedNumber(value: number, duration: number = 500): { displayValue: number; isAnimating: boolean } {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const animationRef = useRef<number>(0);
  const startValueRef = useRef<number>(value);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    const startValue = startValueRef.current;
    const endValue = value;
    const diff = endValue - startValue;

    // Skip if no meaningful change - use RAF to defer state update
    if (Math.abs(diff) < 1) {
      const rafId = requestAnimationFrame(() => {
        setDisplayValue(endValue);
      });
      startValueRef.current = endValue;
      return () => cancelAnimationFrame(rafId);
    }

    // Start animation
    startTimeRef.current = performance.now();
    startValueRef.current = endValue;
    
    // Defer setIsAnimating to next frame to avoid sync setState
    const rafId = requestAnimationFrame(() => {
      setIsAnimating(true);
    });

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out cubic)
      const eased = 1 - Math.pow(1 - progress, 3);
      
      const currentValue = startValue + diff * eased;
      
      setDisplayValue(Math.round(currentValue * 10) / 10);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        setIsAnimating(false);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration]);

  return { displayValue, isAnimating };
}

/**
 * Hook to get color configuration
 * Simply returns the configured color without threshold overrides
 */
export function useThresholdColor(percentage: number, color: string): { colorConfig: typeof COLOR_MAP.red; isCritical: boolean; isWarning: boolean } {
  return useMemo(() => {
    const isCritical = percentage <= 25;
    const isWarning = percentage <= 50;
    
    // Always use the configured color, no overrides
    return { colorConfig: COLOR_MAP[color] || COLOR_MAP.default, isCritical, isWarning };
  }, [percentage, color]);
}

// ============================================
// Value Change Effect Wrapper
// ============================================

interface ValueChangeEffectProps {
  value: number | string;
  children: React.ReactNode;
  className?: string;
  showFlash?: boolean;
  showShake?: boolean;
  shakeOnDecrease?: boolean;
}

export function ValueChangeEffect({ 
  value, 
  children, 
  className,
  showFlash = true,
  showShake = true,
  shakeOnDecrease = true,
}: ValueChangeEffectProps) {
  const { changed, direction } = useValueChange(value);
  
  return (
    <div
      className={cn(
        'relative transition-all',
        changed && showFlash && 'animate-hud-flash',
        changed && showShake && direction === 'decrease' && shakeOnDecrease && 'animate-hud-shake',
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================
// Animated Number Display
// ============================================

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  className?: string;
  decimals?: number;
  unit?: string;
}

export function AnimatedNumber({ value, duration = 400, className, decimals = 0, unit }: AnimatedNumberProps) {
  const { displayValue, isAnimating } = useAnimatedNumber(value, duration);
  
  return (
    <span className={cn(isAnimating && 'animate-number-pulse', className)}>
      {decimals > 0 ? displayValue.toFixed(decimals) : Math.round(displayValue)}
      {unit && <span className="opacity-60 ml-0.5">{unit}</span>}
    </span>
  );
}

// ============================================
// Enhanced Progress Bar
// ============================================

interface AnimatedProgressProps {
  value: number;
  min?: number;
  max?: number;
  color?: string;
  className?: string;
  height?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  label?: string;
  icon?: string;
  unit?: string;
  compact?: boolean;
  showSegments?: boolean;
  segmentCount?: number;
  animated?: boolean;
}

export function AnimatedProgress({
  value,
  min = 0,
  max = 100,
  color = 'blue',
  className,
  height = 'md',
  showValue = true,
  label,
  icon,
  unit,
  compact,
  showSegments = false,
  segmentCount = 10,
  animated = true,
}: AnimatedProgressProps) {
  const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const { changed, direction } = useValueChange(value);
  const { displayValue } = useAnimatedNumber(value, 300);
  const { colorConfig } = useThresholdColor(percentage, color);

  const heightClasses = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  return (
    <div className={cn('flex flex-col gap-1', compact && 'gap-0.5', className)}>
      {/* Label and Value */}
      {(label || showValue) && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {icon && <span className={cn('text-sm', compact && 'text-xs')}>{icon}</span>}
            {label && (
              <span className={cn('text-xs text-white/50', compact && 'text-[10px]')}>
                {label}
              </span>
            )}
          </div>
          {showValue && (
            <ValueChangeEffect value={value} showShake={direction === 'decrease'}>
              <span className={cn(
                'font-medium tabular-nums text-white/80',
                compact ? 'text-[10px]' : 'text-xs'
              )}>
                <AnimatedNumber value={displayValue} unit={unit} />
              </span>
            </ValueChangeEffect>
          )}
        </div>
      )}

      {/* Progress Bar Container */}
      <div
        className={cn(
          'relative w-full bg-white/10 rounded-full overflow-hidden',
          heightClasses[height],
          changed && animated && 'animate-bar-pulse'
        )}
        style={{ minWidth: compact ? 80 : 120 }}
      >
        {/* Segments overlay */}
        {showSegments && (
          <div className="absolute inset-0 flex gap-0.5 px-0.5">
            {Array.from({ length: segmentCount }).map((_, i) => (
              <div key={i} className="flex-1 bg-black/20 rounded-sm" />
            ))}
          </div>
        )}

        {/* Fill bar - solid color, no gradient */}
        <div
          className={cn(
            'h-full rounded-full relative overflow-hidden transition-all duration-500 ease-out'
          )}
          style={{ 
            width: `${percentage}%`,
            backgroundColor: colorConfig.base,
            boxShadow: animated ? `0 0 8px ${colorConfig.glow}` : 'none'
          }}
        >
          {/* Subtle inner highlight */}
          <div 
            className="absolute inset-0 rounded-full"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 60%)'
            }}
          />
        </div>

        {/* Ripple effect on value change */}
        {changed && animated && (
          <div 
            className="absolute top-1/2 -translate-y-1/2 rounded-full bg-white/40 animate-ripple-out pointer-events-none"
            style={{ left: `${percentage}%` }}
          />
        )}
      </div>
    </div>
  );
}

// ============================================
// Enhanced Circular Gauge
// ============================================

interface AnimatedGaugeProps {
  value: number;
  min?: number;
  max?: number;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  showValue?: boolean;
  unit?: string;
  compact?: boolean;
  animated?: boolean;
  showParticles?: boolean;
}

export function AnimatedGauge({
  value,
  min = 0,
  max = 100,
  color = 'cyan',
  size = 'md',
  label,
  showValue = true,
  unit,
  compact,
  animated = true,
  showParticles = false,
}: AnimatedGaugeProps) {
  const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const { changed, direction } = useValueChange(value);
  const { displayValue } = useAnimatedNumber(value, 400);
  const { colorConfig } = useThresholdColor(percentage, color);
  
  const sizeConfig = {
    sm: { dimensions: 'w-10 h-10', radius: 16, strokeWidth: 4, fontSize: 'text-[10px]' },
    md: { dimensions: 'w-14 h-14', radius: 24, strokeWidth: 5, fontSize: 'text-xs' },
    lg: { dimensions: 'w-20 h-20', radius: 36, strokeWidth: 6, fontSize: 'text-sm' },
  };

  const config = sizeConfig[size];
  const circumference = 2 * Math.PI * config.radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className={cn('flex items-center gap-2', compact && 'gap-1')}>
      <div className={cn('relative', config.dimensions)}>
        {/* Particle effects */}
        {showParticles && animated && (
          <GaugeParticles color={colorConfig.base} active={changed} />
        )}

        {/* SVG Gauge */}
        <svg 
          className={cn(
            'w-full h-full transform -rotate-90',
            changed && animated && 'animate-gauge-pulse'
          )}
          viewBox="0 0 64 64"
        >
          {/* Background circle with depth effect */}
          <circle 
            cx="32" 
            cy="32" 
            r={config.radius + 2} 
            fill="none" 
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={config.strokeWidth + 4}
          />
          <circle 
            cx="32" 
            cy="32" 
            r={config.radius} 
            fill="none" 
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={config.strokeWidth}
          />

          {/* Value arc with glow */}
          {animated && (
            <circle 
              cx="32" 
              cy="32" 
              r={config.radius} 
              fill="none" 
              stroke={colorConfig.base}
              strokeWidth={config.strokeWidth + 2}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="opacity-30 blur-sm transition-all duration-500"
            />
          )}

          {/* Main value arc */}
          <circle 
            cx="32" 
            cy="32" 
            r={config.radius} 
            fill="none" 
            stroke={colorConfig.base}
            strokeWidth={config.strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500"
            style={{ filter: animated ? `drop-shadow(0 0 4px ${colorConfig.base})` : 'none' }}
          />
        </svg>

        {/* Center value display */}
        <div className="absolute inset-0 flex items-center justify-center">
          <ValueChangeEffect value={value} showShake={direction === 'decrease'}>
            <span className={cn(
              'font-bold tabular-nums text-white',
              config.fontSize
            )}>
              {showValue && <AnimatedNumber value={displayValue} />}
            </span>
          </ValueChangeEffect>
        </div>

        {/* Ripple on change */}
        {changed && animated && (
          <div 
            className="absolute inset-0 rounded-full border-2 animate-ripple-expand pointer-events-none"
            style={{ borderColor: colorConfig.base }}
          />
        )}
      </div>

      {/* Label */}
      {label && (
        <div className="flex flex-col">
          <span className={cn('text-xs text-white/50', compact && 'text-[10px]')}>{label}</span>
          {unit && <span className="text-[10px] text-white/30">{unit}</span>}
        </div>
      )}
    </div>
  );
}

// ============================================
// Gauge Particles Component
// ============================================

interface GaugeParticlesProps {
  color: string;
  active: boolean;
}

function GaugeParticles({ color, active }: GaugeParticlesProps) {
  const particles = useMemo(() => 
    Array.from({ length: 8 }).map((_, i) => ({
      angle: (i / 8) * Math.PI * 2,
      delay: i * 0.1,
      size: 2 + Math.random() * 2,
    })),
  []);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {particles.map((particle, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 rounded-full animate-particle-float"
          style={{
            background: color,
            left: `calc(50% + ${Math.cos(particle.angle) * 28}px - ${particle.size / 2}px)`,
            top: `calc(50% + ${Math.sin(particle.angle) * 28}px - ${particle.size / 2}px)`,
            width: particle.size,
            height: particle.size,
            animationDelay: `${particle.delay}s`,
            opacity: active ? 0.8 : 0.3,
          }}
        />
      ))}
    </div>
  );
}

// ============================================
// SVG Animated Effects
// ============================================

/**
 * Ripple Wave Effect
 */
interface RippleEffectProps {
  active?: boolean;
  color?: string;
  size?: number;
}

export function RippleEffect({ active = false, color = '#ffffff', size = 100 }: RippleEffectProps) {
  if (!active) return null;

  return (
    <svg 
      className="absolute inset-0 pointer-events-none" 
      width={size} 
      height={size}
      viewBox={`0 0 ${size} ${size}`}
    >
      {[0, 1, 2].map((i) => (
        <circle
          key={i}
          cx={size / 2}
          cy={size / 2}
          r={size / 4}
          fill="none"
          stroke={color}
          strokeWidth={1}
          className="animate-ripple-wave"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </svg>
  );
}

/**
 * Sparkle Particles
 */
interface SparkleParticlesProps {
  count?: number;
  color?: string;
  className?: string;
}

export function SparkleParticles({ count = 5, color = '#ffffff', className }: SparkleParticlesProps) {
  const sparkles = useMemo(() => 
    Array.from({ length: count }).map(() => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 2 + Math.random() * 3,
      delay: Math.random() * 2,
      duration: 1 + Math.random() * 2,
    })),
  [count]);

  return (
    <svg className={cn('absolute inset-0 pointer-events-none overflow-visible', className)}>
      {sparkles.map((sparkle, i) => (
        <circle
          key={i}
          cx={`${sparkle.x}%`}
          cy={`${sparkle.y}%`}
          r={sparkle.size}
          fill={color}
          className="animate-sparkle"
          style={{
            animationDelay: `${sparkle.delay}s`,
            animationDuration: `${sparkle.duration}s`,
          }}
        />
      ))}
    </svg>
  );
}

/**
 * Energy Wave Pattern
 */
interface EnergyWaveProps {
  color?: string;
  opacity?: number;
  className?: string;
}

export function EnergyWave({ color = '#06b6d4', opacity = 0.3, className }: EnergyWaveProps) {
  return (
    <svg 
      className={cn('absolute inset-0 pointer-events-none w-full h-full', className)}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="energyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0" />
          <stop offset="50%" stopColor={color} stopOpacity={opacity} />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0,50 Q25,30 50,50 T100,50 V100 H0 Z"
        fill="url(#energyGradient)"
        className="animate-energy-wave"
      />
    </svg>
  );
}

/**
 * Scan Lines Effect (Retro style)
 */
interface ScanLinesProps {
  color?: string;
  opacity?: number;
  className?: string;
}

export function ScanLines({ color = '#22c55e', opacity = 0.1, className }: ScanLinesProps) {
  return (
    <div 
      className={cn(
        'absolute inset-0 pointer-events-none overflow-hidden',
        className
      )}
    >
      <div 
        className="absolute inset-0 animate-scanline-move"
        style={{
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            ${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')} 2px,
            ${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')} 4px
          )`,
        }}
      />
    </div>
  );
}

// ============================================
// Style-Specific Effect Components
// ============================================

/**
 * Neon Flicker Effect
 */
interface NeonEffectProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
}

export function NeonEffect({ children, color = '#06b6d4', className }: NeonEffectProps) {
  return (
    <div className={cn('relative', className)}>
      <div 
        className="absolute inset-0 animate-neon-flicker rounded-lg"
        style={{
          boxShadow: `
            0 0 5px ${color},
            0 0 10px ${color},
            0 0 20px ${color}40,
            inset 0 0 10px ${color}20
          `,
        }}
      />
      {children}
    </div>
  );
}

/**
 * Fantasy Magic Particles
 */
interface FantasyEffectProps {
  children: React.ReactNode;
  className?: string;
}

export function FantasyEffect({ children, className }: FantasyEffectProps) {
  return (
    <div className={cn('relative', className)}>
      {/* Rune decorations */}
      <div className="absolute -top-1 -left-1 text-amber-500/40 text-xs animate-rune-glow">
        ᚠ
      </div>
      <div className="absolute -top-1 -right-1 text-amber-500/40 text-xs animate-rune-glow" style={{ animationDelay: '0.5s' }}>
        ᚢ
      </div>
      <div className="absolute -bottom-1 -left-1 text-amber-500/40 text-xs animate-rune-glow" style={{ animationDelay: '1s' }}>
        ᚦ
      </div>
      <div className="absolute -bottom-1 -right-1 text-amber-500/40 text-xs animate-rune-glow" style={{ animationDelay: '1.5s' }}>
        ᚨ
      </div>
      
      {/* Magic particles */}
      <SparkleParticles count={3} color="#fbbf24" />
      
      {children}
    </div>
  );
}

/**
 * Retro CRT Effect
 */
interface RetroEffectProps {
  children: React.ReactNode;
  className?: string;
}

export function RetroEffect({ children, className }: RetroEffectProps) {
  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Scanlines */}
      <ScanLines color="#22c55e" opacity={0.15} />
      
      {/* CRT curve effect */}
      <div className="absolute inset-0 pointer-events-none">
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.3) 100%)',
          }}
        />
      </div>
      
      {/* Slight flicker */}
      <div className="absolute inset-0 bg-green-500/5 animate-retro-flicker pointer-events-none" />
      
      {children}
    </div>
  );
}

/**
 * Holographic Glitch Effect
 */
interface HolographicEffectProps {
  children: React.ReactNode;
  className?: string;
}

export function HolographicEffect({ children, className }: HolographicEffectProps) {
  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Chromatic aberration layers */}
      <div className="absolute inset-0 animate-chromatic-shift pointer-events-none">
        <div className="absolute inset-0 bg-red-500/10 translate-x-[-2px]" />
        <div className="absolute inset-0 bg-cyan-500/10 translate-x-[2px]" />
      </div>
      
      {/* Scan line */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-full h-1 bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent animate-holo-scan" />
      </div>
      
      {/* Color shift overlay */}
      <div className="absolute inset-0 animate-holo-color-shift pointer-events-none opacity-30" />
      
      {children}
    </div>
  );
}

// ============================================
// Combined Effect Wrapper
// ============================================

interface StyleEffectWrapperProps {
  style?: 'neon' | 'fantasy' | 'retro' | 'holographic' | 'default';
  children: React.ReactNode;
  className?: string;
}

export function StyleEffectWrapper({ style = 'default', children, className }: StyleEffectWrapperProps) {
  switch (style) {
    case 'neon':
      return <NeonEffect className={className}>{children}</NeonEffect>;
    case 'fantasy':
      return <FantasyEffect className={className}>{children}</FantasyEffect>;
    case 'retro':
      return <RetroEffect className={className}>{children}</RetroEffect>;
    case 'holographic':
      return <HolographicEffect className={className}>{children}</HolographicEffect>;
    default:
      return <div className={className}>{children}</div>;
  }
}

// ============================================
// Meter (Vertical Bar) with Effects
// ============================================

interface AnimatedMeterProps {
  value: number;
  min?: number;
  max?: number;
  color?: string;
  height?: number;
  label?: string;
  showValue?: boolean;
  unit?: string;
  compact?: boolean;
  animated?: boolean;
  className?: string;
}

export function AnimatedMeter({
  value,
  min = 0,
  max = 100,
  color = 'blue',
  height = 48,
  label,
  showValue = true,
  unit,
  compact,
  animated = true,
  className,
}: AnimatedMeterProps) {
  const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const { changed } = useValueChange(value);
  const { colorConfig } = useThresholdColor(percentage, color);

  return (
    <div className={cn('flex items-end gap-2', className)} style={{ height: compact ? height * 0.7 : height }}>
      {/* Vertical bar */}
      <div 
        className={cn(
          'relative bg-white/10 rounded-sm overflow-hidden',
          compact ? 'w-4' : 'w-6',
          changed && animated && 'animate-bar-pulse'
        )}
        style={{ height: '100%' }}
      >
        {/* Fill */}
        <div 
          className="absolute bottom-0 w-full transition-all duration-500 ease-out"
          style={{ 
            height: `${percentage}%`,
            backgroundColor: colorConfig.base,
            boxShadow: `0 0 8px ${colorConfig.glow}`
          }}
        >
          {/* Inner highlight */}
          <div 
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(90deg, rgba(255,255,255,0.1) 0%, transparent 50%)'
            }}
          />
        </div>

        {/* Tick marks */}
        <div className="absolute inset-0 flex flex-col justify-between py-1 pointer-events-none">
          {[0, 25, 50, 75, 100].map((tick) => (
            <div key={tick} className="w-full h-px bg-white/10" />
          ))}
        </div>
      </div>

      {/* Label and Value */}
      <div className="flex flex-col justify-end pb-0.5">
        {label && (
          <span className={cn('text-white/50', compact ? 'text-[8px]' : 'text-[10px]')}>
            {label}
          </span>
        )}
        {showValue && (
          <ValueChangeEffect value={value}>
            <span className={cn(
              'font-bold tabular-nums text-white/80',
              compact ? 'text-[10px]' : 'text-xs'
            )}>
              <AnimatedNumber value={value} unit={unit} />
            </span>
          </ValueChangeEffect>
        )}
      </div>
    </div>
  );
}

// ============================================
// Dots Display with Effects
// ============================================

interface AnimatedDotsProps {
  value: number;
  max?: number;
  color?: string;
  label?: string;
  icon?: string;
  compact?: boolean;
  animated?: boolean;
}

export function AnimatedDots({
  value,
  max = 5,
  color = 'blue',
  label,
  icon,
  compact,
  animated = true,
}: AnimatedDotsProps) {
  const { changed } = useValueChange(value);
  const filledDots = Math.min(max, Math.max(0, Math.round(value)));
  const colorConfig = COLOR_MAP[color] || COLOR_MAP.default;

  return (
    <div className={cn('flex items-center gap-2', compact && 'gap-1')}>
      {icon && <span className={cn('text-sm', compact && 'text-xs')}>{icon}</span>}
      {label && (
        <span className={cn('text-xs text-white/50', compact && 'text-[10px]')}>
          {label}:
        </span>
      )}
      <div className={cn('flex gap-1', changed && animated && 'animate-dots-pulse')}>
        {Array.from({ length: max }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'rounded-full transition-all duration-300',
              compact ? 'w-1.5 h-1.5' : 'w-2.5 h-2.5',
              i === filledDots - 1 && changed && animated && 'animate-dot-fill',
              i === filledDots && changed && animated && i < max && 'animate-dot-empty'
            )}
            style={{
              backgroundColor: i < filledDots ? colorConfig.base : `${colorConfig.base}33`,
              boxShadow: i < filledDots ? `0 0 6px ${colorConfig.glow}` : 'none'
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================
// Badge with Effects
// ============================================

interface AnimatedBadgeProps {
  value: string | number;
  color?: string;
  label?: string;
  icon?: string;
  compact?: boolean;
  animated?: boolean;
}

export function AnimatedBadge({
  value,
  color = 'blue',
  label,
  icon,
  compact,
  animated = true,
}: AnimatedBadgeProps) {
  const { changed } = useValueChange(value);
  const colorConfig = COLOR_MAP[color] || COLOR_MAP.default;

  return (
    <div className={cn('flex items-center gap-2', compact && 'gap-1')}>
      {icon && <span className="text-sm">{icon}</span>}
      {label && !compact && (
        <span className="text-xs text-white/50">{label}:</span>
      )}
      <span
        className={cn(
          'inline-flex items-center rounded-full border font-medium transition-all',
          compact ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1',
          changed && animated && 'animate-badge-pop'
        )}
        style={{
          backgroundColor: BG_COLOR_MAP[color] || BG_COLOR_MAP.default,
          borderColor: `${colorConfig.base}50`,
          color: colorConfig.light,
        }}
      >
        {value}
      </span>
    </div>
  );
}

// Named exports for tree-shaking
// All components and hooks are exported individually above
