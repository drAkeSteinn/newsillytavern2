// ============================================
// Quest Notification Deduplication System
// ============================================
//
// Prevents duplicate quest notifications from being shown to the user.
// Uses a hash-based approach: hash of (questId + objectiveId + type) identifies duplicates.
// A configurable time window determines how long to consider notifications as duplicates.
//
// When a duplicate is detected, the existing notification's `duplicateCount` is incremented
// instead of creating a new notification.

import type { QuestNotification, QuestNotificationType } from '@/types';

// ============================================
// Types
// ============================================

export interface NotificationDedupEntry {
  /** The dedup hash */
  hash: string;
  /** Timestamp when the first notification with this hash was created */
  firstSeen: number;
  /** Timestamp of the most recent duplicate */
  lastSeen: number;
  /** Count of duplicate notifications with this hash */
  count: number;
  /** ID of the first notification created with this hash */
  notificationId: string;
}

export interface NotificationDedupResult {
  /** Whether this notification is a duplicate */
  isDuplicate: boolean;
  /** The dedup hash */
  hash: string;
  /** If duplicate, the ID of the existing notification to update */
  existingNotificationId?: string;
  /** If duplicate, the new count for the existing notification */
  newCount?: number;
}

// ============================================
// Dedup Hash Generation
// ============================================

/**
 * Generates a deduplication hash for a quest notification.
 * 
 * The hash is based on: questId + objectiveId + type
 * This means:
 * - Same quest, same objective, same type = duplicate
 * - Same quest, different objective = NOT duplicate
 * - Same quest, same objective, different type = NOT duplicate
 */
export function generateNotificationDedupHash(
  questId: string,
  type: QuestNotificationType,
  objectiveId?: string,
): string {
  const parts = [questId, type];
  if (objectiveId) {
    parts.push(objectiveId);
  }
  return parts.join('::');
}

// ============================================
// Dedup Cache
// ============================================

/**
 * In-memory cache of recent notification dedup entries.
 * Automatically cleans up entries older than the dedup window.
 */
export class NotificationDedupCache {
  private entries: Map<string, NotificationDedupEntry> = new Map();
  private defaultWindowMs: number;
  private lastCleanup: number = 0;
  private cleanupIntervalMs: number = 60000; // Clean up every 60s

  constructor(defaultWindowMs: number = 30000) {
    this.defaultWindowMs = defaultWindowMs;
  }

  /**
   * Check if a notification is a duplicate and update the cache.
   * Returns a result indicating whether to create a new notification or update an existing one.
   */
  checkAndRecord(
    hash: string,
    notificationId: string,
    windowMs?: number,
  ): NotificationDedupResult {
    const now = Date.now();
    const window = windowMs ?? this.defaultWindowMs;

    // Periodic cleanup
    if (now - this.lastCleanup > this.cleanupIntervalMs) {
      this.cleanup(window);
      this.lastCleanup = now;
    }

    const existing = this.entries.get(hash);

    if (existing && (now - existing.firstSeen) < window) {
      // This is a duplicate within the time window
      existing.count += 1;
      existing.lastSeen = now;

      return {
        isDuplicate: true,
        hash,
        existingNotificationId: existing.notificationId,
        newCount: existing.count,
      };
    }

    // Not a duplicate (or window expired) — record new entry
    this.entries.set(hash, {
      hash,
      firstSeen: now,
      lastSeen: now,
      count: 1,
      notificationId,
    });

    return {
      isDuplicate: false,
      hash,
    };
  }

  /**
   * Remove entries older than the specified window.
   */
  cleanup(windowMs?: number): void {
    const now = Date.now();
    const window = windowMs ?? this.defaultWindowMs;

    for (const [key, entry] of this.entries) {
      if (now - entry.firstSeen > window) {
        this.entries.delete(key);
      }
    }
  }

  /**
   * Clear all entries.
   */
  clear(): void {
    this.entries.clear();
  }

  /**
   * Get current cache size (for debugging).
   */
  get size(): number {
    return this.entries.size;
  }

  /**
   * Get all entries (for debugging).
   */
  getEntries(): NotificationDedupEntry[] {
    return Array.from(this.entries.values());
  }
}

// ============================================
// Singleton Cache Instance
// ============================================

/** Global notification dedup cache instance */
let globalDedupCache: NotificationDedupCache | null = null;

/**
 * Get the global notification dedup cache.
 * Lazily initialized on first access.
 */
export function getNotificationDedupCache(): NotificationDedupCache {
  if (!globalDedupCache) {
    globalDedupCache = new NotificationDedupCache();
  }
  return globalDedupCache;
}

/**
 * Reset the global dedup cache (for testing).
 */
export function resetNotificationDedupCache(): void {
  globalDedupCache?.clear();
  globalDedupCache = null;
}

// ============================================
// Helper: Check and process notification
// ============================================

/**
 * Process a notification through the dedup system.
 * Returns the action to take: 'create' (new notification) or 'update' (increment existing).
 */
export function processNotificationDedup(
  questId: string,
  type: QuestNotificationType,
  objectiveId?: string,
  windowMs: number = 30000,
): NotificationDedupResult {
  const hash = generateNotificationDedupHash(questId, type, objectiveId);
  // Generate a provisional ID for the cache entry
  const provisionalId = `prov-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  return getNotificationDedupCache().checkAndRecord(hash, provisionalId, windowMs);
}

/**
 * Update the dedup cache with the actual notification ID after it's created.
 * This replaces the provisional ID with the real one.
 */
export function updateDedupCacheEntry(
  hash: string,
  actualNotificationId: string,
): void {
  const cache = getNotificationDedupCache();
  const entry = cache.getEntries().find(e => e.hash === hash);
  if (entry) {
    entry.notificationId = actualNotificationId;
  }
}
