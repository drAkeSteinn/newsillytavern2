'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
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
  Zap,
  Package,
  Crown,
  Shuffle,
  List,
  Timer,
  Settings2,
  ChevronDown,
  ChevronUp,
  Copy,
  Image as ImageIcon,
  Layers,
  Play,
  Volume2,
  ArrowRight,
  Info,
  TestTube,
  CheckCircle,
} from 'lucide-react';
import type { 
  CharacterCard,
  TriggerCollection,
  SpritePackV2,
  SpriteTriggerConfig,
  SpriteChain,
  SoundChain,
  TriggerFallbackMode,
} from '@/types';
import { SpritePreview } from './sprite-preview';
import { useTavernStore } from '@/store';
const uuidv4 = () => crypto.randomUUID();
import { getLogger } from '@/lib/logger';

const logger = getLogger('trigger-collection-editor');

// Fallback mode options
const FALLBACK_MODES: { 
  value: TriggerFallbackMode; 
  label: string; 
  description: string 
}[] = [
  { 
    value: 'idle_collection', 
    label: 'Colección Idle', 
    description: 'Retorna al sprite de la colección Idle' 
  },
  { 
    value: 'custom_sprite', 
    label: 'Sprite Personalizado', 
    description: 'Retorna a un sprite específico' 
  },
  { 
    value: 'collection_default', 
    label: 'Default de Colección', 
    description: 'Usa el sprite principal de la colección' 
  },
];

// Behavior options
const BEHAVIOR_OPTIONS: { 
  value: 'principal' | 'random' | 'list'; 
  label: string; 
  icon: React.ReactNode;
  description: string 
}[] = [
  { 
    value: 'principal', 
    label: 'Principal', 
    icon: <Crown className="w-3.5 h-3.5" />,
    description: 'Usa el sprite principal del pack' 
  },
  { 
    value: 'random', 
    label: 'Aleatorio', 
    icon: <Shuffle className="w-3.5 h-3.5" />,
    description: 'Selecciona un sprite aleatorio' 
  },
  { 
    value: 'list', 
    label: 'Lista', 
    icon: <List className="w-3.5 h-3.5" />,
    description: 'Rota entre sprites del pack' 
  },
];

interface TriggerCollectionEditorProps {
  character: CharacterCard;
  onChange: (updates: Partial<CharacterCard>) => void;
}

export function TriggerCollectionEditor({ 
  character, 
  onChange 
}: TriggerCollectionEditorProps) {
  // Get collections and packs
  const triggerCollections: TriggerCollection[] = useMemo(() => {
    return character.triggerCollections || [];
  }, [character.triggerCollections]);

  const spritePacksV2: SpritePackV2[] = useMemo(() => {
    return character.spritePacksV2 || [];
  }, [character.spritePacksV2]);

  // Store actions for testing
  const applyTriggerForCharacter = useTavernStore((state) => state.applyTriggerForCharacter);
  const scheduleReturnToIdleForCharacter = useTavernStore((state) => state.scheduleReturnToIdleForCharacter);
  const cancelReturnToIdleForCharacter = useTavernStore((state) => state.cancelReturnToIdleForCharacter);

  // State
  const [showEditor, setShowEditor] = useState(false);
  const [editingCollection, setEditingCollection] = useState<TriggerCollection | null>(null);
  const [testingCollectionId, setTestingCollectionId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    keys: true,
    behavior: true,
    fallback: true,
    chains: false,
    sprites: false,
  });

  // Update collections
  const updateCollections = (newCollections: TriggerCollection[]) => {
    onChange({
      triggerCollections: newCollections,
    });
  };

  // Test trigger - Apply the trigger sprite to the character
  const handleTestTrigger = (collection: TriggerCollection) => {
    const pack = spritePacksV2.find(p => p.id === collection.packId);
    if (!pack || pack.sprites.length === 0) {
      logger.warn('Cannot test: no sprites in pack', { collectionId: collection.id });
      return;
    }

    // Get the sprite to show based on behavior
    let sprite;
    switch (collection.collectionBehavior) {
      case 'random':
        const randomIndex = Math.floor(Math.random() * pack.sprites.length);
        sprite = pack.sprites[randomIndex];
        break;
      case 'principal':
      case 'list':
      default:
        sprite = collection.principalSpriteId 
          ? pack.sprites.find(s => s.id === collection.principalSpriteId)
          : pack.sprites[0];
        break;
    }

    if (!sprite) {
      logger.warn('Cannot test: no sprite found', { collectionId: collection.id });
      return;
    }

    // Mark as testing
    setTestingCollectionId(collection.id);
    logger.info('Testing trigger', { 
      collectionId: collection.id, 
      spriteUrl: sprite.url,
      spriteLabel: sprite.label 
    });

    // Apply the trigger sprite
    applyTriggerForCharacter(character.id, {
      spriteUrl: sprite.url,
      spriteLabel: sprite.label,
      returnToIdleMs: collection.fallbackDelayMs,
      packId: collection.packId,
      collectionId: collection.id,
      useTimelineSounds: collection.useTimelineSounds ?? false,
    });

    // Note: Timeline sounds are now handled by useTimelineSpriteSounds hook
    // which watches for triggerSpriteUrl changes and checks useTimelineSounds

    // Schedule fallback if configured
    if (collection.fallbackDelayMs > 0) {
      // Get fallback sprite based on mode
      let fallbackSpriteUrl: string | null = null;
      let returnToMode: 'idle' | 'talk' | 'thinking' | 'clear' = 'idle';

      if (collection.fallbackMode === 'custom_sprite' && collection.fallbackSpriteId) {
        const fallbackSprite = pack.sprites.find(s => s.id === collection.fallbackSpriteId);
        fallbackSpriteUrl = fallbackSprite?.url || null;
        returnToMode = 'idle'; // Apply the custom sprite
      } else if (collection.fallbackMode === 'collection_default') {
        const principalSprite = collection.principalSpriteId
          ? pack.sprites.find(s => s.id === collection.principalSpriteId)
          : pack.sprites[0];
        fallbackSpriteUrl = principalSprite?.url || null;
        returnToMode = 'idle'; // Apply the collection default sprite
      } else if (collection.fallbackMode === 'idle_collection') {
        // For 'idle_collection', clear the trigger and let the normal state logic
        // (idle state from State Collections V2) determine what to show
        returnToMode = 'clear';
        // fallbackSpriteUrl can be empty for 'clear' mode
        fallbackSpriteUrl = '';
      }

      // Always schedule fallback when delay > 0
      // For 'clear' mode, the empty string is fine (won't be used)
      scheduleReturnToIdleForCharacter(
        character.id,
        sprite.url,
        returnToMode,
        fallbackSpriteUrl || '',
        sprite.label,
        collection.fallbackDelayMs
      );

      logger.info('Test trigger: fallback scheduled', {
        collectionId: collection.id,
        fallbackMode: collection.fallbackMode,
        returnToMode,
        fallbackDelayMs: collection.fallbackDelayMs,
      });
    }

    // Clear testing indicator after a delay
    setTimeout(() => {
      setTestingCollectionId(null);
    }, 1000);
  };

  // Create new collection
  const handleCreateCollection = () => {
    const now = new Date().toISOString();
    const newCollection: TriggerCollection = {
      id: uuidv4(),
      name: 'Nueva Colección de Triggers',
      active: true,
      priority: 1,
      packId: spritePacksV2[0]?.id || '',
      collectionKey: '',
      collectionKeys: [],
      collectionKeyRequirePipes: true,
      collectionKeyCaseSensitive: false,
      collectionBehavior: 'principal',
      principalSpriteId: undefined,
      fallbackMode: 'idle_collection',
      fallbackSpriteId: undefined,
      fallbackDelayMs: 3000,
      spriteChain: undefined,
      useTimelineSounds: false,
      cooldownMs: 1000,
      spriteConfigs: {},
      createdAt: now,
      updatedAt: now,
    };

    setEditingCollection(newCollection);
    setShowEditor(true);
  };

  // Edit collection
  const handleEditCollection = (collection: TriggerCollection) => {
    setEditingCollection({ ...collection });
    setShowEditor(true);
  };

  // Delete collection
  const handleDeleteCollection = (id: string) => {
    const collection = triggerCollections.find(c => c.id === id);
    if (!collection) return;

    if (!confirm(`¿Eliminar la colección "${collection.name}"?`)) return;

    updateCollections(triggerCollections.filter(c => c.id !== id));
    logger.info('Deleted trigger collection', { collectionId: id });
  };

  // Duplicate collection
  const handleDuplicateCollection = (collection: TriggerCollection) => {
    const now = new Date().toISOString();
    const newCollection: TriggerCollection = {
      ...collection,
      id: uuidv4(),
      name: `${collection.name} (copia)`,
      createdAt: now,
      updatedAt: now,
    };

    updateCollections([...triggerCollections, newCollection]);
    logger.info('Duplicated trigger collection', { 
      originalId: collection.id, 
      newId: newCollection.id 
    });
  };

  // Save collection
  const handleSaveCollection = () => {
    if (!editingCollection) return;

    const now = new Date().toISOString();
    const updatedCollection: TriggerCollection = {
      ...editingCollection,
      updatedAt: now,
    };

    const existingIndex = triggerCollections.findIndex(c => c.id === updatedCollection.id);
    
    if (existingIndex >= 0) {
      // Update existing
      const newCollections = [...triggerCollections];
      newCollections[existingIndex] = updatedCollection;
      updateCollections(newCollections);
    } else {
      // Add new
      updatedCollection.createdAt = now;
      updateCollections([...triggerCollections, updatedCollection]);
    }

    setEditingCollection(null);
    setShowEditor(false);
    logger.info('Saved trigger collection', { collectionId: updatedCollection.id });
  };

  // Toggle collection active
  const handleToggleActive = (id: string, active: boolean) => {
    updateCollections(triggerCollections.map(c =>
      c.id === id ? { ...c, active, updatedAt: new Date().toISOString() } : c
    ));
  };

  // Get pack name
  const getPackName = (packId: string) => {
    const pack = spritePacksV2.find(p => p.id === packId);
    return pack?.name || 'Pack no encontrado';
  };

  // Get pack sprites
  const getPackSprites = (packId: string) => {
    const pack = spritePacksV2.find(p => p.id === packId);
    return pack?.sprites || [];
  };

  // Format time
  const formatTime = (ms: number) => {
    if (ms <= 0) return 'Nunca';
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  };

  // Toggle section
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            Trigger Collections
          </h4>
          <p className="text-xs text-muted-foreground">
            Colecciones de triggers con sistema de prioridades y cadenas.
          </p>
        </div>
        <Button
          size="sm"
          className="h-8"
          onClick={handleCreateCollection}
          disabled={spritePacksV2.length === 0}
        >
          <Plus className="w-4 h-4 mr-1" />
          Nueva Colección
        </Button>
      </div>

      {/* Info Banner */}
      <div className="text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2 font-medium text-amber-600">
          <Zap className="w-4 h-4" />
          Sistema de Trigger Collections
        </div>
        <p className="text-muted-foreground">
          Las colecciones de triggers usan <strong>prioridades</strong> para determinar qué trigger 
          se ejecuta. Puedes activar por <strong>key de colección</strong> (general) o por 
          <strong> keys individuales</strong> por sprite.
        </p>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div className="p-2 bg-background/50 rounded border">
            <div className="flex items-center gap-1 text-xs font-medium text-amber-600">
              <Crown className="w-3 h-3" />
              Prioridad
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Mayor número = mayor prioridad
            </p>
          </div>
          <div className="p-2 bg-background/50 rounded border">
            <div className="flex items-center gap-1 text-xs font-medium text-blue-600">
              <Play className="w-3 h-3" />
              Cadenas
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Secuencias de sprites/sonidos
            </p>
          </div>
        </div>
      </div>

      {/* No packs warning */}
      {spritePacksV2.length === 0 && (
        <div className="text-center py-4 text-amber-600 bg-amber-500/5 border border-amber-500/20 rounded-lg">
          <Package className="w-6 h-6 mx-auto mb-2" />
          <p className="text-sm font-medium">No hay Sprite Packs creados</p>
          <p className="text-xs mt-1">
            Crea un Sprite Pack en la pestaña "Sprite Packs" antes de crear triggers.
          </p>
        </div>
      )}

      {/* Collections List */}
      {triggerCollections.length > 0 ? (
        <Accordion type="multiple" className="w-full space-y-2">
          {triggerCollections
            .sort((a, b) => b.priority - a.priority)
            .map(collection => {
              const pack = spritePacksV2.find(p => p.id === collection.packId);
              const sprites = pack?.sprites || [];

              return (
                <AccordionItem
                  key={collection.id}
                  value={collection.id}
                  className="border rounded-lg px-0"
                >
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex items-center gap-3 w-full">
                      <div className={cn(
                        "p-1.5 rounded",
                        collection.active ? "bg-amber-500/10" : "bg-muted"
                      )}>
                        <Zap className={cn(
                          "w-4 h-4",
                          collection.active ? "text-amber-500" : "text-muted-foreground"
                        )} />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{collection.name}</span>
                          <Badge variant="outline" className="text-xs">
                            Prioridad: {collection.priority}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Package className="w-3 h-3" />
                          <span>{getPackName(collection.packId)}</span>
                          <span>•</span>
                          <span>{sprites.length} sprites</span>
                          {collection.collectionKey && (
                            <>
                              <span>•</span>
                              <code className="bg-muted px-1 rounded text-[10px]">
                                {collection.collectionKeyRequirePipes ? `|${collection.collectionKey}|` : collection.collectionKey}
                              </code>
                            </>
                          )}
                        </div>
                      </div>
                      {!collection.active && (
                        <Badge variant="secondary" className="text-xs">Inactivo</Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-3">
                      {/* Quick Info */}
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="p-2 bg-muted/50 rounded border">
                          <div className="text-muted-foreground">Comportamiento</div>
                          <div className="font-medium mt-0.5 flex items-center gap-1">
                            {BEHAVIOR_OPTIONS.find(b => b.value === collection.collectionBehavior)?.icon}
                            {BEHAVIOR_OPTIONS.find(b => b.value === collection.collectionBehavior)?.label}
                          </div>
                        </div>
                        <div className="p-2 bg-muted/50 rounded border">
                          <div className="text-muted-foreground">Fallback</div>
                          <div className="font-medium mt-0.5">
                            {formatTime(collection.fallbackDelayMs)}
                          </div>
                        </div>
                        <div className="p-2 bg-muted/50 rounded border">
                          <div className="text-muted-foreground">Cooldown</div>
                          <div className="font-medium mt-0.5">
                            {formatTime(collection.cooldownMs)}
                          </div>
                        </div>
                      </div>

                      {/* Chain indicators */}
                      {(collection.spriteChain?.enabled || collection.useTimelineSounds) && (
                        <div className="flex gap-2">
                          {collection.spriteChain?.enabled && (
                            <Badge variant="secondary" className="text-xs bg-purple-500/10 text-purple-600">
                              <Play className="w-3 h-3 mr-1" />
                              Sprite Chain ({collection.spriteChain.steps.length} steps)
                            </Badge>
                          )}
                          {collection.useTimelineSounds && (
                            <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600">
                              <Volume2 className="w-3 h-3 mr-1" />
                              Timeline Sounds
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Sprite configs count */}
                      {Object.keys(collection.spriteConfigs).length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          <Layers className="w-3 h-3 inline mr-1" />
                          {Object.keys(collection.spriteConfigs).length} sprites con configuración individual
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 flex-wrap">
                        {/* Test Button */}
                        <Button
                          variant={testingCollectionId === collection.id ? "default" : "outline"}
                          size="sm"
                          className={cn(
                            "h-7",
                            testingCollectionId === collection.id 
                              ? "bg-green-500 hover:bg-green-600 text-white" 
                              : "text-green-600 hover:text-green-700 hover:bg-green-50"
                          )}
                          onClick={() => handleTestTrigger(collection)}
                          disabled={!spritePacksV2.find(p => p.id === collection.packId)?.sprites?.length}
                        >
                          {testingCollectionId === collection.id ? (
                            <>
                              <CheckCircle className="w-3.5 h-3.5 mr-1" />
                              Aplicado
                            </>
                          ) : (
                            <>
                              <TestTube className="w-3.5 h-3.5 mr-1" />
                              Test
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7"
                          onClick={() => handleEditCollection(collection)}
                        >
                          <Settings2 className="w-3.5 h-3.5 mr-1" />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7"
                          onClick={() => handleDuplicateCollection(collection)}
                        >
                          <Copy className="w-3.5 h-3.5 mr-1" />
                          Duplicar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7"
                          onClick={() => handleToggleActive(collection.id, !collection.active)}
                        >
                          {collection.active ? (
                            <>
                              <Zap className="w-3.5 h-3.5 mr-1 opacity-50" />
                              Desactivar
                            </>
                          ) : (
                            <>
                              <Zap className="w-3.5 h-3.5 mr-1" />
                              Activar
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteCollection(collection.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
        </Accordion>
      ) : spritePacksV2.length > 0 && (
        <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/20">
          <Zap className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No hay Trigger Collections</p>
          <p className="text-xs mt-1">Crea una colección para configurar triggers avanzados</p>
          <Button
            size="sm"
            className="mt-3"
            onClick={handleCreateCollection}
          >
            <Plus className="w-4 h-4 mr-1" />
            Crear Primera Colección
          </Button>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCollection?.id && triggerCollections.find(c => c.id === editingCollection.id)
                ? 'Editar Trigger Collection'
                : 'Nueva Trigger Collection'}
            </DialogTitle>
          </DialogHeader>

          {editingCollection && (
            <TriggerCollectionEditorForm
              collection={editingCollection}
              spritePacksV2={spritePacksV2}
              onChange={setEditingCollection}
            />
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditor(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveCollection}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// Trigger Collection Editor Form
// ============================================

interface TriggerCollectionEditorFormProps {
  collection: TriggerCollection;
  spritePacksV2: SpritePackV2[];
  onChange: (collection: TriggerCollection) => void;
}

function TriggerCollectionEditorForm({
  collection,
  spritePacksV2,
  onChange,
}: TriggerCollectionEditorFormProps) {
  const [expandedSprites, setExpandedSprites] = useState<Record<string, boolean>>({});

  // Get pack sprites
  const packSprites = useMemo(() => {
    const pack = spritePacksV2.find(p => p.id === collection.packId);
    return pack?.sprites || [];
  }, [collection.packId, spritePacksV2]);

  // Update field
  const updateField = <K extends keyof TriggerCollection>(field: K, value: TriggerCollection[K]) => {
    onChange({ ...collection, [field]: value });
  };

  // Format time
  const formatTime = (ms: number) => {
    if (ms <= 0) return 'Nunca';
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  };

  // Parse keys string
  const parseKeysString = (keysStr: string): string[] => {
    return keysStr.split(',').map(k => k.trim()).filter(Boolean);
  };

  // Keys to string
  const keysToString = (keys: string[] | undefined): string => {
    return (keys || []).join(', ');
  };

  return (
    <div className="space-y-6 py-4">
      {/* Basic Info */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Settings2 className="w-4 h-4" />
          Información Básica
        </h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Nombre</Label>
            <Input
              value={collection.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="Nombre de la colección"
              className="h-8 mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Prioridad</Label>
            <Input
              type="number"
              value={collection.priority}
              onChange={(e) => updateField('priority', parseInt(e.target.value) || 1)}
              placeholder="1"
              className="h-8 mt-1"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs">Sprite Pack</Label>
          <Select
            value={collection.packId}
            onValueChange={(v) => updateField('packId', v)}
          >
            <SelectTrigger className="h-8 mt-1">
              <SelectValue placeholder="Seleccionar pack..." />
            </SelectTrigger>
            <SelectContent>
              {spritePacksV2.map(pack => (
                <SelectItem key={pack.id} value={pack.id}>
                  <div className="flex items-center gap-2">
                    <Package className="w-3 h-3" />
                    {pack.name} ({pack.sprites.length} sprites)
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
          <div>
            <Label className="text-xs font-medium">Activo</Label>
            <p className="text-[10px] text-muted-foreground">
              Si está inactivo, no se procesarán los triggers
            </p>
          </div>
          <Switch
            checked={collection.active}
            onCheckedChange={(v) => updateField('active', v)}
          />
        </div>
      </div>

      {/* Collection Keys */}
      <div className="space-y-3 p-4 border rounded-lg bg-cyan-500/5 border-cyan-500/20">
        <h4 className="text-sm font-medium flex items-center gap-2 text-cyan-600">
          <Zap className="w-4 h-4" />
          Keys de Colección (General)
        </h4>
        <p className="text-xs text-muted-foreground">
          Cuando se detecta esta key, se activa la colección usando el comportamiento configurado.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Key Principal</Label>
            <Input
              value={collection.collectionKey}
              onChange={(e) => updateField('collectionKey', e.target.value)}
              placeholder="Ej: spritewin, sprite:happy"
              className="h-8 mt-1 font-mono text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Keys Alternativas (coma)</Label>
            <Input
              value={keysToString(collection.collectionKeys)}
              onChange={(e) => updateField('collectionKeys', parseKeysString(e.target.value))}
              placeholder="win, victory, triumph"
              className="h-8 mt-1 font-mono text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg border">
            <div>
              <Label className="text-xs font-medium">Requiere |pipes|</Label>
              <p className="text-[10px] text-muted-foreground">
                Solo detecta entre | pipes |
              </p>
            </div>
            <Switch
              checked={collection.collectionKeyRequirePipes}
              onCheckedChange={(v) => updateField('collectionKeyRequirePipes', v)}
            />
          </div>
          <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg border">
            <div>
              <Label className="text-xs font-medium">Case Sensitive</Label>
              <p className="text-[10px] text-muted-foreground">
                Distingue mayúsculas
              </p>
            </div>
            <Switch
              checked={collection.collectionKeyCaseSensitive}
              onCheckedChange={(v) => updateField('collectionKeyCaseSensitive', v)}
            />
          </div>
        </div>

        <div>
          <Label className="text-xs">Cooldown</Label>
          <div className="flex items-center gap-2 mt-1">
            <Input
              type="number"
              value={collection.cooldownMs}
              onChange={(e) => updateField('cooldownMs', Math.max(0, parseInt(e.target.value) || 0))}
              className="h-8 w-24"
            />
            <span className="text-xs text-muted-foreground">
              ms ({formatTime(collection.cooldownMs)})
            </span>
          </div>
        </div>
      </div>

      {/* Behavior */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Crown className="w-4 h-4 text-amber-500" />
          Comportamiento
        </h4>
        <p className="text-xs text-muted-foreground">
          Cómo seleccionar el sprite cuando se activa la colección.
        </p>

        <Select
          value={collection.collectionBehavior}
          onValueChange={(v) => updateField('collectionBehavior', v as 'principal' | 'random' | 'list')}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BEHAVIOR_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                <div className="flex items-center gap-2">
                  {opt.icon}
                  <span>{opt.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {BEHAVIOR_OPTIONS.find(b => b.value === collection.collectionBehavior)?.description}
        </p>

        {collection.collectionBehavior === 'principal' && packSprites.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1">
              <Crown className="w-3 h-3 text-amber-500" />
              Sprite Principal
            </Label>
            <Select
              value={collection.principalSpriteId || '__first__'}
              onValueChange={(v) => updateField('principalSpriteId', v === '__first__' ? undefined : v)}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Primero del pack" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__first__">
                  <span className="text-muted-foreground">Primero del pack (automático)</span>
                </SelectItem>
                {packSprites.map(sprite => (
                  <SelectItem key={sprite.id} value={sprite.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded overflow-hidden bg-muted/50">
                        <SpritePreview
                          src={sprite.url}
                          alt={sprite.label}
                          className="w-full h-full"
                          objectFit="contain"
                        />
                      </div>
                      {sprite.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Fallback */}
      <div className="space-y-3 p-4 border rounded-lg bg-blue-500/5 border-blue-500/20">
        <h4 className="text-sm font-medium flex items-center gap-2 text-blue-600">
          <Timer className="w-4 h-4" />
          Fallback
        </h4>
        <p className="text-xs text-muted-foreground">
          Qué hacer después de mostrar el sprite.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Modo de Fallback</Label>
            <Select
              value={collection.fallbackMode}
              onValueChange={(v) => updateField('fallbackMode', v as TriggerFallbackMode)}
            >
              <SelectTrigger className="h-8 mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FALLBACK_MODES.map(mode => (
                  <SelectItem key={mode.value} value={mode.value}>
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tiempo (0 = nunca)</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="number"
                value={collection.fallbackDelayMs}
                onChange={(e) => updateField('fallbackDelayMs', Math.max(0, parseInt(e.target.value) || 0))}
                className="h-8"
              />
              <span className="text-xs text-muted-foreground">
                {formatTime(collection.fallbackDelayMs)}
              </span>
            </div>
          </div>
        </div>

        {collection.fallbackMode === 'custom_sprite' && packSprites.length > 0 && (
          <div>
            <Label className="text-xs">Sprite de Fallback</Label>
            <Select
              value={collection.fallbackSpriteId || ''}
              onValueChange={(v) => updateField('fallbackSpriteId', v || undefined)}
            >
              <SelectTrigger className="h-8 mt-1">
                <SelectValue placeholder="Seleccionar sprite..." />
              </SelectTrigger>
              <SelectContent>
                {packSprites.map(sprite => (
                  <SelectItem key={sprite.id} value={sprite.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded overflow-hidden bg-muted/50">
                        <SpritePreview
                          src={sprite.url}
                          alt={sprite.label}
                          className="w-full h-full"
                          objectFit="contain"
                        />
                      </div>
                      {sprite.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Sprite Chains */}
      <div className="space-y-3 p-4 border rounded-lg bg-purple-500/5 border-purple-500/20">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium flex items-center gap-2 text-purple-600">
            <Play className="w-4 h-4" />
            Sprite Chain
          </h4>
          <Switch
            checked={collection.spriteChain?.enabled ?? false}
            onCheckedChange={(enabled) => updateField('spriteChain', {
              ...collection.spriteChain,
              enabled,
              steps: collection.spriteChain?.steps || [],
              loop: collection.spriteChain?.loop ?? false,
              interruptible: collection.spriteChain?.interruptible ?? true,
            })}
          />
        </div>
        
        {collection.spriteChain?.enabled && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Secuencia de sprites que se reproducen en lugar de un tiempo de espera fijo.
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg border">
                <div>
                  <Label className="text-xs font-medium">Loop</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Repetir la secuencia
                  </p>
                </div>
                <Switch
                  checked={collection.spriteChain?.loop ?? false}
                  onCheckedChange={(loop) => updateField('spriteChain', {
                    ...collection.spriteChain!,
                    loop,
                  })}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg border">
                <div>
                  <Label className="text-xs font-medium">Interrumpible</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Permite cortar con nuevo trigger
                  </p>
                </div>
                <Switch
                  checked={collection.spriteChain?.interruptible ?? true}
                  onCheckedChange={(interruptible) => updateField('spriteChain', {
                    ...collection.spriteChain!,
                    interruptible,
                  })}
                />
              </div>
            </div>

            {/* Chain Steps */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Steps ({collection.spriteChain?.steps.length || 0})</Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => {
                    const steps = collection.spriteChain?.steps || [];
                    const newStep = {
                      spriteId: packSprites[0]?.id || '',
                      durationMs: 1000,
                      transition: 'none' as const,
                    };
                    updateField('spriteChain', {
                      ...collection.spriteChain!,
                      steps: [...steps, newStep],
                    });
                  }}
                  disabled={packSprites.length === 0}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Agregar Step
                </Button>
              </div>
              
              <ScrollArea className="h-32">
                <div className="space-y-1 pr-2">
                  {(collection.spriteChain?.steps || []).map((step, index) => {
                    const sprite = packSprites.find(s => s.id === step.spriteId);
                    return (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 bg-background rounded border"
                      >
                        <div className="w-8 h-8 rounded overflow-hidden bg-muted/50">
                          {sprite ? (
                            <SpritePreview
                              src={sprite.url}
                              alt={sprite.label}
                              className="w-full h-full"
                              objectFit="contain"
                            />
                          ) : (
                            <ImageIcon className="w-4 h-4 m-auto text-muted-foreground" />
                          )}
                        </div>
                        <Select
                          value={step.spriteId}
                          onValueChange={(v) => {
                            const newSteps = [...(collection.spriteChain?.steps || [])];
                            newSteps[index] = { ...newSteps[index], spriteId: v };
                            updateField('spriteChain', {
                              ...collection.spriteChain!,
                              steps: newSteps,
                            });
                          }}
                        >
                          <SelectTrigger className="h-7 flex-1">
                            <SelectValue placeholder="Sprite..." />
                          </SelectTrigger>
                          <SelectContent>
                            {packSprites.map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          value={step.durationMs}
                          onChange={(e) => {
                            const newSteps = [...(collection.spriteChain?.steps || [])];
                            newSteps[index] = { ...newSteps[index], durationMs: parseInt(e.target.value) || 1000 };
                            updateField('spriteChain', {
                              ...collection.spriteChain!,
                              steps: newSteps,
                            });
                          }}
                          className="h-7 w-20"
                          placeholder="ms"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive"
                          onClick={() => {
                            const newSteps = (collection.spriteChain?.steps || []).filter((_, i) => i !== index);
                            updateField('spriteChain', {
                              ...collection.spriteChain!,
                              steps: newSteps,
                            });
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}
      </div>

      {/* Timeline Sounds */}
      <div className="space-y-3 p-4 border rounded-lg bg-green-500/5 border-green-500/20">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium flex items-center gap-2 text-green-600">
              <Volume2 className="w-4 h-4" />
              Timeline Sounds
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              Cuando está activado, reproduce los sonidos configurados en el timeline del sprite.
            </p>
          </div>
          <Switch
            checked={collection.useTimelineSounds ?? false}
            onCheckedChange={(useTimelineSounds) => updateField('useTimelineSounds', useTimelineSounds)}
          />
        </div>

        {collection.useTimelineSounds && (
          <div className="text-xs bg-muted/30 p-3 rounded-lg">
            <Info className="w-3 h-3 inline mr-1" />
            Los sonidos se configuran en cada sprite individual del Sprite Pack.
            Asegúrate de que los sprites tengan configurado su timeline con tracks de sonido.
          </div>
        )}
      </div>

      {/* Individual Sprite Configs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Configuración Individual por Sprite
          </h4>
          <Badge variant="secondary" className="text-xs">
            {Object.keys(collection.spriteConfigs).length} configurados
          </Badge>
        </div>
        
        <p className="text-xs text-muted-foreground">
          Configura keys específicas para sprites individuales dentro del pack.
          Esto permite activar sprites específicos con keys diferentes a la key de colección.
        </p>

        {packSprites.length > 0 ? (
          <ScrollArea className="h-48">
            <div className="space-y-2 pr-2">
              {packSprites.map(sprite => {
                const config = collection.spriteConfigs[sprite.id];
                const isExpanded = expandedSprites[sprite.id];

                return (
                  <div key={sprite.id} className="border rounded-lg overflow-hidden">
                    <div
                      className="flex items-center gap-3 p-3 bg-muted/30 cursor-pointer"
                      onClick={() => setExpandedSprites(prev => ({ ...prev, [sprite.id]: !prev[sprite.id] }))}
                    >
                      <div className="w-10 h-10 rounded overflow-hidden bg-muted/50">
                        <SpritePreview
                          src={sprite.url}
                          alt={sprite.label}
                          className="w-full h-full"
                          objectFit="contain"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">{sprite.label}</div>
                        {config && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {config.enabled ? (
                              <>
                                <Badge variant="secondary" className="text-[10px]">
                                  {config.key || 'Sin key'}
                                </Badge>
                              </>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">Inactivo</Badge>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {config && (
                          <Switch
                            checked={config.enabled}
                            onCheckedChange={(enabled) => {
                              onChange({
                                ...collection,
                                spriteConfigs: {
                                  ...collection.spriteConfigs,
                                  [sprite.id]: { ...config, enabled },
                                },
                              });
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-3 border-t space-y-3 bg-background">
                        {!config && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full h-7"
                            onClick={() => {
                              onChange({
                                ...collection,
                                spriteConfigs: {
                                  ...collection.spriteConfigs,
                                  [sprite.id]: {
                                    spriteId: sprite.id,
                                    key: '',
                                    keys: [],
                                    requirePipes: true,
                                    caseSensitive: false,
                                    fallbackMode: 'collection_default',
                                    fallbackSpriteId: undefined,
                                    fallbackDelayMs: undefined,
                                    spriteChain: undefined,
                                    soundChain: undefined,
                                    enabled: true,
                                  },
                                },
                              });
                            }}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Configurar Sprite
                          </Button>
                        )}

                        {config && (
                          <>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs">Key Principal</Label>
                                <Input
                                  value={config.key}
                                  onChange={(e) => {
                                    onChange({
                                      ...collection,
                                      spriteConfigs: {
                                        ...collection.spriteConfigs,
                                        [sprite.id]: { ...config, key: e.target.value },
                                      },
                                    });
                                  }}
                                  placeholder="sprite:happy"
                                  className="h-7 mt-1 font-mono text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Keys Alternativas</Label>
                                <Input
                                  value={keysToString(config.keys)}
                                  onChange={(e) => {
                                    onChange({
                                      ...collection,
                                      spriteConfigs: {
                                        ...collection.spriteConfigs,
                                        [sprite.id]: { ...config, keys: parseKeysString(e.target.value) },
                                      },
                                    });
                                  }}
                                  placeholder="happy, joy, smile"
                                  className="h-7 mt-1 font-mono text-sm"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="flex items-center justify-between p-2 bg-muted/30 rounded border">
                                <Label className="text-xs">|Pipes|</Label>
                                <Switch
                                  checked={config.requirePipes}
                                  onCheckedChange={(v) => {
                                    onChange({
                                      ...collection,
                                      spriteConfigs: {
                                        ...collection.spriteConfigs,
                                        [sprite.id]: { ...config, requirePipes: v },
                                      },
                                    });
                                  }}
                                />
                              </div>
                              <div className="flex items-center justify-between p-2 bg-muted/30 rounded border">
                                <Label className="text-xs">Case Sens.</Label>
                                <Switch
                                  checked={config.caseSensitive}
                                  onCheckedChange={(v) => {
                                    onChange({
                                      ...collection,
                                      spriteConfigs: {
                                        ...collection.spriteConfigs,
                                        [sprite.id]: { ...config, caseSensitive: v },
                                      },
                                    });
                                  }}
                                />
                              </div>
                            </div>

                            {/* Individual Fallback Configuration */}
                            <div className="space-y-2 p-3 border rounded-lg bg-blue-500/5 border-blue-500/20">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs font-medium text-blue-600 flex items-center gap-1">
                                  <Timer className="w-3 h-3" />
                                  Fallback Individual
                                </Label>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 text-[10px]"
                                  onClick={() => {
                                    onChange({
                                      ...collection,
                                      spriteConfigs: {
                                        ...collection.spriteConfigs,
                                        [sprite.id]: { 
                                          ...config, 
                                          fallbackMode: undefined,
                                          fallbackDelayMs: undefined,
                                          fallbackSpriteId: undefined,
                                        },
                                      },
                                    });
                                  }}
                                >
                                  Usar default
                                </Button>
                              </div>
                              <p className="text-[10px] text-muted-foreground">
                                Configura un fallback específico para este sprite. Si no se configura, usa el fallback de la colección.
                              </p>
                              
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-[10px]">Modo</Label>
                                  <Select
                                    value={config.fallbackMode || 'collection_default'}
                                    onValueChange={(v) => {
                                      onChange({
                                        ...collection,
                                        spriteConfigs: {
                                          ...collection.spriteConfigs,
                                          [sprite.id]: { ...config, fallbackMode: v as TriggerFallbackMode },
                                        },
                                      });
                                    }}
                                  >
                                    <SelectTrigger className="h-7 mt-1 text-xs">
                                      <SelectValue placeholder="Default colección" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {FALLBACK_MODES.map(mode => (
                                        <SelectItem key={mode.value} value={mode.value}>
                                          {mode.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-[10px]">Tiempo (ms)</Label>
                                  <div className="flex items-center gap-1 mt-1">
                                    <Input
                                      type="number"
                                      value={config.fallbackDelayMs ?? ''}
                                      onChange={(e) => {
                                        const val = e.target.value ? parseInt(e.target.value) : undefined;
                                        onChange({
                                          ...collection,
                                          spriteConfigs: {
                                            ...collection.spriteConfigs,
                                            [sprite.id]: { ...config, fallbackDelayMs: val },
                                          },
                                        });
                                      }}
                                      placeholder="Default"
                                      className="h-7 text-xs"
                                    />
                                    {config.fallbackDelayMs && (
                                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                        {formatTime(config.fallbackDelayMs)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {config.fallbackMode === 'custom_sprite' && packSprites.length > 0 && (
                                <div>
                                  <Label className="text-[10px]">Sprite de Fallback</Label>
                                  <Select
                                    value={config.fallbackSpriteId || ''}
                                    onValueChange={(v) => {
                                      onChange({
                                        ...collection,
                                        spriteConfigs: {
                                          ...collection.spriteConfigs,
                                          [sprite.id]: { ...config, fallbackSpriteId: v || undefined },
                                        },
                                      });
                                    }}
                                  >
                                    <SelectTrigger className="h-7 mt-1 text-xs">
                                      <SelectValue placeholder="Seleccionar sprite..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {packSprites.filter(s => s.id !== sprite.id).map(s => (
                                        <SelectItem key={s.id} value={s.id}>
                                          <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 rounded overflow-hidden bg-muted/50">
                                              <SpritePreview
                                                src={s.url}
                                                alt={s.label}
                                                className="w-full h-full"
                                                objectFit="contain"
                                              />
                                            </div>
                                            {s.label}
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs text-destructive"
                              onClick={() => {
                                const newConfigs = { ...collection.spriteConfigs };
                                delete newConfigs[sprite.id];
                                onChange({ ...collection, spriteConfigs: newConfigs });
                              }}
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Eliminar Configuración
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-4 text-muted-foreground bg-muted/20 rounded-lg">
            <ImageIcon className="w-6 h-6 mx-auto mb-2 opacity-50" />
            <p className="text-xs">El pack no tiene sprites</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default TriggerCollectionEditor;
