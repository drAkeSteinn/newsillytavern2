// ============================================
// Global Audio Mute Store
// ============================================
//
// Simple module-level mutable store for global audio muting.
// NOT React state, NOT Zustand — just plain module-level variables.
// This allows import from both React and non-React code
// (audio queue processing, timeline player, etc.)
//
// Supports listener callbacks so that consumers (timeline sounds,
// haptic playback, etc.) can react immediately when mute changes.
//
// ============================================

let globalMuted = false;
const listeners = new Set<(muted: boolean) => void>();

/** Check if global audio is muted */
export function isGlobalMuted(): boolean {
  return globalMuted;
}

/** Set global audio mute state and notify listeners */
export function setGlobalMuted(muted: boolean): void {
  if (globalMuted === muted) return;
  globalMuted = muted;
  listeners.forEach(cb => {
    try { cb(muted); } catch { /* ignore */ }
  });
}

/** Subscribe to mute state changes. Returns unsubscribe function. */
export function onGlobalMuteChange(callback: (muted: boolean) => void): () => void {
  listeners.add(callback);
  return () => { listeners.delete(callback); };
}
