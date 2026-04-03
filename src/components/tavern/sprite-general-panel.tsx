'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type {
  SpriteCollection,
} from '@/types';
import {
  Trash2,
  Upload,
  RefreshCw,
  Image as ImageIcon,
  Film,
  Clock,
  Layers,
  Loader2,
  FolderOpen,
  FolderPlus,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import { useTavernStore } from '@/store/tavern-store';
import { useToast } from '@/hooks/use-toast';
import { SpriteTimelineEditor } from './sprite-timeline-editor';

// ============================================
// Tab 1: Colecciones Manager
// ============================================

interface CollectionManagerProps {
  onCollectionSelect?: (collectionId: string) => void;
}

function CollectionManager({ onCollectionSelect }: CollectionManagerProps) {
  const { toast } = useToast();
  const [collections, setCollections] = useState<SpriteCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  // Fetch collections
  const fetchCollections = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/sprites/collections');
      const data = await response.json();
      setCollections(data.collections || []);
    } catch (error) {
      console.error('Failed to fetch collections:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las colecciones',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  // Create new collection
  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;

    try {
      const response = await fetch('/api/sprites/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCollectionName.trim() }),
      });

      const data = await response.json();
      if (data.success) {
        setNewCollectionName('');
        setCreatingCollection(false);
        await fetchCollections();
        toast({
          title: 'Colección creada',
          description: `La colección "${newCollectionName}" ha sido creada`,
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo crear la colección',
        variant: 'destructive',
      });
    }
  };

  // Rename collection
  const handleRenameCollection = async (collectionId: string, newName: string) => {
    try {
      const response = await fetch('/api/sprites/collections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionId, newName }),
      });

      const data = await response.json();
      if (data.success) {
        setEditingCollectionId(null);
        setEditingName('');
        await fetchCollections();
        toast({
          title: 'Colección renombrada',
          description: `La colección ahora se llama "${newName}"`,
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo renombrar la colección',
        variant: 'destructive',
      });
    }
  };

  // Delete collection
  const handleDeleteCollection = async (collectionId: string, collectionName: string) => {
    if (!confirm(`¿Eliminar la colección "${collectionName}" y todos sus sprites?`)) return;

    try {
      const response = await fetch(`/api/sprites/collections?collectionId=${collectionId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        if (selectedCollectionId === collectionId) {
          setSelectedCollectionId(null);
        }
        await fetchCollections();
        toast({
          title: 'Colección eliminada',
          description: `La colección "${collectionName}" ha sido eliminada`,
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo eliminar la colección',
        variant: 'destructive',
      });
    }
  };

  // Upload sprite to collection
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !selectedCollectionId) return;

    const collection = collections.find(c => c.id === selectedCollectionId);
    if (!collection) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'sprite');
        formData.append('collection', collection.name);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Upload failed');
        }
      }

      await fetchCollections();
      toast({
        title: 'Sprites subidos',
        description: `${files.length} sprite(s) subido(s) correctamente`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron subir los sprites',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Delete sprite
  const handleDeleteSprite = async (spriteUrl: string, spriteName: string) => {
    if (!confirm(`¿Eliminar el sprite "${spriteName}"?`)) return;

    try {
      const response = await fetch(`/api/sprites/manage?url=${encodeURIComponent(spriteUrl)}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        await fetchCollections();
        toast({
          title: 'Sprite eliminado',
          description: `El sprite "${spriteName}" ha sido eliminado`,
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el sprite',
        variant: 'destructive',
      });
    }
  };

  const selectedCollection = collections.find(c => c.id === selectedCollectionId);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Cargando colecciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex gap-4 overflow-hidden">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*,video/*"
        multiple
        onChange={handleFileUpload}
      />

      {/* Left Panel - Collections List */}
      <div className="w-48 md:w-64 flex-shrink-0 flex flex-col gap-3 border rounded-lg bg-muted/20 p-3 overflow-hidden">
        <div className="flex items-center justify-between flex-shrink-0">
          <Label className="text-xs font-medium flex items-center gap-2">
            <FolderOpen className="w-4 h-4" />
            Colecciones
          </Label>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setCreatingCollection(true)}
          >
            <FolderPlus className="w-3 h-3 mr-1" />
            Nueva
          </Button>
        </div>

        {/* New Collection Input */}
        {creatingCollection && (
          <div className="flex gap-1 flex-shrink-0">
            <Input
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              placeholder="Nombre..."
              className="h-8 text-xs"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateCollection()}
              autoFocus
            />
            <Button size="icon" className="h-8 w-8" onClick={handleCreateCollection}>
              <Check className="w-3 h-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => {
              setCreatingCollection(false);
              setNewCollectionName('');
            }}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}

        {/* Collections List */}
        <ScrollArea className="flex-1">
          <div className="space-y-1 pr-2">
            {collections.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No hay colecciones</p>
                <p className="text-xs mt-1">Crea una colección para empezar</p>
              </div>
            ) : (
              collections.map((collection) => (
                <div
                  key={collection.id}
                  className={cn(
                    "group flex items-center justify-between p-2 rounded cursor-pointer transition-colors",
                    selectedCollectionId === collection.id
                      ? "bg-primary/20 border border-primary/30"
                      : "bg-muted/30 hover:bg-muted/50"
                  )}
                  onClick={() => {
                    setSelectedCollectionId(collection.id);
                    onCollectionSelect?.(collection.id);
                  }}
                >
                  {editingCollectionId === collection.id ? (
                    <div className="flex gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="h-7 text-xs"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameCollection(collection.id, editingName);
                          if (e.key === 'Escape') {
                            setEditingCollectionId(null);
                            setEditingName('');
                          }
                        }}
                        autoFocus
                      />
                      <Button
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleRenameCollection(collection.id, editingName)}
                      >
                        <Check className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Layers className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm truncate">{collection.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {collection.files.length}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCollectionId(collection.id);
                            setEditingName(collection.name);
                          }}
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCollection(collection.id, collection.name);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right Panel - Sprites in Collection */}
      <div className="flex-1 flex flex-col gap-3 border rounded-lg bg-muted/20 p-3 overflow-hidden">
        {selectedCollection ? (
          <>
            <div className="flex items-center justify-between flex-shrink-0">
              <Label className="text-xs font-medium flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                Sprites en "{selectedCollection.name}"
              </Label>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Upload className="w-3 h-3 mr-1" />
                )}
                Subir Sprites
              </Button>
            </div>

            <ScrollArea className="flex-1">
              {selectedCollection.files.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-sm">
                  <ImageIcon className="w-16 h-16 mx-auto mb-3 opacity-50" />
                  <p>No hay sprites en esta colección</p>
                  <p className="text-xs mt-1">Sube imágenes o videos para empezar</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 pr-2">
                  {selectedCollection.files.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="group relative rounded border overflow-hidden bg-muted/30"
                    >
                      <div className="aspect-square flex items-center justify-center">
                        {file.type === 'animation' ? (
                          <div className="relative w-full h-full">
                            <video
                              src={file.url}
                              className="w-full h-full object-cover"
                              muted
                              playsInline
                              preload="metadata"
                            />
                            <div className="absolute bottom-1 right-1 bg-black/60 rounded p-0.5">
                              <Film className="w-3 h-3 text-white" />
                            </div>
                          </div>
                        ) : (
                          <img
                            src={file.url}
                            alt={file.name}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="p-2 bg-background/80">
                        <p className="text-xs truncate" title={file.name}>
                          {file.name.replace(/\.[^/.]+$/, '')}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 bg-destructive/80 hover:bg-destructive text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDeleteSprite(file.url, file.name)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Layers className="w-16 h-16 mx-auto mb-3 opacity-50" />
              <p>Selecciona una colección</p>
              <p className="text-xs mt-1">para ver y gestionar sus sprites</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Tab 2: Timeline Editor
// ============================================

interface TimelineEditorTabProps {
  preselectedCollectionId?: string;
}

function TimelineEditorTab({ preselectedCollectionId }: TimelineEditorTabProps) {
  return (
    <div className="h-full overflow-hidden">
      <SpriteTimelineEditor />
    </div>
  );
}

// ============================================
// Main Component: Sprite General Panel
// ============================================

export function SpriteGeneralPanel() {
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Tabs defaultValue="collections" className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 pt-3 flex-shrink-0 border-b">
          <TabsList className="h-9">
            <TabsTrigger value="collections" className="text-xs gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              Colecciones
            </TabsTrigger>
            <TabsTrigger value="timeline" className="text-xs gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Timeline
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="collections" className="flex-1 overflow-hidden m-0 p-4 data-[state=inactive]:hidden">
          <CollectionManager onCollectionSelect={setSelectedCollectionId} />
        </TabsContent>

        <TabsContent value="timeline" className="flex-1 overflow-hidden m-0 p-0 data-[state=inactive]:hidden">
          <TimelineEditorTab preselectedCollectionId={selectedCollectionId || undefined} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default SpriteGeneralPanel;
