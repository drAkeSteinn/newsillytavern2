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
  AttributeAction,
  TriggerCategory,
  TriggerTargetMode,
} from '@/types';
import {
  normalizeReward,
  describeReward,
  createAttributeReward,
  createTriggerReward,
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
  isGroupChat = false,
  compact = false,
  className,
  showIdField = false,
}: RewardEditorProps) {
  // Normalizar reward para obtener valores actuales
  const normalized = normalizeReward(reward);
  const isAttribute = normalized.type === 'attribute';
  const isTrigger = normalized.type === 'trigger';

  // Handlers
  const handleTypeChange = (newType: 'attribute' | 'trigger') => {
    if (newType === normalized.type) return;

    let newReward: QuestReward;
    if (newType === 'attribute') {
      newReward = createAttributeReward(
        normalized.attribute?.key || normalized.key || '',
        normalized.attribute?.value ?? normalized.value ?? 0,
        normalized.attribute?.action || 'add',
        { id: reward.id }
      );
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

  // Compact mode
  if (compact) {
    return (
      <div className={cn("p-2 rounded bg-muted/20 space-y-2", className)}>
        {/* Tipo y preview */}
        <div className="flex items-center gap-2">
          <Select 
            value={normalized.type} 
            onValueChange={(v) => handleTypeChange(v as 'attribute' | 'trigger')}
          >
            <SelectTrigger className="bg-background h-6 text-xs w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="attribute">📊 Atributo</SelectItem>
              <SelectItem value="trigger">⚡ Trigger</SelectItem>
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
            onValueChange={(v) => handleTypeChange(v as 'attribute' | 'trigger')}
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
