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
import { cn } from '@/lib/utils';
import {
  Crown,
  Shuffle,
  List,
  Star,
  Image as ImageIcon,
  Check,
  Package,
  Sparkles,
  MessageSquare,
  Brain,
  X,
} from 'lucide-react';
import type { 
  SpriteState,
  SpritePackV2,
  StateCollectionV2,
  CharacterCard,
} from '@/types';
import { SpritePreview } from './sprite-preview';

// Check if URL is a video file
function isVideoUrl(url: string): boolean {
  return /\.(webm|mp4|mov|avi)(\?.*)?$/i.test(url);
}

// Check if URL is an animated image
function isAnimatedImage(url: string): boolean {
  return /\.(gif|apng|webp)(\?.*)?$/i.test(url);
}

interface StateCollectionEditorV2Props {
  character: CharacterCard;
  onChange: (updates: Partial<CharacterCard>) => void;
}

// State configuration
const STATE_CONFIG: { 
  key: SpriteState; 
  label: string; 
  icon: React.ReactNode; 
  description: string;
  color: string;
}[] = [
  { 
    key: 'idle', 
    label: 'Idle (Reposo)', 
    icon: <Sparkles className="w-4 h-4" />, 
    description: 'Sprite por defecto cuando no hace nada',
    color: 'text-amber-500'
  },
  { 
    key: 'talk', 
    label: 'Talk (Hablando)', 
    icon: <MessageSquare className="w-4 h-4" />, 
    description: 'Sprite cuando está hablando',
    color: 'text-green-500'
  },
  { 
    key: 'thinking', 
    label: 'Thinking (Pensando)', 
    icon: <Brain className="w-4 h-4" />, 
    description: 'Sprite cuando está pensando',
    color: 'text-blue-500'
  },
];

// Behavior configuration per state
// Idle: all 3 behaviors (principal, aleatorio, lista)
// Talk & Thinking: only lista and aleatorio (fallback is always idle)
const BEHAVIOR_BY_STATE: Record<SpriteState, { 
  value: 'principal' | 'random' | 'list'; 
  label: string; 
  icon: React.ReactNode; 
  description: string 
}[]> = {
  idle: [
    { 
      value: 'principal', 
      label: 'Principal', 
      icon: <Crown className="w-3.5 h-3.5" />, 
      description: 'Siempre usa el sprite designado (cuando hace fallback regresa a este)'
    },
    { 
      value: 'random', 
      label: 'Aleatorio', 
      icon: <Shuffle className="w-3.5 h-3.5" />, 
      description: 'Muestra un sprite aleatorio del pack'
    },
    { 
      value: 'list', 
      label: 'Lista', 
      icon: <List className="w-3.5 h-3.5" />, 
      description: 'Rota los sprites del pack en orden cada activación'
    },
  ],
  talk: [
    { 
      value: 'list', 
      label: 'Lista', 
      icon: <List className="w-3.5 h-3.5" />, 
      description: 'Cada vez que habla, muestra el siguiente sprite del pack'
    },
    { 
      value: 'random', 
      label: 'Aleatorio', 
      icon: <Shuffle className="w-3.5 h-3.5" />, 
      description: 'Muestra un sprite aleatorio del pack al hablar'
    },
  ],
  thinking: [
    { 
      value: 'list', 
      label: 'Lista', 
      icon: <List className="w-3.5 h-3.5" />, 
      description: 'Cada vez que piensa, muestra el siguiente sprite del pack'
    },
    { 
      value: 'random', 
      label: 'Aleatorio', 
      icon: <Shuffle className="w-3.5 h-3.5" />, 
      description: 'Muestra un sprite aleatorio del pack al pensar'
    },
  ],
};

// Get behaviors for a given state
const getBehaviorsForState = (state: SpriteState) => BEHAVIOR_BY_STATE[state];

export function StateCollectionEditorV2({ 
  character, 
  onChange 
}: StateCollectionEditorV2Props) {
  // Get packs
  const spritePacksV2: SpritePackV2[] = useMemo(() => {
    return character.spritePacksV2 || [];
  }, [character.spritePacksV2]);

  // Get state collections
  const stateCollectionsV2: Record<SpriteState, StateCollectionV2 | undefined> = useMemo(() => {
    const collections = character.stateCollectionsV2 || [];
    const map: Record<SpriteState, StateCollectionV2 | undefined> = {
      idle: undefined,
      talk: undefined,
      thinking: undefined,
    };
    for (const c of collections) {
      map[c.state] = c;
    }
    return map;
  }, [character.stateCollectionsV2]);

  // Get sprites from pack
  const getSpritesFromPack = (packId: string) => {
    const pack = spritePacksV2.find(p => p.id === packId);
    return pack?.sprites || [];
  };

  // Get selected sprite URL
  const getSelectedSpriteUrl = (packId: string, behavior: 'principal' | 'random' | 'list', principalSpriteId?: string) => {
    const sprites = getSpritesFromPack(packId);
    if (sprites.length === 0) return null;

    switch (behavior) {
      case 'principal':
        if (principalSpriteId) {
          const sprite = sprites.find(s => s.id === principalSpriteId);
          if (sprite) return sprite.url;
        }
        return sprites[0]?.url || null;
      case 'random':
        return null; // Random is determined at runtime
      case 'list':
        return null; // List is determined at runtime
      default:
        return sprites[0]?.url || null;
    }
  };

  // Handle pack selection for state
  const handlePackChange = (state: SpriteState, packId: string) => {
    const currentCollection = stateCollectionsV2[state];
    const newCollection: StateCollectionV2 = {
      state,
      packId,
      behavior: currentCollection?.behavior || (state === 'idle' ? 'principal' : 'list'),
      principalSpriteId: currentCollection?.principalSpriteId,
      spriteOrder: currentCollection?.spriteOrder,
      excludedSpriteIds: currentCollection?.excludedSpriteIds,
      currentIndex: currentCollection?.currentIndex || 0,
    };

    const existingCollections = character.stateCollectionsV2 || [];
    const filtered = existingCollections.filter(c => c.state !== state);
    
    onChange({
      stateCollectionsV2: [...filtered, newCollection],
    });
  };

  // Handle behavior change
  const handleBehaviorChange = (state: SpriteState, behavior: 'principal' | 'random' | 'list') => {
    const currentCollection = stateCollectionsV2[state];
    if (!currentCollection) return;

    const updatedCollection: StateCollectionV2 = {
      ...currentCollection,
      behavior,
    };

    const existingCollections = character.stateCollectionsV2 || [];
    const filtered = existingCollections.filter(c => c.state !== state);
    
    onChange({
      stateCollectionsV2: [...filtered, updatedCollection],
    });
  };

  // Handle principal sprite selection
  const handlePrincipalSpriteChange = (state: SpriteState, spriteId: string) => {
    const currentCollection = stateCollectionsV2[state];
    if (!currentCollection) return;

    const updatedCollection: StateCollectionV2 = {
      ...currentCollection,
      principalSpriteId: spriteId,
    };

    const existingCollections = character.stateCollectionsV2 || [];
    const filtered = existingCollections.filter(c => c.state !== state);
    
    onChange({
      stateCollectionsV2: [...filtered, updatedCollection],
    });
  };

  // Clear state collection
  const handleClearStateCollection = (state: SpriteState) => {
    const existingCollections = character.stateCollectionsV2 || [];
    onChange({
      stateCollectionsV2: existingCollections.filter(c => c.state !== state),
    });
  };

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="text-xs bg-muted/50 border rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <Package className="w-4 h-4 text-purple-500" />
          Colecciones de Estado V2
        </div>
        <p className="text-muted-foreground">
          Cada estado referencia un <strong>Sprite Pack</strong> y define cómo seleccionar el sprite.
          Los packs se crean en la pestaña "Sprite Packs".
        </p>
        <div className="space-y-2 mt-2">
          <div className="font-medium text-muted-foreground">Idle (Reposo)</div>
          <div className="grid grid-cols-3 gap-2">
            {BEHAVIOR_BY_STATE.idle.map(config => (
              <div key={config.value} className="p-2 bg-background/50 rounded border">
                <div className="flex items-center gap-1 text-xs font-medium">
                  {config.icon}
                  <span>{config.label}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {config.description}
                </p>
              </div>
            ))}
          </div>
          <div className="font-medium text-muted-foreground">Talk / Thinking</div>
          <p className="text-[10px] text-muted-foreground">
            Solo <strong>Lista</strong> (rota en orden) y <strong>Aleatorio</strong> — su fallback siempre regresa al Idle.
          </p>
        </div>
      </div>

      {/* State Collections Grid */}
      <div className="grid grid-cols-1 gap-4">
        {STATE_CONFIG.map(stateConfig => {
          const collection = stateCollectionsV2[stateConfig.key];
          const pack = collection ? spritePacksV2.find(p => p.id === collection.packId) : null;
          const sprites = pack ? getSpritesFromPack(pack.id) : [];
          const selectedSpriteUrl = collection ? getSelectedSpriteUrl(collection.packId, collection.behavior, collection.principalSpriteId) : null;

          return (
            <div
              key={stateConfig.key}
              className={cn(
                "border rounded-lg p-4 space-y-3",
                collection && "bg-muted/20"
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("p-1.5 bg-muted rounded", stateConfig.color)}>
                    {stateConfig.icon}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{stateConfig.label}</div>
                    <div className="text-xs text-muted-foreground">{stateConfig.description}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {collection && (
                    <Badge variant="secondary" className="text-xs">
                      {sprites.length} sprites
                    </Badge>
                  )}
                  {collection && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleClearStateCollection(stateConfig.key)}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Pack Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs">Sprite Pack</Label>
                <Select
                  value={collection?.packId || ''}
                  onValueChange={(v) => handlePackChange(stateConfig.key, v)}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Seleccionar pack..." />
                  </SelectTrigger>
                  <SelectContent>
                    {spritePacksV2.length > 0 ? (
                      spritePacksV2.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          <div className="flex items-center gap-2">
                            <Package className="w-3 h-3" />
                            {p.name} ({p.sprites.length})
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        No hay packs creados
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Behavior Selector */}
              {collection && sprites.length > 0 && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Comportamiento</Label>
                    <Select
                      value={collection.behavior}
                      onValueChange={(v) => handleBehaviorChange(stateConfig.key, v as 'principal' | 'random' | 'list')}
                    
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getBehaviorsForState(stateConfig.key).map(config => (
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
                      {getBehaviorsForState(stateConfig.key).find(b => b.value === collection.behavior)?.description}
                    </p>
                  </div>

                  {/* Principal Sprite Selector (for 'principal' behavior) */}
                  {collection.behavior === 'principal' && sprites.length > 1 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1">
                        <Crown className="w-3 h-3 text-amber-500" />
                        Sprite Principal
                      </Label>
                      <ScrollArea className="h-24">
                        <div className="grid grid-cols-4 gap-1.5">
                          {sprites.map(sprite => (
                            <div
                              key={sprite.id}
                              className={cn(
                                "relative border rounded overflow-hidden cursor-pointer transition-all",
                                collection.principalSpriteId === sprite.id
                                  ? "ring-2 ring-amber-500 border-amber-500"
                                  : "hover:border-primary"
                              )}
                              onClick={() => handlePrincipalSpriteChange(stateConfig.key, sprite.id)}
                            >
                              <div className="aspect-square relative">
                                <SpritePreview
                                  src={sprite.url}
                                  alt={sprite.label}
                                  className="w-full h-full"
                                  objectFit="contain"
                                />
                                {collection.principalSpriteId === sprite.id && (
                                  <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
                                    <Check className="w-4 h-4 text-amber-500" />
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {/* Preview */}
                  {selectedSpriteUrl && (
                    <div className="flex items-center gap-3 p-2 bg-background/50 rounded border">
                      <div className="w-12 h-12 rounded border overflow-hidden relative bg-muted/50">
                        <SpritePreview
                          src={selectedSpriteUrl}
                          alt="Preview"
                          className="w-full h-full"
                          objectFit="contain"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-medium">Sprite actual</div>
                        <div className="text-[10px] text-muted-foreground">
                          {collection.behavior === 'principal' ? 'Principal' : 
                           collection.behavior === 'random' ? 'Aleatorio' : 'Rotación'}
                          {pack && ` de "${pack.name}"`}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* No pack selected */}
              {!collection && (
                <div className="text-center py-4 text-muted-foreground border rounded-lg bg-muted/20">
                  <ImageIcon className="w-6 h-6 mx-auto mb-1 opacity-50" />
                  <p className="text-xs">Sin pack asignado</p>
                  <p className="text-[10px] mt-0.5">
                    Selecciona un Sprite Pack arriba
                  </p>
                </div>
              )}

              {/* Pack was deleted (broken reference) */}
              {collection && !pack && (
                <div className="text-center py-4 text-destructive border border-destructive/30 rounded-lg bg-destructive/5">
                  <Package className="w-6 h-6 mx-auto mb-1 opacity-50" />
                  <p className="text-xs font-medium">⚠️ Pack no encontrado</p>
                  <p className="text-[10px] mt-0.5">
                    El sprite pack fue eliminado. El personaje usará su avatar como fallback.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 mt-2 text-xs"
                    onClick={() => handleClearStateCollection(stateConfig.key)}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Limpiar referencia
                  </Button>
                </div>
              )}

              {/* Pack empty */}
              {collection && pack && sprites.length === 0 && (
                <div className="text-center py-4 text-amber-600 border border-amber-500/30 rounded-lg bg-amber-500/5">
                  <Package className="w-6 h-6 mx-auto mb-1 opacity-50" />
                  <p className="text-xs">El pack "{pack?.name}" está vacío</p>
                  <p className="text-[10px] mt-0.5">
                    Agrega sprites al pack en la pestaña "Sprite Packs"
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      {spritePacksV2.length === 0 && (
        <div className="text-center py-4 text-amber-600 bg-amber-500/5 border border-amber-500/20 rounded-lg">
          <Package className="w-6 h-6 mx-auto mb-2" />
          <p className="text-sm font-medium">No hay Sprite Packs creados</p>
          <p className="text-xs mt-1">
            Ve a la pestaña "Sprite Packs" para crear tu primer pack
          </p>
        </div>
      )}
    </div>
  );
}

export default StateCollectionEditorV2;
