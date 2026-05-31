// ============================================
// Unified Key Resolver - Single system for all template resolution
// ============================================
//
// This module unifies the resolution of ALL template keys:
// - Template variables: {{user}}, {{char}}, {{userpersona}}, {{persona}}, {{description}}, etc.
// - Conditional blocks: {{#if}}, {{#user}}, {{#char}}
// - Stats keys: {{attributeKey}}, {{habilidades}}, {{intenciones}}, {{invitaciones}}
//
// The key resolution happens in two phases:
// 1. Template Phase: Resolve {{user}}, {{char}}, {{userpersona}}, {{persona}}, conditionals
// 2. Stats Phase: Resolve attribute values and stat blocks
//
// This ensures that lorebooks injected after template processing
// still get their keys resolved properly.

import type { CharacterCard, Persona, SessionStats, SoundTrigger, AppSettings, QuestTemplate, SessionQuestInstance, QuestSettings, Item, PersonaInventoryEntry, ActiveConsumableEffect, InventoryV2Settings } from '@/types';
import type { ResolvedStats } from '@/types';
import { resolveStatsInText } from '@/lib/stats/stats-resolver';
import { buildQuestPromptSection } from '@/lib/triggers/handlers/quest-handler';
import { getExampleKey } from '@/lib/quest/quest-detector';
import { DEFAULT_QUEST_SETTINGS } from '@/types';

// ============================================
// Types
// ============================================

/**
 * Context for key resolution
 * Contains all data needed to resolve any key type
 */
export interface KeyResolutionContext {
  // Basic template context
  user: string;
  char: string;
  userpersona?: string;

  // Character reference (for {{description}}, {{personality}}, etc.)
  character?: CharacterCard;
  persona?: Persona;

  // Stats resolution
  resolvedStats?: ResolvedStats | null;

  // Persona stats resolution (attributes from user's persona)
  personaResolvedStats?: ResolvedStats | null;

  // Session stats for event keys ({{solicitante}}, {{solicitado}}, {{eventos}})
  sessionStats?: SessionStats | null;
  characterId?: string;  // ID of the current character for looking up solicitudes

  // Sound triggers for {{sonidos}} key
  soundTriggers?: SoundTrigger[];
  soundSettings?: AppSettings['sound'];

  // Quest data for {{activeQuests}} key
  questTemplates?: QuestTemplate[];
  sessionQuests?: SessionQuestInstance[];
  questSettings?: QuestSettings;

  // Lorebook outlet sections for {{outlet::name}} macro resolution
  // Map of outlet name → formatted content string
  outletSections?: Record<string, string>;

  // Lorebook attribute keys resolved from attribute-type entries
  // Map of injectionKey → resolved content (resolved server-side by attribute-resolver)
  lorebookAttributeKeys?: Record<string, string>;

  // Inventory data for {{inventory}} and {{currency}} key resolution
  inventoryData?: {
    personaItems: Array<{ entry: PersonaInventoryEntry; item: Item }>;
    equippedItems: Array<{ entry: PersonaInventoryEntry; item: Item }>;
    activeEffects: ActiveConsumableEffect[];
    currency: number;
    currencyName: string;
    currencyIcon: string;
    inventorySettings: InventoryV2Settings;
  };
}

// ============================================
// Phase 1: Template Variable Resolution
// ============================================

/**
 * Resolve template variables in text
 * Handles: {{user}}, {{char}}, {{userpersona}}, {{persona}}, {{description}}, {{personality}}, {{scenario}}
 * Also handles conditionals: {{#if}}, {{#user}}, {{#char}}
 */
export function resolveTemplateVariables(
  text: string,
  context: KeyResolutionContext
): string {
  if (!text) return text;

  let result = text;

  // Basic variable replacements
  result = result.replace(/\{\{user\}\}/gi, context.user);
  result = result.replace(/\{\{char\}\}/gi, context.char);

  // Current date and time: {{time}} → DD/MM/YYYY, HH:MMam/pm
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12;
  const timeStr = `${day}/${month}/${year}, ${hours}:${minutes}${ampm}`;
  result = result.replace(/\{\{time\}\}/gi, timeStr);

  // User persona (if available)
  if (context.userpersona) {
    result = result.replace(/\{\{userpersona\}\}/gi, context.userpersona);
  } else {
    // Remove {{userpersona}} if not available
    result = result.replace(/\{\{userpersona\}\}/gi, '');
  }

  // {{persona}} key - injects persona description content
  // Resolved early in Phase 1 so that the injected content can contain
  // other keys ({{user}}, {{char}}, {{attributeKey}}, etc.) that will be
  // resolved in subsequent phases.
  if (context.persona?.description) {
    result = result.replace(/\{\{persona\}\}/gi, context.persona.description);
  } else {
    // Remove {{persona}} if not available
    result = result.replace(/\{\{persona\}\}/gi, '');
  }

  // Handle conditional blocks {{#if variable}}...{{/if}}
  result = processConditionals(result, context);

  // Handle {{#user}}...{{/user}} blocks (only show if user is set)
  result = result.replace(/\{\{#user\}\}([\s\S]*?)\{\{\/user\}\}/gi, (_, content) => {
    return context.user ? content : '';
  });

  // Handle {{#char}}...{{/char}} blocks (only show if char is set)
  result = result.replace(/\{\{#char\}\}([\s\S]*?)\{\{\/char\}\}/gi, (_, content) => {
    return context.char ? content : '';
  });

  // Character-specific variables
  if (context.character) {
    result = result.replace(/\{\{description\}\}/gi, context.character.description || '');
    result = result.replace(/\{\{personality\}\}/gi, context.character.personality || '');
    result = result.replace(/\{\{scenario\}\}/gi, context.character.scenario || '');
  }

  // Lorebook outlet macro: {{outlet::name}}
  if (context.outletSections && Object.keys(context.outletSections).length > 0) {
    result = result.replace(/\{\{outlet::([^}]+)\}\}/gi, (_, outletName) => {
      return context.outletSections![outletName.trim()] || '';
    });
  }

  return result;
}

/**
 * Process conditional blocks {{#if var}}content{{/if}}
 */
function processConditionals(text: string, context: KeyResolutionContext): string {
  const conditionalRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/gi;

  return text.replace(conditionalRegex, (_, varName, content) => {
    const value = getVariableValue(varName.toLowerCase(), context);
    return value ? content : '';
  });
}

/**
 * Get variable value by name
 */
function getVariableValue(varName: string, context: KeyResolutionContext): string | undefined {
  switch (varName) {
    case 'user':
      return context.user;
    case 'char':
      return context.char;
    case 'userpersona':
      return context.userpersona;
    case 'persona':
      return context.persona?.description;
    case 'description':
      return context.character?.description;
    case 'personality':
      return context.character?.personality;
    case 'scenario':
      return context.character?.scenario;
    default:
      return undefined;
  }
}

// ============================================
// Phase 2: Stats Key Resolution
// ============================================

/**
 * Resolve stats keys in text
 * Delegates to stats-resolver module
 * Handles: {{attributeKey}}, {{habilidades}}, {{intenciones}}, {{invitaciones}}
 * Also resolves persona attributes if personaResolvedStats is provided
 */
export function resolveStatsKeys(
  text: string,
  resolvedStats: ResolvedStats | null | undefined,
  personaResolvedStats?: ResolvedStats | null | undefined
): string {
  let result = resolveStatsInText(text, resolvedStats ?? null);
  // If persona has stats, also resolve persona-specific attribute keys
  // (only attributes, not block keys like acciones/intenciones)
  if (personaResolvedStats?.attributes) {
    result = resolveStatsInText(result, { ...personaResolvedStats, skillsBlock: undefined, intentionsBlock: undefined, invitationsBlock: undefined, solicitudesBlock: undefined });
  }
  return result;
}

// ============================================
// Phase 3: Event Key Resolution
// ============================================

/**
 * Resolve event keys in text
 * Handles: {{solicitante}}, {{solicitado}}, {{eventos}}
 *
 * {{solicitante}} - Name of who made the solicitud (from pending solicitudes)
 * {{solicitado}} - Name of who received the solicitud (current character)
 * {{eventos}} - Recent events summary
 */
export function resolveEventKeys(
  text: string,
  context: KeyResolutionContext
): string {
  if (!text) return text;

  let result = text;
  const { sessionStats, characterId, char } = context;

  // {{solicitante}} - Who made the solicitud
  if (sessionStats?.solicitudes?.characterSolicitudes && characterId) {
    const pendingSolicitudes = sessionStats.solicitudes.characterSolicitudes[characterId]
      ?.filter(s => s.status === 'pending') || [];
    
    if (pendingSolicitudes.length > 0) {
      // Get the name of the first pending solicitud's sender
      const solicitante = pendingSolicitudes[0].fromCharacterName;
      result = result.replace(/\{\{solicitante\}\}/gi, solicitante);
    } else {
      // No pending solicitudes - replace with empty string
      result = result.replace(/\{\{solicitante\}\}/gi, '');
    }
  } else {
    result = result.replace(/\{\{solicitante\}\}/gi, '');
  }

  // {{solicitado}} - Who received the solicitud (current character)
  // This is always the current character's name
  if (char) {
    result = result.replace(/\{\{solicitado\}\}/gi, char);
  } else {
    result = result.replace(/\{\{solicitado\}\}/gi, '');
  }

  // {{eventos}} - Recent events summary
  if (sessionStats) {
    console.log(`[resolveEventKeys] sessionStats received for {{eventos}}:`, {
      hasUltimoObjetivo: !!sessionStats.ultimo_objetivo_completado,
      hasUltimaSolicitudRealizada: !!sessionStats.ultima_solicitud_realizada,
      hasUltimaSolicitudCompletada: !!sessionStats.ultima_solicitud_completada,
      hasUltimaAccion: !!sessionStats.ultima_accion_realizada,
      ultimoObjetivoValue: sessionStats.ultimo_objetivo_completado,
      ultimaSolicitudRealizadaValue: sessionStats.ultima_solicitud_realizada,
    });
    const eventosBlock = buildEventosBlock(sessionStats);
    console.log(`[resolveEventKeys] Built eventosBlock:`, eventosBlock);
    result = result.replace(/\{\{eventos\}\}/gi, eventosBlock);
  } else {
    console.log(`[resolveEventKeys] No sessionStats provided for {{eventos}}`);
    result = result.replace(/\{\{eventos\}\}/gi, '');
  }

  return result;
}

/**
 * Build the eventos block showing recent events
 * Only shows fields that have actual values (not undefined or empty)
 * Format:
 * [ULTIMOS EVENTOS]
 * - ultimo_objetivo_completado : <value>
 * - ultima_solicitud_realizada : <value>
 * - ultima_solicitud_completada : <value>
 * - ultima accion realizada de <characterName>: "<completedDescription>"
 */
function buildEventosBlock(sessionStats: SessionStats): string {
  const lines: string[] = [];
  
  // Only add fields that have actual values
  if (sessionStats.ultimo_objetivo_completado) {
    lines.push(`- ultimo_objetivo_completado : ${sessionStats.ultimo_objetivo_completado}`);
  }
  
  if (sessionStats.ultima_solicitud_realizada) {
    lines.push(`- ultima_solicitud_realizada : ${sessionStats.ultima_solicitud_realizada}`);
  }
  
  if (sessionStats.ultima_solicitud_completada) {
    lines.push(`- ultima_solicitud_completada : ${sessionStats.ultima_solicitud_completada}`);
  }
  
  if (sessionStats.ultima_accion_realizada) {
    const characterName = sessionStats.ultima_accion_character || '';
    if (characterName) {
      lines.push(`- ultima accion realizada de ${characterName}: "${sessionStats.ultima_accion_realizada}"`);
    } else {
      // Backward compatibility: if no character name stored, use old format
      lines.push(`- ultima_accion_realizada : ${sessionStats.ultima_accion_realizada}`);
    }
  }
  
  // Return empty string if no events to show
  if (lines.length === 0) {
    return '';
  }
  
  return `[ULTIMOS EVENTOS]\n${lines.join('\n')}`;
}

// ============================================
// Phase 4: Sound Key Resolution
// ============================================

/**
 * Resolve {{sonidos}} key in text
 * Shows a list of sounds available for the current character
 * 
 * Format:
 * [SONIDOS DISPONIBLES]
 * - keyword: descripción del sonido
 * - keyword2: otra descripción
 */
export function resolveSoundKeys(
  text: string,
  context: KeyResolutionContext
): string {
  if (!text) return text;

  let result = text;

  // Check if {{sonidos}} is present
  if (!/\{\{sonidos\}\}/gi.test(result)) {
    return result;
  }

  // Get sound triggers for this character
  const { soundTriggers, soundSettings, characterId } = context;

  console.log(`[resolveSoundKeys] Resolving {{sonidos}} for character:`, {
    characterId,
    hasSoundTriggers: !!soundTriggers,
    soundTriggersCount: soundTriggers?.length || 0,
    soundTriggersData: soundTriggers?.map(t => ({
      id: t.id,
      name: t.name,
      active: t.active,
      keywords: t.keywords,
      description: t.description,
      characterIds: t.characterIds
    }))
  });

  if (!soundTriggers || soundTriggers.length === 0) {
    // No sound triggers configured - remove the key
    console.log(`[resolveSoundKeys] No sound triggers configured, removing {{sonidos}}`);
    return result.replace(/\{\{sonidos\}\}/gi, '');
  }

  // Filter triggers for this character
  // A trigger is available to a character if:
  // 1. characterIds is empty (available to all), OR
  // 2. characterIds includes the current character's ID
  const characterTriggers = soundTriggers.filter(trigger => {
    if (!trigger.active) return false;
    if (!trigger.characterIds || trigger.characterIds.length === 0) return true;
    if (characterId && trigger.characterIds.includes(characterId)) return true;
    return false;
  });

  console.log(`[resolveSoundKeys] Filtered triggers:`, {
    totalTriggers: soundTriggers.length,
    activeTriggers: soundTriggers.filter(t => t.active).length,
    characterTriggers: characterTriggers.length,
    characterTriggersData: characterTriggers.map(t => ({
      name: t.name,
      keywords: t.keywords,
      description: t.description
    }))
  });

  // Build the sound list
  const soundList = buildSonidosBlock(characterTriggers, soundSettings);

  console.log(`[resolveSoundKeys] Built sound list:`, soundList);

  result = result.replace(/\{\{sonidos\}\}/gi, soundList);

  return result;
}

/**
 * Build the sonidos block showing available sounds for a character
 * Format:
 * [PREFIX]
 * - keyword: descripción del sonido
 * [SUFFIX]
 */
function buildSonidosBlock(
  triggers: SoundTrigger[],
  soundSettings?: AppSettings['sound']
): string {
  if (triggers.length === 0) {
    return '';
  }

  const lines: string[] = [];

  // Add prefix if configured
  const prefix = soundSettings?.soundListPrefix || '[SONIDOS DISPONIBLES]';
  if (prefix) {
    lines.push(prefix);
  }

  // Add each sound
  triggers.forEach(trigger => {
    // Get the primary keyword for this trigger
    const primaryKeyword = trigger.keywords.find(kw => trigger.keywordsEnabled[kw] !== false) || trigger.keywords[0];
    
    if (primaryKeyword) {
      const description = trigger.description || `Sonido: ${trigger.name}`;
      lines.push(`- ${primaryKeyword}: ${description}`);
    }
  });

  // Add suffix if configured
  const suffix = soundSettings?.soundListSuffix || '';
  if (suffix) {
    lines.push(suffix);
  }

  return lines.join('\n');
}

// ============================================
// Phase 5: Quest Key Resolution
// ============================================

/**
 * Resolve {{availableQuests}} key in text
 * Replaces with a formatted block of AVAILABLE (not yet active) quests.
 * Inner keys in quest content ({{user}}, {{char}}, stats, etc.) are also resolved.
 *
 * Use {{activeQuests}} for active quests only, or {{availableQuests}} for available quests only.
 */
export function resolveAvailableQuestsKey(
  text: string,
  context: KeyResolutionContext
): string {
  if (!text) return text;

  // Early exit if no {{availableQuests}} key present
  if (!/\{\{availableQuests\}\}/gi.test(text)) {
    return text;
  }

  const { questTemplates, sessionQuests, questSettings, characterId } = context;

  // No quest data available - remove the key
  if (!questTemplates?.length || !sessionQuests?.length) {
    return text.replace(/\{\{availableQuests\}\}/gi, '');
  }

  // Only AVAILABLE quests (not active)
  const availableQuests = sessionQuests.filter(q => q.status === 'available');
  if (availableQuests.length === 0) {
    return text.replace(/\{\{availableQuests\}\}/gi, '');
  }

  // Build available quests block
  const availableLines: string[] = [];
  availableQuests.forEach((q, index) => {
    const questTemplate = questTemplates.find(t => t.id === q.templateId);
    if (!questTemplate) return;

    availableLines.push(`${index + 1}) ${questTemplate.name}`);
    availableLines.push(`   - descripción: ${questTemplate.description}`);

    // Add activation key
    const activation = questTemplate.activation || {};
    const baseKey = activation.key || (activation.keys && activation.keys[0]);
    if (baseKey) {
      const activationKey = getExampleKey(questSettings?.questActivationPrefix, baseKey);
      availableLines.push(`   - key de activación: ${activationKey}`);
    }
  });

  if (availableLines.length === 0) {
    return text.replace(/\{\{availableQuests\}\}/gi, '');
  }

  const block = `[MISIONES DISPONIBLES]\n${availableLines.join('\n')}`;

  // Resolve inner keys in the block ({{user}}, {{char}}, stats, events, sounds)
  // Use a context WITHOUT quest data to prevent recursion
  const innerContext: KeyResolutionContext = {
    ...context,
    questTemplates: undefined,
    sessionQuests: undefined,
  };

  const resolvedBlock = resolveAllKeys(block, innerContext);

  return text.replace(/\{\{availableQuests\}\}/gi, resolvedBlock);
}

/**
 * Resolve {{activeQuests}} key in text
 * Replaces with a formatted block of active quests and their objectives.
 * Inner keys in quest content ({{user}}, {{char}}, stats, etc.) are also resolved.
 *
 * The key can be placed in ANY character section (description, scenario,
 * systemPrompt, characterNote, authorNote, postHistoryInstructions, etc.)
 *
 * Example usage in character description:
 *   {{char}} es un aventurero.
 *   [MISIONES ACTIVAS]
 *   {{activeQuests}}
 */
export function resolveQuestKeys(
  text: string,
  context: KeyResolutionContext
): string {
  if (!text) return text;

  // Early exit if no {{activeQuests}} key present
  if (!/\{\{activeQuests\}\}/gi.test(text)) {
    return text;
  }

  const { questTemplates, sessionQuests, questSettings, characterId, sessionStats: questSessionStats } = context;

  // No quest data available - remove the key
  if (!questTemplates?.length || !sessionQuests?.length) {
    return text.replace(/\{\{activeQuests\}\}/gi, '');
  }

  // Check if there are any active quests
  const activeQuests = sessionQuests.filter(q => q.status === 'active');
  if (activeQuests.length === 0) {
    return text.replace(/\{\{activeQuests\}\}/gi, '');
  }

  // Build raw quest content using buildQuestPromptSection with a simple template
  // This gives us just the quest list items without any wrapping template
  const rawQuestContent = buildQuestPromptSection(
    questTemplates,
    sessionQuests,
    '{{activeQuests}}',  // Simple template — result is just the quest list
    characterId,
    false,  // not for narrator
    questSettings,
    questSessionStats ?? undefined
  );

  if (!rawQuestContent) {
    return text.replace(/\{\{activeQuests\}\}/gi, '');
  }

  // Resolve inner keys in quest content ({{user}}, {{char}}, stats, events, sounds)
  // Use a context WITHOUT quest data to prevent recursion
  const innerContext: KeyResolutionContext = {
    ...context,
    questTemplates: undefined,
    sessionQuests: undefined,
  };

  const resolvedQuestContent = resolveAllKeys(rawQuestContent, innerContext);

  // Replace all occurrences of {{activeQuests}} with the resolved content
  return text.replace(/\{\{activeQuests\}\}/gi, resolvedQuestContent);
}

// ============================================
// Phase 6: Lorebook Attribute Key Resolution
// ============================================

/**
 * Resolve lorebook attribute keys in text.
 *
 * Replaces {{injectionKey}} patterns with the resolved content from
 * attribute-type lorebook entries. These keys are pre-resolved server-side
 * by the attribute-resolver module and passed through the context.
 *
 * After replacement, the injected content itself may contain template keys
 * (e.g., {{char}}, {{user}}, {{time}}), so we re-resolve template variables
 * on the result.
 *
 * Example: if lorebookAttributeKeys = { 'estadoHeroe': '{{char}} está herido' },
 * then {{estadoHeroe}} in text becomes "Aitana está herido".
 */
export function resolveLorebookAttributeKeys(
  text: string,
  context: KeyResolutionContext
): string {
  if (!text) return text;

  const keysCount = context.lorebookAttributeKeys ? Object.keys(context.lorebookAttributeKeys).length : 0;

  if (!context.lorebookAttributeKeys || keysCount === 0) {
    return text;
  }

  let result = text;

  // Sort keys by length descending to avoid partial replacements
  // (e.g., 'estadoHeroe' before 'estado')
  const sortedKeys = Object.keys(context.lorebookAttributeKeys).sort(
    (a, b) => b.length - a.length
  );

  for (const key of sortedKeys) {
    const content = context.lorebookAttributeKeys![key];
    if (content === undefined) continue;

    // Replace all occurrences of {{key}} (case-insensitive)
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'gi');
    const regexMatched = regex.test(result);

    if (!regexMatched) {
      continue;
    }

    // Reset regex lastIndex after test() with global flag
    regex.lastIndex = 0;
    result = result.replace(regex, content);
  }

  // After injecting attribute content, re-resolve template variables and stats keys
  // because the injected content may contain {{char}}, {{user}}, {{time}}, {{vida}}, etc.
  if (result !== text) {
    result = resolveTemplateVariables(result, context);
    // Also re-resolve stats keys that may be in the injected content
    result = resolveStatsKeys(result, context.resolvedStats, context.personaResolvedStats);
  }

  return result;
}

// ============================================
// Phase 6.5: Inventory Key Resolution
// ============================================

/**
 * Resolve {{inventory}} and {{currency}} keys in text.
 *
 * {{inventory}} - Full inventory section text (items, effects, currency)
 * {{currency}}  - Currency display string (e.g., "💰 Divisa: 100")
 *
 * These keys allow inventory information to be embedded in any section
 * (character description, lorebooks, author's notes, etc.)
 */
export function resolveInventoryKeys(
  text: string,
  context: KeyResolutionContext
): string {
  if (!text) return text;

  // Early exit if no inventory-related keys are present
  if (!/\{\{inventory\}\}/gi.test(text) && !/\{\{currency\}\}/gi.test(text)) {
    return text;
  }

  const { inventoryData } = context;

  // No inventory data available - remove the keys
  if (!inventoryData || !inventoryData.inventorySettings.enabled) {
    return text
      .replace(/\{\{inventory\}\}/gi, '')
      .replace(/\{\{currency\}\}/gi, '');
  }

  let result = text;

  // Resolve {{currency}} - simple currency display
  if (/\{\{currency\}\}/gi.test(result)) {
    const currencyDisplay = `${inventoryData.currencyIcon || '💰'} ${inventoryData.currencyName || 'Divisa'}: ${inventoryData.currency}`;
    result = result.replace(/\{\{currency\}\}/gi, currencyDisplay);
  }

  // Resolve {{inventory}} - full inventory text
  if (/\{\{inventory\}\}/gi.test(result)) {
    const { personaItems, equippedItems, activeEffects, currency, currencyName, currencyIcon, inventorySettings } = inventoryData;

    const parts: string[] = [];

    // Items list
    const itemLines = personaItems.map(({ entry, item }) => {
      const qty = entry.quantity > 1 ? ` x${entry.quantity}` : '';
      const eq = entry.equipped ? ' [Equipado]' : '';
      const effects = (item.attributeEffects && item.attributeEffects.length > 0)
        ? ` (${item.attributeEffects.map(e => `${e.operator}${e.value} ${e.attributeKey}`).join(', ')})`
        : '';
      return `- ${item.icon || ''} ${item.name}${qty}${eq}${effects}`;
    }).join('\n');

    if (itemLines) {
      parts.push(`[Inventario Activo]\n${itemLines}`);
    }

    // Equipped items
    const equipLines = equippedItems.map(({ item }) => {
      const effects = (item.attributeEffects && item.attributeEffects.length > 0)
        ? item.attributeEffects.map(e => `${e.operator}${e.value} ${e.attributeKey}`).join(', ')
        : '';
      return `- ${item.icon || ''} ${item.name}${item.slot ? ` [${item.slot}]` : ''}${effects ? ` → ${effects}` : ''}`;
    }).join('\n');

    if (equipLines) {
      parts.push(`[Equipo]\n${equipLines}`);
    }

    // Active effects
    const effectLines = activeEffects.map(e => {
      const turnsLeft = e.remainingTurns > 0 ? ` (${e.remainingTurns}/${e.totalTurns} turnos)` : '';
      const effectDesc = e.effects.map(ef =>
        `${ef.operator}${ef.value} ${ef.attributeKey}${ef.targetId !== '__user__' ? ` → ${ef.targetName || ef.targetId}` : ''}`
      ).join(', ');
      return `- ${e.itemName}: ${effectDesc}${turnsLeft}`;
    }).join('\n');

    if (effectLines) {
      parts.push(`[Efectos Activos]\n${effectLines}`);
    }

    // Currency
    parts.push(`${currencyIcon || '💰'} ${currencyName || 'Divisa'}: ${currency}`);

    const inventoryText = parts.join('\n\n');
    result = result.replace(/\{\{inventory\}\}/gi, inventoryText);
  }

  return result;
}

/**
 * Phase 7: Cleanup remaining unresolved {{key}} patterns
 *
 * After all resolution phases, any {{key}} still remaining is an unresolved key.
 * This can happen when:
 * - A lorebook attribute entry's injectionKey is used but the lorebook is not assigned to the character
 * - A custom key was added to text but has no resolver
 * - A stats key references an attribute that doesn't exist in the current config
 *
 * Strategy:
 * - Keys that match known attribute names in the character or persona statsConfig are KEPT as-is
 *   (user may want to see them for debugging or they might be added later)
 * - Keys that look like lorebook injection keys (lowercaseCamelCase, underscores) are replaced with empty
 * - All other remaining {{key}} patterns are replaced with empty string
 *
 * This ensures the LLM never sees raw {{key}} text in the prompt.
 */
function resolveRemainingKeys(
  text: string,
  context: KeyResolutionContext
): string {
  if (!text || !text.includes('{{')) return text;

  // Collect all known stat attribute keys from character and persona configs
  const knownStatKeys = new Set<string>();
  if (context.character?.statsConfig?.attributes) {
    for (const attr of context.character.statsConfig.attributes) {
      knownStatKeys.add(attr.key);
    }
  }
  if (context.persona?.statsConfig?.attributes) {
    for (const attr of context.persona.statsConfig.attributes) {
      knownStatKeys.add(attr.key);
    }
  }

  const pattern = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;

  return text.replace(pattern, (match, key) => {
    // Keep known character/persona stat keys as-is (user might want to see them)
    if (knownStatKeys.has(key)) {
      return match;
    }

    // Replace all other unresolved keys with empty string
    // This includes lorebook injection keys from unassigned lorebooks,
    // typo keys, and any other unrecognized patterns
    console.log(`[KeyResolver Phase 7] Cleaning unresolved key: {{${key}}}`);
    return '';
  });
}

// ============================================
// Unified Resolution
// ============================================

/**
 * Resolve ALL keys in text in the correct order
 *
 * Phase 1: Template variables ({{user}}, {{char}}, conditionals)
 * Phase 2: Stats keys ({{resistencia}}, {{habilidades}}, etc.)
 * Phase 3: Event keys ({{solicitante}}, {{solicitado}}, {{eventos}})
 * Phase 4: Sound keys ({{sonidos}})
 * Phase 5: Quest keys ({{activeQuests}}, {{availableQuests}})
 * Phase 6: Lorebook attribute keys ({{injectionKey}} from attribute-type entries)
 * Phase 6.5: Inventory keys ({{inventory}}, {{currency}})
 *
 * This is the main function to use for resolving all keys
 */
export function resolveAllKeys(
  text: string,
  context: KeyResolutionContext
): string {
  if (!text) return text;

  // Phase 1: Resolve template variables
  let result = resolveTemplateVariables(text, context);

  // Phase 2: Resolve stats keys (character + persona attributes)
  result = resolveStatsKeys(result, context.resolvedStats, context.personaResolvedStats);

  // Phase 3: Resolve event keys
  result = resolveEventKeys(result, context);

  // Phase 4: Resolve sound keys
  result = resolveSoundKeys(result, context);

  // Phase 5: Resolve quest keys ({{activeQuests}}, {{availableQuests}})
  result = resolveQuestKeys(result, context);
  result = resolveAvailableQuestsKey(result, context);

  // Phase 6: Resolve lorebook attribute keys
  result = resolveLorebookAttributeKeys(result, context);

  // Phase 6.5: Resolve inventory keys ({{inventory}}, {{currency}})
  result = resolveInventoryKeys(result, context);

  // Phase 7: Cleanup — replace any remaining unresolved {{key}} with empty string
  // This prevents literal {{key}} text from reaching the LLM prompt.
  // Known keys (like stats defined in config) are already handled in Phase 2,
  // which returns the match as-is so the user sees them for debugging.
  // But lorebook attribute keys from unassigned lorebooks should be silently cleaned.
  result = resolveRemainingKeys(result, context);

  return result;
}

/**
 * Resolve all keys with multiple passes
 *
 * Sometimes, after resolving keys, new content may be injected
 * (e.g., lorebooks that contain {{user}} or stats keys)
 * This function runs resolution multiple times to catch those cases
 *
 * @param text - Text to resolve
 * @param context - Resolution context
 * @param maxPasses - Maximum number of resolution passes (default: 2)
 */
export function resolveAllKeysWithPasses(
  text: string,
  context: KeyResolutionContext,
  maxPasses: number = 2
): string {
  if (!text) return text;

  let result = text;
  let previousResult = '';

  for (let i = 0; i < maxPasses; i++) {
    result = resolveAllKeys(result, context);

    // If nothing changed, we're done
    if (result === previousResult) {
      break;
    }
    previousResult = result;
  }

  return result;
}

// ============================================
// Context Builders
// ============================================

/**
 * Build a key resolution context from character and persona
 */
export function buildKeyResolutionContext(
  character: CharacterCard,
  userName: string = 'User',
  persona?: Persona,
  resolvedStats?: ResolvedStats | null,
  sessionStats?: SessionStats | null,
  soundTriggers?: SoundTrigger[],
  soundSettings?: AppSettings['sound'],
  personaResolvedStats?: ResolvedStats | null,
  questTemplates?: QuestTemplate[],
  sessionQuests?: SessionQuestInstance[],
  questSettings?: QuestSettings,
  outletSections?: Record<string, string>,
  lorebookAttributeKeys?: Record<string, string>,
  inventoryData?: KeyResolutionContext['inventoryData']
): KeyResolutionContext {
  return {
    user: persona?.name || userName,
    char: character.name,
    userpersona: persona?.description,
    character,
    persona,
    resolvedStats,
    personaResolvedStats,
    sessionStats,
    characterId: character.id,
    soundTriggers,
    soundSettings,
    questTemplates,
    sessionQuests,
    questSettings,
    outletSections,
    lorebookAttributeKeys,
    inventoryData,
  };
}

/**
 * Build a key resolution context for group chat
 * Uses the responding character as the main character
 */
export function buildGroupKeyResolutionContext(
  character: CharacterCard,
  userName: string = 'User',
  persona?: Persona,
  resolvedStats?: ResolvedStats | null,
  sessionStats?: SessionStats | null,
  personaResolvedStats?: ResolvedStats | null,
  questTemplates?: QuestTemplate[],
  sessionQuests?: SessionQuestInstance[],
  questSettings?: QuestSettings,
  lorebookAttributeKeys?: Record<string, string>,
  inventoryData?: KeyResolutionContext['inventoryData']
): KeyResolutionContext {
  return buildKeyResolutionContext(character, userName, persona, resolvedStats, sessionStats, undefined, undefined, personaResolvedStats, questTemplates, sessionQuests, questSettings, undefined, lorebookAttributeKeys, inventoryData);
}

// ============================================
// Convenience Functions for Character Processing
// ============================================

/**
 * Process all character text fields with unified key resolution
 * This replaces processCharacterTemplate from prompt-template.ts
 */
export function processCharacterKeys(
  character: CharacterCard,
  userName: string = 'User',
  persona?: Persona,
  resolvedStats?: ResolvedStats | null
): CharacterCard {
  const context = buildKeyResolutionContext(character, userName, persona, resolvedStats);

  return {
    ...character,
    description: resolveAllKeys(character.description, context),
    personality: resolveAllKeys(character.personality, context),
    scenario: resolveAllKeys(character.scenario, context),
    firstMes: resolveAllKeys(character.firstMes, context),
    mesExample: resolveAllKeys(character.mesExample, context),
    systemPrompt: resolveAllKeys(character.systemPrompt, context),
    postHistoryInstructions: resolveAllKeys(character.postHistoryInstructions, context),
    characterNote: resolveAllKeys(character.characterNote, context),
    // Process alternate greetings
    alternateGreetings: character.alternateGreetings.map(greeting =>
      resolveAllKeys(greeting, context)
    )
  };
}

/**
 * Process a single message with key resolution
 */
export function processMessageKeys(
  message: string,
  characterName: string,
  userName: string = 'User',
  resolvedStats?: ResolvedStats | null
): string {
  const context: KeyResolutionContext = {
    user: userName,
    char: characterName,
    resolvedStats,
  };

  return resolveAllKeys(message, context);
}

// ============================================
// Section Processing
// ============================================

import type { PromptSection } from '@/types';

/**
 * Resolve all keys in a prompt section
 */
export function resolveSectionKeys(
  section: PromptSection,
  context: KeyResolutionContext
): PromptSection {
  return {
    ...section,
    content: resolveAllKeys(section.content, context)
  };
}

/**
 * Resolve all keys in multiple prompt sections
 */
export function resolveSectionsKeys(
  sections: PromptSection[],
  context: KeyResolutionContext
): PromptSection[] {
  return sections.map(section => resolveSectionKeys(section, context));
}

/**
 * Resolve all keys in sections with multiple passes
 * Useful for sections that may contain dynamically injected content
 */
export function resolveSectionsKeysWithPasses(
  sections: PromptSection[],
  context: KeyResolutionContext,
  maxPasses: number = 2
): PromptSection[] {
  return sections.map(section => ({
    ...section,
    content: resolveAllKeysWithPasses(section.content, context, maxPasses)
  }));
}
