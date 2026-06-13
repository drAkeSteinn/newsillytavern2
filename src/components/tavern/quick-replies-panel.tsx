// ============================================
// Quick Replies Panel - Character-specific quick replies
// Each quick reply can optionally modify character attributes
// ============================================

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MessageSquare,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Zap,
  Settings2,
  X,
  Check,
  ImageIcon,
  Timer,
  GripVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type {
  CharacterQuickReply,
  QuickReplyAttributeModifier,
  QuickReplyModifierOperation,
  QuickReplySpriteActivation,
  QuickReplySpriteFallbackMode,
  AttributeDefinition,
  CharacterStatsConfig,
  SpritePackV2,
  TriggerCollection,
} from '@/types';

interface QuickRepliesPanelProps {
  quickReplies: CharacterQuickReply[] | undefined;
  statsConfig: CharacterStatsConfig | undefined;
  /** Available sprite packs for sprite activation */
  spritePacksV2?: SpritePackV2[];
  /** Available trigger collections for sprite activation */
  triggerCollections?: TriggerCollection[];
  onChange: (quickReplies: CharacterQuickReply[]) => void;
}

// Operation labels for display
const OPERATION_LABELS: Record<QuickReplyModifierOperation, { label: string; symbol: string; description: string }> = {
  set: { label: 'Establecer', symbol: '=', description: 'Reemplaza el valor actual' },
  add: { label: 'Sumar', symbol: '+', description: 'Agrega al valor actual' },
  subtract: { label: 'Restar', symbol: '-', description: 'Reduce del valor actual' },
  multiply: { label: 'Multiplicar', symbol: '×', description: 'Multiplica el valor actual' },
  divide: { label: 'Dividir', symbol: '÷', description: 'Divide el valor actual' },
};

function generateId(): string {
  return `qr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function QuickRepliesPanel({
  quickReplies,
  statsConfig,
  spritePacksV2,
  triggerCollections,
  onChange,
}: QuickRepliesPanelProps) {
  const replies = quickReplies || [];
  const attributes = statsConfig?.attributes || [];

  // State for new reply form
  const [newLabel, setNewLabel] = useState('');
  const [newResponse, setNewResponse] = useState('');
  const [newModifiers, setNewModifiers] = useState<QuickReplyAttributeModifier[]>([]);

  // State for editing existing reply
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editResponse, setEditResponse] = useState('');
  const [editModifiers, setEditModifiers] = useState<QuickReplyAttributeModifier[]>([]);

  // State for expanded modifiers section
  const [expandedModifiers, setExpandedModifiers] = useState<string | null>(null);

  // State for sprite activation in new reply
  const [newSpriteActivation, setNewSpriteActivation] = useState<QuickReplySpriteActivation | undefined>(undefined);

  // State for sprite activation in editing reply
  const [editSpriteActivation, setEditSpriteActivation] = useState<QuickReplySpriteActivation | undefined>(undefined);

  // State for expanded sprite activation section
  const [expandedSpriteActivation, setExpandedSpriteActivation] = useState<string | null>(null);

  // Whether sprite activation is available (has packs or collections)
  const hasSpriteOptions = (spritePacksV2 && spritePacksV2.length > 0) || (triggerCollections && triggerCollections.length > 0);

  const isAdding = newLabel.trim() && newResponse.trim();

  const handleAdd = () => {
    if (!isAdding) return;
    const newReply: CharacterQuickReply = {
      id: generateId(),
      label: newLabel.trim(),
      response: newResponse.trim(),
      modifiers: newModifiers.length > 0 ? newModifiers : undefined,
      spriteActivation: newSpriteActivation,
    };
    onChange([...replies, newReply]);
    setNewLabel('');
    setNewResponse('');
    setNewModifiers([]);
    setNewSpriteActivation(undefined);
  };

  const handleDelete = (id: string) => {
    onChange(replies.filter((r) => r.id !== id));
  };

  const handleStartEdit = (reply: CharacterQuickReply) => {
    setEditingId(reply.id);
    setEditLabel(reply.label);
    setEditResponse(reply.response);
    setEditModifiers(reply.modifiers ? [...reply.modifiers] : []);
    setEditSpriteActivation(reply.spriteActivation ? { ...reply.spriteActivation } : undefined);
  };

  const handleSaveEdit = () => {
    if (!editingId || !editLabel.trim() || !editResponse.trim()) return;
    onChange(
      replies.map((r) =>
        r.id === editingId
          ? {
              ...r,
              label: editLabel.trim(),
              response: editResponse.trim(),
              modifiers: editModifiers.length > 0 ? editModifiers : undefined,
              spriteActivation: editSpriteActivation,
            }
          : r
      )
    );
    setEditingId(null);
    setEditLabel('');
    setEditResponse('');
    setEditModifiers([]);
    setEditSpriteActivation(undefined);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditLabel('');
    setEditResponse('');
    setEditModifiers([]);
    setEditSpriteActivation(undefined);
  };

  // Add a modifier to the new reply form
  const addModifierToNew = () => {
    if (attributes.length === 0) return;
    setNewModifiers([
      ...newModifiers,
      { attributeKey: attributes[0].key, operation: 'add', value: 1 },
    ]);
  };

  const updateNewModifier = (index: number, field: keyof QuickReplyAttributeModifier, value: string | number) => {
    const updated = [...newModifiers];
    updated[index] = { ...updated[index], [field]: value };
    setNewModifiers(updated);
  };

  const removeNewModifier = (index: number) => {
    setNewModifiers(newModifiers.filter((_, i) => i !== index));
  };

  // Add a modifier to the editing reply form
  const addModifierToEdit = () => {
    if (attributes.length === 0) return;
    setEditModifiers([
      ...editModifiers,
      { attributeKey: attributes[0].key, operation: 'add', value: 1 },
    ]);
  };

  const updateEditModifier = (index: number, field: keyof QuickReplyAttributeModifier, value: string | number) => {
    const updated = [...editModifiers];
    updated[index] = { ...updated[index], [field]: value };
    setEditModifiers(updated);
  };

  const removeEditModifier = (index: number) => {
    setEditModifiers(editModifiers.filter((_, i) => i !== index));
  };

  // Render modifier row
  const renderModifierRow = (
    modifier: QuickReplyAttributeModifier,
    index: number,
    onUpdate: (index: number, field: keyof QuickReplyAttributeModifier, value: string | number) => void,
    onRemove: (index: number) => void
  ) => {
    const attr = attributes.find((a) => a.key === modifier.attributeKey);
    const isTextAttr = attr?.type === 'text' || attr?.type === 'keyword';
    const availableOps: QuickReplyModifierOperation[] = isTextAttr
      ? ['set']
      : ['set', 'add', 'subtract', 'multiply', 'divide'];

    return (
      <div key={index} className="flex items-center gap-1.5">
        {/* Attribute selector */}
        <Select
          value={modifier.attributeKey}
          onValueChange={(val) => onUpdate(index, 'attributeKey', val)}
        >
          <SelectTrigger className="h-7 text-xs flex-1 min-w-[80px]">
            <SelectValue placeholder="Atributo" />
          </SelectTrigger>
          <SelectContent>
            {attributes.map((attr) => (
              <SelectItem key={attr.key} value={attr.key}>
                <span className="text-xs">{attr.icon ? `${attr.icon} ` : ''}{attr.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Operation selector */}
        <Select
          value={modifier.operation}
          onValueChange={(val) => onUpdate(index, 'operation', val as QuickReplyModifierOperation)}
        >
          <SelectTrigger className="h-7 text-xs w-[90px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableOps.map((op) => (
              <SelectItem key={op} value={op}>
                <span className="text-xs">
                  {OPERATION_LABELS[op].symbol} {OPERATION_LABELS[op].label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Value input */}
        <Input
          type={isTextAttr ? 'text' : 'number'}
          value={String(modifier.value)}
          onChange={(e) => {
            const val = isTextAttr ? e.target.value : (parseFloat(e.target.value) || 0);
            onUpdate(index, 'value', val);
          }}
          className="h-7 text-xs w-[70px]"
          placeholder="Valor"
        />

        {/* Remove button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400 flex-shrink-0"
          onClick={() => onRemove(index)}
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    );
  };

  // Render sprite activation section
  const renderSpriteActivation = (
    activation: QuickReplySpriteActivation | undefined,
    setActivation: (a: QuickReplySpriteActivation | undefined) => void,
    sectionKey: string,
  ) => {
    const isExpanded = expandedSpriteActivation === sectionKey;
    const isActive = !!activation;

    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => {
            setExpandedSpriteActivation(isExpanded ? null : sectionKey);
            if (!isActive && !isExpanded) {
              // Pre-populate with defaults
              setActivation({
                mode: 'sprite_pack',
                targetId: '',
                fallbackMode: 'idle_collection',
                fallbackDelayMs: 3000,
              });
            }
          }}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
          <span>Activación de Sprite</span>
          {isActive && (
            <Badge variant="secondary" className="h-4 text-[10px] px-1 bg-emerald-500/20 text-emerald-400">
              {activation?.mode === 'trigger_collection' ? 'Trigger' : 'Pack'}
            </Badge>
          )}
          {isExpanded ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </button>

        {(isExpanded || isActive) && (
          <div className="ml-5 space-y-2 border-l-2 border-emerald-500/20 pl-3">
            {/* Enable/Disable toggle */}
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-muted-foreground">Activar sprite:</label>
              <button
                type="button"
                onClick={() => {
                  if (isActive) {
                    setActivation(undefined);
                  } else {
                    setActivation({
                      mode: 'sprite_pack',
                      targetId: '',
                      fallbackMode: 'idle_collection',
                      fallbackDelayMs: 3000,
                    });
                  }
                }}
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full transition-colors",
                  isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-muted text-muted-foreground"
                )}
              >
                {isActive ? 'Activado' : 'Desactivado'}
              </button>
            </div>

            {isActive && activation && (
              <>
                {/* Mode selector */}
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] text-muted-foreground w-16 flex-shrink-0">Modo</Label>
                  <Select
                    value={activation.mode}
                    onValueChange={(val) => setActivation({ ...activation, mode: val as 'trigger_collection' | 'sprite_pack', targetId: '' })}
                  >
                    <SelectTrigger className="h-7 text-xs flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sprite_pack">
                        <span className="text-xs">📦 Sprite Pack (condicional)</span>
                      </SelectItem>
                      <SelectItem value="trigger_collection">
                        <span className="text-xs">🎯 Colección de Triggers</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Target selector */}
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] text-muted-foreground w-16 flex-shrink-0">Objetivo</Label>
                  <Select
                    value={activation.targetId}
                    onValueChange={(val) => setActivation({ ...activation, targetId: val })}
                  >
                    <SelectTrigger className="h-7 text-xs flex-1">
                      <SelectValue placeholder={activation.mode === 'trigger_collection' ? 'Seleccionar trigger...' : 'Seleccionar pack...'} />
                    </SelectTrigger>
                    <SelectContent>
                      {activation.mode === 'trigger_collection' ? (
                        (triggerCollections || []).map((tc) => (
                          <SelectItem key={tc.id} value={tc.id}>
                            <span className="text-xs">🎯 {tc.name} (Prioridad: {tc.priority})</span>
                          </SelectItem>
                        ))
                      ) : (
                        (spritePacksV2 || []).map((pack) => (
                          <SelectItem key={pack.id} value={pack.id}>
                            <span className="text-xs">📦 {pack.name} {pack.conditionalMode ? '(condicional)' : ''}</span>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Fallback mode */}
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] text-muted-foreground w-16 flex-shrink-0">Al terminar</Label>
                  <Select
                    value={activation.fallbackMode}
                    onValueChange={(val) => setActivation({ ...activation, fallbackMode: val as QuickReplySpriteFallbackMode })}
                  >
                    <SelectTrigger className="h-7 text-xs flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="idle_collection">
                        <span className="text-xs">🔄 Volver al estado normal</span>
                      </SelectItem>
                      <SelectItem value="collection_default">
                        <span className="text-xs">🖼️ Sprite principal del pack</span>
                      </SelectItem>
                      <SelectItem value="custom_sprite">
                        <span className="text-xs">✨ Sprite personalizado</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Fallback delay */}
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] text-muted-foreground w-16 flex-shrink-0">
                    <Timer className="w-3 h-3 inline mr-1" />
                    Duración
                  </Label>
                  <Input
                    type="number"
                    value={activation.fallbackDelayMs}
                    onChange={(e) => setActivation({ ...activation, fallbackDelayMs: parseInt(e.target.value) || 0 })}
                    className="h-7 text-xs w-[80px]"
                    min={0}
                    step={500}
                  />
                  <span className="text-[10px] text-muted-foreground">ms (0 = persistir)</span>
                </div>

                {/* Custom sprite for fallback (only when mode is custom_sprite) */}
                {activation.fallbackMode === 'custom_sprite' && (
                  <div className="flex items-center gap-2">
                    <Label className="text-[10px] text-muted-foreground w-16 flex-shrink-0">Sprite fall.</Label>
                    <Select
                      value={activation.fallbackSpriteId || ''}
                      onValueChange={(val) => setActivation({ ...activation, fallbackSpriteId: val })}
                    >
                      <SelectTrigger className="h-7 text-xs flex-1">
                        <SelectValue placeholder="Seleccionar sprite..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(spritePacksV2 || []).flatMap((pack) =>
                          pack.sprites.map((sprite) => (
                            <SelectItem key={sprite.id} value={sprite.id}>
                              <span className="text-xs">{pack.name} / {sprite.label}</span>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = replies.findIndex((r) => r.id === active.id);
      const newIndex = replies.findIndex((r) => r.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        onChange(arrayMove(replies, oldIndex, newIndex));
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-lg p-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-violet-500/20 rounded-lg">
            <MessageSquare className="w-5 h-5 text-violet-500" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-medium text-violet-600">Respuestas Rápidas</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Botones de acceso rápido personalizados para este personaje.{' '}
              <strong>Etiqueta</strong> es lo que se ve, <strong>Respuesta</strong> es lo que se envía.{' '}
              Puedes usar <code className="text-[10px] bg-muted px-1 rounded">{'{{char}}'}</code> y{' '}
              <code className="text-[10px] bg-muted px-1 rounded">{'{{user}}'}</code> para insertar nombres.
            </p>
            {attributes.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Opcionalmente puedes agregar <Zap className="w-3 h-3 inline text-amber-400" /> modificadores de atributos que se aplican al usar la respuesta.
              </p>
            )}
            {hasSpriteOptions && (
              <p className="text-xs text-muted-foreground mt-1">
                También puedes activar <ImageIcon className="w-3 h-3 inline text-emerald-400" /> sprites al usar la respuesta.
              </p>
            )}
            {replies.length > 1 && (
              <p className="text-xs text-muted-foreground mt-1">
                <GripVertical className="w-3 h-3 inline text-muted-foreground" /> Arrastra para reordenar las respuestas.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Existing replies */}
      {replies.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={replies.map((r) => r.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {replies.map((reply) => (
                <SortableQuickReplyItem
                  key={reply.id}
                  reply={reply}
                  editingId={editingId}
                  editLabel={editLabel}
                  editResponse={editResponse}
                  editModifiers={editModifiers}
                  editSpriteActivation={editSpriteActivation}
                  expandedModifiers={expandedModifiers}
                  expandedSpriteActivation={expandedSpriteActivation}
                  attributes={attributes}
                  hasSpriteOptions={hasSpriteOptions}
                  spritePacksV2={spritePacksV2}
                  triggerCollections={triggerCollections}
                  onStartEdit={handleStartEdit}
                  onSaveEdit={handleSaveEdit}
                  onCancelEdit={handleCancelEdit}
                  onDelete={handleDelete}
                  setEditLabel={setEditLabel}
                  setEditResponse={setEditResponse}
                  setEditModifiers={setEditModifiers}
                  setEditSpriteActivation={setEditSpriteActivation}
                  setExpandedModifiers={setExpandedModifiers}
                  setExpandedSpriteActivation={setExpandedSpriteActivation}
                  addModifierToEdit={addModifierToEdit}
                  updateEditModifier={updateEditModifier}
                  removeEditModifier={removeEditModifier}
                  renderModifierRow={renderModifierRow}
                  renderSpriteActivation={renderSpriteActivation}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add new reply form */}
      {replies.length < 12 && (
        <div className="p-3 rounded-lg border border-dashed space-y-3">
          <p className="text-xs text-muted-foreground font-medium">Agregar nueva respuesta rápida</p>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground w-20 flex-shrink-0">Etiqueta</Label>
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="h-8 text-sm flex-1"
              placeholder="Ej: Atacar..."
              maxLength={20}
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground w-20 flex-shrink-0">Respuesta</Label>
            <Input
              value={newResponse}
              onChange={(e) => setNewResponse(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newLabel.trim() && newResponse.trim()) {
                  handleAdd();
                }
              }}
              className="h-8 text-sm flex-1"
              placeholder="Mensaje que se envía (usa {{char}}, {{user}})"
              maxLength={200}
            />
          </div>

          {/* Modifiers for new reply */}
          {attributes.length > 0 && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() =>
                  setExpandedModifiers(expandedModifiers === '__new__' ? null : '__new__')
                }
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Modificadores de atributos</span>
                {newModifiers.length > 0 && (
                  <Badge variant="secondary" className="h-4 text-[10px] px-1">
                    {newModifiers.length}
                  </Badge>
                )}
                {expandedModifiers === '__new__' ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>

              {(expandedModifiers === '__new__' || newModifiers.length > 0) && (
                <div className="ml-5 space-y-1.5">
                  {newModifiers.map((mod, idx) =>
                    renderModifierRow(mod, idx, updateNewModifier, removeNewModifier)
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-violet-600 hover:text-violet-700 hover:bg-violet-500/10"
                    onClick={addModifierToNew}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Agregar modificador
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Sprite activation for new reply */}
          {hasSpriteOptions && (
            <div>
              {renderSpriteActivation(newSpriteActivation, setNewSpriteActivation, '__new__')}
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-8 w-full"
            disabled={!isAdding}
            onClick={handleAdd}
          >
            <Plus className="w-4 h-4 mr-1" />
            Agregar
          </Button>
        </div>
      )}

      {replies.length >= 12 && (
        <p className="text-xs text-muted-foreground text-center">
          Máximo 12 respuestas rápidas permitidas.
        </p>
      )}

      {replies.length === 0 && (
        <div className="text-center py-6 text-muted-foreground">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-xs">No hay respuestas rápidas configuradas</p>
          <p className="text-xs opacity-60">Agrega respuestas rápidas para acceso directo en el chat</p>
        </div>
      )}
    </div>
  );
}

// ============================================
// Sortable Quick Reply Item - DnD wrapper
// ============================================

interface SortableQuickReplyItemProps {
  reply: CharacterQuickReply;
  editingId: string | null;
  editLabel: string;
  editResponse: string;
  editModifiers: QuickReplyAttributeModifier[];
  editSpriteActivation: QuickReplySpriteActivation | undefined;
  expandedModifiers: string | null;
  expandedSpriteActivation: string | null;
  attributes: AttributeDefinition[];
  hasSpriteOptions: boolean;
  spritePacksV2?: SpritePackV2[];
  triggerCollections?: TriggerCollection[];
  onStartEdit: (reply: CharacterQuickReply) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  setEditLabel: (v: string) => void;
  setEditResponse: (v: string) => void;
  setEditModifiers: (v: QuickReplyAttributeModifier[]) => void;
  setEditSpriteActivation: (v: QuickReplySpriteActivation | undefined) => void;
  setExpandedModifiers: (v: string | null) => void;
  setExpandedSpriteActivation: (v: string | null) => void;
  addModifierToEdit: () => void;
  updateEditModifier: (index: number, field: keyof QuickReplyAttributeModifier, value: string | number) => void;
  removeEditModifier: (index: number) => void;
  renderModifierRow: (
    modifier: QuickReplyAttributeModifier,
    index: number,
    onUpdate: (index: number, field: keyof QuickReplyAttributeModifier, value: string | number) => void,
    onRemove: (index: number) => void
  ) => React.ReactNode;
  renderSpriteActivation: (
    activation: QuickReplySpriteActivation | undefined,
    setActivation: (a: QuickReplySpriteActivation | undefined) => void,
    sectionKey: string,
  ) => React.ReactNode;
}

function SortableQuickReplyItem({
  reply,
  editingId,
  editLabel,
  editResponse,
  editModifiers,
  editSpriteActivation,
  expandedModifiers,
  expandedSpriteActivation,
  attributes,
  hasSpriteOptions,
  spritePacksV2,
  triggerCollections,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  setEditLabel,
  setEditResponse,
  setEditModifiers,
  setEditSpriteActivation,
  setExpandedModifiers,
  setExpandedSpriteActivation,
  addModifierToEdit,
  updateEditModifier,
  removeEditModifier,
  renderModifierRow,
  renderSpriteActivation,
}: SortableQuickReplyItemProps) {
  const {
    attributes: dndAttributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: reply.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isEditing = editingId === reply.id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border group",
        isDragging && "z-50 shadow-lg shadow-violet-500/10 border-violet-500/50 opacity-90"
      )}
    >
      {isEditing ? (
        /* Edit mode */
        <div className="p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground w-20 flex-shrink-0">Etiqueta</Label>
            <Input
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              className="h-8 text-sm flex-1"
              placeholder="Texto del botón..."
              maxLength={20}
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground w-20 flex-shrink-0">Respuesta</Label>
            <Input
              value={editResponse}
              onChange={(e) => setEditResponse(e.target.value)}
              className="h-8 text-sm flex-1"
              placeholder="Mensaje que se envía..."
              maxLength={200}
            />
          </div>

          {/* Modifiers section */}
          {attributes.length > 0 && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() =>
                  setExpandedModifiers(
                    expandedModifiers === reply.id ? null : reply.id
                  )
                }
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Modificadores de atributos</span>
                {editModifiers.length > 0 && (
                  <Badge variant="secondary" className="h-4 text-[10px] px-1">
                    {editModifiers.length}
                  </Badge>
                )}
                {expandedModifiers === reply.id ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>

              {(expandedModifiers === reply.id || editModifiers.length > 0) && (
                <div className="ml-5 space-y-1.5">
                  {editModifiers.map((mod, idx) =>
                    renderModifierRow(mod, idx, updateEditModifier, removeEditModifier)
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-violet-600 hover:text-violet-700 hover:bg-violet-500/10"
                    onClick={addModifierToEdit}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Agregar modificador
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Sprite activation section for editing */}
          {hasSpriteOptions && (
            <div className="mt-2">
              {renderSpriteActivation(editSpriteActivation, setEditSpriteActivation, `edit-${reply.id}`)}
            </div>
          )}

          {/* Save / Cancel */}
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-violet-600 hover:text-violet-700 hover:bg-violet-500/10"
              disabled={!editLabel.trim() || !editResponse.trim()}
              onClick={onSaveEdit}
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              Guardar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={onCancelEdit}
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        /* Display mode */
        <div className="flex items-center gap-2 p-2">
          {/* Drag handle */}
          <button
            type="button"
            className={cn(
              "p-1 rounded cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50 transition-colors flex-shrink-0",
              isDragging && "cursor-grabbing"
            )}
            {...dndAttributes}
            {...listeners}
          >
            <GripVertical className="w-4 h-4" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium">{reply.label}</span>
              {reply.modifiers && reply.modifiers.length > 0 && (
                <Badge variant="secondary" className="h-4 text-[10px] px-1.5 gap-0.5">
                  <Zap className="w-2.5 h-2.5 text-amber-400" />
                  {reply.modifiers.length}
                </Badge>
              )}
              {reply.spriteActivation && (
                <Badge variant="secondary" className="h-4 text-[10px] px-1.5 gap-0.5 bg-emerald-500/20 text-emerald-400">
                  <ImageIcon className="w-2.5 h-2.5" />
                  {reply.spriteActivation.mode === 'trigger_collection' ? 'Trigger' : 'Sprite'}
                </Badge>
              )}
            </div>
            {reply.response !== reply.label && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {reply.response}
              </p>
            )}
            {reply.modifiers && reply.modifiers.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {reply.modifiers.map((mod, idx) => {
                  const attr = attributes.find((a) => a.key === mod.attributeKey);
                  const op = OPERATION_LABELS[mod.operation];
                  return (
                    <span
                      key={idx}
                      className="text-[10px] bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded"
                    >
                      {attr?.icon ? `${attr.icon} ` : ''}{attr?.name || mod.attributeKey} {op.symbol} {mod.value}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => onStartEdit(reply)}
            >
              <Settings2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-red-400 hover:text-red-500 hover:bg-red-500/10"
              onClick={() => onDelete(reply.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
