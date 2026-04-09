'use client';

import { useRef, useCallback, useEffect } from 'react';
import { useTavernStore } from '@/store/tavern-store';
import type { BackgroundPack, BackgroundTriggerHit, BackgroundIndexEntry } from '@/types';

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
 * Find first index of keyword in text (case insensitive)
 */
function findFirstIndex(text: string, keyword: string, caseSensitive: boolean): number {
  if (!keyword) return -1;
  const searchStr = caseSensitive ? keyword : keyword.toLowerCase();
  const textStr = caseSensitive ? text : text.toLowerCase();
  return textStr.indexOf(searchStr);
}

/**
 * Check if keyword exists in text
 */
function keywordMatches(text: string, keyword: string, caseSensitive: boolean): boolean {
  return findFirstIndex(text, keyword, caseSensitive) !== -1;
}

// ============ Cooldown Tracking ============

const lastBgChangeByPack = new Map<string, number>();
let lastGlobalBgChange = 0;

function isBgCooldownReady(
  packId: string, 
  packCooldown: number, 
  globalCooldown: number
): boolean {
  const now = Date.now();
  
  // Check pack-specific cooldown
  const lastPackChange = lastBgChangeByPack.get(packId) || 0;
  if (packCooldown > 0 && now - lastPackChange < packCooldown) {
    return false;
  }
  
  // Check global cooldown
  if (globalCooldown > 0 && now - lastGlobalBgChange < globalCooldown) {
    return false;
  }
  
  return true;
}

function markBgChanged(packId: string): void {
  const now = Date.now();
  lastBgChangeByPack.set(packId, now);
  lastGlobalBgChange = now;
}

// ============ Cycle Index Tracking ============

const packCycleIndexes = new Map<string, number>();

function getCycleIndex(packId: string, maxItems: number): number {
  const current = packCycleIndexes.get(packId) || 0;
  const nextIndex = (current + 1) % maxItems;
  packCycleIndexes.set(packId, nextIndex);
  return current;
}

function getRandomIndex(maxItems: number): number {
  return Math.floor(Math.random() * maxItems);
}

// ============ Background URL Lookup ============

function getBgUrlByLabel(label: string, index: BackgroundIndexEntry[]): string {
  const entry = index.find(e => e.label === label);
  return entry?.url || '';
}

// ============ Trigger State (per message) ============

interface MessageState {
  bgChanged: boolean;
}

const messageStates = new Map<string, MessageState>();

function getMessageState(messageKey: string): MessageState {
  if (!messageStates.has(messageKey)) {
    messageStates.set(messageKey, { bgChanged: false });
  }
  return messageStates.get(messageKey)!;
}

function resetMessageState(messageKey: string): void {
  messageStates.set(messageKey, { bgChanged: false });
}

// ============ Hook ============

export function useBackgroundTriggers() {
  const state = useTavernStore();
  
  const backgroundPacks = state.backgroundPacks;
  const backgroundIndex = state.backgroundIndex;
  const settings = state.settings;
  const setBackgroundIndex = state.setBackgroundIndex;
  const applyBackgroundHit = state.applyBackgroundHit;
  const updateBackgroundPackIndex = state.updateBackgroundPackIndex;
  
  const currentMessageKeyRef = useRef<string>('');
  const indexLoadedRef = useRef(false);
  
  // Load background index on mount
  useEffect(() => {
    const loadIndex = async () => {
      if (indexLoadedRef.current) return;
      
      try {
        console.log('[BgTriggers] 🔄 Loading background index from API...');
        const response = await fetch('/api/backgrounds/index');
        const data = await response.json();
        
        console.log(`[BgTriggers] ✅ API returned ${data.backgrounds?.length || 0} backgrounds`);
        setBackgroundIndex(data);
        indexLoadedRef.current = true;
      } catch (error) {
        console.error('[BgTriggers] ❌ Failed to load background index:', error);
      }
    };
    
    loadIndex();
  }, [setBackgroundIndex]);
  
  /**
   * Match background packs against text
   * Returns the best matching background hit or null
   */
  const matchBackgroundPacks = useCallback((text: string): BackgroundTriggerHit | null => {
    const packs = backgroundPacks.filter(p => p.active);
    if (packs.length === 0) return null;
    
    let bestHit: BackgroundTriggerHit | null = null;
    let bestScore = Infinity;
    
    for (const pack of packs) {
      const caseSensitive = pack.caseSensitive;
      const requireBgKey = pack.requireBgKey !== false;
      
      // 1) Check pack keywords
      let kwHitIdx = Infinity;
      let matchedKeyword = '';
      
      for (const kw of pack.keywords) {
        if (!kw || kw.trim() === '') continue;
        
        const idx = findFirstIndex(text, kw, caseSensitive);
        if (idx !== -1 && idx < kwHitIdx) {
          kwHitIdx = idx;
          matchedKeyword = kw;
        }
      }
      
      // No pack keyword match
      if (!matchedKeyword) continue;
      
      // 2) Check BG-key match (within pack items)
      const items = pack.items.filter(it => it.enabled);
      const matches: { item: typeof items[0]; idx: number }[] = [];
      
      for (const item of items) {
        if (!item.key || item.key.trim() === '') continue;
        
        const idx = findFirstIndex(text, item.key, caseSensitive);
        if (idx !== -1) {
          matches.push({ item, idx });
        }
      }
      
      // If requireBgKey and no matches, skip this pack
      if (requireBgKey && matches.length === 0) continue;
      
      // Select the best matching item (earliest occurrence)
      let chosenItem = null;
      if (matches.length > 0) {
        matches.sort((a, b) => a.idx - b.idx);
        chosenItem = matches[0].item;
      } else if (items.length > 0) {
        // requireBgKey==false, pick any item
        if (pack.playMode === 'random') {
          chosenItem = items[getRandomIndex(items.length)];
        } else {
          const idx = getCycleIndex(pack.id, items.length);
          chosenItem = items[idx];
          // Update the pack's currentIndex in store
          updateBackgroundPackIndex(pack.id, (pack.currentIndex + 1) % items.length);
        }
      }
      
      if (!chosenItem) continue;
      
      // Calculate score (earlier keyword match = better)
      const score = kwHitIdx;
      if (score < bestScore) {
        bestScore = score;
        
        // Get URLs from index
        const bgUrl = chosenItem.backgroundUrl || getBgUrlByLabel(chosenItem.backgroundLabel, backgroundIndex.backgrounds);
        const overlayUrl = chosenItem.overlayUrl || (chosenItem.overlayLabel ? getBgUrlByLabel(chosenItem.overlayLabel, backgroundIndex.backgrounds) : '');
        
        bestHit = {
          packId: pack.id,
          pack,
          backgroundLabel: chosenItem.backgroundLabel,
          backgroundUrl: bgUrl,
          overlayLabel: chosenItem.overlayLabel,
          overlayPlacement: chosenItem.overlayPlacement,
          overlayUrl,
        };
      }
    }
    
    return bestHit;
  }, [backgroundPacks, backgroundIndex, updateBackgroundPackIndex]);
  
  /**
   * Scan text for background triggers and apply changes
   */
  const scanForBackgroundTriggers = useCallback((text: string, messageKey?: string) => {
    // Check if enabled
    if (!settings.backgroundTriggers?.enabled) return;
    
    const msgKey = messageKey || `msg_${Date.now()}`;
    
    // New message?
    if (currentMessageKeyRef.current !== msgKey) {
      currentMessageKeyRef.current = msgKey;
      resetMessageState(msgKey);
    }
    
    const msgState = getMessageState(msgKey);
    
    // Already changed background for this message?
    if (msgState.bgChanged) return;
    
    // Match packs
    const hit = matchBackgroundPacks(text);
    if (!hit) return;
    
    const pack = hit.pack;
    const packCooldown = pack?.cooldown || 0;
    const globalCooldown = settings.backgroundTriggers?.globalCooldown || 250;
    
    // Check cooldown
    if (!isBgCooldownReady(hit.packId, packCooldown, globalCooldown)) return;
    
    // Apply the background change
    console.log(`[BgTriggers] 🖼️ TRIGGERED: "${hit.backgroundLabel}" (pack: ${hit.pack?.title})`);
    
    applyBackgroundHit(hit);
    markBgChanged(hit.packId);
    msgState.bgChanged = true;
  }, [settings.backgroundTriggers, matchBackgroundPacks, applyBackgroundHit]);
  
  /**
   * Reset detection for a new message
   */
  const resetDetection = useCallback((messageKey?: string) => {
    const msgKey = messageKey || `msg_${Date.now()}`;
    currentMessageKeyRef.current = msgKey;
    resetMessageState(msgKey);
    console.log(`[BgTriggers] 🔄 Reset for: ${msgKey}`);
  }, []);
  
  return {
    scanForBackgroundTriggers,
    resetDetection,
    isEnabled: settings.backgroundTriggers?.enabled ?? true,
  };
}

export default useBackgroundTriggers;
