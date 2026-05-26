// ============================================
// Item Key Handler - Unified Inventory V2 Trigger System
// ============================================
//
// Handles item additions, removals, equipment, and consumable usage
// Supports keyword detection and type-indicator formats
//
// Key formats:
// - item:add <name> - Add item to persona inventory
// - item:remove <id> - Remove item from persona inventory
// - item:equip <id> - Equip an item
// - item:use <id> - Use a consumable item
// - Keyword detection via item.triggerKeywords

import type { KeyHandler, TriggerMatch, TriggerMatchResult, RegisteredKey } from '../types';
import type { DetectedKey } from '../key-detector';
import type { TriggerContext } from '../trigger-bus';
import type {
  Item,
  InventoryV2Settings,
  InventoryNotification,
} from '@/types';

// ============================================
// Item Key Handler Context (V2)
// ============================================

export interface ItemKeyHandlerContext extends TriggerContext {
  sessionId?: string;
  characterId?: string;
  personaId?: string;
  items: Item[];
  inventorySettings: InventoryV2Settings;
  
  // Store actions (V2)
  addToPersona?: (personaId: string, itemId: string, quantity?: number) => void;
  removeFromPersona?: (personaId: string, itemId: string, quantity?: number) => void;
  equipItem?: (personaId: string, itemId: string) => void;
  unequipItem?: (personaId: string, itemId: string) => void;
  consumeItem?: (personaId: string, itemId: string) => { effect: any; message: string } | null;
  addInventoryNotification?: (notification: Omit<InventoryNotification, 'id' | 'timestamp' | 'read'>) => void;
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
  private triggeredPositions: Map<string, Set<number>> = new Map();

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
    const { items, inventorySettings, messageKey } = context;
    
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
    
    switch (action) {
      case 'add': {
        return {
          matched: true,
          trigger: {
            triggerId: `item_add_${Date.now()}`,
            triggerType: 'item',
            keyword: key.original || key.key,
            data: {
              action: 'add',
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
      
      case 'remove': {
        return {
          matched: true,
          trigger: {
            triggerId: `item_remove_${Date.now()}`,
            triggerType: 'item',
            keyword: key.original || key.key,
            data: {
              action: 'remove',
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

      case 'use': {
        return {
          matched: true,
          trigger: {
            triggerId: `item_use_${Date.now()}`,
            triggerType: 'item',
            keyword: key.original || key.key,
            data: {
              action: 'use',
              itemId: null,
              item: null,
              quantity: 1,
              message: 'Item used',
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

      case 'unequip': {
        return {
          matched: true,
          trigger: {
            triggerId: `item_unequip_${Date.now()}`,
            triggerType: 'item',
            keyword: key.original || key.key,
            data: {
              action: 'unequip',
              itemId: null,
              item: null,
              quantity: 1,
              message: 'Item unequipped',
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
    const { items, inventorySettings, messageKey, fullText } = context;
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

        // Determine action based on item type
        const action = item.type === 'consumable' ? 'use' : 'add';
        
        return {
          matched: true,
          trigger: {
            triggerId: `item_${action}_${item.id}`,
            triggerType: 'item',
            keyword: key.original || key.key,
            data: {
              action,
              itemId: item.id,
              item,
              quantity: 1,
              message: action === 'use' ? `Used: ${item.name}` : `Found: ${item.name}`,
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
      personaId,
      addToPersona,
      removeFromPersona,
      equipItem,
      consumeItem,
      addInventoryNotification,
    } = context;
    
    const data = match.data as {
      action: 'add' | 'remove' | 'use' | 'equip' | 'unequip';
      itemId: string | null;
      item: Item | null;
      quantity: number;
      message: string;
    };

    if (!personaId) {
      console.warn('[ItemKeyHandler] No personaId in context, cannot execute item action');
      return;
    }
    
    console.log(`[ItemKeyHandler] Executing item action: ${data.action} for persona: ${personaId}`);
    
    const notify = (type: string, itemName: string, message: string) => {
      addInventoryNotification?.({
        type,
        itemName,
        quantity: data.quantity,
        message,
      });
    };
    
    switch (data.action) {
      case 'add':
        if (data.itemId && addToPersona) {
          addToPersona(personaId, data.itemId, data.quantity);
          notify('item_added', data.item?.name || 'Item', data.message);
        }
        break;
        
      case 'remove':
        if (data.itemId && removeFromPersona) {
          removeFromPersona(personaId, data.itemId, data.quantity);
          notify('item_removed', data.item?.name || 'Item', data.message);
        }
        break;

      case 'use':
        if (data.itemId && consumeItem) {
          const result = consumeItem(personaId, data.itemId);
          if (result) {
            notify('item_used', data.item?.name || 'Item', result.message || data.message);
          } else {
            // Consumable use failed (no quantity, etc.) — just add the item instead
            addToPersona?.(personaId, data.itemId, data.quantity);
            notify('item_added', data.item?.name || 'Item', `Obtained: ${data.item?.name || 'Item'}`);
          }
        } else if (data.itemId && addToPersona) {
          // No consumeItem available, just add
          addToPersona(personaId, data.itemId, data.quantity);
          notify('item_added', data.item?.name || 'Item', data.message);
        }
        break;
        
      case 'equip':
        if (data.itemId && equipItem) {
          equipItem(personaId, data.itemId);
          notify('item_equipped', data.item?.name || 'Item', `Equipped: ${data.item?.name || 'Item'}`);
        }
        break;

      case 'unequip':
        if (data.itemId && context.unequipItem) {
          context.unequipItem(personaId, data.itemId);
          notify('item_unequipped', data.item?.name || 'Item', `Unequipped: ${data.item?.name || 'Item'}`);
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
              action: item.type === 'consumable' ? 'use' : 'add',
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
