'use client';

import { useState, Fragment } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  Plus,
  Trash2,
  GripVertical,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Sword,
  Target,
  Mail,
  Settings2,
  AlertCircle,
  Info,
  Zap,
  CaseSensitive,
  Minus,
  Coins,
  Gift,
  X,
  Inbox,
} from 'lucide-react';
import type {
  CharacterStatsConfig,
  AttributeDefinition,
  SkillDefinition,
  IntentionDefinition,
  InvitationDefinition,
  SolicitudDefinition,
  StatRequirement,
  AttributeType,
  RequirementOperator,
  ActivationCost,
  CostOperator,
  QuestReward,
  TriggerCategory,
  TriggerTargetMode,
  ActionType,
  ObjectiveDropdownOption,
  QuestTemplate,
} from '@/types';
import { DEFAULT_STATS_BLOCK_HEADERS, DEFAULT_STATS_CONFIG } from '@/types';
import {
  createTriggerReward,
  createObjectiveReward,
  createSolicitudReward,
  describeReward,
  normalizeReward,
} from '@/lib/quest/quest-reward-utils';

interface StatsEditorProps {
  statsConfig: CharacterStatsConfig | undefined;
  onChange: (statsConfig: CharacterStatsConfig) => void;
  allCharacters?: { id: string; name: string; solicitudDefinitions: SolicitudDefinition[] }[];
  questTemplates?: QuestTemplate[];
  questTemplateIds?: string[];  // IDs de plantillas asignadas al personaje
}

// ============================================
// Attribute Editor Component (Accordion Style)
// ============================================

interface AttributeEditorProps {
  attribute: AttributeDefinition;
  index: number;
  onChange: (index: number, updates: Partial<AttributeDefinition>) => void;
  onDelete: (index: number) => void;
  allAttributes: AttributeDefinition[];
}

function AttributeEditor({ attribute, index, onChange, onDelete, allAttributes }: AttributeEditorProps) {
  const [expanded, setExpanded] = useState(false);
  
  // Get display info
  const displayIcon = attribute.icon || (attribute.type === 'number' ? '🔢' : attribute.type === 'keyword' ? '🏷️' : '📝');
  const displayValue = attribute.defaultValue?.toString() || '0';
  
  return (
    <div className="border rounded-lg bg-muted/30">
      {/* Header - Clickable */}
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
          <span className="text-lg">{displayIcon}</span>
          <span className="font-medium text-sm">
            {attribute.name || `Atributo #${index + 1}`}
          </span>
          {attribute.key && (
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
              {'{{' + attribute.key + '}}'}
            </code>
          )}
          <Badge variant="outline" className="text-xs capitalize">
            {attribute.type === 'number' ? 'Número' : attribute.type === 'keyword' ? 'Estado' : 'Texto'}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-2">
            {attribute.type === 'number' ? `${displayValue}` : displayValue.slice(0, 15)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); onDelete(index); }}
          >
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </Button>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>
      
      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t">
          {/* Basic Info */}
          <div className="pt-3 grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Label className="text-xs">Nombre *</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Nombre visible del atributo. Ejemplo: "Vida", "Maná", "Resistencia"</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                value={attribute.name}
                onChange={(e) => onChange(index, { name: e.target.value })}
                placeholder="Vida, Maná, Resistencia..."
                className="h-8"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Label className="text-xs">Key *</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Identificador único para usar en templates. Se convierte automáticamente a minúsculas y guiones bajos.</p>
                    <p className="mt-1 text-xs text-muted-foreground">Uso: {'{{vida}}'} en cualquier sección del personaje</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                value={attribute.key}
                onChange={(e) => onChange(index, { key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                placeholder="vida, mana, resistencia..."
                className="h-8 font-mono text-xs"
              />
            </div>
          </div>
          
          {/* Type Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Label className="text-xs">Tipo de atributo</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="font-medium">Número:</p>
                    <p className="text-xs text-muted-foreground">Valores numéricos con min/max. Ej: Vida (0-100)</p>
                    <p className="font-medium mt-2">Estado:</p>
                    <p className="text-xs text-muted-foreground">Valores de texto que representan estados. Ej: "enojado", "feliz", "neutral"</p>
                    <p className="font-medium mt-2">Texto:</p>
                    <p className="text-xs text-muted-foreground">Texto libre sin restricciones. Ej: Notas, descripciones</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Select
                value={attribute.type}
                onValueChange={(value: AttributeType) => onChange(index, { type: value })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="number">
                    <div className="flex items-center gap-2">
                      <span>🔢</span>
                      <span>Número</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="keyword">
                    <div className="flex items-center gap-2">
                      <span>🏷️</span>
                      <span>Estado</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="text">
                    <div className="flex items-center gap-2">
                      <span>📝</span>
                      <span>Texto</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Valor por defecto</Label>
              <Input
                type={attribute.type === 'number' ? 'number' : 'text'}
                value={attribute.defaultValue}
                onChange={(e) => onChange(index, { 
                  defaultValue: attribute.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value 
                })}
                className="h-8"
              />
            </div>
          </div>
          
          {/* Number-specific: Min/Max */}
          {attribute.type === 'number' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Valor mínimo</Label>
                <Input
                  type="number"
                  value={attribute.min ?? ''}
                  onChange={(e) => {
                    const parsed = parseFloat(e.target.value);
                    onChange(index, { min: isNaN(parsed) ? undefined : parsed });
                  }}
                  placeholder="0"
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Valor máximo</Label>
                <Input
                  type="number"
                  value={attribute.max ?? ''}
                  onChange={(e) => {
                    const parsed = parseFloat(e.target.value);
                    onChange(index, { max: isNaN(parsed) ? undefined : parsed });
                  }}
                  placeholder="100"
                  className="h-8"
                />
              </div>
            </div>
          )}

          {/* Threshold Effects - Efectos al alcanzar min/max */}
          {attribute.type === 'number' && (attribute.min !== undefined || attribute.max !== undefined) && (
            <div className="space-y-3 p-3 bg-purple-500/5 rounded-lg border border-purple-500/20">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <Label className="text-xs font-medium text-purple-400">Efectos de Umbral</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Efectos que se ejecutan cuando el atributo alcanza su valor mínimo o máximo.</p>
                    <p className="mt-1 text-xs text-muted-foreground">• Triggers: Sprites, sonidos, fondos</p>
                    <p className="text-xs text-muted-foreground">• Atributos: Modificar otros atributos</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* On Min Reached */}
              {attribute.min !== undefined && (
                <div className="space-y-2 p-2 bg-red-500/5 rounded border border-red-500/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={attribute.onMinReached?.enabled ?? false}
                        onCheckedChange={(checked) => onChange(index, {
                          onMinReached: {
                            enabled: checked,
                            rewards: attribute.onMinReached?.rewards || []
                          }
                        })}
                      />
                      <Label className="text-xs font-medium text-red-400">
                        Al llegar al mínimo ({attribute.min})
                      </Label>
                    </div>
                    {attribute.onMinReached?.enabled && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-5 text-[10px] border-purple-500/30 hover:bg-purple-500/10"
                        onClick={() => {
                          const newReward = {
                            id: `attr-min-reward-${Date.now().toString(36)}`,
                            type: 'trigger' as const,
                            trigger: {
                              category: 'sprite' as const,
                              key: '',
                              targetMode: 'self' as const,
                            }
                          };
                          onChange(index, {
                            onMinReached: {
                              enabled: true,
                              rewards: [...(attribute.onMinReached?.rewards || []), newReward]
                            }
                          });
                        }}
                      >
                        <Plus className="w-2.5 h-2.5 mr-0.5" /> Efecto
                      </Button>
                    )}
                  </div>

                  {attribute.onMinReached?.enabled && (
                    <div className="space-y-1">
                      {(attribute.onMinReached?.rewards || []).map((reward, rewardIdx) => {
                        const normalized = normalizeReward(reward);
                        const isTrig = normalized.type === 'trigger';
                        const isAttr = normalized.type === 'attribute';

                        return (
                          <div key={reward.id} className={`p-1.5 rounded border ${isAttr ? 'bg-amber-500/5 border-amber-500/10' : 'bg-purple-500/5 border-purple-500/10'}`}>
                            <div className="flex items-center gap-1.5 mb-1">
                              <Badge variant="outline" className={`text-[9px] ${isAttr ? 'text-amber-400 border-amber-500/30' : 'text-purple-400 border-purple-500/30'}`}>
                                {isAttr ? '📊 Atributo' : '⚡ Trigger'}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-4 w-4 p-0 text-red-500 hover:bg-red-500/10 ml-auto"
                                onClick={() => {
                                  const updatedRewards = (attribute.onMinReached?.rewards || []).filter((_, i) => i !== rewardIdx);
                                  onChange(index, {
                                    onMinReached: {
                                      enabled: true,
                                      rewards: updatedRewards
                                    }
                                  });
                                }}
                              >
                                <X className="w-2.5 h-2.5" />
                              </Button>
                            </div>

                            {isTrig && normalized.trigger && (
                              <div className="grid grid-cols-3 gap-1">
                                <Select
                                  value={normalized.trigger.category}
                                  onValueChange={(v) => {
                                    const updatedRewards = [...(attribute.onMinReached?.rewards || [])];
                                    updatedRewards[rewardIdx] = {
                                      ...reward,
                                      trigger: { ...normalized.trigger!, category: v as TriggerCategory }
                                    };
                                    onChange(index, {
                                      onMinReached: { enabled: true, rewards: updatedRewards }
                                    });
                                  }}
                                >
                                  <SelectTrigger className="bg-background h-5 text-[10px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="sprite">🖼️ Sprite</SelectItem>
                                    <SelectItem value="sound">🔊 Sonido</SelectItem>
                                    <SelectItem value="background">🌄 Fondo</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Input
                                  value={normalized.trigger.key}
                                  onChange={(e) => {
                                    const updatedRewards = [...(attribute.onMinReached?.rewards || [])];
                                    updatedRewards[rewardIdx] = {
                                      ...reward,
                                      trigger: { ...normalized.trigger!, key: e.target.value }
                                    };
                                    onChange(index, {
                                      onMinReached: { enabled: true, rewards: updatedRewards }
                                    });
                                  }}
                                  placeholder="Key"
                                  className="bg-background h-5 text-[10px]"
                                />
                                <Select
                                  value={normalized.trigger.targetMode}
                                  onValueChange={(v) => {
                                    const updatedRewards = [...(attribute.onMinReached?.rewards || [])];
                                    updatedRewards[rewardIdx] = {
                                      ...reward,
                                      trigger: { ...normalized.trigger!, targetMode: v as TriggerTargetMode }
                                    };
                                    onChange(index, {
                                      onMinReached: { enabled: true, rewards: updatedRewards }
                                    });
                                  }}
                                >
                                  <SelectTrigger className="bg-background h-5 text-[10px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="self">👤 Self</SelectItem>
                                    <SelectItem value="all">👥 Todos</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            {isAttr && normalized.attribute && (
                              <div className="grid grid-cols-3 gap-1">
                                <Select
                                  value={normalized.attribute.key}
                                  onValueChange={(v) => {
                                    const updatedRewards = [...(attribute.onMinReached?.rewards || [])];
                                    updatedRewards[rewardIdx] = {
                                      ...reward,
                                      attribute: { ...normalized.attribute!, key: v }
                                    };
                                    onChange(index, {
                                      onMinReached: { enabled: true, rewards: updatedRewards }
                                    });
                                  }}
                                >
                                  <SelectTrigger className="bg-background h-5 text-[10px]">
                                    <SelectValue placeholder="Atributo" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {allAttributes.map((attr) => (
                                      <SelectItem key={attr.key} value={attr.key}>
                                        {attr.name} ({attr.key})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Select
                                  value={normalized.attribute.action}
                                  onValueChange={(v) => {
                                    const updatedRewards = [...(attribute.onMinReached?.rewards || [])];
                                    updatedRewards[rewardIdx] = {
                                      ...reward,
                                      attribute: { ...normalized.attribute!, action: v as any }
                                    };
                                    onChange(index, {
                                      onMinReached: { enabled: true, rewards: updatedRewards }
                                    });
                                  }}
                                >
                                  <SelectTrigger className="bg-background h-5 text-[10px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="set">= Set</SelectItem>
                                    <SelectItem value="add">+ Add</SelectItem>
                                    <SelectItem value="subtract">- Sub</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Input
                                  type="number"
                                  value={normalized.attribute.value}
                                  onChange={(e) => {
                                    const updatedRewards = [...(attribute.onMinReached?.rewards || [])];
                                    updatedRewards[rewardIdx] = {
                                      ...reward,
                                      attribute: { ...normalized.attribute!, value: Number(e.target.value) }
                                    };
                                    onChange(index, {
                                      onMinReached: { enabled: true, rewards: updatedRewards }
                                    });
                                  }}
                                  placeholder="Valor"
                                  className="bg-background h-5 text-[10px]"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Add attribute reward button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-full text-[10px] text-amber-400 hover:bg-amber-500/10 border border-dashed border-amber-500/30"
                        onClick={() => {
                          const newReward = {
                            id: `attr-min-reward-${Date.now().toString(36)}`,
                            type: 'attribute' as const,
                            attribute: {
                              key: '',
                              value: 0,
                              action: 'set' as const
                            }
                          };
                          onChange(index, {
                            onMinReached: {
                              enabled: true,
                              rewards: [...(attribute.onMinReached?.rewards || []), newReward]
                            }
                          });
                        }}
                      >
                        <Plus className="w-2.5 h-2.5 mr-0.5" /> Atributo
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* On Max Reached */}
              {attribute.max !== undefined && (
                <div className="space-y-2 p-2 bg-green-500/5 rounded border border-green-500/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={attribute.onMaxReached?.enabled ?? false}
                        onCheckedChange={(checked) => onChange(index, {
                          onMaxReached: {
                            enabled: checked,
                            rewards: attribute.onMaxReached?.rewards || []
                          }
                        })}
                      />
                      <Label className="text-xs font-medium text-green-400">
                        Al llegar al máximo ({attribute.max})
                      </Label>
                    </div>
                    {attribute.onMaxReached?.enabled && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-5 text-[10px] border-purple-500/30 hover:bg-purple-500/10"
                        onClick={() => {
                          const newReward = {
                            id: `attr-max-reward-${Date.now().toString(36)}`,
                            type: 'trigger' as const,
                            trigger: {
                              category: 'sprite' as const,
                              key: '',
                              targetMode: 'self' as const,
                            }
                          };
                          onChange(index, {
                            onMaxReached: {
                              enabled: true,
                              rewards: [...(attribute.onMaxReached?.rewards || []), newReward]
                            }
                          });
                        }}
                      >
                        <Plus className="w-2.5 h-2.5 mr-0.5" /> Efecto
                      </Button>
                    )}
                  </div>

                  {attribute.onMaxReached?.enabled && (
                    <div className="space-y-1">
                      {(attribute.onMaxReached?.rewards || []).map((reward, rewardIdx) => {
                        const normalized = normalizeReward(reward);
                        const isTrig = normalized.type === 'trigger';
                        const isAttr = normalized.type === 'attribute';

                        return (
                          <div key={reward.id} className={`p-1.5 rounded border ${isAttr ? 'bg-amber-500/5 border-amber-500/10' : 'bg-green-500/5 border-green-500/10'}`}>
                            <div className="flex items-center gap-1.5 mb-1">
                              <Badge variant="outline" className={`text-[9px] ${isAttr ? 'text-amber-400 border-amber-500/30' : 'text-green-400 border-green-500/30'}`}>
                                {isAttr ? '📊 Atributo' : '⚡ Trigger'}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-4 w-4 p-0 text-red-500 hover:bg-red-500/10 ml-auto"
                                onClick={() => {
                                  const updatedRewards = (attribute.onMaxReached?.rewards || []).filter((_, i) => i !== rewardIdx);
                                  onChange(index, {
                                    onMaxReached: {
                                      enabled: true,
                                      rewards: updatedRewards
                                    }
                                  });
                                }}
                              >
                                <X className="w-2.5 h-2.5" />
                              </Button>
                            </div>

                            {isTrig && normalized.trigger && (
                              <div className="grid grid-cols-3 gap-1">
                                <Select
                                  value={normalized.trigger.category}
                                  onValueChange={(v) => {
                                    const updatedRewards = [...(attribute.onMaxReached?.rewards || [])];
                                    updatedRewards[rewardIdx] = {
                                      ...reward,
                                      trigger: { ...normalized.trigger!, category: v as TriggerCategory }
                                    };
                                    onChange(index, {
                                      onMaxReached: { enabled: true, rewards: updatedRewards }
                                    });
                                  }}
                                >
                                  <SelectTrigger className="bg-background h-5 text-[10px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="sprite">🖼️ Sprite</SelectItem>
                                    <SelectItem value="sound">🔊 Sonido</SelectItem>
                                    <SelectItem value="background">🌄 Fondo</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Input
                                  value={normalized.trigger.key}
                                  onChange={(e) => {
                                    const updatedRewards = [...(attribute.onMaxReached?.rewards || [])];
                                    updatedRewards[rewardIdx] = {
                                      ...reward,
                                      trigger: { ...normalized.trigger!, key: e.target.value }
                                    };
                                    onChange(index, {
                                      onMaxReached: { enabled: true, rewards: updatedRewards }
                                    });
                                  }}
                                  placeholder="Key"
                                  className="bg-background h-5 text-[10px]"
                                />
                                <Select
                                  value={normalized.trigger.targetMode}
                                  onValueChange={(v) => {
                                    const updatedRewards = [...(attribute.onMaxReached?.rewards || [])];
                                    updatedRewards[rewardIdx] = {
                                      ...reward,
                                      trigger: { ...normalized.trigger!, targetMode: v as TriggerTargetMode }
                                    };
                                    onChange(index, {
                                      onMaxReached: { enabled: true, rewards: updatedRewards }
                                    });
                                  }}
                                >
                                  <SelectTrigger className="bg-background h-5 text-[10px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="self">👤 Self</SelectItem>
                                    <SelectItem value="all">👥 Todos</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            {isAttr && normalized.attribute && (
                              <div className="grid grid-cols-3 gap-1">
                                <Select
                                  value={normalized.attribute.key}
                                  onValueChange={(v) => {
                                    const updatedRewards = [...(attribute.onMaxReached?.rewards || [])];
                                    updatedRewards[rewardIdx] = {
                                      ...reward,
                                      attribute: { ...normalized.attribute!, key: v }
                                    };
                                    onChange(index, {
                                      onMaxReached: { enabled: true, rewards: updatedRewards }
                                    });
                                  }}
                                >
                                  <SelectTrigger className="bg-background h-5 text-[10px]">
                                    <SelectValue placeholder="Atributo" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {allAttributes.map((attr) => (
                                      <SelectItem key={attr.key} value={attr.key}>
                                        {attr.name} ({attr.key})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Select
                                  value={normalized.attribute.action}
                                  onValueChange={(v) => {
                                    const updatedRewards = [...(attribute.onMaxReached?.rewards || [])];
                                    updatedRewards[rewardIdx] = {
                                      ...reward,
                                      attribute: { ...normalized.attribute!, action: v as any }
                                    };
                                    onChange(index, {
                                      onMaxReached: { enabled: true, rewards: updatedRewards }
                                    });
                                  }}
                                >
                                  <SelectTrigger className="bg-background h-5 text-[10px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="set">= Set</SelectItem>
                                    <SelectItem value="add">+ Add</SelectItem>
                                    <SelectItem value="subtract">- Sub</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Input
                                  type="number"
                                  value={normalized.attribute.value}
                                  onChange={(e) => {
                                    const updatedRewards = [...(attribute.onMaxReached?.rewards || [])];
                                    updatedRewards[rewardIdx] = {
                                      ...reward,
                                      attribute: { ...normalized.attribute!, value: Number(e.target.value) }
                                    };
                                    onChange(index, {
                                      onMaxReached: { enabled: true, rewards: updatedRewards }
                                    });
                                  }}
                                  placeholder="Valor"
                                  className="bg-background h-5 text-[10px]"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Add attribute reward button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-full text-[10px] text-amber-400 hover:bg-amber-500/10 border border-dashed border-amber-500/30"
                        onClick={() => {
                          const newReward = {
                            id: `attr-max-reward-${Date.now().toString(36)}`,
                            type: 'attribute' as const,
                            attribute: {
                              key: '',
                              value: 0,
                              action: 'set' as const
                            }
                          };
                          onChange(index, {
                            onMaxReached: {
                              enabled: true,
                              rewards: [...(attribute.onMaxReached?.rewards || []), newReward]
                            }
                          });
                        }}
                      >
                        <Plus className="w-2.5 h-2.5 mr-0.5" /> Atributo
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Detection Keys (Post-LLM) - Similar to HUD Field System */}
          <div className="space-y-3 p-3 bg-muted/50 rounded-lg border">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <Label className="text-xs font-medium">Detección automática (Post-LLM)</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <p>Cuando el LLM escriba estas keys en su respuesta, el valor se actualizará automáticamente.</p>
                  <p className="mt-1 text-xs text-muted-foreground">El sistema detecta: key=valor, key: valor, [key=valor]</p>
                </TooltipContent>
              </Tooltip>
            </div>
            
            {/* Primary Key Display */}
            <div className="flex items-center gap-2 p-2 bg-amber-500/10 rounded border border-amber-500/20">
              <span className="text-xs text-muted-foreground">Key principal:</span>
              <code className="text-xs bg-background px-2 py-0.5 rounded font-mono">
                {attribute.key || '(sin key)'}
              </code>
              <span className="text-[10px] text-muted-foreground">
                (siempre detectada)
              </span>
            </div>
            
            {/* Alternative Keys */}
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Label className="text-xs">Keys alternativas</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Keys adicionales que también actualizarán este atributo.</p>
                    <p className="mt-1 text-xs text-muted-foreground">Ejemplo: HP, hp, ❤️ detectará "HP: 50", "hp=30", "❤️ 100"</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex gap-2">
                <Input
                  value={(attribute.keys || []).join(', ')}
                  onChange={(e) => {
                    const keys = e.target.value.split(',').map(k => k.trim()).filter(Boolean);
                    onChange(index, { keys: keys.length > 0 ? keys : undefined });
                  }}
                  placeholder="HP, hp, ❤️ (separar con comas)"
                  className="h-8 flex-1"
                />
              </div>
              {/* Show detected keys preview */}
              {((attribute.keys?.length || 0) > 0 || attribute.key) && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {[attribute.key, ...(attribute.keys || [])].filter(Boolean).map((key, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] font-mono">
                      {key}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            
            {/* Case Sensitivity */}
            <div className="flex items-center gap-2">
              <Switch
                checked={attribute.caseSensitive ?? false}
                onCheckedChange={(checked) => onChange(index, { caseSensitive: checked })}
              />
              <Label className="text-xs flex items-center gap-1">
                <CaseSensitive className="w-3 h-3" />
                Distinguir mayúsculas/minúsculas
              </Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Si está desactivado (por defecto), "HP: 50" y "hp: 50" serán equivalentes.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            
            {/* Detection Examples */}
            <div className="text-[10px] text-muted-foreground space-y-1 p-2 bg-background/50 rounded">
              <p className="font-medium text-foreground/70">Formatos detectados:</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                <p>• <code>[Vida=50]</code></p>
                <p>• <code>Vida: 50</code></p>
                <p>• <code>HP=50</code></p>
                <p>• <code>hp: 50</code></p>
              </div>
            </div>
          </div>
          
          {/* Output Format */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Label className="text-xs">Formato de salida</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Cómo se mostrará el valor cuando uses {'{{' + attribute.key + '}}'} en el prompt.</p>
                  <p className="mt-1 text-xs text-muted-foreground">Usa {'{value}'} como placeholder para el valor actual.</p>
                  <p className="mt-1 text-xs">{`Ejemplo: "Vida: {value}" → "Vida: 50"`}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              value={attribute.outputFormat || ''}
              onChange={(e) => onChange(index, { outputFormat: e.target.value || undefined })}
              placeholder={attribute.type === 'number' ? "Vida: {value}" : "Estado: {value}"}
              className="h-8"
            />
            {attribute.outputFormat && (
              <p className="text-xs text-muted-foreground">
                Vista previa: <code className="bg-muted px-1 rounded">{attribute.outputFormat.replace('{value}', String(attribute.defaultValue || '0'))}</code>
              </p>
            )}
          </div>
          
          {/* UI Settings */}
          <div className="flex items-center gap-4 pt-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Icono</Label>
              <Input
                value={attribute.icon || ''}
                onChange={(e) => onChange(index, { icon: e.target.value || undefined })}
                placeholder="❤️"
                className="h-8 w-16 text-center"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Color</Label>
              <Input
                value={attribute.color || ''}
                onChange={(e) => onChange(index, { color: e.target.value || undefined })}
                placeholder="red"
                className="h-8 w-20"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={attribute.showInHUD ?? true}
                onCheckedChange={(checked) => onChange(index, { showInHUD: checked })}
              />
              <Label className="text-xs">Mostrar en HUD</Label>
            </div>
          </div>
          
          {/* HUD Customization */}
          {attribute.showInHUD !== false && (
            <div className="p-3 bg-muted/30 rounded-lg border border-border/40 space-y-3">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-cyan-500" />
                <Label className="text-xs font-medium">Personalización del HUD</Label>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {/* HUD Style */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Estilo visual</Label>
                  <Select
                    value={attribute.hudStyle || 'default'}
                    onValueChange={(value) => onChange(index, { hudStyle: value as any })}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">📝 Por defecto</SelectItem>
                      <SelectItem value="progress">📊 Barra progreso</SelectItem>
                      <SelectItem value="badge">🏷️ Badge</SelectItem>
                      <SelectItem value="gauge">⭕ Gauge circular</SelectItem>
                      <SelectItem value="pill">💊 Píldora</SelectItem>
                      <SelectItem value="status">🟢 Estado</SelectItem>
                      <SelectItem value="dots">••• Puntos</SelectItem>
                      <SelectItem value="meter">📈 Medidor vertical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* HUD Unit */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Unidad</Label>
                  <Input
                    value={attribute.hudUnit || ''}
                    onChange={(e) => onChange(index, { hudUnit: e.target.value || undefined })}
                    placeholder="%, pts, ❤️"
                    className="h-8"
                  />
                </div>
              </div>
              
              {/* Preview */}
              <div className="mt-2 p-2 bg-slate-900/50 rounded border border-white/10">
                <p className="text-[10px] text-muted-foreground mb-1">Vista previa:</p>
                <AttributeHUDPreview attribute={attribute} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Attribute HUD Preview Component
// ============================================

interface AttributeHUDPreviewProps {
  attribute: AttributeDefinition;
}

function AttributeHUDPreview({ attribute }: AttributeHUDPreviewProps) {
  const value = attribute.defaultValue ?? (attribute.type === 'number' ? 0 : '');
  const style = attribute.hudStyle || 'default';
  const color = attribute.color || 'default';
  const icon = attribute.icon;
  const unit = attribute.hudUnit;
  const min = attribute.min ?? 0;
  const max = attribute.max ?? 100;
  
  // Color classes
  const colorClasses: Record<string, string> = {
    red: 'text-red-400',
    green: 'text-green-400',
    blue: 'text-blue-400',
    yellow: 'text-yellow-400',
    purple: 'text-purple-400',
    orange: 'text-orange-400',
    pink: 'text-pink-400',
    cyan: 'text-cyan-400',
    default: 'text-white/80',
  };
  
  const bgColorClasses: Record<string, string> = {
    red: 'bg-red-500/20 border-red-500/30',
    green: 'bg-green-500/20 border-green-500/30',
    blue: 'bg-blue-500/20 border-blue-500/30',
    yellow: 'bg-yellow-500/20 border-yellow-500/30',
    purple: 'bg-purple-500/20 border-purple-500/30',
    orange: 'bg-orange-500/20 border-orange-500/30',
    pink: 'bg-pink-500/20 border-pink-500/30',
    cyan: 'bg-cyan-500/20 border-cyan-500/30',
    default: 'bg-white/10 border-white/20',
  };
  
  const progressColorClasses: Record<string, string> = {
    red: 'bg-red-500',
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    yellow: 'bg-yellow-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    pink: 'bg-pink-500',
    cyan: 'bg-cyan-500',
    default: 'bg-white/50',
  };
  
  const textColor = colorClasses[color] || colorClasses.default;
  const bgColor = bgColorClasses[color] || bgColorClasses.default;
  const progressColor = progressColorClasses[color] || progressColorClasses.default;
  
  // Render based on style
  switch (style) {
    case 'progress': {
      const percentage = Math.max(0, Math.min(100, ((Number(value) - min) / (max - min)) * 100));
      return (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {icon && <span className="text-sm">{icon}</span>}
              <span className="text-xs text-white/50">{attribute.name}</span>
            </div>
            <span className="text-xs font-medium text-white/80">
              {value}{unit && <span className="text-white/40 ml-0.5">{unit}</span>}
            </span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2">
            <div className={`h-full rounded-full transition-all ${progressColor}`} style={{ width: `${percentage}%` }} />
          </div>
        </div>
      );
    }
    
    case 'gauge': {
      const percentage = Math.max(0, Math.min(100, ((Number(value) - min) / (max - min)) * 100));
      const circumference = 2 * Math.PI * 28;
      const offset = circumference - (percentage / 100) * circumference;
      return (
        <div className="flex items-center gap-2">
          <div className="relative w-10 h-10">
            <svg className="w-10 h-10 transform -rotate-90">
              <circle cx="20" cy="20" r="16" stroke="rgba(255,255,255,0.1)" strokeWidth="4" fill="none" />
              <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="4" fill="none"
                strokeDasharray={circumference} strokeDashoffset={offset}
                className={textColor} style={{ transition: 'stroke-dashoffset 0.5s' }} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">{value}</span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-white/50">{attribute.name}</span>
            {unit && <span className="text-[10px] text-white/30">{unit}</span>}
          </div>
        </div>
      );
    }
    
    case 'badge':
      return (
        <div className="flex items-center gap-2">
          {icon && <span className="text-sm">{icon}</span>}
          <span className="text-xs text-white/50">{attribute.name}:</span>
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${bgColor} ${textColor}`}>
            {value}
            {unit && <span className="ml-0.5 opacity-60">{unit}</span>}
          </span>
        </div>
      );
    
    case 'pill':
      return (
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${bgColor}`}>
          {icon && <span className="text-sm">{icon}</span>}
          <span className="text-xs text-white/60">{attribute.name}:</span>
          <span className={`text-sm font-medium ${textColor}`}>
            {value}
            {unit && <span className="text-white/40 ml-0.5">{unit}</span>}
          </span>
        </div>
      );
    
    case 'status': {
      const statusColor = typeof value === 'boolean' 
        ? (value ? 'bg-green-500' : 'bg-red-500')
        : progressColor;
      return (
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${statusColor} animate-pulse`} />
          <span className="text-xs text-white/50">{attribute.name}:</span>
          <span className={`text-sm font-medium ${textColor}`}>
            {typeof value === 'boolean' ? (value ? 'Activo' : 'Inactivo') : String(value)}
          </span>
        </div>
      );
    }
    
    case 'dots': {
      const numDots = typeof value === 'boolean' ? (value ? 5 : 0) : Math.min(5, Math.max(0, Number(value)));
      return (
        <div className="flex items-center gap-2">
          {icon && <span className="text-sm">{icon}</span>}
          <span className="text-xs text-white/50">{attribute.name}:</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={`w-2 h-2 rounded-full ${i <= numDots ? progressColor : 'bg-white/20'}`} />
            ))}
          </div>
        </div>
      );
    }
    
    case 'meter': {
      const percentage = Math.max(0, Math.min(100, ((Number(value) - min) / (max - min)) * 100));
      return (
        <div className="flex items-end gap-2 h-8">
          <div className="relative w-4 h-full bg-white/10 rounded-sm overflow-hidden">
            <div className={`absolute bottom-0 w-full transition-all ${progressColor}`} style={{ height: `${percentage}%` }} />
          </div>
          <div className="flex flex-col justify-end">
            <span className="text-[8px] text-white/50">{attribute.name}</span>
            <span className={`text-[10px] font-bold ${textColor}`}>{value}</span>
          </div>
        </div>
      );
    }
    
    default:
      return (
        <div className="flex items-center gap-2">
          {icon && <span className="text-sm">{icon}</span>}
          <span className="text-xs text-white/50">{attribute.name}:</span>
          <span className={`text-sm font-medium px-2 py-0.5 rounded border ${bgColor} ${textColor}`}>
            {value}
            {unit && <span className="text-white/40 ml-0.5">{unit}</span>}
          </span>
        </div>
      );
  }
}

// ============================================
// Requirement Editor Component
// ============================================

interface RequirementEditorProps {
  requirement: StatRequirement;
  availableAttributes: AttributeDefinition[];
  onChange: (updates: Partial<StatRequirement>) => void;
  onDelete: () => void;
}

// Operator definitions with descriptions
const OPERATOR_OPTIONS: { value: RequirementOperator; label: string; description: string }[] = [
  { value: '>=', label: '≥', description: 'Mayor o igual que' },
  { value: '>', label: '>', description: 'Mayor que' },
  { value: '<=', label: '≤', description: 'Menor o igual que' },
  { value: '<', label: '<', description: 'Menor que' },
  { value: '==', label: '=', description: 'Exactamente igual' },
  { value: '!=', label: '≠', description: 'Diferente de' },
  { value: 'between', label: '∈', description: 'Entre (rango)' },
];

function RequirementEditor({ requirement, availableAttributes, onChange, onDelete }: RequirementEditorProps) {
  const selectedOperator = OPERATOR_OPTIONS.find(op => op.value === requirement.operator);
  
  return (
    <div className="flex items-center gap-2 bg-muted/50 rounded p-2 flex-wrap">
      {/* Attribute selector */}
      <Select
        value={requirement.attributeKey}
        onValueChange={(value) => onChange({ attributeKey: value })}
      >
        <SelectTrigger className="h-7 w-24 text-xs">
          <SelectValue placeholder="Atributo" />
        </SelectTrigger>
        <SelectContent>
          {availableAttributes.map(attr => (
            <SelectItem key={attr.id} value={attr.key}>{attr.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {/* Operator selector with descriptions */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Select
            value={requirement.operator}
            onValueChange={(value: RequirementOperator) => onChange({ operator: value })}
          >
            <SelectTrigger className="h-7 w-20 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPERATOR_OPTIONS.map(op => (
                <SelectItem key={op.value} value={op.value}>
                  <div className="flex items-center gap-2">
                    <span className="font-mono w-4">{op.label}</span>
                    <span className="text-muted-foreground text-xs">{op.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="font-medium">{selectedOperator?.description}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {requirement.operator === 'between' 
              ? `El valor debe estar entre ${requirement.value} y ${requirement.valueMax || '?'}`
              : `El valor debe ser ${selectedOperator?.description} ${requirement.value}`
            }
          </p>
        </TooltipContent>
      </Tooltip>
      
      {/* Value input */}
      <Input
        type="number"
        value={requirement.value}
        onChange={(e) => onChange({ value: parseFloat(e.target.value) || 0 })}
        className="h-7 w-16 text-xs"
      />
      
      {/* Max value for between operator */}
      {requirement.operator === 'between' && (
        <>
          <span className="text-xs text-muted-foreground">y</span>
          <Input
            type="number"
            value={requirement.valueMax ?? ''}
            onChange={(e) => {
              const parsed = parseFloat(e.target.value);
              onChange({ valueMax: isNaN(parsed) ? undefined : parsed });
            }}
            placeholder="max"
            className="h-7 w-16 text-xs"
          />
        </>
      )}
      
      {/* Delete button */}
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete}>
        <Trash2 className="w-3 h-3 text-muted-foreground" />
      </Button>
    </div>
  );
}

// ============================================
// Activation Cost Editor Component
// ============================================

interface ActivationCostEditorProps {
  cost: ActivationCost;
  availableAttributes: AttributeDefinition[];
  onChange: (updates: Partial<ActivationCost>) => void;
  onDelete: () => void;
}

// Cost operator definitions with descriptions
const COST_OPERATOR_OPTIONS: { value: CostOperator; label: string; description: string; symbol: string }[] = [
  { value: '-', label: '-', description: 'Restar', symbol: '−' },
  { value: '+', label: '+', description: 'Sumar', symbol: '+' },
  { value: '*', label: '×', description: 'Multiplicar', symbol: '×' },
  { value: '/', label: '÷', description: 'Dividir', symbol: '÷' },
  { value: '=', label: '=', description: 'Establecer', symbol: '=' },
  { value: 'set_min', label: 'Min', description: 'Establecer mínimo', symbol: '⌊' },
  { value: 'set_max', label: 'Max', description: 'Establecer máximo', symbol: '⌈' },
];

function ActivationCostEditor({ cost, availableAttributes, onChange, onDelete }: ActivationCostEditorProps) {
  const selectedOperator = COST_OPERATOR_OPTIONS.find(op => op.value === cost.operator);
  const selectedAttr = availableAttributes.find(attr => attr.key === cost.attributeKey);
  
  return (
    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded p-2 flex-wrap">
      <Coins className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
      
      {/* Attribute selector */}
      <Select
        value={cost.attributeKey}
        onValueChange={(value) => onChange({ attributeKey: value })}
      >
        <SelectTrigger className="h-7 w-24 text-xs">
          <SelectValue placeholder="Atributo" />
        </SelectTrigger>
        <SelectContent>
          {availableAttributes.map(attr => (
            <SelectItem key={attr.id} value={attr.key}>{attr.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {/* Operator selector with descriptions */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Select
            value={cost.operator}
            onValueChange={(value: CostOperator) => onChange({ operator: value })}
          >
            <SelectTrigger className="h-7 w-16 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COST_OPERATOR_OPTIONS.map(op => (
                <SelectItem key={op.value} value={op.value}>
                  <div className="flex items-center gap-2">
                    <span className="font-mono w-4">{op.label}</span>
                    <span className="text-muted-foreground text-xs">{op.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="font-medium">{selectedOperator?.description}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {cost.operator === '-' 
              ? `Resta ${cost.value} de ${selectedAttr?.name || cost.attributeKey}`
              : cost.operator === '+'
              ? `Suma ${cost.value} a ${selectedAttr?.name || cost.attributeKey}`
              : cost.operator === '='
              ? `Establece ${selectedAttr?.name || cost.attributeKey} en ${cost.value}`
              : cost.operator === 'set_min'
              ? `${selectedAttr?.name || cost.attributeKey} será al menos ${cost.value}`
              : cost.operator === 'set_max'
              ? `${selectedAttr?.name || cost.attributeKey} será como máximo ${cost.value}`
              : `Aplica ${cost.operator}${cost.value} a ${selectedAttr?.name || cost.attributeKey}`
            }
          </p>
        </TooltipContent>
      </Tooltip>
      
      {/* Value input */}
      <Input
        type="number"
        value={cost.value}
        onChange={(e) => onChange({ value: parseFloat(e.target.value) || 0 })}
        className="h-7 w-16 text-xs"
      />
      
      {/* Description input (optional) */}
      <Input
        value={cost.description || ''}
        onChange={(e) => onChange({ description: e.target.value || undefined })}
        placeholder="Descripción opcional..."
        className="h-7 w-32 text-xs"
      />
      
      {/* Delete button */}
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete}>
        <Trash2 className="w-3 h-3 text-muted-foreground" />
      </Button>
    </div>
  );
}

// ============================================
// Skill Editor Component
// ============================================

interface SkillEditorProps {
  skill: SkillDefinition;
  index: number;
  availableAttributes: AttributeDefinition[];
  availableObjectives?: ObjectiveDropdownOption[];
  availableSolicitudes?: SolicitudDropdownOption[];
  onChange: (index: number, updates: Partial<SkillDefinition>) => void;
  onDelete: (index: number) => void;
}

function SkillEditor({ skill, index, availableAttributes, availableObjectives = [], availableSolicitudes = [], onChange, onDelete }: SkillEditorProps) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="border rounded-lg bg-muted/30">
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
          <Sword className="w-4 h-4 text-amber-500" />
          <span className="font-medium text-sm">{skill.name || `Acción #${index + 1}`}</span>
          {skill.key && (
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
              {'{{' + skill.key + '}}'}
            </code>
          )}
          {skill.type && (
            <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
              {skill.type === 'preparacion' ? '📋 Prep' : '⚔️ Ejec'}
            </Badge>
          )}
          {skill.requirements.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {skill.requirements.length} req
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); onDelete(index); }}
          >
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </Button>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t">
          <div className="pt-3 grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs mb-1 block">Nombre *</Label>
              <Input
                value={skill.name}
                onChange={(e) => onChange(index, { name: e.target.value })}
                placeholder="Afilar hacha"
                className="h-8"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Label className="text-xs">Key *</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Identificador para usar en templates.</p>
                    <p className="mt-1 text-xs text-muted-foreground">Uso: {'{{' + (skill.key || 'accion') + '}}'} → Lista de acciones</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                value={skill.key}
                onChange={(e) => onChange(index, { key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                placeholder="afilar_hacha"
                className="h-8 font-mono text-xs"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Tipo</Label>
              <Select
                value={skill.type || ''}
                onValueChange={(v) => onChange(index, { type: (v || undefined) as ActionType | undefined })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="preparacion">📋 Preparación</SelectItem>
                  <SelectItem value="ejecucion">⚔️ Ejecución</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs mb-1 block">Descripción</Label>
            <Textarea
              value={skill.description}
              onChange={(e) => onChange(index, { description: e.target.value })}
              placeholder="Descripción de la habilidad..."
              className="min-h-[60px] text-sm"
            />
          </div>
          
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Label className="text-xs">Categoría</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Agrupa habilidades relacionadas. Opcional.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              value={skill.category || ''}
              onChange={(e) => onChange(index, { category: e.target.value || undefined })}
              placeholder="combate, magia, social..."
              className="h-8"
            />
          </div>
          
          {/* Activation Key Section */}
          <div className="space-y-3 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-400" />
              <Label className="text-xs font-medium text-purple-400">Key de Activación (Trigger)</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <p>Cuando el LLM escriba esta key en su respuesta, la habilidad se activará automáticamente.</p>
                  <p className="mt-1 text-xs text-muted-foreground">Diferente a la key de template - esta es para detección post-LLM.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Label className="text-xs text-muted-foreground">Key principal</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Key principal que activará la habilidad.</p>
                      <p className="mt-1 text-xs text-muted-foreground">Se detectará en múltiples formatos: key:value, key=value, key_x, |key|</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  value={skill.activationKey || ''}
                  onChange={(e) => onChange(index, { activationKey: e.target.value.toLowerCase().replace(/\s+/g, '_') || undefined })}
                  placeholder="golpe, hab1, skill_x"
                  className="h-8 font-mono text-xs"
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Label className="text-xs text-muted-foreground">Keys alternativas</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Keys adicionales que también activarán la habilidad.</p>
                      <p className="mt-1 text-xs text-muted-foreground">Separar con comas: gf, golpe1, g_furioso</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  value={(skill.activationKeys || []).join(', ')}
                  onChange={(e) => {
                    const keys = e.target.value.split(',').map(k => k.trim().toLowerCase().replace(/\s+/g, '_')).filter(Boolean);
                    onChange(index, { activationKeys: keys.length > 0 ? keys : undefined });
                  }}
                  placeholder="gf, golpe1, g_furioso"
                  className="h-8 text-xs"
                />
              </div>
            </div>
            
            {/* Case sensitivity */}
            <div className="flex items-center gap-2">
              <Switch
                checked={skill.activationKeyCaseSensitive ?? false}
                onCheckedChange={(checked) => onChange(index, { activationKeyCaseSensitive: checked })}
              />
              <Label className="text-xs flex items-center gap-1">
                <CaseSensitive className="w-3 h-3" />
                Distinguir mayúsculas/minúsculas
              </Label>
            </div>
            
            {/* Detection Examples */}
            {skill.activationKey && (
              <div className="text-[10px] text-muted-foreground space-y-1 p-2 bg-background/50 rounded">
                <p className="font-medium text-foreground/70">Formatos que activarán "{skill.activationKey}":</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  <p>• <code>{skill.activationKey}:uso</code></p>
                  <p>• <code>{skill.activationKey}=activo</code></p>
                  <p>• <code>{skill.activationKey}_1</code></p>
                  <p>• <code>|{skill.activationKey}|</code></p>
                </div>
              </div>
            )}
            
            {/* Show all activation keys */}
            {((skill.activationKeys?.length || 0) > 0 || skill.activationKey) && (
              <div className="flex flex-wrap gap-1">
                {[skill.activationKey, ...(skill.activationKeys || [])].filter(Boolean).map((key, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] font-mono border-purple-500/30 text-purple-300">
                    {key}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs">Requisitos</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Condiciones que deben cumplirse para que la habilidad esté disponible.</p>
                    <p className="mt-1 text-xs text-muted-foreground">Ejemplo: Vida ≥ 20, Maná ≥ 10</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={() => {
                  const newReq: StatRequirement = { attributeKey: '', operator: '>=', value: 0 };
                  onChange(index, { requirements: [...skill.requirements, newReq] });
                }}
              >
                <Plus className="w-3 h-3 mr-1" /> Agregar
              </Button>
            </div>
            <div className="space-y-1">
              {skill.requirements.map((req, reqIndex) => (
                <RequirementEditor
                  key={reqIndex}
                  requirement={req}
                  availableAttributes={availableAttributes}
                  onChange={(updates) => {
                    const newReqs = [...skill.requirements];
                    newReqs[reqIndex] = { ...newReqs[reqIndex], ...updates };
                    onChange(index, { requirements: newReqs });
                  }}
                  onDelete={() => {
                    onChange(index, { 
                      requirements: skill.requirements.filter((_, i) => i !== reqIndex) 
                    });
                  }}
                />
              ))}
              {skill.requirements.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Sin requisitos - siempre disponible</p>
              )}
            </div>
          </div>
          
          {/* Activation Costs Section */}
          <div className="space-y-2 pt-2 border-t border-red-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-red-400" />
                <Label className="text-xs font-medium text-red-400">Costo de Activación</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Modificaciones a los atributos cuando se activa la habilidad.</p>
                    <p className="mt-1 text-xs text-muted-foreground">Ejemplo: Maná -10, Energía -5</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs border-red-500/30 hover:bg-red-500/10"
                onClick={() => {
                  const newCost: ActivationCost = { attributeKey: '', operator: '-', value: 0 };
                  onChange(index, { activationCosts: [...(skill.activationCosts || []), newCost] });
                }}
              >
                <Plus className="w-3 h-3 mr-1" /> Agregar Costo
              </Button>
            </div>
            <div className="space-y-1">
              {(skill.activationCosts || []).map((cost, costIndex) => (
                <ActivationCostEditor
                  key={costIndex}
                  cost={cost}
                  availableAttributes={availableAttributes}
                  onChange={(updates) => {
                    const newCosts = [...(skill.activationCosts || [])];
                    newCosts[costIndex] = { ...newCosts[costIndex], ...updates };
                    onChange(index, { activationCosts: newCosts });
                  }}
                  onDelete={() => {
                    onChange(index, { 
                      activationCosts: (skill.activationCosts || []).filter((_, i) => i !== costIndex) 
                    });
                  }}
                />
              ))}
              {(skill.activationCosts || []).length === 0 && (
                <p className="text-xs text-muted-foreground italic">Sin costos - activación gratuita</p>
              )}
            </div>
          </div>
          
          {/* Activation Rewards Section - Trigger & Objective Types */}
          <div className="space-y-2 pt-2 border-t border-green-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Gift className="w-3.5 h-3.5 text-green-400" />
                <Label className="text-xs font-medium text-green-400">Recompensas por Activación</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Efectos que se ejecutan cuando se activa la acción.</p>
                    <p className="mt-1 text-xs text-muted-foreground">• Trigger: Sprites, sonidos, fondos</p>
                    <p className="text-xs text-muted-foreground">• Objetivo: Completa un objetivo de misión</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs border-green-500/30 hover:bg-green-500/10"
                  onClick={() => {
                    const newReward = createTriggerReward('sprite', '', 'self', { id: `skill-reward-${Date.now().toString(36)}` });
                    onChange(index, { activationRewards: [...(skill.activationRewards || []), newReward] });
                  }}
                >
                  <Plus className="w-3 h-3 mr-1" /> Trigger
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs border-amber-500/30 hover:bg-amber-500/10"
                  onClick={() => {
                    const newReward = createObjectiveReward('', undefined, { id: `skill-reward-${Date.now().toString(36)}` });
                    onChange(index, { activationRewards: [...(skill.activationRewards || []), newReward] });
                  }}
                >
                  <Plus className="w-3 h-3 mr-1" /> Objetivo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs border-violet-500/30 hover:bg-violet-500/10"
                  onClick={() => {
                    const newReward = createSolicitudReward('', undefined, { id: `skill-reward-${Date.now().toString(36)}` });
                    onChange(index, { activationRewards: [...(skill.activationRewards || []), newReward] });
                  }}
                >
                  <Plus className="w-3 h-3 mr-1" /> Solicitud
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              {(skill.activationRewards || []).map((reward, rewardIdx) => {
                const normalized = normalizeReward(reward);
                const isTrig = normalized.type === 'trigger';
                const isObj = normalized.type === 'objective';
                const isSol = normalized.type === 'solicitud';

                return (
                  <div key={reward.id} className={`p-2 rounded border space-y-2 ${isObj ? 'bg-amber-500/5 border-amber-500/10' : isSol ? 'bg-violet-500/5 border-violet-500/10' : 'bg-green-500/5 border-green-500/10'}`}>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${isObj ? 'text-amber-400 border-amber-500/30' : isSol ? 'text-violet-400 border-violet-500/30' : 'text-green-400 border-green-500/30'}`}>
                        {isObj ? '🎯 Objetivo' : isSol ? '📋 Solicitud' : '⚡ Trigger'}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {describeReward(normalized)}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-red-500 hover:bg-red-500/10 ml-auto"
                        onClick={() => {
                          onChange(index, { 
                            activationRewards: (skill.activationRewards || []).filter((_, i) => i !== rewardIdx) 
                          });
                        }}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    
                    {isTrig && normalized.trigger && (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          <Select 
                            value={normalized.trigger.category} 
                            onValueChange={(v) => {
                              const updatedRewards = [...(skill.activationRewards || [])];
                              updatedRewards[rewardIdx] = {
                                ...reward,
                                trigger: { ...normalized.trigger!, category: v as TriggerCategory }
                              };
                              onChange(index, { activationRewards: updatedRewards });
                            }}
                          >
                            <SelectTrigger className="bg-background h-6 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sprite">🖼️ Sprite</SelectItem>
                              <SelectItem value="sound">🔊 Sonido</SelectItem>
                              <SelectItem value="background">🌄 Fondo</SelectItem>
                              <SelectItem value="soundSequence">🎵 Secuencia</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            value={normalized.trigger.key}
                            onChange={(e) => {
                              const updatedRewards = [...(skill.activationRewards || [])];
                              updatedRewards[rewardIdx] = {
                                ...reward,
                                trigger: { ...normalized.trigger!, key: e.target.value }
                              };
                              onChange(index, { activationRewards: updatedRewards });
                            }}
                            placeholder="Key del trigger"
                            className="bg-background h-6 text-xs"
                          />
                          <Select 
                            value={normalized.trigger.targetMode} 
                            onValueChange={(v) => {
                              const updatedRewards = [...(skill.activationRewards || [])];
                              updatedRewards[rewardIdx] = {
                                ...reward,
                                trigger: { ...normalized.trigger!, targetMode: v as TriggerTargetMode }
                              };
                              onChange(index, { activationRewards: updatedRewards });
                            }}
                          >
                            <SelectTrigger className="bg-background h-6 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="self">👤 Self</SelectItem>
                              <SelectItem value="all">👥 Todos</SelectItem>
                              <SelectItem value="target">🎯 Target</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {/* Extra options based on category */}
                        {normalized.trigger.category === 'sprite' && (
                          <div className="flex items-center gap-2">
                            <Label className="text-[10px] text-muted-foreground">Volver a idle (ms):</Label>
                            <Input
                              type="number"
                              value={normalized.trigger.returnToIdleMs || 0}
                              onChange={(e) => {
                                const updatedRewards = [...(skill.activationRewards || [])];
                                updatedRewards[rewardIdx] = {
                                  ...reward,
                                  trigger: { ...normalized.trigger!, returnToIdleMs: Number(e.target.value) }
                                };
                                onChange(index, { activationRewards: updatedRewards });
                              }}
                              placeholder="0 = no volver"
                              className="bg-background h-6 w-24 text-xs"
                            />
                          </div>
                        )}
                        
                        {normalized.trigger.category === 'sound' && (
                          <div className="flex items-center gap-2">
                            <Label className="text-[10px] text-muted-foreground">Volumen:</Label>
                            <Input
                              type="number"
                              min={0}
                              max={1}
                              step={0.1}
                              value={normalized.trigger.volume ?? 1}
                              onChange={(e) => {
                                const updatedRewards = [...(skill.activationRewards || [])];
                                updatedRewards[rewardIdx] = {
                                  ...reward,
                                  trigger: { ...normalized.trigger!, volume: Number(e.target.value) }
                                };
                                onChange(index, { activationRewards: updatedRewards });
                              }}
                              className="bg-background h-6 w-20 text-xs"
                            />
                          </div>
                        )}
                        
                        {normalized.trigger.category === 'background' && (
                          <div className="flex items-center gap-2">
                            <Label className="text-[10px] text-muted-foreground">Transición (ms):</Label>
                            <Input
                              type="number"
                              value={normalized.trigger.transitionDuration || 500}
                              onChange={(e) => {
                                const updatedRewards = [...(skill.activationRewards || [])];
                                updatedRewards[rewardIdx] = {
                                  ...reward,
                                  trigger: { ...normalized.trigger!, transitionDuration: Number(e.target.value) }
                                };
                                onChange(index, { activationRewards: updatedRewards });
                              }}
                              className="bg-background h-6 w-24 text-xs"
                            />
                          </div>
                        )}
                      </>
                    )}

                    {/* Objective Reward Editor */}
                    {isObj && normalized.objective && (
                      <div>
                        <Label className="text-[10px] text-muted-foreground mb-1 block">Objetivo que completa *</Label>
                        {availableObjectives.length > 0 ? (
                          <Select
                            value={normalized.objective.objectiveKey}
                            onValueChange={(v) => {
                              const selectedObj = availableObjectives.find(o => o.objectiveKey === v);
                              const updatedRewards = [...(skill.activationRewards || [])];
                              updatedRewards[rewardIdx] = {
                                ...reward,
                                objective: { 
                                  ...normalized.objective!, 
                                  objectiveKey: v,
                                  questId: selectedObj?.questId 
                                }
                              };
                              onChange(index, { activationRewards: updatedRewards });
                            }}
                          >
                            <SelectTrigger className="bg-background h-6 text-xs">
                              <SelectValue placeholder="Seleccionar objetivo..." />
                            </SelectTrigger>
                            <SelectContent>
                              {availableObjectives.map((obj) => (
                                <SelectItem key={obj.objectiveKey} value={obj.objectiveKey}>
                                  {obj.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Input
                              value={normalized.objective.objectiveKey}
                              onChange={(e) => {
                                const updatedRewards = [...(skill.activationRewards || [])];
                                updatedRewards[rewardIdx] = {
                                  ...reward,
                                  objective: { ...normalized.objective!, objectiveKey: e.target.value }
                                };
                                onChange(index, { activationRewards: updatedRewards });
                              }}
                              placeholder="Key del objetivo (ej: psycompletado)"
                              className="bg-background h-6 text-xs font-mono flex-1"
                            />
                            <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
                              Sin quests asignadas
                            </Badge>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Solicitud Reward Editor */}
                    {isSol && normalized.solicitud && (
                      <div>
                        <Label className="text-[10px] text-muted-foreground mb-1 block">Solicitud que completa *</Label>
                        {availableSolicitudes.length > 0 ? (
                          <Select
                            value={normalized.solicitud.solicitudKey}
                            onValueChange={(v) => {
                              const selectedSol = availableSolicitudes.find(s => s.solicitudKey === v);
                              const updatedRewards = [...(skill.activationRewards || [])];
                              updatedRewards[rewardIdx] = {
                                ...reward,
                                solicitud: {
                                  ...normalized.solicitud!,
                                  solicitudKey: v,
                                  solicitudId: selectedSol?.solicitudId,
                                  solicitudName: selectedSol?.solicitudName,
                                }
                              };
                              onChange(index, { activationRewards: updatedRewards });
                            }}
                          >
                            <SelectTrigger className="bg-background h-6 text-xs">
                              <SelectValue placeholder="Seleccionar solicitud..." />
                            </SelectTrigger>
                            <SelectContent>
                              {availableSolicitudes.map((sol) => (
                                <SelectItem key={sol.solicitudKey} value={sol.solicitudKey}>
                                  {sol.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="flex gap-2">
                            <Input
                              value={normalized.solicitud.solicitudKey}
                              onChange={(e) => {
                                const updatedRewards = [...(skill.activationRewards || [])];
                                updatedRewards[rewardIdx] = {
                                  ...reward,
                                  solicitud: { ...normalized.solicitud!, solicitudKey: e.target.value }
                                };
                                onChange(index, { activationRewards: updatedRewards });
                              }}
                              placeholder="Key de la solicitud (ej: consulta_respondida)"
                              className="bg-background h-6 text-xs font-mono flex-1"
                            />
                            <Badge variant="outline" className="text-[10px] text-violet-500 border-violet-500/30">
                              Sin solicitudes disponibles
                            </Badge>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {(skill.activationRewards || []).length === 0 && (
                <p className="text-xs text-muted-foreground italic">Sin recompensas - solo aplica costos</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Trigger Key Editor Component (Reusable)
// ============================================

interface TriggerKeyEditorProps {
  // Primary key
  primaryKey: string;
  onPrimaryKeyChange: (key: string) => void;
  primaryKeyPlaceholder?: string;
  
  // Alternative keys
  alternativeKeys?: string[];
  onAlternativeKeysChange?: (keys: string[] | undefined) => void;
  alternativeKeysPlaceholder?: string;
  
  // Case sensitivity
  caseSensitive?: boolean;
  onCaseSensitiveChange?: (value: boolean) => void;
  
  // Labels and descriptions
  label: string;
  description?: string;
  primaryKeyLabel?: string;
  alternativeKeysLabel?: string;
  
  // Color theme
  colorTheme?: 'purple' | 'cyan' | 'amber' | 'emerald' | 'rose';
}

function TriggerKeyEditor({
  primaryKey,
  onPrimaryKeyChange,
  primaryKeyPlaceholder = 'key_name',
  alternativeKeys,
  onAlternativeKeysChange,
  alternativeKeysPlaceholder = 'key1, key2, key3',
  caseSensitive = false,
  onCaseSensitiveChange,
  label,
  description,
  primaryKeyLabel = 'Key principal',
  alternativeKeysLabel = 'Keys alternativas',
  colorTheme = 'purple',
}: TriggerKeyEditorProps) {
  const colorClasses = {
    purple: {
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20',
      icon: 'text-purple-400',
      label: 'text-purple-400',
      keyBg: 'bg-purple-500/10',
      keyText: 'text-purple-400',
    },
    cyan: {
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/20',
      icon: 'text-cyan-400',
      label: 'text-cyan-400',
      keyBg: 'bg-cyan-500/10',
      keyText: 'text-cyan-400',
    },
    amber: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      icon: 'text-amber-400',
      label: 'text-amber-400',
      keyBg: 'bg-amber-500/10',
      keyText: 'text-amber-400',
    },
    emerald: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      icon: 'text-emerald-400',
      label: 'text-emerald-400',
      keyBg: 'bg-emerald-500/10',
      keyText: 'text-emerald-400',
    },
    rose: {
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/20',
      icon: 'text-rose-400',
      label: 'text-rose-400',
      keyBg: 'bg-rose-500/10',
      keyText: 'text-rose-400',
    },
  };
  
  const colors = colorClasses[colorTheme];
  const allKeys = [primaryKey, ...(alternativeKeys || [])].filter(Boolean);
  
  return (
    <div className={`space-y-3 p-3 ${colors.bg} rounded-lg border ${colors.border}`}>
      <div className="flex items-center gap-2">
        <Zap className={`w-4 h-4 ${colors.icon}`} />
        <Label className={`text-xs font-medium ${colors.label}`}>{label}</Label>
        {description && (
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
              <p>{description}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Label className="text-xs text-muted-foreground">{primaryKeyLabel}</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Key principal que activará esta acción.</p>
                <p className="mt-1 text-xs text-muted-foreground">Se detectará en múltiples formatos: key:value, key=value, |key|, [key]</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Input
            value={primaryKey}
            onChange={(e) => onPrimaryKeyChange(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
            placeholder={primaryKeyPlaceholder}
            className="h-8 font-mono text-xs"
          />
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Label className="text-xs text-muted-foreground">{alternativeKeysLabel}</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Keys adicionales que también activarán esta acción.</p>
                <p className="mt-1 text-xs text-muted-foreground">Separar con comas: alt1, alt2, alt3</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Input
            value={(alternativeKeys || []).join(', ')}
            onChange={(e) => {
              const keys = e.target.value.split(',').map(k => k.trim().toLowerCase().replace(/\s+/g, '_')).filter(Boolean);
              onAlternativeKeysChange?.(keys.length > 0 ? keys : undefined);
            }}
            placeholder={alternativeKeysPlaceholder}
            className="h-8 text-xs"
          />
        </div>
      </div>
      
      {/* Case Sensitivity Toggle */}
      {onCaseSensitiveChange && (
        <div className="flex items-center gap-2">
          <Switch
            checked={caseSensitive}
            onCheckedChange={onCaseSensitiveChange}
          />
          <Label className="text-xs flex items-center gap-1">
            <CaseSensitive className="w-3 h-3" />
            Distinguir mayúsculas/minúsculas
          </Label>
        </div>
      )}
      
      {/* Detection Format Preview */}
      {allKeys.length > 0 && (
        <div className="text-[10px] text-muted-foreground space-y-1 p-2 bg-background/50 rounded">
          <p className="font-medium text-foreground/70">Formatos detectados:</p>
          <div className="flex flex-wrap gap-1">
            {allKeys.slice(0, 3).map((key, i) => (
              <Fragment key={i}>
                <code className={`${colors.keyBg} ${colors.keyText} px-1 rounded`}>{key}:valor</code>
                <code className={`${colors.keyBg} ${colors.keyText} px-1 rounded`}>{key}=valor</code>
                <code className={`${colors.keyBg} ${colors.keyText} px-1 rounded`}>|{key}|</code>
                <code className={`${colors.keyBg} ${colors.keyText} px-1 rounded`}>[{key}]</code>
              </Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Invitation/Peticion Editor Component
// ============================================

// ============================================
// Solicitud Definition Editor Component
// ============================================

interface SolicitudDefinitionEditorProps {
  solicitud: SolicitudDefinition;
  index: number;
  availableAttributes: AttributeDefinition[];
  onChange: (index: number, updates: Partial<SolicitudDefinition>) => void;
  onDelete: (index: number) => void;
}

function SolicitudDefinitionEditor({ solicitud, index, availableAttributes, onChange, onDelete }: SolicitudDefinitionEditorProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg bg-muted/30">
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
          <Inbox className="w-4 h-4 text-cyan-500" />
          <span className="font-medium text-sm">{solicitud.name || `Solicitud #${index + 1}`}</span>
          {solicitud.peticionKey && (
            <code className="text-xs bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-1.5 py-0.5 rounded">
              pet: {solicitud.peticionKey}
            </code>
          )}
          {solicitud.solicitudKey && (
            <code className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded">
              sol: {solicitud.solicitudKey}
            </code>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); onDelete(index); }}
          >
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </Button>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t">
          <div className="pt-3">
            <Label className="text-xs mb-1 block">Nombre *</Label>
            <Input
              value={solicitud.name}
              onChange={(e) => onChange(index, { name: e.target.value })}
              placeholder="Proporcionar madera"
              className="h-8"
            />
          </div>

          {/* Peticion Activation Keys - Using TriggerKeyEditor */}
          <TriggerKeyEditor
            primaryKey={solicitud.peticionKey}
            onPrimaryKeyChange={(key) => onChange(index, { peticionKey: key })}
            primaryKeyPlaceholder="pedir_madera"
            alternativeKeys={solicitud.peticionActivationKeys}
            onAlternativeKeysChange={(keys) => onChange(index, { peticionActivationKeys: keys })}
            alternativeKeysPlaceholder="pm, pedir_madera_alt"
            caseSensitive={solicitud.peticionKeyCaseSensitive}
            onCaseSensitiveChange={(value) => onChange(index, { peticionKeyCaseSensitive: value })}
            label="Key de Petición (Activación)"
            description="Key que OTROS personajes escribirán para solicitarte esto. Aparecerá en [PETICIONES POSIBLES] de otros personajes."
            primaryKeyLabel="Key de petición"
            alternativeKeysLabel="Keys alternativas"
            colorTheme="cyan"
          />

          {/* Solicitud Completion Keys - Using TriggerKeyEditor */}
          <TriggerKeyEditor
            primaryKey={solicitud.solicitudKey}
            onPrimaryKeyChange={(key) => onChange(index, { solicitudKey: key })}
            primaryKeyPlaceholder="dar_madera"
            alternativeKeys={solicitud.solicitudActivationKeys}
            onAlternativeKeysChange={(keys) => onChange(index, { solicitudActivationKeys: keys })}
            alternativeKeysPlaceholder="dm, dar_madera_alt"
            caseSensitive={solicitud.solicitudKeyCaseSensitive}
            onCaseSensitiveChange={(value) => onChange(index, { solicitudKeyCaseSensitive: value })}
            label="Key de Solicitud (Completación)"
            description="Key que ESTE personaje escribirá para completar la solicitud. Aparecerá en [SOLICITUDES RECIBIDAS] cuando alguien te solicite esto."
            primaryKeyLabel="Key de solicitud"
            alternativeKeysLabel="Keys alternativas"
            colorTheme="emerald"
          />

          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Label className="text-xs">Descripción de Petición</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Lo que verá el personaje que hace la petición.</p>
                  <p className="mt-1 text-xs text-muted-foreground">Describe qué están solicitando.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Textarea
              value={solicitud.peticionDescription}
              onChange={(e) => onChange(index, { peticionDescription: e.target.value })}
              placeholder="Solicitar madera para construcción..."
              className="min-h-[50px] text-sm"
            />
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Label className="text-xs">Descripción de Solicitud</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Lo que verá este personaje cuando reciba la solicitud.</p>
                  <p className="mt-1 text-xs text-muted-foreground">Describe qué te están pidiendo.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Textarea
              value={solicitud.solicitudDescription}
              onChange={(e) => onChange(index, { solicitudDescription: e.target.value })}
              placeholder="Entregar madera al solicitante..."
              className="min-h-[50px] text-sm"
            />
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Label className="text-xs">Descripción de Completado</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Texto que se guardará en el evento "ultima_solicitud_completada" cuando se complete esta solicitud.</p>
                  <p className="mt-1 text-xs text-muted-foreground">Describe la acción completada. Se usará en el key {'{{'}eventos{'}}'}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Textarea
              value={solicitud.completionDescription || ''}
              onChange={(e) => onChange(index, { completionDescription: e.target.value })}
              placeholder="Has entregado madera al solicitante..."
              className="min-h-[50px] text-sm"
            />
          </div>

          {/* Requirements Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs">Requisitos</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Condiciones que ESTE personaje debe cumplir para que la solicitud esté disponible.</p>
                    <p className="mt-1 text-xs text-muted-foreground">Si no se cumplen, otros no podrán hacerte esta petición.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={() => {
                  const newReq: StatRequirement = { attributeKey: '', operator: '>=', value: 0 };
                  onChange(index, { requirements: [...solicitud.requirements, newReq] });
                }}
              >
                <Plus className="w-3 h-3 mr-1" /> Agregar
              </Button>
            </div>
            <div className="space-y-1">
              {solicitud.requirements.map((req, reqIndex) => (
                <RequirementEditor
                  key={reqIndex}
                  requirement={req}
                  availableAttributes={availableAttributes}
                  onChange={(updates) => {
                    const newReqs = [...solicitud.requirements];
                    newReqs[reqIndex] = { ...newReqs[reqIndex], ...updates };
                    onChange(index, { requirements: newReqs });
                  }}
                  onDelete={() => {
                    onChange(index, {
                      requirements: solicitud.requirements.filter((_, i) => i !== reqIndex)
                    });
                  }}
                />
              ))}
              {solicitud.requirements.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Sin requisitos - siempre disponible para otros</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Invitation Editor Component (Updated)
// ============================================

interface InvitationEditorProps {
  invitation: InvitationDefinition;
  index: number;
  availableAttributes: AttributeDefinition[];
  allCharacters?: { id: string; name: string; solicitudDefinitions: SolicitudDefinition[] }[];
  onChange: (index: number, updates: Partial<InvitationDefinition>) => void;
  onDelete: (index: number) => void;
}

function InvitationEditor({ invitation, index, availableAttributes, allCharacters = [], onChange, onDelete }: InvitationEditorProps) {
  const [expanded, setExpanded] = useState(false);

  // Get selected character's solicitudes
  const selectedCharacter = allCharacters.find(c => c.id === invitation.objetivo?.characterId);
  const selectedSolicitud = selectedCharacter?.solicitudDefinitions.find(
    s => s.id === invitation.objetivo?.solicitudId
  );

  return (
    <div className="border rounded-lg bg-muted/30">
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
          <Mail className="w-4 h-4 text-rose-500" />
          <span className="font-medium text-sm">{invitation.name || `Peticion #${index + 1}`}</span>
          {selectedSolicitud && (
            <code className="text-xs bg-rose-500/10 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded">
              {selectedSolicitud.peticionKey}
            </code>
          )}
          {selectedCharacter && (
            <Badge variant="outline" className="text-xs bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20">
              → {selectedCharacter.name}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); onDelete(index); }}
          >
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </Button>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t">
          <div className="pt-3">
            <Label className="text-xs mb-1 block">Nombre *</Label>
            <Input
              value={invitation.name}
              onChange={(e) => onChange(index, { name: e.target.value })}
              placeholder="Petición de madera"
              className="h-8"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Nombre interno para identificar esta petición en la configuración.
            </p>
          </div>

          {/* Objetivo Section */}
          <div className="space-y-2 p-3 bg-rose-500/10 rounded-lg border border-rose-500/20">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-rose-400" />
              <Label className="text-xs font-medium text-rose-400">Personaje Objetivo</Label>
            </div>

            <Select
              value={invitation.objetivo?.characterId || ''}
              onValueChange={(v) => {
                // Reset solicitud when character changes
                onChange(index, {
                  objetivo: v ? { characterId: v, solicitudId: '' } : undefined
                });
              }}
            >
              <SelectTrigger className="h-8 bg-background">
                <SelectValue placeholder="Seleccionar personaje..." />
              </SelectTrigger>
              <SelectContent>
                {allCharacters.filter(c => c.solicitudDefinitions.length > 0).map(char => (
                  <SelectItem key={char.id} value={char.id}>
                    {char.name} ({char.solicitudDefinitions.length} solicitudes)
                  </SelectItem>
                ))}
                {allCharacters.filter(c => c.solicitudDefinitions.length > 0).length === 0 && (
                  <SelectItem value="_none" disabled>No hay personajes con solicitudes configuradas</SelectItem>
                )}
              </SelectContent>
            </Select>

            {/* Solicitud Selector - appears when character is selected */}
            {selectedCharacter && (
              <div className="mt-2 space-y-1.5">
                <Label className="text-xs text-rose-300">Solicitud a solicitar:</Label>
                <Select
                  value={invitation.objetivo?.solicitudId || ''}
                  onValueChange={(v) => onChange(index, {
                    objetivo: { ...invitation.objetivo!, solicitudId: v }
                  })}
                >
                  <SelectTrigger className="h-8 bg-background">
                    <SelectValue placeholder="Seleccionar solicitud..." />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedCharacter.solicitudDefinitions.map(sol => (
                      <SelectItem key={sol.id} value={sol.id}>
                        {sol.name} ({sol.peticionKey})
                      </SelectItem>
                    ))}
                    {selectedCharacter.solicitudDefinitions.length === 0 && (
                      <SelectItem value="_none" disabled>Este personaje no tiene solicitudes configuradas</SelectItem>
                    )}
                  </SelectContent>
                </Select>

                {/* Show selected solicitud details */}
                {selectedSolicitud && (
                  <div className="mt-2 p-2 bg-background/50 rounded border text-xs space-y-1">
                    <p><strong>Key de activación:</strong> <code className="bg-muted px-1 rounded">{selectedSolicitud.peticionKey}</code></p>
                    <p><strong>Descripción:</strong> {selectedSolicitud.peticionDescription || '(sin descripción)'}</p>
                    {selectedSolicitud.requirements.length > 0 && (
                      <p className="text-amber-600 dark:text-amber-400">
                        ⚠️ Esta solicitud tiene requisitos que el objetivo debe cumplir
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Requirements Section - Requisitos del que HACE la petición */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs">Requisitos (para hacer la petición)</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Condiciones que ESTE personaje debe cumplir para poder hacer la petición.</p>
                    <p className="mt-1 text-xs text-muted-foreground">Si no se cumplen, la petición no aparecerá en tu lista.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={() => {
                  const newReq: StatRequirement = { attributeKey: '', operator: '>=', value: 0 };
                  onChange(index, { requirements: [...invitation.requirements, newReq] });
                }}
              >
                <Plus className="w-3 h-3 mr-1" /> Agregar
              </Button>
            </div>
            <div className="space-y-1">
              {invitation.requirements.map((req, reqIndex) => (
                <RequirementEditor
                  key={reqIndex}
                  requirement={req}
                  availableAttributes={availableAttributes}
                  onChange={(updates) => {
                    const newReqs = [...invitation.requirements];
                    newReqs[reqIndex] = { ...newReqs[reqIndex], ...updates };
                    onChange(index, { requirements: newReqs });
                  }}
                  onDelete={() => {
                    onChange(index, {
                      requirements: invitation.requirements.filter((_, i) => i !== reqIndex)
                    });
                  }}
                />
              ))}
              {invitation.requirements.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Sin requisitos - siempre disponible</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Helper: Generate available objectives from quest templates
// ============================================

function getAvailableObjectives(questTemplates: QuestTemplate[] = [], questTemplateIds?: string[]): ObjectiveDropdownOption[] {
  const options: ObjectiveDropdownOption[] = [];
  
  // Si no hay filtro de IDs, mostrar todas las plantillas
  const filteredTemplates = questTemplateIds && questTemplateIds.length > 0
    ? questTemplates.filter(t => questTemplateIds.includes(t.id))
    : questTemplates;
  
  for (const template of filteredTemplates) {
    for (const objective of template.objectives || []) {
      if (objective.completion?.key) {
        options.push({
          questId: template.id,
          questName: template.name,
          objectiveId: objective.id,
          objectiveKey: objective.completion.key,
          objectiveName: objective.description,
          label: `${template.name} → ${objective.description}`,
        });
      }
    }
  }
  
  return options;
}

// ============================================
// Helper: Generate available solicitudes from character definitions
// ============================================

function getAvailableSolicitudes(
  allCharacters: { id: string; name: string; solicitudDefinitions: SolicitudDefinition[] }[] = []
): SolicitudDropdownOption[] {
  const options: SolicitudDropdownOption[] = [];
  
  for (const char of allCharacters) {
    for (const sol of char.solicitudDefinitions || []) {
      options.push({
        solicitudId: sol.id,
        solicitudKey: sol.solicitudKey,
        solicitudName: sol.name,
        label: `${char.name} → ${sol.name}`,
      });
    }
  }
  
  return options;
}

// ============================================
// Main Stats Editor Component
// ============================================

export function StatsEditor({ statsConfig, onChange, allCharacters = [], questTemplates = [], questTemplateIds }: StatsEditorProps) {
  const config: CharacterStatsConfig = statsConfig || DEFAULT_STATS_CONFIG;
  
  const updateConfig = (updates: Partial<CharacterStatsConfig>) => {
    onChange({ ...config, ...updates });
  };
  
  const availableObjectives = getAvailableObjectives(questTemplates, questTemplateIds);
  const availableSolicitudes = getAvailableSolicitudes(allCharacters);
  
  // Attributes
  const addAttribute = () => {
    const newAttr: AttributeDefinition = {
      id: `attr-${Date.now()}`,
      name: '',
      key: '',
      type: 'number',
      defaultValue: 0,
      showInHUD: true,
      caseSensitive: false,
    };
    updateConfig({ attributes: [...config.attributes, newAttr] });
  };
  
  const updateAttribute = (index: number, updates: Partial<AttributeDefinition>) => {
    const newAttrs = [...config.attributes];
    newAttrs[index] = { ...newAttrs[index], ...updates };
    updateConfig({ attributes: newAttrs });
  };
  
  const deleteAttribute = (index: number) => {
    updateConfig({ attributes: config.attributes.filter((_, i) => i !== index) });
  };
  
  // Skills
  const addSkill = () => {
    const newSkill: SkillDefinition = {
      id: `skill-${Date.now()}`,
      name: '',
      description: '',
      key: '',
      requirements: [],
    };
    updateConfig({ skills: [...config.skills, newSkill] });
  };
  
  const updateSkill = (index: number, updates: Partial<SkillDefinition>) => {
    const newSkills = [...config.skills];
    newSkills[index] = { ...newSkills[index], ...updates };
    updateConfig({ skills: newSkills });
  };
  
  const deleteSkill = (index: number) => {
    updateConfig({ skills: config.skills.filter((_, i) => i !== index) });
  };
  
  // Intentions
  const addIntention = () => {
    const newIntention: IntentionDefinition = {
      id: `int-${Date.now()}`,
      name: '',
      description: '',
      key: '',
      requirements: [],
    };
    updateConfig({ intentions: [...config.intentions, newIntention] });
  };
  
  const updateIntention = (index: number, updates: Partial<IntentionDefinition>) => {
    const newIntentions = [...config.intentions];
    newIntentions[index] = { ...newIntentions[index], ...updates };
    updateConfig({ intentions: newIntentions });
  };
  
  const deleteIntention = (index: number) => {
    updateConfig({ intentions: config.intentions.filter((_, i) => i !== index) });
  };
  
  // Invitations (Peticiones)
  const addInvitation = () => {
    const newInvitation: InvitationDefinition = {
      id: `inv-${Date.now()}`,
      name: '',
      requirements: [],
    };
    updateConfig({ invitations: [...config.invitations, newInvitation] });
  };
  
  const updateInvitation = (index: number, updates: Partial<InvitationDefinition>) => {
    const newInvitations = [...config.invitations];
    newInvitations[index] = { ...newInvitations[index], ...updates };
    updateConfig({ invitations: newInvitations });
  };
  
  const deleteInvitation = (index: number) => {
    updateConfig({ invitations: config.invitations.filter((_, i) => i !== index) });
  };

  // SolicitudDefinitions (Solicitudes que este personaje puede recibir)
  const addSolicitudDefinition = () => {
    const newSolicitud: SolicitudDefinition = {
      id: `sol-${Date.now()}`,
      name: '',
      peticionKey: '',
      solicitudKey: '',
      peticionDescription: '',
      solicitudDescription: '',
      requirements: [],
    };
    updateConfig({ solicitudDefinitions: [...(config.solicitudDefinitions || []), newSolicitud] });
  };

  const updateSolicitudDefinition = (index: number, updates: Partial<SolicitudDefinition>) => {
    const newSolicitudes = [...(config.solicitudDefinitions || [])];
    newSolicitudes[index] = { ...newSolicitudes[index], ...updates };
    updateConfig({ solicitudDefinitions: newSolicitudes });
  };

  const deleteSolicitudDefinition = (index: number) => {
    updateConfig({ solicitudDefinitions: (config.solicitudDefinitions || []).filter((_, i) => i !== index) });
  };
  
  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Enable Toggle */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4" />
            <span className="font-medium">Sistema de Stats</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Info className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Sistema de Stats</h4>
                  <p className="text-xs text-muted-foreground">
                    Define atributos, habilidades, intenciones e invitaciones que el personaje puede usar durante el roleplay.
                  </p>
                  <div className="text-xs space-y-1 text-muted-foreground">
                    <p>• <strong>Atributos:</strong> Valores que cambian (Vida, Maná, etc.)</p>
                    <p>• <strong>Habilidades:</strong> Acciones disponibles según atributos</p>
                    <p>• <strong>Intenciones:</strong> Comportamientos que puede adoptar</p>
                    <p>• <strong>Invitaciones:</strong> Formas de invitar al usuario</p>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(checked) => updateConfig({ enabled: checked })}
          />
        </div>
        
        {!config.enabled && (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Activa el sistema de stats para configurar atributos, habilidades e intenciones.</p>
          </div>
        )}
        
        {config.enabled && (
          <Accordion type="multiple" defaultValue={['attributes']} className="space-y-2">
            {/* Attributes Section */}
            <AccordionItem value="attributes" className="border rounded-lg">
              <div className="flex items-center px-4">
                <AccordionTrigger className="px-0 hover:no-underline flex-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-500" />
                    <span>Atributos</span>
                    <Badge variant="secondary" className="ml-2">{config.attributes.length}</Badge>
                  </div>
                </AccordionTrigger>
                <Popover>
                  <PopoverTrigger asChild>
                    <button 
                      type="button"
                      className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Info className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Atributos</h4>
                      <p className="text-xs text-muted-foreground">
                        Valores que representan el estado del personaje. Pueden cambiar durante el roleplay.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        El LLM puede modificarlos automáticamente si configuras los "Tags de detección".
                      </p>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-2">
                  {config.attributes.map((attr, index) => (
                    <AttributeEditor
                      key={attr.id}
                      attribute={attr}
                      index={index}
                      onChange={updateAttribute}
                      onDelete={deleteAttribute}
                      allAttributes={config.attributes}
                    />
                  ))}
                  <Button variant="outline" size="sm" onClick={addAttribute} className="w-full">
                    <Plus className="w-4 h-4 mr-2" /> Agregar Atributo
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
            
            {/* Skills/Actions Section */}
            <AccordionItem value="skills" className="border rounded-lg">
              <div className="flex items-center px-4">
                <AccordionTrigger className="px-0 hover:no-underline flex-1">
                  <div className="flex items-center gap-2">
                    <Sword className="w-4 h-4 text-amber-500" />
                    <span>Acciones</span>
                    <Badge variant="secondary" className="ml-2">{config.skills.length}</Badge>
                  </div>
                </AccordionTrigger>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Info className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Acciones</h4>
                      <p className="text-xs text-muted-foreground">
                        Acciones que el personaje puede realizar. Pueden ser de preparación o ejecución.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Solo las acciones que cumplan los requisitos se mostrarán en el prompt.
                      </p>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs">Header del bloque</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Título que aparece antes de la lista de acciones en el prompt.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    value={config.blockHeaders.skills}
                    onChange={(e) => updateConfig({
                      blockHeaders: { ...config.blockHeaders, skills: e.target.value }
                    })}
                    placeholder="[ACCIONES DISPONIBLES]"
                    className="h-8"
                  />
                </div>
                <div className="space-y-2">
                  {config.skills.map((skill, index) => (
                    <SkillEditor
                      key={skill.id}
                      skill={skill}
                      index={index}
                      availableAttributes={config.attributes}
                      availableObjectives={availableObjectives}
                      availableSolicitudes={availableSolicitudes}
                      onChange={updateSkill}
                      onDelete={deleteSkill}
                    />
                  ))}
                  <Button variant="outline" size="sm" onClick={addSkill} className="w-full">
                    <Plus className="w-4 h-4 mr-2" /> Agregar Acción
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
            
            {/* Intentions Section */}
            <AccordionItem value="intentions" className="border rounded-lg">
              <div className="flex items-center px-4">
                <AccordionTrigger className="px-0 hover:no-underline flex-1">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-violet-500" />
                    <span>Intenciones</span>
                    <Badge variant="secondary" className="ml-2">{config.intentions.length}</Badge>
                  </div>
                </AccordionTrigger>
                <Popover>
                  <PopoverTrigger asChild>
                    <button 
                      type="button"
                      className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Info className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Intenciones</h4>
                      <p className="text-xs text-muted-foreground">
                        Comportamientos o actitudes que el personaje puede adoptar según la situación.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Ejemplos: "Atacar con furia", "Defender", "Seducción", "Huir"
                      </p>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs">Header del bloque</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Título que aparece antes de la lista de intenciones en el prompt.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    value={config.blockHeaders.intentions}
                    onChange={(e) => updateConfig({
                      blockHeaders: { ...config.blockHeaders, intentions: e.target.value }
                    })}
                    placeholder="Intenciones disponibles:"
                    className="h-8"
                  />
                </div>
                <div className="space-y-2">
                  {config.intentions.map((intention, index) => (
                    <SkillEditor
                      key={intention.id}
                      skill={intention as unknown as SkillDefinition}
                      index={index}
                      availableAttributes={config.attributes}
                      availableObjectives={availableObjectives}
                      onChange={(i, updates) => updateIntention(i, updates as unknown as Partial<IntentionDefinition>)}
                      onDelete={deleteIntention}
                    />
                  ))}
                  <Button variant="outline" size="sm" onClick={addIntention} className="w-full">
                    <Plus className="w-4 h-4 mr-2" /> Agregar Intención
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
            
            {/* SolicitudDefinitions Section - Solicitudes que este personaje puede recibir */}
            <AccordionItem value="solicitudes" className="border rounded-lg">
              <div className="flex items-center px-4">
                <AccordionTrigger className="px-0 hover:no-underline flex-1">
                  <div className="flex items-center gap-2">
                    <Inbox className="w-4 h-4 text-cyan-500" />
                    <span>Solicitudes</span>
                    <Badge variant="secondary" className="ml-2">{(config.solicitudDefinitions || []).length}</Badge>
                  </div>
                </AccordionTrigger>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Info className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Solicitudes</h4>
                      <p className="text-xs text-muted-foreground">
                        Solicitudes que otros personajes pueden hacerte.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Configura qué te pueden pedir y qué requisitos deben cumplirse.
                      </p>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs">Header del bloque (recibidas)</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Titulo que aparece antes de la lista de solicitudes recibidas en el prompt.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    value={config.blockHeaders.solicitudesRecibidas || '[SOLICITUDES RECIBIDAS]'}
                    onChange={(e) => updateConfig({
                      blockHeaders: { ...config.blockHeaders, solicitudesRecibidas: e.target.value }
                    })}
                    placeholder="[SOLICITUDES RECIBIDAS]"
                    className="h-8"
                  />
                </div>
                <div className="space-y-2">
                  {(config.solicitudDefinitions || []).map((solicitud, index) => (
                    <SolicitudDefinitionEditor
                      key={solicitud.id}
                      solicitud={solicitud}
                      index={index}
                      availableAttributes={config.attributes}
                      onChange={updateSolicitudDefinition}
                      onDelete={deleteSolicitudDefinition}
                    />
                  ))}
                  <Button variant="outline" size="sm" onClick={addSolicitudDefinition} className="w-full">
                    <Plus className="w-4 h-4 mr-2" /> Agregar Solicitud
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Invitations Section */}
            <AccordionItem value="invitations" className="border rounded-lg">
              <div className="flex items-center px-4">
                <AccordionTrigger className="px-0 hover:no-underline flex-1">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-rose-500" />
                    <span>Peticiones</span>
                    <Badge variant="secondary" className="ml-2">{config.invitations.length}</Badge>
                  </div>
                </AccordionTrigger>
                <Popover>
                  <PopoverTrigger asChild>
                    <button 
                      type="button"
                      className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Info className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Peticiones</h4>
                      <p className="text-xs text-muted-foreground">
                        Solicitudes que este personaje puede hacer a otros personajes.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Al activarse, se envia la solicitud al personaje objetivo.
                      </p>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs">Header del bloque</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Titulo que aparece antes de la lista de peticiones en el prompt.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    value={config.blockHeaders.invitations}
                    onChange={(e) => updateConfig({
                      blockHeaders: { ...config.blockHeaders, invitations: e.target.value }
                    })}
                    placeholder="[PETICIONES DISPONIBLES]"
                    className="h-8"
                  />
                </div>
                <div className="space-y-2">
                  {config.invitations.map((invitation, index) => (
                    <InvitationEditor
                      key={invitation.id}
                      invitation={invitation}
                      index={index}
                      availableAttributes={config.attributes}
                      allCharacters={allCharacters}
                      onChange={updateInvitation}
                      onDelete={deleteInvitation}
                    />
                  ))}
                  <Button variant="outline" size="sm" onClick={addInvitation} className="w-full">
                    <Plus className="w-4 h-4 mr-2" /> Agregar Peticion
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
        
        {/* Usage Help */}
        <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 space-y-2">
          <p className="font-medium">Uso de keys en el personaje:</p>
          <div className="space-y-1 pl-2">
            <p>• <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{'{{vida}}'}</code> → Muestra el valor del atributo</p>
            <p>• <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{'{{acciones}}'}</code> → Lista de acciones disponibles</p>
            <p>• <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{'{{intenciones}}'}</code> → Lista de intenciones disponibles</p>
            <p>• <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{'{{peticiones}}'}</code> → Peticiones que puede hacer este personaje</p>
            <p>• <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{'{{solicitudes}}'}</code> → Solicitudes recibidas de otros personajes</p>
            <p>• <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{'{{solicitante}}'}</code> → Nombre del personaje que hizo la solicitud</p>
            <p>• <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{'{{solicitado}}'}</code> → Nombre del personaje que recibe la solicitud</p>
            <p>• <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{'{{eventos}}'}</code> → Estado reciente de eventos</p>
          </div>
          <p className="text-xs opacity-75 mt-2">
            Funcionan igual que <code className="bg-muted px-1 rounded">{'{{char}}'}</code> y <code className="bg-muted px-1 rounded">{'{{user}}'}</code> de SillyTavern.
          </p>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default StatsEditor;
