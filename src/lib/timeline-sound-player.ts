// ============================================
// Timeline Sound Player - Plays sounds when sprites activate
// ============================================
//
// This module handles playing timeline sounds when a sprite is activated:
// 1. By triggers (sprite:test01)
// 2. By state changes (idle/talk/thinking)
// 3. Supports loop and persistent sprites
//
// ============================================

import type { 
  TimelineSprite,
  TimelineTrack,
  TimelineKeyframe,
  SoundKeyframeValue,
  SoundTrigger,
  SoundCollection,
} from '@/types';

// ============================================
// Types
// ============================================

export interface TimelineSoundContext {
  soundTriggers: SoundTrigger[];
  soundCollections: SoundCollection[];
  globalVolume: number;
}

export interface ActiveTimelineSound {
  spriteId: string;
  spriteUrl: string;
  tracks: Map<string, ActiveTrackSound>;
  startTime: number;
  duration: number;
  loop: boolean;
}

export interface ActiveTrackSound {
  trackId: string;
  audioElements: HTMLAudioElement[];
  lastTriggeredKeyframe: string | null;
}

// ============================================
// Audio Cache
// ============================================

const audioCache = new Map<string, HTMLAudioElement>();

// Preload audio to cache
export function preloadAudio(url: string): Promise<HTMLAudioElement> {
  return new Promise((resolve, reject) => {
    if (audioCache.has(url)) {
      resolve(audioCache.get(url)!);
      return;
    }
    
    const audio = new Audio(url);
    audio.addEventListener('canplaythrough', () => {
      audioCache.set(url, audio);
      resolve(audio);
    }, { once: true });
    
    audio.addEventListener('error', (e) => {
      console.error('[TimelineSoundPlayer] Failed to load audio:', url, e);
      reject(e);
    }, { once: true });
    
    audio.load();
  });
}

// Get audio from cache (or create new)
function getAudio(url: string): HTMLAudioElement | null {
  let audio = audioCache.get(url);
  if (!audio) {
    audio = new Audio(url);
    audioCache.set(url, audio);
  }
  return audio;
}

// ============================================
// Active Sounds Management
// ============================================

// Map of spriteId -> ActiveTimelineSound
const activeSounds = new Map<string, ActiveTimelineSound>();

// Animation frame ID for the loop checker
let loopCheckFrameId: number | null = null;

// ============================================
// Sound Playback
// ============================================

/**
 * Play a sound from a sound trigger
 */
async function playSoundFromTrigger(
  trigger: SoundTrigger,
  collections: SoundCollection[],
  volume: number = 1
): Promise<HTMLAudioElement | null> {
  try {
    // Get the collection for this trigger
    const collection = collections.find(c => c.name === trigger.collection);
    if (!collection || !collection.files || collection.files.length === 0) {
      console.warn('[TimelineSoundPlayer] Collection not found or empty:', trigger.collection);
      return null;
    }
    
    // Pick a sound based on play mode
    let soundFile: string;
    if (trigger.playMode === 'random') {
      soundFile = collection.files[Math.floor(Math.random() * collection.files.length)];
    } else {
      // Cyclic mode - use currentIndex
      const index = trigger.currentIndex || 0;
      soundFile = collection.files[index % collection.files.length];
    }
    
    // The soundFile already contains the full path
    const soundUrl = soundFile;
    
    // Get or create audio element
    const baseAudio = getAudio(soundUrl);
    if (!baseAudio) return null;
    
    // Clone and play (allows overlapping sounds)
    const audioClone = baseAudio.cloneNode() as HTMLAudioElement;
    audioClone.volume = volume * (trigger.volume || 1);
    audioClone.currentTime = 0;
    
    await audioClone.play().catch(e => {
      console.warn('[TimelineSoundPlayer] Audio play failed:', e);
    });
    
    return audioClone;
  } catch (error) {
    console.error('[TimelineSoundPlayer] Failed to play sound:', error);
    return null;
  }
}

/**
 * Play a sound from direct URL
 */
async function playSoundFromUrl(
  url: string,
  volume: number = 1
): Promise<HTMLAudioElement | null> {
  try {
    const baseAudio = getAudio(url);
    if (!baseAudio) return null;
    
    const audioClone = baseAudio.cloneNode() as HTMLAudioElement;
    audioClone.volume = volume;
    audioClone.currentTime = 0;
    
    await audioClone.play().catch(e => {
      console.warn('[TimelineSoundPlayer] Audio play failed:', e);
    });
    
    return audioClone;
  } catch (error) {
    console.error('[TimelineSoundPlayer] Failed to play sound from URL:', error);
    return null;
  }
}

// ============================================
// Timeline Sound Execution
// ============================================

/**
 * Get timeline data for a sprite by URL
 * This would need to be called with the sprite data from the store
 */
export function findSpriteTimelineByUrl(
  spriteUrl: string,
  timelineCollections: { sprites: TimelineSprite[] }[]
): TimelineSprite | undefined {
  for (const collection of timelineCollections) {
    const sprite = collection.sprites.find(s => s.url === spriteUrl);
    if (sprite) return sprite;
  }
  return undefined;
}

/**
 * Play sounds at a specific time in the timeline
 */
async function playSoundsAtTime(
  sprite: TimelineSprite,
  currentTime: number,
  context: TimelineSoundContext,
  activeSound: ActiveTimelineSound,
  toleranceMs: number = 100
): Promise<void> {
  const { soundTriggers, soundCollections, globalVolume } = context;
  
  // Check each track
  for (const track of sprite.timeline.tracks) {
    if (track.muted || !track.enabled) continue;
    
    const trackId = track.id;
    const activeTrack = activeSound.tracks.get(trackId) || {
      trackId,
      audioElements: [],
      lastTriggeredKeyframe: null,
    };
    
    // Check each keyframe
    for (const keyframe of track.keyframes) {
      const keyframeId = keyframe.id;
      const keyframeTime = keyframe.time;
      
      // Check if playhead is crossing this keyframe
      const isCrossing = currentTime >= keyframeTime && currentTime < keyframeTime + toleranceMs;
      
      if (isCrossing && activeTrack.lastTriggeredKeyframe !== keyframeId) {
        activeTrack.lastTriggeredKeyframe = keyframeId;
        
        // Get sound value
        const soundValue = keyframe.value as SoundKeyframeValue & {
          soundTriggerId?: string;
          soundTriggerName?: string;
        };
        
        if (soundValue.play) {
          let audioEl: HTMLAudioElement | null = null;
          
          // Try sound trigger first
          if (soundValue.soundTriggerId) {
            const trigger = soundTriggers.find(t => t.id === soundValue.soundTriggerId);
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
          // Try collection + file reference
          else if (soundValue.soundCollection && soundValue.soundFile) {
            const collection = soundCollections.find(c => c.name === soundValue.soundCollection);
            if (collection) {
              const file = collection.files.find(f => f.includes(soundValue.soundFile!));
              if (file) {
                audioEl = await playSoundFromUrl(file, (soundValue.volume || 1) * globalVolume);
              }
            }
          }
          
          if (audioEl) {
            activeTrack.audioElements.push(audioEl);
            
            // Clean up after playback
            audioEl.onended = () => {
              const idx = activeTrack.audioElements.indexOf(audioEl!);
              if (idx > -1) activeTrack.audioElements.splice(idx, 1);
            };
          }
        }
        
        // Handle stop command
        if (soundValue.stop) {
          // Stop all audio on this track
          for (const audio of activeTrack.audioElements) {
            audio.pause();
            audio.remove();
          }
          activeTrack.audioElements = [];
        }
      }
      
      // Reset trigger for keyframes we've passed (for looping)
      if (currentTime < keyframeTime) {
        activeTrack.lastTriggeredKeyframe = null;
      }
    }
    
    activeSound.tracks.set(trackId, activeTrack);
  }
}

// ============================================
// Public API
// ============================================

/**
 * Start playing timeline sounds for a sprite
 * Returns an ID that can be used to stop the sounds
 */
export function startTimelineSounds(
  sprite: TimelineSprite,
  context: TimelineSoundContext,
  options: {
    loop?: boolean;
    startTime?: number;
  } = {}
): string {
  const spriteId = sprite.id;
  
  // Stop any existing sounds for this sprite
  stopTimelineSounds(spriteId);
  
  const startTime = options.startTime ?? 0;
  const loop = options.loop ?? sprite.timeline.loop;
  const duration = sprite.timeline.duration;
  
  // Create active sound entry
  const activeSound: ActiveTimelineSound = {
    spriteId,
    spriteUrl: sprite.url,
    tracks: new Map(),
    startTime: Date.now() - startTime,
    duration,
    loop,
  };
  
  activeSounds.set(spriteId, activeSound);
  
  console.log('[TimelineSoundPlayer] Starting timeline sounds for sprite:', {
    spriteId,
    spriteUrl: sprite.url,
    duration,
    loop,
    tracksCount: sprite.timeline.tracks.length,
  });
  
  // Play initial sounds
  playSoundsAtTime(sprite, startTime, context, activeSound);
  
  // Start loop checker if not already running
  startLoopChecker(context);
  
  return spriteId;
}

/**
 * Stop timeline sounds for a sprite
 */
export function stopTimelineSounds(spriteId: string): void {
  const activeSound = activeSounds.get(spriteId);
  if (!activeSound) return;
  
  // Stop all audio elements
  for (const [, track] of activeSound.tracks) {
    for (const audio of track.audioElements) {
      audio.pause();
      audio.remove();
    }
  }
  
  activeSounds.delete(spriteId);
  console.log('[TimelineSoundPlayer] Stopped timeline sounds for sprite:', spriteId);
}

/**
 * Stop all timeline sounds
 */
export function stopAllTimelineSounds(): void {
  for (const spriteId of activeSounds.keys()) {
    stopTimelineSounds(spriteId);
  }
  
  if (loopCheckFrameId) {
    cancelAnimationFrame(loopCheckFrameId);
    loopCheckFrameId = null;
  }
}

/**
 * Check if a sprite has active timeline sounds
 */
export function hasActiveTimelineSounds(spriteId: string): boolean {
  return activeSounds.has(spriteId);
}

/**
 * Get all active sprite IDs
 */
export function getActiveTimelineSpriteIds(): string[] {
  return Array.from(activeSounds.keys());
}

// ============================================
// Loop Checker
// ============================================

// Store for the current context (updated on each start)
let currentContext: TimelineSoundContext | null = null;
let timelineCollections: { sprites: TimelineSprite[] }[] = [];

/**
 * Set the timeline collections for lookups
 */
export function setTimelineCollections(collections: { sprites: TimelineSprite[] }[]): void {
  timelineCollections = collections;
}

function startLoopChecker(context: TimelineSoundContext): void {
  currentContext = context;
  
  if (loopCheckFrameId) return; // Already running
  
  const check = () => {
    const now = Date.now();
    
    for (const [spriteId, activeSound] of activeSounds) {
      const elapsed = now - activeSound.startTime;
      const currentTime = elapsed % activeSound.duration;
      
      // Find the sprite
      const sprite = findSpriteTimelineByUrl(activeSound.spriteUrl, timelineCollections);
      if (!sprite) continue;
      
      // Play sounds at current time
      if (currentContext) {
        playSoundsAtTime(sprite, currentTime, currentContext, activeSound);
      }
    }
    
    loopCheckFrameId = requestAnimationFrame(check);
  };
  
  loopCheckFrameId = requestAnimationFrame(check);
}

// ============================================
// Integration Helper
// ============================================

/**
 * Play timeline sounds for a sprite by URL
 * This is the main entry point for sprite activation
 */
export async function playTimelineSoundsForSprite(
  spriteUrl: string,
  context: TimelineSoundContext,
  collections: { sprites: TimelineSprite[] }[],
  options?: {
    loop?: boolean;
    persist?: boolean;
  }
): Promise<string | null> {
  // Find the sprite by URL
  const sprite = findSpriteTimelineByUrl(spriteUrl, collections);
  
  if (!sprite) {
    console.log('[TimelineSoundPlayer] No timeline sprite found for URL:', spriteUrl);
    return null;
  }
  
  // Check if sprite has any sound tracks
  const soundTracks = sprite.timeline.tracks.filter(
    t => t.type === 'sound' && !t.muted && t.enabled
  );
  
  if (soundTracks.length === 0) {
    console.log('[TimelineSoundPlayer] No sound tracks for sprite:', sprite.label);
    return null;
  }
  
  console.log('[TimelineSoundPlayer] Playing timeline sounds for sprite:', {
    label: sprite.label,
    soundTracks: soundTracks.length,
    keyframes: soundTracks.reduce((sum, t) => sum + t.keyframes.length, 0),
  });
  
  // Update collections reference
  setTimelineCollections(collections);
  
  // Start playing
  return startTimelineSounds(sprite, context, {
    loop: options?.loop ?? sprite.timeline.loop,
  });
}
