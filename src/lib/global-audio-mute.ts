// ============================================
// Global Audio Mute State (Observable)
// ============================================
//
// Re-exports from the consolidated audio-mute-store.
// This file is kept for backward compatibility —
// any code importing from global-audio-mute.ts
// will now use the same store as audio-mute-store.ts.
//
// ============================================

export { isGlobalMuted as isGloballyMuted, setGlobalMuted as setGlobalMute, onGlobalMuteChange } from './audio-mute-store';
