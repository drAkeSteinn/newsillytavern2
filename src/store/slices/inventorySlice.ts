// ============================================
// Inventory Slice - State management for inventory and items system
// ============================================

import type { StateCreator } from 'zustand';
import {
  DEFAULT_INVENTORY_SETTINGS,
  type Item,
  type InventoryEntry,
  type InventoryContainer,
  type CurrencyEntry,
  type InventorySettings,
  type InventoryNotification,
  type ItemCategory,
  type ItemRarity,
  type ItemSlot,
  type ItemStat,
} from '@/types';

// Re-export for convenience
export { DEFAULT_INVENTORY_SETTINGS };

// ============================================
// Helper Functions
// ============================================

function createDefaultItem(
  name: string,
  category: ItemCategory = 'misc',
  rarity: ItemRarity = 'common'
): Item {
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    description: '',
    category,
    rarity,
    stackable: category === 'consumable' || category === 'material',
    maxStack: category === 'consumable' || category === 'material' ? 99 : 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createDefaultInventoryEntry(itemId: string, quantity: number = 1): InventoryEntry {
  return {
    id: `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    itemId,
    quantity,
    obtainedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createDefaultContainer(name: string = 'Inventario'): InventoryContainer {
  return {
    id: `container-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    type: 'inventory',
    capacity: 0, // Unlimited
    entries: [],
    isDefault: true,
  };
}

// Get rarity color for display
function getRarityColor(rarity: ItemRarity): string {
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

// Get category icon
function getCategoryIcon(category: ItemCategory): string {
  const icons: Record<ItemCategory, string> = {
    weapon: '⚔️',
    armor: '🛡️',
    accessory: '💍',
    consumable: '🧪',
    material: '📦',
    key: '🔑',
    book: '📖',
    tool: '🔧',
    treasure: '💎',
    clothing: '👕',
    misc: '❓',
  };
  return icons[category];
}

// ============================================
// Slice Type
// ============================================

export interface InventorySlice {
  // Item Registry
  items: Item[];                     // All defined items
  
  // Inventory State
  containers: InventoryContainer[];  // Storage containers
  currencies: CurrencyEntry[];       // Currency tracking
  
  // Settings
  inventorySettings: InventorySettings;
  
  // Notifications
  inventoryNotifications: InventoryNotification[];
  
  // Item Registry Actions
  addItem: (item: Item) => void;
  updateItem: (id: string, updates: Partial<Item>) => void;
  deleteItem: (id: string) => void;
  getItemById: (id: string) => Item | undefined;
  getItemsByCategory: (category: ItemCategory) => Item[];
  getItemsByRarity: (rarity: ItemRarity) => Item[];
  searchItems: (query: string) => Item[];
  
  // Inventory Actions
  addToInventory: (itemId: string, quantity?: number, containerId?: string) => void;
  removeFromInventory: (entryId: string, quantity?: number) => void;
  transferItem: (entryId: string, fromContainerId: string, toContainerId: string, quantity?: number) => void;
  getInventoryEntries: (containerId?: string) => InventoryEntry[];
  getInventoryEntry: (entryId: string) => InventoryEntry | undefined;
  findItemInInventory: (itemId: string) => InventoryEntry | undefined;
  getItemCount: (itemId: string) => number;
  
  // Container Actions
  addContainer: (container: Omit<InventoryContainer, 'id' | 'entries'>) => void;
  updateContainer: (id: string, updates: Partial<InventoryContainer>) => void;
  deleteContainer: (id: string) => void;
  getContainerById: (id: string) => InventoryContainer | undefined;
  getDefaultContainer: () => InventoryContainer | undefined;
  
  // Currency Actions
  addCurrency: (currency: Omit<CurrencyEntry, 'id'>) => void;
  updateCurrency: (id: string, updates: Partial<CurrencyEntry>) => void;
  deleteCurrency: (id: string) => void;
  adjustCurrency: (id: string, amount: number) => void; // Positive to add, negative to subtract
  getCurrencyById: (id: string) => CurrencyEntry | undefined;
  getPrimaryCurrency: () => CurrencyEntry | undefined;
  
  // Equipment Actions
  equipItem: (entryId: string, slot: ItemSlot, characterId?: string) => void;
  unequipItem: (entryId: string) => void;
  getEquippedItems: (characterId?: string) => InventoryEntry[];
  getEquipmentStats: (characterId?: string) => ItemStat[];
  
  // Settings Actions
  setInventorySettings: (settings: Partial<InventorySettings>) => void;
  
  // Notification Actions
  addInventoryNotification: (notification: Omit<InventoryNotification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  clearInventoryNotifications: () => void;
  getUnreadNotifications: () => InventoryNotification[];
  
  // Utility
  sortInventory: (mode: 'name' | 'rarity' | 'category' | 'value' | 'recent') => void;
  clearInventory: (containerId?: string) => void;
  exportInventory: () => { items: Item[]; containers: InventoryContainer[]; currencies: CurrencyEntry[] };
  importInventory: (data: { items?: Item[]; containers?: InventoryContainer[]; currencies?: CurrencyEntry[] }) => void;
}

// ============================================
// Slice Creator
// ============================================

export const createInventorySlice: StateCreator<InventorySlice, [], [], InventorySlice> = (set, get) => ({
  // Initial State
  items: [],
  containers: [createDefaultContainer()],
  currencies: [],
  inventorySettings: DEFAULT_INVENTORY_SETTINGS,
  inventoryNotifications: [],
  
  // Item Registry Actions
  addItem: (item) => set((state) => ({
    items: [...state.items, item]
  })),
  
  updateItem: (id, updates) => set((state) => ({
    items: state.items.map(item =>
      item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item
    )
  })),
  
  deleteItem: (id) => set((state) => {
    // Also remove from all containers
    const updatedContainers = state.containers.map(container => ({
      ...container,
      entries: container.entries.filter(entry => entry.itemId !== id)
    }));
    
    return {
      items: state.items.filter(item => item.id !== id),
      containers: updatedContainers,
    };
  }),
  
  getItemById: (id) => {
    return get().items.find(item => item.id === id);
  },
  
  getItemsByCategory: (category) => {
    return get().items.filter(item => item.category === category);
  },
  
  getItemsByRarity: (rarity) => {
    return get().items.filter(item => item.rarity === rarity);
  },
  
  searchItems: (query) => {
    const lowerQuery = query.toLowerCase();
    return get().items.filter(item =>
      item.name.toLowerCase().includes(lowerQuery) ||
      item.description.toLowerCase().includes(lowerQuery) ||
      item.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  },
  
  // Inventory Actions
  addToInventory: (itemId, quantity = 1, containerId) => {
    const item = get().getItemById(itemId);
    if (!item) return;
    
    // Find target container
    const targetContainer = containerId 
      ? get().getContainerById(containerId)
      : get().getDefaultContainer();
    
    if (!targetContainer) return;
    
    // Check if item already exists in container and is stackable
    const existingEntry = targetContainer.entries.find(
      e => e.itemId === itemId && item.stackable
    );
    
    if (existingEntry && item.stackable) {
      // Update quantity
      set((state) => ({
        containers: state.containers.map(c => {
          if (c.id !== targetContainer.id) return c;
          return {
            ...c,
            entries: c.entries.map(e =>
              e.id === existingEntry.id
                ? { 
                    ...e, 
                    quantity: Math.min(e.quantity + quantity, item.maxStack),
                    updatedAt: new Date().toISOString() 
                  }
                : e
            )
          };
        })
      }));
    } else {
      // Create new entry
      const newEntry = createDefaultInventoryEntry(itemId, quantity);
      set((state) => ({
        containers: state.containers.map(c => {
          if (c.id !== targetContainer.id) return c;
          return {
            ...c,
            entries: [...c.entries, newEntry]
          };
        })
      }));
    }
    
    // Add notification
    get().addInventoryNotification({
      type: 'item_added',
      itemId,
      itemName: item.name,
      quantity,
      message: `Obtuviste ${quantity > 1 ? `${quantity}x ` : ''}${item.name}`,
    });
  },
  
  removeFromInventory: (entryId, quantity) => {
    const entry = get().getInventoryEntry(entryId);
    if (!entry) return;
    
    const item = get().getItemById(entry.itemId);
    const removeQuantity = quantity ?? entry.quantity;
    
    if (quantity && entry.quantity > quantity) {
      // Reduce quantity
      set((state) => ({
        containers: state.containers.map(c => ({
          ...c,
          entries: c.entries.map(e =>
            e.id === entryId
              ? { ...e, quantity: e.quantity - quantity, updatedAt: new Date().toISOString() }
              : e
          )
        }))
      }));
    } else {
      // Remove entirely
      set((state) => ({
        containers: state.containers.map(c => ({
          ...c,
          entries: c.entries.filter(e => e.id !== entryId)
        }))
      }));
    }
    
    // Add notification
    if (item) {
      get().addInventoryNotification({
        type: 'item_removed',
        itemId: item.id,
        itemName: item.name,
        quantity: removeQuantity,
        message: `Perdiste ${removeQuantity > 1 ? `${removeQuantity}x ` : ''}${item.name}`,
      });
    }
  },
  
  transferItem: (entryId, fromContainerId, toContainerId, quantity = 1) => {
    const fromContainer = get().getContainerById(fromContainerId);
    const toContainer = get().getContainerById(toContainerId);
    if (!fromContainer || !toContainer) return;
    
    const entry = fromContainer.entries.find(e => e.id === entryId);
    if (!entry) return;
    
    const item = get().getItemById(entry.itemId);
    if (!item) return;
    
    const transferQty = Math.min(quantity, entry.quantity);
    
    // Check if item exists in target container
    const existingInTarget = toContainer.entries.find(
      e => e.itemId === entry.itemId && item.stackable
    );
    
    set((state) => ({
      containers: state.containers.map(c => {
        if (c.id === fromContainerId) {
          // Remove or reduce from source
          const newEntries = entry.quantity <= transferQty
            ? c.entries.filter(e => e.id !== entryId)
            : c.entries.map(e =>
                e.id === entryId
                  ? { ...e, quantity: e.quantity - transferQty }
                  : e
              );
          return { ...c, entries: newEntries };
        }
        if (c.id === toContainerId) {
          // Add to target
          if (existingInTarget) {
            return {
              ...c,
              entries: c.entries.map(e =>
                e.id === existingInTarget.id
                  ? { ...e, quantity: e.quantity + transferQty }
                  : e
              )
            };
          } else {
            const newEntry = createDefaultInventoryEntry(entry.itemId, transferQty);
            return { ...c, entries: [...c.entries, newEntry] };
          }
        }
        return c;
      })
    }));
  },
  
  getInventoryEntries: (containerId) => {
    if (containerId) {
      const container = get().getContainerById(containerId);
      return container?.entries ?? [];
    }
    // Return all entries from all containers
    return get().containers.flatMap(c => c.entries);
  },
  
  getInventoryEntry: (entryId) => {
    for (const container of get().containers) {
      const entry = container.entries.find(e => e.id === entryId);
      if (entry) return entry;
    }
    return undefined;
  },
  
  findItemInInventory: (itemId) => {
    for (const container of get().containers) {
      const entry = container.entries.find(e => e.itemId === itemId);
      if (entry) return entry;
    }
    return undefined;
  },
  
  getItemCount: (itemId) => {
    let count = 0;
    for (const container of get().containers) {
      for (const entry of container.entries) {
        if (entry.itemId === itemId) {
          count += entry.quantity;
        }
      }
    }
    return count;
  },
  
  // Container Actions
  addContainer: (containerData) => {
    const container: InventoryContainer = {
      ...containerData,
      id: `container-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      entries: [],
    };
    set((state) => ({
      containers: [...state.containers, container]
    }));
  },
  
  updateContainer: (id, updates) => set((state) => ({
    containers: state.containers.map(c =>
      c.id === id ? { ...c, ...updates } : c
    )
  })),
  
  deleteContainer: (id) => set((state) => {
    // Don't delete default container
    const container = state.containers.find(c => c.id === id);
    if (container?.isDefault) return state;
    
    return {
      containers: state.containers.filter(c => c.id !== id)
    };
  }),
  
  getContainerById: (id) => {
    return get().containers.find(c => c.id === id);
  },
  
  getDefaultContainer: () => {
    return get().containers.find(c => c.isDefault);
  },
  
  // Currency Actions
  addCurrency: (currencyData) => {
    const currency: CurrencyEntry = {
      ...currencyData,
      id: `currency-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    set((state) => ({
      currencies: [...state.currencies, currency]
    }));
  },
  
  updateCurrency: (id, updates) => set((state) => ({
    currencies: state.currencies.map(c =>
      c.id === id ? { ...c, ...updates } : c
    )
  })),
  
  deleteCurrency: (id) => set((state) => ({
    currencies: state.currencies.filter(c => c.id !== id)
  })),
  
  adjustCurrency: (id, amount) => set((state) => {
    const currency = state.currencies.find(c => c.id === id);
    if (!currency) return state;
    
    const newAmount = Math.max(0, currency.amount + amount);
    
    // Add notification
    const change = amount >= 0 ? `+${amount}` : `${amount}`;
    get().addInventoryNotification({
      type: 'currency_changed',
      itemName: currency.name,
      quantity: amount,
      message: `${currency.name}: ${change} (Total: ${newAmount})`,
    });
    
    return {
      currencies: state.currencies.map(c =>
        c.id === id ? { ...c, amount: newAmount } : c
      )
    };
  }),
  
  getCurrencyById: (id) => {
    return get().currencies.find(c => c.id === id);
  },
  
  getPrimaryCurrency: () => {
    return get().currencies.find(c => c.isPrimary);
  },
  
  // Equipment Actions
  equipItem: (entryId, slot, characterId) => {
    const entry = get().getInventoryEntry(entryId);
    if (!entry) return;
    
    const item = get().getItemById(entry.itemId);
    if (!item?.equippable) return;
    
    // First unequip any item in that slot
    const currentEquipped = get().getEquippedItems(characterId);
    const itemInSlot = currentEquipped.find(e => e.slot === slot);
    if (itemInSlot) {
      get().unequipItem(itemInSlot.id);
    }
    
    // Equip new item
    set((state) => ({
      containers: state.containers.map(c => ({
        ...c,
        entries: c.entries.map(e =>
          e.id === entryId
            ? { 
                ...e, 
                equipped: true, 
                equippedTo: characterId,
                slot,
                updatedAt: new Date().toISOString() 
              }
            : e
        )
      }))
    }));
    
    // Add notification
    get().addInventoryNotification({
      type: 'item_equipped',
      itemId: item.id,
      itemName: item.name,
      message: `Equipaste ${item.name}`,
    });
  },
  
  unequipItem: (entryId) => {
    const entry = get().getInventoryEntry(entryId);
    if (!entry) return;
    
    const item = get().getItemById(entry.itemId);
    
    set((state) => ({
      containers: state.containers.map(c => ({
        ...c,
        entries: c.entries.map(e =>
          e.id === entryId
            ? { 
                ...e, 
                equipped: false, 
                equippedTo: undefined,
                slot: undefined,
                updatedAt: new Date().toISOString() 
              }
            : e
        )
      }))
    }));
    
    // Add notification
    if (item) {
      get().addInventoryNotification({
        type: 'item_equipped',
        itemId: item.id,
        itemName: item.name,
        message: `Desequipaste ${item.name}`,
      });
    }
  },
  
  getEquippedItems: (characterId) => {
    const allEntries = get().containers.flatMap(c => c.entries);
    return allEntries.filter(e => {
      if (!e.equipped) return false;
      if (characterId && e.equippedTo !== characterId) return false;
      return true;
    });
  },
  
  getEquipmentStats: (characterId) => {
    const equipped = get().getEquippedItems(characterId);
    const stats: ItemStat[] = [];
    
    for (const entry of equipped) {
      const item = get().getItemById(entry.itemId);
      if (item?.stats) {
        for (const stat of item.stats) {
          const existing = stats.find(s => s.name === stat.name);
          if (existing) {
            existing.value += stat.value;
          } else {
            stats.push({ ...stat });
          }
        }
      }
    }
    
    return stats;
  },
  
  // Settings Actions
  setInventorySettings: (settings) => set((state) => ({
    inventorySettings: { ...state.inventorySettings, ...settings }
  })),
  
  // Notification Actions
  addInventoryNotification: (notification) => set((state) => ({
    inventoryNotifications: [
      {
        ...notification,
        id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
  
  // Utility
  sortInventory: (mode) => set((state) => ({
    containers: state.containers.map(c => {
      const sortedEntries = [...c.entries].sort((a, b) => {
        const itemA = get().getItemById(a.itemId);
        const itemB = get().getItemById(b.itemId);
        if (!itemA || !itemB) return 0;
        
        switch (mode) {
          case 'name':
            return itemA.name.localeCompare(itemB.name);
          case 'rarity': {
            const rarityOrder: ItemRarity[] = ['legendary', 'unique', 'epic', 'rare', 'uncommon', 'common', 'cursed'];
            return rarityOrder.indexOf(itemA.rarity) - rarityOrder.indexOf(itemB.rarity);
          }
          case 'category':
            return itemA.category.localeCompare(itemB.category);
          case 'value':
            return (itemB.value ?? 0) - (itemA.value ?? 0);
          case 'recent':
          default:
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        }
      });
      
      return { ...c, entries: sortedEntries };
    })
  })),
  
  clearInventory: (containerId) => set((state) => {
    if (containerId) {
      return {
        containers: state.containers.map(c =>
          c.id === containerId ? { ...c, entries: [] } : c
        )
      };
    }
    // Clear all containers
    return {
      containers: state.containers.map(c => ({ ...c, entries: [] }))
    };
  }),
  
  exportInventory: () => {
    return {
      items: get().items,
      containers: get().containers,
      currencies: get().currencies,
    };
  },
  
  importInventory: (data) => set((state) => ({
    items: data.items ?? state.items,
    containers: data.containers ?? state.containers,
    currencies: data.currencies ?? state.currencies,
  })),
});

// Export helper functions for external use
export { getRarityColor, getCategoryIcon, createDefaultItem, createDefaultContainer };
