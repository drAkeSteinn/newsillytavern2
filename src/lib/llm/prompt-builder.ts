// ============================================
// Prompt Builder - Unified prompt construction
// ============================================

import type {
  CharacterCard,
  ChatMessage,
  Persona,
  PromptSection,
  CharacterGroup,
  Lorebook,
  SummaryData,
  CharacterMemory,
  SessionStats,
  HUDContextConfig,
  QuestTemplate,
  SessionQuestInstance,
  SoundTrigger,
  AppSettings,
  ResolvedStats,
  QuestSettings,
  Item,
  PersonaInventoryEntry,
  ItemAttributeEffect,
  ActiveConsumableEffect,
  InventoryV2Settings,
  SessionEquipmentEntry,
} from '@/types';
import type { ChatApiMessage, CompletionPromptConfig, GroupPromptBuildResult } from './types';
import { processExampleDialogue } from '@/lib/prompt-template';
import {
  buildLorebookInjectionPlan,
  resolveLorebookAttributeKeys,
  buildLorebookEntryKeyMap,
  type LorebookInjectOptions,
  type LorebookInjectionPlan,
  type LorebookChatInjection,
  type LorebookAttributeContext,
} from '@/lib/lorebook';
import {
  resolveStats,
  type StatsResolutionContext,
} from '@/lib/stats';
import {
  resolveAllKeys,
  resolveSectionsKeys,
  buildKeyResolutionContext,
  type KeyResolutionContext,
} from '@/lib/key-resolver';
import {
  buildQuestPromptSection,
  buildQuestKeysPrompt,
} from '@/lib/triggers/handlers/quest-handler';

// ============================================
// Section Colors for Prompt Viewer
// ============================================

export const SECTION_COLORS = {
  system: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  persona: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  character_description: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  personality: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  scenario: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  example_dialogue: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:bg-cyan-300',
  character_note: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  lorebook: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  author_note: 'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300',
  post_history: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  chat_history: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  instructions: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  summary: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  memory: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  relationship: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300',
  hud_context: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  quest: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  inventory: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
} as const;

// ============================================
// HUD Context Injection
// ============================================

/**
 * Build a HUD context section for prompt injection
 * 
 * Now resolves ALL keys including:
 * - Template variables: {{user}}, {{char}}, {{userpersona}}
 * - Stats keys: {{resistencia}}, {{habilidades}}, etc.
 */
export function buildHUDContextSection(
  contextConfig: HUDContextConfig,
  keyContext?: KeyResolutionContext
): PromptSection | null {
  if (!contextConfig.enabled || !contextConfig.content.trim()) {
    return null;
  }

  // Resolve all keys in the context content
  let resolvedContent = contextConfig.content;
  if (keyContext) {
    resolvedContent = resolveAllKeys(contextConfig.content, keyContext);
  }

  return {
    type: 'hud_context',
    label: 'HUD Context',
    content: resolvedContent,
    color: SECTION_COLORS.hud_context
  };
}

/**
 * Inject HUD context at the specified position
 *
 * Positions:
 * 0 = After system prompt
 * 1 = After user message (after last user message)
 * 2 = Before user message (before last user message)
 * 3 = After assistant message (after last assistant message)
 * 4 = Before assistant message (before last assistant message)
 * 5 = At top of chat (before chat history)
 * 6 = At bottom of chat (after all messages)
 * 7 = After lorebook / Author's Note position
 */
export function injectHUDContextIntoMessages(
  messages: ChatApiMessage[],
  contextSection: PromptSection,
  position: number
): ChatApiMessage[] {
  if (!contextSection.content.trim()) {
    return messages;
  }

  const contextContent = `[${contextSection.label}]\n${contextSection.content}`;
  const result: ChatApiMessage[] = [...messages];

  switch (position) {
    case 0: // After system prompt
      // Find the first system/assistant message (the system prompt)
      const sysIdx = result.findIndex(m => m.role === 'assistant' || m.role === 'system');
      if (sysIdx >= 0) {
        result[sysIdx] = {
          ...result[sysIdx],
          content: result[sysIdx].content + '\n\n' + contextContent
        };
      }
      break;

    case 1: // After user message
      // Find the last user message
      const lastUserIdx = result.map((m, i) => m.role === 'user' ? i : -1).filter(i => i >= 0).pop();
      if (lastUserIdx !== undefined && lastUserIdx >= 0) {
        result[lastUserIdx] = {
          ...result[lastUserIdx],
          content: result[lastUserIdx].content + '\n\n' + contextContent
        };
      }
      break;

    case 2: // Before user message
      const lastUserIdx2 = result.map((m, i) => m.role === 'user' ? i : -1).filter(i => i >= 0).pop();
      if (lastUserIdx2 !== undefined && lastUserIdx2 >= 0) {
        result[lastUserIdx2] = {
          ...result[lastUserIdx2],
          content: contextContent + '\n\n' + result[lastUserIdx2].content
        };
      }
      break;

    case 3: // After assistant message
      const lastAsstIdx = result.map((m, i) => m.role === 'assistant' ? i : -1).filter(i => i >= 0).pop();
      if (lastAsstIdx !== undefined && lastAsstIdx >= 0) {
        result[lastAsstIdx] = {
          ...result[lastAsstIdx],
          content: result[lastAsstIdx].content + '\n\n' + contextContent
        };
      }
      break;

    case 4: // Before assistant message
      const lastAsstIdx4 = result.map((m, i) => m.role === 'assistant' ? i : -1).filter(i => i >= 0).pop();
      if (lastAsstIdx4 !== undefined && lastAsstIdx4 >= 0) {
        result[lastAsstIdx4] = {
          ...result[lastAsstIdx4],
          content: contextContent + '\n\n' + result[lastAsstIdx4].content
        };
      }
      break;

    case 5: // At top of chat (after system, before first message)
      // Merge into the first system message to avoid breaking alternation
      {
        const sysMsgIdx5 = result.findIndex(m => m.role === 'system');
        if (sysMsgIdx5 >= 0) {
          result[sysMsgIdx5] = {
            ...result[sysMsgIdx5],
            content: result[sysMsgIdx5].content + '\n\n' + contextContent
          };
        }
      }
      break;

    case 6: // At bottom of chat (after all messages)
      // Merge into the first system message to avoid breaking alternation
      {
        const sysMsgIdx6 = result.findIndex(m => m.role === 'system');
        if (sysMsgIdx6 >= 0) {
          result[sysMsgIdx6] = {
            ...result[sysMsgIdx6],
            content: result[sysMsgIdx6].content + '\n\n' + contextContent
          };
        }
      }
      break;

    case 7: // After lorebook / Author's Note position
      // Merge into the first system message to avoid breaking alternation
      {
        const sysMsgIdx7 = result.findIndex(m => m.role === 'system' || m.role === 'assistant');
        if (sysMsgIdx7 >= 0) {
          result[sysMsgIdx7] = {
            ...result[sysMsgIdx7],
            content: result[sysMsgIdx7].content + '\n\n' + contextContent
          };
        }
      }
      break;

    default:
      // Merge into the first system message to avoid breaking alternation
      {
        const sysMsgIdxDef = result.findIndex(m => m.role === 'system');
        if (sysMsgIdxDef >= 0) {
          result[sysMsgIdxDef] = {
            ...result[sysMsgIdxDef],
            content: result[sysMsgIdxDef].content + '\n\n' + contextContent
          };
        } else {
          result.push({
            role: 'system',
            content: contextContent
          });
        }
      }
      break;
  }

  return result;
}

/**
 * Inject HUD context into prompt sections
 * This is for the prompt viewer display
 *
 * Positions:
 * 0 = After system prompt
 * 1 = After user message (not applicable to sections, uses chat_history)
 * 2 = Before user message (not applicable to sections, uses chat_history)
 * 3 = After assistant message (not applicable to sections, uses chat_history)
 * 4 = Before assistant message (not applicable to sections, uses chat_history)
 * 5 = At top of chat (before chat history)
 * 6 = At bottom of chat (after all sections)
 * 7 = After lorebook
 */
export function injectHUDContextIntoSections(
  sections: PromptSection[],
  contextSection: PromptSection,
  position: number
): PromptSection[] {
  if (!contextSection.content.trim()) {
    return sections;
  }

  const result: PromptSection[] = [...sections];

  switch (position) {
    case 0: // After system prompt
      const sysSectionIdx = result.findIndex(s => s.type === 'system');
      if (sysSectionIdx >= 0) {
        result.splice(sysSectionIdx + 1, 0, contextSection);
      } else {
        result.unshift(contextSection);
      }
      break;

    case 1: // After user message - inject before chat history
    case 2: // Before user message - inject before chat history
    case 3: // After assistant message - inject before chat history
    case 4: // Before assistant message - inject before chat history
      // These positions apply to messages, for sections we inject before chat history
      const chatHistoryIdx = result.findIndex(s => s.type === 'chat_history');
      if (chatHistoryIdx >= 0) {
        result.splice(chatHistoryIdx, 0, contextSection);
      } else {
        result.push(contextSection);
      }
      break;

    case 5: // At top of chat (before chat history)
      const chatIdx = result.findIndex(s => s.type === 'chat_history');
      if (chatIdx >= 0) {
        result.splice(chatIdx, 0, contextSection);
      } else {
        result.push(contextSection);
      }
      break;

    case 7: // After lorebook
      const lorebookIdx = result.findIndex(s => s.type === 'lorebook');
      if (lorebookIdx >= 0) {
        result.splice(lorebookIdx + 1, 0, contextSection);
      } else {
        // If no lorebook, insert after system prompt
        const sysIdx = result.findIndex(s => s.type === 'system');
        if (sysIdx >= 0) {
          result.splice(sysIdx + 1, 0, contextSection);
        } else {
          result.unshift(contextSection);
        }
      }
      break;

    case 6: // At bottom of chat
    default:
      result.push(contextSection);
      break;
  }

  return result;
}

// ============================================
// Inventory V2 Section
// ============================================

/**
 * Build an inventory section for prompt injection.
 *
 * Shows:
 * - Current currency
 * - Equipped items and their effects
 * - Active consumable effects with remaining turns
 * - Available (non-equipped) items in inventory
 *
 * Uses the `promptTemplate` from `inventorySettings` for formatting.
 * If no template is provided or the template is empty, a default format is used.
 *
 * Returns null if inventory data is empty or invalid.
 */
export function buildInventorySection(
  inventoryData: InventoryPromptData,
  keyContext?: KeyResolutionContext
): PromptSection | null {
  const {
    personaItems,
    equippedItems,
    sessionEquipment,
    activeEffects,
    currency,
    currencyName,
    currencyIcon,
    inventorySettings,
  } = inventoryData;

  // If no items and no effects and no currency, skip section
  if (personaItems.length === 0 && activeEffects.length === 0 && currency === 0) {
    return null;
  }

  // Use the template from inventory settings, or fall back to default
  const template = inventorySettings.promptTemplate?.trim() || `[Inventario Activo]
{{activeItems}}

[Efectos Activos]
{{activeEffects}}

[Divisa]
{{currency}}`;

  // Build items list (all items in inventory)
  const itemLines = personaItems.map(({ entry, item }) => {
    const qty = entry.quantity > 1 ? ` x${entry.quantity}` : '';
    const eq = entry.equipped ? ' [Equipado]' : '';
    const effects = (item.attributeEffects && item.attributeEffects.length > 0)
      ? ` (${item.attributeEffects.map(e => `${e.operator}${e.value} ${e.attributeKey}`).join(', ')})`
      : '';
    return `- ${item.icon || ''} ${item.name}${qty}${eq}${effects}`;
  }).join('\n');

  // Build active effects list
  const effectLines = activeEffects.map(e => {
    const turnsLeft = e.remainingTurns > 0 ? ` (${e.remainingTurns}/${e.totalTurns} turnos)` : '';
    // Use consumableEffect free text if available, otherwise fall back to attribute effects
    let effectDesc: string;
    if (e.consumableEffect) {
      effectDesc = e.consumableEffect;
    } else {
      effectDesc = e.effects.map(ef =>
        `${ef.operator}${ef.value} ${ef.attributeKey}${ef.targetId !== '__user__' ? ` → ${ef.targetName || ef.targetId}` : ''}`
      ).join(', ');
    }
    return `- ${e.itemName}: ${effectDesc}${turnsLeft}`;
  }).join('\n');

  // Build equipped items list - prefer sessionEquipment (per-session), fallback to equippedItems (legacy)
  let equipLines = '';
  if (sessionEquipment && sessionEquipment.length > 0) {
    // Use session equipment data
    const items = personaItems.map(({ item }) => item);
    equipLines = sessionEquipment.map(eq => {
      const item = items.find(i => i.id === eq.itemId);
      const slotDef = inventorySettings.equipmentSlots?.find(s => s.id === eq.equippedSlotId);
      const slotLabel = slotDef?.name || eq.equippedSlotId;
      const effectText = eq.slotEffectText
        || item?.slotEffects?.find(se => se.slotId === eq.equippedSlotId)?.effectText
        || '';
      return `- ${item?.icon || ''} ${item?.name || '???'} [${slotLabel}]${effectText ? ` → ${effectText}` : ''}`;
    }).join('\n');
  } else if (equippedItems && equippedItems.length > 0) {
    // Fallback to legacy equipped items
    equipLines = equippedItems.map(({ item }) => {
      // Prefer slotEffects (V3) over attributeEffects (V2)
      let effects = '';
      if (item.slotEffects && item.slotEffects.length > 0) {
        effects = item.slotEffects.map(se => se.effectText).filter(Boolean).join('; ');
      } else if (item.attributeEffects && item.attributeEffects.length > 0) {
        effects = item.attributeEffects.map(e => `${e.operator}${e.value} ${e.attributeKey}`).join(', ');
      }
      const slotDef = inventorySettings.equipmentSlots?.find(s => s.id === item.slot);
      const slotLabel = slotDef?.name || item.slot || '';
      return `- ${item.icon || ''} ${item.name}${slotLabel ? ` [${slotLabel}]` : ''}${effects ? ` → ${effects}` : ''}`;
    }).join('\n');
  }

  // Build currency line
  const currencyLine = `${currencyIcon || '💰'} ${currencyName || 'Divisa'}: ${currency}`;

  // Apply template replacements
  let content = template
    .replace('{{activeItems}}', itemLines || 'Vacío')
    .replace('{{activeEffects}}', effectLines || 'Ninguno')
    .replace('{{equippedItems}}', equipLines || 'Ninguno')
    .replace('{{currency}}', currencyLine);

  // Resolve all keys in the inventory content if keyContext is available
  if (keyContext) {
    content = resolveAllKeys(content, keyContext);
  }

  return {
    type: 'inventory',
    label: 'Inventory',
    content,
    color: SECTION_COLORS.inventory
  };
}

// ============================================
// Extended Build Options
// ============================================

export interface InventoryPromptData {
  personaItems: Array<{ entry: PersonaInventoryEntry; item: Item }>;
  equippedItems?: Array<{ entry: PersonaInventoryEntry; item: Item }>;  // Legacy: persona-based equipped items
  sessionEquipment?: SessionEquipmentEntry[];  // Per-session equipment state (preferred)
  activeEffects: ActiveConsumableEffect[];
  pendingFallbacks?: Array<{ targetId: string; attributeKey: string; fallbackValue: string | number }>;
  currency: number;
  currencyName: string;
  currencyIcon: string;
  inventorySettings: InventoryV2Settings;
}

export interface PromptBuildOptions {
  userName?: string;
  persona?: Persona;
  messages?: ChatMessage[];
  lorebooks?: Lorebook[];
  postHistoryInstructions?: string;
  lorebookOptions?: LorebookInjectOptions;
  sessionStats?: SessionStats;
  hudContext?: HUDContextConfig;
  questTemplates?: QuestTemplate[];
  sessionQuests?: SessionQuestInstance[];
  questSettings?: QuestSettings;
  inventoryData?: InventoryPromptData;
}

// ============================================
// Individual Chat Prompt Building
// ============================================

/**
 * Build the system prompt from character data (SillyTavern style)
 *
 * Uses unified key resolution for ALL sections:
 * - Template variables: {{user}}, {{char}}, {{userpersona}}, etc.
 * - Stats keys: {{resistencia}}, {{habilidades}}, etc.
 * - Sound keys: {{sonidos}}
 */
export function buildSystemPrompt(
  character: CharacterCard,
  userName: string = 'User',
  persona?: Persona,
  lorebookPlan?: LorebookInjectionPlan | null,
  sessionStats?: SessionStats,
  allCharacters?: CharacterCard[],
  soundTriggers?: SoundTrigger[],
  soundSettings?: AppSettings['sound'],
  questTemplates?: QuestTemplate[],
  sessionQuests?: SessionQuestInstance[],
  questSettings?: QuestSettings,
  lorebookAttributeKeys?: Record<string, string>,
  inventoryData?: InventoryPromptData,
  lorebookEntryKeyMap?: Record<string, string>
): { prompt: string; sections: PromptSection[]; lorebookChatInjections: LorebookChatInjection[]; exampleMessages: ChatApiMessage[] } {
  const sections: PromptSection[] = [];

  // Resolve stats for the persona FIRST (user attributes like {{resistencia}})
  // This must be done before character stats so personaResolvedStats is available
  let personaResolvedStats: ResolvedStats | null = null;
  if (persona?.statsConfig?.enabled && sessionStats) {
    personaResolvedStats = resolveStats({
      characterId: '__user__',
      statsConfig: persona.statsConfig,
      sessionStats,
      lorebookEntryKeys: lorebookEntryKeyMap,
    });
  }

  // Resolve stats for this character (includes skills block with full key resolution)
  const resolvedStats = resolveStats({
    characterId: character.id,
    statsConfig: character.statsConfig,
    sessionStats,
    allCharacters,
    userName,
    characterName: character.name,
    questTemplates,
    personaDescription: persona?.description,
    personaResolvedStats,
    lorebookEntryKeys: lorebookEntryKeyMap,
  });

  // Build outlet sections map from lorebook plan for {{outlet::name}} macro resolution
  const outletSections: Record<string, string> = {};
  if (lorebookPlan?.outletSections.length) {
    for (const outletSection of lorebookPlan.outletSections) {
      // Extract outlet name from label like "World Info (myOutlet)" → "myOutlet"
      const match = outletSection.label.match(/^World Info \((.+)\)$/);
      const outletName = match ? match[1] : outletSection.label;
      outletSections[outletName] = outletSection.content;
    }
  }

  // Build unified key resolution context (includes quest data for {{activeQuests}}, outlet sections, lorebook attribute keys, lorebook entry keys, and inventory data for {{slots}})
  const keyContext = buildKeyResolutionContext(character, userName, persona, resolvedStats, sessionStats, soundTriggers, soundSettings, personaResolvedStats, questTemplates, sessionQuests, questSettings, outletSections, lorebookAttributeKeys, inventoryData ? {
    personaItems: inventoryData.personaItems,
    sessionEquipment: inventoryData.sessionEquipment || inventoryData.equippedItems?.flatMap(({ entry, item }) =>
      entry.equippedSlotId ? [{ itemId: item.id, equippedSlotId: entry.equippedSlotId, slotEffectText: item.slotEffects?.find(se => se.slotId === entry.equippedSlotId)?.effectText }] : []
    ) || [],
    activeEffects: inventoryData.activeEffects,
    currency: inventoryData.currency,
    currencyName: inventoryData.currencyName,
    currencyIcon: inventoryData.currencyIcon,
    inventorySettings: inventoryData.inventorySettings,
  } : undefined, lorebookEntryKeyMap);

  // Main system instruction
  // If character has a custom system prompt, use it instead of the default
  const systemContent = character.systemPrompt?.trim()
    ? character.systemPrompt
    : `You are now in roleplay mode. You will act as ${character.name}.`;

  sections.push({
    type: 'system',
    label: 'System Prompt',
    content: systemContent,
    color: SECTION_COLORS.system
  });

  // Lorebook position 0: After system prompt
  if (lorebookPlan?.position0Section) {
    sections.push(lorebookPlan.position0Section);
  }

  // NOTE: User's Persona section removed - use {{persona}} key in character sections instead
  // The persona content is now injected via the {{persona}} template key which can be
  // placed anywhere in the character's description, scenario, etc.

  // NOTE: Inventory section removed - use {{slots}} key in character sections instead.
  // The {{slots}} key resolves slot equipment + active consumable effects and can be
  // placed anywhere in the character's description, scenario, systemPrompt, etc.

  // Add character description
  if (character.description) {
    sections.push({
      type: 'character_description',
      label: 'Character Description',
      content: character.description,
      color: SECTION_COLORS.character_description
    });
  }

  // Add personality
  if (character.personality) {
    sections.push({
      type: 'personality',
      label: 'Personality',
      content: character.personality,
      color: SECTION_COLORS.personality
    });
  }

  // Add scenario
  if (character.scenario) {
    sections.push({
      type: 'scenario',
      label: 'Scenario',
      content: character.scenario,
      color: SECTION_COLORS.scenario
    });
  }

  // Add character's note (user-defined instructions for this character)
  // NOTE: According to SillyTavern docs, Character Notes comes BEFORE Example Dialogue
  if (character.characterNote) {
    sections.push({
      type: 'character_note',
      label: "Character's Note",
      content: character.characterNote,
      color: SECTION_COLORS.character_note
    });
  }

  // Example Dialogue: Format as numbered [EJEMPLO N] text section
  // Each <START> block becomes a numbered example with --- separators.
  // Supports both <START> and <START></START> tag formats.
  // This replaces the old approach of injecting as user/assistant chat messages,
  // making examples visible in the Prompt Viewer and clearly identifiable by the LLM.
  if (character.mesExample) {
    const exampleContent = processExampleDialogue(character.mesExample, userName, character.name);
    if (exampleContent) {
      sections.push({
        type: 'example_dialogue',
        label: 'EJEMPLOS DE MENSAJES',
        content: exampleContent,
        color: SECTION_COLORS.example_dialogue
      });
    }
  }

  // Lorebook position 5: At top of chat (before chat history)
  if (lorebookPlan?.position5Section) {
    sections.push(lorebookPlan.position5Section);
  }

  // Lorebook position 7: Outlets (custom positions)
  if (lorebookPlan?.outletSections.length) {
    sections.push(...lorebookPlan.outletSections);
  }

  // Lorebook position 6: At bottom of chat (appended at end of system sections)
  if (lorebookPlan?.position6Section) {
    sections.push(lorebookPlan.position6Section);
  }

  // Note: postHistoryInstructions should NOT be in system prompt
  // It must be injected AFTER the chat history in buildChatMessages

  // ========================================
  // UNIFIED KEY RESOLUTION - Apply to ALL sections
  // ========================================
  // This resolves:
  // - Template variables: {{user}}, {{char}}, {{userpersona}}, etc.
  // - Stats keys: {{resistencia}}, {{habilidades}}, etc.
  // All in one place, consistently
  const processedSections = resolveSectionsKeys(sections, keyContext);

  // Build the prompt string from processed sections
  const prompt = processedSections.map(s => `[${s.label}]\n${s.content}`).join('\n\n');

  // Example dialogue is now included as a PromptSection above (visible in Prompt Viewer).
  // Return empty exampleMessages for backward compatibility with API routes.
  const exampleMessages: ChatApiMessage[] = [];

  return { prompt, sections: processedSections, lorebookChatInjections: lorebookPlan?.chatInjections || [], exampleMessages };
}

/**
 * Build complete lorebook injection plan from active lorebooks and chat messages.
 * This replaces the old single-section approach with position-aware injection.
 * Also resolves attribute-type lorebook entries to their injection keys.
 */
export function buildLorebookSectionForPrompt(
  messages: ChatMessage[],
  lorebooks: Lorebook[],
  options?: LorebookInjectOptions,
  attributeContext?: LorebookAttributeContext
): { section: PromptSection | null; plan: LorebookInjectionPlan; lorebookAttributeKeys: Record<string, string>; lorebookEntryKeyMap: Record<string, string>; lorebookDebugEntries?: import('@/lib/lorebook/attribute-resolver').LorebookAttrDebugEntry[] } {
  // Resolve attribute-type entries to key→content map
  let lorebookAttributeKeys: Record<string, string> = {};
  let lorebookDebugEntries: import('@/lib/lorebook/attribute-resolver').LorebookAttrDebugEntry[] | undefined;

  if (attributeContext) {
    const result = resolveLorebookAttributeKeys(lorebooks, attributeContext);
    lorebookAttributeKeys = result.keys;
    lorebookDebugEntries = result.debugEntries;
  }

  // Build lorebook entry key map from traditional entries for {{key}} resolution
  // in action descriptions and other text fields
  const entryKeyMapResult = buildLorebookEntryKeyMap(lorebooks);
  const lorebookEntryKeyMap = entryKeyMapResult.keys;

  // Build injection plan for traditional entries only (attribute entries are skipped by scanner)
  // Pass userName/charName for <START> dialogue formatting in lorebook entries
  const lorebookOptions = {
    ...options,
    userName: options?.userName,
    charName: options?.charName,
  };
  const plan = buildLorebookInjectionPlan(messages, lorebooks, lorebookOptions);

  // Combine all system-level sections into one for backward compat with callers that only need a single section
  const allSystemSections = [
    plan.position0Section,
    plan.position5Section,
    plan.position6Section,
    ...plan.outletSections
  ].filter((s): s is PromptSection => s !== null);

  const section = allSystemSections.length > 0
    ? {
        type: 'lorebook' as const,
        label: 'World Information',
        content: allSystemSections.map(s => s.content).join('\n\n'),
        color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
      }
    : null;

  return { section, plan, lorebookAttributeKeys, lorebookEntryKeyMap, lorebookDebugEntries };
}

/**
 * Build author's note section
 * This section is injected AFTER the chat history, BEFORE post-history instructions
 * 
 * According to SillyTavern docs, the order is:
 * 1. Chat History
 * 2. Author's Note (this)
 * 3. Post-History Instructions
 * 
 * @param authorNote - Raw author's note text (may contain {{keys}})
 * @param keyContext - Key resolution context (optional, for resolving keys)
 */
export function buildAuthorNoteSection(
  authorNote: string | undefined,
  keyContext?: KeyResolutionContext
): PromptSection | null {
  if (!authorNote?.trim()) {
    return null;
  }

  // Resolve all keys if keyContext is provided
  const resolvedContent = keyContext 
    ? resolveAllKeys(authorNote, keyContext)
    : authorNote;

  return {
    type: 'author_note',
    label: "Author's Note",
    content: resolvedContent,
    color: SECTION_COLORS.author_note
  };
}

/**
 * Build post-history instructions section
 * This section is injected AFTER the chat history
 * 
 * @param instructions - Raw instructions text (may contain {{keys}})
 * @param keyContext - Key resolution context (optional, for resolving keys)
 */
export function buildPostHistorySection(
  instructions: string | undefined,
  keyContext?: KeyResolutionContext
): PromptSection | null {
  if (!instructions?.trim()) {
    return null;
  }

  // Resolve all keys if keyContext is provided
  const resolvedContent = keyContext 
    ? resolveAllKeys(instructions, keyContext)
    : instructions;

  return {
    type: 'post_history',
    label: 'Post-History Instructions',
    content: resolvedContent,
    color: SECTION_COLORS.post_history
  };
}

/**
 * Build chat history sections for prompt viewer
 */
export function buildChatHistorySections(
  messages: ChatMessage[],
  characterName: string,
  userName: string
): PromptSection[] {
  const sections: PromptSection[] = [];
  // Exclude narrator messages from chat history display
  const visibleMessages = messages.filter(m => !m.isDeleted && !m.isNarratorMessage);

  const historyParts: string[] = [];
  for (const msg of visibleMessages) {
    const name = msg.role === 'user' ? userName : characterName;
    historyParts.push(`${name}: ${msg.content}`);
  }

  if (historyParts.length > 0) {
    sections.push({
      type: 'chat_history',
      label: 'Chat History',
      content: historyParts.join('\n\n'),
      color: SECTION_COLORS.chat_history
    });
  }

  return sections;
}

/**
 * Inject lorebook content at chat-level positions (1-4).
 * Merges content into existing messages to avoid breaking message alternation.
 *
 * Position mapping:
 * 1 = After last user message
 * 2 = Before last user message
 * 3 = After last assistant message
 * 4 = Before last assistant message
 */
function applyChatInjections(
  messages: ChatApiMessage[],
  injections: LorebookChatInjection[]
): void {
  for (const injection of injections) {
    const content = `\n\n[${injection.label}]\n${injection.content}`;

    switch (injection.position) {
      case 1: { // After last user message
        const lastUserIdx = messages.map((m, i) => m.role === 'user' ? i : -1).filter(i => i >= 0).pop();
        if (lastUserIdx !== undefined && lastUserIdx >= 0) {
          messages[lastUserIdx] = {
            ...messages[lastUserIdx],
            content: messages[lastUserIdx].content + content
          };
        }
        break;
      }
      case 2: { // Before last user message
        const lastUserIdx2 = messages.map((m, i) => m.role === 'user' ? i : -1).filter(i => i >= 0).pop();
        if (lastUserIdx2 !== undefined && lastUserIdx2 >= 0) {
          messages[lastUserIdx2] = {
            ...messages[lastUserIdx2],
            content: content + messages[lastUserIdx2].content
          };
        }
        break;
      }
      case 3: { // After last assistant message
        const lastAsstIdx = messages.map((m, i) => m.role === 'assistant' ? i : -1).filter(i => i >= 0).pop();
        if (lastAsstIdx !== undefined && lastAsstIdx >= 0) {
          messages[lastAsstIdx] = {
            ...messages[lastAsstIdx],
            content: messages[lastAsstIdx].content + content
          };
        }
        break;
      }
      case 4: { // Before last assistant message
        const lastAsstIdx4 = messages.map((m, i) => m.role === 'assistant' ? i : -1).filter(i => i >= 0).pop();
        if (lastAsstIdx4 !== undefined && lastAsstIdx4 >= 0) {
          messages[lastAsstIdx4] = {
            ...messages[lastAsstIdx4],
            content: content + messages[lastAsstIdx4].content
          };
        }
        break;
      }
    }
  }
}

/**
 * Build messages array for chat models
 * 
 * Order (SillyTavern style):
 * 1. System message (system prompt)
 * 2. Chat history
 * 3. Author's Note (injected AFTER chat history, as system message)
 * 4. Post-History Instructions (injected AFTER Author's Note, as system message)
 */
export function buildChatMessages(
  systemPrompt: string,
  messages: ChatMessage[],
  character: CharacterCard,
  userName: string = 'User',
  postHistoryInstructions?: string,
  authorNote?: string,
  useSystemRole: boolean = false,
  embeddingsContext?: string,  // embeddings injected before chat history
  lorebookChatInjections?: LorebookChatInjection[],  // positions 1-4: inject into specific messages
  exampleMessages?: ChatApiMessage[]  // SillyTavern-style example dialogue as chat messages
): ChatApiMessage[] {
  // =============================================
  // Step 1: Build all system content as ONE message
  // =============================================
  // Consolidate system prompt + embeddings + author note + post-history
  // into a single system message to avoid consecutive system messages
  // which break Jinja templates in models like LM Studio.
  const systemParts: string[] = [];

  // Main system prompt
  if (systemPrompt.trim()) {
    systemParts.push(systemPrompt);
  }

  // Embeddings Context
  if (embeddingsContext?.trim()) {
    systemParts.push(embeddingsContext);
  }

  // Author's Note
  if (authorNote?.trim()) {
    systemParts.push(`[Author's Note]\n${authorNote}`);
  }

  // Post-History Instructions
  if (postHistoryInstructions?.trim()) {
    systemParts.push(postHistoryInstructions);
  }

  const chatMessages: ChatApiMessage[] = [];

  // Single system message (or assistant if useSystemRole is false)
  if (systemParts.length > 0) {
    chatMessages.push({
      role: useSystemRole ? 'system' : 'assistant',
      content: systemParts.join('\n\n---\n\n')
    });
  }

  // =============================================
  // Step 2: Inject example dialogue as chat messages (SillyTavern style)
  // =============================================
  // These go between the system message and the actual chat history
  // They serve as few-shot examples for the LLM
  if (exampleMessages && exampleMessages.length > 0) {
    chatMessages.push(...exampleMessages);
  }

  // =============================================
  // Step 3: Build chat history with proper alternation
  // =============================================
  // Merge consecutive same-role messages and ensure
  // strict user/assistant alternation for OpenAI-compatible APIs.
  const visibleMessages = messages.filter(m => !m.isDeleted && !m.isNarratorMessage);

  // First pass: merge consecutive same-role messages
  const mergedMessages: ChatApiMessage[] = [];
  for (const msg of visibleMessages) {
    const role = msg.role === 'user' ? 'user' : 'assistant';
    const last = mergedMessages[mergedMessages.length - 1];
    if (last && last.role === role) {
      // Merge into previous message
      last.content += '\n' + msg.content;
    } else {
      mergedMessages.push({ role, content: msg.content });
    }
  }

  // Second pass: enforce user/assistant alternation
  // If the first chat message is 'assistant', prepend a synthetic user message
  if (mergedMessages.length > 0 && mergedMessages[0].role === 'assistant') {
    mergedMessages.unshift({ role: 'user', content: '*continúa*' });
  }

  // If two same-role messages are still adjacent (shouldn't happen after merge,
  // but as safety), insert a bridging message
  const finalHistory: ChatApiMessage[] = [];
  for (const msg of mergedMessages) {
    const last = finalHistory[finalHistory.length - 1];
    if (last && last.role === msg.role) {
      // Insert bridging message
      const bridgeRole = msg.role === 'user' ? 'assistant' : 'user';
      finalHistory.push({ role: bridgeRole, content: '*continúa*' });
    }
    finalHistory.push(msg);
  }

  // Bridge between example messages and chat history if needed
  // If the last example message has the same role as the first chat message,
  // insert a bridging message to maintain proper user/assistant alternation
  if (finalHistory.length > 0 && chatMessages.length > 0) {
    const lastExistingMsg = chatMessages[chatMessages.length - 1];
    const firstChatMsg = finalHistory[0];
    if (lastExistingMsg.role === firstChatMsg.role) {
      const bridgeRole = firstChatMsg.role === 'user' ? 'assistant' : 'user';
      chatMessages.push({ role: bridgeRole, content: '*continúa*' });
    }
  }

  chatMessages.push(...finalHistory);

  // =============================================
  // Step 4: Inject lorebook chat-level content (positions 1-4)
  // =============================================
  if (lorebookChatInjections?.length) {
    applyChatInjections(chatMessages, lorebookChatInjections);
  }

  return chatMessages;
}

/**
 * Build prompt for completion-style APIs (Ollama, KoboldCPP, etc.)
 * 
 * Order (SillyTavern style):
 * 1. System prompt
 * 2. Chat history
 * 3. Author's Note
 * 4. Post-History Instructions
 * 5. Assistant prefix
 */
export function buildCompletionPrompt(config: CompletionPromptConfig): string {
  const { systemPrompt, messages, character, userName, postHistoryInstructions, authorNote, embeddingsContext, exampleMessages } = config;
  const parts: string[] = [];

  parts.push(systemPrompt);
  parts.push('\n---\n');

  // Embeddings Context - injected before chat history for recency primacy
  if (embeddingsContext?.trim()) {
    parts.push(embeddingsContext);
    parts.push('\n---\n');
  }

  // Example dialogue is now included in the systemPrompt string (as [EJEMPLO] sections).
  // The exampleMessages parameter is kept for backward compatibility but will always be empty.
  // No separate injection needed here.

  // Exclude narrator messages from prompt
  const visibleMessages = messages.filter(m => !m.isDeleted && !m.isNarratorMessage);

  for (const msg of visibleMessages) {
    if (msg.role === 'user') {
      parts.push(`${userName}: ${msg.content}`);
    } else if (msg.role === 'assistant') {
      parts.push(`${character.name}: ${msg.content}`);
    }
  }

  // Author's Note - injected AFTER chat history, BEFORE post-history instructions
  if (authorNote?.trim()) {
    parts.push(`\n[Author's Note]\n${authorNote}`);
  }

  // Post-History Instructions - injected AFTER Author's Note
  if (postHistoryInstructions) {
    parts.push(`\n${postHistoryInstructions}`);
  }

  parts.push(`\n${character.name}:`);

  return parts.join('\n');
}

// ============================================
// Group Chat Prompt Building
// ============================================

/**
 * Build the system prompt for a character in a group chat
 *
 * Uses unified key resolution for ALL sections
 */
export function buildGroupSystemPrompt(
  character: CharacterCard,
  group: CharacterGroup,
  userName: string = 'User',
  persona?: Persona,
  lorebookPlan?: LorebookInjectionPlan | null,
  sessionStats?: SessionStats,
  postHistoryInstructions?: string,
  allCharacters?: CharacterCard[],
  questTemplates?: QuestTemplate[],
  sessionQuests?: SessionQuestInstance[],
  questSettings?: QuestSettings,
  lorebookAttributeKeys?: Record<string, string>,
  inventoryData?: InventoryPromptData,
  lorebookEntryKeyMap?: Record<string, string>
): { prompt: string; sections: PromptSection[]; lorebookChatInjections: LorebookChatInjection[]; exampleMessages: ChatApiMessage[] } {
  const sections: PromptSection[] = [];

  // Resolve stats for the persona FIRST (user attributes like {{resistencia}})
  let personaResolvedStats: ResolvedStats | null = null;
  if (persona?.statsConfig?.enabled && sessionStats) {
    personaResolvedStats = resolveStats({
      characterId: '__user__',
      statsConfig: persona.statsConfig,
      sessionStats,
      lorebookEntryKeys: lorebookEntryKeyMap,
    });
  }

  // Resolve stats for this character in the group (includes skills block with full key resolution)
  const resolvedStats = resolveStats({
    characterId: character.id,
    statsConfig: character.statsConfig,
    sessionStats,
    allCharacters,
    userName,
    characterName: character.name,
    questTemplates,
    personaDescription: persona?.description,
    personaResolvedStats,
    lorebookEntryKeys: lorebookEntryKeyMap,
  });

  // Build unified key resolution context (includes quest data for {{activeQuests}}, lorebook attribute keys, lorebook entry keys, and inventory data for {{slots}})
  const keyContext = buildKeyResolutionContext(character, userName, persona, resolvedStats, sessionStats, undefined, undefined, personaResolvedStats, questTemplates, sessionQuests, questSettings, undefined, lorebookAttributeKeys, inventoryData ? {
    personaItems: inventoryData.personaItems,
    sessionEquipment: inventoryData.sessionEquipment || inventoryData.equippedItems?.flatMap(({ entry, item }) =>
      entry.equippedSlotId ? [{ itemId: item.id, equippedSlotId: entry.equippedSlotId, slotEffectText: item.slotEffects?.find(se => se.slotId === entry.equippedSlotId)?.effectText }] : []
    ) || [],
    activeEffects: inventoryData.activeEffects,
    currency: inventoryData.currency,
    currencyName: inventoryData.currencyName,
    currencyIcon: inventoryData.currencyIcon,
    inventorySettings: inventoryData.inventorySettings,
  } : undefined, lorebookEntryKeyMap);

  // System Prompt Priority: Group > Character > Default
  let systemContent: string;
  let systemLabel: string;

  if (group.systemPrompt?.trim()) {
    // Group system prompt takes highest priority
    systemContent = group.systemPrompt;
    systemLabel = 'System Prompt (Group)';
  } else if (character.systemPrompt?.trim()) {
    // Character system prompt
    systemContent = character.systemPrompt;
    systemLabel = 'System Prompt';
  } else {
    // Default fallback
    systemContent = `You are in a group roleplay. You will act as ${character.name}.`;
    systemLabel = 'System Prompt';
  }

  sections.push({
    type: 'system',
    label: systemLabel,
    content: systemContent,
    color: SECTION_COLORS.system
  });

  // Lorebook position 0: After system prompt
  if (lorebookPlan?.position0Section) {
    sections.push(lorebookPlan.position0Section);
  }

  // NOTE: User's Persona section removed - use {{persona}} key in character sections instead
  // The persona content is now injected via the {{persona}} template key which can be
  // placed anywhere in the character's description, scenario, etc.

  // NOTE: Inventory section removed - use {{slots}} key in character sections instead.
  // The {{slots}} key resolves slot equipment + active consumable effects and can be
  // placed anywhere in the character's description, scenario, systemPrompt, etc.

  // Add this character's details
  if (character.description) {
    sections.push({
      type: 'character_description',
      label: `${character.name}'s Description`,
      content: character.description,
      color: SECTION_COLORS.character_description
    });
  }

  if (character.personality) {
    sections.push({
      type: 'personality',
      label: `${character.name}'s Personality`,
      content: character.personality,
      color: SECTION_COLORS.personality
    });
  }

  // Add scenario - Group description takes priority over character scenario
  if (group.description?.trim()) {
    sections.push({
      type: 'scenario',
      label: 'Scenario (Group)',
      content: group.description,
      color: SECTION_COLORS.scenario
    });
  } else if (character.scenario?.trim()) {
    sections.push({
      type: 'scenario',
      label: 'Scenario',
      content: character.scenario,
      color: SECTION_COLORS.scenario
    });
  }

  // Add character's note
  // NOTE: According to SillyTavern docs, Character Notes comes BEFORE Example Dialogue
  if (character.characterNote) {
    sections.push({
      type: 'character_note',
      label: `${character.name}'s Note`,
      content: character.characterNote,
      color: SECTION_COLORS.character_note
    });
  }

  // Example Dialogue: Format as numbered [EJEMPLO N] text section (group chat variant)
  if (character.mesExample) {
    const exampleContent = processExampleDialogue(character.mesExample, userName, character.name);
    if (exampleContent) {
      sections.push({
        type: 'example_dialogue',
        label: 'EJEMPLOS DE MENSAJES',
        content: exampleContent,
        color: SECTION_COLORS.example_dialogue
      });
    }
  }

  // Lorebook position 5: At top of chat (before chat history)
  if (lorebookPlan?.position5Section) {
    sections.push(lorebookPlan.position5Section);
  }

  // Lorebook position 7: Outlets (custom positions)
  if (lorebookPlan?.outletSections.length) {
    sections.push(...lorebookPlan.outletSections);
  }

  // Lorebook position 6: At bottom of chat (appended at end of system sections)
  if (lorebookPlan?.position6Section) {
    sections.push(lorebookPlan.position6Section);
  }

  // Note: postHistoryInstructions should NOT be in system prompt
  // It must be injected AFTER the chat history in buildGroupChatMessages

  // ========================================
  // UNIFIED KEY RESOLUTION - Apply to ALL sections
  // ========================================
  const processedSections = resolveSectionsKeys(sections, keyContext);

  // Build the prompt string from processed sections
  const prompt = processedSections.map(s => `[${s.label}]\n${s.content}`).join('\n\n');

  // Example dialogue is now included as a PromptSection above (visible in Prompt Viewer).
  // Return empty exampleMessages for backward compatibility with API routes.
  const exampleMessages: ChatApiMessage[] = [];

  return { prompt, sections: processedSections, lorebookChatInjections: lorebookPlan?.chatInjections || [], exampleMessages };
}

/**
 * Build messages array for group chat
 *
 * Order (SillyTavern style):
 * 1. System message (system prompt)
 * 2. Chat history (all visible messages)
 * 3. Previous responses from this turn
 * 4. Author's Note (injected AFTER chat history, as system message)
 * 5. Post-History Instructions (injected AFTER Author's Note, as system message)
 *
 * @param isForNarrator - If true, narrator messages ARE included (narrator sees all)
 */
export function buildGroupChatMessages(
  systemPrompt: string,
  messages: ChatMessage[],
  character: CharacterCard,
  allCharacters: CharacterCard[],
  userName: string = 'User',
  previousResponses?: Array<{ characterName: string; content: string }>,
  postHistoryInstructions?: string,
  authorNote?: string,
  isForNarrator: boolean = false,
  embeddingsContext?: string,  // embeddings injected before chat history
  lorebookChatInjections?: LorebookChatInjection[],  // positions 1-4: inject into specific messages
  exampleMessages?: ChatApiMessage[]  // SillyTavern-style example dialogue as chat messages
): GroupPromptBuildResult {
  // =============================================
  // Step 1: Build all system content as ONE message
  // =============================================
  const systemParts: string[] = [];

  if (systemPrompt.trim()) {
    systemParts.push(systemPrompt);
  }
  if (embeddingsContext?.trim()) {
    systemParts.push(embeddingsContext);
  }
  if (authorNote?.trim()) {
    systemParts.push(`[Author's Note]\n${authorNote}`);
  }
  if (postHistoryInstructions?.trim()) {
    systemParts.push(postHistoryInstructions);
  }

  const chatMessages: ChatApiMessage[] = [];

  // Single system/assistant message
  if (systemParts.length > 0) {
    chatMessages.push({
      role: 'assistant',
      content: systemParts.join('\n\n---\n\n')
    });
  }

  // =============================================
  // Step 2: Inject example dialogue as chat messages (SillyTavern style)
  // =============================================
  // These go between the system message and the actual chat history
  // They serve as few-shot examples for the LLM
  if (exampleMessages && exampleMessages.length > 0) {
    chatMessages.push(...exampleMessages);
  }

  // =============================================
  // Step 3: Build chat history with proper alternation
  // =============================================
  const visibleMessages = isForNarrator
    ? messages.filter(m => !m.isDeleted)
    : messages.filter(m => !m.isDeleted && !m.isNarratorMessage);

  const historyLines: string[] = [];

  // Build history lines + API messages
  for (const msg of visibleMessages) {
    const speaker = msg.role === 'user' ? userName :
      (allCharacters.find(c => c.id === msg.characterId)?.name || 'Character');
    historyLines.push(`${speaker}: ${msg.content}`);
  }

  // Build merged API messages with proper alternation
  const mergedMessages: ChatApiMessage[] = [];
  for (const msg of visibleMessages) {
    const role = msg.role === 'user' ? 'user' : 'assistant';
    const last = mergedMessages[mergedMessages.length - 1];
    if (last && last.role === role) {
      last.content += '\n' + msg.content;
    } else {
      mergedMessages.push({ role, content: msg.content });
    }
  }

  // Add previous responses from this turn
  if (previousResponses && previousResponses.length > 0) {
    for (const resp of previousResponses) {
      historyLines.push(`${resp.characterName}: ${resp.content}`);
      const last = mergedMessages[mergedMessages.length - 1];
      if (last && last.role === 'assistant') {
        last.content += '\n' + resp.content;
      } else {
        mergedMessages.push({ role: 'assistant', content: resp.content });
      }
    }
  }

  // Enforce alternation: if first is assistant, prepend synthetic user
  if (mergedMessages.length > 0 && mergedMessages[0].role === 'assistant') {
    mergedMessages.unshift({ role: 'user', content: '*continúa*' });
  }

  // Safety: insert bridging messages if any same-role adjacency remains
  const finalHistory: ChatApiMessage[] = [];
  for (const msg of mergedMessages) {
    const last = finalHistory[finalHistory.length - 1];
    if (last && last.role === msg.role) {
      const bridgeRole = msg.role === 'user' ? 'assistant' : 'user';
      finalHistory.push({ role: bridgeRole, content: '*continúa*' });
    }
    finalHistory.push(msg);
  }

  // Bridge between example messages and chat history if needed
  if (finalHistory.length > 0 && chatMessages.length > 0) {
    const lastExistingMsg = chatMessages[chatMessages.length - 1];
    const firstChatMsg = finalHistory[0];
    if (lastExistingMsg.role === firstChatMsg.role) {
      const bridgeRole = firstChatMsg.role === 'user' ? 'assistant' : 'user';
      chatMessages.push({ role: bridgeRole, content: '*continúa*' });
    }
  }

  chatMessages.push(...finalHistory);

  // Inject lorebook chat-level content (positions 1-4)
  if (lorebookChatInjections?.length) {
    applyChatInjections(chatMessages, lorebookChatInjections);
  }

  // Build chat history section for prompt viewer
  let chatHistorySection: PromptSection | undefined;
  if (historyLines.length > 0) {
    chatHistorySection = {
      type: 'chat_history',
      label: 'Chat History',
      content: historyLines.join('\n\n'),
      color: SECTION_COLORS.chat_history
    };
  }

  return {
    systemPrompt,
    sections: [],
    chatMessages,
    chatHistorySection
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Process character and return effective values
 * Uses the unified key resolver
 */
export function processCharacter(
  character: CharacterCard,
  userName: string,
  persona?: Persona,
  sessionStats?: SessionStats,
  allCharacters?: CharacterCard[],
  questTemplates?: QuestTemplate[]
): CharacterCard {
  // Resolve stats for the persona FIRST
  let personaResolvedStats: ResolvedStats | null = null;
  if (persona?.statsConfig?.enabled && sessionStats) {
    personaResolvedStats = resolveStats({
      characterId: '__user__',
      statsConfig: persona.statsConfig,
      sessionStats,
    });
  }

  // Resolve stats for this character (includes skills block with full key resolution)
  const resolvedStats = resolveStats({
    characterId: character.id,
    statsConfig: character.statsConfig,
    sessionStats,
    allCharacters,
    userName,
    characterName: character.name,
    questTemplates,
    personaDescription: persona?.description,
    personaResolvedStats,
  });

  // Build key resolution context
  const keyContext = buildKeyResolutionContext(character, userName, persona, resolvedStats, sessionStats, undefined, undefined, personaResolvedStats);

  // Process all text fields
  return {
    ...character,
    description: resolveAllKeys(character.description, keyContext),
    personality: resolveAllKeys(character.personality, keyContext),
    scenario: resolveAllKeys(character.scenario, keyContext),
    firstMes: resolveAllKeys(character.firstMes, keyContext),
    mesExample: resolveAllKeys(character.mesExample, keyContext),
    systemPrompt: resolveAllKeys(character.systemPrompt, keyContext),
    postHistoryInstructions: resolveAllKeys(character.postHistoryInstructions, keyContext),
    characterNote: resolveAllKeys(character.characterNote, keyContext),
    authorNote: resolveAllKeys(character.authorNote, keyContext),
    alternateGreetings: (character.alternateGreetings || []).map(greeting =>
      resolveAllKeys(greeting, keyContext)
    )
  };
}

/**
 * Get effective user name from persona or default
 */
export function getEffectiveUserName(persona?: Persona, defaultName: string = 'User'): string {
  return persona?.name || defaultName;
}

/**
 * Create empty user message for API
 */
export function createUserMessage(content: string): ChatMessage {
  return {
    id: '',
    characterId: '',
    role: 'user',
    content,
    timestamp: '',
    isDeleted: false,
    swipeId: '',
    swipeIndex: 0
  };
}

// ============================================
// Summary & Memory Functions
// ============================================

/**
 * Build summary section for context compression
 */
export function buildSummarySection(summary: SummaryData): PromptSection {
  return {
    type: 'system',
    label: 'Resumen de conversación',
    content: `[Resumen de conversación anterior]\n${summary.content}`,
    color: SECTION_COLORS.summary
  };
}

/**
 * Build character memory section
 */
export function buildMemorySection(memory: CharacterMemory, characterName: string): PromptSection | null {
  if (!memory.events.length && !memory.relationships.length && !memory.notes) {
    return null;
  }

  const parts: string[] = [];

  // Add events (sorted by importance, highest first)
  if (memory.events.length > 0) {
    parts.push(`[Eventos y hechos clave]`);
    const sortedEvents = [...memory.events].sort((a, b) => {
      // Support both old (0-1) and new (1-5) importance scales
      const impA = a.importance > 1 ? a.importance : Math.round(a.importance * 5);
      const impB = b.importance > 1 ? b.importance : Math.round(b.importance * 5);
      return impB - impA;
    });
    for (const event of sortedEvents) {
      // Support both old (0-1) and new (1-5) importance scales
      const normalizedImportance = event.importance > 1 ? event.importance : Math.round(event.importance * 5);
      const importance = normalizedImportance >= 4 ? '⭐' : '';
      parts.push(`${importance} ${event.content}`);
    }
  }

  // Add relationships
  if (memory.relationships.length > 0) {
    parts.push(`\n[Relaciones]`);
    for (const rel of memory.relationships) {
      const sentiment = rel.sentiment > 50 ? '😊' : rel.sentiment < -50 ? '😞' : '😐';
      parts.push(`${sentiment} ${rel.targetName}: ${rel.relationship} (${rel.sentiment >= 0 ? '+' : ''}${rel.sentiment})`);
    }
  }

  // Add notes
  if (memory.notes) {
    parts.push(`\n[Notas]\n${memory.notes}`);
  }

  return {
    type: 'character_note',
    label: `Memoria de ${characterName}`,
    content: parts.join('\n'),
    color: SECTION_COLORS.memory
  };
}

/**
 * Build instructions section for summary behavior
 */
export function buildSummaryInstructionsSection(
  characterName: string,
  summaryEnabled: boolean
): PromptSection | null {
  if (!summaryEnabled) return null;

  const content = `## Instrucciones de memoria
- Recuerda eventos importantes, decisiones y momentos emocionales
- Haz seguimiento del desarrollo de la relación con ${characterName}
- Mantén la consistencia con conversaciones anteriores
- La información clave debe recordarse naturalmente cuando sea relevante`;

  return {
    type: 'instructions',
    label: 'Instrucciones de memoria',
    content,
    color: SECTION_COLORS.instructions
  };
}

/**
 * Get messages for summarization
 * Returns messages that should be included in summary generation
 * Note: Narrator messages are excluded from summaries
 */
export function getMessagesForSummary(
  messages: ChatMessage[],
  summarySettings: { triggerThreshold: number; keepRecentMessages: number }
): ChatMessage[] {
  // Exclude deleted and narrator messages from summaries
  const visibleMessages = messages.filter(m => !m.isDeleted && !m.isNarratorMessage);

  if (visibleMessages.length <= summarySettings.triggerThreshold) {
    return [];
  }

  // Exclude recent messages that should stay unsummarized
  const messagesToSummarize = visibleMessages.slice(
    0,
    visibleMessages.length - summarySettings.keepRecentMessages
  );

  return messagesToSummarize;
}

/**
 * Format summary with context markers
 */
export function formatSummaryWithContext(summary: SummaryData, totalMessages: number): string {
  const startMsg = summary.messageRange.start + 1;
  const endMsg = summary.messageRange.end + 1;

  return `[Resumen de mensajes ${startMsg}-${endMsg} de ${totalMessages}]\n${summary.content}`;
}

// ============================================
// Quest Section Builder (Pre-LLM Quest Prompts)
// ============================================

// Quest prompt options type
type QuestPromptOptions = {
  questInclude?: boolean;
  questTemplate?: string;
  showKeys?: boolean;
  showProgress?: boolean;
  characterId?: string;
  isForNarrator?: boolean;
  questSettings?: QuestSettings;
  sessionStats?: import('@/types').SessionStats;
};

const DEFAULT_QUEST_PROMPT_OPTIONS: QuestPromptOptions = {
  questInclude: true,
  showKeys: true,
  showProgress: true,
};

type QuestSettings = {
  enabled: boolean;
  promptInclude: boolean;
  promptTemplate: string;
};

/**
 * Build quest prompt section for LLM context
 * This function builds a section that shows active quests with their objectives
 * and progress. and completion keys. the AI can use to progress quests.
 */
export function buildQuestPromptForLLM(
  templates: QuestTemplate[],
  sessionQuests: SessionQuestInstance[],
  options: QuestPromptOptions = DEFAULT_QUEST_PROMPT_OPTIONS,
  keyContext?: KeyResolutionContext
): PromptSection | null {
  // Filter to active quests only
  const activeQuests = sessionQuests.filter(q => q.status === 'active');

  if (activeQuests.length === 0) {
    return null;
  }

  // Get template string from options
  const templateStr = options.questTemplate || '{{activeQuests}}';

  // Build quest section using the handler function
  const questContent = buildQuestPromptSection(
    templates,
    activeQuests,
    templateStr,
    options.characterId,
    options.isForNarrator,
    options.questSettings as any,
    options.sessionStats
  );

  // Resolve keys if keyContext provided
  const resolvedContent = resolveAllKeys(questContent, keyContext);

  // Return as a PromptSection
  return {
    type: 'quest',
    label: 'Active Quests',
    content: resolvedContent,
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
  };
}

/**
 * Prepare quest data for API route
 */
export function prepareQuestDataForAPI(
  questTemplateIds?: string[],
  sessionQuests?: SessionQuestInstance[],
  allTemplates: QuestTemplate[]
): {
  templates: QuestTemplate[],
  sessionQuests: SessionQuestInstance[],
} {
  // Filter templates by questTemplateIds if provided
  let templates = allTemplates;
  if (questTemplateIds && questTemplateIds.length > 0) {
    templates = allTemplates.filter(t => questTemplateIds.includes(t.id));
  }
  
  // Filter session quests
  let sessionQuestsList = sessionQuests || [];
  
  return {
    templates,
    sessionQuests: sessionQuestsList,
  };
}
