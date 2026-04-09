// ============================================
// Dialogue Parser - Parse text into formatted segments
// ============================================

import type { 
  TextSegment, 
  TextSegmentType,
  DialogueFormatSettings,
  DEFAULT_DIALOGUE_SETTINGS 
} from '@/types';

// ============================================
// Default Format Settings
// ============================================

const DEFAULT_FORMAT: DialogueFormatSettings = {
  dialogueMarkers: { open: '"', close: '"' },
  actionMarkers: { open: '*', close: '*' },
  thoughtMarkers: { open: '(', close: ')' },
  whisperMarkers: { open: '~', close: '~' },
};

// ============================================
// Parser Configuration
// ============================================

interface ParserConfig {
  format: DialogueFormatSettings;
  parseEmotions: boolean;
  highlightActions: boolean;
}

// ============================================
// Emotion Detection
// ============================================

const EMOTION_PATTERNS: Record<string, RegExp> = {
  happy: /[😊😀😁😄😃😆😉😋😍🥰😘🤩🙂😊]|\b(joy|happy|smile[sd]?|laugh[s]?|grin[s]?|giggle[s]?|cheerful|delighted|pleased|excited)\b/gi,
  sad: /[😢😭😞😔😕🙁☹️😿]|\b(sad|cry(ing)?|tear[s]?|grief|sorrow|melanchol[y]|depressed|heartb?roken|miserable)\b/gi,
  angry: /[😠😡🤬💢😤]|\b(angry|mad|furious|rage|annoyed|irritated|frustrated|hateful)\b/gi,
  scared: /[😱😨😰😧😦🙀]|\b(scared|afraid|fear|terrified|anxious|nervous|worried|panic)\b/gi,
  surprised: /[😮😲🤯😯😵]|\b(surprised|shocked|amazed|astonished|stunned|unexpected)\b/gi,
  love: /[❤️💕💖💗💓💝💘]|\b(love|adore|cherish|devoted|romantic|passionate)\b/gi,
  thinking: /[🤔💭🧐]|\b(think|wonder|consider|ponder|contemplate|hmm|perhaps|maybe)\b/gi,
};

function detectEmotion(text: string): string | undefined {
  for (const [emotion, pattern] of Object.entries(EMOTION_PATTERNS)) {
    if (pattern.test(text)) {
      return emotion;
    }
  }
  return undefined;
}

// ============================================
// Segment Parser
// ============================================

interface MarkerDefinition {
  type: TextSegmentType;
  open: string;
  close: string;
}

function* findMarkers(
  text: string, 
  markers: MarkerDefinition[]
): Generator<{ type: TextSegmentType; start: number; end: number }> {
  const positions: Array<{ type: TextSegmentType; start: number; end: number }> = [];
  
  for (const marker of markers) {
    let pos = 0;
    while (pos < text.length) {
      const startIdx = text.indexOf(marker.open, pos);
      if (startIdx === -1) break;
      
      const endIdx = text.indexOf(marker.close, startIdx + marker.open.length);
      if (endIdx === -1) break;
      
      positions.push({
        type: marker.type,
        start: startIdx,
        end: endIdx + marker.close.length,
      });
      
      pos = endIdx + marker.close.length;
    }
  }
  
  // Sort by start position
  positions.sort((a, b) => a.start - b.start);
  
  // Filter overlapping segments (keep earlier ones)
  let lastEnd = 0;
  for (const pos of positions) {
    if (pos.start >= lastEnd) {
      yield pos;
      lastEnd = pos.end;
    }
  }
}

export function parseTextSegments(
  text: string,
  config: Partial<ParserConfig> = {}
): TextSegment[] {
  const format = config.format || DEFAULT_FORMAT;
  const parseEmotions = config.parseEmotions ?? true;
  
  const segments: TextSegment[] = [];
  
  // Define markers to look for
  const markers: MarkerDefinition[] = [
    { type: 'dialogue', open: format.dialogueMarkers.open, close: format.dialogueMarkers.close },
    { type: 'action', open: format.actionMarkers.open, close: format.actionMarkers.close },
    { type: 'thought', open: format.thoughtMarkers.open, close: format.thoughtMarkers.close },
    { type: 'whisper', open: format.whisperMarkers.open, close: format.whisperMarkers.close },
  ];
  
  // Find all marked segments
  let lastEnd = 0;
  let segmentId = 0;
  
  for (const match of findMarkers(text, markers)) {
    // Add narration before this segment
    if (match.start > lastEnd) {
      const narrationText = text.slice(lastEnd, match.start).trim();
      if (narrationText) {
        segments.push({
          id: `seg-${segmentId++}`,
          type: 'narration',
          content: narrationText,
          startIndex: lastEnd,
          endIndex: match.start,
        });
      }
    }
    
    // Add the matched segment
    const content = text.slice(
      match.start + markers.find(m => m.type === match.type)!.open.length,
      match.end - markers.find(m => m.type === match.type)!.close.length
    );
    
    const segment: TextSegment = {
      id: `seg-${segmentId++}`,
      type: match.type,
      content: content.trim(),
      startIndex: match.start,
      endIndex: match.end,
    };
    
    // Detect emotion if enabled
    if (parseEmotions) {
      const emotion = detectEmotion(content);
      if (emotion) {
        segment.metadata = { emotion };
      }
    }
    
    segments.push(segment);
    lastEnd = match.end;
  }
  
  // Add remaining narration
  if (lastEnd < text.length) {
    const narrationText = text.slice(lastEnd).trim();
    if (narrationText) {
      segments.push({
        id: `seg-${segmentId++}`,
        type: 'narration',
        content: narrationText,
        startIndex: lastEnd,
        endIndex: text.length,
      });
    }
  }
  
  // If no segments were found, treat entire text as narration
  if (segments.length === 0 && text.trim()) {
    segments.push({
      id: 'seg-0',
      type: 'narration',
      content: text.trim(),
      startIndex: 0,
      endIndex: text.length,
    });
  }
  
  return segments;
}

// ============================================
// Text Formatting Helpers
// ============================================

/**
 * Check if text is a shout (ALL CAPS or ends with !!!)
 */
export function isShout(text: string): boolean {
  const cleanText = text.replace(/[!?.,;:]+/g, '');
  return cleanText.length > 3 && 
    cleanText === cleanText.toUpperCase() && 
    /[A-Z]/.test(cleanText);
}

/**
 * Check if text is emphasis (wrapped in **)
 */
export function isEmphasis(text: string): { isEmphasis: boolean; content: string } {
  if (text.startsWith('**') && text.endsWith('**')) {
    return { isEmphasis: true, content: text.slice(2, -2) };
  }
  return { isEmphasis: false, content: text };
}

/**
 * Detect speaker name from text (for multi-character)
 */
export function detectSpeaker(text: string): string | undefined {
  // Pattern: "Name:" at start of text
  const speakerMatch = text.match(/^([^:]+):\s*/);
  if (speakerMatch) {
    return speakerMatch[1].trim();
  }
  return undefined;
}

// ============================================
// Export Index
// ============================================

export type { ParserConfig };
