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
  estimateTokens,
  applyTokenBudget,
  isRegexKey,
  parseRegexKey,
  DEFAULT_SCAN_OPTIONS,
  type LorebookScanResult,
  type ScanOptions
} from './scanner';

// Injector exports
export {
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
  type LorebookInjectResult
} from './injector';
