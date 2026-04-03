'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { 
  Wand2, 
  Sparkles, 
  Heart, 
  Frown, 
  Angry, 
  Smile,
  Coffee,
  Zap,
  BookOpen,
  Plus,
  Check
} from 'lucide-react';
import type { SpriteLibraryEntry } from '@/types';
const uuidv4 = () => crypto.randomUUID();

interface PresetItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  libraries?: {
    actions?: { name: string; prefix: string }[];
    poses?: { name: string; prefix: string }[];
    clothes?: { name: string; prefix: string }[];
  };
}

const PRESETS: PresetItem[] = [
  {
    title: 'Emociones Básicas',
    description: 'Triggers para emociones comunes: feliz, triste, enojado',
    icon: <Heart className="w-4 h-4" />,
    color: 'text-pink-500',
    libraries: {
      actions: [
        { name: 'smile', prefix: 'act-' },
        { name: 'laugh', prefix: 'act-' },
        { name: 'cry', prefix: 'act-' },
        { name: 'blush', prefix: 'act-' },
      ],
    },
  },
  {
    title: 'Acciones de Conversación',
    description: 'Gestos comunes en conversaciones',
    icon: <Sparkles className="w-4 h-4" />,
    color: 'text-purple-500',
    libraries: {
      actions: [
        { name: 'wave', prefix: 'act-' },
        { name: 'nod', prefix: 'act-' },
        { name: 'shake', prefix: 'act-' },
        { name: 'point', prefix: 'act-' },
        { name: 'think', prefix: 'act-' },
      ],
    },
  },
  {
    title: 'Posturas',
    description: 'Diferentes posturas del cuerpo',
    icon: <Coffee className="w-4 h-4" />,
    color: 'text-amber-500',
    libraries: {
      poses: [
        { name: 'standing', prefix: 'pose-' },
        { name: 'sitting', prefix: 'pose-' },
        { name: 'lying', prefix: 'pose-' },
        { name: 'leaning', prefix: 'pose-' },
      ],
    },
  },
  {
    title: 'Ropa/Vestimenta',
    description: 'Diferentes outfits y vestimentas',
    icon: <BookOpen className="w-4 h-4" />,
    color: 'text-blue-500',
    libraries: {
      clothes: [
        { name: 'casual', prefix: 'cloth-' },
        { name: 'formal', prefix: 'cloth-' },
        { name: 'sleep', prefix: 'cloth-' },
        { name: 'swim', prefix: 'cloth-' },
      ],
    },
  },
  {
    title: 'Expresiones Anime',
    description: 'Expresiones típicas de anime',
    icon: <Zap className="w-4 h-4" />,
    color: 'text-yellow-500',
    libraries: {
      actions: [
        { name: 'blush', prefix: 'act-' },
        { name: 'sweatdrop', prefix: 'act-' },
        { name: 'vein', prefix: 'act-' },
        { name: 'sparkle', prefix: 'act-' },
        { name: 'tear', prefix: 'act-' },
      ],
    },
  },
];

interface PresetSelectorProps {
  onApplyPreset: (preset: PresetItem) => void;
  appliedPresets: string[];
  className?: string;
}

export function PresetSelector({ onApplyPreset, appliedPresets, className }: PresetSelectorProps) {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Presets de Triggers</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Aplica configuraciones predefinidas de libraries y packs. Los sprite labels son ejemplos y deben actualizarse con tus sprites.
      </p>
      
      <div className="text-xs bg-amber-500/10 border border-amber-500/20 p-2 rounded text-amber-600">
        ⚠️ Los presets usan labels de ejemplo. Debes configurar los sprites reales en cada item del pack.
      </div>

      <ScrollArea className="h-[180px]">
        <div className="space-y-2 pr-2">
          {PRESETS.map((preset) => {
            const isApplied = appliedPresets.includes(preset.title);
            
            return (
              <button
                key={preset.title}
                type="button"
                onClick={() => setSelectedPreset(selectedPreset === preset.title ? null : preset.title)}
                className={cn(
                  "w-full text-left p-3 rounded-lg border transition-colors",
                  selectedPreset === preset.title 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-primary/50",
                  isApplied && "border-green-500/50 bg-green-500/5"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn("mt-0.5", preset.color)}>
                    {preset.icon}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{preset.title}</span>
                      {isApplied && (
                        <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-600 border-green-500/30">
                          <Check className="w-2.5 h-2.5 mr-1" />
                          Aplicado
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {preset.description}
                    </p>
                    
                    {selectedPreset === preset.title && (
                      <div className="mt-3 space-y-2">
                        {/* Libraries preview */}
                        {preset.libraries && (
                          <div className="text-xs">
                            <span className="text-muted-foreground">Librerías:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {preset.libraries.actions?.map((a) => (
                                <Badge key={a.name} variant="secondary" className="text-[10px]">
                                  {a.prefix}{a.name}
                                </Badge>
                              ))}
                              {preset.libraries.poses?.map((p) => (
                                <Badge key={p.name} variant="secondary" className="text-[10px]">
                                  {p.prefix}{p.name}
                                </Badge>
                              ))}
                              {preset.libraries.clothes?.map((c) => (
                                <Badge key={c.name} variant="secondary" className="text-[10px]">
                                  {c.prefix}{c.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Packs preview */}
                        {preset.packs && preset.packs.length > 0 && (
                          <div className="text-xs">
                            <span className="text-muted-foreground">Packs: {preset.packs.length}</span>
                          </div>
                        )}
                        
                        <Button
                          size="sm"
                          className="w-full h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            onApplyPreset(preset);
                          }}
                          disabled={isApplied}
                        >
                          {isApplied ? 'Ya aplicado' : 'Aplicar Preset'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

// Helper to convert preset to actual data
export function presetToData(preset: PresetItem): {
  libraries: { actions: SpriteLibraryEntry[]; poses: SpriteLibraryEntry[]; clothes: SpriteLibraryEntry[] };
} {
  const libraries: { actions: SpriteLibraryEntry[]; poses: SpriteLibraryEntry[]; clothes: SpriteLibraryEntry[] } = {
    actions: [],
    poses: [],
    clothes: [],
  };

  // Convert libraries
  if (preset.libraries?.actions) {
    libraries.actions = preset.libraries.actions.map(a => ({
      id: uuidv4(),
      name: a.name,
      prefix: a.prefix,
    }));
  }
  if (preset.libraries?.poses) {
    libraries.poses = preset.libraries.poses.map(p => ({
      id: uuidv4(),
      name: p.name,
      prefix: p.prefix,
    }));
  }
  if (preset.libraries?.clothes) {
    libraries.clothes = preset.libraries.clothes.map(c => ({
      id: uuidv4(),
      name: c.name,
      prefix: c.prefix,
    }));
  }

  return { libraries };
}

export { PRESETS };
export type { PresetItem };
