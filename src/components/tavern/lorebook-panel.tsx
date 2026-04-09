'use client';

import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
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
import type { Lorebook, LorebookEntry, SillyTavernLorebook } from '@/types';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Trash2,
  BookOpen,
  Key,
  FileText,
  Download,
  Upload,
  Copy,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  Settings2,
  Pencil,
  ArrowLeft,
  ChevronRight,
} from 'lucide-react';
import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

// Position labels
const POSITION_LABELS: Record<number, string> = {
  0: 'Después del system',
  1: 'Después del usuario',
  2: 'Antes del usuario',
  3: 'Después del asistente',
  4: 'Antes del asistente',
  5: 'Inicio del chat',
  6: 'Final del chat',
  7: 'Outlet'
};

// Logic labels
const LOGIC_LABELS: Record<number, string> = {
  0: 'AND ANY',
  1: 'NOT ALL',
  2: 'NOT ANY',
  3: 'AND ALL'
};

export function LorebookPanel() {
  const {
    lorebooks,
    activeLorebookIds,
    addLorebook,
    updateLorebook,
    deleteLorebook,
    toggleLorebook,
    addLorebookEntry,
    updateLorebookEntry,
    deleteLorebookEntry,
    duplicateLorebookEntry,
    importSillyTavernLorebook,
    exportSillyTavernLorebook
  } = useTavernStore();

  const [selectedLorebookId, setSelectedLorebookId] = useState<string | null>(null);
  const [editingEntryUid, setEditingEntryUid] = useState<number | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importName, setImportName] = useState('');
  const [importDescription, setImportDescription] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<SillyTavernLorebook | null>(null);

  const selectedLorebook = lorebooks.find(l => l.id === selectedLorebookId);

  // Create new lorebook
  const handleCreateLorebook = () => {
    const newLorebook = {
      name: `Nuevo Lorebook ${lorebooks.length + 1}`,
      description: '',
      entries: [],
      settings: {
        scanDepth: 5,
        caseSensitive: false,
        matchWholeWords: false,
        useGroupScoring: false,
        automationId: '',
        tokenBudget: 2048,
        recursionLimit: 3
      },
      tags: [],
      active: true
    };
    addLorebook(newLorebook);
    setTimeout(() => {
      const latestLorebook = useTavernStore.getState().lorebooks[useTavernStore.getState().lorebooks.length - 1];
      if (latestLorebook) {
        setSelectedLorebookId(latestLorebook.id);
      }
    }, 50);
  };

  // Handle file import
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      
      if (!json.entries || typeof json.entries !== 'object') {
        throw new Error('Formato de lorebook inválido. Debe tener un campo "entries".');
      }

      setPendingImport(json);
      setImportName(file.name.replace(/\.json$/i, ''));
      setImportDescription('');
      setImportError(null);
      setImportDialogOpen(true);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Error al importar archivo');
      setImportDialogOpen(true);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Confirm import
  const handleConfirmImport = () => {
    if (!pendingImport || !importName.trim()) return;

    importSillyTavernLorebook(pendingImport, importName.trim(), importDescription);
    setImportDialogOpen(false);
    setPendingImport(null);
    setImportName('');
    setImportDescription('');
  };

  // Export lorebook
  const handleExport = (lorebook: Lorebook) => {
    const stLorebook = exportSillyTavernLorebook(lorebook.id);
    if (!stLorebook) return;

    const blob = new Blob([JSON.stringify(stLorebook, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lorebook.name.replace(/[^a-z0-9]/gi, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Add new entry
  const handleAddEntry = () => {
    if (!selectedLorebookId) return;
    addLorebookEntry(selectedLorebookId, {
      key: [],
      keysecondary: [],
      comment: 'Nueva Entrada',
      content: ''
    });
  };

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h3 className="font-medium text-base">Lorebooks</h3>
          <p className="text-sm text-muted-foreground">
            Información del mundo inyectada según palabras clave
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileImport}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4 mr-1" />
            Importar
          </Button>
          <Button size="sm" onClick={handleCreateLorebook}>
            <Plus className="w-4 h-4 mr-1" />
            Nuevo
          </Button>
        </div>
      </div>

      {/* Main Content */}
      {lorebooks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground border rounded-lg">
          <div className="text-center">
            <BookOpen className="w-16 h-16 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium">No hay lorebooks creados</p>
            <p className="text-sm mt-1">Crea un lorebook o importa uno de SillyTavern</p>
            <Button className="mt-4" onClick={handleCreateLorebook}>
              <Plus className="w-4 h-4 mr-2" />
              Crear Lorebook
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-[200px_1fr] md:grid-cols-[240px_1fr] lg:grid-cols-[280px_1fr] gap-4 min-h-0">
          {/* Left: Lorebook List */}
          <div className="flex flex-col border rounded-lg overflow-hidden">
            <div className="p-2 border-b bg-muted/30 flex-shrink-0">
              <Label className="text-xs text-muted-foreground">Lorebooks ({lorebooks.length})</Label>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-1.5 space-y-1">
                {lorebooks.map((lorebook) => (
                  <div
                    key={lorebook.id}
                    className={cn(
                      'p-2 rounded-lg border cursor-pointer transition-colors',
                      selectedLorebookId === lorebook.id
                        ? 'border-primary bg-primary/10'
                        : 'hover:bg-muted/50'
                    )}
                    onClick={() => setSelectedLorebookId(lorebook.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={cn(
                            'w-2 h-2 rounded-full flex-shrink-0',
                            activeLorebookIds.includes(lorebook.id)
                              ? 'bg-green-500'
                              : 'bg-muted-foreground'
                          )}
                        />
                        <span className="font-medium truncate text-sm">{lorebook.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0 ml-1">
                        {lorebook.entries.length}
                      </span>
                    </div>
                    {lorebook.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate pl-4">
                        {lorebook.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Right: Lorebook Details */}
          {selectedLorebook ? (
            <div className="flex flex-col border rounded-lg overflow-hidden">
              {/* Lorebook Header */}
              <div className="p-2 border-b bg-muted/30 flex items-center justify-between gap-4 flex-shrink-0">
                <div className="flex items-center gap-2 flex-1">
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full flex-shrink-0',
                      activeLorebookIds.includes(selectedLorebook.id)
                        ? 'bg-green-500'
                        : 'bg-muted-foreground'
                    )}
                  />
                  <Input
                    value={selectedLorebook.name}
                    onChange={(e) => updateLorebook(selectedLorebook.id, { name: e.target.value })}
                    className="font-medium h-7 flex-1 max-w-[200px] text-sm"
                  />
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => toggleLorebook(selectedLorebook.id)}
                    title={activeLorebookIds.includes(selectedLorebook.id) ? 'Desactivar' : 'Activar'}
                  >
                    {activeLorebookIds.includes(selectedLorebook.id) ? (
                      <ToggleRight className="w-4 h-4 text-green-500" />
                    ) : (
                      <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => handleExport(selectedLorebook)}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm('¿Estás seguro de que deseas eliminar este lorebook?')) {
                        deleteLorebook(selectedLorebook.id);
                        setSelectedLorebookId(null);
                      }
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Settings Bar */}
              <div className="p-2 border-b flex-shrink-0 bg-muted/10">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                  <div>
                    <Label className="text-xs">Descripción</Label>
                    <Input
                      value={selectedLorebook.description}
                      onChange={(e) => updateLorebook(selectedLorebook.id, { description: e.target.value })}
                      placeholder="Opcional..."
                      className="mt-1 h-7 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Profundidad: {selectedLorebook.settings.scanDepth}</Label>
                    <Slider
                      value={[selectedLorebook.settings.scanDepth]}
                      min={1}
                      max={20}
                      step={1}
                      onValueChange={([value]) =>
                        updateLorebook(selectedLorebook.id, {
                          settings: { ...selectedLorebook.settings, scanDepth: value }
                        })
                      }
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Tokens: {selectedLorebook.settings.tokenBudget}</Label>
                    <Slider
                      value={[selectedLorebook.settings.tokenBudget]}
                      min={256}
                      max={8192}
                      step={256}
                      onValueChange={([value]) =>
                        updateLorebook(selectedLorebook.id, {
                          settings: { ...selectedLorebook.settings, tokenBudget: value }
                        })
                      }
                      className="mt-2"
                    />
                  </div>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer pb-1">
                    <Switch
                      checked={selectedLorebook.settings.caseSensitive}
                      onCheckedChange={(checked) =>
                        updateLorebook(selectedLorebook.id, {
                          settings: { ...selectedLorebook.settings, caseSensitive: checked }
                        })
                      }
                    />
                    Mayúsculas
                  </label>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer pb-1">
                    <Switch
                      checked={selectedLorebook.settings.matchWholeWords}
                      onCheckedChange={(checked) =>
                        updateLorebook(selectedLorebook.id, {
                          settings: { ...selectedLorebook.settings, matchWholeWords: checked }
                        })
                      }
                    />
                    Palabras completas
                  </label>
                </div>
              </div>

              {/* Content Area */}
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                <div className="p-3 space-y-3 flex-1 flex flex-col min-h-0">
                  {/* Entries Section */}
                  <div className="border rounded-lg overflow-hidden flex-1 flex flex-col min-h-0">
                    <div className="p-2 border-b bg-muted/30 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2">
                        {editingEntryUid !== null && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs"
                            onClick={() => setEditingEntryUid(null)}
                          >
                            <ArrowLeft className="w-3 h-3 mr-1" />
                            Entradas
                          </Button>
                        )}
                        <Label className="text-xs">
                          {editingEntryUid !== null 
                            ? `Editando: ${selectedLorebook.entries.find(e => e.uid === editingEntryUid)?.comment || 'Sin título'}`
                            : `Entradas (${selectedLorebook.entries.length})`
                          }
                        </Label>
                      </div>
                      {editingEntryUid === null && (
                        <Button size="sm" variant="outline" className="h-6 text-xs" onClick={handleAddEntry}>
                          <Plus className="w-3 h-3 mr-1" />
                          Agregar
                        </Button>
                      )}
                    </div>

                    <div className="flex-1 overflow-y-auto min-h-0">
                      {selectedLorebook.entries.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground">
                          <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Sin entradas</p>
                          <p className="text-xs">Agrega entradas para definir información del mundo</p>
                        </div>
                      ) : editingEntryUid !== null ? (
                        // Full-width editor for selected entry
                        <div className="p-4">
                          {(() => {
                            const entry = selectedLorebook.entries.find(e => e.uid === editingEntryUid);
                            if (!entry) return null;
                            return (
                              <LorebookEntryEditor
                                entry={entry}
                                lorebookId={selectedLorebook.id}
                                onUpdate={(updates) =>
                                  updateLorebookEntry(selectedLorebook.id, entry.uid, updates)
                                }
                                onDelete={() => {
                                  if (confirm('¿Eliminar esta entrada?')) {
                                    deleteLorebookEntry(selectedLorebook.id, entry.uid);
                                    setEditingEntryUid(null);
                                  }
                                }}
                                onDuplicate={() =>
                                  duplicateLorebookEntry(selectedLorebook.id, entry.uid)
                                }
                              />
                            );
                          })()}
                        </div>
                      ) : (
                        // Compact entry list
                        <div className="divide-y">
                          {selectedLorebook.entries.map((entry) => (
                            <button
                              key={entry.uid}
                              type="button"
                              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left group"
                              onClick={() => setEditingEntryUid(entry.uid)}
                            >
                              <div
                                className={cn(
                                  'w-2 h-2 rounded-full flex-shrink-0',
                                  entry.disable ? 'bg-muted-foreground' : 'bg-green-500'
                                )}
                              />
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-sm truncate block">
                                  {entry.comment || 'Sin título'}
                                </span>
                                {entry.key.length > 0 && (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <Key className="w-2.5 h-2.5 text-muted-foreground" />
                                    <span className="text-[10px] text-muted-foreground truncate">
                                      {entry.key.slice(0, 5).join(', ')}{entry.key.length > 5 ? '...' : ''}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                                <span className="bg-muted px-1.5 py-0.5 rounded">
                                  {entry.key.length} claves
                                </span>
                                {!entry.disable && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-green-500/10 text-green-600 border-green-500/20">
                                    {POSITION_LABELS[entry.position] || `Pos.${entry.position}`}
                                  </Badge>
                                )}
                              </div>
                              <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center border rounded-lg text-muted-foreground">
              <div className="text-center">
                <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Selecciona un lorebook para editar</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar Lorebook</DialogTitle>
          </DialogHeader>
          {importError ? (
            <div className="p-4 rounded-lg bg-destructive/10 text-destructive flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <div>
                <p className="font-medium">Error al importar</p>
                <p className="text-sm">{importError}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>Nombre del Lorebook</Label>
                <Input
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                  placeholder="Mi Lorebook"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Descripción (opcional)</Label>
                <Textarea
                  value={importDescription}
                  onChange={(e) => setImportDescription(e.target.value)}
                  placeholder="Descripción del lorebook..."
                  rows={3}
                  className="mt-1"
                />
              </div>
              {pendingImport && (
                <div className="p-3 rounded-lg bg-muted text-sm">
                  <p>
                    <strong>{Object.keys(pendingImport.entries).length}</strong> entradas detectadas
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              Cancelar
            </Button>
            {!importError && (
              <Button onClick={handleConfirmImport} disabled={!importName.trim()}>
                Importar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Entry Editor Component
interface LorebookEntryEditorProps {
  entry: LorebookEntry;
  lorebookId: string;
  onUpdate: (updates: Partial<LorebookEntry>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

function LorebookEntryEditor({
  entry,
  onUpdate,
  onDelete,
  onDuplicate
}: LorebookEntryEditorProps) {
  const parseKeywords = (value: string): string[] => {
    return value
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);
  };

  const formatKeywords = (keywords: string[]): string => {
    return keywords.join(', ');
  };

  return (
    <div className="space-y-3 pt-1">
      {/* Row 1: Title, Active Toggle */}
      <div className="grid grid-cols-4 gap-3">
        <div className="col-span-3">
          <Label className="text-xs">Título</Label>
          <Input
            value={entry.comment}
            onChange={(e) => onUpdate({ comment: e.target.value })}
            className="mt-1 h-7 text-sm"
          />
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <Switch
              checked={!entry.disable}
              onCheckedChange={(checked) => onUpdate({ disable: !checked })}
            />
            Activo
          </label>
        </div>
      </div>

      {/* Row 2: Primary Keys */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Key className="w-3 h-3 text-primary" />
          <Label className="text-xs">Palabras Clave Primarias</Label>
        </div>
        <Input
          value={formatKeywords(entry.key)}
          onChange={(e) => onUpdate({ key: parseKeywords(e.target.value) })}
          placeholder="palabra1, palabra2... o /regex/i"
          className="h-7 text-sm"
        />
        <p className="text-[10px] text-muted-foreground">
          Soporta regex: /patrón/flags (ej: /(?:clima|lluvia)/i)
        </p>
      </div>

      {/* Row 3: Secondary Keys */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Key className="w-3 h-3 text-muted-foreground" />
          <Label className="text-xs">Palabras Clave Secundarias</Label>
        </div>
        <Input
          value={formatKeywords(entry.keysecondary)}
          onChange={(e) => onUpdate({ keysecondary: parseKeywords(e.target.value) })}
          placeholder="adicional1, adicional2..."
          className="h-7 text-sm"
        />
      </div>

      {/* Row 4: Content */}
      <div className="space-y-1.5">
        <Label className="text-xs">Contenido</Label>
        <Textarea
          value={entry.content}
          onChange={(e) => onUpdate({ content: e.target.value })}
          placeholder="Información que se inyectará..."
          rows={3}
          className="font-mono text-sm"
        />
      </div>

      {/* Row 5: Options Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
        <div>
          <Label className="text-xs">Posición</Label>
          <Select
            value={entry.position.toString()}
            onValueChange={(value) => onUpdate({ position: parseInt(value) as LorebookEntry['position'] })}
          >
            <SelectTrigger className="mt-1 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(POSITION_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value} className="text-xs">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Lógica</Label>
          <Select
            value={entry.selectLogic.toString()}
            onValueChange={(value) => onUpdate({ selectLogic: parseInt(value) })}
          >
            <SelectTrigger className="mt-1 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(LOGIC_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value} className="text-xs">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Grupo</Label>
          <Input
            value={entry.group}
            onChange={(e) => onUpdate({ group: e.target.value })}
            placeholder="-"
            className="mt-1 h-7 text-xs"
          />
        </div>

        <div>
          <Label className="text-xs">Prof.</Label>
          <Input
            type="number"
            min={0}
            max={999}
            value={entry.depth}
            onChange={(e) => onUpdate({ depth: parseInt(e.target.value) || 0 })}
            className="mt-1 h-7 text-xs"
          />
        </div>

        <div>
          <Label className="text-xs">Orden</Label>
          <Input
            type="number"
            min={0}
            value={entry.order}
            onChange={(e) => onUpdate({ order: parseInt(e.target.value) || 0 })}
            className="mt-1 h-7 text-xs"
          />
        </div>

        <div>
          <Label className="text-xs">Prob.%</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={entry.probability}
            onChange={(e) => onUpdate({ probability: parseInt(e.target.value) || 0 })}
            className="mt-1 h-7 text-xs"
          />
        </div>
      </div>

      {/* Outlet Name - Only show when position is 7 (Outlet) */}
      {entry.position === 7 && (
        <div className="space-y-1.5 p-2 bg-muted/50 rounded border">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs font-medium">Nombre del Outlet</Label>
          </div>
          <Input
            value={entry.outletName || ''}
            onChange={(e) => onUpdate({ outletName: e.target.value })}
            placeholder="miOutlet"
            className="h-7 text-sm"
          />
          <p className="text-[10px] text-muted-foreground">
            Usa {'{{outlet::nombre}}'} en el prompt para insertar este contenido manualmente.
          </p>
        </div>
      )}

      {/* Row 6: Toggles in a row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-1.5">
        <label className="flex items-center justify-between p-1.5 rounded border text-xs cursor-pointer">
          Siempre
          <Switch
            checked={entry.constant}
            onCheckedChange={(checked) => onUpdate({ constant: checked })}
          />
        </label>
        <label className="flex items-center justify-between p-1.5 rounded border text-xs cursor-pointer">
          Prob.
          <Switch
            checked={entry.useProbability}
            onCheckedChange={(checked) => onUpdate({ useProbability: checked })}
          />
        </label>
        <label className="flex items-center justify-between p-1.5 rounded border text-xs cursor-pointer">
          Exc.Rec.
          <Switch
            checked={entry.excludeRecursion}
            onCheckedChange={(checked) => onUpdate({ excludeRecursion: checked })}
          />
        </label>
        <label className="flex items-center justify-between p-1.5 rounded border text-xs cursor-pointer">
          Prev.Rec.
          <Switch
            checked={entry.preventRecursion}
            onCheckedChange={(checked) => onUpdate({ preventRecursion: checked })}
          />
        </label>
      </div>

      {/* Row 7: Actions */}
      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onDuplicate}>
          <Copy className="w-3 h-3 mr-1" />
          Duplicar
        </Button>
        <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={onDelete}>
          <Trash2 className="w-3 h-3 mr-1" />
          Eliminar
        </Button>
      </div>
    </div>
  );
}
