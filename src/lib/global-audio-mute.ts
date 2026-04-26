/**
 * Global Audio Mute State
 *
 * Lightweight mutable state for mute control across all audio systems.
 * This is needed because some audio players (AudioBus, TimelineSoundPlayer)
 * run outside React and can't subscribe to the Zustand store directly.
 *
 * The chatbox mute button updates both the Zustand settings (for persistence)
 * and this global state (for immediate effect on non-React audio modules).
 */

let _globalMuted = false;
const _listeners = new Set<() => void>();

/** Check if audio is globally muted */
export function isGloballyMuted(): boolean {
  return _globalMuted;
}

/** Set global mute state and notify listeners */
export function setGlobalMute(muted: boolean): void {
  if (_globalMuted === muted) return;
  _globalMuted = muted;
  _listeners.forEach(cb => {
    try { cb(); } catch {}
  });
}

/** Subscribe to mute state changes */
export function onMuteChange(callback: () => void): () => void {
  _listeners.add(callback);
  return () => _listeners.delete(callback);
}
