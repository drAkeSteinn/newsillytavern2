'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  Plus,
  Trash2,
  Edit,
  ChevronDown,
  ChevronRight,
  Package,
  Image as ImageIcon,
  X,
  Clock,
  Zap,
  Key,
  GripVertical,
  Download,
  Upload,
  Copy,
} from 'lucide-react';
import type { SpritePack, SpritePackItem, SpriteLibraries, SpriteLibraryEntry, SpriteIndex } from '@/types';
import { SpriteSelector } from './sprite-selector';
import { v4 as uuidv4 } from 'uuid';

interface SpritePackEditorProps {
  packs: SpritePack[];
  libraries: SpriteLibraries;
  spriteIndex?: SpriteIndex;
  onChange: (packs: SpritePack[]) => void;
}

const DEFAULT_PACK: Omit<SpritePack, 'id' | 'createdAt' | 'updatedAt'> = {
  title: 'Nuevo Pack',
  active: true,
  requirePipes: true,
  caseSensitive: false,
  keywords: [],
  cooldownMs: 1000,
  items: [],
};

const DEFAULT_ITEM: Omit<SpritePackItem, 'id'> = {
  spriteLabel: '',
  spriteUrl: '',
  keys: '',
  enabled: true,
};

export function SpritePackEditor({ packs, libraries, spriteIndex, onChange }: SpritePackEditorProps) {
  const [expandedPacks, setExpandedPacks] = useState<Set<string>>(new Set());
  const [editingPack, setEditingPack] = useState<SpritePack | null>(null);
  const [editingItem, setEditingItem] = useState<{ packId: string; item: SpritePackItem } | null>(null);
  const [showPackEditor, setShowPackEditor] = useState(false);
  const [showItemEditor, setShowItemEditor] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  
  // Drag & drop state
  const [draggedItem, setDraggedItem] = useState<{ packId: string; itemId: string; index: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ packId: string; index: number } | null>(null);

  const updatePacks = (newPacks: SpritePack[]) => {
    onChange(newPacks);
  };

  // Pack operations
  const handleAddPack = () => {
    const newPack: SpritePack = {
      ...DEFAULT_PACK,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setEditingPack(newPack);
    setShowPackEditor(true);
  };

  const handleEditPack = (pack: SpritePack) => {
    setEditingPack({ ...pack });
    setShowPackEditor(true);
  };

  const handleDeletePack = (id: string) => {
    updatePacks(packs.filter(p => p.id !== id));
  };

  const handleSavePack = () => {
    if (!editingPack) return;
    
    const existingIndex = packs.findIndex(p => p.id === editingPack.id);
    const updatedPack = { ...editingPack, updatedAt: new Date().toISOString() };
    
    if (existingIndex >= 0) {
      const newPacks = [...packs];
      newPacks[existingIndex] = updatedPack;
      updatePacks(newPacks);
    } else {
      updatePacks([...packs, { ...updatedPack, createdAt: new Date().toISOString() }]);
    }
    
    setEditingPack(null);
    setShowPackEditor(false);
  };

  const handleTogglePack = (id: string) => {
    updatePacks(packs.map(p => 
      p.id === id ? { ...p, active: !p.active, updatedAt: new Date().toISOString() } : p
    ));
  };

  const toggleExpandPack = (id: string) => {
    const newExpanded = new Set(expandedPacks);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedPacks(newExpanded);
  };

  // Keyword operations
  const handleAddKeyword = () => {
    if (!editingPack || !newKeyword.trim()) return;
    
    const keyword = newKeyword.trim().toLowerCase();
    if (!editingPack.keywords.includes(keyword)) {
      setEditingPack({
        ...editingPack,
        keywords: [...editingPack.keywords, keyword],
      });
    }
    setNewKeyword('');
  };

  const handleRemoveKeyword = (keyword: string) => {
    if (!editingPack) return;
    setEditingPack({
      ...editingPack,
      keywords: editingPack.keywords.filter(k => k !== keyword),
    });
  };

  // Item operations
  const handleAddItem = (packId: string) => {
    const newItem: SpritePackItem = {
      ...DEFAULT_ITEM,
      id: uuidv4(),
    };
    setEditingItem({ packId, item: newItem });
    setShowItemEditor(true);
  };

  const handleEditItem = (packId: string, item: SpritePackItem) => {
    setEditingItem({ packId, item: { ...item } });
    setShowItemEditor(true);
  };

  const handleDeleteItem = (packId: string, itemId: string) => {
    updatePacks(packs.map(p => {
      if (p.id !== packId) return p;
      return {
        ...p,
        items: p.items.filter(i => i.id !== itemId),
        updatedAt: new Date().toISOString(),
      };
    }));
  };

  const handleSaveItem = () => {
    if (!editingItem) return;
    
    updatePacks(packs.map(p => {
      if (p.id !== editingItem.packId) return p;
      
      const existingIndex = p.items.findIndex(i => i.id === editingItem.item.id);
      let newItems: SpritePackItem[];
      
      if (existingIndex >= 0) {
        newItems = [...p.items];
        newItems[existingIndex] = editingItem.item;
      } else {
        newItems = [...p.items, { ...editingItem.item, id: editingItem.item.id || uuidv4() }];
      }
      
      return {
        ...p,
        items: newItems,
        updatedAt: new Date().toISOString(),
      };
    }));
    
    setEditingItem(null);
    setShowItemEditor(false);
  };

  const handleToggleItem = (packId: string, itemId: string) => {
    updatePacks(packs.map(p => {
      if (p.id !== packId) return p;
      return {
        ...p,
        items: p.items.map(i => 
          i.id === itemId ? { ...i, enabled: !i.enabled } : i
        ),
        updatedAt: new Date().toISOString(),
      };
    }));
  };

  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, packId: string, itemId: string, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggedItem({ packId, itemId, index });
    
    // Add visual feedback
    const target = e.target as HTMLElement;
    setTimeout(() => target.classList.add('opacity-50'), 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.target as HTMLElement;
    target.classList.remove('opacity-50');
    setDraggedItem(null);
    setDropTarget(null);
  };

  const handleDragOver = (e: React.DragEvent, packId: string, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (draggedItem && draggedItem.packId === packId) {
      setDropTarget({ packId, index });
    }
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = (e: React.DragEvent, packId: string, targetIndex: number) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem.packId !== packId) return;
    
    const sourceIndex = draggedItem.index;
    if (sourceIndex === targetIndex) return;
    
    // Reorder items
    updatePacks(packs.map(p => {
      if (p.id !== packId) return p;
      
      const newItems = [...p.items];
      const [movedItem] = newItems.splice(sourceIndex, 1);
      newItems.splice(targetIndex, 0, movedItem);
      
      return {
        ...p,
        items: newItems,
        updatedAt: new Date().toISOString(),
      };
    }));
    
    setDraggedItem(null);
    setDropTarget(null);
  };

  // Import/Export handlers
  const handleExportPacks = () => {
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      packs: packs,
      libraries: libraries,
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sprite-packs-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleImportPacks = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        
        if (data.packs && Array.isArray(data.packs)) {
          // Merge imported packs with existing
          const newPacks = data.packs.map((p: SpritePack) => ({
            ...p,
            id: uuidv4(), // Generate new IDs to avoid conflicts
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }));
          
          updatePacks([...packs, ...newPacks]);
        }
      } catch (error) {
        console.error('Failed to import packs:', error);
        alert('Error al importar: formato inválido');
      }
    };
    reader.readAsText(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDuplicatePack = (pack: SpritePack) => {
    const duplicated: SpritePack = {
      ...pack,
      id: uuidv4(),
      title: `${pack.title} (copia)`,
      items: pack.items.map(item => ({ ...item, id: uuidv4() })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    updatePacks([...packs, duplicated]);
  };

  // Get built keys preview for an item
  const getBuiltKeysPreview = (item: SpritePackItem): string[] => {
    const keys: string[] = [];
    
    if (item.actionId) {
      const action = libraries.actions.find(a => a.id === item.actionId);
      if (action) keys.push(`${action.prefix}${action.name}`);
    }
    if (item.poseId) {
      const pose = libraries.poses.find(p => p.id === item.poseId);
      if (pose) keys.push(`${pose.prefix}${pose.name}`);
    }
    if (item.clothesId) {
      const clothes = libraries.clothes.find(c => c.id === item.clothesId);
      if (clothes) keys.push(`${clothes.prefix}${clothes.name}`);
    }
    
    if (item.keys) {
      keys.push(...item.keys.split(',').map(k => k.trim()).filter(Boolean));
    }
    
    return keys;
  };

  // Get sprite preview URL
  const getSpritePreviewUrl = (item: SpritePackItem): string | null => {
    if (item.spriteUrl) return item.spriteUrl;
    if (item.spriteLabel && spriteIndex) {
      const entry = spriteIndex.sprites.find(s => s.label === item.spriteLabel);
      return entry?.url || null;
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Header with Import/Export */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Sprite Packs</h3>
          <p className="text-xs text-muted-foreground">
            Sistema avanzado con lógica <strong>ANY + ALL</strong> para coincidencia de tokens.
          </p>
        </div>
        <div className="flex gap-1">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".json"
            onChange={handleImportPacks}
          />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-1" />
            Importar
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPacks} disabled={packs.length === 0}>
            <Download className="w-4 h-4 mr-1" />
            Exportar
          </Button>
          <Button size="sm" onClick={handleAddPack}>
            <Plus className="w-4 h-4 mr-1" />
            Nuevo
          </Button>
        </div>
      </div>
      
      {/* How it works */}
      <div className="text-xs bg-muted/50 border rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <Package className="w-4 h-4 text-green-500" />
          ¿Cómo funcionan los Packs?
        </div>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div className="p-2 bg-amber-500/10 rounded border border-amber-500/20">
            <div className="font-medium text-amber-600 flex items-center gap-1">
              <Zap className="w-3 h-3" />
              Pack Keywords (ANY)
            </div>
            <p className="text-muted-foreground text-[10px] mt-1">
              <strong>Cualquiera</strong> de estas palabras activa el pack. 
              Ejemplo: |happy|, |smile|, |joy|
            </p>
          </div>
          <div className="p-2 bg-blue-500/10 rounded border border-blue-500/20">
            <div className="font-medium text-blue-600 flex items-center gap-1">
              <Key className="w-3 h-3" />
              Item Keys (ALL)
            </div>
            <p className="text-muted-foreground text-[10px] mt-1">
              <strong>Todas</strong> estas claves deben coincidir. 
              Ejemplo: act-wave + pose-sitting
            </p>
          </div>
        </div>
        <div className="p-2 bg-green-500/10 rounded border border-green-500/20 mt-2">
          <div className="font-medium text-green-600">Ejemplo completo:</div>
          <div className="text-[10px] text-muted-foreground mt-1">
            Pack: "Emociones" → Keywords: happy, smile | Items: [keys="happy" → sprite_happy], [keys="smile" → sprite_smile]
            <br />
            Mensaje: "|happy|" → Activa pack "Emociones" → Muestra sprite_happy
          </div>
        </div>
      </div>

      {/* Packs List */}
      {packs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border rounded-lg">
          <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No hay Sprite Packs</p>
          <p className="text-xs mt-1">Crea un pack o importa configuración</p>
        </div>
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="space-y-2 pr-2">
            {packs.map((pack) => (
              <Collapsible
                key={pack.id}
                open={expandedPacks.has(pack.id)}
                onOpenChange={() => toggleExpandPack(pack.id)}
              >
                <div className={cn(
                  "border rounded-lg",
                  !pack.active && "opacity-50"
                )}>
                  {/* Pack Header */}
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer">
                      {expandedPacks.has(pack.id) ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{pack.title}</span>
                          <Badge variant="outline" className="text-xs">
                            {pack.items.length} items
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {pack.keywords.slice(0, 3).map((kw) => (
                            <Badge key={kw} variant="secondary" className="text-xs">
                              {pack.requirePipes ? `|${kw}|` : kw}
                            </Badge>
                          ))}
                          {pack.keywords.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{pack.keywords.length - 3}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={pack.active}
                          onCheckedChange={() => handleTogglePack(pack.id)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleDuplicatePack(pack)}
                          title="Duplicar pack"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleEditPack(pack)}
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleDeletePack(pack.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  {/* Pack Items with Drag & Drop */}
                  <CollapsibleContent>
                    <div className="border-t px-3 py-2 bg-muted/30">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          Items (arrastra para reordenar)
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => handleAddItem(pack.id)}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Item
                        </Button>
                      </div>

                      {pack.items.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          No hay items. Agrega sprites que se activarán.
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {pack.items.map((item, index) => (
                            <div
                              key={item.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, pack.id, item.id, index)}
                              onDragEnd={handleDragEnd}
                              onDragOver={(e) => handleDragOver(e, pack.id, index)}
                              onDragLeave={handleDragLeave}
                              onDrop={(e) => handleDrop(e, pack.id, index)}
                              className={cn(
                                "flex items-center gap-2 p-2 bg-background rounded border cursor-move",
                                !item.enabled && "opacity-50",
                                dropTarget?.packId === pack.id && dropTarget.index === index && "border-primary border-2"
                              )}
                            >
                              {/* Drag Handle */}
                              <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              
                              {/* Sprite Preview */}
                              <div className="w-10 h-10 rounded border overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
                                {getSpritePreviewUrl(item) ? (
                                  <img
                                    src={getSpritePreviewUrl(item)!}
                                    alt={item.spriteLabel}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <ImageIcon className="w-4 h-4 text-muted-foreground" />
                                )}
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">
                                  {item.spriteLabel || 'Sin sprite'}
                                </div>
                                <div className="flex flex-wrap gap-0.5 mt-0.5">
                                  {getBuiltKeysPreview(item).slice(0, 3).map((key) => (
                                    <Badge key={key} variant="outline" className="text-[10px] px-1 py-0 h-4">
                                      {key}
                                    </Badge>
                                  ))}
                                  {getBuiltKeysPreview(item).length > 3 && (
                                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                      +{getBuiltKeysPreview(item).length - 3}
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <Switch
                                  checked={item.enabled}
                                  onCheckedChange={() => handleToggleItem(pack.id, item.id)}
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => handleEditItem(pack.id, item)}
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-destructive"
                                  onClick={() => handleDeleteItem(pack.id, item.id)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Info Box */}
      <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg space-y-1">
        <p>💡 <strong>Pack Keywords (ANY):</strong> Cualquiera de estas activa el pack.</p>
        <p>💡 <strong>Item Keys (ALL):</strong> TODAS las claves deben coincidir.</p>
        <p>💡 <strong>Drag & Drop:</strong> Arrastra los items para reordenarlos.</p>
        <p>💡 <strong>Import/Export:</strong> Guarda y carga configuraciones de packs.</p>
      </div>

      {/* Pack Editor Dialog */}
      <Dialog open={showPackEditor} onOpenChange={setShowPackEditor}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPack?.id && packs.find(p => p.id === editingPack.id)
                ? 'Editar Pack'
                : 'Nuevo Pack'}
            </DialogTitle>
          </DialogHeader>

          {editingPack && (
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-xs">Título</Label>
                <Input
                  value={editingPack.title}
                  onChange={(e) => setEditingPack({ ...editingPack, title: e.target.value })}
                  placeholder="Nombre del pack"
                  className="mt-1 h-8"
                />
              </div>

              <div>
                <Label className="text-xs">Palabras Clave (ANY activa el pack)</Label>
                <div className="flex gap-1.5 mt-1">
                  <Input
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    placeholder="Agregar palabra..."
                    onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                    className="h-8 flex-1"
                  />
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleAddKeyword}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {editingPack.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {editingPack.keywords.map((kw) => (
                      <Badge key={kw} variant="secondary" className="gap-1 text-xs">
                        {kw}
                        <X
                          className="w-3 h-3 cursor-pointer"
                          onClick={() => handleRemoveKeyword(kw)}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Requiere |pipes|</Label>
                  <Switch
                    checked={editingPack.requirePipes}
                    onCheckedChange={(requirePipes) => setEditingPack({ ...editingPack, requirePipes })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Distinguir mayúsculas</Label>
                  <Switch
                    checked={editingPack.caseSensitive}
                    onCheckedChange={(caseSensitive) => setEditingPack({ ...editingPack, caseSensitive })}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <Label>Cooldown (ms)</Label>
                  <span className="text-muted-foreground">{editingPack.cooldownMs}ms</span>
                </div>
                <Slider
                  value={[editingPack.cooldownMs]}
                  min={0}
                  max={10000}
                  step={100}
                  onValueChange={([v]) => setEditingPack({ ...editingPack, cooldownMs: v })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPack(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSavePack} disabled={!editingPack?.title}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Editor Dialog */}
      <Dialog open={showItemEditor} onOpenChange={setShowItemEditor}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem?.item.id && packs.find(p => p.id === editingItem?.packId)?.items.find(i => i.id === editingItem?.item.id)
                ? 'Editar Item'
                : 'Nuevo Item'}
            </DialogTitle>
            <DialogDescription>
              Configura el sprite y las claves que deben coincidir.
            </DialogDescription>
          </DialogHeader>

          {editingItem && (
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div>
                <Label className="text-xs font-medium">Sprite</Label>
                <SpriteSelector
                  value={editingItem.item.spriteLabel}
                  urlValue={editingItem.item.spriteUrl}
                  onChange={(label, url) => setEditingItem({
                    ...editingItem,
                    item: { 
                      ...editingItem.item, 
                      spriteLabel: label,
                      spriteUrl: url
                    }
                  })}
                  className="mt-2"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-medium">Librerías (generan claves automáticamente)</Label>
                
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Acción</Label>
                    <Select
                      value={editingItem.item.actionId || 'none'}
                      onValueChange={(v) => setEditingItem({
                        ...editingItem,
                        item: { ...editingItem.item, actionId: v === 'none' ? undefined : v }
                      })}
                    >
                      <SelectTrigger className="mt-1 h-8">
                        <SelectValue placeholder="Ninguna" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Ninguna</SelectItem>
                        {libraries.actions.map((action) => (
                          <SelectItem key={action.id} value={action.id}>
                            {action.prefix}{action.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Postura</Label>
                    <Select
                      value={editingItem.item.poseId || 'none'}
                      onValueChange={(v) => setEditingItem({
                        ...editingItem,
                        item: { ...editingItem.item, poseId: v === 'none' ? undefined : v }
                      })}
                    >
                      <SelectTrigger className="mt-1 h-8">
                        <SelectValue placeholder="Ninguna" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Ninguna</SelectItem>
                        {libraries.poses.map((pose) => (
                          <SelectItem key={pose.id} value={pose.id}>
                            {pose.prefix}{pose.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Ropa</Label>
                    <Select
                      value={editingItem.item.clothesId || 'none'}
                      onValueChange={(v) => setEditingItem({
                        ...editingItem,
                        item: { ...editingItem.item, clothesId: v === 'none' ? undefined : v }
                      })}
                    >
                      <SelectTrigger className="mt-1 h-8">
                        <SelectValue placeholder="Ninguna" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Ninguna</SelectItem>
                        {libraries.clothes.map((clothes) => (
                          <SelectItem key={clothes.id} value={clothes.id}>
                            {clothes.prefix}{clothes.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs">Claves Adicionales (CSV)</Label>
                <Input
                  value={editingItem.item.keys}
                  onChange={(e) => setEditingItem({
                    ...editingItem,
                    item: { ...editingItem.item, keys: e.target.value }
                  })}
                  placeholder="key1, key2, key3"
                  className="mt-1 h-8 font-mono"
                />
              </div>

              <div className="p-3 bg-muted rounded-lg">
                <Label className="text-xs text-muted-foreground">Claves que deben coincidir (ALL)</Label>
                <div className="flex flex-wrap gap-1 mt-2">
                  {getBuiltKeysPreview(editingItem.item).length > 0 ? (
                    getBuiltKeysPreview(editingItem.item).map((key) => (
                      <Badge key={key} variant="outline" className="font-mono text-xs">
                        {key}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin claves</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Sprite Idle (etiqueta)</Label>
                  <Input
                    value={editingItem.item.idleSpriteLabel || ''}
                    onChange={(e) => setEditingItem({
                      ...editingItem,
                      item: { ...editingItem.item, idleSpriteLabel: e.target.value || undefined }
                    })}
                    placeholder="label-idle"
                    className="mt-1 h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs">Retornar en (ms)</Label>
                  <Input
                    type="number"
                    value={editingItem.item.returnToIdleMs || 0}
                    onChange={(e) => setEditingItem({
                      ...editingItem,
                      item: { ...editingItem.item, returnToIdleMs: parseInt(e.target.value) || undefined }
                    })}
                    placeholder="0 = nunca"
                    className="mt-1 h-8"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs">Habilitado</Label>
                <Switch
                  checked={editingItem.item.enabled}
                  onCheckedChange={(enabled) => setEditingItem({
                    ...editingItem,
                    item: { ...editingItem.item, enabled }
                  })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveItem} 
              disabled={!editingItem?.item.spriteLabel && !editingItem?.item.spriteUrl}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
