/**
 * Unified Audio Bus for SFX + TTS Suite
 * Ensures strict sequential playback across all audio sources
 * Supports cancellation and prioritization
 */

import type { AudioTask, AudioBusState } from '@/types/triggers';
import { generateId } from '@/lib/utils';

// Singleton audio bus
const GLOBAL_KEY = '__TAVERNFLOW_AUDIO_BUS__';

interface AudioBus {
  state: AudioBusState;
  audioElement: HTMLAudioElement | null;
  listeners: Set<(state: AudioBusState) => void>;
}

function createAudioBus(): AudioBus {
  const state: AudioBusState = {
    isPlaying: false,
    currentTask: null,
    queue: [],
    token: 0,
  };

  const listeners = new Set<(state: AudioBusState) => void>();

  // Create audio element
  const audioElement = typeof window !== 'undefined' 
    ? new Audio() 
    : null;

  if (audioElement) {
    audioElement.id = 'tavernflow-audio-bus';
    audioElement.autoplay = false;
    audioElement.preload = 'auto';
  }

  return {
    state,
    audioElement,
    listeners,
  };
}

// Get or create singleton
function getAudioBus(): AudioBus {
  if (typeof window === 'undefined') {
    return createAudioBus();
  }

  const w = window as unknown as Record<string, unknown>;
  if (!w[GLOBAL_KEY]) {
    w[GLOBAL_KEY] = createAudioBus();
  }
  return w[GLOBAL_KEY] as AudioBus;
}

/**
 * Subscribe to audio bus state changes
 */
export function subscribeToAudioBus(
  callback: (state: AudioBusState) => void
): () => void {
  const bus = getAudioBus();
  bus.listeners.add(callback);
  return () => bus.listeners.delete(callback);
}

/**
 * Notify all listeners of state change
 */
function notifyListeners(bus: AudioBus): void {
  bus.listeners.forEach((callback) => {
    try {
      callback(bus.state);
    } catch (error) {
      console.error('[AudioBus] Listener error:', error);
    }
  });
}

/**
 * Cancel all pending audio tasks
 */
export function cancelAllAudio(): void {
  const bus = getAudioBus();
  bus.state.token++;
  bus.state.queue = [];
  bus.state.currentTask = null;
  bus.state.isPlaying = false;

  if (bus.audioElement) {
    bus.audioElement.pause();
    bus.audioElement.currentTime = 0;
    bus.audioElement.src = '';
  }

  notifyListeners(bus);
}

/**
 * Enqueue an audio task
 */
export async function enqueueAudio(task: Omit<AudioTask, 'id'>): Promise<void> {
  const bus = getAudioBus();
  const myToken = bus.state.token;

  const fullTask: AudioTask = {
    ...task,
    id: generateId(),
  };

  // Add to queue sorted by priority
  bus.state.queue.push(fullTask);
  bus.state.queue.sort((a, b) => b.priority - a.priority);

  notifyListeners(bus);

  // Wait for this task to be processed
  return new Promise((resolve, reject) => {
    const checkProcessed = () => {
      if (myToken !== bus.state.token) {
        reject(new Error('Cancelled'));
        return;
      }

      const stillInQueue = bus.state.queue.some((t) => t.id === fullTask.id);
      const isCurrent = bus.state.currentTask?.id === fullTask.id;

      if (!stillInQueue && !isCurrent) {
        resolve();
      } else {
        requestAnimationFrame(checkProcessed);
      }
    };

    // Start processing if not already
    processQueue();
    checkProcessed();
  });
}

/**
 * Process the audio queue
 */
async function processQueue(): Promise<void> {
  const bus = getAudioBus();

  // Already playing or queue empty
  if (bus.state.isPlaying || bus.state.queue.length === 0) {
    return;
  }

  // Get next task
  const task = bus.state.queue.shift();
  if (!task) return;

  const myToken = bus.state.token;
  bus.state.currentTask = task;
  bus.state.isPlaying = true;
  notifyListeners(bus);

  try {
    await playAudioTask(bus, task, myToken);
    task.onComplete?.();
  } catch (error) {
    task.onError?.(error as Error);
    console.error('[AudioBus] Task error:', error);
  } finally {
    // Only clear if not cancelled
    if (myToken === bus.state.token) {
      bus.state.currentTask = null;
      bus.state.isPlaying = false;
      notifyListeners(bus);
    }

    // Process next in queue
    if (bus.state.queue.length > 0) {
      processQueue();
    }
  }
}

/**
 * Play a single audio task
 */
async function playAudioTask(
  bus: AudioBus,
  task: AudioTask,
  token: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!bus.audioElement) {
      resolve();
      return;
    }

    // Check for cancellation
    if (token !== bus.state.token) {
      reject(new Error('Cancelled'));
      return;
    }

    // Set up audio source
    if (task.audioBlob) {
      const url = URL.createObjectURL(task.audioBlob);
      bus.audioElement.src = url;
      
      // Clean up URL after playback
      const cleanup = () => URL.revokeObjectURL(url);
      bus.audioElement.addEventListener('ended', cleanup, { once: true });
      bus.audioElement.addEventListener('error', cleanup, { once: true });
    } else if (task.audioUrl) {
      bus.audioElement.src = task.audioUrl;
    } else {
      resolve();
      return;
    }

    // Set volume
    bus.audioElement.volume = task.volume;

    // Event handlers
    const onEnded = () => {
      cleanup();
      resolve();
    };

    const onError = (e: Event) => {
      cleanup();
      reject(new Error(`Audio error: ${e}`));
    };

    const onCanPlay = () => {
      // Check for cancellation before playing
      if (token !== bus.state.token) {
        cleanup();
        reject(new Error('Cancelled'));
        return;
      }

      bus.audioElement?.play().catch((error) => {
        cleanup();
        if (error.name !== 'AbortError') {
          reject(error);
        } else {
          resolve(); // Abort is expected when switching quickly
        }
      });
    };

    const cleanup = () => {
      bus.audioElement?.removeEventListener('ended', onEnded);
      bus.audioElement?.removeEventListener('error', onError);
      bus.audioElement?.removeEventListener('canplay', onCanPlay);
    };

    bus.audioElement.addEventListener('ended', onEnded, { once: true });
    bus.audioElement.addEventListener('error', onError, { once: true });
    bus.audioElement.addEventListener('canplay', onCanPlay, { once: true });

    // Start loading
    bus.audioElement.load();
  });
}

/**
 * Play a sound effect immediately (high priority)
 */
export async function playSoundEffect(
  src: string,
  volume: number = 1.0
): Promise<void> {
  return enqueueAudio({
    type: 'sfx',
    priority: 10,
    audioUrl: src,
    volume,
  });
}

/**
 * Play TTS audio
 */
export async function playTTS(
  audioBlob: Blob,
  volume: number = 1.0
): Promise<void> {
  return enqueueAudio({
    type: 'tts',
    priority: 5,
    audioBlob,
    volume,
  });
}

/**
 * Get current audio bus state
 */
export function getAudioBusState(): AudioBusState {
  const bus = getAudioBus();
  return { ...bus.state };
}

/**
 * Wait for all audio to complete
 */
export async function waitForAudioComplete(): Promise<void> {
  const bus = getAudioBus();
  
  return new Promise((resolve) => {
    const check = () => {
      if (!bus.state.isPlaying && bus.state.queue.length === 0) {
        resolve();
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}

/**
 * Utility delay that respects cancellation
 */
export async function delayMs(ms: number): Promise<void> {
  const bus = getAudioBus();
  const myToken = bus.state.token;

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (myToken !== bus.state.token) {
        reject(new Error('Cancelled'));
      } else {
        resolve();
      }
    }, ms);
  });
}
