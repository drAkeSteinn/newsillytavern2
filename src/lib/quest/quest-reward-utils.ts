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
  QuestRewardTargetAttribute,
  QuestRewardConditionalSpriteCollection,
  QuestRewardActivateSpritePack,
  QuestRewardCondition,
  AttributeAction,
  TriggerCategory,
  TriggerTargetMode,
  TriggerFallbackMode,
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

/**
 * Crea una recompensa de atributo de target (modifica atributo de otro personaje/persona)
 */
export function createTargetAttributeReward(
  targetCharacterId: string,
  key: string,
  value: number | string,
  action: AttributeAction = 'set',
  options?: {
    id?: string;
    condition?: QuestRewardCondition;
  }
): QuestReward {
  return {
    id: options?.id || generateId(),
    type: 'target_attribute',
    target_attribute: {
      targetCharacterId,
      key,
      value,
      action,
    },
    condition: options?.condition,
  };
}

/**
 * Crea una recompensa de divisa (solo para persona)
 */
export function createCurrencyReward(
  amount: number,
  options?: {
    id?: string;
    condition?: QuestRewardCondition;
  }
): QuestReward {
  return {
    id: options?.id || generateId(),
    type: 'currency',
    currency: {
      amount,
    },
    condition: options?.condition,
  };
}

/**
 * Crea una recompensa de activate_sprite_pack
 * Activa un Sprite Pack directamente. Si el pack tiene conditionalMode,
 * evalúa las condiciones de cada sprite para seleccionar el correcto.
 */
export function createActivateSpritePackReward(
  packId: string,
  options?: {
    id?: string;
    behavior?: 'principal' | 'random' | 'list';
    principalSpriteId?: string;
    targetMode?: TriggerTargetMode;
    targetCharacterId?: string;
    returnToIdleMs?: number;
    fallbackMode?: TriggerFallbackMode;
    condition?: QuestRewardCondition;
  }
): QuestReward {
  const config: QuestRewardActivateSpritePack = {
    packId,
    behavior: options?.behavior,
    principalSpriteId: options?.principalSpriteId,
    targetMode: options?.targetMode || 'self',
    targetCharacterId: options?.targetCharacterId,
    returnToIdleMs: options?.returnToIdleMs,
    fallbackMode: options?.fallbackMode,
  };

  return {
    id: options?.id || generateId(),
    type: 'activate_sprite_pack',
    activate_sprite_pack: config,
    condition: options?.condition,
  };
}

/**
 * Crea una recompensa de conditional_sprite_collection
 * Activa una TriggerCollection en modo condicional, evaluando atributos
 * para determinar qué sprite mostrar.
 */
export function createConditionalSpriteCollectionReward(
  collectionId: string,
  targetMode: TriggerTargetMode = 'self',
  options?: {
    id?: string;
    targetCharacterId?: string;
    returnToIdleMs?: number;
    fallbackMode?: TriggerFallbackMode;
    condition?: QuestRewardCondition;
  }
): QuestReward {
  const config: QuestRewardConditionalSpriteCollection = {
    collectionId,
    targetMode,
  };

  if (options?.targetCharacterId) {
    config.targetCharacterId = options.targetCharacterId;
  }
  if (options?.returnToIdleMs !== undefined) {
    config.returnToIdleMs = options.returnToIdleMs;
  }
  if (options?.fallbackMode) {
    config.fallbackMode = options.fallbackMode;
  }

  return {
    id: options?.id || generateId(),
    type: 'conditional_sprite_collection',
    conditional_sprite_collection: config,
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

  if (reward.type === 'target_attribute') {
    if (!reward.target_attribute) {
      errors.push('Target attribute reward must have target_attribute config');
    } else {
      if (!reward.target_attribute.targetCharacterId) {
        errors.push('Target attribute reward must have target_attribute.targetCharacterId');
      }
      if (!reward.target_attribute.key) {
        errors.push('Target attribute reward must have target_attribute.key');
      }
      if (reward.target_attribute.value === undefined) {
        errors.push('Target attribute reward must have target_attribute.value');
      }
    }
  }

  if (reward.type === 'currency') {
    if (!reward.currency) {
      errors.push('Currency reward must have currency config');
    } else {
      if (reward.currency.amount === undefined || reward.currency.amount === 0) {
        errors.push('Currency reward must have non-zero currency.amount');
      }
    }
  }

  if (reward.type === 'conditional_sprite_collection') {
    if (!reward.conditional_sprite_collection) {
      errors.push('Conditional sprite collection reward must have conditional_sprite_collection config');
    } else {
      if (!reward.conditional_sprite_collection.collectionId) {
        errors.push('Conditional sprite collection reward must have conditional_sprite_collection.collectionId');
      }
      if (!reward.conditional_sprite_collection.targetMode) {
        errors.push('Conditional sprite collection reward must have conditional_sprite_collection.targetMode');
      }
      if (!['self', 'all', 'target'].includes(reward.conditional_sprite_collection.targetMode)) {
        errors.push('Conditional sprite collection reward must have valid targetMode (self, all, target)');
      }
      if (reward.conditional_sprite_collection.targetMode === 'target' && !reward.conditional_sprite_collection.targetCharacterId) {
        errors.push('Conditional sprite collection reward with targetMode "target" must have targetCharacterId');
      }
    }
  }

  if (reward.type === 'activate_sprite_pack') {
    if (!reward.activate_sprite_pack) {
      errors.push('Activate sprite pack reward must have activate_sprite_pack config');
    } else {
      if (!reward.activate_sprite_pack.packId) {
        errors.push('Activate sprite pack reward must have packId');
      }
      if (!reward.activate_sprite_pack.targetMode) {
        errors.push('Activate sprite pack reward must have targetMode');
      }
      if (reward.activate_sprite_pack.targetMode === 'target' && !reward.activate_sprite_pack.targetCharacterId) {
        errors.push('Activate sprite pack reward with target mode must have targetCharacterId');
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

  if (reward.type === 'target_attribute') {
    const ta = reward.target_attribute;
    if (!ta) return 'Atributo de Target inválido';
    const symbol = getActionSymbol(ta.action);
    const targetLabel = ta.targetCharacterId === '__user__' ? '👤 Persona' : `@${ta.targetCharacterId}`;
    return `🔗 ${targetLabel}.${ta.key} ${symbol} ${ta.value}`;
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

  if (reward.type === 'currency') {
    const curr = reward.currency;
    if (!curr) return 'Divisa inválida';
    return `💰 Divisa: ${curr.amount > 0 ? '+' : ''}${curr.amount}`;
  }

  if (reward.type === 'conditional_sprite_collection') {
    const csc = reward.conditional_sprite_collection;
    if (!csc) return 'Sprite condicional inválido';
    const targetLabels: Record<string, string> = {
      self: '',
      all: ' (todos)',
      target: ' (objetivo)',
    };
    const targetLabel = targetLabels[csc.targetMode] || '';
    const fallback = csc.returnToIdleMs && csc.returnToIdleMs > 0
      ? ` [${csc.returnToIdleMs}ms]`
      : ' [persistente]';
    return `🎨 Sprite Condicional: ${csc.collectionId}${targetLabel}${fallback}`;
  }

  if (reward.type === 'activate_sprite_pack' && reward.activate_sprite_pack) {
    const asp = reward.activate_sprite_pack;
    const mode = asp.targetMode || 'self';
    if (mode === 'target') {
      const targetLabel = asp.targetCharacterId === '__user__' ? '👤 Persona' : `@${asp.targetCharacterId || '?'}`;
      const packLabel = asp.targetPackId ? ` → ${asp.targetPackId}` : '';
      return `🎨 Sprite Pack → ${targetLabel}${packLabel}`;
    }
    const fallback = asp.fallbackPackId ? ` (fallback: ${asp.fallbackPackId})` : '';
    const persistLabel = asp.returnToIdleMs && asp.returnToIdleMs > 0 ? ` [${asp.returnToIdleMs}ms]` : '';
    return `🎨 Sprite Pack: ${asp.packId || 'sin pack'}${fallback}${persistLabel}`;
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
  if (reward.type === 'solicitud' && reward.solicitud) {
    return reward;
  }
  if (reward.type === 'target_attribute' && reward.target_attribute) {
    return reward;
  }
  if (reward.type === 'currency' && reward.currency) {
    return reward;
  }
  if (reward.type === 'conditional_sprite_collection' && reward.conditional_sprite_collection) {
    return reward;
  }
  if (reward.type === 'activate_sprite_pack' && reward.activate_sprite_pack) {
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

  // Handle target_attribute type
  if (reward.type === 'target_attribute') {
    return {
      ...reward,
      target_attribute: {
        targetCharacterId: reward.target_attribute?.targetCharacterId || '',
        key: reward.target_attribute?.key || '',
        value: reward.target_attribute?.value ?? 0,
        action: reward.target_attribute?.action || 'set',
      },
    };
  }

  // Handle conditional_sprite_collection type
  if (reward.type === 'conditional_sprite_collection') {
    return {
      ...reward,
      conditional_sprite_collection: {
        collectionId: reward.conditional_sprite_collection?.collectionId || '',
        targetMode: reward.conditional_sprite_collection?.targetMode || 'self',
        targetCharacterId: reward.conditional_sprite_collection?.targetCharacterId,
        returnToIdleMs: reward.conditional_sprite_collection?.returnToIdleMs,
        fallbackMode: reward.conditional_sprite_collection?.fallbackMode,
      },
    };
  }

  // Handle activate_sprite_pack type
  if (reward.type === 'activate_sprite_pack') {
    return {
      ...reward,
      activate_sprite_pack: {
        packId: reward.activate_sprite_pack?.packId || '',
        behavior: reward.activate_sprite_pack?.behavior,
        principalSpriteId: reward.activate_sprite_pack?.principalSpriteId,
        targetMode: reward.activate_sprite_pack?.targetMode || 'self',
        targetCharacterId: reward.activate_sprite_pack?.targetCharacterId,
        returnToIdleMs: reward.activate_sprite_pack?.returnToIdleMs,
        fallbackMode: reward.activate_sprite_pack?.fallbackMode,
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
