// ============================================
// Stats Slice - Character stats management
// ============================================

import type {
  SessionStats,
  CharacterSessionStats,
  StatChangeLogEntry,
  CharacterStatsConfig,
  AttributeDefinition,
  SkillDefinition,
  IntentionDefinition,
  InvitationDefinition,
  StatRequirement,
  SolicitudInstance,
  SessionSolicitudes,
} from '@/types';

// ============================================
// Types
// ============================================

export interface ThresholdReachedInfo {
  attributeKey: string;
  attributeName: string;
  thresholdType: 'min' | 'max';
  thresholdValue: number;
  rewards: import('@/types').QuestReward[];
}

export interface UpdateCharacterStatResult {
  oldValue: number | string | undefined;
  newValue: number | string;
  clamped: boolean;
  thresholdsReached: ThresholdReachedInfo[];
}

export interface StatsSlice {
  // Session stats state (values per session)
  sessionStats: SessionStats | null;
  
  // Session Stats Actions
  initializeSessionStats: (
    sessionId: string,
    characters: Array<{ id: string; statsConfig?: CharacterStatsConfig }>
  ) => void;
  
  updateCharacterStat: (
    sessionId: string,
    characterId: string,
    attributeKey: string,
    value: number | string,
    reason?: 'llm_detection' | 'manual' | 'trigger' | 'initialization'
  ) => UpdateCharacterStatResult;
  
  batchUpdateCharacterStats: (
    sessionId: string,
    characterId: string,
    updates: Array<{ attributeKey: string; value: number | string }>,
    reason?: 'llm_detection' | 'manual' | 'trigger'
  ) => void;
  
  resetCharacterStats: (
    sessionId: string,
    characterId: string,
    statsConfig?: CharacterStatsConfig
  ) => void;
  
  clearSessionStats: (sessionId: string) => void;
  
  // Getters
  getCharacterStats: (sessionId: string, characterId: string) => CharacterSessionStats | null;
  getAttributeValue: (sessionId: string, characterId: string, attributeKey: string) => number | string | null;

  // Solicitud Management (Peticiones/Solicitudes system)
  createSolicitud: (
    sessionId: string,
    targetCharacterId: string,
    solicitud: Omit<SolicitudInstance, 'id' | 'createdAt' | 'status'>
  ) => SolicitudInstance | null;
  
  completeSolicitud: (
    sessionId: string,
    characterId: string,
    solicitudKey: string
  ) => SolicitudInstance | null;
  
  getPendingSolicitudes: (
    sessionId: string,
    characterId: string
  ) => SolicitudInstance[];

  // User Peticiones/Solicitudes Actions (for {{user}})
  // These work without injecting anything into the chat
  activateUserPeticion: (
    sessionId: string,
    targetCharacterId: string,
    solicitudKey: string,
    description: string,
    completionDescription: string | undefined,
    userName: string
  ) => SolicitudInstance | null;
  
  acceptUserSolicitud: (
    sessionId: string,
    solicitudId: string
  ) => SolicitudInstance | null;
  
  rejectUserSolicitud: (
    sessionId: string,
    solicitudId: string
  ) => boolean;
  
  getPendingUserSolicitudes: (
    sessionId: string
  ) => SolicitudInstance[];

  // Session Events (for {{eventos}} key)
  // These track recent important events in the session
  updateSessionEvent: (
    sessionId: string,
    eventType: 'ultimo_objetivo_completado' | 'ultima_solicitud_completada' | 'ultima_solicitud_realizada' | 'ultima_accion_realizada',
    description: string
  ) => void;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Clamp a numeric value to the attribute's min/max bounds
 * Returns the clamped value, or the original value if not numeric or no bounds defined
 */
function clampAttributeValue(
  value: number | string,
  attributeDef: AttributeDefinition | undefined
): number | string {
  // Only clamp numeric values
  if (typeof value !== 'number') {
    return value;
  }

  // If no attribute definition, return as-is
  if (!attributeDef) {
    return value;
  }

  let clampedValue = value;

  // Apply min bound - handle both number and string min values
  if (attributeDef.min !== undefined) {
    const minVal = typeof attributeDef.min === 'number'
      ? attributeDef.min
      : parseFloat(String(attributeDef.min));

    if (!isNaN(minVal)) {
      clampedValue = Math.max(clampedValue, minVal);
    }
  }

  // Apply max bound - handle both number and string max values
  if (attributeDef.max !== undefined) {
    const maxVal = typeof attributeDef.max === 'number'
      ? attributeDef.max
      : parseFloat(String(attributeDef.max));

    if (!isNaN(maxVal)) {
      clampedValue = Math.min(clampedValue, maxVal);
    }
  }

  return clampedValue;
}

/**
 * Create default character stats from config
 */
function createDefaultCharacterStats(
  statsConfig?: CharacterStatsConfig
): CharacterSessionStats {
  const attributeValues: Record<string, number | string> = {};
  const lastUpdated: Record<string, number> = {};
  const now = Date.now();
  
  if (statsConfig?.attributes) {
    for (const attr of statsConfig.attributes) {
      attributeValues[attr.key] = attr.defaultValue;
      lastUpdated[attr.key] = now;
    }
  }
  
  return {
    attributeValues,
    lastUpdated,
    changeLog: [],
  };
}

/**
 * Add entry to change log
 */
function addChangeLogEntry(
  stats: CharacterSessionStats,
  attribute: AttributeDefinition | undefined,
  attributeKey: string,
  oldValue: number | string | undefined,
  newValue: number | string,
  reason: StatChangeLogEntry['reason']
): void {
  if (!stats.changeLog) {
    stats.changeLog = [];
  }
  
  stats.changeLog.push({
    attributeId: attribute?.id || attributeKey,
    attributeKey,
    attributeName: attribute?.name || attributeKey,
    oldValue: oldValue ?? '',
    newValue,
    reason,
    timestamp: Date.now(),
  });
  
  // Keep only last 100 entries
  if (stats.changeLog.length > 100) {
    stats.changeLog = stats.changeLog.slice(-100);
  }
}

// ============================================
// Slice Factory
// ============================================

export const createStatsSlice = (set: any, get: any): StatsSlice => ({
  // Initial State
  sessionStats: null,

  // ============================================
  // Session Stats Actions
  // ============================================

  initializeSessionStats: (sessionId, characters) => {
    const state = get();
    const sessions = state.sessions as Array<{ id: string; sessionStats?: SessionStats }>;
    const session = sessions.find(s => s.id === sessionId);
    
    if (!session) return;
    
    // Check if already initialized
    if (session.sessionStats?.initialized) return;
    
    const now = Date.now();
    const characterStats: Record<string, CharacterSessionStats> = {};
    
    // Initialize stats for each character
    for (const char of characters) {
      characterStats[char.id] = createDefaultCharacterStats(char.statsConfig);
    }
    
    const newSessionStats: SessionStats = {
      characterStats,
      initialized: true,
      lastModified: now,
    };
    
    // Update session with new stats
    set((state: any) => ({
      sessions: state.sessions.map((s: any) =>
        s.id === sessionId 
          ? { ...s, sessionStats: newSessionStats, updatedAt: new Date().toISOString() }
          : s
      ),
    }));
  },

  updateCharacterStat: (sessionId, characterId, attributeKey, value, reason = 'manual') => {
    // Default result
    const defaultResult: UpdateCharacterStatResult = {
      oldValue: undefined,
      newValue: typeof value === 'number' ? value : value,
      clamped: false,
      thresholdsReached: [],
    };

    // Read current state
    const state = get();
    const sessions = state.sessions as Array<{ 
      id: string; 
      sessionStats?: SessionStats;
      characterId?: string;
      groupId?: string;
    }>;
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    
    if (sessionIndex === -1) return defaultResult;
    
    const session = sessions[sessionIndex];
    let sessionStats = session.sessionStats;
    
    // Auto-initialize sessionStats if missing
    if (!sessionStats) {
      sessionStats = {
        characterStats: {},
        solicitudes: {
          characterSolicitudes: {},
          lastModified: Date.now(),
        },
        ultimo_objetivo_completado: undefined,
        ultima_solicitud_completada: undefined,
        ultima_solicitud_realizada: undefined,
        ultima_accion_realizada: undefined,
        initialized: true,
        lastModified: Date.now(),
      };
    }
    
    // Auto-initialize character stats if missing
    if (!sessionStats.characterStats[characterId]) {
      const character = state.characters.find((c: any) => c.id === characterId);
      sessionStats = {
        ...sessionStats,
        characterStats: {
          ...sessionStats.characterStats,
          [characterId]: createDefaultCharacterStats(character?.statsConfig),
        },
      };
    }
    
    const stats = sessionStats.characterStats[characterId];
    if (!stats) return defaultResult;

    const oldValue = stats.attributeValues[attributeKey];

    // Find attribute definition for logging and clamping
    const character = state.characters.find((c: any) => c.id === characterId);
    const attributeDef = character?.statsConfig?.attributes?.find(
      (a: AttributeDefinition) => a.key === attributeKey
    );

    // Clamp value to min/max bounds
    const clampedValue = clampAttributeValue(value, attributeDef);
    const clamped = clampedValue !== value;

    // Log if clamping occurred
    if (clamped) {
      console.log(`[StatsSlice] Clamped ${attributeKey}: ${value} → ${clampedValue} (min: ${attributeDef?.min}, max: ${attributeDef?.max})`);
    }

    // Detect threshold reached
    const thresholdsReached: ThresholdReachedInfo[] = [];
    
    if (attributeDef && typeof clampedValue === 'number') {
      // Check if reached minimum
      if (attributeDef.min !== undefined && clampedValue === attributeDef.min) {
        if (attributeDef.onMinReached?.enabled && attributeDef.onMinReached.rewards.length > 0) {
          thresholdsReached.push({
            attributeKey: attributeDef.key,
            attributeName: attributeDef.name,
            thresholdType: 'min',
            thresholdValue: attributeDef.min,
            rewards: attributeDef.onMinReached.rewards,
          });
          console.log(`[StatsSlice] Threshold reached: ${attributeDef.name} hit minimum (${attributeDef.min})`);
        }
      }
      
      // Check if reached maximum
      if (attributeDef.max !== undefined && clampedValue === attributeDef.max) {
        if (attributeDef.onMaxReached?.enabled && attributeDef.onMaxReached.rewards.length > 0) {
          thresholdsReached.push({
            attributeKey: attributeDef.key,
            attributeName: attributeDef.name,
            thresholdType: 'max',
            thresholdValue: attributeDef.max,
            rewards: attributeDef.onMaxReached.rewards,
          });
          console.log(`[StatsSlice] Threshold reached: ${attributeDef.name} hit maximum (${attributeDef.max})`);
        }
      }
    }

    // Build the updated state
    const updatedCharacterStats = {
      ...sessionStats.characterStats,
      [characterId]: {
        ...stats,
        attributeValues: {
          ...stats.attributeValues,
          [attributeKey]: clampedValue,
        },
        lastUpdated: {
          ...stats.lastUpdated,
          [attributeKey]: Date.now(),
        },
      },
    };

    // Add to change log
    addChangeLogEntry(
      updatedCharacterStats[characterId],
      attributeDef,
      attributeKey,
      oldValue,
      clampedValue,
      reason
    );
    
    const newSessionStats: SessionStats = {
      ...sessionStats,
      characterStats: updatedCharacterStats,
      lastModified: Date.now(),
    };
    
    // Update the store
    set({
      sessions: state.sessions.map((s: any) =>
        s.id === sessionId
          ? { 
              ...s, 
              sessionStats: newSessionStats,
              updatedAt: new Date().toISOString() 
            }
          : s
      ),
    });

    // Return result with threshold info
    return {
      oldValue,
      newValue: clampedValue,
      clamped,
      thresholdsReached,
    };
  },

  batchUpdateCharacterStats: (sessionId, characterId, updates, reason = 'llm_detection') => {
    set((state: any) => {
      const sessions = state.sessions as Array<{
        id: string; 
        sessionStats?: SessionStats;
      }>;
      const sessionIndex = sessions.findIndex(s => s.id === sessionId);
      
      if (sessionIndex === -1) return state;
      
      const session = sessions[sessionIndex];
      let sessionStats = session.sessionStats;
      
      // Auto-initialize sessionStats if missing (includes event fields reset)
      if (!sessionStats) {
        sessionStats = {
          characterStats: {},
          solicitudes: {
            characterSolicitudes: {},
            lastModified: Date.now(),
          },
          ultimo_objetivo_completado: undefined,
          ultima_solicitud_completada: undefined,
          ultima_solicitud_realizada: undefined,
          ultima_accion_realizada: undefined,
          initialized: true,
          lastModified: Date.now(),
        };
      }
      
      // Auto-initialize character stats if missing
      if (!sessionStats.characterStats[characterId]) {
        const character = state.characters.find((c: any) => c.id === characterId);
        sessionStats = {
          ...sessionStats,
          characterStats: {
            ...sessionStats.characterStats,
            [characterId]: createDefaultCharacterStats(character?.statsConfig),
          },
        };
      }
      
      const stats = sessionStats.characterStats[characterId];
      if (!stats) return state;
      
      const character = state.characters.find((c: any) => c.id === characterId);
      const now = Date.now();
      
      // Apply all updates
      const newAttributeValues = { ...stats.attributeValues };
      const newLastUpdated = { ...stats.lastUpdated };
      const newChangeLog = [...(stats.changeLog || [])];

      for (const update of updates) {
        const oldValue = newAttributeValues[update.attributeKey];
        const attributeDef = character?.statsConfig?.attributes?.find(
          (a: AttributeDefinition) => a.key === update.attributeKey
        );

        // Clamp value to min/max bounds
        const clampedValue = clampAttributeValue(update.value, attributeDef);

        // Log if clamping occurred
        if (clampedValue !== update.value) {
          console.log(`[StatsSlice] Clamped ${update.attributeKey}: ${update.value} → ${clampedValue} (min: ${attributeDef?.min}, max: ${attributeDef?.max})`);
        }

        newAttributeValues[update.attributeKey] = clampedValue;
        newLastUpdated[update.attributeKey] = now;

        newChangeLog.push({
          attributeId: attributeDef?.id || update.attributeKey,
          attributeKey: update.attributeKey,
          attributeName: attributeDef?.name || update.attributeKey,
          oldValue: oldValue ?? '',
          newValue: clampedValue,
          reason,
          timestamp: now,
        });
      }
      
      // Keep only last 100 entries
      const trimmedChangeLog = newChangeLog.slice(-100);
      
      const updatedCharacterStats = {
        ...sessionStats.characterStats,
        [characterId]: {
          ...stats,
          attributeValues: newAttributeValues,
          lastUpdated: newLastUpdated,
          changeLog: trimmedChangeLog,
        },
      };
      
      const newSessionStats: SessionStats = {
        ...sessionStats,
        characterStats: updatedCharacterStats,
        lastModified: now,
      };
      
      return {
        sessions: state.sessions.map((s: any) =>
          s.id === sessionId
            ? { 
                ...s, 
                sessionStats: newSessionStats,
                updatedAt: new Date().toISOString() 
              }
            : s
        ),
      };
    });
  },

  resetCharacterStats: (sessionId, characterId, statsConfig) => {
    set((state: any) => {
      const sessions = state.sessions as Array<{ 
        id: string; 
        sessionStats?: SessionStats;
      }>;
      const session = sessions.find(s => s.id === sessionId);
      
      if (!session?.sessionStats) return state;
      
      const character = state.characters.find((c: any) => c.id === characterId);
      const newStats = createDefaultCharacterStats(statsConfig || character?.statsConfig);
      
      const updatedCharacterStats = {
        ...session.sessionStats.characterStats,
        [characterId]: newStats,
      };
      
      const newSessionStats: SessionStats = {
        ...session.sessionStats,
        characterStats: updatedCharacterStats,
        lastModified: Date.now(),
      };
      
      return {
        sessions: state.sessions.map((s: any) =>
          s.id === sessionId
            ? { 
                ...s, 
                sessionStats: newSessionStats,
                updatedAt: new Date().toISOString() 
              }
            : s
        ),
      };
    });
  },

  clearSessionStats: (sessionId) => {
    set((state: any) => ({
      sessions: state.sessions.map((s: any) =>
        s.id === sessionId
          ? { 
              ...s, 
              sessionStats: undefined,
              updatedAt: new Date().toISOString() 
            }
          : s
      ),
    }));
  },

  // ============================================
  // Getters
  // ============================================

  getCharacterStats: (sessionId, characterId) => {
    const state = get();
    const sessions = state.sessions as Array<{ 
      id: string; 
      sessionStats?: SessionStats;
    }>;
    const session = sessions.find(s => s.id === sessionId);
    
    if (!session?.sessionStats) return null;
    
    return session.sessionStats.characterStats[characterId] || null;
  },

  getAttributeValue: (sessionId, characterId, attributeKey) => {
    const state = get();
    const sessions = state.sessions as Array<{ 
      id: string; 
      sessionStats?: SessionStats;
    }>;
    const session = sessions.find(s => s.id === sessionId);
    
    if (!session?.sessionStats) return null;
    
    const stats = session.sessionStats.characterStats[characterId];
    if (!stats) return null;
    
    return stats.attributeValues[attributeKey] ?? null;
  },

  // ============================================
  // Solicitud Management (Peticiones/Solicitudes)
  // ============================================

  createSolicitud: (sessionId, targetCharacterId, solicitudData) => {
    const state = get();
    const sessions = state.sessions as Array<{ 
      id: string; 
      sessionStats?: SessionStats;
    }>;
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    
    if (sessionIndex === -1) return null;
    
    const session = sessions[sessionIndex];
    let sessionStats = session.sessionStats;
    
    // Auto-initialize sessionStats if missing (includes event fields)
    if (!sessionStats) {
      sessionStats = {
        characterStats: {},
        solicitudes: {
          characterSolicitudes: {},
          lastModified: Date.now(),
        },
        ultimo_objetivo_completado: undefined,
        ultima_solicitud_completada: undefined,
        ultima_solicitud_realizada: undefined,
        ultima_accion_realizada: undefined,
        initialized: true,
        lastModified: Date.now(),
      };
    }
    
    // Auto-initialize solicitudes if missing
    if (!sessionStats.solicitudes) {
      sessionStats = {
        ...sessionStats,
        solicitudes: {
          characterSolicitudes: {},
          lastModified: Date.now(),
        },
      };
    }
    
    // Create the new solicitud instance
    const newSolicitud: SolicitudInstance = {
      ...solicitudData,
      id: `solicitud-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      createdAt: Date.now(),
    };
    
    console.log(`[createSolicitud] Creating solicitud with data:`, {
      key: solicitudData.key,
      peticionKey: solicitudData.peticionKey,
      fromCharacterId: solicitudData.fromCharacterId,
      targetCharacterId,
    });
    
    // Add to target character's solicitudes
    const currentSolicitudes = sessionStats.solicitudes.characterSolicitudes[targetCharacterId] || [];
    const updatedSolicitudes = [...currentSolicitudes, newSolicitud];
    
    const newSessionStats: SessionStats = {
      ...sessionStats,
      solicitudes: {
        characterSolicitudes: {
          ...sessionStats.solicitudes.characterSolicitudes,
          [targetCharacterId]: updatedSolicitudes,
        },
        lastModified: Date.now(),
      },
      // Save event for {{eventos}} key - peticion was activated
      ultima_solicitud_realizada: solicitudData.description,
      lastModified: Date.now(),
    };
    
    set((state: any) => ({
      sessions: state.sessions.map((s: any) =>
        s.id === sessionId
          ? { 
              ...s, 
              sessionStats: newSessionStats,
              updatedAt: new Date().toISOString() 
            }
          : s
      ),
    }));
    
    console.log(`[Solicitud] Created solicitud "${solicitudData.key}" for character ${targetCharacterId} from ${solicitudData.fromCharacterName}`);
    return newSolicitud;
  },

  completeSolicitud: (sessionId, characterId, solicitudKey) => {
    const state = get();
    const sessions = state.sessions as Array<{ 
      id: string; 
      sessionStats?: SessionStats;
    }>;
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    
    if (sessionIndex === -1) return null;
    
    const session = sessions[sessionIndex];
    const sessionStats = session.sessionStats;
    
    if (!sessionStats?.solicitudes?.characterSolicitudes?.[characterId]) {
      return null;
    }
    
    const solicitudes = sessionStats.solicitudes.characterSolicitudes[characterId];
    const solicitudIndex = solicitudes.findIndex(
      s => s.key === solicitudKey && s.status === 'pending'
    );
    
    if (solicitudIndex === -1) {
      console.log(`[Solicitud] No pending solicitud found with key "${solicitudKey}" for character ${characterId}`);
      return null;
    }
    
    // Mark as completed
    const updatedSolicitudes = [...solicitudes];
    const completedSolicitud = {
      ...updatedSolicitudes[solicitudIndex],
      status: 'completed' as const,
      completedAt: Date.now(),
    };
    updatedSolicitudes[solicitudIndex] = completedSolicitud;
    
    const newSessionStats: SessionStats = {
      ...sessionStats,
      solicitudes: {
        characterSolicitudes: {
          ...sessionStats.solicitudes.characterSolicitudes,
          [characterId]: updatedSolicitudes,
        },
        lastModified: Date.now(),
      },
      // Save event for {{eventos}} key
      ultima_solicitud_completada: completedSolicitud.completionDescription || 
        `Solicitud "${solicitudKey}" completada por ${completedSolicitud.fromCharacterName}`,
      lastModified: Date.now(),
    };
    
    set((state: any) => ({
      sessions: state.sessions.map((s: any) =>
        s.id === sessionId
          ? { 
              ...s, 
              sessionStats: newSessionStats,
              updatedAt: new Date().toISOString() 
            }
          : s
      ),
    }));
    
    console.log(`[Solicitud] Completed solicitud "${solicitudKey}" for character ${characterId}`);
    return completedSolicitud;
  },

  getPendingSolicitudes: (sessionId, characterId) => {
    const state = get();
    const sessions = state.sessions as Array<{ 
      id: string; 
      sessionStats?: SessionStats;
    }>;
    const session = sessions.find(s => s.id === sessionId);
    
    if (!session?.sessionStats?.solicitudes?.characterSolicitudes?.[characterId]) {
      return [];
    }
    
    return session.sessionStats.solicitudes.characterSolicitudes[characterId].filter(
      s => s.status === 'pending'
    );
  },

  // ============================================
  // User Peticiones/Solicitudes Actions ({{user}})
  // ============================================
  // These actions allow the user to make peticiones and accept/reject solicitudes
  // without injecting anything into the chat history.
  // User ID is stored as '__user__' in the session stats.

  /**
   * Activate a peticion for the user
   * Creates a SolicitudInstance for the target character directly
   * (No chat message injection)
   * 
   * Returns null if a pending solicitud with the same key already exists for this target.
   */
  activateUserPeticion: (
    sessionId: string,
    targetCharacterId: string,
    solicitudKey: string,
    description: string,
    completionDescription: string | undefined,
    userName: string
  ) => {
    const state = get();
    const sessions = state.sessions as Array<{ 
      id: string; 
      sessionStats?: SessionStats;
    }>;
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    
    if (sessionIndex === -1) return null;
    
    const session = sessions[sessionIndex];
    let sessionStats = session.sessionStats;
    
    // Auto-initialize sessionStats if missing (includes event fields)
    if (!sessionStats) {
      sessionStats = {
        characterStats: {},
        solicitudes: {
          characterSolicitudes: {},
          lastModified: Date.now(),
        },
        ultimo_objetivo_completado: undefined,
        ultima_solicitud_completada: undefined,
        ultima_solicitud_realizada: undefined,
        ultima_accion_realizada: undefined,
        initialized: true,
        lastModified: Date.now(),
      };
    }
    
    // Auto-initialize solicitudes if missing
    if (!sessionStats.solicitudes) {
      sessionStats = {
        ...sessionStats,
        solicitudes: {
          characterSolicitudes: {},
          lastModified: Date.now(),
        },
      };
    }
    
    // Check for duplicate pending solicitud with same key for same target
    const existingSolicitudes = sessionStats.solicitudes.characterSolicitudes[targetCharacterId] || [];
    const duplicateExists = existingSolicitudes.some(
      s => s.key === solicitudKey && s.status === 'pending' && s.fromCharacterId === '__user__'
    );
    
    if (duplicateExists) {
      console.log(`[UserPeticion] Duplicate solicitud "${solicitudKey}" already exists for character ${targetCharacterId}`);
      return null;
    }
    
    // Create the new solicitud instance
    const newSolicitud: SolicitudInstance = {
      id: `solicitud-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      key: solicitudKey,
      fromCharacterId: '__user__',
      fromCharacterName: userName || 'Usuario',
      description,
      completionDescription,
      status: 'pending',
      createdAt: Date.now(),
    };
    
    // Add to target character's solicitudes
    const currentSolicitudes = sessionStats.solicitudes.characterSolicitudes[targetCharacterId] || [];
    const updatedSolicitudes = [...currentSolicitudes, newSolicitud];
    
    const newSessionStats: SessionStats = {
      ...sessionStats,
      solicitudes: {
        characterSolicitudes: {
          ...sessionStats.solicitudes.characterSolicitudes,
          [targetCharacterId]: updatedSolicitudes,
        },
        lastModified: Date.now(),
      },
      // Save event for {{eventos}} key - user made a peticion to a character
      ultima_solicitud_realizada: description,
      lastModified: Date.now(),
    };
    
    set((state: any) => ({
      sessions: state.sessions.map((s: any) =>
        s.id === sessionId
          ? { 
              ...s, 
              sessionStats: newSessionStats,
              updatedAt: new Date().toISOString() 
            }
          : s
      ),
    }));
    
    console.log(`[UserPeticion] Created solicitud "${solicitudKey}" for character ${targetCharacterId}`);
    return newSolicitud;
  },

  /**
   * Accept a solicitud received by the user
   * Marks the solicitud as completed directly (no chat injection)
   */
  acceptUserSolicitud: (sessionId, solicitudId) => {
    const state = get();
    const sessions = state.sessions as Array<{ 
      id: string; 
      sessionStats?: SessionStats;
    }>;
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    
    if (sessionIndex === -1) return null;
    
    const session = sessions[sessionIndex];
    const sessionStats = session.sessionStats;
    
    // User's solicitudes are stored under '__user__'
    if (!sessionStats?.solicitudes?.characterSolicitudes?.['__user__']) {
      return null;
    }
    
    const solicitudes = sessionStats.solicitudes.characterSolicitudes['__user__'];
    const solicitudIndex = solicitudes.findIndex(
      s => s.id === solicitudId && s.status === 'pending'
    );
    
    if (solicitudIndex === -1) {
      console.log(`[UserSolicitud] No pending solicitud found with id "${solicitudId}"`);
      return null;
    }
    
    // Mark as completed
    const updatedSolicitudes = [...solicitudes];
    const completedSolicitud = {
      ...updatedSolicitudes[solicitudIndex],
      status: 'completed' as const,
      completedAt: Date.now(),
    };
    updatedSolicitudes[solicitudIndex] = completedSolicitud;
    
    const newSessionStats: SessionStats = {
      ...sessionStats,
      solicitudes: {
        characterSolicitudes: {
          ...sessionStats.solicitudes.characterSolicitudes,
          ['__user__']: updatedSolicitudes,
        },
        lastModified: Date.now(),
      },
      // Save event for {{eventos}} key - use completionDescription if available
      ultima_solicitud_completada: completedSolicitud.completionDescription || 
        `${completedSolicitud.fromCharacterName} recibió respuesta del usuario`,
      lastModified: Date.now(),
    };
    
    set((state: any) => ({
      sessions: state.sessions.map((s: any) =>
        s.id === sessionId
          ? { 
              ...s, 
              sessionStats: newSessionStats,
              updatedAt: new Date().toISOString() 
            }
          : s
      ),
    }));
    
    console.log(`[UserSolicitud] Accepted solicitud "${completedSolicitud.key}"`);
    return completedSolicitud;
  },

  /**
   * Reject a solicitud received by the user
   * Removes it from the list
   */
  rejectUserSolicitud: (sessionId, solicitudId) => {
    const state = get();
    const sessions = state.sessions as Array<{ 
      id: string; 
      sessionStats?: SessionStats;
    }>;
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    
    if (sessionIndex === -1) return false;
    
    const session = sessions[sessionIndex];
    const sessionStats = session.sessionStats;
    
    // User's solicitudes are stored under '__user__'
    if (!sessionStats?.solicitudes?.characterSolicitudes?.['__user__']) {
      return false;
    }
    
    const solicitudes = sessionStats.solicitudes.characterSolicitudes['__user__'];
    const solicitud = solicitudes.find(s => s.id === solicitudId);
    
    if (!solicitud) {
      return false;
    }
    
    // Remove from list (mark as rejected by filtering out)
    const updatedSolicitudes = solicitudes.filter(s => s.id !== solicitudId);
    
    const newSessionStats: SessionStats = {
      ...sessionStats,
      solicitudes: {
        characterSolicitudes: {
          ...sessionStats.solicitudes.characterSolicitudes,
          ['__user__']: updatedSolicitudes,
        },
        lastModified: Date.now(),
      },
      lastModified: Date.now(),
    };
    
    set((state: any) => ({
      sessions: state.sessions.map((s: any) =>
        s.id === sessionId
          ? { 
              ...s, 
              sessionStats: newSessionStats,
              updatedAt: new Date().toISOString() 
            }
          : s
      ),
    }));
    
    console.log(`[UserSolicitud] Rejected solicitud "${solicitud.key}"`);
    return true;
  },

  /**
   * Get pending solicitudes for the user
   */
  getPendingUserSolicitudes: (sessionId) => {
    const state = get();
    const sessions = state.sessions as Array<{ 
      id: string; 
      sessionStats?: SessionStats;
    }>;
    const session = sessions.find(s => s.id === sessionId);
    
    if (!session?.sessionStats?.solicitudes?.characterSolicitudes?.['__user__']) {
      return [];
    }
    
    return session.sessionStats.solicitudes.characterSolicitudes['__user__'].filter(
      s => s.status === 'pending'
    );
  },

  /**
   * Update session event (for {{eventos}} key)
   * Saves recent important events to session stats
   */
  updateSessionEvent: (sessionId, eventType, description) => {
    set((state: any) => {
      const sessions = state.sessions as Array<{ 
        id: string; 
        sessionStats?: SessionStats;
      }>;
      const sessionIndex = sessions.findIndex(s => s.id === sessionId);
      
      if (sessionIndex === -1) return state;
      
      const session = sessions[sessionIndex];
      let sessionStats = session.sessionStats;
      
      // Auto-initialize sessionStats if missing (includes event fields)
      if (!sessionStats) {
        sessionStats = {
          characterStats: {},
          solicitudes: {
            characterSolicitudes: {},
            lastModified: Date.now(),
          },
          ultimo_objetivo_completado: undefined,
          ultima_solicitud_completada: undefined,
          ultima_solicitud_realizada: undefined,
          ultima_accion_realizada: undefined,
          initialized: true,
          lastModified: Date.now(),
        };
      }
      
      // Update the specific event field
      const newSessionStats: SessionStats = {
        ...sessionStats,
        [eventType]: description,
        lastModified: Date.now(),
      };
      
      return {
        sessions: state.sessions.map((s: any) =>
          s.id === sessionId
            ? { 
                ...s, 
                sessionStats: newSessionStats,
                updatedAt: new Date().toISOString() 
              }
            : s
        ),
      };
    });
    
    console.log(`[SessionEvent] Updated ${eventType}: ${description}`);
  },
});

// ============================================
// Utility Functions for Requirements
// ============================================

/**
 * Evaluate a single requirement against current stats
 */
export function evaluateRequirement(
  requirement: StatRequirement,
  attributeValues: Record<string, number | string>
): boolean {
  const currentValue = attributeValues[requirement.attributeKey];
  
  if (currentValue === undefined) return false;
  
  const currentNum = typeof currentValue === 'number' ? currentValue : parseFloat(currentValue);
  const valueNum = typeof requirement.value === 'number' ? requirement.value : parseFloat(requirement.value);
  
  if (isNaN(currentNum) || isNaN(valueNum)) {
    // String comparison for non-numeric values
    const currentStr = String(currentValue);
    const valueStr = String(requirement.value);
    
    switch (requirement.operator) {
      case '==': return currentStr === valueStr;
      case '!=': return currentStr !== valueStr;
      default: return false;
    }
  }
  
  switch (requirement.operator) {
    case '<': return currentNum < valueNum;
    case '<=': return currentNum <= valueNum;
    case '>': return currentNum > valueNum;
    case '>=': return currentNum >= valueNum;
    case '==': return currentNum === valueNum;
    case '!=': return currentNum !== valueNum;
    case 'between':
      const maxNum = typeof requirement.valueMax === 'number' 
        ? requirement.valueMax 
        : parseFloat(requirement.valueMax?.toString() || '0');
      return currentNum >= valueNum && currentNum <= maxNum;
    default: return false;
  }
}

/**
 * Evaluate all requirements (AND logic)
 */
export function evaluateRequirements(
  requirements: StatRequirement[],
  attributeValues: Record<string, number | string>
): boolean {
  if (!requirements || requirements.length === 0) return true;
  return requirements.every(req => evaluateRequirement(req, attributeValues));
}

/**
 * Filter skills by requirements
 */
export function filterSkillsByRequirements(
  skills: SkillDefinition[],
  attributeValues: Record<string, number | string>
): SkillDefinition[] {
  return skills.filter(skill => evaluateRequirements(skill.requirements, attributeValues));
}

/**
 * Filter intentions by requirements
 */
export function filterIntentionsByRequirements(
  intentions: IntentionDefinition[],
  attributeValues: Record<string, number | string>
): IntentionDefinition[] {
  return intentions.filter(intention => evaluateRequirements(intention.requirements, attributeValues));
}

/**
 * Filter invitations by requirements
 */
export function filterInvitationsByRequirements(
  invitations: InvitationDefinition[],
  attributeValues: Record<string, number | string>
): InvitationDefinition[] {
  return invitations.filter(invitation => evaluateRequirements(invitation.requirements, attributeValues));
}
