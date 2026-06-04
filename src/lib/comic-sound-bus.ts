// ============================================
// Comic Sound Bus - Event system for visual sound effects
// ============================================
//
// When a sound trigger fires and audio plays,
// this bus emits events that the ComicSoundOverlay
// component listens to, showing comic-style visual
// effects in the sprite area.
//
// Flow: Sound Trigger → audio plays → emitComicSoundEvent()
//       → ComicSoundOverlay picks up event → renders template

export interface ComicSoundEvent {
  id: string;
  /** Display name of the sound trigger */
  triggerName: string;
  /** The keyword that was matched */
  keyword: string;
  /** Timestamp when the event was created */
  timestamp: number;
  /** Optional character ID for per-character positioning */
  characterId?: string;
}

type ComicSoundListener = (event: ComicSoundEvent) => void;

const GLOBAL_KEY = '__TAVERNFLOW_COMIC_SOUND_BUS__';

interface ComicSoundBus {
  listeners: Set<ComicSoundListener>;
  eventHistory: ComicSoundEvent[];
}

function createComicSoundBus(): ComicSoundBus {
  return {
    listeners: new Set<ComicSoundListener>(),
    eventHistory: [],
  };
}

function getComicSoundBus(): ComicSoundBus {
  if (typeof window === 'undefined') {
    return createComicSoundBus();
  }

  const w = window as unknown as Record<string, unknown>;
  if (!w[GLOBAL_KEY]) {
    w[GLOBAL_KEY] = createComicSoundBus();
  }
  return w[GLOBAL_KEY] as ComicSoundBus;
}

/**
 * Subscribe to comic sound events
 * Returns an unsubscribe function
 */
export function subscribeToComicSound(
  callback: ComicSoundListener
): () => void {
  const bus = getComicSoundBus();
  bus.listeners.add(callback);
  return () => bus.listeners.delete(callback);
}

/**
 * Emit a comic sound event when a sound plays
 * Called from sound handlers when audio is triggered
 */
export function emitComicSoundEvent(
  triggerName: string,
  keyword: string,
  characterId?: string
): void {
  const bus = getComicSoundBus();

  const event: ComicSoundEvent = {
    id: `comic_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    triggerName,
    keyword,
    timestamp: Date.now(),
    characterId,
  };

  // Keep a rolling history (max 50 events)
  bus.eventHistory.push(event);
  if (bus.eventHistory.length > 50) {
    bus.eventHistory.shift();
  }

  // Notify all listeners
  bus.listeners.forEach((callback) => {
    try {
      callback(event);
    } catch (error) {
      console.error('[ComicSoundBus] Listener error:', error);
    }
  });

  console.log(`[ComicSoundBus] 💥 Sound visual event: "${triggerName}" (keyword: "${keyword}")`);
}

/**
 * Get recent event history
 */
export function getComicSoundHistory(): ComicSoundEvent[] {
  const bus = getComicSoundBus();
  return [...bus.eventHistory];
}

/**
 * Clear event history
 */
export function clearComicSoundHistory(): void {
  const bus = getComicSoundBus();
  bus.eventHistory.length = 0;
}
