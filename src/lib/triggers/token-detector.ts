// ============================================
// Token Detector - Unified Token Detection System
// ============================================
// 
// @deprecated Use KeyDetector instead. This module is kept for backward compatibility
// but will be removed in a future version. The new KeyDetector provides better
// detection with support for more formats and better streaming support.
//
// Migration guide:
// - TokenDetector.processIncremental() → KeyDetector.detectKeys()
// - DetectedToken → DetectedKey
// - Token type checking → KeyHandler.canHandle() + KeyHandler.handleKey()
//
// This module provides a unified token detection system that can be used
// by multiple trigger types (sounds, sprites, backgrounds, etc.)
//
// Key Features:
// - Single pass tokenization
// - Incremental processing for streaming
// - Consistent normalization
// - Multiple token types (pipe, word, hud, emoji)

// ============================================
// Types
// ============================================

export type TokenType = 'pipe' | 'word' | 'hud' | 'emoji';

export interface DetectedToken {
  token: string;           // Normalized token
  original: string;        // Original token (case preserved)
  type: TokenType;
  position: number;        // Character position in text
  wordPosition: number;    // Word index in text (for tracking already detected)
  metadata?: {
    hudKey?: string;       // For [key=value] format
    hudValue?: string;
  };
}

export interface TokenDetectorConfig {
  pipeDelimiters?: { start: string; end: string };
  caseSensitive?: boolean;
  normalizeAccents?: boolean;
}

// ============================================
// Normalization
// ============================================

/**
 * Normalize a token for matching
 * - Lowercase (unless caseSensitive)
 * - Remove accents (if normalizeAccents)
 * - Keep only letters, numbers, spaces, underscores, hyphens
 */
export function normalizeToken(
  text: string, 
  options: { caseSensitive?: boolean; normalizeAccents?: boolean } = {}
): string {
  const { caseSensitive = false, normalizeAccents = true } = options;
  
  let result = (text ?? '').toString().trim();
  if (!result) return '';
  
  // Lowercase if not case sensitive
  if (!caseSensitive) {
    result = result.toLowerCase();
  }
  
  // Remove accents
  if (normalizeAccents) {
    result = result
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
  
  // Keep letters, numbers, spaces, underscores, hyphens
  result = result.replace(/[^\p{L}\p{N}\s_-]/gu, '');
  
  return result.trim();
}

/**
 * Check if a token matches a keyword
 */
export function tokenMatches(
  token: DetectedToken,
  keyword: string,
  options: { caseSensitive?: boolean; requireExact?: boolean } = {}
): boolean {
  const { caseSensitive = false, requireExact = false } = options;
  
  const normalizedKeyword = normalizeToken(keyword, { caseSensitive });
  const normalizedToken = normalizeToken(token.token, { caseSensitive });
  
  if (!normalizedKeyword || !normalizedToken) return false;
  
  if (requireExact) {
    return normalizedToken === normalizedKeyword;
  }
  
  // Allow partial match (token contains keyword or vice versa)
  return normalizedToken.includes(normalizedKeyword) || 
         normalizedKeyword.includes(normalizedToken);
}

// ============================================
// Token Extraction Functions
// ============================================

/**
 * Extract pipe tokens from text (|keyword|)
 */
function extractPipeTokens(
  text: string, 
  delimiters: { start: string; end: string },
  startWordPosition: number
): DetectedToken[] {
  const tokens: DetectedToken[] = [];
  const { start, end } = delimiters;
  
  const escapedStart = start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedEnd = end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${escapedStart}([^\\n]{1,80}?)${escapedEnd}`, 'g');
  
  for (const match of text.matchAll(re)) {
    if (match[1]) {
      const original = match[1].trim();
      tokens.push({
        token: normalizeToken(original),
        original,
        type: 'pipe',
        position: match.index ?? 0,
        wordPosition: startWordPosition + tokens.length,
      });
    }
  }
  
  return tokens;
}

/**
 * Extract word tokens from text
 * Note: Allows duplicate tokens with different positions (for sound triggers)
 */
function extractWordTokens(
  text: string,
  startWordPosition: number,
  _existingTokens: Set<string> = new Set() // Kept for API compatibility, but not used
): DetectedToken[] {
  const tokens: DetectedToken[] = [];
  
  // Standard word regex: letters, numbers, underscores, hyphens (2-40 chars)
  const wordRe = /[\p{L}\p{N}_-]{2,40}/gu;
  
  // Key:value pattern regex: word:word or word=word (like sprite:ind01, mision:test, Accion=hab1, etc.)
  // This captures patterns like "sprite:ind01", "mision:rescate", "quest:test", "Accion=hab1"
  const keyValueRe = /[\p{L}\p{N}_-]{2,30}[:=][\p{L}\p{N}_-]{2,30}/gu;
  
  // Track positions to avoid duplicates
  const usedPositions = new Set<number>();
  
  // First, extract key:value patterns (higher priority)
  for (const match of text.matchAll(keyValueRe)) {
    if (match[0]) {
      const original = match[0];
      const normalized = normalizeToken(original);
      const position = match.index ?? 0;
      
      // Mark these positions as used
      for (let i = position; i < position + original.length; i++) {
        usedPositions.add(i);
      }
      
      tokens.push({
        token: normalized,
        original,
        type: 'word', // Use 'word' type for compatibility
        position,
        wordPosition: startWordPosition + tokens.length,
      });
    }
  }
  
  // Then, extract standard words (avoiding positions already used by key:value)
  for (const match of text.matchAll(wordRe)) {
    if (match[0]) {
      const position = match.index ?? 0;
      
      // Skip if this position is already part of a key:value token
      if (usedPositions.has(position)) continue;
      
      const original = match[0];
      const normalized = normalizeToken(original);
      
      tokens.push({
        token: normalized,
        original,
        type: 'word',
        position,
        wordPosition: startWordPosition + tokens.length,
      });
    }
  }
  
  return tokens;
}

/**
 * Extract HUD tokens from text
 * 
 * Detects multiple formats:
 * - [key=value] - in brackets with equals
 * - [key: value] - in brackets with colon
 * - key=value - without brackets (standalone)
 * - key: value - without brackets with colon
 * - KEY=VALUE, HP: 10, etc. - case variations
 * 
 * Also supports pipe-separated multiple values: [key=value|other]
 */
function extractHudTokens(
  text: string,
  startWordPosition: number
): DetectedToken[] {
  const tokens: DetectedToken[] = [];
  
  // Pattern 1: Inside brackets [key=value] or [key: value]
  const bracketRe = /\[([^\]]{1,400})\]/g;
  
  for (const match of text.matchAll(bracketRe)) {
    if (match[1]) {
      const inside = match[1].trim();
      const position = match.index ?? 0;
      
      // Split by | and process each part
      for (const part of inside.split('|')) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        
        const hudToken = parseHudKeyValue(trimmed, position);
        if (hudToken) {
          tokens.push({
            ...hudToken,
            wordPosition: startWordPosition + tokens.length,
          });
        }
      }
    }
  }
  
  // Pattern 2: Standalone key=value or key: value (outside brackets)
  // Must be on its own line or surrounded by whitespace to avoid false positives
  // Format: word=value or word: value (with optional spaces around separator)
  const standaloneRe = /(?:^|\n|\s)([a-zA-Z][a-zA-Z0-9_]*)\s*[:=]\s*([^\s\n\[\]]{1,100})(?=\s|\n|$)/g;
  
  for (const match of text.matchAll(standaloneRe)) {
    if (match[1] && match[2]) {
      const key = match[1].trim();
      const value = match[2].trim();
      const position = match.index ?? 0;
      
      tokens.push({
        token: normalizeToken(key),
        original: key,
        type: 'hud',
        position,
        wordPosition: startWordPosition + tokens.length,
        metadata: { hudKey: key, hudValue: value },
      });
    }
  }
  
  return tokens;
}

/**
 * Parse a HUD key=value or key: value string
 *
 * IMPORTANT: For sprite triggers, we need to preserve the full "key:value" format
 * as the token, so that triggers like "sprite:alegre" can match properly.
 * The metadata still contains the separate key and value for special handling.
 */
function parseHudKeyValue(
  text: string,
  position: number
): DetectedToken | null {
  // Try both = and : separators
  // Pattern: key=value or key: value
  const match = text.match(/^([a-zA-Z][a-zA-Z0-9_]*)\s*[:=]\s*(.+)$/);

  if (match && match[1] && match[2]) {
    const key = match[1].trim();
    const value = match[2].trim();
    // Preserve the full "key:value" format for matching (with colon replaced for normalization)
    // This allows triggers like "sprite:alegre" to match properly
    const fullKeyValue = `${key}:${value}`;

    return {
      token: normalizeToken(fullKeyValue), // Normalized: "spritealegre" (colon removed)
      original: fullKeyValue, // Original: "sprite:alegre"
      type: 'hud',
      position,
      wordPosition: 0, // Will be set by caller
      metadata: { hudKey: key, hudValue: value },
    };
  }

  // Simple token without value
  return {
    token: normalizeToken(text),
    original: text,
    type: 'hud',
    position,
    wordPosition: 0, // Will be set by caller
  };
}

/**
 * Extract emoji tokens from text
 */
function extractEmojiTokens(
  text: string,
  startWordPosition: number
): DetectedToken[] {
  const tokens: DetectedToken[] = [];
  
  try {
    const emojiRe = /\p{Extended_Pictographic}/gu;
    for (const match of text.matchAll(emojiRe)) {
      if (match[0]) {
        tokens.push({
          token: match[0],
          original: match[0],
          type: 'emoji',
          position: match.index ?? 0,
          wordPosition: startWordPosition + tokens.length,
        });
      }
    }
  } catch {
    // Older JS engines might not support Extended_Pictographic
  }
  
  return tokens;
}

// ============================================
// Token Detector Class
// ============================================

export class TokenDetector {
  private config: Required<TokenDetectorConfig>;
  private processedPositions: Map<string, number> = new Map(); // messageKey -> last processed char position
  private processedWordPositions: Map<string, Set<number>> = new Map(); // messageKey -> set of processed word positions
  private allTokens: Map<string, DetectedToken[]> = new Map(); // messageKey -> all tokens
  
  constructor(config: TokenDetectorConfig = {}) {
    this.config = {
      pipeDelimiters: config.pipeDelimiters ?? { start: '|', end: '|' },
      caseSensitive: config.caseSensitive ?? false,
      normalizeAccents: config.normalizeAccents ?? true,
    };
  }
  
  /**
   * Process text incrementally (for streaming)
   * Returns ONLY new tokens detected since last call
   */
  processIncremental(text: string, messageKey: string): DetectedToken[] {
    const lastPosition = this.processedPositions.get(messageKey) ?? 0;
    
    // Only process new text
    const newText = text.slice(lastPosition);
    if (!newText.trim()) {
      return [];
    }
    
    // Get current word position offset
    const allTokens = this.allTokens.get(messageKey) ?? [];
    const wordOffset = allTokens.length;
    
    // Extract all token types
    const pipeTokens = extractPipeTokens(newText, this.config.pipeDelimiters, wordOffset);
    const hudTokens = extractHudTokens(newText, wordOffset + pipeTokens.length);
    
    // For word tokens, remove pipe segments first
    const plainText = newText.replace(
      new RegExp(
        `${this.config.pipeDelimiters.start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\n]{1,80}?${this.config.pipeDelimiters.end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
        'g'
      ),
      ' '
    );
    
    // Extract word tokens (allow duplicates with different positions)
    const wordTokens = extractWordTokens(plainText, wordOffset + pipeTokens.length + hudTokens.length);
    const emojiTokens = extractEmojiTokens(newText, wordOffset + pipeTokens.length + hudTokens.length + wordTokens.length);
    
    // Combine all new tokens
    const newTokens = [...pipeTokens, ...hudTokens, ...wordTokens, ...emojiTokens];
    
    // Adjust positions to be relative to full text
    for (const token of newTokens) {
      token.position += lastPosition;
    }
    
    // Update state
    this.processedPositions.set(messageKey, text.length);
    this.allTokens.set(messageKey, [...allTokens, ...newTokens]);
    
    return newTokens;
  }
  
  /**
   * Process full text at once (non-streaming)
   */
  processFull(text: string, messageKey: string): DetectedToken[] {
    this.reset(messageKey);
    return this.processIncremental(text, messageKey);
  }
  
  /**
   * Get all tokens for a message
   */
  getAllTokens(messageKey: string): DetectedToken[] {
    return this.allTokens.get(messageKey) ?? [];
  }
  
  /**
   * Check if a word position has already been processed
   */
  isWordPositionProcessed(messageKey: string, wordPosition: number): boolean {
    const positions = this.processedWordPositions.get(messageKey);
    return positions?.has(wordPosition) ?? false;
  }
  
  /**
   * Mark a word position as processed
   */
  markWordPositionProcessed(messageKey: string, wordPosition: number): void {
    if (!this.processedWordPositions.has(messageKey)) {
      this.processedWordPositions.set(messageKey, new Set());
    }
    this.processedWordPositions.get(messageKey)!.add(wordPosition);
  }
  
  /**
   * Reset state for a new message
   */
  reset(messageKey: string): void {
    this.processedPositions.delete(messageKey);
    this.processedWordPositions.delete(messageKey);
    this.allTokens.delete(messageKey);
  }
  
  /**
   * Update configuration
   */
  setConfig(config: Partial<TokenDetectorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// ============================================
// Singleton Instance
// ============================================

let detectorInstance: TokenDetector | null = null;

export function getTokenDetector(config?: TokenDetectorConfig): TokenDetector {
  if (!detectorInstance) {
    detectorInstance = new TokenDetector(config);
  }
  return detectorInstance;
}

export function resetTokenDetector(): void {
  detectorInstance = null;
}
