'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { SoundTrigger, SoundCollection, SoundSequenceTrigger } from '@/types';
import { getLogger } from '@/lib/logger';
import {
  Plus,
  Play,
  Copy,
  Trash2,
  RefreshCw,
  Volume2,
  VolumeX,
  Zap,
  Music,
  ListMusic,
  HelpCircle,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Settings,
  Users,
  FileText,
  Pencil,
  ChevronRight,
} from 'lucide-react';

type SoundSettingsTab = 'global' | 'triggers' | 'sequences';

export function SoundTriggersSettings() {
  const soundLogger = getLogger('sound');
  const {
    soundTriggers,
    soundCollections,
    soundSequenceTriggers,
    settings,
    characters,
    addSoundTrigger,
    updateSoundTrigger,
    deleteSoundTrigger,
    cloneSoundTrigger,
    toggleSoundTrigger,
    toggleSoundKeyword,
    setSoundCollections,
    updateSettings,
    addSoundSequenceTrigger,
    updateSoundSequenceTrigger,
    deleteSoundSequenceTrigger,
    cloneSoundSequenceTrigger,
    toggleSoundSequenceTrigger,
  } = useTavernStore();

  const [activeTab, setActiveTab] = useState<SoundSettingsTab>('global');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTriggerId, setSelectedTriggerId] = useState<string | null>(null);
  const [selectedSequenceId, setSelectedSequenceId] = useState<string | null>(null);
  const [testingSound, setTestingSound] = useState<string | null>(null);
  const [newKeywordInput, setNewKeywordInput] = useState<Record<string, string>>({});

  // Fetch sound collections
  const fetchCollections = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/sounds/collections');
      const data = await response.json();
      soundLogger.debug('Loaded sound collections', { count: data.collections?.length || 0 });
      setSoundCollections(data.collections);
    } catch (error) {
      soundLogger.error('Failed to fetch sound collections', { error });
    } finally {
      setIsLoading(false);
    }
  }, [setSoundCollections]);

  // Fetch sound collections on mount
  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  // Create new trigger
  const handleAddTrigger = () => {
    const newTrigger: Omit<SoundTrigger, 'id' | 'createdAt' | 'updatedAt' | 'currentIndex'> = {
      name: `Nuevo Trigger ${soundTriggers.length + 1}`,
      description: '',
      characterIds: [],
      active: true,
      keywords: [],
      keywordsEnabled: {},
      collection: soundCollections[0]?.name || '',
      playMode: 'random',
      volume: 0.8,
      cooldown: 0,  // 0 = no cooldown, play all sounds
      delay: 0
    };
    addSoundTrigger(newTrigger);
  };

  // Test sound playback
  const handleTestSound = async (trigger: SoundTrigger) => {
    const collection = soundCollections.find(c => c.name === trigger.collection);
    if (!collection || collection.files.length === 0) return;

    setTestingSound(trigger.id);
    
    try {
      const soundIndex = trigger.playMode === 'random'
        ? Math.floor(Math.random() * collection.files.length)
        : trigger.currentIndex % collection.files.length;
      
      const audio = new Audio(collection.files[soundIndex]);
      audio.volume = trigger.volume * (settings.sound?.globalVolume || 0.85);
      await audio.play();
      
      // Update index for cyclic mode
      if (trigger.playMode === 'cyclic') {
        updateSoundTrigger(trigger.id, {
          currentIndex: (trigger.currentIndex + 1) % collection.files.length
        });
      }
    } catch (error) {
      soundLogger.error('Failed to play sound', { error });
    } finally {
      setTimeout(() => setTestingSound(null), 300);
    }
  };

  // Update keywords from input
  const handleKeywordsChange = (triggerId: string, keywordsStr: string) => {
    const keywords = keywordsStr
      .split(',')
      .map(k => k.trim().toLowerCase())
      .filter(k => k.length > 0);
    
    const trigger = soundTriggers.find(t => t.id === triggerId);
    if (!trigger) return;

    const keywordsEnabled: Record<string, boolean> = {};
    keywords.forEach(kw => {
      keywordsEnabled[kw] = trigger.keywordsEnabled[kw] ?? true;
    });

    updateSoundTrigger(triggerId, { keywords, keywordsEnabled });
  };

  const tabs: { id: SoundSettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'global', label: 'Configuración Global', icon: <Settings className="w-4 h-4" /> },
    { id: 'triggers', label: 'Triggers de Sonido', icon: <Zap className="w-4 h-4" /> },
    { id: 'sequences', label: 'Triggers de Secuencia', icon: <ListMusic className="w-4 h-4" /> },
  ];

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      {/* Sub-tabs Header */}
      <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-lg flex-shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
              activeTab === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.id === 'triggers' && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {soundTriggers.length}
              </Badge>
            )}
            {tab.id === 'sequences' && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {soundSequenceTriggers.length}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {/* Global Settings Tab */}
        {activeTab === 'global' && (
          <ScrollArea className="h-full">
            <div className="p-4 rounded-lg border bg-muted/30 space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Volume2 className="w-4 h-4" />
                Configuración Global de Sonidos
              </h4>

              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <label className="flex items-center justify-between p-2 rounded border bg-background">
                  <span className="text-sm">Habilitar</span>
                  <Switch
                    checked={settings.sound?.enabled ?? true}
                    onCheckedChange={(checked) =>
                      updateSettings({
                        sound: { ...settings.sound, enabled: checked }
                      })
                    }
                  />
                </label>

                <label className="flex items-center justify-between p-2 rounded border bg-background">
                  <span className="text-sm">Tiempo Real</span>
                  <Switch
                    checked={settings.sound?.realtimeEnabled ?? true}
                    onCheckedChange={(checked) =>
                      updateSettings({
                        sound: { ...settings.sound, realtimeEnabled: checked }
                      })
                    }
                  />
                </label>

                <div className="col-span-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Volumen Global</span>
                    <span className="text-muted-foreground">{Math.round((settings.sound?.globalVolume ?? 0.85) * 100)}%</span>
                  </div>
                  <Slider
                    value={[(settings.sound?.globalVolume ?? 0.85) * 100]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={([value]) =>
                      updateSettings({
                        sound: { ...settings.sound, globalVolume: value / 100 }
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs">Máx. Sonidos/Mensaje</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={settings.sound?.maxSoundsPerMessage ?? 10}
                    onChange={(e) =>
                      updateSettings({
                        sound: { ...settings.sound, maxSoundsPerMessage: parseInt(e.target.value) || 10 }
                      })
                    }
                    className="mt-1 h-8"
                  />
                  <p className="text-xs text-muted-foreground mt-1">0 = sin límite</p>
                </div>
                <div>
                  <Label className="text-xs">Enfriamiento Global (ms)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={50}
                    value={settings.sound?.globalCooldown ?? 0}
                    onChange={(e) =>
                      updateSettings({
                        sound: { ...settings.sound, globalCooldown: parseInt(e.target.value) || 0 }
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
                    Actualizar
                  </Button>
                </div>
              </div>

              {/* Collections Info - Collapsible */}
              <Collapsible>
                <div className="flex items-center justify-between p-3 rounded-lg border bg-background/50">
                  <h5 className="font-medium text-sm flex items-center gap-2">
                    <Music className="w-4 h-4" />
                    Colecciones de Sonidos
                    <Badge variant="outline" className="text-xs">{soundCollections.length}</Badge>
                  </h5>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                      <ChevronDown className="w-3.5 h-3.5 transition-transform [[data-state=open]>rotate-180]" />
                      Mostrar
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent>
                  <div className="pt-3">
                    {isLoading ? (
                      <p className="text-sm text-muted-foreground">Cargando...</p>
                    ) : soundCollections.length === 0 ? (
                      <div className="text-sm text-yellow-500">
                        <p className="font-medium">No se encontraron colecciones de sonidos</p>
                        <p className="text-muted-foreground mt-1">
                          Agrega archivos a <code className="bg-muted px-1 rounded">public/sounds/</code> y haz clic en "Actualizar"
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                        {soundCollections.map((col) => (
                          <div key={col.name} className="flex items-center justify-between p-2 rounded border bg-muted/30">
                            <span className="text-sm truncate">{col.name === '__root__' ? 'Raíz' : col.name}</span>
                            <Badge variant="outline" className="shrink-0 ml-2">{col.files.length} sonidos</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* {{sonidos}} Template Configuration - Collapsible */}
              <Collapsible>
                <div className="flex items-center justify-between p-3 rounded-lg border bg-background/50">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-500" />
                    <h5 className="font-medium text-sm">Plantilla de Sonidos ({'{'}{'{'}sonidos{'}'}{'}'})</h5>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <p>Configura cómo se mostrará la lista de sonidos cuando uses la key {`{{sonidos}}`} en las secciones de un personaje.</p>
                        <p className="mt-1 text-xs text-muted-foreground">Solo se mostrarán los sonidos configurados para ese personaje.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                      <ChevronDown className="w-3.5 h-3.5 transition-transform [[data-state=open]>rotate-180]" />
                      Mostrar
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent>
                  <div className="pt-3 space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Prefijo</Label>
                      <Textarea
                        value={settings.sound?.soundListPrefix ?? '[SONIDOS DISPONIBLES]'}
                        onChange={(e) =>
                          updateSettings({
                            sound: { ...settings.sound, soundListPrefix: e.target.value }
                          })
                        }
                        placeholder="Texto que aparecerá antes de la lista de sonidos..."
                        className="h-16 text-sm resize-none"
                      />
                    </div>

                    <div className="p-3 rounded-lg border border-dashed bg-muted/30">
                      <p className="text-xs text-muted-foreground mb-2">Formato de cada sonido:</p>
                      <code className="text-xs bg-background px-2 py-1 rounded block">
                        - keyword: descripción del sonido
                      </code>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Sufijo</Label>
                      <Textarea
                        value={settings.sound?.soundListSuffix ?? ''}
                        onChange={(e) =>
                          updateSettings({
                            sound: { ...settings.sound, soundListSuffix: e.target.value }
                          })
                        }
                        placeholder="Texto que aparecerá después de la lista de sonidos..."
                        className="h-16 text-sm resize-none"
                      />
                    </div>

                    <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                      <p className="text-xs text-purple-400 font-medium mb-1">Ejemplo de salida:</p>
                      <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
{`${settings.sound?.soundListPrefix ?? '[SONIDOS DISPONIBLES]'}
- golpe: Sonido de golpe fuerte
- risa: Risita maliciosa
- pasos: Pasos acercándose
${settings.sound?.soundListSuffix ?? ''}`}
                      </pre>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </ScrollArea>
        )}

        {/* Triggers Tab */}
        {activeTab === 'triggers' && (
          <ScrollArea className="h-full">
            <div className="space-y-4 pr-4">
              {/* Triggers Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Triggers de Sonido ({soundTriggers.length})
                  </h4>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Music className="w-4 h-4" />
                    {isLoading ? (
                      <span>Cargando...</span>
                    ) : (
                      <>
                        <span>{soundCollections.length} colecciones</span>
                        <span className="text-xs">({soundCollections.reduce((acc, c) => acc + c.files.length, 0)} sonidos)</span>
                      </>
                    )}
                  </div>
                </div>
                <Button size="sm" onClick={handleAddTrigger}>
                  <Plus className="w-4 h-4 mr-1" />
                  Agregar Trigger
                </Button>
              </div>

              {/* No Collections Warning */}
              {!isLoading && soundCollections.length === 0 && (
                <div className="p-4 rounded-lg border border-yellow-500/50 bg-yellow-500/10 text-sm">
                  <p className="font-medium text-yellow-500">No se encontraron colecciones de sonidos</p>
                  <p className="text-muted-foreground mt-1">
                    Agrega archivos a <code className="bg-muted px-1 rounded">public/sounds/</code> y haz clic en "Actualizar"
                  </p>
                </div>
              )}

              {/* Triggers List or Editor */}
              {soundTriggers.length === 0 ? (
                <div className="flex items-center justify-center text-muted-foreground py-8">
                  <div className="text-center">
                    <VolumeX className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No hay triggers de sonido configurados</p>
                    <p className="text-xs mt-1">Agrega un trigger para reproducir sonidos basados en palabras clave</p>
                  </div>
                </div>
              ) : selectedTriggerId ? (
                /* ===== Selected Trigger Editor ===== */
                (() => {
                  const trigger = soundTriggers.find(t => t.id === selectedTriggerId);
                  if (!trigger) return null;
                  const collection = soundCollections.find(c => c.name === trigger.collection);
                  return (
                    <div className="space-y-4">
                      {/* Editor Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setSelectedTriggerId(null)}>
                            <ChevronRight className="w-3 h-3 rotate-180" />
                            Volver
                          </Button>
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-2.5 h-2.5 rounded-full",
                              trigger.active ? "bg-green-500" : "bg-muted-foreground"
                            )} />
                            <span className="font-medium">{trigger.name}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="h-7 text-xs"
                            onClick={() => handleTestSound(trigger)}
                            disabled={testingSound === trigger.id || !collection?.files.length}>
                            <Play className={cn("w-3 h-3 mr-1", testingSound === trigger.id && "animate-pulse")} />
                            Probar
                          </Button>
                          <Button variant="outline" size="sm" className="h-7 text-xs"
                            onClick={() => cloneSoundTrigger(trigger.id)}>
                            <Copy className="w-3 h-3 mr-1" />
                            Clonar
                          </Button>
                          <Button variant="destructive" size="sm" className="h-7 text-xs"
                            onClick={() => { deleteSoundTrigger(trigger.id); setSelectedTriggerId(null); }}>
                            <Trash2 className="w-3 h-3 mr-1" />
                            Eliminar
                          </Button>
                        </div>
                      </div>

                      {/* Editor Form */}
                      <div className="p-4 rounded-lg border bg-muted/10 space-y-4">
                        {/* Row 1: Name, Active, Collection, Play Mode */}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                          <div>
                            <Label className="text-xs">Nombre</Label>
                            <Input
                              value={trigger.name}
                              onChange={(e) => updateSoundTrigger(trigger.id, { name: e.target.value })}
                              className="mt-1 h-8"
                            />
                          </div>
                          <div className="flex items-end pb-1">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                              <Switch
                                checked={trigger.active}
                                onCheckedChange={() => toggleSoundTrigger(trigger.id)}
                              />
                              Activo
                            </label>
                          </div>
                          <div>
                            <Label className="text-xs">Colección</Label>
                            <Select
                              value={trigger.collection}
                              onValueChange={(value) => updateSoundTrigger(trigger.id, { collection: value })}
                            >
                              <SelectTrigger className="mt-1 h-8">
                                <SelectValue placeholder="Seleccionar" />
                              </SelectTrigger>
                              <SelectContent>
                                {soundCollections.map((col) => (
                                  <SelectItem key={col.name} value={col.name}>
                                    {col.name === '__root__' ? 'Raíz' : col.name}
                                    <span className="text-xs text-muted-foreground ml-1">
                                      ({col.files.length})
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Modo</Label>
                            <Select
                              value={trigger.playMode}
                              onValueChange={(value: 'random' | 'cyclic') =>
                                updateSoundTrigger(trigger.id, { playMode: value })
                              }
                            >
                              <SelectTrigger className="mt-1 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="random">Aleatorio</SelectItem>
                                <SelectItem value="cyclic">Cíclico</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Row 2: Description and Characters */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              Descripción
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p>Descripción que aparecerá en la key {`{{sonidos}}`} para este sonido.</p>
                                </TooltipContent>
                              </Tooltip>
                            </Label>
                            <Input
                              value={trigger.description || ''}
                              onChange={(e) => updateSoundTrigger(trigger.id, { description: e.target.value })}
                              placeholder="Ej: Sonido de golpe fuerte"
                              className="mt-1 h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              Personajes
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p>Selecciona los personajes que tendrán acceso a este sonido en la key {`{{sonidos}}`}.</p>
                                  <p className="text-xs text-muted-foreground mt-1">Si no seleccionas ninguno, el sonido estará disponible para todos.</p>
                                </TooltipContent>
                              </Tooltip>
                            </Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className="mt-1 h-8 w-full justify-between font-normal"
                                >
                                  <span className="truncate text-xs">
                                    {trigger.characterIds?.length > 0
                                      ? `${trigger.characterIds.length} seleccionados`
                                      : 'Todos los personajes'
                                    }
                                  </span>
                                  <ChevronDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[--radix-popover-trigger-width] p-2 max-h-60 overflow-y-auto">
                                {characters.length === 0 ? (
                                  <p className="text-xs text-muted-foreground text-center py-2">
                                    No hay personajes disponibles
                                  </p>
                                ) : (
                                  <div className="space-y-1">
                                    {characters.map((char) => (
                                      <label
                                        key={char.id}
                                        className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer"
                                      >
                                        <Checkbox
                                          checked={trigger.characterIds?.includes(char.id) || false}
                                          onCheckedChange={(checked) => {
                                            const currentIds = trigger.characterIds || [];
                                            const newIds = checked
                                              ? [...currentIds, char.id]
                                              : currentIds.filter((id: string) => id !== char.id);
                                            updateSoundTrigger(trigger.id, { characterIds: newIds });
                                          }}
                                          className="h-4 w-4"
                                        />
                                        <span className="text-xs">{char.name}</span>
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>

                        {/* Row 3: Keywords */}
                        <div className="space-y-1.5">
                          <Label className="text-xs">Palabras Clave (separadas por coma)</Label>
                          <Input
                            value={trigger.keywords.join(', ')}
                            onChange={(e) => handleKeywordsChange(trigger.id, e.target.value)}
                            placeholder="golpe, impacto, puño..."
                            className="h-8"
                          />
                          {trigger.keywords.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {trigger.keywords.map((keyword) => (
                                <button
                                  key={keyword}
                                  onClick={() => toggleSoundKeyword(trigger.id, keyword)}
                                  className={cn(
                                    "px-2 py-0.5 rounded text-xs transition-colors",
                                    trigger.keywordsEnabled[keyword]
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted text-muted-foreground line-through"
                                  )}
                                >
                                  {keyword}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Row 4: Volume, Cooldown, Delay */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span>Volumen</span>
                              <span className="text-muted-foreground">{Math.round(trigger.volume * 100)}%</span>
                            </div>
                            <Slider
                              value={[trigger.volume * 100]}
                              min={0}
                              max={100}
                              step={1}
                              onValueChange={([value]) =>
                                updateSoundTrigger(trigger.id, { volume: value / 100 })
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Enfriamiento (ms)</Label>
                            <Input
                              type="number"
                              min={0}
                              step={100}
                              value={trigger.cooldown ?? 0}
                              onChange={(e) =>
                                updateSoundTrigger(trigger.id, { cooldown: parseInt(e.target.value) || 0 })
                              }
                              className="mt-1 h-8"
                            />
                            <p className="text-xs text-muted-foreground mt-0.5">0 = sin límite</p>
                          </div>
                          <div>
                            <Label className="text-xs">Retardo (ms)</Label>
                            <Input
                              type="number"
                              min={0}
                              step={50}
                              value={trigger.delay ?? 0}
                              onChange={(e) =>
                                updateSoundTrigger(trigger.id, { delay: parseInt(e.target.value) || 0 })
                              }
                              className="mt-1 h-8"
                            />
                            <p className="text-xs text-muted-foreground mt-0.5">Pausa antes de reproducir</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                /* ===== Trigger List ===== */
                <div className="space-y-1">
                  {soundTriggers.map((trigger) => {
                    const collection = soundCollections.find(c => c.name === trigger.collection);
                    return (
                      <button
                        key={trigger.id}
                        onClick={() => setSelectedTriggerId(trigger.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className={cn(
                          "w-2.5 h-2.5 rounded-full flex-shrink-0",
                          trigger.active ? "bg-green-500" : "bg-muted-foreground"
                        )} />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-sm">{trigger.name}</span>
                          {trigger.description && (
                            <p className="text-xs text-muted-foreground truncate">{trigger.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {trigger.keywords.length > 0 && (
                            <Badge variant="secondary" className="text-xs">{trigger.keywords.length} claves</Badge>
                          )}
                          <Badge variant="outline" className="text-xs">{collection?.files.length || 0} sonidos</Badge>
                          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {/* Sequences Tab */}
        {activeTab === 'sequences' && (
          <ScrollArea className="h-full">
            <div className="space-y-4 pr-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListMusic className="w-5 h-5 text-purple-500" />
                  <h4 className="font-medium flex items-center gap-2">
                    Triggers de Secuencia de Sonido
                    <Badge variant="outline" className="text-xs">
                      {soundSequenceTriggers.length}
                    </Badge>
                  </h4>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p>Los triggers de secuencia reproducen múltiples sonidos en orden cuando se detecta la key de activación en la respuesta del LLM.</p>
                      <p className="mt-1 text-xs text-muted-foreground">Cada item en la secuencia referencia un trigger de sonido existente por su keyword.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Button size="sm" onClick={() => {
                  addSoundSequenceTrigger({
                    name: `Nueva Secuencia ${soundSequenceTriggers.length + 1}`,
                    active: true,
                    activationKey: '',
                    sequence: [],
                    volume: 1,
                    delayBetween: 0,
                    cooldown: 0,
                  });
                }}>
                  <Plus className="w-4 h-4 mr-1" />
                  Nueva Secuencia
                </Button>
              </div>

              {/* Sequences List or Editor */}
              {soundSequenceTriggers.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground border rounded-lg bg-muted/20">
                  <ListMusic className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No hay triggers de secuencia configurados</p>
                  <p className="text-xs mt-1">Crea una secuencia para reproducir múltiples sonidos con un solo trigger</p>
                </div>
              ) : selectedSequenceId ? (
                /* ===== Selected Sequence Editor ===== */
                (() => {
                  const sequence = soundSequenceTriggers.find(s => s.id === selectedSequenceId);
                  if (!sequence) return null;
                  const availableKeywords = soundTriggers
                    .filter(t => t.active)
                    .flatMap(t => t.keywords);
                  return (
                    <div className="space-y-4">
                      {/* Editor Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setSelectedSequenceId(null)}>
                            <ChevronRight className="w-3 h-3 rotate-180" />
                            Volver
                          </Button>
                          <div className="flex items-center gap-2">
                            <Zap className={cn("w-4 h-4", sequence.active ? "text-purple-500" : "text-muted-foreground")} />
                            <span className="font-medium">{sequence.name}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="h-7 text-xs"
                            onClick={() => cloneSoundSequenceTrigger(sequence.id)}>
                            <Copy className="w-3 h-3 mr-1" />
                            Clonar
                          </Button>
                          <Button variant="destructive" size="sm" className="h-7 text-xs"
                            onClick={() => { deleteSoundSequenceTrigger(sequence.id); setSelectedSequenceId(null); }}>
                            <Trash2 className="w-3 h-3 mr-1" />
                            Eliminar
                          </Button>
                        </div>
                      </div>

                      {/* Editor Form */}
                      <div className="p-4 rounded-lg border bg-muted/10 space-y-4">
                        {/* Row 1: Name and Active */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs mb-1 block">Nombre</Label>
                            <Input
                              value={sequence.name}
                              onChange={(e) =>
                                updateSoundSequenceTrigger(sequence.id, { name: e.target.value })
                              }
                              placeholder="Nombre de la secuencia"
                              className="h-8"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Activo</Label>
                            <Switch
                              checked={sequence.active}
                              onCheckedChange={() => toggleSoundSequenceTrigger(sequence.id)}
                            />
                          </div>
                        </div>

                        {/* Row 2: Activation Key */}
                        <div className="space-y-2 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                          <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-purple-400" />
                            <Label className="text-xs font-medium text-purple-400">Key de Activación</Label>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs text-muted-foreground mb-1 block">Key principal</Label>
                              <Input
                                value={sequence.activationKey || ''}
                                onChange={(e) =>
                                  updateSoundSequenceTrigger(sequence.id, {
                                    activationKey: e.target.value.toLowerCase().replace(/\s+/g, '_') || undefined,
                                  })
                                }
                                placeholder="secuencia1, combo"
                                className="h-8 font-mono text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground mb-1 block">Keys alternativas</Label>
                              <Input
                                value={(sequence.activationKeys || []).join(', ')}
                                onChange={(e) => {
                                  const keys = e.target.value.split(',').map(k => k.trim().toLowerCase().replace(/\s+/g, '_')).filter(Boolean);
                                  updateSoundSequenceTrigger(sequence.id, {
                                    activationKeys: keys.length > 0 ? keys : undefined,
                                  });
                                }}
                                placeholder="seq1, combo1"
                                className="h-8 text-xs"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Row 3: Sequence */}
                        <div className="space-y-2">
                          <Label className="text-xs flex items-center gap-1">
                            Secuencia de Sonidos
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p>Lista de keywords de triggers de sonido existentes. Cada uno se reproducirá en orden.</p>
                              </TooltipContent>
                            </Tooltip>
                          </Label>

                          {/* Current sequence */}
                          <div className="space-y-1">
                            {sequence.sequence.map((keyword, kwIndex) => (
                              <div
                                key={kwIndex}
                                className="flex items-center gap-2 bg-muted/50 rounded p-2"
                              >
                                <span className="text-xs text-muted-foreground w-6">{kwIndex + 1}.</span>
                                <Badge variant="secondary" className="font-mono">
                                  {keyword}
                                </Badge>
                                <div className="flex-1" />
                                {kwIndex > 0 && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => {
                                      const newSeq = [...sequence.sequence];
                                      const [removed] = newSeq.splice(kwIndex, 1);
                                      newSeq.splice(kwIndex - 1, 0, removed);
                                      updateSoundSequenceTrigger(sequence.id, { sequence: newSeq });
                                    }}
                                  >
                                    <ChevronUp className="w-3 h-3" />
                                  </Button>
                                )}
                                {kwIndex < sequence.sequence.length - 1 && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => {
                                      const newSeq = [...sequence.sequence];
                                      const [removed] = newSeq.splice(kwIndex, 1);
                                      newSeq.splice(kwIndex + 1, 0, removed);
                                      updateSoundSequenceTrigger(sequence.id, { sequence: newSeq });
                                    }}
                                  >
                                    <ChevronDown className="w-3 h-3" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => {
                                    updateSoundSequenceTrigger(sequence.id, {
                                      sequence: sequence.sequence.filter((_, i) => i !== kwIndex),
                                    });
                                  }}
                                >
                                  <Trash2 className="w-3 h-3 text-destructive" />
                                </Button>
                              </div>
                            ))}
                            {sequence.sequence.length === 0 && (
                              <p className="text-xs text-muted-foreground italic p-2">Sin sonidos en la secuencia</p>
                            )}
                          </div>

                          {/* Add keyword input */}
                          <div className="flex gap-2">
                            <Input
                              value={newKeywordInput[sequence.id] || ''}
                              onChange={(e) =>
                                setNewKeywordInput(prev => ({ ...prev, [sequence.id]: e.target.value }))
                              }
                              placeholder="Agregar keyword de sonido..."
                              className="h-8 text-xs"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && (newKeywordInput[sequence.id]?.trim())) {
                                  updateSoundSequenceTrigger(sequence.id, {
                                    sequence: [...sequence.sequence, newKeywordInput[sequence.id].trim()],
                                  });
                                  setNewKeywordInput(prev => ({ ...prev, [sequence.id]: '' }));
                                }
                              }}
                              list={`available-keywords-${sequence.id}`}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8"
                              onClick={() => {
                                if (newKeywordInput[sequence.id]?.trim()) {
                                  updateSoundSequenceTrigger(sequence.id, {
                                    sequence: [...sequence.sequence, newKeywordInput[sequence.id].trim()],
                                  });
                                  setNewKeywordInput(prev => ({ ...prev, [sequence.id]: '' }));
                                }
                              }}
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>

                          <datalist id={`available-keywords-${sequence.id}`}>
                            {availableKeywords.map((kw, i) => (
                              <option key={i} value={kw} />
                            ))}
                          </datalist>

                          {/* Quick add suggestions */}
                          {availableKeywords.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              <span className="text-xs text-muted-foreground mr-1">Sugerencias:</span>
                              {availableKeywords.slice(0, 6).map((kw, i) => (
                                <Button
                                  key={i}
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-[10px] px-2"
                                  onClick={() => {
                                    updateSoundSequenceTrigger(sequence.id, {
                                      sequence: [...sequence.sequence, kw],
                                    });
                                  }}
                                >
                                  +{kw}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Row 4: Volume, Delay, Cooldown */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span>Volumen</span>
                              <span className="text-muted-foreground">{Math.round(sequence.volume * 100)}%</span>
                            </div>
                            <Slider
                              value={[sequence.volume * 100]}
                              min={0}
                              max={100}
                              step={1}
                              onValueChange={([value]) =>
                                updateSoundSequenceTrigger(sequence.id, { volume: value / 100 })
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Delay entre sonidos (ms)</Label>
                            <Input
                              type="number"
                              min={0}
                              step={50}
                              value={sequence.delayBetween ?? 0}
                              onChange={(e) =>
                                updateSoundSequenceTrigger(sequence.id, { delayBetween: parseInt(e.target.value) || 0 })
                              }
                              className="mt-1 h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Cooldown (ms)</Label>
                            <Input
                              type="number"
                              min={0}
                              step={100}
                              value={sequence.cooldown ?? 0}
                              onChange={(e) =>
                                updateSoundSequenceTrigger(sequence.id, { cooldown: parseInt(e.target.value) || 0 })
                              }
                              className="mt-1 h-8"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                /* ===== Sequence List ===== */
                <div className="space-y-1">
                  {soundSequenceTriggers.map((sequence, index) => (
                    <button
                      key={sequence.id}
                      onClick={() => setSelectedSequenceId(sequence.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className={cn(
                        "w-2.5 h-2.5 rounded-full flex-shrink-0",
                        sequence.active ? "bg-purple-500" : "bg-muted-foreground"
                      )} />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm">{sequence.name || `Secuencia #${index + 1}`}</span>
                        {sequence.activationKey && (
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground ml-2">
                            {sequence.activationKey}
                          </code>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-xs">{sequence.sequence.length} sonidos</Badge>
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
