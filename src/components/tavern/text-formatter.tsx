'use client';

import { memo, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useTavernStore } from '@/store/tavern-store';
import { DEFAULT_TYPOGRAPHY_SETTINGS, DEFAULT_CONTENT_STYLE_SETTINGS, type ChatboxAppearanceSettings } from '@/types';

interface TextFormatterProps {
  content: string;
  className?: string;
  isUser?: boolean;
  appearance?: ChatboxAppearanceSettings;
}

/**
 * Formats text in SillyTavern style:
 * - *text* or _text_ = italic (actions/narration)
 * - "text" = dialogue (different color)
 * - (text) = thought
 * - ~text~ = whisper
 * - **text** = bold
 * - ***text*** = bold italic
 * - `text` = code
 * - Emojis are rendered naturally
 */
export const TextFormatter = memo(function TextFormatter({
  content,
  className,
  isUser = false,
  appearance
}: TextFormatterProps) {
  const { dialogueSettings } = useTavernStore();

  // Get typography settings
  const typography = dialogueSettings.typography ?? DEFAULT_TYPOGRAPHY_SETTINGS;
  const contentStyles = dialogueSettings.contentStyles ?? DEFAULT_CONTENT_STYLE_SETTINGS;

  // Get link and code colors from appearance settings if provided
  const linkColor = appearance?.textColors?.linkColor;
  const codeColor = appearance?.textColors?.codeColor;

  // Build typography classes
  const typographyClasses = useMemo(() => {
    const classes: string[] = [];

    // Font family
    if (typography.fontFamily === 'serif') classes.push('font-serif');
    else if (typography.fontFamily === 'sans') classes.push('font-sans');
    else if (typography.fontFamily === 'mono') classes.push('font-mono');
    // 'system' uses default

    // Font size
    classes.push(`text-${typography.fontSize}`);

    // Font weight
    if (typography.fontWeight === 'medium') classes.push('font-medium');
    else if (typography.fontWeight === 'semibold') classes.push('font-semibold');
    else if (typography.fontWeight === 'bold') classes.push('font-bold');

    // Line height
    classes.push(`leading-${typography.lineHeight}`);

    // Letter spacing
    classes.push(`tracking-${typography.letterSpacing}`);

    return classes;
  }, [typography]);

  // Build custom font style
  const customFontStyle = useMemo(() => {
    if (typography.fontFamily === 'custom' && typography.customFontFamily) {
      return { fontFamily: typography.customFontFamily };
    }
    return undefined;
  }, [typography]);

  const formattedContent = useMemo(() => {
    return parseSillyTavernFormat(content, isUser, contentStyles, dialogueSettings.enabled, codeColor, linkColor);
  }, [content, isUser, contentStyles, dialogueSettings.enabled, codeColor, linkColor]);

  return (
    <div
      className={cn(
        'whitespace-pre-wrap break-words',
        className,
        ...typographyClasses
      )}
      style={customFontStyle}
    >
      {formattedContent}
    </div>
  );
});

/**
 * Helper to build style classes from content style settings
 */
function buildStyleClasses(
  style: typeof DEFAULT_CONTENT_STYLE_SETTINGS['dialogue'],
  type: 'dialogue' | 'action' | 'thought' | 'whisper' | 'narration'
): string {
  const classes: string[] = [];

  // Color
  classes.push(style.color);

  // Font weight
  if (style.fontWeight === 'medium') classes.push('font-medium');
  else if (style.fontWeight === 'semibold') classes.push('font-semibold');
  else if (style.fontWeight === 'bold') classes.push('font-bold');

  // Font style
  if ('fontStyle' in style && style.fontStyle === 'italic') {
    classes.push('italic');
  }

  // Text decoration
  if ('textDecoration' in style && style.textDecoration === 'underline') {
    classes.push('underline');
  }

  return classes.join(' ');
}

function parseSillyTavernFormat(
  text: string,
  isUser: boolean,
  contentStyles: typeof DEFAULT_CONTENT_STYLE_SETTINGS,
  dialogueEnabled: boolean,
  codeColor?: string,
  linkColor?: string
): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let key = 0;

  // Combined regex for all patterns
  // Order matters: bold-italic first, then bold, then italic, then others
  const combinedRegex = /(\*\*\*.+?\*\*\*)|(\*\*.+?\*\*)|(\*.+?\*)|(_.+?_)|(["«][^"»]+["»])|(\([^)]+\))|(~[^~]+~)|(`[^`]+`)/g;

  let lastIndex = 0;
  let match;

  // Reset regex
  combinedRegex.lastIndex = 0;

  while ((match = combinedRegex.exec(text)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      elements.push(
        <span key={key++} className={dialogueEnabled ? buildStyleClasses(contentStyles.narration, 'narration') : ''}>
          {text.slice(lastIndex, match.index)}
        </span>
      );
    }

    const matchedText = match[0];

    // Determine type and extract content
    if (match[1]) {
      // Bold italic ***text***
      elements.push(
        <strong key={key++} className="italic font-bold">
          {matchedText.slice(3, -3)}
        </strong>
      );
    } else if (match[2]) {
      // Bold **text**
      elements.push(
        <strong key={key++} className="font-bold">
          {matchedText.slice(2, -2)}
        </strong>
      );
    } else if (match[3] || match[4]) {
      // Italic *text* or _text_ - treated as actions
      const innerText = matchedText.slice(1, -1);
      if (dialogueEnabled) {
        const styleClasses = buildStyleClasses(contentStyles.action, 'action');
        elements.push(
          <em key={key++} className={cn("italic", styleClasses)}>
            {innerText}
          </em>
        );
      } else {
        elements.push(
          <em key={key++} className="italic text-emerald-600 dark:text-emerald-400">
            {innerText}
          </em>
        );
      }
    } else if (match[5]) {
      // Dialogue "text"
      const dialogueText = matchedText.slice(1, -1);
      if (dialogueEnabled) {
        const styleClasses = buildStyleClasses(contentStyles.dialogue, 'dialogue');
        elements.push(
          <span key={key++} className={styleClasses}>
            "{dialogueText}"
          </span>
        );
      } else {
        elements.push(
          <span key={key++} className={cn(
            "font-medium",
            isUser
              ? "text-yellow-200"
              : "text-amber-600 dark:text-amber-400"
          )}>
            "{dialogueText}"
          </span>
        );
      }
    } else if (match[6]) {
      // Thought (text)
      const thoughtText = matchedText.slice(1, -1);
      if (dialogueEnabled) {
        const styleClasses = buildStyleClasses(contentStyles.thought, 'thought');
        elements.push(
          <span key={key++} className={styleClasses}>
            ({thoughtText})
          </span>
        );
      } else {
        elements.push(
          <span key={key++} className="italic text-blue-600 dark:text-blue-400">
            ({thoughtText})
          </span>
        );
      }
    } else if (match[7]) {
      // Whisper ~text~
      const whisperText = matchedText.slice(1, -1);
      if (dialogueEnabled) {
        const styleClasses = buildStyleClasses(contentStyles.whisper, 'whisper');
        const opacity = contentStyles.whisper.opacity / 100;
        elements.push(
          <span key={key++} className={styleClasses} style={{ opacity }}>
            ~{whisperText}~
          </span>
        );
      } else {
        elements.push(
          <span key={key++} className="italic text-muted-foreground opacity-80">
            ~{whisperText}~
          </span>
        );
      }
    } else if (match[8]) {
      // Code `text`
      elements.push(
        <code 
          key={key++} 
          className="px-1.5 py-0.5 rounded bg-muted font-mono text-sm"
          style={codeColor ? { color: codeColor } : undefined}
        >
          {matchedText.slice(1, -1)}
        </code>
      );
    }

    lastIndex = match.index + matchedText.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex);
    if (dialogueEnabled) {
      elements.push(
        <span key={key++} className={buildStyleClasses(contentStyles.narration, 'narration')}>
          {remainingText}
        </span>
      );
    } else {
      elements.push(
        <span key={key++}>{remainingText}</span>
      );
    }
  }

  return elements.length > 0 ? elements : [<span key={0}>{text}</span>];
}

/**
 * Alternative parser using a state machine approach for more complex formatting
 */
export function parseMessageContent(content: string, isUser: boolean = false): React.ReactNode {
  // Handle multiline content
  const lines = content.split('\n');

  return lines.map((line, index) => (
    <span key={index}>
      <TextFormatter content={line} isUser={isUser} />
      {index < lines.length - 1 && <br />}
    </span>
  ));
}
