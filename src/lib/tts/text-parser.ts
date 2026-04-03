// ============================================
// TTS Text Parser - Parse text into segments
// Separates dialogue (quotes) from narrator (asterisks)
// ============================================

import type { TextSegment } from './types';

/**
 * Parse text into segments based on quotes and asterisks
 * 
 * Examples:
 * - *Camina hacia ti* "Hola, ¿cómo estás?" 
 *   → [{ type: 'narrator', text: 'Camina hacia ti' }, { type: 'dialogue', text: 'Hola, ¿cómo estás?' }]
 * 
 * - "Buenos días" *sonríe amablemente*
 *   → [{ type: 'dialogue', text: 'Buenos días' }, { type: 'narrator', text: 'sonríe amablemente' }]
 */
export function parseTextSegments(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  
  if (!text || typeof text !== 'string') {
    return segments;
  }

  // Pattern to match:
  // 1. Double quotes content: "text" or "text"
  // 2. Asterisks content: *text*
  // Including nested quotes within asterisks and vice versa
  const pattern = /([""]([^""]*?)["""])|(\*([^*]+?)\*)/g;
  
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    // Add plain text before this match
    if (match.index > lastIndex) {
      const plainText = text.slice(lastIndex, match.index).trim();
      if (plainText) {
        segments.push({ type: 'plain', text: plainText });
      }
    }

    // Determine segment type
    if (match[1]) {
      // Double quotes match - it's dialogue
      segments.push({ type: 'dialogue', text: match[2].trim() });
    } else if (match[3]) {
      // Asterisks match - it's narrator
      segments.push({ type: 'narrator', text: match[4].trim() });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining plain text
  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex).trim();
    if (remainingText) {
      segments.push({ type: 'plain', text: remainingText });
    }
  }

  return segments;
}

/**
 * Filter segments based on TTS settings
 * Uses POSITIVE logic: what to generate (not what to ignore)
 * 
 * @param segments - Parsed text segments
 * @param options - Generation options (what to include)
 * @returns Filtered segments
 */
export function filterSegments(
  segments: TextSegment[],
  options: {
    generateDialogues?: boolean;
    generateNarrations?: boolean;
    generatePlainText?: boolean;
  }
): TextSegment[] {
  const { 
    generateDialogues = true, 
    generateNarrations = true,
    generatePlainText = true 
  } = options;

  return segments.filter(segment => {
    // Include dialogue segments if generateDialogues is true
    if (segment.type === 'dialogue') {
      return generateDialogues;
    }

    // Include narrator segments if generateNarrations is true
    if (segment.type === 'narrator') {
      return generateNarrations;
    }

    // Include plain text segments if generatePlainText is true
    if (segment.type === 'plain') {
      return generatePlainText;
    }

    return true;
  });
}

/**
 * Clean text for TTS
 * - Remove markdown formatting
 * - Clean up special characters
 * - Handle emojis (optional removal)
 */
export function cleanTextForTTS(
  text: string,
  options: {
    removeEmojis?: boolean;
    removeMarkdown?: boolean;
    customRegex?: string;
  } = {}
): string {
  let cleaned = text;

  // Remove markdown formatting
  if (options.removeMarkdown !== false) {
    // Remove bold/italic
    cleaned = cleaned.replace(/\*\*\*([^*]+)\*\*\*/g, '$1');
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
    cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');
    cleaned = cleaned.replace(/__([^_]+)__/g, '$1');
    cleaned = cleaned.replace(/_([^_]+)_/g, '$1');
    
    // Remove code blocks
    cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
    cleaned = cleaned.replace(/`([^`]+)`/g, '$1');
    
    // Remove links but keep text
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    
    // Remove headers
    cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');
    
    // Remove horizontal rules
    cleaned = cleaned.replace(/^[-*_]{3,}$/gm, '');
  }

  // Remove emojis (optional)
  if (options.removeEmojis) {
    cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}]/gu, ''); // Emoticons
    cleaned = cleaned.replace(/[\u{1F300}-\u{1F5FF}]/gu, ''); // Symbols & Pictographs
    cleaned = cleaned.replace(/[\u{1F680}-\u{1F6FF}]/gu, ''); // Transport & Map
    cleaned = cleaned.replace(/[\u{1F700}-\u{1F77F}]/gu, ''); // Alchemical Symbols
    cleaned = cleaned.replace(/[\u{1F780}-\u{1F7FF}]/gu, ''); // Geometric Shapes
    cleaned = cleaned.replace(/[\u{1F800}-\u{1F8FF}]/gu, ''); // Supplemental Arrows-C
    cleaned = cleaned.replace(/[\u{1F900}-\u{1F9FF}]/gu, ''); // Supplemental Symbols and Pictographs
    cleaned = cleaned.replace(/[\u{1FA00}-\u{1FA6F}]/gu, ''); // Chess Symbols
    cleaned = cleaned.replace(/[\u{1FA70}-\u{1FAFF}]/gu, ''); // Symbols and Pictographs Extended-A
    cleaned = cleaned.replace(/[\u{2600}-\u{26FF}]/gu, '');   // Misc symbols
    cleaned = cleaned.replace(/[\u{2700}-\u{27BF}]/gu, '');   // Dingbats
  }

  // Apply custom regex
  if (options.customRegex) {
    try {
      const regex = new RegExp(options.customRegex, 'g');
      cleaned = cleaned.replace(regex, '');
    } catch (e) {
      console.warn('[TTS] Invalid custom regex:', e);
    }
  }

  // Clean up whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Split text into chunks for TTS generation
 * Most TTS systems have a character limit (usually ~2000-4000 chars)
 */
export function splitTextForTTS(
  text: string,
  maxLength: number = 2000
): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxLength) {
      currentChunk += sentence;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Process text for TTS with all filtering options
 */
export function processTextForTTS(
  text: string,
  options: {
    generateDialogues?: boolean;
    generateNarrations?: boolean;
    generatePlainText?: boolean;
    removeEmojis?: boolean;
    removeMarkdown?: boolean;
    customRegex?: string;
    maxLength?: number;
  } = {}
): { segments: TextSegment[]; chunks: string[] } {
  // Parse text into segments
  const segments = parseTextSegments(text);
  
  // Filter segments based on options
  const filteredSegments = filterSegments(segments, {
    generateDialogues: options.generateDialogues,
    generateNarrations: options.generateNarrations,
    generatePlainText: options.generatePlainText,
  });
  
  // Clean each segment
  const cleanedSegments = filteredSegments.map(segment => ({
    ...segment,
    text: cleanTextForTTS(segment.text, {
      removeEmojis: options.removeEmojis,
      removeMarkdown: options.removeMarkdown,
      customRegex: options.customRegex,
    }),
  })).filter(segment => segment.text.length > 0);
  
  // Group segments by type for batch processing
  const dialogueTexts = cleanedSegments
    .filter(s => s.type === 'dialogue')
    .map(s => s.text);
  
  const narratorTexts = cleanedSegments
    .filter(s => s.type === 'narrator')
    .map(s => s.text);
  
  const plainTexts = cleanedSegments
    .filter(s => s.type === 'plain')
    .map(s => s.text);
  
  // Combine all texts and split into chunks
  const allTexts = [...dialogueTexts, ...narratorTexts, ...plainTexts];
  const combinedText = allTexts.join(' ');
  const chunks = splitTextForTTS(combinedText, options.maxLength);
  
  return { segments: cleanedSegments, chunks };
}

/**
 * Get text with type information for dual-voice TTS
 */
export function getTextWithType(
  text: string,
  options: {
    generateDialogues?: boolean;
    generateNarrations?: boolean;
    generatePlainText?: boolean;
  } = {}
): Array<{ text: string; type: 'dialogue' | 'narrator' | 'plain' }> {
  const segments = parseTextSegments(text);
  const filtered = filterSegments(segments, options);
  
  return filtered.map(segment => ({
    text: cleanTextForTTS(segment.text),
    type: segment.type,
  }));
}
