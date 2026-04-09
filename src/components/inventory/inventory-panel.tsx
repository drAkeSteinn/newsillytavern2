'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Search,
  Plus,
  Package,
  Gem,
  Settings2,
  Filter,
  SortAsc,
  Sparkles,
  Shield,
  Sword,
  BookOpen,
  Key,
  Wrench,
  Shirt,
  Wine,
} from 'lucide-react';
import { useTavernStore } from '@/store/tavern-store';
import { ItemCard } from './item-card';
import { ItemEditor } from './item-editor';
import type { 
  Item, 
  InventoryEntry, 
  ItemCategory, 
  ItemRarity,
  InventorySettings,
} from '@/types';
import { DEFAULT_INVENTORY_SETTINGS, getCategoryIcon, getRarityColor } from '@/store/slices/inventorySlice';

// ============================================
// Constants
// ============================================

const CATEGORIES: { value: ItemCategory | 'all'; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'Todos', icon: <Package className="w-4 h-4" /> },
  { value: 'weapon', label: 'Armas', icon: <Sword className="w-4 h-4" /> },
  { value: 'armor', label: 'Armadura', icon: <Shield className="w-4 h-4" /> },
  { value: 'accessory', label: 'Accesorios', icon: <Sparkles className="w-4 h-4" /> },
  { value: 'consumable', label: 'Consumibles', icon: <Wine className="w-4 h-4" /> },
  { value: 'material', label: 'Materiales', icon: <Package className="w-4 h-4" /> },
  { value: 'key', label: 'Quest', icon: <Key className="w-4 h-4" /> },
  { value: 'book', label: 'Libros', icon: <BookOpen className="w-4 h-4" /> },
  { value: 'tool', label: 'Herramientas', icon: <Wrench className="w-4 h-4" /> },
  { value: 'treasure', label: 'Tesoros', icon: <Gem className="w-4 h-4" /> },
  { value: 'clothing', label: 'Ropa', icon: <Shirt className="w-4 h-4" /> },
  { value: 'misc', label: 'Otros', icon: <Package className="w-4 h-4" /> },
];

const SORT_OPTIONS = [
  { value: 'recent', label: 'Más recientes' },
  { value: 'name', label: 'Nombre' },
  { value: 'rarity', label: 'Rareza' },
  { value: 'category', label: 'Categoría' },
  { value: 'value', label: 'Valor' },
];

// ============================================
// Inventory Panel Component
// ============================================

export function InventoryPanel() {
  const {
    items,
    containers,
    currencies,
    inventorySettings,
    addItem,
    updateItem,
    deleteItem,
    addToInventory,
    removeFromInventory,
    setInventorySettings,
    sortInventory,
    addCurrency,
    updateCurrency,
    deleteCurrency,
    adjustCurrency,
  } = useTavernStore();
  
  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | 'all'>('all');
  const [selectedRarity, setSelectedRarity] = useState<ItemRarity | 'all'>('all');
  const [showEquipped, setShowEquipped] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [activeTab, setActiveTab] = useState<'inventory' | 'registry' | 'currency' | 'settings'>('inventory');
  
  // Get default container entries
  const defaultContainer = containers.find(c => c.isDefault);
  const inventoryEntries = defaultContainer?.entries || [];
  
  // Filter and sort inventory
  const filteredInventory = useMemo(() => {
    let result = inventoryEntries.map(entry => {
      const item = items.find(i => i.id === entry.itemId);
      return { entry, item };
    }).filter(({ item }) => item !== undefined) as Array<{ entry: InventoryEntry; item: Item }>;
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(({ item }) =>
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    // Apply category filter
    if (selectedCategory !== 'all') {
      result = result.filter(({ item }) => item.category === selectedCategory);
    }
    
    // Apply rarity filter
    if (selectedRarity !== 'all') {
      result = result.filter(({ item }) => item.rarity === selectedRarity);
    }
    
    // Apply equipped filter
    if (!showEquipped) {
      result = result.filter(({ entry }) => !entry.equipped);
    }
    
    // Sort
    switch (inventorySettings.sortMode) {
      case 'name':
        result.sort((a, b) => a.item.name.localeCompare(b.item.name));
        break;
      case 'rarity': {
        const rarityOrder: ItemRarity[] = ['legendary', 'unique', 'epic', 'rare', 'uncommon', 'common', 'cursed'];
        result.sort((a, b) => rarityOrder.indexOf(a.item.rarity) - rarityOrder.indexOf(b.item.rarity));
        break;
      }
      case 'category':
        result.sort((a, b) => a.item.category.localeCompare(b.item.category));
        break;
      case 'value':
        result.sort((a, b) => (b.item.value ?? 0) - (a.item.value ?? 0));
        break;
      case 'recent':
      default:
        result.sort((a, b) => new Date(b.entry.updatedAt).getTime() - new Date(a.entry.updatedAt).getTime());
    }
    
    return result;
  }, [inventoryEntries, items, searchQuery, selectedCategory, selectedRarity, showEquipped, inventorySettings.sortMode]);
  
  // Filter items registry
  const filteredItems = useMemo(() => {
    let result = items;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query)
      );
    }
    
    if (selectedCategory !== 'all') {
      result = result.filter(item => item.category === selectedCategory);
    }
    
    if (selectedRarity !== 'all') {
      result = result.filter(item => item.rarity === selectedRarity);
    }
    
    return result;
  }, [items, searchQuery, selectedCategory, selectedRarity]);
  
  // Handlers
  const handleCreateItem = (itemData: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newItem: Item = {
      ...itemData,
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addItem(newItem);
    setEditingItem(null);
  };
  
  const handleUpdateItem = (itemData: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!editingItem) return;
    updateItem(editingItem.id, itemData);
    setEditingItem(null);
  };
  
  const handleDeleteItem = () => {
    if (!editingItem) return;
    deleteItem(editingItem.id);
    setEditingItem(null);
    setEditorOpen(false);
  };
  
  const handleAddToInventory = (item: Item) => {
    addToInventory(item.id, 1);
  };
  
  // Calculate stats
  const totalItems = inventoryEntries.reduce((sum, e) => sum + e.quantity, 0);
  const equippedCount = inventoryEntries.filter(e => e.equipped).length;
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <Package className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Inventario</h2>
          <Badge variant="secondary">{totalItems} items</Badge>
          {equippedCount > 0 && (
            <Badge variant="outline">{equippedCount} equipados</Badge>
          )}
        </div>
        <Button size="sm" onClick={() => { setEditingItem(null); setEditorOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" />
          Nuevo Item
        </Button>
      </div>
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 flex flex-col">
        <div className="px-4 pt-2 border-b">
          <TabsList>
            <TabsTrigger value="inventory">Inventario</TabsTrigger>
            <TabsTrigger value="registry">Registro</TabsTrigger>
            <TabsTrigger value="currency">Divisa</TabsTrigger>
            <TabsTrigger value="settings">Config</TabsTrigger>
          </TabsList>
        </div>
        
        {/* Inventory Tab */}
        <TabsContent value="inventory" className="flex-1 overflow-hidden m-0">
          <div className="h-full flex flex-col p-4 gap-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar items..."
                  className="pl-9"
                />
              </div>
              
              <Select value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as typeof selectedCategory)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <div className="flex items-center gap-2">
                        {cat.icon}
                        {cat.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={inventorySettings.sortMode} onValueChange={(v) => {
                setInventorySettings({ sortMode: v as InventorySettings['sortMode'] });
              }}>
                <SelectTrigger className="w-[140px]">
                  <SortAsc className="w-4 h-4 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Items List */}
            <ScrollArea className="flex-1">
              {filteredInventory.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="w-16 h-16 mx-auto mb-3 opacity-50" />
                  <p className="text-lg font-medium">Inventario vacío</p>
                  <p className="text-sm mt-1">Los items aparecerán aquí cuando los obtengas</p>
                </div>
              ) : (
                <div className="grid gap-2 pr-4">
                  {filteredInventory.map(({ entry, item }) => (
                    <ItemCard
                      key={entry.id}
                      item={item}
                      entry={entry}
                      showQuantity
                      onEdit={() => { setEditingItem(item); setEditorOpen(true); }}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </TabsContent>
        
        {/* Registry Tab */}
        <TabsContent value="registry" className="flex-1 overflow-hidden m-0">
          <div className="h-full flex flex-col p-4 gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BookOpen className="w-4 h-4" />
              <span>Registro de items definidos ({filteredItems.length})</span>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar en registro..."
                className="pl-9"
              />
            </div>
            
            <ScrollArea className="flex-1">
              {filteredItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="w-16 h-16 mx-auto mb-3 opacity-50" />
                  <p className="text-lg font-medium">Registro vacío</p>
                  <p className="text-sm mt-1">Crea items para el sistema de inventario</p>
                </div>
              ) : (
                <div className="grid gap-2 pr-4">
                  {filteredItems.map(item => {
                    const inInventory = inventoryEntries.some(e => e.itemId === item.id);
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <span className="text-xl">{item.icon || getCategoryIcon(item.category)}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium truncate ${getRarityColor(item.rarity)}`}>
                            {item.name}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {item.category} • {item.rarity}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {!inInventory && (
                            <Button variant="ghost" size="sm" onClick={() => handleAddToInventory(item)}>
                              <Plus className="w-4 h-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => { setEditingItem(item); setEditorOpen(true); }}>
                            <Settings2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </TabsContent>
        
        {/* Currency Tab */}
        <TabsContent value="currency" className="flex-1 overflow-hidden m-0">
          <div className="h-full flex flex-col p-4 gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Divisas</h3>
              <Button size="sm" onClick={() => addCurrency({ name: 'Nueva Divisa', amount: 0 })}>
                <Plus className="w-4 h-4 mr-1" />
                Agregar
              </Button>
            </div>
            
            {currencies.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Gem className="w-16 h-16 mx-auto mb-3 opacity-50" />
                <p className="text-lg font-medium">Sin divisas</p>
                <p className="text-sm mt-1">Añade divisas como Oro, Plata, Gemas, etc.</p>
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="space-y-2 pr-4">
                  {currencies.map(currency => (
                    <div
                      key={currency.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                    >
                      <span className="text-xl">{currency.icon || '💰'}</span>
                      <div className="flex-1">
                        <p className="font-medium">{currency.name}</p>
                        <p className="text-lg font-bold">{currency.amount}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => adjustCurrency(currency.id, -10)}>
                          -10
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => adjustCurrency(currency.id, 10)}>
                          +10
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </TabsContent>
        
        {/* Settings Tab */}
        <TabsContent value="settings" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full p-4">
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-semibold">Detección Automática</h3>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Habilitar detección</Label>
                    <p className="text-xs text-muted-foreground">
                      Detectar items en mensajes automáticamente
                    </p>
                  </div>
                  <Switch
                    checked={inventorySettings.autoDetect}
                    onCheckedChange={(v) => setInventorySettings({ autoDetect: v })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Detectar en tiempo real</Label>
                    <p className="text-xs text-muted-foreground">
                      Detectar durante el streaming del mensaje
                    </p>
                  </div>
                  <Switch
                    checked={inventorySettings.realtimeEnabled}
                    onCheckedChange={(v) => setInventorySettings({ realtimeEnabled: v })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Notificaciones</Label>
                    <p className="text-xs text-muted-foreground">
                      Mostrar notificaciones de items
                    </p>
                  </div>
                  <Switch
                    checked={inventorySettings.showNotifications}
                    onCheckedChange={(v) => setInventorySettings({ showNotifications: v })}
                  />
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <h3 className="font-semibold">Visualización</h3>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Colores por rareza</Label>
                    <p className="text-xs text-muted-foreground">
                      Colorear items según su rareza
                    </p>
                  </div>
                  <Switch
                    checked={inventorySettings.showRarityColors}
                    onCheckedChange={(v) => setInventorySettings({ showRarityColors: v })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Vista compacta</Label>
                    <p className="text-xs text-muted-foreground">
                      Mostrar items en formato compacto
                    </p>
                  </div>
                  <Switch
                    checked={inventorySettings.compactView}
                    onCheckedChange={(v) => setInventorySettings({ compactView: v })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Mostrar valor</Label>
                    <p className="text-xs text-muted-foreground">
                      Mostrar valor de los items
                    </p>
                  </div>
                  <Switch
                    checked={inventorySettings.showItemValue}
                    onCheckedChange={(v) => setInventorySettings({ showItemValue: v })}
                  />
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <h3 className="font-semibold">Equipo</h3>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Sistema de equipo</Label>
                    <p className="text-xs text-muted-foreground">
                      Permitir equipar items
                    </p>
                  </div>
                  <Switch
                    checked={inventorySettings.enableEquipment}
                    onCheckedChange={(v) => setInventorySettings({ enableEquipment: v })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Mostrar equipados</Label>
                    <p className="text-xs text-muted-foreground">
                      Mostrar items equipados en el inventario
                    </p>
                  </div>
                  <Switch
                    checked={inventorySettings.showEquippedInInventory}
                    onCheckedChange={(v) => setInventorySettings({ showEquippedInInventory: v })}
                  />
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
      
      {/* Item Editor Dialog */}
      <ItemEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        item={editingItem}
        onSave={editingItem ? handleUpdateItem : handleCreateItem}
        onDelete={editingItem ? handleDeleteItem : undefined}
      />
    </div>
  );
}

export default InventoryPanel;
