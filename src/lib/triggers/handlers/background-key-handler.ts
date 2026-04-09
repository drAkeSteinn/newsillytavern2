// ============================================
// Background Key Handler - Unified Implementation
// ============================================
//
// Handles ALL background trigger detection and execution using the unified
// KeyHandler interface. Works with DetectedKey[] from KeyDetector.
//
// Supports:
// - Background trigger packs with priority
// - Multiple match modes (any_any, all_any, any_all, all_all)
// - Overlays (layers over/under background)
// - Variants (day/night versions of same location)
// - Advanced transitions (fade, slide, zoom)
// - Return to default after inactivity
// - Per-character isolation in group chats

import type { DetectedKey } from '../key-detector';
import type { KeyHandler, TriggerMatch, TriggerMatchResult, RegisteredKey } from '../types';
import type { TriggerContext } from '../trigger-bus';
import type {
  BackgroundTriggerPack,
  BackgroundTriggerItem,
  BackgroundTriggerSettings,
  BackgroundOverlay,
  BackgroundVariant,
  BackgroundTransitionType,
  BackgroundMatchMode,
} from '@/types';
import {
  normalizeKey,
  keyMatches,
  classifyKey,
} from '../key-detector';
import {
  logHandler,
  logMatch,
  createMatch,
  successResult,
  failResult,
  CooldownTracker,
} from '../utils';

// ============================================
// Types
// ============================================

export interface BackgroundKeyHandlerContext extends TriggerContext {
  sessionId?: string;
  characterId?: string;
  backgroundPacks: BackgroundTriggerPack[];
  backgroundSettings: BackgroundTriggerSettings;
  cooldownContextKey?: string;

  // Store Actions
  setBackground?: (url: string, transition?: { type: string; duration: number }) => void;
  setOverlays?: (overlays: BackgroundOverlay[]) => void;
}

// ============================================
// Background Key Handler Class
// ============================================

export class BackgroundKeyHandler implements KeyHandler {
  readonly id = 'background-key-handler';
  readonly type = 'background' as const;
  readonly priority = 80; // After sprite, before HUD

  private cooldownTracker: CooldownTracker;
  private triggeredPositions: Map<string, Set<number>>;
  private lastTriggeredBackground: Map<string, string>;
  private lastTriggerTime: Map<string, number>;
  private activeOverlays: Map<string, BackgroundOverlay[]>;
  private activeVariant: Map<string, BackgroundVariant | null>;

  constructor() {
    this.cooldownTracker = new CooldownTracker();
    this.triggeredPositions = new Map();
    this.lastTriggeredBackground = new Map();
    this.lastTriggerTime = new Map();
    this.activeOverlays = new Map();
    this.activeVariant = new Map();
  }

  /**
   * Check if this handler should process a detected key
   */
  canHandle(key: DetectedKey, context: TriggerContext): boolean {
    const bgContext = context as Partial<BackgroundKeyHandlerContext>;

    // Check if background triggers are enabled
    if (!bgContext.backgroundSettings?.enabled) {
      return false;
    }

    // Check if category hint is background
    const category = classifyKey(key);
    if (category === 'background') {
      return true;
    }

    // Check if any background pack matches this key
    const activePacks = bgContext.backgroundPacks?.filter(p => p.active) || [];

    for (const pack of activePacks) {
      for (const item of pack.items) {
        if (!item.enabled) continue;

        // Check trigger keys
        if (item.triggerKeys.some(tk => keyMatches(key.key, tk))) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Process a key and return match result
   */
  handleKey(key: DetectedKey, context: TriggerContext): TriggerMatchResult | null {
    const bgContext = context as BackgroundKeyHandlerContext;
    const messageKey = context.messageKey;

    // Check if position already triggered
    const triggered = this.triggeredPositions.get(messageKey) ?? new Set<number>();
    if (triggered.has(key.position)) {
      return null;
    }

    // For type-indicator keys like "bg:value", use the value for matching
    const effectiveKey = this.getEffectiveKey(key);

    // Find matching background
    const result = this.findMatchingBackground(effectiveKey, bgContext);
    if (result) {
      triggered.add(key.position);
      this.triggeredPositions.set(messageKey, triggered);
      return result;
    }

    return null;
  }

  /**
   * Get effective key for matching
   * For type-indicator keys like "bg:value", returns the value
   */
  private getEffectiveKey(key: DetectedKey): DetectedKey {
    const typeIndicators = ['bg', 'background', 'fondo', 'scene'];

    if (key.format === 'key_value' && key.value && typeIndicators.includes(key.key.toLowerCase())) {
      return {
        ...key,
        key: normalizeKey(key.value),
        original: key.value,
        value: undefined,
      };
    }

    return key;
  }

  /**
   * Execute the trigger action immediately
   */
  execute(match: TriggerMatch, context: TriggerContext): void {
    const bgContext = context as BackgroundKeyHandlerContext;
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
      transitionType: BackgroundTransitionType;
      overlays?: BackgroundOverlay[];
    };

    logHandler(this.id, 'execute', {
      backgroundUrl,
      backgroundName,
      transitionType,
      transitionDuration,
    });

    // Apply background with transition
    bgContext.setBackground?.(backgroundUrl, {
      type: transitionType,
      duration: transitionDuration,
    });

    // Apply overlays if present
    if (overlays && overlays.length > 0) {
      bgContext.setOverlays?.(overlays);
    }
  }

  /**
   * Get all registered keys for word-based detection
   */
  getRegisteredKeys(context: TriggerContext): RegisteredKey[] {
    const bgContext = context as Partial<BackgroundKeyHandlerContext>;
    const keys: RegisteredKey[] = [];

    const activePacks = bgContext.backgroundPacks?.filter(p => p.active) || [];
    for (const pack of activePacks) {
      for (const item of pack.items) {
        if (!item.enabled) continue;

        for (const tk of item.triggerKeys) {
          keys.push({
            key: tk,
            category: 'background',
            config: { packId: pack.id, itemId: item.id },
          });
        }
      }
    }

    return keys;
  }

  /**
   * Check if key should be consumed
   */
  consumesKey(_key: DetectedKey): boolean {
    return true;
  }

  /**
   * Reset state for new message
   * Only clears position tracking, NOT cooldowns (to preserve per-character isolation)
   */
  reset(messageKey: string): void {
    this.triggeredPositions.delete(messageKey);
    // Don't reset cooldown tracker - cooldowns are per-character and should persist
    // across messages within the same streaming session
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.triggeredPositions.clear();
    this.lastTriggeredBackground.clear();
    this.lastTriggerTime.clear();
    this.activeOverlays.clear();
    this.activeVariant.clear();
    this.cooldownTracker.reset();
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  /**
   * Find matching background in packs
   */
  private findMatchingBackground(
    key: DetectedKey,
    context: BackgroundKeyHandlerContext
  ): TriggerMatchResult | null {
    const { backgroundPacks, backgroundSettings, cooldownContextKey } = context;

    const activePacks = backgroundPacks
      .filter(p => p.active)
      .sort((a, b) => b.priority - a.priority);

    if (activePacks.length === 0) {
      return null;
    }

    const cooldownKey = cooldownContextKey || 'default';
    const globalCooldown = backgroundSettings.globalCooldown ?? 0;

    // Collect all matches with their priorities
    const matches: Array<{
      pack: BackgroundTriggerPack;
      item: BackgroundTriggerItem;
      variant: BackgroundVariant | null;
      overlays: BackgroundOverlay[];
    }> = [];

    for (const pack of activePacks) {
      const packCooldown = pack.cooldown ?? 0;

      // Check cooldown
      if (globalCooldown > 0 || packCooldown > 0) {
        if (!this.cooldownTracker.isReady(`${cooldownKey}:${pack.id}`, packCooldown, globalCooldown)) {
          logMatch(this.id, key.key, false, { reason: 'cooldown', pack: pack.name });
          continue;
        }
      }

      // Sort items by priority
      const sortedItems = [...pack.items].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

      for (const item of sortedItems) {
        if (!item.enabled) continue;

        // Check if key matches any trigger key
        const matched = item.triggerKeys.some(tk => keyMatches(key.key, tk));
        if (!matched) continue;

        // Check for variant match
        const variant = this.findMatchingVariant(item, key);

        // Merge overlays
        const overlays = this.mergeOverlays(
          backgroundSettings.globalOverlays ?? [],
          pack.defaultOverlays ?? [],
          item.overlays ?? [],
          variant?.overlays ?? []
        );

        matches.push({ pack, item, variant, overlays });
        logMatch(this.id, key.key, true, {
          pack: pack.name,
          item: item.backgroundName,
          variant: variant?.name,
        });
      }
    }

    if (matches.length === 0) {
      return null;
    }

    // Sort by item priority (higher first)
    matches.sort((a, b) => (b.item.priority ?? 0) - (a.item.priority ?? 0));

    // Take highest priority match
    const { pack, item, variant, overlays } = matches[0];

    // Mark cooldown
    if (globalCooldown > 0 || (pack.cooldown ?? 0) > 0) {
      this.cooldownTracker.markTriggered(`${cooldownKey}:${pack.id}`);
    }

    // Update state
    this.lastTriggerTime.set(cooldownKey, Date.now());
    this.lastTriggeredBackground.set(cooldownKey, item.backgroundUrl);
    this.activeOverlays.set(cooldownKey, overlays);
    this.activeVariant.set(cooldownKey, variant);

    // Get final URL and name
    const finalUrl = variant?.url || item.backgroundUrl;
    const finalName = variant ? `${item.backgroundName} (${variant.name})` : item.backgroundName;

    // Get transition settings
    const transitionType = item.transitionType ?? pack.transitionType ?? backgroundSettings.defaultTransitionType ?? 'fade';
    const transitionDuration = item.transitionDuration ?? pack.transitionDuration ?? backgroundSettings.transitionDuration ?? 500;

    return successResult(key, createMatch('background', key.original, {
      backgroundUrl: finalUrl,
      backgroundName: finalName,
      transitionDuration,
      transitionType,
      overlays,
      packId: pack.id,
      packName: pack.name,
      priority: item.priority,
      variant,
    }));
  }

  /**
   * Find matching variant for an item
   */
  private findMatchingVariant(
    item: BackgroundTriggerItem,
    key: DetectedKey
  ): BackgroundVariant | null {
    if (!item.variants || item.variants.length === 0) {
      return null;
    }

    for (const variant of item.variants) {
      const matched = variant.triggerKeys.some(tk => keyMatches(key.key, tk));
      if (matched) {
        return variant;
      }
    }

    return null;
  }

  /**
   * Merge overlays from multiple sources
   */
  private mergeOverlays(
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
}

// ============================================
// Factory Function
// ============================================

let backgroundKeyHandlerInstance: BackgroundKeyHandler | null = null;

export function createBackgroundKeyHandler(): BackgroundKeyHandler {
  if (!backgroundKeyHandlerInstance) {
    backgroundKeyHandlerInstance = new BackgroundKeyHandler();
  }
  return backgroundKeyHandlerInstance;
}

export function resetBackgroundKeyHandler(): void {
  backgroundKeyHandlerInstance?.cleanup();
  backgroundKeyHandlerInstance = null;
}
