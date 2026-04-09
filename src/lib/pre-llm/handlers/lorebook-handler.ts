// ============================================
// Lorebook Handler - Handles lorebook scanning for Pre-LLM
// Uses the existing lorebook scanner to avoid code duplication
// ============================================

import type { Lorebook } from '@/types';
import type { PreLLMInput, PreLLMMatchResult } from '../types';
import {
  scanForLorebookEntries,
  filterByProbability,
  applyTokenBudget,
  estimateTokens,
  type LorebookScanResult
} from '../../lorebook/scanner';

// ============================================
// Lorebook Handler Implementation
// ============================================

/**
 * Lorebook handler - uses existing lorebook scanner
 */
export function lorebookHandler(input: PreLLMInput): PreLLMMatchResult[] {
  const { messages, lorebooks, activeLorebookIds, options } = input;

  // Skip if no lorebooks
  if (!lorebooks || lorebooks.length === 0) {
    return [];
  }

  // Filter to active lorebooks
  const activeLorebooks = lorebooks.filter(lb => {
    if (!lb.active) return false;
    if (activeLorebookIds && activeLorebookIds.length > 0) {
      return activeLorebookIds.includes(lb.id);
    }
    return true;
  });

  // Skip if no active lorebooks
  if (activeLorebooks.length === 0) {
    return [];
  }

  // Use existing lorebook scanner
  const scanResults = scanForLorebookEntries(messages, activeLorebooks, {
    scanDepth: options.scanDepth,
    caseSensitive: options.caseSensitive,
    matchWholeWords: options.matchWholeWords,
    includeConstants: options.includeConstants
  });

  // Filter by probability
  const probabilityFiltered = filterByProbability(scanResults);

  // Apply token budget
  const budgetFiltered = applyTokenBudget(probabilityFiltered, options.tokenBudget ?? 2048);

  // Convert to PreLLM match results
  return budgetFiltered.map((result, index) => convertToMatchResult(result, index));
}

/**
 * Convert lorebook scan result to PreLLM match result
 */
function convertToMatchResult(result: LorebookScanResult, index: number): PreLLMMatchResult {
  return {
    type: 'lorebook',
    handler: 'lorebook',
    content: result.entry.content,
    position: result.entry.position ?? 0,
    order: result.entry.order ?? 100,
    estimatedTokens: estimateTokens(result.entry.content),
    matchedKeys: result.matchedKeys,
    matchType: result.matchType,
    data: {
      entry: result.entry,
      lorebookId: result.lorebookId,
      lorebookName: result.lorebookName
    }
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Extract lorebook content from match results
 */
export function extractLorebookContent(matches: PreLLMMatchResult[]): string {
  return matches
    .filter(m => m.type === 'lorebook')
    .map(m => m.content)
    .filter(c => c?.trim())
    .join('\n\n');
}

/**
 * Check if any lorebooks are active
 */
export function hasActiveLorebooks(
  lorebooks: Lorebook[],
  activeLorebookIds?: string[]
): boolean {
  if (!lorebooks || lorebooks.length === 0) return false;

  return lorebooks.some(lb => {
    if (!lb.active) return false;
    if (activeLorebookIds && activeLorebookIds.length > 0) {
      return activeLorebookIds.includes(lb.id);
    }
    return true;
  });
}
