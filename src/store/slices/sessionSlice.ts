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
  CharacterCard,
} from '@/types';
import { processMessageTemplate } from '@/lib/prompt-template';
import { uuidv4 } from '@/lib/uuid';
import {
  executeObjectiveRewards,
  executeQuestCompletionRewards,
  executeAllRewards,
  type RewardExecutionContext,
  type RewardStoreActions,
} from '@/lib/quest/quest-reward-executor';
import type { ActivationCost, QuestReward } from '@/types';

// ============================================
// Quest Reward Execution Guard
// ============================================

// Prevents infinite recursion when reward chains reference each other
// e.g., Objective A reward completes Objective B, whose reward completes Objective A
const _processingCompletions = new Set<string>();

// ============================================
// Shared Objective Key Matching
// ============================================
// Unified matching logic for all paths (tool, POST-LLM, cascading rewards).
// Matches: exact, case-insensitive, prefix ("obj-" + key), partial substring.

function objectiveKeyMatches(completionKey: string, searchKey: string): boolean {
  if (!completionKey || !searchKey) return false;
  // Exact match
  if (completionKey === searchKey) return true;
  // Case-insensitive
  const ck = completionKey.toLowerCase();
  const sk = searchKey.toLowerCase();
  if (ck === sk) return true;
  // Prefix match (e.g. completion key = "obj-troncos_abedul", search = "troncos_abedul")
  if (ck === `obj-${sk}`) return true;
  // Partial substring match (fallback)
  if (ck.includes(sk) || sk.includes(ck)) return true;
  return false;
}

/**
 * Shared logic to find and complete an objective by completion key.
 * Used by activateSkillByTool and executeCompletionRewards closures.
 * Returns true if the objective was found and completed, false otherwise.
 */
function findAndCompleteObjectiveByKey(
  get: () => any,
  sessionId: string,
  questId: string,
  objectiveKey: string,
  characterId: string,
): boolean {
  const session = get().sessions.find((s: ChatSession) => s.id === sessionId);
  if (!session) {
    console.warn(`[findAndCompleteObjectiveByKey] Session not found: ${sessionId}`);
    return false;
  }

  const templates = get().questTemplates || [];
  const sessionQuests = session.sessionQuests || [];

  console.log(`[findAndCompleteObjectiveByKey] Searching for objective key "${objectiveKey}" in quest ${questId || '(any)'}, session=${sessionId}`);
  console.log(`[findAndCompleteObjectiveByKey] Active quests in session:`, sessionQuests.map(q => `${q.templateId} (${q.status})`).join(', '));

  // Phase 1: Search with questId filter (if provided)
  for (const quest of sessionQuests) {
    if (quest.status !== 'active' && quest.status !== 'available') continue;
    if (questId && quest.templateId !== questId) continue;

    const tmpl = templates.find((t: QuestTemplate) => t.id === quest.templateId);
    if (!tmpl) {
      console.warn(`[findAndCompleteObjectiveByKey] Template "${quest.templateId}" not found in store. Available templates:`, templates.map(t => t.id).join(', '));
      continue;
    }

    if (tryCompleteObjectiveInQuest(get, sessionId, quest, tmpl, objectiveKey, characterId)) {
      return true;
    }
  }

  // Phase 2: Fallback — search ALL active quests (in case questId is stale/wrong)
  if (questId) {
    console.log(`[findAndCompleteObjectiveByKey] QuestId "${questId}" filter didn't match. Retrying without filter...`);
    for (const quest of sessionQuests) {
      if (quest.status !== 'active' && quest.status !== 'available') continue;

      const tmpl = templates.find((t: QuestTemplate) => t.id === quest.templateId);
      if (!tmpl) continue;

      if (tryCompleteObjectiveInQuest(get, sessionId, quest, tmpl, objectiveKey, characterId)) {
        console.log(`[findAndCompleteObjectiveByKey] Found objective in fallback search (quest ${quest.templateId} instead of ${questId})`);
        return true;
      }
    }
  }

  console.warn(`[findAndCompleteObjectiveByKey] No active objective found with key "${objectiveKey}" in any active quest`);
  return false;
}

function tryCompleteObjectiveInQuest(
  get: () => any,
  sessionId: string,
  quest: SessionQuestInstance,
  template: QuestTemplate,
  objectiveKey: string,
  characterId: string,
): boolean {
  for (const obj of template.objectives || []) {
    const completionKeys = [
      obj.completion?.key,
      ...(obj.completion?.keys || []),
    ].filter(Boolean);

    const matched = completionKeys.some((k: string) => objectiveKeyMatches(k, objectiveKey));
    if (!matched) continue;

    // Check if already completed in session
    const sessionObj = quest.objectives?.find((o: any) => o.templateId === obj.id);
    if (sessionObj?.isCompleted) {
      console.log(`[findAndCompleteObjectiveByKey] Objective "${obj.description || objectiveKey}" already completed, skipping.`);
      return true; // Return true so caller doesn't keep searching
    }

    console.log(`[findAndCompleteObjectiveByKey] ✓ Found matching objective "${obj.description || objectiveKey}" in quest "${template.name}" (${quest.templateId})`);
    // Use progressQuestObjective (same path quest-detector uses)
    get().progressQuestObjective?.(sessionId, quest.templateId, obj.id, 999, characterId);
    return true;
  }
  return false;
}

/**
 * Execute rewards after objective or quest completion.
 * Called from store functions to ensure rewards run for ALL callers (UI, trigger system, tools).
 * 
 * Flow:
 * 1. Execute objective rewards (if objectiveId provided)
 * 2. Check if quest auto-completed → execute quest rewards
 */
function executeCompletionRewards(
  get: () => any,
  sessionId: string,
  questTemplateId: string,
  objectiveId?: string,
  characterId?: string,
): void {
  const guardKey = objectiveId 
    ? `${sessionId}:${questTemplateId}:${objectiveId}`
    : `${sessionId}:${questTemplateId}:QUEST`;
  
  if (_processingCompletions.has(guardKey)) {
    console.log(`[Quest Rewards] Skipping (already processing): ${guardKey}`);
    return;
  }
  _processingCompletions.add(guardKey);
  
  try {
    const session = get().sessions.find((s: ChatSession) => s.id === sessionId);
    if (!session) return;
    
    const template = get().getTemplateById?.(questTemplateId);
    if (!template) return;
    
    const resolvedCharacterId = characterId || session.characterId || '';
    const character = get().getCharacterById?.(resolvedCharacterId);
    
    // Build allCharacters for group chat
    let allCharacters: CharacterCard[] = [];
    if (session.groupId) {
      const group = get().getGroupById?.(session.groupId);
      if (group?.members) {
        allCharacters = group.members
          .map((m: any) => get().getCharacterById(m.characterId))
          .filter((c: any): c is CharacterCard => c !== undefined);
      }
    } else if (character) {
      allCharacters = [character];
    }
    
    const context: RewardExecutionContext = {
      sessionId,
      characterId: resolvedCharacterId,
      character,
      allCharacters,
      sessionStats: session.sessionStats,
      timestamp: Date.now(),
      soundCollections: get().soundCollections,
      soundTriggers: get().soundTriggers,
      soundSequenceTriggers: get().soundSequenceTriggers,
      backgroundPacks: get().backgroundTriggerPacks,
      soundSettings: {
        enabled: get().settings?.sound?.enabled ?? false,
        globalVolume: get().settings?.sound?.globalVolume ?? 0.85,
      },
      backgroundSettings: {
        transitionDuration: get().settings?.backgroundTriggers?.transitionDuration ?? 500,
        defaultTransitionType: get().settings?.backgroundTriggers?.defaultTransitionType ?? 'fade',
      },
    };
    
    const actions: RewardStoreActions = {
      updateCharacterStat: (sid: string, cid: string, key: string, value: number | string, reason?: string) => {
        get().updateCharacterStat?.(sid, cid, key, value, reason as any);
      },
      // Allow chained objective rewards (objective reward that completes another objective)
      completeQuestObjective: (sid: string, qid: string, objKey: string, cid?: string) => {
        return findAndCompleteObjectiveByKey(get, sid, qid || '', objKey, cid || resolvedCharacterId);
      },
      // Allow solicitud rewards from quest objectives
      completeSolicitud: (sid: string, cid: string, solicitudKey: string) => {
        return get().completeSolicitud?.(sid, cid, solicitudKey) || null;
      },
      applyTriggerForCharacter: (cid: string, hit: any) => {
        get().applyTriggerForCharacter?.(cid, hit);
      },
      scheduleReturnToIdleForCharacter: (cid: string, triggerSpriteUrl: string, returnToMode: any, returnSpriteUrl: string, returnSpriteLabel: string | null, returnToIdleMs: number) => {
        get().scheduleReturnToIdleForCharacter?.(cid, triggerSpriteUrl, returnToMode, returnSpriteUrl, returnSpriteLabel, returnToIdleMs);
      },
      isSpriteLocked: () => get().isSpriteLocked?.() ?? false,
      playSound: (collection: string, filename: string, volume?: number) => {
        get().playSound?.(collection, filename, volume);
      },
      setBackground: (url: string) => {
        get().setBackground?.(url);
      },
      setActiveOverlays: (overlays: any) => {
        get().setActiveOverlays?.(overlays);
      },
    };
    
    // Step 1: Execute objective rewards (if an objective was completed)
    if (objectiveId) {
      const targetObjective = template.objectives.find((o: any) => o.id === objectiveId);
      if (targetObjective?.rewards && targetObjective.rewards.length > 0) {
        console.log(`[Quest Rewards] Executing ${targetObjective.rewards.length} objective rewards for "${targetObjective.description}"`);
        const objResult = executeObjectiveRewards(targetObjective.rewards, context, actions);
        console.log(`[Quest Rewards] Objective rewards: ${objResult.successCount} succeeded, ${objResult.failureCount} failed`);
        
        // Add notification with objective reward details
        if (objResult.successCount > 0 && get().questSettings?.showNotifications) {
          const rewardMessages = objResult.results
            .filter((r: any) => r.success)
            .map((r: any) => r.message)
            .filter(Boolean);
          if (rewardMessages.length > 0) {
            get().addQuestNotification?.({
              questId: questTemplateId,
              questTitle: template.name,
              type: 'objective_complete',
              message: `Objetivo completado: ${targetObjective.description}. Recompensas: ${rewardMessages.join(', ')}`,
              rewards: targetObjective.rewards,
            } as any);
          }
        }
      }
    }
    
    // Step 2: Check if quest was auto-completed → execute quest rewards
    const updatedSession = get().sessions.find((s: ChatSession) => s.id === sessionId);
    const updatedQuest = updatedSession?.sessionQuests?.find(
      (q: SessionQuestInstance) => q.templateId === questTemplateId
    );
    
    if (updatedQuest?.status === 'completed' && template.rewards && template.rewards.length > 0) {
      console.log(`[Quest Rewards] Quest "${template.name}" completed! Executing ${template.rewards.length} quest rewards`);
      const questResult = executeQuestCompletionRewards(template, context, actions);
      console.log(`[Quest Rewards] Quest rewards: ${questResult.successCount} succeeded, ${questResult.failureCount} failed`);
      
      // Add detailed notification with quest reward info
      if (questResult.successCount > 0 && get().questSettings?.showNotifications) {
        const rewardMessages = questResult.results
          .filter((r: any) => r.success)
          .map((r: any) => r.message)
          .filter(Boolean);
        if (rewardMessages.length > 0) {
          get().addQuestNotification?.({
            questId: questTemplateId,
            questTitle: template.name,
            type: 'quest_complete',
            message: `¡Misión completada: ${template.name}! Recompensas: ${rewardMessages.join(', ')}`,
            rewards: template.rewards,
          } as any);
        }
      }
    }
  } catch (err) {
    console.error('[Quest Rewards] Error executing completion rewards:', err);
  } finally {
    _processingCompletions.delete(guardKey);
  }
}

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
  activateSkillByTool: (sessionId: string, characterId: string, skillName: string, skillDescription: string, activationCosts: ActivationCost[], activationRewards: QuestReward[]) => void;
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
  createSession: async (characterId, groupId) => {
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
    let memberIds: string[] = [];
    let memberNames: string[] = [];
    
    if (groupId) {
      // Group chat: initialize stats for all group members
      const group = get().getGroupById?.(groupId);
      if (group?.members) {
        const groupCharacters = group.members
          .map((m: any) => get().getCharacterById(m.characterId))
          .filter((c: any) => c !== undefined);
        sessionStats = initializeSessionStatsForCharacters(groupCharacters);
        
        // Collect member IDs and names for namespace creation
        memberIds = groupCharacters.map((c: any) => c.id);
        memberNames = groupCharacters.map((c: any) => c.name);
        
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

    // Also add persona's stats as __user__ entry
    if (activePersona?.statsConfig?.enabled && activePersona.statsConfig.attributes?.length > 0) {
      const personaStats = createDefaultCharacterStats(activePersona.statsConfig);
      if (sessionStats) {
        sessionStats = {
          ...sessionStats,
          characterStats: {
            ...sessionStats.characterStats,
            '__user__': personaStats,
          },
        };
      } else {
        sessionStats = {
          characterStats: { '__user__': personaStats },
          solicitudes: {
            characterSolicitudes: {},
            lastModified: Date.now(),
          },
          initialized: true,
          lastModified: Date.now(),
        };
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

    // Create memory namespaces for this session (async, don't wait)
    try {
      await fetch('/api/embeddings/ensure-namespace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId,
          characterName: character?.name || '',
          groupId,
          groupName: groupId ? get().getGroupById?.(groupId)?.name : undefined,
          memberIds,
          memberNames,
          sessionId: id,
        }),
      });
      console.log(`[Session] Created memory namespaces for session ${id}`);
    } catch (err) {
      console.warn('[Session] Failed to create memory namespaces:', err);
    }

    return id;
  },

  updateSession: (id, updates) => set((state: any) => ({
    sessions: state.sessions.map((s: ChatSession) =>
      s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
    )
  })),

  deleteSession: async (id) => {
    // Get session info before deleting
    const session = get().getSessionById(id);
    const characterId = session?.characterId;
    const groupId = session?.groupId;

    // Delete from state
    set((state: any) => ({
      sessions: state.sessions.filter((s: ChatSession) => s.id !== id),
      activeSessionId: state.activeSessionId === id ? null : state.activeSessionId
    }));

    // Delete memory namespaces and their embeddings (async, don't wait)
    if (session) {
      try {
        // For group sessions, collect member IDs so individual character namespaces are also deleted
        let memberIds: string[] | undefined;
        if (groupId) {
          const group = get().getGroupById?.(groupId);
          if (group?.members) {
            memberIds = group.members
              .map((m: any) => m.characterId)
              .filter((id: string) => !!id);
          }
        }

        await fetch('/api/embeddings/delete-session-namespaces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            characterId,
            groupId,
            sessionId: id,
            memberIds,
          }),
        });
        console.log(`[Session] Deleted memory namespaces for session ${id}`);
      } catch (err) {
        console.warn('[Session] Failed to delete memory namespaces:', err);
      }
    }
  },

  setActiveSession: async (id) => {
    const session = get().getSessionById(id);
    set({
      activeSessionId: id,
      activeCharacterId: session?.characterId || null,
      activeGroupId: session?.groupId || null
    });

    // Ensure memory namespaces exist for this session (async, don't wait)
    if (session) {
      try {
        let memberIds: string[] = [];
        let memberNames: string[] = [];
        
        if (session.groupId) {
          // Group chat: get all group members
          const group = get().getGroupById?.(session.groupId);
          if (group?.members) {
            const groupCharacters = group.members
              .map((m: any) => get().getCharacterById(m.characterId))
              .filter((c: any) => c !== undefined);
            memberIds = groupCharacters.map((c: any) => c.id);
            memberNames = groupCharacters.map((c: any) => c.name);
          }
        }
        
        await fetch('/api/embeddings/ensure-namespace', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            characterId: session.characterId,
            characterName: session.characterId ? get().getCharacterById?.(session.characterId)?.name : '',
            groupId: session.groupId,
            groupName: session.groupId ? get().getGroupById?.(session.groupId)?.name : undefined,
            memberIds,
            memberNames,
            sessionId: id,
          }),
        });
        console.log(`[Session] Ensured memory namespaces for session ${id}`);
      } catch (err) {
        console.warn('[Session] Failed to ensure memory namespaces:', err);
      }
    }
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
    let newSessionStats = initializeSessionStatsForCharacters(characters);

    // Also add persona's stats as __user__ entry
    const resetActivePersona = get().getActivePersona?.();
    if (resetActivePersona?.statsConfig?.enabled && resetActivePersona.statsConfig.attributes?.length > 0) {
      newSessionStats = {
        ...newSessionStats,
        characterStats: {
          ...newSessionStats.characterStats,
          '__user__': createDefaultCharacterStats(resetActivePersona.statsConfig),
        },
      };
    }
    
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
    let newSessionStats = initializeSessionStatsForCharacters(characters);

    // Also add persona's stats as __user__ entry
    if (activePersona?.statsConfig?.enabled && activePersona.statsConfig.attributes?.length > 0) {
      newSessionStats = {
        ...newSessionStats,
        characterStats: {
          ...newSessionStats.characterStats,
          '__user__': createDefaultCharacterStats(activePersona.statsConfig),
        },
      };
    }
    
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
    
    // Execute quest completion rewards (handles notifications internally)
    executeCompletionRewards(get, sessionId, questTemplateId, undefined, characterId);
    
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
    
    // Add completion notification (only if no rewards were executed, to avoid duplicates)
    if (template && (!template.rewards || template.rewards.length === 0)) {
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
    
    // Check if objective was completed by this progress, execute rewards if so
    const session = get().sessions.find((s: ChatSession) => s.id === sessionId);
    const quest = session?.sessionQuests?.find((q: SessionQuestInstance) => q.templateId === questTemplateId);
    const objective = quest?.objectives.find(o => o.templateId === objectiveId);
    
    if (objective?.isCompleted) {
      // Execute objective rewards + quest rewards if auto-completed (handles notifications internally)
      executeCompletionRewards(get, sessionId, questTemplateId, objectiveId, characterId);
      
      // Add simple notification only if objective has no rewards (to avoid duplicates)
      if (template && (!targetObjective?.rewards || targetObjective.rewards.length === 0)) {
        get().addQuestNotification?.({
          questId: questTemplateId,
          questTitle: template.name,
          type: 'objective_complete',
          message: `Objetivo completado: ${targetObjective?.description}`,
        });
      }
    }
    
    // Handle quest chain if quest was auto-completed by this progress
    const chainSession = get().sessions.find((s: ChatSession) => s.id === sessionId);
    const chainQuest = chainSession?.sessionQuests?.find(
      (q: SessionQuestInstance) => q.templateId === questTemplateId && q.status === 'completed'
    );
    if (chainQuest && template?.chain && template.chain.type !== 'none' && template.chain.autoStart) {
      const nextQuestId = template.chain.type === 'specific'
        ? template.chain.nextQuestId
        : template.chain.type === 'random' && template.chain.randomPool?.length
          ? template.chain.randomPool[Math.floor(Math.random() * template.chain.randomPool.length)]
          : null;
      if (nextQuestId) {
        const nextQuestInstance = chainSession?.sessionQuests?.find((q: SessionQuestInstance) => q.templateId === nextQuestId);
        if (nextQuestInstance) {
          console.log(`[Quest Chain] Auto-starting next quest from progress: ${nextQuestId}`);
          get().activateQuest(sessionId, nextQuestId);
        } else {
          const nextTemplate = get().getTemplateById?.(nextQuestId);
          if (nextTemplate) {
            console.log(`[Quest Chain] Creating and activating new quest from progress: ${nextQuestId}`);
            get().activateQuestFromTemplate?.(sessionId, nextTemplate);
          }
        }
      }
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
    
    // Guard: skip if objective is already completed (prevent duplicate reward execution)
    const existingSession = get().sessions.find((s: ChatSession) => s.id === sessionId);
    const existingQuest = existingSession?.sessionQuests?.find(
      (q: SessionQuestInstance) => q.templateId === questTemplateId
    );
    if (existingQuest) {
      const existingObj = existingQuest.objectives.find((o) => o.templateId === objectiveId);
      if (existingObj?.isCompleted) {
        console.log(`[completeObjective] Objective "${targetObjective?.description || objectiveId}" is already completed, skipping.`);
        return;
      }
      // Also skip if quest is no longer active/available (e.g., already completed, failed, deactivated)
      if (existingQuest.status !== 'active' && existingQuest.status !== 'available') {
        console.log(`[completeObjective] Quest ${questTemplateId} is ${existingQuest.status}, skipping objective completion.`);
        return;
      }
    }
    
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
    
    // Execute objective rewards + quest rewards if auto-completed (handles notifications internally)
    executeCompletionRewards(get, sessionId, questTemplateId, objectiveId, characterId);
    
    // Add simple notification only if objective has no rewards (to avoid duplicates)
    if (template && targetObjective && (!targetObjective.rewards || targetObjective.rewards.length === 0)) {
      get().addQuestNotification?.({
        questId: questTemplateId,
        questTitle: template.name,
        type: 'objective_complete',
        message: `Objetivo completado: ${targetObjective.description}`,
      });
    }
    
    // Handle quest chain if quest was auto-completed by this objective completion
    const chainSessionObj = get().sessions.find((s: ChatSession) => s.id === sessionId);
    const chainQuestObj = chainSessionObj?.sessionQuests?.find(
      (q: SessionQuestInstance) => q.templateId === questTemplateId && q.status === 'completed'
    );
    if (chainQuestObj && template?.chain && template.chain.type !== 'none' && template.chain.autoStart) {
      const nextQuestId = template.chain.type === 'specific'
        ? template.chain.nextQuestId
        : template.chain.type === 'random' && template.chain.randomPool?.length
          ? template.chain.randomPool[Math.floor(Math.random() * template.chain.randomPool.length)]
          : null;
      if (nextQuestId) {
        const nextQuestInstance = chainSessionObj?.sessionQuests?.find((q: SessionQuestInstance) => q.templateId === nextQuestId);
        if (nextQuestInstance) {
          console.log(`[Quest Chain] Auto-starting next quest from completeObjective: ${nextQuestId}`);
          get().activateQuest(sessionId, nextQuestId);
        } else {
          const nextTemplate = get().getTemplateById?.(nextQuestId);
          if (nextTemplate) {
            console.log(`[Quest Chain] Creating and activating new quest from completeObjective: ${nextQuestId}`);
            get().activateQuestFromTemplate?.(sessionId, nextTemplate);
          }
        }
      }
    }
  },

  // ============================================
  // Skill Activation from Tool
  // ============================================
  // Called when manage_action tool activates a skill via tool-calling.
  // Applies costs to character stats and executes activation rewards.
  activateSkillByTool: (sessionId: string, characterId: string, skillName: string, skillDescription: string, activationCosts: ActivationCost[], activationRewards: QuestReward[]) => {
    try {
      const session = get().sessions.find((s: ChatSession) => s.id === sessionId);
      if (!session) {
        console.warn('[activateSkillByTool] Session not found:', sessionId);
        return;
      }

      const character = get().getCharacterById?.(characterId);
      const statsConfig = character?.statsConfig;
      if (!statsConfig?.enabled) {
        console.warn('[activateSkillByTool] Stats not enabled for character:', characterId);
        return;
      }

      // Save ultima_accion_realizada for {{eventos}} key
      const actionDescription = `${character?.name || characterId} - ${skillName}${skillDescription ? `: ${skillDescription}` : ''}`;
      get().updateSessionEvent?.(sessionId, 'ultima_accion_realizada', actionDescription);
      console.log(`[activateSkillByTool] Saved ultima_accion_realizada: ${actionDescription}`);

      // Step 1: Apply activation costs to character stats
      if (activationCosts.length > 0) {
        const charStats = session.sessionStats?.characterStats?.[characterId];
        const currentValues = charStats?.attributeValues || {};

        for (const cost of activationCosts) {
          if (!cost.attributeKey) continue;

          const attribute = statsConfig.attributes.find(a => a.key === cost.attributeKey);
          if (!attribute) {
            console.warn(`[activateSkillByTool] Attribute not found for cost: ${cost.attributeKey}`);
            continue;
          }

          const oldValue = currentValues[cost.attributeKey] ?? attribute.defaultValue ?? 0;
          let newValue: number | string = oldValue;

          if (typeof oldValue === 'number') {
            switch (cost.operator) {
              case '-': newValue = oldValue - cost.value; break;
              case '+': newValue = oldValue + cost.value; break;
              case '*': newValue = oldValue * cost.value; break;
              case '/': newValue = cost.value !== 0 ? oldValue / cost.value : oldValue; break;
              case '=': newValue = cost.value; break;
              case 'set_min': newValue = Math.max(oldValue, cost.value); break;
              case 'set_max': newValue = Math.min(oldValue, cost.value); break;
              default: break;
            }

            // Apply min/max constraints from attribute definition
            if (attribute.min !== undefined && typeof newValue === 'number') newValue = Math.max(newValue, attribute.min);
            if (attribute.max !== undefined && typeof newValue === 'number') newValue = Math.min(newValue, attribute.max);
          }

          get().updateCharacterStat?.(sessionId, characterId, cost.attributeKey, newValue, 'trigger' as any);
          console.log(`[activateSkillByTool] Applied cost: ${cost.attributeKey} ${oldValue} -> ${newValue}`);
        }
      }

      // Step 2: Execute activation rewards (sounds, sprites, objective completions, etc.)
      if (activationRewards.length > 0) {
        console.log(`[activateSkillByTool] Processing ${activationRewards.length} activation rewards:`, activationRewards.map(r => ({
          id: r.id,
          type: r.type,
          objectiveKey: r.objective?.objectiveKey || '(none)',
          questId: r.objective?.questId || '(none)',
          condition: r.condition || '(none)',
          rawObjective: r.objective,
        })));
        // Build allCharacters for group chat
        let allCharacters: CharacterCard[] = [];
        if (session.groupId) {
          const group = get().getGroupById?.(session.groupId);
          if (group?.members) {
            allCharacters = group.members
              .map((m: any) => get().getCharacterById(m.characterId))
              .filter((c: any): c is CharacterCard => c !== undefined);
          }
        } else if (character) {
          allCharacters = [character];
        }

        const context: RewardExecutionContext = {
          sessionId,
          characterId,
          character,
          allCharacters,
          sessionStats: session.sessionStats,
          timestamp: Date.now(),
          soundCollections: get().soundCollections,
          soundTriggers: get().soundTriggers,
          soundSequenceTriggers: get().soundSequenceTriggers,
          backgroundPacks: get().backgroundTriggerPacks,
          soundSettings: {
            enabled: get().settings?.sound?.enabled ?? false,
            globalVolume: get().settings?.sound?.globalVolume ?? 0.85,
          },
          backgroundSettings: {
            transitionDuration: get().settings?.backgroundTriggers?.transitionDuration ?? 500,
            defaultTransitionType: get().settings?.backgroundTriggers?.defaultTransitionType ?? 'fade',
          },
        };

        const actions: RewardStoreActions = {
          updateCharacterStat: (sid: string, cid: string, key: string, value: number | string, reason?: string) => {
            get().updateCharacterStat?.(sid, cid, key, value, reason as any);
          },
          completeQuestObjective: (sid: string, qid: string, objKey: string, cid?: string) => {
            return findAndCompleteObjectiveByKey(get, sid, qid || '', objKey, cid || characterId);
          },
          completeSolicitud: (sid: string, cid: string, solicitudKey: string) => {
            return get().completeSolicitud?.(sid, cid, solicitudKey) || null;
          },
          applyTriggerForCharacter: (cid: string, hit: any) => {
            get().applyTriggerForCharacter?.(cid, hit);
          },
          scheduleReturnToIdleForCharacter: (cid: string, triggerSpriteUrl: string, returnToMode: any, returnSpriteUrl: string, returnSpriteLabel: string | null, returnToIdleMs: number) => {
            get().scheduleReturnToIdleForCharacter?.(cid, triggerSpriteUrl, returnToMode, returnSpriteUrl, returnSpriteLabel, returnToIdleMs);
          },
          isSpriteLocked: () => get().isSpriteLocked?.() ?? false,
          playSound: (collection: string, filename: string, volume?: number) => {
            get().playSound?.(collection, filename, volume);
          },
          setBackground: (url: string) => {
            get().setBackground?.(url);
          },
          setActiveOverlays: (overlays: any) => {
            get().setActiveOverlays?.(overlays);
          },
        };

        const result = executeAllRewards(activationRewards, context, actions);
        console.log(`[activateSkillByTool] Executed ${activationRewards.length} rewards: ${result.successCount} succeeded, ${result.failureCount} failed`);
      }

      console.log(`[activateSkillByTool] Skill "${skillName}" activated successfully for character ${characterId}`);
    } catch (err) {
      console.error('[activateSkillByTool] Error activating skill:', err);
    }
  },

  // Toggle objective completion (complete/uncomplete)
  toggleObjectiveCompletion: (sessionId, questTemplateId, objectiveId) => {
    const template = get().getTemplateById?.(questTemplateId);
    const targetObjective = template?.objectives.find(o => o.id === objectiveId);
    const targetCount = targetObjective?.targetCount || 1;
    
    // Check current state BEFORE toggle
    const sessionBefore = get().sessions.find((s: ChatSession) => s.id === sessionId);
    const questBefore = sessionBefore?.sessionQuests?.find(
      (q: SessionQuestInstance) => q.templateId === questTemplateId
    );
    const objectiveBefore = questBefore?.objectives.find(o => o.templateId === objectiveId);
    const wasCompletedBefore = objectiveBefore?.isCompleted ?? false;
    
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
    
    // Execute rewards only when toggling TO completed (not when uncompleting)
    if (!wasCompletedBefore) {
      executeCompletionRewards(get, sessionId, questTemplateId, objectiveId);
    }
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
