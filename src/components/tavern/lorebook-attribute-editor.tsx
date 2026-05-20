'use client';

import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type {
  LorebookEntry,
  AttributeRequirement,
  AttributeOperator,
  AttributeEntryConfig,
  DynamicContentRule,
  DynamicContentConfig,
  StaticContentConfig,
  AttributeContentType,
  AttributeTargetType,
  AttributeRequirementLogic,
} from '@/types';
import {
  OPERATORS_BY_ATTR_TYPE,
  ATTRIBUTE_OPERATOR_LABELS,
  OPERATOR_REQUIRES_VALUE,
  OPERATOR_REQUIRES_SECONDARY_VALUE,
} from '@/types';
import {
  Plus,
  Trash2,
  Link2,
  Eye,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useState, useMemo } from 'react';

// ============================================
// Main Component
// ============================================

interface AttributeEntryEditorProps {
  entry: LorebookEntry;
  onUpdate: (updates: Partial<LorebookEntry>) => void;
}

export function AttributeEntryEditor({ entry, onUpdate }: AttributeEntryEditorProps) {
  const config = useMemo((): AttributeEntryConfig => {
    const existing = entry.extensions?.attributeConfig as AttributeEntryConfig | undefined;
    return existing || getDefaultConfig();
  }, [entry.extensions]);

  const updateConfig = (newConfig: Partial<AttributeEntryConfig>) => {
    const merged: AttributeEntryConfig = { ...config, ...newConfig };
    onUpdate({
      extensions: { ...entry.extensions, attributeConfig: merged },
    });
  };

  const contentType = config.content.type;
  const setContentType = (type: AttributeContentType) => {
    if (type === 'static') {
      updateConfig({
        content: {
          type: 'static',
          content: (config.content as DynamicContentConfig)?.defaultContent || '',
        } as StaticContentConfig,
      });
    } else {
      updateConfig({
        content: {
          type: 'dynamic',
          rules: [],
          defaultContent: (config.content as StaticContentConfig)?.content || '',
        } as DynamicContentConfig,
      });
    }
  };

  return (
    <div className="space-y-4 p-3 border rounded-lg bg-muted/20">
      {/* Template Key */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5 text-primary" />
          <Label className="text-xs font-medium">Key de la entrada</Label>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground flex-shrink-0">{'{{'}</span>
          <Input
            value={config.templateKey}
            onChange={(e) => updateConfig({ templateKey: e.target.value.replace(/\s/g, '') })}
            placeholder="miKey"
            className="h-7 text-sm font-mono"
          />
          <span className="text-sm text-muted-foreground flex-shrink-0">{'}'}</span>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Coloca {'{{' + (config.templateKey || 'miKey') + '}'}  en cualquier sección del personaje para inyectar el contenido.
        </p>
      </div>

      <Separator />

      {/* Requirement Logic */}
      <div className="flex items-center gap-3">
        <Label className="text-xs font-medium">Requisitos</Label>
        <Select
          value={config.requirementLogic || 'AND'}
          onValueChange={(v) => updateConfig({ requirementLogic: v as AttributeRequirementLogic })}
        >
          <SelectTrigger className="h-6 w-20 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AND" className="text-xs">AND (Todos)</SelectItem>
            <SelectItem value="OR" className="text-xs">OR (Cualquiera)</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer ml-auto">
          <Switch
            checked={config.isFallback ?? false}
            onCheckedChange={(checked) => updateConfig({ isFallback: checked })}
          />
          Fallback
        </label>
      </div>

      {/* Requirements List */}
      <div className="space-y-2">
        {config.requirements.map((req, index) => (
          <RequirementRow
            key={req.id}
            requirement={req}
            index={index}
            onUpdate={(updated) => {
              const newReqs = [...config.requirements];
              newReqs[index] = updated;
              updateConfig({ requirements: newReqs });
            }}
            onRemove={() => {
              updateConfig({
                requirements: config.requirements.filter((_, i) => i !== index),
              });
            }}
          />
        ))}

        {!config.isFallback && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs w-full border-dashed"
            onClick={() => {
              const newReq: AttributeRequirement = {
                id: crypto.randomUUID(),
                targetId: '',
                targetName: '',
                targetType: 'character',
                attributeKey: '',
                attributeName: '',
                attributeType: 'text',
                operator: 'equals',
                value: '',
              };
              updateConfig({
                requirements: [...config.requirements, newReq],
              });
            }}
          >
            <Plus className="w-3 h-3 mr-1" />
            Agregar requisito
          </Button>
        )}
      </div>

      {config.isFallback && (
        <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-[11px] text-amber-700 dark:text-amber-400">
            Modo fallback: esta entrada se activará siempre que ninguna otra entrada con la misma key cumpla sus requisitos.
          </span>
        </div>
      )}

      <Separator />

      {/* Content Type */}
      <div className="flex items-center gap-3">
        <Label className="text-xs font-medium">Tipo de contenido</Label>
        <Select value={contentType} onValueChange={(v) => setContentType(v as AttributeContentType)}>
          <SelectTrigger className="h-6 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="static" className="text-xs">Estático</SelectItem>
            <SelectItem value="dynamic" className="text-xs">Dinámico</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {contentType === 'static' ? (
        <div className="space-y-1.5">
          <Label className="text-xs">Contenido estático</Label>
          <Textarea
            value={(config.content as StaticContentConfig).content}
            onChange={(e) =>
              updateConfig({
                content: { type: 'static', content: e.target.value } as StaticContentConfig,
              })
            }
            placeholder="Contenido que se inyectará cuando los requisitos se cumplan..."
            rows={3}
            className="font-mono text-sm"
          />
        </div>
      ) : (
        <DynamicContentEditor
          config={config.content as DynamicContentConfig}
          requirements={config.requirements}
          onUpdate={(newContent) => updateConfig({ content: newContent })}
        />
      )}

      {/* Priority */}
      <div className="flex items-center gap-3">
        <Label className="text-xs">Prioridad</Label>
        <Input
          type="number"
          min={0}
          value={config.priority ?? 0}
          onChange={(e) => updateConfig({ priority: parseInt(e.target.value) || 0 })}
          className="h-6 w-20 text-xs"
        />
        <p className="text-[10px] text-muted-foreground">
          Mayor = se evalúa primero (útil cuando múltiples entradas usan la misma key)
        </p>
      </div>
    </div>
  );
}

// ============================================
// Requirement Row Component
// ============================================

interface RequirementRowProps {
  requirement: AttributeRequirement;
  index: number;
  onUpdate: (updated: AttributeRequirement) => void;
  onRemove: () => void;
}

function RequirementRow({ requirement, index, onUpdate, onRemove }: RequirementRowProps) {
  const { characters, personas } = useTavernStore();

  const [expanded, setExpanded] = useState(true);

  // Get available targets
  const characterOptions = useMemo(() =>
    characters.map(c => ({
      id: c.id,
      name: c.name,
      type: 'character' as AttributeTargetType,
    })),
    [characters]
  );

  const personaOptions = useMemo(() =>
    personas.map(p => ({
      id: p.id,
      name: p.name,
      type: 'persona' as AttributeTargetType,
    })),
    [personas]
  );

  // Find the selected target to get attributes
  const selectedTarget = useMemo(() => {
    if (!requirement.targetId) return null;
    if (requirement.targetType === 'persona') {
      return personas.find(p => p.id === requirement.targetId);
    }
    return characters.find(c => c.id === requirement.targetId);
  }, [requirement.targetId, requirement.targetType, characters, personas]);

  // Get attribute definitions for selected target
  const attributeDefs = useMemo(() => {
    if (!selectedTarget?.statsConfig?.attributes) return [];
    return selectedTarget.statsConfig.attributes;
  }, [selectedTarget]);

  // Get available operators based on attribute type
  const availableOperators = useMemo(() => {
    const typeKey = requirement.attributeType || 'text';
    return OPERATORS_BY_ATTR_TYPE[typeKey] || OPERATORS_BY_ATTR_TYPE.text || [];
  }, [requirement.attributeType]);

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-2.5 py-1.5 bg-muted/50 cursor-pointer hover:bg-muted/80 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        )}
        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
          #{index + 1}
        </Badge>
        {requirement.targetName && (
          <span className="text-xs font-medium truncate flex-1">
            {requirement.targetName}
            {requirement.attributeName ? ` → ${requirement.attributeName}` : ''}
          </span>
        )}
        {!requirement.targetName && (
          <span className="text-xs text-muted-foreground italic">Sin configurar</span>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="h-5 w-5 text-destructive hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="p-2.5 space-y-2 border-t">
          {/* Row 1: Target selector */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Objetivo</Label>
              <Select
                value={requirement.targetId || '__none__'}
                onValueChange={(v) => {
                  if (v === '__none__') {
                    onUpdate({ ...requirement, targetId: '', targetName: '', attributeKey: '', attributeName: '' });
                    return;
                  }
                  const isPersona = personaOptions.some(p => p.id === v);
                  const isChar = characterOptions.some(c => c.id === v);
                  const target = isChar
                    ? characterOptions.find(c => c.id === v)
                    : personaOptions.find(p => p.id === v);
                  if (target) {
                    onUpdate({
                      ...requirement,
                      targetId: target.id,
                      targetName: target.name,
                      targetType: target.type,
                      attributeKey: '',
                      attributeName: '',
                    });
                  }
                }}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {characterOptions.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[10px] text-muted-foreground font-medium">Personajes</div>
                      {characterOptions.map(c => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          {c.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {personaOptions.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[10px] text-muted-foreground font-medium mt-1">Personas</div>
                      {personaOptions.map(p => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">
                          {p.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Attribute selector */}
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Atributo</Label>
              <Select
                value={requirement.attributeKey || '__none__'}
                onValueChange={(v) => {
                  if (v === '__none__') {
                    onUpdate({ ...requirement, attributeKey: '', attributeName: '', attributeType: 'text' });
                    return;
                  }
                  const attrDef = attributeDefs.find(a => a.key === v);
                  if (attrDef) {
                    onUpdate({
                      ...requirement,
                      attributeKey: attrDef.key,
                      attributeName: attrDef.name,
                      attributeType: attrDef.type as any,
                    });
                  }
                }}
                disabled={!requirement.targetId}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {attributeDefs.length === 0 && (
                    <div className="px-2 py-1 text-[10px] text-muted-foreground italic">
                      Sin atributos definidos
                    </div>
                  )}
                  {attributeDefs.map(attr => (
                    <SelectItem key={attr.key} value={attr.key} className="text-xs">
                      {attr.name}
                      <Badge variant="outline" className="ml-1 text-[8px] px-0.5 h-3">
                        {attr.type}
                      </Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Operator and values */}
          <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
            {/* Operator */}
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Operador</Label>
              <Select
                value={requirement.operator}
                onValueChange={(v) => onUpdate({ ...requirement, operator: v as AttributeOperator })}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableOperators.map(op => (
                    <SelectItem key={op} value={op} className="text-xs">
                      {ATTRIBUTE_OPERATOR_LABELS[op]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Value */}
            {OPERATOR_REQUIRES_VALUE[requirement.operator] && (
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Valor</Label>
                <Input
                  value={requirement.value}
                  onChange={(e) => onUpdate({ ...requirement, value: e.target.value })}
                  placeholder="..."
                  className="h-7 text-xs"
                />
              </div>
            )}

            {/* Secondary Value (for "between", "one_of", "none_of") */}
            {OPERATOR_REQUIRES_SECONDARY_VALUE[requirement.operator] && (
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">
                  {requirement.operator === 'between' ? 'Valor máx.' : 'Lista (CSV)'}
                </Label>
                <Input
                  value={requirement.valueSecondary || ''}
                  onChange={(e) => onUpdate({ ...requirement, valueSecondary: e.target.value })}
                  placeholder={requirement.operator === 'between' ? '10' : 'a, b, c'}
                  className="h-7 text-xs"
                />
              </div>
            )}

            {/* Spacer when no values needed */}
            {!OPERATOR_REQUIRES_VALUE[requirement.operator] && (
              <div />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Dynamic Content Editor
// ============================================

interface DynamicContentEditorProps {
  config: DynamicContentConfig;
  requirements: AttributeRequirement[];
  onUpdate: (content: DynamicContentConfig) => void;
}

function DynamicContentEditor({ config, requirements, onUpdate }: DynamicContentEditorProps) {
  const addRule = () => {
    const newRule: DynamicContentRule = {
      id: crypto.randomUUID(),
      conditions: [],
      content: '',
    };
    onUpdate({ ...config, rules: [...config.rules, newRule] });
  };

  const updateRule = (index: number, updated: DynamicContentRule) => {
    const newRules = [...config.rules];
    newRules[index] = updated;
    onUpdate({ ...config, rules: newRules });
  };

  const removeRule = (index: number) => {
    onUpdate({ ...config, rules: config.rules.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-2">
      {/* Rules */}
      {config.rules.map((rule, index) => (
        <DynamicRuleEditor
          key={rule.id}
          rule={rule}
          ruleIndex={index}
          requirements={requirements}
          onUpdate={(updated) => updateRule(index, updated)}
          onRemove={() => removeRule(index)}
        />
      ))}

      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs w-full border-dashed"
        onClick={addRule}
      >
        <Plus className="w-3 h-3 mr-1" />
        Agregar regla condicional
      </Button>

      {/* Default Content */}
      <div className="space-y-1.5">
        <Label className="text-xs">Contenido por defecto (si ninguna regla coincide)</Label>
        <Textarea
          value={config.defaultContent || ''}
          onChange={(e) => onUpdate({ ...config, defaultContent: e.target.value })}
          placeholder="Contenido por defecto..."
          rows={2}
          className="font-mono text-sm"
        />
      </div>
    </div>
  );
}

// ============================================
// Dynamic Rule Editor
// ============================================

interface DynamicRuleEditorProps {
  rule: DynamicContentRule;
  ruleIndex: number;
  requirements: AttributeRequirement[];
  onUpdate: (updated: DynamicContentRule) => void;
  onRemove: () => void;
}

function DynamicRuleEditor({ rule, ruleIndex, requirements, onUpdate, onRemove }: DynamicRuleEditorProps) {
  const [expanded, setExpanded] = useState(true);

  const addCondition = () => {
    const newCondition = {
      requirementIndex: 0,
      operator: 'equals' as AttributeOperator,
      value: '',
    };
    onUpdate({ ...rule, conditions: [...rule.conditions, newCondition] });
  };

  const updateCondition = (condIndex: number, updated: typeof rule.conditions[0]) => {
    const newConditions = [...rule.conditions];
    newConditions[condIndex] = updated;
    onUpdate({ ...rule, conditions: newConditions });
  };

  const removeCondition = (condIndex: number) => {
    onUpdate({ ...rule, conditions: rule.conditions.filter((_, i) => i !== condIndex) });
  };

  // Get available operators for the referenced requirement's attribute type
  const getAvailableOperators = (reqIndex: number): AttributeOperator[] => {
    const req = requirements[reqIndex];
    if (!req) return OPERATORS_BY_ATTR_TYPE.text || [];
    const typeKey = req.attributeType || 'text';
    return OPERATORS_BY_ATTR_TYPE[typeKey] || OPERATORS_BY_ATTR_TYPE.text || [];
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" />
        )}
        <Badge className="text-[9px] px-1 py-0 h-4 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
          Regla {ruleIndex + 1}
        </Badge>
        <span className="text-xs text-muted-foreground truncate flex-1">
          {rule.conditions.length} condición(es)
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="h-5 w-5 text-destructive hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      {expanded && (
        <div className="p-2.5 space-y-2 border-t">
          {/* Conditions */}
          {rule.conditions.map((cond, condIndex) => {
            const refReq = requirements[cond.requirementIndex];
            const ops = getAvailableOperators(cond.requirementIndex);

            return (
              <div key={condIndex} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                {/* Requirement reference */}
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground">Atributo</Label>
                  <Select
                    value={String(cond.requirementIndex)}
                    onValueChange={(v) =>
                      updateCondition(condIndex, { ...cond, requirementIndex: parseInt(v) })
                    }
                  >
                    <SelectTrigger className="h-6 text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {requirements.map((req, ri) => (
                        <SelectItem key={ri} value={String(ri)} className="text-[11px]">
                          #{ri + 1}: {req.targetName} → {req.attributeName || '?'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Operator */}
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground">Condición</Label>
                  <Select
                    value={cond.operator}
                    onValueChange={(v) =>
                      updateCondition(condIndex, { ...cond, operator: v as AttributeOperator })
                    }
                  >
                    <SelectTrigger className="h-6 text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ops.map(op => (
                        <SelectItem key={op} value={op} className="text-[11px]">
                          {ATTRIBUTE_OPERATOR_LABELS[op]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Value */}
                {OPERATOR_REQUIRES_VALUE[cond.operator] && (
                  <div className="space-y-0.5">
                    <Label className="text-[10px] text-muted-foreground">Valor</Label>
                    <Input
                      value={cond.value}
                      onChange={(e) =>
                        updateCondition(condIndex, { ...cond, value: e.target.value })
                      }
                      placeholder="..."
                      className="h-6 text-[11px]"
                    />
                  </div>
                )}

                {!OPERATOR_REQUIRES_VALUE[cond.operator] && <div />}

                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={() => removeCondition(condIndex)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            );
          })}

          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[11px] w-full border-dashed border"
            onClick={addCondition}
          >
            <Plus className="w-3 h-3 mr-1" />
            Agregar condición
          </Button>

          {/* Rule Content */}
          <div className="space-y-1">
            <Label className="text-[11px]">Contenido si se cumple</Label>
            <Textarea
              value={rule.content}
              onChange={(e) => onUpdate({ ...rule, content: e.target.value })}
              placeholder="Texto que aparecerá cuando se cumplan todas las condiciones..."
              rows={2}
              className="font-mono text-[11px]"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Default Config
// ============================================

function getDefaultConfig(): AttributeEntryConfig {
  return {
    requirements: [],
    requirementLogic: 'AND',
    templateKey: '',
    content: {
      type: 'static',
      content: '',
    },
    priority: 0,
    isFallback: false,
  };
}

// ============================================
// Live Preview Component
// ============================================

interface AttributeEntryPreviewProps {
  entry: LorebookEntry;
}

export function AttributeEntryPreview({ entry }: AttributeEntryPreviewProps) {
  const { characters, personas } = useTavernStore();
  const { sessionStats } = useTavernStore();

  const config = useMemo((): AttributeEntryConfig | null => {
    if (entry.entryType !== 'attribute') return null;
    return (entry.extensions?.attributeConfig as AttributeEntryConfig) || null;
  }, [entry]);

  if (!config) return null;

  // Get current attribute values
  const getAttrValue = (req: AttributeRequirement) => {
    let values: Record<string, number | string> = {};
    if (req.targetType === 'character') {
      values = sessionStats?.characterStats?.[req.targetId]?.attributeValues || {};
    } else {
      values = sessionStats?.characterStats?.['__user__']?.attributeValues || {};
    }
    return values[req.attributeKey];
  };

  return (
    <div className="p-3 border rounded-lg bg-muted/10 space-y-2">
      <div className="flex items-center gap-1.5">
        <Eye className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-medium">Preview (valores actuales)</span>
      </div>

      {/* Requirements evaluation */}
      {config.requirements.length > 0 && (
        <div className="space-y-1">
          {config.requirements.map((req, i) => {
            const val = getAttrValue(req);
            const hasVal = val !== undefined && val !== null;

            return (
              <div key={req.id} className="flex items-center gap-2 text-[11px]">
                {hasVal ? (
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                ) : (
                  <XCircle className="w-3 h-3 text-muted-foreground" />
                )}
                <span className="text-muted-foreground">
                  {req.targetName} → {req.attributeName}:
                </span>
                <span className="font-medium">{hasVal ? String(val) : 'sin valor'}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Key */}
      {config.templateKey && (
        <div className="text-[11px]">
          <span className="text-muted-foreground">Key: </span>
          <code className="bg-muted px-1 py-0.5 rounded font-mono text-primary">
            {'{{' + config.templateKey + '}}'}
          </code>
        </div>
      )}

      {/* Content preview */}
      <div className="text-[11px] text-muted-foreground">
        <span>Tipo de contenido: </span>
        <Badge variant="outline" className="text-[9px] px-1 py-0 h-3">
          {config.content.type === 'static' ? 'Estático' : `Dinámico (${config.content.rules?.length || 0} reglas)`}
        </Badge>
      </div>
    </div>
  );
}
