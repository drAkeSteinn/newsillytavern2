'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
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
import { Plus, Trash2 } from 'lucide-react';
import { useTavernStore } from '@/store/tavern-store';
import type {
  Item,
  ItemRarity,
  ItemSlot,
  ItemAttributeEffect,
  InventoryItemType,
  CostOperator,
  AttributeDefinition,
  AttributeType,
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

const EQUIPMENT_SLOTS: ItemSlot[] = [
  'main_hand',
  'off_hand',
  'head',
  'chest',
  'legs',
  'feet',
  'hands',
  'accessory1',
  'accessory2',
  'back',
];

const SLOT_LABELS: Record<string, string> = {
  main_hand: 'Mano Principal',
  off_hand: 'Mano Secundaria',
  head: 'Cabeza',
  chest: 'Pecho',
  legs: 'Piernas',
  feet: 'Pies',
  hands: 'Manos',
  accessory1: 'Accesorio 1',
  accessory2: 'Accesorio 2',
  back: 'Espalda',
};

// Target options are built dynamically - see useTargetOptions hook below

function useTargetOptions() {
  const characters = useTavernStore(state => state.characters);
  const activeSessionId = useTavernStore(state => state.activeSessionId);
  const sessions = useTavernStore(state => state.sessions);
  const getGroupById = useTavernStore(state => state.getGroupById);
  const getCharacterById = useTavernStore(state => state.getCharacterById);

  return useMemo(() => {
    const options = [{ value: '__user__', label: 'Persona (usuario)' }];

    // Get characters from the active session
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
          options.push({
            value: char.id,
            label: char.name || 'Personaje',
          });
        }
      }
    } else {
      for (const char of characters) {
        options.push({
          value: char.id,
          label: char.name || 'Personaje',
        });
      }
    }

    return options;
  }, [characters, activeSessionId, sessions, getGroupById, getCharacterById]);
}

// Hook to get attributes for a specific target (persona or character)
function useTargetAttributes(targetId: string | undefined): AttributeDefinition[] {
  const characters = useTavernStore(state => state.characters);
  const personas = useTavernStore(state => state.personas);
  const activePersonaId = useTavernStore(state => state.activePersonaId);

  return useMemo(() => {
    if (!targetId) return [];

    if (targetId === '__user__') {
      // Get persona attributes
      const persona = personas.find((p: any) => p.id === activePersonaId);
      return persona?.statsConfig?.enabled ? (persona.statsConfig.attributes || []) : [];
    } else {
      // Get character attributes
      const char = characters.find(c => c.id === targetId);
      return char?.statsConfig?.enabled ? (char.statsConfig.attributes || []) : [];
    }
  }, [targetId, characters, personas, activePersonaId]);
}

// Operators filtered by attribute type
const OPERATORS_BY_TYPE: Record<AttributeType, { value: CostOperator; label: string }[]> = {
  number: [
    { value: '+', label: '+ (Sumar)' },
    { value: '-', label: '− (Restar)' },
    { value: '*', label: '× (Multiplicar)' },
    { value: '/', label: '÷ (Dividir)' },
    { value: '=', label: '= (Establecer)' },
    { value: 'set_min', label: 'Mínimo' },
    { value: 'set_max', label: 'Máximo' },
  ],
  text: [
    { value: '=', label: '= (Establecer)' },
  ],
  keyword: [
    { value: '=', label: '= (Establecer)' },
  ],
};

// Type label and icon for attributes
const ATTR_TYPE_INFO: Record<AttributeType, { label: string; icon: string }> = {
  number: { label: 'Numérico', icon: '🔢' },
  text: { label: 'Texto', icon: '📝' },
  keyword: { label: 'Keyword', icon: '🏷️' },
};

// All operators (fallback when no attribute type is known)
const ALL_OPERATORS: { value: CostOperator; label: string }[] = [
  { value: '+', label: '+ (Sumar)' },
  { value: '-', label: '− (Restar)' },
  { value: '*', label: '× (Multiplicar)' },
  { value: '/', label: '÷ (Dividir)' },
  { value: '=', label: '= (Establecer)' },
  { value: 'set_min', label: 'Mínimo' },
  { value: 'set_max', label: 'Máximo' },
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
  attributeEffects: ItemAttributeEffect[];
  useMessage: string;
  expireMessage: string;
  unequipMessage: string;
  duration: string;
  slot: ItemSlot;
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
  const itemKey = item?.id ?? 'new';
  const initialState = useMemo(() => getInitialState(item), [item]);
  const targetOptions = useTargetOptions();
  const [state, setState] = useState<EditorState>(initialState);

  // Reset state when the dialog opens or the item changes
  // This is needed because useState only uses its initial value on first render,
  // and handleOpenChange only fires for user interactions (not programmatic opens)
  useEffect(() => {
    if (open) {
      setState(getInitialState(item));
    }
  }, [item?.id, open]);

  // Get attributes for each unique target in effects
  // Cache attributes per targetId so dropdowns can show the right options
  const effectTargetIds = state.attributeEffects.map(e => e.targetId).join(',');
  const targetAttributesCache = useMemo(() => {
    const cache: Record<string, AttributeDefinition[]> = {};
    for (const effect of state.attributeEffects) {
      if (effect.targetId && !cache[effect.targetId]) {
        // Read directly from store for each unique target
        const store = useTavernStore.getState();
        if (effect.targetId === '__user__') {
          const persona = store.personas.find((p: any) => p.id === store.activePersonaId);
          cache[effect.targetId] = persona?.statsConfig?.enabled ? (persona.statsConfig.attributes || []) : [];
        } else {
          const char = store.characters.find(c => c.id === effect.targetId);
          cache[effect.targetId] = char?.statsConfig?.enabled ? (char.statsConfig.attributes || []) : [];
        }
      }
    }
    return cache;
  }, [effectTargetIds]);

  // Helper: get attribute type for a given target + attributeKey
  const getAttributeType = (targetId: string | undefined, attributeKey: string | undefined): AttributeType | undefined => {
    if (!targetId || !attributeKey) return undefined;
    const attrs = targetAttributesCache[targetId] || [];
    const attr = attrs.find(a => a.key === attributeKey);
    return attr?.type;
  };

  // Helper: get filtered operators for an attribute type
  const getFilteredOperators = (attrType: AttributeType | undefined) => {
    if (!attrType) return ALL_OPERATORS;
    return OPERATORS_BY_TYPE[attrType] || ALL_OPERATORS;
  };

  // Handle dialog open/close changes from user interactions
  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (isOpen) {
      setState(getInitialState(item));
    }
    onOpenChange(isOpen);
  }, [item, onOpenChange]);

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
    }));
  };

  // Effect management
  const addEffect = () => {
    setState(prev => ({
      ...prev,
      attributeEffects: [
        ...prev.attributeEffects,
        {
          targetId: '__user__',
          targetName: 'Persona',
          attributeKey: '',
          attributeName: '',
          operator: '+' as CostOperator,
          value: 0,
          mode: 'static' as const,
        },
      ],
    }));
  };

  const updateEffect = (index: number, updates: Partial<ItemAttributeEffect>) => {
    setState(prev => ({
      ...prev,
      attributeEffects: prev.attributeEffects.map((e, i) =>
        i === index ? { ...e, ...updates } : e
      ),
    }));
  };

  const removeEffect = (index: number) => {
    setState(prev => ({
      ...prev,
      attributeEffects: prev.attributeEffects.filter((_, i) => i !== index),
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
    <Dialog open={open} onOpenChange={handleOpenChange} key={itemKey}>
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
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-semibold text-sm">Efectos de Atributo</h4>
                  <p className="text-xs text-muted-foreground">
                    Define cómo el item modifica los atributos del objetivo
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={addEffect}>
                  <Plus className="w-4 h-4 mr-1" />
                  Agregar
                </Button>
              </div>

              {state.attributeEffects.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Sin efectos definidos. Agrega efectos para modificar atributos.
                </p>
              ) : (
                <div className="space-y-3">
                  {state.attributeEffects.map((effect, index) => {
                    const targetAttrs = targetAttributesCache[effect.targetId] || [];
                    const currentAttrType = getAttributeType(effect.targetId, effect.attributeKey);
                    const filteredOperators = getFilteredOperators(currentAttrType);
                    const isTextAttr = currentAttrType === 'text' || currentAttrType === 'keyword';
                    const attrTypeInfo = currentAttrType ? ATTR_TYPE_INFO[currentAttrType] : null;
                    const isDynamic = (effect.mode || 'static') === 'dynamic';

                    return (
                      <div key={index} className="p-3 bg-muted/50 rounded-lg space-y-2">
                        <div className="flex items-center gap-2">
                          {/* Target */}
                          <Select
                            value={effect.targetId}
                            onValueChange={(v) => {
                              const opt = targetOptions.find(o => o.value === v);
                              const targetName = opt?.label ?? (v === '__user__' ? 'Persona' : v);
                              // Reset attribute when changing target
                              updateEffect(index, { targetId: v, targetName, attributeKey: '', attributeName: '' });
                            }}
                          >
                            <SelectTrigger className="w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {targetOptions.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.value === '__user__' ? '👤' : '🎭'} {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {/* Attribute Key - Dropdown when target has attributes, free input otherwise */}
                          {targetAttrs.length > 0 ? (
                            <Select
                              value={effect.attributeKey}
                              onValueChange={(v) => {
                                const attr = targetAttrs.find(a => a.key === v);
                                updateEffect(index, {
                                  attributeKey: v,
                                  attributeName: attr?.name || v,
                                  // Auto-reset operator if current one isn't valid for the new type
                                  operator: attr?.type && attr.type !== 'number' && effect.operator !== '=' ? '=' as CostOperator : effect.operator,
                                });
                              }}
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Seleccionar atributo..." />
                              </SelectTrigger>
                              <SelectContent>
                                {targetAttrs.map(attr => (
                                  <SelectItem key={attr.key} value={attr.key}>
                                    <span className="flex items-center gap-1.5">
                                      <span className="text-xs">{ATTR_TYPE_INFO[attr.type]?.icon || '📊'}</span>
                                      <span>{attr.icon ? `${attr.icon} ` : ''}{attr.name}</span>
                                      <span className="text-muted-foreground text-xs">({attr.key})</span>
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              value={effect.attributeKey}
                              onChange={(e) => updateEffect(index, {
                                attributeKey: e.target.value,
                                attributeName: e.target.value,
                              })}
                              placeholder="atributo (ej: vida)"
                              className="flex-1"
                            />
                          )}

                          {/* Attribute type badge */}
                          {attrTypeInfo && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted whitespace-nowrap" title={`Tipo: ${attrTypeInfo.label}`}>
                              {attrTypeInfo.icon} {attrTypeInfo.label}
                            </span>
                          )}

                          {/* Delete */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0"
                            onClick={() => removeEffect(index)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Effect Mode */}
                          <Select
                            value={effect.mode || 'static'}
                            onValueChange={(v) => updateEffect(index, { mode: v as 'static' | 'dynamic' })}
                          >
                            <SelectTrigger className="w-[110px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="static">📌 Estático</SelectItem>
                              <SelectItem value="dynamic">🔄 Dinámico</SelectItem>
                            </SelectContent>
                          </Select>

                          {/* Operator - filtered by attribute type */}
                          <Select
                            value={effect.operator}
                            onValueChange={(v) => updateEffect(index, { operator: v as CostOperator })}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {filteredOperators.map(op => (
                                <SelectItem key={op.value} value={op.value}>
                                  {op.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {/* Value - number input for number attrs, text input for text/keyword attrs */}
                          {isTextAttr ? (
                            <Input
                              value={typeof effect.value === 'string' ? effect.value : String(effect.value)}
                              onChange={(e) => updateEffect(index, { value: e.target.value })}
                              className="flex-1"
                              placeholder={isDynamic ? "Valor1|Valor2|Valor3 (separa con |)" : "Valor de texto (ej: Poción de fuerza)"}
                            />
                          ) : (
                            <Input
                              type="number"
                              value={effect.value}
                              onChange={(e) => updateEffect(index, { value: parseFloat(e.target.value) || 0 })}
                              className="w-24"
                              placeholder="Valor"
                            />
                          )}
                        </div>

                        {/* Dynamic mode hints */}
                        {isDynamic && (
                          <div className="text-xs text-muted-foreground space-y-1">
                            {isTextAttr ? (
                              <p>🔄 Usa <code className="bg-muted px-1 rounded">|</code> para separar valores que ciclan cada turno. Ej: <code className="bg-muted px-1 rounded">Envenenado|Debilitado|Crítico</code></p>
                            ) : (
                              <p>🔄 Se aplica <code className="bg-muted px-1 rounded">{effect.operator}{effect.value}</code> cada turno (acumulativo)</p>
                            )}
                          </div>
                        )}

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Estado de regreso</Label>
                          {isTextAttr ? (
                            <Input
                              value={effect.fallbackValue != null ? String(effect.fallbackValue) : ''}
                              onChange={(e) => updateEffect(index, {
                                fallbackValue: e.target.value === '' ? undefined : e.target.value,
                              })}
                              placeholder="Valor original de texto (ej: NINGUNO)"
                              className="w-full"
                            />
                          ) : (
                            <Input
                              value={effect.fallbackValue ?? ''}
                              onChange={(e) => updateEffect(index, {
                                fallbackValue: e.target.value === '' ? undefined : (isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value)),
                              })}
                              placeholder="Valor original (dejar vacío)"
                              className="w-full"
                            />
                          )}
                          {isDynamic ? (
                            <>
                              <p className="text-xs text-amber-500/80">
                                ⚠️ Muy recomendado para efectos dinámicos ya que el cambio es acumulativo.
                              </p>
                              {effect.fallbackValue === undefined && (
                                <p className="text-xs text-red-500/80">
                                  ⚠️ Sin valor de regreso, el efecto dinámico no se puede revertir automáticamente al terminar.
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Valor al que regresa el atributo cuando el efecto termina.
                            </p>
                          )}
                        </div>

                        {targetAttrs.length === 0 && effect.targetId && (
                          <p className="text-xs text-amber-500/80 italic">
                            ⚠️ Este objetivo no tiene atributos configurados. Verifica que {effect.targetId === '__user__' ? 'la persona' : 'el personaje'} tenga el sistema de stats activado.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ===== Messages Tab ===== */}
            <TabsContent value="messages" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Label htmlFor="use-message">Mensaje al usar</Label>
                <p className="text-xs text-muted-foreground">
                  Texto mostrado cuando se usa o equipa el item
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
                    Texto mostrado cuando se desequipa el item
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

              {state.type === 'equipment' && (
                <div className="space-y-2">
                  <Label>Slot de Equipo</Label>
                  <p className="text-xs text-muted-foreground">
                    Slot donde se equipa este item
                  </p>
                  <Select value={state.slot} onValueChange={(v) => update('slot', v as ItemSlot)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EQUIPMENT_SLOTS.map(s => (
                        <SelectItem key={s} value={s}>
                          {SLOT_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
