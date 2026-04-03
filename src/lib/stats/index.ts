// ============================================
// Stats Module - Character stats system
// ============================================
//
// This module provides:
// - Pre-LLM: Resolution of {{key}} templates in character content
// - Post-LLM: Detection of keyword patterns to update stats
//
// Usage:
// ```tsx
// import { resolveStats, resolveStatsInText, detectStatsUpdates } from '@/lib/stats';
//
// // Pre-LLM: Resolve stats before building prompt
// const resolved = resolveStats({
//   characterId: 'char-001',
//   statsConfig: character.statsConfig,
//   sessionStats: session.sessionStats
// });
//
// // Resolve keys in text
// const processedText = resolveStatsInText(character.description, resolved);
//
// // Post-LLM: Detect updates in response
// const updates = detectStatsUpdates(llmResponse, character.statsConfig);
// ```

// Resolver (Pre-LLM)
export {
  resolveStats,
  resolveStatsInText,
  resolveAttributeKey,
  resolveAllAttributes,
  getCharacterSessionStats,
  getAttributeValue,
  formatAttributeValue,
  buildSkillsBlock,
  buildIntentionsBlock,
  buildInvitationsBlock,
  extractStatsKeys,
  hasStatsKeys,
  isBlockKey,
  buildStatsPromptSections,
  type StatsResolutionContext,
  type ResolvedAttribute,
} from './stats-resolver';

// Detector (Post-LLM)
export {
  detectStatsUpdates,
  detectAttributeUpdates,
  parseStatValue,
  type StatsDetectionResult,
  type AttributeDetection,
} from './stats-detector';
