'use client';

import { useRef, useCallback, useEffect } from 'react';
import { useTavernStore } from '@/store/tavern-store';
import type { SoundTrigger, SoundCollection } from '@/types';

// ============ Audio Queue System ============

interface QueueItem {
  src: string;
  volume: number;
  triggerName: string;
  keyword: string;
}

const audioQueue: QueueItem[] = [];
let isPlaying = false;

async function processAudioQueue() {
  if (isPlaying || audioQueue.length === 0) return;
  
  isPlaying = true;
  console.log(`[SoundTriggers] 🎵 Processing queue, ${audioQueue.length} items pending`);
  
  while (audioQueue.length > 0) {
    const item = audioQueue.shift();
    if (!item) break;
    
    try {
      console.log(`[SoundTriggers] 🔊 Playing: "${item.triggerName}" (keyword: "${item.keyword}") -> ${item.src}`);
      const audio = new Audio(item.src);
      audio.volume = Math.min(1, Math.max(0, item.volume));
      
      await audio.play();
      
      // Wait for audio to finish
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        setTimeout(() => resolve(), 5000); // Max 5s per sound
      });
      
      // Small gap between sounds
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.warn('[SoundTriggers] ❌ Failed to play:', item.src, error);
    }
  }
  
  isPlaying = false;
  console.log('[SoundTriggers] 🎵 Queue processing complete');
}

// ============ Text Normalization ============

function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^\p{L}\p{N}]/gu, ' ') // Keep only letters and numbers
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find all positions of a keyword in text
 */
function findAllKeywordPositions(text: string, keyword: string): number[] {
  const normalizedText = normalizeText(text);
  const normalizedKeyword = normalizeText(keyword);
  if (!normalizedKeyword) return [];
  
  const positions: number[] = [];
  const words = normalizedText.split(/\s+/);
  
  let position = 0;
  for (const word of words) {
    if (word === normalizedKeyword || word.includes(normalizedKeyword)) {
      positions.push(position);
    }
    position++;
  }
  
  return positions;
}

// ============ Trigger State (per message) ============

interface TriggerState {
  detectedPositions: Set<number>; // Positions already detected
  lastTriggerTime: number; // For trigger-specific cooldown
}

interface MessageState {
  triggerStates: Map<string, TriggerState>; // Key: triggerId:keyword
  totalPlayed: number;
}

const messageStates = new Map<string, MessageState>();
const triggerLastPlayTime = new Map<string, number>(); // Global trigger cooldown tracking

function getMessageState(messageKey: string): MessageState {
  if (!messageStates.has(messageKey)) {
    messageStates.set(messageKey, {
      triggerStates: new Map(),
      totalPlayed: 0,
    });
  }
  return messageStates.get(messageKey)!;
}

function getTriggerState(messageKey: string, triggerId: string, keyword: string): TriggerState {
  const msgState = getMessageState(messageKey);
  const key = `${triggerId}:${keyword}`;
  
  if (!msgState.triggerStates.has(key)) {
    msgState.triggerStates.set(key, {
      detectedPositions: new Set(),
      lastTriggerTime: 0,
    });
  }
  
  return msgState.triggerStates.get(key)!;
}

function resetMessageState(messageKey: string): void {
  messageStates.set(messageKey, {
    triggerStates: new Map(),
    totalPlayed: 0,
  });
}

// ============ Cycle Index Tracking ============

const triggerCycleIndexes = new Map<string, number>();

function getCycleIndex(triggerId: string, maxFiles: number): number {
  const current = triggerCycleIndexes.get(triggerId) || 0;
  const nextIndex = (current + 1) % maxFiles;
  triggerCycleIndexes.set(triggerId, nextIndex);
  return current;
}

function getRandomIndex(maxFiles: number): number {
  return Math.floor(Math.random() * maxFiles);
}

// ============ Hook ============

export function useSoundTriggers() {
  const state = useTavernStore();
  
  const soundTriggers = state.soundTriggers;
  const soundCollections = state.soundCollections;
  const settings = state.settings;
  const setSoundCollections = state.setSoundCollections;
  
  const currentMessageKeyRef = useRef<string>('');
  const collectionsLoadedRef = useRef(false);
  
  // Load sound collections on mount
  useEffect(() => {
    const loadCollections = async () => {
      if (collectionsLoadedRef.current) return;
      
      try {
        console.log('[SoundTriggers] 🔄 Loading sound collections from API...');
        const response = await fetch('/api/sounds/collections');
        const data = await response.json();
        
        if (data.collections && Array.isArray(data.collections)) {
          console.log(`[SoundTriggers] ✅ API returned ${data.collections.length} collections:`);
          data.collections.forEach((c: SoundCollection) => {
            console.log(`  - "${c.name}": ${c.files.length} files`);
          });
          
          setSoundCollections(data.collections);
          collectionsLoadedRef.current = true;
        }
      } catch (error) {
        console.error('[SoundTriggers] ❌ Failed to load collections:', error);
      }
    };
    
    loadCollections();
  }, [setSoundCollections]);
  
  /**
   * Get sound file from trigger's collection using play mode
   */
  const getSoundFile = useCallback((trigger: SoundTrigger): string | null => {
    const collection = soundCollections.find(c => c.name === trigger.collection);
    
    if (!collection) {
      console.warn(`[SoundTriggers] ⚠️ Collection "${trigger.collection}" NOT FOUND for trigger "${trigger.name}"`);
      return null;
    }
    
    if (collection.files.length === 0) {
      console.warn(`[SoundTriggers] ⚠️ Collection "${trigger.collection}" is empty`);
      return null;
    }
    
    let soundIndex: number;
    if (trigger.playMode === 'random') {
      soundIndex = getRandomIndex(collection.files.length);
    } else {
      // Cyclic mode - use shared tracking
      soundIndex = getCycleIndex(trigger.id, collection.files.length);
    }
    
    const file = collection.files[soundIndex];
    console.log(`[SoundTriggers] 🎵 Selected: "${file}" (index ${soundIndex}, mode: ${trigger.playMode})`);
    return file || null;
  }, [soundCollections]);
  
  /**
   * Scan FULL content for keywords and trigger sounds
   */
  const scanStreamingContent = useCallback((fullContent: string, messageKey?: string) => {
    // Check if enabled
    if (!settings.sound?.enabled) {
      return;
    }
    
    const msgKey = messageKey || `msg_${Date.now()}`;
    
    // New message?
    if (currentMessageKeyRef.current !== msgKey) {
      console.log(`[SoundTriggers] 🆕 New message: ${msgKey}`);
      currentMessageKeyRef.current = msgKey;
      resetMessageState(msgKey);
    }
    
    const msgState = getMessageState(msgKey);
    
    const activeTriggers = soundTriggers.filter(t => t.active);
    if (activeTriggers.length === 0) {
      return;
    }
    
    const maxSounds = settings.sound?.maxSoundsPerMessage || 10;
    const globalCooldown = settings.sound?.globalCooldown || 0;
    const now = Date.now();
    
    // Check max sounds for this message
    if (msgState.totalPlayed >= maxSounds) {
      return;
    }
    
    // Scan each trigger
    for (const trigger of activeTriggers) {
      for (const keyword of trigger.keywords) {
        if (!keyword || keyword.trim() === '') continue;
        
        // Skip disabled keywords
        if (trigger.keywordsEnabled[keyword] === false) continue;
        
        const triggerKey = `${trigger.id}:${keyword}`;
        const triggerState = getTriggerState(msgKey, trigger.id, keyword);
        
        // Check trigger-specific cooldown
        const triggerCooldown = trigger.cooldown || 0;
        if (triggerCooldown > 0) {
          const lastTime = triggerLastPlayTime.get(triggerKey) || 0;
          if (now - lastTime < triggerCooldown) {
            continue; // Skip this trigger, cooldown not elapsed
          }
        }
        
        // Find ALL positions of keyword in text
        const positions = findAllKeywordPositions(fullContent, keyword);
        
        // Check each position - if not yet detected, it's a new occurrence
        for (const pos of positions) {
          if (triggerState.detectedPositions.has(pos)) {
            continue; // Already detected this position
          }
          
          // NEW occurrence found!
          triggerState.detectedPositions.add(pos);
          
          // Check global cooldown (between different triggers)
          if (globalCooldown > 0) {
            const lastGlobalTime = triggerLastPlayTime.get('__global__') || 0;
            if (now - lastGlobalTime < globalCooldown) {
              // Still queue it, just note the delay
              console.log(`[SoundTriggers] ⏳ Global cooldown active, but still queuing...`);
            }
          }
          
          // Get sound file
          const soundFile = getSoundFile(trigger);
          if (!soundFile) continue;
          
          // Calculate volume
          const volume = trigger.volume * (settings.sound?.globalVolume || 0.85);
          
          // Add to queue
          audioQueue.push({
            src: soundFile,
            volume,
            triggerName: trigger.name,
            keyword,
          });
          
          // Update cooldowns
          triggerLastPlayTime.set(triggerKey, now);
          triggerLastPlayTime.set('__global__', now);
          msgState.totalPlayed++;
          
          console.log(`[SoundTriggers] ✅ QUEUED: "${trigger.name}" (keyword: "${keyword}", position: ${pos}) -> ${soundFile}`);
          console.log(`[SoundTriggers] 📊 Queue size: ${audioQueue.length}, Total played this message: ${msgState.totalPlayed}`);
          
          if (msgState.totalPlayed >= maxSounds) break;
        }
      }
      
      if (msgState.totalPlayed >= maxSounds) break;
    }
    
    // Process queue if not already playing
    if (audioQueue.length > 0 && !isPlaying) {
      processAudioQueue();
    }
  }, [soundTriggers, settings.sound, getSoundFile]);
  
  /**
   * Reset detection for a new message
   */
  const resetDetection = useCallback((messageKey?: string) => {
    const msgKey = messageKey || `msg_${Date.now()}`;
    currentMessageKeyRef.current = msgKey;
    resetMessageState(msgKey);
    console.log(`[SoundTriggers] 🔄 Reset for: ${msgKey}`);
  }, []);
  
  /**
   * Scan a complete message (non-streaming)
   */
  const scanCompleteMessage = useCallback((content: string) => {
    if (!settings.sound?.enabled) return;
    resetDetection();
    scanStreamingContent(content);
  }, [settings.sound?.enabled, resetDetection, scanStreamingContent]);
  
  return {
    scanStreamingContent,
    scanCompleteMessage,
    resetDetection,
    isEnabled: settings.sound?.enabled ?? true,
  };
}

export default useSoundTriggers;
