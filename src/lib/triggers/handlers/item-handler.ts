// ============================================
// Item Handler - Handles Inventory Triggers
// ============================================
//
// @deprecated Use ItemKeyHandler instead. This legacy handler is kept for
// backward compatibility but will be removed in a future version.
// The new ItemKeyHandler provides:
// - Unified KeyHandler interface
// - Trigger keyword detection
// - Context key validation
// - Per-character position tracking for group chat
//
// Migration: Use createItemKeyHandler() from './item-key-handler'

import type { DetectedToken } from '../token-detector';
import type { TriggerContext } from '../trigger-bus';
import type { 
  Item, 
  InventorySettings, 
  InventoryTriggerHit,
  InventoryEntry,
  ItemRarity,
  ItemCategory,
} from '@/types';
import { getCooldownManager } from '../cooldown-manager';

// ============================================
// Item Handler State
// ============================================

export interface ItemHandlerState {
  processedItems: Map<string, Set<string>>; // messageKey -> itemIds processed
  triggeredPositions: Map<string, Set<number>>; // messageKey -> wordPositions already triggered
}

export function createItemHandlerState(): ItemHandlerState {
  return {
    processedItems: new Map(),
    triggeredPositions: new Map(),
  };
}

// ============================================
// Item Trigger Context
// ============================================

export interface ItemTriggerContext extends TriggerContext {
  items: Item[];
  inventoryEntries: InventoryEntry[];
  inventorySettings: InventorySettings;
  defaultContainerId: string;
}

export interface ItemHandlerResult {
  hits: InventoryTriggerHit[];
  itemsToAdd: Array<{ itemId: string; quantity: number }>;
  itemsToRemove: Array<{ entryId: string; quantity: number }>;
  itemsToEquip: Array<{ entryId: string; slot: string }>;
}

// ============================================
// Item Tag Parser
// ============================================

interface ParsedItemTag {
  action: 'add' | 'remove' | 'use' | 'equip' | 'unequip';
  itemId?: string;
  itemName?: string;
  quantity?: number;
  slot?: string;
  rarity?: ItemRarity;
  category?: ItemCategory;
  description?: string;
}

const ITEM_TAG_PATTERN = /<item(?::(add|remove|use|equip|unequip))?(?:\s+([^>]*))?\/?>/gi;
const ITEM_ATTR_PATTERN = /(\w+)="([^"]*)"/g;

// Action patterns for natural language detection
const ITEM_ACQUISITION_PATTERNS = [
  /(?:obtienes?|recibes?|encuentras?|consigues?|adquieres?|ganas?|logras? obtener|te dan|te entrega)\s+(?:un[ao]?\s+)?([^.!?\n]+)/gi,
  /(?:you\s+(?:get|obtain|receive|find|acquire|gain)\s+(?:a\s+)?([^.!?\n]+))/gi,
  /(?:added?\s+to\s+inventory:?\s*)([^.!?\n]+)/gi,
];

const ITEM_REMOVAL_PATTERNS = [
  /(?:pierdes?|usas?|gastas?|consumes?|tiras?|descartas?|eliminas?)\s+(?:un[ao]?\s+)?([^.!?\n]+)/gi,
  /(?:you\s+(?:lose|use|spend|consume|discard|remove)\s+(?:a\s+)?([^.!?\n]+))/gi,
  /(?:removed?\s+from\s+inventory:?\s*)([^.!?\n]+)/gi,
];

const EQUIP_PATTERNS = [
  /(?:equipas?|te\s+pones?|vistes?|empuñas?|usas?|portas?)\s+(?:un[ao]?\s+)?([^.!?\n]+)/gi,
  /(?:you\s+equip|you\s+put\s+on|you\s+wield)\s+(?:a\s+)?([^.!?\n]+)/gi,
];

/**
 * Parse item tags from message content
 * Format: <item:add name="Sword" rarity="rare"/>
 *         <item:remove id="item-123" quantity="1"/>
 *         <item:equip id="item-123" slot="main_hand"/>
 */
export function parseItemTags(content: string): ParsedItemTag[] {
  const tags: ParsedItemTag[] = [];
  
  let match;
  while ((match = ITEM_TAG_PATTERN.exec(content)) !== null) {
    const action = (match[1] as ParsedItemTag['action']) || 'add';
    const attrs = match[2] || '';
    
    const tag: ParsedItemTag = { action };
    
    // Parse attributes
    let attrMatch;
    while ((attrMatch = ITEM_ATTR_PATTERN.exec(attrs)) !== null) {
      const [, key, value] = attrMatch;
      
      switch (key) {
        case 'id':
          tag.itemId = value;
          break;
        case 'name':
          tag.itemName = value;
          break;
        case 'quantity':
        case 'qty':
          tag.quantity = parseInt(value) || 1;
          break;
        case 'slot':
          tag.slot = value;
          break;
        case 'rarity':
          tag.rarity = value as ItemRarity;
          break;
        case 'category':
          tag.category = value as ItemCategory;
          break;
        case 'description':
          tag.description = value;
          break;
      }
    }
    
    tags.push(tag);
  }
  
  return tags;
}

// ============================================
// Item Handler Functions
// ============================================

/**
 * Check item triggers - Detects item additions, removals, and equipment
 * Uses wordPosition for token validation to prevent duplicate triggers
 */
export function checkItemTriggers(
  tokens: DetectedToken[],
  content: string,
  context: ItemTriggerContext,
  state: ItemHandlerState
): ItemHandlerResult {
  const { items, inventoryEntries, inventorySettings } = context;
  
  const result: ItemHandlerResult = {
    hits: [],
    itemsToAdd: [],
    itemsToRemove: [],
    itemsToEquip: [],
  };
  
  if (!inventorySettings.enabled) {
    return result;
  }
  
  const processedForMessage = state.processedItems.get(context.messageKey) ?? new Set<string>();
  const triggeredPositions = state.triggeredPositions.get(context.messageKey) ?? new Set<number>();
  
  // 1. Parse explicit item tags from content (these don't need wordPosition validation)
  const parsedTags = parseItemTags(content);
  
  for (const tag of parsedTags) {
    const hit = processParsedItemTag(tag, items, inventoryEntries);
    if (hit) {
      result.hits.push(hit);
      
      // Add to appropriate action list
      switch (hit.type) {
        case 'add':
          result.itemsToAdd.push({ itemId: hit.itemId, quantity: hit.quantity });
          break;
        case 'remove':
          const entry = inventoryEntries.find(e => e.itemId === hit.itemId);
          if (entry) {
            result.itemsToRemove.push({ entryId: entry.id, quantity: hit.quantity });
          }
          break;
        case 'equip':
          const equipEntry = inventoryEntries.find(e => e.itemId === hit.itemId);
          if (equipEntry && hit.slot) {
            result.itemsToEquip.push({ entryId: equipEntry.id, slot: hit.slot });
          }
          break;
      }
    }
  }
  
  // 2. Check keyword-based triggers (auto-detection) using token validation
  if (inventorySettings.autoDetect) {
    // Process tokens for keyword-based detection
    for (const token of tokens) {
      // Skip if this position already triggered something
      if (triggeredPositions.has(token.wordPosition)) {
        continue;
      }
      
      const normalizedToken = token.token.toLowerCase();
      
      // Check items with trigger keywords
      for (const item of items) {
        if (!item.triggerKeywords || item.triggerKeywords.length === 0) continue;
        
        // Check if token matches any trigger keyword
        const hasKeyword = item.triggerKeywords.some(kw => {
          const normalizedKw = kw.toLowerCase().trim();
          return normalizedToken.includes(normalizedKw) || normalizedKw.includes(normalizedToken);
        });
        
        if (hasKeyword && !processedForMessage.has(item.id)) {
          // Check context keys if present
          if (item.contextKeys && item.contextKeys.length > 0) {
            const hasContext = item.contextKeys.some(kw =>
              content.toLowerCase().includes(kw.toLowerCase())
            );
            if (!hasContext) continue;
          }
          
          const hit: InventoryTriggerHit = {
            type: 'add',
            itemId: item.id,
            item,
            quantity: 1,
            message: `Found: ${item.name}`,
          };
          
          result.hits.push(hit);
          result.itemsToAdd.push({ itemId: item.id, quantity: 1 });
          
          // Mark this position as triggered
          triggeredPositions.add(token.wordPosition);
          processedForMessage.add(item.id);
          break; // Move to next token
        }
      }
      
      // Check natural language patterns (only if not already triggered at this position)
      if (!triggeredPositions.has(token.wordPosition)) {
        // Check for item acquisition patterns
        for (const pattern of ITEM_ACQUISITION_PATTERNS) {
          pattern.lastIndex = 0; // Reset regex state
          const matches = content.matchAll(pattern);
          for (const match of matches) {
            const matchIndex = match.index ?? 0;
            const itemName = match[1]?.trim();
            if (!itemName || processedForMessage.has(itemName)) continue;
            
            // Check if this match corresponds to current token position
            if (token.position >= matchIndex && token.position <= matchIndex + match[0].length) {
              const matchedItem = findItemByName(itemName, items);
              
              const hit: InventoryTriggerHit = {
                type: 'add',
                itemId: matchedItem?.id || `item-auto-${Date.now()}`,
                item: matchedItem,
                quantity: 1,
                message: `Obtained: ${itemName}`,
              };
              
              result.hits.push(hit);
              result.itemsToAdd.push({ itemId: hit.itemId, quantity: 1 });
              
              triggeredPositions.add(token.wordPosition);
              processedForMessage.add(itemName);
              break;
            }
          }
        }
      }
    }
  }
  
  // Update state
  state.processedItems.set(context.messageKey, processedForMessage);
  state.triggeredPositions.set(context.messageKey, triggeredPositions);
  
  return result;
}

/**
 * Process a parsed item tag
 */
function processParsedItemTag(
  tag: ParsedItemTag,
  items: Item[],
  entries: InventoryEntry[]
): InventoryTriggerHit | null {
  // Resolve item by ID or name
  let item: Item | undefined;
  if (tag.itemId) {
    item = items.find(i => i.id === tag.itemId);
  } else if (tag.itemName) {
    item = findItemByName(tag.itemName, items);
  }
  
  switch (tag.action) {
    case 'add':
      return {
        type: 'add',
        itemId: item?.id || tag.itemId || `item-${Date.now()}`,
        item,
        quantity: tag.quantity || 1,
        message: `Added to inventory: ${item?.name || tag.itemName || 'Unknown Item'}`,
      };
      
    case 'remove':
      const removeEntry = item 
        ? entries.find(e => e.itemId === item!.id)
        : tag.itemId ? entries.find(e => e.itemId === tag.itemId) : null;
      
      if (!removeEntry && !tag.itemId) return null;
      
      return {
        type: 'remove',
        itemId: item?.id || tag.itemId || '',
        item,
        quantity: tag.quantity || 1,
        message: `Removed from inventory: ${item?.name || tag.itemName || 'Item'}`,
      };
      
    case 'use':
      const useEntry = item 
        ? entries.find(e => e.itemId === item!.id)
        : null;
      
      if (!useEntry && !tag.itemId) return null;
      
      return {
        type: 'remove',
        itemId: item?.id || tag.itemId || '',
        item,
        quantity: tag.quantity || 1,
        message: `Used: ${item?.name || tag.itemName || 'Item'}`,
      };
      
    case 'equip':
      const equipEntry = item 
        ? entries.find(e => e.itemId === item!.id)
        : null;
      
      if (!equipEntry && !tag.itemId) return null;
      
      return {
        type: 'equip',
        itemId: item?.id || tag.itemId || '',
        item,
        quantity: 1,
        message: `Equipped: ${item?.name || 'Item'}`,
      };
      
    case 'unequip':
      return {
        type: 'unequip',
        itemId: item?.id || tag.itemId || '',
        item,
        quantity: 1,
        message: `Unequipped: ${item?.name || 'Item'}`,
      };
      
    default:
      return null;
  }
}

/**
 * Find item by name (fuzzy matching)
 */
function findItemByName(name: string, items: Item[]): Item | undefined {
  const lowerName = name.toLowerCase().trim();
  
  // Exact match first
  const exact = items.find(i => i.name.toLowerCase() === lowerName);
  if (exact) return exact;
  
  // Partial match
  const partial = items.find(i => 
    i.name.toLowerCase().includes(lowerName) ||
    lowerName.includes(i.name.toLowerCase())
  );
  if (partial) return partial;
  
  // Match by tags
  const byTag = items.find(i =>
    i.tags?.some(tag => lowerName.includes(tag.toLowerCase()))
  );
  if (byTag) return byTag;
  
  return undefined;
}

/**
 * Find inventory entry by item name
 */
function findInventoryEntryByName(
  name: string,
  entries: InventoryEntry[],
  items: Item[]
): InventoryEntry | undefined {
  const item = findItemByName(name, items);
  if (item) {
    return entries.find(e => e.itemId === item.id);
  }
  return undefined;
}

// ============================================
// Inventory Prompt Builder
// ============================================

/**
 * Build inventory section for prompt
 */
export function buildInventoryPromptSection(
  entries: InventoryEntry[],
  items: Item[],
  currencies: Array<{ name: string; amount: number; icon?: string }>,
  template: string
): string {
  // Build item list
  const itemLines = entries.map(entry => {
    const item = items.find(i => i.id === entry.itemId);
    if (!item) return '';
    
    const quantity = entry.quantity > 1 ? ` x${entry.quantity}` : '';
    const equipped = entry.equipped ? ' [Equipped]' : '';
    return `- ${item.name}${quantity}${equipped}`;
  }).filter(Boolean).join('\n');
  
  // Build currency list
  const currencyLines = currencies.map(c => {
    const icon = c.icon ? `${c.icon} ` : '';
    return `- ${icon}${c.name}: ${c.amount}`;
  }).join('\n');
  
  return template
    .replace('{{inventory}}', itemLines || 'Empty')
    .replace('{{currency}}', currencyLines || 'None');
}

// ============================================
// Utility Functions
// ============================================

/**
 * Create a new item from detected content
 */
export function createItemFromDetection(
  name: string,
  category: ItemCategory = 'misc',
  rarity: ItemRarity = 'common',
  description: string = ''
): Item {
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    description,
    category,
    rarity,
    stackable: category === 'consumable' || category === 'material',
    maxStack: category === 'consumable' || category === 'material' ? 99 : 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Execute inventory trigger - call store actions
 */
export function executeInventoryTrigger(
  hit: InventoryTriggerHit,
  callbacks: {
    addToInventory: (itemId: string, quantity: number) => void;
    removeFromInventory: (entryId: string, quantity: number) => void;
    equipItem: (entryId: string, slot: string) => void;
    unequipItem: (entryId: string) => void;
    addNotification: (notification: { type: string; itemName: string; quantity: number; message: string }) => void;
  }
): void {
  switch (hit.type) {
    case 'add':
      callbacks.addToInventory(hit.itemId, hit.quantity);
      callbacks.addNotification({
        type: 'item_added',
        itemName: hit.item?.name || 'Item',
        quantity: hit.quantity,
        message: hit.message,
      });
      break;
      
    case 'remove':
      // This requires entryId which we don't have in the hit
      // The caller should handle this case
      break;
      
    case 'equip':
      // This requires entryId which we don't have in the hit
      // The caller should handle this case
      break;
      
    case 'unequip':
      // This requires entryId which we don't have in the hit
      // The caller should handle this case
      break;
  }
}

/**
 * Reset state for new message
 */
export function resetItemHandlerState(state: ItemHandlerState, messageKey: string): void {
  state.processedItems.delete(messageKey);
  state.triggeredPositions.delete(messageKey);
}

/**
 * Clear all item state
 */
export function clearItemHandlerState(state: ItemHandlerState): void {
  state.processedItems.clear();
  state.triggeredPositions.clear();
}

// ============================================
// Export Index
// ============================================

export type { ItemHandlerState, ItemTriggerContext, ItemHandlerResult };
