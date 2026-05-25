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
  scanDepth?: number;           // Number of messages to scan back (default from lorebook settings)
  caseSensitive?: boolean;      // Case sensitive matching
  matchWholeWords?: boolean;    // Match whole words only
  includeConstants?: boolean;   // Include constant entries
}

/**
 * Default scan options
 */
export const DEFAULT_SCAN_OPTIONS: ScanOptions = {
  scanDepth: undefined, // undefined = use lorebook/entry settings
  caseSensitive: undefined,  // undefined = use lorebook/entry settings
  matchWholeWords: undefined, // undefined = use lorebook/entry settings
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
 * Scan messages for lorebook entries (traditional only).
 * 
 * Attribute-type entries are skipped — they use {{injectionKey}} resolution
 * in the key-resolver phase instead of position-based injection.
 * 
 * Supports per-entry overrides for scanDepth, caseSensitive, and matchWholeWords.
 * When an entry has a non-null override value, it takes precedence over the lorebook
 * global settings and the scan options.
 * 
 * @param messages Chat messages to scan
 * @param lorebooks Active lorebooks to check
 * @param options Scan options (used as fallback when entry/lorebook don't specify)
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

  // Cache scan texts by depth to avoid recomputing for different entries
  const scanTextCache = new Map<number, { content: string; lastUserMessage: string }>();

  /**
   * Get combined message content and last user message for a given scan depth.
   * Results are cached to avoid re-scanning for entries with the same depth.
   */
  function getScanTextForDepth(depth: number): { content: string; lastUserMessage: string } {
    if (scanTextCache.has(depth)) return scanTextCache.get(depth)!;

    const visibleMessages = messages
      .filter(m => !m.isDeleted)
      .slice(-depth);

    const content = visibleMessages.map(m => m.content).join('\n');
    const lastUserMessage = visibleMessages
      .filter(m => m.role === 'user')
      .pop()?.content || '';

    const result = { content, lastUserMessage };
    scanTextCache.set(depth, result);
    return result;
  }

  for (const lorebook of lorebooks) {
    // Note: lorebook.active check removed — frontend already filters active lorebooks

    // Get global settings from lorebook
    const settings = lorebook.settings;

    for (const entry of lorebook.entries) {
      // Skip disabled entries
      if (entry.disable) continue;

      // Skip attribute-type entries (they use {{injectionKey}} resolution)
      if (entry.entryType === 'attribute') continue;

      // Skip if already processed
      const entryKey = `${lorebook.id}:${entry.uid}`;
      if (processedEntries.has(entryKey)) continue;

      // Handle constant entries (always active, no scanning needed)
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

      // === Per-entry overrides ===
      // Priority: entry override > lorebook settings > scan options > defaults

      // Scan depth: entry.scanDepth ?? lorebook settings ?? options ?? default(5)
      const entryScanDepth = entry.scanDepth ?? settings.scanDepth ?? opts.scanDepth ?? 5;

      // Case sensitivity: entry.caseSensitive ?? lorebook settings ?? options ?? false
      const effectiveCaseSensitive = entry.caseSensitive
        ?? (opts.caseSensitive !== undefined ? opts.caseSensitive : settings.caseSensitive);

      // Match whole words: entry.matchWholeWords ?? lorebook settings ?? options ?? false
      const effectiveMatchWholeWords = entry.matchWholeWords
        ?? (opts.matchWholeWords !== undefined ? opts.matchWholeWords : settings.matchWholeWords);

      // Get scan text for this entry's effective depth
      const { content: messageContent, lastUserMessage } = getScanTextForDepth(entryScanDepth);

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

  // Sort by order (lower = earlier in prompt)
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
  // Create regex pattern for whole word match with Unicode support
  // Uses \p{L} (Unicode letter) and \p{N} (Unicode number) for proper
  // word boundary detection in Spanish and other non-ASCII languages
  const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(^|(?<!\\p{L}))${escapedWord}((?!\\p{L})|$)`, 'gu');
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
 * Group entries by position number
 */
export function groupByPosition(
  results: LorebookScanResult[]
): Map<number, LorebookScanResult[]> {
  const groups = new Map<number, LorebookScanResult[]>();
  
  for (const result of results) {
    const pos = result.entry.position ?? 0;
    if (!groups.has(pos)) {
      groups.set(pos, []);
    }
    groups.get(pos)!.push(result);
  }
  
  return groups;
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
 * Apply group scoring: within each group, select only one entry
 * based on groupWeight (weighted random selection).
 * Entries without a group are always included.
 * 
 * This mirrors SillyTavern's group behavior where multiple entries
 * in the same group compete and only one is selected per activation.
 */
export function applyGroupScoring(
  results: LorebookScanResult[]
): LorebookScanResult[] {
  const ungrouped: LorebookScanResult[] = [];
  const grouped = new Map<string, LorebookScanResult[]>();

  for (const result of results) {
    const groupName = result.entry.group;
    if (!groupName) {
      ungrouped.push(result);
    } else {
      if (!grouped.has(groupName)) {
        grouped.set(groupName, []);
      }
      grouped.get(groupName)!.push(result);
    }
  }

  const finalResults: LorebookScanResult[] = [...ungrouped];

  // For each group, select one entry based on groupWeight
  for (const [, groupEntries] of grouped) {
    // Sort by weight descending
    groupEntries.sort((a, b) => (b.entry.groupWeight ?? 1) - (a.entry.groupWeight ?? 1));

    // Weighted random selection
    const totalWeight = groupEntries.reduce((sum, e) => sum + (e.entry.groupWeight ?? 1), 0);
    let random = Math.random() * totalWeight;

    for (const entry of groupEntries) {
      random -= (entry.entry.groupWeight ?? 1);
      if (random <= 0) {
        finalResults.push(entry);
        break;
      }
    }
  }

  return finalResults;
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

/**
 * Format lorebook entries with their comment headers and optional role prefixes.
 * Also detects and formats <START>-style dialogue in entry content.
 * This is used when building the final content to inject into the prompt.
 */
export function formatEntriesWithComments(
  results: LorebookScanResult[],
  userName?: string,
  charName?: string
): string {
  const ROLE_LABELS: Record<number, string> = {
    0: 'System',
    1: 'User',
    2: 'Assistant',
  };

  return results
    .map(r => {
      const parts: string[] = [];

      // Role prefix (if set)
      if (r.entry.role != null && ROLE_LABELS[r.entry.role]) {
        parts.push(`[${ROLE_LABELS[r.entry.role]}]`);
      }

      // Comment header (SillyTavern style)
      if (r.entry.comment) {
        parts.push(`[${r.entry.comment}]`);
      }

      const header = parts.length > 0 ? parts.join(' ') + '\n' : '';
      
      // Process entry content: detect <START>-formatted dialogue
      let content = r.entry.content;
      if (/<START>/gi.test(content) && userName && charName) {
        // Import processExampleDialogue dynamically to avoid circular deps
        // Instead, we do simple inline formatting here
        content = formatStartDialogueInLorebook(content, userName, charName);
      }
      
      return header + content;
    })
    .filter(content => content.trim())
    .join('\n\n');
}

/**
 * Format <START>-dialogue content within a lorebook entry.
 * Preserves the natural conversation flow with speaker labels visible.
 * Improves separation between dialogue blocks and fixes the bug where
 * lastSpeaker was incorrectly reset on continuation lines.
 */
function formatStartDialogueInLorebook(content: string, userName: string, charName: string): string {
  // Split by <START> tags (case-insensitive)
  const blocks = content.split(/<START>/gi).filter(block => block.trim());

  if (blocks.length === 0) return content;

  const userPattern = new RegExp(`^(\\{\\{user\\}\\}|${escapeRegExp(userName)})\\s*:\\s*(.*)`, 'i');
  const charPattern = new RegExp(`^(\\{\\{char\\}\\}|${escapeRegExp(charName)})\\s*:\\s*(.*)`, 'i');

  const formattedBlocks: string[] = [];

  for (const block of blocks) {
    const trimmedBlock = block.trim();
    if (!trimmedBlock) continue;

    const lines = trimmedBlock.split('\n');
    const dialogueLines: Array<{speaker: 'user' | 'char' | 'narrative', content: string}> = [];
    let lastSpeaker: 'user' | 'char' | null = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      const userMatch = line.match(userPattern);
      const charMatch = line.match(charPattern);

      if (userMatch) {
        dialogueLines.push({ speaker: 'user', content: line });
        lastSpeaker = 'user';
      } else if (charMatch) {
        dialogueLines.push({ speaker: 'char', content: line });
        lastSpeaker = 'char';
      } else if (lastSpeaker && dialogueLines.length > 0) {
        // Continuation line — append to previous line (keep same speaker)
        dialogueLines[dialogueLines.length - 1].content += '\n' + line;
        // DON'T reset lastSpeaker - continuation lines belong to the same speaker
      } else {
        dialogueLines.push({ speaker: 'narrative', content: line });
        lastSpeaker = null;
      }
    }

    if (dialogueLines.length > 0) {
      // Group consecutive same-speaker lines with double newline between different speakers
      const parts: string[] = [];
      let currentSpeaker: string | null = null;

      for (const dl of dialogueLines) {
        if (dl.speaker !== currentSpeaker && parts.length > 0) {
          parts.push('');  // Empty line between different speakers
        }
        parts.push(dl.content);
        currentSpeaker = dl.speaker;
      }

      formattedBlocks.push(parts.join('\n'));
    }
  }

  return formattedBlocks.join('\n\n');
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
