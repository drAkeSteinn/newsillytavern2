'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
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
  Download,
  Upload,
  AlertCircle,
  CheckCircle,
  Shirt,
  Pencil,
  Copy,
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
  DialogFooter,
} from '@/components/ui/dialog';
import type {
  Item,
  InventoryV2Settings,
  ActiveConsumableEffect,
  PersonaInventoryEntry,
  EquipmentSlotDefinition,
} from '@/types';
import {
  getRarityColor,
  getRarityBgColor,
  getItemTypeIcon,
  getItemTypeLabel,
} from '@/store/slices/inventorySlice';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';

// ============================================
// Slot Emoji Quick Picker
// ============================================

const SLOT_EMOJIS = ['🪖', '🧢', '🧥', '🛡️', '⚔️', '🗡️', '🧤', '🥾', '💍', '📿', '🎒', '👑', '🎭', '💫', '🔮'];

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

// Stable empty array to avoid creating new references
const EMPTY_ARRAY: EquipmentSlotDefinition[] = [];
const EMPTY_ITEMS: Array<{ entry: PersonaInventoryEntry; item: Item }> = [];

export function InventoryPanel() {
  // ---- State selectors (individual to avoid infinite re-render loops) ----
  const items = useTavernStore(state => state.items);
  const activeConsumableEffects = useTavernStore(state => state.activeConsumableEffects);
  const inventorySettings = useTavernStore(state => state.inventorySettings);
  const inventoryNotifications = useTavernStore(state => state.inventoryNotifications);

  // ---- Action selectors (stable references in Zustand) ----
  const addItem = useTavernStore(state => state.addItem);
  const updateItem = useTavernStore(state => state.updateItem);
  const deleteItem = useTavernStore(state => state.deleteItem);
  const addToPersona = useTavernStore(state => state.addToPersona);
  const removeFromPersona = useTavernStore(state => state.removeFromPersona);
  const getPersonaItems = useTavernStore(state => state.getPersonaItems);
  const equipItem = useTavernStore(state => state.equipItem);
  const equipItemToSlot = useTavernStore(state => state.equipItemToSlot);
  const unequipItem = useTavernStore(state => state.unequipItem);
  const getEquippedItems = useTavernStore(state => state.getEquippedItems);
  const getSessionEquipment = useTavernStore(state => state.getSessionEquipment);
  const isItemEquippedInSession = useTavernStore(state => state.isItemEquippedInSession);
  const consumeItem = useTavernStore(state => state.useConsumable);
  const removeEffect = useTavernStore(state => state.removeEffect);
  const adjustCurrency = useTavernStore(state => state.adjustCurrency);
  const canAfford = useTavernStore(state => state.canAfford);
  const purchaseItem = useTavernStore(state => state.purchaseItem);
  const getShopItems = useTavernStore(state => state.getShopItems);
  const setInventorySettings = useTavernStore(state => state.setInventorySettings);
  const clearInventoryNotifications = useTavernStore(state => state.clearInventoryNotifications);
  const clearPendingEquipAction = useTavernStore(state => state.clearPendingEquipAction);
  const executeEquipWithTarget = useTavernStore(state => state.executeEquipWithTarget);
  const executeUseWithTarget = useTavernStore(state => state.executeUseWithTarget);
  const exportInventory = useTavernStore(state => state.exportInventory);
  const importInventory = useTavernStore(state => state.importInventory);

  // Characters for target selection
  const characters = useTavernStore(state => state.characters);
  const activeSessionId = useTavernStore(state => state.activeSessionId);
  const sessions = useTavernStore(state => state.sessions);
  const getGroupById = useTavernStore(state => state.getGroupById);
  const getCharacterById = useTavernStore(state => state.getCharacterById);

  // Persona data via selectors (avoid calling getActivePersona() in render)
  const activePersonaId = useTavernStore(state => state.activePersonaId);
  const personas = useTavernStore(state => state.personas);
  const persona = useMemo(() => {
    if (!activePersonaId) return null;
    return personas.find(p => p.id === activePersonaId) || null;
  }, [activePersonaId, personas]);
  const personaId = persona?.id ?? '';

  // Equipment slots - use stable empty array ref
  const equipmentSlots = useTavernStore(state => state.inventorySettings.equipmentSlots) ?? EMPTY_ARRAY;
  const addEquipmentSlot = useTavernStore(state => state.addEquipmentSlot);
  const updateEquipmentSlot = useTavernStore(state => state.updateEquipmentSlot);
  const deleteEquipmentSlot = useTavernStore(state => state.deleteEquipmentSlot);

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const editorNonceRef = useRef(0); // Increments each time the editor opens, to force remount
  const [activeTab, setActiveTab] = useState<string>('inventory');
  const [targetPickerOpen, setTargetPickerOpen] = useState(false);
  const [targetPickerAction, setTargetPickerAction] = useState<'equip' | 'use' | null>(null);
  const [targetPickerItemId, setTargetPickerItemId] = useState<string>('');
  const [selectedTargetId, setSelectedTargetId] = useState<string>('__user__');
  const [editingSlot, setEditingSlot] = useState<EquipmentSlotDefinition | null>(null);
  const [slotEditorOpen, setSlotEditorOpen] = useState(false);
  const [slotForm, setSlotForm] = useState({ name: '', key: '', icon: '', description: '' });
  const [slotPickerOpen, setSlotPickerOpen] = useState(false);
  const [slotPickerItemId, setSlotPickerItemId] = useState<string>('');
  const { toast } = useToast();
  const itemFileInputRef = useRef<HTMLInputElement>(null);

  // Build target options from active session characters
  const targetOptions = useMemo(() => {
    const options = [{ value: '__user__', label: 'Persona (usuario)', icon: '👤' }];

    const activeSession = sessions.find(s => s.id === activeSessionId);
    if (activeSession) {
      const sessionCharIds: string[] = [];

      if (activeSession.groupId) {
        const group = getGroupById(activeSession.groupId);
        if (group?.members) {
          for (const member of group.members) {
            sessionCharIds.push(member.characterId);
          }
        }
      } else if (activeSession.characterId) {
        sessionCharIds.push(activeSession.characterId);
      }

      for (const charId of sessionCharIds) {
        const char = getCharacterById(charId);
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

  // Persona items - compute from persona.inventoryItems + items registry
  const personaInventoryItems = persona?.inventoryItems;
  const personaItems = useMemo(() => {
    if (!personaId || !personaInventoryItems) return EMPTY_ITEMS;
    return personaInventoryItems
      .map(entry => {
        const item = items.find(i => i.id === entry.itemId);
        return item ? { entry, item } : null;
      })
      .filter((r): r is { entry: PersonaInventoryEntry; item: Item } => r !== null);
  }, [personaId, personaInventoryItems, items]);

  // Get session equipment (per-session equipped state)
  const sessionEquipment = useMemo(
    () => activeSessionId ? getSessionEquipment(activeSessionId) : [],
    [activeSessionId, sessions, getSessionEquipment]
  );

  const equippedItems = useMemo(
    () => personaItems.filter(({ item }) =>
      sessionEquipment.some(se => se.itemId === item.id)
    ),
    [personaItems, sessionEquipment]
  );

  // Active effects for this persona
  const activeEffects = useMemo(
    () => activeConsumableEffects.filter(e => e.personaId === personaId),
    [activeConsumableEffects, personaId]
  );

  // Shop items
  const shopItems = useMemo(() => items.filter(item => (item.price ?? 0) > 0), [items]);

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

    // If item has multiple slot effects, show slot picker dialog
    if (item.slotEffects && item.slotEffects.length > 1) {
      setSlotPickerItemId(itemId);
      setSlotPickerOpen(true);
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

  // Export all items to JSON file
  const handleExportItems = () => {
    try {
      const inventoryData = exportInventory();
      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        type: 'inventory',
        data: inventoryData,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tavernflow-items-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Items exportados',
        description: `${inventoryData.items.length} items exportados correctamente.`,
      });
    } catch {
      toast({
        title: 'Error al exportar',
        description: 'No se pudieron exportar los items.',
        variant: 'destructive',
      });
    }
  };

  // Import items from JSON file
  const handleImportItems = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const imported = JSON.parse(content);

        if (!imported.data) {
          throw new Error('Formato de archivo inválido');
        }

        const { data } = imported;
        importInventory({
          items: data.items,
          activeEffects: data.activeEffects,
          settings: data.settings,
          dynamicEquipmentState: data.dynamicEquipmentState,
        });

        const itemCount = data.items?.length ?? 0;
        toast({
          title: 'Items importados',
          description: `${itemCount} items importados correctamente.`,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error desconocido';
        toast({
          title: 'Error al importar',
          description: `No se pudo importar: ${msg}`,
          variant: 'destructive',
        });
      }
    };
    reader.readAsText(file);

    if (itemFileInputRef.current) {
      itemFileInputRef.current.value = '';
    }
  };

  // ---- Slot handlers ----
  const keyManuallyEditedRef = useRef(false);

  const generateKeyFromName = (name: string): string => {
    return name
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s_]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {
      // Fallback: use a temporary textarea
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    });
  };

  const handleSaveSlot = () => {
    if (!slotForm.name.trim() || !slotForm.key.trim()) {
      toast({
        title: 'Campos requeridos',
        description: 'Nombre y Key son obligatorios.',
        variant: 'destructive',
      });
      return;
    }

    // Validate key format
    if (!/^[a-z][a-z0-9_]*$/.test(slotForm.key)) {
      toast({
        title: 'Key inválida',
        description: 'La key debe empezar con letra y solo contener letras minúsculas, números y guiones bajos.',
        variant: 'destructive',
      });
      return;
    }

    // Check for duplicate keys (excluding current editing slot)
    const duplicateKey = equipmentSlots.some(
      s => s.key === slotForm.key && (!editingSlot || s.id !== editingSlot.id)
    );
    if (duplicateKey) {
      toast({
        title: 'Key duplicada',
        description: `Ya existe un slot con la key "{{${slotForm.key}}}".`,
        variant: 'destructive',
      });
      return;
    }

    if (editingSlot) {
      updateEquipmentSlot(editingSlot.id, {
        name: slotForm.name.trim(),
        key: slotForm.key.trim(),
        icon: slotForm.icon || undefined,
        description: slotForm.description.trim() || undefined,
      });
      toast({
        title: 'Slot actualizado',
        description: `"${slotForm.name}" actualizado correctamente.`,
      });
    } else {
      addEquipmentSlot({
        name: slotForm.name.trim(),
        key: slotForm.key.trim(),
        icon: slotForm.icon || undefined,
        description: slotForm.description.trim() || undefined,
      });
      toast({
        title: 'Slot creado',
        description: `"${slotForm.name}" creado correctamente.`,
      });
    }

    setSlotEditorOpen(false);
    setEditingSlot(null);
    keyManuallyEditedRef.current = false;
  };

  const handleDeleteSlot = (id: string, name: string) => {
    deleteEquipmentSlot(id);
    toast({
      title: 'Slot eliminado',
      description: `"${name}" ha sido eliminado. Los items que usaban este slot han sido actualizados.`,
    });
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
          onClick={() => { setEditingItem(null); editorNonceRef.current++; setEditorOpen(true); }}
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
            <TabsTrigger value="slots" className="flex-1 text-xs">
              Slots
            </TabsTrigger>
            <TabsTrigger value="config" className="flex-1 text-xs">
              Config
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ===== Inventario Tab ===== */}
        <TabsContent value="inventory" className="flex-1 overflow-hidden m-0">
          <div className="h-full flex flex-col p-3 gap-3 overflow-hidden">
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
            <ScrollArea className="flex-1 min-h-0">
              {filteredPersonaItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="w-16 h-16 mx-auto mb-3 opacity-50" />
                  <p className="text-lg font-medium">Inventario vacío</p>
                  <p className="text-sm mt-1">Los items aparecerán aquí cuando los obtengas</p>
                </div>
              ) : (
                <div className="grid gap-2 pr-3">
                  <AnimatePresence mode="popLayout">
                    {filteredPersonaItems.map(({ entry, item }) => {
                      const isEquippedInSession = sessionEquipment.some(se => se.itemId === item.id);
                      return (
                      <motion.div
                        key={entry.itemId}
                        layout
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                      >
                        <ItemCard
                          item={item}
                          entry={{ ...entry, equipped: isEquippedInSession }}
                          showQuantity
                          showActions
                          equipmentSlots={equipmentSlots}
                          onUse={item.type === 'consumable' ? () => handleUseConsumable(item.id) : undefined}
                          onEquip={item.type === 'equipment' && !isEquippedInSession ? () => handleEquipItem(item.id) : undefined}
                          onUnequip={item.type === 'equipment' && isEquippedInSession ? () => handleUnequipItem(item.id) : undefined}
                          onRemove={() => handleRemoveFromPersona(item.id)}
                          onEdit={() => { setEditingItem(item); editorNonceRef.current++; setEditorOpen(true); }}
                        />
                      </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </ScrollArea>
          </div>
        </TabsContent>

        {/* ===== Registro Tab ===== */}
        <TabsContent value="registry" className="flex-1 overflow-hidden m-0">
          <div className="h-full flex flex-col p-3 gap-3 overflow-hidden">
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

            <ScrollArea className="flex-1 min-h-0">
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
          <div className="h-full flex flex-col p-3 gap-3 overflow-hidden">
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

            <ScrollArea className="flex-1 min-h-0">
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

        {/* ===== Slots Tab ===== */}
        <TabsContent value="slots" className="flex-1 overflow-hidden m-0">
          <div className="h-full flex flex-col p-3 gap-3 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Shirt className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">Slots de Equipo</h3>
                <Badge variant="secondary" className="text-xs">{equipmentSlots.length}</Badge>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setEditingSlot(null);
                  setSlotForm({ name: '', key: '', icon: '', description: '' });
                  keyManuallyEditedRef.current = false;
                  setSlotEditorOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-1" />
                Nuevo
              </Button>
            </div>

            {/* Info text */}
            <div className="p-2.5 rounded-lg bg-muted/50 text-xs text-muted-foreground shrink-0">
              Los slots definen las ubicaciones donde se puede equipar un item. Cada slot genera una key (ej: {'{{cabeza}}'}) que se puede usar en los prompts.
            </div>

            {/* Slots List */}
            <ScrollArea className="flex-1 min-h-0">
              {equipmentSlots.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Shirt className="w-16 h-16 mx-auto mb-3 opacity-50" />
                  <p className="text-lg font-medium">Sin slots definidos</p>
                  <p className="text-sm mt-1">Crea slots como Cabeza, Pecho, Mano Izquierda, etc.</p>
                </div>
              ) : (
                <div className="grid gap-2 pr-3">
                  <AnimatePresence mode="popLayout">
                    {equipmentSlots.map(slot => (
                      <motion.div
                        key={slot.id}
                        layout
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                      >
                        <div className="flex items-center gap-2.5 p-2.5 rounded-lg border bg-card">
                          {/* Icon */}
                          <div className="w-8 h-8 rounded-md flex items-center justify-center text-base shrink-0 bg-muted/50">
                            {slot.icon || '📦'}
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{slot.name}</p>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <code className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">{'{{' + slot.key + '}}'}</code>
                              {slot.description && (
                                <>
                                  <span>•</span>
                                  <span className="truncate">{slot.description}</span>
                                </>
                              )}
                            </div>
                          </div>
                          {/* Actions */}
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => {
                                copyToClipboard('{{' + slot.key + '}}');
                                toast({ title: 'Key copiada', description: `{{${slot.key}}} copiada al portapapeles` });
                              }}
                              title="Copiar key"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => {
                                setEditingSlot(slot);
                                setSlotForm({
                                  name: slot.name,
                                  key: slot.key,
                                  icon: slot.icon || '',
                                  description: slot.description || '',
                                });
                                setSlotEditorOpen(true);
                              }}
                              title="Editar slot"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteSlot(slot.id, slot.name)}
                              title="Eliminar slot"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
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
                      Usar la key {'{{slots}}'} en las secciones del personaje para mostrar equipo y efectos
                    </p>
                  </div>
                  <Switch
                    checked={inventorySettings.promptInclude}
                    onCheckedChange={(v) => setInventorySettings({ promptInclude: v })}
                  />
                </div>

                <div className="p-2.5 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-1.5">
                  <p className="font-medium text-foreground">Keys disponibles:</p>
                  <p><code className="px-1 py-0.5 rounded bg-muted font-mono">{'{{slots}}'}</code> — Lista de slots de equipo y efectos de consumibles activos</p>
                  <p><code className="px-1 py-0.5 rounded bg-muted font-mono">{'{{currency}}'}</code> — Muestra la divisa actual</p>
                  <p className="pt-1">Puedes colocar {'{{slots}}'} en cualquier sección del personaje (descripción, escenario, system prompt, etc.)</p>
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

              <Separator />

              {/* Export / Import Items */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">Exportar / Importar Items</h3>
                <p className="text-xs text-muted-foreground">
                  Exporta todos los items, efectos activos y configuración del inventario a un archivo JSON, o impórtalos desde un archivo previamente exportado.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="h-auto py-3 flex flex-col gap-1.5"
                    onClick={handleExportItems}
                  >
                    <Download className="w-4 h-4" />
                    <span className="text-sm">Exportar Items</span>
                    <span className="text-[10px] text-muted-foreground">{items.length} items</span>
                  </Button>
                  <label className="cursor-pointer">
                    <Button
                      variant="outline"
                      className="h-auto py-3 flex flex-col gap-1.5 w-full"
                      asChild
                    >
                      <span>
                        <Upload className="w-4 h-4" />
                        <span className="text-sm">Importar Items</span>
                        <span className="text-[10px] text-muted-foreground">Desde JSON</span>
                      </span>
                    </Button>
                    <input
                      ref={itemFileInputRef}
                      type="file"
                      accept=".json"
                      onChange={handleImportItems}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">
                      Importar items reemplazará los items y efectos activos existentes. La configuración del inventario también se sobreescribirá si está incluida en el archivo.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Item Editor Dialog */}
      <ItemEditor
        key={`${editingItem?.id ?? 'new'}-${editorNonceRef.current}`}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        item={editingItem}
        onSave={editingItem ? handleUpdateItem : handleCreateItem}
        onDelete={editingItem ? handleDeleteItem : undefined}
      />

      {/* Slot Editor Dialog */}
      <Dialog open={slotEditorOpen} onOpenChange={setSlotEditorOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSlot ? 'Editar Slot' : 'Crear Nuevo Slot'}</DialogTitle>
            <DialogDescription>Define una ubicación de equipo para los items.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={slotForm.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setSlotForm(prev => ({
                    ...prev,
                    name,
                    // Auto-generate key from name unless user manually edited the key
                    key: keyManuallyEditedRef.current ? prev.key : generateKeyFromName(name),
                  }));
                }}
                placeholder="Ej: Cabeza, Mano Izquierda"
              />
            </div>
            {/* Key */}
            <div className="space-y-2">
              <Label>Key *</Label>
              <p className="text-xs text-muted-foreground">Se usará como {'{{key}}'} en los prompts</p>
              <Input
                value={slotForm.key}
                onChange={(e) => {
                  keyManuallyEditedRef.current = true;
                  setSlotForm(prev => ({ ...prev, key: e.target.value }));
                }}
                placeholder="Ej: cabeza, mano_izquierda"
                className="font-mono"
              />
            </div>
            {/* Icon */}
            <div className="space-y-2">
              <Label>Icono</Label>
              <div className="flex gap-2 items-center">
                <Input
                  value={slotForm.icon}
                  onChange={(e) => setSlotForm(prev => ({ ...prev, icon: e.target.value }))}
                  placeholder="🪖"
                  className="w-16 text-center text-xl"
                  maxLength={4}
                />
                <div className="flex flex-wrap gap-1">
                  {SLOT_EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      className={cn(
                        'w-7 h-7 rounded-md border text-sm flex items-center justify-center transition-colors',
                        slotForm.icon === emoji
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:bg-muted/50'
                      )}
                      onClick={() => setSlotForm(prev => ({ ...prev, icon: emoji }))}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {/* Description */}
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input
                value={slotForm.description}
                onChange={(e) => setSlotForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descripción opcional del slot"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSlotEditorOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveSlot}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Slot Picker Dialog - shown when equipping an item with multiple slot effects */}
      <Dialog open={slotPickerOpen} onOpenChange={setSlotPickerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Seleccionar Slot</DialogTitle>
            <DialogDescription>
              Este item tiene efectos para distintos slots. ¿En qué slot deseas equiparlo?
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const item = items.find(i => i.id === slotPickerItemId);
            if (!item) return null;
            return (
              <div className="space-y-2">
                {item.slotEffects?.map((slotEffect, idx) => {
                  const slotDef = equipmentSlots.find(s => s.id === slotEffect.slotId);
                  if (!slotDef) return null;
                  const isOccupied = sessionEquipment.some(se => se.equippedSlotId === slotDef.id && se.itemId !== slotPickerItemId);
                  return (
                    <button
                      key={slotEffect.slotId}
                      className="w-full rounded-lg border p-3 text-left hover:bg-accent transition-colors"
                      onClick={() => {
                        if (personaId) {
                          equipItemToSlot(personaId, slotPickerItemId, slotDef.id);
                        }
                        setSlotPickerOpen(false);
                        setSlotPickerItemId('');
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{slotDef.icon || '📦'}</span>
                        <span className="font-medium text-sm">{slotDef.name}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono">
                          {`{{${slotDef.key}}}`}
                        </Badge>
                        {isOccupied && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                            Ocupado
                          </Badge>
                        )}
                      </div>
                      {slotEffect.effectText && (
                        <p className="text-xs text-muted-foreground mt-1 pl-7">
                          {slotEffect.effectText}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })()}
          <div className="flex justify-end pt-2 border-t">
            <Button variant="outline" onClick={() => { setSlotPickerOpen(false); setSlotPickerItemId(''); }}>
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default InventoryPanel;
