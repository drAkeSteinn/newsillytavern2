'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { useTavernStore } from '@/store/tavern-store';
import type {
  Item,
  ItemRarity,
  ItemAttributeEffect,
  ItemSlotEffect,
  EquipmentSlotDefinition,
  InventoryItemType,
} from '@/types';
import {
  getRarityColor,
  createConsumableItem,
  createEquipmentItem,
} from '@/store/slices/inventorySlice';

// ============================================
// Constants
// ============================================

const RARITIES: ItemRarity[] = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
  'unique',
  'cursed',
];

const RARITY_LABELS: Record<ItemRarity, string> = {
  common: 'Común',
  uncommon: 'Poco común',
  rare: 'Raro',
  epic: 'Épico',
  legendary: 'Legendario',
  unique: 'Único',
  cursed: 'Maldito',
};

const ITEM_TYPES: { value: InventoryItemType; label: string }[] = [
  { value: 'consumable', label: 'Consumible' },
  { value: 'equipment', label: 'Equipo' },
];

// Common emojis for the emoji picker
const COMMON_EMOJIS = [
  '⚔️', '🛡️', '🧪', '📜', '🗡️', '🏹', '💎', '🔥', '❄️', '⚡',
  '💊', '🧲', '🎯', '🎪', '🪄', '🧬', '💰', '🗝️', '🛡️', '👑',
  '🧥', '🥾', '🧤', '💍', '📿', '🎸', '🔮', '🍷', '🍖', '🍞',
];

// ============================================
// Get initial state from item
// ============================================

interface EditorState {
  name: string;
  description: string;
  type: InventoryItemType;
  rarity: ItemRarity;
  icon: string;
  price: string;
  attributeEffects: ItemAttributeEffect[]; // Kept for backward compatibility
  slotEffects: ItemSlotEffect[];
  consumableEffect: string;               // Free-text effect for consumables
  useMessage: string;
  expireMessage: string;
  unequipMessage: string;
  duration: string;
  slot: string; // Slot ID (references EquipmentSlotDefinition.id or legacy ItemSlot)
  stackable: boolean;
  maxStack: string;
  triggerKeywords: string;
  contextKeys: string;
  tags: string;
}

function getInitialState(item: Item | null | undefined): EditorState {
  return {
    name: item?.name ?? '',
    description: item?.description ?? '',
    type: item?.type ?? 'consumable',
    rarity: item?.rarity ?? 'common',
    icon: item?.icon ?? (item?.type === 'equipment' ? '⚔️' : '🧪'),
    price: item?.price?.toString() ?? '',
    attributeEffects: item?.attributeEffects ?? [],
    slotEffects: item?.slotEffects ?? [],
    consumableEffect: item?.consumableEffect ?? '',
    useMessage: item?.useMessage ?? '',
    expireMessage: item?.expireMessage ?? '',
    unequipMessage: item?.unequipMessage ?? '',
    duration: item?.duration?.toString() ?? '1',
    slot: item?.slot ?? 'main_hand',
    stackable: item?.stackable ?? (item?.type === 'consumable'),
    maxStack: item?.maxStack?.toString() ?? (item?.type === 'consumable' ? '99' : '1'),
    triggerKeywords: item?.triggerKeywords?.join(', ') ?? '',
    contextKeys: item?.contextKeys?.join(', ') ?? '',
    tags: item?.tags?.join(', ') ?? '',
  };
}

// ============================================
// Stable empty array to avoid infinite re-render
// (must be outside component so reference is stable)
// ============================================

const EMPTY_EQUIPMENT_SLOTS: EquipmentSlotDefinition[] = [];

// ============================================
// Item Editor Component
// ============================================

interface ItemEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Item | null;
  onSave: (item: Item) => void;
  onDelete?: () => void;
}

export function ItemEditor({ open, onOpenChange, item, onSave, onDelete }: ItemEditorProps) {
  const initialState = useMemo(() => getInitialState(item), [item]);
  const [state, setState] = useState<EditorState>(initialState);

  // User-defined equipment slots from store
  // IMPORTANT: Use stable empty array outside selector to avoid getSnapshot infinite loop
  const equipmentSlots = useTavernStore(state => state.inventorySettings.equipmentSlots) ?? EMPTY_EQUIPMENT_SLOTS;

  // Available slots (not already used in slotEffects)
  const availableSlots = useMemo(() => {
    const usedSlotIds = new Set(state.slotEffects.map(se => se.slotId));
    return equipmentSlots.filter((s: EquipmentSlotDefinition) => !usedSlotIds.has(s.id));
  }, [equipmentSlots, state.slotEffects]);

  // Handle dialog open/close changes from user interactions
  const handleOpenChange = useCallback((isOpen: boolean) => {
    onOpenChange(isOpen);
  }, [onOpenChange]);

  const update = <K extends keyof EditorState>(key: K, value: EditorState[K]) => {
    setState(prev => ({ ...prev, [key]: value }));
  };

  const handleTypeChange = (newType: InventoryItemType) => {
    setState(prev => ({
      ...prev,
      type: newType,
      icon: newType === 'consumable' ? '🧪' : '⚔️',
      stackable: newType === 'consumable',
      maxStack: newType === 'consumable' ? '99' : '1',
      duration: newType === 'consumable' ? '1' : '',
      // Clear type-specific fields when switching types
      slotEffects: newType === 'consumable' ? [] : prev.slotEffects,
      consumableEffect: newType === 'equipment' ? '' : prev.consumableEffect,
      unequipMessage: newType === 'consumable' ? '' : prev.unequipMessage,
      expireMessage: newType === 'equipment' ? '' : prev.expireMessage,
    }));
  };

  // Slot effect management
  const addSlotEffect = () => {
    if (availableSlots.length === 0) return;
    const firstSlot = availableSlots[0];
    setState(prev => ({
      ...prev,
      slotEffects: [
        ...prev.slotEffects,
        {
          slotId: firstSlot.id,
          slotName: firstSlot.name,
          effectText: '',
        },
      ],
    }));
  };

  const updateSlotEffect = (index: number, updates: Partial<ItemSlotEffect>) => {
    setState(prev => ({
      ...prev,
      slotEffects: prev.slotEffects.map((se, i) =>
        i === index ? { ...se, ...updates } : se
      ),
    }));
  };

  const removeSlotEffect = (index: number) => {
    setState(prev => ({
      ...prev,
      slotEffects: prev.slotEffects.filter((_, i) => i !== index),
    }));
  };

  // Save handler - use factory functions
  const handleSave = () => {
    if (!state.name.trim()) return;

    const triggerKeywordsList = state.triggerKeywords.trim()
      ? state.triggerKeywords.split(',').map(k => k.trim()).filter(Boolean)
      : undefined;

    const contextKeysList = state.contextKeys.trim()
      ? state.contextKeys.split(',').map(k => k.trim()).filter(Boolean)
      : undefined;

    const tagsList = state.tags.trim()
      ? state.tags.split(',').map(t => t.trim()).filter(Boolean)
      : undefined;

    const price = state.price ? parseInt(state.price) : undefined;

    if (state.type === 'consumable') {
      const newItem = createConsumableItem(state.name.trim(), {
        description: state.description.trim(),
        rarity: state.rarity,
        icon: state.icon || undefined,
        duration: parseInt(state.duration) || 1,
        attributeEffects: state.attributeEffects,
        slotEffects: state.slotEffects,
        consumableEffect: state.consumableEffect.trim() || undefined,
        useMessage: state.useMessage.trim() || undefined,
        expireMessage: state.expireMessage.trim() || undefined,
        price,
        triggerKeywords: triggerKeywordsList,
        contextKeys: contextKeysList,
        tags: tagsList,
        stackable: state.stackable,
        maxStack: parseInt(state.maxStack) || 99,
      });
      // If editing, preserve the id and timestamps
      if (item) {
        onSave({ ...newItem, id: item.id, createdAt: item.createdAt, updatedAt: item.updatedAt });
      } else {
        onSave(newItem);
      }
    } else {
      const newItem = createEquipmentItem(state.name.trim(), {
        description: state.description.trim(),
        rarity: state.rarity,
        icon: state.icon || undefined,
        slot: state.slot || undefined,
        attributeEffects: state.attributeEffects,
        slotEffects: state.slotEffects,
        useMessage: state.useMessage.trim() || undefined,
        unequipMessage: state.unequipMessage.trim() || undefined,
        price,
        triggerKeywords: triggerKeywordsList,
        contextKeys: contextKeysList,
        tags: tagsList,
      });
      if (item) {
        onSave({ ...newItem, id: item.id, createdAt: item.createdAt, updatedAt: item.updatedAt });
      } else {
        onSave(newItem);
      }
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {item ? 'Editar Item' : 'Crear Nuevo Item'}
          </DialogTitle>
          <DialogDescription>
            Define las propiedades del item para el sistema de inventario.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-4 w-full shrink-0">
            <TabsTrigger value="basic">Básico</TabsTrigger>
            <TabsTrigger value="effects">Efectos</TabsTrigger>
            <TabsTrigger value="messages">Mensajes</TabsTrigger>
            <TabsTrigger value="config">Config</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            {/* ===== Basic Tab ===== */}
            <TabsContent value="basic" className="space-y-4 mt-0">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="item-name">Nombre *</Label>
                <Input
                  id="item-name"
                  value={state.name}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder="Espada del Destino"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="item-description">Descripción</Label>
                <Textarea
                  id="item-description"
                  value={state.description}
                  onChange={(e) => update('description', e.target.value)}
                  placeholder="Una espada legendaria forjada en los fuegos del monte destino..."
                  rows={3}
                />
              </div>

              {/* Type & Rarity */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={state.type} onValueChange={(v) => handleTypeChange(v as InventoryItemType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ITEM_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.value === 'consumable' ? '🧪' : '⚔️'} {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Rareza</Label>
                  <Select value={state.rarity} onValueChange={(v) => update('rarity', v as ItemRarity)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RARITIES.map(r => (
                        <SelectItem key={r} value={r}>
                          <span className={getRarityColor(r)}>{RARITY_LABELS[r]}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Icon & Price */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Icono (emoji)</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      value={state.icon}
                      onChange={(e) => update('icon', e.target.value)}
                      placeholder="⚔️"
                      className="w-16 text-center text-xl"
                      maxLength={4}
                    />
                    <div className="flex flex-wrap gap-1">
                      {COMMON_EMOJIS.slice(0, 8).map(emoji => (
                        <Button
                          key={emoji}
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-base"
                          onClick={() => update('icon', emoji)}
                        >
                          {emoji}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="item-price">Precio (tienda)</Label>
                  <Input
                    id="item-price"
                    type="number"
                    value={state.price}
                    onChange={(e) => update('price', e.target.value)}
                    placeholder="0 = no vendible"
                    min="0"
                  />
                </div>
              </div>
            </TabsContent>

            {/* ===== Effects Tab ===== */}
            <TabsContent value="effects" className="space-y-4 mt-0">

              {/* ---- Consumable: simple effect text ---- */}
              {state.type === 'consumable' && (
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-sm">Efecto del Consumible</h4>
                    <p className="text-xs text-muted-foreground">
                      Describe qué efecto causa al usar este consumible
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="consumable-effect">Efecto</Label>
                    <Textarea
                      id="consumable-effect"
                      value={state.consumableEffect}
                      onChange={(e) => update('consumableEffect', e.target.value)}
                      placeholder="Describe el efecto del consumible... (ej: +10 vida, restaura 20 de maná, curación de veneno)"
                      rows={4}
                      className="resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      Este texto se incluirá en el contexto cuando el consumible esté activo.
                    </p>
                  </div>

                  {/* Info about old effects for backward compat */}
                  {state.attributeEffects && state.attributeEffects.length > 0 && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">
                          Este item tiene efectos heredados del sistema anterior. El nuevo campo de efecto reemplaza el sistema de objetivo+atributo.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ---- Equipment: slot-based effects ---- */}
              {state.type === 'equipment' && (
                <>
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-semibold text-sm">Efectos por Slot</h4>
                      <p className="text-xs text-muted-foreground">
                        Define qué efecto causa el item según el slot donde se equipe
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={addSlotEffect} disabled={availableSlots.length === 0}>
                      <Plus className="w-4 h-4 mr-1" />
                      Agregar Slot
                    </Button>
                  </div>

                  {equipmentSlots.length === 0 ? (
                    <div className="text-center py-6 space-y-2">
                      <p className="text-sm text-amber-600">No hay slots de equipo configurados</p>
                      <p className="text-xs text-muted-foreground">
                        Ve a la sección de Inventario → Slots para crear slots de equipo primero.
                      </p>
                    </div>
                  ) : state.slotEffects.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Sin efectos definidos. Agrega slots para definir los efectos del item.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {state.slotEffects.map((slotEffect, index) => {
                        const slotDef = equipmentSlots.find((s: EquipmentSlotDefinition) => s.id === slotEffect.slotId);
                        if (!slotDef) return null; // Slot was deleted

                        return (
                          <div key={index} className="rounded-lg border overflow-hidden">
                            {/* Header with slot info */}
                            <div className="flex items-center justify-between px-3 py-1.5 bg-orange-500/10 border-b border-orange-500/20">
                              <div className="flex items-center gap-2">
                                <span className="text-base">{slotDef.icon || '📦'}</span>
                                <span className="text-xs font-medium text-orange-700">{slotDef.name}</span>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-mono">
                                  {'{{'}{slotDef.key}{'}}'}
                                </Badge>
                              </div>
                              <Button variant="ghost" size="icon" className="shrink-0 h-6 w-6" onClick={() => removeSlotEffect(index)}>
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            </div>

                            <div className="p-3 space-y-3 bg-muted/30">
                              {/* Slot selector (in case user wants to change the slot) */}
                              <Select
                                value={slotEffect.slotId}
                                onValueChange={(v) => {
                                  const newSlot = equipmentSlots.find((s: EquipmentSlotDefinition) => s.id === v);
                                  updateSlotEffect(index, { slotId: v, slotName: newSlot?.name || v });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccionar slot..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {equipmentSlots.map((s: EquipmentSlotDefinition) => (
                                    <SelectItem key={s.id} value={s.id}>
                                      {s.icon || '📦'} {s.name} ({`{{${s.key}}}`})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              {/* Effect text - the main content */}
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Efecto</Label>
                                <Textarea
                                  value={slotEffect.effectText}
                                  onChange={(e) => updateSlotEffect(index, { effectText: e.target.value })}
                                  placeholder="Describe el efecto cuando se equipa en este slot... (ej: +10 ataque, Maldición: -5 vida por turno)"
                                  rows={2}
                                  className="resize-none"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Info about old effects for backward compat */}
                  {state.attributeEffects && state.attributeEffects.length > 0 && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">
                          Este item tiene efectos heredados del sistema anterior. Los nuevos efectos por slot reemplazan el sistema de objetivo+atributo.
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {/* ===== Messages Tab ===== */}
            <TabsContent value="messages" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Label htmlFor="use-message">Mensaje al usar</Label>
                <p className="text-xs text-muted-foreground">
                  Texto mostrado cuando se usa o equipa el item
                  {state.type === 'equipment' && (
                    <> — usa <code className="text-primary font-mono text-[10px] bg-primary/10 px-1 rounded">{'{{slot}}'}</code> para insertar el nombre del slot</>
                  )}
                </p>
                <Textarea
                  id="use-message"
                  value={state.useMessage}
                  onChange={(e) => update('useMessage', e.target.value)}
                  placeholder="Equipaste la Espada del Destino"
                  rows={2}
                />
              </div>

              <Separator />

              {state.type === 'consumable' && (
                <div className="space-y-2">
                  <Label htmlFor="expire-message">Mensaje al expirar</Label>
                  <p className="text-xs text-muted-foreground">
                    Texto mostrado cuando el efecto del consumible expira
                  </p>
                  <Textarea
                    id="expire-message"
                    value={state.expireMessage}
                    onChange={(e) => update('expireMessage', e.target.value)}
                    placeholder="El efecto de la poción ha expirado"
                    rows={2}
                  />
                </div>
              )}

              {state.type === 'equipment' && (
                <div className="space-y-2">
                  <Label htmlFor="unequip-message">Mensaje al desequipar</Label>
                  <p className="text-xs text-muted-foreground">
                    Texto mostrado cuando se desequipa el item — usa <code className="text-primary font-mono text-[10px] bg-primary/10 px-1 rounded">{'{{slot}}'}</code> para insertar el nombre del slot
                  </p>
                  <Textarea
                    id="unequip-message"
                    value={state.unequipMessage}
                    onChange={(e) => update('unequipMessage', e.target.value)}
                    placeholder="Desequipaste la Espada del Destino"
                    rows={2}
                  />
                </div>
              )}
            </TabsContent>

            {/* ===== Config Tab ===== */}
            <TabsContent value="config" className="space-y-4 mt-0">
              {state.type === 'consumable' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duración (turnos)</Label>
                    <p className="text-xs text-muted-foreground">
                      Cuántos turnos dura el efecto del consumible
                    </p>
                    <Input
                      id="duration"
                      type="number"
                      value={state.duration}
                      onChange={(e) => update('duration', e.target.value)}
                      min="1"
                      className="w-32"
                    />
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={state.stackable}
                        onCheckedChange={(v) => update('stackable', v)}
                      />
                      <Label>Apilable</Label>
                    </div>

                    {state.stackable && (
                      <div className="flex items-center gap-2 ml-6">
                        <Label className="text-muted-foreground text-sm">Máximo:</Label>
                        <Input
                          type="number"
                          value={state.maxStack}
                          onChange={(e) => update('maxStack', e.target.value)}
                          className="w-20"
                          min="1"
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              <Separator />

              {/* Trigger Keywords */}
              <div className="space-y-2">
                <Label>Keywords de Trigger</Label>
                <p className="text-xs text-muted-foreground">
                  Palabras clave que detectan este item en los mensajes (separadas por coma)
                </p>
                <Input
                  value={state.triggerKeywords}
                  onChange={(e) => update('triggerKeywords', e.target.value)}
                  placeholder="espada del destino, legendary sword"
                />
              </div>

              <div className="space-y-2">
                <Label>Keywords de Contexto</Label>
                <p className="text-xs text-muted-foreground">
                  Keywords adicionales que TAMBIÉN deben estar presentes (separadas por coma)
                </p>
                <Input
                  value={state.contextKeys}
                  onChange={(e) => update('contextKeys', e.target.value)}
                  placeholder="encuentras, obtienes"
                />
              </div>

              <div className="space-y-2">
                <Label>Tags</Label>
                <p className="text-xs text-muted-foreground">
                  Tags para organización y búsqueda (separados por coma)
                </p>
                <Input
                  value={state.tags}
                  onChange={(e) => update('tags', e.target.value)}
                  placeholder="arma, legendario, fuego"
                />
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="gap-2 mt-auto pt-4 border-t shrink-0">
          {item && onDelete && (
            <Button variant="destructive" onClick={onDelete}>
              Eliminar
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!state.name.trim()}>
            {item ? 'Guardar' : 'Crear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ItemEditor;
