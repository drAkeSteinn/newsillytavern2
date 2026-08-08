'use client';

import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Clock,
  Hash,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { SummaryData } from '@/types';

interface SummaryViewerProps {
  sessionId?: string;
  className?: string;
}

export function SummaryViewer({ sessionId, className }: SummaryViewerProps) {
  const { 
    summaries, 
    getSessionSummaries, 
    deleteSummary, 
    isGeneratingSummary,
    summarySettings
  } = useTavernStore();
  
  const [expandedSummaries, setExpandedSummaries] = useState<Set<string>>(new Set());
  
  // Get summaries for this session
  const sessionSummaries = sessionId 
    ? getSessionSummaries(sessionId)
    : summaries;

  const toggleExpand = useCallback((summaryId: string) => {
    setExpandedSummaries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(summaryId)) {
        newSet.delete(summaryId);
      } else {
        newSet.add(summaryId);
      }
      return newSet;
    });
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!summarySettings.enabled) {
    return (
      <Card className={cn("border-dashed", className)}>
        <CardContent className="py-8 text-center">
          <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground text-sm">
            El sistema de memoria está desactivado.
          </p>
          <p className="text-muted-foreground/70 text-xs mt-1">
            Actívalo en Configuración → Memoria para ver los resúmenes.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (sessionSummaries.length === 0) {
    return (
      <Card className={cn("border-dashed", className)}>
        <CardContent className="py-8 text-center">
          <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground text-sm">
            No hay resúmenes generados aún.
          </p>
          <p className="text-muted-foreground/70 text-xs mt-1">
            Los resúmenes aparecerán automáticamente según la configuración de intervalo.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {isGeneratingSummary && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="py-3 flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm">Generando resumen...</span>
          </CardContent>
        </Card>
      )}
      
      {sessionSummaries.map((summary) => (
        <SummaryCard
          key={summary.id}
          summary={summary}
          isExpanded={expandedSummaries.has(summary.id)}
          onToggle={() => toggleExpand(summary.id)}
          onDelete={() => deleteSummary(summary.id)}
          formatDate={formatDate}
        />
      ))}
    </div>
  );
}

// ============================================
// Summary Card Component
// ============================================

interface SummaryCardProps {
  summary: SummaryData;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  formatDate: (date: string) => string;
}

function SummaryCard({ summary, isExpanded, onToggle, onDelete, formatDate }: SummaryCardProps) {
  return (
    <Card className="overflow-hidden transition-all">
      <CardHeader className="py-3 px-4 cursor-pointer hover:bg-muted/50" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <div>
              <CardTitle className="text-sm font-medium">
                Resumen #{summary.messageRange.start + 1}-{summary.messageRange.end + 1}
              </CardTitle>
              <CardDescription className="text-xs flex items-center gap-2 mt-0.5">
                <Clock className="w-3 h-3" />
                {formatDate(summary.createdAt)}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              <Hash className="w-3 h-3 mr-1" />
              {summary.tokens} tokens
            </Badge>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="pt-0 pb-4 px-4">
          <ScrollArea className="max-h-[300px] rounded-lg bg-muted/30 p-3">
            <p className="text-sm whitespace-pre-wrap">{summary.content}</p>
          </ScrollArea>
          
          <div className="flex items-center justify-end gap-2 mt-3">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={(e) => {
                e.stopPropagation();
                // TODO: Implement regenerate
              }}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Regenerar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Eliminar
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
