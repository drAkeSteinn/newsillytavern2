'use client';

/**
 * QuestLogPanel Component
 * 
 * Panel for viewing and managing active quest instances in a session.
 * Quests are activated from templates and stored in session.sessionQuests.
 * 
 * Features:
 * - View and manage session quests
 * - Complete/fail quests with optional character selection (for group chats)
 * - Progress or complete objectives
 * - Filter and sort quests
 */

import { useState, useCallback, useMemo } from 'react';
import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Target,
  Search,
  CheckCircle2,
  XCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Settings,
  Play,
  ScrollText,
  Clock,
  Star,
  User,
  Users,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { QuestActivationDialog } from './quest-activation-dialog';
import type { SessionQuestInstance, QuestTemplate, QuestStatus, QuestPriority, CharacterCard } from '@/types';

// ============================================
// Quest Log Panel Props
// ============================================

interface QuestLogPanelProps {
  sessionId: string;
  className?: string;
  showSettings?: boolean;
  onOpenSettings?: () => void;
}

// ============================================
// Quest Log Panel Component
// ============================================

export function QuestLogPanel({
  sessionId,
  className,
  showSettings = false,
  onOpenSettings,
}: QuestLogPanelProps) {
  const {
    sessions,
    questTemplates,
    questSettings,
    activateQuest,
    completeQuest: completeSessionQuest,
    failQuest: failSessionQuest,
    progressQuestObjective,
    completeObjective,
    toggleObjectiveCompletion,  // NEW: Toggle function
    groups,
    characters,
  } = useTavernStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuestStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<QuestPriority | 'all'>('all');
  const [sortBy, setSortBy] = useState<'priority' | 'progress' | 'activatedAt'>('priority');
  const [sortAsc, setSortAsc] = useState(false);

  // Dialogs
  const [activationDialogOpen, setActivationDialogOpen] = useState(false);
  const [characterSelectOpen, setCharacterSelectOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: 'complete_quest' | 'fail_quest' | 'complete_objective' | 'progress_objective' | 'toggle_objective';
    templateId: string;
    objectiveId?: string;
  } | null>(null);

  // Get session quests from the session (NEW SYSTEM)
  const session = useMemo(
    () => sessions.find(s => s.id === sessionId),
    [sessions, sessionId]
  );
  
  const sessionQuests: SessionQuestInstance[] = session?.sessionQuests || [];
  
  // Get group members for character selection (if group chat)
  const isGroupChat = !!session?.groupId;
  const group = useMemo(() => {
    if (!session?.groupId) return null;
    return groups.find(g => g.id === session.groupId);
  }, [session, groups]);
  
  const groupCharacters = useMemo(() => {
    if (!group?.members) return [];
    return group.members
      .map((m: any) => characters.find(c => c.id === m.characterId))
      .filter((c: any): c is CharacterCard => c !== undefined);
  }, [group, characters]);

  // Get templates for quest info
  const getTemplate = useCallback(
    (templateId: string): QuestTemplate | undefined => 
      questTemplates.find(t => t.id === templateId),
    [questTemplates]
  );

  // Filter and sort quests
  const filteredQuests = useMemo(() => {
    let filtered = sessionQuests;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((q) => {
        const template = getTemplate(q.templateId);
        return template?.name.toLowerCase().includes(query) ||
          template?.description?.toLowerCase().includes(query) ||
          template?.objectives.some((o) => o.description.toLowerCase().includes(query));
      });
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((q) => q.status === statusFilter);
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter((q) => {
        const template = getTemplate(q.templateId);
        return template?.priority === priorityFilter;
      });
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      let comparison = 0;
      const templateA = getTemplate(a.templateId);
      const templateB = getTemplate(b.templateId);

      switch (sortBy) {
        case 'priority':
          const priorityOrder = { main: 3, side: 2, hidden: 1 };
          comparison = (priorityOrder[templateB?.priority || 'side'] || 2) - 
                       (priorityOrder[templateA?.priority || 'side'] || 2);
          break;
        case 'progress':
          comparison = (b.progress || 0) - (a.progress || 0);
          break;
        case 'activatedAt':
          comparison =
            new Date(a.activatedAt || 0).getTime() -
            new Date(b.activatedAt || 0).getTime();
          break;
      }

      return sortAsc ? -comparison : comparison;
    });

    return filtered;
  }, [sessionQuests, searchQuery, statusFilter, priorityFilter, sortBy, sortAsc, getTemplate]);

  // Stats
  const stats = useMemo(() => {
    const active = sessionQuests.filter((q) => q.status === 'active').length;
    const completed = sessionQuests.filter((q) => q.status === 'completed').length;
    const failed = sessionQuests.filter((q) => q.status === 'failed').length;
    const available = sessionQuests.filter((q) => q.status === 'available').length;

    return { active, completed, failed, available };
  }, [sessionQuests]);

  // Handlers - for group chats, open character selection dialog
  const handleCompleteQuest = useCallback((templateId: string) => {
    if (isGroupChat && groupCharacters.length > 0) {
      setPendingAction({ type: 'complete_quest', templateId });
      setCharacterSelectOpen(true);
    } else {
      completeSessionQuest(sessionId, templateId);
    }
  }, [sessionId, completeSessionQuest, isGroupChat, groupCharacters.length]);

  const handleFailQuest = useCallback((templateId: string) => {
    // Fail quest doesn't need character selection
    failSessionQuest(sessionId, templateId);
  }, [sessionId, failSessionQuest]);

  const handleProgressObjective = useCallback((templateId: string, objectiveId: string) => {
    if (isGroupChat && groupCharacters.length > 0) {
      setPendingAction({ type: 'progress_objective', templateId, objectiveId });
      setCharacterSelectOpen(true);
    } else {
      progressQuestObjective(sessionId, templateId, objectiveId, 1);
    }
  }, [sessionId, progressQuestObjective, isGroupChat, groupCharacters.length]);
  
  const handleCompleteObjective = useCallback((templateId: string, objectiveId: string) => {
    if (isGroupChat && groupCharacters.length > 0) {
      setPendingAction({ type: 'complete_objective', templateId, objectiveId });
      setCharacterSelectOpen(true);
    } else {
      completeObjective(sessionId, templateId, objectiveId);
    }
  }, [sessionId, completeObjective, isGroupChat, groupCharacters.length]);
  
  // NEW: Toggle objective completion (complete/uncomplete)
  const handleToggleObjective = useCallback((templateId: string, objectiveId: string) => {
    if (isGroupChat && groupCharacters.length > 0) {
      setPendingAction({ type: 'toggle_objective', templateId, objectiveId });
      setCharacterSelectOpen(true);
    } else {
      toggleObjectiveCompletion(sessionId, templateId, objectiveId);
    }
  }, [sessionId, toggleObjectiveCompletion, isGroupChat, groupCharacters.length]);
  
  // Handle character selection
  const handleCharacterSelect = useCallback((characterId: string | undefined) => {
    if (!pendingAction) return;
    
    switch (pendingAction.type) {
      case 'complete_quest':
        completeSessionQuest(sessionId, pendingAction.templateId, characterId);
        break;
      case 'progress_objective':
        progressQuestObjective(sessionId, pendingAction.templateId, pendingAction.objectiveId!, 1, characterId);
        break;
      case 'complete_objective':
        completeObjective(sessionId, pendingAction.templateId, pendingAction.objectiveId!, characterId);
        break;
      case 'toggle_objective':
        toggleObjectiveCompletion(sessionId, pendingAction.templateId, pendingAction.objectiveId!);
        break;
    }
    
    setCharacterSelectOpen(false);
    setPendingAction(null);
  }, [pendingAction, sessionId, completeSessionQuest, progressQuestObjective, completeObjective, toggleObjectiveCompletion]);

  const toggleSort = useCallback((field: typeof sortBy) => {
    if (sortBy === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortBy(field);
      setSortAsc(false);
    }
  }, [sortBy]);

  // Priority colors
  const priorityColors: Record<QuestPriority, string> = {
    main: 'text-amber-500',
    side: 'text-blue-500',
    hidden: 'text-slate-500',
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Registro de Misiones
          </h3>
          <div className="flex items-center gap-2">
            {showSettings && onOpenSettings && (
              <Button variant="ghost" size="icon" onClick={onOpenSettings}>
                <Settings className="w-4 h-4" />
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => setActivationDialogOpen(true)}
              className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              Activar Misión
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-sm flex-wrap">
          <Badge
            variant="outline"
            className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
          >
            <Play className="w-3 h-3 mr-1" />
            {stats.active} Activas
          </Badge>
          <Badge
            variant="outline"
            className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
          >
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {stats.completed} Completadas
          </Badge>
          {stats.available > 0 && (
            <Badge
              variant="outline"
              className="bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20"
            >
              <Clock className="w-3 h-3 mr-1" />
              {stats.available} Disponibles
            </Badge>
          )}
          {stats.failed > 0 && (
            <Badge
              variant="outline"
              className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
            >
              <XCircle className="w-3 h-3 mr-1" />
              {stats.failed} Fallidas
            </Badge>
          )}
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar misiones..."
              className="pl-8 h-8"
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as QuestStatus | 'all')}
          >
            <SelectTrigger className="w-28 h-8">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Activas</SelectItem>
              <SelectItem value="available">Disponibles</SelectItem>
              <SelectItem value="completed">Completadas</SelectItem>
              <SelectItem value="failed">Fallidas</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={priorityFilter}
            onValueChange={(v) => setPriorityFilter(v as QuestPriority | 'all')}
          >
            <SelectTrigger className="w-28 h-8">
              <SelectValue placeholder="Prioridad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="main">Principal</SelectItem>
              <SelectItem value="side">Secundaria</SelectItem>
              <SelectItem value="hidden">Oculta</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Ordenar:</span>
          <Button
            variant={sortBy === 'priority' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => toggleSort('priority')}
          >
            Prioridad
            {sortBy === 'priority' &&
              (sortAsc ? (
                <ChevronUp className="w-3 h-3 ml-1" />
              ) : (
                <ChevronDown className="w-3 h-3 ml-1" />
              ))}
          </Button>
          <Button
            variant={sortBy === 'progress' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => toggleSort('progress')}
          >
            Progreso
            {sortBy === 'progress' &&
              (sortAsc ? (
                <ChevronUp className="w-3 h-3 ml-1" />
              ) : (
                <ChevronDown className="w-3 h-3 ml-1" />
              ))}
          </Button>
        </div>
      </div>

      {/* Quest List */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {filteredQuests.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <ScrollText className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground text-sm mb-2">
                  {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all'
                    ? 'No se encontraron misiones con esos filtros.'
                    : 'No hay misiones en esta sesión.'}
                </p>
                {!searchQuery && statusFilter === 'all' && priorityFilter === 'all' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => setActivationDialogOpen(true)}
                  >
                    <Sparkles className="w-4 h-4 mr-1.5" />
                    Activar Misión desde Template
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredQuests.map((quest) => {
              const template = getTemplate(quest.templateId);
              if (!template) return null;
              
              return (
                <QuestInstanceCard
                  key={quest.templateId}
                  quest={quest}
                  template={template}
                  onComplete={handleCompleteQuest}
                  onFail={handleFailQuest}
                  onProgressObjective={handleProgressObjective}
                  onCompleteObjective={handleCompleteObjective}
                  onToggleObjective={handleToggleObjective}
                />
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Quest Activation Dialog */}
      <QuestActivationDialog
        open={activationDialogOpen}
        onOpenChange={setActivationDialogOpen}
        sessionId={sessionId}
      />
      
      {/* Character Selection Dialog for Group Chats */}
      <Dialog open={characterSelectOpen} onOpenChange={setCharacterSelectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Seleccionar Personaje
            </DialogTitle>
            <DialogDescription>
              {pendingAction?.type === 'complete_quest' && '¿Qué personaje completó esta misión?'}
              {pendingAction?.type === 'complete_objective' && '¿Qué personaje completó este objetivo?'}
              {pendingAction?.type === 'progress_objective' && '¿Qué personaje progresó este objetivo?'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            {groupCharacters.map((char) => (
              <Button
                key={char.id}
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => handleCharacterSelect(char.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-muted">
                    {char.avatar ? (
                      <img src={char.avatar} alt={char.name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-4 h-4 m-auto" />
                    )}
                  </div>
                  <span>{char.name}</span>
                </div>
              </Button>
            ))}
            <Button
              variant="ghost"
              className="justify-start text-muted-foreground"
              onClick={() => handleCharacterSelect(undefined)}
            >
              Sin especificar (recompensas no asignadas)
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCharacterSelectOpen(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// Quest Instance Card Component
// ============================================

interface QuestInstanceCardProps {
  quest: SessionQuestInstance;
  template: QuestTemplate;
  onComplete: (templateId: string) => void;
  onFail: (templateId: string) => void;
  onProgressObjective: (templateId: string, objectiveId: string) => void;
  onCompleteObjective: (templateId: string, objectiveId: string) => void;
  onToggleObjective: (templateId: string, objectiveId: string) => void;  // NEW: Toggle objective
}

function QuestInstanceCard({
  quest,
  template,
  onComplete,
  onFail,
  onProgressObjective,
  onCompleteObjective,
  onToggleObjective,
}: QuestInstanceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const statusColors: Record<QuestStatus, string> = {
    active: 'border-green-500/30 bg-green-500/5',
    available: 'border-slate-500/30 bg-slate-500/5',
    completed: 'border-blue-500/30 bg-blue-500/5',
    failed: 'border-red-500/30 bg-red-500/5',
    locked: 'border-slate-500/30 bg-slate-500/5 opacity-50',
    paused: 'border-yellow-500/30 bg-yellow-500/5',
  };
  
  const statusBadgeColors: Record<QuestStatus, string> = {
    active: 'bg-green-500/20 text-green-600',
    available: 'bg-slate-500/20 text-slate-600',
    completed: 'bg-blue-500/20 text-blue-600',
    failed: 'bg-red-500/20 text-red-600',
    locked: 'bg-slate-500/20 text-slate-600',
    paused: 'bg-yellow-500/20 text-yellow-600',
  };
  
  const statusLabels: Record<QuestStatus, string> = {
    active: 'Activa',
    available: 'Disponible',
    completed: 'Completada',
    failed: 'Fallida',
    locked: 'Bloqueada',
    paused: 'Pausada',
  };
  
  const priorityIcon: Record<QuestPriority, React.ReactNode> = {
    main: <Star className="w-3 h-3 text-amber-500" />,
    side: <Target className="w-3 h-3 text-blue-500" />,
    hidden: <ScrollText className="w-3 h-3 text-slate-500" />,
  };

  // Build objectives with progress
  const objectives = template.objectives.map(obj => {
    const instanceObj = quest.objectives.find(o => o.templateId === obj.id);
    return {
      ...obj,
      currentCount: instanceObj?.currentCount || 0,
      isCompleted: instanceObj?.isCompleted || false,
    };
  });

  const completedObjectives = objectives.filter(o => o.isCompleted).length;
  const totalObjectives = objectives.length;

  return (
    <Card className={cn('border transition-all', statusColors[quest.status])}>
      <CardContent className="p-3 space-y-2">
        {/* Header */}
        <div 
          className="flex items-start gap-2 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {/* Icon */}
          <div className="text-2xl shrink-0">
            {template.icon || '📜'}
          </div>
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm truncate">{template.name}</span>
              {priorityIcon[template.priority]}
              <Badge className={cn('text-[10px] h-4', statusBadgeColors[quest.status])}>
                {statusLabels[quest.status]}
              </Badge>
            </div>
            
            {/* Progress bar */}
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 h-1.5 bg-black/20 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    quest.status === 'completed' ? 'bg-blue-500' : 'bg-amber-500'
                  )}
                  style={{ width: `${quest.progress || 0}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">
                {Math.round(quest.progress || 0)}%
              </span>
            </div>
            
            {/* Objectives count */}
            <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Target className="w-3 h-3" />
                {completedObjectives}/{totalObjectives} objetivos
              </span>
            </div>
          </div>
          
          {/* Expand/Collapse */}
          <ChevronDown 
            className={cn(
              'w-4 h-4 text-muted-foreground transition-transform shrink-0',
              isExpanded && 'rotate-180'
            )} 
          />
        </div>
        
        {/* Expanded content */}
        {isExpanded && (
          <div className="pt-2 border-t mt-2 space-y-2">
            {/* Description */}
            {template.description && (
              <p className="text-xs text-muted-foreground">
                {template.description}
              </p>
            )}
            
            {/* Objectives */}
            <div className="space-y-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Objetivos
              </span>
              {objectives.map((obj) => (
                <div
                  key={obj.id}
                  className={cn(
                    'flex items-center gap-2 p-1.5 rounded text-xs',
                    obj.isCompleted 
                      ? 'bg-green-500/10 text-green-600' 
                      : 'bg-muted/50'
                  )}
                >
                  {/* Checkbox/Progress - Now toggles on click */}
                  <div 
                    className={cn(
                      'w-4 h-4 rounded-full border flex items-center justify-center shrink-0 cursor-pointer transition-colors',
                      obj.isCompleted 
                        ? 'bg-green-500 border-green-500 text-white' 
                        : 'border-muted-foreground/30 hover:border-primary/50'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      // Toggle objective completion
                      onToggleObjective(template.id, obj.id);
                    }}
                    title={obj.isCompleted ? 'Click para desmarcar' : 'Click para marcar como completado'}
                  >
                    {obj.isCompleted && <CheckCircle2 className="w-3 h-3" />}
                  </div>
                  
                  {/* Description */}
                  <span className={cn(
                    'flex-1',
                    obj.isCompleted && 'line-through opacity-70'
                  )}>
                    {obj.description}
                  </span>
                  
                  {/* Progress */}
                  {obj.targetCount > 1 && !obj.isCompleted && (
                    <span className="text-[10px] text-muted-foreground">
                      {obj.currentCount}/{obj.targetCount}
                    </span>
                  )}
                  
                  {/* Toggle button - changes based on completion state */}
                  {quest.status === 'active' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-5 px-1.5 text-[9px]",
                        obj.isCompleted && "text-orange-600 hover:text-orange-700"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleObjective(template.id, obj.id);
                      }}
                    >
                      {obj.isCompleted ? (
                        <>
                          <RotateCcw className="w-2.5 h-2.5 mr-0.5" />
                          Desmarcar
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
                          Cumplir
                        </>
                      )}
                    </Button>
                  )}
                  
                  {/* Optional badge */}
                  {obj.isOptional && (
                    <Badge variant="outline" className="text-[8px] h-3">
                      opt
                    </Badge>
                  )}
                </div>
              ))}
            </div>
            
            {/* Actions */}
            {quest.status === 'active' && (
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] flex-1"
                  onClick={() => onComplete(template.id)}
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Completar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] flex-1 text-destructive hover:text-destructive"
                  onClick={() => onFail(template.id)}
                >
                  <XCircle className="w-3 h-3 mr-1" />
                  Fallar
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default QuestLogPanel;
