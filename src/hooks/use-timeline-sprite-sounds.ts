// ============================================
// Use Timeline Sprite Sounds Hook
// ============================================
//
// This hook connects sprite activation with timeline sound playback.
// When a sprite is activated (via trigger), it:
// 1. Extracts the collection name from the sprite URL
// 2. Loads the metadata.json from that collection
// 3. Finds the sprite's timeline configuration
// 4. Plays sounds using the soundTriggerId references
//
// ============================================

import { useEffect, useRef, useCallback } from 'react';
import { useTavernStore } from '@/store';
import type {
  SpriteTimelineData,
  TimelineTrack,
  TimelineKeyframe,
  SoundTrigger,
  SoundCollection,
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

interface ActiveTimelineSound {
  spriteUrl: string;
  startTime: number;
  duration: number;
  loop: boolean;
  activeAudios: Map<string, HTMLAudioElement[]>;
  triggeredKeyframes: Set<string>;
  timelineData: SpriteTimelineData;
  soundTriggers: SoundTrigger[];
  soundCollections: SoundCollection[];
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
// Active Timeline Sounds State
// ============================================

const activeTimelines = new Map<string, ActiveTimelineSound>();
const collectionMetadataCache = new Map<string, CollectionMetadata>();

// Loop checker state
let loopCheckerRunning = false;
let loopAnimationId: number | null = null;

// ============================================
// Loop Checker - Single Global Loop
// ============================================

function startLoopChecker() {
  if (loopCheckerRunning) {
    console.log('[TimelineSounds] Loop checker already running');
    return;
  }
  
  loopCheckerRunning = true;
  console.log('[TimelineSounds] 🔄 Starting loop checker');
  
  const check = () => {
    if (activeTimelines.size === 0) {
      loopCheckerRunning = false;
      loopAnimationId = null;
      console.log('[TimelineSounds] ⏹️ Loop checker stopped - no active timelines');
      return;
    }

    const now = Date.now();
    console.log(`[TimelineSounds] 🔄 Loop tick - ${activeTimelines.size} active timelines`);

    for (const [characterId, activeSound] of activeTimelines) {
      const elapsed = now - activeSound.startTime;
      const currentTime = elapsed % activeSound.duration;

      console.log(`[TimelineSounds] ⏱️ Character ${characterId.substring(0, 8)}: ${currentTime.toFixed(0)}ms / ${activeSound.duration}ms`);

      // Play sounds at current time using stored timeline data
      playSoundsAtTime(
        characterId,
        activeSound.timelineData,
        currentTime,
        activeSound.soundTriggers,
        activeSound.soundCollections,
        activeSound
      );
    }

    loopAnimationId = requestAnimationFrame(check);
  };

  loopAnimationId = requestAnimationFrame(check);
}

// ============================================
// Collection Metadata Loader
// ============================================

async function loadCollectionMetadata(collectionName: string): Promise<CollectionMetadata | null> {
  // Check cache first
  if (collectionMetadataCache.has(collectionName)) {
    return collectionMetadataCache.get(collectionName)!;
  }

  try {
    const response = await fetch(`/sprites/${collectionName}/metadata.json`);
    if (!response.ok) {
      console.warn(`[TimelineSounds] No metadata.json found for collection: ${collectionName}`);
      return null;
    }

    const metadata: CollectionMetadata = await response.json();
    collectionMetadataCache.set(collectionName, metadata);
    console.log(`[TimelineSounds] Loaded metadata for collection: ${collectionName}`, {
      spriteCount: Object.keys(metadata.sprites).length,
    });
    
    return metadata;
  } catch (error) {
    console.error(`[TimelineSounds] Failed to load metadata for ${collectionName}:`, error);
    return null;
  }
}

// ============================================
// Extract Collection Name from Sprite URL
// ============================================

function extractCollectionFromUrl(spriteUrl: string): string | null {
  // URL format: /sprites/CollectionName/filename.webm
  const match = spriteUrl.match(/\/sprites\/([^/]+)\//);
  return match ? match[1] : null;
}

// ============================================
// Extract Filename from Sprite URL
// ============================================

function extractFilenameFromUrl(spriteUrl: string): string | null {
  // URL format: /sprites/CollectionName/filename.webm
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
  if (!collection || !collection.files || collection.files.length === 0) {
    console.warn('[TimelineSounds] ❌ Collection not found or empty:', trigger.collection, {
      availableCollections: collections.map(c => c.name),
      requestedCollection: trigger.collection,
    });
    return null;
  }

  let soundFile: string;
  if (trigger.playMode === 'random') {
    soundFile = collection.files[Math.floor(Math.random() * collection.files.length)];
  } else {
    const index = trigger.currentIndex || 0;
    soundFile = collection.files[index % collection.files.length];
  }

  console.log('[TimelineSounds] 🔊 Playing sound file:', soundFile);

  try {
    const baseAudio = getAudio(soundFile);
    const audioClone = baseAudio.cloneNode() as HTMLAudioElement;
    audioClone.volume = volume * (trigger.volume || 1);
    audioClone.currentTime = 0;

    await audioClone.play().catch(e => {
      console.warn('[TimelineSounds] Audio play failed:', e);
    });

    return audioClone;
  } catch (error) {
    console.error('[TimelineSounds] Failed to play sound:', error);
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

    await audioClone.play().catch(e => {
      console.warn('[TimelineSounds] Audio play failed:', e);
    });

    return audioClone;
  } catch (error) {
    console.error('[TimelineSounds] Failed to play sound from URL:', error);
    return null;
  }
}

// ============================================
// Timeline Sound Player
// ============================================

function playSoundsAtTime(
  characterId: string,
  timeline: SpriteTimelineData,
  currentTime: number,
  soundTriggers: SoundTrigger[],
  soundCollections: SoundCollection[],
  activeSound: ActiveTimelineSound,
  toleranceMs: number = 150
): void {
  const globalVolume = timeline.globalVolume ?? 1;

  console.log(`[TimelineSounds] 🎵 playSoundsAtTime: currentTime=${currentTime.toFixed(0)}ms, tolerance=${toleranceMs}ms`);
  console.log(`[TimelineSounds] 📊 Timeline has ${timeline.tracks.length} tracks`);

  for (const track of timeline.tracks) {
    if (track.muted || !track.enabled) {
      console.log(`[TimelineSounds] 🔇 Track "${track.name}" muted or disabled`);
      continue;
    }
    
    // Check if this is a sound track - support both 'sound' and 'sprite' types
    // (legacy fix: some tracks were saved with type 'sprite' but contain sound keyframes)
    const isSoundTrack = track.type === 'sound' || (
      track.type === 'sprite' && track.keyframes.some(kf => {
        const val = kf.value as Record<string, unknown>;
        return val?.soundTriggerId || val?.play;
      })
    );
    
    if (!isSoundTrack) {
      console.log(`[TimelineSounds] ⏭️ Track "${track.name}" is not sound type (${track.type})`);
      continue;
    }

    const trackId = track.id;
    console.log(`[TimelineSounds] 🎸 Processing track "${track.name}" with ${track.keyframes.length} keyframes`);

    for (const keyframe of track.keyframes) {
      const keyframeId = keyframe.id;
      const keyframeTime = keyframe.time;

      // Check if playhead is crossing this keyframe
      const isCrossing = currentTime >= keyframeTime && currentTime < keyframeTime + toleranceMs;

      console.log(`[TimelineSounds] ⏱️ Keyframe at ${keyframeTime}ms: currentTime=${currentTime.toFixed(0)}, isCrossing=${isCrossing}, alreadyTriggered=${activeSound.triggeredKeyframes.has(keyframeId)}`);

      if (isCrossing && !activeSound.triggeredKeyframes.has(keyframeId)) {
        activeSound.triggeredKeyframes.add(keyframeId);

        const soundValue = keyframe.value as {
          soundTriggerId?: string;
          soundTriggerName?: string;
          soundUrl?: string;
          volume?: number;
          play?: boolean;
          stop?: boolean;
        };

        console.log(`[TimelineSounds] 🎯 TRIGGERING Keyframe at ${keyframeTime}ms:`, {
          soundTriggerId: soundValue.soundTriggerId,
          soundTriggerName: soundValue.soundTriggerName,
          play: soundValue.play,
          volume: soundValue.volume,
        });

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
                if (trigger) {
                  console.log(`[TimelineSounds] ✅ Found trigger by name fallback: ${trigger.name}`);
                }
              }
              
              if (trigger) {
                console.log(`[TimelineSounds] 🎵 Playing trigger: ${trigger.name} (collection: ${trigger.collection})`);
                audioEl = await playSoundFromTrigger(
                  trigger,
                  soundCollections,
                  (soundValue.volume || 1) * globalVolume
                );
              } else {
                console.warn(`[TimelineSounds] ⚠️ Sound trigger not found:`, {
                  searchedId: soundValue.soundTriggerId,
                  searchedName: soundValue.soundTriggerName,
                  availableTriggers: soundTriggers.map(t => ({ id: t.id, name: t.name, collection: t.collection })),
                });
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
              const trackAudios = activeSound.activeAudios.get(trackId) || [];
              trackAudios.push(audioEl);
              activeSound.activeAudios.set(trackId, trackAudios);

              // Clean up after playback
              audioEl.onended = () => {
                const idx = trackAudios.indexOf(audioEl!);
                if (idx > -1) trackAudios.splice(idx, 1);
              };
            }
          })();
        }

        // Handle stop command
        if (soundValue.stop) {
          const trackAudios = activeSound.activeAudios.get(trackId) || [];
          for (const audio of trackAudios) {
            audio.pause();
            audio.remove();
          }
          trackAudios.length = 0;
        }
      }

      // Reset trigger for keyframes we've passed (for looping)
      if (currentTime < keyframeTime - toleranceMs) {
        activeSound.triggeredKeyframes.delete(keyframeId);
      }
    }
  }
}

function stopTimelineSound(characterId: string) {
  const activeSound = activeTimelines.get(characterId);
  if (!activeSound) return;

  // Stop all audio elements
  for (const [, audios] of activeSound.activeAudios) {
    for (const audio of audios) {
      audio.pause();
      audio.remove();
    }
  }

  activeTimelines.delete(characterId);
  console.log('[TimelineSounds] ⏹️ Stopped timeline sounds for:', characterId);
}

function startTimelineSound(
  characterId: string,
  spriteUrl: string,
  timeline: SpriteTimelineData,
  soundTriggers: SoundTrigger[],
  soundCollections: SoundCollection[]
): void {
  // Stop any existing timeline for this character
  stopTimelineSound(characterId);

  // Filter sound tracks - support both 'sound' and 'sprite' types with sound keyframes
  const soundTracks = timeline.tracks.filter(
    t => !t.muted && t.enabled && (
      t.type === 'sound' || (
        t.type === 'sprite' && t.keyframes.some(kf => {
          const val = kf.value as Record<string, unknown>;
          return val?.soundTriggerId || val?.play;
        })
      )
    )
  );

  if (soundTracks.length === 0) {
    console.log('[TimelineSounds] No active sound tracks in timeline');
    return;
  }

  const activeSound: ActiveTimelineSound = {
    spriteUrl,
    startTime: Date.now(),
    duration: timeline.duration || 5000,
    loop: timeline.loop,
    activeAudios: new Map(),
    triggeredKeyframes: new Set(),
    timelineData: timeline,
    soundTriggers,
    soundCollections,
  };

  activeTimelines.set(characterId, activeSound);

  console.log('[TimelineSounds] ▶️ Started timeline sounds:', {
    characterId,
    spriteUrl,
    duration: timeline.duration,
    loop: timeline.loop,
    soundTracks: soundTracks.length,
    keyframes: soundTracks.reduce((sum, t) => sum + t.keyframes.length, 0),
    soundTriggersCount: soundTriggers.length,
    soundCollectionsCount: soundCollections.length,
  });

  // Start the loop checker if not already running
  startLoopChecker();

  // Play initial sounds at time 0
  playSoundsAtTime(
    characterId,
    timeline,
    0,
    soundTriggers,
    soundCollections,
    activeSound
  );
}

// ============================================
// Main Hook
// ============================================

export function useTimelineSpriteSounds() {
  const characterSpriteStates = useTavernStore((state) => state.characterSpriteStates);
  const soundTriggers = useTavernStore((state) => state.soundTriggers ?? []);
  const soundCollections = useTavernStore((state) => state.soundCollections ?? []);

  const prevSpriteUrlsRef = useRef<Record<string, string>>({});

  // Start/stop timeline sounds when sprite changes
  useEffect(() => {
    const currentSpriteUrls: Record<string, string> = {};

    console.log('[TimelineSounds] 📋 Checking sprite changes:', {
      soundTriggersCount: soundTriggers.length,
      soundCollectionsCount: soundCollections.length,
      characterSpriteStatesCount: Object.keys(characterSpriteStates).length,
    });

    for (const [characterId, charState] of Object.entries(characterSpriteStates)) {
      const currentUrl = charState.triggerSpriteUrl;
      currentSpriteUrls[characterId] = currentUrl || '';

      const prevUrl = prevSpriteUrlsRef.current[characterId];

      // If sprite changed
      if (currentUrl && currentUrl !== prevUrl) {
        console.log('[TimelineSounds] 🔄 Sprite URL changed:', {
          characterId,
          currentUrl,
          prevUrl,
          useTimelineSounds: charState.useTimelineSounds,
        });

        // Check if timeline sounds are enabled for this character
        if (!charState.useTimelineSounds) {
          console.log('[TimelineSounds] ⏸️ Timeline sounds disabled for this character, skipping');
          continue;
        }

        // Extract collection name and filename from URL
        const collectionName = extractCollectionFromUrl(currentUrl);
        const filename = extractFilenameFromUrl(currentUrl);

        if (!collectionName || !filename) {
          console.warn('[TimelineSounds] ⚠️ Could not extract collection/filename from URL:', currentUrl);
          continue;
        }

        console.log('[TimelineSounds] 📁 Extracted from URL:', { collectionName, filename });

        // Load collection metadata and find sprite timeline
        (async () => {
          const metadata = await loadCollectionMetadata(collectionName);
          if (!metadata) {
            console.warn('[TimelineSounds] ⚠️ No metadata found for collection:', collectionName);
            return;
          }

          // Find sprite in metadata by filename
          const spriteMeta = metadata.sprites[filename];
          if (!spriteMeta) {
            console.warn('[TimelineSounds] ⚠️ Sprite not found in metadata:', filename);
            console.log('[TimelineSounds] Available sprites:', Object.keys(metadata.sprites));
            return;
          }

          // Check if sprite has timeline with sound tracks
          if (!spriteMeta.timeline || !spriteMeta.timeline.tracks) {
            console.log('[TimelineSounds] ℹ️ Sprite has no timeline:', filename);
            return;
          }

          // Filter sound tracks - support both 'sound' and 'sprite' types with sound keyframes
          const soundTracks = spriteMeta.timeline.tracks.filter(
            (t: TimelineTrack) => !t.muted && t.enabled && (
              t.type === 'sound' || (
                t.type === 'sprite' && t.keyframes.some(kf => {
                  const val = kf.value as Record<string, unknown>;
                  return val?.soundTriggerId || val?.play;
                })
              )
            )
          );

          if (soundTracks.length === 0) {
            console.log('[TimelineSounds] ℹ️ Sprite has no active sound tracks:', filename);
            return;
          }

          console.log('[TimelineSounds] ✅ Found sprite with timeline sounds:', {
            label: spriteMeta.label,
            duration: spriteMeta.duration,
            soundTracks: soundTracks.length,
            keyframes: soundTracks.reduce((sum: number, t: TimelineTrack) => sum + t.keyframes.length, 0),
          });

          // Start playing timeline sounds
          startTimelineSound(
            characterId,
            currentUrl,
            spriteMeta.timeline,
            soundTriggers,
            soundCollections
          );
        })();
      }

      // If sprite was cleared but we had an active timeline
      if (!currentUrl && prevUrl) {
        stopTimelineSound(characterId);
      }
    }

    prevSpriteUrlsRef.current = currentSpriteUrls;
  }, [characterSpriteStates, soundTriggers, soundCollections]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const characterId of activeTimelines.keys()) {
        stopTimelineSound(characterId);
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
    stopTimeline: stopTimelineSound,
    clearMetadataCache: () => collectionMetadataCache.clear(),
  };
}

