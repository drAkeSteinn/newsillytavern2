// ============================================
// User Constants - Special IDs for {{user}}
// ============================================

/**
 * Special ID for the user in the stats system
 * Used to store user's stats and solicitudes in SessionStats
 */
export const USER_ID = '__user__';

/**
 * Display name for the user in stats blocks
 */
export const USER_DISPLAY_NAME = 'Usuario';

/**
 * Check if an ID is the special user ID
 */
export function isUserId(id: string | undefined | null): boolean {
  return id === USER_ID;
}

/**
 * Get display name for an entity (user or character)
 */
export function getEntityDisplayName(id: string, fallbackName: string): string {
  if (isUserId(id)) {
    return USER_DISPLAY_NAME;
  }
  return fallbackName;
}
