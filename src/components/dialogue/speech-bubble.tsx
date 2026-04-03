'use client';

import { cn } from '@/lib/utils';
import type { 
  TextSegment, 
  SpeechBubbleStyle, 
  CharacterDialogueStyle 
} from '@/types';

// ============================================
// Speech Bubble Component
// ============================================

interface SpeechBubbleProps {
  segments: TextSegment[];
  style: SpeechBubbleStyle;
  characterStyle?: CharacterDialogueStyle;
  avatarUrl?: string;
  characterName?: string;
  isUser?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const STYLE_CONFIG: Record<SpeechBubbleStyle, {
  container: string;
  bubble: string;
  avatar: string;
}> = {
  modern: {
    container: 'flex gap-3',
    bubble: 'rounded-2xl px-4 py-3 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10',
    avatar: 'rounded-full ring-2 ring-white/20',
  },
  classic: {
    container: 'flex gap-3',
    bubble: 'rounded-xl px-4 py-3 bg-white/10 border-2 border-white/30 relative before:absolute before:-left-2 before:top-4 before:border-8 before:border-transparent before:border-r-white/30',
    avatar: 'rounded-full border-2 border-white/30',
  },
  minimal: {
    container: 'flex gap-3',
    bubble: 'rounded-lg px-4 py-3 bg-white/5 border border-white/10',
    avatar: 'rounded-full',
  },
  neon: {
    container: 'flex gap-3',
    bubble: 'rounded-xl px-4 py-3 bg-black/50 border border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.3)]',
    avatar: 'rounded-full ring-2 ring-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.3)]',
  },
  elegant: {
    container: 'flex gap-3',
    bubble: 'rounded-xl px-4 py-3 bg-gradient-to-r from-amber-500/10 to-rose-500/10 border border-amber-500/20',
    avatar: 'rounded-full ring-2 ring-amber-500/30',
  },
  dark: {
    container: 'flex gap-3',
    bubble: 'rounded-xl px-4 py-3 bg-zinc-900/80 border border-zinc-700/50',
    avatar: 'rounded-full ring-2 ring-zinc-700/50',
  },
};

export function SpeechBubble({
  segments,
  style,
  characterStyle,
  avatarUrl,
  characterName,
  isUser = false,
  className,
  children,
}: SpeechBubbleProps) {
  const config = STYLE_CONFIG[style];
  
  // Apply character style overrides
  const bubbleClasses = cn(
    config.bubble,
    characterStyle?.customClass,
    characterStyle?.bubbleColor,
    characterStyle?.fontStyle === 'italic' && 'italic',
    characterStyle?.fontStyle === 'bold' && 'font-bold',
    characterStyle?.fontSize === 'sm' && 'text-sm',
    characterStyle?.fontSize === 'lg' && 'text-lg',
    isUser && 'ml-auto flex-row-reverse',
  );
  
  const avatarClasses = cn(
    config.avatar,
    'w-10 h-10 object-cover flex-shrink-0',
  );
  
  return (
    <div className={cn(config.container, className)}>
      {avatarUrl && (
        <img 
          src={avatarUrl} 
          alt={characterName || 'Avatar'} 
          className={avatarClasses}
        />
      )}
      <div className={bubbleClasses}>
        {characterName && (
          <div className="text-xs font-medium text-muted-foreground mb-1">
            {characterName}
          </div>
        )}
        <div className="space-y-1">
          {segments.map((segment) => (
            <SegmentRenderer key={segment.id} segment={segment} />
          ))}
          {children}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Segment Renderer
// ============================================

interface SegmentRendererProps {
  segment: TextSegment;
}

function SegmentRenderer({ segment }: SegmentRendererProps) {
  const baseClasses = 'inline';
  
  switch (segment.type) {
    case 'dialogue':
      return (
        <span className={cn(baseClasses, 'text-foreground')}>
          "{segment.content}"
        </span>
      );
    case 'action':
      return (
        <span className={cn(baseClasses, 'italic text-muted-foreground')}>
          *{segment.content}*
        </span>
      );
    case 'thought':
      return (
        <span className={cn(baseClasses, 'text-muted-foreground/80 italic text-sm')}>
          ({segment.content})
        </span>
      );
    case 'whisper':
      return (
        <span className={cn(baseClasses, 'text-muted-foreground text-sm')}>
          ~{segment.content}~
        </span>
      );
    case 'emphasis':
      return (
        <span className={cn(baseClasses, 'font-bold')}>
          {segment.content}
        </span>
      );
    case 'shout':
      return (
        <span className={cn(baseClasses, 'font-bold uppercase')}>
          {segment.content}
        </span>
      );
    case 'narration':
    default:
      return (
        <span className={cn(baseClasses, 'text-foreground/90')}>
          {segment.content}
        </span>
      );
  }
}

export default SpeechBubble;
