// ============================================
// Lorebook Module - Main exports
// ============================================

// Scanner exports (used internally by injector)
export {
  scanForLorebookEntries,
  filterByProbability,
  groupEntries,
  groupByOutlet,
  groupByPosition,
  estimateTokens,
  applyTokenBudget,
  applyGroupScoring,
  isRegexKey,
  parseRegexKey,
  formatEntriesWithComments,
  DEFAULT_SCAN_OPTIONS,
  type LorebookScanResult,
  type ScanOptions
} from './scanner';

// Injector exports (used by prompt-builder)
export {
  buildLorebookInjectionPlan,
  type LorebookInjectOptions,
  type LorebookInjectionPlan,
  type LorebookChatInjection
} from './injector';

// Attribute resolver exports (used by prompt-builder and key-resolver)
export {
  resolveLorebookAttributeKeys,
  type LorebookAttributeContext,
  type LorebookAttrDebugEntry
} from './attribute-resolver';
