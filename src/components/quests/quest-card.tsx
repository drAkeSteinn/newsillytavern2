'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ScrollArea,
} from '@/components/ui/scroll-area';
import {
  ChevronDown,
  MoreVertical,
  CheckCircle2,
  Circle,
  Clock,
  XCircle,
  Pause,
  Trophy,
  Star,
  Eye,
  EyeOff,
  Edit3,
  Trash2,
  Play,
  Target,
  Lock
} from 'lucide-react';
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { 
  Quest, 
  QuestObjective, 
  QuestStatus, 
  QuestPriority 
} from '@/types';

// ============================================
// Quest Card Props
// ============================================

interface QuestCardProps {
  quest: Quest;
  onEdit?: (quest: Quest) => void;
  onDelete?: (questId: string) => void;
  onComplete?: (questId: string) => void;
  onPause?: (questId: string) => void;
  onResume?: (questId: string) => void;
  onFail?: (questId: string) => void;
  onObjectiveComplete?: (questId: string, objectiveId: string) => void;
  compact?: boolean;
  className?: string;
}

// ============================================
// Status Configuration
// ============================================

const STATUS_CONFIG: Record<QuestStatus, { 
  icon: React.ReactNode; 
  color: string; 
  bg: string;
  label: string;
}> = {
  active: { 
    icon: <Play className="w-4 h-4" />, 
    color: 'text-green-500',
    bg: 'bg-green-500/10',
    label: 'Activa'
  },
  completed: { 
    icon: <CheckCircle2 className="w-4 h-4" />, 
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    label: 'Completada'
  },
  failed: { 
    icon: <XCircle className="w-4 h-4" />, 
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    label: 'Fallida'
  },
  paused: { 
    icon: <Pause className="w-4 h-4" />, 
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    label: 'Pausada'
  },
};

const PRIORITY_CONFIG: Record<QuestPriority, { 
  icon: React.ReactNode; 
  color: string;
  label: string;
}> = {
  main: { 
    icon: <Star className="w-3.5 h-3.5" />, 
    color: 'text-amber-500',
    label: 'Principal'
  },
  side: { 
    icon: <Target className="w-3.5 h-3.5" />, 
    color: 'text-blue-400',
    label: 'Secundaria'
  },
  hidden: { 
    icon: <EyeOff className="w-3.5 h-3.5" />, 
    color: 'text-gray-400',
    label: 'Oculta'
  },
};

// ============================================
// Quest Card Component
// ============================================

export function QuestCard({
  quest,
  onEdit,
  onDelete,
  onComplete,
  onPause,
  onResume,
  onFail,
  onObjectiveComplete,
  compact = false,
  className,
}: QuestCardProps) {
  const [isOpen, setIsOpen] = useState(!compact);
  
  const statusConfig = STATUS_CONFIG[quest.status];
  const priorityConfig = PRIORITY_CONFIG[quest.priority];
  
  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
    });
  }, []);
  
  const objectiveProgress = quest.objectives.filter(o => o.isCompleted).length;
  const totalObjectives = quest.objectives.length;
  
  return (
    <Card className={cn(
      "transition-all duration-200",
      quest.status === 'completed' && "border-green-500/30 bg-green-500/5",
      quest.status === 'failed' && "border-red-500/30 bg-red-500/5",
      quest.status === 'paused' && "opacity-70",
      className
    )}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="p-3 pb-0">
          <div className="flex items-start justify-between gap-2">
            <CollapsibleTrigger asChild>
              <div className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                <div className={cn(
                  "p-1.5 rounded-lg shrink-0",
                  statusConfig.bg
                )}>
                  <span className={statusConfig.color}>
                    {quest.icon || statusConfig.icon}
                  </span>
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-sm font-medium truncate flex items-center gap-2">
                    {quest.title}
                    {quest.isHidden && (
                      <EyeOff className="w-3 h-3 text-muted-foreground" />
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge 
                      variant="outline" 
                      className={cn("text-xs", priorityConfig.color)}
                    >
                      {priorityConfig.icon}
                      <span className="ml-1">{priorityConfig.label}</span>
                    </Badge>
                    {totalObjectives > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {objectiveProgress}/{totalObjectives}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronDown className={cn(
                  "w-4 h-4 text-muted-foreground transition-transform shrink-0",
                  isOpen && "rotate-180"
                )} />
              </div>
            </CollapsibleTrigger>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(quest)}>
                    <Edit3 className="w-4 h-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                )}
                {quest.status === 'active' && onPause && (
                  <DropdownMenuItem onClick={() => onPause(quest.id)}>
                    <Pause className="w-4 h-4 mr-2" />
                    Pausar
                  </DropdownMenuItem>
                )}
                {quest.status === 'paused' && onResume && (
                  <DropdownMenuItem onClick={() => onResume(quest.id)}>
                    <Play className="w-4 h-4 mr-2" />
                    Reanudar
                  </DropdownMenuItem>
                )}
                {quest.status === 'active' && onComplete && (
                  <DropdownMenuItem onClick={() => onComplete(quest.id)}>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Completar
                  </DropdownMenuItem>
                )}
                {quest.status === 'active' && onFail && (
                  <DropdownMenuItem 
                    onClick={() => onFail(quest.id)}
                    className="text-destructive"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Marcar Fallida
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => onDelete(quest.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Eliminar
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="p-3 pt-2">
            {/* Progress bar */}
            <div className="flex items-center gap-2 mb-2">
              <Progress 
                value={quest.progress} 
                className="h-1.5 flex-1"
              />
              <span className="text-xs text-muted-foreground font-mono w-8">
                {quest.progress}%
              </span>
            </div>
            
            {/* Description */}
            {quest.description && (
              <p className="text-sm text-muted-foreground mb-3">
                {quest.description}
              </p>
            )}
            
            {/* Objectives */}
            {quest.objectives.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Objetivos
                </p>
                <ScrollArea className="max-h-[150px]">
                  <div className="space-y-1 pr-2">
                    {quest.objectives.map((objective) => (
                      <ObjectiveItem
                        key={objective.id}
                        objective={objective}
                        onComplete={onObjectiveComplete && quest.status === 'active'
                          ? () => onObjectiveComplete(quest.id, objective.id)
                          : undefined
                        }
                      />
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
            
            {/* Rewards */}
            {quest.rewards.length > 0 && (
              <div className="mt-3 pt-2 border-t">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  Recompensas
                </p>
                <div className="flex flex-wrap gap-1">
                  {quest.rewards.map((reward, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      <Trophy className="w-3 h-3 mr-1 text-amber-500" />
                      {reward.name}
                      {reward.quantity && ` x${reward.quantity}`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {/* Timestamps */}
            <div className="mt-2 pt-2 border-t flex items-center gap-3 text-xs text-muted-foreground">
              {quest.startedAt && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Inicio: {formatDate(quest.startedAt)}
                </span>
              )}
              {quest.completedAt && (
                <span className="flex items-center gap-1 text-green-500">
                  <CheckCircle2 className="w-3 h-3" />
                  Fin: {formatDate(quest.completedAt)}
                </span>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// ============================================
// Objective Item Component
// ============================================

interface ObjectiveItemProps {
  objective: QuestObjective;
  onComplete?: () => void;
}

function ObjectiveItem({ objective, onComplete }: ObjectiveItemProps) {
  return (
    <div 
      className={cn(
        "flex items-center gap-2 p-1.5 rounded-md text-sm",
        objective.isCompleted && "text-muted-foreground line-through",
        onComplete && !objective.isCompleted && "cursor-pointer hover:bg-muted/50"
      )}
      onClick={onComplete}
    >
      {objective.isCompleted ? (
        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
      ) : (
        <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
      )}
      <span className="flex-1 truncate">{objective.description}</span>
      {objective.targetCount > 1 && (
        <Badge variant="outline" className="text-xs shrink-0">
          {objective.currentCount}/{objective.targetCount}
        </Badge>
      )}
      {objective.isOptional && (
        <Badge variant="secondary" className="text-xs shrink-0">
          Opcional
        </Badge>
      )}
    </div>
  );
}

export default QuestCard;
