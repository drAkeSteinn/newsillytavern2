// ============================================
// Group Slice - Character groups management
// ============================================

import type { CharacterGroup, GroupMember } from '@/types';
import { uuidv4 } from '@/lib/uuid';

export interface GroupSlice {
  // State
  groups: CharacterGroup[];
  activeGroupId: string | null;

  // Actions
  addGroup: (group: Partial<CharacterGroup> & { name: string }, preserveId?: boolean) => void;
  updateGroup: (id: string, updates: Partial<CharacterGroup>) => void;
  deleteGroup: (id: string) => void;
  setActiveGroup: (id: string | null) => void;

  // Member Actions
  addGroupMember: (groupId: string, characterId: string) => void;
  removeGroupMember: (groupId: string, characterId: string) => void;
  updateGroupMember: (groupId: string, characterId: string, updates: Partial<GroupMember>) => void;
  toggleGroupMemberActive: (groupId: string, characterId: string) => void;
  toggleGroupMemberPresent: (groupId: string, characterId: string) => void;
  toggleGroupMemberNarrator: (groupId: string, characterId: string) => void;

  // Utilities
  getGroupById: (id: string) => CharacterGroup | undefined;
}

export const createGroupSlice = (set: any, _get: any): GroupSlice => ({
  // Initial State
  groups: [],
  activeGroupId: null,

  // Actions
  addGroup: (group, preserveId = false) => set((state: any) => ({
    groups: [...state.groups, {
      ...group,
      id: (preserveId && group.id) ? group.id : uuidv4(),
      // Ensure members array is initialized from characterIds if not provided
      members: group.members || (group.characterIds || []).map((id, index) => ({
        characterId: id,
        isActive: true,
        isPresent: true,
        isNarrator: false,
        joinOrder: index
      })),
      // Set defaults for new fields
      minResponsesPerTurn: group.minResponsesPerTurn ?? 1,
      maxResponsesPerTurn: group.maxResponsesPerTurn ?? 3,
      allowMentions: group.allowMentions ?? true,
      mentionTriggers: group.mentionTriggers ?? [],
      conversationStyle: group.conversationStyle ?? 'sequential',
      createdAt: group.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }]
  })),

  updateGroup: (id, updates) => set((state: any) => ({
    groups: state.groups.map((g: CharacterGroup) =>
      g.id === id ? { ...g, ...updates, updatedAt: new Date().toISOString() } : g
    )
  })),

  deleteGroup: (id) => set((state: any) => ({
    groups: state.groups.filter((g: CharacterGroup) => g.id !== id),
    activeGroupId: state.activeGroupId === id ? null : state.activeGroupId
  })),

  setActiveGroup: (id) => set({ activeGroupId: id }),

  // Member Actions
  addGroupMember: (groupId, characterId) => set((state: any) => ({
    groups: state.groups.map((g: CharacterGroup) => {
      if (g.id !== groupId) return g;
      const existingMember = g.members?.find(m => m.characterId === characterId);
      if (existingMember) return g; // Already a member
      const newMember: GroupMember = {
        characterId,
        isActive: true,
        isPresent: true,
        isNarrator: false,
        joinOrder: g.members?.length || 0
      };
      return {
        ...g,
        members: [...(g.members || []), newMember],
        characterIds: [...(g.characterIds || []), characterId],
        updatedAt: new Date().toISOString()
      };
    })
  })),

  removeGroupMember: (groupId, characterId) => set((state: any) => ({
    groups: state.groups.map((g: CharacterGroup) => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        members: (g.members || []).filter(m => m.characterId !== characterId),
        characterIds: (g.characterIds || []).filter(id => id !== characterId),
        updatedAt: new Date().toISOString()
      };
    })
  })),

  updateGroupMember: (groupId, characterId, updates) => set((state: any) => ({
    groups: state.groups.map((g: CharacterGroup) => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        members: (g.members || []).map(m =>
          m.characterId === characterId ? { ...m, ...updates } : m
        ),
        updatedAt: new Date().toISOString()
      };
    })
  })),

  toggleGroupMemberActive: (groupId, characterId) => set((state: any) => ({
    groups: state.groups.map((g: CharacterGroup) => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        members: (g.members || []).map(m =>
          m.characterId === characterId ? { ...m, isActive: !m.isActive } : m
        ),
        updatedAt: new Date().toISOString()
      };
    })
  })),

  toggleGroupMemberPresent: (groupId, characterId) => set((state: any) => ({
    groups: state.groups.map((g: CharacterGroup) => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        members: (g.members || []).map(m =>
          m.characterId === characterId ? { ...m, isPresent: !m.isPresent } : m
        ),
        updatedAt: new Date().toISOString()
      };
    })
  })),

  toggleGroupMemberNarrator: (groupId, characterId) => set((state: any) => ({
    groups: state.groups.map((g: CharacterGroup) => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        members: (g.members || []).map(m =>
          m.characterId === characterId ? { ...m, isNarrator: !m.isNarrator } : m
        ),
        updatedAt: new Date().toISOString()
      };
    })
  })),

  // Utilities
  getGroupById: (id) => _get().groups.find((g: CharacterGroup) => g.id === id),
});
