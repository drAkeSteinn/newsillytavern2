import type { Lorebook, LorebookEntry, ChatMessage } from '@/types';

/**
 * Process lorebooks and extract relevant entries based on chat messages
 * This implements the core SillyTavern World Info logic
 */

export interface ProcessedLorebookContent {
  entries: LorebookEntry[];
  totalContent: string;
  estimatedTokens: number;
}

/**
 * Check if a keyword matches in text
 */
function keywordMatches(
  text: string,
  keyword: string,
  caseSensitive: boolean,
  matchWholeWords: boolean
): boolean {
  const searchText = caseSensitive ? text : text.toLowerCase();
  const searchKeyword = caseSensitive ? keyword : keyword.toLowerCase();

  if (!matchWholeWords) {
    return searchText.includes(searchKeyword);
  }

  // Match whole words only
  const regex = new RegExp(`\\b${escapeRegex(searchKeyword)}\\b`, caseSensitive ? 'g' : 'gi');
  return regex.test(searchText);
}

/**
 * Escape special regex characters
 */
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if an entry should activate based on the scan text
 */
function checkEntryActivation(
  entry: LorebookEntry,
  scanText: string,
  globalCaseSensitive: boolean,
  globalMatchWholeWords: boolean
): boolean {
  // If disabled or probability check fails, don't activate
  if (entry.disable) return false;
  if (entry.useProbability && entry.probability < 100) {
    if (Math.random() * 100 > entry.probability) return false;
  }

  // If constant, always activate
  if (entry.constant) return true;

  // If no keys, don't activate
  if (entry.key.length === 0) return false;

  const caseSensitive = entry.caseSensitive ?? globalCaseSensitive;
  const matchWholeWords = entry.matchWholeWords ?? globalMatchWholeWords;

  // Check primary keys based on logic
  const primaryMatches = entry.key.map(key => 
    keywordMatches(scanText, key, caseSensitive, matchWholeWords)
  );

  // Apply select logic
  let primaryActivated = false;
  switch (entry.selectLogic) {
    case 0: // AND_ANY - match any primary key
      primaryActivated = primaryMatches.some(m => m);
      break;
    case 1: // NOT_ALL - not all primary keys match
      primaryActivated = !primaryMatches.every(m => m);
      break;
    case 2: // NOT_ANY - no primary key matches
      primaryActivated = !primaryMatches.some(m => m);
      break;
    case 3: // AND_ALL - all primary keys match
      primaryActivated = primaryMatches.every(m => m);
      break;
    default:
      primaryActivated = primaryMatches.some(m => m);
  }

  // If not activated by primary keys or no secondary keys, return
  if (!primaryActivated || entry.keysecondary.length === 0) {
    return primaryActivated;
  }

  // Check secondary keys (must match at least one if selective)
  if (entry.selective) {
    const secondaryMatches = entry.keysecondary.map(key =>
      keywordMatches(scanText, key, caseSensitive, matchWholeWords)
    );
    return secondaryMatches.some(m => m);
  }

  return primaryActivated;
}

/**
 * Get text to scan from messages based on depth
 */
function getScanText(
  messages: ChatMessage[],
  depth: number,
  includePersona: boolean = false,
  personaDescription?: string
): string {
  const recentMessages = messages
    .filter(m => !m.isDeleted)
    .slice(-depth);
  
  let text = recentMessages.map(m => m.content).join(' ');
  
  if (includePersona && personaDescription) {
    text += ' ' + personaDescription;
  }
  
  return text;
}

/**
 * Process lorebooks and return activated entries
 */
export function processLorebooks(
  lorebooks: Lorebook[],
  messages: ChatMessage[],
  options: {
    depth?: number;
    personaDescription?: string;
    includePersona?: boolean;
  } = {}
): ProcessedLorebookContent {
  const { 
    depth = 5, 
    personaDescription,
    includePersona = false 
  } = options;

  const activatedEntries: LorebookEntry[] = [];
  
  // Process each active lorebook
  for (const lorebook of lorebooks) {
    if (!lorebook.active) continue;
    
    const globalScanDepth = lorebook.settings.scanDepth;
    const globalCaseSensitive = lorebook.settings.caseSensitive;
    const globalMatchWholeWords = lorebook.settings.matchWholeWords;
    
    // Get scan text for this lorebook
    const scanDepth = depth || globalScanDepth;
    const scanText = getScanText(messages, scanDepth, includePersona, personaDescription);
    
    // Check each entry
    for (const entry of lorebook.entries) {
      const entryScanDepth = entry.scanDepth ?? globalScanDepth;
      const entryScanText = entryScanDepth !== scanDepth 
        ? getScanText(messages, entryScanDepth, includePersona, personaDescription)
        : scanText;
      
      if (checkEntryActivation(entry, entryScanText, globalCaseSensitive, globalMatchWholeWords)) {
        activatedEntries.push(entry);
      }
    }
  }
  
  // Sort entries by order (higher order = inserted later)
  activatedEntries.sort((a, b) => a.order - b.order);
  
  // Group entries by group name and handle group logic
  const groupedEntries = new Map<string, LorebookEntry[]>();
  const ungroupedEntries: LorebookEntry[] = [];
  
  for (const entry of activatedEntries) {
    if (entry.group) {
      if (!groupedEntries.has(entry.group)) {
        groupedEntries.set(entry.group, []);
      }
      groupedEntries.get(entry.group)!.push(entry);
    } else {
      ungroupedEntries.push(entry);
    }
  }
  
  // Process groups - select one entry per group based on weight
  const finalEntries: LorebookEntry[] = [...ungroupedEntries];
  
  for (const [groupName, groupEntries] of groupedEntries) {
    // Sort by weight
    groupEntries.sort((a, b) => b.groupWeight - a.groupWeight);
    
    // Select based on weight (weighted random)
    const totalWeight = groupEntries.reduce((sum, e) => sum + e.groupWeight, 0);
    let random = Math.random() * totalWeight;
    
    for (const entry of groupEntries) {
      random -= entry.groupWeight;
      if (random <= 0) {
        finalEntries.push(entry);
        break;
      }
    }
  }
  
  // Sort final entries by order
  finalEntries.sort((a, b) => a.order - b.order);
  
  // Build content
  const totalContent = finalEntries
    .map(e => e.content)
    .filter(c => c.trim())
    .join('\n\n');
  
  // Estimate tokens (roughly 4 characters per token)
  const estimatedTokens = Math.ceil(totalContent.length / 4);
  
  return {
    entries: finalEntries,
    totalContent,
    estimatedTokens
  };
}

/**
 * Get lorebook content for a specific position
 */
export function getLorebookContentForPosition(
  processedLorebook: ProcessedLorebookContent,
  position: number
): string {
  const entries = processedLorebook.entries.filter(e => e.position === position);
  return entries.map(e => e.content).filter(c => c.trim()).join('\n\n');
}

/**
 * Split lorebook content by insertion positions
 */
export function splitLorebookByPosition(
  processedLorebook: ProcessedLorebookContent
): Record<number, string> {
  const result: Record<number, string> = {};
  
  for (const entry of processedLorebook.entries) {
    if (!result[entry.position]) {
      result[entry.position] = '';
    }
    if (entry.content.trim()) {
      result[entry.position] += (result[entry.position] ? '\n\n' : '') + entry.content;
    }
  }
  
  return result;
}

/**
 * Estimate if content fits within token budget
 */
export function checkTokenBudget(
  processedLorebook: ProcessedLorebookContent,
  budget: number
): boolean {
  return processedLorebook.estimatedTokens <= budget;
}

/**
 * Trim lorebook content to fit token budget
 */
export function trimToTokenBudget(
  processedLorebook: ProcessedLorebookContent,
  budget: number
): ProcessedLorebookContent {
  if (processedLorebook.estimatedTokens <= budget) {
    return processedLorebook;
  }
  
  // Remove entries from lowest order until we fit
  const sortedEntries = [...processedLorebook.entries].sort((a, b) => a.order - b.order);
  const keptEntries: LorebookEntry[] = [];
  let currentTokens = 0;
  
  for (const entry of sortedEntries) {
    const entryTokens = Math.ceil(entry.content.length / 4);
    if (currentTokens + entryTokens <= budget) {
      keptEntries.push(entry);
      currentTokens += entryTokens;
    }
  }
  
  const totalContent = keptEntries
    .map(e => e.content)
    .filter(c => c.trim())
    .join('\n\n');
  
  return {
    entries: keptEntries,
    totalContent,
    estimatedTokens: currentTokens
  };
}
