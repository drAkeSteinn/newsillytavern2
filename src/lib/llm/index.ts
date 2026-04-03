// ============================================
// LLM Module - Main exports
// ============================================

// Types
export * from './types';

// Utilities
export * from './utils';

// Prompt building
export * from './prompt-builder';

// Streaming functions
export * from './streaming';

// Generation functions
export * from './generation';

// Providers
export * from './providers';

// Re-export key resolver functions for convenience
export {
  resolveAllKeys,
  resolveAllKeysWithPasses,
  resolveTemplateVariables,
  resolveStatsKeys,
  resolveSectionKeys,
  resolveSectionsKeys,
  resolveSectionsKeysWithPasses,
  buildKeyResolutionContext,
  buildGroupKeyResolutionContext,
  processCharacterKeys,
  processMessageKeys,
  type KeyResolutionContext,
} from '@/lib/key-resolver';

// Re-export stats resolver for convenience
export {
  resolveStats,
  resolveStatsInText,
  type StatsResolutionContext,
} from '@/lib/stats';
