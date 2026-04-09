'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { TypewriterSettings } from '@/types';

// ============================================
// Typewriter Text Component
// ============================================

interface TypewriterTextProps {
  text: string;
  settings: TypewriterSettings;
  onComplete?: () => void;
  className?: string;
  isStreaming?: boolean;
}

export function TypewriterText({
  text,
  settings,
  onComplete,
  className,
  isStreaming = false,
}: TypewriterTextProps) {
  // If typewriter disabled or streaming, show full text
  if (!settings.enabled || isStreaming) {
    return <span className={className}>{text}</span>;
  }
  
  // For now, show full text directly (typewriter effect can be added via CSS animation)
  // The full typewriter effect would need a more complex implementation with requestAnimationFrame
  return (
    <span className={className}>
      {text}
      {settings.showCursor && (
        <span 
          className="inline-block ml-0.5 animate-pulse"
          style={{ 
            animationDuration: `${settings.cursorBlinkMs}ms`,
          }}
        >
          {settings.cursorChar}
        </span>
      )}
    </span>
  );
}

export default TypewriterText;
