// ============================================
// Use Timeline Sprite Sounds Hook
// ============================================
//
// This hook connects sprite display (idle, trigger, talk, thinking)
// with timeline sound AND haptic playback.
//
// When a sprite is displayed in the chat scene, it:
// 1. Extracts the collection name from the sprite URL
// 2. Loads the metadata.json from that collection
// 3. Finds the sprite's timeline configuration
// 4. Plays sounds at keyframe times (via requestAnimationFrame loop)
// 5. Plays haptic patterns via HSP (Handy Server Pattern)
//
// HSP vs HDSP approach:
// - HSP preloads ALL points into the device buffer before playing
// - The device handles timing, interpolation, and looping natively
// - This eliminates network latency, loop wraparound jumps, and erratic velocity
// - Sound tracks still use requestAnimationFrame for precise keyframe triggering
//
// Supports: idle sprites, trigger sprites, WEBP/GIF/WebM
// ============================================

import { useEffect, useRef } from 'react';
import { useTavernStore } from '@/store';
import type {
  SpriteTimelineData,
  TimelineTrack,
  HapticKeyframeValue,
  SoundTrigger,
  SoundCollection,
  CharacterCard,
  SpritePackV2,
  StateCollectionV2,
} from '@/types';
import { isGlobalMuted } from '@/lib/audio/audio-mute-store';
import { generateHspPattern } from '@/lib/haptic/hsp-pattern-generator';
import type { HspPoint } from '@/hooks/use-haptic-playback';

// ============================================
// Types
// ============================================

interface SpriteMetadata {
  label?: string;
  filename: string;
  duration?: number;
  timeline?: SpriteTimelineData;
}

interface CollectionMetadata {
  version: number;
  collectionName: string;
  sprites: Record<string, SpriteMetadata>;
}

interface ActiveTimeline {
  spriteUrl: string;
  startTime: number;
  duration: number;
  loop: boolean;
  activeAudios: Map<string, HTMLAudioElement[]>;
  triggeredKeyframes: Set<string>;
  timelineData: SpriteTimelineData;
  soundTriggers: SoundTrigger[];
  soundCollections: SoundCollection[];
  characterId: string;
  // HSP state for this timeline
  hspPlaying: boolean;
  // Pause state — elapsed time (ms) when paused, null when not paused
  pauseElapsed: number | null;
}

// ============================================
// Audio Cache
// ============================================

const audioCache = new Map<string, HTMLAudioElement>();

function getAudio(url: string): HTMLAudioElement {
  if (!audioCache.has(url)) {
    const audio = new Audio(url);
    audio.load();
    audioCache.set(url, audio);
  }
  return audioCache.get(url)!;
}

// ============================================
// Global State
// ============================================

const activeTimelines = new Map<string, ActiveTimeline>();
const collectionMetadataCache = new Map<string, CollectionMetadata>();

// Loop checker state (only for sound tracks now)
let loopCheckerRunning = false;
let loopAnimationId: number | null = null;

// ============================================
// Haptic Config Helpers
// ============================================

interface HandyConfig {
  appId: string;
  connectionKey: string;
}

function readHandyConfig(): HandyConfig | null {
  try {
    const storageKey = 'tavernflow-storage';
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      const handySettings = parsed?.state?.settings?.handy;
      if (handySettings?.appId && handySettings?.connectionKey) {
        return { appId: handySettings.appId, connectionKey: handySettings.connectionKey };
      }
    }
    const saved = localStorage.getItem('handy-config');
    if (saved) {
      const cfg = JSON.parse(saved) as HandyConfig;
      if (cfg.appId && cfg.connectionKey) return cfg;
    }
  } catch { /* ignore */ }
  return null;
}

function readHapticEnabled(): boolean {
  try {
    const storageKey = 'tavernflow-storage';
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      const handySettings = parsed?.state?.settings?.handy;
      if (handySettings?.enabled !== undefined) return handySettings.enabled;
    }
    return localStorage.getItem('handy-haptic-enabled') === 'true';
  } catch { return false; }
}

function readInverted(): boolean {
  try {
    const storageKey = 'tavernflow-storage';
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      const handySettings = parsed?.state?.settings?.handy;
      if (handySettings?.positionInverted !== undefined) return handySettings.positionInverted;
    }
    return localStorage.getItem('handy-inverted') === 'true';
  } catch { return false; }
}

// ============================================
// HSP Pattern Playback (via REST API proxy)
// ============================================
//
// These functions handle HSP pattern playback directly via the
// /api/handy/hsp/* endpoints. They don't use the React hook
// because they're called from non-React contexts (global functions).
//
// Flow:
//   1. Get server time for sync
//   2. Set device mode to HSP (mode 4)
//   3. Set slider stroke to full range
//   4. HSP setup (assign stream ID)
//   5. HSP add (send points in batches)
//   6. HSP play (with server_time, loop flag)
//   7. On stop: HSP stop → HSP flush → center device

let serverTimeOffset: number = 0;

/**
 * NTP-style server time sync with multiple samples and outlier removal.
 * Matches the approach in use-haptic-playback.ts.
 */
const TIMELINE_SYNC_SAMPLES = 8;
const TIMELINE_SYNC_OUTLIERS = 2;

async function syncServerTime(): Promise<void> {
  const samples: Array<{ offset: number; rtd: number }> = [];

  for (let i = 0; i < TIMELINE_SYNC_SAMPLES; i++) {
    try {
      const startLocal = Date.now();
      const response = await fetch('/api/handy/servertime', {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      const endLocal = Date.now();
      const data = await response.json();
      // Handy API v3 /servertime returns: { result: { server_time: number } }
      const serverTime = data?.result?.server_time ?? data?.result ?? data;

      if (typeof serverTime === 'number' && serverTime > 0) {
        const rtd = endLocal - startLocal;
        const estimatedLocalAtServer = startLocal + rtd / 2;
        const offset = serverTime - estimatedLocalAtServer;
        samples.push({ offset, rtd });
      }
    } catch {
      // Skip failed samples
    }
  }

  if (samples.length > 0) {
    // Sort by round-trip delay and remove worst outliers
    samples.sort((a, b) => a.rtd - b.rtd);
    const trimmed = samples.slice(0, Math.max(1, samples.length - TIMELINE_SYNC_OUTLIERS));

    let offsetAccum = 0;
    for (const s of trimmed) {
      offsetAccum += s.offset;
    }
    serverTimeOffset = offsetAccum / trimmed.length;
  }
  // Keep existing offset if all samples failed
}

function estimateServerTime(): number {
  // Per Handy API v3 reference: estimate = Math.round(Date.now() + offset)
  return Math.round(Date.now() + serverTimeOffset);
}

async function setHandyMode(mode: number): Promise<boolean> {
  const config = readHandyConfig();
  if (!config) return false;
  try {
    const response = await fetch('/api/handy/mode2', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId: config.appId,
        connectionKey: config.connectionKey,
        mode,
      }),
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function setSliderStroke(min: number, max: number): Promise<void> {
  const config = readHandyConfig();
  if (!config) return;
  try {
    await fetch('/api/handy/slider/stroke', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId: config.appId,
        connectionKey: config.connectionKey,
        min,
        max,
      }),
    });
  } catch { /* non-critical */ }
}

/**
 * Start HSP pattern playback for a timeline's haptic tracks.
 * Converts keyframes to HSP points, loads them into the device, and starts playback.
 */
async function startHspPatternPlayback(
  timeline: SpriteTimelineData,
): Promise<boolean> {
  const config = readHandyConfig();
  if (!config || !readHapticEnabled()) return false;

  const { appId, connectionKey } = config;
  const inverted = readInverted();

  // Find haptic tracks
  const hapticTracks = timeline.tracks.filter(
    (t) => t.type === 'haptic' && !t.muted && t.enabled && t.keyframes.length > 0
  );

  if (hapticTracks.length === 0) return false;

  // Convert haptic keyframes to HSP points
  // For multiple haptic tracks, merge them (use the first active track)
  // In practice, there's usually only one haptic track per timeline
  const track = hapticTracks[0];
  const keyframes = track.keyframes.map((kf) => ({
    time: kf.time,
    value: kf.value as HapticKeyframeValue,
    interpolation: kf.interpolation,
  }));

  const points = generateHspPattern(keyframes, timeline.duration || 5000, timeline.loop);

  if (points.length === 0) return false;

  // Apply inversion to all points
  const adjustedPoints = inverted
    ? points.map((p) => ({ t: p.t, x: 100 - p.x }))
    : points;

  console.log('[Timeline-HSP] 🎮 Starting HSP pattern playback:', {
    points: adjustedPoints.length,
    duration: timeline.duration,
    loop: timeline.loop,
    firstPoint: adjustedPoints[0],
    lastPoint: adjustedPoints[adjustedPoints.length - 1],
  });

  try {
    // 1. Sync server time (multiple samples with outlier removal)
    await syncServerTime();

    // 2. Set device mode to HSP (mode 4)
    const modeSet = await setHandyMode(4);
    if (!modeSet) {
      console.warn('[Timeline-HSP] ⚠️ Failed to switch to HSP mode');
      return false;
    }

    // 3. Set slider stroke to full range
    await setSliderStroke(0, 1.0);

    // 4. HSP setup
    const streamId = Math.floor(Math.random() * 1024);
    const setupResponse = await fetch('/api/handy/hsp/setup', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId, connectionKey, stream_id: streamId }),
      signal: AbortSignal.timeout(5000),
    });

    if (!setupResponse.ok) {
      console.error('[Timeline-HSP] ❌ HSP setup failed:', setupResponse.status);
      return false;
    }

    // 5. HSP add - send initial batch
    const initialBatch = adjustedPoints.slice(0, 10);
    const addResponse = await fetch('/api/handy/hsp/add', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId,
        connectionKey,
        flush: false,
        points: initialBatch,
        tail_point_stream_index: initialBatch.length - 1,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!addResponse.ok) {
      console.error('[Timeline-HSP] ❌ HSP add (initial) failed');
      return false;
    }

    // 6. HSP play - use current estimated server time directly
    // (matching the reference implementation approach)
    const playServerTime = estimateServerTime();
    const playResponse = await fetch('/api/handy/hsp/play', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId,
        connectionKey,
        server_time: playServerTime,
        start_time: 0,
        loop: timeline.loop,
        playback_rate: 1,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!playResponse.ok) {
      console.error('[Timeline-HSP] ❌ HSP play failed');
      return false;
    }

    // 7. Send remaining points in batches
    if (adjustedPoints.length > 10) {
      const remaining = adjustedPoints.slice(10);
      const batchCount = Math.ceil(remaining.length / 100);
      let sentCount = 10;

      for (let i = 0; i < batchCount; i++) {
        const batchPoints = remaining.slice(i * 100, (i + 1) * 100);
        sentCount += batchPoints.length;

        try {
          await fetch('/api/handy/hsp/add', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              appId,
              connectionKey,
              flush: false,
              points: batchPoints,
              tail_point_stream_index: sentCount - 1,
            }),
            signal: AbortSignal.timeout(5000),
          });
        } catch {
          console.warn(`[Timeline-HSP] ⚠️ Error sending batch ${i + 1}/${batchCount}`);
        }
      }
    }

    console.log('[Timeline-HSP] ✅ HSP pattern playback started successfully');
    return true;

  } catch (err) {
    console.error('[Timeline-HSP] ❌ Error:', err);
    return false;
  }
}

/**
 * Stop HSP pattern playback and return device to center.
 */
async function stopHspPatternPlayback(): Promise<void> {
  const config = readHandyConfig();
  if (!config) return;

  const { appId, connectionKey } = config;
  const inverted = readInverted();

  try {
    // 1. Stop HSP
    await fetch('/api/handy/hsp/stop', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId, connectionKey }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});

    // 2. Flush buffer
    await fetch('/api/handy/hsp/flush', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId, connectionKey }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});

    // 3. Switch to HDSP mode and center device
    await setHandyMode(2);

    const centerPos = inverted ? 0.5 : 0.5;
    await fetch('/api/handy/hdsp/xpvp', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId,
        connectionKey,
        xp: centerPos,
        vp: 0.3,
        stop_on_target: true,
        immediate_rsp: true,
      }),
    }).catch(() => {});

    // 4. Stop HAMP
    setTimeout(() => {
      fetch('/api/handy/hamp/stop', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, connectionKey }),
      }).catch(() => {});
    }, 300);

  } catch (err) {
    console.error('[Timeline-HSP] ❌ Error stopping:', err);
  }
}

// ============================================
// Collection Metadata Loader
// ============================================

async function loadCollectionMetadata(collectionName: string): Promise<CollectionMetadata | null> {
  if (collectionMetadataCache.has(collectionName)) {
    return collectionMetadataCache.get(collectionName)!;
  }

  try {
    const response = await fetch(`/sprites/${collectionName}/metadata.json`);
    if (!response.ok) return null;

    const metadata: CollectionMetadata = await response.json();
    collectionMetadataCache.set(collectionName, metadata);
    return metadata;
  } catch {
    return null;
  }
}

// ============================================
// URL Helpers
// ============================================

function extractCollectionFromUrl(spriteUrl: string): string | null {
  const match = spriteUrl.match(/\/sprites\/([^/]+)\//);
  return match ? match[1] : null;
}

function extractFilenameFromUrl(spriteUrl: string): string | null {
  const parts = spriteUrl.split('/');
  return parts[parts.length - 1] || null;
}

// ============================================
// Sound Playback Functions
// ============================================

async function playSoundFromTrigger(
  trigger: SoundTrigger,
  collections: SoundCollection[],
  volume: number = 1
): Promise<HTMLAudioElement | null> {
  if (isGlobalMuted()) return null;
  const collection = collections.find(c => c.name === trigger.collection);
  if (!collection || !collection.files || collection.files.length === 0) return null;

  let soundFile: string;
  if (trigger.playMode === 'random') {
    soundFile = collection.files[Math.floor(Math.random() * collection.files.length)];
  } else {
    const index = trigger.currentIndex || 0;
    soundFile = collection.files[index % collection.files.length];
  }

  try {
    const baseAudio = getAudio(soundFile);
    const audioClone = baseAudio.cloneNode() as HTMLAudioElement;
    audioClone.volume = volume * (trigger.volume || 1);
    audioClone.currentTime = 0;
    await audioClone.play().catch(() => {});
    return audioClone;
  } catch {
    return null;
  }
}

async function playSoundFromUrl(
  url: string,
  volume: number = 1
): Promise<HTMLAudioElement | null> {
  if (isGlobalMuted()) return null;
  try {
    const baseAudio = getAudio(url);
    const audioClone = baseAudio.cloneNode() as HTMLAudioElement;
    audioClone.volume = volume;
    audioClone.currentTime = 0;
    await audioClone.play().catch(() => {});
    return audioClone;
  } catch {
    return null;
  }
}

// ============================================
// Timeline Sound Player
// ============================================

function playSoundsAtTime(
  timeline: SpriteTimelineData,
  currentTime: number,
  soundTriggers: SoundTrigger[],
  soundCollections: SoundCollection[],
  active: ActiveTimeline,
  toleranceMs: number = 150
): void {
  if (isGlobalMuted()) return;
  const globalVolume = timeline.globalVolume ?? 1;

  for (const track of timeline.tracks) {
    if (track.muted || !track.enabled) continue;

    // Only process sound tracks
    const isSoundTrack = track.type === 'sound' || (
      track.type === 'sprite' && track.keyframes.some(kf => {
        const val = kf.value as unknown as Record<string, unknown>;
        return val?.soundTriggerId || val?.play;
      })
    );

    if (!isSoundTrack) continue;

    const trackId = track.id;

    for (const keyframe of track.keyframes) {
      const keyframeId = keyframe.id;
      const keyframeTime = keyframe.time;

      const isCrossing = currentTime >= keyframeTime && currentTime < keyframeTime + toleranceMs;

      if (isCrossing && !active.triggeredKeyframes.has(keyframeId)) {
        active.triggeredKeyframes.add(keyframeId);

        const soundValue = keyframe.value as {
          soundTriggerId?: string;
          soundTriggerName?: string;
          soundUrl?: string;
          volume?: number;
          play?: boolean;
          stop?: boolean;
        };

        if (soundValue.play) {
          (async () => {
            let audioEl: HTMLAudioElement | null = null;

            if (soundValue.soundTriggerId) {
              let trigger = soundTriggers.find(t => t.id === soundValue.soundTriggerId);

              if (!trigger && soundValue.soundTriggerName) {
                trigger = soundTriggers.find(t =>
                  t.name.toLowerCase() === soundValue.soundTriggerName!.toLowerCase()
                );
              }

              if (trigger) {
                audioEl = await playSoundFromTrigger(
                  trigger,
                  soundCollections,
                  (soundValue.volume || 1) * globalVolume
                );
              }
            }
            else if (soundValue.soundUrl) {
              audioEl = await playSoundFromUrl(
                soundValue.soundUrl,
                (soundValue.volume || 1) * globalVolume
              );
            }

            if (audioEl) {
              const trackAudios = active.activeAudios.get(trackId) || [];
              trackAudios.push(audioEl);
              active.activeAudios.set(trackId, trackAudios);
              audioEl.onended = () => {
                const idx = trackAudios.indexOf(audioEl!);
                if (idx > -1) trackAudios.splice(idx, 1);
              };
            }
          })();
        }

        if (soundValue.stop) {
          const trackAudios = active.activeAudios.get(trackId) || [];
          for (const audio of trackAudios) {
            audio.pause();
            audio.remove();
          }
          trackAudios.length = 0;
        }
      }

      // Reset trigger for keyframes we've passed (for looping)
      if (currentTime < keyframeTime - toleranceMs) {
        active.triggeredKeyframes.delete(keyframeId);
      }
    }
  }
}

// ============================================
// Loop Checker - Only for Sound Tracks
// ============================================
// HSP handles haptic playback natively - no need for requestAnimationFrame
// haptic updates. This loop only triggers sound keyframes.

function startLoopChecker() {
  if (loopCheckerRunning) return;

  loopCheckerRunning = true;

  const check = () => {
    if (activeTimelines.size === 0) {
      loopCheckerRunning = false;
      loopAnimationId = null;
      return;
    }

    // If globally muted, keep the loop running but skip processing
    if (isGlobalMuted()) {
      loopAnimationId = requestAnimationFrame(check);
      return;
    }

    const now = Date.now();

    for (const [, active] of activeTimelines) {
      // Skip paused timelines
      if (active.pauseElapsed !== null) continue;

      // Only process sound tracks via the loop checker
      const hasSoundTracks = active.timelineData.tracks.some(t =>
        !t.muted && t.enabled && (t.type === 'sound' || (
          t.type === 'sprite' && t.keyframes.some(kf => {
            const val = kf.value as unknown as Record<string, unknown>;
            return val?.soundTriggerId || val?.play;
          })
        ))
      );

      if (hasSoundTracks) {
        const elapsed = now - active.startTime;
        const currentTime = elapsed % active.duration;
        playSoundsAtTime(
          active.timelineData,
          currentTime,
          active.soundTriggers,
          active.soundCollections,
          active
        );
      }
    }

    loopAnimationId = requestAnimationFrame(check);
  };

  loopAnimationId = requestAnimationFrame(check);
}

// ============================================
// Start/Stop Timeline
// ============================================

/**
 * Pause ALL active timelines (sounds + haptic).
 * Keeps timeline state so it can be resumed later.
 * Called when the user presses the global mute button.
 */
function pauseAllTimelines(): void {
  if (activeTimelines.size === 0) return;

  console.log('[Timeline] ⏸ Pausing all timelines (mute on) — count:', activeTimelines.size);

  const now = Date.now();

  for (const [characterId, active] of activeTimelines) {
    // Store elapsed time so we can resume from this position
    const elapsed = now - active.startTime;
    if (active.loop) {
      active.pauseElapsed = elapsed % active.duration;
    } else {
      active.pauseElapsed = Math.min(elapsed, active.duration);
    }

    // Pause all audio elements for this timeline
    for (const [, audios] of active.activeAudios) {
      for (const audio of audios) {
        audio.pause();
        audio.remove();
      }
    }
    active.activeAudios.clear();

    // If this timeline was playing HSP, stop it (HSP doesn't support pause natively)
    if (active.hspPlaying) {
      stopHspPatternPlayback();
      active.hspPlaying = false;
    }
  }

  // Cancel the loop checker (will be restarted on resume)
  if (loopAnimationId) {
    cancelAnimationFrame(loopAnimationId);
    loopAnimationId = null;
    loopCheckerRunning = false;
  }

  // Ensure haptic device is stopped and centered
  if (readHapticEnabled()) {
    const config = readHandyConfig();
    if (config) {
      const inverted = readInverted();
      const centerPos = inverted ? 0.5 : 0.5;
      fetch('/api/handy/hdsp/xpvp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: config.appId,
          connectionKey: config.connectionKey,
          xp: centerPos,
          vp: 0.3,
          stop_on_target: true,
          immediate_rsp: true,
        }),
      }).catch(() => {});
      setTimeout(() => {
        fetch('/api/handy/hamp/stop', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appId: config.appId,
            connectionKey: config.connectionKey,
          }),
        }).catch(() => {});
      }, 500);
    }
  }
}

/**
 * Resume ALL paused timelines (sounds + haptic).
 * Called when the user turns off global mute.
 * Restarts playback from the position where it was paused.
 */
function resumeAllTimelines(): void {
  if (activeTimelines.size === 0) return;

  console.log('[Timeline] ▶️ Resuming all timelines (mute off) — count:', activeTimelines.size);

  const now = Date.now();
  let hasSoundTracks = false;

  for (const [characterId, active] of activeTimelines) {
    if (active.pauseElapsed === null) continue; // Not paused, skip

    // Adjust startTime so elapsed time resumes from the paused position
    // now - startTime = pauseElapsed  →  startTime = now - pauseElapsed
    active.startTime = now - active.pauseElapsed;
    active.pauseElapsed = null; // Clear pause state

    // Reset triggered keyframes so sounds will re-trigger correctly
    // at the resumed position
    active.triggeredKeyframes.clear();

    // Check if this timeline has sound tracks
    const timelineHasSounds = active.timelineData.tracks.some(t =>
      !t.muted && t.enabled && (t.type === 'sound' || (
        t.type === 'sprite' && t.keyframes.some(kf => {
          const val = kf.value as unknown as Record<string, unknown>;
          return val?.soundTriggerId || val?.play;
        })
      ))
    );

    if (timelineHasSounds) {
      hasSoundTracks = true;
    }

    // Restart HSP pattern playback for haptic tracks (from the beginning of the pattern)
    const hasHapticTracks = readHapticEnabled() && active.timelineData.tracks.some(
      t => t.type === 'haptic' && !t.muted && t.enabled && t.keyframes.length > 0
    );

    if (hasHapticTracks) {
      (async () => {
        await stopHspPatternPlayback().catch(() => {});
        const success = await startHspPatternPlayback(active.timelineData);
        if (success) {
          const tl = activeTimelines.get(characterId);
          if (tl) tl.hspPlaying = true;
          console.log('[Timeline] 🎮 HSP pattern playback resumed');
        }
      })();
    }
  }

  // Restart the loop checker for sound tracks
  if (hasSoundTracks) {
    startLoopChecker();
  }
}

/**
 * Stop ALL active timelines (sounds + haptic) and clear state.
 * Used when the sprite changes or when a full stop is needed.
 */
function stopAllTimelines(): void {
  if (activeTimelines.size === 0) return;

  console.log('[Timeline] ⏹ Stopping all timelines — count:', activeTimelines.size);

  for (const [characterId, active] of activeTimelines) {
    // Stop all audio elements for this timeline
    for (const [, audios] of active.activeAudios) {
      for (const audio of audios) {
        audio.pause();
        audio.remove();
      }
    }
    active.activeAudios.clear();

    // If this timeline was playing HSP, stop it
    if (active.hspPlaying) {
      stopHspPatternPlayback();
      active.hspPlaying = false;
    }
  }

  // Clear all active timelines
  activeTimelines.clear();

  // Stop the loop checker
  if (loopAnimationId) {
    cancelAnimationFrame(loopAnimationId);
    loopAnimationId = null;
    loopCheckerRunning = false;
  }

  // Ensure haptic device is stopped and centered
  if (readHapticEnabled()) {
    const config = readHandyConfig();
    if (config) {
      const inverted = readInverted();
      const centerPos = inverted ? 0.5 : 0.5;
      fetch('/api/handy/hdsp/xpvp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: config.appId,
          connectionKey: config.connectionKey,
          xp: centerPos,
          vp: 0.3,
          stop_on_target: true,
          immediate_rsp: true,
        }),
      }).catch(() => {});
      setTimeout(() => {
        fetch('/api/handy/hamp/stop', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appId: config.appId,
            connectionKey: config.connectionKey,
          }),
        }).catch(() => {});
      }, 500);
    }
  }
}

function stopTimeline(characterId: string) {
  const active = activeTimelines.get(characterId);
  if (!active) return;

  // Stop all audio elements
  for (const [, audios] of active.activeAudios) {
    for (const audio of audios) {
      audio.pause();
      audio.remove();
    }
  }

  // If this timeline was playing HSP, stop it
  if (active.hspPlaying) {
    stopHspPatternPlayback();
  }

  activeTimelines.delete(characterId);

  // If no more active timelines, ensure device is stopped
  if (activeTimelines.size === 0 && readHapticEnabled()) {
    // HSP stop already called above, but ensure device is centered
    const config = readHandyConfig();
    if (config) {
      const inverted = readInverted();
      const centerPos = inverted ? 0.5 : 0.5;
      fetch('/api/handy/hdsp/xpvp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: config.appId,
          connectionKey: config.connectionKey,
          xp: centerPos,
          vp: 0.3,
          stop_on_target: true,
          immediate_rsp: true,
        }),
      }).catch(() => {});
      setTimeout(() => {
        fetch('/api/handy/hamp/stop', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appId: config.appId,
            connectionKey: config.connectionKey,
          }),
        }).catch(() => {});
      }, 500);
    }
  }
}

function startTimeline(
  characterId: string,
  spriteUrl: string,
  timeline: SpriteTimelineData,
  soundTriggers: SoundTrigger[],
  soundCollections: SoundCollection[]
): void {
  // Stop any existing timeline for this character
  stopTimeline(characterId);

  // Check if there are any playable tracks
  const hasSoundTracks = timeline.tracks.some(t => !t.muted && t.enabled && (
    t.type === 'sound' || (
      t.type === 'sprite' && t.keyframes.some(kf => {
        const val = kf.value as unknown as Record<string, unknown>;
        return val?.soundTriggerId || val?.play;
      })
    )
  ));

  const hasHapticTracks = readHapticEnabled() && timeline.tracks.some(
    t => t.type === 'haptic' && !t.muted && t.enabled && t.keyframes.length > 0
  );

  if (!hasSoundTracks && !hasHapticTracks) return;

  const active: ActiveTimeline = {
    spriteUrl,
    startTime: Date.now(),
    duration: timeline.duration || 5000,
    loop: timeline.loop,
    activeAudios: new Map(),
    triggeredKeyframes: new Set(),
    timelineData: timeline,
    soundTriggers,
    soundCollections,
    characterId,
    hspPlaying: false,
    pauseElapsed: null,
  };

  // If globally muted, start in paused state (will be resumed when unmuted)
  if (isGlobalMuted()) {
    active.pauseElapsed = 0; // Paused at the beginning
    activeTimelines.set(characterId, active);

    console.log('[Timeline] ⏸ Started (paused, global mute active) for', characterId.substring(0, 8), {
      duration: timeline.duration,
      sounds: hasSoundTracks,
      haptic: hasHapticTracks,
      url: spriteUrl.split('/').pop(),
    });
    return;
  }

  activeTimelines.set(characterId, active);

  console.log('[Timeline] ▶️ Started for', characterId.substring(0, 8), {
    duration: timeline.duration,
    sounds: hasSoundTracks,
    haptic: hasHapticTracks,
    url: spriteUrl.split('/').pop(),
  });

  // Start the loop checker for sound tracks
  if (hasSoundTracks) {
    startLoopChecker();

    // Play initial sounds at time 0
    playSoundsAtTime(timeline, 0, soundTriggers, soundCollections, active);
  }

  // Start HSP pattern playback for haptic tracks
  // Use async IIFE to properly await stop before starting new session
  if (hasHapticTracks) {
    (async () => {
      // Ensure any previous HSP playback is fully stopped before starting new one
      // This prevents race conditions where two HSP sessions run simultaneously
      await stopHspPatternPlayback().catch(() => {});

      const success = await startHspPatternPlayback(timeline);
      if (success) {
        const tl = activeTimelines.get(characterId);
        if (tl) tl.hspPlaying = true;
        console.log('[Timeline] 🎮 HSP pattern playback started');
      } else {
        console.warn('[Timeline] ⚠️ HSP pattern playback failed to start');
      }
    })();
  }
}

// ============================================
// Idle Sprite URL Resolver
// ============================================

function computeIdleSpriteUrl(
  spriteState: string,
  character: CharacterCard | undefined,
  characterId: string,
): string | null {
  if (!character) return null;

  const hasV2Collections = !!(character.stateCollectionsV2 && character.stateCollectionsV2.length > 0);
  const hasV2Packs = !!(character.spritePacksV2 && character.spritePacksV2.length > 0);

  if (!hasV2Collections || !hasV2Packs) return null;

  const stateCollection = character.stateCollectionsV2!.find(
    (c: StateCollectionV2) => c.state === spriteState
  );
  if (!stateCollection) return null;

  const pack = character.spritePacksV2!.find(
    (p: SpritePackV2) => p.id === stateCollection.packId
  );
  if (!pack || pack.sprites.length === 0) return null;

  switch (stateCollection.behavior) {
    case 'principal': {
      if (stateCollection.principalSpriteId) {
        const principal = pack.sprites.find(s => s.id === stateCollection.principalSpriteId);
        if (principal) return principal.url;
      }
      return pack.sprites[0]?.url || null;
    }
    case 'random':
    case 'list': {
      return pack.sprites[0]?.url || null;
    }
    default:
      return pack.sprites[0]?.url || null;
  }
}

// ============================================
// Main Hook
// ============================================

export function useTimelineSpriteSounds() {
  const characterSpriteStates = useTavernStore((state) => state.characterSpriteStates);
  const soundTriggers = useTavernStore((state) => state.soundTriggers ?? []);
  const soundCollections = useTavernStore((state) => state.soundCollections ?? []);
  const characters = useTavernStore((state) => state.characters ?? []);

  const characterMap = useRef<Map<string, CharacterCard>>(new Map());
  useEffect(() => {
    characterMap.current = new Map(characters.map(c => [c.id, c]));
  }, [characters]);

  const prevSpriteUrlsRef = useRef<Record<string, string>>({});

  // Start/stop timeline when sprite changes
  useEffect(() => {
    const currentSpriteUrls: Record<string, string> = {};

    for (const [characterId, charState] of Object.entries(characterSpriteStates)) {
      let effectiveUrl = charState.triggerSpriteUrl || '';

      if (!effectiveUrl) {
        const character = characterMap.current.get(characterId);
        effectiveUrl = computeIdleSpriteUrl(
          charState.spriteState,
          character,
          characterId
        ) || '';
      }

      currentSpriteUrls[characterId] = effectiveUrl;

      const prevUrl = prevSpriteUrlsRef.current[characterId];

      if (effectiveUrl && effectiveUrl !== prevUrl) {
        if (charState.triggerSpriteUrl && !charState.useTimelineSounds) {
          continue;
        }

        const collectionName = extractCollectionFromUrl(effectiveUrl);
        const filename = extractFilenameFromUrl(effectiveUrl);

        if (!collectionName || !filename) continue;

        (async () => {
          const metadata = await loadCollectionMetadata(collectionName);
          if (!metadata) return;

          const spriteMeta = metadata.sprites[filename];
          if (!spriteMeta?.timeline?.tracks) return;

          startTimeline(
            characterId,
            effectiveUrl,
            spriteMeta.timeline,
            soundTriggers,
            soundCollections
          );
        })();
      }

      if (!effectiveUrl && prevUrl) {
        stopTimeline(characterId);
      }
    }

    prevSpriteUrlsRef.current = currentSpriteUrls;
  }, [characterSpriteStates, soundTriggers, soundCollections]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const characterId of activeTimelines.keys()) {
        stopTimeline(characterId);
      }
      if (loopAnimationId) {
        cancelAnimationFrame(loopAnimationId);
        loopAnimationId = null;
        loopCheckerRunning = false;
      }
    };
  }, []);

  return {
    hasActiveTimeline: (characterId: string) => activeTimelines.has(characterId),
    stopTimeline,
    stopAllTimelines,
    clearMetadataCache: () => collectionMetadataCache.clear(),
  };
}

// Export for use outside of React (e.g., mute button handler)
export { stopAllTimelines, pauseAllTimelines, resumeAllTimelines };
