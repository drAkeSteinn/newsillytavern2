# Plan de Migración: Sistema de Triggers Unificado

## ✅ MIGRACIÓN COMPLETADA

Todas las fases de la migración han sido completadas exitosamente. El sistema de triggers ahora usa una arquitectura unificada basada en `KeyHandler`.

---

## Estado Final

### Arquitectura Unificada

```
┌─────────────────────────────────────────────────────────────────┐
│                    STREAMING CONTENT                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     useTriggerSystem                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    KeyDetector                              ││
│  │  Detecta: [key], |key|, Peticion:key, key:value, words     ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              Unified KeyHandler Processing                  ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                  │
│        ┌─────────────────────┼─────────────────────┐           │
│        ▼                     ▼                     ▼           │
│  ┌───────────┐         ┌───────────┐         ┌───────────┐    │
│  │  Sound    │         │  Sprite   │         │ Background│    │
│  │ KeyHandler│         │ KeyHandler│         │ KeyHandler│    │
│  └───────────┘         └───────────┘         └───────────┘    │
│        │                     │                     │           │
│  ┌───────────┐         ┌───────────┐         ┌───────────┐    │
│  │   HUD     │         │   Quest   │         │   Stats   │    │
│  │ KeyHandler│         │ KeyHandler│         │ KeyHandler│    │
│  └───────────┘         └───────────┘         └───────────┘    │
│        │                     │                     │           │
│  ┌───────────┐         ┌───────────┐         ┌───────────┐    │
│  │   Item    │         │   Skill   │         │ Solicitud │    │
│  │ KeyHandler│         │ KeyHandler│         │ KeyHandler│    │
│  └───────────┘         └───────────┘         └───────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Handlers Finales

| Handler | Sistema | Estado | Fase |
|---------|---------|--------|------|
| SoundKeyHandler | KeyHandler | ✅ Completado | Fase 2 |
| SpriteKeyHandler | KeyHandler | ✅ Completado | Fase 2 |
| BackgroundKeyHandler | KeyHandler | ✅ Completado | Fase 3 |
| HUDKeyHandler | KeyHandler | ✅ Completado | Fase 3 |
| QuestKeyHandler | KeyHandler | ✅ Completado | Fase 4 |
| StatsKeyHandler | KeyHandler | ✅ Completado | Fase 4 |
| ItemKeyHandler | KeyHandler | ✅ Completado | Fase 4 |
| SkillKeyHandler | KeyHandler | ✅ Completado | Fase 1 |
| SolicitudKeyHandler | KeyHandler | ✅ Completado | Fase 1 |
| SoundHandler | Legacy | ⚠️ Deprecated | Ver migration guide |
| SpriteHandler | Legacy | ⚠️ Deprecated | Ver migration guide |
| BackgroundHandler | Legacy | ⚠️ Deprecated | Ver migration guide |
| HUDHandler | Legacy | ⚠️ Deprecated | Ver migration guide |
| QuestHandler | Legacy | ⚠️ Deprecated | Ver migration guide |
| ItemHandler | Legacy | ⚠️ Deprecated | Ver migration guide |
| StatsHandler | Legacy | ⚠️ Deprecated | Ver migration guide |

---

## Arquitectura Objetivo

```
┌─────────────────────────────────────────────────────────────────┐
│                    STREAMING CONTENT                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     useTriggerSystem                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    KeyDetector                              ││
│  │  Detecta: [key], |key|, Peticion:key, key:value, words     ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                  HandlerRegistry                            ││
│  │  Orquesta todos los handlers por prioridad                  ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                 KeyHandler Interface                        ││
│  │  - canHandle(key, context) → boolean                        ││
│  │  - handleKey(key, context) → TriggerMatchResult             ││
│  │  - execute(match, context) → void                           ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                  │
│        ┌─────────────────────┼─────────────────────┐           │
│        ▼                     ▼                     ▼           │
│  ┌───────────┐         ┌───────────┐         ┌───────────┐    │
│  │  Sound    │         │  Sprite   │         │ Background│    │
│  │ KeyHandler│         │ KeyHandler│         │ KeyHandler│    │
│  └───────────┘         └───────────┘         └───────────┘    │
│        │                     │                     │           │
│  ┌───────────┐         ┌───────────┐         ┌───────────┐    │
│  │   HUD     │         │   Quest   │         │   Stats   │    │
│  │ KeyHandler│         │ KeyHandler│         │ KeyHandler│    │
│  └───────────┘         └───────────┘         └───────────┘    │
│        │                     │                     │           │
│  ┌───────────┐         ┌───────────┐         ┌───────────┐    │
│  │   Item    │         │   Skill   │         │ Solicitud │    │
│  │ KeyHandler│         │ KeyHandler│         │ KeyHandler│    │
│  └───────────┘         └───────────┘         └───────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## FASE 1: Preparación de Infraestructura

**Duración estimada:** 1 sesión
**Objetivo:** Preparar la base para la migración

### Tareas

#### 1.1 Extender KeyDetector con características avanzadas

```typescript
// src/lib/triggers/key-detector.ts

// Añadir soporte para:
- Detección de HUD patterns: [key=value], [key: value]
- Detección de Quest patterns: <quest:activate>, <quest:progress>
- Detección de Stats patterns: +stat, -stat, stat=value
- Detección de Item patterns: [item:name], [item:name=count]
```

**Cambios necesarios:**
- [ ] Añadir pattern para HUD `key=value` con valor numérico
- [ ] Añadir pattern para Quest tags XML
- [ ] Añadir pattern para Stats con operadores (+, -, =)
- [ ] Añadir pattern para Items con cantidades

#### 1.2 Mejorar la interfaz KeyHandler

```typescript
// src/lib/triggers/types.ts

export interface KeyHandler {
  id: string;
  type: TriggerType;
  priority: number;
  
  // Métodos principales
  canHandle(key: DetectedKey, context: TriggerContext): boolean;
  handleKey(key: DetectedKey, context: TriggerContext): TriggerMatchResult | null;
  execute(match: TriggerMatch, context: TriggerContext): void;
  
  // NUEVOS: Métodos para detección avanzada
  getRegisteredKeys?(context: TriggerContext): RegisteredKey[];
  handleBatch?(keys: DetectedKey[], context: TriggerContext): TriggerMatch[];
  
  // Estado
  reset?(messageKey: string): void;
  cleanup?(): void;
}

// NUEVO: Registro de keys para optimización
export interface RegisteredKey {
  key: string;
  config: Record<string, unknown>;
  caseSensitive?: boolean;
  requireValue?: boolean;
}
```

#### 1.3 Crear utilidades compartidas

```typescript
// src/lib/triggers/utils.ts

// Utilidades comunes para todos los handlers:
- parseNumericValue(value: string): number | null
- parseOperator(value: string): '+' | '-' | '=' | null
- matchKeywords(detected: string, keywords: string[], caseSensitive: boolean): boolean
- calculateVolume(base: number, global: number, trigger: number): number
- scheduleReturnToIdle(characterId: string, delay: number, mode: string): void
```

#### 1.4 Crear tests de regresión

```typescript
// src/lib/triggers/__tests__/regression.test.ts

// Tests que aseguran que el nuevo sistema detecta lo mismo que el viejo
describe('Regression Tests', () => {
  it('detects [sound:glohg] like legacy', () => {});
  it('detects |sprite:happy| like legacy', () => {});
  it('detects [quest:activate] like legacy', () => {});
  // ... más tests
});
```

### Checklist Fase 1

- [ ] KeyDetector extendido con nuevos patterns
- [ ] Interfaz KeyHandler mejorada
- [ ] Utilidades compartidas creadas
- [ ] Tests de regresión creados
- [ ] Documentación actualizada

---

## FASE 2: Migración de Handlers Básicos

**Duración estimada:** 2 sesiones
**Objetivo:** Migrar Sound y Sprite handlers

### 2.1 SoundKeyHandler (Consolidación)

El handler ya existe pero hay código legacy duplicado. Consolidar.

```typescript
// src/lib/triggers/handlers/sound-key-handler.ts

export function createSoundKeyHandler(): KeyHandler {
  return {
    id: 'sound-key-handler',
    type: 'sound',
    priority: 100,
    
    canHandle(key: DetectedKey, context: SoundKeyHandlerContext): boolean {
      // Detectar keys de sonido:
      // - Por keyword registrada en soundTriggers
      // - Por formato [sound:name] o |sound_name|
      // - Por prefijo "sonido:" o "sound:"
    },
    
    handleKey(key: DetectedKey, context: SoundKeyHandlerContext): TriggerMatchResult | null {
      // Buscar en soundTriggers
      // Seleccionar archivo (random/cycle)
      // Retornar match con URL y volumen
    },
    
    execute(match: TriggerMatch, context: TriggerContext): void {
      // Reproducir sonido via AudioBus
      // Actualizar cooldown
    },
    
    getRegisteredKeys(context: SoundKeyHandlerContext): RegisteredKey[] {
      // Retornar todas las keywords de soundTriggers
    },
    
    reset(messageKey: string): void {
      // Resetear estado de cooldown
    }
  };
}
```

**Cambios en useTriggerSystem:**
- [ ] Eliminar llamada a `checkSoundTriggers` legacy
- [ ] Usar solo `SoundKeyHandler` via HandlerRegistry
- [ ] Migrar `soundHandlerState` a handler interno

### 2.2 SpriteKeyHandler (Nuevo)

Crear handler unificado para sprites.

```typescript
// src/lib/triggers/handlers/sprite-key-handler.ts

export function createSpriteKeyHandler(): KeyHandler {
  return {
    id: 'sprite-key-handler',
    type: 'sprite',
    priority: 90, // Después de sound
    
    canHandle(key: DetectedKey, context: SpriteKeyHandlerContext): boolean {
      // Detectar keys de sprite:
      // - Por collectionKey en triggerCollections
      // - Por spriteId en spriteConfigs
      // - Por formato [sprite:name], |expression|
      // - Por nombre de pack
    },
    
    handleKey(key: DetectedKey, context: SpriteKeyHandlerContext): TriggerMatchResult | null {
      // Buscar en triggerCollections V2 (prioridad)
      // Buscar en spritePacks legacy
      // Buscar en spriteTriggers simple
      // Retornar match con URL y config de fallback
    },
    
    execute(match: TriggerMatch, context: TriggerContext): void {
      // Aplicar sprite al personaje
      // Programar returnToIdle si aplica
      // Disparar sonidos de timeline si tiene
    },
    
    getRegisteredKeys(context: SpriteKeyHandlerContext): RegisteredKey[] {
      // Retornar todas las keys de triggerCollections + spritePacks
    }
  };
}
```

**Cambios en useTriggerSystem:**
- [ ] Eliminar llamadas a `checkSpriteTriggers` y `checkTriggerCollections`
- [ ] Usar solo `SpriteKeyHandler` via HandlerRegistry
- [ ] Migrar `spriteHandlerState` a handler interno

### Checklist Fase 2

- [ ] SoundKeyHandler consolidado
- [ ] SpriteKeyHandler implementado
- [ ] Tests de regresión pasando
- [ ] Legacy handlers marcados como deprecated
- [ ] Documentación actualizada

---

## FASE 3: Migración de Handlers de Entorno

**Duración estimada:** 2 sesiones
**Objetivo:** Migrar Background y HUD handlers

### 3.1 BackgroundKeyHandler

```typescript
// src/lib/triggers/handlers/background-key-handler.ts

export function createBackgroundKeyHandler(): KeyHandler {
  return {
    id: 'background-key-handler',
    type: 'background',
    priority: 80, // Después de sprite
    
    canHandle(key: DetectedKey, context: BackgroundKeyHandlerContext): boolean {
      // Detectar keys de background:
      // - Por triggerKeys en backgroundPacks
      // - Por backgroundName
      // - Por formato [bg:name], [fondo:name]
    },
    
    handleKey(key: DetectedKey, context: BackgroundKeyHandlerContext): TriggerMatchResult | null {
      // Buscar en backgroundPacks
      // Obtener URL, overlays, transición
      // Retornar match con config completa
    },
    
    execute(match: TriggerMatch, context: TriggerContext): void {
      // Aplicar cambio de fondo con transición
      // Aplicar overlays
      // Actualizar cooldown
    },
    
    getRegisteredKeys(context: BackgroundKeyHandlerContext): RegisteredKey[] {
      // Retornar todas las triggerKeys de backgroundPacks
    }
  };
}
```

### 3.2 HUDKeyHandler

```typescript
// src/lib/triggers/handlers/hud-key-handler.ts

export function createHUDKeyHandler(): KeyHandler {
  return {
    id: 'hud-key-handler',
    type: 'hud',
    priority: 70, // Después de background
    
    canHandle(key: DetectedKey, context: HUDKeyHandlerContext): boolean {
      // Detectar keys de HUD:
      // - Por field.key en HUDTemplate
      // - Formato [field=value] con valor
      // - Keys dinámicas según template activo
    },
    
    handleKey(key: DetectedKey, context: HUDKeyHandlerContext): TriggerMatchResult | null {
      // Buscar campo en template activo
      // Validar valor si tiene validación
      // Retornar match con campo y valor
    },
    
    execute(match: TriggerMatch, context: TriggerContext): void {
      // Actualizar valor en HUDSessionState
      // Disparar callbacks si tiene
    },
    
    getRegisteredKeys(context: HUDKeyHandlerContext): RegisteredKey[] {
      // Retornar keys del template activo
    }
  };
}
```

### Checklist Fase 3

- [ ] BackgroundKeyHandler implementado
- [ ] HUDKeyHandler implementado
- [ ] Tests de regresión pasando
- [ ] Legacy handlers marcados como deprecated

---

## FASE 4: Migración de Handlers de Sistema

**Duración estimada:** 2 sesiones
**Objetivo:** Migrar Quest, Stats e Item handlers

### 4.1 QuestKeyHandler

```typescript
// src/lib/triggers/handlers/quest-key-handler.ts

export function createQuestKeyHandler(): KeyHandler {
  return {
    id: 'quest-key-handler',
    type: 'quest',
    priority: 60, // Sistema de misiones
    
    canHandle(key: DetectedKey, context: QuestKeyHandlerContext): boolean {
      // Detectar keys de quest:
      // - Activation keys de quest templates
      // - Objective completion keys
      // - Quest completion keys
      // - Tags XML <quest:activate>, <quest:progress>
    },
    
    handleKey(key: DetectedKey, context: QuestKeyHandlerContext): TriggerMatchResult | null {
      // Determinar tipo: activation, progress, completion
      // Buscar quest/objective correspondiente
      // Retornar match con acción y datos
    },
    
    execute(match: TriggerMatch, context: TriggerContext): void {
      // Ejecutar acción: activate, progress, complete
      // Ejecutar recompensas si aplica
      // Actualizar sessionQuests
    },
    
    getRegisteredKeys(context: QuestKeyHandlerContext): RegisteredKey[] {
      // Retornar todas las keys de quests activas/disponibles
    }
  };
}
```

### 4.2 StatsKeyHandler

```typescript
// src/lib/triggers/handlers/stats-key-handler.ts

export function createStatsKeyHandler(): KeyHandler {
  return {
    id: 'stats-key-handler',
    type: 'stats',
    priority: 50, // Stats del personaje
    
    canHandle(key: DetectedKey, context: StatsKeyHandlerContext): boolean {
      // Detectar keys de stats:
      // - Por attribute.detectionKey
      // - Formato [stat=value], [stat+N], [stat-N]
      // - Keys dinámicas según statsConfig
    },
    
    handleKey(key: DetectedKey, context: StatsKeyHandlerContext): TriggerMatchResult | null {
      // Parsear operación: set, add, subtract
      // Buscar atributo correspondiente
      // Validar rango si tiene
      // Retornar match con atributo y valor
    },
    
    execute(match: TriggerMatch, context: TriggerContext): void {
      // Actualizar stat en sessionStats
      // Disparar efectos visuales si aplica
    },
    
    getRegisteredKeys(context: StatsKeyHandlerContext): RegisteredKey[] {
      // Retornar detectionKeys de todos los atributos
    }
  };
}
```

### 4.3 ItemKeyHandler

```typescript
// src/lib/triggers/handlers/item-key-handler.ts

export function createItemKeyHandler(): KeyHandler {
  return {
    id: 'item-key-handler',
    type: 'item',
    priority: 40, // Items/inventario
    
    canHandle(key: DetectedKey, context: ItemKeyHandlerContext): boolean {
      // Detectar keys de items:
      // - Por item.key en inventario
      // - Formato [item:name], [item:name=+N]
    },
    
    handleKey(key: DetectedKey, context: ItemKeyHandlerContext): TriggerMatchResult | null {
      // Buscar item por key
      // Parsear cantidad si tiene
      // Retornar match con item y cantidad
    },
    
    execute(match: TriggerMatch, context: TriggerContext): void {
      // Añadir/remover item del inventario
      // Disparar efectos si aplica
    },
    
    getRegisteredKeys(context: ItemKeyHandlerContext): RegisteredKey[] {
      // Retornar keys de todos los items disponibles
    }
  };
}
```

### Checklist Fase 4

- [ ] QuestKeyHandler implementado
- [ ] StatsKeyHandler implementado
- [ ] ItemKeyHandler implementado
- [ ] Tests de regresión pasando
- [ ] Legacy handlers marcados como deprecated

---

## FASE 5: Limpieza y Deprecación

**Duración estimada:** 1 sesión
**Objetivo:** Eliminar código legacy

### 5.1 Deprecar TokenDetector

```typescript
// src/lib/triggers/token-detector.ts

/**
 * @deprecated Use KeyDetector instead
 * Will be removed in v2.0.0
 */
export class TokenDetector { ... }
```

### 5.2 Eliminar Handler States Legacy

Archivos a eliminar o marcar como deprecated:
- `src/lib/triggers/handlers/sound-handler.ts` (consolidado en sound-key-handler)
- `src/lib/triggers/handlers/sprite-handler.ts` → sprite-key-handler
- `src/lib/triggers/handlers/background-handler.ts` → background-key-handler
- `src/lib/triggers/handlers/hud-handler.ts` → hud-key-handler
- `src/lib/triggers/handlers/quest-handler.ts` → quest-key-handler
- `src/lib/triggers/handlers/item-handler.ts` → item-key-handler
- `src/lib/triggers/handlers/stats-handler.ts` → stats-key-handler

### 5.3 Simplificar useTriggerSystem

```typescript
// src/lib/triggers/use-trigger-system.ts

export function useTriggerSystem(config: TriggerSystemConfig = {}): TriggerSystemResult {
  // SIMPLIFICADO: Solo KeyDetector + HandlerRegistry
  
  const processStreamingContent = useCallback((content, character, messageKey, characters) => {
    // 1. Detectar todas las keys
    const keys = keyDetector.detectKeys(content, messageKey);
    const wordKeys = keyDetector.detectWordKeys(content, messageKey, getAllKeywords());
    
    // 2. Procesar via registry (todos los handlers)
    const result = handlerRegistry.processKeys([...keys, ...wordKeys], {
      character,
      characters,
      fullText: content,
      messageKey,
      isStreaming: true,
      timestamp: Date.now(),
    });
    
    // Eso es todo. Sin código legacy.
  }, []);
  
  return { processStreamingContent, resetForNewMessage, clearAllState, isEnabled };
}
```

### 5.4 Actualizar exports

```typescript
// src/lib/triggers/index.ts

// NUEVO: Exportar solo KeyHandlers
export { createSoundKeyHandler } from './handlers/sound-key-handler';
export { createSpriteKeyHandler } from './handlers/sprite-key-handler';
export { createBackgroundKeyHandler } from './handlers/background-key-handler';
export { createHUDKeyHandler } from './handlers/hud-key-handler';
export { createQuestKeyHandler } from './handlers/quest-key-handler';
export { createStatsKeyHandler } from './handlers/stats-key-handler';
export { createItemKeyHandler } from './handlers/item-key-handler';
export { createSkillKeyHandler } from './handlers/skill-key-handler';
export { createSolicitudKeyHandler } from './handlers/solicitud-key-handler';

// DEPRECATED: Legacy exports (remove in v2.0.0)
/** @deprecated Use createXxxKeyHandler instead */
export { checkSoundTriggers } from './handlers/sound-handler';
// ... etc
```

### Checklist Fase 5

- [ ] TokenDetector marcado como deprecated
- [ ] Handler states legacy eliminados/deprecados
- [ ] useTriggerSystem simplificado
- [ ] Exports actualizados
- [ ] Documentación final actualizada
- [ ] CHANGELOG actualizado

---

## Cronograma

| Fase | Sesiones | Dependencias |
|------|----------|--------------|
| 1. Preparación | 1 | - |
| 2. Básicos (Sound, Sprite) | 2 | Fase 1 |
| 3. Entorno (Background, HUD) | 2 | Fase 2 |
| 4. Sistema (Quest, Stats, Item) | 2 | Fase 3 |
| 5. Limpieza | 1 | Fase 4 |
| **Total** | **8 sesiones** | |

---

## Riesgos y Mitigaciones

### Riesgo 1: Regresiones en detección
**Mitigación:** Tests de regresión exhaustivos antes de cada fase

### Riesgo 2: Performance
**Mitigación:** Benchmarking antes/después de cada migración

### Riesgo 3: Compatibilidad hacia atrás
**Mitigación:** Mantener exports legacy con warnings de deprecación

---

## Métricas de Éxito

1. **Cobertura de tests:** 100% de casos legacy cubiertos
2. **Performance:** Sin degradación > 10%
3. **Código eliminado:** Mínimo 500 líneas de código legacy
4. **Simplicidad:** useTriggerSystem reducido de ~1000 a ~200 líneas

---

## Próximos Pasos

1. **Aprobar plan** con el equipo
2. **Crear branch** `feature/trigger-system-migration`
3. **Iniciar Fase 1** con la preparación de infraestructura
4. **Documentar progreso** en cada fase

---

*Documento creado: $(date)*
*Última actualización: Pendiente*
