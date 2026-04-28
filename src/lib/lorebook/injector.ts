// ============================================
// Lorebook Injector - Inject lorebook content into prompts
// ============================================
//
// This module provides position-aware lorebook injection.
// Lorebook entries have a `position` field (0-7) that determines
// WHERE in the prompt the content is injected:
//
// 0 = After system prompt
// 1 = After last user message
// 2 = Before last user message
// 3 = After last assistant message
// 4 = Before last assistant message
// 5 = At top of chat (before chat history)
// 6 = At bottom of chat (after all messages)
// 7 = Outlet (custom position, uses outletName field)
//
// System-level positions (0, 5, 7) → injected into the system message
// Chat-level positions (1-4) → injected into specific chat messages
// Bottom position (6) → appended at the end of all content

import type { LorebookEntry, PromptSection, ChatMessage, Lorebook } from '@/types';
import { 
  scanForLorebookEntries, 
  filterByProbability, 
  applyTokenBudget,
  estimateTokens,
  groupByPosition,
  groupByOutlet,
  getEntriesByPosition,
  formatEntriesWithComments,
  LorebookScanResult 
} from './scanner';

// ============================================
// Types
// ============================================

/**
 * Chat-level lorebook injection for positions 1-4.
 * These are injected into/around specific chat messages.
 */
export interface LorebookChatInjection {
  position: 1 | 2 | 3 | 4;
  content: string;
  label: string;
}

/**
 * Complete lorebook injection plan with position-aware sections.
 */
export interface LorebookInjectionPlan {
  /** All matched entries (for debugging/prompt viewer) */
  allEntries: LorebookScanResult[];

  /** Position 0: After system prompt */
  position0Section: PromptSection | null;

  /** Position 5: At top of chat (before chat history) */
  position5Section: PromptSection | null;

  /** Position 6: At bottom of chat (after all messages) */
  position6Section: PromptSection | null;

  /** Position 7: Outlets (may be multiple, keyed by outletName) */
  outletSections: PromptSection[];

  /** Positions 1-4: Chat-level injections (around specific messages) */
  chatInjections: LorebookChatInjection[];

  /** Total estimated tokens across all matched entries */
  totalTokens: number;
}

/**
 * Options for lorebook injection
 */
export interface LorebookInjectOptions {
  tokenBudget?: number;          // Max tokens for lorebook content (overrides lorebook settings)
  scanDepth?: number;            // Scan depth override
  caseSensitive?: boolean;       // Case sensitivity override
  matchWholeWords?: boolean;     // Whole word matching override
  includeConstants?: boolean;    // Include constant entries
}

/**
 * Default inject options
 */
export const DEFAULT_INJECT_OPTIONS: LorebookInjectOptions = {
  includeConstants: true,
};

// ============================================
// Legacy types (kept for backward compatibility)
// ============================================

/**
 * @deprecated Use LorebookInjectionPlan instead
 */
export interface LorebookInjectResult {
  matchedEntries: LorebookScanResult[];
  lorebookSection: PromptSection | null;
  totalTokens: number;
}

// ============================================
// Lorebook color for prompt viewer
// ============================================

const LOREBOOK_COLOR = 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300';

// ============================================
// Main API
// ============================================

/**
 * Build a complete lorebook injection plan with position-aware sections.
 * 
 * This replaces the old `processLorebooks()` function. It:
 * - Scans messages for matching entries (with per-entry overrides)
 * - Filters by probability
 * - Applies token budget from lorebook settings or options
 * - Groups entries by position
 * - Builds properly labeled sections for each position
 *
 * @param messages Chat messages to scan for keywords
 * @param lorebooks Active lorebooks to check
 * @param options Injection options (token budget overrides scan options)
 * @returns Complete injection plan with sections for each position
 */
export function buildLorebookInjectionPlan(
  messages: ChatMessage[],
  lorebooks: Lorebook[],
  options: LorebookInjectOptions = {}
): LorebookInjectionPlan {
  // Early return if no lorebooks
  if (!lorebooks || lorebooks.length === 0) {
    return {
      allEntries: [],
      position0Section: null,
      position5Section: null,
      position6Section: null,
      outletSections: [],
      chatInjections: [],
      totalTokens: 0
    };
  }

  // Scan for matching entries (with per-entry overrides for scanDepth, etc.)
  const scanResults = scanForLorebookEntries(messages, lorebooks, {
    scanDepth: options.scanDepth,
    caseSensitive: options.caseSensitive,
    matchWholeWords: options.matchWholeWords,
    includeConstants: options.includeConstants
  });

  // Filter by probability
  const probabilityFiltered = filterByProbability(scanResults);

  // Determine effective token budget:
  // Priority: options.tokenBudget > first active lorebook's settings > default 2048
  const effectiveTokenBudget = options.tokenBudget
    ?? lorebooks.find(lb => lb.active)?.settings.tokenBudget
    ?? 2048;

  // Apply token budget
  const budgetFiltered = applyTokenBudget(probabilityFiltered, effectiveTokenBudget);

  // Calculate total tokens
  const totalTokens = budgetFiltered.reduce(
    (sum, r) => sum + estimateTokens(r.entry.content),
    0
  );

  // Group by position
  const positionGroups = groupByPosition(budgetFiltered);

  // === Build system-level sections ===

  // Position 0: After system prompt
  const pos0Entries = positionGroups.get(0);
  const position0Section = pos0Entries?.length
    ? buildPromptSection('World Info (after system)', pos0Entries)
    : null;

  // Position 5: At top of chat (before chat history)
  const pos5Entries = positionGroups.get(5);
  const position5Section = pos5Entries?.length
    ? buildPromptSection('World Info (top of chat)', pos5Entries)
    : null;

  // Position 6: At bottom of chat (after all messages)
  const pos6Entries = positionGroups.get(6);
  const position6Section = pos6Entries?.length
    ? buildPromptSection('World Info (bottom)', pos6Entries)
    : null;

  // Position 7: Outlets (may be multiple, grouped by outletName)
  const outletSections: PromptSection[] = [];
  const pos7Entries = positionGroups.get(7);
  if (pos7Entries?.length) {
    const outlets = groupByOutlet(pos7Entries);
    for (const [outletName, entries] of outlets) {
      outletSections.push(buildPromptSection(
        `World Info (${outletName})`,
        entries
      ));
    }
    // Also handle position 7 entries without an outlet name
    const entriesWithoutOutlet = pos7Entries.filter(e => !e.entry.outletName);
    if (entriesWithoutOutlet.length > 0) {
      outletSections.push(buildPromptSection(
        'World Info (outlet)',
        entriesWithoutOutlet
      ));
    }
  }

  // === Build chat-level injections (positions 1-4) ===
  const chatInjections: LorebookChatInjection[] = [];
  for (const [pos, entries] of positionGroups) {
    if (pos >= 1 && pos <= 4) {
      chatInjections.push({
        position: pos as 1 | 2 | 3 | 4,
        content: formatEntriesWithComments(entries),
        label: 'World Info'
      });
    }
  }

  // Sort chat injections by position for deterministic order
  chatInjections.sort((a, b) => a.position - b.position);

  return {
    allEntries: budgetFiltered,
    position0Section,
    position5Section,
    position6Section,
    outletSections,
    chatInjections,
    totalTokens
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Build a PromptSection from lorebook scan results.
 * Includes comment headers and role prefixes in the content.
 */
function buildPromptSection(
  label: string,
  results: LorebookScanResult[]
): PromptSection {
  return {
    type: 'lorebook',
    label,
    content: formatEntriesWithComments(results),
    color: LOREBOOK_COLOR
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

  return applyTokenBudget(positionFiltered, opts.tokenBudget ?? 2048);
}

// ============================================
// Legacy API (backward compatibility)
// ============================================

/**
 * Build lorebook section content from entries
 * @deprecated Use buildLorebookInjectionPlan() instead
 */
export function buildLorebookSection(
  results: LorebookScanResult[]
): string {
  return formatEntriesWithComments(results);
}

/**
 * Create a prompt section for lorebook content
 * @deprecated Use buildLorebookInjectionPlan() instead
 */
export function createLorebookPromptSection(
  results: LorebookScanResult[]
): PromptSection | null {
  if (results.length === 0) return null;

  const content = formatEntriesWithComments(results);
  if (!content.trim()) return null;

  return {
    type: 'lorebook',
    label: 'World Information',
    content,
    color: LOREBOOK_COLOR
  };
}

/**
 * Process lorebooks for a chat context (legacy API)
 * @deprecated Use buildLorebookInjectionPlan() instead
 */
export function processLorebooks(
  messages: ChatMessage[],
  lorebooks: Lorebook[],
  options: LorebookInjectOptions = {}
): LorebookInjectResult {
  const plan = buildLorebookInjectionPlan(messages, lorebooks, options);

  // Combine all system sections into a single section for backward compat
  const allSections = [
    plan.position0Section,
    plan.position5Section,
    plan.position6Section,
    ...plan.outletSections
  ].filter((s): s is PromptSection => s !== null);

  const lorebookSection = allSections.length > 0
    ? combineLorebookSections(allSections)
    : null;

  return {
    matchedEntries: plan.allEntries,
    lorebookSection,
    totalTokens: plan.totalTokens
  };
}

/**
 * Format lorebook entries as context string
 * @deprecated Use formatEntriesWithComments() from scanner instead
 */
export function formatLorebookContext(
  entries: LorebookScanResult[]
): string {
  return formatEntriesWithComments(entries);
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
    color: LOREBOOK_COLOR
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

