'use client';

/**
 * QuestActivationDialog Component
 * 
 * Dialog for activating a quest template into a session instance.
 * Replaces the manual quest creation - quests should come from templates.
 */

import { useState, useEffect, useMemo } from 'react';
import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ScrollText,
  Target,
  Gift,
  Star,
  Check,
  Sparkles,
  Clock,
  Zap,
  AlertCircle,
  EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuestTemplate, QuestPriority, QuestActivationMethod } from '@/types';

// ============================================
// Quest Activation Dialog Props
// ============================================

interface QuestActivationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
}

// ============================================
// Priority Configuration
// ============================================

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
// Quest Activation Dialog Component
// ============================================

export function QuestActivationDialog({
  open,
  onOpenChange,
  sessionId,
}: QuestActivationDialogProps) {
  const {
    questTemplates,
    loadTemplates,
    activateQuestFromTemplate,
    questSettings,
    sessions,
  } = useTavernStore();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Get current session
  const currentSession = sessions.find(s => s.id === sessionId);
  const sessionQuests = currentSession?.sessionQuests || [];

  // Get already active quest template IDs in this session
  const activeTemplateIds = useMemo(() => {
    return sessionQuests
      .filter(q => q.status === 'active')
      .map(q => q.templateId);
  }, [sessionQuests]);

  // Load templates on mount
  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (open && questTemplates.length === 0) {
        if (isMounted) setIsLoading(true);
        try {
          await loadTemplates();
        } finally {
          if (isMounted) setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [open, questTemplates.length, loadTemplates]);

  // Filter available templates
  const availableTemplates = useMemo(() => {
    let filtered = questTemplates;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.id.toLowerCase().includes(query)
      );
    }

    // Filter out non-repeatable quests that are already active
    filtered = filtered.filter(t =>
      t.isRepeatable || !activeTemplateIds.includes(t.id)
    );

    return filtered;
  }, [questTemplates, searchQuery, activeTemplateIds]);

  // Group templates by priority
  const groupedTemplates = useMemo(() => ({
    main: availableTemplates.filter(t => t.priority === 'main'),
    side: availableTemplates.filter(t => t.priority === 'side'),
    hidden: availableTemplates.filter(t => t.priority === 'hidden'),
  }), [availableTemplates]);

  // Selected template details
  const selectedTemplate = questTemplates.find(t => t.id === selectedTemplateId);

  // Check if can activate (prerequisites)
  const canActivate = useMemo(() => {
    if (!selectedTemplate) return false;

    // Check prerequisites - look at completed quests in session
    if (selectedTemplate.prerequisites && selectedTemplate.prerequisites.length > 0) {
      const completedTemplateIds = sessionQuests
        .filter(q => q.status === 'completed')
        .map(q => q.templateId);

      const missingPrereqs = selectedTemplate.prerequisites.filter(
        prereq => !completedTemplateIds.includes(prereq)
      );

      if (missingPrereqs.length > 0) return false;
    }

    // Check if already active (and not repeatable)
    if (!selectedTemplate.isRepeatable && activeTemplateIds.includes(selectedTemplate.id)) {
      return false;
    }

    // Check max active quests
    const activeCount = sessionQuests.filter(q => q.status === 'active').length;
    const maxActive = questSettings?.maxActiveQuests || 10;
    if (activeCount >= maxActive) return false;

    return true;
  }, [selectedTemplate, sessionQuests, activeTemplateIds, questSettings?.maxActiveQuests]);

  // Handle activation
  const handleActivate = () => {
    if (!selectedTemplate || !canActivate) return;

    // Use the new session-based quest activation
    activateQuestFromTemplate(sessionId, selectedTemplate);

    // Reset and close
    setSelectedTemplateId('');
    setSearchQuery('');
    onOpenChange(false);
  };

  // Get activation method label
  const getActivationLabel = (method: QuestActivationMethod) => {
    switch (method) {
      case 'keyword': return 'Por Keyword';
      case 'turn': return 'Por Turnos';
      case 'manual': return 'Manual';
      case 'chain': return 'En Cadena';
      default: return method;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[90vw] max-h-[85vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="p-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30">
              <Sparkles className="w-5 h-5 text-amber-500" />
            </div>
            Activar Misión desde Template
          </DialogTitle>
          <DialogDescription>
            Selecciona un template de misión para activarlo en la sesión actual.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Search */}
          <div className="p-4 border-b shrink-0">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar templates..."
              className="w-full"
            />
          </div>

          {/* Template List */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4 space-y-4">
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto" />
                  <p className="text-muted-foreground text-sm mt-3">Cargando templates...</p>
                </div>
              ) : availableTemplates.length === 0 ? (
                <div className="text-center py-8">
                  <ScrollText className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-muted-foreground">
                    {questTemplates.length === 0
                      ? 'No hay templates creados. Crea uno en la tab Templates.'
                      : 'No hay templates disponibles con esos filtros.'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Main Quests */}
                  {groupedTemplates.main.length > 0 && (
                    <TemplateGroup
                      title="Misiones Principales"
                      icon={<Star className="w-4 h-4 text-amber-500" />}
                      templates={groupedTemplates.main}
                      selectedId={selectedTemplateId}
                      onSelect={setSelectedTemplateId}
                      activeTemplateIds={activeTemplateIds}
                    />
                  )}

                  {/* Side Quests */}
                  {groupedTemplates.side.length > 0 && (
                    <TemplateGroup
                      title="Misiones Secundarias"
                      icon={<Target className="w-4 h-4 text-blue-500" />}
                      templates={groupedTemplates.side}
                      selectedId={selectedTemplateId}
                      onSelect={setSelectedTemplateId}
                      activeTemplateIds={activeTemplateIds}
                    />
                  )}

                  {/* Hidden Quests */}
                  {groupedTemplates.hidden.length > 0 && (
                    <TemplateGroup
                      title="Misiones Ocultas"
                      icon={<EyeOff className="w-4 h-4 text-slate-500" />}
                      templates={groupedTemplates.hidden}
                      selectedId={selectedTemplateId}
                      onSelect={setSelectedTemplateId}
                      activeTemplateIds={activeTemplateIds}
                    />
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Selected Template Preview */}
        {selectedTemplate && (
          <div className="border-t p-4 bg-muted/30 shrink-0">
            <div className="flex items-start gap-3">
              <div className="text-2xl">{selectedTemplate.icon || '📜'}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-medium">{selectedTemplate.name}</h4>
                  <Badge className={priorityConfig[selectedTemplate.priority].color}>
                    {priorityConfig[selectedTemplate.priority].label}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {getActivationLabel(selectedTemplate.activation.method)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {selectedTemplate.description || 'Sin descripción'}
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    {selectedTemplate.objectives.length} objetivos
                  </span>
                  <span className="flex items-center gap-1">
                    <Gift className="w-3 h-3" />
                    {selectedTemplate.rewards.length} recompensas
                  </span>
                  {selectedTemplate.isRepeatable && (
                    <Badge variant="secondary" className="text-[10px] h-4 bg-green-500/10 text-green-600">
                      Repetible
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Prerequisites warning */}
            {selectedTemplate.prerequisites && selectedTemplate.prerequisites.length > 0 && (
              <div className="mt-3 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400">
                <strong>Prerrequisitos:</strong> {selectedTemplate.prerequisites.join(', ')}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="p-4 border-t shrink-0 flex flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleActivate}
            disabled={!selectedTemplate || !canActivate}
            className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Activar Misión
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Template Group Component
// ============================================

interface TemplateGroupProps {
  title: string;
  icon: React.ReactNode;
  templates: QuestTemplate[];
  selectedId: string;
  onSelect: (id: string) => void;
  activeTemplateIds: string[];
}

function TemplateGroup({ title, icon, templates, selectedId, onSelect, activeTemplateIds }: TemplateGroupProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {icon}
        {title}
        <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{templates.length}</span>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {templates.map((template) => {
          const isActive = activeTemplateIds.includes(template.id) && !template.isRepeatable;
          const isSelected = selectedId === template.id;

          return (
            <div
              key={template.id}
              onClick={() => !isActive && onSelect(template.id)}
              className={cn(
                "p-3 rounded-lg border cursor-pointer transition-all",
                "hover:border-amber-500/30 hover:bg-muted/50",
                isSelected && "border-amber-500/50 bg-amber-500/10",
                isActive && "opacity-50 cursor-not-allowed bg-muted/30"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0",
                  isSelected ? "border-amber-500 bg-amber-500" : "border-muted-foreground/30"
                )}>
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{template.icon || '📜'}</span>
                    <span className="font-medium truncate">{template.name}</span>
                    {isActive && (
                      <Badge variant="secondary" className="text-[10px] bg-green-500/10 text-green-600">
                        Activa
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Target className="w-3 h-3" />
                      {template.objectives.length}
                    </span>
                    <span className="flex items-center gap-1">
                      <Gift className="w-3 h-3" />
                      {template.rewards.length}
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      <code className="bg-muted px-1 rounded text-[10px]">{template.activation.key}</code>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default QuestActivationDialog;
