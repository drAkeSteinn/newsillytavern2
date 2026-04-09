// ============================================
// Memory Handler - Handles memory/summary injection for Pre-LLM
// ============================================

import type { CharacterMemory, MemoryEvent, MemoryRelationship } from '@/types';
import type { PreLLMHandler, PreLLMContext, PreLLMMatchResult } from '../types';
import { estimateTokens } from '../scanner';

// ============================================
// Memory Handler Implementation
// ============================================

/**
 * Input data for the memory handler
 */
export interface MemoryHandlerData {
  memory?: CharacterMemory;
  characterName?: string;
  maxEvents?: number;
  includeRelationships?: boolean;
  includeNotes?: boolean;
}

/**
 * Memory match result data
 */
export interface MemoryMatchData {
  type: 'events' | 'relationships' | 'notes';
  content: string;
  eventCount?: number;
  relationshipCount?: number;
}

/**
 * Create the memory handler
 */
export function createMemoryHandler(): PreLLMHandler {
  return {
    name: 'memory',
    priority: 20, // Run after lorebook

    process: (context: PreLLMContext, data?: unknown): PreLLMMatchResult[] => {
      const handlerData = data as MemoryHandlerData | undefined;
      if (!handlerData?.memory) {
        return [];
      }

      const { memory, characterName = 'Character', maxEvents = 10, includeRelationships = true, includeNotes = true } = handlerData;

      const results: PreLLMMatchResult[] = [];
      const parts: string[] = [];

      // Process events
      if (memory.events && memory.events.length > 0) {
        const importantEvents = memory.events
          .filter(e => e.importance >= 0.5) // Only important events
          .sort((a, b) => b.importance - a.importance) // Most important first
          .slice(0, maxEvents);

        if (importantEvents.length > 0) {
          const eventContent = importantEvents
            .map(e => {
              const importance = e.importance >= 0.7 ? '⭐ ' : '';
              return `${importance}${e.content}`;
            })
            .join('\n');

          parts.push(`[Key Events and Facts]\n${eventContent}`);

          results.push({
            type: 'memory',
            handler: 'memory',
            data: {
              type: 'events',
              content: eventContent,
              eventCount: importantEvents.length
            } as MemoryMatchData,
            order: 100,
            position: 0, // Same position as lorebook
            estimatedTokens: estimateTokens(eventContent)
          });
        }
      }

      // Process relationships
      if (includeRelationships && memory.relationships && memory.relationships.length > 0) {
        const relationshipContent = memory.relationships
          .map(r => {
            const sentiment = r.sentiment > 50 ? '😊' : r.sentiment < -50 ? '😞' : '😐';
            return `${sentiment} ${r.targetName}: ${r.relationship} (${r.sentiment >= 0 ? '+' : ''}${r.sentiment})`;
          })
          .join('\n');

        if (relationshipContent.trim()) {
          parts.push(`[Relationships]\n${relationshipContent}`);

          results.push({
            type: 'memory',
            handler: 'memory',
            data: {
              type: 'relationships',
              content: relationshipContent,
              relationshipCount: memory.relationships.length
            } as MemoryMatchData,
            order: 101,
            position: 0,
            estimatedTokens: estimateTokens(relationshipContent)
          });
        }
      }

      // Process notes
      if (includeNotes && memory.notes && memory.notes.trim()) {
        parts.push(`[Notes]\n${memory.notes}`);

        results.push({
          type: 'memory',
          handler: 'memory',
          data: {
            type: 'notes',
            content: memory.notes
          } as MemoryMatchData,
          order: 102,
          position: 0,
          estimatedTokens: estimateTokens(memory.notes)
        });
      }

      return results;
    }
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Format memory for display
 */
export function formatMemoryForDisplay(memory: CharacterMemory, characterName: string): string {
  const parts: string[] = [];

  if (memory.events && memory.events.length > 0) {
    parts.push(`[Key Events and Facts]`);
    for (const event of memory.events) {
      const importance = event.importance >= 0.7 ? '⭐' : '';
      parts.push(`${importance} ${event.content}`);
    }
  }

  if (memory.relationships && memory.relationships.length > 0) {
    parts.push(`\n[Relationships]`);
    for (const rel of memory.relationships) {
      const sentiment = rel.sentiment > 50 ? '😊' : rel.sentiment < -50 ? '😞' : '😐';
      parts.push(`${sentiment} ${rel.targetName}: ${rel.relationship} (${rel.sentiment >= 0 ? '+' : ''}${rel.sentiment})`);
    }
  }

  if (memory.notes) {
    parts.push(`\n[Notes]\n${memory.notes}`);
  }

  return parts.join('\n');
}

/**
 * Check if memory has content
 */
export function hasMemoryContent(memory?: CharacterMemory): boolean {
  if (!memory) return false;
  return (
    (memory.events && memory.events.length > 0) ||
    (memory.relationships && memory.relationships.length > 0) ||
    !!memory.notes?.trim()
  );
}

// ============================================
// Export singleton handler
// ============================================

export const memoryHandler = createMemoryHandler();
