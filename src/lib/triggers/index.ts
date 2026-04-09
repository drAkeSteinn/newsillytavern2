// ============================================
// Triggers Module - Unified Trigger System
// ============================================
//
// This module provides a unified trigger detection and execution system
// that can be used by sounds, sprites, backgrounds, and future trigger types.
//
// Key Features:
// - Unified key detection (all formats: [key], |key|, Peticion:key, etc.)
// - Real-time streaming support
// - Immediate trigger execution
// - Position-based deduplication
// - Support for operators (+, -, =) in values
// - Quest XML tag support

// ============================================
// CORE: Unified Key Detector
// ============================================
export {
  KeyDetector,
  getKeyDetector,
  resetKeyDetector,
  normalizeKey,
  normalizeValue,
  keyMatches,
  keyMatchesAny,
  parseValueWithOperator,
  classifyKey,
  isKeyForHandler,
} from './key-detector';

export type {
  DetectedKey,
  KeyFormat,
  KeyCategory,
  ValueOperator,
  KeyValueInfo,
} from './key-detector';

// ============================================
// TYPES: Unified Handler Types
// ============================================
export type {
  TriggerType,
  TriggerMatch,
  TriggerMatchResult,
  RegisteredKey,
  KeyHandler,
  HandlerProcessResult,
  BatchProcessResult,
  CooldownConfig,
  CooldownState,
  HandlerContext,
} from './types';

// ============================================
// LEGACY: Token Detector (will be deprecated)
// ============================================
/** @deprecated Use KeyDetector instead */
export { 
  TokenDetector, 
  getTokenDetector, 
  resetTokenDetector,
} from './token-detector';

/** @deprecated Use DetectedKey instead */
export type { 
  DetectedToken, 
  TokenType, 
  TokenDetectorConfig 
} from './token-detector';

// ============================================
// BUS: Event System
// ============================================
export { 
  getTriggerBus, 
  resetTriggerBus,
} from './trigger-bus';

export type { 
  TriggerContext, 
  TriggerEvent,
  MessageStartEvent, 
  MessageEndEvent,
  TriggerEventHandler,
} from './trigger-bus';

// ============================================
// COOLDOWN: Global Cooldown Manager
// ============================================
export { 
  getCooldownManager, 
  resetCooldownManager 
} from './cooldown-manager';

// ============================================
// KEY HANDLERS: Unified Handler Implementations
// ============================================
// These handlers implement the unified KeyHandler interface
// and work with KeyDetector for optimal streaming support.
// Each handler supports per-character isolation for group chats.
// ============================================

// Sound Key Handler (Phase 2)
export {
  createSoundKeyHandler,
  resetSoundKeyHandler,
  SoundKeyHandler,
  type SoundKeyHandlerContext,
} from './handlers/sound-key-handler';

// Sprite Key Handler (Phase 2)
export {
  createSpriteKeyHandler,
  resetSpriteKeyHandler,
  SpriteKeyHandler,
  getIdleSpriteUrl,
  type SpriteKeyHandlerContext,
} from './handlers/sprite-key-handler';

// Background Key Handler (Phase 3)
export {
  createBackgroundKeyHandler,
  BackgroundKeyHandler,
  type BackgroundKeyHandlerContext,
} from './handlers/background-key-handler';

// HUD Key Handler (Phase 3)
export {
  createHUDKeyHandler,
  HUDKeyHandler,
  type HUDKeyHandlerContext,
} from './handlers/hud-key-handler';

// Quest Key Handler (Phase 4)
export {
  createQuestKeyHandler,
  QuestKeyHandler,
  type QuestKeyHandlerContext,
} from './handlers/quest-key-handler';

// Stats Key Handler (Phase 4)
export {
  createStatsKeyHandler,
  StatsKeyHandler,
  type StatsKeyHandlerContext,
} from './handlers/stats-key-handler';

// Item Key Handler (Phase 4)
export {
  createItemKeyHandler,
  ItemKeyHandler,
  type ItemKeyHandlerContext,
} from './handlers/item-key-handler';

// Skill Key Handler
export {
  createSkillKeyHandler,
  type SkillKeyHandlerContext,
} from './handlers/skill-key-handler';

// Solicitud Key Handler
export {
  createSolicitudKeyHandler,
  type SolicitudKeyHandlerContext,
  type SolicitudMatchData,
} from './handlers/solicitud-key-handler';

// ============================================
// LEGACY HANDLERS (deprecated - use KeyHandlers instead)
// ============================================

/** 
 * @deprecated Use createSoundKeyHandler instead
 * These will be removed in v2.0.0
 */
export {
  createSoundHandlerState,
  checkSoundTriggers,
  executeSoundTrigger,
  executeAllSoundTriggers,
  resetSoundHandlerState,
  type SoundHandlerState,
  type SoundTriggerContext,
  type SoundHandlerResult,
} from './handlers/sound-handler';

/** 
 * @deprecated Use createSpriteKeyHandler instead
 * These will be removed in v2.0.0
 */
export {
  createSpriteHandlerState,
  checkSpriteTriggers,
  executeSpriteTrigger,
  resetSpriteHandlerState,
  type SpriteHandlerState,
  type SpriteTriggerContext,
  type SpriteHandlerResult,
} from './handlers/sprite-handler';

/** @deprecated Will be replaced by BackgroundKeyHandler */
export {
  createBackgroundHandlerState,
  type BackgroundHandlerState,
} from './handlers/background-handler';

/** @deprecated Will be replaced by HUDKeyHandler */
export {
  createHUDHandlerState,
  checkHUDTriggers,
  executeHUDTrigger,
  resetHUDHandlerState,
  type HUDHandlerState,
  type HUDTriggerContext,
  type HUDHandlerResult,
} from './handlers/hud-handler';

// ============================================
// MAIN HOOK
// ============================================
export { 
  useTriggerSystem,
  type TriggerSystemConfig,
  type TriggerSystemResult,
} from './use-trigger-system';

// ============================================
// UTILITIES: Shared Handler Utilities
// ============================================
export {
  normalizeForMatch,
  stringMatches,
  matchesAny,
  parseNumber,
  parseOperatorValue,
  applyOperator,
  clampValue,
  calculateVolume,
  dbToLinear,
  linearToDb,
  CooldownTracker,
  selectRandom,
  selectCycle,
  selectWeighted,
  isValidUrl,
  isDirectUrl,
  resolveUrl,
  sleep,
  debounce,
  throttle,
  logHandler,
  logMatch,
  isBracketFormat,
  isPipeFormat,
  hasPrefixFormat,
  hasKeyValueFormat,
  parseBracketKey,
  parseKeyValue,
} from './utils';
