'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  FlaskConical,
  Shield,
  Sparkles,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  Item,
  PersonaInventoryEntry,
  ItemRarity,
  ItemAttributeEffect,
  EquipmentSlotDefinition,
} from '@/types';
import {
  getRarityColor,
  getRarityBgColor,
  getItemTypeIcon,
  getItemTypeLabel,
} from '@/store/slices/inventorySlice';

// ============================================
// Constants
// ============================================

const RARITY_LABELS: Record<ItemRarity, string> = {
  common: 'Común',
  uncommon: 'Poco común',
  rare: 'Raro',
  epic: 'Épico',
  legendary: 'Legendario',
  unique: 'Único',
  cursed: 'Maldito',
};

const OPERATOR_LABELS: Record<string, string> = {
  '+': '+',
  '-': '−',
  '*': '×',
  '/': '÷',
  '=': '=',
  set_min: 'mín',
  set_max: 'máx',
};

// ============================================
// Helper
// ============================================

function formatEffectDescription(effect: ItemAttributeEffect): string {
  const op = OPERATOR_LABELS[effect.operator] ?? effect.operator;
  const target = effect.targetId === '__user__' ? '' : ` → ${effect.targetName || effect.targetId}`;
  const attr = effect.attributeName || effect.attributeKey;
  const modePrefix = effect.mode === 'dynamic' ? '🔄/turno ' : '';
  return `${modePrefix}${op}${effect.value} ${attr}${target}`;
}

// ============================================
// Item Card Component
// ============================================

interface ItemCardProps {
  item: Item;
  entry?: PersonaInventoryEntry;
  showQuantity?: boolean;
  showActions?: boolean;
  compact?: boolean;
  equipmentSlots?: EquipmentSlotDefinition[];
  onUse?: () => void;
  onEquip?: () => void;
  onUnequip?: () => void;
  onRemove?: () => void;
  onEdit?: () => void;
}

export function ItemCard({
  item,
  entry,
  showQuantity = true,
  showActions = true,
  compact = false,
  equipmentSlots = [],
  onUse,
  onEquip,
  onUnequip,
  onRemove,
  onEdit,
}: ItemCardProps) {
  const [expanded, setExpanded] = useState(false);

  const rarityColor = getRarityColor(item.rarity);
  const rarityBg = getRarityBgColor(item.rarity);
  const typeIcon = item.icon || getItemTypeIcon(item.type || 'consumable');
  const typeLabel = getItemTypeLabel(item.type || 'consumable');
  const quantity = entry?.quantity ?? 1;
  const isEquipped = entry?.equipped ?? false;
  const isConsumable = item.type === 'consumable';
  const isEquipment = item.type === 'equipment';

  // Compact mode - single line with tooltip
  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-md',
                'bg-muted/50 hover:bg-muted transition-colors cursor-pointer',
                isEquipped && 'ring-1 ring-primary'
              )}
            >
              <span className="text-base shrink-0">{typeIcon}</span>
              <span className={cn('text-sm font-medium truncate', rarityColor)}>
                {item.name}
              </span>
              {showQuantity && quantity > 1 && (
                <Badge variant="secondary" className="text-xs ml-auto shrink-0">
                  x{quantity}
                </Badge>
              )}
              {isEquipped && (
                <Shield className="w-3 h-3 text-primary ml-auto shrink-0" />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <div className="space-y-1">
              <p className={cn('font-semibold', rarityColor)}>{item.name}</p>
              <p className="text-xs text-muted-foreground">
                {typeLabel} • {RARITY_LABELS[item.rarity]}
              </p>
              {item.description && (
                <p className="text-xs text-muted-foreground">{item.description}</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full card mode
  return (
    <div
      className={cn(
        'rounded-lg border transition-all',
        rarityBg,
        isEquipped && 'ring-2 ring-primary/50',
        'hover:shadow-sm'
      )}
    >
      {/* Header Row */}
      <div
        className="flex items-center gap-2.5 p-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Icon */}
        <div
          className={cn(
            'w-9 h-9 rounded-md flex items-center justify-center text-lg shrink-0',
            rarityBg
          )}
        >
          {typeIcon}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={cn('font-semibold text-sm truncate', rarityColor)}>
              {item.name}
            </span>
            {isEquipped && (
              <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                Equipado
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Badge
              variant={isConsumable ? 'secondary' : 'outline'}
              className="text-[10px] px-1.5 py-0 h-4"
            >
              {isConsumable ? (
                <FlaskConical className="w-2.5 h-2.5 mr-0.5" />
              ) : (
                <Shield className="w-2.5 h-2.5 mr-0.5" />
              )}
              {typeLabel}
            </Badge>
            <span className="capitalize">{RARITY_LABELS[item.rarity]}</span>
            {showQuantity && quantity > 1 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                x{quantity}
              </Badge>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        {showActions && (
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {isConsumable && onUse && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={onUse}
                title="Usar consumible"
              >
                <FlaskConical className="w-3.5 h-3.5 mr-1" />
                Usar
              </Button>
            )}
            {isEquipment && !isEquipped && onEquip && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={onEquip}
                title="Equipar"
              >
                <Shield className="w-3.5 h-3.5 mr-1" />
                Equipar
              </Button>
            )}
            {isEquipment && isEquipped && onUnequip && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={onUnequip}
                title="Desequipar"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Quitar
              </Button>
            )}
          </div>
        )}

        {/* Expand indicator */}
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-3 pb-3 pt-0 space-y-2 text-sm border-t border-border/30">
          {/* Description */}
          {item.description && (
            <p className="text-muted-foreground pt-2">{item.description}</p>
          )}

          {/* Slot-based Effects (Equipment) */}
          {isEquipment && item.slotEffects && item.slotEffects.length > 0 && (
            <div className="space-y-1">
              <h5 className="text-xs font-semibold text-muted-foreground uppercase">
                Efectos por Slot
              </h5>
              <div className="space-y-1">
                {item.slotEffects.map((slotEffect, i) => {
                  const slotDef = equipmentSlots.find(s => s.id === slotEffect.slotId);
                  return (
                    <div key={i} className="rounded border bg-muted/30 px-2 py-1.5 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{slotDef?.icon || '📦'}</span>
                        <span className="text-xs font-medium">{slotEffect.slotName || slotDef?.name || slotEffect.slotId}</span>
                        {slotDef && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-mono">
                            {`{{${slotDef.key}}}`}
                          </Badge>
                        )}
                      </div>
                      {slotEffect.effectText && (
                        <p className="text-xs text-muted-foreground pl-5">{slotEffect.effectText}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Consumable Effect */}
          {isConsumable && item.consumableEffect && (
            <div className="space-y-1">
              <h5 className="text-xs font-semibold text-muted-foreground uppercase">
                Efecto
              </h5>
              <p className="text-xs text-muted-foreground">{item.consumableEffect}</p>
            </div>
          )}

          {/* Legacy Attribute Effects (backward compat) */}
          {item.attributeEffects && item.attributeEffects.length > 0 && !(item.slotEffects && item.slotEffects.length > 0) && !item.consumableEffect && (
            <div className="space-y-1">
              <h5 className="text-xs font-semibold text-muted-foreground uppercase">
                Efectos
              </h5>
              <div className="space-y-0.5">
                {item.attributeEffects.map((effect, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs">
                    <Sparkles className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span>{formatEffectDescription(effect)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Equipment Slot */}
          {isEquipment && item.slot && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Slot:</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                {equipmentSlots.find(s => s.id === item.slot)?.name || item.slot}
              </Badge>
            </div>
          )}

          {/* Duration (Consumable) */}
          {isConsumable && item.duration && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Duración:</span>
              <span>{item.duration} turno{item.duration !== 1 ? 's' : ''}</span>
            </div>
          )}

          {/* Price */}
          {item.price !== undefined && item.price > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Precio:</span>
              <span className="font-medium">{item.price} 💰</span>
            </div>
          )}

          {/* Action buttons row */}
          {(onRemove || onEdit) && (
            <div className="flex justify-end gap-1.5 pt-1">
              {onEdit && (
                <Button variant="outline" size="sm" className="h-6 text-xs" onClick={onEdit}>
                  Editar
                </Button>
              )}
              {onRemove && (
                <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive" onClick={onRemove}>
                  <Trash2 className="w-3 h-3 mr-1" />
                  Eliminar
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Compact Item List Component
// ============================================

interface ItemListProps {
  items: Array<{ item: Item; entry?: PersonaInventoryEntry }>;
  onItemClick?: (item: Item, entry?: PersonaInventoryEntry) => void;
  showQuantity?: boolean;
  equipmentSlots?: EquipmentSlotDefinition[];
}

export function ItemList({ items, onItemClick, showQuantity = true, equipmentSlots = [] }: ItemListProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">Inventario vacío</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {items.map(({ item, entry }) => (
        <ItemCard
          key={entry?.itemId || item.id}
          item={item}
          entry={entry}
          compact
          showQuantity={showQuantity}
          equipmentSlots={equipmentSlots}
          onEdit={onItemClick ? () => onItemClick(item, entry) : undefined}
        />
      ))}
    </div>
  );
}

export default ItemCard;
