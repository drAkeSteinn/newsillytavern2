// ============================================
// Lorebook Entry Key Builder
// ============================================
//
// Builds a map of lorebook entry keys → content from traditional (non-attribute) lorebook entries.
// This enables {{key}} resolution in action descriptions and other text fields.
//
// When a user writes {{tecnica_fuego}} in an action description, and a traditional lorebook entry
// has "tecnica_fuego" in its key array, the {{tecnica_fuego}} placeholder is replaced with the
// entry's content.
//
// Priority: Entries with lower `order` values have higher priority. If multiple entries share a key,
// only the highest priority (lowest order) entry's content is used.
//
// Constant entries are always included. Non-constant entries are included regardless of whether
// their keywords appear in chat (since this is explicit {{key}} resolution, not chat scanning).

import type { Lorebook, LorebookEntry } from '@/types';

// ============================================
// Types
// ============================================

/**
 * Result of building the lorebook entry key map.
 * Contains the key→content mapping and debug information.
 */
export interface LorebookEntryKeyMapResult {
  /** Map of key name → resolved content string */
  keys: Record<string, string>;
  /** Debug entries showing which entries were processed */
  debugEntries: LorebookEntryKeyDebugEntry[];
}

export interface LorebookEntryKeyDebugEntry {
  lorebookName: string;
  entryComment: string;
  keys: string[];
  order: number;
  constant: boolean;
  disabled: boolean;
  isAttribute: boolean;
  resolvedTo: string;
}

// ============================================
// Main API
// ============================================

/**
 * Build a key→content map from traditional (non-attribute) lorebook entries.
 *
 * For each active, non-disabled, non-attribute entry:
 * - For each keyword in entry.key[]:
 *   - If not already in the map (or current entry has lower order = higher priority), add key → entry.content
 *
 * @param lorebooks Active lorebooks to scan for entries
 * @returns Map of key → content and debug information
 */
export function buildLorebookEntryKeyMap(
  lorebooks: Lorebook[]
): LorebookEntryKeyMapResult {
  const result: Record<string, string> = {};
  const debugEntries: LorebookEntryKeyDebugEntry[] = [];

  if (!lorebooks || lorebooks.length === 0) {
    return { keys: result, debugEntries };
  }

  // Collect all traditional entries across all lorebooks
  interface CollectedEntry {
    entry: LorebookEntry;
    lorebookName: string;
  }

  const allTraditionalEntries: CollectedEntry[] = [];

  for (const lorebook of lorebooks) {
    if (!lorebook.active) continue;

    for (const entry of lorebook.entries) {
      // Skip attribute entries (handled by attribute-resolver)
      if (entry.entryType === 'attribute') continue;
      // Skip disabled entries
      if (entry.disable) continue;
      // Skip entries with no keys
      if (!entry.key || entry.key.length === 0) continue;
      // Skip entries with empty content
      if (!entry.content?.trim()) continue;

      allTraditionalEntries.push({
        entry,
        lorebookName: lorebook.name,
      });
    }
  }

  // Sort by entry.order ascending — lower order = higher priority
  allTraditionalEntries.sort((a, b) => a.entry.order - b.entry.order);

  // Track which keys have been resolved (to handle priority)
  const resolvedKeys = new Map<string, { content: string; order: number; lorebookName: string }>();

  for (const { entry, lorebookName } of allTraditionalEntries) {
    for (const key of entry.key) {
      // Skip regex keys — they can't be used as {{key}} template references
      if (isRegexKey(key)) continue;

      const normalizedKey = key.trim().toLowerCase();
      if (!normalizedKey) continue;

      // If this key already has a resolved entry from a higher-priority (lower order) entry, skip
      if (resolvedKeys.has(normalizedKey)) {
        const existing = resolvedKeys.get(normalizedKey)!;

        debugEntries.push({
          lorebookName,
          entryComment: entry.comment || '(sin nombre)',
          keys: entry.key,
          order: entry.order,
          constant: entry.constant,
          disabled: entry.disable,
          isAttribute: entry.entryType === 'attribute',
          resolvedTo: `(omitido — ya resuelto por entrada "${existing.lorebookName}" con orden ${existing.order})`,
        });
        continue;
      }

      // Add this key → content mapping
      const content = entry.content.trim();
      result[normalizedKey] = content;
      resolvedKeys.set(normalizedKey, { content, order: entry.order, lorebookName });

      debugEntries.push({
        lorebookName,
        entryComment: entry.comment || '(sin nombre)',
        keys: entry.key,
        order: entry.order,
        constant: entry.constant,
        disabled: entry.disable,
        isAttribute: entry.entryType === 'attribute',
        resolvedTo: content.slice(0, 100) + (content.length > 100 ? '...' : ''),
      });
    }
  }

  return { keys: result, debugEntries };
}

// ============================================
// Internal Functions
// ============================================

/**
 * Check if a key is a regex pattern (e.g., /pattern/flags)
 * Regex keys can't be used as {{key}} template references.
 */
function isRegexKey(key: string): boolean {
  return key.startsWith('/') && key.length > 1;
}
