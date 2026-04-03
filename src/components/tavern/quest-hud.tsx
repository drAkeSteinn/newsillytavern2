'use client';

/**
 * QuestHUD Component
 * 
 * Displays active and available quests in the chat interface as a floating HUD.
 * Shows quest progress, objectives, and status indicators.
 * 
 * Features:
 * - Quest cards with progress bars
 * - Objective tracking with checkmarks
 * - Priority-based coloring (main/side/hidden)
 * - Compact mode for minimal UI
 * - Collapsible to save space
 * - Click to expand/collapse
 * - Available quests section with activation toggle
 * - Auto Quest system configuration
 */

import { useState, useMemo } from 'react';
import { useTavernStore } from '@/store';
import type { 
  QuestTemplate, 
  SessionQuestInstance, 
  SessionQuestObjective,
  QuestPriority,
  QuestStatus,
} from '@/types';
import { cn } from '@/lib/utils';
import { 
  ScrollText, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  Circle, 
  Target,
  Gift,
  Clock,
  Star,
  Lock,
  Sparkles,
  Play,
  Pause,
  Settings2,
  Zap,
  List,
  Shuffle,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface QuestHUDProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  className?: string;
  compact?: boolean;
}

interface QuestWithTemplate {
  instance: SessionQuestInstance;
  template: QuestTemplate;
}

// ============================================
// Position Classes
// ============================================

const positionClasses = {
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'bottom-4 right-4',
};

// ============================================
// Priority Colors
// ============================================

const priorityColors: Record<QuestPriority, { bg: string; text: string; border: string; progress: string }> = {
  main: {
    bg: 'bg-amber-500/20',
    text: 'text-amber-400',
    border: 'border-amber-500/40',
    progress: 'bg-amber-500',
  },
  side: {
    bg: 'bg-blue-500/20',
    text: 'text-blue-400',
    border: 'border-blue-500/40',
    progress: 'bg-blue-500',
  },
  hidden: {
    bg: 'bg-slate-500/20',
    text: 'text-slate-400',
    border: 'border-slate-500/40',
    progress: 'bg-slate-500',
  },
};

// ============================================
// Status Icons
// ============================================

const statusIcons: Record<QuestStatus, React.ReactNode> = {
  available: <Circle className="w-3 h-3" />,
  active: <Sparkles className="w-3 h-3" />,
  completed: <Check className="w-3 h-3" />,
  failed: <span className="text-xs">✗</span>,
  paused: <Clock className="w-3 h-3" />,
};

// ============================================
// Main Component
// ============================================

export function QuestHUD({ 
  position = 'top-right', 
  className,
  compact: forceCompact,
}: QuestHUDProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAvailable, setShowAvailable] = useState(false);
  const [showAutoQuest, setShowAutoQuest] = useState(false);
  
  // Store state
  const activeSessionId = useTavernStore((state) => state.activeSessionId);
  const sessions = useTavernStore((state) => state.sessions);
  const questTemplates = useTavernStore((state) => state.questTemplates);
  const questSettings = useTavernStore((state) => state.questSettings);
  const setQuestSettings = useTavernStore((state) => state.setQuestSettings);
  const activateQuest = useTavernStore((state) => state.activateQuest);
  const deactivateQuest = useTavernStore((state) => state.deactivateQuest);
  
  // Get active session
  const activeSession = sessions.find(s => s.id === activeSessionId);
  const sessionQuests = activeSession?.sessionQuests ?? [];
  
  // Get active quests with templates
  const activeQuests = useMemo(() => {
    if (sessionQuests.length === 0) return [];
    
    return sessionQuests
      .filter(q => q.status === 'active')
      .map(instance => {
        const template = questTemplates.find(t => t.id === instance.templateId);
        return template ? { instance, template } : null;
      })
      .filter((q): q is QuestWithTemplate => q !== null)
      .sort((a, b) => {
        // Sort by priority: main > side > hidden
        const priorityOrder: Record<QuestPriority, number> = { main: 0, side: 1, hidden: 2 };
        return priorityOrder[a.template.priority] - priorityOrder[b.template.priority];
      });
  }, [sessionQuests, questTemplates]);
  
  // Get available quests with templates
  const availableQuests = useMemo(() => {
    if (sessionQuests.length === 0) return [];
    
    return sessionQuests
      .filter(q => q.status === 'available')
      .map(instance => {
        const template = questTemplates.find(t => t.id === instance.templateId);
        return template ? { instance, template } : null;
      })
      .filter((q): q is QuestWithTemplate => q !== null)
      .sort((a, b) => {
        // Sort by autoQuest order if available, then by priority
        const aOrder = a.template.autoQuest?.order ?? 999;
        const bOrder = b.template.autoQuest?.order ?? 999;
        if (aOrder !== bOrder) return aOrder - bOrder;
        
        const priorityOrder: Record<QuestPriority, number> = { main: 0, side: 1, hidden: 2 };
        return priorityOrder[a.template.priority] - priorityOrder[b.template.priority];
      });
  }, [sessionQuests, questTemplates]);
  
  // Handle quest activation/deactivation
  const handleQuestToggle = (templateId: string, currentStatus: QuestStatus) => {
    if (!activeSessionId) return;
    
    if (currentStatus === 'available') {
      activateQuest(activeSessionId, templateId);
    } else if (currentStatus === 'active') {
      deactivateQuest(activeSessionId, templateId);
    }
  };
  
  // Handle auto quest settings change
  const handleAutoQuestChange = (updates: Partial<typeof questSettings>) => {
    setQuestSettings(updates);
  };
  
  // Check if quest HUD is enabled
  if (!questSettings.enabled) {
    return null;
  }
  
  // Don't show if no quests at all
  if (activeQuests.length === 0 && availableQuests.length === 0) {
    return null;
  }
  
  const compact = forceCompact ?? activeQuests.length > 2;
  const showObjectives = isExpanded || activeQuests.length === 1;
  
  return (
    <div
      className={cn(
        'absolute z-30 pointer-events-auto',
        positionClasses[position],
        className
      )}
    >
      <div 
        className={cn(
          'backdrop-blur-md rounded-xl border transition-all duration-300',
          'bg-gradient-to-br from-slate-900/90 to-slate-800/80',
          'border-white/10 shadow-xl shadow-black/20',
          compact ? 'max-w-[280px]' : 'max-w-[320px]',
          isCollapsed && 'max-w-[200px]'
        )}
      >
        {/* Header */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2',
            'border-b border-white/10',
            'hover:bg-white/5 transition-colors'
          )}
        >
          <ScrollText className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium text-white/80 flex-1 text-left">
            Misiones
          </span>
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
            {activeQuests.length}
          </Badge>
          {availableQuests.length > 0 && (
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 ml-1">
              +{availableQuests.length}
            </Badge>
          )}
          {isCollapsed ? (
            <ChevronDown className="w-4 h-4 text-white/40" />
          ) : (
            <ChevronUp className="w-4 h-4 text-white/40" />
          )}
        </button>
        
        {/* Quest List */}
        {!isCollapsed && (
          <div className={cn(
            'p-2 space-y-2 max-h-[400px] overflow-y-auto',
            'scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent'
          )}>
            {/* Active Quests */}
            {activeQuests.map(({ instance, template }) => (
              <QuestCard
                key={instance.templateId}
                instance={instance}
                template={template}
                compact={compact}
                showObjectives={showObjectives}
                onToggleObjectives={() => setIsExpanded(!isExpanded)}
                onToggleActivation={() => handleQuestToggle(template.id, 'active')}
              />
            ))}
            
            {/* Available Quests Section */}
            {availableQuests.length > 0 && (
              <div className="pt-2 border-t border-white/10">
                <button
                  onClick={() => setShowAvailable(!showAvailable)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-blue-400 hover:bg-white/5 rounded transition-colors"
                >
                  <Circle className="w-3 h-3" />
                  <span className="flex-1 text-left">Disponibles ({availableQuests.length})</span>
                  {showAvailable ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>
                
                {showAvailable && (
                  <div className="mt-1 space-y-1">
                    {availableQuests.map(({ instance, template }) => (
                      <AvailableQuestItem
                        key={instance.templateId}
                        template={template}
                        onActivate={() => handleQuestToggle(template.id, 'available')}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Auto Quest Section */}
            <div className="pt-2 border-t border-white/10">
              <button
                onClick={() => setShowAutoQuest(!showAutoQuest)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded transition-colors',
                  questSettings.autoQuestEnabled
                    ? 'text-violet-400 hover:bg-violet-500/10'
                    : 'text-white/50 hover:bg-white/5'
                )}
              >
                <Zap className={cn(
                  'w-3 h-3',
                  questSettings.autoQuestEnabled && 'animate-pulse'
                )} />
                <span className="flex-1 text-left">Auto Quest</span>
                {questSettings.autoQuestEnabled && (
                  <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30">
                    ON
                  </Badge>
                )}
                {showAutoQuest ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
              
              {showAutoQuest && (
                <div className="mt-2 p-2 rounded-lg bg-violet-500/10 border border-violet-500/20 space-y-3">
                  {/* Enable Switch */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/70">Activar automáticamente</span>
                    <button
                      onClick={() => handleAutoQuestChange({ autoQuestEnabled: !questSettings.autoQuestEnabled })}
                      className={cn(
                        'relative w-10 h-5 rounded-full transition-colors',
                        questSettings.autoQuestEnabled ? 'bg-violet-500' : 'bg-white/20'
                      )}
                    >
                      <div className={cn(
                        'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                        questSettings.autoQuestEnabled ? 'translate-x-5' : 'translate-x-0.5'
                      )} />
                    </button>
                  </div>
                  
                  {/* Interval Setting */}
                  <div className="space-y-1">
                    <label className="text-xs text-white/50">
                      Cada X turnos/mensajes:
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={questSettings.autoQuestInterval}
                      onChange={(e) => handleAutoQuestChange({ 
                        autoQuestInterval: Math.max(1, parseInt(e.target.value) || 5) 
                      })}
                      className="w-full px-2 py-1 text-xs bg-black/30 border border-white/10 rounded text-white/80 focus:outline-none focus:border-violet-500/50"
                      disabled={!questSettings.autoQuestEnabled}
                    />
                  </div>
                  
                  {/* Mode Selection */}
                  <div className="space-y-1">
                    <label className="text-xs text-white/50">Modo de selección:</label>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleAutoQuestChange({ autoQuestMode: 'random' })}
                        disabled={!questSettings.autoQuestEnabled}
                        className={cn(
                          'flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded transition-colors',
                          questSettings.autoQuestMode === 'random'
                            ? 'bg-violet-500/30 text-violet-300 border border-violet-500/50'
                            : 'bg-white/5 text-white/50 border border-white/10',
                          !questSettings.autoQuestEnabled && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <Shuffle className="w-3 h-3" />
                        Random
                      </button>
                      <button
                        onClick={() => handleAutoQuestChange({ autoQuestMode: 'list' })}
                        disabled={!questSettings.autoQuestEnabled}
                        className={cn(
                          'flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded transition-colors',
                          questSettings.autoQuestMode === 'list'
                            ? 'bg-violet-500/30 text-violet-300 border border-violet-500/50'
                            : 'bg-white/5 text-white/50 border border-white/10',
                          !questSettings.autoQuestEnabled && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <List className="w-3 h-3" />
                        Lista
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Collapsed Preview */}
        {isCollapsed && (
          <div className="p-2 flex flex-wrap gap-1">
            {activeQuests.slice(0, 3).map(({ instance, template }) => (
              <div
                key={instance.templateId}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-full text-xs',
                  priorityColors[template.priority].bg,
                  priorityColors[template.priority].text,
                  priorityColors[template.priority].border,
                  'border'
                )}
                title={template.name}
              >
                <span>{template.icon || '📜'}</span>
                <span className="font-medium">{Math.round(instance.progress)}%</span>
              </div>
            ))}
            {activeQuests.length > 3 && (
              <div className="text-xs text-white/40 px-1">
                +{activeQuests.length - 3}
              </div>
            )}
            {availableQuests.length > 0 && (
              <div className="text-xs text-blue-400/60 px-1">
                +{availableQuests.length} disp.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Quest Card Component
// ============================================

interface QuestCardProps {
  instance: SessionQuestInstance;
  template: QuestTemplate;
  compact?: boolean;
  showObjectives?: boolean;
  onToggleObjectives?: () => void;
  onToggleActivation?: () => void;
}

function QuestCard({ 
  instance, 
  template, 
  compact, 
  showObjectives,
  onToggleObjectives,
  onToggleActivation,
}: QuestCardProps) {
  const colors = priorityColors[template.priority];
  
  // Calculate progress
  const progress = instance.progress;
  
  // Get objectives with template data
  const objectives = template.objectives.map(obj => {
    const instanceObj = instance.objectives.find(o => o.templateId === obj.id);
    return {
      ...obj,
      currentCount: instanceObj?.currentCount ?? 0,
      isCompleted: instanceObj?.isCompleted ?? false,
    };
  });
  
  const completedObjectives = objectives.filter(o => o.isCompleted).length;
  const totalObjectives = objectives.length;
  
  return (
    <div
      className={cn(
        'rounded-lg border transition-all',
        colors.bg,
        colors.border,
        'hover:bg-white/5'
      )}
    >
      {/* Quest Header */}
      <div 
        className={cn('flex items-start gap-2', compact ? 'p-1.5' : 'p-2')}
      >
        {/* Icon */}
        <div className={cn(
          'flex items-center justify-center rounded-lg shrink-0',
          compact ? 'w-8 h-8' : 'w-10 h-10',
          colors.bg,
          'border',
          colors.border
        )}>
          <span className={compact ? 'text-lg' : 'text-xl'}>
            {template.icon || '📜'}
          </span>
        </div>
        
        {/* Quest Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span 
              className={cn(
                'font-medium truncate cursor-pointer hover:underline',
                colors.text,
                compact ? 'text-xs' : 'text-sm'
              )}
              onClick={onToggleObjectives}
            >
              {template.name}
            </span>
            {template.priority === 'main' && (
              <Star className="w-3 h-3 text-amber-400 shrink-0" />
            )}
          </div>
          
          {/* Progress Bar */}
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-black/30 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', colors.progress)}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className={cn('text-[10px] font-medium', colors.text)}>
              {Math.round(progress)}%
            </span>
          </div>
          
          {/* Objective Count */}
          {!compact && (
            <div className="mt-1 flex items-center gap-1 text-[10px] text-white/50">
              <Target className="w-3 h-3" />
              <span>{completedObjectives}/{totalObjectives} objetivos</span>
              {template.rewards.length > 0 && (
                <>
                  <span className="mx-1">•</span>
                  <Gift className="w-3 h-3" />
                  <span>{template.rewards.length} recompensas</span>
                </>
              )}
            </div>
          )}
        </div>
        
        {/* Deactivate Button */}
        <button
          onClick={onToggleActivation}
          className={cn(
            'p-1.5 rounded-lg transition-colors shrink-0',
            'hover:bg-red-500/20 text-red-400/60 hover:text-red-400'
          )}
          title="Desactivar misión"
        >
          <Pause className="w-3.5 h-3.5" />
        </button>
      </div>
      
      {/* Objectives (Expanded) */}
      {showObjectives && objectives.length > 0 && (
        <div className={cn(
          'border-t border-white/10',
          compact ? 'p-1.5 pt-2' : 'p-2 pt-2'
        )}>
          <div className="space-y-1">
            {objectives.map((obj) => (
              <ObjectiveItem
                key={obj.id}
                objective={obj}
                compact={compact}
              />
            ))}
          </div>
        </div>
      )}
      
      {/* Description (if expanded and not compact) */}
      {showObjectives && template.description && !compact && (
        <div className="px-2 pb-2">
          <p className="text-[10px] text-white/40 line-clamp-2">
            {template.description}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================
// Available Quest Item Component
// ============================================

interface AvailableQuestItemProps {
  template: QuestTemplate;
  onActivate: () => void;
}

function AvailableQuestItem({ template, onActivate }: AvailableQuestItemProps) {
  const colors = priorityColors[template.priority];
  
  return (
    <button
      onClick={onActivate}
      className={cn(
        'w-full flex items-center gap-2 p-2 rounded-lg border transition-all',
        'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20',
        'group'
      )}
    >
      {/* Icon */}
      <div className={cn(
        'flex items-center justify-center rounded-lg w-8 h-8 shrink-0',
        colors.bg,
        'border',
        colors.border,
        'group-hover:border-white/30'
      )}>
        <span className="text-lg">
          {template.icon || '📜'}
        </span>
      </div>
      
      {/* Info */}
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-1">
          <span className={cn(
            'font-medium truncate text-xs',
            colors.text
          )}>
            {template.name}
          </span>
          {template.priority === 'main' && (
            <Star className="w-2.5 h-2.5 text-amber-400 shrink-0" />
          )}
        </div>
        {template.description && (
          <p className="text-[10px] text-white/40 truncate mt-0.5">
            {template.description}
          </p>
        )}
      </div>
      
      {/* Activate Button */}
      <div className={cn(
        'p-1.5 rounded-lg transition-all',
        'bg-green-500/10 text-green-400 group-hover:bg-green-500/20'
      )}>
        <Play className="w-3.5 h-3.5" />
      </div>
    </button>
  );
}

// ============================================
// Objective Item Component
// ============================================

interface ObjectiveItemProps {
  objective: {
    id: string;
    description: string;
    type: string;
    targetCount: number;
    currentCount: number;
    isCompleted: boolean;
    isOptional: boolean;
  };
  compact?: boolean;
}

function ObjectiveItem({ objective, compact }: ObjectiveItemProps) {
  const progress = objective.targetCount > 0 
    ? Math.min(100, (objective.currentCount / objective.targetCount) * 100)
    : (objective.isCompleted ? 100 : 0);
  
  return (
    <div 
      className={cn(
        'flex items-center gap-2 rounded px-1.5 py-1',
        objective.isCompleted 
          ? 'bg-green-500/10 text-green-400' 
          : 'bg-white/5 text-white/70',
        'transition-colors'
      )}
    >
      {/* Checkbox */}
      <div className={cn(
        'flex items-center justify-center rounded-full shrink-0 transition-all',
        compact ? 'w-4 h-4' : 'w-5 h-5',
        objective.isCompleted 
          ? 'bg-green-500 text-white' 
          : 'border border-white/30'
      )}>
        {objective.isCompleted && <Check className="w-3 h-3" />}
      </div>
      
      {/* Description */}
      <span className={cn(
        'flex-1 truncate',
        compact ? 'text-[10px]' : 'text-xs',
        objective.isCompleted && 'line-through opacity-70'
      )}>
        {objective.description}
      </span>
      
      {/* Counter (if multi-target) */}
      {objective.targetCount > 1 && (
        <span className={cn(
          'text-[10px] font-medium px-1.5 py-0.5 rounded',
          objective.isCompleted 
            ? 'bg-green-500/20 text-green-400'
            : 'bg-white/10 text-white/50'
        )}>
          {objective.currentCount}/{objective.targetCount}
        </span>
      )}
      
      {/* Optional badge */}
      {objective.isOptional && !objective.isCompleted && (
        <span className="text-[8px] text-white/30 uppercase tracking-wider">
          opt
        </span>
      )}
    </div>
  );
}

// ============================================
// Badge Component (inline)
// ============================================

function Badge({ 
  children, 
  className 
}: { 
  children: React.ReactNode; 
  className?: string;
}) {
  return (
    <span className={cn(
      'inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border',
      className
    )}>
      {children}
    </span>
  );
}

export default QuestHUD;
