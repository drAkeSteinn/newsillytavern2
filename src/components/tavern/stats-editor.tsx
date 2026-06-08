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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
  Timer,
  Clock,
  Package,
  GitBranch,
  Pencil,
  ArrowUpNarrowWide,
  Layers,
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
  TriggerFallbackMode,
  ActionType,
  ObjectiveDropdownOption,
  QuestTemplate,
  SolicitudDropdownOption,
  SpritePackV2,
  ThresholdEffect,
} from '@/types';
import { DEFAULT_STATS_BLOCK_HEADERS, DEFAULT_STATS_CONFIG } from '@/types';
import {
  createTriggerReward,
  createObjectiveReward,
  createSolicitudReward,
  createTargetAttributeReward,
  createCurrencyReward,
  createActivateSpritePackReward,
  describeReward,
  normalizeReward,
} from '@/lib/quest/quest-reward-utils';

interface StatsEditorProps {
  statsConfig: CharacterStatsConfig | undefined;
  onChange: (statsConfig: CharacterStatsConfig) => void;
  allCharacters?: { id: string; name: string; solicitudDefinitions: SolicitudDefinition[] }[];
  questTemplates?: QuestTemplate[];
  questTemplateIds?: string[];  // IDs de plantillas asignadas al personaje
  availableTargets?: {
    id: string;
    name: string;
    attributes: Array<{
      key: string;
      name: string;
      type: 'number' | 'keyword' | 'text';
      min?: number;
      max?: number;
    }>;
    spritePacks?: Array<{ id: string; name: string; conditionalMode?: boolean; spriteCount: number }>;
  }[];
  spritePacksV2?: SpritePackV2[];  // for activate_sprite_pack reward
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
  availableTargets?: StatsEditorProps['availableTargets'];
  spritePacksV2?: SpritePackV2[];
}

function AttributeEditor({ attribute, index, onChange, onDelete, allAttributes, availableTargets = [], spritePacksV2 }: AttributeEditorProps) {
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
          <Badge variant="outline" className={cn(
            "text-xs capitalize",
            attribute.type === 'number' ? 'border-blue-500/30 text-blue-500' :
            attribute.type === 'keyword' ? 'border-purple-500/30 text-purple-500' :
            'border-amber-500/30 text-amber-500'
          )}>
            {attribute.type === 'number' ? '🔢 Numérico' : attribute.type === 'keyword' ? '🏷️ Estado' : '📝 Texto'}
          </Badge>
          {attribute.timer?.enabled && (
            <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-400">
              <Timer className="w-2.5 h-2.5 mr-0.5" />
              {attribute.timer.intervalMinutes}min
            </Badge>
          )}
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
          
          {/* Type Selection - Two main categories: Numeric / Text */}
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Label className="text-xs font-medium">Tipo de atributo</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="font-medium">🔢 Numérico:</p>
                    <p className="text-xs text-muted-foreground">Valores numéricos con min/max. Soporta operaciones aritméticas (+, -, *, /). Ej: Vida (0-100), Maná</p>
                    <p className="font-medium mt-2">📝 Texto:</p>
                    <p className="text-xs text-muted-foreground">Texto libre sin restricciones. Solo soporta el operador = (establecer). Ej: Notas, descripciones</p>
                    <p className="font-medium mt-2">🏷️ Estado:</p>
                    <p className="text-xs text-muted-foreground">Variante de texto que representa estados o condiciones. Solo soporta = (establecer). Ej: "enojado", "feliz", "neutral"</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              {/* Two main category buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={cn(
                    'flex flex-col items-center gap-1 p-2.5 rounded-lg border-2 transition-all',
                    attribute.type === 'number'
                      ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      : 'border-border hover:border-blue-500/50 hover:bg-blue-500/5'
                  )}
                  onClick={() => onChange(index, { type: 'number', defaultValue: 0 })}
                >
                  <span className="text-xl">🔢</span>
                  <span className="text-xs font-medium">Numérico</span>
                  <span className="text-[10px] text-muted-foreground">Operaciones aritméticas</span>
                </button>
                <div className="space-y-1.5">
                  <button
                    type="button"
                    className={cn(
                      'w-full flex items-center gap-2 p-2 rounded-lg border-2 transition-all',
                      attribute.type === 'text'
                        ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : 'border-border hover:border-amber-500/50 hover:bg-amber-500/5'
                    )}
                    onClick={() => onChange(index, { type: 'text', defaultValue: '' })}
                  >
                    <span className="text-base">📝</span>
                    <div className="text-left">
                      <span className="text-xs font-medium block">Texto</span>
                      <span className="text-[10px] text-muted-foreground">Texto libre</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'w-full flex items-center gap-2 p-2 rounded-lg border-2 transition-all',
                      attribute.type === 'keyword'
                        ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400'
                        : 'border-border hover:border-purple-500/50 hover:bg-purple-500/5'
                    )}
                    onClick={() => onChange(index, { type: 'keyword', defaultValue: '' })}
                  >
                    <span className="text-base">🏷️</span>
                    <div className="text-left">
                      <span className="text-xs font-medium block">Estado</span>
                      <span className="text-[10px] text-muted-foreground">Texto con estados</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Valor por defecto</Label>
              {attribute.type === 'number' ? (
                <Input
                  type="number"
                  value={attribute.defaultValue}
                  onChange={(e) => onChange(index, { 
                    defaultValue: parseFloat(e.target.value) || 0
                  })}
                  className="h-8"
                  placeholder="0"
                />
              ) : attribute.type === 'keyword' ? (
                <Input
                  type="text"
                  value={attribute.defaultValue}
                  onChange={(e) => onChange(index, { defaultValue: e.target.value })}
                  className="h-8"
                  placeholder="neutral (separa opciones con |)"
                />
              ) : (
                <Textarea
                  value={attribute.defaultValue}
                  onChange={(e) => onChange(index, { defaultValue: e.target.value })}
                  className="min-h-[60px] text-xs"
                  placeholder="Texto libre..."
                  rows={2}
                />
              )}
              {attribute.type === 'keyword' && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Para estados múltiples, separa con | Ej: enojado|feliz|neutral
                </p>
              )}
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

          {/* Threshold Effects V2 - Flexible conditions with priority */}
          {attribute.type === 'number' && (
            <ThresholdEffectsSection
              attribute={attribute}
              index={index}
              onChange={onChange}
              allAttributes={allAttributes}
              availableTargets={availableTargets}
              spritePacksV2={spritePacksV2}
            />
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
          
          {/* Timer - Automatic attribute changes over time */}
          <div className="space-y-3 p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-emerald-400" />
                <Label className="text-xs font-medium text-emerald-400">Timer automático</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p>El atributo cambia automáticamente con el tiempo.</p>
                    <p className="mt-1 text-xs text-muted-foreground">• Numérico: suma/resta/multiplica/divide cada X minutos</p>
                    <p className="text-xs text-muted-foreground">• Estado/Texto: cicla, aleatorio o establece valores</p>
                    <p className="text-xs text-muted-foreground">• Solo aplica cuando se cumplen las condiciones (si las hay)</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Switch
                checked={attribute.timer?.enabled ?? false}
                onCheckedChange={(checked) => onChange(index, {
                  timer: {
                    ...attribute.timer,
                    enabled: checked,
                    intervalMinutes: attribute.timer?.intervalMinutes || 5,
                  }
                })}
              />
            </div>
            
            {attribute.timer?.enabled && (
              <div className="space-y-3">
                {/* Interval */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs mb-1 block">Intervalo (minutos)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={attribute.timer.intervalMinutes || 5}
                      onChange={(e) => onChange(index, {
                        timer: {
                          ...attribute.timer!,
                          intervalMinutes: Math.max(1, parseInt(e.target.value) || 5),
                        }
                      })}
                      className="h-8"
                      placeholder="5"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Cada cuántos minutos se actualiza
                    </p>
                  </div>
                  
                  {/* Numeric operation */}
                  {attribute.type === 'number' && (
                    <div>
                      <Label className="text-xs mb-1 block">Operación</Label>
                      <Select
                        value={attribute.timer.numericOperation || 'add'}
                        onValueChange={(value) => onChange(index, {
                          timer: {
                            ...attribute.timer!,
                            numericOperation: value as 'add' | 'subtract' | 'multiply' | 'divide' | 'set',
                          }
                        })}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="add">➕ Sumar (+)</SelectItem>
                          <SelectItem value="subtract">➖ Restar (-)</SelectItem>
                          <SelectItem value="multiply">✖️ Multiplicar (×)</SelectItem>
                          <SelectItem value="divide">➗ Dividir (÷)</SelectItem>
                          <SelectItem value="set">📌 Establecer (=)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {/* Text/Keyword operation */}
                  {(attribute.type === 'keyword' || attribute.type === 'text') && (
                    <div>
                      <Label className="text-xs mb-1 block">Operación</Label>
                      <Select
                        value={attribute.timer.textOperation || 'set'}
                        onValueChange={(value) => onChange(index, {
                          timer: {
                            ...attribute.timer!,
                            textOperation: value as 'cycle' | 'random' | 'set',
                          }
                        })}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cycle">🔄 Cíclico (rotar)</SelectItem>
                          <SelectItem value="random">🎲 Aleatorio</SelectItem>
                          <SelectItem value="set">📌 Establecer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                
                {/* Numeric value */}
                {attribute.type === 'number' && (
                  <div>
                    <Label className="text-xs mb-1 block">
                      Valor {attribute.timer.numericOperation === 'add' ? '(cantidad a sumar)' :
                             attribute.timer.numericOperation === 'subtract' ? '(cantidad a restar)' :
                             attribute.timer.numericOperation === 'multiply' ? '(multiplicador)' :
                             attribute.timer.numericOperation === 'divide' ? '(divisor)' :
                             '(valor a establecer)'}
                    </Label>
                    <Input
                      type="number"
                      value={attribute.timer.numericValue ?? 1}
                      onChange={(e) => onChange(index, {
                        timer: {
                          ...attribute.timer!,
                          numericValue: parseFloat(e.target.value) || 0,
                        }
                      })}
                      className="h-8"
                      placeholder="1"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {attribute.timer.numericOperation === 'add' || !attribute.timer.numericOperation
                        ? `Ej: Cada ${attribute.timer.intervalMinutes || 5} min, +${attribute.timer.numericValue || 1}`
                        : attribute.timer.numericOperation === 'subtract'
                        ? `Ej: Cada ${attribute.timer.intervalMinutes || 5} min, -${attribute.timer.numericValue || 1}`
                        : attribute.timer.numericOperation === 'set'
                        ? `Ej: Cada ${attribute.timer.intervalMinutes || 5} min, = ${attribute.timer.numericValue || 0}`
                        : `Ej: Cada ${attribute.timer.intervalMinutes || 5} min, ${attribute.timer.numericOperation === 'multiply' ? '×' : '÷'}${attribute.timer.numericValue || 1}`
                      }
                    </p>
                  </div>
                )}
                
                {/* Text values for cycle/random */}
                {(attribute.type === 'keyword' || attribute.type === 'text') && 
                 (attribute.timer.textOperation === 'cycle' || attribute.timer.textOperation === 'random') && (
                  <div>
                    <Label className="text-xs mb-1 block">
                      Valores (separar con comas)
                    </Label>
                    <Input
                      value={attribute.timer.textValues || ''}
                      onChange={(e) => onChange(index, {
                        timer: {
                          ...attribute.timer!,
                          textValues: e.target.value,
                        }
                      })}
                      placeholder="caja, roca, botella"
                      className="h-8"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {attribute.timer.textOperation === 'cycle'
                        ? 'Rotará ciclicamente por estos valores'
                        : 'Seleccionará un valor aleatorio cada tick'
                      }
                    </p>
                    {attribute.timer.textValues && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {attribute.timer.textValues.split(',').map((v, i) => v.trim()).filter(Boolean).map((v, i) => (
                          <Badge key={i} variant="outline" className="text-[10px]">
                            {v}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Text value for set */}
                {(attribute.type === 'keyword' || attribute.type === 'text') && 
                 attribute.timer.textOperation === 'set' && (
                  <div>
                    <Label className="text-xs mb-1 block">Valor a establecer</Label>
                    <Input
                      value={attribute.timer.textValue || ''}
                      onChange={(e) => onChange(index, {
                        timer: {
                          ...attribute.timer!,
                          textValue: e.target.value,
                        }
                      })}
                      placeholder="nuevo valor"
                      className="h-8"
                    />
                  </div>
                )}
                
                {/* Timer conditions */}
                <div className="space-y-2 p-2 bg-background/50 rounded border border-emerald-500/10">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-3 h-3 text-emerald-400" />
                    <Label className="text-xs font-medium">Condiciones (opcional)</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <p>El timer solo se aplicará cuando todas las condiciones se cumplan.</p>
                        <p className="mt-1 text-xs text-muted-foreground">Ejemplo: Vida &gt; 0 (no regenerar si está muerto)</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  
                  {(attribute.timer.condition || []).map((cond, condIdx) => (
                    <div key={condIdx} className="flex items-center gap-2">
                      <Select
                        value={cond.attributeKey}
                        onValueChange={(value) => {
                          const newConditions = [...(attribute.timer?.condition || [])];
                          newConditions[condIdx] = { ...newConditions[condIdx], attributeKey: value };
                          onChange(index, { timer: { ...attribute.timer!, condition: newConditions } });
                        }}
                      >
                        <SelectTrigger className="h-7 w-28">
                          <SelectValue placeholder="Atributo" />
                        </SelectTrigger>
                        <SelectContent>
                          {allAttributes.map(attr => (
                            <SelectItem key={attr.key} value={attr.key}>
                              {attr.name || attr.key}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={cond.operator}
                        onValueChange={(value) => {
                          const newConditions = [...(attribute.timer?.condition || [])];
                          newConditions[condIdx] = { ...newConditions[condIdx], operator: value as any };
                          onChange(index, { timer: { ...attribute.timer!, condition: newConditions } });
                        }}
                      >
                        <SelectTrigger className="h-7 w-16">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value=">">&gt;</SelectItem>
                          <SelectItem value=">=">&ge;</SelectItem>
                          <SelectItem value="<">&lt;</SelectItem>
                          <SelectItem value="<=">&le;</SelectItem>
                          <SelectItem value="==">=</SelectItem>
                          <SelectItem value="!=">&ne;</SelectItem>
                          <SelectItem value="contains">contiene</SelectItem>
                          <SelectItem value="not_contains">no contiene</SelectItem>
                        </SelectContent>
                      </Select>
                      {cond.operator === 'contains' || cond.operator === 'not_contains' ? (
                        <Input
                          value={typeof cond.value === 'string' ? cond.value : ''}
                          onChange={(e) => {
                            const newConditions = [...(attribute.timer?.condition || [])];
                            newConditions[condIdx] = { ...newConditions[condIdx], value: e.target.value };
                            onChange(index, { timer: { ...attribute.timer!, condition: newConditions } });
                          }}
                          className="h-7 w-20"
                          placeholder="texto"
                        />
                      ) : (
                        <Input
                          type="number"
                          value={typeof cond.value === 'number' ? cond.value : ''}
                          onChange={(e) => {
                            const newConditions = [...(attribute.timer?.condition || [])];
                            newConditions[condIdx] = { ...newConditions[condIdx], value: parseFloat(e.target.value) || 0 };
                            onChange(index, { timer: { ...attribute.timer!, condition: newConditions } });
                          }}
                          className="h-7 w-16"
                          placeholder="valor"
                        />
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          const newConditions = (attribute.timer?.condition || []).filter((_, i) => i !== condIdx);
                          onChange(index, { timer: { ...attribute.timer!, condition: newConditions.length > 0 ? newConditions : undefined } });
                        }}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] border-emerald-500/30 hover:bg-emerald-500/10"
                    onClick={() => {
                      const newConditions = [...(attribute.timer?.condition || []), {
                        attributeKey: allAttributes[0]?.key || '',
                        operator: '>' as const,
                        value: 0,
                      }];
                      onChange(index, { timer: { ...attribute.timer!, condition: newConditions } });
                    }}
                  >
                    <Plus className="w-2.5 h-2.5 mr-0.5" /> Agregar condición
                  </Button>
                </div>
              </div>
            )}
          </div>
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
  availableTargets?: StatsEditorProps['availableTargets'];
  onChange: (updates: Partial<StatRequirement>) => void;
  onDelete: () => void;
}

// Numeric operator definitions with descriptions
const NUMERIC_OPERATOR_OPTIONS: { value: RequirementOperator; label: string; description: string }[] = [
  { value: '>=', label: '≥', description: 'Mayor o igual que' },
  { value: '>', label: '>', description: 'Mayor que' },
  { value: '<=', label: '≤', description: 'Menor o igual que' },
  { value: '<', label: '<', description: 'Menor que' },
  { value: '==', label: '=', description: 'Exactamente igual' },
  { value: '!=', label: '≠', description: 'Diferente de' },
  { value: 'between', label: '∈', description: 'Entre (rango)' },
];

// Text operator definitions with descriptions
const TEXT_OPERATOR_OPTIONS: { value: RequirementOperator; label: string; description: string }[] = [
  { value: '==', label: '=', description: 'Exactamente igual' },
  { value: '!=', label: '≠', description: 'Diferente de' },
  { value: 'contains', label: '⊂', description: 'Contiene' },
  { value: 'not_contains', label: '⊄', description: 'No contiene' },
];

function RequirementEditor({ requirement, availableAttributes, availableTargets = [], onChange, onDelete }: RequirementEditorProps) {
  const isTargetMode = requirement.targetCharacterId !== undefined;
  const selectedTarget = isTargetMode && requirement.targetCharacterId
    ? availableTargets.find(t => t.id === requirement.targetCharacterId)
    : undefined;
  const targetAttrs = selectedTarget?.attributes || [];

  // Determine the selected attribute and its type
  const selectedSelfAttr = !isTargetMode ? availableAttributes.find(a => a.key === requirement.attributeKey) : undefined;
  const selectedTargetAttr = isTargetMode ? targetAttrs.find(a => a.key === requirement.attributeKey) : undefined;
  const selectedAttr = selectedSelfAttr || selectedTargetAttr;
  const attrType = selectedAttr?.type || 'number';
  const isTextType = attrType === 'text' || attrType === 'keyword';

  const operatorOptions = isTextType ? TEXT_OPERATOR_OPTIONS : NUMERIC_OPERATOR_OPTIONS;
  const selectedOperator = operatorOptions.find(op => op.value === requirement.operator);

  return (
    <div className="flex items-center gap-2 bg-muted/50 rounded p-2 flex-wrap">
      {/* Target/Mode indicator */}
      <Select
        value={isTargetMode ? 'target' : 'self'}
        onValueChange={(value) => {
          if (value === 'target') {
            onChange({ attributeKey: '', targetCharacterId: '', targetAttributeName: '', operator: '==', value: '' });
          } else {
            onChange({ attributeKey: '', targetCharacterId: undefined, targetAttributeName: undefined, operator: '>=', value: 0 });
          }
        }}
      >
        <SelectTrigger className="h-7 w-16 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="self">
            <span className="flex items-center gap-1">🎭 Yo</span>
          </SelectItem>
          <SelectItem value="target">
            <span className="flex items-center gap-1">🎯 Target</span>
          </SelectItem>
        </SelectContent>
      </Select>

      {isTargetMode ? (
        <>
          {/* Target selector */}
          <Select
            value={requirement.targetCharacterId || ''}
            onValueChange={(value) => {
              const target = availableTargets.find(t => t.id === value);
              onChange({ targetCharacterId: value, attributeKey: '', targetAttributeName: target?.name || '' });
            }}
          >
            <SelectTrigger className="h-7 w-28 text-xs">
              <SelectValue placeholder="Target..." />
            </SelectTrigger>
            <SelectContent>
              {availableTargets.map(t => (
                <SelectItem key={t.id} value={t.id}>
                  {t.id === '__user__' ? '👤 ' : '🎭 '}{t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Target attribute selector */}
          <Select
            value={requirement.attributeKey}
            onValueChange={(value) => {
              const attr = targetAttrs.find(a => a.key === value);
              const isText = attr?.type === 'text' || attr?.type === 'keyword';
              onChange({
                attributeKey: value,
                targetAttributeName: attr?.name || '',
                operator: isText ? '==' : '>=',
                value: isText ? '' : 0,
              });
            }}
            disabled={!requirement.targetCharacterId}
          >
            <SelectTrigger className="h-7 w-28 text-xs">
              <SelectValue placeholder="Atributo..." />
            </SelectTrigger>
            <SelectContent>
              {targetAttrs.map((attr, i) => (
                <SelectItem key={attr.key || `attr-${i}`} value={attr.key}>
                  <span className="flex items-center gap-1">
                    <span className={attr.type === 'text' || attr.type === 'keyword' ? 'text-blue-400' : 'text-green-400'}>
                      {attr.type === 'text' ? '📝' : attr.type === 'keyword' ? '🏷️' : '🔢'}
                    </span>
                    {attr.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      ) : (
        /* Self attribute selector */
        <Select
          value={requirement.attributeKey}
          onValueChange={(value) => {
            const attr = availableAttributes.find(a => a.key === value);
            const isText = attr?.type === 'text' || attr?.type === 'keyword';
            onChange({
              attributeKey: value,
              operator: isText ? '==' : '>=',
              value: isText ? '' : 0,
            });
          }}
        >
          <SelectTrigger className="h-7 w-24 text-xs">
            <SelectValue placeholder="Atributo" />
          </SelectTrigger>
          <SelectContent>
            {availableAttributes.map(attr => (
              <SelectItem key={attr.id} value={attr.key}>
                <span className="flex items-center gap-1">
                  <span className={attr.type === 'text' || attr.type === 'keyword' ? 'text-blue-400' : 'text-green-400'}>
                    {attr.type === 'text' ? '📝' : attr.type === 'keyword' ? '🏷️' : '🔢'}
                  </span>
                  {attr.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Operator selector with descriptions */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Select
            value={operatorOptions.some(op => op.value === requirement.operator) ? requirement.operator : operatorOptions[0].value}
            onValueChange={(value: RequirementOperator) => onChange({ operator: value })}
          >
            <SelectTrigger className="h-7 w-16 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {operatorOptions.map(op => (
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

      {/* Value input - text or number based on attribute type */}
      {isTextType ? (
        <Input
          type="text"
          value={typeof requirement.value === 'string' ? requirement.value : String(requirement.value)}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder="Texto..."
          className="h-7 w-24 text-xs"
        />
      ) : (
        <Input
          type="number"
          value={requirement.value}
          onChange={(e) => onChange({ value: parseFloat(e.target.value) || 0 })}
          className="h-7 w-16 text-xs"
        />
      )}

      {/* Max value for between operator (only for numeric) */}
      {!isTextType && requirement.operator === 'between' && (
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
// Threshold Effect Dialog - Edit a single threshold effect in a dialog
// ============================================

interface ThresholdEffectDialogProps {
  effect: ThresholdEffect;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updatedEffect: ThresholdEffect) => void;
  allAttributes: AttributeDefinition[];
  availableTargets: StatsEditorProps['availableTargets'];
  spritePacksV2?: SpritePackV2[];
  attributeKey: string;  // The parent attribute's key (for self-referencing conditions)
}

function ThresholdEffectDialog({ effect, open, onOpenChange, onSave, allAttributes, availableTargets, spritePacksV2, attributeKey }: ThresholdEffectDialogProps) {
  // Local state for editing
  const [localEffect, setLocalEffect] = useState<ThresholdEffect>({ ...effect });

  // Sync when effect prop changes or dialog opens
  const prevOpenRef = useState(false);
  if (open && !prevOpenRef[0]) {
    setLocalEffect({ ...effect });
    prevOpenRef[1](true);
  }
  if (!open && prevOpenRef[0]) {
    prevOpenRef[1](false);
  }

  const updateEffect = (updates: Partial<ThresholdEffect>) => {
    setLocalEffect(prev => ({ ...prev, ...updates }));
  };

  // Condition management
  const addCondition = () => {
    const newCondition: StatRequirement = {
      attributeKey: attributeKey,  // Default to self attribute
      operator: '<=',
      value: 0,
    };
    updateEffect({ conditions: [...localEffect.conditions, newCondition] });
  };

  const removeCondition = (idx: number) => {
    updateEffect({ conditions: localEffect.conditions.filter((_, i) => i !== idx) });
  };

  const updateCondition = (idx: number, updates: Partial<StatRequirement>) => {
    const updated = [...localEffect.conditions];
    updated[idx] = { ...updated[idx], ...updates };
    updateEffect({ conditions: updated });
  };

  // Reward management
  const addReward = (type: QuestReward['type']) => {
    let newReward: QuestReward;
    switch (type) {
      case 'trigger':
        newReward = createTriggerReward('sprite', '', 'self');
        break;
      case 'attribute':
        newReward = {
          id: `threshold-reward-${Date.now().toString(36)}`,
          type: 'attribute',
          attribute: { key: '', value: 0, action: 'set' }
        };
        break;
      case 'target_attribute':
        newReward = createTargetAttributeReward('', '', 0, 'set');
        break;
      case 'currency':
        newReward = createCurrencyReward(0);
        break;
      case 'activate_sprite_pack':
        newReward = createActivateSpritePackReward('', { targetMode: 'self' });
        break;
      case 'conditional_sprite_collection':
        newReward = {
          id: `threshold-reward-${Date.now().toString(36)}`,
          type: 'conditional_sprite_collection',
          conditional_sprite_collection: {
            collectionId: '',
            targetMode: 'self',
          }
        };
        break;
      default:
        newReward = createTriggerReward('sprite', '', 'self');
    }
    updateEffect({ rewards: [...localEffect.rewards, newReward] });
  };

  const removeReward = (idx: number) => {
    updateEffect({ rewards: localEffect.rewards.filter((_, i) => i !== idx) });
  };

  const updateReward = (idx: number, updatedReward: QuestReward) => {
    const updated = [...localEffect.rewards];
    updated[idx] = updatedReward;
    updateEffect({ rewards: updated });
  };

  // Operator display helper
  const operatorSymbol = (op: RequirementOperator) => {
    switch (op) {
      case '<': return '< Menor que';
      case '<=': return '≤ Menor o igual';
      case '>': return '> Mayor que';
      case '>=': return '≥ Mayor o igual';
      case '==': return '= Igual a';
      case '!=': return '≠ Diferente de';
      case 'between': return '↔ Entre';
      case 'contains': return '∋ Contiene';
      case 'not_contains': return '∌ No contiene';
      default: return op;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            Editar Efecto de Umbral
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Name & Priority */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs font-medium">Nombre del Efecto</Label>
              <Input
                value={localEffect.name}
                onChange={(e) => updateEffect({ name: e.target.value })}
                placeholder="Ej: Vida Crítica, Maná Lleno..."
                className="bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1">
                <ArrowUpNarrowWide className="w-3 h-3" /> Prioridad
              </Label>
              <Input
                type="number"
                value={localEffect.priority}
                onChange={(e) => updateEffect({ priority: Number(e.target.value) })}
                className="bg-background"
              />
              <p className="text-[10px] text-muted-foreground">Mayor = más importante</p>
            </div>
          </div>

          {/* Enabled toggle */}
          <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
            <Switch
              checked={localEffect.enabled}
              onCheckedChange={(checked) => updateEffect({ enabled: checked })}
            />
            <Label className="text-sm">{localEffect.enabled ? '✅ Activado' : '⏸ Desactivado'}</Label>
          </div>

          {/* Conditions Section */}
          <div className="space-y-3 p-3 bg-purple-500/5 rounded-lg border border-purple-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                <Label className="text-sm font-medium text-purple-400">Condiciones</Label>
                <Badge variant="outline" className="text-[10px] text-purple-300 border-purple-500/30">
                  {localEffect.conditions.length} {localEffect.conditions.length === 1 ? 'regla' : 'reglas'}
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-purple-500/30 hover:bg-purple-500/10"
                onClick={addCondition}
              >
                <Plus className="w-3 h-3 mr-1" /> Condición
              </Button>
            </div>

            {localEffect.conditions.length === 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                <p>Sin condiciones. Agrega una para definir cuándo se activa este efecto.</p>
                <p className="text-xs mt-1">Ej: Vida ≤ 20, Maná ≥ 80</p>
              </div>
            )}

            {localEffect.conditions.map((cond, condIdx) => (
              <div key={condIdx} className="p-2 bg-background rounded border border-purple-500/10 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] text-purple-300 border-purple-500/30">
                    Condición {condIdx + 1}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    onClick={() => removeCondition(condIdx)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>

                <div className="grid grid-cols-[1fr_140px_1fr] gap-2">
                  {/* Attribute selector */}
                  <Select
                    value={cond.targetCharacterId ? `__target__:${cond.targetCharacterId}:${cond.attributeKey}` : cond.attributeKey}
                    onValueChange={(v) => {
                      if (v.startsWith('__target__:')) {
                        const parts = v.split(':');
                        updateCondition(condIdx, { targetCharacterId: parts[1], attributeKey: parts[2] });
                      } else {
                        updateCondition(condIdx, { attributeKey: v, targetCharacterId: undefined, targetAttributeName: undefined });
                      }
                    }}
                  >
                    <SelectTrigger className="bg-background h-8 text-xs">
                      <SelectValue placeholder="Atributo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={attributeKey}>
                        🔢 {allAttributes.find(a => a.key === attributeKey)?.name || attributeKey} (self)
                      </SelectItem>
                      {allAttributes.filter(a => a.key !== attributeKey).map(attr => (
                        <SelectItem key={attr.key} value={attr.key}>
                          {attr.type === 'number' ? '🔢' : attr.type === 'keyword' ? '🏷️' : '📝'} {attr.name}
                        </SelectItem>
                      ))}
                      {availableTargets.length > 0 && (
                        <>
                          <SelectItem value="__separator__" disabled className="text-[10px] text-muted-foreground">
                            ─── Otros personajes ───
                          </SelectItem>
                          {availableTargets.flatMap(t =>
                            t.attributes.map(attr => ({
                              value: `__target__:${t.id}:${attr.key}`,
                              label: `${t.id === '__user__' ? '👤' : '🎭'} ${t.name} → ${attr.name}`,
                            }))
                          ).map(item => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>

                  {/* Operator selector */}
                  <Select
                    value={cond.operator}
                    onValueChange={(v) => updateCondition(condIdx, { operator: v as RequirementOperator })}
                  >
                    <SelectTrigger className="bg-background h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="<">{'< Menor que'}</SelectItem>
                      <SelectItem value="<=">{'≤ Menor o igual'}</SelectItem>
                      <SelectItem value=">">{'> Mayor que'}</SelectItem>
                      <SelectItem value=">=">{'≥ Mayor o igual'}</SelectItem>
                      <SelectItem value="==">{'= Igual a'}</SelectItem>
                      <SelectItem value="!=">{'≠ Diferente de'}</SelectItem>
                      <SelectItem value="between">{'↔ Entre'}</SelectItem>
                      <SelectItem value="contains">{'∋ Contiene'}</SelectItem>
                      <SelectItem value="not_contains">{'∌ No contiene'}</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Value input */}
                  {cond.operator === 'between' ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={typeof cond.value === 'number' ? cond.value : Number(cond.value) || 0}
                        onChange={(e) => updateCondition(condIdx, { value: Number(e.target.value) })}
                        placeholder="Min"
                        className="bg-background h-8 text-xs"
                      />
                      <span className="text-xs text-muted-foreground">y</span>
                      <Input
                        type="number"
                        value={cond.valueMax || 0}
                        onChange={(e) => updateCondition(condIdx, { valueMax: Number(e.target.value) })}
                        placeholder="Max"
                        className="bg-background h-8 text-xs"
                      />
                    </div>
                  ) : (
                    <Input
                      type={allAttributes.find(a => a.key === cond.attributeKey)?.type === 'number' || !isNaN(Number(cond.value)) ? 'number' : 'text'}
                      value={cond.value}
                      onChange={(e) => {
                        const v = e.target.value;
                        const attrType = allAttributes.find(a => a.key === cond.attributeKey)?.type;
                        updateCondition(condIdx, { value: attrType === 'number' || !isNaN(Number(v)) ? Number(v) : v });
                      }}
                      placeholder="Valor"
                      className="bg-background h-8 text-xs"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Rewards Section */}
          <div className="space-y-3 p-3 bg-amber-500/5 rounded-lg border border-amber-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gift className="w-4 h-4 text-amber-400" />
                <Label className="text-sm font-medium text-amber-400">Recompensas</Label>
                <Badge variant="outline" className="text-[10px] text-amber-300 border-amber-500/30">
                  {localEffect.rewards.length} {localEffect.rewards.length === 1 ? 'recompensa' : 'recompensas'}
                </Badge>
              </div>
            </div>

            {/* Add reward buttons */}
            <div className="flex flex-wrap gap-1.5">
              <Button variant="outline" size="sm" className="h-6 text-[10px] border-purple-500/30 hover:bg-purple-500/10" onClick={() => addReward('trigger')}>
                <Plus className="w-2.5 h-2.5 mr-0.5" /> ⚡ Efecto
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] text-amber-400 hover:bg-amber-500/10 border border-dashed border-amber-500/30" onClick={() => addReward('attribute')}>
                <Plus className="w-2.5 h-2.5 mr-0.5" /> 📊 Atributo
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] text-blue-400 hover:bg-blue-500/10 border border-dashed border-blue-500/30" onClick={() => addReward('target_attribute')}>
                <Plus className="w-2.5 h-2.5 mr-0.5" /> 🔗 Atributo Target
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] text-amber-400 hover:bg-amber-500/10 border border-dashed border-amber-500/30" onClick={() => addReward('currency')}>
                <Plus className="w-2.5 h-2.5 mr-0.5" /> 💰 Divisa
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] text-emerald-400 hover:bg-emerald-500/10 border border-dashed border-emerald-500/30" onClick={() => addReward('activate_sprite_pack')}>
                <Plus className="w-2.5 h-2.5 mr-0.5" /> 🎨 Sprite Pack
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] text-cyan-400 hover:bg-cyan-500/10 border border-dashed border-cyan-500/30" onClick={() => addReward('conditional_sprite_collection')}>
                <Plus className="w-2.5 h-2.5 mr-0.5" /> 🖼️ Colección Condicional
              </Button>
            </div>

            {localEffect.rewards.length === 0 && (
              <div className="text-center py-3 text-sm text-muted-foreground">
                Sin recompensas. Agrega efectos, atributos o sprite packs.
              </div>
            )}

            {localEffect.rewards.map((reward, rewardIdx) => {
              const normalized = normalizeReward(reward);
              const isTrig = normalized.type === 'trigger';
              const isAttr = normalized.type === 'attribute';
              const isTargetAttr = normalized.type === 'target_attribute';
              const isCurrency = normalized.type === 'currency';
              const isSpritePack = normalized.type === 'activate_sprite_pack';
              const isCondSprite = normalized.type === 'conditional_sprite_collection';

              return (
                <div key={reward.id} className={`p-2.5 rounded border space-y-2 ${
                  isSpritePack ? 'bg-emerald-500/5 border-emerald-500/10' :
                  isCondSprite ? 'bg-cyan-500/5 border-cyan-500/10' :
                  isAttr ? 'bg-amber-500/5 border-amber-500/10' :
                  isTargetAttr ? 'bg-blue-500/5 border-blue-500/10' :
                  isCurrency ? 'bg-amber-500/5 border-amber-500/10' :
                  'bg-purple-500/5 border-purple-500/10'
                }`}>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] ${
                      isSpritePack ? 'text-emerald-400 border-emerald-500/30' :
                      isCondSprite ? 'text-cyan-400 border-cyan-500/30' :
                      isAttr ? 'text-amber-400 border-amber-500/30' :
                      isTargetAttr ? 'text-blue-400 border-blue-500/30' :
                      isCurrency ? 'text-amber-400 border-amber-500/30' :
                      'text-purple-400 border-purple-500/30'
                    }`}>
                      {isSpritePack ? '🎨 Sprite Pack' : isCondSprite ? '🖼️ Col. Condicional' : isAttr ? '📊 Atributo' : isTargetAttr ? '🔗 Atributo Target' : isCurrency ? '💰 Divisa' : '⚡ Trigger'}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {describeReward(normalized)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 text-red-400 hover:bg-red-500/10"
                      onClick={() => removeReward(rewardIdx)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>

                  {/* Trigger reward editor */}
                  {isTrig && normalized.trigger && (
                    <div className="grid grid-cols-3 gap-2">
                      <Select
                        value={normalized.trigger.category}
                        onValueChange={(v) => updateReward(rewardIdx, { ...reward, trigger: { ...normalized.trigger!, category: v as TriggerCategory } })}
                      >
                        <SelectTrigger className="bg-background h-7 text-xs">
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
                        onChange={(e) => updateReward(rewardIdx, { ...reward, trigger: { ...normalized.trigger!, key: e.target.value } })}
                        placeholder="Key"
                        className="bg-background h-7 text-xs"
                      />
                      <Select
                        value={normalized.trigger.targetMode}
                        onValueChange={(v) => updateReward(rewardIdx, { ...reward, trigger: { ...normalized.trigger!, targetMode: v as TriggerTargetMode } })}
                      >
                        <SelectTrigger className="bg-background h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="self">👤 Self</SelectItem>
                          <SelectItem value="all">👥 Todos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Attribute reward editor */}
                  {isAttr && normalized.attribute && (
                    <div className="grid grid-cols-3 gap-2">
                      <Select
                        value={normalized.attribute.key}
                        onValueChange={(v) => updateReward(rewardIdx, { ...reward, attribute: { ...normalized.attribute!, key: v } })}
                      >
                        <SelectTrigger className="bg-background h-7 text-xs">
                          <SelectValue placeholder="Atributo" />
                        </SelectTrigger>
                        <SelectContent>
                          {allAttributes.map(attr => (
                            <SelectItem key={attr.key} value={attr.key}>{attr.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={normalized.attribute.action}
                        onValueChange={(v) => updateReward(rewardIdx, { ...reward, attribute: { ...normalized.attribute!, action: v as any } })}
                      >
                        <SelectTrigger className="bg-background h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="set">= Set</SelectItem>
                          <SelectItem value="add">+ Sumar</SelectItem>
                          <SelectItem value="subtract">- Restar</SelectItem>
                          <SelectItem value="multiply">×</SelectItem>
                          <SelectItem value="divide">÷ Dividir</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        value={normalized.attribute.value}
                        onChange={(e) => updateReward(rewardIdx, { ...reward, attribute: { ...normalized.attribute!, value: Number(e.target.value) } })}
                        placeholder="Valor"
                        className="bg-background h-7 text-xs"
                      />
                    </div>
                  )}

                  {/* Target Attribute reward editor */}
                  {isTargetAttr && normalized.target_attribute && (
                    <div className="space-y-2">
                      <Select
                        value={normalized.target_attribute.targetCharacterId}
                        onValueChange={(v) => updateReward(rewardIdx, { ...reward, target_attribute: { ...normalized.target_attribute!, targetCharacterId: v, key: '', value: 0 } })}
                      >
                        <SelectTrigger className="bg-background h-7 text-xs">
                          <SelectValue placeholder="Target..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableTargets.map(t => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.id === '__user__' ? '👤 ' : '🎭 '}{t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {normalized.target_attribute.targetCharacterId && (() => {
                        const selectedTarget = availableTargets.find(t => t.id === normalized.target_attribute!.targetCharacterId);
                        const targetAttrs = selectedTarget?.attributes || [];
                        const isNumeric = targetAttrs.find(a => a.key === normalized.target_attribute!.key)?.type === 'number';
                        return (
                          <div className="grid grid-cols-3 gap-2">
                            <Select value={normalized.target_attribute.key} onValueChange={(v) => updateReward(rewardIdx, { ...reward, target_attribute: { ...normalized.target_attribute!, key: v } })}>
                              <SelectTrigger className="bg-background h-7 text-xs"><SelectValue placeholder="Atributo" /></SelectTrigger>
                              <SelectContent>
                                {targetAttrs.map((a, i) => <SelectItem key={a.key || `a-${i}`} value={a.key}>{a.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            {isNumeric ? (
                              <Select value={normalized.target_attribute.action} onValueChange={(v) => updateReward(rewardIdx, { ...reward, target_attribute: { ...normalized.target_attribute!, action: v as any } })}>
                                <SelectTrigger className="bg-background h-7 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="set">= Set</SelectItem>
                                  <SelectItem value="add">+ Sumar</SelectItem>
                                  <SelectItem value="subtract">- Restar</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : <div className="flex items-center justify-center"><span className="text-[10px] text-muted-foreground">= Set</span></div>}
                            <Input
                              type={isNumeric ? 'number' : 'text'}
                              value={normalized.target_attribute.value}
                              onChange={(e) => updateReward(rewardIdx, { ...reward, target_attribute: { ...normalized.target_attribute!, value: isNumeric ? Number(e.target.value) : e.target.value } })}
                              placeholder={isNumeric ? 'Valor' : 'Texto'}
                              className="bg-background h-7 text-xs"
                            />
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Currency reward editor */}
                  {isCurrency && normalized.currency && (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Cantidad:</Label>
                      <Input
                        type="number"
                        value={normalized.currency.amount}
                        onChange={(e) => updateReward(rewardIdx, { ...reward, type: 'currency', currency: { amount: Number(e.target.value) } })}
                        className="bg-background h-7 text-xs w-24"
                      />
                      <span className="text-xs text-muted-foreground">divisa para persona</span>
                    </div>
                  )}

                  {/* Sprite Pack reward editor */}
                  {isSpritePack && normalized.activate_sprite_pack && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Modo Target</Label>
                          <Select
                            value={normalized.activate_sprite_pack.targetMode || 'self'}
                            onValueChange={(v) => updateReward(rewardIdx, {
                              ...reward,
                              type: 'activate_sprite_pack',
                              activate_sprite_pack: {
                                ...normalized.activate_sprite_pack!,
                                targetMode: v as TriggerTargetMode,
                                targetCharacterId: v === 'target' ? normalized.activate_sprite_pack!.targetCharacterId : undefined,
                                targetPackId: v === 'target' ? normalized.activate_sprite_pack!.targetPackId : undefined,
                                fallbackPackId: v === 'self' ? normalized.activate_sprite_pack!.fallbackPackId : undefined,
                              }
                            })}
                          >
                            <SelectTrigger className="bg-background h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="self">👤 Self</SelectItem>
                              <SelectItem value="all">👥 Todos</SelectItem>
                              <SelectItem value="target">🎯 Target</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Sprite Pack</Label>
                          <Select
                            value={normalized.activate_sprite_pack.packId}
                            onValueChange={(v) => updateReward(rewardIdx, {
                              ...reward,
                              type: 'activate_sprite_pack',
                              activate_sprite_pack: { ...normalized.activate_sprite_pack!, packId: v }
                            })}
                          >
                            <SelectTrigger className="bg-background h-7 text-xs"><SelectValue placeholder="Seleccionar pack..." /></SelectTrigger>
                            <SelectContent>
                              {(spritePacksV2 || []).map(p => (
                                <SelectItem key={p.id} value={p.id}>
                                  🎨 {p.name} {p.conditionalMode ? '(condicional)' : `(${p.sprites.length} sprites)`}
                                </SelectItem>
                              ))}
                              {(spritePacksV2 || []).length === 0 && (
                                <SelectItem value="__none__" disabled>Sin packs disponibles</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Self mode: fallback options */}
                      {(normalized.activate_sprite_pack.targetMode || 'self') === 'self' && normalized.activate_sprite_pack.packId && (
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Fallback Pack</Label>
                            <Select
                              value={normalized.activate_sprite_pack.fallbackPackId || '__none__'}
                              onValueChange={(v) => updateReward(rewardIdx, {
                                ...reward,
                                type: 'activate_sprite_pack',
                                activate_sprite_pack: {
                                  ...normalized.activate_sprite_pack!,
                                  fallbackPackId: v === '__none__' ? undefined : v,
                                  fallbackMode: v === '__none__' ? normalized.activate_sprite_pack!.fallbackMode : 'custom_sprite' as const,
                                }
                              })}
                            >
                              <SelectTrigger className="bg-background h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Ninguno</SelectItem>
                                {(spritePacksV2 || []).filter(p => p.id !== normalized.activate_sprite_pack!.packId).map(p => (
                                  <SelectItem key={p.id} value={p.id}>🎨 {p.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Idle (ms)</Label>
                            <Input
                              type="number"
                              value={normalized.activate_sprite_pack.returnToIdleMs || 0}
                              onChange={(e) => updateReward(rewardIdx, {
                                ...reward,
                                type: 'activate_sprite_pack',
                                activate_sprite_pack: { ...normalized.activate_sprite_pack!, returnToIdleMs: Number(e.target.value) }
                              })}
                              className="bg-background h-7 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Fallback</Label>
                            <Select
                              value={normalized.activate_sprite_pack.fallbackMode || 'idle_collection'}
                              onValueChange={(v) => updateReward(rewardIdx, {
                                ...reward,
                                type: 'activate_sprite_pack',
                                activate_sprite_pack: { ...normalized.activate_sprite_pack!, fallbackMode: v as TriggerFallbackMode }
                              })}
                            >
                              <SelectTrigger className="bg-background h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="idle_collection">Colección Idle</SelectItem>
                                <SelectItem value="default_pack">Pack Default</SelectItem>
                                <SelectItem value="custom_sprite">Custom</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}

                      {/* Target mode: target character + pack */}
                      {normalized.activate_sprite_pack.targetMode === 'target' && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Personaje Target</Label>
                            <Select
                              value={normalized.activate_sprite_pack.targetCharacterId || ''}
                              onValueChange={(v) => updateReward(rewardIdx, {
                                ...reward,
                                type: 'activate_sprite_pack',
                                activate_sprite_pack: { ...normalized.activate_sprite_pack!, targetCharacterId: v }
                              })}
                            >
                              <SelectTrigger className="bg-background h-7 text-xs"><SelectValue placeholder="Target..." /></SelectTrigger>
                              <SelectContent>
                                {availableTargets.map(t => (
                                  <SelectItem key={t.id} value={t.id}>
                                    {t.id === '__user__' ? '👤 ' : '🎭 '}{t.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Pack del Target</Label>
                            <Select
                              value={normalized.activate_sprite_pack.targetPackId || ''}
                              onValueChange={(v) => updateReward(rewardIdx, {
                                ...reward,
                                type: 'activate_sprite_pack',
                                activate_sprite_pack: { ...normalized.activate_sprite_pack!, targetPackId: v }
                              })}
                            >
                              <SelectTrigger className="bg-background h-7 text-xs"><SelectValue placeholder="Pack del target..." /></SelectTrigger>
                              <SelectContent>
                                {(spritePacksV2 || []).map(p => (
                                  <SelectItem key={p.id} value={p.id}>🎨 {p.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}

                      {/* Pack preview */}
                      {normalized.activate_sprite_pack.packId && (() => {
                        const selectedPack = (spritePacksV2 || []).find(p => p.id === normalized.activate_sprite_pack!.packId);
                        if (!selectedPack) return null;
                        return (
                          <div className="text-[10px] text-muted-foreground p-1.5 bg-background/50 rounded">
                            Pack: {selectedPack.name} • {selectedPack.sprites.length} sprites • {selectedPack.conditionalMode ? 'Modo Condicional' : `Comportamiento: ${selectedPack.behavior || 'principal'}`}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Conditional Sprite Collection reward editor */}
                  {isCondSprite && normalized.conditional_sprite_collection && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Modo Target</Label>
                          <Select
                            value={normalized.conditional_sprite_collection.targetMode || 'self'}
                            onValueChange={(v) => updateReward(rewardIdx, {
                              ...reward,
                              type: 'conditional_sprite_collection',
                              conditional_sprite_collection: { ...normalized.conditional_sprite_collection!, targetMode: v as TriggerTargetMode }
                            })}
                          >
                            <SelectTrigger className="bg-background h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="self">👤 Self</SelectItem>
                              <SelectItem value="all">👥 Todos</SelectItem>
                              <SelectItem value="target">🎯 Target</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Idle / Fallback</Label>
                          <div className="flex gap-1">
                            <Input
                              type="number"
                              value={normalized.conditional_sprite_collection.returnToIdleMs || 0}
                              onChange={(e) => updateReward(rewardIdx, {
                                ...reward,
                                type: 'conditional_sprite_collection',
                                conditional_sprite_collection: { ...normalized.conditional_sprite_collection!, returnToIdleMs: Number(e.target.value) }
                              })}
                              placeholder="ms"
                              className="bg-background h-7 text-xs w-16"
                            />
                            <Select
                              value={normalized.conditional_sprite_collection.fallbackMode || 'idle_collection'}
                              onValueChange={(v) => updateReward(rewardIdx, {
                                ...reward,
                                type: 'conditional_sprite_collection',
                                conditional_sprite_collection: { ...normalized.conditional_sprite_collection!, fallbackMode: v as TriggerFallbackMode }
                              })}
                            >
                              <SelectTrigger className="bg-background h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="idle_collection">Idle</SelectItem>
                                <SelectItem value="default_pack">Default</SelectItem>
                                <SelectItem value="custom_sprite">Custom</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => { onSave(localEffect); onOpenChange(false); }}>
            Guardar Cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Threshold Effects Section - Card list + Add/Edit/Delete
// ============================================

interface ThresholdEffectsSectionProps {
  attribute: AttributeDefinition;
  index: number;
  onChange: (index: number, updates: Partial<AttributeDefinition>) => void;
  allAttributes: AttributeDefinition[];
  availableTargets: StatsEditorProps['availableTargets'];
  spritePacksV2?: SpritePackV2[];
}

function ThresholdEffectsSection({ attribute, index, onChange, allAttributes, availableTargets, spritePacksV2 }: ThresholdEffectsSectionProps) {
  const [editingEffect, setEditingEffect] = useState<ThresholdEffect | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Migrate old onMinReached/onMaxReached to new thresholdEffects
  const effects: ThresholdEffect[] = attribute.thresholdEffects || [];

  // Auto-migrate old format if no new format exists
  const needsMigration = !attribute.thresholdEffects && (attribute.onMinReached?.enabled || attribute.onMaxReached?.enabled);

  const handleMigrate = () => {
    const migrated: ThresholdEffect[] = [];
    if (attribute.onMinReached?.enabled && attribute.onMinReached.rewards.length > 0) {
      migrated.push({
        id: `migrated-min-${Date.now().toString(36)}`,
        name: `Al mínimo (${attribute.min ?? 0})`,
        enabled: true,
        priority: 0,
        conditions: [{
          attributeKey: attribute.key,
          operator: '<=',
          value: attribute.min ?? 0,
        }],
        rewards: attribute.onMinReached.rewards,
      });
    }
    if (attribute.onMaxReached?.enabled && attribute.onMaxReached.rewards.length > 0) {
      migrated.push({
        id: `migrated-max-${Date.now().toString(36)}`,
        name: `Al máximo (${attribute.max ?? 100})`,
        enabled: true,
        priority: 0,
        conditions: [{
          attributeKey: attribute.key,
          operator: '>=',
          value: attribute.max ?? 100,
        }],
        rewards: attribute.onMaxReached.rewards,
      });
    }
    onChange(index, {
      thresholdEffects: migrated,
      onMinReached: undefined,
      onMaxReached: undefined,
    });
  };

  const addEffect = () => {
    const newEffect: ThresholdEffect = {
      id: `threshold-${Date.now().toString(36)}`,
      name: '',
      enabled: true,
      priority: effects.length,
      conditions: [{
        attributeKey: attribute.key,
        operator: '<=',
        value: 0,
      }],
      rewards: [],
    };
    setEditingEffect(newEffect);
    setDialogOpen(true);
  };

  const editEffect = (effect: ThresholdEffect) => {
    setEditingEffect({ ...effect });
    setDialogOpen(true);
  };

  const saveEffect = (updatedEffect: ThresholdEffect) => {
    const existingIdx = effects.findIndex(e => e.id === updatedEffect.id);
    let updatedEffects: ThresholdEffect[];
    if (existingIdx >= 0) {
      updatedEffects = effects.map(e => e.id === updatedEffect.id ? updatedEffect : e);
    } else {
      updatedEffects = [...effects, updatedEffect];
    }
    onChange(index, { thresholdEffects: updatedEffects });
  };

  const deleteEffect = (effectId: string) => {
    onChange(index, { thresholdEffects: effects.filter(e => e.id !== effectId) });
  };

  const toggleEffect = (effectId: string) => {
    onChange(index, {
      thresholdEffects: effects.map(e => e.id === effectId ? { ...e, enabled: !e.enabled } : e)
    });
  };

  // Describe a condition for the card summary
  const describeCondition = (cond: StatRequirement) => {
    const attrName = cond.targetCharacterId
      ? (availableTargets.find(t => t.id === cond.targetCharacterId)?.name || cond.targetCharacterId) + ' → ' + (cond.targetAttributeName || cond.attributeKey)
      : (allAttributes.find(a => a.key === cond.attributeKey)?.name || cond.attributeKey);
    const opSymbol: Record<string, string> = { '<': '<', '<=': '≤', '>': '>', '>=': '≥', '==': '=', '!=': '≠', 'between': '↔', 'contains': '∋', 'not_contains': '∌' };
    if (cond.operator === 'between') {
      return `${attrName} ${opSymbol[cond.operator]} ${cond.value} y ${cond.valueMax}`;
    }
    return `${attrName} ${opSymbol[cond.operator] || cond.operator} ${cond.value}`;
  };

  return (
    <div className="space-y-3 p-3 bg-purple-500/5 rounded-lg border border-purple-500/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <Label className="text-xs font-medium text-purple-400">Efectos de Umbral</Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>Efectos que se activan cuando el atributo cumple ciertas condiciones.</p>
              <p className="mt-1 text-xs text-muted-foreground">• Condiciones flexibles: ≤, ≥, &lt;, &gt;, =, ≠, entre</p>
              <p className="text-xs text-muted-foreground">• Prioridad: el efecto con mayor prioridad gana</p>
              <p className="text-xs text-muted-foreground">• Recompensas: Sprites, atributos, sonidos, fondos, sprite packs</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-[10px] border-purple-500/30 hover:bg-purple-500/10"
          onClick={addEffect}
        >
          <Plus className="w-2.5 h-2.5 mr-0.5" /> Agregar Umbral
        </Button>
      </div>

      {/* Migration banner */}
      {needsMigration && (
        <div className="flex items-center gap-2 p-2 bg-amber-500/10 rounded border border-amber-500/20 text-xs">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-amber-300">Existen efectos de umbral en formato antiguo (min/max).</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 text-[10px] text-amber-300 hover:bg-amber-500/10 ml-auto shrink-0"
            onClick={handleMigrate}
          >
            Migrar al nuevo formato
          </Button>
        </div>
      )}

      {/* Effects list */}
      {effects.length === 0 && !needsMigration && (
        <div className="text-center py-3 text-xs text-muted-foreground">
          Sin efectos de umbral. Agrega uno para activar efectos cuando cambie este atributo.
        </div>
      )}

      <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
        {effects.map(effect => (
          <div
            key={effect.id}
            className={`p-2.5 rounded-lg border transition-colors ${
              effect.enabled
                ? 'bg-purple-500/5 border-purple-500/15 hover:border-purple-500/30'
                : 'bg-muted/30 border-muted/20 opacity-60'
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Switch
                checked={effect.enabled}
                onCheckedChange={() => toggleEffect(effect.id)}
                className="scale-75"
              />
              <span className={`text-sm font-medium ${effect.enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                {effect.name || 'Sin nombre'}
              </span>
              {effect.priority > 0 && (
                <Badge variant="outline" className="text-[9px] text-amber-400 border-amber-500/30">
                  ⬆ Prio: {effect.priority}
                </Badge>
              )}
              <div className="ml-auto flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-purple-400 hover:bg-purple-500/10"
                  onClick={() => editEffect(effect)}
                >
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-red-400 hover:bg-red-500/10"
                  onClick={() => deleteEffect(effect.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* Condition summary */}
            <div className="flex flex-wrap gap-1 mb-1.5">
              {effect.conditions.map((cond, ci) => (
                <Badge key={ci} variant="outline" className="text-[9px] text-purple-300 border-purple-500/20 bg-purple-500/5">
                  {describeCondition(cond)}
                </Badge>
              ))}
            </div>

            {/* Reward summary */}
            <div className="flex flex-wrap gap-1">
              {effect.rewards.map((reward, ri) => {
                const normalized = normalizeReward(reward);
                return (
                  <Badge key={ri} variant="outline" className={`text-[9px] ${
                    normalized.type === 'activate_sprite_pack' ? 'text-emerald-400 border-emerald-500/20' :
                    normalized.type === 'conditional_sprite_collection' ? 'text-cyan-400 border-cyan-500/20' :
                    normalized.type === 'attribute' ? 'text-amber-400 border-amber-500/20' :
                    normalized.type === 'target_attribute' ? 'text-blue-400 border-blue-500/20' :
                    normalized.type === 'currency' ? 'text-amber-400 border-amber-500/20' :
                    'text-purple-400 border-purple-500/20'
                  }`}>
                    {normalized.type === 'activate_sprite_pack' ? '🎨' :
                     normalized.type === 'conditional_sprite_collection' ? '🖼️' :
                     normalized.type === 'attribute' ? '📊' :
                     normalized.type === 'target_attribute' ? '🔗' :
                     normalized.type === 'currency' ? '💰' : '⚡'} {describeReward(normalized)}
                  </Badge>
                );
              })}
              {effect.rewards.length === 0 && (
                <span className="text-[10px] text-muted-foreground italic">Sin recompensas</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Threshold Effect Edit Dialog */}
      {editingEffect && (
        <ThresholdEffectDialog
          effect={editingEffect}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSave={saveEffect}
          allAttributes={allAttributes}
          availableTargets={availableTargets}
          spritePacksV2={spritePacksV2}
          attributeKey={attribute.key}
        />
      )}
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
  availableTargets?: StatsEditorProps['availableTargets'];
  spritePacksV2?: SpritePackV2[];  // for activate_sprite_pack reward
  onChange: (index: number, updates: Partial<SkillDefinition>) => void;
  onDelete: (index: number) => void;
}

function SkillEditor({ skill, index, availableAttributes, availableObjectives = [], availableSolicitudes = [], availableTargets = [], spritePacksV2, onChange, onDelete }: SkillEditorProps) {
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
              <Label className="text-xs">Descripción completado</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Texto que se guarda y se inyecta en el LLM cuando la acción se realiza.</p>
                  <p className="mt-1 text-xs text-muted-foreground">Si se deja vacío, se usará la Descripción normal.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Textarea
              value={skill.completedDescription || ''}
              onChange={(e) => onChange(index, { completedDescription: e.target.value || undefined })}
              placeholder="Texto que aparece cuando la acción se realiza..."
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
                  availableTargets={availableTargets}
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
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs border-blue-500/30 hover:bg-blue-500/10"
                  onClick={() => {
                    const newReward = createTargetAttributeReward('', '', 0, 'set', { id: `skill-reward-${Date.now().toString(36)}` });
                    onChange(index, { activationRewards: [...(skill.activationRewards || []), newReward] });
                  }}
                >
                  <Plus className="w-3 h-3 mr-1" /> 🔗 Atributo Target
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs border-amber-500/30 hover:bg-amber-500/10"
                  onClick={() => {
                    const newReward = createCurrencyReward(0, { id: `skill-reward-${Date.now().toString(36)}` });
                    onChange(index, { activationRewards: [...(skill.activationRewards || []), newReward] });
                  }}
                >
                  <Plus className="w-3 h-3 mr-1" /> 💰 Divisa
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs border-purple-500/30 hover:bg-purple-500/10"
                  onClick={() => {
                    const newReward = createActivateSpritePackReward('', { id: `skill-reward-${Date.now().toString(36)}` });
                    onChange(index, { activationRewards: [...(skill.activationRewards || []), newReward] });
                  }}
                >
                  <Plus className="w-3 h-3 mr-1" /> 🎨 Sprite Pack
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              {(skill.activationRewards || []).map((reward, rewardIdx) => {
                const normalized = normalizeReward(reward);
                const isTrig = normalized.type === 'trigger';
                const isObj = normalized.type === 'objective';
                const isSol = normalized.type === 'solicitud';
                const isTargetAttr = normalized.type === 'target_attribute';
                const isCurrency = normalized.type === 'currency';
                const isActivateSpritePack = normalized.type === 'activate_sprite_pack';

                return (
                  <div key={reward.id} className={`p-2 rounded border space-y-2 ${isObj ? 'bg-amber-500/5 border-amber-500/10' : isSol ? 'bg-violet-500/5 border-violet-500/10' : isTargetAttr ? 'bg-blue-500/5 border-blue-500/10' : isCurrency ? 'bg-amber-500/5 border-amber-500/10' : isActivateSpritePack ? 'bg-purple-500/5 border-purple-500/10' : 'bg-green-500/5 border-green-500/10'}`}>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${isObj ? 'text-amber-400 border-amber-500/30' : isSol ? 'text-violet-400 border-violet-500/30' : isTargetAttr ? 'text-blue-400 border-blue-500/30' : isCurrency ? 'text-amber-400 border-amber-500/30' : isActivateSpritePack ? 'text-purple-400 border-purple-500/30' : 'text-green-400 border-green-500/30'}`}>
                        {isObj ? '🎯 Objetivo' : isSol ? '📋 Solicitud' : isTargetAttr ? '🔗 Atributo Target' : isCurrency ? '💰 Divisa' : isActivateSpritePack ? '🎨 Sprite Pack' : '⚡ Trigger'}
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
                                  objectiveId: selectedObj?.objectiveId,
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
                    {/* Target Attribute Reward Editor */}
                    {isTargetAttr && normalized.target_attribute && (
                      <div className="space-y-2">
                        {/* Target selection dropdown */}
                        <div className="grid grid-cols-2 gap-1">
                          <div className="col-span-2">
                            <Label className="text-[10px] text-muted-foreground mb-1 block">Target (personaje o persona)</Label>
                            <Select
                              value={normalized.target_attribute.targetCharacterId}
                              onValueChange={(v) => {
                                const updatedRewards = [...(skill.activationRewards || [])];
                                updatedRewards[rewardIdx] = {
                                  ...reward,
                                  target_attribute: { ...normalized.target_attribute!, targetCharacterId: v, key: '', value: 0 }
                                };
                                onChange(index, { activationRewards: updatedRewards });
                              }}
                            >
                              <SelectTrigger className="bg-background h-6 text-xs">
                                <SelectValue placeholder="Seleccionar target..." />
                              </SelectTrigger>
                              <SelectContent>
                                {availableTargets.map(t => (
                                  <SelectItem key={t.id} value={t.id}>
                                    {t.id === '__user__' ? '👤 ' : '🎭 '}{t.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Attribute selection + action + value */}
                        {normalized.target_attribute.targetCharacterId && (() => {
                          const selectedTarget = availableTargets.find(t => t.id === normalized.target_attribute!.targetCharacterId);
                          const targetAttrs = selectedTarget?.attributes || [];
                          const selectedAttr = targetAttrs.find(a => a.key === normalized.target_attribute!.key);
                          const isNumeric = selectedAttr?.type === 'number';

                          return (
                            <div className="grid grid-cols-3 gap-2">
                              {/* Attribute key */}
                              <Select
                                value={normalized.target_attribute.key}
                                onValueChange={(v) => {
                                  const attr = targetAttrs.find(a => a.key === v);
                                  const updatedRewards = [...(skill.activationRewards || [])];
                                  updatedRewards[rewardIdx] = {
                                    ...reward,
                                    target_attribute: { ...normalized.target_attribute!, key: v, value: attr?.type === 'number' ? 0 : '' }
                                  };
                                  onChange(index, { activationRewards: updatedRewards });
                                }}
                              >
                                <SelectTrigger className="bg-background h-6 text-xs">
                                  <SelectValue placeholder="Atributo..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {targetAttrs.map((attr, i) => (
                                    <SelectItem key={attr.key || `attr-${i}`} value={attr.key}>
                                      {attr.name} ({attr.key})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              {/* Action (only for numeric) */}
                              {isNumeric ? (
                                <Select
                                  value={normalized.target_attribute.action}
                                  onValueChange={(v) => {
                                    const updatedRewards = [...(skill.activationRewards || [])];
                                    updatedRewards[rewardIdx] = {
                                      ...reward,
                                      target_attribute: { ...normalized.target_attribute!, action: v as any }
                                    };
                                    onChange(index, { activationRewards: updatedRewards });
                                  }}
                                >
                                  <SelectTrigger className="bg-background h-6 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="set">= Set</SelectItem>
                                    <SelectItem value="add">+ Sumar</SelectItem>
                                    <SelectItem value="subtract">- Restar</SelectItem>
                                    <SelectItem value="multiply">×</SelectItem>
                                    <SelectItem value="divide">÷ Dividir</SelectItem>
                                    <SelectItem value="percent">% Porcentaje</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <div className="flex items-center justify-center h-6">
                                  <span className="text-xs text-muted-foreground">= Set</span>
                                </div>
                              )}

                              {/* Value */}
                              {isNumeric ? (
                                <Input
                                  type="number"
                                  value={normalized.target_attribute.value}
                                  onChange={(e) => {
                                    const updatedRewards = [...(skill.activationRewards || [])];
                                    updatedRewards[rewardIdx] = {
                                      ...reward,
                                      target_attribute: { ...normalized.target_attribute!, value: Number(e.target.value) }
                                    };
                                    onChange(index, { activationRewards: updatedRewards });
                                  }}
                                  placeholder="Valor"
                                  className="bg-background h-6 text-xs"
                                />
                              ) : (
                                <Input
                                  value={normalized.target_attribute.value}
                                  onChange={(e) => {
                                    const updatedRewards = [...(skill.activationRewards || [])];
                                    updatedRewards[rewardIdx] = {
                                      ...reward,
                                      target_attribute: { ...normalized.target_attribute!, value: e.target.value }
                                    };
                                    onChange(index, { activationRewards: updatedRewards });
                                  }}
                                  placeholder="Texto"
                                  className="bg-background h-6 text-xs"
                                />
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    {isCurrency && normalized.currency && (
                      <div className="flex items-center gap-2 mt-1">
                        <Label className="text-[10px] text-muted-foreground">Cantidad:</Label>
                        <Input
                          type="number"
                          value={normalized.currency.amount}
                          onChange={(e) => {
                            const updatedRewards = [...(skill.activationRewards || [])];
                            updatedRewards[rewardIdx] = {
                              ...updatedRewards[rewardIdx],
                              type: 'currency',
                              currency: { amount: Number(e.target.value) }
                            };
                            onChange(index, { activationRewards: updatedRewards });
                          }}
                          className="bg-background h-5 text-[10px] w-20"
                        />
                        <span className="text-[10px] text-muted-foreground">divisa para persona</span>
                      </div>
                    )}
                    {/* Activate Sprite Pack Editor */}
                    {isActivateSpritePack && normalized.activate_sprite_pack && (
                      <div className="space-y-2">
                        {/* Target Mode selector */}
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Objetivo</Label>
                          <Select
                            value={normalized.activate_sprite_pack.targetMode || 'self'}
                            onValueChange={(v) => {
                              const updatedRewards = [...(skill.activationRewards || [])];
                              updatedRewards[rewardIdx] = {
                                ...reward,
                                type: 'activate_sprite_pack',
                                activate_sprite_pack: { 
                                  ...normalized.activate_sprite_pack!, 
                                  targetMode: v as TriggerTargetMode,
                                  // Reset target-specific fields when switching mode
                                  targetCharacterId: v === 'target' ? normalized.activate_sprite_pack!.targetCharacterId : undefined,
                                  targetPackId: v === 'target' ? normalized.activate_sprite_pack!.targetPackId : undefined,
                                  fallbackPackId: v === 'self' ? normalized.activate_sprite_pack!.fallbackPackId : undefined,
                                }
                              };
                              onChange(index, { activationRewards: updatedRewards });
                            }}
                          >
                            <SelectTrigger className="bg-background h-6 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="self">👤 Mismo personaje (Self)</SelectItem>
                              <SelectItem value="all">👥 Todos</SelectItem>
                              <SelectItem value="target">🎯 Personaje objetivo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* SELF mode: Select own sprite pack + fallback collection */}
                        {(normalized.activate_sprite_pack.targetMode || 'self') === 'self' && (
                          <div className="space-y-2 p-2 rounded-md bg-purple-500/5 border border-purple-500/10">
                            <div className="text-[10px] text-purple-500 font-medium">Activar en sí mismo</div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Sprite Pack</Label>
                                <Select
                                  value={normalized.activate_sprite_pack.packId}
                                  onValueChange={(v) => {
                                    const updatedRewards = [...(skill.activationRewards || [])];
                                    updatedRewards[rewardIdx] = {
                                      ...reward,
                                      type: 'activate_sprite_pack',
                                      activate_sprite_pack: { ...normalized.activate_sprite_pack!, packId: v }
                                    };
                                    onChange(index, { activationRewards: updatedRewards });
                                  }}
                                >
                                  <SelectTrigger className="bg-background h-6 text-xs">
                                    <SelectValue placeholder="Seleccionar pack..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(spritePacksV2 || []).length > 0 ? (
                                      spritePacksV2!.map(p => (
                                        <SelectItem key={p.id} value={p.id}>
                                          <div className="flex items-center gap-1.5">
                                            <Package className="w-3 h-3" />
                                            {p.name} ({p.sprites.length})
                                            {p.conditionalMode && (
                                              <span className="text-purple-500 text-[9px]">cond.</span>
                                            )}
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
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Fallback Pack</Label>
                                <Select
                                  value={normalized.activate_sprite_pack.fallbackPackId || '__none__'}
                                  onValueChange={(v) => {
                                    const updatedRewards = [...(skill.activationRewards || [])];
                                    updatedRewards[rewardIdx] = {
                                      ...reward,
                                      type: 'activate_sprite_pack',
                                      activate_sprite_pack: { 
                                        ...normalized.activate_sprite_pack!, 
                                        fallbackPackId: v === '__none__' ? undefined : v,
                                        fallbackMode: v === '__none__' ? normalized.activate_sprite_pack!.fallbackMode : 'custom_sprite' as const,
                                      }
                                    };
                                    onChange(index, { activationRewards: updatedRewards });
                                  }}
                                >
                                  <SelectTrigger className="bg-background h-6 text-xs">
                                    <SelectValue placeholder="Ninguno..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">Ninguno (volver a idle)</SelectItem>
                                    {(spritePacksV2 || [])
                                      .filter(p => p.id !== normalized.activate_sprite_pack!.packId)
                                      .map(p => (
                                        <SelectItem key={p.id} value={p.id}>
                                          <div className="flex items-center gap-1.5">
                                            <Package className="w-3 h-3" />
                                            {p.name} ({p.sprites.length})
                                            {p.conditionalMode && (
                                              <span className="text-purple-500 text-[9px]">cond.</span>
                                            )}
                                          </div>
                                        </SelectItem>
                                      ))
                                    }
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* ALL mode: Select sprite pack that applies to everyone */}
                        {(normalized.activate_sprite_pack.targetMode) === 'all' && (
                          <div className="space-y-2 p-2 rounded-md bg-purple-500/5 border border-purple-500/10">
                            <div className="text-[10px] text-purple-500 font-medium">Activar en todos los personajes</div>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Sprite Pack</Label>
                              <Select
                                value={normalized.activate_sprite_pack.packId}
                                onValueChange={(v) => {
                                  const updatedRewards = [...(skill.activationRewards || [])];
                                  updatedRewards[rewardIdx] = {
                                    ...reward,
                                    type: 'activate_sprite_pack',
                                    activate_sprite_pack: { ...normalized.activate_sprite_pack!, packId: v }
                                  };
                                  onChange(index, { activationRewards: updatedRewards });
                                }}
                              >
                                <SelectTrigger className="bg-background h-6 text-xs">
                                  <SelectValue placeholder="Seleccionar pack..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {(spritePacksV2 || []).length > 0 ? (
                                    spritePacksV2!.map(p => (
                                      <SelectItem key={p.id} value={p.id}>
                                        <div className="flex items-center gap-1.5">
                                          <Package className="w-3 h-3" />
                                          {p.name} ({p.sprites.length})
                                          {p.conditionalMode && (
                                            <span className="text-purple-500 text-[9px]">cond.</span>
                                          )}
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
                          </div>
                        )}

                        {/* TARGET mode: Select target character + their sprite pack */}
                        {(normalized.activate_sprite_pack.targetMode) === 'target' && (
                          <div className="space-y-2 p-2 rounded-md bg-blue-500/5 border border-blue-500/10">
                            <div className="text-[10px] text-blue-500 font-medium">Activar en personaje objetivo</div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Personaje objetivo</Label>
                                <Select
                                  value={normalized.activate_sprite_pack.targetCharacterId || ''}
                                  onValueChange={(v) => {
                                    const updatedRewards = [...(skill.activationRewards || [])];
                                    updatedRewards[rewardIdx] = {
                                      ...reward,
                                      type: 'activate_sprite_pack',
                                      activate_sprite_pack: { 
                                        ...normalized.activate_sprite_pack!, 
                                        targetCharacterId: v,
                                        targetPackId: undefined, // Reset pack when character changes
                                      }
                                    };
                                    onChange(index, { activationRewards: updatedRewards });
                                  }}
                                >
                                  <SelectTrigger className="bg-background h-6 text-xs">
                                    <SelectValue placeholder="Seleccionar personaje..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableTargets.length > 0 ? (
                                      availableTargets.map(t => (
                                        <SelectItem key={t.id} value={t.id}>
                                          {t.id === '__user__' ? '👤 ' : '🎭 '}{t.name}
                                        </SelectItem>
                                      ))
                                    ) : (
                                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                        No hay otros personajes con stats
                                      </div>
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Sprite Pack del objetivo</Label>
                                <Select
                                  value={normalized.activate_sprite_pack.targetPackId || ''}
                                  onValueChange={(v) => {
                                    const updatedRewards = [...(skill.activationRewards || [])];
                                    updatedRewards[rewardIdx] = {
                                      ...reward,
                                      type: 'activate_sprite_pack',
                                      activate_sprite_pack: { ...normalized.activate_sprite_pack!, targetPackId: v }
                                    };
                                    onChange(index, { activationRewards: updatedRewards });
                                  }}
                                >
                                  <SelectTrigger className="bg-background h-6 text-xs">
                                    <SelectValue placeholder="Seleccionar pack..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(() => {
                                      const selectedTarget = availableTargets.find(t => t.id === normalized.activate_sprite_pack!.targetCharacterId);
                                      const targetPacks = selectedTarget?.spritePacks || [];
                                      return targetPacks.length > 0 ? (
                                        targetPacks.map(p => (
                                          <SelectItem key={p.id} value={p.id}>
                                            <div className="flex items-center gap-1.5">
                                              <Package className="w-3 h-3" />
                                              {p.name} ({p.spriteCount})
                                              {p.conditionalMode && (
                                                <span className="text-purple-500 text-[9px]">cond.</span>
                                              )}
                                            </div>
                                          </SelectItem>
                                        ))
                                      ) : (
                                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                          {normalized.activate_sprite_pack!.targetCharacterId 
                                            ? 'Este personaje no tiene sprite packs' 
                                            : 'Selecciona un personaje primero'}
                                        </div>
                                      );
                                    })()}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            {!normalized.activate_sprite_pack.targetCharacterId && (
                              <p className="text-[10px] text-muted-foreground italic">Selecciona un personaje objetivo para ver sus sprite packs disponibles</p>
                            )}
                          </div>
                        )}

                        {/* Common options: Return to idle + Fallback mode */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex items-center gap-2">
                            <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Idle (ms):</Label>
                            <Input
                              type="number"
                              min={0}
                              value={normalized.activate_sprite_pack.returnToIdleMs || 0}
                              onChange={(e) => {
                                const updatedRewards = [...(skill.activationRewards || [])];
                                updatedRewards[rewardIdx] = {
                                  ...reward,
                                  type: 'activate_sprite_pack',
                                  activate_sprite_pack: { ...normalized.activate_sprite_pack!, returnToIdleMs: Number(e.target.value) }
                                };
                                onChange(index, { activationRewards: updatedRewards });
                              }}
                              placeholder="0 = persistir"
                              className="bg-background h-6 w-24 text-xs"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Fallback:</Label>
                            <Select
                              value={normalized.activate_sprite_pack.fallbackMode || 'idle_collection'}
                              onValueChange={(v) => {
                                const updatedRewards = [...(skill.activationRewards || [])];
                                updatedRewards[rewardIdx] = {
                                  ...reward,
                                  type: 'activate_sprite_pack',
                                  activate_sprite_pack: { ...normalized.activate_sprite_pack!, fallbackMode: v as TriggerFallbackMode }
                                };
                                onChange(index, { activationRewards: updatedRewards });
                              }}
                            >
                              <SelectTrigger className="bg-background h-6 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="idle_collection">Idle</SelectItem>
                                <SelectItem value="collection_default">Default</SelectItem>
                                <SelectItem value="custom_sprite">Custom</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {/* Info about conditional mode */}
                        {normalized.activate_sprite_pack.packId && (() => {
                          const selectedPack = (spritePacksV2 || []).find(p => p.id === normalized.activate_sprite_pack!.packId);
                          if (!selectedPack) return null;
                          return (
                            <div className="text-[10px] text-muted-foreground p-1.5 bg-background/50 rounded">
                              {selectedPack.conditionalMode ? (
                                <span className="text-purple-500 flex items-center gap-1">
                                  <GitBranch className="w-3 h-3" />
                                  Pack con modo condicional — evaluará las condiciones de cada sprite por prioridad
                                </span>
                              ) : (
                                <span>
                                  Pack sin modo condicional — usará el comportamiento definido (principal/aleatorio/lista)
                                </span>
                              )}
                            </div>
                          );
                        })()}
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
  availableTargets?: StatsEditorProps['availableTargets'];
  onChange: (index: number, updates: Partial<SolicitudDefinition>) => void;
  onDelete: (index: number) => void;
}

function SolicitudDefinitionEditor({ solicitud, index, availableAttributes, availableTargets = [], onChange, onDelete }: SolicitudDefinitionEditorProps) {
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
                  availableTargets={availableTargets}
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
  availableTargets?: StatsEditorProps['availableTargets'];
  onChange: (index: number, updates: Partial<InvitationDefinition>) => void;
  onDelete: (index: number) => void;
}

function InvitationEditor({ invitation, index, availableAttributes, allCharacters = [], availableTargets = [], onChange, onDelete }: InvitationEditorProps) {
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
                  availableTargets={availableTargets}
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
// Helper: Generate available solicitudes from character's own definitions
// ============================================
// Only shows the character's OWN solicitudDefinitions, because:
// - Action rewards of type 'solicitud' complete solicitudes made TO this character
// - When another character makes a petition, it creates a SolicitudInstance
//   with a solicitudKey matching one of this character's SolicitudDefinitions
// - The action can only complete solicitudes that match this character's definitions

function getAvailableSolicitudes(
  statsConfig?: CharacterStatsConfig
): SolicitudDropdownOption[] {
  const options: SolicitudDropdownOption[] = [];
  
  if (!statsConfig?.solicitudDefinitions?.length) {
    return options;
  }
  
  for (const sol of statsConfig.solicitudDefinitions) {
    options.push({
      solicitudId: sol.id,
      solicitudKey: sol.solicitudKey,
      solicitudName: sol.name,
      label: sol.name,
    });
  }
  
  return options;
}

// ============================================
// Main Stats Editor Component
// ============================================

export function StatsEditor({ statsConfig, onChange, allCharacters = [], questTemplates = [], questTemplateIds, availableTargets = [], spritePacksV2 }: StatsEditorProps) {
  const config: CharacterStatsConfig = statsConfig || DEFAULT_STATS_CONFIG;
  
  const updateConfig = (updates: Partial<CharacterStatsConfig>) => {
    onChange({ ...config, ...updates });
  };
  
  const availableObjectives = getAvailableObjectives(questTemplates, questTemplateIds);
  const availableSolicitudes = getAvailableSolicitudes(config);
  
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
          <>
            {/* Global Timer Configuration */}
            <div className="p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <span className="font-medium text-sm text-emerald-400">Timer de Atributos</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Sistema de timer para que los atributos cambien automáticamente con el tiempo.</p>
                      <p className="mt-1 text-xs text-muted-foreground">• Cada atributo puede tener su propio timer</p>
                      <p className="text-xs text-muted-foreground">• Se evalúa al cargar la sesión y periódicamente</p>
                      <p className="text-xs text-muted-foreground">• Los cambios offline se aplican al volver</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Switch
                  checked={config.timerEnabled ?? false}
                  onCheckedChange={(checked) => updateConfig({ timerEnabled: checked })}
                />
              </div>
              
              {config.timerEnabled && (
                <div className="space-y-3 mt-3 pt-3 border-t border-emerald-500/10">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Label className="text-xs">Intervalo de tick</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Cada cuántos segundos se verifica si hay timers que aplicar. Menor = más preciso pero más procesamiento.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={10}
                          max={3600}
                          value={config.timerTickSeconds ?? 60}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val) && val >= 10) updateConfig({ timerTickSeconds: val });
                          }}
                          className="h-8 w-20"
                        />
                        <span className="text-xs text-muted-foreground">segundos</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Label className="text-xs">Máx. ticks acumulados</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Máximo de ticks que se acumulan cuando la sesión está inactiva. Previene cambios masivos tras mucho tiempo offline.</p>
                            <p className="mt-1 text-xs text-muted-foreground">Para keywords cíclicos, el máximo es siempre 10.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Input
                        type="number"
                        min={1}
                        max={1000}
                        value={config.timerMaxAccumulatedTicks ?? 100}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val >= 1) updateConfig({ timerMaxAccumulatedTicks: val });
                        }}
                        className="h-8"
                      />
                    </div>
                  </div>
                  
                  {/* Active timers summary */}
                  {config.attributes.some(attr => attr.timer?.enabled) && (
                    <div className="p-2 bg-emerald-500/10 rounded border border-emerald-500/15">
                      <p className="text-[10px] font-medium text-emerald-400 mb-1">Timers activos:</p>
                      <div className="flex flex-wrap gap-1">
                        {config.attributes.filter(attr => attr.timer?.enabled).map(attr => (
                          <Badge key={attr.key} variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">
                            <Timer className="w-2.5 h-2.5 mr-0.5" />
                            {attr.name || attr.key}: cada {attr.timer!.intervalMinutes}min
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

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
                      availableTargets={availableTargets}
                      spritePacksV2={spritePacksV2}
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
                      availableTargets={availableTargets}
                      spritePacksV2={spritePacksV2}
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
                      availableTargets={availableTargets}
                      spritePacksV2={spritePacksV2}
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
                      availableTargets={availableTargets}
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
                      availableTargets={availableTargets}
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
          </>
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
