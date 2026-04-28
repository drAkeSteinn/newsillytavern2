// ============================================
// Lorebook Module - Main exports
// ============================================

// Scanner exports
export {
  scanForLorebookEntries,
  filterByProbability,
  getEntriesByPosition,
  getEntriesByOutlet,
  groupEntries,
  groupByOutlet,
  groupByPosition,
  estimateTokens,
  applyTokenBudget,
  isRegexKey,
  parseRegexKey,
  formatEntriesWithComments,
  DEFAULT_SCAN_OPTIONS,
  type LorebookScanResult,
  type ScanOptions
} from './scanner';

// Injector exports
export {
  buildLorebookInjectionPlan,
  buildLorebookSection,
  createLorebookPromptSection,
  processLorebooks,
  getLorebookForPosition,
  formatLorebookContext,
  combineLorebookSections,
  hasActiveLorebookEntries,
  getTotalEntryCount,
  DEFAULT_INJECT_OPTIONS,
  type LorebookInjectOptions,
  type LorebookInjectResult,
  type LorebookInjectionPlan,
  type LorebookChatInjection
} from './injector';
