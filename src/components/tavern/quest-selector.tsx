'use client';

/**
 * QuestSelector Component
 * 
 * Multi-select dropdown for selecting quest templates for a character or group.
 * Used in the character/group editor.
 */

import { useEffect } from 'react';
import { useTavernStore } from '@/store';
import type { QuestTemplate, QuestPriority } from '@/types';
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollText, X, Check, Star, Target, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuestSelectorProps {
  value: string[] | undefined;
  onChange: (questTemplateIds: string[]) => void;
  placeholder?: string;
}

// Priority colors for badges
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

export function QuestSelector({ value = [], onChange, placeholder = 'Sin misiones' }: QuestSelectorProps) {
  const questTemplates = useTavernStore((state) => state.questTemplates);
  const loadTemplates = useTavernStore((state) => state.loadTemplates);

  // Load templates on mount if not loaded
  useEffect(() => {
    if (questTemplates.length === 0) {
      loadTemplates();
    }
  }, [questTemplates.length, loadTemplates]);

  const handleToggle = (templateId: string) => {
    const newValue = value.includes(templateId)
      ? value.filter(id => id !== templateId)
      : [...value, templateId];
    onChange(newValue);
  };

  const handleRemove = (templateId: string) => {
    onChange(value.filter(id => id !== templateId));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  // Get selected templates
  const selectedTemplates = questTemplates.filter(t => value.includes(t.id));

  // Group templates by priority for display
  const groupedTemplates = {
    main: questTemplates.filter(t => t.priority === 'main'),
    side: questTemplates.filter(t => t.priority === 'side'),
    hidden: questTemplates.filter(t => t.priority === 'hidden'),
  };

  return (
    <div className="space-y-2">
      {/* Selected quests display */}
      {selectedTemplates.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedTemplates.map((template) => (
            <Badge
              key={template.id}
              variant="secondary"
              className={cn("gap-1 pr-1 text-xs", priorityColors[template.priority])}
            >
              <span>{template.icon || '📜'}</span>
              {template.name}
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => handleRemove(template.id)}
              >
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          ))}
          {selectedTemplates.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 text-xs text-muted-foreground"
              onClick={handleClearAll}
            >
              Limpiar
            </Button>
          )}
        </div>
      )}

      {/* Dropdown selector */}
      <Select>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder}>
            <div className="flex items-center gap-2">
              <ScrollText className="w-4 h-4" />
              <span>
                {selectedTemplates.length > 0
                  ? `${selectedTemplates.length} misión${selectedTemplates.length > 1 ? 'es' : ''} seleccionada${selectedTemplates.length > 1 ? 's' : ''}`
                  : placeholder
                }
              </span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {questTemplates.length === 0 ? (
            <div className="px-2 py-3 text-center text-sm text-muted-foreground">
              No hay templates de misión creados.
              <br />
              Crea uno en Configuración → Quest Templates
            </div>
          ) : (
            <div className="max-h-[300px] overflow-y-auto">
              {/* Main Quests */}
              {groupedTemplates.main.length > 0 && (
                <div className="px-2 py-1">
                  <div className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">
                    <Star className="w-3 h-3" />
                    Misiones Principales
                  </div>
                  {groupedTemplates.main.map((template) => (
                    <QuestOption
                      key={template.id}
                      template={template}
                      isSelected={value.includes(template.id)}
                      onToggle={() => handleToggle(template.id)}
                    />
                  ))}
                </div>
              )}

              {/* Side Quests */}
              {groupedTemplates.side.length > 0 && (
                <div className="px-2 py-1">
                  <div className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                    <Target className="w-3 h-3" />
                    Misiones Secundarias
                  </div>
                  {groupedTemplates.side.map((template) => (
                    <QuestOption
                      key={template.id}
                      template={template}
                      isSelected={value.includes(template.id)}
                      onToggle={() => handleToggle(template.id)}
                    />
                  ))}
                </div>
              )}

              {/* Hidden Quests */}
              {groupedTemplates.hidden.length > 0 && (
                <div className="px-2 py-1">
                  <div className="flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    <ScrollText className="w-3 h-3" />
                    Misiones Ocultas
                  </div>
                  {groupedTemplates.hidden.map((template) => (
                    <QuestOption
                      key={template.id}
                      template={template}
                      isSelected={value.includes(template.id)}
                      onToggle={() => handleToggle(template.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </SelectContent>
      </Select>

      {/* Info text */}
      {selectedTemplates.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Las misiones seleccionadas estarán disponibles en esta sesión de rol.
        </p>
      )}
    </div>
  );
}

// ============================================
// Quest Option Component
// ============================================

interface QuestOptionProps {
  template: QuestTemplate;
  isSelected: boolean;
  onToggle: () => void;
}

function QuestOption({ template, isSelected, onToggle }: QuestOptionProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer",
        "hover:bg-muted/50 transition-colors",
        isSelected && "bg-muted/30"
      )}
      onClick={onToggle}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={onToggle}
        className="pointer-events-none"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm">{template.icon || '📜'}</span>
          <span className="truncate text-sm font-medium">{template.name}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-0.5">
            <Target className="w-3 h-3" />
            {template.objectives.length}
          </span>
          <span className="flex items-center gap-0.5">
            <Gift className="w-3 h-3" />
            {template.rewards.length}
          </span>
          {template.isRepeatable && (
            <Badge variant="outline" className="text-[9px] px-1 h-3.5 bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
              Repetible
            </Badge>
          )}
          {template.isHidden && (
            <Badge variant="outline" className="text-[9px] px-1 h-3.5 bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20">
              Oculta
            </Badge>
          )}
        </div>
      </div>
      {isSelected && (
        <Check className="w-4 h-4 text-primary" />
      )}
    </div>
  );
}

export default QuestSelector;
