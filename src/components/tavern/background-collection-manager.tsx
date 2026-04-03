'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { 
  Image as ImageIcon, 
  Video, 
  RefreshCw, 
  X,
  FolderPlus,
  Trash2,
  Upload,
  Loader2,
  Save,
  Tag,
  Key,
  AlertTriangle,
  FolderOpen,
  ChevronDown,
  FileImage
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getLogger } from '@/lib/logger';
import type { BackgroundCollection, BackgroundCollectionEntry, BackgroundFile } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';

const bgLogger = getLogger('background');

interface CollectionManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BackgroundCollectionManager({ open, onOpenChange }: CollectionManagerProps) {
  const [collections, setCollections] = useState<BackgroundCollection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCollectionName, setSelectedCollectionName] = useState<string | null>(null);
  const [localCollection, setLocalCollection] = useState<BackgroundCollection | null>(null);
  const localCollectionRef = useRef<BackgroundCollection | null>(null);
  
  // Create collection dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDescription, setNewCollectionDescription] = useState('');
  
  // Delete confirmation
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'collection' | 'file'; name: string; filename?: string } | null>(null);
  
  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Track initial load
  const hasLoadedRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    localCollectionRef.current = localCollection;
  }, [localCollection]);

  // Fetch collections - only depends on open
  const fetchCollections = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/backgrounds/collections');
      const data = await response.json();
      setCollections(data.collections || []);
      return data.collections || [];
    } catch (error) {
      bgLogger.error('Error fetching collections', { error });
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch when dialog opens
  useEffect(() => {
    if (open && !hasLoadedRef.current) {
      fetchCollections();
      hasLoadedRef.current = true;
    }
    if (!open) {
      hasLoadedRef.current = false;
    }
  }, [open, fetchCollections]);

  // Select a collection
  const handleSelectCollection = useCallback((collection: BackgroundCollection) => {
    setSelectedCollectionName(collection.name);
    setLocalCollection(collection);
    setHasChanges(false);
  }, []);

  // Create new collection
  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/backgrounds/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: newCollectionName.trim(),
          description: newCollectionDescription.trim()
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        const newCollections = await fetchCollections();
        setShowCreateDialog(false);
        setNewCollectionName('');
        setNewCollectionDescription('');
        if (data.collection) {
          handleSelectCollection(data.collection);
        }
      } else {
        alert(data.error || 'Failed to create collection');
      }
    } catch (error) {
      bgLogger.error('Error creating collection', { error });
    } finally {
      setIsLoading(false);
    }
  };

  // Delete collection
  const handleDeleteCollection = async () => {
    if (!deleteTarget || deleteTarget.type !== 'collection') return;
    
    setIsLoading(true);
    try {
      const folderName = collections.find(c => c.name === deleteTarget.name)?.path.split('/').pop();
      
      const response = await fetch(
        `/api/backgrounds/collections?folderName=${encodeURIComponent(folderName || deleteTarget.name)}`,
        { method: 'DELETE' }
      );
      
      const data = await response.json();
      
      if (data.success) {
        setSelectedCollectionName(null);
        setLocalCollection(null);
        await fetchCollections();
      } else {
        alert(data.error || 'Failed to delete collection');
      }
    } catch (error) {
      bgLogger.error('Error deleting collection', { error });
    } finally {
      setIsLoading(false);
      setShowDeleteDialog(false);
      setDeleteTarget(null);
    }
  };

  // Delete file from collection
  const handleDeleteFile = async () => {
    if (!deleteTarget || deleteTarget.type !== 'file' || !localCollection) return;
    
    setIsLoading(true);
    try {
      const folderName = localCollection.path.split('/').pop();
      
      const response = await fetch(
        `/api/backgrounds/collections?folderName=${encodeURIComponent(folderName || '')}&filename=${encodeURIComponent(deleteTarget.filename || '')}`,
        { method: 'DELETE' }
      );
      
      const data = await response.json();
      
      if (data.success) {
        const newCollections = await fetchCollections();
        const updated = newCollections.find((c: BackgroundCollection) => c.name === selectedCollectionName);
        if (updated) {
          setLocalCollection(updated);
        }
      } else {
        alert(data.error || 'Failed to delete file');
      }
    } catch (error) {
      bgLogger.error('Error deleting file', { error });
    } finally {
      setIsLoading(false);
      setShowDeleteDialog(false);
      setDeleteTarget(null);
    }
  };

  // Upload file to collection
  const handleUploadFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !localCollection) return;
    
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'background');
      formData.append('collection', localCollection.path.split('/').pop() || '');
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      
      if (data.success) {
        const newCollections = await fetchCollections();
        const updated = newCollections.find((c: BackgroundCollection) => c.name === selectedCollectionName);
        if (updated) {
          setLocalCollection(updated);
        }
      } else {
        alert(data.error || 'Failed to upload file');
      }
    } catch (error) {
      bgLogger.error('Error uploading file', { error });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Save collection metadata
  const handleSaveCollection = async () => {
    if (!localCollection) return;
    
    setIsSaving(true);
    try {
      const folderName = localCollection.path.split('/').pop();
      
      const response = await fetch('/api/backgrounds/collections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderName,
          name: localCollection.name,
          description: localCollection.description,
          entries: localCollection.entries,
          transitionDuration: localCollection.transitionDuration
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setHasChanges(false);
        await fetchCollections();
      } else {
        alert(data.error || 'Failed to save collection');
      }
    } catch (error) {
      bgLogger.error('Error saving collection', { error });
    } finally {
      setIsSaving(false);
    }
  };

  // Update local collection state
  const updateLocalCollection = (updates: Partial<BackgroundCollection>) => {
    if (!localCollection) return;
    setLocalCollection({ ...localCollection, ...updates });
    setHasChanges(true);
  };

  // Update entry in local collection
  const updateEntry = (entryId: string, updates: Partial<BackgroundCollectionEntry>) => {
    if (!localCollection) return;
    
    setLocalCollection(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        entries: prev.entries.map(e => 
          e.id === entryId ? { ...e, ...updates } : e
        )
      };
    });
    setHasChanges(true);
  };

  // Sync entries with files
  const syncEntriesWithFiles = () => {
    if (!localCollection) return;
    
    const existingUrls = new Set(localCollection.entries.map(e => e.url));
    const newEntries: BackgroundCollectionEntry[] = [...localCollection.entries];
    
    for (const file of localCollection.files) {
      if (!existingUrls.has(file.url)) {
        newEntries.push({
          id: `bg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          name: file.name.replace(/\.[^.]+$/, ''),
          url: file.url,
          triggerKeys: [],
          contextKeys: [],
          tags: file.type === 'video' ? ['video'] : []
        });
      }
    }
    
    setLocalCollection(prev => {
      if (!prev) return prev;
      return { ...prev, entries: newEntries };
    });
    setHasChanges(true);
  };

  // Get entry for file
  const getEntryForFile = (file: BackgroundFile): BackgroundCollectionEntry | undefined => {
    return localCollection?.entries.find(e => e.url === file.url);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="collection-manager-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="fixed inset-0 z-[55] bg-background"
        >
          <div className="h-full flex flex-col">
            {/* Header */}
            <motion.div
              initial={{ y: -8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.2, delay: 0.05, ease: 'easeOut' }}
              className="h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-4 flex-shrink-0"
            >
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-muted-foreground" />
                <h2 className="font-semibold text-sm">Gestionar Colecciones</h2>
                {hasChanges && (
                  <Badge variant="outline" className="text-orange-500 border-orange-500 text-xs ml-2">
                    Sin guardar
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 text-xs"
                  onClick={handleSaveCollection}
                  disabled={!hasChanges || isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span className="ml-1 hidden sm:inline">Guardar</span>
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => fetchCollections()}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>

            {/* Body: Sidebar + Main Content */}
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.1, ease: 'easeOut' }}
              className="flex-1 flex overflow-hidden"
            >
              {/* Collections Sidebar */}
              <div className="w-14 md:w-64 border-r bg-muted/30 flex flex-col flex-shrink-0">
                <div className="p-1.5 md:p-2 border-b">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="default"
                        size="sm"
                        className="w-full h-8"
                        onClick={() => setShowCreateDialog(true)}
                      >
                        <FolderPlus className="w-4 h-4 shrink-0" />
                        <span className="hidden md:inline ml-2">Nueva Colección</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="md:hidden">
                      Nueva Colección
                    </TooltipContent>
                  </Tooltip>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-1.5 md:p-2 space-y-0.5">
                    {collections.map(collection => (
                      <Tooltip key={collection.name}>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              "group flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors",
                              selectedCollectionName === collection.name
                                ? "bg-primary text-primary-foreground"
                                : "hover:bg-muted"
                            )}
                            onClick={() => handleSelectCollection(collection)}
                          >
                            <FolderOpen className="w-4 h-4 flex-shrink-0" />
                            <div className="flex-1 min-w-0 hidden md:block">
                              <p className="font-medium truncate text-sm">{collection.name}</p>
                              <p className="text-xs opacity-70">
                                {collection.files.length} archivo{collection.files.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "h-6 w-6 shrink-0",
                                selectedCollectionName === collection.name 
                                  ? "text-primary-foreground hover:text-primary-foreground hover:bg-primary/80" 
                                  : "opacity-0 group-hover:opacity-100"
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget({ type: 'collection', name: collection.name });
                                setShowDeleteDialog(true);
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="md:hidden">
                          {collection.name}
                        </TooltipContent>
                      </Tooltip>
                    ))}
                    
                    {collections.length === 0 && !isLoading && (
                      <div className="text-center py-8 text-muted-foreground">
                        <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm hidden md:block">Sin colecciones</p>
                        <p className="text-xs mt-1 hidden md:block">Crea una para comenzar</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Main Content */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {localCollection ? (
                  <>
                    {/* Collection Header */}
                    <div className="p-4 border-b bg-muted/20 flex-shrink-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <Input
                            value={localCollection.name}
                            onChange={(e) => updateLocalCollection({ name: e.target.value })}
                            className="font-semibold text-lg border-none bg-transparent px-0 focus-visible:ring-0"
                          />
                          <Textarea
                            value={localCollection.description || ''}
                            onChange={(e) => updateLocalCollection({ description: e.target.value })}
                            placeholder="Descripción de la colección..."
                            className="min-h-[40px] resize-none border-none bg-transparent px-0 focus-visible:ring-0 text-sm"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleUploadFile}
                            accept="image/*,video/*"
                            className="hidden"
                          />
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                          >
                            {isUploading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Upload className="w-4 h-4" />
                            )}
                            <span className="ml-1">Subir</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={syncEntriesWithFiles}
                            title="Sincronizar entradas con archivos"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Files Accordion */}
                    <ScrollArea className="flex-1">
                      <div className="p-4">
                        {localCollection.files.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                            <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
                            <p>Sin fondos en esta colección</p>
                            <p className="text-xs mt-1">Sube imágenes o videos para comenzar</p>
                          </div>
                        ) : (
                          <Accordion type="multiple" className="w-full space-y-2">
                            {localCollection.files.map((file, index) => {
                              const entry = getEntryForFile(file);
                              const isVideo = file.type === 'video';
                              
                              return (
                                <AccordionItem 
                                  key={file.url} 
                                  value={`file-${index}`}
                                  className="border rounded-lg bg-card overflow-hidden"
                                >
                                  <div className="flex items-center">
                                    <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-muted/50 flex-1">
                                      <div className="flex items-center gap-3 w-full pr-4">
                                        {/* Small Thumbnail */}
                                        <div className="w-12 h-8 flex-shrink-0 relative rounded overflow-hidden bg-muted">
                                          {isVideo ? (
                                            <video
                                              src={file.url}
                                              className="w-full h-full object-cover"
                                              muted
                                            />
                                          ) : (
                                            <img
                                              src={file.url}
                                              alt={file.name}
                                              className="w-full h-full object-cover"
                                            />
                                          )}
                                          {isVideo && (
                                            <Video className="absolute inset-0 m-auto w-3 h-3 text-white drop-shadow" />
                                          )}
                                        </div>
                                        
                                        {/* File name */}
                                        <div className="flex-1 min-w-0 text-left">
                                          <p className="font-medium text-sm truncate">
                                            {entry?.name || file.name.replace(/\.[^.]+$/, '')}
                                          </p>
                                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span>{file.name}</span>
                                            {(entry?.triggerKeys?.length || 0) > 0 && (
                                              <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                                                {entry?.triggerKeys?.length} trigger{(entry?.triggerKeys?.length || 0) > 1 ? 's' : ''}
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </AccordionTrigger>
                                    
                                    {/* Quick actions - outside the button */}
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            type="button"
                                            className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors mr-2"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setDeleteTarget({ 
                                                type: 'file', 
                                                name: localCollection.name,
                                                filename: file.name 
                                              });
                                              setShowDeleteDialog(true);
                                            }}
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent>Eliminar archivo</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                  
                                  <AccordionContent className="px-4 pb-4">
                                    <div className="space-y-3 pt-2">
                                      {/* Name */}
                                      <div>
                                        <Label className="text-xs text-muted-foreground">Nombre</Label>
                                        <Input
                                          value={entry?.name || file.name.replace(/\.[^.]+$/, '')}
                                          onChange={(e) => {
                                            if (entry) {
                                              updateEntry(entry.id, { name: e.target.value });
                                            }
                                          }}
                                          className="h-8 mt-1"
                                        />
                                      </div>

                                      {/* Trigger Keys */}
                                      <div>
                                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                          <Key className="w-3 h-3" />
                                          Claves de Activación
                                        </Label>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {(entry?.triggerKeys || []).map((key, i) => (
                                            <Badge 
                                              key={i} 
                                              variant="secondary"
                                              className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground text-xs"
                                              onClick={() => {
                                                if (entry) {
                                                  updateEntry(entry.id, {
                                                    triggerKeys: entry.triggerKeys.filter((_, idx) => idx !== i)
                                                  });
                                                }
                                              }}
                                            >
                                              {key}
                                              <X className="w-2.5 h-2.5 ml-0.5" />
                                            </Badge>
                                          ))}
                                          <Input
                                            placeholder="Agregar..."
                                            className="h-6 w-20 text-xs px-2"
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                                if (entry) {
                                                  updateEntry(entry.id, {
                                                    triggerKeys: [...(entry.triggerKeys || []), e.currentTarget.value.trim().toLowerCase()]
                                                  });
                                                }
                                                e.currentTarget.value = '';
                                              }
                                            }}
                                          />
                                        </div>
                                      </div>

                                      {/* Context Keys */}
                                      <div>
                                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                          <Tag className="w-3 h-3" />
                                          Claves de Contexto
                                        </Label>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {(entry?.contextKeys || []).map((key, i) => (
                                            <Badge 
                                              key={i} 
                                              variant="outline"
                                              className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground text-xs"
                                              onClick={() => {
                                                if (entry) {
                                                  updateEntry(entry.id, {
                                                    contextKeys: entry.contextKeys.filter((_, idx) => idx !== i)
                                                  });
                                                }
                                              }}
                                            >
                                              {key}
                                              <X className="w-2.5 h-2.5 ml-0.5" />
                                            </Badge>
                                          ))}
                                          <Input
                                            placeholder="Agregar..."
                                            className="h-6 w-20 text-xs px-2"
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                                if (entry) {
                                                  updateEntry(entry.id, {
                                                    contextKeys: [...(entry.contextKeys || []), e.currentTarget.value.trim().toLowerCase()]
                                                  });
                                                }
                                                e.currentTarget.value = '';
                                              }
                                            }}
                                          />
                                        </div>
                                      </div>

                                      {/* Tags */}
                                      <div>
                                        <Label className="text-xs text-muted-foreground">Etiquetas</Label>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {(entry?.tags || []).map((tag, i) => (
                                            <Badge 
                                              key={i} 
                                              variant="default"
                                              className="cursor-pointer hover:bg-destructive text-xs"
                                              onClick={() => {
                                                if (entry) {
                                                  updateEntry(entry.id, {
                                                    tags: entry.tags?.filter((_, idx) => idx !== i)
                                                  });
                                                }
                                              }}
                                            >
                                              {tag}
                                              <X className="w-2.5 h-2.5 ml-0.5" />
                                            </Badge>
                                          ))}
                                          <Input
                                            placeholder="Agregar..."
                                            className="h-6 w-20 text-xs px-2"
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                                if (entry) {
                                                  updateEntry(entry.id, {
                                                    tags: [...(entry.tags || []), e.currentTarget.value.trim().toLowerCase()]
                                                  });
                                                }
                                                e.currentTarget.value = '';
                                              }
                                            }}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              );
                            })}
                          </Accordion>
                        )}
                      </div>
                    </ScrollArea>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Selecciona una colección para gestionar</p>
                      <p className="text-xs mt-1">O crea una nueva</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Create Collection Dialog */}
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nueva Colección</DialogTitle>
                <DialogDescription>
                  Crea una nueva colección de fondos. Se creará una carpeta en el directorio de fondos.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nombre de la Colección</Label>
                  <Input
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    placeholder="Ej: Bosque, Castillo, Playa"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descripción (opcional)</Label>
                  <Textarea
                    value={newCollectionDescription}
                    onChange={(e) => setNewCollectionDescription(e.target.value)}
                    placeholder="Describe esta colección..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateCollection} disabled={!newCollectionName.trim() || isLoading}>
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
                  Crear
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  Confirmar Eliminación
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {deleteTarget?.type === 'collection' ? (
                    <>
                      ¿Estás seguro de que quieres eliminar la colección <strong>{deleteTarget.name}</strong>?
                      Se eliminarán permanentemente todos los archivos de esta colección. Esta acción no se puede deshacer.
                    </>
                  ) : (
                    <>
                      ¿Estás seguro de que quieres eliminar <strong>{deleteTarget?.filename}</strong>?
                      Esta acción no se puede deshacer.
                    </>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={deleteTarget?.type === 'collection' ? handleDeleteCollection : handleDeleteFile}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default BackgroundCollectionManager;
