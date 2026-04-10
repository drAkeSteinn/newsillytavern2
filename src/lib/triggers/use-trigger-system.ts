// ============================================
// Use Trigger System - Unified Trigger Hook
// ============================================
//
// This hook integrates all trigger components:
// - KeyDetector (unified key detection for all formats)
// - HandlerRegistry (orchestration of KeyHandlers)
// - KeyHandlers (Sound, Skill, Solicitud - unified interface)
// - Legacy TokenDetector (for Sprite, HUD, Background, Quest, Item, Stats)
//
// Usage:
// ```tsx
// const { processStreamingContent, resetForNewMessage } = useTriggerSystem();
// 
// // During streaming
// processStreamingContent(accumulatedContent, character, messageKey);
// 
// // When message ends
// resetForNewMessage(messageKey, character);
// ```

import { useCallback, useEffect, useRef, useMemo } from 'react';
import { useTavernStore } from '@/store';
import type { CharacterCard, HUDTemplate } from '@/types';

// ============================================
// UNIFIED: KeyDetector and KeyHandler system
// ============================================
import { 
  getKeyDetector,
  resetKeyDetector,
  normalizeKey,
  keyMatches,
  type DetectedKey,
  type KeyFormat,
} from './key-detector';
import {
  getHandlerRegistry,
  resetHandlerRegistry,
  type HandlerRegistryResult,
} from './handler-registry';
import type { KeyHandler, TriggerMatchResult } from './types';

// ============================================
// UNIFIED: KeyHandler implementations
// ============================================
import {
  createSoundKeyHandler,
  SoundKeyHandler,
  type SoundKeyHandlerContext,
} from './handlers/sound-key-handler';
import {
  createSpriteKeyHandler,
  SpriteKeyHandler,
  type SpriteKeyHandlerContext,
  getIdleSpriteUrl,
} from './handlers/sprite-key-handler';
import {
  createSkillKeyHandler,
  SkillKeyHandler,
  type SkillKeyHandlerContext,
} from './handlers/skill-key-handler';
import {
  createSolicitudKeyHandler,
  SolicitudKeyHandler,
  type SolicitudKeyHandlerContext,
} from './handlers/solicitud-key-handler';
import {
  createBackgroundKeyHandler,
  BackgroundKeyHandler,
  type BackgroundKeyHandlerContext,
} from './handlers/background-key-handler';
import {
  createHUDKeyHandler,
  HUDKeyHandler,
  type HUDKeyHandlerContext,
} from './handlers/hud-key-handler';
import {
  createQuestKeyHandler,
  QuestKeyHandler,
  type QuestKeyHandlerContext,
} from './handlers/quest-key-handler';
import {
  createStatsKeyHandler,
  StatsKeyHandler,
  type StatsKeyHandlerContext,
} from './handlers/stats-key-handler';
import {
  createItemKeyHandler,
  ItemKeyHandler,
  type ItemKeyHandlerContext,
} from './handlers/item-key-handler';

// ============================================
// LEGACY: TokenDetector (for handlers not yet migrated)
// ============================================
import { 
  getTokenDetector, 
  type TokenDetectorConfig 
} from './token-detector';
import { 
  getTriggerBus, 
  type TriggerContext, 
  createMessageEndEvent,
} from './trigger-bus';
import {
  createSoundHandlerState,
  checkSoundTriggers,
  executeAllSoundTriggers,
  resetSoundHandlerState,
  clearSoundHandlerState,
  checkSoundSequenceTriggers,
  executeAllSoundSequenceTriggers,
  type SoundHandlerState,
  type SoundTriggerContext,
  type SoundSequenceContext,
} from './handlers/sound-handler';
import {
  createSpriteHandlerState,
  checkSpriteTriggers,
  executeSpriteTrigger,
  resetSpriteHandlerState,
  clearSpriteHandlerState,
  checkTriggerCollections,
  executeTriggerCollectionResult,
  markCollectionTriggered,
  type SpriteHandlerState,
  type SpriteTriggerContext,
  type SpriteTriggerContextV2,
  type TriggerCollectionMatchResult,
} from './handlers/sprite-handler';
import {
  createHUDHandlerState,
  checkHUDTriggers,
  executeHUDTrigger,
  resetHUDHandlerState,
  clearHUDHandlerState,
  type HUDHandlerState,
  type HUDTriggerContext,
} from './handlers/hud-handler';
import {
  createBackgroundHandlerState,
  checkBackgroundTriggers,
  checkBackgroundTriggersMulti,
  checkReturnToDefault,
  executeBackgroundTrigger,
  executeAllBackgroundTriggers,
  resetBackgroundHandlerState,
  clearBackgroundHandlerState,
  type BackgroundHandlerState,
  type BackgroundTriggerContext,
} from './handlers/background-handler';
import {
  createQuestHandlerState,
  checkQuestTriggers,
  resetQuestHandlerState,
  clearQuestHandlerState,
  type QuestHandlerState,
  type QuestTriggerContext,
} from './handlers/quest-handler';
import {
  executeQuestCompletionRewards,
  executeObjectiveRewards,
  executeTriggerRewardFromQuest,
  executeReward,
  type RewardStoreActions,
} from '@/lib/quest/quest-reward-executor';
import {
  createItemHandlerState,
  checkItemTriggers,
  resetItemHandlerState,
  clearItemHandlerState,
  type ItemHandlerState,
  type ItemTriggerContext,
} from './handlers/item-handler';
import {
  createStatsHandlerState,
  checkStatsTriggersInText,
  executeStatsTrigger,
  resetStatsHandlerState,
  clearStatsHandlerState,
  type StatsHandlerState,
  type StatsTriggerContext,
} from './handlers/stats-handler';
import {
  createSkillActivationHandlerState,
  checkSkillActivationTriggersInText,
  executeAllSkillActivations,
  resetSkillActivationState,
  clearSkillActivationHandlerState,
  type SkillActivationHandlerState,
  type SkillActivationTriggerContext,
} from './handlers/skill-activation-handler';
import {
  createSolicitudHandlerState,
  checkSolicitudTriggersInText,
  resetSolicitudHandlerState,
  clearSolicitudHandlerState,
  type SolicitudHandlerState,
  type SolicitudTriggerContext,
} from './handlers/solicitud-handler';
import type { BackgroundOverlay, BackgroundTransitionType } from '@/types';

// ============================================
// Hook Configuration
// ============================================

export interface TriggerSystemConfig {
  tokenDetector?: Partial<TokenDetectorConfig>;
  soundEnabled?: boolean;
  spriteEnabled?: boolean;
  backgroundEnabled?: boolean;
  hudEnabled?: boolean;
  questEnabled?: boolean;
  inventoryEnabled?: boolean;
  statsEnabled?: boolean;
  debug?: boolean;
  maxSoundsPerMessage?: number;
  // Persona for peticiones/solicitudes system
  activePersona?: { id: string; name: string; statsConfig?: any } | null;
}

// ============================================
// Hook Return Type
// ============================================

export interface TriggerSystemResult {
  processStreamingContent: (
    content: string, 
    character: CharacterCard | null,
    messageKey: string,
    characters?: CharacterCard[]
  ) => void;
  
  processFullContent: (
    content: string,
    character: CharacterCard | null,
    messageKey: string,
    characters?: CharacterCard[]
  ) => void;
  
  completePartialMatches: (
    messageKey: string,
    character: CharacterCard | null,
    characters?: CharacterCard[]
  ) => DetectedKey | null;
  
  resetForNewMessage: (messageKey: string, character: CharacterCard | null, characters?: CharacterCard[]) => void;
  
  // Clear ALL state - call this when chat is reset
  clearAllState: () => void;
  
  isEnabled: boolean;
}

// ============================================
// Hook Implementation
// ============================================

export function useTriggerSystem(config: TriggerSystemConfig = {}): TriggerSystemResult {
  const store = useTavernStore();
  const settings = store.settings;
  
  // Handler states (created once)
  const soundHandlerState = useMemo(() => createSoundHandlerState(), []);
  const spriteHandlerState = useMemo(() => createSpriteHandlerState(), []);
  const hudHandlerState = useMemo(() => createHUDHandlerState(), []);
  const backgroundHandlerState = useMemo(() => createBackgroundHandlerState(), []);
  const questHandlerState = useMemo(() => createQuestHandlerState(), []);
  const itemHandlerState = useMemo(() => createItemHandlerState(), []);
  const statsHandlerState = useMemo(() => createStatsHandlerState(), []);
  const skillActivationHandlerState = useMemo(() => createSkillActivationHandlerState(), []);
  const solicitudHandlerState = useMemo(() => createSolicitudHandlerState(), []);

  // Key handlers (created once to preserve deduplication state)
  // IMPORTANT: These must be created once and reused, otherwise the position tracking
  // for deduplication is reset on every call, causing double activations
  const soundHandler = useMemo(() => createSoundKeyHandler(config.maxSoundsPerMessage ?? 10), [config.maxSoundsPerMessage]);
  const spriteHandler = useMemo(() => createSpriteKeyHandler(), []);
  const skillHandler = useMemo(() => createSkillKeyHandler(), []);
  const solicitudHandler = useMemo(() => createSolicitudKeyHandler(), []);
  const backgroundHandler = useMemo(() => createBackgroundKeyHandler(), []);
  const hudHandler = useMemo(() => createHUDKeyHandler(), []);
  const questHandler = useMemo(() => createQuestKeyHandler(), []);
  const statsHandler = useMemo(() => createStatsKeyHandler(), []);
  const itemHandler = useMemo(() => createItemKeyHandler(), []);

  // Track last processed content per message
  const lastProcessedRef = useRef<Map<string, string>>(new Map());
  
  // Initialize trigger bus and detector
  useEffect(() => {
    const bus = getTriggerBus();
    const detector = getTokenDetector(config.tokenDetector);
    
    if (config.debug) {
      bus.setDebug(true);
    }
    
    // Cleanup on unmount
    return () => {
      soundHandlerState.triggeredPositions.clear();
      soundHandlerState.soundCountPerMessage.clear();
      spriteHandlerState.triggeredPositions.clear();
      spriteHandlerState.lastPackMatches.clear();
      hudHandlerState.updatedFields.clear();
      backgroundHandlerState.triggeredPositions.clear();
      backgroundHandlerState.lastTriggeredBackground.clear();
      backgroundHandlerState.lastTriggerTime.clear();
      backgroundHandlerState.currentActivePack.clear();
      questHandlerState.processedQuests.clear();
      questHandlerState.triggeredPositions.clear();
      itemHandlerState.processedItems.clear();
      itemHandlerState.triggeredPositions.clear();
      statsHandlerState.detectionStates.clear();
      statsHandlerState.processedMessages.clear();
    };
  }, [config.debug, config.tokenDetector, soundHandlerState, spriteHandlerState, hudHandlerState, backgroundHandlerState, questHandlerState, itemHandlerState, statsHandlerState]);
  
  // Check for return to default background periodically
  useEffect(() => {
    if (config.backgroundEnabled === false) return;
    
    const checkInterval = setInterval(() => {
      const bgSettings = settings.backgroundTriggers;
      if (!bgSettings?.enabled || !bgSettings?.returnToDefaultEnabled) return;
      
      const context: BackgroundTriggerContext = {
        character: null,
        characters: undefined,
        fullText: '',
        messageKey: 'return-check',
        isStreaming: false,
        timestamp: Date.now(),
        backgroundPacks: store.backgroundTriggerPacks ?? [],
        backgroundCollections: store.backgroundCollections ?? [],
        backgroundSettings: {
          enabled: bgSettings.enabled,
          globalCooldown: bgSettings.globalCooldown ?? 0,
          transitionDuration: bgSettings.transitionDuration ?? 500,
          defaultTransitionType: (bgSettings.defaultTransitionType as BackgroundTransitionType) ?? 'fade',
          returnToDefaultEnabled: bgSettings.returnToDefaultEnabled ?? false,
          returnToDefaultAfter: bgSettings.returnToDefaultAfter ?? 300000,
          defaultBackgroundUrl: bgSettings.defaultBackgroundUrl ?? '',
          globalOverlays: (bgSettings.globalOverlays as BackgroundOverlay[]) ?? [],
        },
        cooldownContextKey: 'default',
      };
      
      const returnResult = checkReturnToDefault(context, backgroundHandlerState);
      
      if (returnResult?.shouldReturn && returnResult.defaultUrl) {
        console.log('[TriggerSystem] Returning to default background');
        store.setBackground(returnResult.defaultUrl);
        if (returnResult.overlays) {
          store.setActiveOverlays(returnResult.overlays);
        }
      }
    }, 10000); // Check every 10 seconds
    
    return () => clearInterval(checkInterval);
  }, [settings.backgroundTriggers, store, backgroundHandlerState, config.backgroundEnabled]);
  
  /**
   * Get the active HUD template based on character or group
   */
  const getActiveHUDTemplate = useCallback((): HUDTemplate | null => {
    const hudSessionState = store.hudSessionState;
    
    // If there's an active template in session, use it
    if (hudSessionState.activeTemplateId) {
      return store.hudTemplates.find(t => t.id === hudSessionState.activeTemplateId) || null;
    }
    
    return null;
  }, [store.hudTemplates, store.hudSessionState]);
  
  /**
   * Process streaming content incrementally
   */
  const processStreamingContent = useCallback((
    content: string,
    character: CharacterCard | null,
    messageKey: string,
    characters?: CharacterCard[]
  ) => {
    // DEBUG: Log all processStreamingContent calls
    console.log(`[TriggerSystem] processStreamingContent called`, {
      messageKey,
      characterName: character?.name,
      characterId: character?.id,
      contentLength: content.length,
      contentPreview: content.slice(0, 100),
      charactersCount: characters?.length,
      hasPersona: characters?.some(c => c.id === '__user__'),
    });

    // Check if already processed this exact content
    // Use characterMessageKey for cache to avoid cross-character conflicts in group chat
    // But we need to compute characterMessageKey first
    let characterMessageKey: string;
    if (character?.id) {
      // Check if messageKey already ends with the characterId (group chat case)
      if (messageKey.endsWith(`_${character.id}`)) {
        characterMessageKey = messageKey;
      } else {
        characterMessageKey = `${messageKey}_${character.id}`;
      }
    } else {
      characterMessageKey = messageKey;
    }
    
    const lastProcessed = lastProcessedRef.current.get(characterMessageKey);
    if (lastProcessed === content) {
      console.log(`[TriggerSystem] Skipping - same content as last processed for ${characterMessageKey}`);
      return;
    }
    lastProcessedRef.current.set(characterMessageKey, content);
    
    console.log(`[TriggerSystem] Using characterMessageKey: ${characterMessageKey}`);
    
    // Create context (needed for both token-based triggers AND solicitud processing)
    const context: TriggerContext = {
      character,
      characters,
      fullText: content,
      messageKey: characterMessageKey,
      isStreaming: true,
      timestamp: Date.now(),
    };
    
    // ============================================
    // UNIFIED KEY DETECTION (NEW SYSTEM)
    // Detect ALL key formats in one pass: [key], |key|, Peticion:key, key:value, etc.
    // ============================================
    const keyDetector = getKeyDetector();
    const registry = getHandlerRegistry();
    
    // Detect formatted keys incrementally (only NEW keys since last call)
    // Use characterMessageKey for independent tracking per character
    const newKeys = keyDetector.detectKeys(content, characterMessageKey);
    
    // Also detect plain word keys for registered sound triggers
    // This is needed because "glohg" and "gluck" are plain words without special format
    const soundKeywords = store.soundTriggers
      ?.filter(t => t.active)
      ?.flatMap(t => t.keywords) || [];
    
    // Also detect skill activation keys as plain words
    // This is needed because "hab1" can appear as a plain word
    const skillActivationKeys = character?.statsConfig?.skills
      ?.filter(s => s.activationKey || (s.activationKeys && s.activationKeys.length > 0))
      ?.flatMap(s => [
        s.activationKey,
        ...(s.activationKeys || [])
      ].filter(Boolean)) || [];
    
    // Also detect background trigger keys as plain words
    // This is needed because "sofa", "cama", etc. are plain words without special format
    const backgroundKeywords = store.backgroundTriggerPacks
      ?.filter(p => p.active)
      ?.flatMap(p => p.items.filter(i => i.enabled).flatMap(i => i.triggerKeys)) || [];
    
    // Also detect quest activation and objective completion keys as plain words
    // Quest activation keys from available quests
    const activeSession = store.getActiveSession?.();
    const sessionQuests = activeSession?.sessionQuests || [];
    
    // Get quest templates for looking up activation/completion keys
    const questTemplates = store.questTemplates || [];
    
    // Activation keys from available quests
    const questActivationKeys = sessionQuests
      .filter(q => q.status === 'available')
      .flatMap(q => {
        const template = questTemplates.find(t => t.id === q.templateId);
        if (template?.activation?.method === 'keyword') {
          return [
            template.activation.key,
            ...(template.activation.keys || [])
          ].filter(Boolean);
        }
        return [];
      });
    
    // Objective completion keys from active quests
    const questObjectiveKeys = sessionQuests
      .filter(q => q.status === 'active')
      .flatMap(q => {
        const template = questTemplates.find(t => t.id === q.templateId);
        if (!template) return [];
        return template.objectives.flatMap(obj => {
          const sessionObj = q.objectives.find(o => o.templateId === obj.id);
          if (sessionObj?.isCompleted) return [];
          return [
            obj.completion?.key,
            ...(obj.completion?.keys || [])
          ].filter(Boolean);
        });
      });
    
    // Quest completion keys from active quests
    const questCompletionKeys = sessionQuests
      .filter(q => q.status === 'active')
      .flatMap(q => {
        const template = questTemplates.find(t => t.id === q.templateId);
        if (!template) return [];
        return [
          template.completion?.key,
          ...(template.completion?.keys || [])
        ].filter(Boolean);
      });
    
    // Combine all keywords to detect as plain words
    const allKeywords = [
      ...soundKeywords,
      ...skillActivationKeys,
      ...backgroundKeywords,
      ...questActivationKeys,
      ...questObjectiveKeys,
      ...questCompletionKeys,
    ];
    
    // DEBUG: Log keyword detection setup
    console.log(`[TriggerSystem] Keyword detection setup:`, {
      soundKeywordsCount: soundKeywords.length,
      skillActivationKeysCount: skillActivationKeys.length,
      backgroundKeywordsCount: backgroundKeywords.length,
      questActivationKeysCount: questActivationKeys.length,
      questObjectiveKeysCount: questObjectiveKeys.length,
      questCompletionKeysCount: questCompletionKeys.length,
      allKeywordsCount: allKeywords.length,
      // Show actual quest keywords for debugging
      questActivationKeys,
      questObjectiveKeys,
      questCompletionKeys,
      sessionQuestsCount: sessionQuests.length,
      sessionQuestsStatuses: sessionQuests.map(q => q.status),
    });
    
    // Use characterMessageKey for independent tracking per character
    const wordKeys = keyDetector.detectWordKeys(content, characterMessageKey, allKeywords);
    
    // Combine all detected keys (formatted + plain words)
    const allDetectedKeys = [...newKeys, ...wordKeys];
    
    console.log(`[TriggerSystem] Detection summary: ${newKeys.length} formatted + ${wordKeys.length} word = ${allDetectedKeys.length} total`);
    
    if (allDetectedKeys.length > 0) {
      console.log(`[TriggerSystem] Detected ${allDetectedKeys.length} keys:`, 
        allDetectedKeys.map(k => ({ key: k.key, format: k.format, position: k.position })));
      
      // Build contexts for each handler type
      const activeSession = store.getActiveSession?.();
      const sessionId = store.activeSessionId || '';
      
      // Include persona as pseudo-character for peticiones targeting __user__
      const allCharactersWithPersona = [
        ...(characters || []),
        ...(config.activePersona?.statsConfig?.enabled ? [{
          id: '__user__',
          name: config.activePersona.name || 'User',
          statsConfig: config.activePersona.statsConfig,
        }] as CharacterCard[] : []),
      ];
      
      // ============================================
      // UNIFIED HANDLER REGISTRY PROCESSING
      // Register all handlers and process keys through registry
      // This replaces the manual loop with a unified handler system
      // ============================================
      
      // Build context for handlers
      const soundKeyHandlerContext: SoundKeyHandlerContext = {
        ...context,
        sessionId,
        characterId: character?.id,
        soundTriggers: store.soundTriggers,
        soundCollections: store.soundCollections,
        soundSequenceTriggers: store.soundSequenceTriggers,
        soundSettings: {
          enabled: settings.sound?.enabled ?? false,
          globalVolume: settings.sound?.globalVolume ?? 0.85,
          globalCooldown: settings.sound?.globalCooldown ?? 0,
        },
        cooldownContextKey: character?.id || 'default',
        playSound: store.playSound?.bind(store),
      };
      
      const spriteKeyHandlerContext: SpriteKeyHandlerContext = {
        ...context,
        sessionId,
        characterId: character?.id,
        character,
        allCharacters: characters,
        triggerCollections: character?.triggerCollections ?? [],
        spritePacksV2: character?.spritePacksV2 ?? store.spritePacksV2 ?? [],
        stateCollectionsV2: character?.stateCollectionsV2,
        spritePacks: character?.spritePacks ?? store.spritePacks ?? [],
        spriteTriggers: character?.spriteTriggers ?? [],
        spriteIndex: store.spriteIndex,
        isSpriteLocked: store.isSpriteLocked?.() ?? false,
        applyTriggerForCharacter: store.applyTriggerForCharacter?.bind(store),
        scheduleReturnToIdleForCharacter: store.scheduleReturnToIdleForCharacter?.bind(store),
        addTriggerToQueue: store.addTriggerToQueue?.bind(store),
        startSpriteChain: store.startSpriteChain?.bind(store),
        startSoundChain: store.startSoundChain?.bind(store),
      };
      
      const skillHandlerContext: SkillKeyHandlerContext = {
        ...context,
        characterId: character?.id || '',
        characterName: character?.name || '',
        statsConfig: character?.statsConfig,
        sessionStats: activeSession?.sessionStats,
        sessionId,
        storeActions: {
          updateCharacterStat: store.updateCharacterStat.bind(store),
          updateSessionEvent: store.updateSessionEvent?.bind(store),
        },
      };
      
      const solicitudHandlerContext: SolicitudKeyHandlerContext = {
        ...context,
        characterId: character?.id || '',
        characterName: character?.name || '',
        statsConfig: character?.statsConfig,
        sessionStats: activeSession?.sessionStats,
        sessionId,
        allCharacters: allCharactersWithPersona,
        activePersona: config.activePersona,
        storeActions: {
          createSolicitud: store.createSolicitud.bind(store),
          completeSolicitud: store.completeSolicitud.bind(store),
          getSessionStats: (sid: string) => {
            const session = store.sessions?.find((s: any) => s.id === sid);
            return session?.sessionStats || null;
          },
        },
      };

      // Build handler contexts (outside the loop for efficiency)
      const backgroundKeyHandlerContext: BackgroundKeyHandlerContext = {
        ...context,
        sessionId,
        characterId: character?.id,
        backgroundPacks: store.backgroundTriggerPacks ?? [],
        backgroundSettings: {
          enabled: settings.backgroundTriggers?.enabled ?? false,
          globalCooldown: settings.backgroundTriggers?.globalCooldown ?? 0,
          transitionDuration: settings.backgroundTriggers?.transitionDuration ?? 500,
          defaultTransitionType: settings.backgroundTriggers?.defaultTransitionType ?? 'fade',
          returnToDefaultEnabled: settings.backgroundTriggers?.returnToDefaultEnabled ?? false,
          returnToDefaultAfter: settings.backgroundTriggers?.returnToDefaultAfter ?? 300000,
          defaultBackgroundUrl: settings.backgroundTriggers?.defaultBackgroundUrl ?? '',
          globalOverlays: settings.backgroundTriggers?.globalOverlays ?? [],
        },
        cooldownContextKey: character?.id || 'default',
        setBackground: store.setBackground?.bind(store),
        setOverlays: store.setActiveOverlays?.bind(store),
      };

      const activeHUDTemplate = getActiveHUDTemplate();
      const hudKeyHandlerContext: HUDKeyHandlerContext | null = activeHUDTemplate ? {
        ...context,
        sessionId,
        characterId: character?.id,
        activeHUDTemplate,
        currentHUDValues: store.hudSessionState.fieldValues,
        updateHUDFieldValue: store.updateHUDFieldValue.bind(store),
      } : null;

      // Quest handler context
      const questKeyHandlerContext: QuestKeyHandlerContext = {
        ...context,
        sessionId,
        characterId: character?.id,
        questTemplates: store.questTemplates ?? [],
        sessionQuests: activeSession?.sessionQuests ?? [],
        questSettings: store.questSettings ?? { enabled: false },
        turnCount: activeSession?.turnCount ?? 0,
        activateQuest: store.activateQuest?.bind(store),
        progressQuestObjective: store.progressQuestObjective?.bind(store),
        completeQuest: store.completeQuest?.bind(store),
      };

      // Stats handler context
      const statsKeyHandlerContext: StatsKeyHandlerContext = {
        ...context,
        sessionId,
        characterId: character?.id,
        characterName: character?.name,
        statsConfig: character?.statsConfig,
        sessionStats: activeSession?.sessionStats,
        updateCharacterStat: store.updateCharacterStat.bind(store),
      };

      // Item handler context
      const itemKeyHandlerContext: ItemKeyHandlerContext = {
        ...context,
        sessionId,
        characterId: character?.id,
        items: store.items ?? [],
        inventoryEntries: store.inventoryEntries ?? [],
        inventorySettings: store.inventorySettings ?? { enabled: false },
        defaultContainerId: store.defaultContainerId,
        addToInventory: store.addToInventory?.bind(store),
        removeFromInventory: store.removeFromInventory?.bind(store),
        equipItem: store.equipItem?.bind(store),
        unequipItem: store.unequipItem?.bind(store),
        addNotification: store.addInventoryNotification?.bind(store),
      };

      // Process keys through unified handlers
      for (const detectedKey of allDetectedKeys) {
        // 1. Sound Handler (highest priority for audio)
        if (config.soundEnabled !== false && settings.sound?.enabled) {
          if (soundHandler.canHandle(detectedKey, soundKeyHandlerContext)) {
            const result = soundHandler.handleKey(detectedKey, soundKeyHandlerContext);
            if (result?.matched) {
              console.log(`[TriggerSystem] Sound key matched: ${detectedKey.key}`);
              soundHandler.execute(result.trigger, soundKeyHandlerContext);
            }
          }
        }
        
        // 2. Sprite Handler
        if (config.spriteEnabled !== false) {
          if (spriteHandler.canHandle(detectedKey, spriteKeyHandlerContext)) {
            const result = spriteHandler.handleKey(detectedKey, spriteKeyHandlerContext);
            if (result?.matched) {
              console.log(`[TriggerSystem] Sprite key matched: ${detectedKey.key}`);
              spriteHandler.execute(result.trigger, spriteKeyHandlerContext);
            }
          }
        }
        
        // Helper function to complete quest objectives by their detection key
        // objectiveDetectionKey is the completion.key (e.g., "psycompletado") from QuestRewardObjective
        const completeQuestObjectiveByKey = (
          sessionId: string,
          questTemplateId: string, // Can be empty to search all active quests
          objectiveDetectionKey: string,
          characterId?: string
        ): boolean => {
          try {
            console.log(`[completeQuestObjectiveByKey] Searching for objective with key: "${objectiveDetectionKey}"`);
            const sessionQuests = store.getSessionQuests?.(sessionId) || [];
            console.log(`[completeQuestObjectiveByKey] Session quests found: ${sessionQuests.length}`);
            
            const activeQuests = sessionQuests.filter((q: any) => q.status === 'active' || q.status === 'available');
            console.log(`[completeQuestObjectiveByKey] Active quests: ${activeQuests.length}`);
            
            // Get templates from questTemplateSlice to access objective completion keys
            // Access via store state (questTemplates is directly on the store)
            const templates = (store as any).questTemplates || [];
            console.log(`[completeQuestObjectiveByKey] Templates loaded: ${templates.length}`);
            
            if (templates.length === 0) {
              console.log(`[completeQuestObjectiveByKey] WARNING: No templates loaded in store!`);
            }
            
            for (const quest of activeQuests) {
              // If questTemplateId is specified, skip non-matching quests
              if (questTemplateId && quest.templateId !== questTemplateId) continue;
              
              // Find the template for this quest
              const template = templates.find((t: any) => t.id === quest.templateId);
              if (!template) continue;
              
              // Search for the objective by its completion.key
              for (const objective of template.objectives || []) {
                const completionKeys = [objective.completion?.key, ...(objective.completion?.keys || [])].filter(Boolean);
                
                console.log(`[completeQuestObjectiveByKey] Checking objective "${objective.description}" (id: ${objective.id}) with keys:`, completionKeys);
                
                for (const completionKey of completionKeys) {
                  if (completionKey === objectiveDetectionKey || 
                      completionKey?.toLowerCase() === objectiveDetectionKey.toLowerCase() ||
                      completionKey === `obj-${objectiveDetectionKey}`) {
                    console.log(`[completeQuestObjectiveByKey] MATCH! Objective "${objective.description}" (key: ${completionKey}) in quest ${quest.templateId}`);
                    store.completeObjective?.(sessionId, quest.templateId, objective.id, characterId);
                    return true;
                  }
                }
              }
            }
            
            // Try case-insensitive partial match
            const lowerKey = objectiveDetectionKey.toLowerCase();
            console.log(`[completeQuestObjectiveByKey] Trying partial match with lowerKey: "${lowerKey}"`);
            for (const quest of activeQuests) {
              if (questTemplateId && quest.templateId !== questTemplateId) continue;
              
              const template = templates.find((t: any) => t.id === quest.templateId);
              if (!template) continue;
              
              for (const objective of template.objectives || []) {
                const completionKeys = [objective.completion?.key, ...(objective.completion?.keys || [])].filter(Boolean);
                
                for (const completionKey of completionKeys) {
                  if (completionKey?.toLowerCase().includes(lowerKey) || lowerKey.includes(completionKey?.toLowerCase())) {
                    console.log(`[completeQuestObjectiveByKey] PARTIAL MATCH! Objective "${objective.description}" (key: ${completionKey}) in quest ${quest.templateId}`);
                    store.completeObjective?.(sessionId, quest.templateId, objective.id, characterId);
                    return true;
                  }
                }
              }
            }
            
            console.log(`[TriggerSystem] Objective not found: ${objectiveDetectionKey}`);
            return false;
          } catch (err) {
            console.error('[TriggerSystem] Error completing objective:', err);
            return false;
          }
        };
        
        // 3. Skill Handler (for skill activations)
        if (config.statsEnabled !== false && character?.statsConfig?.enabled) {
          if (skillHandler.canHandle(detectedKey, skillHandlerContext)) {
            const result = skillHandler.handleKey(detectedKey, skillHandlerContext);
            if (result?.matched) {
              console.log(`[TriggerSystem] Skill key matched: ${detectedKey.key}`);
              const executeResult = skillHandler.execute(result.trigger, skillHandlerContext);
              
              // Execute activation rewards (sounds, sprites, objective completions, etc.)
              const rewards = result.trigger.data?.activationRewards || [];
              if (rewards.length > 0) {
                console.log(`[TriggerSystem] Executing ${rewards.length} skill activation rewards`);
                for (const reward of rewards) {
                  try {
                    executeReward(reward, {
                      sessionId,
                      characterId: character.id,
                      character,
                      allCharacters: allCharactersWithPersona,
                      sessionStats: activeSession?.sessionStats,
                      timestamp: Date.now(),
                      soundCollections: store.soundCollections,
                      soundTriggers: store.soundTriggers,
                      backgroundPacks: store.backgroundTriggerPacks,
                      soundSettings: {
                        enabled: settings.sound?.enabled ?? false,
                        globalVolume: settings.sound?.globalVolume ?? 0.85,
                      },
                      backgroundSettings: {
                        transitionDuration: settings.backgroundTriggers?.transitionDuration ?? 500,
                        defaultTransitionType: settings.backgroundTriggers?.defaultTransitionType ?? 'fade',
                      },
                    }, {
                      updateCharacterStat: store.updateCharacterStat.bind(store),
                      applyTriggerForCharacter: store.applyTriggerForCharacter?.bind(store),
                      scheduleReturnToIdleForCharacter: store.scheduleReturnToIdleForCharacter?.bind(store),
                      isSpriteLocked: store.isSpriteLocked?.bind(store),
                      playSound: store.playSound?.bind(store),
                      setBackground: store.setBackground?.bind(store),
                      setActiveOverlays: store.setActiveOverlays?.bind(store),
                      completeObjective: store.completeObjective?.bind(store),
                      completeQuestObjective: completeQuestObjectiveByKey,
                      completeSolicitud: store.completeSolicitud?.bind(store),
                    });
                    console.log(`[TriggerSystem] Reward executed: ${reward.type} - ${reward.key || reward.id}`);
                  } catch (err) {
                    console.error('[TriggerSystem] Failed to execute skill activation reward:', err);
                  }
                }
              }
              
              // Execute threshold effects (when attribute reaches min/max)
              if (executeResult.thresholdsReached.length > 0) {
                console.log(`[TriggerSystem] Executing ${executeResult.thresholdsReached.length} threshold effects`);
                for (const threshold of executeResult.thresholdsReached) {
                  for (const reward of threshold.rewards) {
                    try {
                      executeReward(reward, {
                        sessionId,
                        characterId: character.id,
                        character,
                        allCharacters: allCharactersWithPersona,
                        sessionStats: activeSession?.sessionStats,
                        timestamp: Date.now(),
                        soundCollections: store.soundCollections,
                        soundTriggers: store.soundTriggers,
                        backgroundPacks: store.backgroundTriggerPacks,
                        soundSettings: {
                          enabled: settings.sound?.enabled ?? false,
                          globalVolume: settings.sound?.globalVolume ?? 0.85,
                        },
                        backgroundSettings: {
                          transitionDuration: settings.backgroundTriggers?.transitionDuration ?? 500,
                          defaultTransitionType: settings.backgroundTriggers?.defaultTransitionType ?? 'fade',
                        },
                      }, {
                        updateCharacterStat: store.updateCharacterStat.bind(store),
                        applyTriggerForCharacter: store.applyTriggerForCharacter?.bind(store),
                        scheduleReturnToIdleForCharacter: store.scheduleReturnToIdleForCharacter?.bind(store),
                        isSpriteLocked: store.isSpriteLocked?.bind(store),
                        playSound: store.playSound?.bind(store),
                        setBackground: store.setBackground?.bind(store),
                        setActiveOverlays: store.setActiveOverlays?.bind(store),
                        completeQuestObjective: completeQuestObjectiveByKey,
                        completeSolicitud: store.completeSolicitud?.bind(store),
                      });
                      console.log(`[TriggerSystem] Executed threshold effect for ${threshold.attributeName}`);
                    } catch (err) {
                      console.error(`[TriggerSystem] Failed to execute threshold effect:`, err);
                    }
                  }
                }
              }
            }
          }
        }
        
        // 4. Solicitud Handler (for peticiones/solicitudes)
        if (config.statsEnabled !== false && character?.statsConfig?.enabled) {
          const hasPeticiones = character.statsConfig.invitations && character.statsConfig.invitations.length > 0;
          const hasPendingSolicitudes = activeSession?.sessionStats?.solicitudes?.characterSolicitudes?.[character.id]
            ?.some(s => s.status === 'pending');
          
          if (hasPeticiones || hasPendingSolicitudes) {
            if (solicitudHandler.canHandle(detectedKey, solicitudHandlerContext)) {
              const result = solicitudHandler.handleKey(detectedKey, solicitudHandlerContext);
              if (result?.matched) {
                console.log(`[TriggerSystem] Solicitud key matched: ${detectedKey.key}`);
                solicitudHandler.execute(result.trigger, solicitudHandlerContext);
              }
            }
          }
        }

        // 5. Background Handler
        if (config.backgroundEnabled !== false && settings.backgroundTriggers?.enabled) {
          if (backgroundHandler.canHandle(detectedKey, backgroundKeyHandlerContext)) {
            const result = backgroundHandler.handleKey(detectedKey, backgroundKeyHandlerContext);
            if (result?.matched) {
              console.log(`[TriggerSystem] Background key matched: ${detectedKey.key}`);
              backgroundHandler.execute(result.trigger, backgroundKeyHandlerContext);
            }
          }
        }

        // 6. HUD Handler
        if (config.hudEnabled !== false && hudKeyHandlerContext) {
          if (hudHandler.canHandle(detectedKey, hudKeyHandlerContext)) {
            const result = hudHandler.handleKey(detectedKey, hudKeyHandlerContext);
            if (result?.matched) {
              console.log(`[TriggerSystem] HUD key matched: ${detectedKey.key}`);
              hudHandler.execute(result.trigger, hudKeyHandlerContext);
            }
          }
        }

        // 7. Quest Handler
        if (config.questEnabled !== false && store.questSettings?.enabled) {
          if (questHandler.canHandle(detectedKey, questKeyHandlerContext)) {
            const result = questHandler.handleKey(detectedKey, questKeyHandlerContext);
            if (result?.matched) {
              console.log(`[TriggerSystem] Quest key matched: ${detectedKey.key}`);
              questHandler.execute(result.trigger, questKeyHandlerContext);
            }
          }
        }

        // 8. Stats Handler
        if (config.statsEnabled !== false && character?.statsConfig?.enabled) {
          if (statsHandler.canHandle(detectedKey, statsKeyHandlerContext)) {
            const result = statsHandler.handleKey(detectedKey, statsKeyHandlerContext);
            if (result?.matched) {
              console.log(`[TriggerSystem] Stats key matched: ${detectedKey.key}`);
              statsHandler.execute(result.trigger, statsKeyHandlerContext);
            }
          }
        }

        // 9. Item Handler
        if (config.inventoryEnabled !== false && store.inventorySettings?.enabled) {
          if (itemHandler.canHandle(detectedKey, itemKeyHandlerContext)) {
            const result = itemHandler.handleKey(detectedKey, itemKeyHandlerContext);
            if (result?.matched) {
              console.log(`[TriggerSystem] Item key matched: ${detectedKey.key}`);
              itemHandler.execute(result.trigger, itemKeyHandlerContext);
            }
          }
        }
      }

      // Reset handlers for next message (use characterMessageKey for correct tracking)
      soundHandler.reset(characterMessageKey);
      spriteHandler.reset(characterMessageKey);
      backgroundHandler.reset(characterMessageKey);
      hudHandler.reset(characterMessageKey);
      questHandler.reset(characterMessageKey);
      statsHandler.reset(characterMessageKey);
      itemHandler.reset(characterMessageKey);
    }
    
    // ============================================
    // PROCESS Solicitud triggers FIRST (before token-based early return)
    // This is critical because the TokenDetector may not detect peticion/solicitud keys
    // but we still need to process them for the peticiones/solicitudes system
    // ============================================
    console.log(`[TriggerSystem] Checking solicitud conditions`, {
      statsEnabled: config.statsEnabled !== false,
      characterStatsEnabled: character?.statsConfig?.enabled,
      hasInvitations: character?.statsConfig?.invitations?.length,
    });

    if (config.statsEnabled !== false) {
      const activeSession = store.getActiveSession?.();
      const sessionId = store.activeSessionId || '';

      // Only process for the speaking character
      if (character?.statsConfig?.enabled) {
        const hasPeticiones = character.statsConfig.invitations && character.statsConfig.invitations.length > 0;
        const hasPendingSolicitudes = activeSession?.sessionStats?.solicitudes?.characterSolicitudes?.[character.id]
          ?.some(s => s.status === 'pending');

        console.log(`[TriggerSystem] Solicitud check for ${character.name}`, {
          hasPeticiones,
          hasPendingSolicitudes,
          invitationsCount: character.statsConfig.invitations?.length,
          invitations: character.statsConfig.invitations?.map(i => ({ key: i.peticionKey, target: i.objetivo })),
        });

        if (hasPeticiones || hasPendingSolicitudes) {
          // Include persona as pseudo-character for peticiones targeting __user__
          const allCharactersWithPersona = [
            ...(characters || []),
            ...(config.activePersona?.statsConfig?.enabled ? [{
              id: '__user__',
              name: config.activePersona.name || 'User',
              statsConfig: config.activePersona.statsConfig,
            }] as CharacterCard[] : []),
          ];
          
          const solicitudContext: SolicitudTriggerContext = {
            ...context,
            characterId: character.id,
            characterName: character.name,
            statsConfig: character.statsConfig,
            sessionStats: activeSession?.sessionStats,
            sessionId,
            allCharacters: allCharactersWithPersona,
            activePersona: config.activePersona,
          };

          const solicitudResult = checkSolicitudTriggersInText(
            content,
            solicitudContext,
            solicitudHandlerState,
            {
              createSolicitud: store.createSolicitud.bind(store),
              completeSolicitud: store.completeSolicitud.bind(store),
              getSessionStats: (sessionId: string) => {
                const session = store.sessions?.find((s: any) => s.id === sessionId);
                return session?.sessionStats || null;
              },
            }
          );

          if (solicitudResult.matched && solicitudResult.processingResult) {
            const { activations, completions } = solicitudResult.processingResult;
            
            if (activations.length > 0) {
              console.log(`[TriggerSystem] Peticiones activated for ${character.name}: ${activations.filter(a => a.activated).map(a => a.peticionKey).join(', ')}`);
            }
            
            if (completions.length > 0) {
              console.log(`[TriggerSystem] Solicitudes completed for ${character.name}: ${completions.filter(c => c.completed).map(c => c.solicitudKey).join(', ')}`);
            }
          }
        }
      }
    }
    
    // ============================================
    // TOKEN-BASED TRIGGERS (sound, sprite, etc.)
    // These use the TokenDetector for pattern matching
    // ============================================
    const detector = getTokenDetector();
    
    // Process incrementally - get only NEW tokens
    const newTokens = detector.processIncremental(content, messageKey);
    
    if (newTokens.length === 0) {
      return;
    }
    
    // ============================================
    // NOTE: Sound and Sprite are now handled by the UNIFIED KeyHandlers above
    // The legacy processing below has been removed to avoid double-processing
    // ============================================
    
    // Process HUD triggers
    if (config.hudEnabled !== false) {
      const activeHUDTemplate = getActiveHUDTemplate();
      
      if (activeHUDTemplate) {
        const hudContext: HUDTriggerContext = {
          ...context,
          activeHUDTemplate,
          currentValues: store.hudSessionState.fieldValues,
        };
        
        const hudResult = checkHUDTriggers(
          newTokens,
          hudContext,
          hudHandlerState
        );
        
        if (hudResult?.matched && hudResult.trigger) {
          executeHUDTrigger(hudResult.trigger, context, {
            updateHUDFieldValue: store.updateHUDFieldValue.bind(store),
          });
        }
      }
    }
    
    // Process Background triggers - Use Multi version for multiple background changes
    if (config.backgroundEnabled !== false && settings.backgroundTriggers?.enabled) {
      const bgContext: BackgroundTriggerContext = {
        ...context,
        backgroundPacks: store.backgroundTriggerPacks ?? [],
        backgroundCollections: store.backgroundCollections ?? [],
        backgroundSettings: {
          enabled: settings.backgroundTriggers?.enabled ?? false,
          globalCooldown: settings.backgroundTriggers?.globalCooldown ?? 0,
          transitionDuration: settings.backgroundTriggers?.transitionDuration ?? 500,
          defaultTransitionType: (settings.backgroundTriggers?.defaultTransitionType as BackgroundTransitionType) ?? 'fade',
          returnToDefaultEnabled: settings.backgroundTriggers?.returnToDefaultEnabled ?? false,
          returnToDefaultAfter: settings.backgroundTriggers?.returnToDefaultAfter ?? 300000,
          defaultBackgroundUrl: settings.backgroundTriggers?.defaultBackgroundUrl ?? '',
          globalOverlays: (settings.backgroundTriggers?.globalOverlays as BackgroundOverlay[]) ?? [],
        },
        cooldownContextKey: character?.id || 'default',
      };
      
      // Use Multi version to detect ALL background matches in order of appearance
      const bgResult = checkBackgroundTriggersMulti(
        newTokens,
        bgContext,
        backgroundHandlerState
      );
      
      if (bgResult?.matched && bgResult.triggers.length > 0) {
        executeAllBackgroundTriggers(bgResult, context, {
          setBackground: store.setBackground.bind(store),
          setOverlays: store.setActiveOverlays.bind(store),
        });
      }
    }
    
    // Process Quest triggers (New Template/Instance System)
    if (config.questEnabled !== false && store.questSettings?.enabled) {
      const activeSession = store.getActiveSession?.();
      const sessionId = store.activeSessionId || '';
      
      // Get templates and session quest instances
      const templates = store.questTemplates || [];
      const sessionQuests = activeSession?.sessionQuests || [];
      const turnCount = activeSession?.turnCount || 0;
      
      // Only process if we have quests in this session
      if (templates.length > 0 || sessionQuests.length > 0) {
        const questContext: QuestTriggerContext = {
          ...context,
          templates,
          sessionQuests,
          questSettings: store.questSettings,
          sessionId,
          turnCount,
        };
        
        const questResult = checkQuestTriggers(
          newTokens,
          content,
          questContext,
          questHandlerState
        );
        
        if (questResult.hits.length > 0) {
          // Process quest trigger hits
          for (const hit of questResult.hits) {
            console.log(`[TriggerSystem] Quest trigger: ${hit.message}`);
            
            // Handle different quest actions
            switch (hit.action) {
              case 'activate':
                // Activate a quest in the session
                store.activateQuest(sessionId, hit.questId);
                break;
                
              case 'progress':
                // Progress an objective
                if (hit.questId && hit.objectiveId) {
                  // Check quest status BEFORE progressing (to detect auto-completion)
                  const questBefore = activeSession?.sessionQuests?.find(
                    (q: { templateId: string; status: string }) => q.templateId === hit.questId
                  );
                  const wasActive = questBefore?.status === 'active';
                  
                  store.progressQuestObjective(
                    sessionId,
                    hit.questId,
                    hit.objectiveId,
                    hit.progress || 1,
                    character?.id
                  );
                  
                  // Execute objective rewards if this progress completes the objective
                  if (hit.completesObjective && hit.objectiveRewards && hit.objectiveRewards.length > 0) {
                    console.log(`[TriggerSystem] Objective completed! Executing ${hit.objectiveRewards.length} rewards`);
                    
                    const objectiveRewardContext = {
                      sessionId,
                      characterId: character?.id || '',
                      character,
                      allCharacters: characters, // Para targetMode en group chats
                      sessionStats: activeSession?.sessionStats,
                      timestamp: Date.now(),
                      // Pass resources for trigger lookup
                      soundCollections: store.soundCollections,
                      soundTriggers: store.soundTriggers,
                      soundSequenceTriggers: store.soundSequenceTriggers,
                      backgroundPacks: store.backgroundTriggerPacks,
                      soundSettings: {
                        enabled: settings.sound?.enabled ?? false,
                        globalVolume: settings.sound?.globalVolume ?? 0.85,
                      },
                      backgroundSettings: {
                        transitionDuration: settings.backgroundTriggers?.transitionDuration ?? 500,
                        defaultTransitionType: settings.backgroundTriggers?.defaultTransitionType ?? 'fade',
                      },
                    };
                    
                    const rewardActions: RewardStoreActions = {
                      updateCharacterStat: store.updateCharacterStat.bind(store),
                      applyTriggerForCharacter: store.applyTriggerForCharacter?.bind(store),
                      scheduleReturnToIdleForCharacter: store.scheduleReturnToIdleForCharacter?.bind(store),
                      isSpriteLocked: store.isSpriteLocked?.bind(store),
                      playSound: store.playSound?.bind(store),
                      setBackground: store.setBackground?.bind(store),
                      setActiveOverlays: store.setActiveOverlays?.bind(store),
                    };
                    
                    const objectiveRewardResult = executeObjectiveRewards(
                      hit.objectiveRewards,
                      objectiveRewardContext,
                      rewardActions
                    );
                    
                    console.log(
                      `[TriggerSystem] Objective "${hit.objective?.description}" rewards: ${objectiveRewardResult.successCount} succeeded, ${objectiveRewardResult.failureCount} failed`
                    );
                    
                    // Add notification for objective rewards
                    if (objectiveRewardResult.successCount > 0 && store.questSettings.showNotifications) {
                      const rewardMessages = objectiveRewardResult.results
                        .filter(r => r.success)
                        .map(r => r.message)
                        .filter(Boolean);
                      
                      if (rewardMessages.length > 0) {
                        store.addQuestNotification({
                          questId: hit.questId,
                          questName: hit.template?.name || 'Quest',
                          type: 'objective_complete',
                          message: `Objective "${hit.objective?.description}" completed! Rewards: ${rewardMessages.join(', ')}`,
                          rewards: hit.objectiveRewards,
                        });
                      }
                    }
                  }
                  
                  // Check if quest was auto-completed (was active before, now completed)
                  // Get the updated session to check quest status
                  const updatedSession = store.getActiveSession?.();
                  const questAfter = updatedSession?.sessionQuests?.find(
                    (q: { templateId: string; status: string }) => q.templateId === hit.questId
                  );
                  const isNowCompleted = questAfter?.status === 'completed';
                  
                  if (wasActive && isNowCompleted && hit.template?.rewards && hit.template.rewards.length > 0) {
                    console.log(`[TriggerSystem] Quest auto-completed! Executing ${hit.template.rewards.length} quest rewards`);
                    
                    const questRewardContext = {
                      sessionId,
                      characterId: character?.id || '',
                      character,
                      allCharacters: characters, // Para targetMode en group chats
                      sessionStats: updatedSession?.sessionStats,
                      timestamp: Date.now(),
                      // Pass resources for trigger lookup
                      soundCollections: store.soundCollections,
                      soundTriggers: store.soundTriggers,
                      soundSequenceTriggers: store.soundSequenceTriggers,
                      backgroundPacks: store.backgroundTriggerPacks,
                      soundSettings: {
                        enabled: settings.sound?.enabled ?? false,
                        globalVolume: settings.sound?.globalVolume ?? 0.85,
                      },
                      backgroundSettings: {
                        transitionDuration: settings.backgroundTriggers?.transitionDuration ?? 500,
                        defaultTransitionType: settings.backgroundTriggers?.defaultTransitionType ?? 'fade',
                      },
                    };
                    
                    const questRewardActions: RewardStoreActions = {
                      updateCharacterStat: store.updateCharacterStat.bind(store),
                      applyTriggerForCharacter: store.applyTriggerForCharacter?.bind(store),
                      scheduleReturnToIdleForCharacter: store.scheduleReturnToIdleForCharacter?.bind(store),
                      isSpriteLocked: store.isSpriteLocked?.bind(store),
                      playSound: store.playSound?.bind(store),
                      setBackground: store.setBackground?.bind(store),
                      setActiveOverlays: store.setActiveOverlays?.bind(store),
                    };
                    
                    const questRewardResult = executeQuestCompletionRewards(
                      hit.template,
                      questRewardContext,
                      questRewardActions
                    );
                    
                    console.log(
                      `[TriggerSystem] Quest "${hit.template.name}" auto-completion rewards: ${questRewardResult.successCount} succeeded, ${questRewardResult.failureCount} failed`
                    );
                    
                    // Add quest completion notification with rewards
                    if (store.questSettings.showNotifications) {
                      const rewardMessages = questRewardResult.results
                        .filter(r => r.success)
                        .map(r => r.message)
                        .filter(Boolean);
                      
                      store.addQuestNotification({
                        questId: hit.questId,
                        questName: hit.template.name,
                        type: 'quest_complete',
                        message: `¡Misión completada: ${hit.template.name}!${rewardMessages.length > 0 ? ` Recompensas: ${rewardMessages.join(', ')}` : ''}`,
                        rewards: hit.template.rewards,
                      });
                    }
                  }
                }
                break;
                
              case 'complete':
                if (hit.questId) {
                  // Complete the quest
                  store.completeQuest(sessionId, hit.questId, character?.id);
                  
                  // Execute rewards if template has them
                  if (hit.template?.rewards && hit.template.rewards.length > 0) {
                    const rewardContext = {
                      sessionId,
                      characterId: character?.id || '',
                      character,
                      allCharacters: characters, // Para targetMode en group chats
                      sessionStats: activeSession?.sessionStats,
                      timestamp: Date.now(),
                      // Pass resources for trigger lookup
                      soundCollections: store.soundCollections,
                      soundTriggers: store.soundTriggers,
                      soundSequenceTriggers: store.soundSequenceTriggers,
                      backgroundPacks: store.backgroundTriggerPacks,
                      soundSettings: {
                        enabled: settings.sound?.enabled ?? false,
                        globalVolume: settings.sound?.globalVolume ?? 0.85,
                      },
                      backgroundSettings: {
                        transitionDuration: settings.backgroundTriggers?.transitionDuration ?? 500,
                        defaultTransitionType: settings.backgroundTriggers?.defaultTransitionType ?? 'fade',
                      },
                    };
                    
                    const rewardActions: RewardStoreActions = {
                      updateCharacterStat: store.updateCharacterStat.bind(store),
                      applyTriggerForCharacter: store.applyTriggerForCharacter?.bind(store),
                      scheduleReturnToIdleForCharacter: store.scheduleReturnToIdleForCharacter?.bind(store),
                      isSpriteLocked: store.isSpriteLocked?.bind(store),
                      playSound: store.playSound?.bind(store),
                      setBackground: store.setBackground?.bind(store),
                      setActiveOverlays: store.setActiveOverlays?.bind(store),
                    };
                    
                    const rewardResult = executeQuestCompletionRewards(
                      hit.template,
                      rewardContext,
                      rewardActions
                    );
                    
                    console.log(
                      `[TriggerSystem] Quest "${hit.template.name}" rewards: ${rewardResult.successCount} succeeded, ${rewardResult.failureCount} failed`
                    );
                    
                    // Add reward info to notification
                    if (rewardResult.successCount > 0 && store.questSettings.showNotifications) {
                      const rewardMessages = rewardResult.results
                        .filter(r => r.success)
                        .map(r => r.message)
                        .filter(Boolean);
                      
                      if (rewardMessages.length > 0) {
                        store.addQuestNotification({
                          questId: hit.questId,
                          questName: hit.template.name,
                          type: 'reward_claimed',
                          message: `Rewards: ${rewardMessages.join(', ')}`,
                          rewards: hit.template.rewards,
                        });
                      }
                    }
                  }
                }
                break;
                
              case 'fail':
                if (hit.questId) {
                  store.failQuest(sessionId, hit.questId);
                }
                break;
            }
            
            // Add notification for quest events (except complete and progress with rewards which are handled separately)
            // Only add notification if:
            // - action is 'activate' or 'fail'
            // - action is 'progress' but doesn't complete objective (no rewards)
            if (store.questSettings.showNotifications) {
              if (hit.action === 'activate') {
                store.addQuestNotification({
                  questId: hit.questId,
                  questName: hit.template?.name || 'Quest',
                  type: 'quest_activated',
                  message: hit.message,
                });
              } else if (hit.action === 'fail') {
                store.addQuestNotification({
                  questId: hit.questId,
                  questName: hit.template?.name || 'Quest',
                  type: 'quest_failed',
                  message: hit.message,
                });
              } else if (hit.action === 'progress' && !hit.completesObjective) {
                // Only notify for progress that doesn't complete objective
                // Progress that completes objective already notified with rewards above
                store.addQuestNotification({
                  questId: hit.questId,
                  questName: hit.template?.name || 'Quest',
                  type: 'objective_complete',
                  message: hit.message,
                });
              }
            }
          }
        }
      }
    }
    
    // Process Item triggers
    if (config.inventoryEnabled !== false && store.inventorySettings?.enabled) {
      const defaultContainer = store.containers.find(c => c.isDefault);
      
      const itemContext: ItemTriggerContext = {
        ...context,
        items: store.items,
        inventoryEntries: defaultContainer?.entries || [],
        inventorySettings: store.inventorySettings,
        defaultContainerId: defaultContainer?.id || '',
      };
      
      const itemResult = checkItemTriggers(
        newTokens,
        content,
        itemContext,
        itemHandlerState
      );
      
      if (itemResult.hits.length > 0) {
        // Process item trigger hits
        for (const hit of itemResult.hits) {
          console.log(`[TriggerSystem] Item trigger: ${hit.message}`);
          
          switch (hit.type) {
            case 'add':
              store.addToInventory(hit.itemId, hit.quantity);
              break;
            case 'remove':
              // Find the entry to remove
              const entryToRemove = defaultContainer?.entries.find(e => e.itemId === hit.itemId);
              if (entryToRemove) {
                store.removeFromInventory(entryToRemove.id, hit.quantity);
              }
              break;
            case 'equip':
              const entryToEquip = defaultContainer?.entries.find(e => e.itemId === hit.itemId);
              if (entryToEquip && hit.item?.slot) {
                store.equipItem(entryToEquip.id, hit.item.slot);
              }
              break;
          }
          
          // Add notification if enabled
          if (store.inventorySettings.showNotifications) {
            store.addInventoryNotification({
              type: hit.type,
              itemName: hit.item?.name || 'Item',
              quantity: hit.quantity,
              message: hit.message,
            });
          }
        }
      }
    }
    
    // Process Stats triggers (Character Attributes)
    // IMPORTANT: Only process stats for the SPEAKING character (the one in `character` parameter)
    // This prevents conflicts when multiple characters have the same attribute key
    if (config.statsEnabled !== false) {
      const activeSession = store.getActiveSession?.();
      const sessionId = store.activeSessionId || '';

      // Only process stats for the speaking character
      // In group chats, `character` is the current speaker, not all characters
      if (character?.statsConfig?.enabled) {
        const statsContext: StatsTriggerContext = {
          ...context,
          characterId: character.id,
          statsConfig: character.statsConfig,
          sessionStats: activeSession?.sessionStats,
        };

        const statsResult = checkStatsTriggersInText(
          content,
          statsContext,
          statsHandlerState
        );

        if (statsResult.matched && statsResult.trigger) {
          const hits = executeStatsTrigger(statsResult.trigger, context, {
            updateCharacterStat: store.updateCharacterStat.bind(store),
            activeSessionId: sessionId,
          });

          if (hits.length > 0) {
            console.log(`[TriggerSystem] Stats updated for ${character.name} (${character.id}): ${hits.map(h => `${h.attributeName}=${h.newValue}`).join(', ')}`);
          }
        }
      }
    }
    
    // ============================================
    // LEGACY: Skill Activation triggers - DISABLED
    // Now handled by SkillKeyHandler in the unified system above
    // ============================================
    // if (config.statsEnabled !== false) {
    //   ... legacy skill activation code removed ...
    // }
  }, [config, settings, store, soundHandlerState, spriteHandlerState, hudHandlerState, backgroundHandlerState, questHandlerState, itemHandlerState, statsHandlerState, skillActivationHandlerState, solicitudHandlerState, getActiveHUDTemplate, soundHandler, spriteHandler, skillHandler, solicitudHandler, backgroundHandler, hudHandler, questHandler, statsHandler, itemHandler]);
  
  /**
   * Process full content at once (non-streaming)
   */
  const processFullContent = useCallback((
    content: string,
    character: CharacterCard | null,
    messageKey: string,
    characters?: CharacterCard[]
  ) => {
    const detector = getTokenDetector();
    
    // Reset and process full content
    detector.reset(messageKey);
    lastProcessedRef.current.set(messageKey, content);
    
    // Process as streaming content (same logic)
    processStreamingContent(content, character, messageKey, characters);
  }, [processStreamingContent]);
  
  /**
   * Complete any pending partial matches and process them
   * This should be called when streaming ends to capture key:value pairs at end of text
   */
  const completePartialMatches = useCallback((
    messageKey: string, 
    character: CharacterCard | null,
    characters?: CharacterCard[]
  ): DetectedKey | null => {
    const keyDetector = getKeyDetector();
    
    // Create characterMessageKey with same logic as processStreamingContent
    let characterMessageKey: string;
    if (character?.id) {
      // Check if messageKey already ends with the characterId (group chat case)
      if (messageKey.endsWith(`_${character.id}`)) {
        characterMessageKey = messageKey;
      } else {
        characterMessageKey = `${messageKey}_${character.id}`;
      }
    } else {
      characterMessageKey = messageKey;
    }
    
    // Complete any pending partial match
    const completedKey = keyDetector.completePartialMatch(characterMessageKey);
    
    if (completedKey) {
      console.log(`[TriggerSystem] Completed partial match:`, {
        key: completedKey.key,
        value: completedKey.value,
        format: completedKey.format,
        characterId: character?.id,
      });
      
      // Process the completed key through handlers
      const sessionId = store.activeSessionId || '';
      const activeSession = store.getActiveSession?.();
      
      // Include persona as pseudo-character for peticiones targeting __user__
      const allCharactersWithPersona = [
        ...(characters || []),
        ...(config.activePersona?.statsConfig?.enabled ? [{
          id: '__user__',
          name: config.activePersona.name || 'User',
          statsConfig: config.activePersona.statsConfig,
        }] as CharacterCard[] : []),
      ];
      
      // Build context for sprite handler (most common case for key:value)
      const spriteKeyHandlerContext: SpriteKeyHandlerContext = {
        character,
        characters,
        characterId: character?.id,
        messageKey,
        fullText: '',
        isStreaming: false,
        timestamp: Date.now(),
        sessionId,
        allCharacters: characters,
        triggerCollections: character?.triggerCollections ?? [],
        spritePacksV2: character?.spritePacksV2 ?? store.spritePacksV2 ?? [],
        stateCollectionsV2: character?.stateCollectionsV2,
        spritePacks: character?.spritePacks ?? store.spritePacks ?? [],
        spriteTriggers: character?.spriteTriggers ?? [],
        spriteIndex: store.spriteIndex,
        isSpriteLocked: store.isSpriteLocked?.() ?? false,
        applyTriggerForCharacter: store.applyTriggerForCharacter?.bind(store),
        scheduleReturnToIdleForCharacter: store.scheduleReturnToIdleForCharacter?.bind(store),
        addTriggerToQueue: store.addTriggerToQueue?.bind(store),
        startSpriteChain: store.startSpriteChain?.bind(store),
        startSoundChain: store.startSoundChain?.bind(store),
      };
      
      const soundKeyHandlerContext: SoundKeyHandlerContext = {
        character,
        characters,
        characterId: character?.id,
        messageKey,
        fullText: '',
        isStreaming: false,
        timestamp: Date.now(),
        sessionId,
        soundTriggers: store.soundTriggers,
        soundCollections: store.soundCollections,
        soundSequenceTriggers: store.soundSequenceTriggers,
        soundSettings: {
          enabled: settings.sound?.enabled ?? false,
          globalVolume: settings.sound?.globalVolume ?? 0.85,
          globalCooldown: settings.sound?.globalCooldown ?? 0,
        },
        cooldownContextKey: character?.id || 'default',
        playSound: store.playSound?.bind(store),
      };
      
      // Process through handlers
      const spriteHandler = createSpriteKeyHandler();
      const soundHandler = createSoundKeyHandler(config.maxSoundsPerMessage ?? 10);
      
      // Try sprite handler first
      if (config.spriteEnabled !== false) {
        if (spriteHandler.canHandle(completedKey, spriteKeyHandlerContext)) {
          const result = spriteHandler.handleKey(completedKey, spriteKeyHandlerContext);
          if (result?.matched) {
            console.log(`[TriggerSystem] Completed partial match - Sprite key matched: ${completedKey.key}=${completedKey.value}`);
            spriteHandler.execute(result.trigger, spriteKeyHandlerContext);
          }
        }
      }
      
      // Try sound handler
      if (config.soundEnabled !== false && settings.sound?.enabled) {
        if (soundHandler.canHandle(completedKey, soundKeyHandlerContext)) {
          const result = soundHandler.handleKey(completedKey, soundKeyHandlerContext);
          if (result?.matched) {
            console.log(`[TriggerSystem] Completed partial match - Sound key matched: ${completedKey.key}=${completedKey.value}`);
            soundHandler.execute(result.trigger, soundKeyHandlerContext);
          }
        }
      }
    }
    
    return completedKey;
  }, [config, store, settings]);
  
  /**
   * Reset for new message
   */
  const resetForNewMessage = useCallback((messageKey: string, character: CharacterCard | null, characters?: CharacterCard[]) => {
    // First, complete any pending partial matches
    completePartialMatches(messageKey, character, characters);
    
    // Create characterMessageKey for resetting with same logic as processStreamingContent
    let characterMessageKey: string;
    if (character?.id) {
      // Check if messageKey already ends with the characterId (group chat case)
      if (messageKey.endsWith(`_${character.id}`)) {
        characterMessageKey = messageKey;
      } else {
        characterMessageKey = `${messageKey}_${character.id}`;
      }
    } else {
      characterMessageKey = messageKey;
    }
    
    console.log(`[TriggerSystem] resetForNewMessage using characterMessageKey: ${characterMessageKey}`);
    
    // Reset unified KeyDetector
    const keyDetector = getKeyDetector();
    keyDetector.reset(characterMessageKey);
    
    // Reset legacy TokenDetector
    const tokenDetector = getTokenDetector();
    tokenDetector.reset(messageKey);
    
    // Get sessionId for quest handler reset
    const sessionId = store.activeSessionId || undefined;
    
    // Reset handlers
    resetSoundHandlerState(soundHandlerState, messageKey);
    resetSpriteHandlerState(spriteHandlerState, messageKey);
    resetHUDHandlerState(hudHandlerState, messageKey);
    resetBackgroundHandlerState(backgroundHandlerState, messageKey);
    resetQuestHandlerState(questHandlerState, messageKey, sessionId);
    resetItemHandlerState(itemHandlerState, messageKey);
    resetStatsHandlerState(statsHandlerState, character?.id || '', messageKey);
    resetSkillActivationState(skillActivationHandlerState, messageKey);
    resetSolicitudHandlerState(solicitudHandlerState, character?.id || '', messageKey);
    
    // Clear last processed
    lastProcessedRef.current.delete(messageKey);
    
    // Emit message end event
    const bus = getTriggerBus();
    bus.emit(createMessageEndEvent(messageKey, character, ''));
  }, [soundHandlerState, spriteHandlerState, hudHandlerState, backgroundHandlerState, questHandlerState, itemHandlerState, statsHandlerState, skillActivationHandlerState, solicitudHandlerState, store.activeSessionId, completePartialMatches]);
  
  /**
   * Clear ALL trigger state - call this when chat is reset
   * This clears all detection states so quests can be re-activated
   */
  const clearAllState = useCallback(() => {
    // Clear unified KeyDetector
    getKeyDetector().clearAll();
    
    // Clear all handler states
    clearSoundHandlerState(soundHandlerState);
    clearSpriteHandlerState(spriteHandlerState);
    clearHUDHandlerState(hudHandlerState);
    clearBackgroundHandlerState(backgroundHandlerState);
    clearQuestHandlerState(questHandlerState);
    clearItemHandlerState(itemHandlerState);
    clearStatsHandlerState(statsHandlerState);
    clearSkillActivationHandlerState(skillActivationHandlerState);
    clearSolicitudHandlerState(solicitudHandlerState);
    
    // Clear processed tracking
    lastProcessedRef.current.clear();
    
    console.log('[TriggerSystem] All state cleared');
  }, [soundHandlerState, spriteHandlerState, hudHandlerState, backgroundHandlerState, questHandlerState, itemHandlerState, statsHandlerState, skillActivationHandlerState, solicitudHandlerState]);
  
  return {
    processStreamingContent,
    processFullContent,
    completePartialMatches,
    resetForNewMessage,
    clearAllState,
    isEnabled: true,
  };
}

// ============================================
// Export Everything
// ============================================

export { getTokenDetector, getTriggerBus };
export * from './token-detector';
export * from './trigger-bus';
export * from './types';
