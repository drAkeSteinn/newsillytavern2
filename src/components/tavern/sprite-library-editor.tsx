'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  Plus,
  Trash2,
  Edit,
  Play,
  PersonStanding,
  Shirt,
  Key,
  Library,
} from 'lucide-react';
import type { SpriteLibraries, SpriteLibraryEntry } from '@/types';
const uuidv4 = () => crypto.randomUUID();

interface SpriteLibraryEditorProps {
  libraries: SpriteLibraries;
  onChange: (libraries: SpriteLibraries) => void;
}

type LibraryType = 'actions' | 'poses' | 'clothes';

const LIBRARY_CONFIG: Record<LibraryType, { icon: React.ReactNode; label: string; defaultPrefix: string; description: string }> = {
  actions: {
    icon: <Play className="w-4 h-4" />,
    label: 'Acciones',
    defaultPrefix: 'act-',
    description: 'Acciones como wave, nod, bow, blush, etc.',
  },
  poses: {
    icon: <PersonStanding className="w-4 h-4" />,
    label: 'Posturas',
    defaultPrefix: 'pose-',
    description: 'Posturas como standing, sitting, lying, etc.',
  },
  clothes: {
    icon: <Shirt className="w-4 h-4" />,
    label: 'Ropa',
    defaultPrefix: 'cloth-',
    description: 'Vestimenta como casual, formal, sleep, etc.',
  },
};

export function SpriteLibraryEditor({ libraries, onChange }: SpriteLibraryEditorProps) {
  const [activeTab, setActiveTab] = useState<LibraryType>('actions');
  const [editingEntry, setEditingEntry] = useState<SpriteLibraryEntry | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const updateLibrary = (type: LibraryType, entries: SpriteLibraryEntry[]) => {
    onChange({
      ...libraries,
      [type]: entries,
    });
  };

  const handleAddEntry = () => {
    const config = LIBRARY_CONFIG[activeTab];
    const newEntry: SpriteLibraryEntry = {
      id: uuidv4(),
      name: '',
      prefix: config.defaultPrefix,
    };
    setEditingEntry(newEntry);
    setShowEditor(true);
  };

  const handleEditEntry = (entry: SpriteLibraryEntry) => {
    setEditingEntry({ ...entry });
    setShowEditor(true);
  };

  const handleDeleteEntry = (id: string) => {
    const currentLibrary = libraries[activeTab] || [];
    updateLibrary(activeTab, currentLibrary.filter(e => e.id !== id));
  };

  const handleSaveEntry = () => {
    if (!editingEntry) return;
    
    const currentLibrary = libraries[activeTab] || [];
    const existingIndex = currentLibrary.findIndex(e => e.id === editingEntry.id);
    
    if (existingIndex >= 0) {
      // Update existing
      const newEntries = [...currentLibrary];
      newEntries[existingIndex] = editingEntry;
      updateLibrary(activeTab, newEntries);
    } else {
      // Add new
      updateLibrary(activeTab, [...currentLibrary, editingEntry]);
    }
    
    setEditingEntry(null);
    setShowEditor(false);
  };

  const getGeneratedKey = (entry: SpriteLibraryEntry): string => {
    if (!entry.name) return '';
    return `${entry.prefix}${entry.name}`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Sprite Libraries</h3>
          <p className="text-xs text-muted-foreground">
            Define prefijos reutilizables para componer claves de sprite.
          </p>
        </div>
      </div>
      
      {/* How it works */}
      <div className="text-xs bg-muted/50 border rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <Library className="w-4 h-4 text-blue-500" />
          ¿Para qué sirven?
        </div>
        <p className="text-muted-foreground">
          Las libraries generan <strong>claves automáticas</strong> que puedes usar en los Packs. 
          Por ejemplo: <code className="bg-muted px-1 rounded">act-wave</code> + <code className="bg-muted px-1 rounded">pose-sitting</code> = 
          el sprite se muestra cuando el mensaje contiene tanto "wave" como "sitting".
        </p>
        <div className="grid grid-cols-3 gap-2 mt-2">
          <div className="p-2 bg-background rounded border text-center">
            <Play className="w-4 h-4 mx-auto text-amber-500 mb-1" />
            <div className="font-medium text-[11px]">Acciones</div>
            <div className="text-muted-foreground text-[10px]">act-wave, act-nod</div>
          </div>
          <div className="p-2 bg-background rounded border text-center">
            <PersonStanding className="w-4 h-4 mx-auto text-green-500 mb-1" />
            <div className="font-medium text-[11px]">Posturas</div>
            <div className="text-muted-foreground text-[10px]">pose-sitting, pose-standing</div>
          </div>
          <div className="p-2 bg-background rounded border text-center">
            <Shirt className="w-4 h-4 mx-auto text-pink-500 mb-1" />
            <div className="font-medium text-[11px]">Ropa</div>
            <div className="text-muted-foreground text-[10px]">cloth-casual, cloth-formal</div>
          </div>
        </div>
      </div>

      {/* Tabs for each library type */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as LibraryType)}>
        <TabsList className="grid w-full grid-cols-3">
          {Object.entries(LIBRARY_CONFIG).map(([key, config]) => (
            <TabsTrigger key={key} value={key} className="flex items-center gap-1.5">
              {config.icon}
              <span className="hidden sm:inline">{config.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.entries(LIBRARY_CONFIG).map(([key, config]) => {
          const entries = libraries[key as LibraryType] || [];
          
          return (
            <TabsContent key={key} value={key} className="space-y-3">
              {/* Description */}
              <p className="text-xs text-muted-foreground">{config.description}</p>
              
              {/* Add button */}
              <Button size="sm" onClick={handleAddEntry}>
                <Plus className="w-4 h-4 mr-1" />
                Agregar {config.label.slice(0, -1)}
              </Button>

              {/* Entries list */}
              {entries.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground border rounded-lg">
                  <Key className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No hay entradas</p>
                  <p className="text-xs mt-1">Agrega entradas para componer claves de sprite</p>
                </div>
              ) : (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2 pr-2">
                    {entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center gap-3 p-2 border rounded-lg hover:bg-muted/50"
                      >
                        {/* Generated Key */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm bg-muted px-2 py-0.5 rounded">
                              {getGeneratedKey(entry)}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            prefix: <code className="text-xs">{entry.prefix}</code>
                            {' • '}
                            name: <code className="text-xs">{entry.name}</code>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleEditEntry(entry)}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => handleDeleteEntry(entry.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Info Box */}
      <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg space-y-1">
        <p>💡 <strong>Prefix + Name:</strong> La clave generada es prefix + name (ej: act-wave)</p>
        <p>💡 <strong>Uso:</strong> Estas claves se usan en Sprite Packs para coincidir con tokens.</p>
        <p>💡 <strong>Ejemplo:</strong> Si el mensaje contiene |wave|, coincide con act-wave</p>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingEntry?.id && (libraries[activeTab] || []).find(e => e.id === editingEntry.id)
                ? `Editar ${LIBRARY_CONFIG[activeTab].label.slice(0, -1)}`
                : `Nueva ${LIBRARY_CONFIG[activeTab].label.slice(0, -1)}`}
            </DialogTitle>
            <DialogDescription>
              Define el nombre y prefijo para generar la clave del sprite.
            </DialogDescription>
          </DialogHeader>

          {editingEntry && (
            <div className="space-y-4 py-4">
              {/* Name */}
              <div>
                <Label className="text-xs">Nombre</Label>
                <Input
                  value={editingEntry.name}
                  onChange={(e) => setEditingEntry({ ...editingEntry, name: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                  placeholder="wave, nod, sitting..."
                  className="mt-1 h-8 font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Solo letras minúsculas, números, _ y -
                </p>
              </div>

              {/* Prefix */}
              <div>
                <Label className="text-xs">Prefijo</Label>
                <Input
                  value={editingEntry.prefix}
                  onChange={(e) => setEditingEntry({ ...editingEntry, prefix: e.target.value.toLowerCase() })}
                  placeholder="act-"
                  className="mt-1 h-8 font-mono"
                />
              </div>

              {/* Preview */}
              <div className="p-3 bg-muted rounded-lg">
                <Label className="text-xs text-muted-foreground">Clave generada</Label>
                <div className="font-mono text-lg mt-1">
                  {getGeneratedKey(editingEntry) || <span className="text-muted-foreground">-</span>}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEntry(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEntry} disabled={!editingEntry?.name}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
