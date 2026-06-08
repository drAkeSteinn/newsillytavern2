'use client';

/**
 * RewardEditor Component
 * 
 * Componente reutilizable para editar recompensas de quests.
 * Soporta el sistema unificado de 2 tipos: attribute | trigger
 * 
 * Uso:
 * <RewardEditor
 *   reward={reward}
 *   onChange={(updated) => ...}
 *   onDelete={() => ...}
 *   compact={true} // Para UI compacta en objetivos
 * />
 */

import type {
  QuestReward,
  QuestRewardActivateSpritePack,
  AttributeAction,
  TriggerCategory,
  TriggerTargetMode,
  TriggerFallbackMode,
} from '@/types';
import {
  normalizeReward,
  describeReward,
  createAttributeReward,
  createTriggerReward,
  createCurrencyReward,
  createConditionalSpriteCollectionReward,
  createActivateSpritePackReward,
  getActionSymbol,
} from '@/lib/quest/quest-reward-utils';
import { cn } from '@/lib/utils';
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
  X,
  Hash,
  Zap,
  Image as ImageIcon,
  Volume2,
  Wallpaper,
  Users,
  User,
  Crosshair,
  ChevronDown,
  Coins,
  GitBranch,
  Package,
} from 'lucide-react';

// ============================================
// Types
// ============================================

export interface RewardEditorProps {
  /** Recompensa a editar */
  reward: QuestReward;
  /** Callback cuando la recompensa cambia */
  onChange: (reward: QuestReward) => void;
  /** Callback cuando se solicita eliminar */
  onDelete: () => void;
  /** Lista de atributos disponibles para autocompletado */
  availableAttributes?: string[];
  /** Triggers disponibles por categoría */
  availableTriggers?: {
    sprites?: string[];
    sounds?: string[];
    backgrounds?: string[];
  };
  /** Si es chat grupal, mostrar opciones de targetMode */
  isGroupChat?: boolean;
  /** Modo compacto (para usar en objetivos) */
  compact?: boolean;
  /** Clase CSS adicional */
  className?: string;
  /** Mostrar campo de ID editable */
  showIdField?: boolean;
  /** Colecciones de triggers condicionales disponibles */
  availableConditionalCollections?: Array<{ id: string; name: string }>;
  /** Sprite packs V2 disponibles para activate_sprite_pack */
  availableSpritePacks?: Array<{ id: string; name: string; conditionalMode?: boolean; spriteCount?: number }>;
  /** Targets disponibles (otros personajes) para target mode en activate_sprite_pack */
  availableTargets?: Array<{
    id: string;
    name: string;
    spritePacks?: Array<{ id: string; name: string; conditionalMode?: boolean; spriteCount: number }>;
  }>;
}

// ============================================
// Constants
// ============================================

const ACTION_OPTIONS: { value: AttributeAction; label: string; symbol: string }[] = [
  { value: 'set', label: 'Establecer', symbol: '=' },
  { value: 'add', label: 'Sumar', symbol: '+' },
  { value: 'subtract', label: 'Restar', symbol: '-' },
  { value: 'multiply', label: 'Multiplicar', symbol: '×' },
  { value: 'divide', label: 'Dividir', symbol: '÷' },
  { value: 'percent', label: 'Porcentaje', symbol: '%' },
];

const TRIGGER_CATEGORIES: { value: TriggerCategory; label: string; icon: React.ReactNode }[] = [
  { value: 'sprite', label: 'Sprite', icon: <ImageIcon className="w-3.5 h-3.5" /> },
  { value: 'sound', label: 'Sonido', icon: <Volume2 className="w-3.5 h-3.5" /> },
  { value: 'background', label: 'Fondo', icon: <Wallpaper className="w-3.5 h-3.5" /> },
];

const TARGET_MODES: { value: TriggerTargetMode; label: string; icon: React.ReactNode }[] = [
  { value: 'self', label: 'Mismo personaje', icon: <User className="w-3.5 h-3.5" /> },
  { value: 'all', label: 'Todos', icon: <Users className="w-3.5 h-3.5" /> },
  { value: 'target', label: 'Objetivo', icon: <Crosshair className="w-3.5 h-3.5" /> },
];

// ============================================
// Component
// ============================================

export function RewardEditor({
  reward,
  onChange,
  onDelete,
  availableAttributes,
  availableTriggers,
  availableConditionalCollections,
  availableSpritePacks,
  availableTargets,
  isGroupChat = false,
  compact = false,
  className,
  showIdField = false,
}: RewardEditorProps) {
  // Normalizar reward para obtener valores actuales
  const normalized = normalizeReward(reward);
  const isAttribute = normalized.type === 'attribute';
  const isTrigger = normalized.type === 'trigger';
  const isCurrency = normalized.type === 'currency';
  const isConditionalSpriteCollection = normalized.type === 'conditional_sprite_collection';
  const isActivateSpritePack = normalized.type === 'activate_sprite_pack';

  // Handlers
  const handleTypeChange = (newType: 'attribute' | 'trigger' | 'currency' | 'conditional_sprite_collection' | 'activate_sprite_pack') => {
    if (newType === normalized.type) return;

    let newReward: QuestReward;
    if (newType === 'attribute') {
      newReward = createAttributeReward(
        normalized.attribute?.key || normalized.key || '',
        normalized.attribute?.value ?? normalized.value ?? 0,
        normalized.attribute?.action || 'add',
        { id: reward.id }
      );
    } else if (newType === 'currency') {
      newReward = createCurrencyReward(0, { id: reward.id });
    } else if (newType === 'conditional_sprite_collection') {
      newReward = createConditionalSpriteCollectionReward('', { id: reward.id });
    } else if (newType === 'activate_sprite_pack') {
      newReward = createActivateSpritePackReward('', { id: reward.id });
    } else {
      newReward = createTriggerReward(
        normalized.trigger?.category || 'sprite',
        normalized.trigger?.key || normalized.key || '',
        normalized.trigger?.targetMode || 'self',
        { id: reward.id }
      );
    }
    onChange(newReward);
  };

  const handleAttributeChange = (updates: Partial<NonNullable<QuestReward['attribute']>>) => {
    const currentAttr = normalized.attribute || { key: '', value: 0, action: 'add' as AttributeAction };
    onChange({
      ...reward,
      type: 'attribute',
      attribute: { ...currentAttr, ...updates },
    });
  };

  const handleTriggerChange = (updates: Partial<NonNullable<QuestReward['trigger']>>) => {
    const currentTrigger = normalized.trigger || { 
      category: 'sprite' as TriggerCategory, 
      key: '', 
      targetMode: 'self' as TriggerTargetMode 
    };
    onChange({
      ...reward,
      type: 'trigger',
      trigger: { ...currentTrigger, ...updates },
    });
  };

  const handleCurrencyChange = (updates: Partial<NonNullable<QuestReward['currency']>>) => {
    const currentCurrency = normalized.currency || { amount: 0 };
    onChange({
      ...reward,
      type: 'currency',
      currency: { ...currentCurrency, ...updates },
    });
  };

  const handleConditionalSpriteCollectionChange = (updates: Partial<NonNullable<QuestReward['conditional_sprite_collection']>>) => {
    const current = normalized.conditional_sprite_collection || {
      collectionId: '',
      targetMode: 'self' as TriggerTargetMode,
      returnToIdleMs: 0,
      fallbackMode: 'idle_collection' as TriggerFallbackMode,
    };
    onChange({
      ...reward,
      type: 'conditional_sprite_collection',
      conditional_sprite_collection: { ...current, ...updates },
    });
  };

  const handleActivateSpritePackChange = (updates: Partial<NonNullable<QuestReward['activate_sprite_pack']>>) => {
    const current = normalized.activate_sprite_pack || {
      packId: '',
      targetMode: 'self' as TriggerTargetMode,
      returnToIdleMs: 0,
      fallbackMode: 'idle_collection' as TriggerFallbackMode,
    };
    onChange({
      ...reward,
      type: 'activate_sprite_pack',
      activate_sprite_pack: { ...current, ...updates },
    });
  };

  // Derived expiry mode for unified "Al expirar" dropdown
  const getExpiryMode = (): string => {
    const pack = normalized.activate_sprite_pack;
    if (!pack) return 'idle_collection';
    if (pack.fallbackPackId) return 'fallback_pack';
    return pack.fallbackMode || 'idle_collection';
  };

  const handleExpiryModeChange = (value: string) => {
    if (value === 'fallback_pack') {
      handleActivateSpritePackChange({
        fallbackMode: 'custom_sprite' as const,
        fallbackPackId: normalized.activate_sprite_pack?.fallbackPackId || undefined,
      });
    } else {
      handleActivateSpritePackChange({
        fallbackMode: value as TriggerFallbackMode,
        fallbackPackId: undefined,
      });
    }
  };

  // Compact mode
  if (compact) {
    return (
      <div className={cn("p-2 rounded bg-muted/20 space-y-2", className)}>
        {/* Tipo y preview */}
        <div className="flex items-center gap-2">
          <Select 
            value={normalized.type} 
            onValueChange={(v) => handleTypeChange(v as 'attribute' | 'trigger' | 'currency' | 'conditional_sprite_collection' | 'activate_sprite_pack')}
          >
            <SelectTrigger className="bg-background h-6 text-xs w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="attribute">📊 Atributo</SelectItem>
              <SelectItem value="trigger">⚡ Trigger</SelectItem>
              <SelectItem value="currency">💰 Divisa</SelectItem>
              <SelectItem value="conditional_sprite_collection">🔀 Cond. Sprite</SelectItem>
              <SelectItem value="activate_sprite_pack">🎨 Sprite Pack</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline" className="text-[10px] flex-1">
            {describeReward(normalized)}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-red-500 hover:bg-red-500/10"
            onClick={onDelete}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
        
        {/* Config attribute */}
        {isAttribute && normalized.attribute && (
          <div className="grid grid-cols-3 gap-2">
            <Input
              value={normalized.attribute.key}
              onChange={(e) => handleAttributeChange({ key: e.target.value })}
              placeholder="Key"
              className="bg-background h-6 text-xs"
              list={availableAttributes ? "available-attributes" : undefined}
            />
            {availableAttributes && (
              <datalist id="available-attributes">
                {availableAttributes.map(attr => (
                  <option key={attr} value={attr} />
                ))}
              </datalist>
            )}
            <Input
              type="number"
              value={normalized.attribute.value}
              onChange={(e) => handleAttributeChange({ value: Number(e.target.value) })}
              placeholder="Valor"
              className="bg-background h-6 text-xs"
            />
            <Select 
              value={normalized.attribute.action} 
              onValueChange={(v) => handleAttributeChange({ action: v as AttributeAction })}
            >
              <SelectTrigger className="bg-background h-6 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.symbol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        
        {/* Config trigger */}
        {isTrigger && normalized.trigger && (
          <div className="grid grid-cols-3 gap-2">
            <Select 
              value={normalized.trigger.category} 
              onValueChange={(v) => handleTriggerChange({ category: v as TriggerCategory })}
            >
              <SelectTrigger className="bg-background h-6 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <span className="flex items-center gap-1">
                      {cat.icon}
                      {cat.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={normalized.trigger.key}
              onChange={(e) => handleTriggerChange({ key: e.target.value })}
              placeholder="Key"
              className="bg-background h-6 text-xs"
              list={getTriggerDatalistId(normalized.trigger.category, availableTriggers)}
            />
            {isGroupChat ? (
              <Select 
                value={normalized.trigger.targetMode} 
                onValueChange={(v) => handleTriggerChange({ targetMode: v as TriggerTargetMode })}
              >
                <SelectTrigger className="bg-background h-6 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_MODES.map(mode => (
                    <SelectItem key={mode.value} value={mode.value}>
                      <span className="flex items-center gap-1">
                        {mode.icon}
                        {mode.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                type="number"
                min={0}
                value={normalized.trigger.returnToIdleMs || 0}
                onChange={(e) => handleTriggerChange({ returnToIdleMs: Number(e.target.value) })}
                placeholder="Idle ms"
                className="bg-background h-6 text-xs"
              />
            )}
          </div>
        )}

        {/* Config currency */}
        {isCurrency && normalized.currency && (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={normalized.currency.amount}
              onChange={(e) => handleCurrencyChange({ amount: Number(e.target.value) })}
              placeholder="Cantidad"
              className="bg-background h-6 text-xs w-20"
            />
            <span className="text-[10px] text-muted-foreground">divisa para persona</span>
          </div>
        )}

        {/* Config conditional_sprite_collection */}
        {isConditionalSpriteCollection && normalized.conditional_sprite_collection && (
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={normalized.conditional_sprite_collection.collectionId}
              onChange={(e) => handleConditionalSpriteCollectionChange({ collectionId: e.target.value })}
              placeholder="ID Colección"
              className="bg-background h-6 text-xs"
            />
            <Select
              value={normalized.conditional_sprite_collection.targetMode || 'self'}
              onValueChange={(v) => handleConditionalSpriteCollectionChange({ targetMode: v as TriggerTargetMode })}
            >
              <SelectTrigger className="bg-background h-6 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGET_MODES.map(mode => (
                  <SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Config activate_sprite_pack */}
        {isActivateSpritePack && normalized.activate_sprite_pack && (
          <div className="space-y-1.5">
            {/* Target mode */}
            <Select
              value={normalized.activate_sprite_pack.targetMode || 'self'}
              onValueChange={(v) => handleActivateSpritePackChange({ targetMode: v as TriggerTargetMode })}
            >
              <SelectTrigger className="bg-background h-6 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGET_MODES.map(mode => (
                  <SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Pack selectors — varies by mode */}
            {(normalized.activate_sprite_pack.targetMode || 'self') === 'self' ? (
              <Select
                value={normalized.activate_sprite_pack.packId}
                onValueChange={(v) => handleActivateSpritePackChange({ packId: v })}
              >
                <SelectTrigger className="bg-background h-6 text-xs">
                  <SelectValue placeholder="Sprite Pack..." />
                </SelectTrigger>
                <SelectContent>
                  {availableSpritePacks?.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        {p.name}
                        {p.conditionalMode && <span className="text-[9px] text-purple-500">cond.</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (normalized.activate_sprite_pack.targetMode) === 'target' ? (
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={normalized.activate_sprite_pack.targetCharacterId || ''}
                  onValueChange={(v) => handleActivateSpritePackChange({ targetCharacterId: v, targetPackId: undefined })}
                >
                  <SelectTrigger className="bg-background h-6 text-xs">
                    <SelectValue placeholder="Personaje..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTargets?.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.id === '__user__' ? '👤 ' : '🎭 '}{t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={normalized.activate_sprite_pack.targetPackId || ''}
                  onValueChange={(v) => handleActivateSpritePackChange({ targetPackId: v })}
                >
                  <SelectTrigger className="bg-background h-6 text-xs">
                    <SelectValue placeholder="Pack objetivo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const sel = availableTargets?.find(t => t.id === normalized.activate_sprite_pack!.targetCharacterId);
                      return sel?.spritePacks?.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      )) || [];
                    })()}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <Select
                value={normalized.activate_sprite_pack.packId}
                onValueChange={(v) => handleActivateSpritePackChange({ packId: v })}
              >
                <SelectTrigger className="bg-background h-6 text-xs">
                  <SelectValue placeholder="Sprite Pack..." />
                </SelectTrigger>
                <SelectContent>
                  {availableSpritePacks?.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Duration + Al expirar */}
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                min={0}
                value={normalized.activate_sprite_pack.returnToIdleMs || 0}
                onChange={(e) => handleActivateSpritePackChange({ returnToIdleMs: Number(e.target.value) })}
                placeholder="Duración ms"
                className="bg-background h-6 text-xs"
              />
              <Select
                value={getExpiryMode()}
                onValueChange={handleExpiryModeChange}
              >
                <SelectTrigger className="bg-background h-6 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="idle_collection">↩️ Idle</SelectItem>
                  <SelectItem value="collection_default">⭐ Default</SelectItem>
                  {(normalized.activate_sprite_pack.targetMode || 'self') !== 'target' && (
                    <SelectItem value="fallback_pack">
                      <div className="flex items-center gap-1">
                        <Package className="w-3 h-3" /> Otro Pack
                      </div>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Fallback pack selector (only when Al expirar = fallback_pack, not target mode) */}
            {getExpiryMode() === 'fallback_pack' && (normalized.activate_sprite_pack.targetMode || 'self') !== 'target' && (
              <Select
                value={normalized.activate_sprite_pack.fallbackPackId || ''}
                onValueChange={(v) => handleActivateSpritePackChange({ fallbackPackId: v })}
              >
                <SelectTrigger className="bg-background h-6 text-xs">
                  <SelectValue placeholder="Pack alternativo..." />
                </SelectTrigger>
                <SelectContent>
                  {availableSpritePacks?.filter(p => p.id !== normalized.activate_sprite_pack!.packId).map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </div>
    );
  }

  // Full mode
  return (
    <div className={cn("space-y-3", className)}>
      {/* Type selector and preview */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Label className="text-[10px] text-muted-foreground mb-1 block">Tipo de Recompensa</Label>
          <Select 
            value={normalized.type} 
            onValueChange={(v) => handleTypeChange(v as 'attribute' | 'trigger' | 'currency' | 'conditional_sprite_collection' | 'activate_sprite_pack')}
          >
            <SelectTrigger className="bg-background h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="attribute">
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4" />
                  Atributo
                </div>
              </SelectItem>
              <SelectItem value="trigger">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Trigger
                </div>
              </SelectItem>
              <SelectItem value="currency">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4" />
                  Divisa
                </div>
              </SelectItem>
              <SelectItem value="conditional_sprite_collection">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4" />
                  Col. Sprite Condicional
                </div>
              </SelectItem>
              <SelectItem value="activate_sprite_pack">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Sprite Pack
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Preview badge */}
        <div className="pt-5">
          <Badge variant="outline" className="text-xs">
            {describeReward(normalized)}
          </Badge>
        </div>
      </div>

      {/* ATTRIBUTE CONFIG */}
      {isAttribute && normalized.attribute && (
        <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-muted/30">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Key del Atributo</Label>
            <Input
              value={normalized.attribute.key}
              onChange={(e) => handleAttributeChange({ key: e.target.value })}
              placeholder="HP, oro, exp..."
              className="bg-background font-mono text-xs h-8"
              list={availableAttributes ? "attr-list" : undefined}
            />
            {availableAttributes && (
              <datalist id="attr-list">
                {availableAttributes.map(attr => (
                  <option key={attr} value={attr} />
                ))}
              </datalist>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Valor</Label>
            <Input
              type="number"
              value={normalized.attribute.value}
              onChange={(e) => handleAttributeChange({ value: Number(e.target.value) })}
              className="bg-background h-8"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Acción</Label>
            <Select 
              value={normalized.attribute.action} 
              onValueChange={(v) => handleAttributeChange({ action: v as AttributeAction })}
            >
              <SelectTrigger className="bg-background h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.symbol} {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* TRIGGER CONFIG */}
      {isTrigger && normalized.trigger && (
        <div className="space-y-3 p-3 rounded-lg bg-muted/30">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Categoría</Label>
              <Select 
                value={normalized.trigger.category} 
                onValueChange={(v) => handleTriggerChange({ category: v as TriggerCategory })}
              >
                <SelectTrigger className="bg-background h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <div className="flex items-center gap-2">
                        {cat.icon}
                        {cat.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Key del Trigger</Label>
              <Input
                value={normalized.trigger.key}
                onChange={(e) => handleTriggerChange({ key: e.target.value })}
                placeholder="feliz, victory, forest..."
                className="bg-background font-mono text-xs h-8"
                list={getTriggerDatalistId(normalized.trigger.category, availableTriggers)}
              />
              {availableTriggers && renderTriggerDatalist(normalized.trigger.category, availableTriggers)}
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Objetivo</Label>
              <Select 
                value={normalized.trigger.targetMode} 
                onValueChange={(v) => handleTriggerChange({ targetMode: v as TriggerTargetMode })}
              >
                <SelectTrigger className="bg-background h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_MODES.map(mode => (
                    <SelectItem key={mode.value} value={mode.value}>
                      <div className="flex items-center gap-2">
                        {mode.icon}
                        {mode.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Category-specific options */}
          {normalized.trigger.category === 'sprite' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Volver a Idle (ms)</Label>
                <Input
                  type="number"
                  min={0}
                  value={normalized.trigger.returnToIdleMs || 0}
                  onChange={(e) => handleTriggerChange({ returnToIdleMs: Number(e.target.value) })}
                  placeholder="0 = no volver"
                  className="bg-background h-8"
                />
              </div>
              <div className="flex items-end pb-1">
                <p className="text-[10px] text-muted-foreground">
                  0 = mantener sprite indefinidamente
                </p>
              </div>
            </div>
          )}

          {normalized.trigger.category === 'sound' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Volumen (0-1)</Label>
                <Input
                  type="number"
                  min={0}
                  max={1}
                  step={0.1}
                  value={normalized.trigger.volume ?? 0.8}
                  onChange={(e) => handleTriggerChange({ volume: Number(e.target.value) })}
                  className="bg-background h-8"
                />
              </div>
              <div className="flex items-end pb-1">
                <p className="text-[10px] text-muted-foreground">
                  Formato key: "coleccion/archivo"
                </p>
              </div>
            </div>
          )}

          {normalized.trigger.category === 'background' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Duración Transición (ms)</Label>
                <Input
                  type="number"
                  min={0}
                  value={normalized.trigger.transitionDuration ?? 500}
                  onChange={(e) => handleTriggerChange({ transitionDuration: Number(e.target.value) })}
                  className="bg-background h-8"
                />
              </div>
              <div className="flex items-end pb-1">
                <p className="text-[10px] text-muted-foreground">
                  Key puede ser URL o nombre
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CURRENCY CONFIG */}
      {isCurrency && normalized.currency && (
        <div className="p-3 rounded-lg bg-muted/30">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Cantidad</Label>
              <Input
                type="number"
                value={normalized.currency.amount}
                onChange={(e) => handleCurrencyChange({ amount: Number(e.target.value) })}
                className="bg-background h-8"
                placeholder="Ej: 50, 100, -10"
              />
            </div>
            <div className="flex items-end pb-1">
              <p className="text-[10px] text-muted-foreground">
                Cantidad positiva suma divisa a la persona. Negativa resta.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* CONDITIONAL SPRITE COLLECTION CONFIG */}
      {isConditionalSpriteCollection && normalized.conditional_sprite_collection && (
        <div className="space-y-3 p-3 rounded-lg bg-teal-500/10 border border-teal-500/20">
          <div className="text-xs text-teal-600 font-medium flex items-center gap-1">
            <GitBranch className="w-3.5 h-3.5" />
            Colección de Sprite Condicional
          </div>
          <p className="text-[10px] text-muted-foreground">
            Activa una colección de sprites que evalúa condiciones de atributos para seleccionar el sprite.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Colección</Label>
              <Select
                value={normalized.conditional_sprite_collection.collectionId}
                onValueChange={(v) => handleConditionalSpriteCollectionChange({ collectionId: v })}
              >
                <SelectTrigger className="bg-background h-8">
                  <SelectValue placeholder="Seleccionar colección..." />
                </SelectTrigger>
                <SelectContent>
                  {/* List conditional mode trigger collections */}
                  {availableConditionalCollections?.map(col => (
                    <SelectItem key={col.id} value={col.id}>
                      <div className="flex items-center gap-2">
                        <GitBranch className="w-3 h-3" />
                        {col.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Objetivo</Label>
              <Select
                value={normalized.conditional_sprite_collection.targetMode || 'self'}
                onValueChange={(v) => handleConditionalSpriteCollectionChange({ targetMode: v as TriggerTargetMode })}
              >
                <SelectTrigger className="bg-background h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_MODES.map(mode => (
                    <SelectItem key={mode.value} value={mode.value}>
                      <div className="flex items-center gap-2">
                        {mode.icon}
                        {mode.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Volver a Idle (ms)</Label>
              <Input
                type="number"
                min={0}
                value={normalized.conditional_sprite_collection.returnToIdleMs || 0}
                onChange={(e) => handleConditionalSpriteCollectionChange({ returnToIdleMs: Number(e.target.value) })}
                placeholder="0 = no volver"
                className="bg-background h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Modo Fallback</Label>
              <Select
                value={normalized.conditional_sprite_collection.fallbackMode || 'idle_collection'}
                onValueChange={(v) => handleConditionalSpriteCollectionChange({ fallbackMode: v as TriggerFallbackMode })}
              >
                <SelectTrigger className="bg-background h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="idle_collection">Colección Idle</SelectItem>
                  <SelectItem value="custom_sprite">Sprite Personalizado</SelectItem>
                  <SelectItem value="collection_default">Default de Colección</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVATE SPRITE PACK CONFIG */}
      {isActivateSpritePack && normalized.activate_sprite_pack && (
        <div className="space-y-3 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
          <div className="text-xs text-purple-600 font-medium flex items-center gap-1">
            <Package className="w-3.5 h-3.5" />
            Activar Sprite Pack
          </div>
          <p className="text-[10px] text-muted-foreground">
            Activa un Sprite Pack. Si el pack tiene modo condicional, evaluará las condiciones de cada sprite para seleccionar el correcto.
          </p>
          
          {/* Target Mode */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Objetivo</Label>
            <Select
              value={normalized.activate_sprite_pack.targetMode || 'self'}
              onValueChange={(v) => handleActivateSpritePackChange({ 
                targetMode: v as TriggerTargetMode,
                targetCharacterId: v === 'target' ? normalized.activate_sprite_pack!.targetCharacterId : undefined,
                targetPackId: v === 'target' ? normalized.activate_sprite_pack!.targetPackId : undefined,
                fallbackPackId: v !== 'target' ? normalized.activate_sprite_pack!.fallbackPackId : undefined,
              })}
            >
              <SelectTrigger className="bg-background h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGET_MODES.map(mode => (
                  <SelectItem key={mode.value} value={mode.value}>
                    <div className="flex items-center gap-2">
                      {mode.icon}
                      {mode.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* SELF mode: Select own sprite pack */}
          {(normalized.activate_sprite_pack.targetMode || 'self') === 'self' && (
            <div className="space-y-2 p-2 rounded-md bg-purple-500/5 border border-purple-500/10">
              <div className="text-[10px] text-purple-500 font-medium">Activar en sí mismo</div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Sprite Pack</Label>
                <Select
                  value={normalized.activate_sprite_pack.packId}
                  onValueChange={(v) => handleActivateSpritePackChange({ packId: v })}
                >
                  <SelectTrigger className="bg-background h-8">
                    <SelectValue placeholder="Seleccionar pack..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSpritePacks?.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex items-center gap-2">
                          <Package className="w-3 h-3" />
                          {p.name}
                          {p.conditionalMode && (
                            <span className="text-[9px] text-purple-500">(condicional)</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* ALL mode */}
          {(normalized.activate_sprite_pack.targetMode) === 'all' && (
            <div className="space-y-2 p-2 rounded-md bg-purple-500/5 border border-purple-500/10">
              <div className="text-[10px] text-purple-500 font-medium">Activar en todos los personajes</div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Sprite Pack</Label>
                <Select
                  value={normalized.activate_sprite_pack.packId}
                  onValueChange={(v) => handleActivateSpritePackChange({ packId: v })}
                >
                  <SelectTrigger className="bg-background h-8">
                    <SelectValue placeholder="Seleccionar pack..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSpritePacks?.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex items-center gap-2">
                          <Package className="w-3 h-3" />
                          {p.name}
                          {p.conditionalMode && (
                            <span className="text-[9px] text-purple-500">(condicional)</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* TARGET mode: Select character + their sprite pack */}
          {(normalized.activate_sprite_pack.targetMode) === 'target' && (
            <div className="space-y-2 p-2 rounded-md bg-blue-500/5 border border-blue-500/10">
              <div className="text-[10px] text-blue-500 font-medium">Activar en personaje objetivo</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Personaje objetivo</Label>
                  <Select
                    value={normalized.activate_sprite_pack.targetCharacterId || ''}
                    onValueChange={(v) => handleActivateSpritePackChange({ targetCharacterId: v, targetPackId: undefined })}
                  >
                    <SelectTrigger className="bg-background h-8">
                      <SelectValue placeholder="Seleccionar personaje..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTargets && availableTargets.length > 0 ? (
                        availableTargets.map(t => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.id === '__user__' ? '👤 ' : '🎭 '}{t.name}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                          No hay otros personajes disponibles
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Sprite Pack del objetivo</Label>
                  <Select
                    value={normalized.activate_sprite_pack.targetPackId || ''}
                    onValueChange={(v) => handleActivateSpritePackChange({ targetPackId: v })}
                  >
                    <SelectTrigger className="bg-background h-8">
                      <SelectValue placeholder="Seleccionar pack..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(() => {
                        const sel = availableTargets?.find(t => t.id === normalized.activate_sprite_pack!.targetCharacterId);
                        const packs = sel?.spritePacks || [];
                        return packs.length > 0 ? (
                          packs.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              <div className="flex items-center gap-2">
                                <Package className="w-3 h-3" />
                                {p.name} ({p.spriteCount})
                                {p.conditionalMode && (
                                  <span className="text-[9px] text-purple-500">(cond.)</span>
                                )}
                              </div>
                            </SelectItem>
                          ))
                        ) : (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">
                            {normalized.activate_sprite_pack!.targetCharacterId 
                              ? 'Este personaje no tiene sprite packs' 
                              : 'Selecciona un personaje primero'}
                          </div>
                        );
                      })()}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {!normalized.activate_sprite_pack.targetCharacterId && (
                <p className="text-[10px] text-muted-foreground italic">Selecciona un personaje objetivo para ver sus sprite packs disponibles</p>
              )}
            </div>
          )}

          {/* Comportamiento al expirar */}
          <div className="space-y-2 p-2 rounded-md bg-muted/20 border border-muted/30">
            <div className="text-[10px] text-muted-foreground font-medium">
              Comportamiento al expirar
            </div>
            <p className="text-[9px] text-muted-foreground">
              Define qué sucede cuando la activación del sprite pack termina
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Duración (ms)</Label>
                <Input
                  type="number"
                  min={0}
                  value={normalized.activate_sprite_pack.returnToIdleMs || 0}
                  onChange={(e) => handleActivateSpritePackChange({ returnToIdleMs: Number(e.target.value) })}
                  placeholder="0 = indefinido"
                  className="bg-background h-8"
                />
                <p className="text-[9px] text-muted-foreground">0 = el sprite se mantiene indefinidamente</p>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Al expirar</Label>
                <Select
                  value={getExpiryMode()}
                  onValueChange={handleExpiryModeChange}
                >
                  <SelectTrigger className="bg-background h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="idle_collection">
                      <div className="flex items-center gap-2">
                        <span>↩️</span> Volver a estado Idle
                      </div>
                    </SelectItem>
                    <SelectItem value="collection_default">
                      <div className="flex items-center gap-2">
                        <span>⭐</span> Default del Pack
                      </div>
                    </SelectItem>
                    {(normalized.activate_sprite_pack.targetMode || 'self') !== 'target' && (
                      <SelectItem value="fallback_pack">
                        <div className="flex items-center gap-2">
                          <Package className="w-3 h-3" /> Activar otro Pack
                        </div>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-[9px] text-muted-foreground">Qué hacer cuando la activación expira</p>
              </div>
            </div>
            {getExpiryMode() === 'fallback_pack' && (normalized.activate_sprite_pack.targetMode || 'self') !== 'target' && (
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Pack alternativo</Label>
                <Select
                  value={normalized.activate_sprite_pack.fallbackPackId || ''}
                  onValueChange={(v) => handleActivateSpritePackChange({ fallbackPackId: v })}
                >
                  <SelectTrigger className="bg-background h-8">
                    <SelectValue placeholder="Seleccionar pack alternativo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSpritePacks?.filter(p => p.id !== normalized.activate_sprite_pack!.packId).map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex items-center gap-2">
                          <Package className="w-3 h-3" />
                          {p.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ID field (collapsible) */}
      {showIdField && (
        <details className="group">
          <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1">
            <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
            ID: {reward.id}
          </summary>
          <div className="mt-2">
            <Input
              value={reward.id}
              onChange={(e) => onChange({ ...reward, id: e.target.value })}
              className="bg-background font-mono text-xs h-7"
            />
          </div>
        </details>
      )}
    </div>
  );
}

// ============================================
// Helper Functions
// ============================================

function getTriggerDatalistId(
  category: TriggerCategory,
  availableTriggers?: RewardEditorProps['availableTriggers']
): string | undefined {
  if (!availableTriggers) return undefined;
  return `trigger-list-${category}`;
}

function renderTriggerDatalist(
  category: TriggerCategory,
  availableTriggers: NonNullable<RewardEditorProps['availableTriggers']>
): React.ReactNode {
  const triggers = category === 'sprite' 
    ? availableTriggers.sprites 
    : category === 'sound' 
      ? availableTriggers.sounds 
      : availableTriggers.backgrounds;
  
  if (!triggers?.length) return null;
  
  return (
    <datalist id={`trigger-list-${category}`}>
      {triggers.map(trigger => (
        <option key={trigger} value={trigger} />
      ))}
    </datalist>
  );
}

// ============================================
// Exports
// ============================================

export default RewardEditor;
