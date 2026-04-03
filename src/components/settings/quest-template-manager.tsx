'use client';

/**
 * QuestTemplateManager Component
 * 
 * Settings tab for managing Quest templates.
 * Allows creating, editing, duplicating, and deleting quest templates.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTavernStore } from '@/store';
import type { 
  QuestTemplate, 
  QuestObjectiveTemplate, 
  QuestReward,
  QuestPriority,
  QuestObjectiveType,
  QuestRewardType,
  QuestActivationMethod,
  QuestValueCondition,
  QuestValueType,
  QuestNumberOperator,
  QuestTextOperator,
  AttributeAction,
  TriggerCategory,
  TriggerTargetMode,
  QuestCharacterFilter,
} from '@/types';
import { cn, generateId } from '@/lib/utils';
import {
  createAttributeReward,
  createTriggerReward,
  describeReward,
  getActionSymbol,
  normalizeReward,
} from '@/lib/quest/quest-reward-utils';
import { getExampleKey } from '@/lib/quest';
import { DEFAULT_QUEST_SETTINGS } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { motion } from 'framer-motion';
import { ArrowLeft, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Plus,
  Pencil,
  Copy,
  Trash2,
  ScrollText,
  Target,
  Gift,
  Sparkles,
  ChevronUp,
  ChevronDown,
  X,
  GripVertical,
  Zap,
  Clock,
  Link2,
  Hash,
  List,
  ToggleLeft,
  ToggleRight,
  Check,
  CheckCircle,
  AlertCircle,
  Info,
  Settings2,
  Eye,
  EyeOff,
  Timer,
  Image as ImageIcon,
  Volume2,
  Wallpaper,
  Users,
  User,
  Crosshair,
  ChevronRight,
  Filter,
  GripHorizontal,
  ChevronDown as ChevronDownIcon,
  Music,
  FileText,
  Star,
  HelpCircle,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ============================================
// Main Component
// ============================================

export function QuestTemplateManager() {
  const [editingTemplate, setEditingTemplate] = useState<QuestTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const questTemplates = useTavernStore((state) => state.questTemplates);
  const questSettings = useTavernStore((state) => state.questSettings);
  const loadTemplates = useTavernStore((state) => state.loadTemplates);
  const saveTemplate = useTavernStore((state) => state.saveTemplate);
  const deleteTemplate = useTavernStore((state) => state.deleteTemplate);
  const duplicateTemplate = useTavernStore((state) => state.duplicateTemplate);
  
  // Get the objective prefix if configured
  const objectivePrefix = questSettings?.objectiveCompletionPrefix || DEFAULT_QUEST_SETTINGS.objectiveCompletionPrefix;

  // Load templates on mount
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        await loadTemplates();
      } catch (error) {
        console.error('Error loading templates:', error);
      }
      setIsLoading(false);
    };
    load();
  }, [loadTemplates]);

  const handleCreate = () => {
    setIsCreating(true);
    setEditingTemplate(null);
  };
  
  const handleEdit = (template: QuestTemplate) => {
    setIsCreating(false);
    setEditingTemplate(template);
  };
  
  const handleDuplicate = async (template: QuestTemplate) => {
    const newId = `${template.id}-copy-${Date.now().toString(36)}`;
    try {
      await duplicateTemplate(template.id, newId);
    } catch (error) {
      console.error('Error duplicating template:', error);
    }
  };
  
  const handleDelete = async (template: QuestTemplate) => {
    if (confirm(`¿Eliminar el template "${template.name}"?`)) {
      try {
        await deleteTemplate(template.id);
      } catch (error) {
        console.error('Error deleting template:', error);
      }
    }
  };
  
  const handleSave = async (template: QuestTemplate) => {
    try {
      await saveTemplate(template);
      setEditingTemplate(null);
      setIsCreating(false);
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Error al guardar el template');
    }
  };

  const handleClose = () => {
    setEditingTemplate(null);
    setIsCreating(false);
  };

  // Priority colors
  const priorityColors: Record<QuestPriority, string> = {
    main: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30',
    side: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30',
    hidden: 'bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-500/30',
  };

  const priorityLabels: Record<QuestPriority, string> = {
    main: 'Principal',
    side: 'Secundaria',
    hidden: 'Oculta',
  };
  
  return (
    <div className={(editingTemplate || isCreating) ? "h-full flex flex-col" : "h-full relative"}>
      {(editingTemplate || isCreating) ? (
        <QuestTemplateEditorDialog
          key={editingTemplate?.id || 'new'}
          template={editingTemplate}
          isNew={isCreating}
          onSave={handleSave}
          onClose={handleClose}
          existingIds={questTemplates.map(t => t.id)}
          objectivePrefix={objectivePrefix}
        />
      ) : (
        <div className="h-full overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30">
                    <ScrollText className="w-5 h-5 text-amber-500" />
                  </div>
                  Quest Templates
                </h2>
                <p className="text-muted-foreground text-sm ml-12">
                  Crea plantillas de misiones para usar en las sesiones de rol
                </p>
              </div>
              <Button 
                onClick={handleCreate}
                className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-lg shadow-amber-500/25 transition-all duration-200 hover:shadow-amber-500/40"
              >
                <Plus className="w-4 h-4 mr-2" />
                Crear Template
              </Button>
            </div>

            {/* Loading State */}
            {isLoading && (
              <Card className="border-dashed border-2 bg-gradient-to-br from-muted/50 to-muted/30">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
                  <p className="text-muted-foreground text-sm mt-4">Cargando templates...</p>
                </CardContent>
              </Card>
            )}
            
            {/* Template List */}
            {!isLoading && questTemplates.length === 0 ? (
              <Card className="border-dashed border-2 bg-gradient-to-br from-muted/50 to-muted/30">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 mb-4">
                    <ScrollText className="w-12 h-12 text-amber-400" />
                  </div>
                  <p className="text-muted-foreground text-center mb-2 font-medium">
                    No hay templates de quest creados
                  </p>
                  <p className="text-muted-foreground/60 text-sm text-center max-w-xs mb-6">
                    Los templates definen misiones que pueden activarse automáticamente durante el rol
                  </p>
                  <Button variant="outline" className="gap-2" onClick={handleCreate}>
                    <Sparkles className="w-4 h-4" />
                    Crear primer template
                  </Button>
                </CardContent>
              </Card>
            ) : !isLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {questTemplates.map((template) => (
                  <Card 
                    key={template.id} 
                    className={cn(
                      "group relative overflow-hidden transition-all duration-300",
                      "hover:shadow-xl hover:shadow-amber-500/10 hover:-translate-y-1",
                      "border border-border/60 bg-gradient-to-br from-card to-muted/30 hover:border-amber-500/30"
                    )}
                  >
                    <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-gradient-to-br from-amber-500/5 to-orange-500/5 group-hover:scale-150 transition-transform duration-500" />
                    <CardHeader className="pb-3 relative">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{template.icon || '📜'}</span>
                            <CardTitle className="text-lg truncate">{template.name}</CardTitle>
                          </div>
                          {template.description && (
                            <CardDescription className="mt-1.5 line-clamp-2">
                              {template.description}
                            </CardDescription>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 relative">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={priorityColors[template.priority]}>
                          {priorityLabels[template.priority]}
                        </Badge>
                        <Badge variant="outline" className="text-xs bg-muted/50">
                          <Target className="w-3 h-3 mr-1" />
                          {template.objectives.length} objetivos
                        </Badge>
                        <Badge variant="outline" className="text-xs bg-muted/50">
                          <Gift className="w-3 h-3 mr-1" />
                          {template.rewards.length} recompensas
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {template.activation.method === 'keyword' && (
                          <>
                            <Zap className="w-3.5 h-3.5" />
                            <span>Key: <code className="bg-muted px-1 rounded">{template.activation.key}</code></span>
                          </>
                        )}
                        {template.activation.method === 'turn' && (
                          <>
                            <Clock className="w-3.5 h-3.5" />
                            <span>Cada {template.activation.turnInterval} turnos</span>
                          </>
                        )}
                        {template.activation.method === 'manual' && (
                          <>
                            <ToggleRight className="w-3.5 h-3.5" />
                            <span>Activación manual</span>
                          </>
                        )}
                        {template.activation.method === 'chain' && (
                          <>
                            <Link2 className="w-3.5 h-3.5" />
                            <span>En cadena</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {template.isRepeatable && (
                          <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600 dark:text-green-400">
                            Repetible
                          </Badge>
                        )}
                        {template.isHidden && (
                          <Badge variant="secondary" className="text-xs bg-slate-500/10 text-slate-600 dark:text-slate-400">
                            <EyeOff className="w-3 h-3 mr-1" />
                            Oculta
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-2 pt-2 border-t border-border/50">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/30 transition-colors"
                          onClick={() => handleEdit(template)}
                        >
                          <Pencil className="w-3.5 h-3.5 mr-1.5" />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 hover:bg-slate-500/10 hover:text-slate-600 hover:border-slate-500/30 transition-colors"
                          onClick={() => handleDuplicate(template)}
                        >
                          <Copy className="w-3.5 h-3.5 mr-1.5" />
                          Duplicar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="hover:bg-red-500/10 hover:text-red-600 hover:border-red-500/30 transition-colors"
                          onClick={() => handleDelete(template)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Sortable Objective Item Component
// ============================================

interface SortableObjectiveItemProps {
  objective: QuestObjectiveTemplate;
  index: number;
  totalObjectives: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<QuestObjectiveTemplate>) => void;
  onRemove: () => void;
  allCharacters: Array<{ id: string; name: string }>;
  objectivePrefix: string;
}

function SortableObjectiveItem({
  objective,
  index,
  totalObjectives,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onRemove,
  allCharacters,
  objectivePrefix,
}: SortableObjectiveItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: objective.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Helper to get objective summary for collapsed view
  const getObjectiveSummary = (obj: QuestObjectiveTemplate): string => {
    const parts: string[] = [];
    if (obj.description) {
      parts.push(obj.description.substring(0, 50) + (obj.description.length > 50 ? '...' : ''));
    }
    if (obj.completion?.key) {
      parts.push(`Key: ${obj.completion.key}`);
    }
    if (obj.targetCount > 1) {
      parts.push(`x${obj.targetCount}`);
    }
    return parts.join(' | ') || 'Sin configurar';
  };

  const typeLabels: Record<QuestObjectiveType, string> = {
    collect: 'Coleccionar',
    reach: 'Alcanzar',
    defeat: 'Derrotar',
    talk: 'Hablar',
    discover: 'Descubrir',
    custom: 'Personalizado',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "border rounded-lg overflow-hidden transition-all duration-200",
        isDragging ? "border-primary/50 shadow-lg shadow-primary/10 z-50" : "border-border/60",
        isExpanded ? "bg-card" : "bg-muted/30 hover:bg-muted/50"
      )}
    >
      {/* Accordion Header */}
      <div
        className={cn(
          "flex items-center gap-2 p-3 cursor-pointer select-none",
          isExpanded && "border-b border-border/50 bg-muted/30"
        )}
        onClick={onToggleExpand}
      >
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>

        {/* Index Badge */}
        <div className="flex items-center justify-center w-6 h-6 rounded bg-primary/10 text-primary text-xs font-medium">
          {index + 1}
        </div>

        {/* Type Icon */}
        <Target className="w-4 h-4 text-muted-foreground" />

        {/* Title Area */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium truncate">
              {objective.id}
            </span>
            <Badge variant="outline" className="text-[10px] h-5">
              {typeLabels[objective.type]}
            </Badge>
            {objective.isOptional && (
              <Badge variant="secondary" className="text-[10px] h-5 bg-blue-500/10 text-blue-600 dark:text-blue-400">
                Opcional
              </Badge>
            )}
            {objective.completionDescription && (
              <Badge variant="secondary" className="text-[10px] h-5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1">
                <CheckCircle className="w-3 h-3" />
                Info
              </Badge>
            )}
            {objective.characterFilter?.enabled && objective.characterFilter.characterIds.length > 0 && (
              <Badge variant="secondary" className="text-[10px] h-5 gap-1">
                <Users className="w-3 h-3" />
                {objective.characterFilter.characterIds.length}
              </Badge>
            )}
          </div>
          {!isExpanded && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {getObjectiveSummary(objective)}
            </p>
          )}
        </div>

        {/* Expand/Collapse Icon */}
        <ChevronDownIcon
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform duration-200",
            isExpanded && "rotate-180"
          )}
        />

        {/* Delete Button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-red-500 hover:bg-red-500/10"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Accordion Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Basic Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">ID</Label>
              <Input
                value={objective.id}
                onChange={(e) => onUpdate({ id: e.target.value })}
                className="bg-background font-mono text-xs h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Tipo</Label>
              <Select 
                value={objective.type} 
                onValueChange={(v) => onUpdate({ type: v as QuestObjectiveType })}
              >
                <SelectTrigger className="bg-background h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="collect">Coleccionar</SelectItem>
                  <SelectItem value="reach">Alcanzar</SelectItem>
                  <SelectItem value="defeat">Derrotar</SelectItem>
                  <SelectItem value="talk">Hablar</SelectItem>
                  <SelectItem value="discover">Descubrir</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Descripción</Label>
            <Input
              value={objective.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="Descripción del objetivo..."
              className="bg-background h-8"
            />
          </div>

          {/* Completion Description */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Descripción de Completado
              <span className="text-[9px] text-muted-foreground/60">(se_completa_cuando)</span>
            </Label>
            <Textarea
              value={objective.completionDescription || ''}
              onChange={(e) => onUpdate({ completionDescription: e.target.value })}
              placeholder="Instrucciones claras para el LLM sobre cuándo considerar este objetivo completado. Ej: El personaje confirma claramente que ya entregó los materiales..."
              className="bg-background text-xs min-h-[60px] resize-none"
              rows={2}
            />
            <p className="text-[9px] text-muted-foreground">
              Esta descripción se mostrará al LLM como instrucción de cuándo marcar el objetivo como completado.
            </p>
          </div>

          {/* Completion Keys */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-muted-foreground">Key de Completado</Label>
                {objectivePrefix && objectivePrefix.trim() !== '' && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                    +{objectivePrefix}
                  </Badge>
                )}
              </div>
              <Input
                value={objective.completion.key}
                onChange={(e) => onUpdate({ 
                  completion: { ...objective.completion, key: e.target.value } 
                })}
                placeholder="resistencia"
                className="bg-background font-mono text-xs h-8"
              />
              {objectivePrefix && objectivePrefix.trim() !== '' && objective.completion.key && (
                <div className="text-[9px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Zap className="w-2.5 h-2.5 text-amber-500" />
                  <span className="text-amber-600 dark:text-amber-400 font-mono">
                    {getExampleKey(objectivePrefix, objective.completion.key)}
                  </span>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Keys Alternativas</Label>
              <Input
                value={(objective.completion.keys || []).join(', ')}
                onChange={(e) => onUpdate({ 
                  completion: { ...objective.completion, keys: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } 
                })}
                placeholder="resistance, Resistance"
                className="bg-background font-mono text-xs h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Cantidad</Label>
              <Input
                type="number"
                min={1}
                value={objective.targetCount}
                onChange={(e) => onUpdate({ targetCount: Number(e.target.value) })}
                className="bg-background h-8"
              />
            </div>
          </div>

          {/* Switches */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={objective.completion.caseSensitive}
                onCheckedChange={(v) => onUpdate({ 
                  completion: { ...objective.completion, caseSensitive: v } 
                })}
              />
              <span className="text-xs text-muted-foreground">Case Sensitive</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={objective.isOptional}
                onCheckedChange={(v) => onUpdate({ isOptional: v })}
              />
              <span className="text-xs text-muted-foreground">Opcional</span>
            </div>
          </div>

          {/* Character Filter Section */}
          <div className="space-y-2 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Filter className="w-3 h-3" />
                Filtro de Personajes
              </Label>
              <Switch
                checked={objective.characterFilter?.enabled || false}
                onCheckedChange={(v) => onUpdate({ 
                  characterFilter: { 
                    enabled: v, 
                    mode: objective.characterFilter?.mode || 'include',
                    characterIds: objective.characterFilter?.characterIds || []
                  } 
                })}
              />
            </div>
            
            {objective.characterFilter?.enabled && (
              <div className="space-y-2 p-2 rounded bg-muted/30">
                <div className="space-y-1">
                  <Label className="text-[9px] text-muted-foreground">Modo de Filtro</Label>
                  <Select 
                    value={objective.characterFilter.mode} 
                    onValueChange={(v) => onUpdate({ 
                      characterFilter: { 
                        ...objective.characterFilter!, 
                        mode: v as 'include' | 'exclude'
                      } 
                    })}
                  >
                    <SelectTrigger className="bg-background h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="include">
                        <div className="flex items-center gap-2">
                          <User className="w-3 h-3" />
                          Incluir (solo estos personajes)
                        </div>
                      </SelectItem>
                      <SelectItem value="exclude">
                        <div className="flex items-center gap-2">
                          <Users className="w-3 h-3" />
                          Excluir (todos menos estos)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1">
                  <Label className="text-[9px] text-muted-foreground">
                    {objective.characterFilter.mode === 'include' ? 'Personajes que verán este objetivo' : 'Personajes que NO verán este objetivo'}
                  </Label>
                  <div className="flex flex-wrap gap-1 p-2 rounded bg-background min-h-[32px]">
                    {objective.characterFilter.characterIds.length === 0 ? (
                      <span className="text-xs text-muted-foreground italic">
                        Selecciona personajes...
                      </span>
                    ) : (
                      objective.characterFilter.characterIds.map(charId => {
                        const char = allCharacters.find(c => c.id === charId);
                        if (!char) return null;
                        return (
                          <Badge 
                            key={charId} 
                            variant="secondary"
                            className="text-[10px] gap-1 pr-1"
                          >
                            {char.name}
                            <button
                              type="button"
                              className="ml-1 hover:text-red-500"
                              onClick={() => onUpdate({ 
                                characterFilter: { 
                                  ...objective.characterFilter!, 
                                  characterIds: objective.characterFilter!.characterIds.filter(id => id !== charId)
                                } 
                              })}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        );
                      })
                    )}
                  </div>
                  <Select 
                    value="" 
                    onValueChange={(v) => {
                      if (v && !objective.characterFilter?.characterIds.includes(v)) {
                        onUpdate({ 
                          characterFilter: { 
                            ...objective.characterFilter!, 
                            characterIds: [...(objective.characterFilter?.characterIds || []), v]
                          } 
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="bg-background h-7 text-xs">
                      <SelectValue placeholder="+ Agregar personaje" />
                    </SelectTrigger>
                    <SelectContent>
                      {allCharacters
                        .filter(c => !objective.characterFilter?.characterIds.includes(c.id))
                        .map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  {objective.characterFilter.mode === 'include' 
                    ? 'Solo los personajes seleccionados verán este objetivo en su prompt'
                    : 'Todos los personajes verán este objetivo EXCEPTO los seleccionados'}
                </p>
              </div>
            )}
          </div>

          {/* Value Condition Section */}
          <div className="space-y-2 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground">Condición de Valor</Label>
              <Switch
                checked={!!objective.completion.valueCondition}
                onCheckedChange={(v) => onUpdate({ 
                  completion: { 
                    ...objective.completion, 
                    valueCondition: v ? { valueType: 'presence' } : undefined 
                  } 
                })}
              />
            </div>
            
            {objective.completion.valueCondition && (
              <div className="grid grid-cols-3 gap-2 p-2 rounded bg-muted/30">
                <div className="space-y-1">
                  <Label className="text-[9px] text-muted-foreground">Tipo de Valor</Label>
                  <Select 
                    value={objective.completion.valueCondition.valueType} 
                    onValueChange={(v) => onUpdate({ 
                      completion: { 
                        ...objective.completion, 
                        valueCondition: { 
                          ...objective.completion.valueCondition, 
                          valueType: v as QuestValueType 
                        } 
                      } 
                    })}
                  >
                    <SelectTrigger className="bg-background h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="presence">Presencia</SelectItem>
                      <SelectItem value="number">Número</SelectItem>
                      <SelectItem value="text">Texto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {objective.completion.valueCondition.valueType !== 'presence' && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-[9px] text-muted-foreground">Operador</Label>
                      <Select 
                        value={objective.completion.valueCondition.operator || (objective.completion.valueCondition.valueType === 'number' ? '==' : 'equals')} 
                        onValueChange={(v) => onUpdate({ 
                          completion: { 
                            ...objective.completion, 
                            valueCondition: { 
                              ...objective.completion.valueCondition, 
                              operator: v as any 
                            } 
                          } 
                        })}
                      >
                        <SelectTrigger className="bg-background h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {objective.completion.valueCondition.valueType === 'number' ? (
                            <>
                              <SelectItem value=">">&gt; Mayor que</SelectItem>
                              <SelectItem value="<">&lt; Menor que</SelectItem>
                              <SelectItem value=">=">≥ Mayor o igual</SelectItem>
                              <SelectItem value="<=">≤ Menor o igual</SelectItem>
                              <SelectItem value="==">= Igual</SelectItem>
                              <SelectItem value="!=">≠ Diferente</SelectItem>
                            </>
                          ) : (
                            <>
                              <SelectItem value="equals">Igual a</SelectItem>
                              <SelectItem value="contains">Contiene</SelectItem>
                              <SelectItem value="startsWith">Empieza con</SelectItem>
                              <SelectItem value="endsWith">Termina con</SelectItem>
                              <SelectItem value="notEquals">Diferente de</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9px] text-muted-foreground">Valor Objetivo</Label>
                      <Input
                        value={String(objective.completion.valueCondition.targetValue || '')}
                        onChange={(e) => onUpdate({ 
                          completion: { 
                            ...objective.completion, 
                            valueCondition: { 
                              ...objective.completion.valueCondition, 
                              targetValue: objective.completion.valueCondition?.valueType === 'number' 
                ? Number(e.target.value) 
                : e.target.value 
            } 
          } 
        })}
                        placeholder={objective.completion.valueCondition.valueType === 'number' ? '50' : 'texto'}
                        className="bg-background h-7 text-xs"
                      />
                    </div>
                  </>
                )}

                {objective.completion.valueCondition.valueType === 'presence' && (
                  <div className="col-span-2 flex items-center text-xs text-muted-foreground">
                    <Info className="w-3 h-3 mr-1" />
                    Detecta si la key existe en el texto
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Objective Rewards Section */}
          <div className="space-y-2 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Gift className="w-3 h-3" />
                Recompensas del Objetivo
              </Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => {
                  const newReward = createAttributeReward('', 0, 'add', { id: `obj-reward-${Date.now().toString(36)}` });
                  onUpdate({ 
                    rewards: [...(objective.rewards || []), newReward] 
                  });
                }}
              >
                <Plus className="w-3 h-3 mr-1" />
                Agregar
              </Button>
            </div>
            
            {(objective.rewards || []).length > 0 && (
              <div className="space-y-2">
                {(objective.rewards || []).map((reward, rewardIdx) => {
                  const normalized = normalizeReward(reward);
                  const isAttr = normalized.type === 'attribute';
                  const isTrig = normalized.type === 'trigger';
                  
                  return (
                    <div key={reward.id} className="p-2 rounded bg-muted/20 space-y-2">
                      {/* Tipo y preview */}
                      <div className="flex items-center gap-2">
                        <Select 
                          value={normalized.type} 
                          onValueChange={(v) => {
                            let newReward: QuestReward;
                            if (v === 'attribute') {
                              newReward = createAttributeReward(
                                normalized.attribute?.key || normalized.key || '',
                                normalized.attribute?.value ?? normalized.value ?? 0,
                                normalized.attribute?.action || 'add',
                                { id: reward.id }
                              );
                            } else {
                              newReward = createTriggerReward(
                                normalized.trigger?.category || 'sprite',
                                normalized.trigger?.key || normalized.key || '',
                                normalized.trigger?.targetMode || 'self',
                                { id: reward.id }
                              );
                            }
                            const updatedRewards = [...(objective.rewards || [])];
                            updatedRewards[rewardIdx] = newReward;
                            onUpdate({ rewards: updatedRewards });
                          }}
                        >
                          <SelectTrigger className="bg-background h-6 text-xs w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="attribute">📊 Atributo</SelectItem>
                            <SelectItem value="trigger">⚡ Trigger</SelectItem>
                          </SelectContent>
                        </Select>
                        <Badge variant="outline" className="text-[10px]">
                          {describeReward(normalized)}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-500 hover:bg-red-500/10 ml-auto"
                          onClick={() => {
                            const updatedRewards = (objective.rewards || []).filter((_, i) => i !== rewardIdx);
                            onUpdate({ rewards: updatedRewards });
                          }}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                      
                      {/* Config según tipo */}
                      {isAttr && normalized.attribute && (
                        <div className="grid grid-cols-3 gap-2">
                          <Input
                            value={normalized.attribute.key}
                            onChange={(e) => {
                              const updatedRewards = [...(objective.rewards || [])];
                              updatedRewards[rewardIdx] = {
                                ...reward,
                                attribute: { ...normalized.attribute!, key: e.target.value }
                              };
                              onUpdate({ rewards: updatedRewards });
                            }}
                            placeholder="Key"
                            className="bg-background h-6 text-xs"
                          />
                          <Input
                            type="number"
                            value={normalized.attribute.value}
                            onChange={(e) => {
                              const updatedRewards = [...(objective.rewards || [])];
                              updatedRewards[rewardIdx] = {
                                ...reward,
                                attribute: { ...normalized.attribute!, value: Number(e.target.value) }
                              };
                              onUpdate({ rewards: updatedRewards });
                            }}
                            placeholder="Valor"
                            className="bg-background h-6 text-xs"
                          />
                          <Select 
                            value={normalized.attribute.action} 
                            onValueChange={(v) => {
                              const updatedRewards = [...(objective.rewards || [])];
                              updatedRewards[rewardIdx] = {
                                ...reward,
                                attribute: { ...normalized.attribute!, action: v as AttributeAction }
                              };
                              onUpdate({ rewards: updatedRewards });
                            }}
                          >
                            <SelectTrigger className="bg-background h-6 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="add">+</SelectItem>
                              <SelectItem value="subtract">-</SelectItem>
                              <SelectItem value="set">=</SelectItem>
                              <SelectItem value="multiply">×</SelectItem>
                              <SelectItem value="divide">÷</SelectItem>
                              <SelectItem value="percent">%</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      
                      {isTrig && normalized.trigger && (
                        <>
                          <div className="grid grid-cols-3 gap-2">
                            <Select 
                              value={normalized.trigger.category} 
                              onValueChange={(v) => {
                                const updatedRewards = [...(objective.rewards || [])];
                                updatedRewards[rewardIdx] = {
                                  ...reward,
                                  trigger: { ...normalized.trigger!, category: v as TriggerCategory }
                                };
                                onUpdate({ rewards: updatedRewards });
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
                                const updatedRewards = [...(objective.rewards || [])];
                                updatedRewards[rewardIdx] = {
                                  ...reward,
                                  trigger: { ...normalized.trigger!, key: e.target.value }
                                };
                                onUpdate({ rewards: updatedRewards });
                              }}
                              placeholder="Key"
                              className="bg-background h-6 text-xs"
                            />
                            <Select 
                              value={normalized.trigger.targetMode} 
                              onValueChange={(v) => {
                                const updatedRewards = [...(objective.rewards || [])];
                                updatedRewards[rewardIdx] = {
                                  ...reward,
                                  trigger: { ...normalized.trigger!, targetMode: v as TriggerTargetMode }
                                };
                                onUpdate({ rewards: updatedRewards });
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
                          
                          {/* Character selector when targetMode is 'target' */}
                          {normalized.trigger.targetMode === 'target' && (
                            <div className="grid grid-cols-2 gap-2">
                              <Select 
                                value={normalized.trigger.targetCharacterId || ''} 
                                onValueChange={(v) => {
                                  const updatedRewards = [...(objective.rewards || [])];
                                  updatedRewards[rewardIdx] = {
                                    ...reward,
                                    trigger: { ...normalized.trigger!, targetCharacterId: v }
                                  };
                                  onUpdate({ rewards: updatedRewards });
                                }}
                              >
                                <SelectTrigger className="bg-background h-6 text-xs">
                                  <SelectValue placeholder="Seleccionar personaje..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {allCharacters.map((char) => (
                                    <SelectItem key={char.id} value={char.id}>
                                      {char.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <div className="flex items-center text-[10px] text-muted-foreground">
                                Personaje que recibirá el trigger
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            
            {(objective.rewards || []).length === 0 && (
              <p className="text-[10px] text-muted-foreground italic">
                Sin recompensas. Se ejecutarán al completar este objetivo.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Quest Template Editor Dialog
// ============================================

interface QuestTemplateEditorDialogProps {
  template: QuestTemplate | null;
  isNew: boolean;
  onSave: (template: QuestTemplate) => void;
  onClose: () => void;
  existingIds: string[];
  objectivePrefix: string;
}

function QuestTemplateEditorDialog({ template, isNew, onSave, onClose, existingIds, objectivePrefix }: QuestTemplateEditorDialogProps) {
  // Basic info
  const [id, setId] = useState(template?.id || '');
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [priority, setPriority] = useState<QuestPriority>(template?.priority || 'side');
  const [icon, setIcon] = useState(template?.icon || '📜');
  const [isRepeatable, setIsRepeatable] = useState(template?.isRepeatable ?? false);
  const [isHidden, setIsHidden] = useState(template?.isHidden ?? false);
  const [prerequisites, setPrerequisites] = useState<string[]>(template?.prerequisites || []);
  
  // Activation
  const [activationKey, setActivationKey] = useState(template?.activation?.key || '');
  const [activationKeys, setActivationKeys] = useState<string[]>(template?.activation?.keys || []);
  const [activationCaseSensitive, setActivationCaseSensitive] = useState(template?.activation?.caseSensitive ?? false);
  const [activationMethod, setActivationMethod] = useState<QuestActivationMethod>(template?.activation?.method || 'keyword');
  const [turnInterval, setTurnInterval] = useState(template?.activation?.turnInterval || 5);
  
  // Completion
  const [completionKey, setCompletionKey] = useState(template?.completion?.key || '');
  const [completionKeys, setCompletionKeys] = useState<string[]>(template?.completion?.keys || []);
  const [completionCaseSensitive, setCompletionCaseSensitive] = useState(template?.completion?.caseSensitive ?? false);
  const [completionValueCondition, setCompletionValueCondition] = useState<QuestValueCondition | undefined>(template?.completion?.valueCondition);
  
  // Objectives & Rewards
  const [objectives, setObjectives] = useState<QuestObjectiveTemplate[]>(template?.objectives || []);
  const [rewards, setRewards] = useState<QuestReward[]>(template?.rewards || []);
  
  // Chain config
  const [chainType, setChainType] = useState<'none' | 'specific' | 'random'>(template?.chain?.type || 'none');
  const [chainNextQuestId, setChainNextQuestId] = useState(template?.chain?.nextQuestId || '');
  const [chainAutoStart, setChainAutoStart] = useState(template?.chain?.autoStart ?? false);
  const [chainRandomPool, setChainRandomPool] = useState<string[]>(template?.chain?.randomPool || []);

  // Validation
  const [errors, setErrors] = useState<string[]>([]);

  // Active tab for the editor
  const [activeSection, setActiveSection] = useState<'basic' | 'activation' | 'objectives' | 'completion' | 'rewards'>('basic');

  // Track expanded objectives (for accordion)
  const [expandedObjectives, setExpandedObjectives] = useState<Set<string>>(new Set());

  // Get all characters for the character filter
  const allCharacters = useTavernStore((state) => state.characters);

  // DnD sensors for objectives
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = objectives.findIndex((obj) => obj.id === active.id);
      const newIndex = objectives.findIndex((obj) => obj.id === over.id);
      setObjectives(arrayMove(objectives, oldIndex, newIndex));
    }
  };

  const validate = (): boolean => {
    const newErrors: string[] = [];
    
    if (!id.trim()) newErrors.push('ID es requerido');
    if (!name.trim()) newErrors.push('Nombre es requerido');
    if (!activationKey.trim()) newErrors.push('Key de activación es requerida');
    if (!completionKey.trim()) newErrors.push('Key de completado es requerida');
    
    if (isNew && existingIds.includes(id)) {
      newErrors.push('Ya existe un template con este ID');
    }
    
    // Validate objectives
    objectives.forEach((obj, i) => {
      if (!obj.id) newErrors.push(`Objetivo ${i + 1}: ID requerido`);
      if (!obj.completion?.key) newErrors.push(`Objetivo ${i + 1}: Key de completado requerida`);
    });
    
    // Validate rewards
    rewards.forEach((reward, i) => {
      if (!reward.id) newErrors.push(`Recompensa ${i + 1}: ID requerido`);
      if (!reward.key) newErrors.push(`Recompensa ${i + 1}: Key requerida`);
    });
    
    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    
    const now = new Date().toISOString();
    
    const newTemplate: QuestTemplate = {
      id,
      name,
      description,
      priority,
      icon,
      isRepeatable,
      isHidden,
      prerequisites,
      
      activation: {
        key: activationKey,
        keys: activationKeys,
        caseSensitive: activationCaseSensitive,
        method: activationMethod,
        turnInterval: activationMethod === 'turn' ? turnInterval : undefined,
      },
      
      objectives,
      
      completion: {
        key: completionKey,
        keys: completionKeys,
        caseSensitive: completionCaseSensitive,
        valueCondition: completionValueCondition,
      },
      
      chain: chainType !== 'none' ? {
        type: chainType,
        nextQuestId: chainType === 'specific' ? chainNextQuestId : undefined,
        autoStart: chainAutoStart,
        randomPool: chainType === 'random' ? chainRandomPool : undefined,
      } : undefined,
      
      rewards,
      
      createdAt: template?.createdAt || now,
      updatedAt: now,
    };
    
    onSave(newTemplate);
  };

  // Objective management
  const addObjective = () => {
    const newObjective: QuestObjectiveTemplate = {
      id: `obj-${Date.now().toString(36)}`,
      description: '',
      type: 'custom',
      completion: {
        key: '',
        keys: [],
        caseSensitive: false,
      },
      targetCount: 1,
      isOptional: false,
    };
    setObjectives([...objectives, newObjective]);
  };

  const updateObjective = (index: number, updates: Partial<QuestObjectiveTemplate>) => {
    setObjectives(objectives.map((obj, i) => i === index ? { ...obj, ...updates } : obj));
  };

  const removeObjective = (index: number) => {
    setObjectives(objectives.filter((_, i) => i !== index));
  };

  const moveObjective = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= objectives.length) return;
    const newObjectives = [...objectives];
    [newObjectives[index], newObjectives[newIndex]] = [newObjectives[newIndex], newObjectives[index]];
    setObjectives(newObjectives);
  };

  const toggleObjectiveExpand = (objectiveId: string) => {
    setExpandedObjectives((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(objectiveId)) {
        newSet.delete(objectiveId);
      } else {
        newSet.add(objectiveId);
      }
      return newSet;
    });
  };

  // Helper to get objective summary for collapsed view
  const getObjectiveSummary = (obj: QuestObjectiveTemplate): string => {
    const parts: string[] = [];
    if (obj.description) {
      parts.push(obj.description.substring(0, 40) + (obj.description.length > 40 ? '...' : ''));
    }
    if (obj.completion?.key) {
      parts.push(`Key: ${obj.completion.key}`);
    }
    if (obj.targetCount > 1) {
      parts.push(`x${obj.targetCount}`);
    }
    if (obj.characterFilter?.enabled && obj.characterFilter.characterIds.length > 0) {
      const charNames = obj.characterFilter.characterIds
        .map(id => allCharacters.find(c => c.id === id)?.name)
        .filter(Boolean)
        .slice(0, 2)
        .join(', ');
      const remaining = obj.characterFilter.characterIds.length - 2;
      parts.push(`👥 ${charNames}${remaining > 0 ? ` +${remaining}` : ''}`);
    }
    return parts.join(' | ') || 'Sin configurar';
  };

  // Reward management
  const addReward = () => {
    const newReward = createAttributeReward('', 0, 'add');
    setRewards([...rewards, newReward]);
  };

  const updateReward = (index: number, updates: Partial<QuestReward>) => {
    setRewards(rewards.map((reward, i) => {
      if (i !== index) return reward;
      
      // Si se cambia el tipo, necesitamos crear la estructura correcta
      if (updates.type && updates.type !== reward.type) {
        if (updates.type === 'attribute') {
          return createAttributeReward(
            reward.attribute?.key || reward.key || '',
            reward.attribute?.value ?? reward.value ?? 0,
            reward.attribute?.action || reward.action || 'add'
          );
        }
        if (updates.type === 'trigger') {
          return createTriggerReward(
            'sprite',
            reward.trigger?.key || reward.key || '',
            reward.trigger?.targetMode || 'self'
          );
        }
      }
      
      // Normal update
      const updated = { ...reward, ...updates };
      
      // Si es tipo attribute, actualizar el objeto attribute
      if (updated.type === 'attribute') {
        updated.attribute = {
          key: updates.attribute?.key ?? reward.attribute?.key ?? reward.key ?? '',
          value: updates.attribute?.value ?? reward.attribute?.value ?? reward.value ?? 0,
          action: updates.attribute?.action ?? reward.attribute?.action ?? reward.action ?? 'add',
        };
      }
      
      // Si es tipo trigger, actualizar el objeto trigger
      if (updated.type === 'trigger') {
        updated.trigger = {
          category: updates.trigger?.category ?? reward.trigger?.category ?? 'sprite',
          key: updates.trigger?.key ?? reward.trigger?.key ?? reward.key ?? '',
          targetMode: updates.trigger?.targetMode ?? reward.trigger?.targetMode ?? 'self',
          returnToIdleMs: updates.trigger?.returnToIdleMs ?? reward.trigger?.returnToIdleMs,
          volume: updates.trigger?.volume ?? reward.trigger?.volume,
          transitionDuration: updates.trigger?.transitionDuration ?? reward.trigger?.transitionDuration,
        };
      }
      
      return updated;
    }));
  };

  const removeReward = (index: number) => {
    setRewards(rewards.filter((_, i) => i !== index));
  };

  // Section navigation buttons with themed colors
  const sections = [
    { id: 'basic', label: 'Info Básica', icon: <Settings2 className="w-4 h-4" />, color: 'slate' },
    { id: 'activation', label: 'Activación', icon: <Zap className="w-4 h-4" />, color: 'amber' },
    { id: 'objectives', label: 'Objetivos', icon: <Target className="w-4 h-4" />, color: 'purple' },
    { id: 'completion', label: 'Completado', icon: <Check className="w-4 h-4" />, color: 'green' },
    { id: 'rewards', label: 'Recompensas', icon: <Gift className="w-4 h-4" />, color: 'pink' },
  ] as const;

  const sectionColors: Record<string, { bg: string; text: string; border: string; activeBg: string }> = {
    slate: { bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-500/30', activeBg: 'bg-slate-500/20' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30', activeBg: 'bg-amber-500/20' },
    purple: { bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/30', activeBg: 'bg-purple-500/20' },
    green: { bg: 'bg-green-500/10', text: 'text-green-600 dark:text-green-400', border: 'border-green-500/30', activeBg: 'bg-green-500/20' },
    pink: { bg: 'bg-pink-500/10', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-500/30', activeBg: 'bg-pink-500/20' },
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="h-full flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-border/50 flex-shrink-0">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 shrink-0">
            {isNew ? <Plus className="w-5 h-5 text-amber-500" /> : <Pencil className="w-5 h-5 text-amber-500" />}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold truncate">{isNew ? 'Crear Nuevo Template' : 'Editar Template'}</h2>
            {name && <p className="text-xs text-muted-foreground truncate">{name}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!id.trim() || !name.trim()}>
            <Save className="w-4 h-4 mr-2" />
            {isNew ? 'Crear' : 'Guardar'}
          </Button>
        </div>
      </div>

      {/* Section Tabs with themed colors */}
      <div className="flex gap-2 py-2 border-b border-border/50 px-6 flex-shrink-0">
          {sections.map((section) => {
            const colors = sectionColors[section.color];
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap border",
                  activeSection === section.id
                    ? `${colors.activeBg} ${colors.text} ${colors.border}`
                    : "bg-transparent text-muted-foreground hover:bg-muted/50 border-transparent hover:border-border/50"
                )}
              >
                <span className={activeSection === section.id ? colors.text : ''}>{section.icon}</span>
                {section.label}
              </button>
            );
          })}
        </div>

        {/* Error Messages */}
        {errors.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="text-sm text-red-600 dark:text-red-400">
              <ul className="list-disc list-inside">
                {errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          <div className="grid grid-cols-1 2xl:grid-cols-[1fr_380px] h-full">
            {/* Left: Form sections */}
            <div className="overflow-y-auto p-6">
          {/* Basic Info Section */}
          {activeSection === 'basic' && (
            <div className="space-y-6">
              {/* Banner */}
              <div className="rounded-xl bg-gradient-to-r from-slate-500/10 via-slate-500/5 to-slate-500/10 border border-slate-500/20 p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-slate-500/20">
                    <Settings2 className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      Información Básica
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Define el identificador, nombre y propiedades generales de la misión.
                    </p>
                  </div>
                </div>
              </div>

              {/* Identificación */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <div className="p-1.5 rounded-md bg-slate-500/10">
                    <Hash className="w-4 h-4 text-slate-500" />
                  </div>
                  Identificación
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 pl-8">
                  <div className="space-y-2">
                    <Label htmlFor="template-id" className="text-xs text-muted-foreground">ID del Template</Label>
                    <Input
                      id="template-id"
                      value={id}
                      onChange={(e) => setId(e.target.value.replace(/\s+/g, '-').toLowerCase())}
                      placeholder="ejemplo-mision"
                      disabled={!isNew}
                      className="bg-background font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground">Identificador único, sin espacios</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="template-name" className="text-xs text-muted-foreground">Nombre</Label>
                    <Input
                      id="template-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Misión de Ejemplo"
                      className="bg-background"
                    />
                  </div>
                </div>
              </div>

              <Separator className="bg-border/50" />

              {/* Descripción */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <div className="p-1.5 rounded-md bg-slate-500/10">
                    <FileText className="w-4 h-4 text-slate-500" />
                  </div>
                  Descripción
                </div>
                <div className="pl-8 space-y-2">
                  <Textarea
                    id="template-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe la misión..."
                    className="bg-background min-h-[80px]"
                  />
                </div>
              </div>

              <Separator className="bg-border/50" />

              {/* Propiedades */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <div className="p-1.5 rounded-md bg-amber-500/10">
                    <Star className="w-4 h-4 text-amber-500" />
                  </div>
                  Propiedades
                </div>
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 pl-8">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Prioridad</Label>
                    <Select value={priority} onValueChange={(v) => setPriority(v as QuestPriority)}>
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="main">
                          <div className="flex items-center gap-2">
                            <Star className="w-3.5 h-3.5 text-amber-500" />
                            Principal
                          </div>
                        </SelectItem>
                        <SelectItem value="side">
                          <div className="flex items-center gap-2">
                            <Target className="w-3.5 h-3.5 text-blue-500" />
                            Secundaria
                          </div>
                        </SelectItem>
                        <SelectItem value="hidden">
                          <div className="flex items-center gap-2">
                            <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                            Oculta
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="template-icon" className="text-xs text-muted-foreground">Icono (emoji)</Label>
                    <Input
                      id="template-icon"
                      value={icon}
                      onChange={(e) => setIcon(e.target.value)}
                      placeholder="📜"
                      className="bg-background text-center text-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Comportamiento</Label>
                    <div className="flex flex-col gap-2 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Switch
                          checked={isRepeatable}
                          onCheckedChange={setIsRepeatable}
                        />
                        <span className="text-sm">Repetible</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Switch
                          checked={isHidden}
                          onCheckedChange={setIsHidden}
                        />
                        <span className="text-sm">Oculta</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <Separator className="bg-border/50" />

              {/* Prerrequisitos */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <div className="p-1.5 rounded-md bg-cyan-500/10">
                    <Link2 className="w-4 h-4 text-cyan-500" />
                  </div>
                  Prerrequisitos
                </div>
                <div className="pl-8 space-y-2">
                  <Input
                    id="prerequisites"
                    value={prerequisites.join(', ')}
                    onChange={(e) => setPrerequisites(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                    placeholder="mision-anterior, otra-mision"
                    className="bg-background font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Esta misión no estará disponible hasta que se completen las misiones listadas (IDs separadas por coma)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Activation Section */}
          {activeSection === 'activation' && (
            <div className="space-y-6">
              {/* Banner */}
              <div className="rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-500/10 border border-amber-500/20 p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/20">
                    <Zap className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                      Activación de la Misión
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Define cómo y cuándo la misión se activa. La key detecta cuándo debe comenzar.
                    </p>
                  </div>
                </div>
              </div>

              {/* Keys de Activación */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <div className="p-1.5 rounded-md bg-amber-500/10">
                    <Zap className="w-4 h-4 text-amber-500" />
                  </div>
                  Keys de Activación
                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground ml-1" title="El LLM puede generar estas keys en su respuesta" />
                </div>
                <div className="pl-8 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="activation-key" className="text-xs text-muted-foreground">Key Principal</Label>
                    <Input
                      id="activation-key"
                      value={activationKey}
                      onChange={(e) => setActivationKey(e.target.value)}
                      placeholder="mision:rescate"
                      className="bg-background font-mono"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="activation-keys" className="text-xs text-muted-foreground">Keys Alternativas</Label>
                    <Input
                      id="activation-keys"
                      value={activationKeys.join(', ')}
                      onChange={(e) => setActivationKeys(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                      placeholder="mission:rescue, quest:rescate"
                      className="bg-background font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground">Separadas por coma. Se detectará cualquiera de estas keys.</p>
                  </div>
                </div>
              </div>

              <Separator className="bg-border/50" />

              {/* Método de Activación */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <div className="p-1.5 rounded-md bg-orange-500/10">
                    <ToggleRight className="w-4 h-4 text-orange-500" />
                  </div>
                  Método de Activación
                </div>
                <div className="pl-8 space-y-4">
                  <Select value={activationMethod} onValueChange={(v) => setActivationMethod(v as QuestActivationMethod)}>
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keyword">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-amber-500" />
                          <div>
                            <span className="font-medium">Por Keyword</span>
                            <span className="text-xs text-muted-foreground ml-2">Detecta la key en el chat</span>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="turn">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-blue-500" />
                          <div>
                            <span className="font-medium">Por Turnos</span>
                            <span className="text-xs text-muted-foreground ml-2">Se activa cada N turnos</span>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="manual">
                        <div className="flex items-center gap-2">
                          <ToggleLeft className="w-4 h-4 text-slate-500" />
                          <div>
                            <span className="font-medium">Manual</span>
                            <span className="text-xs text-muted-foreground ml-2">Solo se activa manualmente</span>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="chain">
                        <div className="flex items-center gap-2">
                          <Link2 className="w-4 h-4 text-purple-500" />
                          <div>
                            <span className="font-medium">En Cadena</span>
                            <span className="text-xs text-muted-foreground ml-2">Se activa al completar otra misión</span>
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {activationMethod === 'turn' && (
                    <div className="p-4 rounded-lg border border-blue-500/20 bg-blue-500/5">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/20">
                          <Clock className="w-4 h-4 text-blue-500" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <Label htmlFor="turn-interval" className="text-xs text-muted-foreground">Cada cuántos turnos</Label>
                          <Input
                            id="turn-interval"
                            type="number"
                            min={1}
                            value={turnInterval}
                            onChange={(e) => setTurnInterval(Number(e.target.value))}
                            className="bg-background w-32"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Separator className="bg-border/50" />

              {/* Opciones Adicionales */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <div className="p-1.5 rounded-md bg-cyan-500/10">
                    <Settings2 className="w-4 h-4 text-cyan-500" />
                  </div>
                  Opciones Adicionales
                </div>
                <div className="pl-8">
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-gradient-to-r from-background to-muted/30 cursor-pointer hover:border-cyan-500/30 transition-colors">
                    <Switch
                      checked={activationCaseSensitive}
                      onCheckedChange={setActivationCaseSensitive}
                    />
                    <div>
                      <span className="text-sm font-medium">Distinguir mayúsculas/minúsculas</span>
                      <p className="text-xs text-muted-foreground">La key debe coincidir exactamente en casing</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Objectives Section */}
          {activeSection === 'objectives' && (
            <div className="space-y-6">
              {/* Banner */}
              <div className="rounded-xl bg-gradient-to-r from-purple-500/10 via-violet-500/5 to-purple-500/10 border border-purple-500/20 p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/20">
                    <Target className="w-4 h-4 text-purple-500" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-purple-600 dark:text-purple-400">
                      Objetivos de la Misión
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Define los objetivos que deben completarse. Arrastra para reordenar • Clic para expandir/colapsar
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">
                  <Target className="w-3 h-3 mr-1" />
                  {objectives.length} objetivo{objectives.length !== 1 ? 's' : ''}
                </Badge>
                <Button variant="outline" size="sm" onClick={addObjective} className="hover:border-purple-500/30 hover:bg-purple-500/5">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Agregar Objetivo
                </Button>
              </div>

              {objectives.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-xl bg-gradient-to-br from-muted/50 to-muted/30">
                  <div className="p-3 rounded-full bg-purple-500/10 w-fit mx-auto mb-3">
                    <Target className="w-8 h-8 text-purple-400" />
                  </div>
                  <p className="text-muted-foreground text-sm mb-1">No hay objetivos definidos</p>
                  <p className="text-muted-foreground/60 text-xs">Agrega objetivos para que los jugadores puedan completar la misión</p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={objectives.map(obj => obj.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {objectives.map((obj, index) => (
                        <SortableObjectiveItem
                          key={obj.id}
                          objective={obj}
                          index={index}
                          totalObjectives={objectives.length}
                          isExpanded={expandedObjectives.has(obj.id)}
                          onToggleExpand={() => toggleObjectiveExpand(obj.id)}
                          onUpdate={(updates) => updateObjective(index, updates)}
                          onRemove={() => removeObjective(index)}
                          allCharacters={allCharacters}
                          objectivePrefix={objectivePrefix}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          )}

          {/* Completion Section */}
          {activeSection === 'completion' && (
            <div className="space-y-6">
              {/* Banner */}
              <div className="rounded-xl bg-gradient-to-r from-green-500/10 via-emerald-500/5 to-green-500/10 border border-green-500/20 p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <Check className="w-4 h-4 text-green-500" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      Completado de la Misión
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Define las keys y condiciones para completar exitosamente la misión. Se ejecutan las recompensas automáticamente.
                    </p>
                  </div>
                </div>
              </div>

              {/* Keys de Completado */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <div className="p-1.5 rounded-md bg-green-500/10">
                    <Check className="w-4 h-4 text-green-500" />
                  </div>
                  Keys de Completado
                </div>
                <div className="pl-8 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="completion-key" className="text-xs text-muted-foreground">Key Principal</Label>
                    <Input
                      id="completion-key"
                      value={completionKey}
                      onChange={(e) => setCompletionKey(e.target.value)}
                      placeholder="mision:completada"
                      className="bg-background font-mono"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="completion-keys" className="text-xs text-muted-foreground">Keys Alternativas</Label>
                    <Input
                      id="completion-keys"
                      value={completionKeys.join(', ')}
                      onChange={(e) => setCompletionKeys(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                      placeholder="mission:complete, quest:done"
                      className="bg-background font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground">Separadas por coma. Se detectará cualquiera de estas keys.</p>
                  </div>

                  <label className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-gradient-to-r from-background to-muted/30 cursor-pointer hover:border-green-500/30 transition-colors">
                    <Switch
                      checked={completionCaseSensitive}
                      onCheckedChange={setCompletionCaseSensitive}
                    />
                    <div>
                      <span className="text-sm font-medium">Distinguir mayúsculas/minúsculas</span>
                      <p className="text-xs text-muted-foreground">La key debe coincidir exactamente en casing</p>
                    </div>
                  </label>
                </div>
              </div>

              <Separator className="bg-border/50" />

              {/* Condición de Valor */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <div className="p-1.5 rounded-md bg-emerald-500/10">
                    <Hash className="w-4 h-4 text-emerald-500" />
                  </div>
                  Condición de Valor
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 ml-auto">
                    Avanzado
                  </Badge>
                </div>
                <div className="pl-8">
                  <div className="p-4 rounded-lg border border-border/60 bg-gradient-to-r from-background to-muted/30">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <Label className="text-sm font-medium">Activar condición</Label>
                        <p className="text-xs text-muted-foreground">Detectar y comparar valores después de la key</p>
                      </div>
                      <Switch
                        checked={!!completionValueCondition}
                        onCheckedChange={(v) => setCompletionValueCondition(v ? { valueType: 'presence' } : undefined)}
                      />
                    </div>
                    
                    {completionValueCondition && (
                      <div className="space-y-3 pt-3 border-t border-border/50">
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Tipo de Valor</Label>
                            <Select 
                              value={completionValueCondition.valueType} 
                              onValueChange={(v) => setCompletionValueCondition({ 
                                ...completionValueCondition, 
                                valueType: v as QuestValueType 
                              })}
                            >
                              <SelectTrigger className="bg-background h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="presence">Presencia</SelectItem>
                                <SelectItem value="number">Número</SelectItem>
                                <SelectItem value="text">Texto</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {completionValueCondition.valueType !== 'presence' && (
                            <>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Operador</Label>
                                <Select 
                                  value={completionValueCondition.operator || (completionValueCondition.valueType === 'number' ? '==' : 'equals')} 
                                  onValueChange={(v) => setCompletionValueCondition({ 
                                    ...completionValueCondition, 
                                    operator: v as any 
                                  })}
                                >
                                  <SelectTrigger className="bg-background h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {completionValueCondition.valueType === 'number' ? (
                                      <>
                                        <SelectItem value=">">&gt; Mayor que</SelectItem>
                                        <SelectItem value="<">&lt; Menor que</SelectItem>
                                        <SelectItem value=">=">≥ Mayor o igual</SelectItem>
                                        <SelectItem value="<=">≤ Menor o igual</SelectItem>
                                        <SelectItem value="==">= Igual</SelectItem>
                                        <SelectItem value="!=">≠ Diferente</SelectItem>
                                      </>
                                    ) : (
                                      <>
                                        <SelectItem value="equals">Igual a</SelectItem>
                                        <SelectItem value="contains">Contiene</SelectItem>
                                        <SelectItem value="startsWith">Empieza con</SelectItem>
                                        <SelectItem value="endsWith">Termina con</SelectItem>
                                        <SelectItem value="notEquals">Diferente de</SelectItem>
                                      </>
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Valor Objetivo</Label>
                                <Input
                                  value={String(completionValueCondition.targetValue || '')}
                                  onChange={(e) => setCompletionValueCondition({ 
                                    ...completionValueCondition, 
                                    targetValue: completionValueCondition.valueType === 'number' 
                                      ? Number(e.target.value) 
                                      : e.target.value 
                                  })}
                                  placeholder={completionValueCondition.valueType === 'number' ? '50' : 'texto'}
                                  className="bg-background h-8"
                                />
                              </div>
                            </>
                          )}

                          {completionValueCondition.valueType === 'presence' && (
                            <div className="col-span-2 flex items-center text-xs text-muted-foreground p-2 rounded bg-muted/30">
                              <Info className="w-3.5 h-3.5 mr-2 shrink-0" />
                              Detecta si la key existe en el texto (comportamiento por defecto)
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <Separator className="bg-border/50" />

              {/* Configuración de Cadena */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <div className="p-1.5 rounded-md bg-violet-500/10">
                    <Link2 className="w-4 h-4 text-violet-500" />
                  </div>
                  Cadena de Misiones
                </div>
                <div className="pl-8 space-y-4">
                  <Select value={chainType} onValueChange={(v) => setChainType(v as 'none' | 'specific' | 'random')}>
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <div className="flex items-center gap-2">
                          <X className="w-4 h-4 text-slate-500" />
                          <span>Sin cadena</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="specific">
                        <div className="flex items-center gap-2">
                          <Link2 className="w-4 h-4 text-violet-500" />
                          <span>Siguiente específico</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="random">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-amber-500" />
                          <span>Pool aleatorio</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {chainType === 'specific' && (
                    <div className="p-4 rounded-lg border border-violet-500/20 bg-violet-500/5">
                      <Label className="text-xs text-muted-foreground mb-2 block">ID de la Siguiente Misión</Label>
                      <Input
                        value={chainNextQuestId}
                        onChange={(e) => setChainNextQuestId(e.target.value)}
                        placeholder="siguiente-mision"
                        className="bg-background font-mono"
                      />
                    </div>
                  )}

                  {chainType === 'random' && (
                    <div className="p-4 rounded-lg border border-amber-500/20 bg-amber-500/5">
                      <Label className="text-xs text-muted-foreground mb-2 block">Pool de Misiones</Label>
                      <Input
                        value={chainRandomPool.join(', ')}
                        onChange={(e) => setChainRandomPool(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                        placeholder="mision-1, mision-2, mision-3"
                        className="bg-background font-mono"
                      />
                      <p className="text-[10px] text-muted-foreground mt-2">IDs separados por coma. Se seleccionará una aleatoriamente.</p>
                    </div>
                  )}

                  {chainType !== 'none' && (
                    <label className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-gradient-to-r from-background to-muted/30 cursor-pointer hover:border-violet-500/30 transition-colors">
                      <Switch
                        checked={chainAutoStart}
                        onCheckedChange={setChainAutoStart}
                      />
                      <div>
                        <span className="text-sm font-medium">Iniciar automáticamente</span>
                        <p className="text-xs text-muted-foreground">La siguiente misión se activará sin intervención manual</p>
                      </div>
                    </label>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Rewards Section */}
          {activeSection === 'rewards' && (
            <div className="space-y-6">
              {/* Banner */}
              <div className="rounded-xl bg-gradient-to-r from-pink-500/10 via-rose-500/5 to-pink-500/10 border border-pink-500/20 p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-pink-500/20">
                    <Gift className="w-4 h-4 text-pink-500" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-pink-600 dark:text-pink-400">
                      Recompensas de la Misión
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Define las recompensas que se otorgan al completar la misión. Pueden modificar atributos o ejecutar triggers.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Badge variant="outline" className="bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20">
                  <Gift className="w-3 h-3 mr-1" />
                  {rewards.length} recompensa{rewards.length !== 1 ? 's' : ''}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addReward}
                  className="hover:border-pink-500/30 hover:bg-pink-500/5"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Agregar Recompensa
                </Button>
              </div>

              {rewards.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-xl bg-gradient-to-br from-muted/50 to-muted/30">
                  <div className="p-3 rounded-full bg-pink-500/10 w-fit mx-auto mb-3">
                    <Gift className="w-8 h-8 text-pink-400" />
                  </div>
                  <p className="text-muted-foreground text-sm mb-1">No hay recompensas definidas</p>
                  <p className="text-muted-foreground/60 text-xs">Agrega recompensas que se otorgarán al completar la misión</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rewards.map((reward, index) => {
                    const normalized = normalizeReward(reward);
                    const isAttr = normalized.type === 'attribute';
                    const isTrig = normalized.type === 'trigger';

                    return (
                      <div key={reward.id} className="p-4 rounded-lg border border-border/60 bg-gradient-to-r from-background to-muted/20 space-y-3">
                        {/* Tipo y preview */}
                        <div className="flex items-center gap-2">
                          <Select 
                            value={normalized.type} 
                            onValueChange={(v) => updateReward(index, { type: v as QuestRewardType })}
                          >
                            <SelectTrigger className="bg-background h-8 text-xs w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="attribute">
                                <div className="flex items-center gap-2">
                                  <Hash className="w-3.5 h-3.5 text-blue-500" />
                                  Atributo
                                </div>
                              </SelectItem>
                              <SelectItem value="trigger">
                                <div className="flex items-center gap-2">
                                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                                  Trigger
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <Badge variant="outline" className="text-xs bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20">
                            {describeReward(normalized)}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-500 hover:bg-red-500/10 ml-auto"
                            onClick={() => removeReward(index)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        {/* Config según tipo */}
                        {isAttr && normalized.attribute && (
                          <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Key del Atributo</Label>
                              <Input
                                value={normalized.attribute.key}
                                onChange={(e) => updateReward(index, { 
                                  attribute: { ...normalized.attribute!, key: e.target.value } 
                                })}
                                placeholder="oro, xp, vida..."
                                className="bg-background h-8 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Valor</Label>
                              <Input
                                type="number"
                                value={normalized.attribute.value}
                                onChange={(e) => updateReward(index, { 
                                  attribute: { ...normalized.attribute!, value: Number(e.target.value) } 
                                })}
                                placeholder="100"
                                className="bg-background h-8 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Acción</Label>
                              <Select 
                                value={normalized.attribute.action} 
                                onValueChange={(v) => updateReward(index, { 
                                  attribute: { ...normalized.attribute!, action: v as AttributeAction } 
                                })}
                              >
                                <SelectTrigger className="bg-background h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="add">+ Sumar</SelectItem>
                                  <SelectItem value="subtract">- Restar</SelectItem>
                                  <SelectItem value="set">= Establecer</SelectItem>
                                  <SelectItem value="multiply">× Multiplicar</SelectItem>
                                  <SelectItem value="divide">÷ Dividir</SelectItem>
                                  <SelectItem value="percent">% Porcentaje</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}

                        {isTrig && normalized.trigger && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Categoría</Label>
                                <Select 
                                  value={normalized.trigger.category} 
                                  onValueChange={(v) => updateReward(index, { 
                                    trigger: { ...normalized.trigger!, category: v as TriggerCategory } 
                                  })}
                                >
                                  <SelectTrigger className="bg-background h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="sprite">🖼️ Sprite</SelectItem>
                                    <SelectItem value="sound">🔊 Sonido</SelectItem>
                                    <SelectItem value="background">🌄 Fondo</SelectItem>
                                    <SelectItem value="soundSequence">🎵 Secuencia</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Key</Label>
                                <Input
                                  value={normalized.trigger.key}
                                  onChange={(e) => updateReward(index, { 
                                    trigger: { ...normalized.trigger!, key: e.target.value } 
                                  })}
                                  placeholder="nombre-archivo"
                                  className="bg-background h-8 text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Objetivo</Label>
                                <Select 
                                  value={normalized.trigger.targetMode} 
                                  onValueChange={(v) => updateReward(index, { 
                                    trigger: { ...normalized.trigger!, targetMode: v as TriggerTargetMode } 
                                  })}
                                >
                                  <SelectTrigger className="bg-background h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="self">👤 Self</SelectItem>
                                    <SelectItem value="all">👥 Todos</SelectItem>
                                    <SelectItem value="target">🎯 Target</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* Category-specific options */}
                            {normalized.trigger.category === 'sprite' && (
                              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-violet-500/5 border border-violet-500/20">
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-muted-foreground">Volver a Idle (ms)</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={normalized.trigger.returnToIdleMs || 0}
                                    onChange={(e) => updateReward(index, { 
                                      trigger: { ...normalized.trigger!, returnToIdleMs: Number(e.target.value) } 
                                    })}
                                    placeholder="0 = mantener"
                                    className="bg-background h-8 text-xs"
                                  />
                                </div>
                                <div className="flex items-end text-xs text-muted-foreground pb-2">
                                  0 = mantener sprite indefinidamente
                                </div>
                              </div>
                            )}

                            {normalized.trigger.category === 'sound' && (
                              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-muted-foreground">Volumen (0-1)</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    max={1}
                                    step={0.1}
                                    value={normalized.trigger.volume ?? 0.8}
                                    onChange={(e) => updateReward(index, { 
                                      trigger: { ...normalized.trigger!, volume: Number(e.target.value) } 
                                    })}
                                    placeholder="0.8"
                                    className="bg-background h-8 text-xs"
                                  />
                                </div>
                                <div className="flex items-end text-xs text-muted-foreground pb-2">
                                  Key formato: "coleccion/archivo"
                                </div>
                              </div>
                            )}

                            {normalized.trigger.category === 'background' && (
                              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-muted-foreground">Transición (ms)</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={normalized.trigger.transitionDuration ?? 500}
                                    onChange={(e) => updateReward(index, { 
                                      trigger: { ...normalized.trigger!, transitionDuration: Number(e.target.value) } 
                                    })}
                                    placeholder="500"
                                    className="bg-background h-8 text-xs"
                                  />
                                </div>
                                <div className="flex items-end text-xs text-muted-foreground pb-2">
                                  Key puede ser URL o nombre
                                </div>
                              </div>
                            )}

                            {/* Character selector when targetMode is 'target' */}
                            {normalized.trigger.targetMode === 'target' && (
                              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-rose-500/5 border border-rose-500/20">
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-muted-foreground">Personaje Objetivo</Label>
                                  <Select 
                                    value={normalized.trigger.targetCharacterId || ''} 
                                    onValueChange={(v) => updateReward(index, { 
                                      trigger: { ...normalized.trigger!, targetCharacterId: v } 
                                    })}
                                  >
                                    <SelectTrigger className="bg-background h-8 text-xs">
                                      <SelectValue placeholder="Seleccionar..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {allCharacters.map((char) => (
                                        <SelectItem key={char.id} value={char.id}>
                                          {char.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex items-end text-xs text-muted-foreground pb-2">
                                  Personaje que recibirá el trigger
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          </div>
          {/* End left column */}

          {/* Right: Live Preview - visible on wide screens */}
          <div className="hidden 2xl:block border-l border-border/50 overflow-y-auto p-6 bg-muted/20">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Vista Previa</h3>
            <Card className="border border-border/60 bg-gradient-to-br from-card to-muted/30">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{icon || '📜'}</span>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{name || 'Sin nombre'}</CardTitle>
                    {description && (
                      <CardDescription className="line-clamp-2 mt-1">{description}</CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={sectionColors[priority === 'main' ? 'amber' : priority === 'side' ? 'slate' : 'slate']?.bg || 'bg-muted/50'}>
                    {priority === 'main' ? 'Principal' : priority === 'side' ? 'Secundaria' : 'Oculta'}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <Target className="w-3 h-3 mr-1" />
                    {objectives.length} objetivos
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <Gift className="w-3 h-3 mr-1" />
                    {rewards.length} recompensas
                  </Badge>
                </div>

                <Separator />

                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Activación</p>
                  <p className="text-xs">
                    {activationMethod === 'keyword' && `Key: ${activationKey || '—'}`}
                    {activationMethod === 'turn' && `Cada ${turnInterval} turnos`}
                    {activationMethod === 'manual' && 'Manual'}
                    {activationMethod === 'chain' && 'En cadena'}
                  </p>
                </div>

                {objectives.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Objetivos</p>
                    {objectives.map((obj, i) => (
                      <div key={obj.id || i} className="flex items-center gap-2 text-xs">
                        <div className="w-4 h-4 rounded bg-primary/10 text-primary text-[10px] flex items-center justify-center">
                          {i + 1}
                        </div>
                        <span className="truncate">{obj.description || obj.id || 'Sin configurar'}</span>
                      </div>
                    ))}
                  </div>
                )}

                {rewards.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Recompensas</p>
                    {rewards.slice(0, 5).map((reward, i) => (
                      <div key={reward.id || i} className="text-xs text-muted-foreground">
                        {describeReward(reward)}
                      </div>
                    ))}
                    {rewards.length > 5 && (
                      <p className="text-xs text-muted-foreground/60">+{rewards.length - 5} más...</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          {/* End right column */}

        </div>
        {/* End grid */}

      </div>
      {/* End flex-1 overflow-hidden */}

    </motion.div>
  );
}
