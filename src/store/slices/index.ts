// ============================================
// Slices Index - Export all slices
// ============================================

// Export types (interfaces)
export type { CharacterSlice } from './characterSlice';
export type { SessionSlice } from './sessionSlice';
export type { GroupSlice } from './groupSlice';
export type { LLMSlice } from './llmSlice';
export type { SettingsSlice } from './settingsSlice';
export type { LorebookSlice } from './lorebookSlice';
export type { PersonaSlice } from './personaSlice';
export type { BackgroundSlice } from './backgroundSlice';
export type { SoundSlice } from './soundSlice';
export type { UISlice } from './uiSlice';
export type { SpriteSlice } from './spriteSlice';
export type { HUDSlice } from './hudSlice';
export type { AtmosphereSlice } from './atmosphereSlice';
export type { MemorySlice } from './memorySlice';
export type { QuestSlice } from './questSlice';
export type { DialogueSlice } from './dialogueSlice';
export type { InventorySlice } from './inventorySlice';
export type { StatsSlice } from './statsSlice';

// Export slice creators and other values
export { createCharacterSlice } from './characterSlice';
export { createSessionSlice } from './sessionSlice';
export { createGroupSlice } from './groupSlice';
export { createLLMSlice } from './llmSlice';
export { createSettingsSlice } from './settingsSlice';
export { createLorebookSlice } from './lorebookSlice';
export { createPersonaSlice } from './personaSlice';
export { createBackgroundSlice } from './backgroundSlice';
export { createSoundSlice } from './soundSlice';
export { createUISlice } from './uiSlice';
export { createSpriteSlice, setReturnToIdleCallback } from './spriteSlice';
export type { CharacterSpriteState } from './spriteSlice';
export { createHUDSlice } from './hudSlice';
export { createAtmosphereSlice, DEFAULT_ATMOSPHERE_LAYERS, DEFAULT_ATMOSPHERE_PRESETS, DEFAULT_ATMOSPHERE_SETTINGS } from './atmosphereSlice';
export { createMemorySlice, DEFAULT_SUMMARY_SETTINGS } from './memorySlice';
export type { SessionSummaryTracking } from './memorySlice';
export { createQuestSlice, DEFAULT_QUEST_SETTINGS } from './questSlice';
export { createDialogueSlice, DEFAULT_DIALOGUE_SETTINGS } from './dialogueSlice';
export { createInventorySlice, DEFAULT_INVENTORY_SETTINGS, getRarityColor, getCategoryIcon } from './inventorySlice';
export { 
  createStatsSlice, 
  evaluateRequirement,
  evaluateRequirements,
  filterSkillsByRequirements,
  filterIntentionsByRequirements,
  filterInvitationsByRequirements
} from './statsSlice';
export { createQuestTemplateSlice } from './questTemplateSlice';
export type { QuestTemplateSlice } from './questTemplateSlice';

// Timeline Editor Slice (V3 - Keyframe-based sprite animation)
export { createTimelineEditorSlice, useTimelineEditorCollections, useTimelineEditorState, useSelectedCollection, useSelectedSprite } from './timelineEditorSlice';
export type { TimelineEditorSlice } from './timelineEditorSlice';
