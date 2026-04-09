// ============================================
// Lorebook Scanner - Keyword scanning for lorebook entries
// ============================================

import type { Lorebook, LorebookEntry, LorebookSettings, ChatMessage } from '@/types';

/**
 * Result of a lorebook scan
 */
export interface LorebookScanResult {
  entry: LorebookEntry;
  lorebookId: string;
  lorebookName: string;
  matchedKeys: string[];
  matchType: 'primary' | 'secondary' | 'constant';
}

/**
 * Options for scanning
 */
export interface ScanOptions {
  scanDepth?: number;           // Number of messages to scan back
  caseSensitive?: boolean;      // Case sensitive matching
  matchWholeWords?: boolean;    // Match whole words only
  includeConstants?: boolean;   // Include constant entries
}

/**
 * Default scan options
 */
export const DEFAULT_SCAN_OPTIONS: ScanOptions = {
  scanDepth: 5,
  caseSensitive: false,
  matchWholeWords: false,
  includeConstants: true,
};

// ============================================
// REGEX SUPPORT
// ============================================

/**
 * Check if a key is a regex pattern
 * Regex keys start with '/' and end with '/' optionally followed by flags
 * Examples: /pattern/, /pattern/i, /pattern/gi
 */
export function isRegexKey(key: string): boolean {
  // Must start with / and have at least /x/ format
  if (!key.startsWith('/')) return false;
  
  // Find the closing /
  // The pattern is: /body/flags
  // We need to find the last / that's followed only by valid flags
  const lastSlashIndex = key.lastIndexOf('/');
  
  // Must have at least one character between slashes: /x/
  if (lastSlashIndex <= 1) return false;
  
  // Everything after the last / should be valid flags (only g, i, m, s, u, etc.)
  const flags = key.slice(lastSlashIndex + 1);
  const validFlags = /^[gimsuvy]*$/;
  
  return validFlags.test(flags);
}

/**
 * Parse a regex key into RegExp object
 * @param key - The regex key string (e.g., "/pattern/i")
 * @returns RegExp object or null if invalid
 */
export function parseRegexKey(key: string): RegExp | null {
  if (!isRegexKey(key)) return null;
  
  try {
    // Extract pattern and flags
    const lastSlashIndex = key.lastIndexOf('/');
    const pattern = key.slice(1, lastSlashIndex);
    const flags = key.slice(lastSlashIndex + 1);
    
    return new RegExp(pattern, flags);
  } catch {
    // Invalid regex pattern
    console.warn(`Invalid regex key: ${key}`);
    return null;
  }
}

/**
 * Check if a regex key matches content
 */
function checkRegexMatch(regex: RegExp, content: string): boolean {
  try {
    // Reset regex state (for global flag)
    regex.lastIndex = 0;
    return regex.test(content);
  } catch {
    return false;
  }
}

// ============================================
// SCANNING FUNCTIONS
// ============================================

/**
 * Scan messages for lorebook entries
 * @param messages Chat messages to scan
 * @param lorebooks Active lorebooks to check
 * @param options Scan options
 * @returns Array of scan results with matched entries
 */
export function scanForLorebookEntries(
  messages: ChatMessage[],
  lorebooks: Lorebook[],
  options: ScanOptions = {}
): LorebookScanResult[] {
  const opts = { ...DEFAULT_SCAN_OPTIONS, ...options };
  const results: LorebookScanResult[] = [];
  const processedEntries = new Set<string>(); // Avoid duplicates

  // Get visible messages up to scan depth
  const visibleMessages = messages
    .filter(m => !m.isDeleted)
    .slice(-opts.scanDepth!);

  // Combine message content for scanning
  const messageContent = visibleMessages
    .map(m => m.content)
    .join('\n');

  // Also scan the last user message separately for better matching
  const lastUserMessage = visibleMessages
    .filter(m => m.role === 'user')
    .pop()?.content || '';

  for (const lorebook of lorebooks) {
    if (!lorebook.active) continue;

    // Get settings from lorebook or use defaults
    const settings = lorebook.settings;
    const effectiveCaseSensitive = opts.caseSensitive ?? settings.caseSensitive;
    const effectiveMatchWholeWords = opts.matchWholeWords ?? settings.matchWholeWords;

    for (const entry of lorebook.entries) {
      // Skip disabled entries
      if (entry.disable) continue;

      // Skip if already processed
      const entryKey = `${lorebook.id}:${entry.uid}`;
      if (processedEntries.has(entryKey)) continue;

      // Handle constant entries
      if (entry.constant && opts.includeConstants) {
        processedEntries.add(entryKey);
        results.push({
          entry,
          lorebookId: lorebook.id,
          lorebookName: lorebook.name,
          matchedKeys: ['[constant]'],
          matchType: 'constant'
        });
        continue;
      }

      // Check primary keys
      const primaryMatch = checkKeyMatch(
        entry.key,
        messageContent,
        lastUserMessage,
        effectiveCaseSensitive,
        effectiveMatchWholeWords,
        entry.selectLogic ?? 0
      );

      if (primaryMatch.matched) {
        // If using secondary keys, check those too
        if (entry.selective && entry.keysecondary.length > 0) {
          const secondaryMatch = checkKeyMatch(
            entry.keysecondary,
            messageContent,
            lastUserMessage,
            effectiveCaseSensitive,
            effectiveMatchWholeWords,
            0 // AND_ANY for secondary
          );

          if (secondaryMatch.matched) {
            processedEntries.add(entryKey);
            results.push({
              entry,
              lorebookId: lorebook.id,
              lorebookName: lorebook.name,
              matchedKeys: [...primaryMatch.keys, ...secondaryMatch.keys],
              matchType: 'secondary'
            });
          }
        } else {
          processedEntries.add(entryKey);
          results.push({
            entry,
            lorebookId: lorebook.id,
            lorebookName: lorebook.name,
            matchedKeys: primaryMatch.keys,
            matchType: 'primary'
          });
        }
      }
    }
  }

  // Sort by order (higher = later in prompt)
  return results.sort((a, b) => a.entry.order - b.entry.order);
}

/**
 * Check if keys match in content
 * Supports both plain text and regex keys
 */
function checkKeyMatch(
  keys: string[],
  content: string,
  lastUserMessage: string,
  caseSensitive: boolean,
  matchWholeWords: boolean,
  selectLogic: number // 0=AND_ANY, 1=NOT_ALL, 2=NOT_ANY, 3=AND_ALL
): { matched: boolean; keys: string[] } {
  const matchedKeys: string[] = [];
  const contentToCheck = caseSensitive ? content : content.toLowerCase();
  const userMsgToCheck = caseSensitive ? lastUserMessage : lastUserMessage.toLowerCase();

  for (const key of keys) {
    if (!key.trim()) continue;

    // Check if this is a regex key
    if (isRegexKey(key)) {
      const regex = parseRegexKey(key);
      if (regex) {
        // For regex, we test against both content and user message
        // Note: regex handles its own case sensitivity via flags
        const inContent = checkRegexMatch(regex, content);
        const inUserMsg = checkRegexMatch(regex, lastUserMessage);
        
        if (inContent || inUserMsg) {
          matchedKeys.push(key);
        }
      }
      continue;
    }

    // Standard plaintext matching
    const keyToCheck = caseSensitive ? key : key.toLowerCase();
    
    // Check in combined content and last user message
    const inContent = matchWholeWords
      ? checkWholeWord(contentToCheck, keyToCheck)
      : contentToCheck.includes(keyToCheck);
    
    const inUserMsg = matchWholeWords
      ? checkWholeWord(userMsgToCheck, keyToCheck)
      : userMsgToCheck.includes(keyToCheck);

    if (inContent || inUserMsg) {
      matchedKeys.push(key);
    }
  }

  // Apply select logic
  switch (selectLogic) {
    case 0: // AND_ANY - Match ANY key
      return { matched: matchedKeys.length > 0, keys: matchedKeys };
    
    case 1: // NOT_ALL - NOT match ALL keys (inverse)
      return { matched: matchedKeys.length < keys.filter(k => k.trim()).length, keys: matchedKeys };
    
    case 2: // NOT_ANY - NOT match ANY key
      return { matched: matchedKeys.length === 0, keys: [] };
    
    case 3: // AND_ALL - Match ALL keys
      return { matched: matchedKeys.length === keys.filter(k => k.trim()).length, keys: matchedKeys };
    
    default:
      return { matched: matchedKeys.length > 0, keys: matchedKeys };
  }
}

/**
 * Check for whole word match
 */
function checkWholeWord(content: string, word: string): boolean {
  // Create regex pattern for whole word match
  const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(^|[^a-zA-Z0-9])${escapedWord}([^a-zA-Z0-9]|$)`, 'g');
  return pattern.test(content);
}

/**
 * Filter scan results by probability
 */
export function filterByProbability(results: LorebookScanResult[]): LorebookScanResult[] {
  return results.filter(result => {
    // Skip probability check if not enabled
    if (!result.entry.useProbability) return true;
    
    // Check probability (0-100)
    const probability = result.entry.probability ?? 100;
    return Math.random() * 100 <= probability;
  });
}

/**
 * Get entries by position for injection
 */
export function getEntriesByPosition(
  results: LorebookScanResult[],
  position: number
): LorebookScanResult[] {
  return results.filter(r => r.entry.position === position);
}

/**
 * Get entries by outlet name
 */
export function getEntriesByOutlet(
  results: LorebookScanResult[],
  outletName: string
): LorebookScanResult[] {
  return results.filter(r => 
    r.entry.position === 7 && 
    r.entry.outletName === outletName
  );
}

/**
 * Group entries by their outlet name (for position 7)
 */
export function groupByOutlet(
  results: LorebookScanResult[]
): Map<string, LorebookScanResult[]> {
  const outlets = new Map<string, LorebookScanResult[]>();
  
  for (const result of results) {
    if (result.entry.position === 7 && result.entry.outletName) {
      const name = result.entry.outletName;
      if (!outlets.has(name)) {
        outlets.set(name, []);
      }
      outlets.get(name)!.push(result);
    }
  }
  
  return outlets;
}

/**
 * Group entries by their group name
 */
export function groupEntries(
  results: LorebookScanResult[]
): Map<string, LorebookScanResult[]> {
  const groups = new Map<string, LorebookScanResult[]>();
  
  for (const result of results) {
    const groupName = result.entry.group || '__default__';
    if (!groups.has(groupName)) {
      groups.set(groupName, []);
    }
    groups.get(groupName)!.push(result);
  }
  
  return groups;
}

/**
 * Estimate token count for text (rough approximation)
 */
export function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token on average
  return Math.ceil(text.length / 4);
}

/**
 * Apply token budget to results
 */
export function applyTokenBudget(
  results: LorebookScanResult[],
  tokenBudget: number
): LorebookScanResult[] {
  const filtered: LorebookScanResult[] = [];
  let totalTokens = 0;

  // Sort by order (lower = higher priority)
  const sorted = [...results].sort((a, b) => a.entry.order - b.entry.order);

  for (const result of sorted) {
    const entryTokens = estimateTokens(result.entry.content);
    
    if (totalTokens + entryTokens <= tokenBudget) {
      filtered.push(result);
      totalTokens += entryTokens;
    }
  }

  return filtered;
}
