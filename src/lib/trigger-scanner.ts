/**
 * Trigger Scanner for detecting keywords and emotions in messages
 * Supports pipes syntax, fuzzy matching, and realtime detection
 */

import type { 
  SFXTrigger, 
  BackgroundTrigger, 
  BackgroundPack,
  EmotionTrigger,
  MessageScanResult,
  TriggerSystemSettings,
  DEFAULT_TRIGGER_SETTINGS
} from '@/types/triggers';

// ============ Utility Functions ============

/**
 * Normalize a token for matching (lowercase, remove accents)
 */
export function normalizeToken(s: string): string {
  const raw = (s ?? '').toString().trim().toLowerCase();
  if (!raw) return '';
  
  const deacc = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // remove accents

  // keep letters/numbers/space/_/-
  const kept = deacc.replace(/[^\p{L}\p{N}\s_-]/gu, '');
  
  // If we removed everything (e.g., emoji token like 💦), keep the raw token
  return kept || raw;
}

/**
 * Extract tokens from message based on scan mode
 */
export function extractTokens(
  message: string,
  settings: TriggerSystemSettings
): { pipes: string[]; plainText: string[] } {
  const pipes: string[] = [];
  const plainText: string[] = [];
  
  const { start, end } = settings.tagDelimiters;
  const pipeRegex = new RegExp(
    `${escapeRegex(start)}([^${escapeRegex(end)}]+)${escapeRegex(end)}`,
    'g'
  );
  
  // Extract pipes
  let match;
  while ((match = pipeRegex.exec(message)) !== null) {
    pipes.push(normalizeToken(match[1]));
  }
  
  // Extract plain text keywords (words without pipes)
  if (settings.scanMode === 'pipes+text') {
    const cleanText = message
      .replace(pipeRegex, ' ')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .toLowerCase();
    
    const words = cleanText.split(/\s+/).filter(w => w.length > 2);
    plainText.push(...words.map(normalizeToken));
  }
  
  return { pipes, plainText };
}

/**
 * Escape regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Calculate fuzzy match score using Levenshtein distance
 */
export function fuzzyMatch(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  
  const lenA = a.length;
  const lenB = b.length;
  
  if (Math.abs(lenA - lenB) > Math.max(lenA, lenB) * 0.5) {
    return 0;
  }
  
  // Simple similarity ratio
  const matrix: number[][] = [];
  
  for (let i = 0; i <= lenA; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= lenB; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  const distance = matrix[lenA][lenB];
  const maxLen = Math.max(lenA, lenB);
  return 1 - distance / maxLen;
}

// ============ Trigger Matching ============

/**
 * Check if a trigger matches the message tokens
 */
function triggerMatchesKeywords(
  trigger: { keywords: string[]; requirePipes: boolean; caseSensitive?: boolean },
  tokens: { pipes: string[]; plainText: string[] },
  settings: TriggerSystemSettings
): boolean {
  const keywords = trigger.keywords;
  if (!keywords.length) return false;
  
  const searchTokens = trigger.requirePipes ? tokens.pipes : [...tokens.pipes, ...tokens.plainText];
  if (!searchTokens.length) return false;
  
  for (const keyword of keywords) {
    const normalizedKeyword = trigger.caseSensitive 
      ? keyword 
      : normalizeToken(keyword);
    
    for (const token of searchTokens) {
      // Exact match
      if (token === normalizedKeyword) {
        return true;
      }
      
      // Fuzzy match
      if (settings.fuzzyEnabled) {
        const score = fuzzyMatch(token, normalizedKeyword);
        if (score >= settings.fuzzyThreshold) {
          return true;
        }
      }
    }
  }
  
  return false;
}

// ============ Scanner Class ============

export class TriggerScanner {
  private sfxTriggers: SFXTrigger[] = [];
  private backgroundTriggers: BackgroundTrigger[] = [];
  private backgroundPacks: BackgroundPack[] = [];
  private emotionTriggers: EmotionTrigger[] = [];
  private settings: TriggerSystemSettings;
  
  // Cooldown tracking
  private lastPlayedById = new Map<string, number>();
  private lastGlobalPlay = 0;
  private lastBackgroundChange = 0;

  constructor(settings?: Partial<TriggerSystemSettings>) {
    this.settings = { 
      ...DEFAULT_TRIGGER_SETTINGS,
      ...settings 
    } as TriggerSystemSettings;
  }

  /**
   * Update triggers configuration
   */
  setSFXTriggers(triggers: SFXTrigger[]): void {
    this.sfxTriggers = triggers.filter(t => t.active);
  }

  setBackgroundTriggers(triggers: BackgroundTrigger[]): void {
    this.backgroundTriggers = triggers.filter(t => t.active);
  }

  setBackgroundPacks(packs: BackgroundPack[]): void {
    this.backgroundPacks = packs.filter(p => p.active);
  }

  setEmotionTriggers(triggers: EmotionTrigger[]): void {
    this.emotionTriggers = triggers.filter(t => t.active);
  }

  updateSettings(settings: Partial<TriggerSystemSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  /**
   * Check if cooldown is ready for a trigger
   */
  isCooldownReady(triggerId: string, cooldownMs: number): boolean {
    const now = Date.now();
    const lastPlay = this.lastPlayedById.get(triggerId) ?? 0;
    
    if (cooldownMs > 0 && (now - lastPlay) < cooldownMs) {
      return false;
    }
    
    if (this.settings.globalCooldownMs > 0 && 
        (now - this.lastGlobalPlay) < this.settings.globalCooldownMs) {
      return false;
    }
    
    return true;
  }

  /**
   * Mark a trigger as played
   */
  markPlayed(triggerId: string): void {
    const now = Date.now();
    this.lastPlayedById.set(triggerId, now);
    this.lastGlobalPlay = now;
  }

  /**
   * Scan a message and return matching triggers
   */
  scanMessage(message: string): MessageScanResult {
    if (!this.settings.enabled) {
      return {
        sfxTriggers: [],
        backgroundTriggers: [],
        emotionTriggers: [],
        detectedKeywords: [],
        detectedEmotions: [],
      };
    }

    const tokens = extractTokens(message, this.settings);
    const result: MessageScanResult = {
      sfxTriggers: [],
      backgroundTriggers: [],
      emotionTriggers: [],
      detectedKeywords: [],
      detectedEmotions: [],
    };

    // Scan SFX triggers
    let sfxCount = 0;
    for (const trigger of this.sfxTriggers) {
      if (sfxCount >= this.settings.maxSoundsPerMessage) break;
      
      if (this.isCooldownReady(trigger.id, trigger.cooldownMs) &&
          triggerMatchesKeywords(trigger, tokens, this.settings)) {
        result.sfxTriggers.push(trigger);
        result.detectedKeywords.push(...trigger.keywords);
        sfxCount++;
      }
    }

    // Scan background triggers/packs
    if (this.settings.playBackgroundTriggers) {
      const now = Date.now();
      if ((now - this.lastBackgroundChange) >= this.settings.backgroundGlobalCooldownMs) {
        // Check background packs first
        for (const pack of this.backgroundPacks) {
          if (triggerMatchesKeywords(pack, tokens, this.settings)) {
            // Find matching item in pack
            const matchingItem = pack.items.find(item => {
              return triggerMatchesKeywords(
                { keywords: [item.key], requirePipes: false },
                tokens,
                this.settings
              );
            });
            
            if (matchingItem) {
              result.backgroundTriggers.push(pack);
              result.detectedKeywords.push(...pack.keywords);
              break;
            }
          }
        }
        
        // Fall back to simple background triggers
        if (result.backgroundTriggers.length === 0) {
          for (const trigger of this.backgroundTriggers) {
            if (this.isCooldownReady(trigger.id, trigger.cooldownMs) &&
                triggerMatchesKeywords(trigger, tokens, this.settings)) {
              result.backgroundTriggers.push(trigger);
              result.detectedKeywords.push(...trigger.keywords);
              break;
            }
          }
        }
      }
    }

    // Scan emotion triggers
    if (this.settings.playEmotionSounds) {
      for (const trigger of this.emotionTriggers) {
        if (triggerMatchesKeywords(trigger, tokens, this.settings)) {
          result.emotionTriggers.push(trigger);
          result.detectedEmotions.push(...trigger.keywords);
        }
      }
    }

    return result;
  }

  /**
   * Realtime scan for streaming messages
   * Returns only new triggers found since last scan
   */
  scanStreaming(
    message: string,
    previousMessage: string,
    debounceMs: number = this.settings.realtimeDebounceMs
  ): MessageScanResult {
    if (!this.settings.realtimeEnabled) {
      return {
        sfxTriggers: [],
        backgroundTriggers: [],
        emotionTriggers: [],
        detectedKeywords: [],
        detectedEmotions: [],
      };
    }

    // Get only the new portion of the message
    const newPortion = message.slice(previousMessage.length);
    if (!newPortion.trim()) {
      return {
        sfxTriggers: [],
        backgroundTriggers: [],
        emotionTriggers: [],
        detectedKeywords: [],
        detectedEmotions: [],
      };
    }

    return this.scanMessage(newPortion);
  }
}

// Export singleton instance
export const triggerScanner = new TriggerScanner();

// Default settings import
import { DEFAULT_TRIGGER_SETTINGS } from '@/types/triggers';
