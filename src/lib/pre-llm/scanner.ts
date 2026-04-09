// ============================================
// Pre-LLM Scanner - Unified scanning system for pre-LLM processing
// ============================================

import type { PromptSection } from '@/types';
import type { PreLLMScanOptions, PreLLMScanResult, PreLLMInput, PreLLMMatchResult, PreLLMHandler, DEFAULT_PRELLM_OPTIONS } from './types';
import { scanForLorebookEntries, filterByProbability, applyTokenBudget, estimateTokens, type LorebookScanResult } from '../lorebook/scanner';
import { lorebookHandler } from './handlers/lorebook-handler';

// ============================================
// Pre-LLM Scanner Class
// ============================================

/**
 * Central orchestrator for all Pre-LLM scanning
 * Uses a single scan pass to collect all matches, then applies token budget
 */
export class PreLLMScanner {
  private handlers: Map<string, PreLLMHandler> = new Map();
  private handlerOrder: string[] = [];

  /**
   * Register a handler
   */
  registerHandler(name: string, handler: PreLLMHandler): void {
    this.handlers.set(name, handler);
    if (!this.handlerOrder.includes(name)) {
      this.handlerOrder.push(name);
    }
  }

  /**
   * Remove a handler
   */
  removeHandler(name: string): void {
    this.handlers.delete(name);
    this.handlerOrder = this.handlerOrder.filter(n => n !== name);
  }

  /**
   * Run all handlers and return unified results
   */
  scan(input: PreLLMInput): PreLLMScanResult {
    const allMatches: PreLLMMatchResult[] = [];

    // Run each handler in order
    for (const name of this.handlerOrder) {
      const handler = this.handlers.get(name);
      if (!handler) continue;

      try {
        const results = handler(input);
        allMatches.push(...results);
      } catch (error) {
        console.error(`[PreLLM] Handler ${name} error:`, error);
      }
    }

    // Sort matches by position and order
    allMatches.sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position;
      return a.order - b.order;
    });

    // Apply token budget
    const budgetedMatches = this.applyTokenBudget(allMatches, input.options.tokenBudget ?? 2048);

    // Build sections and content
    const sections = this.buildSections(budgetedMatches);
    const injectedContent = sections.map(s => s.content).join('\n\n');

    return {
      matches: budgetedMatches,
      totalTokens: budgetedMatches.reduce((sum, m) => sum + m.estimatedTokens, 0),
      budgetExceeded: allMatches.length > budgetedMatches.length,
      injectedContent,
      sections
    };
  }

  /**
   * Apply token budget to results
   */
  private applyTokenBudget(matches: PreLLMMatchResult[], budget: number): PreLLMMatchResult[] {
    const filtered: PreLLMMatchResult[] = [];
    let totalTokens = 0;

    // Sort by position first, then by order
    const sorted = [...matches].sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position;
      return a.order - b.order;
    });

    for (const match of sorted) {
      if (totalTokens + match.estimatedTokens <= budget) {
        filtered.push(match);
        totalTokens += match.estimatedTokens;
      }
    }

    return filtered;
  }

  /**
   * Build prompt sections from matches
   */
  private buildSections(matches: PreLLMMatchResult[]): PromptSection[] {
    const typeColors: Record<string, string> = {
      lorebook: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
      memory: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
      relationship: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300',
      custom: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    };

    const typeLabels: Record<string, string> = {
      lorebook: 'World Information',
      memory: 'Character Memory',
      relationship: 'Relationships',
      custom: 'Additional Context',
    };

    // Group matches by type
    const byType = new Map<string, PreLLMMatchResult[]>();
    for (const match of matches) {
      if (!byType.has(match.type)) {
        byType.set(match.type, []);
      }
      byType.get(match.type)!.push(match);
    }

    // Create sections
    const sections: PromptSection[] = [];
    for (const [type, typeMatches] of byType) {
      const content = typeMatches
        .map(m => m.content)
        .filter(c => c.trim())
        .join('\n\n');

      if (content.trim()) {
        sections.push({
          type,
          label: typeLabels[type] || type,
          content,
          color: typeColors[type] || typeColors.custom,
        });
      }
    }

    return sections;
  }
}

// ============================================
// Singleton Instance with default handlers
// ============================================

let scannerInstance: PreLLMScanner | null = null;

/**
 * Get the global Pre-LLM scanner instance with default handlers
 */
export function getPreLLMScanner(): PreLLMScanner {
  if (!scannerInstance) {
    scannerInstance = new PreLLMScanner();
    // Register default handlers
    scannerInstance.registerHandler('lorebook', lorebookHandler);
  }
  return scannerInstance;
}

/**
 * Create a new Pre-LLM scanner instance (for isolated scans)
 */
export function createPreLLMScanner(): PreLLMScanner {
  return new PreLLMScanner();
}

// ============================================
// Convenience Functions
// ============================================

/**
 * Quick scan for lorebook entries only (backward compatibility)
 * Uses the existing lorebook scanner directly
 */
export function quickLorebookScan(
  messages: { role: string; content: string; isDeleted?: boolean }[],
  lorebooks: { id: string; name: string; active: boolean; entries: unknown[]; settings?: unknown }[],
  options: Partial<PreLLMScanOptions> = {}
): { matches: LorebookScanResult[]; content: string; estimatedTokens: number } {
  // Use existing lorebook scanner
  const scanResults = scanForLorebookEntries(
    messages as Parameters<typeof scanForLorebookEntries>[0],
    lorebooks as Parameters<typeof scanForLorebookEntries>[1],
    {
      scanDepth: options.scanDepth,
      caseSensitive: options.caseSensitive,
      matchWholeWords: options.matchWholeWords,
      includeConstants: options.includeConstants
    }
  );

  // Filter by probability
  const probabilityFiltered = filterByProbability(scanResults);

  // Apply token budget
  const budgetFiltered = applyTokenBudget(probabilityFiltered, options.tokenBudget ?? 2048);

  // Build content
  const content = budgetFiltered.map(r => r.entry.content).filter(c => c.trim()).join('\n\n');

  return {
    matches: budgetFiltered,
    content,
    estimatedTokens: estimateTokens(content)
  };
}
