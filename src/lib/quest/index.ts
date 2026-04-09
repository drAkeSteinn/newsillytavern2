// ============================================
// Quest Module Index
// ============================================
//
// NOTE: Storage functions (quest-storage.ts) are NOT exported here because
// they use Node.js 'fs' module and can only run on the server.
// Use the API routes (/api/quest-templates) or the store (questTemplateSlice) instead.

// Detection functions
export {
  // Key extraction
  getActivationKeys,
  getCompletionKeys,
  getObjectiveKeys,
  
  // Prefix key helpers
  generatePrefixKeyVariants,
  applyPrefixToKeys,
  getActivationKeysWithPrefix,
  getCompletionKeysWithPrefix,
  getObjectiveKeysWithPrefix,
  getExampleKey,
  
  // Detection
  detectQuestActivations,
  detectObjectiveProgress,
  detectQuestCompletions,
  detectQuestEvents,
  checkTurnBasedActivation,
  
  // Convert to trigger hits
  activationsToTriggerHits,
  objectivesToTriggerHits,
  completionsToTriggerHits,
  
  // Streaming support
  QuestDetectionState,
  createQuestDetectionState,
  
  // Trigger system integration
  checkQuestTriggersInText,
  resetQuestDetectorState,
  clearQuestDetectorState,
  
  // Chain helpers
  getNextQuestInChain,
  shouldAutoStartChain,
  
  // Types
  type QuestDetectionAction,
  type QuestActivationDetection,
  type QuestObjectiveDetection,
  type QuestCompletionDetection,
  type QuestDetectionResult,
  type QuestTriggerContext,
  type QuestHandlerResult,
} from './quest-detector';

// Reward execution functions
export {
  // Condition evaluation
  evaluateRewardCondition,
  
  // Attribute helpers
  calculateNewAttributeValue,
  
  // Individual reward execution
  executeAttributeReward,
  executeReward,
  
  // Batch execution
  executeAllRewards,
  executeQuestCompletionRewards,
  
  // Types
  type RewardExecutionContext,
  type RewardExecutionResult,
  type RewardBatchResult,
  type RewardStoreActions,
} from './quest-reward-executor';

// Re-export types from @/types
export type {
  QuestTemplate,
  SessionQuestInstance,
  QuestObjectiveTemplate,
  QuestReward,
  QuestRewardType,
  QuestRewardCondition,
  QuestRewardAttribute,
  QuestRewardTrigger,
  TriggerTargetMode,
  TriggerCategory,
  AttributeAction,
  QuestStatus,
  QuestPriority,
  QuestObjectiveType,
  QuestActivationConfig,
  QuestCompletionConfig,
  QuestChainConfig,
  QuestSettings,
  QuestTriggerHit,
  QuestNotification,
  DEFAULT_QUEST_SETTINGS,
} from '@/types';

// Re-export reward utilities
export {
  // Factory functions
  createAttributeReward,
  createTriggerReward,
  
  // Migration functions
  migrateRewardToNewFormat,
  migrateRewardsToNewFormat,
  
  // Validation functions
  validateReward,
  validateRewards,
  
  // Utility functions
  getActionSymbol,
  getCategoryIcon,
  getTargetModeLabel,
  describeReward,
  describeRewards,
  
  // Normalization functions
  normalizeReward,
  normalizeRewards,
} from './quest-reward-utils';
