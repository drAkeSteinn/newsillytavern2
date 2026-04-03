// ============================================
// Background Handler - Handles Background Triggers
// ============================================
//
// @deprecated Use BackgroundKeyHandler instead. This legacy handler is kept for
// backward compatibility but will be removed in a future version.
// The new BackgroundKeyHandler provides:
// - Unified KeyHandler interface
// - Per-character cooldown tracking for group chat
// - Better streaming support
// - Support for simple keyword triggers without type-indicator format
//
// Migration: Use createBackgroundKeyHandler() from './background-key-handler'
//
// Phase 3: Supports overlays, variants, and advanced transitions.
// 
// Features:
// - Priority-based matching
// - Multiple match modes (any_any, all_any, any_all, all_all)
// - Overlays (layers over/under background)
// - Variants (day/night versions of same location)
// - Advanced transitions (fade, slide, zoom)

import type { TriggerMatch } from '../types';
import type { DetectedToken } from '../token-detector';
import type { TriggerContext } from '../trigger-bus';
import type { 
  BackgroundTriggerPack, 
  BackgroundTriggerItem, 
  BackgroundCollection, 
  BackgroundMatchMode,
  BackgroundOverlay,
  BackgroundVariant,
  BackgroundTransitionType,
} from '@/types';
import { getCooldownManager } from '../cooldown-manager';

// ============================================
// Background Handler State
// ============================================

export interface BackgroundHandlerState {
  triggeredPositions: Map<string, Set<number>>;
  lastTriggeredBackground: Map<string, string>;
  lastTriggerTime: Map<string, number>;  // For return to default
  currentActivePack: Map<string, string>; // Track which pack is currently active
  activeOverlays: Map<string, BackgroundOverlay[]>; // Current active overlays
  activeVariant: Map<string, BackgroundVariant | null>; // Current active variant
}

export function createBackgroundHandlerState(): BackgroundHandlerState {
  return {
    triggeredPositions: new Map(),
    lastTriggeredBackground: new Map(),
    lastTriggerTime: new Map(),
    currentActivePack: new Map(),
    activeOverlays: new Map(),
    activeVariant: new Map(),
  };
}

// ============================================
// Background Trigger Context
// ============================================

export interface BackgroundTriggerContext extends TriggerContext {
  backgroundPacks: BackgroundTriggerPack[];
  backgroundCollections: BackgroundCollection[];
  backgroundSettings: {
    enabled: boolean;
    globalCooldown: number;
    transitionDuration: number;
    defaultTransitionType: BackgroundTransitionType;
    returnToDefaultEnabled: boolean;
    returnToDefaultAfter: number;
    defaultBackgroundUrl: string;
    globalOverlays: BackgroundOverlay[];
  };
  cooldownContextKey?: string;
}

export interface BackgroundHandlerResult {
  matched: boolean;
  trigger: TriggerMatch | null;
  tokens: DetectedToken[];
  shouldReturnToDefault: boolean;
}

/**
 * Extended result for multiple background matches
 * Used when processing streaming content that may have multiple background changes
 */
export interface BackgroundHandlerMultiResult {
  matched: boolean;
  triggers: Array<{
    trigger: TriggerMatch;
    tokens: DetectedToken[];
    position: number; // Character position for ordering
  }>;
}

// ============================================
// Match Mode Implementation
// ============================================

/**
 * Check if a key matches a token
 * 
 * Matching rules:
 * - Single-word key: Requires EXACT match (no partial matches)
 * - Multi-word key: Checks if the phrase appears in text
 * 
 * This prevents false positives like:
 * - "marisa" triggering "risa" (no longer matches)
 * - "alegría" triggering "ale" (no longer matches)
 */
function keyMatchesToken(key: string, tokenText: string): boolean {
  const normalizedKey = key.toLowerCase();
  const normalizedToken = tokenText.toLowerCase();
  
  if (!normalizedKey || !normalizedToken) return false;
  
  // For single-word keys, require EXACT match
  const keyWords = normalizedKey.split(/\s+/);
  if (keyWords.length === 1) {
    return normalizedToken === normalizedKey;
  }
  
  // For multi-word keys, check if the phrase appears in token
  return normalizedToken.includes(normalizedKey);
}

/**
 * Check if keys match according to the specified mode
 */
function checkMatchMode(
  triggerKeys: string[],
  contextKeys: string[],
  tokenTexts: string[],
  allText: string,
  mode: BackgroundMatchMode
): { triggerMatched: boolean; contextMatched: boolean } {
  const triggerMatched = triggerKeys.length === 0 || triggerKeys.some(key =>
    tokenTexts.some(t => keyMatchesToken(key, t)) ||
    keyMatchesToken(key, allText)
  );
  
  const allTriggerMatched = triggerKeys.length === 0 || triggerKeys.every(key =>
    tokenTexts.some(t => keyMatchesToken(key, t)) ||
    keyMatchesToken(key, allText)
  );
  
  const contextMatched = contextKeys.length === 0 || contextKeys.some(key =>
    tokenTexts.some(t => keyMatchesToken(key, t)) ||
    keyMatchesToken(key, allText)
  );
  
  const allContextMatched = contextKeys.length === 0 || contextKeys.every(key =>
    tokenTexts.some(t => keyMatchesToken(key, t)) ||
    keyMatchesToken(key, allText)
  );
  
  switch (mode) {
    case 'any_any':
      return { triggerMatched, contextMatched };
    case 'all_any':
      return { triggerMatched: allTriggerMatched, contextMatched };
    case 'any_all':
      return { triggerMatched, contextMatched: allContextMatched };
    case 'all_all':
      return { triggerMatched: allTriggerMatched, contextMatched: allContextMatched };
    default:
      return { triggerMatched, contextMatched };
  }
}

/**
 * Compare two items by priority (higher priority first)
 */
function compareByPriority(a: BackgroundTriggerItem, b: BackgroundTriggerItem): number {
  return (b.priority ?? 0) - (a.priority ?? 0);
}

/**
 * Find matching variant for an item
 */
function findMatchingVariant(
  item: BackgroundTriggerItem,
  tokenTexts: string[],
  allText: string
): BackgroundVariant | null {
  if (!item.variants || item.variants.length === 0) {
    return null;
  }
  
  // Sort variants by specificity (more context keys = more specific)
  const sortedVariants = [...item.variants].sort((a, b) => 
    (b.contextKeys?.length ?? 0) - (a.contextKeys?.length ?? 0)
  );
  
  for (const variant of sortedVariants) {
    // Check if any trigger key matches (using exact matching for single words)
    const triggerMatched = variant.triggerKeys.length === 0 || variant.triggerKeys.some(key =>
      tokenTexts.some(t => keyMatchesToken(key, t)) ||
      keyMatchesToken(key, allText)
    );
    
    // Check if any context key matches (optional)
    const contextMatched = variant.contextKeys.length === 0 || variant.contextKeys.some(key =>
      tokenTexts.some(t => keyMatchesToken(key, t)) ||
      keyMatchesToken(key, allText)
    );
    
    if (triggerMatched && contextMatched) {
      console.log(`[BgHandler] Variant matched: "${variant.name}"`);
      return variant;
    }
  }
  
  return null;
}

/**
 * Merge overlays from multiple sources
 * Priority: item overlays > variant overlays > pack default overlays > global overlays
 */
function mergeOverlays(
  globalOverlays: BackgroundOverlay[],
  packOverlays: BackgroundOverlay[],
  itemOverlays: BackgroundOverlay[],
  variantOverlays: BackgroundOverlay[] = []
): BackgroundOverlay[] {
  const overlayMap = new Map<string, BackgroundOverlay>();
  
  // Add in reverse priority order (lowest to highest)
  for (const overlay of globalOverlays) {
    overlayMap.set(overlay.id, overlay);
  }
  for (const overlay of packOverlays) {
    overlayMap.set(overlay.id, overlay);
  }
  for (const overlay of variantOverlays) {
    overlayMap.set(overlay.id, overlay);
  }
  for (const overlay of itemOverlays) {
    overlayMap.set(overlay.id, overlay);
  }
  
  return Array.from(overlayMap.values());
}

// ============================================
// Background Handler Functions
// ============================================

/**
 * Check background triggers with priority, match modes, overlays, and variants
 * 
 * Matching logic:
 * 1. Sort packs by priority (higher first)
 * 2. Sort items within each pack by priority
 * 3. Apply match mode to each item
 * 4. Check for variant matches
 * 5. Merge overlays from all sources
 * 6. Return first match (highest priority)
 * 
 * Cooldown behavior:
 * - cooldown=0: No cooldown, background can change immediately
 * - cooldown>0: Must wait before changing background again
 */
export function checkBackgroundTriggers(
  tokens: DetectedToken[],
  context: BackgroundTriggerContext,
  state: BackgroundHandlerState,
  maxChangesPerMessage: number = 1
): BackgroundHandlerResult | null {
  const { backgroundPacks, backgroundSettings, cooldownContextKey } = context;
  
  // Check if background triggers are enabled
  if (!backgroundSettings?.enabled) {
    return null;
  }
  
  // Get active packs and sort by priority (higher first)
  const activePacks = backgroundPacks
    .filter(p => p.active)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  
  if (activePacks.length === 0) {
    return null;
  }
  
  // Get cooldown manager
  const cooldownManager = getCooldownManager();
  const cooldownKey = cooldownContextKey || 'default';
  const globalCooldown = backgroundSettings.globalCooldown ?? 0;
  
  // Get triggered positions for this message
  const triggered = state.triggeredPositions.get(context.messageKey) ?? new Set<number>();
  
  // Build token text for matching
  const tokenTexts = tokens.map(t => t.token.toLowerCase());
  const allText = tokenTexts.join(' ');
  
  console.log(`[BgHandler] Checking ${tokens.length} tokens against ${activePacks.length} packs`);
  
  // Collect all matches with their priorities
  const matches: Array<{ 
    pack: BackgroundTriggerPack; 
    item: BackgroundTriggerItem;
    variant: BackgroundVariant | null;
    overlays: BackgroundOverlay[];
  }> = [];
  
  // Find matching background across all packs
  for (const pack of activePacks) {
    const packCooldown = pack.cooldown ?? 0;
    
    // Check cooldown ONLY if cooldown > 0
    if (globalCooldown > 0 || packCooldown > 0) {
      const isReady = cooldownManager.isReady(cooldownKey, pack.id, {
        global: globalCooldown,
        perTrigger: packCooldown,
      });
      
      if (!isReady) {
        console.log(`[BgHandler] Pack "${pack.name}" on cooldown, skipping`);
        continue;
      }
    }
    
    // Sort items by priority within this pack
    const sortedItems = [...pack.items].sort(compareByPriority);
    
    // Check each item in the pack
    for (const item of sortedItems) {
      if (!item.enabled) continue;
      
      // Use item's match mode or pack's default
      const matchMode = item.matchMode ?? pack.matchMode ?? 'any_any';
      
      // Check match mode
      const { triggerMatched, contextMatched } = checkMatchMode(
        item.triggerKeys,
        item.contextKeys,
        tokenTexts,
        allText,
        matchMode
      );
      
      if (!triggerMatched || !contextMatched) {
        continue;
      }
      
      // Check for variant match
      const variant = findMatchingVariant(item, tokenTexts, allText);
      
      // Merge overlays from all sources
      const overlays = mergeOverlays(
        backgroundSettings.globalOverlays ?? [],
        pack.defaultOverlays ?? [],
        item.overlays ?? [],
        variant?.overlays ?? []
      );
      
      // Found a match!
      matches.push({ pack, item, variant, overlays });
      console.log(`[BgHandler] MATCH: "${item.backgroundName}"${variant ? ` (${variant.name})` : ''} with ${overlays.length} overlays`);
    }
  }
  
  // No matches found
  if (matches.length === 0) {
    return null;
  }
  
  // Sort all matches by item priority (higher first)
  matches.sort((a, b) => (b.item.priority ?? 0) - (a.item.priority ?? 0));
  
  // Take the highest priority match
  const { pack, item, variant, overlays } = matches[0];
  
  // Mark cooldown as fired
  if (globalCooldown > 0 || (pack.cooldown ?? 0) > 0) {
    cooldownManager.markFired(cooldownKey, pack.id);
  }
  
  // Mark tokens as triggered
  tokens.forEach(t => triggered.add(t.wordPosition));
  state.triggeredPositions.set(context.messageKey, triggered);
  
  // Update state
  const now = Date.now();
  state.lastTriggerTime.set(cooldownKey, now);
  state.currentActivePack.set(cooldownKey, pack.id);
  state.activeOverlays.set(cooldownKey, overlays);
  state.activeVariant.set(cooldownKey, variant);
  
  // Use variant URL if available, otherwise item URL
  const finalUrl = variant?.url || item.backgroundUrl;
  const finalName = variant ? `${item.backgroundName} (${variant.name})` : item.backgroundName;
  
  // Get transition settings
  const transitionType = item.transitionType ?? pack.transitionType ?? backgroundSettings.defaultTransitionType ?? 'fade';
  const transitionDuration = item.transitionDuration ?? pack.transitionDuration ?? backgroundSettings.transitionDuration ?? 500;
  
  return {
    matched: true,
    trigger: {
      triggerId: pack.id,
      triggerType: 'background',
      keyword: item.triggerKeys[0] || '',
      data: {
        backgroundUrl: finalUrl,
        backgroundName: finalName,
        transitionDuration,
        transitionType,
        packName: pack.name,
        priority: item.priority,
        overlays,
        variant,
      },
    },
    tokens,
    shouldReturnToDefault: false,
  };
}

/**
 * Check background triggers and return ALL matches in order of appearance
 * This is used for streaming content where multiple background changes should occur
 * 
 * Unlike checkBackgroundTriggers which returns only the highest priority match,
 * this function returns all matches sorted by their position in the text.
 */
export function checkBackgroundTriggersMulti(
  tokens: DetectedToken[],
  context: BackgroundTriggerContext,
  state: BackgroundHandlerState
): BackgroundHandlerMultiResult {
  const { backgroundPacks, backgroundSettings, cooldownContextKey } = context;
  
  const result: BackgroundHandlerMultiResult = {
    matched: false,
    triggers: [],
  };
  
  // Check if background triggers are enabled
  if (!backgroundSettings?.enabled) {
    return result;
  }
  
  // Get active packs and sort by priority (higher first)
  const activePacks = backgroundPacks
    .filter(p => p.active)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  
  if (activePacks.length === 0) {
    return result;
  }
  
  // Get cooldown manager
  const cooldownManager = getCooldownManager();
  const cooldownKey = cooldownContextKey || 'default';
  const globalCooldown = backgroundSettings.globalCooldown ?? 0;
  
  // Get triggered positions for this message
  const triggered = state.triggeredPositions.get(context.messageKey) ?? new Set<number>();
  
  console.log(`[BgHandler] Multi-checking ${tokens.length} tokens against ${activePacks.length} packs`);
  
  // Track which tokens have been matched (to prevent same token matching multiple backgrounds)
  const matchedTokenPositions = new Set<number>();
  
  // Process tokens in order of appearance
  for (const token of tokens) {
    // Skip if this token position already triggered a background
    if (triggered.has(token.wordPosition) || matchedTokenPositions.has(token.wordPosition)) {
      continue;
    }
    
    const tokenText = token.token.toLowerCase();
    
    // Find matching background for this token
    for (const pack of activePacks) {
      const packCooldown = pack.cooldown ?? 0;
      
      // Check cooldown ONLY if cooldown > 0
      if (globalCooldown > 0 || packCooldown > 0) {
        const isReady = cooldownManager.isReady(cooldownKey, pack.id, {
          global: globalCooldown,
          perTrigger: packCooldown,
        });
        
        if (!isReady) {
          continue; // Skip this pack but continue with others
        }
      }
      
      // Sort items by priority within this pack
      const sortedItems = [...pack.items].sort(compareByPriority);
      
      // Check each item in the pack
      for (const item of sortedItems) {
        if (!item.enabled) continue;
        
        // Check if this token matches any trigger key (exact match)
        const keyMatch = item.triggerKeys.some(tk => tk.toLowerCase() === tokenText);
        
        if (!keyMatch) continue;
        
        // Found a match!
        console.log(`[BgHandler] Multi-MATCH: "${item.backgroundName}" for token "${token.original}" at position ${token.position}`);
        
        // Check for variant match
        const variant = findMatchingVariant(item, [tokenText], tokenText);
        
        // Merge overlays from all sources
        const overlays = mergeOverlays(
          backgroundSettings.globalOverlays ?? [],
          pack.defaultOverlays ?? [],
          item.overlays ?? [],
          variant?.overlays ?? []
        );
        
        // Use variant URL if available, otherwise item URL
        const finalUrl = variant?.url || item.backgroundUrl;
        const finalName = variant ? `${item.backgroundName} (${variant.name})` : item.backgroundName;
        
        // Get transition settings
        const transitionType = item.transitionType ?? pack.transitionType ?? backgroundSettings.defaultTransitionType ?? 'fade';
        const transitionDuration = item.transitionDuration ?? pack.transitionDuration ?? backgroundSettings.transitionDuration ?? 500;
        
        // Create trigger match
        const triggerMatch: TriggerMatch = {
          triggerId: pack.id,
          triggerType: 'background',
          keyword: item.triggerKeys[0] || '',
          data: {
            backgroundUrl: finalUrl,
            backgroundName: finalName,
            transitionDuration,
            transitionType,
            packName: pack.name,
            priority: item.priority,
            overlays,
            variant,
          },
        };
        
        // Add to results
        result.triggers.push({
          trigger: triggerMatch,
          tokens: [token],
          position: token.position,
        });
        
        // Mark this token position as matched
        matchedTokenPositions.add(token.wordPosition);
        triggered.add(token.wordPosition);
        
        // Mark cooldown as fired
        if (globalCooldown > 0 || (pack.cooldown ?? 0) > 0) {
          cooldownManager.markFired(cooldownKey, pack.id);
        }
        
        result.matched = true;
        
        // Break to next token (one background per token)
        break;
      }
      
      // If we matched for this token, move to next token
      if (matchedTokenPositions.has(token.wordPosition)) {
        break;
      }
    }
  }
  
  // Update state
  state.triggeredPositions.set(context.messageKey, triggered);
  
  // Sort triggers by position (order of appearance in text)
  result.triggers.sort((a, b) => a.position - b.position);
  
  if (result.triggers.length > 0) {
    console.log(`[BgHandler] Multi-result: ${result.triggers.length} background changes in order: ${result.triggers.map(t => t.trigger.data?.backgroundName).join(' → ')}`);
  }
  
  return result;
}

/**
 * Check if should return to default background
 */
export function checkReturnToDefault(
  context: BackgroundTriggerContext,
  state: BackgroundHandlerState
): { shouldReturn: boolean; defaultUrl: string; overlays: BackgroundOverlay[] } | null {
  const { backgroundSettings, cooldownContextKey } = context;
  const cooldownKey = cooldownContextKey || 'default';
  
  // Check if return to default is enabled
  if (!backgroundSettings?.returnToDefaultEnabled) {
    return null;
  }
  
  const lastTriggerTime = state.lastTriggerTime.get(cooldownKey);
  if (!lastTriggerTime) {
    return null;
  }
  
  const elapsed = Date.now() - lastTriggerTime;
  const returnAfter = backgroundSettings.returnToDefaultAfter ?? 300000; // Default 5 minutes
  
  if (elapsed >= returnAfter) {
    // Check for pack-specific default
    const activePackId = state.currentActivePack.get(cooldownKey);
    const activePack = context.backgroundPacks.find(p => p.id === activePackId);
    
    // Priority: pack default > global default
    const defaultUrl = activePack?.defaultBackground || backgroundSettings.defaultBackgroundUrl;
    
    // Use global overlays for default
    const overlays = backgroundSettings.globalOverlays ?? [];
    
    if (defaultUrl) {
      console.log(`[BgHandler] Return to default triggered after ${elapsed}ms`);
      state.lastTriggerTime.delete(cooldownKey);
      state.activeOverlays.set(cooldownKey, overlays);
      state.activeVariant.set(cooldownKey, null);
      return { shouldReturn: true, defaultUrl, overlays };
    }
  }
  
  return null;
}

/**
 * Execute background trigger - applies the background change with overlays
 */
export function executeBackgroundTrigger(
  match: TriggerMatch,
  context: TriggerContext,
  callbacks: {
    setBackground: (url: string, transition?: { type: string; duration: number }) => void;
    setOverlays?: (overlays: BackgroundOverlay[]) => void;
  }
): void {
  const { 
    backgroundUrl, 
    backgroundName, 
    transitionDuration, 
    transitionType,
    overlays,
  } = match.data as {
    backgroundUrl: string;
    backgroundName: string;
    transitionDuration: number;
    transitionType: string;
    overlays?: BackgroundOverlay[];
  };
  
  console.log(`[BgHandler] Applying background: "${backgroundName}" (${transitionType} ${transitionDuration}ms)`);
  
  // Set background with transition
  callbacks.setBackground(backgroundUrl, {
    type: transitionType,
    duration: transitionDuration,
  });
  
  // Set overlays if callback provided
  if (callbacks.setOverlays && overlays) {
    callbacks.setOverlays(overlays);
  }
}

/**
 * Execute all background triggers from a multi-result
 * Applies backgrounds in order with a small delay between changes
 */
export function executeAllBackgroundTriggers(
  result: BackgroundHandlerMultiResult,
  context: TriggerContext,
  callbacks: {
    setBackground: (url: string, transition?: { type: string; duration: number }) => void;
    setOverlays?: (overlays: BackgroundOverlay[]) => void;
  }
): void {
  if (!result.matched || result.triggers.length === 0) return;
  
  console.log(`[BgHandler] Executing ${result.triggers.length} background change(s)`);
  
  // Execute each trigger in order
  for (let i = 0; i < result.triggers.length; i++) {
    const { trigger } = result.triggers[i];
    
    // Add a small delay between background changes for visual effect
    // The first change happens immediately, subsequent changes after the transition
    if (i > 0) {
      // Get the transition duration from the previous trigger
      const prevData = result.triggers[i - 1].trigger.data as {
        transitionDuration?: number;
      };
      const delay = prevData.transitionDuration ?? 500;
      
      // Use setTimeout to delay subsequent changes
      setTimeout(() => {
        executeBackgroundTrigger(trigger, context, callbacks);
      }, delay * i);
    } else {
      // Execute first trigger immediately
      executeBackgroundTrigger(trigger, context, callbacks);
    }
  }
}

/**
 * Get current active overlays
 */
export function getActiveOverlays(state: BackgroundHandlerState, contextKey: string = 'default'): BackgroundOverlay[] {
  return state.activeOverlays.get(contextKey) ?? [];
}

/**
 * Reset state for new message
 */
export function resetBackgroundHandlerState(state: BackgroundHandlerState, messageKey: string): void {
  state.triggeredPositions.delete(messageKey);
}

/**
 * Clear all background handler state
 */
export function clearBackgroundHandlerState(state: BackgroundHandlerState): void {
  state.triggeredPositions.clear();
  state.lastTriggeredBackground.clear();
  state.lastTriggerTime.clear();
  state.currentActivePack.clear();
}

/**
 * Reset cooldown for a context
 */
export function resetBackgroundCooldowns(contextKey: string): void {
  const cooldownManager = getCooldownManager();
  cooldownManager.reset(contextKey);
}

/**
 * Clear all background cooldowns
 */
export function clearAllBackgroundCooldowns(): void {
  const cooldownManager = getCooldownManager();
  cooldownManager.resetAll();
}
