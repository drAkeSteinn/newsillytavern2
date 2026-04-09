'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useTavernStore } from '@/store/tavern-store';
import type { BackgroundOverlay, BackgroundTransitionType } from '@/types';
import { cn } from '@/lib/utils';

// ============================================
// Transition Utilities
// ============================================

interface TransitionStyles {
  enter: string;
  enterActive: string;
  exit: string;
  exitActive: string;
}

const TRANSITION_CONFIG: Record<BackgroundTransitionType, TransitionStyles> = {
  none: {
    enter: 'opacity-100',
    enterActive: '',
    exit: 'opacity-0',
    exitActive: '',
  },
  fade: {
    enter: 'opacity-0',
    enterActive: 'transition-opacity duration-300 ease-in-out',
    exit: 'opacity-100',
    exitActive: 'transition-opacity duration-300 ease-in-out',
  },
  'slide-left': {
    enter: 'translate-x-full opacity-0',
    enterActive: 'transition-all duration-300 ease-in-out',
    exit: 'translate-x-0 opacity-100',
    exitActive: 'transition-all duration-300 ease-in-out',
  },
  'slide-right': {
    enter: '-translate-x-full opacity-0',
    enterActive: 'transition-all duration-300 ease-in-out',
    exit: 'translate-x-0 opacity-100',
    exitActive: 'transition-all duration-300 ease-in-out',
  },
  'slide-up': {
    enter: 'translate-y-full opacity-0',
    enterActive: 'transition-all duration-300 ease-in-out',
    exit: 'translate-y-0 opacity-100',
    exitActive: 'transition-all duration-300 ease-in-out',
  },
  'slide-down': {
    enter: '-translate-y-full opacity-0',
    enterActive: 'transition-all duration-300 ease-in-out',
    exit: 'translate-y-0 opacity-100',
    exitActive: 'transition-all duration-300 ease-in-out',
  },
  'zoom-in': {
    enter: 'scale-50 opacity-0',
    enterActive: 'transition-all duration-300 ease-in-out',
    exit: 'scale-100 opacity-100',
    exitActive: 'transition-all duration-300 ease-in-out',
  },
  'zoom-out': {
    enter: 'scale-150 opacity-0',
    enterActive: 'transition-all duration-300 ease-in-out',
    exit: 'scale-100 opacity-100',
    exitActive: 'transition-all duration-300 ease-in-out',
  },
  crossfade: {
    enter: 'opacity-0 scale-95',
    enterActive: 'transition-all duration-500 ease-in-out',
    exit: 'opacity-100 scale-100',
    exitActive: 'transition-all duration-500 ease-in-out',
  },
};

// ============================================
// Overlay Component
// ============================================

interface OverlayRendererProps {
  overlay: BackgroundOverlay;
}

function OverlayRenderer({ overlay }: OverlayRendererProps) {
  const { url, position, opacity, blendMode, animated, animationSpeed } = overlay;

  // Animation for animated overlays (rain, snow, etc.)
  const animationStyle = animated
    ? {
        animation: `overlayFloat ${animationSpeed ?? 1}s linear infinite`,
      }
    : {};

  // Position styles
  const positionStyles: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    opacity: opacity ?? 1,
    mixBlendMode: (blendMode as React.CSSProperties['mixBlendMode']) || 'normal',
    ...animationStyle,
  };

  // Z-index based on position
  const zIndex = position === 'back' ? 0 : position === 'fill' ? 1 : 2;

  return (
    <div
      className={cn(
        "absolute inset-0",
        position === 'fill' && "object-cover"
      )}
      style={{ 
        ...positionStyles, 
        zIndex,
      }}
    >
      {/* Back position: render as background */}
      {position === 'back' && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ 
            backgroundImage: `url(${url})`,
            opacity: opacity ?? 1,
          }}
        />
      )}
      
      {/* Front position: render as overlay */}
      {position === 'front' && (
        <img
          src={url}
          alt=""
          className="w-full h-full object-cover"
          style={{ opacity: opacity ?? 1 }}
        />
      )}
      
      {/* Fill: blend with main background */}
      {position === 'fill' && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${url})`,
            mixBlendMode: (blendMode as React.CSSProperties['mixBlendMode']) || 'overlay',
            opacity: opacity ?? 0.5,
          }}
        />
      )}
    </div>
  );
}

// ============================================
// Background Display Component
// ============================================

interface BackgroundDisplayProps {
  className?: string;
  children?: React.ReactNode;
}

export function BackgroundDisplay({ className, children }: BackgroundDisplayProps) {
  const activeBackground = useTavernStore((s) => s.activeBackground);
  const activeOverlays = useTavernStore((s) => s.activeOverlays);
  
  const [currentBg, setCurrentBg] = useState<string | null>(activeBackground);
  const [previousBg, setPreviousBg] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionType, setTransitionType] = useState<BackgroundTransitionType>('fade');
  const [transitionDuration, setTransitionDuration] = useState(500);
  
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Handle background changes with transition
  useEffect(() => {
    if (!activeBackground) return;
    
    if (activeBackground !== currentBg) {
      // Use timeout to avoid synchronous setState
      const timeoutId = setTimeout(() => {
        setPreviousBg(currentBg);
        setIsTransitioning(true);
        
        // Set new background after short delay
        const newBgTimeout = setTimeout(() => {
          setCurrentBg(activeBackground);
          
          // End transition after animation completes
          const endTimeout = setTimeout(() => {
            setIsTransitioning(false);
            setPreviousBg(null);
          }, transitionDuration);
          
          transitionTimeoutRef.current = endTimeout;
        }, 50);
        
        transitionTimeoutRef.current = newBgTimeout;
      }, 0);
      
      return () => {
        clearTimeout(timeoutId);
        if (transitionTimeoutRef.current) {
          clearTimeout(transitionTimeoutRef.current);
        }
      };
    }
  }, [activeBackground, currentBg, transitionDuration]);
  
  // Get transition styles
  const config = TRANSITION_CONFIG[transitionType];
  
  // Sort overlays by position for proper layering
  const sortedOverlays = useMemo(() => {
    if (!activeOverlays?.length) return [];
    
    return [...activeOverlays].sort((a, b) => {
      const aPos = a.position === 'back' ? 0 : a.position === 'fill' ? 1 : 2;
      const bPos = b.position === 'back' ? 0 : b.position === 'fill' ? 1 : 2;
      return aPos - bPos;
    });
  }, [activeOverlays]);

  return (
    <div className={cn("relative w-full h-full overflow-hidden", className)}>
      {/* CSS for overlay animations */}
      <style jsx global>{`
        @keyframes overlayFloat {
          0% { transform: translateY(0); }
          100% { transform: translateY(100%); }
        }
      `}</style>
      
      {/* Previous background (for transition) */}
      {previousBg && isTransitioning && (
        <div
          className={cn(
            "absolute inset-0 bg-cover bg-center",
            config.exit,
            isTransitioning && config.exitActive
          )}
          style={{ 
            backgroundImage: `url(${previousBg})`,
            zIndex: 0,
          }}
        />
      )}
      
      {/* Current background */}
      <div
        className={cn(
          "absolute inset-0 bg-cover bg-center transition-all",
          isTransitioning ? config.enter : "opacity-100 scale-100",
          isTransitioning && config.enterActive
        )}
        style={{
          backgroundImage: currentBg ? `url(${currentBg})` : undefined,
          backgroundColor: !currentBg ? 'hsl(var(--background))' : undefined,
          transitionDuration: `${transitionDuration}ms`,
          zIndex: 1,
        }}
      />
      
      {/* Overlays */}
      {sortedOverlays.map((overlay) => (
        <OverlayRenderer key={overlay.id} overlay={overlay} />
      ))}
      
      {/* Content overlay */}
      {children && (
        <div className="relative z-10 w-full h-full">
          {children}
        </div>
      )}
    </div>
  );
}

export default BackgroundDisplay;
