// ============================================
// Lorebook Injector - Inject lorebook content into prompts
// ============================================
//
// This module provides position-aware lorebook injection for TRADITIONAL entries.
// Attribute-type entries are handled via {{injectionKey}} resolution in key-resolver.ts
//
// Position values for traditional entries:
// 0 = After system prompt
// 1 = After last user message
// 2 = Before last user message
// 3 = After last assistant message
// 4 = Before last assistant message
// 5 = At top of chat (before chat history)
// 6 = At bottom of chat (after all messages)
// 7 = Outlet (custom position, uses outletName field)

import type { PromptSection, ChatMessage, Lorebook } from '@/types';
import { 
  scanForLorebookEntries, 
  filterByProbability, 
  applyTokenBudget,
  applyGroupScoring,
  estimateTokens,
  groupByPosition,
  groupByOutlet,
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
  userName?: string;             // User name for <START> dialogue formatting
  charName?: string;             // Character name for <START> dialogue formatting
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
 * Only processes TRADITIONAL entries. Attribute-type entries are resolved
 * separately via resolveLorebookAttributeKeys() and injected via {{injectionKey}}.
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

  // Scan for matching traditional entries only (attribute entries are skipped by scanner)
  const scanResults = scanForLorebookEntries(messages, lorebooks, {
    scanDepth: options.scanDepth,
    caseSensitive: options.caseSensitive,
    matchWholeWords: options.matchWholeWords,
    includeConstants: options.includeConstants
  });

  // Filter by probability
  const probabilityFiltered = filterByProbability(scanResults);

  // Apply group scoring (select one entry per group based on weight)
  const groupFiltered = applyGroupScoring(probabilityFiltered);

  // Determine effective token budget:
  // Priority: options.tokenBudget > minimum of all active lorebooks' budgets > default 2048
  let effectiveTokenBudget: number;
  if (options.tokenBudget != null && options.tokenBudget > 0) {
    effectiveTokenBudget = options.tokenBudget;
  } else {
    const activeBudgets = lorebooks
      .filter(lb => lb.settings.tokenBudget > 0)
      .map(lb => lb.settings.tokenBudget);
    effectiveTokenBudget = activeBudgets.length > 0
      ? Math.min(...activeBudgets)
      : 2048;
  }

  // Apply token budget
  const budgetFiltered = applyTokenBudget(groupFiltered, effectiveTokenBudget);

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
    ? buildPromptSection('World Info (after system)', pos0Entries, options.userName, options.charName)
    : null;

  // Position 5: At top of chat (before chat history)
  const pos5Entries = positionGroups.get(5);
  const position5Section = pos5Entries?.length
    ? buildPromptSection('World Info (top of chat)', pos5Entries, options.userName, options.charName)
    : null;

  // Position 6: At bottom of chat (after all messages)
  const pos6Entries = positionGroups.get(6);
  const position6Section = pos6Entries?.length
    ? buildPromptSection('World Info (bottom)', pos6Entries, options.userName, options.charName)
    : null;

  // Position 7: Outlets (may be multiple, grouped by outletName)
  const outletSections: PromptSection[] = [];
  const pos7Entries = positionGroups.get(7);
  if (pos7Entries?.length) {
    const outlets = groupByOutlet(pos7Entries);
    for (const [outletName, entries] of outlets) {
      outletSections.push(buildPromptSection(
        `World Info (${outletName})`,
        entries,
        options.userName,
        options.charName
      ));
    }
    // Also handle position 7 entries without an outlet name
    const entriesWithoutOutlet = pos7Entries.filter(e => !e.entry.outletName);
    if (entriesWithoutOutlet.length > 0) {
      outletSections.push(buildPromptSection(
        'World Info (outlet)',
        entriesWithoutOutlet,
        options.userName,
        options.charName
      ));
    }
  }

  // === Build chat-level injections (positions 1-4) ===
  const chatInjections: LorebookChatInjection[] = [];
  for (const [pos, entries] of positionGroups) {
    if (pos >= 1 && pos <= 4) {
      chatInjections.push({
        position: pos as 1 | 2 | 3 | 4,
        content: formatEntriesWithComments(entries, options.userName, options.charName),
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
  results: LorebookScanResult[],
  userName?: string,
  charName?: string
): PromptSection {
  return {
    type: 'lorebook',
    label,
    content: formatEntriesWithComments(results, userName, charName),
    color: LOREBOOK_COLOR
  };
}
