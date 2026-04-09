// ============================================
// Trigger Utils - Shared Utilities for All Handlers
// ============================================
//
// This module provides common utility functions used by all KeyHandler
// implementations. Centralizing these functions reduces code duplication
// and ensures consistent behavior across handlers.

import type { TriggerMatch, TriggerMatchResult, DetectedKey } from './types';

// ============================================
// String Utilities
// ============================================

/**
 * Normalize a string for matching
 * - Lowercase
 * - Remove accents
 * - Keep only alphanumeric, underscores, hyphens
 */
export function normalizeForMatch(text: string): string {
  if (!text) return '';
  
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9_-]/g, '');
}

/**
 * Check if two strings match (case-insensitive by default)
 */
export function stringMatches(a: string, b: string, caseSensitive = false): boolean {
  if (!a || !b) return false;
  return caseSensitive 
    ? a === b 
    : a.toLowerCase() === b.toLowerCase();
}

/**
 * Check if a string matches any in a list
 */
export function matchesAny(str: string, list: string[], caseSensitive = false): boolean {
  return list.some(item => stringMatches(str, item, caseSensitive));
}

// ============================================
// Value Parsing Utilities
// ============================================

/**
 * Parse a numeric value from a string
 * Returns null if not a valid number
 */
export function parseNumber(value: string | undefined | null): number | null {
  if (value === undefined || value === null) return null;
  
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

/**
 * Parse a value with optional operator prefix
 * Supports: +N, -N, =N, *N, /N, N (implicit set)
 */
export function parseOperatorValue(value: string): { 
  operator: '+' | '-' | '=' | '*' | '/' | 'set';
  value: number | string;
  numericValue: number | null;
} {
  const trimmed = value.trim();
  
  // Check for operator prefix
  const match = trimmed.match(/^([+\-*/=])(.+)$/);
  
  if (match) {
    const op = match[1];
    const rest = match[2].trim();
    const num = parseFloat(rest);
    
    return {
      operator: op === '=' ? 'set' : op as '+' | '-' | '*' | '/',
      value: isNaN(num) ? rest : num,
      numericValue: isNaN(num) ? null : num,
    };
  }
  
  // No operator - check if numeric
  const num = parseFloat(trimmed);
  return {
    operator: 'set',
    value: isNaN(num) ? trimmed : num,
    numericValue: isNaN(num) ? null : num,
  };
}

/**
 * Apply an operator to a current value
 */
export function applyOperator(
  currentValue: number,
  operator: '+' | '-' | '*' | '/' | 'set',
  operand: number
): number {
  switch (operator) {
    case '+': return currentValue + operand;
    case '-': return currentValue - operand;
    case '*': return currentValue * operand;
    case '/': return operand !== 0 ? currentValue / operand : currentValue;
    case 'set': return operand;
    default: return currentValue;
  }
}

/**
 * Clamp a value to a range
 */
export function clampValue(value: number, min?: number, max?: number): number {
  let result = value;
  if (min !== undefined) result = Math.max(min, result);
  if (max !== undefined) result = Math.min(max, result);
  return result;
}

// ============================================
// Volume Utilities
// ============================================

/**
 * Calculate final volume from multiple volume factors
 * Volumes are multiplied together (0.0 - 1.0)
 */
export function calculateVolume(
  baseVolume: number,
  ...factors: (number | undefined)[]
): number {
  let result = Math.max(0, Math.min(1, baseVolume));
  
  for (const factor of factors) {
    if (factor !== undefined) {
      result *= Math.max(0, Math.min(1, factor));
    }
  }
  
  return result;
}

/**
 * Convert decibel to linear volume
 */
export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Convert linear volume to decibel
 */
export function linearToDb(linear: number): number {
  return 20 * Math.log10(Math.max(0.0001, linear));
}

// ============================================
// Cooldown Utilities
// ============================================

/**
 * Simple cooldown manager for handlers
 */
export class CooldownTracker {
  private lastTriggerTimes: Map<string, number> = new Map();
  private globalLastTrigger: number = 0;
  
  /**
   * Check if a key is ready (cooldown expired)
   */
  isReady(key: string, cooldownMs: number, globalCooldownMs?: number): boolean {
    const now = Date.now();
    
    // Check global cooldown
    if (globalCooldownMs && globalCooldownMs > 0) {
      if (now - this.globalLastTrigger < globalCooldownMs) {
        return false;
      }
    }
    
    // Check per-key cooldown
    const lastTime = this.lastTriggerTimes.get(key) ?? 0;
    return now - lastTime >= cooldownMs;
  }
  
  /**
   * Mark a key as triggered
   */
  markTriggered(key: string): void {
    const now = Date.now();
    this.lastTriggerTimes.set(key, now);
    this.globalLastTrigger = now;
  }
  
  /**
   * Get remaining cooldown time for a key
   */
  getRemainingCooldown(key: string, cooldownMs: number): number {
    const lastTime = this.lastTriggerTimes.get(key) ?? 0;
    const elapsed = Date.now() - lastTime;
    return Math.max(0, cooldownMs - elapsed);
  }
  
  /**
   * Reset all cooldowns
   */
  reset(): void {
    this.lastTriggerTimes.clear();
    this.globalLastTrigger = 0;
  }
}

// ============================================
// Selection Utilities
// ============================================

/**
 * Select a random item from an array
 */
export function selectRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Select next item in cycle
 */
export function selectCycle<T>(items: T[], currentIndex: number): { item: T; nextIndex: number } {
  if (items.length === 0) {
    throw new Error('Cannot select from empty array');
  }
  
  const validIndex = currentIndex % items.length;
  return {
    item: items[validIndex],
    nextIndex: (validIndex + 1) % items.length,
  };
}

/**
 * Select item by weight (weighted random)
 */
export function selectWeighted<T extends { weight?: number }>(items: T[]): T | null {
  if (items.length === 0) return null;
  
  const totalWeight = items.reduce((sum, item) => sum + (item.weight ?? 1), 0);
  let random = Math.random() * totalWeight;
  
  for (const item of items) {
    random -= item.weight ?? 1;
    if (random <= 0) return item;
  }
  
  return items[items.length - 1];
}

// ============================================
// URL Utilities
// ============================================

/**
 * Check if a string is a valid URL
 */
export function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a string is a direct URL (starts with http, /, or data:)
 */
export function isDirectUrl(str: string): boolean {
  return str.startsWith('http://') || 
         str.startsWith('https://') || 
         str.startsWith('/') || 
         str.startsWith('data:');
}

/**
 * Resolve a relative path to full URL
 */
export function resolveUrl(basePath: string, filename: string): string {
  if (isDirectUrl(filename)) return filename;
  if (filename.startsWith('/')) return filename;
  return `${basePath}/${filename}`;
}

// ============================================
// Time Utilities
// ============================================

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle a function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => { inThrottle = false; }, limit);
    }
  };
}

// ============================================
// Trigger Match Utilities
// ============================================

/**
 * Create a trigger match object
 */
export function createMatch(
  triggerType: string,
  keyword: string,
  data: Record<string, unknown>
): TriggerMatch {
  return {
    triggerId: data.triggerId as string || `trigger-${Date.now()}`,
    triggerType: triggerType as TriggerMatch['triggerType'],
    keyword,
    data,
    timestamp: Date.now(),
  };
}

/**
 * Create a successful match result
 */
export function successResult(
  detectedKey: DetectedKey,
  match: TriggerMatch
): TriggerMatchResult {
  return {
    matched: true,
    key: detectedKey,
    trigger: match,
  };
}

/**
 * Create a failed match result
 */
export function failResult(
  _detectedKey: DetectedKey,
  _reason?: string
): TriggerMatchResult {
  return {
    matched: false,
  };
}

// ============================================
// Logging Utilities
// ============================================

const DEBUG_ENABLED = process.env.NODE_ENV === 'development';

/**
 * Log handler activity (only in development)
 */
export function logHandler(
  handlerId: string,
  action: string,
  data?: Record<string, unknown>
): void {
  if (!DEBUG_ENABLED) return;
  
  console.log(`[${handlerId}] ${action}`, data ?? '');
}

/**
 * Log trigger match
 */
export function logMatch(
  handlerId: string,
  key: string,
  matched: boolean,
  details?: Record<string, unknown>
): void {
  if (!DEBUG_ENABLED) return;
  
  console.log(`[${handlerId}] ${matched ? '✓' : '✗'} "${key}"`, details ?? '');
}

// ============================================
// Key Format Detection Utilities
// ============================================

/**
 * Check if a key appears to be a bracketed key [key] or [key=value]
 */
export function isBracketFormat(key: string): boolean {
  return key.startsWith('[') && key.endsWith(']');
}

/**
 * Check if a key appears to be a pipe-delimited key |key|
 */
export function isPipeFormat(key: string): boolean {
  return key.startsWith('|') && key.endsWith('|');
}

/**
 * Check if a key appears to have a prefix (Peticion:, Solicitud:)
 */
export function hasPrefixFormat(key: string): boolean {
  return /^(Peticion|Solicitud)[:=]/i.test(key);
}

/**
 * Check if a key has a key:value or key=value format
 */
export function hasKeyValueFormat(key: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9_-]*[:=]/.test(key);
}

/**
 * Parse a bracketed key into key and optional value
 */
export function parseBracketKey(key: string): { key: string; value?: string } {
  const inner = key.slice(1, -1); // Remove brackets
  const separatorIndex = inner.search(/[:=]/);
  
  if (separatorIndex >= 0) {
    return {
      key: inner.slice(0, separatorIndex).trim(),
      value: inner.slice(separatorIndex + 1).trim(),
    };
  }
  
  return { key: inner.trim() };
}

/**
 * Parse a key:value or key=value pair
 */
export function parseKeyValue(key: string): { key: string; value?: string } {
  const separatorIndex = key.search(/[:=]/);
  
  if (separatorIndex >= 0) {
    return {
      key: key.slice(0, separatorIndex).trim(),
      value: key.slice(separatorIndex + 1).trim(),
    };
  }
  
  return { key: key.trim() };
}
