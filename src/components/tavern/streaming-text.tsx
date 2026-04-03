'use client';

import { memo, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface StreamingTextProps {
  content: string;
  isStreaming: boolean;
  className?: string;
  isUser?: boolean;
}

/**
 * StreamingText - Real-time formatting during streaming
 * 
 * Features:
 * - Formatting is applied in real-time as tokens arrive
 * - Incomplete patterns (like **) are shown as plain text until completed
 * - Smooth typewriter-like appearance (tokens arrive gradually from API)
 */
export const StreamingText = memo(function StreamingText({
  content,
  isStreaming,
  className,
  isUser = false,
}: StreamingTextProps) {
  return (
    <div className={cn('whitespace-pre-wrap break-words', className)}>
      <FormattedContent content={content} isUser={isUser} isStreaming={isStreaming} />
      {isStreaming && <StreamingCursor />}
    </div>
  );
});

/**
 * FormattedContent - Parses and formats text with incomplete pattern handling
 */
const FormattedContent = memo(function FormattedContent({
  content,
  isUser,
  isStreaming,
}: {
  content: string;
  isUser: boolean;
  isStreaming: boolean;
}) {
  const elements = useMemo(() => {
    return parseAndFormat(content, isUser);
  }, [content, isUser]);

  return <>{elements}</>;
});

/**
 * Parse and format text, handling incomplete formatting patterns
 */
function parseAndFormat(text: string, isUser: boolean): React.ReactNode[] {
  if (!text) return [];
  
  const elements: React.ReactNode[] = [];
  let key = 0;
  let pos = 0;
  
  while (pos < text.length) {
    // Try to match formatting patterns starting at current position
    
    // Bold: **text**
    if (text.slice(pos, pos + 2) === '**') {
      const endIndex = text.indexOf('**', pos + 2);
      if (endIndex !== -1) {
        // Complete bold pattern
        const boldContent = text.slice(pos + 2, endIndex);
        elements.push(
          <strong key={key++} className="font-semibold">{boldContent}</strong>
        );
        pos = endIndex + 2;
        continue;
      }
      // Incomplete bold - show asterisks as-is
      elements.push(<span key={key++}>**</span>);
      pos += 2;
      continue;
    }
    
    // Italic with asterisk: *text* (single asterisk, not **)
    if (text[pos] === '*' && text[pos + 1] !== '*') {
      // Find closing single asterisk (not part of **)
      let endPos = pos + 1;
      while (endPos < text.length) {
        if (text[endPos] === '*') {
          // Check it's not part of **
          if (text[endPos + 1] !== '*' && text[endPos - 1] !== '*') {
            break;
          }
        }
        endPos++;
      }
      
      if (endPos < text.length && text[endPos] === '*') {
        // Complete italic pattern
        const italicContent = text.slice(pos + 1, endPos);
        elements.push(
          <em key={key++} className="italic text-emerald-600 dark:text-emerald-400">{italicContent}</em>
        );
        pos = endPos + 1;
        continue;
      }
      // Incomplete italic - show asterisk as-is
      elements.push(<span key={key++}>*</span>);
      pos += 1;
      continue;
    }
    
    // Italic with underscore: _text_
    if (text[pos] === '_') {
      const endIndex = text.indexOf('_', pos + 1);
      if (endIndex !== -1) {
        // Complete italic pattern
        const italicContent = text.slice(pos + 1, endIndex);
        elements.push(
          <em key={key++} className="italic text-emerald-600 dark:text-emerald-400">{italicContent}</em>
        );
        pos = endIndex + 1;
        continue;
      }
      // Incomplete - show underscore as-is
      elements.push(<span key={key++}>_</span>);
      pos += 1;
      continue;
    }
    
    // Dialogue: "text" - with styled quotes
    if (text[pos] === '"') {
      // Find closing quote
      const endIndex = text.indexOf('"', pos + 1);
      if (endIndex !== -1) {
        // Complete dialogue pattern
        const dialogueContent = text.slice(pos + 1, endIndex);
        elements.push(
          <span key={key++} className={cn(
            "font-medium",
            isUser 
              ? "text-yellow-200" 
              : "text-amber-600 dark:text-amber-400"
          )}>
            "{dialogueContent}"
          </span>
        );
        pos = endIndex + 1;
        continue;
      }
      // Incomplete dialogue - show quote as-is
      elements.push(<span key={key++}>"</span>);
      pos += 1;
      continue;
    }
    
    // Smart quotes dialogue: «text»
    if (text[pos] === '«') {
      const endIndex = text.indexOf('»', pos + 1);
      if (endIndex !== -1) {
        // Complete dialogue pattern
        const dialogueContent = text.slice(pos + 1, endIndex);
        elements.push(
          <span key={key++} className={cn(
            "font-medium",
            isUser 
              ? "text-yellow-200" 
              : "text-amber-600 dark:text-amber-400"
          )}>
            «{dialogueContent}»
          </span>
        );
        pos = endIndex + 1;
        continue;
      }
      // Incomplete - show as-is
      elements.push(<span key={key++}>«</span>);
      pos += 1;
      continue;
    }
    
    // Code: `text`
    if (text[pos] === '`') {
      const endIndex = text.indexOf('`', pos + 1);
      if (endIndex !== -1) {
        // Complete code pattern
        const codeContent = text.slice(pos + 1, endIndex);
        elements.push(
          <code key={key++} className="px-1.5 py-0.5 rounded bg-muted font-mono text-sm">
            {codeContent}
          </code>
        );
        pos = endIndex + 1;
        continue;
      }
      // Incomplete - show backtick as-is
      elements.push(<span key={key++}>`</span>);
      pos += 1;
      continue;
    }
    
    // Plain text - collect until next special character
    let plainEnd = pos + 1;
    while (plainEnd < text.length) {
      const c = text[plainEnd];
      if (c === '*' || c === '_' || c === '"' || c === '`' || c === '«') {
        break;
      }
      plainEnd++;
    }
    
    elements.push(<span key={key++}>{text.slice(pos, plainEnd)}</span>);
    pos = plainEnd;
  }
  
  return elements;
}

/**
 * Animated blinking cursor
 */
const StreamingCursor = memo(function StreamingCursor() {
  return (
    <span 
      className="inline-block w-2 h-5 bg-amber-500 dark:bg-amber-400 ml-0.5 align-middle animate-cursor-blink"
    />
  );
});
