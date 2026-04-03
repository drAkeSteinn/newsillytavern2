// ============================================
// Session Slice - Chat sessions and messages
// ============================================

import type { 
  ChatSession, 
  ChatMessage, 
  SessionStats, 
  CharacterSessionStats,
  SessionQuestInstance,
  QuestTemplate,
} from '@/types';
import { processMessageTemplate } from '@/lib/prompt-template';
import { uuidv4 } from '@/lib/uuid';

// ============================================
// Helper Functions for Session Stats
// ============================================

/**
 * Create default character stats from statsConfig
 */
function createDefaultCharacterStats(
  statsConfig?: { enabled?: boolean; attributes?: Array<{ key: string; defaultValue: number | string }> }
): CharacterSessionStats {
  const attributeValues: Record<string, number | string> = {};
  const lastUpdated: Record<string, number> = {};
  const now = Date.now();
  
  if (statsConfig?.enabled && statsConfig.attributes) {
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
 * Initialize session stats for a character or group of characters
 * Resets all stats, solicitudes, and session events to default values
 */
function initializeSessionStatsForCharacters(
  characters: Array<{ id: string; statsConfig?: { enabled?: boolean; attributes?: Array<{ key: string; defaultValue: number | string }> } }>
): SessionStats {
  const now = Date.now();
  const characterStats: Record<string, CharacterSessionStats> = {};
  
  for (const char of characters) {
    characterStats[char.id] = createDefaultCharacterStats(char.statsConfig);
  }
  
  return {
    characterStats,
    solicitudes: {
      characterSolicitudes: {},
      lastModified: now,
    },
    // Reset session events to undefined (clean state)
    ultimo_objetivo_completado: undefined,
    ultima_solicitud_completada: undefined,
    ultima_solicitud_realizada: undefined,
    ultima_accion_realizada: undefined,
    initialized: true,
    lastModified: now,
  };
}

// ============================================
// Quest Instance Helpers
// ============================================

/**
 * Create quest instances from templates
 * Creates 'available' status quests (not yet activated)
 */
function createQuestInstancesFromTemplates(
  templates: QuestTemplate[]
): SessionQuestInstance[] {
  return templates.map(template => ({
    templateId: template.id,
    status: 'available' as const,
    objectives: template.objectives.map(obj => ({
      templateId: obj.id,
      currentCount: 0,
      isCompleted: false,
    })),
    progress: 0,
    activatedAt: undefined,
    completedAt: undefined,
    activatedAtTurn: undefined,
  }));
}

/**
 * Calculate quest progress from objectives
 */
function calculateQuestProgress(objectives: Array<{ templateId: string; currentCount: number; isCompleted: boolean } & { isOptional?: boolean }>): number {
  if (!objectives || objectives.length === 0) return 0;
  
  const requiredObjectives = objectives.filter(o => !o.isOptional);
  
  if (requiredObjectives.length === 0) return 100;
  
  const completedCount = requiredObjectives.filter(o => o.isCompleted).length;
  return Math.round((completedCount / requiredObjectives.length) * 100);
}

export interface SessionSlice {
  // State
  sessions: ChatSession[];
  activeSessionId: string | null;

  // Session Actions
  createSession: (characterId: string, groupId?: string) => string;
  updateSession: (id: string, updates: Partial<ChatSession>) => void;
  deleteSession: (id: string) => void;
  setActiveSession: (id: string | null) => void;
  resetSessionStats: (sessionId: string) => void;
  clearChat: (sessionId: string) => void;

  // Message Actions
  addMessage: (sessionId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  updateMessage: (sessionId: string, messageId: string, content: string) => void;
  deleteMessage: (sessionId: string, messageId: string) => void;
  deleteMessagesUpTo: (sessionId: string, keepLastN: number) => void;  // Delete old messages, keep last N
  
  // Swipe Actions
  swipeMessage: (sessionId: string, messageId: string, direction: 'left' | 'right') => number;
  addSwipeAlternative: (sessionId: string, messageId: string, content: string, metadata?: ChatMessage['metadata']) => void;
  setCurrentSwipe: (sessionId: string, messageId: string, swipeIndex: number) => void;
  getSwipeCount: (sessionId: string, messageId: string) => number;

  // Turn Management
  incrementTurnCount: (sessionId: string) => void;
  getTurnCount: (sessionId: string) => number;
  resetTurnCount: (sessionId: string) => void;
  
  // Summary Actions
  setSessionSummary: (sessionId: string, summary: import('@/types').SessionSummary) => void;
  clearSessionSummary: (sessionId: string) => void;

  // Quest Instance Actions
  initializeSessionQuests: (sessionId: string, questTemplateIds: string[]) => void;
  activateQuest: (sessionId: string, questTemplateId: string) => void;
  activateQuestFromTemplate: (sessionId: string, template: QuestTemplate) => void;  // NEW: Direct activation from template
  deactivateQuest: (sessionId: string, questTemplateId: string) => void;  // Deactivate quest back to available
  completeQuest: (sessionId: string, questTemplateId: string, characterId?: string) => void;
  failQuest: (sessionId: string, questTemplateId: string) => void;
  progressQuestObjective: (sessionId: string, questTemplateId: string, objectiveId: string, amount?: number, characterId?: string) => void;
  completeObjective: (sessionId: string, questTemplateId: string, objectiveId: string, characterId?: string) => void;
  toggleObjectiveCompletion: (sessionId: string, questTemplateId: string, objectiveId: string) => void;  // Toggle objective completion
  getSessionQuests: (sessionId: string) => SessionQuestInstance[];
  getActiveQuests: (sessionId: string) => SessionQuestInstance[];
  getAvailableQuests: (sessionId: string) => SessionQuestInstance[];
  clearSessionQuests: (sessionId: string) => void;

  // Utilities
  getActiveSession: () => ChatSession | undefined;
  getSessionById: (id: string) => ChatSession | undefined;
}

export const createSessionSlice = (set: any, get: any): SessionSlice => ({
  // Initial State
  sessions: [],
  activeSessionId: null,

  // Session Actions
  createSession: (characterId, groupId) => {
    const id = uuidv4();
    const character = get().getCharacterById(characterId);
    const activePersona = get().getActivePersona?.();
    const userName = activePersona?.name || 'User';

    // Process the first message with template variables
    const processedFirstMes = character
      ? processMessageTemplate(character.firstMes, character.name, userName)
      : '';

    const initialContent = processedFirstMes || '';
    
    // Initialize session stats
    let sessionStats: SessionStats | undefined;
    
    // Initialize session quests
    let sessionQuests: SessionQuestInstance[] = [];
    
    if (groupId) {
      // Group chat: initialize stats for all group members
      const group = get().getGroupById?.(groupId);
      if (group?.members) {
        const groupCharacters = group.members
          .map((m: any) => get().getCharacterById(m.characterId))
          .filter((c: any) => c !== undefined);
        sessionStats = initializeSessionStatsForCharacters(groupCharacters);
        
        // Group chat: ONLY use group's quest templates (not individual character quests)
        if (group.questTemplateIds && group.questTemplateIds.length > 0) {
          const templates = get().getTemplatesByIds?.(group.questTemplateIds) || [];
          if (templates.length > 0) {
            sessionQuests = createQuestInstancesFromTemplates(templates);
          }
        }
      }
    } else if (character) {
      // Single character chat
      sessionStats = initializeSessionStatsForCharacters([character]);
      
      // Individual chat: use character's quest templates
      if (character.questTemplateIds && character.questTemplateIds.length > 0) {
        const templates = get().getTemplatesByIds?.(character.questTemplateIds) || [];
        if (templates.length > 0) {
          sessionQuests = createQuestInstancesFromTemplates(templates);
        }
      }
    }
    
    set((state: any) => ({
      sessions: [...state.sessions, {
        id,
        characterId,
        groupId,
        name: character ? `Chat with ${character.name}` : 'New Chat',
        messages: character ? [{
          id: uuidv4(),
          characterId,
          role: 'assistant' as const,
          content: initialContent,
          timestamp: new Date().toISOString(),
          isDeleted: false,
          swipeId: uuidv4(),
          swipeIndex: 0,
          swipes: [initialContent]  // Initialize with first swipe
        }] : [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sessionStats,  // Include initialized session stats
        sessionQuests, // Include initialized session quests
        turnCount: 0   // Initialize turn counter
      }],
      activeSessionId: id,
      activeCharacterId: characterId,
      activeGroupId: groupId || null
    }));

    return id;
  },

  updateSession: (id, updates) => set((state: any) => ({
    sessions: state.sessions.map((s: ChatSession) =>
      s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
    )
  })),

  deleteSession: (id) => set((state: any) => ({
    sessions: state.sessions.filter((s: ChatSession) => s.id !== id),
    activeSessionId: state.activeSessionId === id ? null : state.activeSessionId
  })),

  setActiveSession: (id) => {
    const session = get().getSessionById(id);
    set({
      activeSessionId: id,
      activeCharacterId: session?.characterId || null,
      activeGroupId: session?.groupId || null
    });
  },

  resetSessionStats: (sessionId) => {
    const session = get().getSessionById(sessionId);
    if (!session) return;
    
    // Get characters for this session
    let characters: Array<{ id: string; statsConfig?: any }> = [];
    
    if (session.groupId) {
      // Group chat: get all group members
      const group = get().getGroupById?.(session.groupId);
      if (group?.members) {
        characters = group.members
          .map((m: any) => get().getCharacterById(m.characterId))
          .filter((c: any) => c !== undefined);
      }
    } else {
      // Single character chat
      const character = get().getCharacterById(session.characterId);
      if (character) {
        characters = [character];
      }
    }
    
    // Reset session stats to default values
    const newSessionStats = initializeSessionStatsForCharacters(characters);
    
    set((state: any) => ({
      sessions: state.sessions.map((s: ChatSession) =>
        s.id === sessionId ? { 
          ...s, 
          sessionStats: newSessionStats,
          updatedAt: new Date().toISOString() 
        } : s
      ),
    }));
  },

  clearChat: (sessionId) => {
    const session = get().getSessionById(sessionId);
    if (!session) return;
    
    // Get character for first message
    const character = get().getCharacterById(session.characterId);
    const activePersona = get().getActivePersona?.();
    const userName = activePersona?.name || 'User';
    
    // Process the first message with template variables
    const processedFirstMes = character
      ? processMessageTemplate(character.firstMes, character.name, userName)
      : '';
    
    // Get characters for stats reset
    let characters: Array<{ id: string; statsConfig?: any }> = [];
    
    if (session.groupId) {
      const group = get().getGroupById?.(session.groupId);
      if (group?.members) {
        characters = group.members
          .map((m: any) => get().getCharacterById(m.characterId))
          .filter((c: any) => c !== undefined);
      }
    } else {
      if (character) {
        characters = [character];
      }
    }
    
    // Reset session stats to default values
    const newSessionStats = initializeSessionStatsForCharacters(characters);
    
    // Reset session quests to template defaults
    let newSessionQuests: SessionQuestInstance[] = [];
    
    // Get quest template IDs from character or group
    if (session.groupId) {
      // Group chat: use group's quest templates
      const group = get().getGroupById?.(session.groupId);
      if (group?.questTemplateIds && group.questTemplateIds.length > 0) {
        const templates = get().getTemplatesByIds?.(group.questTemplateIds) || [];
        if (templates.length > 0) {
          newSessionQuests = createQuestInstancesFromTemplates(templates);
        }
      }
    } else if (character?.questTemplateIds && character.questTemplateIds.length > 0) {
      // Individual chat: use character's quest templates
      const templates = get().getTemplatesByIds?.(character.questTemplateIds) || [];
      if (templates.length > 0) {
        newSessionQuests = createQuestInstancesFromTemplates(templates);
      }
    }
    
    // Reset messages to only the first message
    const initialContent = processedFirstMes || '';
    
    set((state: any) => ({
      sessions: state.sessions.map((s: ChatSession) =>
        s.id === sessionId ? {
          ...s,
          messages: character ? [{
            id: uuidv4(),
            characterId: session.characterId,
            role: 'assistant' as const,
            content: initialContent,
            timestamp: new Date().toISOString(),
            isDeleted: false,
            swipeId: uuidv4(),
            swipeIndex: 0,
            swipes: [initialContent]
          }] : [],
          sessionStats: newSessionStats,
          sessionQuests: newSessionQuests,  // Reset quests to template defaults
          turnCount: 0,  // Reset turn counter
          updatedAt: new Date().toISOString()
        } : s
      ),
    }));
  },

  // Message Actions
  addMessage: (sessionId, message) => set((state: any) => {
    // Ensure swipes array is initialized
    const content = message.content || '';
    const swipes = message.swipes?.length ? message.swipes : [content];
    
    return {
      sessions: state.sessions.map((s: ChatSession) =>
        s.id === sessionId ? {
          ...s,
          messages: [...s.messages, {
            ...message,
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            content,
            swipes,
            swipeIndex: message.swipeIndex ?? 0
          }],
          updatedAt: new Date().toISOString()
        } : s
      )
    };
  }),

  updateMessage: (sessionId, messageId, content) => set((state: any) => ({
    sessions: state.sessions.map((s: ChatSession) =>
      s.id === sessionId ? {
        ...s,
        messages: s.messages.map((m: ChatMessage) =>
          m.id === messageId ? { 
            ...m, 
            content,
            // Also update the current swipe, or initialize swipes if missing
            swipes: m.swipes?.length 
              ? m.swipes.map((s, i) => i === (m.swipeIndex || 0) ? content : s)
              : [content]
          } : m
        ),
        updatedAt: new Date().toISOString()
      } : s
    )
  })),

  deleteMessage: (sessionId, messageId) => set((state: any) => ({
    sessions: state.sessions.map((s: ChatSession) =>
      s.id === sessionId ? {
        ...s,
        messages: s.messages.map((m: ChatMessage) =>
          m.id === messageId ? { ...m, isDeleted: true } : m
        ),
        updatedAt: new Date().toISOString()
      } : s
    )
  })),

  // Delete old messages, keeping the last N messages (for memory/summary system)
  deleteMessagesUpTo: (sessionId, keepLastN) => set((state: any) => ({
    sessions: state.sessions.map((s: ChatSession) => {
      if (s.id !== sessionId) return s;
      
      const visibleMessages = s.messages.filter((m: ChatMessage) => !m.isDeleted);
      const messagesToDelete = visibleMessages.length - keepLastN;
      
      if (messagesToDelete <= 0) return s; // Nothing to delete
      
      // Mark old messages as deleted (keep the first message and last N messages)
      const firstMessageId = s.messages[0]?.id;
      let deletedCount = 0;
      
      return {
        ...s,
        messages: s.messages.map((m: ChatMessage) => {
          // Never delete the first message (greeting)
          if (m.id === firstMessageId) return m;
          // Already deleted
          if (m.isDeleted) return m;
          // Check if we should delete this message
          if (deletedCount < messagesToDelete) {
            deletedCount++;
            return { ...m, isDeleted: true };
          }
          return m;
        }),
        updatedAt: new Date().toISOString()
      };
    })
  })),

  // Swipe Actions
  swipeMessage: (sessionId, messageId, direction) => {
    let newIndex = 0;
    
    set((state: any) => ({
      sessions: state.sessions.map((s: ChatSession) => {
        if (s.id !== sessionId) return s;
        return {
          ...s,
          messages: s.messages.map((m: ChatMessage) => {
            if (m.id !== messageId) return m;
            
            const maxIndex = (m.swipes?.length || 1) - 1;
            
            if (direction === 'right') {
              newIndex = Math.min(m.swipeIndex + 1, maxIndex);
            } else {
              newIndex = Math.max(0, m.swipeIndex - 1);
            }
            
            return { 
              ...m, 
              swipeIndex: newIndex,
              content: m.swipes?.[newIndex] || m.content
            };
          })
        };
      })
    }));
    
    return newIndex;
  },

  addSwipeAlternative: (sessionId, messageId, content, metadata) => set((state: any) => ({
    sessions: state.sessions.map((s: ChatSession) => {
      if (s.id !== sessionId) return s;
      return {
        ...s,
        messages: s.messages.map((m: ChatMessage) => {
          if (m.id !== messageId) return m;
          
          const swipes = [...(m.swipes || [m.content]), content];
          const newIndex = swipes.length - 1;
          
          return {
            ...m,
            swipes,
            swipeIndex: newIndex,
            content,
            metadata: metadata || m.metadata
          };
        }),
        updatedAt: new Date().toISOString()
      };
    })
  })),

  setCurrentSwipe: (sessionId, messageId, swipeIndex) => set((state: any) => ({
    sessions: state.sessions.map((s: ChatSession) => {
      if (s.id !== sessionId) return s;
      return {
        ...s,
        messages: s.messages.map((m: ChatMessage) => {
          if (m.id !== messageId) return m;
          if (swipeIndex < 0 || swipeIndex >= (m.swipes?.length || 1)) return m;
          
          return {
            ...m,
            swipeIndex,
            content: m.swipes?.[swipeIndex] || m.content
          };
        })
      };
    })
  })),

  getSwipeCount: (sessionId, messageId) => {
    const state = get();
    const session = state.sessions.find((s: ChatSession) => s.id === sessionId);
    if (!session) return 1;
    const message = session.messages.find((m: ChatMessage) => m.id === messageId);
    return message?.swipes?.length || 1;
  },

  // ============================================
  // Turn Management
  // ============================================

  incrementTurnCount: (sessionId) => set((state: any) => ({
    sessions: state.sessions.map((s: ChatSession) =>
      s.id === sessionId
        ? { ...s, turnCount: (s.turnCount || 0) + 1, updatedAt: new Date().toISOString() }
        : s
    ),
  })),

  getTurnCount: (sessionId) => {
    const session = get().sessions.find((s: ChatSession) => s.id === sessionId);
    return session?.turnCount || 0;
  },

  resetTurnCount: (sessionId) => set((state: any) => ({
    sessions: state.sessions.map((s: ChatSession) =>
      s.id === sessionId
        ? { ...s, turnCount: 0, updatedAt: new Date().toISOString() }
        : s
    ),
  })),

  // ============================================
  // Summary Actions
  // ============================================
  
  setSessionSummary: (sessionId, summary) => set((state: any) => ({
    sessions: state.sessions.map((s: ChatSession) =>
      s.id === sessionId
        ? { ...s, summary, updatedAt: new Date().toISOString() }
        : s
    ),
  })),

  clearSessionSummary: (sessionId) => set((state: any) => ({
    sessions: state.sessions.map((s: ChatSession) =>
      s.id === sessionId
        ? { ...s, summary: undefined, updatedAt: new Date().toISOString() }
        : s
    ),
  })),

  // ============================================
  // Quest Instance Actions
  // ============================================

  initializeSessionQuests: (sessionId, questTemplateIds) => {
    // Get templates from quest template slice
    const templates = get().getTemplatesByIds?.(questTemplateIds) || [];
    
    if (templates.length === 0) return;
    
    // Create instances from templates
    const questInstances = createQuestInstancesFromTemplates(templates);
    
    set((state: any) => ({
      sessions: state.sessions.map((s: ChatSession) =>
        s.id === sessionId
          ? { ...s, sessionQuests: questInstances, updatedAt: new Date().toISOString() }
          : s
      ),
    }));
  },

  activateQuest: (sessionId, questTemplateId) => {
    // Get template to check prerequisites
    const template = get().getTemplateById?.(questTemplateId);
    
    if (template?.prerequisites && template.prerequisites.length > 0) {
      const session = get().sessions.find((s: ChatSession) => s.id === sessionId);
      const completedQuestIds = (session?.sessionQuests || [])
        .filter(q => q.status === 'completed')
        .map(q => q.templateId);
      
      const hasAllPrereqs = template.prerequisites.every(prereqId => 
        completedQuestIds.includes(prereqId)
      );
      
      if (!hasAllPrereqs) {
        console.warn(`[Quest] Cannot activate "${template.name}": missing prerequisites. Required: ${template.prerequisites.join(', ')}`);
        return; // Don't activate - missing prerequisites
      }
    }
    
    set((state: any) => ({
      sessions: state.sessions.map((s: ChatSession) => {
        if (s.id !== sessionId) return s;
        
        const turnCount = s.turnCount || 0;
        
        return {
          ...s,
          sessionQuests: (s.sessionQuests || []).map((q: SessionQuestInstance) =>
            q.templateId === questTemplateId && q.status === 'available'
              ? {
                  ...q,
                  status: 'active' as const,
                  activatedAt: new Date().toISOString(),
                  activatedAtTurn: turnCount,
                }
              : q
          ),
          updatedAt: new Date().toISOString(),
        };
      }),
    }));
    
    // Add notification for quest activation
    if (template) {
      get().addQuestNotification?.({
        questId: questTemplateId,
        questTitle: template.name,
        type: 'quest_activated',
        message: `¡Nueva misión activada: ${template.name}!`,
      });
    }
  },

  deactivateQuest: (sessionId, questTemplateId) => {
    // Get template for notification
    const template = get().getTemplateById?.(questTemplateId);
    
    set((state: any) => ({
      sessions: state.sessions.map((s: ChatSession) => {
        if (s.id !== sessionId) return s;
        
        return {
          ...s,
          sessionQuests: (s.sessionQuests || []).map((q: SessionQuestInstance) =>
            q.templateId === questTemplateId && q.status === 'active'
              ? {
                  ...q,
                  status: 'available' as const,
                  activatedAt: undefined,
                  activatedAtTurn: undefined,
                  // Reset objective progress
                  objectives: q.objectives.map(obj => ({
                    ...obj,
                    currentCount: 0,
                    isCompleted: false,
                  })),
                  progress: 0,
                }
              : q
          ),
          updatedAt: new Date().toISOString(),
        };
      }),
    }));
    
    // Add notification for quest deactivation
    if (template) {
      get().addQuestNotification?.({
        questId: questTemplateId,
        questTitle: template.name,
        type: 'quest_updated',
        message: `Misión desactivada: ${template.name}`,
      });
    }
  },

  completeQuest: (sessionId, questTemplateId, characterId) => {
    // Get the template to check for chain
    const template = get().getTemplateById?.(questTemplateId);
    
    set((state: any) => ({
      sessions: state.sessions.map((s: ChatSession) => {
        if (s.id !== sessionId) return s;
        
        return {
          ...s,
          sessionQuests: (s.sessionQuests || []).map((q: SessionQuestInstance) =>
            q.templateId === questTemplateId
              ? {
                  ...q,
                  status: 'completed' as const,
                  completedAt: new Date().toISOString(),
                  completedBy: characterId,
                  progress: 100,
                }
              : q
          ),
          updatedAt: new Date().toISOString(),
        };
      }),
    }));
    
    // Handle quest chain - activate next quest if autoStart is enabled
    if (template?.chain && template.chain.type !== 'none' && template.chain.autoStart) {
      const nextQuestId = template.chain.type === 'specific' 
        ? template.chain.nextQuestId 
        : template.chain.type === 'random' && template.chain.randomPool?.length
          ? template.chain.randomPool[Math.floor(Math.random() * template.chain.randomPool.length)]
          : null;
      
      if (nextQuestId) {
        // Check if next quest exists in session quests
        const session = get().sessions.find((s: ChatSession) => s.id === sessionId);
        const nextQuestInstance = session?.sessionQuests?.find(q => q.templateId === nextQuestId);
        
        if (nextQuestInstance) {
          // Activate existing quest instance
          console.log(`[Quest Chain] Auto-starting next quest: ${nextQuestId}`);
          get().activateQuest(sessionId, nextQuestId);
        } else {
          // Create and activate new quest instance from template
          const nextTemplate = get().getTemplateById?.(nextQuestId);
          if (nextTemplate) {
            console.log(`[Quest Chain] Creating and activating new quest: ${nextQuestId}`);
            get().activateQuestFromTemplate?.(sessionId, nextTemplate);
          }
        }
      }
    }
    
    // Add completion notification
    if (template) {
      get().addQuestNotification?.({
        questId: questTemplateId,
        questTitle: template.name,
        type: 'quest_complete',
        message: `¡Misión completada: ${template.name}!`,
        rewards: template.rewards,
      });
    }
  },

  failQuest: (sessionId, questTemplateId) => set((state: any) => ({
    sessions: state.sessions.map((s: ChatSession) => {
      if (s.id !== sessionId) return s;
      
      return {
        ...s,
        sessionQuests: (s.sessionQuests || []).map((q: SessionQuestInstance) =>
          q.templateId === questTemplateId
            ? { ...q, status: 'failed' as const, updatedAt: new Date().toISOString() }
            : q
        ),
        updatedAt: new Date().toISOString(),
      };
    }),
  })),

  progressQuestObjective: (sessionId, questTemplateId, objectiveId, amount = 1, characterId?: string) => {
    // Get the template to find target count
    const template = get().getTemplateById?.(questTemplateId);
    const targetObjective = template?.objectives.find(o => o.id === objectiveId);
    const targetCount = targetObjective?.targetCount || 1;
    
    set((state: any) => ({
      sessions: state.sessions.map((s: ChatSession) => {
        if (s.id !== sessionId) return s;
        
        return {
          ...s,
          sessionQuests: (s.sessionQuests || []).map((q: SessionQuestInstance) => {
            if (q.templateId !== questTemplateId) return q;
            
            const updatedObjectives = q.objectives.map((o) => {
              if (o.templateId !== objectiveId) return o;
              
              const newCount = Math.min((o.currentCount || 0) + amount, targetCount);
              const isNowCompleted = newCount >= targetCount;
              
              return {
                ...o,
                currentCount: newCount,
                isCompleted: isNowCompleted,
              };
            });
            
            const newProgress = calculateQuestProgress(updatedObjectives);
            
            // Only check non-optional objectives for auto-completion
            const requiredObjectives = updatedObjectives.filter(o => {
              const objTemplate = template?.objectives.find(ot => ot.id === o.templateId);
              return !objTemplate?.isOptional;
            });
            const allRequiredCompleted = requiredObjectives.length === 0 || 
              requiredObjectives.every(o => o.isCompleted);
            
            return {
              ...q,
              objectives: updatedObjectives,
              progress: newProgress,
              // Auto-complete quest if all REQUIRED objectives are done
              ...(allRequiredCompleted && {
                status: 'completed' as const,
                completedAt: new Date().toISOString(),
                completedBy: characterId,
              }),
            };
          }),
          updatedAt: new Date().toISOString(),
        };
      }),
    }));
    
    // Add notification if objective completed
    const session = get().sessions.find((s: ChatSession) => s.id === sessionId);
    const quest = session?.sessionQuests?.find((q: SessionQuestInstance) => q.templateId === questTemplateId);
    const objective = quest?.objectives.find(o => o.templateId === objectiveId);
    
    if (objective?.isCompleted && template) {
      get().addQuestNotification?.({
        questId: questTemplateId,
        questTitle: template.name,
        type: 'objective_complete',
        message: `Objetivo completado: ${targetObjective?.description}`,
      });
    }
  },

  getSessionQuests: (sessionId) => {
    const session = get().sessions.find((s: ChatSession) => s.id === sessionId);
    return session?.sessionQuests || [];
  },

  completeObjective: (sessionId, questTemplateId, objectiveId, characterId) => {
    const template = get().getTemplateById?.(questTemplateId);
    const targetObjective = template?.objectives.find(o => o.id === objectiveId);
    const targetCount = targetObjective?.targetCount || 1;
    
    set((state: any) => ({
      sessions: state.sessions.map((s: ChatSession) => {
        if (s.id !== sessionId) return s;
        
        return {
          ...s,
          sessionQuests: (s.sessionQuests || []).map((q: SessionQuestInstance) => {
            if (q.templateId !== questTemplateId) return q;
            
            const updatedObjectives = q.objectives.map((o) => {
              if (o.templateId !== objectiveId) return o;
              
              return {
                ...o,
                currentCount: targetCount,
                isCompleted: true,
              };
            });
            
            const newProgress = calculateQuestProgress(updatedObjectives);
            
            // Only check non-optional objectives for auto-completion
            const requiredObjectives = updatedObjectives.filter(o => {
              const objTemplate = template?.objectives.find(ot => ot.id === o.templateId);
              return !objTemplate?.isOptional;
            });
            const allRequiredCompleted = requiredObjectives.length === 0 || 
              requiredObjectives.every(o => o.isCompleted);
            
            return {
              ...q,
              objectives: updatedObjectives,
              progress: newProgress,
              // Auto-complete quest if all REQUIRED objectives are done
              ...(allRequiredCompleted && {
                status: 'completed' as const,
                completedAt: new Date().toISOString(),
                completedBy: characterId,
              }),
            };
          }),
          // Save event to sessionStats for {{eventos}} key
          sessionStats: s.sessionStats ? {
            ...s.sessionStats,
            ultimo_objetivo_completado: targetObjective?.completionDescription || targetObjective?.description,
            lastModified: Date.now(),
          } : s.sessionStats,
          updatedAt: new Date().toISOString(),
        };
      }),
    }));
    
    // Add notification
    if (template && targetObjective) {
      get().addQuestNotification?.({
        questId: questTemplateId,
        questTitle: template.name,
        type: 'objective_complete',
        message: `Objetivo completado: ${targetObjective.description}`,
      });
    }
  },

  // Toggle objective completion (complete/uncomplete)
  toggleObjectiveCompletion: (sessionId, questTemplateId, objectiveId) => {
    const template = get().getTemplateById?.(questTemplateId);
    const targetObjective = template?.objectives.find(o => o.id === objectiveId);
    const targetCount = targetObjective?.targetCount || 1;
    
    set((state: any) => ({
      sessions: state.sessions.map((s: ChatSession) => {
        if (s.id !== sessionId) return s;
        
        return {
          ...s,
          sessionQuests: (s.sessionQuests || []).map((q: SessionQuestInstance) => {
            if (q.templateId !== questTemplateId) return q;
            
            // Find current objective state
            const currentObjective = q.objectives.find(o => o.templateId === objectiveId);
            if (!currentObjective) return q;
            
            // Toggle the completion status
            const newCompletedState = !currentObjective.isCompleted;
            
            const updatedObjectives = q.objectives.map((o) => {
              if (o.templateId !== objectiveId) return o;
              
              return {
                ...o,
                currentCount: newCompletedState ? targetCount : 0,
                isCompleted: newCompletedState,
              };
            });
            
            const newProgress = calculateQuestProgress(updatedObjectives);
            const allCompleted = updatedObjectives.every(o => o.isCompleted);
            
            return {
              ...q,
              objectives: updatedObjectives,
              progress: newProgress,
              // Auto-complete quest if all objectives are done AND quest was active
              ...(allCompleted && q.status === 'active' && {
                status: 'completed' as const,
                completedAt: new Date().toISOString(),
              }),
              // If uncompleting an objective and quest was completed, set back to active
              ...(!newCompletedState && q.status === 'completed' && {
                status: 'active' as const,
                completedAt: undefined,
              }),
            };
          }),
          updatedAt: new Date().toISOString(),
        };
      }),
    }));
  },

  getActiveQuests: (sessionId) => {
    const session = get().sessions.find((s: ChatSession) => s.id === sessionId);
    return (session?.sessionQuests || []).filter((q: SessionQuestInstance) => q.status === 'active');
  },

  getAvailableQuests: (sessionId) => {
    const session = get().sessions.find((s: ChatSession) => s.id === sessionId);
    return (session?.sessionQuests || []).filter((q: SessionQuestInstance) => q.status === 'available');
  },

  clearSessionQuests: (sessionId) => set((state: any) => ({
    sessions: state.sessions.map((s: ChatSession) =>
      s.id === sessionId
        ? { ...s, sessionQuests: [], updatedAt: new Date().toISOString() }
        : s
    ),
  })),

  // NEW: Activate quest directly from template (creates instance if needed)
  activateQuestFromTemplate: (sessionId, template) => {
    const session = get().sessions.find((s: ChatSession) => s.id === sessionId);
    if (!session) return;

    const turnCount = session.turnCount || 0;
    const existingQuest = (session.sessionQuests || []).find(
      (q: SessionQuestInstance) => q.templateId === template.id
    );

    if (existingQuest) {
      // Quest already exists, just activate it if available
      if (existingQuest.status === 'available') {
        set((state: any) => ({
          sessions: state.sessions.map((s: ChatSession) =>
            s.id === sessionId
              ? {
                  ...s,
                  sessionQuests: (s.sessionQuests || []).map((q: SessionQuestInstance) =>
                    q.templateId === template.id
                      ? {
                          ...q,
                          status: 'active' as const,
                          activatedAt: new Date().toISOString(),
                          activatedAtTurn: turnCount,
                        }
                      : q
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : s
          ),
        }));
      }
    } else {
      // Create new instance and activate it
      const newQuest: SessionQuestInstance = {
        templateId: template.id,
        status: 'active',
        objectives: template.objectives.map(obj => ({
          templateId: obj.id,
          currentCount: 0,
          isCompleted: false,
        })),
        progress: 0,
        activatedAt: new Date().toISOString(),
        activatedAtTurn: turnCount,
      };

      set((state: any) => ({
        sessions: state.sessions.map((s: ChatSession) =>
          s.id === sessionId
            ? {
                ...s,
                sessionQuests: [...(s.sessionQuests || []), newQuest],
                updatedAt: new Date().toISOString(),
              }
            : s
        ),
      }));
    }

    // Add notification using quest slice
    get().addQuestNotification?.({
      questId: template.id,
      questTitle: template.name,
      type: 'started',
      message: `Nueva misión iniciada: ${template.name}`,
    });
  },

  // ============================================
  // Utilities
  // ============================================

  getActiveSession: () => {
    const state = get();
    return state.sessions.find((s: ChatSession) => s.id === state.activeSessionId);
  },

  getSessionById: (id) => get().sessions.find((s: ChatSession) => s.id === id),
});
