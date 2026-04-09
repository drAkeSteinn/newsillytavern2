'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Plus,
  Trash2,
  Crown,
  Shuffle,
  List,
  Star,
  Image as ImageIcon,
  Check,
  X,
  Video,
  Film,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import type { 
  SpriteState, 
  StateSpriteCollection, 
  StateCollectionEntry, 
  CollectionBehavior,
  SpriteRole,
  SpriteIndexEntry 
} from '@/types';
import { SpritePreview } from './sprite-preview';
const uuidv4 = () => crypto.randomUUID();

// Check if URL is a video file
function isVideoUrl(url: string): boolean {
  return /\.(webm|mp4|mov|avi)(\?.*)?$/i.test(url);
}

// Check if URL is an animated image
function isAnimatedImage(url: string): boolean {
  return /\.(gif|apng)(\?.*)?$/i.test(url);
}

interface StateCollectionEditorProps {
  stateKey: SpriteState;
  stateLabel: string;
  stateIcon: React.ReactNode;
  stateDescription: string;
  collection?: StateSpriteCollection;
  customSprites: SpriteIndexEntry[];
  selectedCollectionName?: string;
  onChange: (collection: StateSpriteCollection) => void;
}

// Behavior mode configuration
const BEHAVIOR_CONFIG: { 
  value: CollectionBehavior; 
  label: string; 
  icon: React.ReactNode; 
  description: string 
}[] = [
  { 
    value: 'principal', 
    label: 'Principal', 
    icon: <Crown className="w-3.5 h-3.5" />, 
    description: 'Siempre usa el sprite marcado como principal' 
  },
  { 
    value: 'random', 
    label: 'Aleatorio', 
    icon: <Shuffle className="w-3.5 h-3.5" />, 
    description: 'Selecciona un sprite aleatorio cada vez' 
  },
  { 
    value: 'list', 
    label: 'Lista', 
    icon: <List className="w-3.5 h-3.5" />, 
    description: 'Rota entre los sprites en orden' 
  },
];

export function StateCollectionEditor({
  stateKey,
  stateLabel,
  stateIcon,
  stateDescription,
  collection,
  customSprites,
  selectedCollectionName,
  onChange,
}: StateCollectionEditorProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Default empty collection
  const currentCollection: StateSpriteCollection = useMemo(() => collection || {
    entries: [],
    behavior: 'principal' as CollectionBehavior,
    currentIndex: 0,
  }, [collection]);

  // Filter custom sprites by search
  const filteredSprites = useMemo(() => {
    if (!searchQuery.trim()) return customSprites;
    const query = searchQuery.toLowerCase();
    return customSprites.filter(s => 
      s.label.toLowerCase().includes(query) ||
      s.filename.toLowerCase().includes(query)
    );
  }, [customSprites, searchQuery]);

  // Get sprite URL by label
  const getSpriteUrl = (label: string): string | undefined => {
    return customSprites.find(s => s.label === label)?.url;
  };

  // Handle behavior change
  const handleBehaviorChange = (behavior: CollectionBehavior) => {
    onChange({
      ...currentCollection,
      behavior,
    });
  };

  // Add sprite to collection
  const handleAddSprite = (sprite: SpriteIndexEntry, role: SpriteRole) => {
    const newEntry: StateCollectionEntry = {
      id: uuidv4(),
      spriteLabel: sprite.label,
      spriteUrl: sprite.url,
      role,
      order: currentCollection.entries.length,
    };

    // If adding as principal, demote existing principal
    const updatedEntries = role === 'principal'
      ? currentCollection.entries.map(e => ({ ...e, role: 'alternate' as SpriteRole }))
      : currentCollection.entries;

    onChange({
      ...currentCollection,
      entries: [...updatedEntries, newEntry],
    });
    setShowAddDialog(false);
    setSearchQuery('');
  };

  // Remove sprite from collection
  const handleRemoveSprite = (entryId: string) => {
    const filtered = currentCollection.entries.filter(e => e.id !== entryId);
    // Reorder remaining entries
    const reordered = filtered.map((e, i) => ({ ...e, order: i }));
    onChange({
      ...currentCollection,
      entries: reordered,
    });
  };

  // Change sprite role
  const handleChangeRole = (entryId: string, newRole: SpriteRole) => {
    const updated = currentCollection.entries.map(e => {
      if (newRole === 'principal' && e.role === 'principal') {
        // Demote existing principal
        return { ...e, role: 'alternate' as SpriteRole };
      }
      if (e.id === entryId) {
        return { ...e, role: newRole };
      }
      return e;
    });
    onChange({
      ...currentCollection,
      entries: updated,
    });
  };

  // Move sprite up/down in order
  const handleMoveSprite = (entryId: string, direction: 'up' | 'down') => {
    const entries = [...currentCollection.entries].sort((a, b) => a.order - b.order);
    const index = entries.findIndex(e => e.id === entryId);
    
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === entries.length - 1) return;

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [entries[index], entries[swapIndex]] = [entries[swapIndex], entries[index]];
    
    // Update order values
    const reordered = entries.map((e, i) => ({ ...e, order: i }));
    onChange({
      ...currentCollection,
      entries: reordered,
    });
  };

  // Get principal sprite
  const principalEntry = currentCollection.entries.find(e => e.role === 'principal');
  const alternateEntries = currentCollection.entries.filter(e => e.role === 'alternate').sort((a, b) => a.order - b.order);

  // Check if sprite is already added
  const isSpriteAdded = (label: string) => {
    return currentCollection.entries.some(e => e.spriteLabel === label);
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-muted rounded">
            {stateIcon}
          </div>
          <div>
            <div className="text-sm font-medium">{stateLabel}</div>
            <div className="text-xs text-muted-foreground">{stateDescription}</div>
          </div>
        </div>
        <Badge variant="outline" className="text-xs">
          {currentCollection.entries.length} sprites
        </Badge>
      </div>

      {/* Behavior Selector */}
      <div className="space-y-1.5">
        <Label className="text-xs">Comportamiento</Label>
        <Select
          value={currentCollection.behavior}
          onValueChange={(v) => handleBehaviorChange(v as CollectionBehavior)}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BEHAVIOR_CONFIG.map(config => (
              <SelectItem key={config.value} value={config.value}>
                <div className="flex items-center gap-2">
                  {config.icon}
                  <span>{config.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {BEHAVIOR_CONFIG.find(b => b.value === currentCollection.behavior)?.description}
        </p>
      </div>

      {/* Sprites List */}
      {currentCollection.entries.length > 0 ? (
        <div className="space-y-2">
          {/* Principal Sprite */}
          {principalEntry && (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-amber-600">
                <Crown className="w-3 h-3" />
                <span className="font-medium">Principal</span>
              </div>
              <SpriteEntryCard
                entry={principalEntry}
                onRemove={() => handleRemoveSprite(principalEntry.id)}
                onChangeRole={(role) => handleChangeRole(principalEntry.id, role)}
                onMoveUp={() => handleMoveSprite(principalEntry.id, 'up')}
                onMoveDown={() => handleMoveSprite(principalEntry.id, 'down')}
                isPrincipal
                showOrderControls={currentCollection.behavior === 'list'}
                isFirst={principalEntry.order === 0}
                isLast={principalEntry.order === currentCollection.entries.length - 1}
              />
            </div>
          )}

          {/* Alternate Sprites */}
          {alternateEntries.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="w-3 h-3" />
                <span className="font-medium">Alternativos</span>
              </div>
              <ScrollArea className="max-h-40">
                <div className="space-y-1">
                  {alternateEntries.map((entry, index) => (
                    <SpriteEntryCard
                      key={entry.id}
                      entry={entry}
                      onRemove={() => handleRemoveSprite(entry.id)}
                      onChangeRole={(role) => handleChangeRole(entry.id, role)}
                      onMoveUp={() => handleMoveSprite(entry.id, 'up')}
                      onMoveDown={() => handleMoveSprite(entry.id, 'down')}
                      showOrderControls={currentCollection.behavior === 'list'}
                      isFirst={entry.order === 0}
                      isLast={entry.order === currentCollection.entries.length - 1}
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-4 text-muted-foreground border rounded-lg bg-muted/30">
          <ImageIcon className="w-6 h-6 mx-auto mb-1 opacity-50" />
          <p className="text-xs">Sin sprites en esta colección</p>
        </div>
      )}

      {/* Add Sprite Button */}
      <Button
        variant="outline"
        size="sm"
        className="w-full h-8"
        onClick={() => setShowAddDialog(true)}
        disabled={customSprites.length === 0}
      >
        <Plus className="w-4 h-4 mr-1" />
        Agregar Sprite
      </Button>

      {/* Add Sprite Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Agregar Sprite a {stateLabel}</DialogTitle>
            <p className="text-xs text-muted-foreground">
              Sprites de la colección: <strong>"{selectedCollectionName || 'Sin colección'}"</strong>
            </p>
          </DialogHeader>
          
          <div className="space-y-3 py-4">
            {/* Search */}
            <div className="relative">
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

            {/* Sprite List */}
            <ScrollArea className="h-64">
              {filteredSprites.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {filteredSprites.map(sprite => {
                    const added = isSpriteAdded(sprite.label);
                    
                    return (
                      <div
                        key={sprite.label}
                        className={cn(
                          "relative group aspect-square rounded border overflow-hidden cursor-pointer transition-all bg-muted/50",
                          added 
                            ? "opacity-50 cursor-not-allowed" 
                            : "hover:border-primary"
                        )}
                        onClick={() => !added && handleAddSprite(sprite, principalEntry ? 'alternate' : 'principal')}
                      >
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
                              <Video className="w-2.5 h-2.5 mr-0.5" />
                              WEBM
                            </Badge>
                          </div>
                        )}
                        {isAnimatedImage(sprite.url) && (
                          <div className="absolute top-1 right-1">
                            <Badge variant="secondary" className="text-[9px] h-4 px-1 bg-purple-500/80 text-white">
                              <Film className="w-2.5 h-2.5 mr-0.5" />
                              GIF
                            </Badge>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-end p-1">
                          <span className="text-[10px] text-white truncate w-full text-center">
                            {sprite.label}
                          </span>
                          {!added && (
                            <div className="flex gap-1 mt-1">
                              <Button
                                variant="secondary"
                                size="sm"
                                className="h-5 text-[10px] px-1.5"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddSprite(sprite, 'principal');
                                }}
                              >
                                <Crown className="w-2.5 h-2.5 mr-0.5" />
                                Principal
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                className="h-5 text-[10px] px-1.5"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddSprite(sprite, 'alternate');
                                }}
                              >
                                <Star className="w-2.5 h-2.5 mr-0.5" />
                                Alt.
                              </Button>
                            </div>
                          )}
                        </div>
                        {added && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <Check className="w-5 h-5 text-green-500" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {customSprites.length === 0 ? (
                    <>
                      <p>No hay sprites personalizados.</p>
                      <p className="text-xs mt-1">Sube sprites en la sección de Sprites Personalizados.</p>
                    </>
                  ) : (
                    <p>No se encontraron sprites para "{searchQuery}"</p>
                  )}
                </div>
              )}
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Sprite Entry Card Component
interface SpriteEntryCardProps {
  entry: StateCollectionEntry;
  onRemove: () => void;
  onChangeRole: (role: SpriteRole) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isPrincipal?: boolean;
  showOrderControls?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}

function SpriteEntryCard({
  entry,
  onRemove,
  onChangeRole,
  onMoveUp,
  onMoveDown,
  isPrincipal,
  showOrderControls,
  isFirst,
  isLast,
}: SpriteEntryCardProps) {
  return (
    <div className={cn(
      "flex items-center gap-2 p-2 border rounded bg-background",
      isPrincipal && "border-amber-500/50 bg-amber-500/5"
    )}>
      {/* Sprite Preview */}
      <div className="w-10 h-10 rounded border overflow-hidden flex-shrink-0 relative bg-muted/50">
        <SpritePreview
          src={entry.spriteUrl}
          alt={entry.spriteLabel}
          className="w-full h-full"
          objectFit="contain"
        />
        {/* Type indicator */}
        {isVideoUrl(entry.spriteUrl) && (
          <div className="absolute -top-0.5 -right-0.5">
            <Video className="w-3 h-3 text-blue-500 drop-shadow-sm" />
          </div>
        )}
        {isAnimatedImage(entry.spriteUrl) && (
          <div className="absolute -top-0.5 -right-0.5">
            <Film className="w-3 h-3 text-purple-500 drop-shadow-sm" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{entry.spriteLabel}</div>
        <div className="flex items-center gap-1 mt-0.5">
          {isPrincipal ? (
            <Badge variant="default" className="text-[10px] h-4 px-1 bg-amber-500">
              <Crown className="w-2.5 h-2.5 mr-0.5" />
              Principal
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px] h-4 px-1">
              <Star className="w-2.5 h-2.5 mr-0.5" />
              Alternativo
            </Badge>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {!isPrincipal && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onChangeRole('principal')}
            title="Hacer principal"
          >
            <Crown className="w-3 h-3 text-amber-500" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
          onClick={onRemove}
          title="Eliminar"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

export default StateCollectionEditor;
