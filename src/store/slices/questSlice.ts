// ============================================
// Quest Slice - State management for quest/mission system
// ============================================

import type { StateCreator } from 'zustand';
import {
  DEFAULT_QUEST_SETTINGS,
  type Quest,
  type QuestObjective,
  type QuestSettings,
  type QuestNotification,
  type QuestStatus,
  type QuestPriority,
  type QuestTrigger,
} from '@/types';

// Re-export for convenience
export { DEFAULT_QUEST_SETTINGS };

// ============================================
// Helper Functions
// ============================================

function createDefaultQuest(
  sessionId: string,
  title: string,
  description: string,
  priority: QuestPriority = 'side'
): Quest {
  return {
    id: `quest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    sessionId,
    title,
    description,
    status: 'active',
    priority,
    objectives: [],
    rewards: [],
    triggers: {
      startKeywords: [],
      completionKeywords: [],
      autoStart: false,
      autoComplete: true,
      trackProgress: true,
    },
    updatedAt: new Date().toISOString(),
    progress: 0,
    isHidden: false,
    isRepeatable: false,
  };
}

function calculateProgress(objectives: QuestObjective[]): number {
  if (objectives.length === 0) return 0;
  
  const requiredObjectives = objectives.filter(o => !o.isOptional);
  if (requiredObjectives.length === 0) return 100;
  
  const completedCount = requiredObjectives.filter(o => o.isCompleted).length;
  return Math.round((completedCount / requiredObjectives.length) * 100);
}

// ============================================
// Slice Type
// ============================================

export interface QuestSlice {
  // Quest State
  quests: Quest[];
  questSettings: QuestSettings;
  questNotifications: QuestNotification[];
  
  // Quest CRUD
  addQuest: (quest: Quest) => void;
  updateQuest: (id: string, updates: Partial<Quest>) => void;
  deleteQuest: (id: string) => void;
  getSessionQuests: (sessionId: string) => Quest[];
  getActiveQuests: (sessionId: string) => Quest[];
  getQuestById: (id: string) => Quest | undefined;
  
  // Quest Status Actions
  startQuest: (quest: Omit<Quest, 'id' | 'updatedAt' | 'progress' | 'status' | 'startedAt'>) => Quest;
  completeQuest: (id: string) => void;
  failQuest: (id: string) => void;
  pauseQuest: (id: string) => void;
  resumeQuest: (id: string) => void;
  
  // Objective Actions
  addObjective: (questId: string, objective: QuestObjective) => void;
  updateObjective: (questId: string, objectiveId: string, updates: Partial<QuestObjective>) => void;
  completeObjective: (questId: string, objectiveId: string) => void;
  progressObjective: (questId: string, objectiveId: string, amount: number) => void;
  removeObjective: (questId: string, objectiveId: string) => void;
  
  // Settings Actions
  setQuestSettings: (settings: Partial<QuestSettings>) => void;
  
  // Notification Actions
  addQuestNotification: (notification: Omit<QuestNotification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  clearQuestNotifications: () => void;
  getUnreadNotifications: () => QuestNotification[];
  
  // Utility
  clearSessionQuests: (sessionId: string) => void;
}

// ============================================
// Slice Creator
// ============================================

export const createQuestSlice: StateCreator<QuestSlice, [], [], QuestSlice> = (set, get) => ({
  // Initial State
  quests: [],
  questSettings: DEFAULT_QUEST_SETTINGS,
  questNotifications: [],
  
  // Quest CRUD
  addQuest: (quest) => set((state) => ({
    quests: [...state.quests, quest]
  })),
  
  updateQuest: (id, updates) => set((state) => ({
    quests: state.quests.map(q => 
      q.id === id ? { ...q, ...updates, updatedAt: new Date().toISOString() } : q
    )
  })),
  
  deleteQuest: (id) => set((state) => ({
    quests: state.quests.filter(q => q.id !== id)
  })),
  
  getSessionQuests: (sessionId) => {
    return get().quests.filter(q => q.sessionId === sessionId);
  },
  
  getActiveQuests: (sessionId) => {
    return get().quests.filter(q => 
      q.sessionId === sessionId && q.status === 'active'
    );
  },
  
  getQuestById: (id) => {
    return get().quests.find(q => q.id === id);
  },
  
  // Quest Status Actions
  startQuest: (questData) => {
    const quest: Quest = {
      ...questData,
      id: `quest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: 'active',
      progress: 0,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    set((state) => ({
      quests: [...state.quests, quest]
    }));
    
    // Add notification
    get().addQuestNotification({
      questId: quest.id,
      questTitle: quest.title,
      type: 'started',
      message: `Nueva misión iniciada: ${quest.title}`,
    });
    
    return quest;
  },
  
  completeQuest: (id) => set((state) => {
    const quest = state.quests.find(q => q.id === id);
    if (!quest) return state;
    
    // Add notification
    setTimeout(() => {
      get().addQuestNotification({
        questId: id,
        questTitle: quest.title,
        type: 'completed',
        message: `¡Misión completada: ${quest.title}!`,
      });
    }, 0);
    
    return {
      quests: state.quests.map(q => 
        q.id === id ? {
          ...q,
          status: 'completed' as QuestStatus,
          progress: 100,
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } : q
      )
    };
  }),
  
  failQuest: (id) => set((state) => {
    const quest = state.quests.find(q => q.id === id);
    if (!quest) return state;
    
    setTimeout(() => {
      get().addQuestNotification({
        questId: id,
        questTitle: quest.title,
        type: 'failed',
        message: `Misión fallida: ${quest.title}`,
      });
    }, 0);
    
    return {
      quests: state.quests.map(q => 
        q.id === id ? {
          ...q,
          status: 'failed' as QuestStatus,
          updatedAt: new Date().toISOString(),
        } : q
      )
    };
  }),
  
  pauseQuest: (id) => set((state) => ({
    quests: state.quests.map(q => 
      q.id === id ? {
        ...q,
        status: 'paused' as QuestStatus,
        updatedAt: new Date().toISOString(),
      } : q
    )
  })),
  
  resumeQuest: (id) => set((state) => ({
    quests: state.quests.map(q => 
      q.id === id ? {
        ...q,
        status: 'active' as QuestStatus,
        updatedAt: new Date().toISOString(),
      } : q
    )
  })),
  
  // Objective Actions
  addObjective: (questId, objective) => set((state) => ({
    quests: state.quests.map(q => 
      q.id === questId ? {
        ...q,
        objectives: [...q.objectives, objective],
        updatedAt: new Date().toISOString(),
      } : q
    )
  })),
  
  updateObjective: (questId, objectiveId, updates) => set((state) => ({
    quests: state.quests.map(q => 
      q.id === questId ? {
        ...q,
        objectives: q.objectives.map(o =>
          o.id === objectiveId ? { ...o, ...updates } : o
        ),
        updatedAt: new Date().toISOString(),
      } : q
    )
  })),
  
  completeObjective: (questId, objectiveId) => set((state) => {
    const quest = state.quests.find(q => q.id === questId);
    if (!quest) return state;
    
    const objective = quest.objectives.find(o => o.id === objectiveId);
    
    // Update objective and calculate new progress
    const updatedObjectives = quest.objectives.map(o =>
      o.id === objectiveId ? { ...o, isCompleted: true, currentCount: o.targetCount } : o
    );
    
    const newProgress = calculateProgress(updatedObjectives);
    const allCompleted = updatedObjectives.filter(o => !o.isOptional).every(o => o.isCompleted);
    
    // Add notification
    if (objective) {
      setTimeout(() => {
        get().addQuestNotification({
          questId,
          questTitle: quest.title,
          type: 'objective_complete',
          message: `Objetivo completado: ${objective.description}`,
        });
      }, 0);
    }
    
    return {
      quests: state.quests.map(q => 
        q.id === questId ? {
          ...q,
          objectives: updatedObjectives,
          progress: newProgress,
          status: allCompleted ? 'completed' as QuestStatus : q.status,
          completedAt: allCompleted ? new Date().toISOString() : q.completedAt,
          updatedAt: new Date().toISOString(),
        } : q
      )
    };
  }),
  
  progressObjective: (questId, objectiveId, amount) => set((state) => {
    const quest = state.quests.find(q => q.id === questId);
    if (!quest) return state;
    
    const objective = quest.objectives.find(o => o.id === objectiveId);
    if (!objective) return state;
    
    const newCount = Math.min(objective.currentCount + amount, objective.targetCount);
    const isNowCompleted = newCount >= objective.targetCount;
    
    const updatedObjectives = quest.objectives.map(o =>
      o.id === objectiveId ? { ...o, currentCount: newCount, isCompleted: isNowCompleted } : o
    );
    
    const newProgress = calculateProgress(updatedObjectives);
    const allCompleted = updatedObjectives.filter(o => !o.isOptional).every(o => o.isCompleted);
    
    return {
      quests: state.quests.map(q => 
        q.id === questId ? {
          ...q,
          objectives: updatedObjectives,
          progress: newProgress,
          status: allCompleted ? 'completed' as QuestStatus : q.status,
          completedAt: allCompleted ? new Date().toISOString() : q.completedAt,
          updatedAt: new Date().toISOString(),
        } : q
      )
    };
  }),
  
  removeObjective: (questId, objectiveId) => set((state) => {
    const quest = state.quests.find(q => q.id === questId);
    if (!quest) return state;
    
    const updatedObjectives = quest.objectives.filter(o => o.id !== objectiveId);
    const newProgress = calculateProgress(updatedObjectives);
    
    return {
      quests: state.quests.map(q => 
        q.id === questId ? {
          ...q,
          objectives: updatedObjectives,
          progress: newProgress,
          updatedAt: new Date().toISOString(),
        } : q
      )
    };
  }),
  
  // Settings Actions
  setQuestSettings: (settings) => set((state) => ({
    questSettings: { ...state.questSettings, ...settings }
  })),
  
  // Notification Actions
  addQuestNotification: (notification) => set((state) => ({
    questNotifications: [
      {
        ...notification,
        id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        read: false,
      },
      ...state.questNotifications
    ].slice(0, 50) // Keep last 50 notifications
  })),
  
  markNotificationRead: (id) => set((state) => ({
    questNotifications: state.questNotifications.map(n =>
      n.id === id ? { ...n, read: true } : n
    )
  })),
  
  clearQuestNotifications: () => set({ questNotifications: [] }),
  
  getUnreadNotifications: () => {
    return get().questNotifications.filter(n => !n.read);
  },
  
  // Utility
  clearSessionQuests: (sessionId) => set((state) => ({
    quests: state.quests.filter(q => q.sessionId !== sessionId)
  })),
});
