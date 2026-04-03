// ============================================
// UUID Generation Utility
// ============================================
// Provides a fallback for environments without crypto.randomUUID

/**
 * Generate a UUID v4
 * Uses crypto.randomUUID if available, otherwise falls back to a polyfill
 */
export const uuidv4 = (): string => {
  // Check if crypto.randomUUID is available (modern browsers and Node.js 19+)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for environments without crypto.randomUUID
  // This is a simple UUID v4 implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export default uuidv4;
