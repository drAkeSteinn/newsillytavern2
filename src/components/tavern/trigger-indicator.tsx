'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { History, Zap, Image, Clock, X, Trash2 } from 'lucide-react';
import { useTavernStore } from '@/store';

interface TriggerHistoryEntry {
  id: string;
  timestamp: number;
  type: 'pack' | 'simple';
  packTitle?: string;
  spriteLabel: string;
  spriteUrl: string;
  matchedKeywords: string[];
  matchedKeys: string[];
  returnToIdle?: boolean;
}

interface TriggerIndicatorProps {
  className?: string;
  showHistory?: boolean;
  maxHistory?: number;
}

// Global history for trigger events
let triggerHistory: TriggerHistoryEntry[] = [];
const historyListeners: Set<() => void> = new Set();

export function addToTriggerHistory(entry: Omit<TriggerHistoryEntry, 'id' | 'timestamp'>) {
  const newEntry: TriggerHistoryEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
  };
  
  triggerHistory = [newEntry, ...triggerHistory].slice(0, 50); // Keep last 50
  historyListeners.forEach(listener => listener());
}

export function clearTriggerHistory() {
  triggerHistory = [];
  historyListeners.forEach(listener => listener());
}

export function TriggerIndicator({ className, showHistory = true, maxHistory = 10 }: TriggerIndicatorProps) {
  const [, forceUpdate] = useState(0);
  const store = useTavernStore();
  
  // Subscribe to history changes
  useEffect(() => {
    const listener = () => forceUpdate(n => n + 1);
    historyListeners.add(listener);
    return () => {
      historyListeners.delete(listener);
    };
  }, []);

  // Get current state
  const currentSpriteUrl = store.currentSpriteUrl;
  const currentSpriteLabel = store.currentSpriteLabel;
  const isLocked = store.isSpriteLocked();
  const returnToIdleState = store.returnToIdle;
  
  // Format time
  const formatTime = (ms: number) => {
    const date = new Date(ms);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Format relative time
  const formatRelativeTime = (ms: number) => {
    const diff = Date.now() - ms;
    if (diff < 60000) return 'Ahora';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return `${Math.floor(diff / 86400000)}d`;
  };

  const displayHistory = triggerHistory.slice(0, maxHistory);

  if (!currentSpriteUrl && displayHistory.length === 0) {
    return null;
  }

  return (
    <div className={cn("bg-card border rounded-lg p-3 space-y-3", className)}>
      {/* Current State */}
      {currentSpriteUrl && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium">
            <Zap className="w-3.5 h-3.5 text-primary" />
            <span>Sprite Activo</span>
          </div>
          
          <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-md">
            <div className="w-8 h-8 rounded overflow-hidden bg-muted flex-shrink-0">
              <img src={currentSpriteUrl} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">
                {currentSpriteLabel || 'Sprite'}
              </div>
              <div className="flex gap-1 mt-0.5">
                {isLocked && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 bg-amber-500/20 text-amber-600">
                    🔒 Locked
                  </Badge>
                )}
                {returnToIdleState.active && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 bg-blue-500/20 text-blue-600">
                    ⏱️ {Math.max(0, Math.ceil((returnToIdleState.returnAt - Date.now()) / 1000))}s
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      {showHistory && displayHistory.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <History className="w-3.5 h-3.5" />
              <span>Historial</span>
            </div>
            {triggerHistory.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 text-[10px] px-1"
                onClick={clearTriggerHistory}
              >
                <Trash2 className="w-2.5 h-2.5 mr-1" />
                Limpiar
              </Button>
            )}
          </div>

          <ScrollArea className="h-[120px]">
            <div className="space-y-1 pr-1">
              {displayHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-2 p-1.5 bg-muted/50 rounded text-xs"
                >
                  <div className="w-5 h-5 rounded overflow-hidden bg-muted flex-shrink-0">
                    {entry.spriteUrl && (
                      <img src={entry.spriteUrl} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {entry.spriteLabel || 'Sprite'}
                    </div>
                    <div className="flex gap-0.5 mt-0.5">
                      {entry.matchedKeywords.slice(0, 2).map((kw) => (
                        <Badge key={kw} variant="outline" className="text-[9px] px-1 py-0 h-3">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div className="text-[10px] text-muted-foreground flex-shrink-0">
                    {formatRelativeTime(entry.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
