'use client';

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Search,
  Plus,
  Package,
  Gem,
  Settings2,
  Sparkles,
  FlaskConical,
  Shield,
  ShoppingCart,
  Coins,
  Trash2,
  Clock,
  X,
  Target,
  User,
} from 'lucide-react';
import { useTavernStore } from '@/store/tavern-store';
import { ItemCard } from './item-card';
import { ItemEditor } from './item-editor';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type {
  Item,
  InventoryV2Settings,
  ActiveConsumableEffect,
  PersonaInventoryEntry,
} from '@/types';
import {
  getRarityColor,
  getRarityBgColor,
  getItemTypeIcon,
  getItemTypeLabel,
} from '@/store/slices/inventorySlice';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================
// Active Effect Badge
// ============================================

function ActiveEffectBadge({ effect, onRemove }: { effect: ActiveConsumableEffect; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs">
      <Clock className="w-3 h-3 text-amber-500 shrink-0" />
      <span className="truncate font-medium text-amber-600 dark:text-amber-400">
        {effect.itemName}
      </span>
      <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 shrink-0">
        {effect.remainingTurns}/{effect.totalTurns}
      </Badge>
      <Button
        variant="ghost"
        size="sm"
        className="h-4 w-4 p-0 shrink-0"
        onClick={onRemove}
      >
        <X className="w-3 h-3" />
      </Button>
    </div>
  );
}

// ============================================
// Shop Item Row
// ============================================

function ShopItemRow({
  item,
  canAfford,
  currencyIcon,
  onBuy,
}: {
  item: Item;
  canAfford: boolean;
  currencyIcon: string;
  onBuy: () => void;
}) {
  const rarityColor = getRarityColor(item.rarity);
  const typeIcon = item.icon || getItemTypeIcon(item.type || 'consumable');
  const typeLabel = getItemTypeLabel(item.type || 'consumable');

  return (
    <div className={cn('flex items-center gap-2.5 p-2.5 rounded-lg border', getRarityBgColor(item.rarity))}>
      <div className={cn('w-8 h-8 rounded-md flex items-center justify-center text-base shrink-0', getRarityBgColor(item.rarity))}>
        {typeIcon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('font-medium text-sm truncate', rarityColor)}>{item.name}</p>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{typeLabel}</span>
          {item.description && (
            <>
              <span>•</span>
              <span className="truncate">{item.description}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1 text-sm font-medium">
          <span>{item.price}</span>
          <span>{currencyIcon}</span>
        </div>
        <Button
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={!canAfford}
          onClick={onBuy}
        >
          <ShoppingCart className="w-3.5 h-3.5 mr-1" />
          Comprar
        </Button>
      </div>
    </div>
  );
}

// ============================================
// Inventory Panel Component
// ============================================

export function InventoryPanel() {
  const {
    items,
    activeConsumableEffects,
    inventorySettings,
    inventoryNotifications,
    pendingEquipAction,
    addItem,
    updateItem,
    deleteItem,
    getActivePersona,
    addToPersona,
    removeFromPersona,
    getPersonaItems,
    equipItem,
    unequipItem,
    getEquippedItems,
    useConsumable: consumeItem,
    removeEffect,
    adjustCurrency,
    canAfford,
    purchaseItem,
    getShopItems,
    searchItems,
    getItemsByType,
    setInventorySettings,
    addInventoryNotification,
    clearInventoryNotifications,
    requestEquipItem,
    requestUseItem,
    clearPendingEquipAction,
    executeEquipWithTarget,
    executeUseWithTarget,
  } = useTavernStore();

  // Characters for target selection
  const characters = useTavernStore(state => state.characters);
  const activeSessionId = useTavernStore(state => state.activeSessionId);
  const sessions = useTavernStore(state => state.sessions);
  const getGroupById = useTavernStore(state => state.getGroupById);
  const getCharacterById = useTavernStore(state => state.getCharacterById);

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [activeTab, setActiveTab] = useState<string>('inventory');
  const [targetPickerOpen, setTargetPickerOpen] = useState(false);
  const [targetPickerAction, setTargetPickerAction] = useState<'equip' | 'use' | null>(null);
  const [targetPickerItemId, setTargetPickerItemId] = useState<string>('');
  const [selectedTargetId, setSelectedTargetId] = useState<string>('__user__');

  // Build target options from active session characters
  const targetOptions = useMemo(() => {
    const options = [{ value: '__user__', label: 'Persona (usuario)', icon: '👤' }];

    const activeSession = sessions.find(s => s.id === activeSessionId);
    if (activeSession) {
      const sessionCharIds: string[] = [];

      if (activeSession.groupId) {
        const group = getGroupById?.(activeSession.groupId);
        if (group?.members) {
          for (const member of group.members) {
            sessionCharIds.push(member.characterId);
          }
        }
      } else if (activeSession.characterId) {
        sessionCharIds.push(activeSession.characterId);
      }

      for (const charId of sessionCharIds) {
        const char = getCharacterById?.(charId);
        if (char) {
          options.push({ value: char.id, label: char.name || 'Personaje', icon: '🎭' });
        }
      }
    } else {
      for (const char of characters) {
        options.push({ value: char.id, label: char.name || 'Personaje', icon: '🎭' });
      }
    }

    return options;
  }, [characters, activeSessionId, sessions, getGroupById, getCharacterById]);

  // Check if an item needs a target picker dialog
  const itemNeedsTargetPicker = useCallback((item: Item): boolean => {
    if (!item.attributeEffects || item.attributeEffects.length === 0) return false;
    // Show picker if any effect targets a character (not just __user__)
    return item.attributeEffects.some(e => e.targetId !== '__user__');
  }, []);

  // Get active persona
  const persona = getActivePersona();
  const personaId = persona?.id ?? '';

  // Persona items
  const personaItems = useMemo(
    () => (personaId ? getPersonaItems(personaId) : []),
    [personaId, getPersonaItems, persona?.inventoryItems]
  );

  const equippedItems = useMemo(
    () => (personaId ? getEquippedItems(personaId) : []),
    [personaId, getEquippedItems, persona?.inventoryItems]
  );

  // Active effects for this persona
  const activeEffects = useMemo(
    () => activeConsumableEffects.filter(e => e.personaId === personaId),
    [activeConsumableEffects, personaId]
  );

  // Shop items
  const shopItems = useMemo(() => getShopItems(), [items]);

  // Filter persona items by search
  const filteredPersonaItems = useMemo(() => {
    if (!searchQuery) return personaItems;
    const q = searchQuery.toLowerCase();
    return personaItems.filter(({ item }) =>
      item.name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.tags?.some(t => t.toLowerCase().includes(q))
    );
  }, [personaItems, searchQuery]);

  // Filter registry items by search
  const filteredRegistryItems = useMemo(() => {
    let result = items;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item =>
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.tags?.some(t => t.toLowerCase().includes(q))
      );
    }
    return result;
  }, [items, searchQuery]);

  // Filter shop items by search
  const filteredShopItems = useMemo(() => {
    if (!searchQuery) return shopItems;
    const q = searchQuery.toLowerCase();
    return shopItems.filter(item =>
      item.name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q)
    );
  }, [shopItems, searchQuery]);

  // Stats
  const totalItems = personaItems.reduce((sum, { entry }) => sum + entry.quantity, 0);
  const equippedCount = equippedItems.length;
  const unreadNotifications = inventoryNotifications.filter(n => !n.read).length;

  // Handlers
  const handleCreateItem = (itemData: Item) => {
    addItem(itemData);
    setEditingItem(null);
  };

  const handleUpdateItem = (itemData: Item) => {
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

  const handleUseConsumable = (itemId: string) => {
    if (!personaId) return;
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    if (itemNeedsTargetPicker(item)) {
      // Show target picker dialog
      setTargetPickerAction('use');
      setTargetPickerItemId(itemId);
      setSelectedTargetId(item.attributeEffects?.[0]?.targetId || '__user__');
      setTargetPickerOpen(true);
    } else {
      consumeItem(personaId, itemId);
    }
  };

  const handleEquipItem = (itemId: string) => {
    if (!personaId) return;
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    if (itemNeedsTargetPicker(item)) {
      // Show target picker dialog
      setTargetPickerAction('equip');
      setTargetPickerItemId(itemId);
      setSelectedTargetId(item.attributeEffects?.[0]?.targetId || '__user__');
      setTargetPickerOpen(true);
    } else {
      equipItem(personaId, itemId);
    }
  };

  const handleTargetPickerConfirm = () => {
    if (!personaId || !targetPickerAction) return;
    if (targetPickerAction === 'equip') {
      executeEquipWithTarget(personaId, targetPickerItemId, selectedTargetId);
    } else {
      executeUseWithTarget(personaId, targetPickerItemId, selectedTargetId);
    }
    setTargetPickerOpen(false);
    setTargetPickerAction(null);
    setTargetPickerItemId('');
  };

  const handleTargetPickerCancel = () => {
    setTargetPickerOpen(false);
    setTargetPickerAction(null);
    setTargetPickerItemId('');
    clearPendingEquipAction();
  };

  const handleUnequipItem = (itemId: string) => {
    if (!personaId) return;
    unequipItem(personaId, itemId);
  };

  const handleRemoveFromPersona = (itemId: string) => {
    if (!personaId) return;
    removeFromPersona(personaId, itemId);
  };

  const handleBuyItem = (itemId: string) => {
    if (!personaId) return;
    purchaseItem(personaId, itemId);
  };

  const handleAdjustCurrency = (amount: number) => {
    if (!personaId) return;
    adjustCurrency(personaId, amount);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Inventario</h2>
          <Badge variant="secondary" className="text-xs">{totalItems} items</Badge>
          {equippedCount > 0 && (
            <Badge variant="outline" className="text-xs">
              <Shield className="w-3 h-3 mr-1" />
              {equippedCount}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => { setEditingItem(null); setEditorOpen(true); }}
        >
          <Plus className="w-4 h-4 mr-1" />
          Nuevo
        </Button>
      </div>

      {/* Currency Bar */}
      {persona && (
        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">{persona.currencyIcon || '💰'}</span>
            <span className="font-bold text-lg">{persona.currency ?? 0}</span>
            <span className="text-sm text-muted-foreground">{persona.currencyName || 'Divisa'}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-xs"
              onClick={() => handleAdjustCurrency(-10)}
              title="-10"
            >
              −
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-xs"
              onClick={() => handleAdjustCurrency(-1)}
              title="-1"
            >
              −1
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-xs"
              onClick={() => handleAdjustCurrency(1)}
              title="+1"
            >
              +1
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-xs"
              onClick={() => handleAdjustCurrency(10)}
              title="+10"
            >
              +
            </Button>
          </div>
        </div>
      )}

      {/* Active Effects */}
      {activeEffects.length > 0 && (
        <div className="px-3 py-2 border-b bg-amber-500/5 shrink-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              Efectos Activos
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {activeEffects.map(effect => (
              <ActiveEffectBadge
                key={effect.id}
                effect={effect}
                onRemove={() => removeEffect(effect.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="px-3 pt-2 border-b shrink-0">
          <TabsList className="w-full">
            <TabsTrigger value="inventory" className="flex-1 text-xs">
              Inventario
            </TabsTrigger>
            <TabsTrigger value="registry" className="flex-1 text-xs">
              Registro
            </TabsTrigger>
            <TabsTrigger value="shop" className="flex-1 text-xs">
              Tienda
            </TabsTrigger>
            <TabsTrigger value="config" className="flex-1 text-xs">
              Config
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ===== Inventario Tab ===== */}
        <TabsContent value="inventory" className="flex-1 overflow-hidden m-0">
          <div className="h-full flex flex-col p-3 gap-3">
            {/* Search */}
            <div className="relative shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar items..."
                className="pl-9"
              />
            </div>

            {/* Items List */}
            <ScrollArea className="flex-1">
              {filteredPersonaItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="w-16 h-16 mx-auto mb-3 opacity-50" />
                  <p className="text-lg font-medium">Inventario vacío</p>
                  <p className="text-sm mt-1">Los items aparecerán aquí cuando los obtengas</p>
                </div>
              ) : (
                <div className="grid gap-2 pr-3">
                  <AnimatePresence mode="popLayout">
                    {filteredPersonaItems.map(({ entry, item }) => (
                      <motion.div
                        key={entry.itemId}
                        layout
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                      >
                        <ItemCard
                          item={item}
                          entry={entry}
                          showQuantity
                          showActions
                          onUse={item.type === 'consumable' ? () => handleUseConsumable(item.id) : undefined}
                          onEquip={item.type === 'equipment' && !entry.equipped ? () => handleEquipItem(item.id) : undefined}
                          onUnequip={item.type === 'equipment' && entry.equipped ? () => handleUnequipItem(item.id) : undefined}
                          onRemove={() => handleRemoveFromPersona(item.id)}
                          onEdit={() => { setEditingItem(item); setEditorOpen(true); }}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </ScrollArea>
          </div>
        </TabsContent>

        {/* ===== Registro Tab ===== */}
        <TabsContent value="registry" className="flex-1 overflow-hidden m-0">
          <div className="h-full flex flex-col p-3 gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
              <Package className="w-4 h-4" />
              <span>Items definidos ({filteredRegistryItems.length})</span>
            </div>

            <div className="relative shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar en registro..."
                className="pl-9"
              />
            </div>

            <ScrollArea className="flex-1">
              {filteredRegistryItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="w-16 h-16 mx-auto mb-3 opacity-50" />
                  <p className="text-lg font-medium">Registro vacío</p>
                  <p className="text-sm mt-1">Crea items para el sistema de inventario</p>
                </div>
              ) : (
                <div className="grid gap-2 pr-3">
                  {filteredRegistryItems.map(item => {
                    const inInventory = persona?.inventoryItems?.some(e => e.itemId === item.id);
                    const typeIcon = item.icon || getItemTypeIcon(item.type || 'consumable');
                    const typeLabel = getItemTypeLabel(item.type || 'consumable');

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          'flex items-center gap-2.5 p-2.5 rounded-lg border',
                          getRarityBgColor(item.rarity)
                        )}
                      >
                        <div className={cn('w-8 h-8 rounded-md flex items-center justify-center text-base shrink-0', getRarityBgColor(item.rarity))}>
                          {typeIcon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn('font-medium text-sm truncate', getRarityColor(item.rarity))}>
                            {item.name}
                          </p>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                              {typeLabel}
                            </Badge>
                            <span>{item.rarity}</span>
                            {inInventory && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                En inventario
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {personaId && !inInventory && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => addToPersona(personaId, item.id, 1)}
                              title="Agregar al inventario"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => { setEditingItem(item); setEditorOpen(true); }}
                            title="Editar item"
                          >
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

        {/* ===== Tienda Tab ===== */}
        <TabsContent value="shop" className="flex-1 overflow-hidden m-0">
          <div className="h-full flex flex-col p-3 gap-3">
            {/* Currency display */}
            {persona && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 shrink-0">
                <Coins className="w-5 h-5 text-amber-500" />
                <span className="font-bold">{persona.currency ?? 0}</span>
                <span className="text-sm text-muted-foreground">{persona.currencyName || 'Divisa'}</span>
              </div>
            )}

            <div className="relative shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar en la tienda..."
                className="pl-9"
              />
            </div>

            <ScrollArea className="flex-1">
              {filteredShopItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ShoppingCart className="w-16 h-16 mx-auto mb-3 opacity-50" />
                  <p className="text-lg font-medium">Tienda vacía</p>
                  <p className="text-sm mt-1">Define precios en los items para que aparezcan aquí</p>
                </div>
              ) : (
                <div className="grid gap-2 pr-3">
                  {filteredShopItems.map(item => (
                    <ShopItemRow
                      key={item.id}
                      item={item}
                      canAfford={personaId ? canAfford(personaId, item.price ?? 0) : false}
                      currencyIcon={persona?.currencyIcon ?? '💰'}
                      onBuy={() => handleBuyItem(item.id)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </TabsContent>

        {/* ===== Config Tab ===== */}
        <TabsContent value="config" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full p-3">
            <div className="space-y-6 pr-3">
              {/* General Settings */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">General</h3>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Sistema habilitado</Label>
                    <p className="text-xs text-muted-foreground">
                      Activar el sistema de inventario
                    </p>
                  </div>
                  <Switch
                    checked={inventorySettings.enabled}
                    onCheckedChange={(v) => setInventorySettings({ enabled: v })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Mostrar en chat</Label>
                    <p className="text-xs text-muted-foreground">
                      Mostrar mini HUD en el área de chat
                    </p>
                  </div>
                  <Switch
                    checked={inventorySettings.showInChat}
                    onCheckedChange={(v) => setInventorySettings({ showInChat: v })}
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

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Detección automática</Label>
                    <p className="text-xs text-muted-foreground">
                      Detectar items en mensajes automáticamente
                    </p>
                  </div>
                  <Switch
                    checked={inventorySettings.autoDetect}
                    onCheckedChange={(v) => setInventorySettings({ autoDetect: v })}
                  />
                </div>
              </div>

              <Separator />

              {/* Prompt Settings */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">Integración con Prompt</h3>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Incluir en prompt</Label>
                    <p className="text-xs text-muted-foreground">
                      Agregar inventario al prompt del LLM
                    </p>
                  </div>
                  <Switch
                    checked={inventorySettings.promptInclude}
                    onCheckedChange={(v) => setInventorySettings({ promptInclude: v })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Plantilla del prompt</Label>
                  <p className="text-xs text-muted-foreground">
                    Variables: {'{{activeItems}}'}, {'{{activeEffects}}'}, {'{{equippedItems}}'}, {'{{currency}}'}
                  </p>
                  <Textarea
                    value={inventorySettings.promptTemplate}
                    onChange={(e) => setInventorySettings({ promptTemplate: e.target.value })}
                    rows={6}
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              <Separator />

              {/* Currency Settings */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">Divisa</h3>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Nombre</Label>
                    <Input
                      value={inventorySettings.currencyName}
                      onChange={(e) => setInventorySettings({ currencyName: e.target.value })}
                      placeholder="Divisa"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Icono</Label>
                    <Input
                      value={inventorySettings.currencyIcon}
                      onChange={(e) => setInventorySettings({ currencyIcon: e.target.value })}
                      placeholder="💰"
                      className="w-20"
                      maxLength={4}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Notifications */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">
                    Notificaciones
                    {unreadNotifications > 0 && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">
                        {unreadNotifications}
                      </Badge>
                    )}
                  </h3>
                  {inventoryNotifications.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={clearInventoryNotifications}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Limpiar
                    </Button>
                  )}
                </div>

                {inventoryNotifications.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Sin notificaciones
                  </p>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {inventoryNotifications.slice(0, 20).map(notif => (
                      <div
                        key={notif.id}
                        className={cn(
                          'text-xs p-2 rounded-md',
                          notif.read ? 'text-muted-foreground' : 'bg-muted/50 font-medium'
                        )}
                      >
                        <span className="text-muted-foreground">
                          {new Date(notif.timestamp).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {' '}
                        {notif.message}
                      </div>
                    ))}
                  </div>
                )}
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

      {/* Target Picker Dialog */}
      <Dialog open={targetPickerOpen} onOpenChange={(open) => { if (!open) handleTargetPickerCancel(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Seleccionar Objetivo
            </DialogTitle>
            <DialogDescription>
              {targetPickerAction === 'equip'
                ? 'Elige quién recibe los efectos al equipar este item'
                : 'Elige quién recibe los efectos al usar este consumible'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            {targetOptions.map(opt => (
              <button
                key={opt.value}
                type="button"
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors',
                  selectedTargetId === opt.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-muted/50'
                )}
                onClick={() => setSelectedTargetId(opt.value)}
              >
                <span className="text-lg shrink-0">{opt.icon}</span>
                <span className="font-medium text-sm">{opt.label}</span>
                {selectedTargetId === opt.value && (
                  <Badge variant="default" className="ml-auto text-[10px]">
                    Seleccionado
                  </Badge>
                )}
              </button>
            ))}

            {targetOptions.length === 1 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                No hay personajes en la sesión actual. Los efectos se aplicarán a la persona.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={handleTargetPickerCancel}>
              Cancelar
            </Button>
            <Button onClick={handleTargetPickerConfirm}>
              {targetPickerAction === 'equip' ? 'Equipar' : 'Usar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default InventoryPanel;
