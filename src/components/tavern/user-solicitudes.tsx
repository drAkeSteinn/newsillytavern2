'use client';

import { useMemo } from 'react';
import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Mail, Send, Inbox, Check } from 'lucide-react';
import type { Persona, CharacterCard, SolicitudDefinition, InvitationDefinition, SolicitudInstance } from '@/types';
import { resolveInvitations } from '@/lib/stats/stats-resolver';

interface QuickPetitionsProps {
  activePersona?: Persona | null;
  activeCharacter?: CharacterCard | null;
  characters: CharacterCard[];
  onActivatePeticion: (
    targetCharacterId: string,
    solicitudKey: string,
    description: string,
    completionDescription?: string
  ) => void;
}

/**
 * QuickPetitions Component
 * 
 * Displays available petitions (peticiones) as clickable tags.
 * When clicked, creates a SolicitudInstance for the target character
 * without injecting anything into the chat.
 */
export function QuickPetitions({
  activePersona,
  activeCharacter,
  characters,
  onActivatePeticion,
}: QuickPetitionsProps) {
  const activeSessionId = useTavernStore((state) => state.activeSessionId);
  const sessions = useTavernStore((state) => state.sessions);
  
  // Get session stats
  const activeSession = sessions.find(s => s.id === activeSessionId);
  const sessionStats = activeSession?.sessionStats;
  
  // Get persona's stats config (user's peticiones)
  const userStatsConfig = activePersona?.statsConfig;
  const userInvitations = userStatsConfig?.invitations || [];
  const userName = activePersona?.name || 'User';
  
  // Get all active (pending) solicitudes from user to check for duplicates
  const activeUserPetitions = useMemo(() => {
    const pending: Map<string, SolicitudInstance> = new Map();
    if (!sessionStats?.solicitudes?.characterSolicitudes) return pending;
    
    // Check all characters for pending solicitudes from user
    for (const [charId, solicitudes] of Object.entries(sessionStats.solicitudes.characterSolicitudes)) {
      for (const s of solicitudes) {
        if (s.fromCharacterId === '__user__' && s.status === 'pending') {
          // Key format: targetCharacterId:solicitudKey
          pending.set(`${charId}:${s.key}`, s);
        }
      }
    }
    return pending;
  }, [sessionStats]);
  
  // Resolve available petitions
  const availablePetitions = useMemo(() => {
    if (!userStatsConfig?.enabled || userInvitations.length === 0) {
      return [];
    }
    
    // Get user's current attribute values from session stats (if any)
    const userAttributeValues: Record<string, number | string> = {};
    // Note: User stats would be stored under '__user__' if we want to support user attributes
    
    // Resolve invitations to get actual keys and descriptions
    // IMPORTANT: When USER makes a petition, characterName should be the USER's name
    // - {{solicitante}} = userName (who makes the request = the user)
    // - {{solicitado}} = targetCharacter.name (who receives the request)
    const resolved = resolveInvitations(
      userInvitations,
      userAttributeValues,
      characters,
      sessionStats,
      userName,           // userName - for {{user}} key
      userName            // characterName = userName because the USER is the one making the petition
    );
    
    return resolved;
  }, [userStatsConfig, userInvitations, characters, sessionStats, userName, activeCharacter]);
  
  if (availablePetitions.length === 0) {
    return null;
  }
  
  return (
    <div className="px-2 py-1 flex gap-1 overflow-x-auto border-t bg-background/30 flex-shrink-0">
      <div className="flex items-center gap-1 mr-1">
        <Send className="w-3 h-3 text-blue-400" />
        <span className="text-[10px] text-muted-foreground">Peticiones:</span>
      </div>
      
      {availablePetitions.map((petition) => {
        const targetChar = characters.find(c => c.id === petition.targetCharacterId);
        // Check if this petition is already active (use solicitudKey for checking)
        const petitionKey = `${petition.targetCharacterId}:${petition.solicitudKey}`;
        const isAlreadyActive = activeUserPetitions.has(petitionKey);

        return (
          <Button
            key={petition.id}
            variant="outline"
            size="sm"
            disabled={isAlreadyActive}
            className={cn(
              "h-6 px-2 text-xs flex-shrink-0 gap-1",
              isAlreadyActive
                ? "bg-green-500/10 border-green-500/30 text-green-400 cursor-default"
                : "bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/50"
            )}
            onClick={() => onActivatePeticion(
              petition.targetCharacterId,
              petition.solicitudKey,            // Use solicitudKey (completion key) for the target
              petition.solicitudDescription,    // Use solicitudDescription for the target
              petition.completionDescription    // Pass completion description
            )}
          >
            {isAlreadyActive ? (
              <Check className="w-3 h-3" />
            ) : (
              <Mail className="w-3 h-3" />
            )}
            <span className="truncate max-w-[100px]">
              {petition.name}
            </span>
            {targetChar && (
              <Badge className={cn(
                "text-[8px] px-1 h-4",
                isAlreadyActive
                  ? "bg-green-500/20 text-green-300"
                  : "bg-blue-500/20 text-blue-300"
              )}>
                → {targetChar.name}
              </Badge>
            )}
          </Button>
        );
      })}
    </div>
  );
}

// ============================================
// User Solicitudes Panel Component
// ============================================

interface UserSolicitudesPanelProps {
  className?: string;
}

/**
 * UserSolicitudesPanel Component
 * 
 * Displays pending solicitudes received by the user.
 * Allows accepting or rejecting each solicitud.
 */
export function UserSolicitudesPanel({ className }: UserSolicitudesPanelProps) {
  const activeSessionId = useTavernStore((state) => state.activeSessionId);
  const getPendingUserSolicitudes = useTavernStore((state) => state.getPendingUserSolicitudes);
  const acceptUserSolicitud = useTavernStore((state) => state.acceptUserSolicitud);
  const rejectUserSolicitud = useTavernStore((state) => state.rejectUserSolicitud);
  
  const pendingSolicitudes = activeSessionId 
    ? getPendingUserSolicitudes(activeSessionId)
    : [];
  
  if (pendingSolicitudes.length === 0) {
    return null;
  }
  
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <Inbox className="w-4 h-4 text-amber-500" />
        <span>Solicitudes Recibidas</span>
        <Badge className="bg-amber-500/20 text-amber-400 text-xs">
          {pendingSolicitudes.length}
        </Badge>
      </div>
      
      <div className="space-y-2">
        {pendingSolicitudes.map((solicitud) => (
          <div
            key={solicitud.id}
            className="p-3 rounded-lg border bg-amber-500/10 border-amber-500/30"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-amber-400">
                    De: {solicitud.fromCharacterName}
                  </span>
                  <code className="text-[10px] bg-black/20 px-1.5 py-0.5 rounded font-mono">
                    {solicitud.key}
                  </code>
                </div>
                <p className="text-xs text-muted-foreground">
                  {solicitud.description}
                </p>
              </div>
              
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20"
                  onClick={() => {
                    if (activeSessionId) {
                      acceptUserSolicitud(activeSessionId, solicitud.id);
                    }
                  }}
                >
                  ✓ Aceptar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                  onClick={() => {
                    if (activeSessionId) {
                      rejectUserSolicitud(activeSessionId, solicitud.id);
                    }
                  }}
                >
                  ✗ Rechazar
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
