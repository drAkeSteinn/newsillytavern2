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
// 4. Plays sounds at keyframe times
// 5. Sends haptic positions to Handy device
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

// Loop checker state
let loopCheckerRunning = false;
let loopAnimationId: number | null = null;

// Haptic state (throttled)
let lastHapticSendTime = 0;
let lastSentHapticPosition: number | null = null;

// ============================================
// Haptic Helpers (read config from localStorage)
// ============================================

interface HandyConfig {
  appId: string;
  connectionKey: string;
}

function readHandyConfig(): HandyConfig | null {
  try {
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
    return localStorage.getItem('handy-haptic-enabled') === 'true';
  } catch { return false; }
}

function readInverted(): boolean {
  try {
    return localStorage.getItem('handy-inverted') === 'true';
  } catch { return false; }
}

// Send haptic position to Handy device (throttled to ~12fps)
function sendHapticPosition(position: number, velocity: number = 1.0) {
  const config = readHandyConfig();
  if (!config) return;

  // Throttle to ~12fps (80ms interval)
  const now = Date.now();
  if (now - lastHapticSendTime < 80) return;
  lastHapticSendTime = now;

  // Skip if position hasn't changed
  const roundedPos = Math.round(position * 10) / 10;
  if (lastSentHapticPosition !== null && lastSentHapticPosition === roundedPos) return;
  lastSentHapticPosition = roundedPos;

  // Normalize 0-100 → 0-1
  const normalizedPosition = Math.max(0, Math.min(1, position / 100));
  const inverted = readInverted();
  const devicePos = inverted ? 1 - normalizedPosition : normalizedPosition;

  fetch('/api/handy/hdsp/xpvp', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appId: config.appId,
      connectionKey: config.connectionKey,
      xp: devicePos,
      vp: Math.max(0, Math.min(1, velocity)),
      stop_on_target: false,
    }),
  }).catch(() => { /* silently fail */ });
}

// Interpolate haptic position between keyframes
function interpolateHapticPosition(
  currentTime: number,
  keyframes: { time: number; value: HapticKeyframeValue }[],
): number {
  if (keyframes.length === 0) return 50;
  if (keyframes.length === 1) return keyframes[0].value.position;

  let prev = keyframes[0];
  let next = keyframes[keyframes.length - 1];

  for (let i = 0; i < keyframes.length - 1; i++) {
    if (currentTime >= keyframes[i].time && currentTime <= keyframes[i + 1].time) {
      prev = keyframes[i];
      next = keyframes[i + 1];
      break;
    }
  }

  if (currentTime <= prev.time) return prev.value.position;
  if (currentTime >= next.time) return next.value.position;

  const t = (currentTime - prev.time) / (next.time - prev.time);
  return prev.value.position + (next.value.position - prev.value.position) * t;
}

// ============================================
// Loop Checker - Single Global Loop
// ============================================

function startLoopChecker() {
  if (loopCheckerRunning) return;

  loopCheckerRunning = true;

  const check = () => {
    if (activeTimelines.size === 0) {
      loopCheckerRunning = false;
      loopAnimationId = null;
      lastSentHapticPosition = null; // Reset debounce when stopping
      return;
    }

    const now = Date.now();

    for (const [, active] of activeTimelines) {
      const elapsed = now - active.startTime;
      const currentTime = elapsed % active.duration;

      // Play sounds at current time
      playSoundsAtTime(
        active.timelineData,
        currentTime,
        active.soundTriggers,
        active.soundCollections,
        active
      );

      // Send haptic positions for haptic tracks
      processHapticTracks(active.timelineData, currentTime);
    }

    loopAnimationId = requestAnimationFrame(check);
  };

  loopAnimationId = requestAnimationFrame(check);
}

// ============================================
// Haptic Track Processor
// ============================================

function processHapticTracks(
  timeline: SpriteTimelineData,
  currentTime: number,
): void {
  if (!readHapticEnabled()) return;

  const hapticTracks = timeline.tracks.filter(
    (t) => t.type === 'haptic' && !t.muted && t.enabled
  );

  if (hapticTracks.length === 0) return;

  for (const track of hapticTracks) {
    if (track.keyframes.length === 0) continue;

    const hapticKeyframes = track.keyframes.map((kf) => ({
      time: kf.time,
      value: kf.value as HapticKeyframeValue,
    }));

    const position = interpolateHapticPosition(currentTime, hapticKeyframes);

    // Find closest keyframe for velocity
    let closestKf = hapticKeyframes[0];
    for (const kf of hapticKeyframes) {
      if (Math.abs(kf.time - currentTime) < Math.abs(closestKf.time - currentTime)) {
        closestKf = kf;
      }
    }

    const velocity = closestKf.value.velocity ?? 1.0;
    sendHapticPosition(position, velocity);
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
  const globalVolume = timeline.globalVolume ?? 1;

  for (const track of timeline.tracks) {
    if (track.muted || !track.enabled) continue;

    // Only process sound tracks (or legacy 'sprite' tracks with sound data)
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

      // Check if playhead is crossing this keyframe
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

            // Try sound trigger first (by ID)
            if (soundValue.soundTriggerId) {
              let trigger = soundTriggers.find(t => t.id === soundValue.soundTriggerId);

              // Fallback: try to find by name if ID not found
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
            // Fall back to direct URL
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

        // Handle stop command
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
// Start/Stop Timeline
// ============================================

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

  activeTimelines.delete(characterId);

  // If no more active timelines, send haptic to center
  if (activeTimelines.size === 0 && readHapticEnabled()) {
    sendHapticPosition(50, 0.3);
    lastSentHapticPosition = null;
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

  // Check if there are any playable tracks (sound or haptic)
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
  };

  activeTimelines.set(characterId, active);

  console.log('[Timeline] ▶️ Started for', characterId.substring(0, 8), {
    duration: timeline.duration,
    sounds: hasSoundTracks,
    haptic: hasHapticTracks,
    url: spriteUrl.split('/').pop(),
  });

  // Start the loop checker if not already running
  startLoopChecker();

  // Play initial sounds at time 0
  if (hasSoundTracks) {
    playSoundsAtTime(timeline, 0, soundTriggers, soundCollections, active);
  }

  // Send initial haptic position
  if (hasHapticTracks) {
    processHapticTracks(timeline, 0);
  }
}

// ============================================
// Idle Sprite URL Resolver
// ============================================

// Replicate the same logic as CharacterSprite.getSpriteUrl / getSpriteFromStateCollectionV2
// to compute the displayed sprite URL for idle/talk/thinking states.
// This requires character data (spritePacksV2, stateCollectionsV2).

function computeIdleSpriteUrl(
  spriteState: string,
  character: CharacterCard | undefined,
  characterId: string,
): string | null {
  if (!character) return null;

  const hasV2Collections = !!(character.stateCollectionsV2 && character.stateCollectionsV2.length > 0);
  const hasV2Packs = !!(character.spritePacksV2 && character.spritePacksV2.length > 0);

  if (!hasV2Collections || !hasV2Packs) return null;

  // Find state collection matching the current sprite state
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
      // For random/list, we can't easily predict the URL from here
      // since random uses Math.random() and list uses a rotation index.
      // Return first sprite URL as fallback — the actual displayed sprite
      // may differ, but this ensures we at least try to load timeline data.
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

  // Build a character lookup map for efficiency
  const characterMap = useRef<Map<string, CharacterCard>>(new Map());
  useEffect(() => {
    characterMap.current = new Map(characters.map(c => [c.id, c]));
  }, [characters]);

  const prevSpriteUrlsRef = useRef<Record<string, string>>({});

  // Start/stop timeline when sprite changes (trigger OR idle)
  useEffect(() => {
    const currentSpriteUrls: Record<string, string> = {};

    for (const [characterId, charState] of Object.entries(characterSpriteStates)) {
      // Determine effective sprite URL:
      // Priority: trigger > idle from state collections
      let effectiveUrl = charState.triggerSpriteUrl || '';

      if (!effectiveUrl) {
        // No trigger active — compute idle sprite URL
        const character = characterMap.current.get(characterId);
        effectiveUrl = computeIdleSpriteUrl(
          charState.spriteState,
          character,
          characterId
        ) || '';
      }

      currentSpriteUrls[characterId] = effectiveUrl;

      const prevUrl = prevSpriteUrlsRef.current[characterId];

      // If sprite URL changed to a new sprite
      if (effectiveUrl && effectiveUrl !== prevUrl) {
        // Check if timeline sounds are enabled (only for trigger sprites)
        if (charState.triggerSpriteUrl && !charState.useTimelineSounds) {
          // For triggers with disabled timeline sounds, skip
          continue;
        }

        // Extract collection name and filename from URL
        const collectionName = extractCollectionFromUrl(effectiveUrl);
        const filename = extractFilenameFromUrl(effectiveUrl);

        if (!collectionName || !filename) continue;

        // Load collection metadata and find sprite timeline
        (async () => {
          const metadata = await loadCollectionMetadata(collectionName);
          if (!metadata) return;

          const spriteMeta = metadata.sprites[filename];
          if (!spriteMeta?.timeline?.tracks) return;

          // Start timeline (handles both sound and haptic tracks)
          startTimeline(
            characterId,
            effectiveUrl,
            spriteMeta.timeline,
            soundTriggers,
            soundCollections
          );
        })();
      }

      // If sprite was cleared but we had an active timeline
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
    clearMetadataCache: () => collectionMetadataCache.clear(),
  };
}
