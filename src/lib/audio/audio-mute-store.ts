// ============================================
// Global Audio Mute Store
// ============================================
//
// Simple module-level mutable store for global audio muting.
// NOT React state, NOT Zustand — just plain module-level variables.
// This allows import from both React and non-React code
// (audio queue processing, timeline player, etc.)
//
// ============================================

let globalMuted = false;

/** Check if global audio is muted */
export function isGlobalMuted(): boolean {
  return globalMuted;
}

/** Set global audio mute state */
export function setGlobalMuted(muted: boolean): void {
  globalMuted = muted;
}
