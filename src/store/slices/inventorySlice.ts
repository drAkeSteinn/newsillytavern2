// ============================================
// Inventory Slice V2 - Redesigned for persona-based inventory
// ============================================
//
// Key concepts:
// - Items belong to the persona (user), not characters
// - Two item types: consumable (temporary, with duration) and equipment (permanent)
// - Currency ("divisa") is on the persona
// - Consumables modify attributes for N turns, then expire
// - Equipment modifies attributes permanently while equipped
// - Effects are applied BEFORE prompt is built
// - Shop allows buying items with currency
// - Items can be detected in AI messages via triggerKeywords

import type { StateCreator } from 'zustand';
import {
  DEFAULT_INVENTORY_V2_SETTINGS,
  type Item,
  type ItemRarity,
  type ItemSlot,
  type ItemAttributeEffect,
  type ActiveConsumableEffect,
  type PersonaInventoryEntry,
  type InventoryV2Settings,
  type InventoryNotification,
  type CostOperator,
  type SessionStats,
} from '@/types';

// Re-export for convenience
export { DEFAULT_INVENTORY_V2_SETTINGS };

// ============================================
// Helper Functions
// ============================================

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Apply a single item attribute effect to SessionStats via updateCharacterStat.
 * This directly modifies the session stats so the UI reflects the change.
 *
 * IMPORTANT: When the character stats for a target don't exist in the session
 * yet (e.g., persona stats were configured after session creation), we must
 * look up the default value from the statsConfig BEFORE computing the effect.
 * Otherwise, updateCharacterStat's auto-initialization would create default
 * values, but our computation would be based on 0 (the "missing" value),
 * resulting in incorrect attribute values (e.g., vida=10 instead of vida=110).
 */
function applyEffectToSessionStats(
  stateAny: any,
  effect: ItemAttributeEffect
): void {
  const sessionId = stateAny.activeSessionId as string | undefined;
  if (!sessionId) {
    console.warn('[Inventory] applyEffectToSessionStats: no active session');
    return;
  }

  const targetId = effect.targetId || '__user__';
  let currentValue = stateAny.getAttributeValue?.(sessionId, targetId, effect.attributeKey);

  // If the attribute doesn't exist yet in session stats, look up the default
  // value from the character's/persona's statsConfig. This is critical because
  // updateCharacterStat auto-initializes character stats with defaults, so
  // computing based on 0 would give wrong results (e.g., 0+10=10 instead of 100+10=110).
  if (currentValue === null || currentValue === undefined) {
    const defaultValue = getDefaultAttributeValue(stateAny, targetId, effect.attributeKey);
    if (defaultValue !== null) {
      currentValue = defaultValue;
      console.log('[Inventory] applyEffectToSessionStats: attribute not in session, using config default', {
        targetId,
        attributeKey: effect.attributeKey,
        defaultValue,
      });
    }
  }

  // If still null, default to 0 for numeric operations (truly new attribute)
  const currentNum = (currentValue !== null && currentValue !== undefined)
    ? (typeof currentValue === 'number' ? currentValue : parseFloat(String(currentValue)))
    : 0;

  if (isNaN(currentNum) && currentValue !== null && currentValue !== undefined) {
    console.warn('[Inventory] applyEffectToSessionStats: current value is NaN', { targetId, attributeKey: effect.attributeKey, currentValue });
    return;
  }

  let newValue = currentNum;
  switch (effect.operator) {
    case '+': newValue = currentNum + effect.value; break;
    case '-': newValue = currentNum - effect.value; break;
    case '*': newValue = currentNum * effect.value; break;
    case '/': newValue = effect.value !== 0 ? currentNum / effect.value : currentNum; break;
    case '=': newValue = effect.value; break;
    case 'set_min': newValue = Math.min(currentNum, effect.value); break;
    case 'set_max': newValue = Math.max(currentNum, effect.value); break;
  }

  newValue = Math.round(newValue * 100) / 100;

  console.log('[Inventory] applyEffectToSessionStats:', {
    sessionId: sessionId.slice(0, 8),
    targetId,
    attributeKey: effect.attributeKey,
    currentValue,
    currentNum,
    operator: effect.operator,
    effectValue: effect.value,
    newValue,
  });

  const result = stateAny.updateCharacterStat?.(sessionId, targetId, effect.attributeKey, newValue, 'trigger');
  if (!result || result.oldValue === undefined) {
    console.warn('[Inventory] applyEffectToSessionStats: updateCharacterStat returned no result', {
      sessionId: sessionId.slice(0, 8),
      targetId,
      attributeKey: effect.attributeKey,
      hasUpdateCharacterStat: typeof stateAny.updateCharacterStat === 'function',
    });
  } else {
    console.log('[Inventory] applyEffectToSessionStats: updateCharacterStat result', {
      oldValue: result.oldValue,
      newValue: result.newValue,
      clamped: result.clamped,
    });
  }
}

/**
 * Look up the default value for an attribute from the character's/persona's statsConfig.
 * Returns null if no default is found.
 */
function getDefaultAttributeValue(
  stateAny: any,
  targetId: string,
  attributeKey: string
): number | string | null {
  let statsConfig: any = undefined;

  if (targetId === '__user__') {
    const activePersonaId = stateAny.activePersonaId;
    const personas: any[] = stateAny.personas || [];
    const activePersona = personas.find((p: any) => p.id === activePersonaId);
    statsConfig = activePersona?.statsConfig;
  } else {
    const characters: any[] = stateAny.characters || [];
    const character = characters.find((c: any) => c.id === targetId);
    statsConfig = character?.statsConfig;
  }

  if (!statsConfig?.attributes) return null;

  const attrDef = statsConfig.attributes.find((a: any) => a.key === attributeKey);
  if (attrDef && attrDef.defaultValue !== undefined) {
    return attrDef.defaultValue;
  }

  return null;
}

/**
 * Apply multiple item effects to SessionStats.
 */
function applyEffectsToSessionStats(
  stateAny: any,
  effects: ItemAttributeEffect[]
): void {
  for (const effect of effects) {
    applyEffectToSessionStats(stateAny, effect);
  }
}

/**
 * Apply a fallback value to SessionStats for a given target/attribute.
 * If no fallback value is provided, reverse the operator of the given effect.
 */
function applyFallbackToSessionStats(
  stateAny: any,
  targetId: string,
  attributeKey: string,
  fallbackValue: string | number | undefined,
  effect?: ItemAttributeEffect
): void {
  const sessionId = stateAny.activeSessionId as string | undefined;
  if (!sessionId) return;

  const resolvedTargetId = targetId || '__user__';

  if (fallbackValue !== undefined) {
    // Use explicit fallback value
    const numValue = typeof fallbackValue === 'number'
      ? fallbackValue
      : (isNaN(Number(fallbackValue)) ? fallbackValue : Number(fallbackValue));
    try {
      stateAny.updateCharacterStat?.(sessionId, resolvedTargetId, attributeKey, numValue, 'trigger');
    } catch {
      // Non-critical
    }
  } else if (effect) {
    // No fallback - reverse the operator
    const currentValue = stateAny.getAttributeValue?.(sessionId, resolvedTargetId, attributeKey);
    if (currentValue === null || currentValue === undefined) return;

    const currentNum = typeof currentValue === 'number' ? currentValue : parseFloat(String(currentValue));
    if (isNaN(currentNum)) return;

    let newValue = currentNum;
    switch (effect.operator) {
      case '+': newValue = currentNum - effect.value; break; // reverse add
      case '-': newValue = currentNum + effect.value; break; // reverse subtract
      case '*': newValue = effect.value !== 0 ? currentNum / effect.value : currentNum; break; // reverse multiply
      case '/': newValue = currentNum * effect.value; break; // reverse divide
      case '=': break; // can't reverse a set without fallback
      case 'set_min': break; // can't reverse without fallback
      case 'set_max': break; // can't reverse without fallback
      default: break;
    }

    if (newValue !== currentNum) {
      newValue = Math.round(newValue * 100) / 100;
      try {
        stateAny.updateCharacterStat?.(sessionId, resolvedTargetId, attributeKey, newValue, 'trigger');
      } catch {
        // Non-critical
      }
    }
  }
}

// Get rarity color for display
export function getRarityColor(rarity: ItemRarity): string {
  const colors: Record<ItemRarity, string> = {
    common: 'text-gray-400',
    uncommon: 'text-green-400',
    rare: 'text-blue-400',
    epic: 'text-purple-400',
    legendary: 'text-amber-400',
    unique: 'text-red-400',
    cursed: 'text-fuchsia-400',
  };
  return colors[rarity];
}

// Get rarity background color
export function getRarityBgColor(rarity: ItemRarity): string {
  const colors: Record<ItemRarity, string> = {
    common: 'bg-gray-500/10 border-gray-500/20',
    uncommon: 'bg-green-500/10 border-green-500/20',
    rare: 'bg-blue-500/10 border-blue-500/20',
    epic: 'bg-purple-500/10 border-purple-500/20',
    legendary: 'bg-amber-500/10 border-amber-500/20',
    unique: 'bg-red-500/10 border-red-500/20',
    cursed: 'bg-fuchsia-500/10 border-fuchsia-500/20',
  };
  return colors[rarity];
}

// Get type icon
export function getItemTypeIcon(type: 'consumable' | 'equipment'): string {
  return type === 'consumable' ? '🧪' : '⚔️';
}

// Get type label
export function getItemTypeLabel(type: 'consumable' | 'equipment'): string {
  return type === 'consumable' ? 'Consumible' : 'Equipo';
}

// ============================================
// Slice Type
// ============================================

export interface InventorySlice {
  // Item Registry - all defined items available in the system
  items: Item[];

  // Active consumable effects (with remaining duration)
  activeConsumableEffects: ActiveConsumableEffect[];

  // Settings
  inventorySettings: InventoryV2Settings;

  // Notifications
  inventoryNotifications: InventoryNotification[];

  // Pending item message to be sent as user chat message
  pendingItemMessage: string | null;

  // Pending equip/use action (waiting for target selection)
  pendingEquipAction: {
    type: 'equip' | 'use';
    personaId: string;
    itemId: string;
  } | null;

  // ===== Item Registry Actions =====
  addItem: (item: Item) => void;
  updateItem: (id: string, updates: Partial<Item>) => void;
  deleteItem: (id: string) => void;
  getItemById: (id: string) => Item | undefined;
  searchItems: (query: string) => Item[];
  getItemsByType: (type: 'consumable' | 'equipment') => Item[];

  // ===== Persona Inventory Actions =====
  // These read/write persona.inventoryItems via the store's updatePersona
  addToPersona: (personaId: string, itemId: string, quantity?: number) => void;
  removeFromPersona: (personaId: string, itemId: string, quantity?: number) => void;
  getPersonaItems: (personaId: string) => Array<{ entry: PersonaInventoryEntry; item: Item }>;
  getPersonaItemCount: (personaId: string, itemId: string) => number;

  // ===== Equipment Actions =====
  equipItem: (personaId: string, itemId: string) => void;
  unequipItem: (personaId: string, itemId: string) => void;
  getEquippedItems: (personaId: string) => Array<{ entry: PersonaInventoryEntry; item: Item }>;
  getEquipmentEffects: (personaId: string) => ItemAttributeEffect[];

  // ===== Consumable Actions =====
  useConsumable: (personaId: string, itemId: string) => { effect: ActiveConsumableEffect; message: string } | null;

  // ===== Active Effects =====
  tickEffects: (personaId: string) => string[];  // Returns list of expired effect messages
  removeExpiredEffects: (personaId: string) => string[];  // Returns list of expired effect messages
  getAllActiveEffects: (personaId: string) => ItemAttributeEffect[]; // consumable + equipment combined
  removeEffect: (effectId: string) => void;
  clearAllEffects: (personaId: string) => void;

  // ===== Currency Actions (delegates to persona) =====
  adjustCurrency: (personaId: string, amount: number) => void;
  canAfford: (personaId: string, price: number) => boolean;
  purchaseItem: (personaId: string, itemId: string) => boolean; // Returns true if purchase succeeded

  // ===== Shop =====
  getShopItems: () => Item[]; // Items with price > 0

  // ===== Settings Actions =====
  setInventorySettings: (settings: Partial<InventoryV2Settings>) => void;

  // ===== Notification Actions =====
  addInventoryNotification: (notification: Omit<InventoryNotification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  clearInventoryNotifications: () => void;
  getUnreadNotifications: () => InventoryNotification[];

  // ===== Pending Item Message =====
  clearPendingItemMessage: () => void;

  // ===== Target Selection Actions =====
  requestEquipItem: (personaId: string, itemId: string) => void;
  requestUseItem: (personaId: string, itemId: string) => void;
  clearPendingEquipAction: () => void;
  executeEquipWithTarget: (personaId: string, itemId: string, targetOverrideId: string) => void;
  executeUseWithTarget: (personaId: string, itemId: string, targetOverrideId: string) => void;

  // ===== Pending Fallbacks =====
  pendingFallbacks: Array<{ targetId: string; attributeKey: string; fallbackValue: string | number }>;

  // ===== Utility =====
  exportInventory: () => { items: Item[]; activeEffects: ActiveConsumableEffect[]; settings: InventoryV2Settings };
  importInventory: (data: { items?: Item[]; activeEffects?: ActiveConsumableEffect[]; settings?: InventoryV2Settings }) => void;
}

// ============================================
// Slice Creator
// ============================================

export const createInventorySlice: StateCreator<InventorySlice, [], [], InventorySlice> = (set, get) => ({
  // Initial State
  items: [],
  activeConsumableEffects: [],
  inventorySettings: DEFAULT_INVENTORY_V2_SETTINGS,
  inventoryNotifications: [],
  pendingItemMessage: null,
  pendingEquipAction: null,
  pendingFallbacks: [],

  // ===== Item Registry Actions =====
  addItem: (item) => set((state) => ({
    items: [...state.items, item]
  })),

  updateItem: (id, updates) => set((state) => ({
    items: state.items.map(item =>
      item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item
    )
  })),

  deleteItem: (id) => set((state) => {
    // Also remove from all personas' inventories and active effects
    const stateAny = state as any;
    const personas = stateAny.personas as Array<{ id: string; inventoryItems: PersonaInventoryEntry[] }> | undefined;

    // We need to update personas to remove this item from their inventories
    // This is handled by calling updatePersona for each affected persona
    // For simplicity, we just remove from items and active effects
    return {
      items: state.items.filter(item => item.id !== id),
      activeConsumableEffects: state.activeConsumableEffects.filter(e => e.itemId !== id),
    };
  }),

  getItemById: (id) => {
    return get().items.find(item => item.id === id);
  },

  searchItems: (query) => {
    const lowerQuery = query.toLowerCase();
    return get().items.filter(item =>
      item.name.toLowerCase().includes(lowerQuery) ||
      item.description.toLowerCase().includes(lowerQuery) ||
      item.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  },

  getItemsByType: (type) => {
    return get().items.filter(item => item.type === type);
  },

  // ===== Persona Inventory Actions =====
  addToPersona: (personaId, itemId, quantity = 1) => {
    const stateAny = get() as any;
    const personas = stateAny.personas as Array<{ id: string; inventoryItems?: PersonaInventoryEntry[] }>;
    const persona = personas.find(p => p.id === personaId);
    if (!persona) return;

    const currentItems = persona.inventoryItems || [];
    const existing = currentItems.find(e => e.itemId === itemId);
    const item = get().getItemById(itemId);
    if (!item) return;

    let updatedItems: PersonaInventoryEntry[];
    if (existing) {
      // Update quantity (respect maxStack)
      const maxStack = item.maxStack ?? (item.type === 'consumable' ? 99 : 1);
      updatedItems = currentItems.map(e =>
        e.itemId === itemId
          ? { ...e, quantity: Math.min(e.quantity + quantity, maxStack) }
          : e
      );
    } else {
      // Add new entry
      updatedItems = [...currentItems, { itemId, quantity, equipped: false }];
    }

    stateAny.updatePersona(personaId, { inventoryItems: updatedItems });

    get().addInventoryNotification({
      type: 'item_added',
      itemId,
      itemName: item.name,
      quantity,
      message: `Obtuviste ${quantity > 1 ? `${quantity}x ` : ''}${item.name}`,
    });
  },

  removeFromPersona: (personaId, itemId, quantity) => {
    const stateAny = get() as any;
    const personas = stateAny.personas as Array<{ id: string; inventoryItems?: PersonaInventoryEntry[] }>;
    const persona = personas.find(p => p.id === personaId);
    if (!persona?.inventoryItems) return;

    const existing = persona.inventoryItems.find(e => e.itemId === itemId);
    if (!existing) return;

    const item = get().getItemById(itemId);
    const removeQty = quantity ?? existing.quantity;

    let updatedItems: PersonaInventoryEntry[];
    if (quantity && existing.quantity > quantity) {
      // Reduce quantity
      updatedItems = persona.inventoryItems.map(e =>
        e.itemId === itemId
          ? { ...e, quantity: e.quantity - quantity }
          : e
      );
    } else {
      // Remove entirely (also unequip if equipped)
      if (existing.equipped && item?.type === 'equipment') {
        // Reverse equipment effects when removing equipped item
        if (item.attributeEffects) {
          for (const ae of item.attributeEffects) {
            const effectTargetId = existing.targetOverrideId || ae.targetId;
            applyFallbackToSessionStats(stateAny, effectTargetId, ae.attributeKey, ae.fallbackValue, ae);
          }
        }
      }
      updatedItems = persona.inventoryItems.filter(e => e.itemId !== itemId);
    }

    stateAny.updatePersona(personaId, { inventoryItems: updatedItems });

    if (item) {
      get().addInventoryNotification({
        type: 'item_removed',
        itemId: item.id,
        itemName: item.name,
        quantity: removeQty,
        message: `Perdiste ${removeQty > 1 ? `${removeQty}x ` : ''}${item.name}`,
      });
    }
  },

  getPersonaItems: (personaId) => {
    const stateAny = get() as any;
    const personas = stateAny.personas as Array<{ id: string; inventoryItems?: PersonaInventoryEntry[] }>;
    const persona = personas.find(p => p.id === personaId);
    if (!persona?.inventoryItems) return [];

    return persona.inventoryItems
      .map(entry => {
        const item = get().getItemById(entry.itemId);
        return item ? { entry, item } : null;
      })
      .filter((r): r is { entry: PersonaInventoryEntry; item: Item } => r !== null);
  },

  getPersonaItemCount: (personaId, itemId) => {
    const stateAny = get() as any;
    const personas = stateAny.personas as Array<{ id: string; inventoryItems?: PersonaInventoryEntry[] }>;
    const persona = personas.find(p => p.id === personaId);
    if (!persona?.inventoryItems) return 0;

    const entry = persona.inventoryItems.find(e => e.itemId === itemId);
    return entry?.quantity ?? 0;
  },

  // ===== Equipment Actions =====
  equipItem: (personaId, itemId) => {
    const stateAny = get() as any;
    const personas = stateAny.personas as Array<{ id: string; inventoryItems?: PersonaInventoryEntry[] }>;
    const persona = personas.find(p => p.id === personaId);
    if (!persona?.inventoryItems) return;

    const item = get().getItemById(itemId);
    if (!item || item.type !== 'equipment') return;

    const entry = persona.inventoryItems.find(e => e.itemId === itemId);
    if (!entry) return;

    // If this item uses a slot, unequip any existing item in that slot first
    let updatedItems = [...persona.inventoryItems];
    if (item.slot) {
      updatedItems = updatedItems.map(e => {
        const eItem = get().getItemById(e.itemId);
        if (e.equipped && eItem?.slot === item.slot && e.itemId !== itemId) {
          // Unequip the old item in this slot - reverse its effects
          if (eItem.attributeEffects) {
            for (const ae of eItem.attributeEffects) {
              const oldTargetId = e.targetOverrideId || ae.targetId;
              applyFallbackToSessionStats(stateAny, oldTargetId, ae.attributeKey, ae.fallbackValue, ae);
            }
          }
          return { ...e, equipped: false };
        }
        return e;
      });
    }

    // Equip the item
    updatedItems = updatedItems.map(e =>
      e.itemId === itemId ? { ...e, equipped: true } : e
    );

    stateAny.updatePersona(personaId, { inventoryItems: updatedItems });

    // Apply equipment effects directly to SessionStats so UI reflects changes
    if (item.attributeEffects && item.attributeEffects.length > 0) {
      applyEffectsToSessionStats(stateAny, item.attributeEffects);

      // Verify effects were applied
      const verifyState = get() as any;
      for (const ae of item.attributeEffects) {
        const targetId = ae.targetId || '__user__';
        const actualValue = verifyState.getAttributeValue?.(verifyState.activeSessionId, targetId, ae.attributeKey);
        console.log('[Inventory] equipItem: verification after apply', {
          attributeKey: ae.attributeKey,
          targetId,
          expectedOperator: ae.operator,
          expectedDelta: ae.value,
          actualValue,
        });
      }
    }

    const message = item.useMessage || `Equipaste ${item.name}`;
    get().addInventoryNotification({
      type: 'item_equipped',
      itemId: item.id,
      itemName: item.name,
      quantity: 1,
      message,
    });

    // Queue message for chat injection
    if (item.useMessage) {
      set({ pendingItemMessage: item.useMessage });
    }
  },

  unequipItem: (personaId, itemId) => {
    const stateAny = get() as any;
    const personas = stateAny.personas as Array<{ id: string; inventoryItems?: PersonaInventoryEntry[] }>;
    const persona = personas.find(p => p.id === personaId);
    if (!persona?.inventoryItems) return;

    const item = get().getItemById(itemId);
    if (!item) return;

    const entry = persona.inventoryItems.find(e => e.itemId === itemId);
    const targetOverrideId = entry?.targetOverrideId;

    const updatedItems = persona.inventoryItems.map(e =>
      e.itemId === itemId ? { ...e, equipped: false } : e
    );

    stateAny.updatePersona(personaId, { inventoryItems: updatedItems });

    const message = item.unequipMessage || `Desequipaste ${item.name}`;
    get().addInventoryNotification({
      type: 'item_equipped',
      itemId: item.id,
      itemName: item.name,
      quantity: 1,
      message,
    });

    // Queue message for chat injection
    if (item.unequipMessage) {
      set({ pendingItemMessage: item.unequipMessage });
    }

    // Apply fallback values directly to SessionStats when unequipping
    if (item.attributeEffects) {
      for (const ae of item.attributeEffects) {
        const effectTargetId = targetOverrideId || ae.targetId;
        applyFallbackToSessionStats(stateAny, effectTargetId, ae.attributeKey, ae.fallbackValue, ae);
      }
    }
  },

  getEquippedItems: (personaId) => {
    return get().getPersonaItems(personaId).filter(({ entry }) => entry.equipped);
  },

  getEquipmentEffects: (personaId) => {
    const equipped = get().getEquippedItems(personaId);
    const effects: ItemAttributeEffect[] = [];

    for (const { item } of equipped) {
      if (item.attributeEffects) {
        effects.push(...item.attributeEffects);
      }
    }

    return effects;
  },

  // ===== Consumable Actions =====
  useConsumable: (personaId, itemId) => {
    const stateAny = get() as any;
    const personas = stateAny.personas as Array<{ id: string; inventoryItems?: PersonaInventoryEntry[] }>;
    const persona = personas.find(p => p.id === personaId);
    if (!persona?.inventoryItems) {
      console.warn('[Inventory] useConsumable: persona not found or no inventory', { personaId });
      return null;
    }

    const item = get().getItemById(itemId);
    if (!item || item.type !== 'consumable') {
      console.warn('[Inventory] useConsumable: item not found or not consumable', { itemId, itemFound: !!item, itemType: item?.type });
      return null;
    }

    const entry = persona.inventoryItems.find(e => e.itemId === itemId);
    if (!entry || entry.quantity <= 0) {
      console.warn('[Inventory] useConsumable: no inventory entry or zero quantity', { itemId, hasEntry: !!entry, quantity: entry?.quantity });
      return null;
    }

    console.log('[Inventory] useConsumable: using item', {
      itemName: item.name,
      attributeEffects: item.attributeEffects,
      useMessage: item.useMessage,
      duration: item.duration,
    });

    // Reduce quantity (consumable is consumed on use)
    const updatedItems = persona.inventoryItems.map(e =>
      e.itemId === itemId
        ? { ...e, quantity: e.quantity - 1 }
        : e
    ).filter(e => e.quantity > 0); // Remove entries with 0 quantity

    stateAny.updatePersona(personaId, { inventoryItems: updatedItems });

    // Create active effect
    const duration = item.duration ?? 1;

    // Collect fallback values from item's attributeEffects
    const effectFallbacks: Record<string, string | number> = {};
    for (const ae of (item.attributeEffects || [])) {
      if (ae.fallbackValue !== undefined) {
        effectFallbacks[ae.attributeKey] = ae.fallbackValue;
      }
    }

    const effect: ActiveConsumableEffect = {
      id: generateId('effect'),
      itemId: item.id,
      itemName: item.name,
      personaId,
      effects: item.attributeEffects || [],
      effectFallbacks,
      remainingTurns: duration,
      totalTurns: duration,
      useMessage: item.useMessage,
      expireMessage: item.expireMessage,
      appliedAt: new Date().toISOString(),
    };

    set((state) => ({
      activeConsumableEffects: [...state.activeConsumableEffects, effect]
    }));

    // Apply consumable effects directly to SessionStats so UI reflects changes
    if (item.attributeEffects && item.attributeEffects.length > 0) {
      console.log('[Inventory] useConsumable: applying effects to session stats', {
        effectsCount: item.attributeEffects.length,
        effects: item.attributeEffects.map(e => `${e.targetId}.${e.attributeKey} ${e.operator}${e.value}`),
      });
      applyEffectsToSessionStats(stateAny, item.attributeEffects);

      // Verify effects were applied by reading back the values
      const verifyState = get() as any;
      for (const ae of item.attributeEffects) {
        const targetId = ae.targetId || '__user__';
        const actualValue = verifyState.getAttributeValue?.(verifyState.activeSessionId, targetId, ae.attributeKey);
        console.log('[Inventory] useConsumable: verification after apply', {
          attributeKey: ae.attributeKey,
          targetId,
          expectedOperator: ae.operator,
          expectedDelta: ae.value,
          actualValue,
        });
      }
    }

    const message = item.useMessage || `Usaste ${item.name} (${duration} turnos)`;

    get().addInventoryNotification({
      type: 'item_used',
      itemId: item.id,
      itemName: item.name,
      quantity: 1,
      message,
    });

    // Queue message for chat injection
    if (item.useMessage) {
      console.log('[Inventory] useConsumable: queueing pending item message', { useMessage: item.useMessage });
      set({ pendingItemMessage: item.useMessage });
    } else {
      console.log('[Inventory] useConsumable: no useMessage configured, skipping chat injection');
    }

    return { effect, message };
  },

  // ===== Active Effects =====
  tickEffects: (personaId) => {
    const expiredMessages: string[] = [];

    set((state) => ({
      activeConsumableEffects: state.activeConsumableEffects.map(effect => {
        if (effect.personaId !== personaId) return effect;
        const newRemaining = effect.remainingTurns - 1;
        if (newRemaining <= 0) {
          const msg = effect.expireMessage || `El efecto de ${effect.itemName} ha expirado`;
          expiredMessages.push(msg);
        }
        return { ...effect, remainingTurns: Math.max(0, newRemaining) };
      })
    }));

    return expiredMessages;
  },

  removeExpiredEffects: (personaId) => {
    const expiredMessages: string[] = [];
    const stateAny = get() as any;

    set((state) => {
      const expired = state.activeConsumableEffects.filter(
        e => e.personaId === personaId && e.remainingTurns <= 0
      );
      for (const e of expired) {
        const msg = e.expireMessage || `El efecto de ${e.itemName} ha expirado`;
        expiredMessages.push(msg);

        get().addInventoryNotification({
          type: 'item_removed',
          itemId: e.itemId,
          itemName: e.itemName,
          quantity: 1,
          message: msg,
        });
      }

      // Apply fallback values directly to SessionStats for expired effects
      for (const effect of expired) {
        const item = get().getItemById(effect.itemId);
        if (!item?.attributeEffects) continue;
        for (const ae of item.attributeEffects) {
          // Use the effect's overridden targetId if it was set (from executeUseWithTarget)
          const activeEffect = effect.effects.find(e => e.attributeKey === ae.attributeKey);
          const effectTargetId = activeEffect?.targetId || ae.targetId;
          applyFallbackToSessionStats(stateAny, effectTargetId, ae.attributeKey, ae.fallbackValue, ae);
        }
      }

      return {
        activeConsumableEffects: state.activeConsumableEffects.filter(
          e => !(e.personaId === personaId && e.remainingTurns <= 0)
        ),
        pendingFallbacks: state.pendingFallbacks || [], // Keep for backward compat but no new additions
      };
    });

    return expiredMessages;
  },

  getAllActiveEffects: (personaId) => {
    // Combine equipment effects + active consumable effects
    const equipmentEffects = get().getEquipmentEffects(personaId);
    const consumableEffects = get().activeConsumableEffects
      .filter(e => e.personaId === personaId)
      .flatMap(e => e.effects);

    return [...equipmentEffects, ...consumableEffects];
  },

  removeEffect: (effectId) => {
    const stateAny = get() as any;
    // Find the effect before removing so we can reverse its attribute changes
    const effectToRemove = get().activeConsumableEffects.find(e => e.id === effectId);
    if (effectToRemove) {
      const item = get().getItemById(effectToRemove.itemId);
      if (item?.attributeEffects) {
        for (const ae of item.attributeEffects) {
          const activeEffect = effectToRemove.effects.find(e => e.attributeKey === ae.attributeKey);
          const effectTargetId = activeEffect?.targetId || ae.targetId;
          applyFallbackToSessionStats(stateAny, effectTargetId, ae.attributeKey, ae.fallbackValue, ae);
        }
      }
    }
    set((state) => ({
      activeConsumableEffects: state.activeConsumableEffects.filter(e => e.id !== effectId)
    }));
  },

  clearAllEffects: (personaId) => {
    const stateAny = get() as any;
    // Reverse all active consumable effects for this persona before clearing
    const effectsToClear = get().activeConsumableEffects.filter(e => e.personaId === personaId);
    for (const effect of effectsToClear) {
      const item = get().getItemById(effect.itemId);
      if (item?.attributeEffects) {
        for (const ae of item.attributeEffects) {
          const activeEffect = effect.effects.find(e => e.attributeKey === ae.attributeKey);
          const effectTargetId = activeEffect?.targetId || ae.targetId;
          applyFallbackToSessionStats(stateAny, effectTargetId, ae.attributeKey, ae.fallbackValue, ae);
        }
      }
    }
    set((state) => ({
      activeConsumableEffects: state.activeConsumableEffects.filter(e => e.personaId !== personaId)
    }));
  },

  // ===== Currency Actions =====
  adjustCurrency: (personaId, amount) => {
    const stateAny = get() as any;
    const personas = stateAny.personas as Array<{ id: string; currency?: number; currencyName?: string }>;
    const persona = personas.find(p => p.id === personaId);
    if (!persona) return;

    const currentAmount = persona.currency ?? 0;
    const newAmount = Math.max(0, currentAmount + amount);
    stateAny.updatePersona(personaId, { currency: newAmount });

    const change = amount >= 0 ? `+${amount}` : `${amount}`;
    const currencyName = persona.currencyName || 'Divisa';
    get().addInventoryNotification({
      type: 'currency_changed',
      itemName: currencyName,
      quantity: amount,
      message: `${currencyName}: ${change} (Total: ${newAmount})`,
    });
  },

  canAfford: (personaId, price) => {
    const stateAny = get() as any;
    const personas = stateAny.personas as Array<{ id: string; currency?: number }>;
    const persona = personas.find(p => p.id === personaId);
    if (!persona) return false;
    return (persona.currency ?? 0) >= price;
  },

  purchaseItem: (personaId, itemId) => {
    const item = get().getItemById(itemId);
    if (!item || !item.price || item.price <= 0) return false;

    if (!get().canAfford(personaId, item.price)) return false;

    // Deduct currency and add item
    get().adjustCurrency(personaId, -item.price);
    get().addToPersona(personaId, itemId, 1);

    get().addInventoryNotification({
      type: 'item_added',
      itemId: item.id,
      itemName: item.name,
      quantity: 1,
      message: `Compraste ${item.name} por ${item.price} divisa${item.price !== 1 ? 's' : ''}`,
    });

    return true;
  },

  // ===== Shop =====
  getShopItems: () => {
    return get().items.filter(item => item.price && item.price > 0);
  },

  // ===== Settings Actions =====
  setInventorySettings: (settings) => set((state) => ({
    inventorySettings: { ...state.inventorySettings, ...settings }
  })),

  // ===== Notification Actions =====
  addInventoryNotification: (notification) => set((state) => ({
    inventoryNotifications: [
      {
        ...notification,
        id: generateId('notif'),
        timestamp: new Date().toISOString(),
        read: false,
      },
      ...state.inventoryNotifications
    ].slice(0, 50) // Keep last 50 notifications
  })),

  markNotificationRead: (id) => set((state) => ({
    inventoryNotifications: state.inventoryNotifications.map(n =>
      n.id === id ? { ...n, read: true } : n
    )
  })),

  clearInventoryNotifications: () => set({ inventoryNotifications: [] }),

  getUnreadNotifications: () => {
    return get().inventoryNotifications.filter(n => !n.read);
  },

  // ===== Pending Item Message =====
  clearPendingItemMessage: () => set({ pendingItemMessage: null }),

  // ===== Target Selection Actions =====
  requestEquipItem: (personaId, itemId) => set({
    pendingEquipAction: { type: 'equip', personaId, itemId }
  }),

  requestUseItem: (personaId, itemId) => set({
    pendingEquipAction: { type: 'use', personaId, itemId }
  }),

  clearPendingEquipAction: () => set({ pendingEquipAction: null }),

  executeEquipWithTarget: (personaId, itemId, targetOverrideId) => {
    const stateAny = get() as any;
    const personas = stateAny.personas as Array<{ id: string; inventoryItems?: PersonaInventoryEntry[] }>;
    const persona = personas.find(p => p.id === personaId);
    if (!persona?.inventoryItems) return;

    const item = get().getItemById(itemId);
    if (!item || item.type !== 'equipment') return;

    const entry = persona.inventoryItems.find(e => e.itemId === itemId);
    if (!entry) return;

    // If this item uses a slot, unequip any existing item in that slot first
    let updatedItems = [...persona.inventoryItems];
    if (item.slot) {
      updatedItems = updatedItems.map(e => {
        const eItem = get().getItemById(e.itemId);
        if (e.equipped && eItem?.slot === item.slot && e.itemId !== itemId) {
          // Unequip the old item in this slot - reverse its effects
          if (eItem.attributeEffects) {
            for (const ae of eItem.attributeEffects) {
              const oldTargetId = e.targetOverrideId || ae.targetId;
              applyFallbackToSessionStats(stateAny, oldTargetId, ae.attributeKey, ae.fallbackValue, ae);
            }
          }
          return { ...e, equipped: false };
        }
        return e;
      });
    }

    // Equip the item with target override
    updatedItems = updatedItems.map(e =>
      e.itemId === itemId ? { ...e, equipped: true, targetOverrideId } : e
    );

    stateAny.updatePersona(personaId, { inventoryItems: updatedItems });

    // Clear pending action
    set({ pendingEquipAction: null });

    // Apply equipment effects directly to SessionStats (with targetOverrideId)
    if (item.attributeEffects && item.attributeEffects.length > 0) {
      const effectsWithTarget = item.attributeEffects.map(ae => ({
        ...ae,
        targetId: targetOverrideId || ae.targetId,
        targetName: targetOverrideId === '__user__' ? 'Persona'
          : (targetOverrideId ? (stateAny.getCharacterById?.(targetOverrideId)?.name || targetOverrideId) : ae.targetName),
      }));
      applyEffectsToSessionStats(stateAny, effectsWithTarget);

      // Verify effects were applied
      const verifyState = get() as any;
      for (const ae of effectsWithTarget) {
        const tid = ae.targetId || '__user__';
        const actualValue = verifyState.getAttributeValue?.(verifyState.activeSessionId, tid, ae.attributeKey);
        console.log('[Inventory] executeEquipWithTarget: verification after apply', {
          attributeKey: ae.attributeKey,
          targetId: tid,
          actualValue,
        });
      }
    }

    const message = item.useMessage || `Equipaste ${item.name}`;
    get().addInventoryNotification({
      type: 'item_equipped',
      itemId: item.id,
      itemName: item.name,
      quantity: 1,
      message,
    });

    // Queue message for chat injection
    if (item.useMessage) {
      set({ pendingItemMessage: item.useMessage });
    }
  },

  executeUseWithTarget: (personaId, itemId, targetOverrideId) => {
    const stateAny = get() as any;
    const personas = stateAny.personas as Array<{ id: string; inventoryItems?: PersonaInventoryEntry[] }>;
    const persona = personas.find(p => p.id === personaId);
    if (!persona?.inventoryItems) return;

    const item = get().getItemById(itemId);
    if (!item || item.type !== 'consumable') return;

    const entry = persona.inventoryItems.find(e => e.itemId === itemId);
    if (!entry || entry.quantity <= 0) return;

    // Reduce quantity (consumable is consumed on use)
    const updatedItems = persona.inventoryItems.map(e =>
      e.itemId === itemId
        ? { ...e, quantity: e.quantity - 1 }
        : e
    ).filter(e => e.quantity > 0); // Remove entries with 0 quantity

    stateAny.updatePersona(personaId, { inventoryItems: updatedItems });

    // Create active effect - override targetId in effects with the selected target
    const duration = item.duration ?? 1;
    const overriddenEffects = (item.attributeEffects || []).map(ef => ({
      ...ef,
      targetId: targetOverrideId || ef.targetId,
      targetName: targetOverrideId === '__user__' ? 'Persona'
        : (targetOverrideId ? (stateAny.getCharacterById?.(targetOverrideId)?.name || targetOverrideId) : ef.targetName),
    }));

    const effect: ActiveConsumableEffect = {
      id: generateId('effect'),
      itemId: item.id,
      itemName: item.name,
      personaId,
      effects: overriddenEffects,
      remainingTurns: duration,
      totalTurns: duration,
      useMessage: item.useMessage,
      expireMessage: item.expireMessage,
      appliedAt: new Date().toISOString(),
    };

    set((state) => ({
      activeConsumableEffects: [...state.activeConsumableEffects, effect],
      pendingEquipAction: null,
    }));

    // Apply consumable effects directly to SessionStats (with overridden target)
    if (overriddenEffects.length > 0) {
      applyEffectsToSessionStats(stateAny, overriddenEffects);

      // Verify effects were applied
      const verifyState = get() as any;
      for (const ae of overriddenEffects) {
        const tid = ae.targetId || '__user__';
        const actualValue = verifyState.getAttributeValue?.(verifyState.activeSessionId, tid, ae.attributeKey);
        console.log('[Inventory] executeUseWithTarget: verification after apply', {
          attributeKey: ae.attributeKey,
          targetId: tid,
          actualValue,
        });
      }
    }

    const message = item.useMessage || `Usaste ${item.name} (${duration} turnos)`;

    get().addInventoryNotification({
      type: 'item_used',
      itemId: item.id,
      itemName: item.name,
      quantity: 1,
      message,
    });

    // Queue message for chat injection
    if (item.useMessage) {
      set({ pendingItemMessage: item.useMessage });
    }
  },

  // ===== Utility =====
  exportInventory: () => {
    return {
      items: get().items,
      activeEffects: get().activeConsumableEffects,
      settings: get().inventorySettings,
    };
  },

  importInventory: (data) => set((state) => ({
    items: data.items ?? state.items,
    activeConsumableEffects: data.activeEffects ?? state.activeConsumableEffects,
    inventorySettings: data.settings ?? state.inventorySettings,
  })),
});

// ============================================
// Item Factory Functions
// ============================================

/**
 * Create a new consumable item
 */
export function createConsumableItem(
  name: string,
  options: {
    description?: string;
    rarity?: ItemRarity;
    icon?: string;
    duration?: number;
    attributeEffects?: ItemAttributeEffect[];
    useMessage?: string;
    expireMessage?: string;
    price?: number;
    triggerKeywords?: string[];
    contextKeys?: string[];
    tags?: string[];
    stackable?: boolean;
    maxStack?: number;
  } = {}
): Item {
  return {
    id: generateId('item'),
    name,
    description: options.description || '',
    category: 'consumable' as const,
    type: 'consumable',
    rarity: options.rarity || 'common',
    icon: options.icon || '🧪',
    attributeEffects: options.attributeEffects || [],
    duration: options.duration ?? 1,
    stackable: options.stackable ?? true,
    maxStack: options.maxStack ?? 99,
    useMessage: options.useMessage,
    expireMessage: options.expireMessage,
    price: options.price,
    triggerKeywords: options.triggerKeywords,
    contextKeys: options.contextKeys,
    tags: options.tags,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Create a new equipment item
 */
export function createEquipmentItem(
  name: string,
  options: {
    description?: string;
    rarity?: ItemRarity;
    icon?: string;
    slot?: ItemSlot;
    attributeEffects?: ItemAttributeEffect[];
    useMessage?: string;
    unequipMessage?: string;
    price?: number;
    triggerKeywords?: string[];
    contextKeys?: string[];
    tags?: string[];
  } = {}
): Item {
  return {
    id: generateId('item'),
    name,
    description: options.description || '',
    category: 'weapon' as const,
    type: 'equipment',
    rarity: options.rarity || 'common',
    icon: options.icon || '⚔️',
    attributeEffects: options.attributeEffects || [],
    slot: options.slot,
    useMessage: options.useMessage,
    unequipMessage: options.unequipMessage,
    price: options.price,
    triggerKeywords: options.triggerKeywords,
    contextKeys: options.contextKeys,
    tags: options.tags,
    stackable: false,
    maxStack: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Apply item effects to session stats
 * This modifies session stats based on active item effects (equipment + consumables)
 * Returns the modified stats
 */
export function applyItemEffectsToStats(
  baseStats: Record<string, { value: number | string }>,
  effects: ItemAttributeEffect[],
  targetId: string
): Record<string, { value: number | string; modified: boolean; modifier?: string }> {
  const result: Record<string, { value: number | string; modified: boolean; modifier?: string }> = {};

  // Copy base stats
  for (const [key, stat] of Object.entries(baseStats)) {
    result[key] = { ...stat, modified: false };
  }

  // Apply effects
  for (const effect of effects) {
    if (effect.targetId !== targetId) continue;

    const stat = result[effect.attributeKey];
    if (!stat || typeof stat.value !== 'number') continue;

    const originalValue = stat.value;
    let newValue = originalValue;

    switch (effect.operator) {
      case '+':
        newValue = originalValue + effect.value;
        break;
      case '-':
        newValue = originalValue - effect.value;
        break;
      case '*':
        newValue = originalValue * effect.value;
        break;
      case '/':
        newValue = effect.value !== 0 ? originalValue / effect.value : originalValue;
        break;
      case '=':
        newValue = effect.value;
        break;
      case 'set_min':
        newValue = Math.min(originalValue, effect.value);
        break;
      case 'set_max':
        newValue = Math.max(originalValue, effect.value);
        break;
    }

    stat.value = newValue;
    stat.modified = true;
    stat.modifier = `${effect.operator}${effect.value}`;
  }

  return result;
}

/**
 * Build inventory prompt section
 * Creates a text block showing current inventory, active effects, and currency
 */
export function buildInventoryPromptSectionV2(
  personaId: string,
  getPersonaItems: () => Array<{ entry: PersonaInventoryEntry; item: Item }>,
  getEquippedItems: () => Array<{ entry: PersonaInventoryEntry; item: Item }>,
  activeConsumableEffects: ActiveConsumableEffect[],
  currency: number,
  currencyName: string,
  template: string
): string {
  // Build items list
  const personaItems = getPersonaItems();
  const equippedItems = getEquippedItems();
  const personaEffects = activeConsumableEffects.filter(e => e.personaId === personaId);

  const itemLines = personaItems.map(({ entry, item }) => {
    const qty = entry.quantity > 1 ? ` x${entry.quantity}` : '';
    const eq = entry.equipped ? ' [Equipado]' : '';
    const effects = (item.attributeEffects?.length ?? 0) > 0
      ? ` (${item.attributeEffects!.map(e => `${e.operator}${e.value} ${e.attributeKey}`).join(', ')})`
      : '';
    return `- ${item.icon || ''} ${item.name}${qty}${eq}${effects}`;
  }).join('\n');

  // Build active effects list
  const effectLines = personaEffects.map(e => {
    const turnsLeft = e.remainingTurns > 0 ? ` (${e.remainingTurns}/${e.totalTurns} turnos)` : '';
    const effectDesc = e.effects.map(ef =>
      `${ef.operator}${ef.value} ${ef.attributeKey}${ef.targetId !== '__user__' ? ` → ${ef.targetName || ef.targetId}` : ''}`
    ).join(', ');
    return `- ${e.itemName}: ${effectDesc}${turnsLeft}`;
  }).join('\n');

  // Build equipped items list
  const equipLines = equippedItems.map(({ item }) => {
    const effects = (item.attributeEffects ?? []).map(e => `${e.operator}${e.value} ${e.attributeKey}`).join(', ');
    return `- ${item.icon || ''} ${item.name}${item.slot ? ` [${item.slot}]` : ''}${effects ? ` → ${effects}` : ''}`;
  }).join('\n');

  // Build currency
  const currencyLine = `${currencyName}: ${currency}`;

  return template
    .replace('{{activeItems}}', itemLines || 'Vacío')
    .replace('{{activeEffects}}', effectLines || 'Ninguno')
    .replace('{{equippedItems}}', equipLines || 'Ninguno')
    .replace('{{currency}}', currencyLine);
}

// ============================================
// Session Stats Integration
// ============================================

/**
 * Apply inventory item effects (equipment + consumables) to session stats.
 * Returns a DEEP COPY of sessionStats with attribute values modified by item effects.
 * This is called BEFORE resolveStats() so that item effects are reflected in {{key}} templates.
 *
 * Item effects can target:
 * - '__user__' (persona) — applies to persona's attribute values
 * - characterId — applies to that character's attribute values
 */
export function applyInventoryEffectsToSessionStats(
  sessionStats: SessionStats | undefined,
  equippedItems: Array<{ entry: PersonaInventoryEntry; item: Item }>,
  activeEffects: ActiveConsumableEffect[],
  pendingFallbacks?: Array<{ targetId: string; attributeKey: string; fallbackValue: string | number }>,
): SessionStats | undefined {
  if (!sessionStats?.characterStats) return sessionStats;

  // Deep copy sessionStats to avoid mutation
  const modified: SessionStats = JSON.parse(JSON.stringify(sessionStats));

  // Apply pending fallbacks first (set attribute directly to fallback value)
  if (pendingFallbacks && pendingFallbacks.length > 0) {
    for (const fb of pendingFallbacks) {
      const targetId = fb.targetId || '__user__';
      const charStats = modified.characterStats[targetId];
      if (!charStats?.attributeValues) continue;

      const currentValue = charStats.attributeValues[fb.attributeKey];
      if (currentValue === undefined) continue;

      charStats.attributeValues[fb.attributeKey] = typeof fb.fallbackValue === 'number'
        ? fb.fallbackValue
        : (isNaN(Number(fb.fallbackValue)) ? fb.fallbackValue : Number(fb.fallbackValue));
    }
  }

  // Collect ALL effects: equipment (permanent while equipped) + consumable (temporary)
  const allEffects: ItemAttributeEffect[] = [];

  // Equipment effects (from equipped items) — respect targetOverrideId from entry
  for (const { entry, item } of equippedItems) {
    if (item.attributeEffects) {
      for (const effect of item.attributeEffects) {
        // If the entry has a targetOverrideId, override the effect's targetId
        const effectiveTargetId = entry.targetOverrideId || effect.targetId;
        const effectiveTargetName = entry.targetOverrideId
          ? (entry.targetOverrideId === '__user__' ? 'Persona' : effect.targetName)
          : effect.targetName;
        allEffects.push({ ...effect, targetId: effectiveTargetId, targetName: effectiveTargetName });
      }
    }
  }

  // Consumable effects (from active effects)
  for (const effect of activeEffects) {
    allEffects.push(...effect.effects);
  }

  if (allEffects.length === 0 && (!pendingFallbacks || pendingFallbacks.length === 0)) return sessionStats;

  // Group effects by targetId
  const effectsByTarget = new Map<string, ItemAttributeEffect[]>();
  for (const effect of allEffects) {
    const targetId = effect.targetId || '__user__';
    if (!effectsByTarget.has(targetId)) {
      effectsByTarget.set(targetId, []);
    }
    effectsByTarget.get(targetId)!.push(effect);
  }

  // Apply effects for each target
  for (const [targetId, targetEffects] of effectsByTarget) {
    const charStats = modified.characterStats[targetId];
    if (!charStats?.attributeValues) continue;

    for (const effect of targetEffects) {
      const currentValue = charStats.attributeValues[effect.attributeKey];
      if (currentValue === undefined) continue;

      const currentNum = typeof currentValue === 'number' ? currentValue : parseFloat(String(currentValue));
      if (isNaN(currentNum)) continue;

      let newValue = currentNum;
      switch (effect.operator) {
        case '+': newValue = currentNum + effect.value; break;
        case '-': newValue = currentNum - effect.value; break;
        case '*': newValue = currentNum * effect.value; break;
        case '/': newValue = effect.value !== 0 ? currentNum / effect.value : currentNum; break;
        case '=': newValue = effect.value; break;
        case 'set_min': newValue = Math.min(currentNum, effect.value); break;
        case 'set_max': newValue = Math.max(currentNum, effect.value); break;
      }

      charStats.attributeValues[effect.attributeKey] = Math.round(newValue * 100) / 100;
    }
  }

  return modified;
}
