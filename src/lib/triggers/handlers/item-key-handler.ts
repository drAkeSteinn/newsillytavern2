// ============================================
// Item Key Handler - Unified Inventory Trigger System
// ============================================
//
// Handles item additions, removals, and equipment
// Supports XML tags and keyword detection
//
// Key formats:
// - item:add <name> - Add item to inventory
// - item:remove <id> - Remove item from inventory
// - item:equip <id> - Equip an item
// - <item:add name="Sword" rarity="rare"/>
// - <item:remove id="item-123" quantity="1"/>

import type { KeyHandler, TriggerMatch, TriggerMatchResult, RegisteredKey } from '../types';
import type { DetectedKey } from '../key-detector';
import type { TriggerContext } from '../trigger-bus';
import type {
  Item,
  InventorySettings,
  InventoryEntry,
  InventoryTriggerHit,
  ItemRarity,
  ItemCategory,
} from '@/types';

// ============================================
// Item Key Handler Context
// ============================================

export interface ItemKeyHandlerContext extends TriggerContext {
  sessionId?: string;
  characterId?: string;
  items: Item[];
  inventoryEntries: InventoryEntry[];
  inventorySettings: InventorySettings;
  defaultContainerId?: string;
  
  // Store actions
  addToInventory?: (itemId: string, quantity: number, containerId?: string) => void;
  removeFromInventory?: (entryId: string, quantity: number) => void;
  equipItem?: (entryId: string, slot: string) => void;
  unequipItem?: (entryId: string) => void;
  addNotification?: (notification: {
    type: string;
    itemName: string;
    quantity: number;
    message: string;
  }) => void;
}

// ============================================
// Item Key Handler Implementation
// ============================================

export class ItemKeyHandler implements KeyHandler {
  id = 'item-key-handler';
  type = 'item' as const;
  priority = 40; // After stats, lowest priority among main handlers
  
  // Track processed items per message
  private processedItems: Map<string, Set<string>> = new Map();
  
  // Track triggered positions
  private triggeredPositions: Map<string, Set<number>> = new Set() as any;

  canHandle(key: DetectedKey, context: ItemKeyHandlerContext): boolean {
    // Check if inventory system is enabled
    if (!context.inventorySettings?.enabled) {
      return false;
    }
    
    // Type-indicator format: item:action
    if (key.key === 'item' && key.value) {
      const action = key.value.toLowerCase();
      return ['add', 'remove', 'use', 'equip', 'unequip'].includes(action);
    }
    
    // Check if key matches any item trigger keyword
    const normalizedKey = key.key.toLowerCase();
    
    for (const item of context.items) {
      if (item.triggerKeywords?.some(kw => kw.toLowerCase() === normalizedKey)) {
        return true;
      }
    }
    
    return false;
  }

  handleKey(key: DetectedKey, context: ItemKeyHandlerContext): TriggerMatchResult | null {
    const { items, inventoryEntries, inventorySettings, messageKey } = context;
    
    // Skip if already processed this position
    const triggeredPositions = this.triggeredPositions.get(messageKey) ?? new Set();
    if (key.position !== undefined && triggeredPositions.has(key.position)) {
      return { matched: false };
    }
    
    // Handle type-indicator format: item:action
    if (key.key === 'item' && key.value) {
      return this.handleTypeIndicator(key, context);
    }
    
    // Handle keyword-based detection
    return this.handleKeywordDetection(key, context);
  }

  private handleTypeIndicator(key: DetectedKey, context: ItemKeyHandlerContext): TriggerMatchResult | null {
    const action = key.value!.toLowerCase();
    const { items, inventoryEntries } = context;
    
    // For add, we need additional info (item name or ID)
    // This is typically handled via XML tags with attributes
    // Here we provide basic support
    
    switch (action) {
      case 'add': {
        // If key has additional value, try to find item by name
        // Otherwise return a placeholder
        return {
          matched: true,
          trigger: {
            triggerId: `item_add_${Date.now()}`,
            triggerType: 'item',
            keyword: key.original || key.key,
            data: {
              action: 'add',
              type: 'add',
              itemId: null,
              item: null,
              quantity: 1,
              message: 'Item added to inventory',
              requiresResolution: true,
            },
          },
          key,
        };
      }
      
      case 'remove':
      case 'use': {
        return {
          matched: true,
          trigger: {
            triggerId: `item_remove_${Date.now()}`,
            triggerType: 'item',
            keyword: key.original || key.key,
            data: {
              action: 'remove',
              type: 'remove',
              itemId: null,
              item: null,
              quantity: 1,
              message: 'Item removed from inventory',
              requiresResolution: true,
            },
          },
          key,
        };
      }
      
      case 'equip': {
        return {
          matched: true,
          trigger: {
            triggerId: `item_equip_${Date.now()}`,
            triggerType: 'item',
            keyword: key.original || key.key,
            data: {
              action: 'equip',
              type: 'equip',
              itemId: null,
              item: null,
              quantity: 1,
              message: 'Item equipped',
              requiresResolution: true,
            },
          },
          key,
        };
      }
      
      default:
        return { matched: false };
    }
  }

  private handleKeywordDetection(key: DetectedKey, context: ItemKeyHandlerContext): TriggerMatchResult | null {
    const { items, inventoryEntries, inventorySettings, messageKey, fullText } = context;
    const normalizedKey = key.key.toLowerCase();
    
    // Check items with trigger keywords
    for (const item of items) {
      if (!item.triggerKeywords || item.triggerKeywords.length === 0) continue;
      
      const hasKeyword = item.triggerKeywords.some(kw => {
        const normalizedKw = kw.toLowerCase().trim();
        return normalizedKey === normalizedKw || normalizedKey.includes(normalizedKw);
      });
      
      if (hasKeyword) {
        // Check context keys if present
        if (item.contextKeys && item.contextKeys.length > 0 && fullText) {
          const hasContext = item.contextKeys.some(kw =>
            fullText.toLowerCase().includes(kw.toLowerCase())
          );
          if (!hasContext) continue;
        }
        
        // Mark position as triggered
        const positions = this.triggeredPositions.get(messageKey) ?? new Set();
        if (key.position !== undefined) positions.add(key.position);
        this.triggeredPositions.set(messageKey, positions);
        
        // Mark item as processed for this message
        const processed = this.processedItems.get(messageKey) ?? new Set();
        processed.add(item.id);
        this.processedItems.set(messageKey, processed);
        
        return {
          matched: true,
          trigger: {
            triggerId: `item_add_${item.id}`,
            triggerType: 'item',
            keyword: key.original || key.key,
            data: {
              action: 'add',
              type: 'add',
              itemId: item.id,
              item,
              quantity: 1,
              message: `Found: ${item.name}`,
            },
          },
          key,
        };
      }
    }
    
    return { matched: false };
  }

  execute(match: TriggerMatch, context: ItemKeyHandlerContext): void {
    const {
      addToInventory,
      removeFromInventory,
      equipItem,
      addNotification,
      defaultContainerId,
    } = context;
    
    const data = match.data as {
      action: 'add' | 'remove' | 'equip' | 'unequip';
      type: string;
      itemId: string | null;
      item: Item | null;
      quantity: number;
      message: string;
    };
    
    console.log(`[ItemKeyHandler] Executing item action: ${data.action}`);
    
    switch (data.action) {
      case 'add':
        if (data.itemId && addToInventory) {
          addToInventory(data.itemId, data.quantity, defaultContainerId);
          addNotification?.({
            type: 'item_added',
            itemName: data.item?.name || 'Item',
            quantity: data.quantity,
            message: data.message,
          });
        }
        break;
        
      case 'remove':
        if (data.itemId && removeFromInventory) {
          // Find entry by itemId
          const entry = context.inventoryEntries.find(e => e.itemId === data.itemId);
          if (entry) {
            removeFromInventory(entry.id, data.quantity);
            addNotification?.({
              type: 'item_removed',
              itemName: data.item?.name || 'Item',
              quantity: data.quantity,
              message: data.message,
            });
          }
        }
        break;
        
      case 'equip':
        if (data.itemId && equipItem) {
          const entry = context.inventoryEntries.find(e => e.itemId === data.itemId);
          if (entry && data.item?.equipSlot) {
            equipItem(entry.id, data.item.equipSlot);
            addNotification?.({
              type: 'item_equipped',
              itemName: data.item.name,
              quantity: 1,
              message: `Equipped: ${data.item.name}`,
            });
          }
        }
        break;
        
      case 'unequip':
        if (data.itemId && context.unequipItem) {
          const entry = context.inventoryEntries.find(e => e.itemId === data.itemId);
          if (entry) {
            context.unequipItem(entry.id);
            addNotification?.({
              type: 'item_unequipped',
              itemName: data.item?.name || 'Item',
              quantity: 1,
              message: `Unequipped: ${data.item?.name || 'Item'}`,
            });
          }
        }
        break;
    }
  }

  getRegisteredKeys(context: ItemKeyHandlerContext): RegisteredKey[] {
    const keys: RegisteredKey[] = [];
    
    if (!context.inventorySettings?.enabled) {
      return keys;
    }
    
    // Add trigger keywords from all items
    for (const item of context.items) {
      if (item.triggerKeywords) {
        for (const kw of item.triggerKeywords) {
          keys.push({
            key: kw,
            category: 'item',
            config: {
              action: 'add',
              itemId: item.id,
              contextKeys: item.contextKeys,
            },
          });
        }
      }
    }
    
    return keys;
  }

  reset(messageKey: string): void {
    this.processedItems.delete(messageKey);
    this.triggeredPositions.delete(messageKey);
  }

  cleanup(): void {
    this.processedItems.clear();
    this.triggeredPositions.clear();
  }
}

// ============================================
// Factory Function
// ============================================

export function createItemKeyHandler(): ItemKeyHandler {
  return new ItemKeyHandler();
}
