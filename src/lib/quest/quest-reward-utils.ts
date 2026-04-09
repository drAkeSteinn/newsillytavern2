// ============================================
// Quest Reward Utilities - Factory & Migration
// ============================================
//
// Funciones de utilidad para crear, validar y migrar recompensas
// al nuevo sistema simplificado (attribute | trigger)

import type {
  QuestReward,
  QuestRewardAttribute,
  QuestRewardTrigger,
  QuestRewardObjective,
  QuestRewardSolicitud,
  QuestRewardCondition,
  AttributeAction,
  TriggerCategory,
  TriggerTargetMode,
} from '@/types';
import { generateId } from '@/lib/utils';

// ============================================
// Factory Functions - Crear recompensas fácilmente
// ============================================

/**
 * Crea una recompensa de atributo
 */
export function createAttributeReward(
  key: string,
  value: number | string,
  action: AttributeAction = 'add',
  options?: {
    id?: string;
    condition?: QuestRewardCondition;
  }
): QuestReward {
  return {
    id: options?.id || generateId(),
    type: 'attribute',
    attribute: {
      key,
      value,
      action,
    },
    condition: options?.condition,
  };
}

/**
 * Crea una recompensa de trigger
 */
export function createTriggerReward(
  category: TriggerCategory,
  key: string,
  targetMode: TriggerTargetMode = 'self',
  options?: {
    id?: string;
    returnToIdleMs?: number;
    volume?: number;
    transitionDuration?: number;
    condition?: QuestRewardCondition;
  }
): QuestReward {
  const reward: QuestReward = {
    id: options?.id || generateId(),
    type: 'trigger',
    trigger: {
      category,
      key,
      targetMode,
    },
    condition: options?.condition,
  };

  // Añadir opciones específicas según categoría
  if (category === 'sprite' && options?.returnToIdleMs !== undefined) {
    reward.trigger!.returnToIdleMs = options.returnToIdleMs;
  }
  if ((category === 'sound' || category === 'soundSequence') && options?.volume !== undefined) {
    reward.trigger!.volume = options.volume;
  }
  if (category === 'background' && options?.transitionDuration !== undefined) {
    reward.trigger!.transitionDuration = options.transitionDuration;
  }

  return reward;
}

/**
 * Crea una recompensa de objetivo (completa un objetivo de misión)
 */
export function createObjectiveReward(
  objectiveKey: string,
  questId?: string,
  options?: {
    id?: string;
    condition?: QuestRewardCondition;
  }
): QuestReward {
  return {
    id: options?.id || generateId(),
    type: 'objective',
    objective: {
      objectiveKey,
      questId,
    },
    condition: options?.condition,
  };
}

/**
 * Crea una recompensa de solicitud (completa una solicitud del personaje)
 */
export function createSolicitudReward(
  solicitudKey: string,
  solicitudId?: string,
  options?: {
    id?: string;
    solicitudName?: string;
    condition?: QuestRewardCondition;
  }
): QuestReward {
  return {
    id: options?.id || generateId(),
    type: 'solicitud',
    solicitud: {
      solicitudKey,
      solicitudId,
      solicitudName: options?.solicitudName,
    },
    condition: options?.condition,
  };
}

// ============================================
// Legacy Migration - Convertir formato antiguo al nuevo
// ============================================

/**
 * Migra una recompensa del formato antiguo al nuevo
 * 
 * Formato antiguo:
 * { type: 'sprite', key: 'feliz', value: 'url', returnToIdleMs: 3000 }
 * 
 * Formato nuevo:
 * { type: 'trigger', trigger: { category: 'sprite', key: 'feliz', targetMode: 'self' } }
 */
export function migrateRewardToNewFormat(reward: Partial<QuestReward> & { type: string }): QuestReward {
  const id = reward.id || generateId();
  const condition = reward.condition;

  // Si ya está en formato nuevo, retornar tal cual
  if (reward.type === 'attribute' && reward.attribute) {
    return { ...reward, id } as QuestReward;
  }
  if (reward.type === 'trigger' && reward.trigger) {
    return { ...reward, id } as QuestReward;
  }

  // Migrar del formato antiguo
  switch (reward.type) {
    case 'attribute': {
      // Formato antiguo: { type: 'attribute', key: 'HP', value: 10, action: 'add' }
      const attribute: QuestRewardAttribute = {
        key: reward.key || '',
        value: reward.value ?? 0,
        action: (reward.action as AttributeAction) || 'set',
      };
      return {
        id,
        type: 'attribute',
        attribute,
        condition,
      };
    }

    case 'sprite': {
      // Formato antiguo: { type: 'sprite', key: 'feliz', value: 'url', returnToIdleMs: 3000 }
      const trigger: QuestRewardTrigger = {
        category: 'sprite',
        key: reward.key || '',
        targetMode: 'self',
        returnToIdleMs: reward.returnToIdleMs,
      };
      return {
        id,
        type: 'trigger',
        trigger,
        condition,
      };
    }

    case 'sound': {
      // Formato antiguo: { type: 'sound', key: 'collection', value: 'filename' }
      const trigger: QuestRewardTrigger = {
        category: 'sound',
        key: reward.key || '',
        targetMode: 'self',
      };
      return {
        id,
        type: 'trigger',
        trigger,
        condition,
      };
    }

    case 'background': {
      // Formato antiguo: { type: 'background', key: 'label', value: 'url' }
      const trigger: QuestRewardTrigger = {
        category: 'background',
        key: reward.key || '',
        targetMode: 'self',
      };
      return {
        id,
        type: 'trigger',
        trigger,
        condition,
      };
    }

    case 'item':
    case 'custom':
    default: {
      // Para item y custom, convertir a attribute como fallback
      // Esto permite que los datos no se pierdan durante la migración
      const attribute: QuestRewardAttribute = {
        key: reward.key || 'unknown',
        value: reward.value ?? 0,
        action: 'set',
      };
      return {
        id,
        type: 'attribute',
        attribute,
        condition,
      };
    }
  }
}

/**
 * Migra un array de recompensas al nuevo formato
 */
export function migrateRewardsToNewFormat(rewards: Array<Partial<QuestReward> & { type: string }>): QuestReward[] {
  return rewards.map(migrateRewardToNewFormat);
}

// ============================================
// Validation Functions
// ============================================

/**
 * Valida que una recompensa tenga la estructura correcta
 */
export function validateReward(reward: QuestReward): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!reward.id) {
    errors.push('Reward must have an id');
  }

  if (reward.type === 'attribute') {
    if (!reward.attribute && !reward.key) {
      errors.push('Attribute reward must have attribute.key or legacy key');
    }
    if (reward.attribute && !reward.attribute.key) {
      errors.push('Attribute reward must have attribute.key');
    }
    if (reward.attribute && reward.attribute.value === undefined) {
      errors.push('Attribute reward must have attribute.value');
    }
  }

  if (reward.type === 'trigger') {
    if (!reward.trigger) {
      errors.push('Trigger reward must have trigger config');
    } else {
      if (!reward.trigger.category) {
        errors.push('Trigger reward must have trigger.category');
      }
      if (!reward.trigger.key) {
        errors.push('Trigger reward must have trigger.key');
      }
      if (!['self', 'all', 'target'].includes(reward.trigger.targetMode)) {
        errors.push('Trigger reward must have valid trigger.targetMode');
      }
    }
  }

  if (reward.type === 'objective') {
    if (!reward.objective) {
      errors.push('Objective reward must have objective config');
    } else {
      if (!reward.objective.objectiveKey) {
        errors.push('Objective reward must have objective.objectiveKey');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Valida un array de recompensas
 */
export function validateRewards(rewards: QuestReward[]): { valid: boolean; errors: Map<string, string[]> } {
  const errors = new Map<string, string[]>();
  let allValid = true;

  for (const reward of rewards) {
    const result = validateReward(reward);
    if (!result.valid) {
      allValid = false;
      errors.set(reward.id, result.errors);
    }
  }

  return {
    valid: allValid,
    errors,
  };
}

// ============================================
// Utility Functions
// ============================================

/**
 * Obtiene el símbolo de acción para mostrar en UI
 */
export function getActionSymbol(action: AttributeAction): string {
  const symbols: Record<AttributeAction, string> = {
    set: '=',
    add: '+',
    subtract: '-',
    multiply: '×',
    divide: '÷',
    percent: '%+',
  };
  return symbols[action] || '=';
}

/**
 * Obtiene el icono de categoría para mostrar en UI
 */
export function getCategoryIcon(category: TriggerCategory): string {
  const icons: Record<TriggerCategory, string> = {
    sprite: '🖼️',
    sound: '🔊',
    background: '🌄',
    soundSequence: '🎵',
  };
  return icons[category] || '❓';
}

/**
 * Obtiene el label de targetMode para mostrar en UI
 */
export function getTargetModeLabel(mode: TriggerTargetMode): string {
  const labels: Record<TriggerTargetMode, string> = {
    self: 'Mismo personaje',
    all: 'Todos',
    target: 'Objetivo específico',
  };
  return labels[mode] || mode;
}

/**
 * Genera una descripción legible de la recompensa
 */
export function describeReward(reward: QuestReward): string {
  if (reward.type === 'attribute') {
    const attr = reward.attribute || { key: reward.key || '?', value: reward.value ?? '?', action: 'set' };
    const symbol = getActionSymbol(attr.action as AttributeAction);
    return `${attr.key} ${symbol} ${attr.value}`;
  }

  if (reward.type === 'trigger') {
    const trig = reward.trigger;
    if (!trig) return 'Trigger inválido';
    const icon = getCategoryIcon(trig.category);
    return `${icon} ${trig.key} (${getTargetModeLabel(trig.targetMode)})`;
  }

  if (reward.type === 'objective') {
    const obj = reward.objective;
    if (!obj) return 'Objetivo inválido';
    return `🎯 Objetivo: ${obj.objectiveKey}${obj.questId ? ` (${obj.questId})` : ''}`;
  }

  if (reward.type === 'solicitud') {
    const sol = reward.solicitud;
    if (!sol) return 'Solicitud inválida';
    return `📋 Solicitud: ${sol.solicitudName || sol.solicitudKey}`;
  }

  return 'Recompensa desconocida';
}

/**
 * Genera una descripción de un array de recompensas
 */
export function describeRewards(rewards: QuestReward[]): string {
  return rewards.map(describeReward).join(', ');
}

// ============================================
// Normalization Functions
// ============================================

/**
 * Normaliza una recompensa asegurando que tenga la estructura correcta
 * Combina campos legacy con la nueva estructura
 */
export function normalizeReward(reward: QuestReward): QuestReward {
  // Si ya tiene la estructura nueva completa, retornar tal cual
  if (reward.type === 'attribute' && reward.attribute) {
    return reward;
  }
  if (reward.type === 'trigger' && reward.trigger) {
    return reward;
  }
  if (reward.type === 'objective' && reward.objective) {
    return reward;
  }

  // Si tiene campos legacy, crear la estructura nueva
  if (reward.type === 'attribute') {
    return {
      ...reward,
      attribute: {
        key: reward.key || reward.attribute?.key || '',
        value: reward.value ?? reward.attribute?.value ?? 0,
        action: reward.action || reward.attribute?.action || 'set',
      },
    };
  }

  if (reward.type === 'trigger' || ['sprite', 'sound', 'background', 'soundSequence'].includes(reward.type as string)) {
    // Determinar categoría desde tipo legacy o trigger.category
    let category: TriggerCategory = 'sprite';
    if (reward.type === 'sound' || reward.trigger?.category === 'sound') {
      category = 'sound';
    } else if (reward.type === 'background' || reward.trigger?.category === 'background') {
      category = 'background';
    } else if (reward.type === 'soundSequence' || reward.trigger?.category === 'soundSequence') {
      category = 'soundSequence';
    }

    return {
      ...reward,
      type: 'trigger',
      trigger: {
        category,
        key: reward.key || reward.trigger?.key || '',
        targetMode: 'self',
        returnToIdleMs: reward.returnToIdleMs || reward.trigger?.returnToIdleMs,
        volume: reward.trigger?.volume,
        transitionDuration: reward.trigger?.transitionDuration,
      },
    };
  }

  // Handle objective type
  if (reward.type === 'objective') {
    return {
      ...reward,
      objective: {
        objectiveKey: reward.objective?.objectiveKey || '',
        questId: reward.objective?.questId,
      },
    };
  }

  return reward;
}

/**
 * Normaliza un array de recompensas
 */
export function normalizeRewards(rewards: QuestReward[]): QuestReward[] {
  return rewards.map(normalizeReward);
}
