'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { cn } from '@/lib/utils';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Play,
  Pause,
  Volume2,
  Image as ImageIcon,
  Timer,
  ArrowRight,
  GripVertical,
  Loop,
  AlertCircle,
} from 'lucide-react';
import type {
  SpriteChain,
  SpriteChainStep,
  SoundChain,
  SoundChainStep,
  SpritePackV2,
} from '@/types';
import { SpritePreview } from './sprite-preview';

// ============================================
// Types
// ============================================

export type ChainType = 'sprite' | 'sound';

interface BaseChainEditorProps {
  type: ChainType;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  disabled?: boolean;
}

interface SpriteChainEditorProps extends BaseChainEditorProps {
  type: 'sprite';
  chain: SpriteChain | undefined;
  onChange: (chain: SpriteChain | undefined) => void;
  spritePacks: SpritePackV2[];
}

interface SoundChainEditorProps extends BaseChainEditorProps {
  type: 'sound';
  chain: SoundChain | undefined;
  onChange: (chain: SoundChain | undefined) => void;
  soundTriggers?: Array<{ key: string; name: string }>;
}

type ChainEditorProps = SpriteChainEditorProps | SoundChainEditorProps;

// ============================================
// Sprite Chain Editor
// ============================================

interface SpriteChainStepEditorProps {
  step: SpriteChainStep;
  index: number;
  totalSteps: number;
  spritePacks: SpritePackV2[];
  onChange: (step: SpriteChainStep) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

function SpriteChainStepEditor({
  step,
  index,
  totalSteps,
  spritePacks,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: SpriteChainStepEditorProps) {
  // Get all sprites from all packs
  const allSprites = useMemo(() => {
    return spritePacks.flatMap(pack => 
      pack.sprites.map(sprite => ({
        ...sprite,
        packName: pack.name,
      }))
    );
  }, [spritePacks]);

  const selectedSprite = allSprites.find(s => s.id === step.spriteId);

  return (
    <div className="flex items-center gap-2 p-2 bg-background rounded border group">
      {/* Drag handle / index */}
      <div className="flex items-center gap-1 w-8 flex-shrink-0">
        <span className="text-xs text-muted-foreground font-mono">{index + 1}</span>
        <GripVertical className="w-3 h-3 text-muted-foreground/50" />
      </div>

      {/* Sprite preview */}
      <div className="w-10 h-10 rounded overflow-hidden bg-muted/50 flex-shrink-0">
        {selectedSprite ? (
          <SpritePreview
            src={selectedSprite.url}
            alt={selectedSprite.label}
            className="w-full h-full"
            objectFit="contain"
          />
        ) : (
          <ImageIcon className="w-5 h-5 m-auto text-muted-foreground" />
        )}
      </div>

      {/* Sprite selector */}
      <Select
        value={step.spriteId}
        onValueChange={(v) => onChange({ ...step, spriteId: v })}
      >
        <SelectTrigger className="h-9 flex-1">
          <SelectValue placeholder="Select sprite..." />
        </SelectTrigger>
        <SelectContent>
          {spritePacks.map(pack => (
            <div key={pack.id}>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                {pack.name}
              </div>
              {pack.sprites.map(sprite => (
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
                    <span>{sprite.label}</span>
                  </div>
                </SelectItem>
              ))}
            </div>
          ))}
        </SelectContent>
      </Select>

      {/* Duration */}
      <div className="flex items-center gap-1 w-28 flex-shrink-0">
        <Timer className="w-3 h-3 text-muted-foreground" />
        <Input
          type="number"
          value={step.durationMs}
          onChange={(e) => onChange({ ...step, durationMs: Math.max(0, parseInt(e.target.value) || 0) })}
          className="h-8 w-16 text-xs"
          placeholder="ms"
        />
        <span className="text-xs text-muted-foreground">ms</span>
      </div>

      {/* Transition */}
      <Select
        value={step.transition || 'none'}
        onValueChange={(v) => onChange({ ...step, transition: v as 'none' | 'fade' | 'slide' })}
      >
        <SelectTrigger className="h-8 w-20">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None</SelectItem>
          <SelectItem value="fade">Fade</SelectItem>
          <SelectItem value="slide">Slide</SelectItem>
        </SelectContent>
      </Select>

      {/* Actions */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 text-destructive opacity-0 group-hover:opacity-100"
        onClick={onDelete}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

// ============================================
// Sound Chain Step Editor
// ============================================

interface SoundChainStepEditorProps {
  step: SoundChainStep;
  index: number;
  onChange: (step: SoundChainStep) => void;
  onDelete: () => void;
  soundTriggers?: Array<{ key: string; name: string }>;
}

function SoundChainStepEditor({
  step,
  index,
  onChange,
  onDelete,
  soundTriggers = [],
}: SoundChainStepEditorProps) {
  return (
    <div className="flex items-center gap-2 p-2 bg-background rounded border group">
      {/* Index */}
      <div className="w-6 text-center flex-shrink-0">
        <span className="text-xs text-muted-foreground font-mono">{index + 1}</span>
      </div>

      {/* Sound trigger key */}
      <div className="flex-1">
        {soundTriggers.length > 0 ? (
          <Select
            value={step.soundTriggerKey}
            onValueChange={(v) => onChange({ ...step, soundTriggerKey: v })}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Select sound trigger..." />
            </SelectTrigger>
            <SelectContent>
              {soundTriggers.map(trigger => (
                <SelectItem key={trigger.key} value={trigger.key}>
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-3 h-3" />
                    <span>{trigger.name}</span>
                    <code className="text-xs text-muted-foreground">[{trigger.key}]</code>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={step.soundTriggerKey}
            onChange={(e) => onChange({ ...step, soundTriggerKey: e.target.value })}
            placeholder="Sound trigger key..."
            className="h-8"
          />
        )}
      </div>

      {/* Or direct URL */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span>or</span>
        <Input
          value={step.soundUrl || ''}
          onChange={(e) => onChange({ ...step, soundUrl: e.target.value || undefined })}
          placeholder="URL"
          className="h-8 w-32"
        />
      </div>

      {/* Delay */}
      <div className="flex items-center gap-1 w-24 flex-shrink-0">
        <Timer className="w-3 h-3 text-muted-foreground" />
        <Input
          type="number"
          value={step.delayMs}
          onChange={(e) => onChange({ ...step, delayMs: Math.max(0, parseInt(e.target.value) || 0) })}
          className="h-8 w-14 text-xs"
          placeholder="ms"
        />
        <span className="text-xs text-muted-foreground">ms</span>
      </div>

      {/* Volume */}
      <div className="flex items-center gap-1 w-20 flex-shrink-0">
        <Volume2 className="w-3 h-3 text-muted-foreground" />
        <Input
          type="number"
          value={step.volume ?? 1}
          onChange={(e) => onChange({ ...step, volume: Math.min(1, Math.max(0, parseFloat(e.target.value) || 1)) })}
          className="h-8 w-12 text-xs"
          placeholder="0-1"
          step="0.1"
          min="0"
          max="1"
        />
      </div>

      {/* Delete */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 text-destructive opacity-0 group-hover:opacity-100"
        onClick={onDelete}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

// ============================================
// Main Chain Editor Component
// ============================================

export function ChainEditor(props: ChainEditorProps) {
  const { type, enabled, onEnabledChange, disabled } = props;
  const [isOpen, setIsOpen] = useState(false);

  // Get chain-specific props
  const chain = props.chain;
  const onChange = props.onChange;

  // Format time
  const formatTime = (ms: number) => {
    if (ms <= 0) return '0s';
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  // Calculate total duration
  const totalDuration = useMemo(() => {
    if (!chain) return 0;
    if (type === 'sprite') {
      return (chain as SpriteChain).steps.reduce((sum, s) => sum + s.durationMs, 0);
    } else {
      return (chain as SoundChain).steps.reduce((sum, s) => sum + s.delayMs, 0);
    }
  }, [chain, type]);

  // Icon and colors based on type
  const Icon = type === 'sprite' ? Play : Volume2;
  const iconColor = type === 'sprite' ? 'text-purple-500' : 'text-green-500';
  const borderColor = type === 'sprite' ? 'border-purple-500/20' : 'border-green-500/20';
  const bgColor = type === 'sprite' ? 'bg-purple-500/5' : 'bg-green-500/5';

  // Create default chain
  const createDefaultChain = (): SpriteChain | SoundChain => {
    if (type === 'sprite') {
      return {
        enabled: true,
        steps: [],
        loop: false,
        interruptible: true,
      };
    } else {
      return {
        enabled: true,
        steps: [],
        stopOnInterrupt: true,
      };
    }
  };

  // Add step
  const handleAddStep = () => {
    if (!chain) {
      onChange(createDefaultChain());
      return;
    }

    if (type === 'sprite') {
      const newStep: SpriteChainStep = {
        spriteId: (props as SpriteChainEditorProps).spritePacks[0]?.sprites[0]?.id || '',
        durationMs: 1000,
        transition: 'none',
      };
      onChange({
        ...(chain as SpriteChain),
        steps: [...(chain as SpriteChain).steps, newStep],
      });
    } else {
      const newStep: SoundChainStep = {
        soundTriggerKey: '',
        delayMs: 0,
        volume: 1,
      };
      onChange({
        ...(chain as SoundChain),
        steps: [...(chain as SoundChain).steps, newStep],
      });
    }
  };

  // Update step
  const handleUpdateStep = (index: number, step: SpriteChainStep | SoundChainStep) => {
    if (!chain) return;
    
    if (type === 'sprite') {
      const newSteps = [...(chain as SpriteChain).steps];
      newSteps[index] = step as SpriteChainStep;
      onChange({ ...(chain as SpriteChain), steps: newSteps });
    } else {
      const newSteps = [...(chain as SoundChain).steps];
      newSteps[index] = step as SoundChainStep;
      onChange({ ...(chain as SoundChain), steps: newSteps });
    }
  };

  // Delete step
  const handleDeleteStep = (index: number) => {
    if (!chain) return;
    
    if (type === 'sprite') {
      const newSteps = (chain as SpriteChain).steps.filter((_, i) => i !== index);
      onChange({ ...(chain as SpriteChain), steps: newSteps });
    } else {
      const newSteps = (chain as SoundChain).steps.filter((_, i) => i !== index);
      onChange({ ...(chain as SoundChain), steps: newSteps });
    }
  };

  // Update chain property
  const updateChainProperty = <K extends keyof SpriteChain | keyof SoundChain>(
    key: K,
    value: unknown
  ) => {
    if (!chain) return;
    onChange({ ...chain, [key]: value });
  };

  const steps = chain?.steps || [];
  const stepCount = steps.length;

  return (
    <div className={cn('rounded-lg border', borderColor, bgColor)}>
      {/* Header */}
      <div className="flex items-center justify-between p-3">
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
          <CollapsibleTrigger className="flex items-center gap-2 w-full">
            <div className="flex items-center gap-2 flex-1">
              {isOpen ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
              <Icon className={cn('w-4 h-4', iconColor)} />
              <span className="text-sm font-medium">
                {type === 'sprite' ? 'Sprite Chain' : 'Sound Chain'}
              </span>
              {enabled && stepCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {stepCount} step{stepCount !== 1 ? 's' : ''}
                </Badge>
              )}
              {enabled && stepCount > 0 && totalDuration > 0 && (
                <Badge variant="outline" className="text-xs">
                  {formatTime(totalDuration)}
                </Badge>
              )}
            </div>
          </CollapsibleTrigger>
        </Collapsible>

        <Switch
          checked={enabled}
          onCheckedChange={onEnabledChange}
          disabled={disabled}
        />
      </div>

      {/* Content */}
      {enabled && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleContent>
            <div className="px-3 pb-3 pt-0 space-y-3">
              {/* Description */}
              <p className="text-xs text-muted-foreground">
                {type === 'sprite' 
                  ? 'Secuencia de sprites que se reproducen en lugar de un tiempo de espera fijo.'
                  : 'Secuencia de sonidos que se reproducen cuando se activa el trigger.'}
              </p>

              {/* Chain-specific options */}
              <div className="grid grid-cols-2 gap-3">
                {type === 'sprite' ? (
                  <>
                    <div className="flex items-center justify-between p-2 bg-background/50 rounded border">
                      <div>
                        <Label className="text-xs font-medium flex items-center gap-1">
                          <Loop className="w-3 h-3" />
                          Loop
                        </Label>
                        <p className="text-[10px] text-muted-foreground">
                          Repetir la secuencia
                        </p>
                      </div>
                      <Switch
                        checked={(chain as SpriteChain)?.loop ?? false}
                        onCheckedChange={(v) => updateChainProperty('loop', v)}
                      />
                    </div>
                    <div className="flex items-center justify-between p-2 bg-background/50 rounded border">
                      <div>
                        <Label className="text-xs font-medium flex items-center gap-1">
                          <Pause className="w-3 h-3" />
                          Interrumpible
                        </Label>
                        <p className="text-[10px] text-muted-foreground">
                          Permite cortar con nuevo trigger
                        </p>
                      </div>
                      <Switch
                        checked={(chain as SpriteChain)?.interruptible ?? true}
                        onCheckedChange={(v) => updateChainProperty('interruptible', v)}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between p-2 bg-background/50 rounded border col-span-2">
                      <div>
                        <Label className="text-xs font-medium flex items-center gap-1">
                          <Pause className="w-3 h-3" />
                          Detener al interrumpir
                        </Label>
                        <p className="text-[10px] text-muted-foreground">
                          Detener sonidos si el trigger es interrumpido
                        </p>
                      </div>
                      <Switch
                        checked={(chain as SoundChain)?.stopOnInterrupt ?? true}
                        onCheckedChange={(v) => updateChainProperty('stopOnInterrupt', v)}
                      />
                    </div>
                    <div className="flex items-center justify-between p-2 bg-background/50 rounded border">
                      <div>
                        <Label className="text-xs font-medium">Overlap</Label>
                        <p className="text-[10px] text-muted-foreground">
                          Permitir superponer sonidos
                        </p>
                      </div>
                      <Switch
                        checked={(chain as SoundChain)?.overlap ?? false}
                        onCheckedChange={(v) => updateChainProperty('overlap', v)}
                      />
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-background/50 rounded border">
                      <Label className="text-xs font-medium">Volumen global</Label>
                      <Input
                        type="number"
                        value={(chain as SoundChain)?.volume ?? 1}
                        onChange={(e) => updateChainProperty('volume', parseFloat(e.target.value) || 1)}
                        className="h-7 w-16"
                        min="0"
                        max="1"
                        step="0.1"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Steps */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Pasos ({stepCount})</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleAddStep}
                    disabled={disabled}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Agregar
                  </Button>
                </div>

                {stepCount === 0 ? (
                  <div className="text-center py-4 text-muted-foreground text-xs border rounded bg-background/50">
                    {type === 'sprite' ? (
                      <>
                        <Play className="w-6 h-6 mx-auto mb-1 opacity-30" />
                        <p>No hay pasos definidos</p>
                        <p className="text-[10px]">Agrega sprites para crear una secuencia animada</p>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-6 h-6 mx-auto mb-1 opacity-30" />
                        <p>No hay sonidos definidos</p>
                        <p className="text-[10px]">Agrega sonidos para crear una secuencia de audio</p>
                      </>
                    )}
                  </div>
                ) : (
                  <ScrollArea className="h-40">
                    <div className="space-y-1 pr-2">
                      {type === 'sprite' ? (
                        (steps as SpriteChainStep[]).map((step, index) => (
                          <SpriteChainStepEditor
                            key={index}
                            step={step}
                            index={index}
                            totalSteps={stepCount}
                            spritePacks={(props as SpriteChainEditorProps).spritePacks}
                            onChange={(s) => handleUpdateStep(index, s)}
                            onDelete={() => handleDeleteStep(index)}
                          />
                        ))
                      ) : (
                        (steps as SoundChainStep[]).map((step, index) => (
                          <SoundChainStepEditor
                            key={index}
                            step={step}
                            index={index}
                            onChange={(s) => handleUpdateStep(index, s)}
                            onDelete={() => handleDeleteStep(index)}
                            soundTriggers={(props as SoundChainEditorProps).soundTriggers}
                          />
                        ))
                      )}
                    </div>
                  </ScrollArea>
                )}
              </div>

              {/* Preview info */}
              {stepCount > 0 && type === 'sprite' && (chain as SpriteChain).loop && (
                <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-600">
                  <AlertCircle className="w-3 h-3" />
                  <span>La secuencia se repetirá infinitamente hasta ser interrumpida</span>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

// ============================================
// Exports
// ============================================

export default ChainEditor;
