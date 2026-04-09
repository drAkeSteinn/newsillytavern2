// ============================================
// Pre-LLM Types - Unified scanning system types
// ============================================

import type { ChatMessage, Lorebook, Persona, PromptSection, CharacterMemory } from '@/types';

/**
 * Result of a single Pre-LLM handler match
 */
export interface PreLLMMatchResult {
  /** Type of match */
  type: 'lorebook' | 'memory' | 'relationship' | 'custom';
  /** Handler that produced this match */
  handler: string;
  /** The matched content */
  content: string;
  /** Label for display in prompt viewer */
  label: string;
  /** Color for prompt viewer */
  color: string;
  /** Estimated tokens for this content */
  estimatedTokens: number;
  /** Position in prompt (for ordering) */
  position: number;
}

/**
 * Options for Pre-LLM scanning
 */
export interface PreLLMScanOptions {
  /** Number of messages to scan back */
  scanDepth?: number;
  /** Include case-sensitive matching */
  caseSensitive?: boolean;
  /** Match whole words only */
  matchWholeWords?: boolean;
  /** Token budget for all injected content */
  tokenBudget?: number;
  /** Include constant entries */
  includeConstants?: boolean;
  /** Additional context */
  persona?: Persona;
}

/**
 * Default scan options
 */
export const DEFAULT_PRELLM_OPTIONS: PreLLMScanOptions = {
  scanDepth: 5,
  caseSensitive: false,
  matchWholeWords: false,
  tokenBudget: 2048,
  includeConstants: true,
};

/**
 * Input data for all Pre-LLM handlers
 */
export interface PreLLMInput {
  messages: ChatMessage[];
  lorebooks?: Lorebook[];
  activeLorebookIds?: string[];
  memory?: CharacterMemory;
  characterName?: string;
  options: PreLLMScanOptions;
}

/**
 * Result of the full Pre-LLM scan
 */
export interface PreLLMScanResult {
  /** All matched results */
  matches: PreLLMMatchResult[];
  /** Total estimated tokens */
  totalTokens: number;
  /** Whether token budget was exceeded */
  budgetExceeded: boolean;
  /** Content ready for prompt injection */
  injectedContent: string;
  /** Prompt sections for the prompt builder */
  sections: PromptSection[];
}

/**
 * Handler function type
 */
export type PreLLMHandler = (input: PreLLMInput) => PreLLMMatchResult[];
