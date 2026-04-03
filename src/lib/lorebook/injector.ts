// ============================================
// Lorebook Injector - Inject lorebook content into prompts
// ============================================

import type { LorebookEntry, PromptSection, ChatMessage, Lorebook } from '@/types';
import { 
  scanForLorebookEntries, 
  filterByProbability, 
  applyTokenBudget,
  getEntriesByPosition,
  LorebookScanResult 
} from './scanner';

/**
 * Build lorebook section content from entries
 */
export function buildLorebookSection(
  results: LorebookScanResult[]
): string {
  return results
    .map(r => r.entry.content)
    .filter(content => content.trim())
    .join('\n\n');
}

/**
 * Create a prompt section for lorebook content
 */
export function createLorebookPromptSection(
  results: LorebookScanResult[]
): PromptSection | null {
  if (results.length === 0) return null;

  const content = buildLorebookSection(results);
  if (!content.trim()) return null;

  return {
    type: 'lorebook',
    label: 'World Information',
    content,
    color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
  };
}

/**
 * Options for lorebook injection
 */
export interface LorebookInjectOptions {
  tokenBudget?: number;
  scanDepth?: number;
  caseSensitive?: boolean;
  matchWholeWords?: boolean;
  includeConstants?: boolean;
}

/**
 * Default inject options
 */
export const DEFAULT_INJECT_OPTIONS: LorebookInjectOptions = {
  tokenBudget: 2048,
  scanDepth: 5,
  caseSensitive: false,
  matchWholeWords: false,
  includeConstants: true,
};

/**
 * Result of lorebook injection
 */
export interface LorebookInjectResult {
  /** All matched entries after filtering */
  matchedEntries: LorebookScanResult[];
  /** Prompt section for the main lorebook content */
  lorebookSection: PromptSection | null;
  /** Total tokens estimated */
  totalTokens: number;
}

/**
 * Process lorebooks for a chat context
 * @param messages Chat messages to scan
 * @param lorebooks Active lorebooks
 * @param options Injection options
 * @returns Injection result with sections and metadata
 */
export function processLorebooks(
  messages: ChatMessage[],
  lorebooks: Lorebook[],
  options: LorebookInjectOptions = {}
): LorebookInjectResult {
  const opts = { ...DEFAULT_INJECT_OPTIONS, ...options };

  // Early return if no lorebooks
  if (!lorebooks || lorebooks.length === 0) {
    return {
      matchedEntries: [],
      lorebookSection: null,
      totalTokens: 0
    };
  }

  // Scan for matching entries
  const scanResults = scanForLorebookEntries(messages, lorebooks, {
    scanDepth: opts.scanDepth,
    caseSensitive: opts.caseSensitive,
    matchWholeWords: opts.matchWholeWords,
    includeConstants: opts.includeConstants
  });

  // Filter by probability
  const probabilityFiltered = filterByProbability(scanResults);

  // Apply token budget
  const budgetFiltered = applyTokenBudget(probabilityFiltered, opts.tokenBudget!);

  // Create prompt section
  const lorebookSection = createLorebookPromptSection(budgetFiltered);

  // Calculate total tokens
  const totalTokens = budgetFiltered.reduce(
    (sum, r) => sum + Math.ceil(r.entry.content.length / 4),
    0
  );

  return {
    matchedEntries: budgetFiltered,
    lorebookSection,
    totalTokens
  };
}

/**
 * Get lorebook entries for a specific position
 * This is useful for advanced positioning (before/after messages)
 */
export function getLorebookForPosition(
  messages: ChatMessage[],
  lorebooks: Lorebook[],
  position: number,
  options: LorebookInjectOptions = {}
): LorebookScanResult[] {
  const opts = { ...DEFAULT_INJECT_OPTIONS, ...options };

  const scanResults = scanForLorebookEntries(messages, lorebooks, {
    scanDepth: opts.scanDepth,
    caseSensitive: opts.caseSensitive,
    matchWholeWords: opts.matchWholeWords,
    includeConstants: opts.includeConstants
  });

  const probabilityFiltered = filterByProbability(scanResults);
  const positionFiltered = getEntriesByPosition(probabilityFiltered, position);

  return applyTokenBudget(positionFiltered, opts.tokenBudget!);
}

/**
 * Format lorebook entries as context string
 * Used for inserting into prompts at specific positions
 */
export function formatLorebookContext(
  entries: LorebookScanResult[]
): string {
  if (entries.length === 0) return '';

  const parts: string[] = [];

  // Group by lorebook for organization
  const byLorebook = new Map<string, LorebookScanResult[]>();
  for (const entry of entries) {
    if (!byLorebook.has(entry.lorebookName)) {
      byLorebook.set(entry.lorebookName, []);
    }
    byLorebook.get(entry.lorebookName)!.push(entry);
  }

  // Format each lorebook's entries
  for (const [lorebookName, results] of byLorebook) {
    for (const result of results) {
      const comment = result.entry.comment ? ` [${result.entry.comment}]` : '';
      parts.push(`${result.entry.content}${comment}`);
    }
  }

  return parts.join('\n\n');
}

/**
 * Combine multiple lorebook sections into one
 */
export function combineLorebookSections(
  sections: (PromptSection | null)[]
): PromptSection | null {
  const validSections = sections.filter((s): s is PromptSection => s !== null);
  
  if (validSections.length === 0) return null;

  const combinedContent = validSections
    .map(s => s.content)
    .join('\n\n');

  return {
    type: 'lorebook',
    label: 'World Information',
    content: combinedContent,
    color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
  };
}

/**
 * Check if any lorebook has entries
 */
export function hasActiveLorebookEntries(lorebooks: Lorebook[]): boolean {
  return lorebooks.some(
    lb => lb.active && lb.entries.some(e => !e.disable)
  );
}

/**
 * Get total entry count across all active lorebooks
 */
export function getTotalEntryCount(lorebooks: Lorebook[]): number {
  return lorebooks
    .filter(lb => lb.active)
    .reduce((sum, lb) => sum + lb.entries.filter(e => !e.disable).length, 0);
}
