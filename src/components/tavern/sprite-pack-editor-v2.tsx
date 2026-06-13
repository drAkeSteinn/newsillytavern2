'use client';

import { useState, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import {
  Plus,
  Trash2,
  Package,
  Image as ImageIcon,
  Edit,
  Check,
  X,
  Video,
  Film,
  Layers,
  FolderOpen,
  GitBranch,
  HelpCircle,
  Settings2,
  ArrowUp,
  Star,
} from 'lucide-react';
import type { 
  SpritePackV2,
  SpritePackEntryV2,
  SpriteIndexEntry,
  SpriteCollection,
  CharacterCard,
  AttributeDefinition,
  StatRequirement,
  RequirementOperator,
} from '@/types';
import { SpritePreview } from './sprite-preview';
const uuidv4 = () => crypto.randomUUID();
import { getLogger } from '@/lib/logger';

const logger = getLogger('sprite-pack-editor');

// Check if URL is a video file
function isVideoUrl(url: string): boolean {
  return /\.(webm|mp4|mov|avi)(\?.*)?$/i.test(url);
}

// Check if URL is an animated image
function isAnimatedImage(url: string): boolean {
  return /\.(gif|apng|webp)(\?.*)?$/i.test(url);
}

// Operator display config
const OPERATOR_OPTIONS: { value: RequirementOperator; label: string; symbol: string }[] = [
  { value: '<', label: 'Menor que', symbol: '<' },
  { value: '<=', label: 'Menor o igual', symbol: '≤' },
  { value: '>', label: 'Mayor que', symbol: '>' },
  { value: '>=', label: 'Mayor o igual', symbol: '≥' },
  { value: '==', label: 'Igual', symbol: '==' },
  { value: '!=', label: 'Distinto', symbol: '!=' },
  { value: 'between', label: 'Entre', symbol: '∈' },
  { value: 'contains', label: 'Contiene', symbol: '∋' },
  { value: 'not_contains', label: 'No contiene', symbol: '∌' },
];

// Inline editable label for sprite cards — click to edit, Enter/blur to save, Escape to cancel
function SpriteLabelInput({
  label,
  onLabelChange,
}: {
  label: string;
  onLabelChange: (newLabel: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEditing = () => {
    setDraft(label);
    setIsEditing(true);
    // Focus the input on next tick
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== label) {
      onLabelChange(trimmed);
    }
    setIsEditing(false);
  };

  const cancel = () => {
    setDraft(label);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') cancel();
        }}
        className="w-full text-sm text-center font-medium bg-background border border-primary/50 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-primary"
      />
    );
  }

  return (
    <p
      className="text-sm truncate text-center font-medium cursor-pointer hover:text-primary hover:underline underline-offset-2 transition-colors"
      onClick={startEditing}
      title="Click para editar la etiqueta"
    >
      {label}
    </p>
  );
}

// Sprite Condition Editor - Full-size version for dialog
function SpriteConditionEditorFull({
  conditions,
  availableAttributes,
  onConditionsChange,
  conditionOperator,
  onConditionOperatorChange,
}: {
  conditions: StatRequirement[];
  availableAttributes: AttributeDefinition[];
  onConditionsChange: (conditions: StatRequirement[]) => void;
  conditionOperator?: 'AND' | 'OR';
  onConditionOperatorChange?: (operator: 'AND' | 'OR') => void;
}) {
  return (
    <div className="space-y-3">
      {conditions.length === 0 && (
        <div className="text-center py-4 text-muted-foreground border border-dashed rounded-lg">
          <GitBranch className="w-5 h-5 mx-auto mb-1.5 opacity-40" />
          <p className="text-sm">Sin condiciones</p>
          <p className="text-xs mt-0.5">Este sprite se mostrará si tiene la mayor prioridad</p>
        </div>
      )}
      {conditions.map((cond, idx) => {
        const attrDef = availableAttributes.find(a => a.key === cond.attributeKey);
        return (
          <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border">
            <div className="flex-1 space-y-2">
              {/* Row 1: Attribute + Operator */}
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">Atributo</Label>
                  <Select
                    value={cond.attributeKey}
                    onValueChange={(v) => {
                      const newConditions = [...conditions];
                      newConditions[idx] = { ...newConditions[idx], attributeKey: v };
                      onConditionsChange(newConditions);
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Seleccionar atributo" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableAttributes.map(attr => (
                        <SelectItem key={attr.key} value={attr.key}>
                          {attr.name || attr.key}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-40">
                  <Label className="text-xs text-muted-foreground mb-1 block">Operador</Label>
                  <Select
                    value={cond.operator}
                    onValueChange={(v) => {
                      const newConditions = [...conditions];
                      newConditions[idx] = { ...newConditions[idx], operator: v as RequirementOperator };
                      onConditionsChange(newConditions);
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATOR_OPTIONS.map(op => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.symbol} {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Row 2: Value(s) */}
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Valor {attrDef?.type === 'string' ? '(texto)' : '(número)'}
                  </Label>
                  <Input
                    type={attrDef?.type === 'string' ? 'text' : 'number'}
                    className="h-9 text-sm"
                    value={typeof cond.value === 'number' ? cond.value : cond.value || ''}
                    onChange={(e) => {
                      const newConditions = [...conditions];
                      const val = attrDef?.type === 'string' ? e.target.value : Number(e.target.value);
                      newConditions[idx] = { ...newConditions[idx], value: val as number };
                      onConditionsChange(newConditions);
                    }}
                  />
                </div>
                {cond.operator === 'between' && (
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground mb-1 block">Valor máximo</Label>
                    <Input
                      type="number"
                      className="h-9 text-sm"
                      value={cond.valueMax || 0}
                      onChange={(e) => {
                        const newConditions = [...conditions];
                        newConditions[idx] = { ...newConditions[idx], valueMax: Number(e.target.value) };
                        onConditionsChange(newConditions);
                      }}
                    />
                  </div>
                )}
              </div>
              {/* Condition summary */}
              <div className="text-xs text-muted-foreground">
                {attrDef?.name || cond.attributeKey}{' '}
                {OPERATOR_OPTIONS.find(o => o.value === cond.operator)?.symbol}{' '}
                {cond.value}
                {cond.operator === 'between' ? ` ~ ${cond.valueMax}` : ''}
              </div>
            </div>
            {/* Delete button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 shrink-0 text-red-500 hover:text-red-600 hover:bg-red-500/10 mt-5"
              onClick={() => onConditionsChange(conditions.filter((_, i) => i !== idx))}
              title="Eliminar condición"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        );
      })}
      {/* AND/OR Toggle */}
      {conditions.length >= 2 && onConditionOperatorChange && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={cn(
                'flex-1 h-8 text-xs font-medium rounded-md border transition-colors',
                conditionOperator !== 'OR'
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  : 'bg-muted/30 text-muted-foreground border-transparent'
              )}
              onClick={() => onConditionOperatorChange('AND')}
            >
              Y (AND)
            </button>
            <button
              type="button"
              className={cn(
                'flex-1 h-8 text-xs font-medium rounded-md border transition-colors',
                conditionOperator === 'OR'
                  ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                  : 'bg-muted/30 text-muted-foreground border-transparent'
              )}
              onClick={() => onConditionOperatorChange('OR')}
            >
              O (OR)
            </button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {conditionOperator === 'OR'
              ? 'Al menos una debe cumplirse'
              : 'Todas deben cumplirse'}
          </p>
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        className="w-full h-9 text-sm text-purple-600 hover:text-purple-700 border-purple-500/30 hover:border-purple-500/50 hover:bg-purple-500/5"
        onClick={() => {
          const newCondition: StatRequirement = {
            attributeKey: availableAttributes[0]?.key || '',
            operator: '>=',
            value: 0,
          };
          onConditionsChange([...conditions, newCondition]);
        }}
      >
        <Plus className="w-4 h-4 mr-1.5" /> Agregar Condición
      </Button>
    </div>
  );
}

interface SpritePackEditorV2Props {
  character: CharacterCard;
  customSprites: SpriteIndexEntry[];
  collections: SpriteCollection[];
  onChange: (updates: Partial<CharacterCard>) => void;
}

export function SpritePackEditorV2({ 
  character, 
  customSprites,
  collections,
  onChange 
}: SpritePackEditorV2Props) {
  // State for dialogs
  const [showCreatePackDialog, setShowCreatePackDialog] = useState(false);
  const [showAddSpriteDialog, setShowAddSpriteDialog] = useState<string | null>(null); // packId
  const [editingPackId, setEditingPackId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [collectionFilter, setCollectionFilter] = useState<string>('__all__');
  
  // Sprite edit dialog state
  const [editingSprite, setEditingSprite] = useState<{ packId: string; spriteId: string } | null>(null);
  
  // New pack form state
  const [newPackName, setNewPackName] = useState('');
  const [newPackDescription, setNewPackDescription] = useState('');

  // Get current packs from character
  const spritePacksV2: SpritePackV2[] = useMemo(() => {
    return character.spritePacksV2 || [];
  }, [character.spritePacksV2]);

  // Available attributes from character statsConfig
  const availableAttributes: AttributeDefinition[] = useMemo(() => {
    return character.statsConfig?.attributes || [];
  }, [character.statsConfig?.attributes]);

  // Filter sprites by collection filter AND search
  const filteredSprites = useMemo(() => {
    let result = customSprites;
    
    // Filter by collection
    if (collectionFilter && collectionFilter !== '__all__') {
      result = result.filter(s => s.pack === collectionFilter);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(s => 
        s.label.toLowerCase().includes(query) ||
        s.filename.toLowerCase().includes(query) ||
        (s.pack && s.pack.toLowerCase().includes(query))
      );
    }
    
    return result;
  }, [customSprites, collectionFilter, searchQuery]);

  // Get unique collection names from sprites for grouping
  const collectionNames = useMemo(() => {
    const names = new Set(customSprites.map(s => s.pack).filter(Boolean));
    return Array.from(names).sort();
  }, [customSprites]);

  // Check if sprite is in any pack
  const getSpritePackInfo = (spriteUrl: string) => {
    for (const pack of spritePacksV2) {
      const found = pack.sprites.find(s => s.url === spriteUrl);
      if (found) return { packId: pack.id, packName: pack.name, sprite: found };
    }
    return null;
  };

  // Get current editing sprite data
  const currentEditSprite = useMemo(() => {
    if (!editingSprite) return null;
    const pack = spritePacksV2.find(p => p.id === editingSprite.packId);
    if (!pack) return null;
    const sprite = pack.sprites.find(s => s.id === editingSprite.spriteId);
    if (!sprite) return null;
    return { pack, sprite };
  }, [editingSprite, spritePacksV2]);

  // Create new pack
  const handleCreatePack = () => {
    if (!newPackName.trim()) return;
    
    const now = new Date().toISOString();
    const newPack: SpritePackV2 = {
      id: uuidv4(),
      name: newPackName.trim(),
      description: newPackDescription.trim() || undefined,
      sprites: [],
      createdAt: now,
      updatedAt: now,
    };
    
    onChange({
      spritePacksV2: [...spritePacksV2, newPack],
    });
    
    // Reset form
    setNewPackName('');
    setNewPackDescription('');
    setShowCreatePackDialog(false);
    
    logger.info('Created sprite pack', { packId: newPack.id, name: newPack.name });
  };

  // Delete pack
  const handleDeletePack = (packId: string) => {
    const pack = spritePacksV2.find(p => p.id === packId);
    if (!pack) return;
    
    if (!confirm(`¿Eliminar el pack "${pack.name}"? Los sprites no se eliminarán, solo se quitarán del pack.\n\nSi este pack está siendo usado en Colecciones de Estado, se eliminará la referencia.`)) return;
    
    // Remove pack from spritePacksV2
    const updatedPacks = spritePacksV2.filter(p => p.id !== packId);
    
    // Also clean up stateCollectionsV2 references to this pack
    const stateCollectionsV2 = character.stateCollectionsV2 || [];
    const updatedStateCollections = stateCollectionsV2
      .filter(c => c.packId !== packId); // Remove collections that reference this pack
    
    // Also clean up trigger collections that reference this pack
    const triggerCollections = character.triggerCollections || [];
    const updatedTriggerCollections = triggerCollections.filter(c => c.packId !== packId);
    
    onChange({
      spritePacksV2: updatedPacks,
      stateCollectionsV2: updatedStateCollections,
      triggerCollections: updatedTriggerCollections.length < triggerCollections.length ? updatedTriggerCollections : undefined,
    });
    
    logger.info('Deleted sprite pack and cleaned up references', { 
      packId,
      removedStateCollections: stateCollectionsV2.length - updatedStateCollections.length,
      removedTriggerCollections: triggerCollections.length - updatedTriggerCollections.length,
    });
  };

  // Rename pack
  const handleRenamePack = (packId: string) => {
    if (!editingName.trim()) {
      setEditingPackId(null);
      return;
    }
    
    onChange({
      spritePacksV2: spritePacksV2.map(p => 
        p.id === packId 
          ? { ...p, name: editingName.trim(), updatedAt: new Date().toISOString() }
          : p
      ),
    });
    
    setEditingPackId(null);
    logger.info('Renamed sprite pack', { packId, newName: editingName });
  };

  // Add sprite to pack
  const handleAddSpriteToPack = (packId: string, sprite: SpriteIndexEntry) => {
    const pack = spritePacksV2.find(p => p.id === packId);
    if (!pack) return;
    
    // Check if already in pack
    if (pack.sprites.some(s => s.url === sprite.url)) {
      return;
    }
    
    const newEntry: SpritePackEntryV2 = {
      id: uuidv4(),
      label: sprite.label,
      url: sprite.url,
      thumbnail: sprite.thumb,
      tags: sprite.expressions,
      isAnimated: isAnimatedImage(sprite.url) || isVideoUrl(sprite.url),
    };
    
    onChange({
      spritePacksV2: spritePacksV2.map(p => 
        p.id === packId 
          ? { ...p, sprites: [...p.sprites, newEntry], updatedAt: new Date().toISOString() }
          : p
      ),
    });
    
    logger.info('Added sprite to pack', { packId, spriteLabel: sprite.label });
  };

  // Remove sprite from pack
  const handleRemoveSpriteFromPack = (packId: string, spriteId: string) => {
    onChange({
      spritePacksV2: spritePacksV2.map(p => 
        p.id === packId 
          ? { 
              ...p, 
              sprites: p.sprites.filter(s => s.id !== spriteId),
              updatedAt: new Date().toISOString() 
            }
          : p
      ),
    });
    
    logger.info('Removed sprite from pack', { packId, spriteId });
  };

  // Update sprite within a pack
  const handleUpdateSpriteInPack = (packId: string, spriteId: string, updates: Partial<SpritePackEntryV2>) => {
    onChange({
      spritePacksV2: spritePacksV2.map(p =>
        p.id === packId
          ? {
              ...p,
              sprites: p.sprites.map(s =>
                s.id === spriteId ? { ...s, ...updates } : s
              ),
              updatedAt: new Date().toISOString()
            }
          : p
      ),
    });
  };

  // Set default sprite for a pack
  const handleSetDefaultSprite = (packId: string, spriteId: string | undefined) => {
    onChange({
      spritePacksV2: spritePacksV2.map(p =>
        p.id === packId
          ? { ...p, defaultSpriteId: spriteId, updatedAt: new Date().toISOString() }
          : p
      ),
    });
  };

  // Get sprites not in current pack for add dialog
  const getSpritesNotInPack = (packId: string) => {
    const pack = spritePacksV2.find(p => p.id === packId);
    if (!pack) return filteredSprites;
    
    const packUrls = new Set(pack.sprites.map(s => s.url));
    return filteredSprites.filter(s => !packUrls.has(s.url));
  };

  // Get condition summary text for compact display
  const getConditionSummary = (sprite: SpritePackEntryV2): string => {
    if (!sprite.conditions || sprite.conditions.length === 0) return 'Sin condiciones';
    return sprite.conditions.map(c => {
      const attr = availableAttributes.find(a => a.key === c.attributeKey);
      const op = OPERATOR_OPTIONS.find(o => o.value === c.operator);
      return `${attr?.name || c.attributeKey} ${op?.symbol || c.operator} ${c.value}${c.operator === 'between' ? `~${c.valueMax}` : ''}`;
    }).join(', ');
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-500" />
              Sprite Packs
            </h4>
            <p className="text-xs text-muted-foreground">
              Crea packs de sprites para usar en colecciones de estado y triggers.
            </p>
          </div>
          <Button
            size="sm"
            className="h-8"
            onClick={() => setShowCreatePackDialog(true)}
          >
            <Plus className="w-4 h-4 mr-1" />
            Nuevo Pack
          </Button>
        </div>

        {/* Info Banner */}
        <div className="text-xs bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
          <div className="flex items-center gap-2 font-medium text-purple-600">
            <Package className="w-4 h-4" />
            ¿Qué son los Sprite Packs?
          </div>
          <p className="text-muted-foreground mt-1">
            Los Sprite Packs son <strong>contenedores simples</strong> que agrupan sprites relacionados.
            No tienen lógica de triggers - solo organizan los sprites para que las 
            <strong> Colecciones de Estado</strong> y <strong>Trigger Collections</strong> puedan usarlos.
            Puedes agregar sprites de <strong>cualquier colección</strong> a un pack.
          </p>
        </div>

        {/* Available Sprites Summary */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs bg-purple-500/10 border-purple-500/30">
            <Package className="w-3 h-3 mr-1" />
            {customSprites.length} sprites disponibles
          </Badge>
          {collectionNames.map(name => {
            const count = customSprites.filter(s => s.pack === name).length;
            return (
              <Badge key={name} variant="secondary" className="text-xs">
                <FolderOpen className="w-3 h-3 mr-1" />
                {name}: {count}
              </Badge>
            );
          })}
        </div>

        {/* Packs List */}
        {spritePacksV2.length > 0 ? (
          <Accordion type="multiple" className="w-full space-y-2">
            {spritePacksV2.map(pack => (
              <AccordionItem 
                key={pack.id} 
                value={pack.id}
                className="border rounded-lg px-0"
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-3 w-full">
                    <div className="p-1.5 bg-purple-500/10 rounded">
                      <Package className="w-4 h-4 text-purple-500" />
                    </div>
                    <div className="flex-1 text-left">
                      {editingPackId === pack.id ? (
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <Input
                            value={editingName}
                            onChange={e => setEditingName(e.target.value)}
                            className="h-7 w-48"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => handleRenamePack(pack.id)}
                          >
                            <Check className="w-3.5 h-3.5 text-green-500" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => setEditingPackId(null)}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="text-sm font-medium">{pack.name}</div>
                          {pack.description && (
                            <div className="text-xs text-muted-foreground">{pack.description}</div>
                          )}
                        </>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {pack.sprites.length} sprites
                    </Badge>
                    {pack.conditionalMode && (
                      <Badge variant="secondary" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/30">
                        <GitBranch className="w-3 h-3 mr-1" />
                        Condicional
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-3">
                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7"
                        onClick={() => {
                          setEditingPackId(pack.id);
                          setEditingName(pack.name);
                        }}
                      >
                        <Edit className="w-3.5 h-3.5 mr-1" />
                        Renombrar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7"
                        onClick={() => {
                          setCollectionFilter('__all__');
                          setSearchQuery('');
                          setShowAddSpriteDialog(pack.id);
                        }}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Agregar Sprites
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-destructive hover:text-destructive"
                        onClick={() => handleDeletePack(pack.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        Eliminar
                      </Button>
                    </div>

                    {/* Conditional Mode Section */}
                    <div className="space-y-2 p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <GitBranch className="w-3.5 h-3.5 text-purple-500" />
                          <Label className="text-xs font-medium">Modo Condicional</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Cuando está activado, los sprites del pack se seleccionan según condiciones de atributos y prioridad.</p>
                              <p className="mt-1 text-xs text-muted-foreground">El sprite con mayor prioridad cuyas condiciones se cumplan será el que se muestre.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Switch
                          checked={pack.conditionalMode || false}
                          onCheckedChange={(checked) => {
                            onChange({
                              spritePacksV2: spritePacksV2.map(p =>
                                p.id === pack.id
                                  ? { ...p, conditionalMode: checked, updatedAt: new Date().toISOString() }
                                  : p
                              ),
                            });
                          }}
                        />
                      </div>
                      {pack.conditionalMode && (
                        <p className="text-xs text-muted-foreground">
                          Cada sprite puede tener condiciones y prioridad. El sprite con mayor prioridad cuyas condiciones se cumplan será el seleccionado.
                          Define un sprite como &quot;Default&quot; para usarlo cuando ninguna condición coincida.
                        </p>
                      )}
                    </div>

                    {/* Sprites Horizontal Slider */}
                    {pack.sprites.length > 0 ? (
                      <div className="relative">
                        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory" style={{ scrollbarWidth: 'thin' }}>
                          {pack.sprites.map(sprite => {
                            const isCondEnabled = pack.conditionalMode && sprite.conditionalEnabled;
                            const isDefaultSprite = sprite.isDefault || pack.defaultSpriteId === sprite.id;
                            const condCount = sprite.conditions?.length || 0;
                            
                            return (
                              <div
                                key={sprite.id}
                                className={cn(
                                  "relative group border rounded-lg overflow-hidden shrink-0 snap-start",
                                  "w-56",
                                  isCondEnabled ? "border-purple-500/50 bg-purple-500/5" : "bg-muted/30",
                                  isDefaultSprite && pack.conditionalMode && "border-amber-500/50 bg-amber-500/5"
                                )}
                              >
                                <div className="aspect-square relative">
                                  <SpritePreview
                                    src={sprite.url}
                                    alt={sprite.label}
                                    className="w-full h-full"
                                    objectFit="contain"
                                  />
                                  {/* Type indicator */}
                                  {isVideoUrl(sprite.url) && (
                                    <div className="absolute top-1 right-1">
                                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-blue-500/80 text-white">
                                        <Video className="w-3 h-3" />
                                      </Badge>
                                    </div>
                                  )}
                                  {isAnimatedImage(sprite.url) && (
                                    <div className="absolute top-1 right-1">
                                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-purple-500/80 text-white">
                                        <Film className="w-3 h-3" />
                                      </Badge>
                                    </div>
                                  )}
                                  {/* Conditional indicator */}
                                  {isCondEnabled && (
                                    <div className="absolute top-1 left-1">
                                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-purple-500/80 text-white">
                                        <GitBranch className="w-3 h-3" />
                                      </Badge>
                                    </div>
                                  )}
                                  {/* Default indicator */}
                                  {isDefaultSprite && pack.conditionalMode && (
                                    <div className="absolute bottom-1 left-1">
                                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-amber-500/80 text-white">
                                        ★
                                      </Badge>
                                    </div>
                                  )}
                                  {/* Remove button */}
                                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={() => handleRemoveSpriteFromPack(pack.id, sprite.id)}
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </div>
                                {/* Compact info area */}
                                <div className="p-3 border-t bg-background space-y-1.5">
                                  <SpriteLabelInput
                                    label={sprite.label}
                                    onLabelChange={(newLabel) => handleUpdateSpriteInPack(pack.id, sprite.id, { label: newLabel })}
                                  />
                                  {pack.conditionalMode && (
                                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                      {/* Priority badge */}
                                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                                        <ArrowUp className="w-2.5 h-2.5 mr-0.5" />
                                        P:{sprite.priority || 0}
                                      </Badge>
                                      {/* Conditional status */}
                                      {sprite.conditionalEnabled ? (
                                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-purple-500/10 text-purple-600 border-purple-500/30">
                                          <GitBranch className="w-2.5 h-2.5 mr-0.5" />
                                          {condCount} cond.
                                        </Badge>
                                      ) : (
                                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 text-muted-foreground">
                                          Sin cond.
                                        </Badge>
                                      )}
                                      {/* Default badge */}
                                      {isDefaultSprite && (
                                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-amber-500/10 text-amber-600 border-amber-500/30">
                                          <Star className="w-2.5 h-2.5 mr-0.5" />
                                          Default
                                        </Badge>
                                      )}
                                      {/* Edit button */}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 px-1.5 text-[10px] text-purple-600 hover:text-purple-700"
                                        onClick={() => setEditingSprite({ packId: pack.id, spriteId: sprite.id })}
                                        title="Editar condiciones y prioridad"
                                      >
                                        <Settings2 className="w-3 h-3 mr-0.5" />
                                        Editar
                                      </Button>
                                    </div>
                                  )}
                                  {/* Condition summary for conditional sprites */}
                                  {pack.conditionalMode && sprite.conditionalEnabled && condCount > 0 && (
                                    <p className="text-[10px] text-muted-foreground text-center truncate" title={getConditionSummary(sprite)}>
                                      {getConditionSummary(sprite)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground border rounded-lg bg-muted/20">
                        <ImageIcon className="w-6 h-6 mx-auto mb-1 opacity-50" />
                        <p className="text-xs">Pack vacío</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 mt-2"
                          onClick={() => {
                            setCollectionFilter('__all__');
                            setSearchQuery('');
                            setShowAddSpriteDialog(pack.id);
                          }}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          Agregar Sprites
                        </Button>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/20">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay Sprite Packs</p>
            <p className="text-xs mt-1">Crea un pack para organizar tus sprites</p>
            <Button
              size="sm"
              className="mt-3"
              onClick={() => setShowCreatePackDialog(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Crear Primer Pack
            </Button>
          </div>
        )}

        {/* Sprite Edit Dialog - Full conditions editor */}
        <Dialog 
          open={editingSprite !== null} 
          onOpenChange={(open) => !open && setEditingSprite(null)}
        >
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-purple-500" />
                Editar Sprite Condicional
              </DialogTitle>
              <DialogDescription>
                Configura la prioridad y condiciones para este sprite dentro del pack.
              </DialogDescription>
            </DialogHeader>
            {currentEditSprite && (
              <div className="space-y-6 py-4">
                {/* Sprite Preview + Name */}
                <div className="flex gap-4 items-start">
                  <div className="w-40 h-40 border rounded-lg overflow-hidden bg-muted/30 shrink-0">
                    <SpritePreview
                      src={currentEditSprite.sprite.url}
                      alt={currentEditSprite.sprite.label}
                      className="w-full h-full"
                      objectFit="contain"
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={currentEditSprite.sprite.label}
                        onChange={(e) => handleUpdateSpriteInPack(currentEditSprite.pack.id, currentEditSprite.sprite.id, { label: e.target.value })}
                        className="h-8 text-lg font-medium border-transparent bg-transparent hover:bg-muted/50 focus:bg-background focus:border-primary/50 px-1 py-0"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Pack: <span className="font-medium text-foreground">{currentEditSprite.pack.name}</span>
                    </p>
                    {isVideoUrl(currentEditSprite.sprite.url) && (
                      <Badge variant="secondary" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/30">
                        <Video className="w-3 h-3 mr-1" /> Video
                      </Badge>
                    )}
                    {isAnimatedImage(currentEditSprite.sprite.url) && (
                      <Badge variant="secondary" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/30">
                        <Film className="w-3 h-3 mr-1" /> Animado
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Settings Section */}
                <div className="space-y-4 p-4 rounded-lg bg-muted/30 border">
                  <h4 className="text-sm font-medium flex items-center gap-1.5">
                    <Settings2 className="w-4 h-4 text-purple-500" />
                    Configuración
                  </h4>
                  
                  {/* Row: Priority + Default */}
                  <div className="flex items-end gap-4">
                    <div className="flex-1 max-w-48">
                      <Label className="text-sm mb-1.5 block">Prioridad</Label>
                      <Input
                        type="number"
                        className="h-10 text-sm"
                        value={currentEditSprite.sprite.priority || 0}
                        onChange={(e) => handleUpdateSpriteInPack(currentEditSprite.pack.id, currentEditSprite.sprite.id, { priority: parseInt(e.target.value) || 0 })}
                        min={0}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Mayor número = mayor prioridad
                      </p>
                    </div>
                    <div className="flex items-center gap-3 pb-0.5">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="conditional-enabled"
                          checked={currentEditSprite.sprite.conditionalEnabled || false}
                          onCheckedChange={(checked) => handleUpdateSpriteInPack(currentEditSprite.pack.id, currentEditSprite.sprite.id, { conditionalEnabled: checked })}
                        />
                        <Label htmlFor="conditional-enabled" className="text-sm cursor-pointer">
                          Condicional
                        </Label>
                      </div>
                    </div>
                  </div>

                  {/* Default sprite toggle */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant={currentEditSprite.sprite.isDefault || currentEditSprite.pack.defaultSpriteId === currentEditSprite.sprite.id ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "h-9",
                        currentEditSprite.sprite.isDefault || currentEditSprite.pack.defaultSpriteId === currentEditSprite.sprite.id
                          ? "bg-amber-500 hover:bg-amber-600 text-white"
                          : "text-muted-foreground"
                      )}
                      onClick={() => {
                        const isDefault = currentEditSprite.sprite.isDefault || currentEditSprite.pack.defaultSpriteId === currentEditSprite.sprite.id;
                        handleSetDefaultSprite(currentEditSprite.pack.id, isDefault ? undefined : currentEditSprite.sprite.id);
                      }}
                    >
                      <Star className="w-4 h-4 mr-1.5" />
                      {currentEditSprite.sprite.isDefault || currentEditSprite.pack.defaultSpriteId === currentEditSprite.sprite.id ? 'Sprite Default' : 'Marcar como Default'}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Se muestra cuando ninguna condición coincide
                    </p>
                  </div>
                </div>

                {/* Conditions Section */}
                {currentEditSprite.sprite.conditionalEnabled && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-purple-500" />
                      <h4 className="text-sm font-medium">Condiciones</h4>
                      <Badge variant="secondary" className="text-xs">
                        {currentEditSprite.sprite.conditions?.length || 0}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Define las condiciones que deben cumplirse para que este sprite se muestre.
                    </p>
                    <SpriteConditionEditorFull
                      conditions={currentEditSprite.sprite.conditions || []}
                      availableAttributes={availableAttributes}
                      onConditionsChange={(conditions) => handleUpdateSpriteInPack(currentEditSprite.pack.id, currentEditSprite.sprite.id, { conditions })}
                      conditionOperator={currentEditSprite.sprite.conditionOperator}
                      onConditionOperatorChange={(operator) => handleUpdateSpriteInPack(currentEditSprite.pack.id, currentEditSprite.sprite.id, { conditionOperator: operator })}
                    />
                  </div>
                )}

                {/* Info when conditional is disabled */}
                {!currentEditSprite.sprite.conditionalEnabled && (
                  <div className="text-center py-6 text-muted-foreground border border-dashed rounded-lg">
                    <GitBranch className="w-6 h-6 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Condiciones desactivadas</p>
                    <p className="text-xs mt-1">
                      Activa &quot;Condicional&quot; para agregar condiciones a este sprite
                    </p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingSprite(null)}>
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Pack Dialog */}
        <Dialog open={showCreatePackDialog} onOpenChange={setShowCreatePackDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Sprite Pack</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="packName">Nombre del pack</Label>
                <Input
                  id="packName"
                  value={newPackName}
                  onChange={(e) => setNewPackName(e.target.value)}
                  placeholder="Ej: Expressions, Outfits, Actions..."
                  className="mt-1"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreatePack()}
                />
              </div>
              <div>
                <Label htmlFor="packDescription">Descripción (opcional)</Label>
                <Textarea
                  id="packDescription"
                  value={newPackDescription}
                  onChange={(e) => setNewPackDescription(e.target.value)}
                  placeholder="Describe qué contiene este pack..."
                  className="mt-1 h-20 resize-none"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreatePackDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreatePack} disabled={!newPackName.trim()}>
                <Package className="w-4 h-4 mr-1" />
                Crear Pack
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Sprites Dialog */}
        <Dialog 
          open={showAddSpriteDialog !== null} 
          onOpenChange={(open) => !open && setShowAddSpriteDialog(null)}
        >
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                Agregar Sprites a &quot;{spritePacksV2.find(p => p.id === showAddSpriteDialog)?.name}&quot;
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                {customSprites.length} sprites disponibles en {collectionNames.length} colección(es)
              </p>
            </DialogHeader>
            <div className="space-y-3 py-4">
              {/* Collection Filter + Search */}
              <div className="flex gap-2">
                <Select
                  value={collectionFilter}
                  onValueChange={setCollectionFilter}
                >
                  <SelectTrigger className="h-8 w-44">
                    <FolderOpen className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                    <SelectValue placeholder="Filtrar colección..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">
                      <span className="text-muted-foreground">Todas ({customSprites.length})</span>
                    </SelectItem>
                    {collectionNames.map(name => {
                      const count = customSprites.filter(s => s.pack === name).length;
                      return (
                        <SelectItem key={name} value={name}>
                          {name} ({count})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <div className="relative flex-1">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar sprite..."
                    className="h-8 pr-8"
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-8 w-8 p-0"
                      onClick={() => setSearchQuery('')}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Sprite Selection - Horizontal Slider Style */}
              <ScrollArea className="h-80">
                {showAddSpriteDialog && getSpritesNotInPack(showAddSpriteDialog).length > 0 ? (
                  <div className="flex gap-3 flex-wrap">
                    {getSpritesNotInPack(showAddSpriteDialog).map(sprite => {
                      const existingPack = getSpritePackInfo(sprite.url);
                      
                      return (
                        <div
                          key={sprite.url}
                          className="relative group border rounded-lg overflow-hidden cursor-pointer hover:border-primary transition-all bg-muted/30 shrink-0 w-36"
                          onClick={() => handleAddSpriteToPack(showAddSpriteDialog!, sprite)}
                        >
                          <div className="aspect-square relative">
                            <SpritePreview
                              src={sprite.url}
                              alt={sprite.label}
                              className="w-full h-full"
                              objectFit="contain"
                            />
                            {/* Type indicator */}
                            {isVideoUrl(sprite.url) && (
                              <div className="absolute top-1 right-1">
                                <Badge variant="secondary" className="text-[9px] h-4 px-1 bg-blue-500/80 text-white">
                                  <Video className="w-2.5 h-2.5" />
                                </Badge>
                              </div>
                            )}
                            {isAnimatedImage(sprite.url) && (
                              <div className="absolute top-1 right-1">
                                <Badge variant="secondary" className="text-[9px] h-4 px-1 bg-purple-500/80 text-white">
                                  <Film className="w-2.5 h-2.5" />
                                </Badge>
                              </div>
                            )}
                            {/* Hover overlay */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Plus className="w-6 h-6 text-white" />
                            </div>
                          </div>
                          <div className="p-1.5 border-t bg-background">
                            <p className="text-[10px] truncate text-center">{sprite.label}</p>
                            {/* Collection badge */}
                            {sprite.pack && (
                              <p className="text-[9px] text-muted-foreground text-center truncate">
                                {sprite.pack}
                              </p>
                            )}
                            {existingPack && (
                              <p className="text-[9px] text-amber-600 text-center truncate">
                                En: {existingPack.packName}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {customSprites.length === 0 ? (
                      <>
                        <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No hay sprites disponibles</p>
                        <p className="text-xs mt-1">
                          Ve a la sección &quot;Sprites&quot; para subir sprites a las colecciones.
                        </p>
                      </>
                    ) : (
                      <p className="text-sm">No se encontraron sprites{searchQuery ? ` para &quot;${searchQuery}&quot;` : ''}</p>
                    )}
                  </div>
                )}
              </ScrollArea>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddSpriteDialog(null)}>
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

export default SpritePackEditorV2;
