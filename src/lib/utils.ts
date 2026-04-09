import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate a unique ID compatible with all environments
 * Works in browser, Node.js, and edge runtimes
 */
export function generateId(): string {
  // Try native crypto.randomUUID first (modern browsers and Node 16.7+)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  
  // Fallback: generate a UUID v4 compatible string
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'y' ? (r & 0x3) | 0x8 : r;
    return v.toString(16);
  });
}
