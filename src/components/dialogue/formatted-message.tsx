'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { parseTextSegments } from '@/lib/dialogue/dialogue-parser';
import { TypewriterText } from './typewriter-text';
import type { 
  DialogueSettings, 
  TextSegment,
  CharacterDialogueStyle,
  DEFAULT_DIALOGUE_SETTINGS 
} from '@/types';

// ============================================
// Formatted Message Component
// ============================================

interface FormattedMessageProps {
  content: string;
  settings: DialogueSettings;
  characterStyle?: CharacterDialogueStyle;
  avatarUrl?: string;
  characterName?: string;
  isUser?: boolean;
  isStreaming?: boolean;
  className?: string;
}

export function FormattedMessage({
  content,
  settings,
  characterStyle,
  avatarUrl,
  characterName,
  isUser = false,
  isStreaming = false,
  className,
}: FormattedMessageProps) {
  // Parse text into segments - always call useMemo
  const segments = useMemo(() => {
    if (!settings.enabled) return [];
    
    return parseTextSegments(content, {
      format: settings.formatting,
      parseEmotions: settings.parseEmotions,
      highlightActions: settings.highlightActions,
    });
  }, [content, settings.enabled, settings.formatting, settings.parseEmotions, settings.highlightActions]);
  
  // Animation classes based on settings - always call useMemo
  const animationClasses = useMemo(() => {
    if (!settings.enabled || !settings.animateEntry) return '';
    
    switch (settings.entryAnimation) {
      case 'fade':
        return 'animate-in fade-in duration-200';
      case 'slide':
        return 'animate-in slide-in-from-bottom-4 duration-200';
      case 'scale':
        return 'animate-in zoom-in-95 duration-200';
      default:
        return '';
    }
  }, [settings.enabled, settings.animateEntry, settings.entryAnimation]);
  
  // If dialogue system disabled, show plain text
  if (!settings.enabled) {
    return (
      <div className={cn('whitespace-pre-wrap', className)}>
        {content}
      </div>
    );
  }
  
  // Width style
  const widthStyle = {
    maxWidth: `${settings.bubbleMaxWidth}%`,
  };
  
  // Avatar size classes
  const avatarSizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };
  
  return (
    <div 
      className={cn(
        'flex gap-3',
        isUser && 'flex-row-reverse',
        animationClasses,
        className
      )}
      style={widthStyle}
    >
      {/* Avatar */}
      {settings.showCharacterAvatar && avatarUrl && settings.avatarPosition !== 'hidden' && (
        <img 
          src={avatarUrl} 
          alt={characterName || 'Avatar'} 
          className={cn(
            'rounded-full object-cover flex-shrink-0 ring-2 ring-white/10',
            avatarSizeClasses[settings.avatarSize],
            isUser && 'ring-blue-500/30',
            !isUser && 'ring-purple-500/30',
          )}
        />
      )}
      
      {/* Message Content */}
      <div className={cn(
        'flex-1 space-y-1',
        isUser && 'text-right',
      )}>
        {/* Character Name */}
        {characterName && !isUser && (
          <div className="text-xs font-medium text-muted-foreground mb-1">
            {characterName}
          </div>
        )}
        
        {/* Message Bubble */}
        <div className={cn(
          'inline-block rounded-2xl px-4 py-2.5 backdrop-blur-sm',
          isUser 
            ? settings.userBubbleColor 
            : characterStyle?.bubbleColor || settings.assistantBubbleColor,
          'border border-white/10',
        )}>
          <div className={cn(
            'text-sm leading-relaxed',
            isUser ? 'text-left' : 'text-left',
            characterStyle?.textColor,
          )}>
            {segments.length > 0 ? (
              segments.map((segment, index) => (
                <SegmentDisplay 
                  key={segment.id || index}
                  segment={segment}
                  typewriterSettings={settings.typewriter}
                  isStreaming={isStreaming}
                  highlightActions={settings.highlightActions}
                />
              ))
            ) : (
              <TypewriterText
                text={content}
                settings={settings.typewriter}
                isStreaming={isStreaming}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Segment Display Component
// ============================================

interface SegmentDisplayProps {
  segment: TextSegment;
  typewriterSettings: typeof DEFAULT_DIALOGUE_SETTINGS.typewriter;
  isStreaming: boolean;
  highlightActions: boolean;
}

function SegmentDisplay({ 
  segment, 
  typewriterSettings,
  isStreaming,
  highlightActions,
}: SegmentDisplayProps) {
  // Render based on segment type
  const renderContent = () => {
    switch (segment.type) {
      case 'dialogue':
        return (
          <span className="text-foreground font-medium">
            "<TypewriterText 
              text={segment.content}
              settings={typewriterSettings}
              isStreaming={isStreaming}
            />"
          </span>
        );
        
      case 'action':
        return (
          <span className={cn(
            'italic',
            highlightActions ? 'text-amber-400/90' : 'text-muted-foreground',
          )}>
            *<TypewriterText 
              text={segment.content}
              settings={typewriterSettings}
              isStreaming={isStreaming}
            />*
          </span>
        );
        
      case 'thought':
        return (
          <span className="text-muted-foreground/80 italic text-sm">
            (<TypewriterText 
              text={segment.content}
              settings={typewriterSettings}
              isStreaming={isStreaming}
            />)
          </span>
        );
        
      case 'whisper':
        return (
          <span className="text-muted-foreground text-sm">
            ~<TypewriterText 
              text={segment.content}
              settings={typewriterSettings}
              isStreaming={isStreaming}
            />~
          </span>
        );
        
      case 'emphasis':
        return (
          <span className="font-bold text-foreground">
            <TypewriterText 
              text={segment.content}
              settings={typewriterSettings}
              isStreaming={isStreaming}
            />
          </span>
        );
        
      case 'shout':
        return (
          <span className="font-bold uppercase text-foreground">
            <TypewriterText 
              text={segment.content}
              settings={typewriterSettings}
              isStreaming={isStreaming}
            />
          </span>
        );
        
      case 'narration':
      default:
        return (
          <span className="text-foreground/90">
            <TypewriterText 
              text={segment.content}
              settings={typewriterSettings}
              isStreaming={isStreaming}
            />
          </span>
        );
    }
  };
  
  return (
    <span className="inline">
      {segment.type !== 'narration' && ' '}
      {renderContent()}
      {segment.type !== 'narration' && ' '}
    </span>
  );
}

export default FormattedMessage;
