/**
 * Deprecation Warning Utilities
 * 
 * Provides runtime console warnings when legacy fields or types are accessed.
 * Each field/type only warns once per session to avoid console spam.
 * 
 * Usage:
 *   warnLegacyField('sprites', 'spritePacksV2 + stateCollectionsV2');
 *   warnLegacyType('CharacterSprite', 'SpritePackEntryV2');
 */

// Track which warnings have already been issued (once per session)
const warnedFields = new Set<string>();
const warnedTypes = new Set<string>();

/**
 * Emit a console warning when a legacy field is accessed.
 * Only warns once per field per session.
 * 
 * @param fieldName - Name of the deprecated field
 * @param replacement - Name of the V2 replacement
 */
export function warnLegacyField(fieldName: string, replacement: string): void {
  const key = `field:${fieldName}`;
  if (warnedFields.has(key)) return;
  warnedFields.add(key);

  if (typeof console !== 'undefined' && console.warn) {
    console.warn(
      `[TavernFlow Deprecation] Field "${fieldName}" is deprecated. ` +
      `Use "${replacement}" instead. ` +
      `See the Migration Panel in the character editor for automatic migration.`
    );
  }
}

/**
 * Emit a console warning when a legacy type is used.
 * Only warns once per type per session.
 * 
 * @param typeName - Name of the deprecated type
 * @param replacement - Name of the V2 replacement type
 */
export function warnLegacyType(typeName: string, replacement: string): void {
  const key = `type:${typeName}`;
  if (warnedTypes.has(key)) return;
  warnedTypes.add(key);

  if (typeof console !== 'undefined' && console.warn) {
    console.warn(
      `[TavernFlow Deprecation] Type "${typeName}" is deprecated. ` +
      `Use "${replacement}" instead. ` +
      `Run the migration tool to convert legacy data to V2 format.`
    );
  }
}

/**
 * Clear all tracked warnings (useful for testing)
 */
export function clearDeprecationWarnings(): void {
  warnedFields.clear();
  warnedTypes.clear();
}

/**
 * Check if a specific field has already triggered a warning
 */
export function hasWarnedField(fieldName: string): boolean {
  return warnedFields.has(`field:${fieldName}`);
}

/**
 * Check if a specific type has already triggered a warning
 */
export function hasWarnedType(typeName: string): boolean {
  return warnedTypes.has(`type:${typeName}`);
}
