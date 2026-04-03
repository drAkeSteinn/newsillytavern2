'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
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
  Crown,
  Star,
  Settings,
  Layers,
} from 'lucide-react';
import type { 
  SpritePackV2,
  SpritePackEntryV2,
  SpriteIndexEntry,
  CharacterCard,
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
  return /\.(gif|apng)(\?.*)?$/i.test(url);
}

interface SpritePackEditorV2Props {
  character: CharacterCard;
  customSprites: SpriteIndexEntry[];
  selectedCollectionName?: string;
  onChange: (updates: Partial<CharacterCard>) => void;
}

export function SpritePackEditorV2({ 
  character, 
  customSprites,
  selectedCollectionName,
  onChange 
}: SpritePackEditorV2Props) {
  // State for dialogs
  const [showCreatePackDialog, setShowCreatePackDialog] = useState(false);
  const [showAddSpriteDialog, setShowAddSpriteDialog] = useState<string | null>(null); // packId
  const [editingPackId, setEditingPackId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // New pack form state
  const [newPackName, setNewPackName] = useState('');
  const [newPackDescription, setNewPackDescription] = useState('');

  // Get current packs from character
  const spritePacksV2: SpritePackV2[] = useMemo(() => {
    return character.spritePacksV2 || [];
  }, [character.spritePacksV2]);

  // Filter sprites by search
  const filteredSprites = useMemo(() => {
    if (!searchQuery.trim()) return customSprites;
    const query = searchQuery.toLowerCase();
    return customSprites.filter(s => 
      s.label.toLowerCase().includes(query) ||
      s.filename.toLowerCase().includes(query)
    );
  }, [customSprites, searchQuery]);

  // Check if sprite is in any pack
  const getSpritePackInfo = (spriteUrl: string) => {
    for (const pack of spritePacksV2) {
      const found = pack.sprites.find(s => s.url === spriteUrl);
      if (found) return { packId: pack.id, packName: pack.name, sprite: found };
    }
    return null;
  };

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
    
    onChange({
      spritePacksV2: updatedPacks,
      stateCollectionsV2: updatedStateCollections,
    });
    
    logger.info('Deleted sprite pack and cleaned up state collection references', { 
      packId,
      removedCollections: stateCollectionsV2.length - updatedStateCollections.length
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

  // Get sprites not in current pack for add dialog
  const getSpritesNotInPack = (packId: string) => {
    const pack = spritePacksV2.find(p => p.id === packId);
    if (!pack) return filteredSprites;
    
    const packUrls = new Set(pack.sprites.map(s => s.url));
    return filteredSprites.filter(s => !packUrls.has(s.url));
  };

  return (
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
        </p>
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
                      onClick={() => setShowAddSpriteDialog(pack.id)}
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

                  {/* Sprites Grid */}
                  {pack.sprites.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2">
                      {pack.sprites.map(sprite => (
                        <div
                          key={sprite.id}
                          className="relative group border rounded-lg overflow-hidden bg-muted/30"
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
                            {/* Remove button */}
                            <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-5 w-5 p-0"
                                onClick={() => handleRemoveSpriteFromPack(pack.id, sprite.id)}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="p-1.5 border-t bg-background">
                            <p className="text-[10px] truncate text-center">{sprite.label}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground border rounded-lg bg-muted/20">
                      <ImageIcon className="w-6 h-6 mx-auto mb-1 opacity-50" />
                      <p className="text-xs">Pack vacío</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 mt-2"
                        onClick={() => setShowAddSpriteDialog(pack.id)}
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

      {/* Available Sprites Info */}
      <div className="border-t pt-4">
        {selectedCollectionName && (
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="text-xs bg-purple-500/10 border-purple-500/30">
              <Package className="w-3 h-3 mr-1" />
              Colección activa: {selectedCollectionName}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {customSprites.length} sprites disponibles
            </span>
          </div>
        )}
        {customSprites.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Solo se muestran los sprites de la colección seleccionada en la pestaña "Sprites".
            Cambia la colección allí para ver otros sprites.
          </p>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            <ImageIcon className="w-6 h-6 mx-auto mb-1 opacity-50" />
            <p className="text-xs">No hay sprites en la colección "{selectedCollectionName}"</p>
            <p className="text-xs mt-1">
              Ve a la pestaña "Sprites" para subir sprites a esta colección.
            </p>
          </div>
        )}
      </div>

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
              Agregar Sprites a "{spritePacksV2.find(p => p.id === showAddSpriteDialog)?.name}"
            </DialogTitle>
            {selectedCollectionName && (
              <p className="text-xs text-muted-foreground">
                Mostrando sprites de la colección: <Badge variant="secondary" className="text-[10px] ml-1">{selectedCollectionName}</Badge>
              </p>
            )}
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

            {/* Sprite Grid */}
            <ScrollArea className="h-80">
              {showAddSpriteDialog && getSpritesNotInPack(showAddSpriteDialog).length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {getSpritesNotInPack(showAddSpriteDialog).map(sprite => {
                    const existingPack = getSpritePackInfo(sprite.url);
                    
                    return (
                      <div
                        key={sprite.label}
                        className="relative group border rounded-lg overflow-hidden cursor-pointer hover:border-primary transition-all bg-muted/30"
                        onClick={() => handleAddSpriteToPack(showAddSpriteDialog, sprite)}
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
                      <p className="text-sm">No hay sprites en la colección "{selectedCollectionName}"</p>
                      <p className="text-xs mt-1">
                        Ve a la pestaña "Sprites" para subir sprites a esta colección,
                        o selecciona otra colección con sprites.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm">No se encontraron sprites para "{searchQuery}"</p>
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
  );
}

export default SpritePackEditorV2;
