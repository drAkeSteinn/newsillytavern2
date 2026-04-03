// ============================================
// Trigger Handlers Index
// ============================================

// ============================================
// LEGACY HANDLERS (Deprecated)
// ============================================
// These handlers use the old TokenDetector system and are kept
// for backward compatibility only. They will be removed in v2.0.0.
//
// MIGRATION GUIDE:
// - sound-handler → sound-key-handler
// - sprite-handler → sprite-key-handler  
// - background-handler → background-key-handler
// - hud-handler → hud-key-handler
// - quest-handler → quest-key-handler
// - stats-handler → stats-key-handler
// - item-handler → item-key-handler
// ============================================

/** @deprecated Use sound-key-handler instead */
export * from './sound-handler';
/** @deprecated Use sprite-key-handler instead */
export * from './sprite-handler';
/** @deprecated Use background-key-handler instead */
export * from './background-handler';
/** @deprecated Not actively used - atmosphere system pending refactor */
export * from './atmosphere-handler';
/** @deprecated Use quest-key-handler instead */
export * from './quest-handler';
/** @deprecated Use item-key-handler instead */
export * from './item-handler';
/** @deprecated Use stats-key-handler instead */
export * from './stats-handler';
/** @deprecated Use skill-key-handler from main triggers index instead */
export * from './skill-activation-handler';

// ============================================
// UNIFIED KEYHANDLER IMPLEMENTATIONS (Recommended)
// ============================================
// These handlers implement the unified KeyHandler interface
// and work with the KeyDetector for better streaming support
// and group chat isolation.
// ============================================

export * from './sound-key-handler';
export * from './sprite-key-handler';
export * from './background-key-handler';
export * from './hud-key-handler';
export * from './quest-key-handler';
export * from './stats-key-handler';
export * from './item-key-handler';
