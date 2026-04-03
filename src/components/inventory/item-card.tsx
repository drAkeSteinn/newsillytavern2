'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Sword,
  Shield,
  Gem,
  Package,
  Key,
  BookOpen,
  Wrench,
  Shirt,
  HelpCircle,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Star,
} from 'lucide-react';
import type { 
  Item, 
  InventoryEntry, 
  ItemRarity, 
  ItemCategory,
  ItemSlot,
} from '@/types';
import { getRarityColor, getCategoryIcon } from '@/store/slices/inventorySlice';

// ============================================
// Helper Functions
// ============================================

function getRarityBadgeVariant(rarity: ItemRarity): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (rarity) {
    case 'legendary':
    case 'unique':
      return 'default';
    case 'epic':
    case 'cursed':
      return 'secondary';
    case 'rare':
      return 'outline';
    default:
      return 'secondary';
  }
}

function getSlotLabel(slot: ItemSlot): string {
  const labels: Record<ItemSlot, string> = {
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
    none: 'Sin Slot',
  };
  return labels[slot];
}

// ============================================
// Item Card Component
// ============================================

interface ItemCardProps {
  item: Item;
  entry?: InventoryEntry;
  showQuantity?: boolean;
  showDetails?: boolean;
  compact?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onEquip?: () => void;
  onUnequip?: () => void;
  onUse?: () => void;
}

export function ItemCard({
  item,
  entry,
  showQuantity = true,
  showDetails = true,
  compact = false,
  onEdit,
  onDelete,
  onEquip,
  onUnequip,
  onUse,
}: ItemCardProps) {
  const [expanded, setExpanded] = useState(false);
  
  const rarityColor = getRarityColor(item.rarity);
  const categoryIcon = getCategoryIcon(item.category);
  
  const quantity = entry?.quantity ?? 1;
  const isEquipped = entry?.equipped ?? false;
  
  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div 
              className={`
                flex items-center gap-2 px-2 py-1.5 rounded-md 
                bg-muted/50 hover:bg-muted transition-colors cursor-pointer
                ${isEquipped ? 'ring-1 ring-primary' : ''}
              `}
            >
              <span className="text-base">{categoryIcon}</span>
              <span className={`text-sm font-medium truncate ${rarityColor}`}>
                {item.name}
              </span>
              {showQuantity && quantity > 1 && (
                <Badge variant="secondary" className="text-xs ml-auto">
                  x{quantity}
                </Badge>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <div className="space-y-1">
              <p className={`font-semibold ${rarityColor}`}>{item.name}</p>
              {item.description && (
                <p className="text-xs text-muted-foreground">{item.description}</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  return (
    <Card className={`
      overflow-hidden transition-all hover:shadow-md
      ${isEquipped ? 'ring-2 ring-primary' : ''}
    `}>
      {/* Header */}
      <div 
        className={`
          flex items-center gap-3 p-3 cursor-pointer
          ${expanded ? 'border-b' : ''}
        `}
        onClick={() => showDetails && setExpanded(!expanded)}
      >
        {/* Icon */}
        <div className={`
          w-10 h-10 rounded-lg flex items-center justify-center text-xl
          ${item.rarity === 'legendary' ? 'bg-amber-500/20' : ''}
          ${item.rarity === 'unique' ? 'bg-red-500/20' : ''}
          ${item.rarity === 'epic' ? 'bg-purple-500/20' : ''}
          ${item.rarity === 'rare' ? 'bg-blue-500/20' : ''}
          ${item.rarity === 'uncommon' ? 'bg-green-500/20' : ''}
          ${item.rarity === 'common' ? 'bg-gray-500/20' : ''}
          ${item.rarity === 'cursed' ? 'bg-fuchsia-500/20' : ''}
        `}>
          {item.icon || categoryIcon}
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className={`font-semibold truncate ${rarityColor}`}>
              {entry?.customName || item.name}
            </h4>
            {isEquipped && (
              <Badge variant="default" className="text-xs">
                Equipado
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="capitalize">{item.category}</span>
            <span>•</span>
            <span className="capitalize">{item.rarity}</span>
            {showQuantity && quantity > 1 && (
              <>
                <span>•</span>
                <span>x{quantity}</span>
              </>
            )}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1">
          {onEquip && !isEquipped && item.equippable && (
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onEquip(); }}>
              <Sparkles className="w-4 h-4" />
            </Button>
          )}
          {onUnequip && isEquipped && (
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onUnequip(); }}>
              <Shield className="w-4 h-4" />
            </Button>
          )}
          {onUse && item.usable && (
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onUse(); }}>
              <Package className="w-4 h-4" />
            </Button>
          )}
          {showDetails && (
            expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                     : <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>
      
      {/* Expanded Details */}
      {expanded && (
        <CardContent className="pt-3 space-y-3">
          {/* Description */}
          {item.description && (
            <p className="text-sm text-muted-foreground">
              {entry?.customDescription || item.description}
            </p>
          )}
          
          {/* Stats */}
          {item.stats && item.stats.length > 0 && (
            <div className="space-y-1">
              <h5 className="text-xs font-semibold text-muted-foreground uppercase">
                Estadísticas
              </h5>
              <div className="grid grid-cols-2 gap-1">
                {item.stats.map((stat, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{stat.name}</span>
                    <span className="font-medium">
                      {stat.isPercentage ? `${stat.value}%` : stat.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Effects */}
          {item.effects && item.effects.length > 0 && (
            <div className="space-y-1">
              <h5 className="text-xs font-semibold text-muted-foreground uppercase">
                Efectos
              </h5>
              <div className="space-y-1">
                {item.effects.map((effect, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="text-xs capitalize">
                      {effect.type}
                    </Badge>
                    <span>{effect.name}</span>
                    {effect.value && (
                      <span className="text-muted-foreground">({effect.value})</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Equipment Slot */}
          {item.equippable && item.slot && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Slot:</span>
              <Badge variant="secondary">{getSlotLabel(item.slot)}</Badge>
            </div>
          )}
          
          {/* Value */}
          {item.value !== undefined && (
            <div className="flex items-center gap-2 text-sm">
              <Gem className="w-4 h-4 text-amber-500" />
              <span className="text-muted-foreground">Valor:</span>
              <span className="font-medium">{item.value}</span>
            </div>
          )}
          
          {/* Entry-specific info */}
          {entry && (
            <div className="pt-2 border-t text-xs text-muted-foreground">
              <p>Obtenido: {new Date(entry.obtainedAt).toLocaleDateString()}</p>
              {entry.notes && <p className="mt-1 italic">{entry.notes}</p>}
            </div>
          )}
          
          {/* Action Buttons */}
          {(onEdit || onDelete) && (
            <div className="flex justify-end gap-2 pt-2 border-t">
              {onEdit && (
                <Button variant="outline" size="sm" onClick={onEdit}>
                  <Edit3 className="w-4 h-4 mr-1" />
                  Editar
                </Button>
              )}
              {onDelete && (
                <Button variant="destructive" size="sm" onClick={onDelete}>
                  <Trash2 className="w-4 h-4 mr-1" />
                  Eliminar
                </Button>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ============================================
// Compact Item List Component
// ============================================

interface ItemListProps {
  items: Array<{ item: Item; entry?: InventoryEntry }>;
  onItemClick?: (item: Item, entry?: InventoryEntry) => void;
  showQuantity?: boolean;
}

export function ItemList({ items, onItemClick, showQuantity = true }: ItemListProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>Inventario vacío</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-1">
      {items.map(({ item, entry }) => (
        <ItemCard
          key={entry?.id || item.id}
          item={item}
          entry={entry}
          compact
          showQuantity={showQuantity}
          onEdit={onItemClick ? () => onItemClick(item, entry) : undefined}
        />
      ))}
    </div>
  );
}

// ============================================
// Export
// ============================================

export default ItemCard;
