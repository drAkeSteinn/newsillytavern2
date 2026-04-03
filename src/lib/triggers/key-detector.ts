// ============================================
// Key Detector - Unified Key Detection System
// ============================================
//
// Detects trigger keys in multiple formats during streaming:
// - [key] - Simple bracketed key
// - [key=value] - Key with value
// - [key: value] - Key with colon and value
// - |key| - Pipe delimited
// - Peticion:key, Peticion=key - Prefix format (solicitudes)
// - Solicitud:key, Solicitud=key - Prefix format
// - key:value, key=value - Standalone key-value
// - <quest:action/> - Quest XML tags
// - +stat, -stat, stat=N - Stats operators
// - plain_word - Simple word (for triggers configured as plain keywords)
//
// Features:
// - Position-based detection (prevents duplicates)
// - Order of appearance preserved
// - Works with character or word streaming
// - Immediate trigger execution
// - Single unified detector for ALL trigger types
// - Support for operators (+, -, =) in values
// - Streaming-safe key:value detection (waits for value completion)

// ============================================
// Types
// ============================================

export type KeyFormat =
  | 'bracket'        // [key] or [key=value]
  | 'pipe'           // |key|
  | 'prefix'         // Peticion:key, Solicitud=key
  | 'key_value'      // key:value, key=value
  | 'xml_tag'        // <quest:action/> or <quest:action attr="value"/>
  | 'operator'       // +value, -value, =value (for stats)
  | 'word';          // Simple word (for triggers configured as plain keywords)

export type KeyCategory = 
  | 'sound'          // Sound trigger keyword
  | 'sprite'         // Sprite trigger keyword
  | 'background'     // Background trigger keyword
  | 'solicitud'      // Peticion/Solicitud activation/completion
  | 'skill'          // Skill activation key
  | 'stats'          // Stats modification key
  | 'hud'            // HUD update key
  | 'quest'          // Quest trigger key
  | 'item'           // Item trigger key
  | 'atmosphere'     // Atmosphere/weather effect
  | 'unknown';       // Not yet classified

/**
 * Operator type for stats modifications
 */
export type ValueOperator = '+' | '-' | '=' | '*' | '/' | 'set' | 'add' | 'subtract';

/**
 * Extended value information with operator support
 */
export interface KeyValueInfo {
  raw: string;              // Raw value string
  operator: ValueOperator;  // Operator applied
  numericValue?: number;    // Parsed numeric value if applicable
  stringValue?: string;     // String value if not numeric
}

export interface DetectedKey {
  key: string;              // Normalized key (lowercase, no accents)
  original: string;         // Original key as appeared in text
  value?: string;           // Value if present (for [key=value] or key:value)
  valueInfo?: KeyValueInfo; // Parsed value with operator info
  format: KeyFormat;        // How the key appeared
  prefix?: string;          // Prefix if format is 'prefix' (Peticion, Solicitud)
  position: number;         // Character position in text
  length: number;           // Length of the full match in text
  fullMatch: string;        // The complete matched string
  
  // XML tag Specific attributes (for quest tags)
  attributes?: Record<string, string>;
  
  // Category hint (populated by classifyKey)
  category?: KeyCategory;
}

/**
 * Tracks a potentially partial key:value match that's at the end of streaming text
 */
interface PartialMatch {
  position: number;
  key: string;
  original: string;
  value: string;
  fullMatch: string;
  endPosition: number; // Position where the match ends in text
}

// ============================================
// Normalization
// ============================================

/**
 * Normalize a key for matching
 * - Lowercase
 * - Remove accents (NFD normalization)
 * - Keep only letters, numbers, underscores, hyphens
 */
export function normalizeKey(text: string): string {
  if (!text) return '';
  
  let result = text.trim().toLowerCase();
  
  // Remove accents
  result = result
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  
  // Keep only alphanumeric, underscores, hyphens
  result = result.replace(/[^a-z0-9_-]/g, '');
  
  return result;
}

/**
 * Normalize a key but preserve more characters (for values)
 */
export function normalizeValue(text: string): string {
  if (!text) return '';
  return text.trim();
}

/**
 * Check if a normalized key matches a pattern
 * Supports exact match only (no partials to avoid false positives)
 */
export function keyMatches(
  detectedKey: string,
  triggerKey: string,
  caseSensitive: boolean = false
): boolean {
  if (!detectedKey || !triggerKey) return false;
  
  if (caseSensitive) {
    return detectedKey === triggerKey;
  }
  
  return detectedKey.toLowerCase() === triggerKey.toLowerCase();
}

/**
 * Check if a detected key matches any of the trigger keys
 */
export function keyMatchesAny(
  detectedKey: string,
  triggerKeys: string[],
  caseSensitive: boolean = false
): boolean {
  return triggerKeys.some(k => keyMatches(detectedKey, k, caseSensitive));
}

/**
 * Parse a value string with potential operator prefix
 * Examples: "+10", "-5", "=100", "10" (implicit set)
 */
export function parseValueWithOperator(value: string): KeyValueInfo {
  const trimmed = value.trim();
  
  // Check for operator prefix
  const operatorMatch = trimmed.match(/^([+\-*/=])(.+)$/);
  
  if (operatorMatch) {
    const opChar = operatorMatch[1];
    const rest = operatorMatch[2].trim();
    
    const operator: ValueOperator = 
      opChar === '+' ? 'add' :
      opChar === '-' ? 'subtract' :
      opChar === '=' ? 'set' :
      opChar === '*' ? '*' :
      opChar === '/' ? '/' : 'set';
    
    const numValue = parseFloat(rest);
    
    return {
      raw: value,
      operator,
      numericValue: isNaN(numValue) ? undefined : numValue,
      stringValue: isNaN(numValue) ? rest : undefined,
    };
  }
  
  // No operator prefix - check if numeric
  const numValue = parseFloat(trimmed);
  
  return {
    raw: value,
    operator: 'set', // Default is set
    numericValue: isNaN(numValue) ? undefined : numValue,
    stringValue: isNaN(numValue) ? trimmed : undefined,
  };
}

// ============================================
// Key Detector Class
// ============================================

export class KeyDetector {
  // Track processed positions per message to avoid duplicates
  private processedPositions: Map<string, Set<number>> = new Map();
  
  // Track last processed length per message for incremental detection
  private lastProcessedLength: Map<string, number> = new Map();
  
  // All detected keys per message (for debugging)
  private allKeys: Map<string, DetectedKey[]> = new Map();
  
  // Track potentially partial key:value matches at end of streaming text
  // Key: messageKey, Value: the partial match info
  private partialMatches: Map<string, PartialMatch> = new Map();

  /**
   * Detect keys incrementally in streaming text
   * Returns only NEW keys detected since last call
   */
  detectKeys(text: string, messageKey: string): DetectedKey[] {
    const processed = this.processedPositions.get(messageKey) ?? new Set();
    const allKeys = this.allKeys.get(messageKey) ?? [];
    
    const newKeys: DetectedKey[] = [];
    
    // Pattern 1: [key] or [key=value] or [key: value]
    // Extended to capture operators in values: [hp+10], [mana-5]
    const bracketPattern = /\[([a-zA-Z][a-zA-Z0-9_-]*)(?:\s*[:=]\s*([^\]]+))?\]/g;
    
    // Pattern 2: |key|
    const pipePattern = /\|([a-zA-Z][a-zA-Z0-9_-]+)\|/g;
    
    // Pattern 3: Peticion:key, Peticion=key, Peticion: key, Solicitud:key, etc.
    const prefixPattern = /(Peticion|Solicitud)\s*[:=]?\s*([a-zA-Z][a-zA-Z0-9_-]+)/gi;
    
    // Pattern 4: key:value or key=value (standalone, must be preceded by space/start)
    // STREAMING-SAFE: Value must be followed by delimiter (space, newline, punctuation)
    // If match ends at end of text, it's potentially partial and handled separately
    const keyValuePattern = /(?:^|[\s\n])([a-zA-Z][a-zA-Z0-9_-]{1,30})\s*[:=]\s*([a-zA-Z0-9_+-][a-zA-Z0-9_+-]{0,30})(?=[\s\n\r.,;:!?)]|$)/g;
    
    // Pattern 5: Quest XML tags - <quest:activate/>, <quest:progress id="x"/>, etc.
    // Also supports: <quest:activate title="Mission" description="..."/>
    const questTagPattern = /<quest:(activate|progress|complete|fail)(?:\s+([^>]*))?\/?>/gi;
    
    // Pattern 6: Operator-prefixed values (standalone stats)
    // Examples: +10 vida, -5 mana, =100 hp (at word boundary)
    // Note: These are caught by other patterns mostly, this is for standalone
    const operatorPattern = /(?:^|[\s\n])([+\-*/=])(\d+(?:\.\d+)?)\s*([a-zA-Z][a-zA-Z0-9_-]{0,20})/g;
    
    // Process all patterns
    this.processPattern(text, bracketPattern, 'bracket', processed, newKeys, (match) => {
      const key = normalizeKey(match[1]);
      const value = match[2]?.trim() || undefined;
      return {
        key,
        original: match[1],
        value,
        valueInfo: value ? parseValueWithOperator(value) : undefined,
        category: classifyKey({ key, original: match[1], value } as DetectedKey),
      };
    });
    
    this.processPattern(text, pipePattern, 'pipe', processed, newKeys, (match) => {
      const key = normalizeKey(match[1]);
      return {
        key,
        original: match[1],
        category: classifyKey({ key, original: match[1] } as DetectedKey),
      };
    });
    
    this.processPattern(text, prefixPattern, 'prefix', processed, newKeys, (match) => {
      return {
        key: normalizeKey(match[2]),
        original: match[2],
        prefix: match[1],
        category: 'solicitud' as KeyCategory,
      };
    });
    
    // Process key:value patterns with streaming-safe logic
    this.processKeyValuePattern(text, keyValuePattern, processed, newKeys, messageKey);
    
    // Process quest XML tags
    this.processPattern(text, questTagPattern, 'xml_tag', processed, newKeys, (match) => {
      const action = match[1].toLowerCase();
      const attrs = match[2] || '';
      
      // Parse attributes
      const attributes: Record<string, string> = {};
      const attrPattern = /(\w+)="([^"]*)"/g;
      let attrMatch;
      while ((attrMatch = attrPattern.exec(attrs)) !== null) {
        attributes[attrMatch[1]] = attrMatch[2];
      }
      
      // The key is the action type, with id or title as value
      const key = `quest_${action}`;
      const value = attributes.id || attributes.title || '';
      
      return {
        key,
        original: match[0],
        value,
        attributes,
        category: 'quest' as KeyCategory,
      };
    });
    
    // Process operator patterns (standalone numeric modifications)
    this.processPattern(text, operatorPattern, 'operator', processed, newKeys, (match) => {
      const opChar = match[1];
      const numValue = parseFloat(match[2]);
      const key = normalizeKey(match[3]);
      
      const operator: ValueOperator = 
        opChar === '+' ? 'add' :
        opChar === '-' ? 'subtract' :
        opChar === '=' ? 'set' :
        opChar === '*' ? '*' :
        opChar === '/' ? '/' : 'set';
      
      return {
        key,
        original: match[3],
        value: `${opChar}${numValue}`,
        valueInfo: {
          raw: match[0].trim(),
          operator,
          numericValue: numValue,
        },
        category: 'stats' as KeyCategory,
      };
    });
    
    // Sort by position (order of appearance)
    newKeys.sort((a, b) => a.position - b.position);
    
    // Update state
    this.lastProcessedLength.set(messageKey, text.length);
    this.processedPositions.set(messageKey, processed);
    this.allKeys.set(messageKey, [...allKeys, ...newKeys]);
    
    return newKeys;
  }
  
  /**
   * Process key:value pattern with streaming-safe logic
   * 
   * CRITICAL: During streaming, if a key:value pair ends at the END of the text,
   * the value might still be incomplete. We track these as "partial matches"
   * and only confirm them when we see more content that doesn't extend them.
   */
  private processKeyValuePattern(
    text: string,
    pattern: RegExp,
    processed: Set<number>,
    results: DetectedKey[],
    messageKey: string
  ): void {
    // Reset regex lastIndex
    pattern.lastIndex = 0;
    
    // Get or clear partial match for this message
    let partialMatch = this.partialMatches.get(messageKey);
    
    // Check if the previous partial match has been extended or completed
    if (partialMatch) {
      // Check if the text still contains the partial match at the same position
      const textAtPosition = text.substring(partialMatch.position);
      
      if (textAtPosition.startsWith(partialMatch.fullMatch)) {
        // The partial match is still there, check if it's been extended
        // Look for the pattern again starting from the same position
        const extendedPattern = /([a-zA-Z][a-zA-Z0-9_-]{1,30})\s*[:=]\s*([a-zA-Z0-9_+-][a-zA-Z0-9_+-]{0,30})(?=[\s\n\r.,;:!?)]|$)/g;
        extendedPattern.lastIndex = partialMatch.position;
        
        const extendedMatch = extendedPattern.exec(text);
        
        if (extendedMatch && extendedMatch.index === partialMatch.position) {
          const newValue = extendedMatch[2];
          const newFullMatch = extendedMatch[0];
          const newEndPosition = partialMatch.position + newFullMatch.length;
          
          // Check if this new match is now complete (not at end of text)
          const isComplete = newEndPosition < text.length;
          
          if (isComplete) {
            // The value is now complete - process it
            console.log(`[KeyDetector] Partial match completed: ${partialMatch.fullMatch} → ${newFullMatch}`);
            
            // Mark positions as processed
            for (let i = partialMatch.position; i < newEndPosition; i++) {
              processed.add(i);
            }
            
            const key = normalizeKey(extendedMatch[1]);
            const value = newValue?.trim();
            
            results.push({
              key,
              original: extendedMatch[1],
              value,
              valueInfo: value ? parseValueWithOperator(value) : undefined,
              format: 'key_value',
              position: partialMatch.position,
              length: newFullMatch.length,
              fullMatch: newFullMatch,
              category: classifyKey({ key, original: extendedMatch[1], value } as DetectedKey),
            });
            
            // Clear the partial match
            this.partialMatches.delete(messageKey);
            return;
          } else if (newValue !== partialMatch.value) {
            // Value was extended but still at end of text - update partial match
            console.log(`[KeyDetector] Partial match extended: ${partialMatch.value} → ${newValue}`);
            partialMatch = {
              position: partialMatch.position,
              key: partialMatch.key,
              original: partialMatch.original,
              value: newValue,
              fullMatch: newFullMatch,
              endPosition: newEndPosition,
            };
            this.partialMatches.set(messageKey, partialMatch);
            return; // Don't process, wait for more content
          }
          // Value unchanged and still partial - wait for more
          return;
        }
      }
      
      // Partial match no longer matches at expected position (text changed?)
      // Clear it and continue with normal detection
      console.log(`[KeyDetector] Partial match invalidated: ${partialMatch.fullMatch}`);
      this.partialMatches.delete(messageKey);
    }
    
    // Normal pattern matching
    for (const match of text.matchAll(pattern)) {
      const position = match.index ?? 0;
      const fullMatch = match[0];
      const length = fullMatch.length;
      const endPosition = position + length;
      
      // Skip if this position was already processed
      let hasOverlap = false;
      for (let i = position; i < endPosition; i++) {
        if (processed.has(i)) {
          hasOverlap = true;
          break;
        }
      }
      if (hasOverlap) continue;
      
      // Check if this match is at the END of the current text
      // If so, it might be a partial match (value still being streamed)
      const isAtEndOfText = endPosition >= text.length;
      
      if (isAtEndOfText) {
        // This match ends at the end of text - it might be partial
        // Store it and wait for more content
        const key = normalizeKey(match[1]);
        const value = match[2]?.trim();
        
        console.log(`[KeyDetector] Potential partial match at end: ${fullMatch} (value: ${value})`);
        
        this.partialMatches.set(messageKey, {
          position,
          key,
          original: match[1],
          value: value || '',
          fullMatch,
          endPosition,
        });
        
        // Don't add to results yet - wait for confirmation
        continue;
      }
      
      // Match is complete (not at end of text) - process it normally
      const key = normalizeKey(match[1]);
      const value = match[2]?.trim();
      
      if (!key) continue;
      
      // Mark all positions in this match as processed
      for (let i = position; i < endPosition; i++) {
        processed.add(i);
      }
      
      // Add to results
      results.push({
        key,
        original: match[1],
        value,
        valueInfo: value ? parseValueWithOperator(value) : undefined,
        format: 'key_value',
        position,
        length,
        fullMatch,
        category: classifyKey({ key, original: match[1], value } as DetectedKey),
      });
    }
  }
  
  /**
   * Process a regex pattern and extract keys
   */
  private processPattern(
    text: string,
    pattern: RegExp,
    format: KeyFormat,
    processed: Set<number>,
    results: DetectedKey[],
    extractor: (match: RegExpMatchArray) => Partial<DetectedKey>
  ): void {
    // Reset regex lastIndex
    pattern.lastIndex = 0;
    
    for (const match of text.matchAll(pattern)) {
      const position = match.index ?? 0;
      const fullMatch = match[0];
      const length = fullMatch.length;
      
      // Skip if this position was already processed
      // Use position range to avoid overlaps
      let hasOverlap = false;
      for (let i = position; i < position + length; i++) {
        if (processed.has(i)) {
          hasOverlap = true;
          break;
        }
      }
      if (hasOverlap) continue;
      
      // Extract key data
      const extracted = extractor(match);
      if (!extracted.key) continue;
      
      // Mark all positions in this match as processed
      for (let i = position; i < position + length; i++) {
        processed.add(i);
      }
      
      // Add to results
      results.push({
        key: extracted.key,
        original: extracted.original ?? extracted.key,
        value: extracted.value,
        valueInfo: extracted.valueInfo,
        format,
        prefix: extracted.prefix,
        position,
        length,
        fullMatch,
        attributes: extracted.attributes,
        category: extracted.category,
      });
    }
  }
  
  /**
   * Detect plain word keys (for triggers configured without special format)
   * This is for backward compatibility with simple keyword triggers
   * 
   * IMPORTANT: Only matches words that are registered as trigger keywords
   */
  detectWordKeys(
    text: string, 
    messageKey: string, 
    registeredKeys: string[]
  ): DetectedKey[] {
    if (registeredKeys.length === 0) return [];
    
    const processed = this.processedPositions.get(messageKey) ?? new Set();
    const newKeys: DetectedKey[] = [];
    
    // Normalize registered keys for matching
    const normalizedRegistered = registeredKeys.map(k => normalizeKey(k)).filter(k => k);
    if (normalizedRegistered.length === 0) return [];
    
    // Build pattern from registered keys
    const escapedKeys = normalizedRegistered
      .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    
    // Word boundary pattern to match exact words
    const wordPattern = new RegExp(`\\b(${escapedKeys})\\b`, 'gi');
    
    for (const match of text.matchAll(wordPattern)) {
      const position = match.index ?? 0;
      const fullMatch = match[0];
      const length = fullMatch.length;
      
      // Skip if already processed
      let hasOverlap = false;
      for (let i = position; i < position + length; i++) {
        if (processed.has(i)) {
          hasOverlap = true;
          break;
        }
      }
      if (hasOverlap) continue;
      
      // Mark positions as processed
      for (let i = position; i < position + length; i++) {
        processed.add(i);
      }
      
      const key = normalizeKey(match[1]);
      newKeys.push({
        key,
        original: match[1],
        format: 'word',
        position,
        length,
        fullMatch,
        category: classifyKey({ key, original: match[1] } as DetectedKey),
      });
    }
    
    this.processedPositions.set(messageKey, processed);
    
    return newKeys;
  }
  
  /**
   * Detect keys with batch registration (optimized for multiple key sets)
   * Each handler can register its keys and get matches in one call
   */
  detectRegisteredKeys(
    text: string,
    messageKey: string,
    keySets: Array<{
      keys: string[];
      caseSensitive?: boolean;
      requireValue?: boolean;
      category?: KeyCategory;
    }>
  ): Map<string, DetectedKey[]> {
    const results = new Map<string, DetectedKey[]>();
    
    for (const keySet of keySets) {
      const matches = this.detectWordKeys(text, messageKey, keySet.keys);
      
      // Filter by requirements if needed
      const filtered = matches.filter(key => {
        if (keySet.requireValue && !key.value) return false;
        return true;
      });
      
      if (filtered.length > 0) {
        const categoryKey = keySet.category || 'unknown';
        results.set(categoryKey, filtered);
      }
    }
    
    return results;
  }
  
  /**
   * Get all detected keys for a message
   */
  getAllKeys(messageKey: string): DetectedKey[] {
    return this.allKeys.get(messageKey) ?? [];
  }
  
  /**
   * Check if a position has been processed
   */
  isProcessed(messageKey: string, position: number): boolean {
    const processed = this.processedPositions.get(messageKey);
    return processed?.has(position) ?? false;
  }
  
  /**
   * Mark a position range as processed (for external use)
   */
  markProcessed(messageKey: string, position: number, length: number): void {
    const processed = this.processedPositions.get(messageKey) ?? new Set();
    for (let i = position; i < position + length; i++) {
      processed.add(i);
    }
    this.processedPositions.set(messageKey, processed);
  }
  
  /**
   * Force complete any pending partial match (call when streaming ends)
   */
  completePartialMatch(messageKey: string): DetectedKey | null {
    const partialMatch = this.partialMatches.get(messageKey);
    if (!partialMatch) return null;
    
    const processed = this.processedPositions.get(messageKey) ?? new Set();
    
    // Check if positions are already processed
    let hasOverlap = false;
    for (let i = partialMatch.position; i < partialMatch.endPosition; i++) {
      if (processed.has(i)) {
        hasOverlap = true;
        break;
      }
    }
    
    if (hasOverlap) {
      this.partialMatches.delete(messageKey);
      return null;
    }
    
    // Mark positions as processed
    for (let i = partialMatch.position; i < partialMatch.endPosition; i++) {
      processed.add(i);
    }
    
    this.processedPositions.set(messageKey, processed);
    this.partialMatches.delete(messageKey);
    
    console.log(`[KeyDetector] Force completing partial match: ${partialMatch.fullMatch}`);
    
    return {
      key: partialMatch.key,
      original: partialMatch.original,
      value: partialMatch.value,
      valueInfo: parseValueWithOperator(partialMatch.value),
      format: 'key_value',
      position: partialMatch.position,
      length: partialMatch.fullMatch.length,
      fullMatch: partialMatch.fullMatch,
      category: classifyKey({ 
        key: partialMatch.key, 
        original: partialMatch.original, 
        value: partialMatch.value 
      } as DetectedKey),
    };
  }
  
  /**
   * Reset state for a new message
   */
  reset(messageKey: string): void {
    this.processedPositions.delete(messageKey);
    this.lastProcessedLength.delete(messageKey);
    this.allKeys.delete(messageKey);
    this.partialMatches.delete(messageKey);
  }
  
  /**
   * Clear all state
   */
  clearAll(): void {
    this.processedPositions.clear();
    this.lastProcessedLength.clear();
    this.allKeys.clear();
    this.partialMatches.clear();
  }
}

// ============================================
// Singleton Instance
// ============================================

let detectorInstance: KeyDetector | null = null;

export function getKeyDetector(): KeyDetector {
  if (!detectorInstance) {
    detectorInstance = new KeyDetector();
  }
  return detectorInstance;
}

export function resetKeyDetector(): void {
  detectorInstance = null;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Classify a detected key into a category based on its format and content
 * This is a hint - handlers should do their own classification
 */
export function classifyKey(key: DetectedKey): KeyCategory {
  // If already classified, return it
  if (key.category) return key.category;
  
  // XML tag format is always quest
  if (key.format === 'xml_tag') {
    return 'quest';
  }
  
  // Operator format is always stats
  if (key.format === 'operator') {
    return 'stats';
  }
  
  // Prefix-based classification
  if (key.format === 'prefix') {
    if (key.prefix?.toLowerCase() === 'peticion' || key.prefix?.toLowerCase() === 'solicitud') {
      return 'solicitud';
    }
  }
  
  // Value-based hints (if key has a value)
  if (key.value) {
    const valueLower = key.value.toLowerCase();
    if (valueLower.includes('sprite') || valueLower.includes('expresion')) {
      return 'sprite';
    }
    if (valueLower.includes('sound') || valueLower.includes('sonido')) {
      return 'sound';
    }
    if (valueLower.includes('bg') || valueLower.includes('background') || valueLower.includes('fondo')) {
      return 'background';
    }
    if (valueLower.includes('item') || valueLower.includes('objeto')) {
      return 'item';
    }
    if (valueLower.includes('atmosphere') || valueLower.includes('weather') || valueLower.includes('clima')) {
      return 'atmosphere';
    }
  }
  
  // Key name hints
  const keyLower = key.key.toLowerCase();
  
  // Direct key name matches (for key:value format like sprite:alegre, sound:laugh)
  if (keyLower === 'sprite' || keyLower === 'expresion' || keyLower === 'expression') {
    return 'sprite';
  }
  if (keyLower === 'sound' || keyLower === 'sonido' || keyLower === 'sfx') {
    return 'sound';
  }
  if (keyLower === 'bg' || keyLower === 'background' || keyLower === 'fondo') {
    return 'background';
  }
  if (keyLower === 'item' || keyLower === 'objeto') {
    return 'item';
  }
  if (keyLower === 'atmosphere' || keyLower === 'weather' || keyLower === 'clima') {
    return 'atmosphere';
  }
  if (keyLower === 'hud' || keyLower === 'ui') {
    return 'hud';
  }
  
  // Solicitud patterns
  if (keyLower.startsWith('pedir_') || keyLower.startsWith('solicitar_') || 
      keyLower.startsWith('peticion_') || keyLower.startsWith('solicitud_')) {
    return 'solicitud';
  }
  
  // Quest patterns
  if (keyLower.startsWith('quest_') || keyLower.startsWith('mision_') || 
      keyLower.startsWith('objetivo_') || keyLower.startsWith('mission_')) {
    return 'quest';
  }
  
  // Skill patterns
  if (keyLower.startsWith('skill_') || keyLower.startsWith('habilidad_') || 
      keyLower.startsWith('accion_') || keyLower.startsWith('action_') ||
      keyLower.startsWith('hab') || keyLower.match(/^hab\d/)) {
    return 'skill';
  }
  
  // Stats patterns
  if (keyLower.startsWith('stat_') || keyLower.startsWith('atributo_') ||
      keyLower === 'hp' || keyLower === 'mp' || keyLower === 'vida' ||
      keyLower === 'mana' || keyLower === 'stamina' || keyLower === 'energy' ||
      keyLower.match(/^(hp|mp|sp|exp)$/)) {
    return 'stats';
  }
  
  // Item patterns
  if (keyLower.startsWith('item_') || keyLower.startsWith('objeto_') ||
      keyLower.startsWith('get_') || keyLower.startsWith('lose_')) {
    return 'item';
  }
  
  // Background patterns
  if (keyLower.startsWith('bg_') || keyLower.startsWith('fondo_') ||
      keyLower.startsWith('background_') || keyLower.startsWith('scene_')) {
    return 'background';
  }
  
  // Sound patterns
  if (keyLower.startsWith('sound_') || keyLower.startsWith('sonido_') ||
      keyLower.startsWith('sfx_') || keyLower.startsWith('audio_')) {
    return 'sound';
  }
  
  // Sprite patterns
  if (keyLower.startsWith('sprite_') || keyLower.startsWith('expresion_') ||
      keyLower.startsWith('emotion_') || keyLower.startsWith('face_')) {
    return 'sprite';
  }
  
  // HUD patterns
  if (keyLower.startsWith('hud_') || keyLower.startsWith('ui_')) {
    return 'hud';
  }
  
  // Atmosphere patterns
  if (keyLower.startsWith('atmosphere_') || keyLower.startsWith('weather_') ||
      keyLower.startsWith('clima_') || keyLower.startsWith('ambiente_')) {
    return 'atmosphere';
  }
  
  return 'unknown';
}

/**
 * Check if a key should be processed by a specific handler type
 */
export function isKeyForHandler(key: DetectedKey, handlerType: KeyCategory): boolean {
  const category = classifyKey(key);
  return category === handlerType || category === 'unknown';
}
