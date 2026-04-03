'use client';

import { useState } from 'react';
import { Brain, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface EmbeddingsContextData {
  count: number;
  namespaces: string[];
  topResults: Array<{
    content: string;
    similarity: number;
    namespace: string;
    source_type?: string;
  }>;
}

interface EmbeddingsContextIndicatorProps {
  data: EmbeddingsContextData;
  characterName?: string;
  onDismiss?: () => void;
}

export function EmbeddingsContextIndicator({
  data,
  characterName,
  onDismiss,
}: EmbeddingsContextIndicatorProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mx-auto max-w-lg my-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'flex items-center gap-2 w-full px-3 py-1.5 rounded-lg border transition-all duration-200',
          'bg-violet-500/5 border-violet-500/20 hover:bg-violet-500/10 hover:border-violet-500/30',
          'dark:bg-violet-500/10 dark:border-violet-500/30 dark:hover:bg-violet-500/15',
          'text-left group'
        )}
      >
        <Brain className="w-3.5 h-3.5 text-violet-500 shrink-0" />
        <span className="text-xs text-violet-600 dark:text-violet-400 font-medium flex-1">
          {characterName ? (
            <>Contexto recuperado para <strong>{characterName}</strong></>
          ) : (
            <>Contexto recuperado</>
          )}
        </span>
        <Badge
          variant="secondary"
          className="text-[10px] h-5 px-1.5 bg-violet-500/15 text-violet-600 dark:text-violet-400 border-0"
        >
          {data.count}
        </Badge>
        <div className="flex gap-0.5">
          {data.namespaces.slice(0, 2).map(ns => (
            <Badge key={ns} variant="outline" className="text-[9px] h-4 px-1 border-violet-500/20 text-violet-500/70">
              {ns}
            </Badge>
          ))}
          {data.namespaces.length > 2 && (
            <Badge variant="outline" className="text-[9px] h-4 px-1 border-violet-500/20 text-violet-500/70">
              +{data.namespaces.length - 2}
            </Badge>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-3 h-3 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="mt-1 rounded-lg border border-violet-500/20 bg-violet-500/5 dark:bg-violet-500/10 overflow-hidden">
          <div className="max-h-48 overflow-y-auto p-2 space-y-1.5">
            {data.topResults.map((result, i) => (
              <div
                key={i}
                className="p-2 rounded-md bg-background/60 border border-border/30"
              >
                <p className="text-xs text-foreground/80 line-clamp-2 leading-relaxed">
                  {result.content}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <Badge variant="outline" className="text-[9px] h-3.5 px-1 border-violet-500/20">
                    {(result.similarity * 100).toFixed(0)}%
                  </Badge>
                  {result.source_type && (
                    <span className="text-[9px] text-muted-foreground">{result.source_type}</span>
                  )}
                  <span className="text-[9px] text-muted-foreground">{result.namespace}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface EmbeddingsContextContainerProps {
  contexts: Array<EmbeddingsContextData & { characterId?: string; characterName?: string }>;
  onClear?: () => void;
}

export function EmbeddingsContextContainer({
  contexts,
  onClear,
}: EmbeddingsContextContainerProps) {
  if (contexts.length === 0) return null;

  return (
    <div className="space-y-1">
      {contexts.map((ctx, i) => (
        <EmbeddingsContextIndicator
          key={`${ctx.characterId || 'single'}-${i}`}
          data={ctx}
          characterName={ctx.characterName}
        />
      ))}
    </div>
  );
}

export default EmbeddingsContextIndicator;
