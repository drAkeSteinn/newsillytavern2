'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Coins,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Shield,
  Clock,
  GripVertical,
  FlaskConical,
  X,
  Sword,
  Backpack,
} from 'lucide-react';
import { useTavernStore } from '@/store/tavern-store';
import type {
  Item,
  ActiveConsumableEffect,
} from '@/types';
import {
  getRarityColor,
  getItemTypeIcon,
  getItemTypeLabel,
} from '@/store/slices/inventorySlice';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================
// Constants
// ============================================

const HUD_STORAGE_KEY = 'tavernflow-inventory-hud-position';
const DEFAULT_POSITION = { x: 16, y: 16 };

// ============================================
// Helper - load/save HUD position from localStorage
// ============================================

function loadPosition(): { x: number; y: number } {
  if (typeof window === 'undefined') return DEFAULT_POSITION;
  try {
    const saved = localStorage.getItem(HUD_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {}
  return DEFAULT_POSITION;
}

function savePosition(pos: { x: number; y: number }) {
  try {
    localStorage.setItem(HUD_STORAGE_KEY, JSON.stringify(pos));
  } catch {}
}

// ============================================
// Compact Effect Row (with expire button)
// ============================================

function CompactEffectRow({
  effect,
  onExpire,
}: {
  effect: ActiveConsumableEffect;
  onExpire: () => void;
}) {
  return (
    <div className="group flex items-center gap-1 text-xs py-0.5 rounded px-0.5 hover:bg-amber-500/10 transition-colors">
      <Clock className="w-3 h-3 text-amber-500 shrink-0" />
      <span className="truncate font-medium text-amber-600 dark:text-amber-400">
        {effect.itemName}
      </span>
      <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 shrink-0">
        {effect.remainingTurns}t
      </Badge>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onExpire();
        }}
        className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
        title="Expirar efecto"
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </div>
  );
}

// ============================================
// Compact Equipped Item (clickable to unequip)
// ============================================

function CompactEquippedItem({
  item,
  onUnequip,
}: {
  item: Item;
  onUnequip: () => void;
}) {
  const icon = item.icon || getItemTypeIcon(item.type || 'equipment');
  const rarityColor = getRarityColor(item.rarity);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            className={cn(
              'w-6 h-6 rounded flex items-center justify-center text-sm cursor-pointer',
              'hover:ring-1 hover:ring-primary/50 hover:bg-muted/80',
              'transition-all duration-150',
              rarityColor
            )}
            title="Click para desequipar"
            onClick={(e) => {
              e.stopPropagation();
              onUnequip();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onUnequip();
              }
            }}
          >
            {icon}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <p className={cn('font-semibold', rarityColor)}>{item.name}</p>
          <p className="text-muted-foreground">{getItemTypeLabel(item.type || 'equipment')}</p>
          {item.slot && <p className="text-muted-foreground">Slot: {item.slot}</p>}
          <p className="text-primary font-medium mt-0.5">Click para desequipar</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================
// Inventory HUD Component
// ============================================

export function InventoryHUD() {
  const {
    activeConsumableEffects,
    inventorySettings,
    getActivePersona,
    getPersonaItems,
    getEquippedItems,
    removeEffect,
    equipItem,
    unequipItem,
    useConsumable: consumeItem,
  } = useTavernStore();

  const [expanded, setExpanded] = useState(false);
  const [position, setPosition] = useState(loadPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const hudRef = useRef<HTMLDivElement>(null);

  // Draggable handlers - must be declared before any early returns
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('[data-grip]')) return;

    e.preventDefault();
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [position]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    e.preventDefault();

    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;

    const newX = Math.max(0, dragStart.current.posX + dx);
    const newY = Math.max(0, dragStart.current.posY + dy);

    setPosition({ x: newX, y: newY });
  }, [isDragging]);

  const handlePointerUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      savePosition(position);
    }
  }, [isDragging, position]);

  // Get persona data
  const persona = getActivePersona();
  const personaId = persona?.id ?? '';

  const personaItems = personaId ? getPersonaItems(personaId) : [];
  const equippedItems = personaId ? getEquippedItems(personaId) : [];
  const activeEffects = activeConsumableEffects.filter(e => e.personaId === personaId);

  // Separate unequipped items for the backpack section
  const unequippedItems = personaItems.filter(({ entry }) => !entry.equipped);

  // Action handlers
  const handleEquipItem = useCallback((itemId: string) => {
    if (!personaId) return;
    equipItem(personaId, itemId);
  }, [personaId, equipItem]);

  const handleUnequipItem = useCallback((itemId: string) => {
    if (!personaId) return;
    unequipItem(personaId, itemId);
  }, [personaId, unequipItem]);

  const handleUseConsumable = useCallback((itemId: string) => {
    if (!personaId) return;
    consumeItem(personaId, itemId);
  }, [personaId, consumeItem]);

  const handleExpireEffect = useCallback((effectId: string) => {
    removeEffect(effectId);
  }, [removeEffect]);

  // Determine action for an inventory item based on type and equipped state
  const getItemAction = useCallback((item: Item, equipped: boolean): {
    action: () => void;
    tooltip: string;
  } => {
    if (item.type === 'consumable') {
      return {
        action: () => handleUseConsumable(item.id),
        tooltip: 'Click para usar',
      };
    }
    if (equipped) {
      return {
        action: () => handleUnequipItem(item.id),
        tooltip: 'Click para desequipar',
      };
    }
    return {
      action: () => handleEquipItem(item.id),
      tooltip: 'Click para equipar',
    };
  }, [handleUseConsumable, handleUnequipItem, handleEquipItem]);

  // Don't render if disabled or no persona
  if (!inventorySettings.showInChat || !persona) return null;

  return (
    <div
      ref={hudRef}
      className={cn(
        'fixed z-30 select-none',
        isDragging && 'cursor-grabbing'
      )}
      style={{
        left: position.x,
        top: position.y,
        width: '200px',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <motion.div
        layout
        className={cn(
          'rounded-lg border shadow-lg backdrop-blur-md',
          'bg-background/80 border-border/50',
          'overflow-hidden'
        )}
        initial={false}
        animate={{ opacity: 1 }}
      >
        {/* Header - Always visible, draggable */}
        <div
          data-grip
          className={cn(
            'flex items-center gap-1.5 px-2 py-1.5 cursor-grab active:cursor-grabbing',
            'bg-muted/50 border-b border-border/30'
          )}
        >
          <GripVertical className="w-3 h-3 text-muted-foreground shrink-0" />
          <Coins className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="font-bold text-sm">{persona.currency ?? 0}</span>
          <span className="text-[10px] text-muted-foreground truncate">{persona.currencyName || 'Divisa'}</span>

          {activeEffects.length > 0 && (
            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 ml-1 shrink-0">
              <Sparkles className="w-2.5 h-2.5 mr-0.5 text-amber-500" />
              {activeEffects.length}
            </Badge>
          )}

          {equippedItems.length > 0 && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 shrink-0">
              <Shield className="w-2.5 h-2.5 mr-0.5" />
              {equippedItems.length}
            </Badge>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="h-4 w-4 p-0 ml-auto shrink-0"
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          >
            {expanded ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </Button>
        </div>

        {/* Expanded Content */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="p-2 space-y-2">
                {/* Active Effects */}
                {activeEffects.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase">
                        Efectos
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {activeEffects.map(effect => (
                        <CompactEffectRow
                          key={effect.id}
                          effect={effect}
                          onExpire={() => handleExpireEffect(effect.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Equipped Items (clickable to unequip) */}
                {equippedItems.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <Shield className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                        Equipo
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {equippedItems.map(({ item }) => (
                        <CompactEquippedItem
                          key={item.id}
                          item={item}
                          onUnequip={() => handleUnequipItem(item.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Backpack - Unequipped Items (clickable to use/equip) */}
                {unequippedItems.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <Backpack className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                        Mochila ({unequippedItems.length})
                      </span>
                    </div>
                    <div className="space-y-0.5 max-h-32 overflow-y-auto">
                      {unequippedItems.map(({ entry, item }) => {
                        const icon = item.icon || getItemTypeIcon(item.type || 'consumable');
                        const rarityColor = getRarityColor(item.rarity);
                        const { action, tooltip } = getItemAction(item, false);
                        const isConsumable = item.type === 'consumable';

                        return (
                          <div
                            key={entry.itemId}
                            role="button"
                            tabIndex={0}
                            className={cn(
                              'flex items-center gap-1 text-[10px] rounded px-1 py-0.5',
                              'cursor-pointer hover:bg-muted/80',
                              'transition-colors duration-150',
                              'hover:ring-1 hover:ring-primary/30'
                            )}
                            title={tooltip}
                            onClick={(e) => {
                              e.stopPropagation();
                              action();
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                action();
                              }
                            }}
                          >
                            <span className="text-xs">{icon}</span>
                            <span className={cn('truncate', rarityColor)}>{item.name}</span>
                            {entry.quantity > 1 && (
                              <span className="text-muted-foreground shrink-0">x{entry.quantity}</span>
                            )}
                            {/* Action hint icon */}
                            {isConsumable ? (
                              <FlaskConical className="w-2.5 h-2.5 text-amber-500/60 shrink-0 ml-auto" />
                            ) : (
                              <Sword className="w-2.5 h-2.5 text-muted-foreground/60 shrink-0 ml-auto" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {activeEffects.length === 0 && equippedItems.length === 0 && unequippedItems.length === 0 && (
                  <p className="text-[10px] text-muted-foreground text-center py-2">
                    Inventario vacío
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

export default InventoryHUD;
