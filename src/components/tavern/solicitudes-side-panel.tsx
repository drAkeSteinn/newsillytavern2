'use client';

import { useState, useMemo } from 'react';
import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { 
  Inbox, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  X, 
  Clock,
  User,
} from 'lucide-react';
import type { SolicitudInstance } from '@/types';

interface SolicitudesSidePanelProps {
  className?: string;
}

/**
 * SolicitudesSidePanel Component
 * 
 * A collapsible side panel that shows pending solicitudes received by the user.
 * When collapsed, shows a floating button with a badge count on the right edge.
 * When expanded, slides out from the right side with a scrollable list.
 * 
 * Designed to work inside a container with overflow-hidden.
 */
export function SolicitudesSidePanel({ 
  className,
}: SolicitudesSidePanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const activeSessionId = useTavernStore((state) => state.activeSessionId);
  const getPendingUserSolicitudes = useTavernStore((state) => state.getPendingUserSolicitudes);
  const acceptUserSolicitud = useTavernStore((state) => state.acceptUserSolicitud);
  const rejectUserSolicitud = useTavernStore((state) => state.rejectUserSolicitud);
  
  const pendingSolicitudes = activeSessionId 
    ? getPendingUserSolicitudes(activeSessionId)
    : [];
  
  // Group solicitudes by character
  const solicitudesByCharacter = useMemo(() => {
    const grouped = new Map<string, SolicitudInstance[]>();
    for (const s of pendingSolicitudes) {
      const existing = grouped.get(s.fromCharacterName) || [];
      existing.push(s);
      grouped.set(s.fromCharacterName, existing);
    }
    return grouped;
  }, [pendingSolicitudes]);
  
  // Format relative time
  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `Hace ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours}h`;
    return `Hace ${Math.floor(hours / 24)}d`;
  };
  
  // Don't render anything if no solicitudes and not expanded
  if (pendingSolicitudes.length === 0 && !isExpanded) {
    return null;
  }
  
  return (
    <div 
      className={cn(
        "absolute right-0 top-0 bottom-0 z-30 flex transition-all duration-200 ease-out",
        isExpanded ? "translate-x-0" : "translate-x-0",
        className
      )}
    >
      {/* Expanded State - Sliding Panel (rendered first so it's behind the button when collapsed) */}
      <div 
        className={cn(
          "flex flex-col bg-background/95 backdrop-blur-sm border-l shadow-2xl overflow-hidden transition-all duration-200 ease-out",
          isExpanded ? "w-64 opacity-100" : "w-0 opacity-0"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-2 border-b bg-muted/30 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <Inbox className="w-4 h-4 text-amber-500" />
            <span className="font-medium text-xs">Solicitudes</span>
            {pendingSolicitudes.length > 0 && (
              <Badge className="bg-amber-500/20 text-amber-400 text-[9px] px-1">
                {pendingSolicitudes.length}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => setIsExpanded(false)}
          >
            <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
        
        {/* Content with Scroll */}
        <ScrollArea className="flex-1">
          <div className="p-1.5 space-y-1.5">
            {pendingSolicitudes.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Inbox className="w-6 h-6 mx-auto mb-2 opacity-30" />
                <p className="text-[10px]">No hay solicitudes pendientes</p>
              </div>
            ) : (
              Array.from(solicitudesByCharacter.entries()).map(([characterName, solicitudes]) => (
                <div key={characterName} className="space-y-1">
                  {/* Character Header */}
                  <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-muted/50 rounded text-[10px] font-medium text-muted-foreground">
                    <User className="w-2.5 h-2.5" />
                    <span className="truncate flex-1">{characterName}</span>
                    <Badge variant="outline" className="text-[8px] h-3 px-0.5">
                      {solicitudes.length}
                    </Badge>
                  </div>
                  
                  {/* Solicitudes for this character */}
                  {solicitudes.map((solicitud) => (
                    <div
                      key={solicitud.id}
                      className="p-2 rounded-lg border bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10 transition-colors"
                    >
                      {/* Key badge and time */}
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <code className="text-[9px] bg-black/30 px-1 py-0.5 rounded font-mono text-amber-300 truncate max-w-[100px]">
                          {solicitud.key}
                        </code>
                        <span className="text-[8px] text-muted-foreground flex items-center gap-0.5">
                          <Clock className="w-2 h-2" />
                          {formatTime(solicitud.createdAt)}
                        </span>
                      </div>
                      
                      {/* Description */}
                      <p className="text-[10px] text-foreground/80 mb-1.5 leading-relaxed line-clamp-2">
                        {solicitud.description}
                      </p>
                      
                      {/* Action Buttons */}
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-5 px-1.5 text-[9px] flex-1 bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20 hover:text-green-300"
                          onClick={() => {
                            if (activeSessionId) {
                              acceptUserSolicitud(activeSessionId, solicitud.id);
                            }
                          }}
                        >
                          <Check className="w-2.5 h-2.5 mr-0.5" />
                          Aceptar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-5 px-1.5 text-[9px] flex-1 bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                          onClick={() => {
                            if (activeSessionId) {
                              rejectUserSolicitud(activeSessionId, solicitud.id);
                            }
                          }}
                        >
                          <X className="w-2.5 h-2.5 mr-0.5" />
                          Rechazar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
      
      {/* Collapsed State - Floating Button on the right edge */}
      <Button
        variant="outline"
        size="sm"
        className={cn(
          "h-auto py-2 px-1 gap-1 bg-background/95 backdrop-blur-sm border-r-0 rounded-r-none rounded-l-lg shadow-lg flex-shrink-0",
          isExpanded && "hidden",
          "border-amber-500/30 hover:border-amber-500/50",
          "flex-col items-center justify-center"
        )}
        style={{ 
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
        }}
        onClick={() => setIsExpanded(true)}
      >
        <Inbox className="w-4 h-4 text-amber-500 mb-1" style={{ writingMode: 'horizontal-tb' }} />
        <span className="text-[10px] font-medium" style={{ writingMode: 'horizontal-tb' }}>
          {pendingSolicitudes.length > 0 && (
            <Badge className="bg-amber-500 text-white text-[9px] px-1 h-4 min-w-[16px] justify-center">
              {pendingSolicitudes.length}
            </Badge>
          )}
        </span>
        <ChevronLeft className="w-3 h-3 text-muted-foreground mt-1" style={{ writingMode: 'horizontal-tb' }} />
      </Button>
    </div>
  );
}
