'use client';

/**
 * useSpriteTriggers Hook
 * 
 * Advanced sprite trigger system based on DOP Tirano Suite.
 * 
 * Features:
 * - Sprite Pack matching (ANY pack keyword + ALL item keys)
 * - Sprite Libraries (actions/poses/clothes with prefix-based keys)
 * - Return to Idle timer system (store-managed)
 * - Sprite Lock (keep sprite fixed with optional interval reapply)
 * - Realtime streaming support
 * 
 * FASE 2: Enhanced integration with store
 * 
 * FASE 3: V2 Trigger Collections support
 * - Trigger Collections with priority system
 * - Queue system for triggers of equal priority
 * - Sprite chains and sound chains
 */

import { useCallback, useEffect, useRef } from 'react';
import { useTavernStore } from '@/store';
import { setReturnToIdleCallback } from '@/store/slices/spriteSlice';
import type {
  SpriteTriggerHit,
  SpritePack,
  SpritePackItem,
  SpriteLibraryEntry,
  SpriteIndexEntry,
  CharacterCard,
  CharacterSpriteTrigger,
  StateSpriteCollection,
  SpriteState,
  CollectionBehavior,
  // V2 Types
  TriggerCollection,
  SpritePackV2,
  SpriteChain,
  SoundChain,
  TriggerQueueEntry,
} from '@/types';
import {
  checkTriggerCollections,
  createSpriteHandlerState,
  markCollectionTriggered,
  executeTriggerCollectionResult,
  selectSpriteFromPack,
  type SpriteTriggerContextV2,
  type TriggerCollectionMatchResult,
  type SpriteHandlerState,
} from '@/lib/triggers/handlers/sprite-handler';

// ============================================
// Token Extraction Utilities
// ============================================

/**
 * Normalize a token for matching (lowercase, remove accents)
 */
export function normalizeToken(s: string): string {
  const raw = (s ?? '').toString().trim().toLowerCase();
  if (!raw) return '';

  const deacc = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove accents

  // Keep letters/numbers/space/_/-
  const kept = deacc.replace(/[^\p{L}\p{N}\s_-]/gu, '');

  // If we removed everything (e.g., emoji token), keep the raw token
  return kept || raw;
}

/**
 * Extract pipe tokens from text (|keyword|)
 */
export function extractPipeTokens(text: string, tagDelimiters = { start: '|', end: '|' }): string[] {
  const tokens: string[] = [];
  const { start, end } = tagDelimiters;

  const escapedStart = start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedEnd = end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const re = new RegExp(`${escapedStart}([^\\n]{1,80}?)${escapedEnd}`, 'g');

  for (const m of text.matchAll(re)) {
    if (m && m[1]) tokens.push(m[1]);
  }

  return tokens;
}

/**
 * Remove pipe segments from text for plain word scanning
 */
export function removePipeSegments(text: string, tagDelimiters = { start: '|', end: '|' }): string {
  const { start, end } = tagDelimiters;
  const escapedStart = start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedEnd = end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${escapedStart}[^\\n]{1,80}?${escapedEnd}`, 'g');
  return text.replace(re, ' ');
}

/**
 * Extract word tokens from plain text
 */
export function extractWordTokens(text: string): string[] {
  const tokens: string[] = [];
  const wordRe = /[\p{L}\p{N}_-]{2,40}/gu;

  for (const m of text.matchAll(wordRe)) {
    if (m && m[0]) tokens.push(m[0]);
  }

  // Emoji / pictographs
  try {
    const emojiRe = /\p{Extended_Pictographic}/gu;
    for (const m of text.matchAll(emojiRe)) {
      if (m && m[0]) tokens.push(m[0]);
    }
  } catch {
    // Older JS engines might not support Extended_Pictographic
  }

  return tokens;
}

/**
 * Extract HUD tokens [key=value|key2]
 */
export function extractHudTokens(text: string): string[] {
  const out: string[] = [];
  const re = /\[([^\]]{1,400})\]/g;
  let m;

  while ((m = re.exec(text)) !== null) {
    const inside = (m[1] ?? '').toString();
    if (!inside) continue;

    for (const part of inside.split('|')) {
      const p = part.trim();
      if (p) out.push(p);

      // If token looks like key=value, also push value and key separately
      const eq = p.indexOf('=');
      if (eq > 0 && eq < p.length - 1) {
        const k = p.slice(0, eq).trim();
        const v = p.slice(eq + 1).trim();
        if (k) out.push(k);
        if (v) out.push(v);
      }
    }
  }

  return out;
}

// ============================================
// Token Set Builder
// ============================================

interface TokenSetOptions {
  pipeTokens?: string[];
  wordTokens?: string[];
  hudTokens?: string[];
}

/**
 * Build a set of normalized tokens for matching
 */
export function buildTokenSet(
  { pipeTokens = [], wordTokens = [], hudTokens = [] }: TokenSetOptions,
  caseSensitive: boolean
): Set<string> {
  const set = new Set<string>();

  const norm = (s: string) => {
    const t = (s ?? '').toString().trim();
    if (!t) return '';
    return caseSensitive ? t : t.toLowerCase();
  };

  for (const t of [...pipeTokens, ...wordTokens, ...hudTokens]) {
    const v = norm(t);
    if (v) set.add(v);
  }

  return set;
}

/**
 * Find first index of a keyword in text
 */
export function findFirstIndex(
  text: string,
  keyword: string,
  caseSensitive: boolean
): number {
  const h = caseSensitive ? text : text.toLowerCase();
  const n = caseSensitive ? keyword : keyword.toLowerCase();
  if (!h || !n) return -1;
  return h.indexOf(n);
}

// ============================================
// Sprite Library Helpers
// ============================================

/**
 * Build sprite key from library entry
 */
export function spriteLibKey(entry: SpriteLibraryEntry | null | undefined): string {
  if (!entry) return '';
  const prefix = (entry.prefix ?? '').toString().trim();
  const name = (entry.name ?? '').toString().trim();
  if (!prefix || !name) return '';
  return `${prefix}${name}`;
}

/**
 * Get library entry by ID
 */
export function spriteLibEntryById(
  libraries: { actions: SpriteLibraryEntry[]; poses: SpriteLibraryEntry[]; clothes: SpriteLibraryEntry[] },
  kind: 'actions' | 'poses' | 'clothes',
  id: string
): SpriteLibraryEntry | null {
  try {
    const arr = libraries?.[kind] ?? [];
    return arr.find(e => e?.id === id) || null;
  } catch {
    return null;
  }
}

/**
 * Parse CSV keys
 */
export function parseKeysCsv(raw: string): string[] {
  return (raw ?? '')
    .toString()
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);
}

/**
 * Build all keys for a sprite pack item
 * Combines library references + manual keys
 */
export function spriteItemBuiltKeys(
  libraries: { actions: SpriteLibraryEntry[]; poses: SpriteLibraryEntry[]; clothes: SpriteLibraryEntry[] },
  item: SpritePackItem
): string[] {
  const out: string[] = [];

  const a = spriteLibEntryById(libraries, 'actions', item.actionId || '');
  const p = spriteLibEntryById(libraries, 'poses', item.poseId || '');
  const c = spriteLibEntryById(libraries, 'clothes', item.clothesId || '');

  // Library keys
  for (const e of [a, p, c]) {
    const k = spriteLibKey(e);
    if (k) out.push(k);
  }

  // Manual keys
  out.push(...parseKeysCsv(item.keys));

  // De-duplicate
  const seen = new Set<string>();
  return out.filter(k => {
    const kk = k.toString().trim();
    if (!kk) return false;
    if (seen.has(kk)) return false;
    seen.add(kk);
    return true;
  });
}

// ============================================
// Sprite URL Lookup
// ============================================

/**
 * Get sprite URL by label from index
 */
export function getSpriteUrlByLabel(
  spriteIndex: { sprites: SpriteIndexEntry[] },
  label: string
): string | null {
  const entry = spriteIndex.sprites.find(s => s.label === label);
  return entry?.url || null;
}

/**
 * Get sprite URL from pack item (resolve from index or use direct URL)
 */
export function resolveSpriteUrl(
  item: SpritePackItem,
  spriteIndex: { sprites: SpriteIndexEntry[] }
): string | null {
  if (item.spriteUrl) return item.spriteUrl;
  if (item.spriteLabel) return getSpriteUrlByLabel(spriteIndex, item.spriteLabel);
  return null;
}

// ============================================
// State Collection Sprite Selection
// ============================================

/**
 * Get sprite URL from a state collection based on behavior mode
 * 
 * @param collection - The state collection to select from
 * @param updateIndex - Whether to update the collection's currentIndex (for list mode)
 * @returns The selected sprite URL and updated collection (if index changed)
 */
export function getSpriteFromCollection(
  collection: StateSpriteCollection | undefined,
  updateIndex: boolean = true
): { url: string | null; label: string | null; updatedCollection?: StateSpriteCollection } {
  if (!collection || collection.entries.length === 0) {
    return { url: null, label: null };
  }

  const { entries, behavior, currentIndex } = collection;
  const sortedEntries = [...entries].sort((a, b) => a.order - b.order);

  let selectedEntry;
  let newIndex = currentIndex;

  switch (behavior) {
    case 'principal':
      // Always use the principal sprite
      selectedEntry = sortedEntries.find(e => e.role === 'principal') || sortedEntries[0];
      break;

    case 'random':
      // Random selection from all entries
      const randomIndex = Math.floor(Math.random() * sortedEntries.length);
      selectedEntry = sortedEntries[randomIndex];
      break;

    case 'list':
      // Rotate through entries in order
      selectedEntry = sortedEntries[currentIndex % sortedEntries.length];
      newIndex = (currentIndex + 1) % sortedEntries.length;
      break;

    default:
      selectedEntry = sortedEntries[0];
  }

  if (!selectedEntry) {
    return { url: null, label: null };
  }

  const result: { url: string | null; label: string | null; updatedCollection?: StateSpriteCollection } = {
    url: selectedEntry.spriteUrl,
    label: selectedEntry.spriteLabel,
  };

  // Return updated collection if index changed (list mode)
  if (behavior === 'list' && updateIndex && newIndex !== currentIndex) {
    result.updatedCollection = {
      ...collection,
      currentIndex: newIndex,
    };
  }

  return result;
}

/**
 * Get sprite URL for a specific state (idle, talk, thinking)
 * Falls back to legacy sprites if state collection is not configured
 */
export function getStateSpriteUrl(
  state: SpriteState,
  spriteConfig: {
    sprites?: { [key in SpriteState]?: string };
    stateCollections?: { [key in SpriteState]?: StateSpriteCollection };
  },
  avatar?: string
): { url: string | null; label: string | null } {
  // First, try state collections (new system)
  const stateCollection = spriteConfig.stateCollections?.[state];
  if (stateCollection && stateCollection.entries.length > 0) {
    return getSpriteFromCollection(stateCollection, false);
  }

  // Fall back to legacy sprites
  const legacyUrl = spriteConfig.sprites?.[state];
  if (legacyUrl) {
    return { url: legacyUrl, label: null };
  }

  // Additional fallbacks
  if (state === 'talk') {
    // Talk falls back to idle
    const idleResult = getStateSpriteUrl('idle', spriteConfig, avatar);
    if (idleResult.url) return idleResult;
  }

  if (state === 'idle' && avatar) {
    // Idle falls back to avatar
    return { url: avatar, label: 'avatar' };
  }

  return { url: null, label: null };
}

// ============================================
// Sprite Pack Matching
// ============================================

/**
 * Match sprite packs against text
 * 
 * Logic:
 * 1. ANY pack keyword must match
 * 2. ALL item keys must match
 * 3. Return best match (earliest keyword occurrence)
 */
export function matchSpritePacks(
  text: string,
  packs: SpritePack[],
  spriteIndex: { sprites: SpriteIndexEntry[] },
  libraries: { actions: SpriteLibraryEntry[]; poses: SpriteLibraryEntry[]; clothes: SpriteLibraryEntry[] },
  options: {
    pipeDelimiters?: { start: string; end: string };
    tagDelimiters?: { start: string; end: string };
  } = {}
): SpriteTriggerHit | null {
  const tagDelimiters = options.tagDelimiters || options.pipeDelimiters || { start: '|', end: '|' };
  const activePacks = packs.filter(p => p.active);

  if (activePacks.length === 0) return null;

  // Extract all tokens
  const pipeTokens = extractPipeTokens(text, tagDelimiters);
  const plainText = removePipeSegments(text, tagDelimiters);
  const wordTokens = extractWordTokens(plainText);
  const hudTokens = extractHudTokens(text);

  let best: SpriteTriggerHit | null = null;

  for (const pack of activePacks) {
    const caseSensitive = pack.caseSensitive;
    const requirePipes = pack.requirePipes;

    // Build token sets
    const tokenSetAny = buildTokenSet({ pipeTokens, wordTokens, hudTokens }, caseSensitive);
    const tokenSetPipes = buildTokenSet({ pipeTokens, wordTokens: [], hudTokens: [] }, caseSensitive);

    // 1) Pack keyword match (ANY)
    let kwHitIdx = Infinity;
    let kwMatched = '';

    for (const kw of pack.keywords) {
      const needle = caseSensitive ? kw : kw.toLowerCase();
      const ok = requirePipes
        ? tokenSetPipes.has(needle)
        : (tokenSetAny.has(needle) || findFirstIndex(text, kw, caseSensitive) !== -1);

      if (!ok) continue;

      const idx = findFirstIndex(text, kw, caseSensitive);
      if (idx !== -1 && idx < kwHitIdx) {
        kwHitIdx = idx;
        kwMatched = kw;
      }
    }

    if (!kwMatched) continue;

    // 2) Item keys match (ALL keys must match)
    const items = pack.items || [];
    let chosen: SpritePackItem | null = null;
    let chosenKeyCount = 0;

    for (const item of items) {
      if (!item || item.enabled === false) continue;

      const label = (item.spriteLabel ?? '').toString().trim();
      if (!label) continue;

      const keys = spriteItemBuiltKeys(libraries, item);
      if (keys.length === 0) continue; // Items without keys don't auto-trigger

      // ALL keys must match
      let okAll = true;
      for (const k of keys) {
        const needle = caseSensitive ? k : k.toLowerCase();
        const ok = requirePipes
          ? tokenSetPipes.has(needle)
          : (tokenSetAny.has(needle) || findFirstIndex(text, k, caseSensitive) !== -1);

        if (!ok) {
          okAll = false;
          break;
        }
      }

      if (!okAll) continue;

      // Prefer more specific items (more keys)
      if (!chosen || keys.length > chosenKeyCount) {
        chosen = item;
        chosenKeyCount = keys.length;
      }
    }

    if (!chosen) continue;

    // Resolve sprite URL
    const spriteUrl = resolveSpriteUrl(chosen, spriteIndex);
    if (!spriteUrl) continue;

    const score = kwHitIdx;
    const hit: SpriteTriggerHit = {
      packId: pack.id,
      pack,
      item: chosen,
      spriteLabel: chosen.spriteLabel,
      spriteUrl,
      idleSpriteLabel: chosen.idleSpriteLabel,
      returnToIdleMs: chosen.returnToIdleMs,
      score,
    };

    if (!best || (hit.score ?? Infinity) < (best.score ?? Infinity)) {
      best = hit;
    }
  }

  return best;
}

// ============================================
// Simple Sprite Trigger Matching
// ============================================

/**
 * Get all keys from a trigger (main key + alternatives + legacy keywords)
 * Supports both new key/keys system and legacy keywords field
 */
export function getAllTriggerKeys(trigger: CharacterSpriteTrigger): string[] {
  const allKeys: string[] = [];
  
  // New system: main key
  if (trigger.key) {
    allKeys.push(trigger.key);
  }
  
  // New system: alternative keys
  if (trigger.keys && trigger.keys.length > 0) {
    allKeys.push(...trigger.keys);
  }
  
  // Legacy: keywords (only if no new keys defined)
  if (allKeys.length === 0 && trigger.keywords && trigger.keywords.length > 0) {
    allKeys.push(...trigger.keywords);
  }
  
  return allKeys;
}

/**
 * Match simple character sprite triggers (CharacterSpriteTrigger)
 * 
 * Logic: ANY key matches (main key OR any alternative key)
 * Supports both new key/keys system and legacy keywords field
 */
export function matchSimpleSpriteTriggers(
  text: string,
  triggers: CharacterSpriteTrigger[],
  options: {
    tagDelimiters?: { start: string; end: string };
  } = {}
): CharacterSpriteTrigger | null {
  const tagDelimiters = options.tagDelimiters || { start: '|', end: '|' };
  const activeTriggers = triggers.filter(t => t.active);

  if (activeTriggers.length === 0) return null;

  const pipeTokens = extractPipeTokens(text, tagDelimiters);
  const plainText = removePipeSegments(text, tagDelimiters);
  const wordTokens = extractWordTokens(plainText);

  let best: CharacterSpriteTrigger | null = null;
  let bestIdx = Infinity;
  let bestPriority = -1;

  for (const trigger of activeTriggers) {
    const caseSensitive = trigger.caseSensitive;
    const requirePipes = trigger.requirePipes;
    const triggerPriority = trigger.priority || 1;

    const tokenSetAny = buildTokenSet({ pipeTokens, wordTokens }, caseSensitive);
    const tokenSetPipes = buildTokenSet({ pipeTokens }, caseSensitive);

    // Get all keys (new system + legacy)
    const allKeys = getAllTriggerKeys(trigger);
    
    for (const kw of allKeys) {
      const needle = caseSensitive ? kw : kw.toLowerCase();
      const ok = requirePipes
        ? tokenSetPipes.has(needle)
        : (tokenSetAny.has(needle) || findFirstIndex(text, kw, caseSensitive) !== -1);

      if (!ok) continue;

      const idx = findFirstIndex(text, kw, caseSensitive);
      
      // Higher priority wins, or earlier match if same priority
      if (idx !== -1) {
        if (triggerPriority > bestPriority || 
            (triggerPriority === bestPriority && idx < bestIdx)) {
          bestIdx = idx;
          bestPriority = triggerPriority;
          best = trigger;
        }
      }
    }
  }

  return best;
}

// ============================================
// Cooldown Management
// ============================================

interface CooldownState {
  lastPackTriggerAt: Map<string, number>;
  lastGlobalTriggerAt: number;
}

const cooldownState: CooldownState = {
  lastPackTriggerAt: new Map(),
  lastGlobalTriggerAt: 0,
};

/**
 * Check if trigger is ready (cooldown elapsed)
 */
export function isCooldownReady(
  packId: string,
  cooldownMs: number,
  globalCooldownMs: number
): boolean {
  const now = Date.now();

  // Check pack-specific cooldown
  const lastPack = cooldownState.lastPackTriggerAt.get(packId) || 0;
  if (cooldownMs > 0 && now - lastPack < cooldownMs) {
    return false;
  }

  // Check global cooldown
  if (globalCooldownMs > 0 && now - cooldownState.lastGlobalTriggerAt < globalCooldownMs) {
    return false;
  }

  return true;
}

/**
 * Mark trigger as fired
 */
export function markTriggerFired(packId: string): void {
  const now = Date.now();
  cooldownState.lastPackTriggerAt.set(packId, now);
  cooldownState.lastGlobalTriggerAt = now;
}

// ============================================
// V2 Trigger Collections Matching
// ============================================

/**
 * Global handler state for V2 triggers
 */
const v2HandlerState = createSpriteHandlerState();

/**
 * Extract tokens for V2 system (same as legacy but returns DetectedToken array)
 */
export function extractTokensForV2(
  text: string,
  tagDelimiters: { start: string; end: string } = { start: '|', end: '|' }
): Array<{ token: string; type: string; wordPosition?: number }> {
  const tokens: Array<{ token: string; type: string; wordPosition?: number }> = [];
  
  // Extract pipe tokens
  const pipeTokens = extractPipeTokens(text, tagDelimiters);
  let pipeText = text;
  let pipeOffset = 0;
  
  // Find positions of pipe tokens
  for (const pipeToken of pipeTokens) {
    const searchStr = `${tagDelimiters.start}${pipeToken}${tagDelimiters.end}`;
    const idx = pipeText.indexOf(searchStr, pipeOffset);
    if (idx !== -1) {
      tokens.push({
        token: pipeToken,
        type: 'pipe',
        wordPosition: idx,
      });
      pipeOffset = idx + searchStr.length;
    }
  }
  
  // Remove pipe segments and extract word tokens
  const plainText = removePipeSegments(text, tagDelimiters);
  const wordTokens = extractWordTokens(plainText);
  
  // Find approximate positions for word tokens
  let wordOffset = 0;
  for (const wordToken of wordTokens) {
    const idx = plainText.indexOf(wordToken, wordOffset);
    if (idx !== -1) {
      tokens.push({
        token: wordToken,
        type: 'word',
        wordPosition: idx,
      });
      wordOffset = idx + wordToken.length;
    }
  }
  
  // Add HUD tokens
  const hudTokens = extractHudTokens(text);
  for (const hudToken of hudTokens) {
    tokens.push({
      token: hudToken,
      type: 'hud',
    });
  }
  
  return tokens;
}

/**
 * Match Trigger Collections against text
 * 
 * Returns the best match based on priority and position
 */
export function matchTriggerCollections(
  text: string,
  triggerCollections: TriggerCollection[],
  spritePacksV2: SpritePackV2[],
  options: {
    tagDelimiters?: { start: string; end: string };
    caseSensitive?: boolean;
  } = {}
): TriggerCollectionMatchResult | null {
  const { tagDelimiters = { start: '|', end: '|' } } = options;
  
  if (triggerCollections.length === 0 || spritePacksV2.length === 0) {
    return null;
  }
  
  // Extract tokens
  const rawTokens = extractTokensForV2(text, tagDelimiters);
  
  // Convert to DetectedToken format
  const tokens = rawTokens.map((t, index) => ({
    token: t.token,
    type: t.type as 'word' | 'pipe' | 'hud',
    wordPosition: t.wordPosition,
    position: index,
  }));
  
  // Build context
  const context: SpriteTriggerContextV2 = {
    triggerCollections,
    spritePacksV2,
    spriteIndex: { sprites: [] },
    character: null,
    messageKey: `msg_${Date.now()}`,
    isSpriteLocked: false,
  };
  
  // Check collections
  return checkTriggerCollections(tokens, context, v2HandlerState);
}

/**
 * Get sprite from State Collection V2
 */
export function getSpriteFromStateCollectionV2(
  pack: SpritePackV2,
  behavior: 'principal' | 'random' | 'list',
  principalSpriteId?: string,
  excludedSpriteIds?: string[]
): { url: string | null; label: string | null; spriteId: string | null } {
  if (!pack || pack.sprites.length === 0) {
    return { url: null, label: null, spriteId: null };
  }
  
  // Filter out excluded sprites
  let availableSprites = pack.sprites;
  if (excludedSpriteIds && excludedSpriteIds.length > 0) {
    availableSprites = pack.sprites.filter(s => !excludedSpriteIds.includes(s.id));
  }
  
  if (availableSprites.length === 0) {
    return { url: null, label: null, spriteId: null };
  }
  
  // Create temporary pack with filtered sprites
  const filteredPack: SpritePackV2 = {
    ...pack,
    sprites: availableSprites,
  };
  
  const selected = selectSpriteFromPack(filteredPack, behavior, principalSpriteId);
  
  if (!selected) {
    return { url: null, label: null, spriteId: null };
  }
  
  return {
    url: selected.url,
    label: selected.label,
    spriteId: selected.id,
  };
}

// ============================================
// Main Hook
// ============================================

interface UseSpriteTriggersOptions {
  globalCooldownMs?: number;
  enabled?: boolean;
  realtimeEnabled?: boolean;
  tagDelimiters?: { start: string; end: string };
}

export function useSpriteTriggers(options: UseSpriteTriggersOptions = {}) {
  const {
    globalCooldownMs = 250,
    enabled = true,
    tagDelimiters = { start: '|', end: '|' },
  } = options;

  const store = useTavernStore();
  
  // Ref to track handler state per message
  const handlerStateRef = useRef<SpriteHandlerState>(createSpriteHandlerState());

  /**
   * Scan text for V2 Trigger Collections and apply them
   * Uses the new priority and queue system
   */
  const scanForTriggerCollectionsV2 = useCallback(
    (text: string, character: CharacterCard | null) => {
      if (!enabled || !text.trim() || !character) return null;

      // Check if sprite is locked
      if (store.isSpriteLocked && store.isSpriteLocked()) {
        return null;
      }

      // Get trigger collections and sprite packs from character
      const triggerCollections = character.triggerCollections || [];
      const spritePacksV2 = character.spritePacksV2 || store.spritePacksV2 || [];
      
      if (triggerCollections.length === 0) {
        return null;
      }

      // Match against trigger collections
      const result = matchTriggerCollections(
        text,
        triggerCollections,
        spritePacksV2,
        { tagDelimiters }
      );

      if (!result) {
        return null;
      }

      // Mark as triggered for cooldown
      markCollectionTriggered(result.collection.id, handlerStateRef.current);

      return result;
    },
    [enabled, store, tagDelimiters]
  );

  /**
   * Apply a V2 trigger collection result
   */
  const applyTriggerCollectionResult = useCallback(
    (result: TriggerCollectionMatchResult, character: CharacterCard | null) => {
      if (!character?.id) return;

      const characterId = character.id;

      // Check if we should add to queue or execute immediately
      const charState = store.getCharacterSpriteState(characterId);
      const hasActiveTrigger = charState.triggerQueue.active !== null;

      if (hasActiveTrigger) {
        // Add to queue
        store.addTriggerToQueue(characterId, {
          triggerCollectionId: result.collection.id,
          spriteId: result.selectedSprite.id,
          source: result.matchSource,
        });
        return result;
      }

      // Execute immediately
      executeTriggerCollectionResult(
        result,
        {
          triggerCollections: character.triggerCollections || [],
          spritePacksV2: character.spritePacksV2 || store.spritePacksV2 || [],
          spriteIndex: store.spriteIndex,
          character,
          messageKey: `msg_${Date.now()}`,
          isSpriteLocked: store.isSpriteLocked?.() ?? false,
        },
        {
          applyTriggerForCharacter: (id, hit) => {
            store.applyTriggerForCharacter(id, {
              spriteUrl: hit.spriteUrl,
              spriteLabel: hit.spriteLabel,
              returnToIdleMs: hit.returnToIdleMs,
              packId: hit.packId,
              spriteLabel: hit.spriteLabel,
            } as SpriteTriggerHit);
          },
          scheduleReturnToIdleForCharacter: store.scheduleReturnToIdleForCharacter,
          addTriggerToQueue: store.addTriggerToQueue,
          startSpriteChain: store.startSpriteChain,
          startSoundChain: store.startSoundChain,
        },
        () => {
          // Get idle sprite from state collection V2
          const idleCollection = character.stateCollectionsV2?.find(c => c.state === 'idle');
          if (idleCollection) {
            const pack = character.spritePacksV2?.find(p => p.id === idleCollection.packId);
            if (pack) {
              const { url } = getSpriteFromStateCollectionV2(
                pack,
                idleCollection.behavior,
                idleCollection.principalSpriteId,
                idleCollection.excludedSpriteIds
              );
              return url;
            }
          }
          // Fall back to legacy
          return character.spriteConfig?.sprites?.['idle'] || character.avatar || null;
        }
      );

      return result;
    },
    [store]
  );

  /**
   * Scan and apply V2 triggers in one call
   */
  const scanAndApplyV2 = useCallback(
    (text: string, character: CharacterCard | null) => {
      const result = scanForTriggerCollectionsV2(text, character);
      if (result && character) {
        return applyTriggerCollectionResult(result, character);
      }
      return null;
    },
    [scanForTriggerCollectionsV2, applyTriggerCollectionResult]
  );

  /**
   * Scan text for sprite triggers and apply them
   */
  const scanForSpriteTriggers = useCallback(
    (text: string, character: CharacterCard | null) => {
      if (!enabled || !text.trim()) return null;

      // Check if sprite is locked
      if (store.isSpriteLocked && store.isSpriteLocked()) {
        return null;
      }

      // Check if return to idle is scheduled - allow it to be interrupted by new triggers
      // (this is intentional behavior - new triggers can override pending idle return)

      // Try sprite packs first (priority)
      const packs = character?.spritePacks || store.spritePacks || [];
      const hit = matchSpritePacks(
        text,
        packs,
        store.spriteIndex,
        store.spriteLibraries,
        { tagDelimiters }
      );

      if (hit && hit.pack) {
        const cooldown = hit.pack.cooldownMs || 0;
        if (isCooldownReady(hit.packId, cooldown, globalCooldownMs)) {
          markTriggerFired(hit.packId);
          return hit;
        }
      }

      // Try simple triggers
      const simpleTriggers = character?.spriteTriggers || [];
      if (simpleTriggers.length > 0) {
        const simpleHit = matchSimpleSpriteTriggers(text, simpleTriggers, { tagDelimiters });
        if (simpleHit) {
          // Check cooldown for simple trigger
          const triggerId = `simple_${simpleHit.id}`;
          if (isCooldownReady(triggerId, simpleHit.cooldownMs || 0, globalCooldownMs)) {
            markTriggerFired(triggerId);
            return {
              packId: triggerId,
              spriteLabel: simpleHit.spriteState || null,
              spriteUrl: simpleHit.spriteUrl,
              idleSpriteLabel: null,
              returnToIdleMs: simpleHit.returnToIdleMs,
              returnToMode: simpleHit.returnToMode || 'idle_collection',
              returnToSpriteUrl: simpleHit.returnToSpriteUrl,
              cooldownMs: simpleHit.cooldownMs,
              item: undefined,
              pack: undefined,
            } as SpriteTriggerHit;
          }
        }
      }

      return null;
    },
    [enabled, globalCooldownMs, store, tagDelimiters]
  );

  /**
   * Apply a sprite trigger hit for a specific character
   * Uses the UNIFIED system with per-character state
   */
  const applyTrigger = useCallback(
    (hit: SpriteTriggerHit, character?: CharacterCard | null) => {
      if (!hit.spriteUrl || !character?.id) return;

      const characterId = character.id;

      // Apply the sprite using the UNIFIED per-character system
      store.applyTriggerForCharacter(characterId, hit);

      // Schedule return to idle if configured
      // Use 'clear' mode to let the normal logic determine what sprite to show
      // based on current state (talk/thinking/idle)
      if (hit.returnToIdleMs && hit.returnToIdleMs > 0) {
        let returnToMode: 'idle' | 'talk' | 'thinking' | 'clear' = 'clear';
        let returnSpriteUrl: string | null = null;
        let returnSpriteLabel: string | null = null;

        if (hit.returnToMode === 'custom_sprite' && hit.returnToSpriteUrl) {
          // Return to custom sprite - use 'idle' mode with specific sprite
          returnToMode = 'idle';
          returnSpriteUrl = hit.returnToSpriteUrl;
          returnSpriteLabel = 'custom_return';
        } else {
          // Default: use 'clear' mode to let normal logic determine what to show
          // This ensures that if the character is in talk/thinking mode, the correct sprite shows
          returnToMode = 'clear';
          
          // Still get the idle sprite URL for reference (used by some UI elements)
          const idleCollection = character?.spriteConfig?.stateCollections?.['idle'];
          if (idleCollection && idleCollection.entries.length > 0) {
            const result = getSpriteFromCollection(idleCollection, false);
            returnSpriteUrl = result.url;
            returnSpriteLabel = result.label;
          }
          // Fall back to legacy idle sprite
          if (!returnSpriteUrl && character?.spriteConfig?.sprites?.['idle']) {
            returnSpriteUrl = character.spriteConfig.sprites['idle'];
            returnSpriteLabel = 'idle';
          }
          // Fall back to avatar
          if (!returnSpriteUrl && character?.avatar) {
            returnSpriteUrl = character.avatar;
            returnSpriteLabel = 'avatar';
          }
        }
        
        // Schedule the return - using 'clear' mode by default
        store.scheduleReturnToIdleForCharacter(
          characterId,
          hit.spriteUrl,
          returnToMode,
          returnSpriteUrl || '',
          returnSpriteLabel,
          hit.returnToIdleMs
        );
      }
      
      return hit;
    },
    [store]
  );

  /**
   * Scan and apply triggers in one call
   * Returns the hit if a trigger was applied
   */
  const scanAndApply = useCallback(
    (text: string, character: CharacterCard | null) => {
      const hit = scanForSpriteTriggers(text, character);
      if (hit && character) {
        applyTrigger(hit, character);
      }
      return hit;
    },
    [scanForSpriteTriggers, applyTrigger]
  );

  /**
   * Reset trigger state for a specific character
   */
  const resetTriggerStateForCharacter = useCallback((characterId: string) => {
    store.cancelReturnToIdleForCharacter(characterId);
  }, [store]);

  /**
   * Reset trigger state for new message (legacy - uses active character)
   */
  const resetTriggerState = useCallback(() => {
    // Cancel any pending return to idle
    store.cancelReturnToIdle();
  }, [store]);

  /**
   * Get sprite state for a specific character
   */
  const getCharacterSpriteState = useCallback((characterId: string) => {
    return store.getCharacterSpriteState(characterId);
  }, [store]);

  /**
   * Get return to idle countdown for a specific character
   */
  const getReturnToIdleCountdownForCharacter = useCallback((characterId: string) => {
    return store.getReturnToIdleCountdownForCharacter(characterId);
  }, [store]);

  /**
   * Check if return to idle is scheduled for a specific character
   */
  const isReturnToIdleScheduledForCharacter = useCallback((characterId: string) => {
    return store.isReturnToIdleScheduledForCharacter(characterId);
  }, [store]);

  /**
   * Lock sprite (prevent trigger changes)
   */
  const lockSprite = useCallback(
    (url: string, durationMs: number = 0, intervalMs: number = 0) => {
      store.applySpriteLock(url, durationMs, intervalMs);
    },
    [store]
  );

  /**
   * Unlock sprite
   */
  const unlockSprite = useCallback(() => {
    store.clearSpriteLock();
  }, [store]);

  /**
   * Cancel pending return to idle
   */
  const cancelIdleReturn = useCallback(() => {
    store.cancelReturnToIdle();
  }, [store]);

  /**
   * Force immediate return to idle
   */
  const forceIdleReturn = useCallback(() => {
    store.executeReturnToIdle();
  }, [store]);

  // Set up callback for return to idle (for external listeners)
  useEffect(() => {
    setReturnToIdleCallback(() => {
      // Can be used to trigger animations or other effects
      // when return to idle executes
    });

    return () => {
      setReturnToIdleCallback(null);
    };
  }, []);

  return {
    // ============================================
    // V2 Trigger Collections System (NEW)
    // ============================================
    scanForTriggerCollectionsV2,
    applyTriggerCollectionResult,
    scanAndApplyV2,
    
    // V2 State helpers
    getSpriteFromStateCollectionV2,
    matchTriggerCollections,
    
    // ============================================
    // Legacy Core functions
    // ============================================
    scanForSpriteTriggers,
    applyTrigger,
    scanAndApply,

    // Per-character functions (UNIFIED SYSTEM)
    getCharacterSpriteState,
    getReturnToIdleCountdownForCharacter,
    isReturnToIdleScheduledForCharacter,
    resetTriggerStateForCharacter,

    // State management (legacy)
    resetTriggerState,
    lockSprite,
    unlockSprite,
    cancelIdleReturn,
    forceIdleReturn,

    // Current state (from store - legacy, for single chat)
    currentSpriteUrl: store.currentSpriteUrl,
    currentSpriteLabel: store.currentSpriteLabel,
    isLocked: store.isSpriteLocked(),
    isReturnToIdleScheduled: store.isReturnToIdleScheduled(),
    returnToIdleCountdown: store.getReturnToIdleCountdown(),
    returnToIdleState: store.returnToIdle,
    lockState: store.spriteLock,

    // Utilities (exposed for testing/debugging)
    extractPipeTokens,
    extractWordTokens,
    extractHudTokens,
    matchSpritePacks,
    matchSimpleSpriteTriggers,
  };
}

export default useSpriteTriggers;
