'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
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
  ArrowRight,
} from 'lucide-react';
import { useTavernStore } from '@/store/tavern-store';
import type {
  Item,
  ActiveConsumableEffect,
  EquipmentSlotDefinition,
  ItemSlotEffect,
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

/**
 * Get display name for a slot ID by looking up EquipmentSlotDefinition
 */
function getSlotDisplayName(
  slotId: string | undefined,
  equipmentSlots: EquipmentSlotDefinition[]
): string | null {
  if (!slotId) return null;
  const slotDef = equipmentSlots.find(s => s.id === slotId);
  return slotDef?.name || null;
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
  equippedSlotId,
  equipmentSlots,
  onUnequip,
}: {
  item: Item;
  equippedSlotId?: string;
  equipmentSlots: EquipmentSlotDefinition[];
  onUnequip: () => void;
}) {
  const icon = item.icon || getItemTypeIcon(item.type || 'equipment');
  const rarityColor = getRarityColor(item.rarity);
  const slotDisplayName = getSlotDisplayName(equippedSlotId, equipmentSlots);

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
          {slotDisplayName && <p className="text-muted-foreground">Slot: {slotDisplayName}</p>}
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
  // Use individual selectors to avoid subscribing to the entire store
  const activeSessionId = useTavernStore(state => state.activeSessionId);
  const sessions = useTavernStore(state => state.sessions);
  const inventorySettings = useTavernStore(state => state.inventorySettings);
  const getActivePersona = useTavernStore(state => state.getActivePersona);
  const getPersonaItems = useTavernStore(state => state.getPersonaItems);
  const getEquippedItems = useTavernStore(state => state.getEquippedItems);
  const removeEffect = useTavernStore(state => state.removeEffect);
  const equipItem = useTavernStore(state => state.equipItem);
  const equipItemToSlot = useTavernStore(state => state.equipItemToSlot);
  const unequipItem = useTavernStore(state => state.unequipItem);
  const consumeItem = useTavernStore(state => state.useConsumable);
  const getItemById = useTavernStore(state => state.getItemById);

  const [expanded, setExpanded] = useState(false);
  const [position, setPosition] = useState(loadPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingSlotSelection, setPendingSlotSelection] = useState<string | null>(null);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const hudRef = useRef<HTMLDivElement>(null);
  const slotPickerRef = useRef<HTMLDivElement>(null);

  // Equipment slots for slot name resolution
  const equipmentSlots = inventorySettings.equipmentSlots || [];

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

  // Get session-specific data
  const activeSession = sessions.find(s => s.id === activeSessionId);

  const personaItems = personaId ? getPersonaItems(personaId) : [];
  const equippedItems = personaId ? getEquippedItems(personaId) : [];

  // Read active effects from session first, fallback to global store
  const activeEffects = useMemo(() => {
    const sessionEffects = activeSession?.activeConsumableEffects;
    if (sessionEffects && sessionEffects.length > 0) {
      return sessionEffects.filter(e => e.personaId === personaId);
    }
    // Fallback to global store for backward compat
    return (useTavernStore.getState().activeConsumableEffects || []).filter(e => e.personaId === personaId);
  }, [activeSession?.activeConsumableEffects, personaId]);

  // Build a map from session equipment for quick lookup
  const sessionEquipmentMap = useMemo(() => {
    const map = new Map<string, string>(); // itemId → equippedSlotId
    const sessionEquip = activeSession?.sessionEquipment || [];
    for (const entry of sessionEquip) {
      map.set(entry.itemId, entry.equippedSlotId);
    }
    return map;
  }, [activeSession?.sessionEquipment]);

  // Separate unequipped items for the backpack section
  const unequippedItems = personaItems.filter(({ entry }) => !entry.equipped);

  // Close slot picker on outside click
  useEffect(() => {
    if (!pendingSlotSelection) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (slotPickerRef.current && !slotPickerRef.current.contains(e.target as Node)) {
        setPendingSlotSelection(null);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [pendingSlotSelection]);

  // Action handlers
  const handleEquipItem = (itemId: string) => {
    if (!personaId) return;
    const item = getItemById(itemId);
    if (!item) return;

    // Check if item has multiple slot effects → show picker
    const slotEffects = item.slotEffects || [];
    if (slotEffects.length > 1) {
      setPendingSlotSelection(itemId);
      return;
    }

    // Single or no slot effects → equip directly
    equipItem(personaId, itemId);
  };

  const handleEquipToSlot = (itemId: string, slotId: string) => {
    if (!personaId) return;
    setPendingSlotSelection(null);
    equipItemToSlot(personaId, itemId, slotId);
  };

  const handleUnequipItem = (itemId: string) => {
    if (!personaId) return;
    unequipItem(personaId, itemId);
  };

  const handleUseConsumable = (itemId: string) => {
    if (!personaId) return;
    consumeItem(personaId, itemId);
  };

  const handleExpireEffect = (effectId: string) => {
    removeEffect(effectId);
  };

  // Determine action for an inventory item based on type and equipped state
  const getItemAction = (item: Item, equipped: boolean): {
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
    const slotEffects = item.slotEffects || [];
    if (slotEffects.length > 1) {
      return {
        action: () => setPendingSlotSelection(item.id),
        tooltip: 'Click para elegir slot',
      };
    }
    return {
      action: () => handleEquipItem(item.id),
      tooltip: 'Click para equipar',
    };
  };

  // Get the item that is pending slot selection
  const pendingSlotItem = pendingSlotSelection ? getItemById(pendingSlotSelection) : null;
  const pendingSlotEffects: ItemSlotEffect[] = pendingSlotItem?.slotEffects || [];

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
                      {equippedItems.map(({ entry, item }) => (
                        <CompactEquippedItem
                          key={item.id}
                          item={item}
                          equippedSlotId={entry.equippedSlotId || sessionEquipmentMap.get(item.id)}
                          equipmentSlots={equipmentSlots}
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

                {/* Slot Selection Picker */}
                <AnimatePresence>
                  {pendingSlotSelection && pendingSlotItem && pendingSlotEffects.length > 1 && (
                    <motion.div
                      ref={slotPickerRef}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden rounded-md border border-primary/30 bg-primary/5"
                    >
                      <div className="p-2 space-y-1">
                        <div className="flex items-center gap-1 mb-1.5">
                          <Sword className="w-3 h-3 text-primary shrink-0" />
                          <span className="text-[10px] font-semibold text-primary uppercase truncate">
                            ¿En qué slot equipar {pendingSlotItem.name}?
                          </span>
                          <button
                            type="button"
                            onClick={() => setPendingSlotSelection(null)}
                            className="ml-auto w-4 h-4 rounded-full flex items-center justify-center hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                        <div className="space-y-0.5">
                          {pendingSlotEffects.map((se) => {
                            const slotDef = equipmentSlots.find(s => s.id === se.slotId);
                            const slotName = slotDef?.name || se.slotName || se.slotId;
                            const slotIcon = slotDef?.icon;
                            const isOccupied = activeSession?.sessionEquipment?.some(
                              eq => eq.equippedSlotId === se.slotId && eq.itemId !== pendingSlotSelection
                            );
                            const occupiedItemName = isOccupied
                              ? (() => {
                                  const occEntry = activeSession?.sessionEquipment?.find(
                                    eq => eq.equippedSlotId === se.slotId && eq.itemId !== pendingSlotSelection
                                  );
                                  return occEntry ? getItemById(occEntry.itemId)?.name : undefined;
                                })()
                              : undefined;
                            return (
                              <button
                                key={se.slotId}
                                type="button"
                                className={cn(
                                  'w-full flex items-center gap-1.5 text-[10px] rounded px-1.5 py-1',
                                  'cursor-pointer hover:bg-primary/10',
                                  'transition-colors duration-150',
                                  'text-left border border-transparent hover:border-primary/20',
                                  isOccupied && 'border-amber-500/30'
                                )}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEquipToSlot(pendingSlotSelection, se.slotId);
                                }}
                              >
                                {slotIcon && <span className="text-xs shrink-0">{slotIcon}</span>}
                                <div className="flex-1 min-w-0">
                                  <span className="font-semibold text-foreground truncate block">{slotName}</span>
                                  {se.effectText && (
                                    <span className="text-muted-foreground truncate block">{se.effectText}</span>
                                  )}
                                  {isOccupied && occupiedItemName && (
                                    <span className="text-amber-500/80 truncate block">Reemplaza: {occupiedItemName}</span>
                                  )}
                                </div>
                                <ArrowRight className="w-2.5 h-2.5 text-muted-foreground/60 shrink-0" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Empty state */}
                {activeEffects.length === 0 && equippedItems.length === 0 && unequippedItems.length === 0 && !pendingSlotSelection && (
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
