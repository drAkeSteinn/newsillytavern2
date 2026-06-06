// ============================================
// Timer Processor - Automatic attribute updates over time
// ============================================
//
// Evaluates elapsed time since last timer update and applies
// timer-configured changes to attributes.
//
// Architecture: Tick-based (not interval-based)
// - A single timer tick occurs at a configured interval (default 60s)
// - Each attribute defines how many ticks it needs to trigger
// - On session load/message, elapsed time is calculated and accumulated ticks are applied
// - This makes the system resilient to server restarts
//
// Supported operations:
// Number: add, subtract, multiply, divide, set
// Keyword/Text: cycle (rotate through list), random (pick random), set (fixed value)
//
// Conditions: Timer only applies when configured requirements are met
// Threshold transitions: onMinReached/onMaxReached are triggered if timer causes them
// Max accumulated ticks: Prevents runaway updates after long offline periods

import type {
  AttributeDefinition,
  CharacterStatsConfig,
  SessionStats,
  CharacterSessionStats,
  StatRequirement,
  TimerNumericOperation,
  TimerTextOperation,
} from '@/types';

// ============================================
// Types
// ============================================

export interface TimerTickResult {
  attributeKey: string;
  attributeName: string;
  oldValue: number | string;
  newValue: number | string;
  operation: string;
  ticksApplied: number;
  thresholdTriggered?: 'min' | 'max' | null;
}

export interface TimerEvaluationResult {
  updates: Array<{
    attributeKey: string;
    value: number | string;
  }>;
  details: TimerTickResult[];
  newCycleIndex: Record<string, number>;
  newLastTimerUpdate: number;
  thresholdsReached: Array<{
    attributeKey: string;
    attributeName: string;
    thresholdType: 'min' | 'max';
  }>;
}

// ============================================
// Evaluation Functions
// ============================================

/**
 * Evaluate timer conditions for an attribute
 * Returns true if the timer should apply (conditions met or no conditions defined)
 */
function evaluateTimerConditions(
  conditions: StatRequirement[] | undefined,
  attributeValues: Record<string, number | string>,
  sessionStats?: SessionStats
): boolean {
  if (!conditions || conditions.length === 0) return true;

  // Inline basic evaluation (same logic as evaluateRequirements in statsSlice,
  // but self-contained to avoid importing Zustand slice at lib level)
  for (const req of conditions) {
    const currentValue = attributeValues[req.attributeKey];
    if (currentValue === undefined) return false;

    const numValue = typeof currentValue === 'number' ? currentValue : parseFloat(String(currentValue));
    const reqValue = typeof req.value === 'number' ? req.value : parseFloat(String(req.value));

    if (isNaN(numValue) || isNaN(reqValue)) {
      // String comparison
      const strCurrent = String(currentValue).toLowerCase();
      const strReq = String(req.value).toLowerCase();

      switch (req.operator) {
        case '==': if (strCurrent !== strReq) return false; break;
        case '!=': if (strCurrent === strReq) return false; break;
        case 'contains': if (!strCurrent.includes(strReq)) return false; break;
        case 'not_contains': if (strCurrent.includes(strReq)) return false; break;
        default: continue;
      }
      continue;
    }

    switch (req.operator) {
      case '<': if (!(numValue < reqValue)) return false; break;
      case '<=': if (!(numValue <= reqValue)) return false; break;
      case '>': if (!(numValue > reqValue)) return false; break;
      case '>=': if (!(numValue >= reqValue)) return false; break;
      case '==': if (numValue !== reqValue) return false; break;
      case '!=': if (numValue === reqValue) return false; break;
      case 'between': {
        const maxVal = typeof req.valueMax === 'number' ? req.valueMax : reqValue;
        if (!(numValue >= reqValue && numValue <= maxVal)) return false;
        break;
      }
      default: continue;
    }
  }

  return true;
}

/**
 * Apply a numeric timer operation for a given number of ticks
 */
function applyNumericTimerOperation(
  currentValue: number,
  operation: TimerNumericOperation,
  value: number,
  ticks: number,
  min?: number,
  max?: number
): { newValue: number; clamped: boolean } {
  let result = currentValue;

  switch (operation) {
    case 'add':
      result = currentValue + (value * ticks);
      break;
    case 'subtract':
      result = currentValue - (value * ticks);
      break;
    case 'multiply':
      // For multiply/divide, apply iteratively (compound effect)
      for (let i = 0; i < ticks; i++) {
        result = result * value;
      }
      break;
    case 'divide':
      for (let i = 0; i < ticks; i++) {
        result = result / value;
      }
      break;
    case 'set':
      result = value; // set doesn't compound with ticks
      break;
  }

  // Clamp to min/max
  let clamped = false;
  if (min !== undefined && result < min) {
    result = min;
    clamped = true;
  }
  if (max !== undefined && result > max) {
    result = max;
    clamped = true;
  }

  // Round to avoid floating point issues
  result = Math.round(result * 1000) / 1000;

  return { newValue: result, clamped };
}

/**
 * Apply a text/keyword timer operation
 */
function applyTextTimerOperation(
  currentValue: string,
  operation: TimerTextOperation,
  textValues: string | undefined,
  textValue: string | undefined,
  ticks: number,
  currentCycleIndex: number,
  valuesList: string[]
): { newValue: string; newCycleIndex: number } {
  switch (operation) {
    case 'cycle': {
      if (valuesList.length === 0) return { newValue: currentValue, newCycleIndex: currentCycleIndex };
      // Advance by ticks positions
      const newIndex = (currentCycleIndex + ticks) % valuesList.length;
      return { newValue: valuesList[newIndex], newCycleIndex: newIndex };
    }
    case 'random': {
      if (valuesList.length === 0) return { newValue: currentValue, newCycleIndex: currentCycleIndex };
      // Random only applies once (no point in accumulating random)
      const randomIndex = Math.floor(Math.random() * valuesList.length);
      return { newValue: valuesList[randomIndex], newCycleIndex: currentCycleIndex };
    }
    case 'set': {
      return { newValue: textValue || currentValue, newCycleIndex: currentCycleIndex };
    }
    default:
      return { newValue: currentValue, newCycleIndex: currentCycleIndex };
  }
}

/**
 * Parse comma-separated text values into an array
 */
function parseTextValues(textValues: string | undefined): string[] {
  if (!textValues) return [];
  return textValues.split(',').map(v => v.trim()).filter(v => v.length > 0);
}

/**
 * Main timer evaluation function
 *
 * Call this when a session is loaded or a message is sent.
 * It calculates elapsed ticks since last update and applies all pending timer changes.
 */
export function evaluateTimerTicks(
  statsConfig: CharacterStatsConfig,
  sessionStats: SessionStats,
  characterId: string
): TimerEvaluationResult {
  const result: TimerEvaluationResult = {
    updates: [],
    details: [],
    newCycleIndex: { ...(sessionStats.keywordCycleIndex || {}) },
    newLastTimerUpdate: sessionStats.lastTimerUpdate || Date.now(), // Preserve fractional progress
    thresholdsReached: [],
  };

  // Check if timer is enabled
  if (!statsConfig.timerEnabled) {
    return result;
  }

  const now = Date.now();
  const lastUpdate = sessionStats.lastTimerUpdate || now;
  const elapsedMs = now - lastUpdate;
  const elapsedMinutes = elapsedMs / 60000;

  // If no time has passed, nothing to do
  if (elapsedMinutes < 1) {
    return result;
  }

  const charStats = sessionStats.characterStats?.[characterId];
  if (!charStats) return result;

  const attributeValues = { ...charStats.attributeValues };
  const maxAccumulatedTicks = statsConfig.timerMaxAccumulatedTicks || 100;

  // Track the minimum consumed time across all attributes to preserve fractional progress
  // We advance lastTimerUpdate by the amount of time "consumed" by ticks
  let maxConsumedMinutes = 0;

  // Process each attribute with timer enabled
  for (const attr of statsConfig.attributes) {
    if (!attr.timer?.enabled) continue;

    const intervalMinutes = attr.timer.intervalMinutes;
    if (!intervalMinutes || intervalMinutes < 1) continue;

    // Calculate ticks
    const rawTicks = Math.floor(elapsedMinutes / intervalMinutes);

    // For cycle operations, cap at 10 (shorter lists cycle quickly)
    const effectiveMaxTicks = attr.type !== 'number' && attr.timer.textOperation === 'cycle'
      ? Math.min(maxAccumulatedTicks, 10)
      : maxAccumulatedTicks;

    const ticks = Math.min(rawTicks, effectiveMaxTicks);

    if (ticks <= 0) continue;

    // Track consumed time for fractional progress preservation
    const consumedMinutes = ticks * intervalMinutes;
    if (consumedMinutes > maxConsumedMinutes) {
      maxConsumedMinutes = consumedMinutes;
    }

    // Check conditions
    const conditionsMet = evaluateTimerConditions(
      attr.timer.condition,
      attributeValues,
      sessionStats
    );

    if (!conditionsMet) continue;

    const oldValue = attributeValues[attr.key] ?? attr.defaultValue;

    // Apply based on attribute type
    if (attr.type === 'number' && typeof oldValue === 'number') {
      const operation = attr.timer.numericOperation || 'add';
      const value = attr.timer.numericValue ?? 0;

      const { newValue, clamped } = applyNumericTimerOperation(
        oldValue,
        operation,
        value,
        ticks,
        attr.min,
        attr.max
      );

      // Update attribute value
      attributeValues[attr.key] = newValue;

      const tickDetail: TimerTickResult = {
        attributeKey: attr.key,
        attributeName: attr.name,
        oldValue,
        newValue,
        operation: `${operation} ${value} × ${ticks} ticks`,
        ticksApplied: ticks,
      };

      // Check threshold transitions
      if (clamped) {
        if (attr.min !== undefined && newValue === attr.min && attr.onMinReached?.enabled) {
          tickDetail.thresholdTriggered = 'min';
          result.thresholdsReached.push({
            attributeKey: attr.key,
            attributeName: attr.name,
            thresholdType: 'min',
          });
        }
        if (attr.max !== undefined && newValue === attr.max && attr.onMaxReached?.enabled) {
          tickDetail.thresholdTriggered = 'max';
          result.thresholdsReached.push({
            attributeKey: attr.key,
            attributeName: attr.name,
            thresholdType: 'max',
          });
        }
      }

      result.details.push(tickDetail);
    } else if (attr.type === 'keyword' || attr.type === 'text') {
      const operation = attr.timer.textOperation || 'set';
      const valuesList = parseTextValues(attr.timer.textValues);
      const currentCycleIndex = result.newCycleIndex[attr.key] || 0;

      const { newValue, newCycleIndex } = applyTextTimerOperation(
        String(oldValue),
        operation,
        attr.timer.textValues,
        attr.timer.textValue,
        ticks,
        currentCycleIndex,
        valuesList
      );

      attributeValues[attr.key] = newValue;
      result.newCycleIndex[attr.key] = newCycleIndex;

      result.details.push({
        attributeKey: attr.key,
        attributeName: attr.name,
        oldValue,
        newValue,
        operation: `${operation}${operation === 'cycle' ? ` (pos: ${newCycleIndex})` : ''}`,
        ticksApplied: ticks,
      });
    }
  }

  // Build updates array
  for (const detail of result.details) {
    result.updates.push({
      attributeKey: detail.attributeKey,
      value: detail.newValue,
    });
  }

  // Update lastTimerUpdate: advance by the consumed time to preserve fractional progress
  // This ensures that if 7 minutes pass with a 5-minute interval, the remaining 2 minutes
  // carry over to the next evaluation instead of being lost
  if (maxConsumedMinutes > 0) {
    result.newLastTimerUpdate = lastUpdate + (maxConsumedMinutes * 60000);
  }

  return result;
}

/**
 * Check if any attributes have active timers
 * Used to determine if the timer system needs to run for a character
 */
export function hasActiveTimers(statsConfig: CharacterStatsConfig): boolean {
  if (!statsConfig.timerEnabled) return false;
  return statsConfig.attributes.some(attr => attr.timer?.enabled);
}

/**
 * Get the minimum tick interval from all active timers
 * Used to set the interval for the periodic timer check
 */
export function getMinimumTimerInterval(statsConfig: CharacterStatsConfig): number {
  if (!statsConfig.timerEnabled) return 0;

  const intervals = statsConfig.attributes
    .filter(attr => attr.timer?.enabled)
    .map(attr => attr.timer!.intervalMinutes);

  if (intervals.length === 0) return 0;
  return Math.min(...intervals);
}
