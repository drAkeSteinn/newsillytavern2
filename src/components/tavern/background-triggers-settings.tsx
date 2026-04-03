'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import type { BackgroundTriggerPack, BackgroundTriggerItem, BackgroundCollection, BackgroundMatchMode } from '@/types';
import {
  Plus,
  Trash2,
  RefreshCw,
  Image as ImageIcon,
  Layers,
  Key,
  Palette,
  ArrowUpDown,
  Clock,
  Target,
  Sparkles,
} from 'lucide-react';

const MATCH_MODE_DESCRIPTIONS: Record<BackgroundMatchMode, { label: string; description: string }> = {
  any_any: { label: 'ANY + ANY', description: 'Cualquier trigger + cualquier context' },
  all_any: { label: 'ALL + ANY', description: 'Todos los triggers + cualquier context' },
  any_all: { label: 'ANY + ALL', description: 'Cualquier trigger + todos los context' },
  all_all: { label: 'ALL + ALL', description: 'Todos los triggers + todos los context' },
};

export function BackgroundTriggersSettings() {
  const {
    backgroundTriggerPacks,
    backgroundCollections,
    settings,
    addBackgroundTriggerPack,
    updateBackgroundTriggerPack,
    deleteBackgroundTriggerPack,
    toggleBackgroundTriggerPack,
    setBackgroundCollections,
    addBackgroundTriggerItem,
    updateBackgroundTriggerItem,
    deleteBackgroundTriggerItem,
    updateSettings,
  } = useTavernStore();

  const [isLoading, setIsLoading] = useState(false);
  const [expandedPacks, setExpandedPacks] = useState<string[]>([]);
  const [previewBackground, setPreviewBackground] = useState<string | null>(null);

  // Fetch background collections
  const fetchCollections = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/backgrounds/collections');
      const data = await response.json();
      console.log('[BgTriggers] Loaded collections:', data.collections?.length || 0);
      setBackgroundCollections(data.collections || []);
    } catch (error) {
      console.error('[BgTriggers] Failed to fetch collections:', error);
    } finally {
      setIsLoading(false);
    }
  }, [setBackgroundCollections]);

  // Fetch collections on mount
  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  // Create new trigger pack
  const handleAddPack = () => {
    const firstCollection = backgroundCollections[0];
    const newPack: Omit<BackgroundTriggerPack, 'id' | 'createdAt' | 'updatedAt'> = {
      name: `Nuevo Pack ${backgroundTriggerPacks.length + 1}`,
      active: true,
      collection: firstCollection?.name || '',
      priority: backgroundTriggerPacks.length * 10, // Auto-increment priority
      cooldown: 0,
      matchMode: 'any_any',
      transitionDuration: 500,
      transitionType: 'fade',
      items: [],
      returnToDefault: false,
      returnToDefaultAfter: 0,
      defaultBackground: '',
    };
    addBackgroundTriggerPack(newPack);
  };

  // Add item from collection to pack
  const handleAddItemToPack = (packId: string, collection: BackgroundCollection) => {
    const maxPriority = backgroundTriggerPacks
      .find(p => p.id === packId)?.items.reduce((max, item) => Math.max(max, item.priority ?? 0), 0) ?? 0;

    addBackgroundTriggerItem(packId, {
      backgroundUrl: collection.entries[0]?.url || '',
      backgroundName: collection.entries[0]?.name || 'Nuevo Item',
      triggerKeys: [],
      contextKeys: [],
      enabled: true,
      priority: maxPriority + 10,
    });
  };

  // Get collection by name
  const getCollection = (name: string): BackgroundCollection | undefined => {
    return backgroundCollections.find(c => c.name === name);
  };

  return (
    <div className="h-full flex flex-col gap-4 min-h-0">
      {/* Global Settings */}
      <div className="p-4 rounded-lg border bg-muted/30 space-y-4 flex-shrink-0">
        <h4 className="font-medium flex items-center gap-2">
          <Layers className="w-4 h-4" />
          Configuración Global de Backgrounds
        </h4>

        <div className="grid grid-cols-4 gap-4">
          <label className="flex items-center justify-between p-2 rounded border bg-background">
            <span className="text-sm">Habilitar</span>
            <Switch
              checked={settings.backgroundTriggers?.enabled ?? true}
              onCheckedChange={(checked) =>
                updateSettings({
                  backgroundTriggers: { ...settings.backgroundTriggers, enabled: checked }
                })
              }
            />
          </label>

          <label className="flex items-center justify-between p-2 rounded border bg-background">
            <span className="text-sm">Tiempo Real</span>
            <Switch
              checked={settings.backgroundTriggers?.realtimeEnabled ?? true}
              onCheckedChange={(checked) =>
                updateSettings({
                  backgroundTriggers: { ...settings.backgroundTriggers, realtimeEnabled: checked }
                })
              }
            />
          </label>

          <div className="col-span-2">
            <div className="flex justify-between text-sm mb-1">
              <span>Duración Transición</span>
              <span className="text-muted-foreground">{settings.backgroundTriggers?.transitionDuration ?? 500}ms</span>
            </div>
            <Slider
              value={[settings.backgroundTriggers?.transitionDuration ?? 500]}
              min={0}
              max={2000}
              step={50}
              onValueChange={([value]) =>
                updateSettings({
                  backgroundTriggers: { ...settings.backgroundTriggers, transitionDuration: value }
                })
              }
            />
          </div>
        </div>

        {/* Return to Default Settings */}
        <div className="grid grid-cols-4 gap-4 p-3 rounded border bg-background/50">
          <label className="flex items-center justify-between p-2 rounded border bg-background">
            <span className="text-sm flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Return to Default
            </span>
            <Switch
              checked={settings.backgroundTriggers?.returnToDefaultEnabled ?? false}
              onCheckedChange={(checked) =>
                updateSettings({
                  backgroundTriggers: { ...settings.backgroundTriggers, returnToDefaultEnabled: checked }
                })
              }
            />
          </label>

          <div>
            <Label className="text-xs">Tiempo de inactividad (min)</Label>
            <Input
              type="number"
              min={0}
              step={1}
              value={Math.floor((settings.backgroundTriggers?.returnToDefaultAfter ?? 300000) / 60000)}
              onChange={(e) =>
                updateSettings({
                  backgroundTriggers: { 
                    ...settings.backgroundTriggers, 
                    returnToDefaultAfter: (parseInt(e.target.value) || 5) * 60000 
                  }
                })
              }
              className="mt-1 h-8"
            />
          </div>

          <div className="col-span-2">
            <Label className="text-xs">Fondo por defecto global</Label>
            <Select
              value={settings.backgroundTriggers?.defaultBackgroundUrl || ''}
              onValueChange={(url) =>
                updateSettings({
                  backgroundTriggers: { ...settings.backgroundTriggers, defaultBackgroundUrl: url }
                })
              }
            >
              <SelectTrigger className="mt-1 h-8">
                <SelectValue placeholder="Seleccionar fondo" />
              </SelectTrigger>
              <SelectContent>
                {backgroundCollections.flatMap(col => 
                  col.entries.map(entry => (
                    <SelectItem key={entry.id} value={entry.url}>
                      {col.name} / {entry.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label className="text-xs">Enfriamiento Global (ms)</Label>
            <Input
              type="number"
              min={0}
              step={50}
              value={settings.backgroundTriggers?.globalCooldown ?? 0}
              onChange={(e) =>
                updateSettings({
                  backgroundTriggers: { ...settings.backgroundTriggers, globalCooldown: parseInt(e.target.value) || 0 }
                })
              }
              className="mt-1 h-8"
            />
            <p className="text-xs text-muted-foreground mt-1">0 = sin límite</p>
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchCollections}
              disabled={isLoading}
              className="w-full h-8"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 mr-1", isLoading && "animate-spin")} />
              Actualizar Colecciones
            </Button>
          </div>
          <div className="flex items-end">
            <p className="text-xs text-muted-foreground">
              {backgroundCollections.length} colecciones · {backgroundCollections.reduce((acc, c) => acc + c.entries.length, 0)} fondos
            </p>
          </div>
        </div>
      </div>

      {/* Trigger Packs Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <h4 className="font-medium flex items-center gap-2">
          <Palette className="w-4 h-4" />
          Packs de Background Triggers ({backgroundTriggerPacks.length})
        </h4>
        <Button size="sm" onClick={handleAddPack}>
          <Plus className="w-4 h-4 mr-1" />
          Agregar Pack
        </Button>
      </div>

      {/* No Collections Warning */}
      {!isLoading && backgroundCollections.length === 0 && (
        <div className="p-4 rounded-lg border border-yellow-500/50 bg-yellow-500/10 text-sm flex-shrink-0">
          <p className="font-medium text-yellow-500">No se encontraron colecciones de backgrounds</p>
          <p className="text-muted-foreground mt-1">
            Agrega carpetas con imágenes a <code className="bg-muted px-1 rounded">public/backgrounds/</code> con un archivo <code className="bg-muted px-1 rounded">collection.json</code>
          </p>
        </div>
      )}

      {/* Trigger Packs Accordion */}
      {backgroundTriggerPacks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground min-h-0">
          <div className="text-center">
            <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No hay packs de background triggers configurados</p>
            <p className="text-xs mt-1">Agrega un pack para cambiar fondos basados en palabras clave</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full">
            <Accordion
              type="multiple"
              value={expandedPacks}
              onValueChange={setExpandedPacks}
              className="space-y-2 pr-4"
            >
            {backgroundTriggerPacks
              .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
              .map((pack) => {
                const collection = getCollection(pack.collection);

                return (
                  <AccordionItem
                    key={pack.id}
                    value={pack.id}
                    className="border rounded-lg data-[state=open]:bg-muted/10"
                  >
                    <AccordionTrigger className="px-4 py-2 hover:no-underline">
                      <div className="flex items-center gap-3 w-full">
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full flex-shrink-0",
                            pack.active ? "bg-green-500" : "bg-muted-foreground"
                          )}
                        />
                        <span className="font-medium text-sm">{pack.name}</span>
                        <span className="text-xs text-muted-foreground ml-auto mr-2 flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <ArrowUpDown className="w-3 h-3" />
                            {pack.priority}
                          </span>
                          <span>{pack.items.length} items</span>
                        </span>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-3 pt-2">
                        {/* Pack Settings Row */}
                                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                          <div>
                            <Label className="text-xs">Nombre</Label>
                            <Input
                              value={pack.name}
                              onChange={(e) => updateBackgroundTriggerPack(pack.id, { name: e.target.value })}
                              className="mt-1 h-8"
                            />
                          </div>
                          <div className="flex items-end pb-1">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                              <Switch
                                checked={pack.active}
                                onCheckedChange={() => toggleBackgroundTriggerPack(pack.id)}
                              />
                              Activo
                            </label>
                          </div>
                          <div>
                            <Label className="text-xs flex items-center gap-1">
                              <ArrowUpDown className="w-3 h-3" />
                              Prioridad
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={pack.priority ?? 0}
                              onChange={(e) =>
                                updateBackgroundTriggerPack(pack.id, { priority: parseInt(e.target.value) || 0 })
                              }
                              className="mt-1 h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Colección</Label>
                            <Select
                              value={pack.collection}
                              onValueChange={(value) => updateBackgroundTriggerPack(pack.id, { collection: value })}
                            >
                              <SelectTrigger className="mt-1 h-8">
                                <SelectValue placeholder="Seleccionar" />
                              </SelectTrigger>
                              <SelectContent>
                                {backgroundCollections.map((col) => (
                                  <SelectItem key={col.name} value={col.name}>
                                    {col.name}
                                    <span className="text-xs text-muted-foreground ml-1">
                                      ({col.entries.length})
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs flex items-center gap-1">
                              <Target className="w-3 h-3" />
                              Modo Match
                            </Label>
                            <Select
                              value={pack.matchMode ?? 'any_any'}
                              onValueChange={(value: BackgroundMatchMode) =>
                                updateBackgroundTriggerPack(pack.id, { matchMode: value })
                              }
                            >
                              <SelectTrigger className="mt-1 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(MATCH_MODE_DESCRIPTIONS).map(([mode, { label }]) => (
                                  <SelectItem key={mode} value={mode}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Transición</Label>
                            <Select
                              value={pack.transitionType}
                              onValueChange={(value: 'fade' | 'slide' | 'none') =>
                                updateBackgroundTriggerPack(pack.id, { transitionType: value })
                              }
                            >
                              <SelectTrigger className="mt-1 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="fade">Fade</SelectItem>
                                <SelectItem value="slide">Slide</SelectItem>
                                <SelectItem value="none">Ninguna</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Pack Return to Default Settings */}
                        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 p-3 rounded border bg-muted/20">
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <Switch
                              checked={pack.returnToDefault ?? false}
                              onCheckedChange={(checked) =>
                                updateBackgroundTriggerPack(pack.id, { returnToDefault: checked })
                              }
                            />
                            <Clock className="w-3 h-3" />
                            Return to Default
                          </label>
                          <div>
                            <Label className="text-xs">Después de (min)</Label>
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              value={Math.floor((pack.returnToDefaultAfter ?? 0) / 60000)}
                              onChange={(e) =>
                                updateBackgroundTriggerPack(pack.id, { 
                                  returnToDefaultAfter: (parseInt(e.target.value) || 0) * 60000 
                                })
                              }
                              className="mt-1 h-8"
                              disabled={!pack.returnToDefault}
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Fondo Default del Pack</Label>
                            <Select
                              value={pack.defaultBackground || ''}
                              onValueChange={(url) =>
                                updateBackgroundTriggerPack(pack.id, { defaultBackground: url })
                              }
                              disabled={!pack.returnToDefault}
                            >
                              <SelectTrigger className="mt-1 h-8">
                                <SelectValue placeholder="Seleccionar" />
                              </SelectTrigger>
                              <SelectContent>
                                {collection?.entries.map((entry) => (
                                  <SelectItem key={entry.id} value={entry.url}>
                                    {entry.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Items Header */}
                        <div className="flex items-center justify-between pt-2">
                          <h5 className="text-sm font-medium flex items-center gap-2">
                            <ImageIcon className="w-3.5 h-3.5" />
                            Items del Pack (ordenados por prioridad)
                          </h5>
                          {collection && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleAddItemToPack(pack.id, collection)}
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Agregar Item
                            </Button>
                          )}
                        </div>

                        {/* Match Mode Explanation */}
                        <div className="p-2 rounded bg-muted/30 text-xs text-muted-foreground flex items-center gap-2">
                          <Sparkles className="w-3 h-3" />
                          <span>
                            <strong>{MATCH_MODE_DESCRIPTIONS[pack.matchMode ?? 'any_any'].label}</strong>: 
                            {' '}{MATCH_MODE_DESCRIPTIONS[pack.matchMode ?? 'any_any'].description}
                          </span>
                        </div>

                        {/* Items List */}
                        {pack.items.length === 0 ? (
                          <div className="text-center p-4 border rounded bg-muted/20 text-muted-foreground text-sm">
                            No hay items configurados. Agrega un item desde la colección.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {pack.items
                              .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
                              .map((item) => (
                                <div
                                  key={item.id}
                                  className={cn(
                                    "p-3 border rounded-lg",
                                    !item.enabled && "opacity-50"
                                  )}
                                >
                                  <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2 items-center">
                                    {/* Background Preview */}
                                    <div className="relative">
                                      <div
                                        className="w-full h-16 rounded border overflow-hidden bg-muted cursor-pointer"
                                        onClick={() => setPreviewBackground(
                                          previewBackground === item.backgroundUrl ? null : item.backgroundUrl
                                        )}
                                      >
                                        {item.backgroundUrl && (
                                          <img
                                            src={item.backgroundUrl}
                                            alt={item.backgroundName}
                                            className="w-full h-full object-cover"
                                          />
                                        )}
                                      </div>
                                      <p className="text-xs text-center mt-1 truncate">{item.backgroundName}</p>
                                    </div>

                                    {/* Background Selector */}
                                    <div>
                                      <Label className="text-xs">Fondo</Label>
                                      <Select
                                        value={item.backgroundUrl}
                                        onValueChange={(url) => {
                                          const entry = collection?.entries.find(e => e.url === url);
                                          updateBackgroundTriggerItem(pack.id, item.id, {
                                            backgroundUrl: url,
                                            backgroundName: entry?.name || item.backgroundName,
                                          });
                                        }}
                                      >
                                        <SelectTrigger className="mt-1 h-8">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {collection?.entries.map((entry) => (
                                            <SelectItem key={entry.id} value={entry.url}>
                                              {entry.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    {/* Trigger Keys */}
                                    <div>
                                      <Label className="text-xs flex items-center gap-1">
                                        <Key className="w-3 h-3" />
                                        Trigger Keys
                                      </Label>
                                      <Input
                                        value={item.triggerKeys.join(', ')}
                                        onChange={(e) =>
                                          updateBackgroundTriggerItem(pack.id, item.id, {
                                            triggerKeys: e.target.value.split(',').map(k => k.trim().toLowerCase()).filter(k => k),
                                          })
                                        }
                                        placeholder="bosque, forest"
                                        className="mt-1 h-8"
                                      />
                                    </div>

                                    {/* Context Keys */}
                                    <div>
                                      <Label className="text-xs flex items-center gap-1">
                                        <Key className="w-3 h-3 text-muted-foreground" />
                                        Context Keys
                                      </Label>
                                      <Input
                                        value={item.contextKeys.join(', ')}
                                        onChange={(e) =>
                                          updateBackgroundTriggerItem(pack.id, item.id, {
                                            contextKeys: e.target.value.split(',').map(k => k.trim().toLowerCase()).filter(k => k),
                                          })
                                        }
                                        placeholder="noche, night"
                                        className="mt-1 h-8"
                                      />
                                    </div>

                                    {/* Priority */}
                                    <div>
                                      <Label className="text-xs flex items-center gap-1">
                                        <ArrowUpDown className="w-3 h-3" />
                                        Prioridad
                                      </Label>
                                      <Input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={item.priority ?? 0}
                                        onChange={(e) =>
                                          updateBackgroundTriggerItem(pack.id, item.id, {
                                            priority: parseInt(e.target.value) || 0,
                                          })
                                        }
                                        className="mt-1 h-8"
                                      />
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <Switch
                                          checked={item.enabled}
                                          onCheckedChange={(checked) =>
                                            updateBackgroundTriggerItem(pack.id, item.id, { enabled: checked })
                                          }
                                        />
                                      </label>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                        onClick={() => deleteBackgroundTriggerItem(pack.id, item.id)}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Item-specific match mode override */}
                                  <div className="mt-2 flex items-center gap-2">
                                    <Label className="text-xs">Modo Match (override):</Label>
                                    <Select
                                      value={item.matchMode || 'default'}
                                      onValueChange={(value: BackgroundMatchMode | 'default') =>
                                        updateBackgroundTriggerItem(pack.id, item.id, {
                                          matchMode: value === 'default' ? undefined : value,
                                        })
                                      }
                                    >
                                      <SelectTrigger className="h-7 w-40">
                                        <SelectValue placeholder="Usar default" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="default">Usar default del pack</SelectItem>
                                        {Object.entries(MATCH_MODE_DESCRIPTIONS).map(([mode, { label }]) => (
                                          <SelectItem key={mode} value={mode}>
                                            {label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}

                        {/* Pack Actions */}
                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              const newPack: Omit<BackgroundTriggerPack, 'id' | 'createdAt' | 'updatedAt'> = {
                                name: `${pack.name} (copy)`,
                                active: pack.active,
                                collection: pack.collection,
                                priority: pack.priority,
                                cooldown: pack.cooldown,
                                matchMode: pack.matchMode,
                                transitionDuration: pack.transitionDuration,
                                transitionType: pack.transitionType,
                                items: pack.items,
                                returnToDefault: pack.returnToDefault,
                                returnToDefaultAfter: pack.returnToDefaultAfter,
                                defaultBackground: pack.defaultBackground,
                              };
                              addBackgroundTriggerPack(newPack);
                            }}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Clonar Pack
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => deleteBackgroundTriggerPack(pack.id)}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Eliminar Pack
                          </Button>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
          </Accordion>
        </ScrollArea>
        </div>
      )}

      {/* Preview Modal */}
      {previewBackground && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewBackground(null)}
        >
          <img
            src={previewBackground}
            alt="Preview"
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>
      )}
    </div>
  );
}
