# Plan de Trabajo: Sistema Unificado de Recompensas

## Resumen Ejecutivo

Simplificar el sistema de recompensas de misiones de 6 tipos separados a **2 tipos unificados**:
- **attribute**: Modifica atributos del personaje en la sesión
- **trigger**: Activa triggers existentes (sprite/sound/background) simulando detección de tokens

---

## Arquitectura Propuesta

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SISTEMA UNIFICADO DE RECOMPENSAS                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    QuestReward (Nuevo Tipo)                         │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │  type: 'attribute' | 'trigger'                                      │    │
│  │                                                                      │    │
│  │  // Para attribute:                                                  │    │
│  │  attribute?: { key, value, action }                                  │    │
│  │                                                                      │    │
│  │  // Para trigger:                                                    │    │
│  │  trigger?: { category, key, targetMode }                             │    │
│  │                                                                      │    │
│  │  // Común:                                                           │    │
│  │  condition?: QuestRewardCondition                                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## FASE 1: Actualizar Tipos e Interfaces

### Archivos a modificar:
- `/src/types/index.ts`

### Cambios:

```typescript
// ============================================
// NUEVO SISTEMA DE RECOMPENSAS (SIMPLIFICADO)
// ============================================

export type QuestRewardType = 'attribute' | 'trigger';

// Categorías de triggers disponibles
export type TriggerCategory = 'sprite' | 'sound' | 'background';

// Modo de objetivo para triggers (importante para grupos)
export type TriggerTargetMode = 'self' | 'all' | 'target';

// Configuración de recompensa de atributo
export interface QuestAttributeReward {
  key: string;                    // "resistencia", "HP", "oro"
  value: number | string;         // Valor a aplicar
  action: 'set' | 'add' | 'subtract' | 'multiply' | 'divide' | 'percent';
}

// Configuración de recompensa de trigger
export interface QuestTriggerReward {
  category: TriggerCategory;      // 'sprite' | 'sound' | 'background'
  key: string;                    // Keyword del trigger: "feliz", "victory"
  targetMode: TriggerTargetMode;  // Quién recibe el trigger
  targetId?: string;              // Para targetMode: 'target'
}

// NUEVA interfaz QuestReward simplificada
export interface QuestReward {
  id: string;
  
  // Tipo de recompensa
  type: QuestRewardType;
  
  // Configuración específica según tipo
  attribute?: QuestAttributeReward;
  trigger?: QuestTriggerReward;
  
  // Condición opcional para ejecutar
  condition?: QuestRewardCondition;
  
  // ===== CAMPOS LEGACY (para migración) =====
  // Mantener para compatibilidad durante transición
  key?: string;
  value?: string | number;
  action?: 'set' | 'add' | 'subtract' | 'multiply' | 'divide' | 'percent';
  returnToIdleMs?: number;
}

// Tipo legacy para referencia
export type QuestRewardTypeLegacy = 'attribute' | 'sprite' | 'sound' | 'background' | 'item' | 'custom';
```

### Tareas:
- [ ] Añadir nuevos tipos: `TriggerCategory`, `TriggerTargetMode`
- [ ] Añadir interfaces: `QuestAttributeReward`, `QuestTriggerReward`
- [ ] Modificar `QuestReward` para usar la nueva estructura
- [ ] Mantener campos legacy con comentarios
- [ ] Actualizar `QuestObjectiveTemplate` para usar rewards en objetivos

---

## FASE 2: Crear UnifiedTriggerExecutor

### Archivos nuevos:
- `/src/lib/triggers/unified-trigger-executor.ts`

### Propósito:
Este módulo actúa como puente entre el sistema de recompensas y el sistema de triggers existente. Simula que el `TokenDetector` encontró un token, permitiendo reutilizar toda la infraestructura de handlers.

### Implementación:

```typescript
// ============================================
// Unified Trigger Executor
// ============================================

import type { CharacterCard, TriggerCategory, TriggerTargetMode } from '@/types';
import type { DetectedToken } from './token-detector';
import { getTriggerBus, createTokensEvent, type TriggerContext } from './trigger-bus';

export interface TriggerExecutionContext {
  sessionId: string;
  characterId: string;
  character: CharacterCard;
  allCharacters?: CharacterCard[];
  source: 'objective' | 'quest_completion';
}

export interface TriggerExecutionResult {
  success: boolean;
  category: TriggerCategory;
  key: string;
  message?: string;
  error?: string;
}

/**
 * Ejecuta un trigger de recompensa
 * 
 * Simula que el TokenDetector encontró un token, permitiendo
 * reutilizar toda la infraestructura existente de handlers.
 */
export function executeTriggerReward(
  category: TriggerCategory,
  key: string,
  context: TriggerExecutionContext,
  targetMode: TriggerTargetMode = 'self',
  targetId?: string
): TriggerExecutionResult {
  // 1. Determinar el personaje objetivo
  const targets = getTargetCharacters(targetMode, context, targetId);
  
  if (targets.length === 0) {
    return {
      success: false,
      category,
      key,
      error: 'No target characters found',
    };
  }
  
  // 2. Ejecutar para cada objetivo
  const results: TriggerExecutionResult[] = [];
  for (const target of targets) {
    const result = executeTriggerForCharacter(category, key, context, target);
    results.push(result);
  }
  
  // 3. Retornar resultado agregado
  const allSuccess = results.every(r => r.success);
  return {
    success: allSuccess,
    category,
    key,
    message: `Trigger ${category}:${key} executed for ${targets.length} character(s)`,
    error: allSuccess ? undefined : 'Some triggers failed',
  };
}

/**
 * Ejecuta trigger para un personaje específico
 */
function executeTriggerForCharacter(
  category: TriggerCategory,
  key: string,
  context: TriggerExecutionContext,
  target: CharacterCard
): TriggerExecutionResult {
  // Crear token sintético
  const syntheticToken: DetectedToken = {
    token: key.toLowerCase(),
    original: key,
    type: 'pipe',  // Triggers de recompensa se tratan como pipes
    position: 0,
    wordPosition: 0,
  };
  
  // Crear contexto de trigger
  const triggerContext: TriggerContext = {
    character: target,
    characters: context.allCharacters,
    fullText: `[REWARD:${category}:${key}]`,
    messageKey: `reward-${Date.now()}`,
    isStreaming: false,
    timestamp: Date.now(),
  };
  
  // Emitir evento al TriggerBus
  const bus = getTriggerBus();
  bus.emit(createTokensEvent([syntheticToken], triggerContext));
  
  return {
    success: true,
    category,
    key,
    message: `Trigger ${category}:${key} executed for ${target.name}`,
  };
}

/**
 * Determina los personajes objetivo según targetMode
 */
function getTargetCharacters(
  targetMode: TriggerTargetMode,
  context: TriggerExecutionContext,
  targetId?: string
): CharacterCard[] {
  switch (targetMode) {
    case 'self':
      return context.character ? [context.character] : [];
    case 'all':
      return context.allCharacters || (context.character ? [context.character] : []);
    case 'target':
      if (targetId && context.allCharacters) {
        const target = context.allCharacters.find(c => c.id === targetId);
        return target ? [target] : [];
      }
      return context.character ? [context.character] : [];
    default:
      return context.character ? [context.character] : [];
  }
}
```

### Tareas:
- [ ] Crear archivo `/src/lib/triggers/unified-trigger-executor.ts`
- [ ] Implementar `executeTriggerReward()`
- [ ] Implementar `getTargetCharacters()` con soporte para grupos
- [ ] Exportar desde `/src/lib/triggers/index.ts`

---

## FASE 3: Refactorizar Quest Reward Executor

### Archivos a modificar:
- `/src/lib/quest/quest-reward-executor.ts`

### Cambios principales:

```typescript
// ============================================
// Simplified Quest Reward Executor
// ============================================

import type { QuestReward, SessionStats, CharacterCard } from '@/types';
import { executeTriggerReward, type TriggerExecutionContext } from '@/lib/triggers/unified-trigger-executor';

export interface RewardExecutionContext {
  sessionId: string;
  characterId: string;
  character?: CharacterCard | null;
  allCharacters?: CharacterCard[];
  sessionStats?: SessionStats;
  timestamp: number;
}

/**
 * Ejecuta una recompensa (punto de entrada único)
 */
export function executeReward(
  reward: QuestReward,
  context: RewardExecutionContext,
  storeActions: RewardStoreActions
): RewardExecutionResult {
  // Verificar condición
  if (reward.condition && !evaluateCondition(reward.condition, context)) {
    return {
      rewardId: reward.id,
      type: reward.type,
      success: false,
      message: 'Condition not met',
    };
  }
  
  // Verificar si es formato legacy y convertir
  const normalizedReward = normalizeReward(reward);
  
  switch (normalizedReward.type) {
    case 'attribute':
      return executeAttributeReward(normalizedReward, context, storeActions);
    case 'trigger':
      return executeTriggerTypeReward(normalizedReward, context);
    default:
      return {
        rewardId: reward.id,
        type: reward.type,
        success: false,
        error: `Unknown reward type`,
      };
  }
}

/**
 * Normaliza rewards legacy al nuevo formato
 */
function normalizeReward(reward: QuestReward): QuestReward {
  // Si ya tiene el nuevo formato, retornar tal cual
  if (reward.attribute || reward.trigger) {
    return reward;
  }
  
  // Convertir formato legacy
  if (reward.type === 'attribute' && reward.key) {
    return {
      ...reward,
      attribute: {
        key: reward.key,
        value: reward.value ?? 0,
        action: reward.action ?? 'set',
      },
    };
  }
  
  // Convertir sprite/sound/background legacy a trigger
  if (['sprite', 'sound', 'background'].includes(reward.type) && reward.key) {
    return {
      ...reward,
      trigger: {
        category: reward.type as TriggerCategory,
        key: reward.key,
        targetMode: 'self' as TriggerTargetMode,
      },
    };
  }
  
  return reward;
}
```

### Tareas:
- [ ] Simplificar `executeReward()` para usar solo 2 tipos
- [ ] Implementar `normalizeReward()` para compatibilidad legacy
- [ ] Eliminar funciones específicas de cada tipo (`executeSpriteReward`, etc.)
- [ ] Actualizar `describeReward()` para nuevo formato

---

## FASE 4: Actualizar Store Slices

### Archivos a verificar:
- `/src/store/slices/statsSlice.ts` - Asegurar que `updateCharacterStat` está disponible
- `/src/store/slices/sessionSlice.ts` - Verificar que pasa `allCharacters` para grupos

### Tareas:
- [ ] Verificar que `statsSlice.updateCharacterStat` funciona correctamente
- [ ] Asegurar que en grupos se pasa `allCharacters` al contexto de recompensas

---

## FASE 5: Crear Componente RewardEditor UI

### Archivos nuevos:
- `/src/components/quests/reward-editor.tsx`

### Propósito:
Componente reutilizable para editar recompensas, usado tanto en objetivos como en recompensas de misión.

### Características del UI:
- Selector de tipo: "Atributo" | "Trigger"
- Editor de atributo: key, action, value
- Editor de trigger: category, key, targetMode (solo grupos)
- Botones de mover arriba/abajo, eliminar

### Tareas:
- [ ] Crear archivo `/src/components/quests/reward-editor.tsx`
- [ ] Implementar `RewardEditor` componente principal
- [ ] Implementar `AttributeEditor` subcomponente
- [ ] Implementar `TriggerEditor` subcomponente
- [ ] Añadir soporte para grupos (targetMode)
- [ ] Exportar desde `/src/components/quests/index.ts`

---

## FASE 6: Actualizar QuestTemplateManager

### Archivos a modificar:
- `/src/components/settings/quest-template-manager.tsx`

### Cambios:
1. Importar y usar `RewardEditor` en lugar del editor inline actual
2. Actualizar sección de recompensas de misión
3. Añadir soporte para recompensas en objetivos

### Tareas:
- [ ] Importar `RewardEditor` component
- [ ] Reemplazar UI de recompensas actual con `RewardEditor`
- [ ] Añadir `availableAttributes` desde el personaje/grupo
- [ ] Añadir `availableTriggers` desde spritePacks/soundTriggers/etc.

---

## FASE 7: Añadir Recompensas en Objetivos

### Archivos a modificar:
- `/src/components/settings/quest-template-manager.tsx` (sección objetivos)

### Cambios:
Mostrar sección de recompensas dentro de cada objetivo en el editor.

### Tareas:
- [ ] Añadir UI de recompensas dentro de cada objetivo
- [ ] Usar `RewardEditor` para editar rewards de objetivos
- [ ] Añadir botón "Agregar recompensa" en cada objetivo

---

## FASE 8: Migración de Datos Legacy

### Archivos nuevos:
- `/src/lib/quest/reward-migration.ts`

### Propósito:
Funciones para convertir recompensas legacy al nuevo formato.

### Tareas:
- [ ] Crear archivo de migración
- [ ] Implementar `migrateReward()` y `migrateRewards()`
- [ ] Integrar en carga de templates

---

## FASE 9: Testing y Verificación

### Checklist de Testing:

#### Chat Simple (1 personaje)
- [ ] Crear misión con recompensa de atributo → funciona
- [ ] Crear misión con recompensa de trigger (sprite) → funciona
- [ ] Crear misión con recompensa de trigger (sound) → funciona
- [ ] Completar objetivo con recompensa → se ejecuta
- [ ] Completar misión con múltiples recompensas → se ejecutan todas

#### Chat Grupal (múltiples personajes)
- [ ] Recompensa con targetMode: 'self' → solo el que completó
- [ ] Recompensa con targetMode: 'all' → todos los miembros
- [ ] Recompensa de atributo en grupo → se aplica al correcto

#### Migración Legacy
- [ ] Cargar misión con rewards legacy → se migra correctamente
- [ ] Editar misión legacy → guarda en nuevo formato

#### UI
- [ ] Selector de tipo muestra "Atributo" y "Trigger"
- [ ] Editor de atributo funciona correctamente
- [ ] Editor de trigger funciona correctamente
- [ ] targetMode solo visible en grupos

---

## Estimación de Tiempo

| Fase | Tiempo Estimado | Prioridad |
|------|-----------------|-----------|
| FASE 1: Tipos | 1 hora | Alta |
| FASE 2: UnifiedTriggerExecutor | 2 horas | Alta |
| FASE 3: Reward Executor | 2 horas | Alta |
| FASE 4: Store Slices | 30 min | Media |
| FASE 5: RewardEditor UI | 3 horas | Alta |
| FASE 6: QuestTemplateManager | 2 horas | Media |
| FASE 7: Objetivos con rewards | 1 hora | Media |
| FASE 8: Migración | 1 hora | Media |
| FASE 9: Testing | 2 horas | Alta |

**Total estimado: ~14.5 horas**

---

## Orden de Implementación Recomendado

1. **FASE 1** → Tipos primero (fundación)
2. **FASE 2** → UnifiedTriggerExecutor (core del sistema)
3. **FASE 3** → Refactorizar Reward Executor (lógica)
4. **FASE 5** → RewardEditor UI (componente visual)
5. **FASE 6** → Integrar en QuestTemplateManager
6. **FASE 7** → Añadir rewards en objetivos
7. **FASE 8** → Migración legacy
8. **FASE 4** → Verificar store (si es necesario)
9. **FASE 9** → Testing completo

---

## Notas Adicionales

### Compatibilidad
- Mantener campos legacy en `QuestReward` durante la migración
- El `normalizeReward()` convierte legacy a nuevo formato automáticamente
- Los templates existentes deben funcionar sin cambios

### Extensibilidad
- El sistema de triggers se puede extender fácilmente
- Nuevos tipos de triggers se añaden automáticamente
- No requiere modificar el executor para nuevos triggers

### Consideraciones de Grupo
- `targetMode` es clave para el comportamiento en grupos
- El contexto debe incluir `allCharacters` para grupos
- Los atributos se aplican por `characterId`
