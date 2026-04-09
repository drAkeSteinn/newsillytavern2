'use client';

/**
 * QuestInstanceEditor Component
 * 
 * Simplified editor for quest instances.
 * Only allows editing instance-specific data (notes, manual objective completion).
 * Does NOT allow redefining the quest structure - that should be done in templates.
 */

import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Check,
  X,
  Save,
  Target,
  Trophy,
  FileText,
  Clock,
  Star,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Pause,
  Play,
  RotateCcw,
  Hash,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Quest, QuestObjective, QuestStatus, QuestPriority } from '@/types';
import { describeReward, normalizeReward } from '@/lib/quest/quest-reward-utils';

// ============================================
// Quest Instance Editor Props
// ============================================

interface QuestInstanceEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quest: Quest | undefined;
  onSave: (questId: string, updates: Partial<Quest>) => void;
}

// ============================================
// Status Configuration
// ============================================

const statusConfig: Record<QuestStatus, { label: string; color: string; icon: React.ReactNode }> = {
  active: {
    label: 'Activa',
    color: 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30',
    icon: <Play className="w-3.5 h-3.5" />,
  },
  completed: {
    label: 'Completada',
    color: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  failed: {
    label: 'Fallida',
    color: 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30',
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
  paused: {
    label: 'Pausada',
    color: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30',
    icon: <Pause className="w-3.5 h-3.5" />,
  },
};

const priorityConfig: Record<QuestPriority, { label: string; color: string; icon: React.ReactNode }> = {
  main: {
    label: 'Principal',
    color: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30',
    icon: <Star className="w-3.5 h-3.5" />,
  },
  side: {
    label: 'Secundaria',
    color: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30',
    icon: <Target className="w-3.5 h-3.5" />,
  },
  hidden: {
    label: 'Oculta',
    color: 'bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-500/30',
    icon: <EyeOff className="w-3.5 h-3.5" />,
  },
};

// ============================================
// Quest Instance Editor Component
// ============================================

export function QuestInstanceEditor({
  open,
  onOpenChange,
  quest,
  onSave,
}: QuestInstanceEditorProps) {
  // Local state for editable fields
  // Use key prop on Dialog to reset state when quest changes
  const [notes, setNotes] = useState(() => quest?.notes || '');
  const [objectiveUpdates, setObjectiveUpdates] = useState<Record<string, Partial<QuestObjective>>>({});

  // Calculate progress
  const progress = useMemo(() => {
    if (!quest) return 0;
    const objectives = quest.objectives.map((obj) => ({
      ...obj,
      ...objectiveUpdates[obj.id],
    }));
    const completed = objectives.filter((o) => o.isCompleted).length;
    const total = objectives.filter((o) => !o.isOptional).length;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }, [quest, objectiveUpdates]);

  // Handle objective toggle
  const toggleObjective = useCallback((objectiveId: string) => {
    if (!quest) return;
    const objective = quest.objectives.find((o) => o.id === objectiveId);
    if (!objective) return;

    setObjectiveUpdates((prev) => ({
      ...prev,
      [objectiveId]: {
        isCompleted: !prev[objectiveId]?.isCompleted ?? !objective.isCompleted,
        currentCount: !prev[objectiveId]?.isCompleted ?? !objective.isCompleted
          ? objective.targetCount
          : objective.currentCount,
      },
    }));
  }, [quest]);

  // Handle save
  const handleSave = useCallback(() => {
    if (!quest) return;

    // Build updated objectives array
    const updatedObjectives = quest.objectives.map((obj) => ({
      ...obj,
      ...objectiveUpdates[obj.id],
    }));

    // Recalculate progress
    const completed = updatedObjectives.filter((o) => o.isCompleted).length;
    const total = updatedObjectives.filter((o) => !o.isOptional).length;
    const newProgress = total > 0 ? Math.round((completed / total) * 100) : 0;

    onSave(quest.id, {
      notes,
      objectives: updatedObjectives,
      progress: newProgress,
    });

    setObjectiveUpdates({});
  }, [quest, notes, objectiveUpdates, onSave]);

  // Format date
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!quest) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent key={quest.id} className="max-w-2xl w-[90vw] max-h-[85vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="p-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-3">
            <div className="text-2xl">{quest.icon || '📜'}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="truncate">{quest.title}</span>
                <Badge className={statusConfig[quest.status].color}>
                  {statusConfig[quest.status].icon}
                  <span className="ml-1">{statusConfig[quest.status].label}</span>
                </Badge>
                <Badge className={priorityConfig[quest.priority].color}>
                  {priorityConfig[quest.priority].label}
                </Badge>
              </div>
            </div>
          </DialogTitle>
          <DialogDescription className="mt-2">
            Edita los detalles de esta instancia de misión.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-4">
            {/* Quest Info (Read-only) */}
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground mb-3">
                  {quest.description || 'Sin descripción'}
                </p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Iniciada: {formatDate(quest.startedAt)}
                  </div>
                  {quest.templateId && (
                    <Badge variant="outline" className="text-[10px]">
                      Template: {quest.templateId}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Progress */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Progreso
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Progress value={progress} className="flex-1 h-2" />
                  <span className="text-sm font-mono w-12 text-right">{progress}%</span>
                </div>

                {/* Objectives */}
                <div className="space-y-2 mt-3">
                  {quest.objectives.map((obj) => {
                    const updatedObj = { ...obj, ...objectiveUpdates[obj.id] };
                    const isCompleted = updatedObj.isCompleted;
                    const canToggle = quest.status === 'active';

                    return (
                      <div
                        key={obj.id}
                        onClick={() => canToggle && toggleObjective(obj.id)}
                        className={cn(
                          'flex items-center gap-3 p-2.5 rounded-lg border transition-all',
                          isCompleted
                            ? 'bg-green-500/10 border-green-500/30'
                            : 'bg-muted/30 border-border',
                          canToggle && 'cursor-pointer hover:bg-muted/50'
                        )}
                      >
                        <div
                          className={cn(
                            'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                            isCompleted
                              ? 'border-green-500 bg-green-500'
                              : 'border-muted-foreground/30'
                          )}
                        >
                          {isCompleted && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              'text-sm truncate',
                              isCompleted && 'line-through text-muted-foreground'
                            )}
                          >
                            {obj.description || obj.id}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span>
                              {updatedObj.currentCount}/{updatedObj.targetCount}
                            </span>
                            {obj.isOptional && (
                              <Badge
                                variant="outline"
                                className="text-[9px] h-4 bg-slate-500/10"
                              >
                                Opcional
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Haz clic en un objetivo para marcarlo como completado manualmente.
                </p>
              </CardContent>
            </Card>

            {/* Rewards (Read-only) */}
            {quest.rewards.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    Recompensas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {quest.rewards.map((reward, index) => {
                      const normalized = normalizeReward(reward);
                      const isAttribute = normalized.type === 'attribute';
                      const isTrigger = normalized.type === 'trigger';
                      
                      return (
                        <Badge 
                          key={reward.id || index} 
                          variant="secondary" 
                          className={cn(
                            "gap-1.5 py-1 px-2",
                            isAttribute && "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
                            isTrigger && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                          )}
                        >
                          {isAttribute && <Hash className="w-3 h-3" />}
                          {isTrigger && <Zap className="w-3 h-3" />}
                          <span>{describeReward(normalized)}</span>
                        </Badge>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Las recompensas se aplicarán automáticamente al completar la misión.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Notes (Editable) */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Notas Personales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Añade notas sobre esta misión..."
                  className="min-h-[100px] text-sm"
                />
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        <DialogFooter className="p-4 border-t shrink-0 flex flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-1.5" />
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            <Save className="w-4 h-4 mr-1.5" />
            Guardar Cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default QuestInstanceEditor;
