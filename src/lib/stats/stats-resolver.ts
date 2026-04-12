// ============================================
// Stats Handler - Pre-LLM resolution of stats keys
// ============================================
//
// This handler resolves {{key}} templates in character content
// and builds blocks for skills/intentions/invitations injection
//
// Keys resolved:
// - {{attributeKey}} → "AttributeName: value" (e.g., {{vida}} → "Vida: 50")
// - {{acciones}} → Block of available skills
// - {{intenciones}} → Block of available intentions
// - {{peticiones}} → Block of available invitations (from target's solicitudes)
// - {{solicitudes}} → Block of received requests

import type {
  CharacterStatsConfig,
  SessionStats,
  CharacterSessionStats,
  AttributeDefinition,
  SkillDefinition,
  IntentionDefinition,
  InvitationDefinition,
  SolicitudDefinition,
  ResolvedStats,
  SolicitudInstance,
  CharacterCard,
  QuestTemplate,
} from '@/types';
import {
  evaluateRequirements,
  filterSkillsByRequirements,
  filterIntentionsByRequirements,
  filterInvitationsByRequirements,
} from '@/store/slices/statsSlice';

// ============================================
// Types
// ============================================

export interface StatsResolutionContext {
  characterId: string;
  statsConfig: CharacterStatsConfig | undefined;
  sessionStats: SessionStats | undefined;
  // For resolving invitations - need access to other characters' solicitudDefinitions
  allCharacters?: CharacterCard[];
  // For resolving {{user}} and {{char}} in descriptions
  userName?: string;
  characterName?: string;
  // For resolving objective names in skill rewards
  questTemplates?: QuestTemplate[];
}

export interface ResolvedAttribute {
  key: string;
  name: string;
  value: number | string;
  formatted: string;
}

// Extended invitation for display (includes data from target's solicitudDefinition)
export interface ResolvedInvitation {
  id: string;
  name: string;
  peticionKey: string;               // Key to ACTIVATE the peticion (used by sender)
  solicitudKey: string;              // Key to COMPLETE the solicitud (used by receiver)
  peticionDescription: string;       // Description shown to SOLICITANTE (who asks)
  solicitudDescription: string;      // Description shown to SOLICITADO (who receives)
  completionDescription?: string;    // Description saved when completed
  targetCharacterId: string;
  targetCharacterName: string;
  solicitudId: string;
}

// ============================================
// Main Resolution Functions
// ============================================

/**
 * Get character session stats
 */
export function getCharacterSessionStats(
  sessionStats: SessionStats | undefined,
  characterId: string
): CharacterSessionStats | null {
  if (!sessionStats?.characterStats?.[characterId]) {
    return null;
  }
  return sessionStats.characterStats[characterId];
}

/**
 * Get attribute value (from session or default)
 */
export function getAttributeValue(
  attribute: AttributeDefinition,
  sessionStats: CharacterSessionStats | null
): number | string {
  if (sessionStats?.attributeValues?.[attribute.key] !== undefined) {
    return sessionStats.attributeValues[attribute.key];
  }
  return attribute.defaultValue;
}

/**
 * Format attribute value for prompt
 * 
 * Format:
 * - Number type: "Nombre: (valor/max)" e.g., "Resistencia física: (40/100)"
 * - Keyword/Text type: "Nombre: valor" e.g., "Detección: mágica"
 * - Custom outputFormat takes precedence if defined
 */
export function formatAttributeValue(
  attribute: AttributeDefinition,
  value: number | string
): string {
  // Use new outputFormat field first (custom format takes precedence)
  if (attribute.outputFormat) {
    return attribute.outputFormat.replace('{value}', String(value));
  }
  // Fallback to legacy keywordFormat for backward compatibility
  if (attribute.keywordFormat) {
    return attribute.keywordFormat.replace('{value}', String(value));
  }
  
  // Default formatting based on attribute type
  const attributeType = attribute.type || 'number';
  
  if (attributeType === 'number') {
    // For numeric attributes, show (current/max) format
    const max = attribute.max ?? 100;
    return `${attribute.name}: (${value}/${max})`;
  } else {
    // For keyword and text types, show just the value
    return `${attribute.name}: ${value}`;
  }
}

/**
 * Resolve a single attribute key
 */
export function resolveAttributeKey(
  key: string,
  statsConfig: CharacterStatsConfig | undefined,
  sessionStats: CharacterSessionStats | null
): string | null {
  if (!statsConfig?.attributes) return null;
  
  const attribute = statsConfig.attributes.find(a => a.key === key);
  if (!attribute) return null;
  
  const value = getAttributeValue(attribute, sessionStats);
  return formatAttributeValue(attribute, value);
}

/**
 * Resolve all attributes for a character
 */
export function resolveAllAttributes(
  statsConfig: CharacterStatsConfig | undefined,
  sessionStats: CharacterSessionStats | null
): ResolvedAttribute[] {
  if (!statsConfig?.attributes) return [];
  
  return statsConfig.attributes.map(attribute => {
    const value = getAttributeValue(attribute, sessionStats);
    return {
      key: attribute.key,
      name: attribute.name,
      value,
      formatted: formatAttributeValue(attribute, value),
    };
  });
}

/**
 * Resolve template keys in text ({{user}}, {{char}}, {{solicitante}}, {{solicitado}})
 * Used to resolve placeholders in descriptions before storing or displaying
 *
 * Key resolution:
 * - {{user}} - The user's name
 * - {{char}} - The current character's name
 * - {{solicitante}} - Who is making the request (the asker)
 * - {{solicitado}} - Who receives the request (the asked)
 */
function resolveTemplateKeys(
  text: string,
  userName?: string,
  characterName?: string,
  solicitanteName?: string,
  solicitadoName?: string
): string {
  if (!text) return text;
  let result = text;
  if (userName) {
    result = result.replace(/\{\{user\}\}/gi, userName);
  }
  if (characterName) {
    result = result.replace(/\{\{char\}\}/gi, characterName);
  }
  if (solicitanteName) {
    result = result.replace(/\{\{solicitante\}\}/gi, solicitanteName);
  }
  if (solicitadoName) {
    result = result.replace(/\{\{solicitado\}\}/gi, solicitadoName);
  }
  return result;
}

/**
 * Find objective name by completion key
 */
function findObjectiveNameByKey(
  objectiveKey: string,
  questTemplates: { objectives?: { completion?: { key?: string; keys?: string[] }; description?: string }[] }[]
): string | null {
  const normalizedKey = objectiveKey.toLowerCase().trim();
  
  for (const template of questTemplates) {
    for (const objective of template.objectives || []) {
      const keys = [
        objective.completion?.key,
        ...(objective.completion?.keys || [])
      ].filter(Boolean);
      
      for (const key of keys) {
        if (key?.toLowerCase().trim() === normalizedKey) {
          return objective.description || null;
        }
      }
    }
  }
  
  return null;
}

/**
 * Build skills/actions block for injection
 *
 * NEW READABLE FORMAT:
 * [ACCIONES DEL PERSONAJE]
 * El personaje puede realizar las siguientes acciones:
 *
 * • Examen psicológico
 *   Tipo: ejecución
  *   Descripción: Sabes aplicar examen psicológico...
  *   Resultado esperado: Completará "Analizar al usuario"
  */
export function buildSkillsBlock(
  skills: SkillDefinition[],
  attributeValues: Record<string, number | string>,
  header: string,
  questTemplates: { objectives?: { completion?: { key?: string; keys?: string[] }; description?: string }[] }[] = [],
  characterName?: string,
  sessionStats?: SessionStats
): string {
  const availableSkills = filterSkillsByRequirements(skills, attributeValues, sessionStats);

  if (availableSkills.length === 0) {
    return '';
  }

  const charName = characterName || '{{char}}';
  const introText = header.includes('ACCIONES') 
    ? `${charName} puede realizar las siguientes acciones cuando la situación lo requiera.\nCuando una acción tenga "Puede completar", USA LA TOOL "manage_quest" o "manage_solicitud" con la key correspondiente para marcar como completado:\n`
    : '';

  const lines: string[] = [header];
  if (introText) {
    lines.push(introText);
  }

  availableSkills.forEach((skill) => {
    // Check for custom inject format first
    if (skill.injectFormat) {
      const formatted = skill.injectFormat
        .replace('{name}', skill.name)
        .replace('{description}', skill.description)
        .replace('{key}', skill.activationKey || skill.key || '');
      lines.push(`- ${formatted}`);
    } else {
      // New readable format
      lines.push(`- Nombre: ${skill.name}`);

      // Type (preparacion/ejecucion)
      if (skill.type) {
        const tipoLabel = skill.type === 'preparacion' ? 'preparación' : 'ejecución';
        lines.push(`  Tipo: ${tipoLabel}`);
      }

      lines.push(`  Descripción: ${skill.description}`);

      // Collect objectives and solicitudes that this skill can complete
      const objectives: string[] = [];
      const solicitudes: string[] = [];
      
      for (const reward of skill.activationRewards || []) {
        if (reward.type === 'objective' && reward.objective?.objectiveKey) {
          const objectiveName = findObjectiveNameByKey(reward.objective.objectiveKey, questTemplates);
          objectives.push(objectiveName || reward.objective.objectiveKey);
        } else if (reward.type === 'solicitud' && reward.solicitud?.solicitudKey) {
          solicitudes.push(reward.solicitud.solicitudName || reward.solicitud.solicitudKey);
        }
      }

      // Build "Puede completar" section
      if (objectives.length > 0 || solicitudes.length > 0) {
        lines.push(`  Puede completar:`);
        for (const obj of objectives) {
          lines.push(`    - Objetivo: ${obj}`);
        }
        for (const sol of solicitudes) {
          lines.push(`    - Solicitud: ${sol}`);
        }
      }
    }
  });

  return lines.join('\n');
}

/**
 * Build intentions block for injection
 *
 * Format (same as skills):
 * 1) Intention Name
 *    - Descripción: description text
 *    - key de activación: activation_key (only if key exists)
 *
 * Numbers are dynamic based on available intentions count.
 */
export function buildIntentionsBlock(
  intentions: IntentionDefinition[],
  attributeValues: Record<string, number | string>,
  header: string,
  sessionStats?: SessionStats
): string {
  const availableIntentions = filterIntentionsByRequirements(intentions, attributeValues, sessionStats);

  if (availableIntentions.length === 0) {
    return '';
  }

  const lines: string[] = [header];

  availableIntentions.forEach((intention, index) => {
    const intentionNumber = index + 1;

    // Check for custom inject format first
    if (intention.injectFormat) {
      const formatted = intention.injectFormat
        .replace('{name}', intention.name)
        .replace('{description}', intention.description)
        .replace('{key}', intention.key || '');
      lines.push(`${intentionNumber}) ${formatted}`);
    } else {
      // Default format with description and activation key
      lines.push(`${intentionNumber}) ${intention.name}`);
      lines.push(`   - Descripción: ${intention.description}`);

      // Show activation key only if it exists
      if (intention.key) {
        lines.push(`   - key de activación: ${intention.key}`);
      }
    }
  });

  return lines.join('\n');
}

/**
 * Build invitations/peticiones block for injection
 *
 * NEW FORMAT - Gets key and description from target's solicitudDefinition:
 * [PETICIONES POSIBLES]
 * - key: pedir_madera
 *   dirigido_a: Carpintero
 *   descripcion: Solicitar madera para construcción
 *
 * The invitation must reference a solicitud from another character.
 * Only shows if the target character meets the requirements of their own solicitud.
 */
export function buildInvitationsBlock(
  invitations: InvitationDefinition[],
  attributeValues: Record<string, number | string>,
  header: string,
  allCharacters?: CharacterCard[],
  sessionStats?: SessionStats,
  userName?: string,
  characterName?: string
): string {
  const availableInvitations = filterInvitationsByRequirements(invitations, attributeValues, sessionStats);

  if (availableInvitations.length === 0) {
    return '';
  }

  const lines: string[] = [header];

  availableInvitations.forEach((invitation) => {
    // Skip if no target configured
    if (!invitation.objetivo?.characterId || !invitation.objetivo?.solicitudId) {
      return;
    }

    // Find target character
    const targetCharacter = allCharacters?.find(c => c.id === invitation.objetivo!.characterId);
    if (!targetCharacter) {
      return;
    }

    // Find the specific solicitud on the target
    const solicitud = targetCharacter.statsConfig?.solicitudDefinitions?.find(
      s => s.id === invitation.objetivo!.solicitudId
    );
    if (!solicitud) {
      return;
    }

    // Check if target character meets the solicitud's requirements
    // (the target needs to have the required attributes to fulfill the request)
    const targetAttributeValues = sessionStats?.characterStats?.[targetCharacter.id]?.attributeValues || {};
    const targetMeetsRequirements = evaluateRequirements(solicitud.requirements, targetAttributeValues);

    if (!targetMeetsRequirements) {
      // Target doesn't meet requirements - don't show this invitation
      return;
    }

    // Resolve keys in description:
    // - {{solicitante}} = characterName (who makes the request - current character)
    // - {{solicitado}} = targetCharacter.name (who receives the request)
    const resolvedDescription = resolveTemplateKeys(
      solicitud.peticionDescription,
      userName,
      characterName,
      characterName,       // solicitante = current character (who asks)
      targetCharacter.name // solicitado = target (who is asked)
    );

    // Use custom inject format if available
    if (invitation.injectFormat) {
      const formatted = invitation.injectFormat
        .replace('{name}', invitation.name)
        .replace('{key}', solicitud.peticionKey)
        .replace('{descripcion}', resolvedDescription)
        .replace('{objetivo}', targetCharacter.name);
      lines.push(formatted);
    } else {
      // New YAML-like format
      lines.push(`- key: ${solicitud.peticionKey}`);
      lines.push(`  dirigido_a: ${targetCharacter.name}`);
      lines.push(`  descripcion: ${resolvedDescription}`);
    }
  });

  // Return empty if no valid invitations after filtering
  if (lines.length === 1) {
    return '';
  }

  return lines.join('\n');
}

/**
 * Resolve invitations to get their actual keys and descriptions
 * (for use in detection system and UI components)
 */
export function resolveInvitations(
  invitations: InvitationDefinition[],
  attributeValues: Record<string, number | string>,
  allCharacters?: CharacterCard[],
  sessionStats?: SessionStats,
  userName?: string,
  characterName?: string
): ResolvedInvitation[] {
  const availableInvitations = filterInvitationsByRequirements(invitations, attributeValues, sessionStats);
  const resolved: ResolvedInvitation[] = [];

  availableInvitations.forEach((invitation) => {
    if (!invitation.objetivo?.characterId || !invitation.objetivo?.solicitudId) {
      return;
    }

    const targetCharacter = allCharacters?.find(c => c.id === invitation.objetivo!.characterId);
    if (!targetCharacter) {
      return;
    }

    const solicitud = targetCharacter.statsConfig?.solicitudDefinitions?.find(
      s => s.id === invitation.objetivo!.solicitudId
    );
    if (!solicitud) {
      return;
    }

    // Check if target meets solicitud requirements
    const targetAttributeValues = sessionStats?.characterStats?.[targetCharacter.id]?.attributeValues || {};
    const targetMeetsRequirements = evaluateRequirements(solicitud.requirements, targetAttributeValues);

    if (!targetMeetsRequirements) {
      return;
    }

    // Resolve keys in peticionDescription (shown to SOLICITANTE - who asks):
    // - {{solicitante}} = characterName (who makes the request - current character)
    // - {{solicitado}} = targetCharacter.name (who receives the request)
    const resolvedPeticionDescription = resolveTemplateKeys(
      solicitud.peticionDescription,
      userName,
      characterName,
      characterName,       // solicitante = current character (who asks)
      targetCharacter.name // solicitado = target (who is asked)
    );

    // Resolve keys in solicitudDescription (shown to SOLICITADO - who receives):
    // - {{solicitante}} = characterName (who makes the request)
    // - {{solicitado}} = targetCharacter.name (current character who receives)
    const resolvedSolicitudDescription = resolveTemplateKeys(
      solicitud.solicitudDescription,
      userName,
      targetCharacter.name,
      characterName,        // solicitante = who makes the request
      targetCharacter.name  // solicitado = who receives
    );

    // Resolve keys in completionDescription (saved when completed):
    const resolvedCompletionDescription = solicitud.completionDescription
      ? resolveTemplateKeys(
          solicitud.completionDescription,
          userName,
          targetCharacter.name,
          characterName,        // solicitante
          targetCharacter.name  // solicitado
        )
      : undefined;

    resolved.push({
      id: invitation.id,
      name: invitation.name,
      peticionKey: solicitud.peticionKey,
      solicitudKey: solicitud.solicitudKey,  // Key for completing the solicitud
      peticionDescription: resolvedPeticionDescription,
      solicitudDescription: resolvedSolicitudDescription,
      completionDescription: resolvedCompletionDescription,
      targetCharacterId: targetCharacter.id,
      targetCharacterName: targetCharacter.name,
      solicitudId: solicitud.id,
    });
  });

  return resolved;
}

/**
 * Build solicitudes block for injection
 *
 * Shows requests received from other characters
 *
 * FORMAT:
 * [SOLICITUDES RECIBIDAS]
 * - key: preparar_troncos
 *   de: Aitana
 *   descripcion: Aitana necesita que dejes listos los troncos de abedul.
 */
export function buildSolicitudesBlock(
  solicitudes: SolicitudInstance[],
  header: string,
  userName?: string,
  characterName?: string
): string {
  // Filter only pending solicitudes
  const pendingSolicitudes = solicitudes.filter(s => s.status === 'pending');

  if (pendingSolicitudes.length === 0) {
    return '';
  }

  const lines: string[] = [header];

  pendingSolicitudes.forEach((solicitud) => {
    // Resolve keys in description:
    // - {{solicitante}} = solicitud.fromCharacterName (who sent the request)
    // - {{solicitado}} = characterName (current character who receives)
    const resolvedDescription = resolveTemplateKeys(
      solicitud.description,
      userName,
      characterName,
      solicitud.fromCharacterName, // solicitante = who sent the request
      characterName                 // solicitado = current character (who receives)
    );
    lines.push(`- key: ${solicitud.key}`);
    lines.push(`  de: ${solicitud.fromCharacterName}`);
    lines.push(`  descripcion: ${resolvedDescription}`);
  });

  return lines.join('\n');
}

/**
 * Full stats resolution for a character
 */
export function resolveStats(
  context: StatsResolutionContext
): ResolvedStats | null {
  const { characterId, statsConfig, sessionStats } = context;
  
  if (!statsConfig || !statsConfig.enabled) {
    return null;
  }
  
  const charStats = getCharacterSessionStats(sessionStats, characterId);
  
  // Resolve all attributes
  const attributes = resolveAllAttributes(statsConfig, charStats);
  const attributeValues = charStats?.attributeValues || 
    Object.fromEntries(
      statsConfig.attributes.map(a => [a.key, a.defaultValue])
    );
  
  // Build attribute map for template resolution
  const attributesMap: Record<string, string> = {};
  for (const attr of attributes) {
    attributesMap[attr.key] = attr.formatted;
  }
  
  // Build blocks
  const skillsBlock = buildSkillsBlock(
    statsConfig.skills,
    attributeValues,
    statsConfig.blockHeaders.skills,
    context.questTemplates || [],
    context.characterName,
    sessionStats
  );
  
  const intentionsBlock = buildIntentionsBlock(
    statsConfig.intentions,
    attributeValues,
    statsConfig.blockHeaders.intentions,
    sessionStats
  );
  
  const invitationsBlock = buildInvitationsBlock(
    statsConfig.invitations,
    attributeValues,
    statsConfig.blockHeaders.invitations,
    context.allCharacters,
    sessionStats,
    context.userName,
    context.characterName
  );

  // Build solicitudes block (requests received from other characters)
  const solicitudes = sessionStats?.solicitudes?.characterSolicitudes?.[characterId] || [];
  const solicitudesBlock = buildSolicitudesBlock(
    solicitudes,
    statsConfig.blockHeaders?.solicitudesRecibidas || '[SOLICITUDES RECIBIDAS]',
    context.userName,
    context.characterName
  );

  // Filter available items
  const availableSkills = filterSkillsByRequirements(statsConfig.skills, attributeValues, sessionStats);
  const availableIntentions = filterIntentionsByRequirements(statsConfig.intentions, attributeValues, sessionStats);
  const availableInvitations = filterInvitationsByRequirements(statsConfig.invitations, attributeValues, sessionStats);

  return {
    attributes: attributesMap,
    availableSkills,
    availableIntentions,
    availableInvitations,
    availableSolicitudes: solicitudes.filter(s => s.status === 'pending'),
    skillsBlock,
    intentionsBlock,
    invitationsBlock,
    solicitudesBlock,
  };
}

// ============================================
// Template Resolution
// ============================================

/**
 * Regex pattern for stats keys
 * Matches {{key}} where key is alphanumeric with underscores
 */
const STATS_KEY_PATTERN = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;

/**
 * Check if a key is a block key (acciones, habilidades, intenciones, invitaciones, peticiones, solicitudes)
 * Also accepts alternate spellings for backward compatibility
 */
export function isBlockKey(key: string): boolean {
  return key === 'acciones' || key === 'habilidades' || 
         key === 'intenciones' || key === 'intensiones' || 
         key === 'invitaciones' || key === 'peticiones' || 
         key === 'solicitudes';
}

/**
 * Resolve all stats keys in a text
 */
export function resolveStatsInText(
  text: string,
  resolvedStats: ResolvedStats | null
): string {
  return text.replace(STATS_KEY_PATTERN, (match, key) => {
    // Block keys (acciones, habilidades, intenciones, invitaciones, peticiones, solicitudes)
    // Return empty string if stats disabled, empty, or no items available
    // Support both {{acciones}} (new) and {{habilidades}} (legacy)
    if (key === 'acciones' || key === 'habilidades') {
      return resolvedStats?.skillsBlock ?? '';
    }
    // Accept both "intenciones" (correct Spanish) and "intensiones" (typo, for backward compatibility)
    if (key === 'intenciones' || key === 'intensiones') {
      return resolvedStats?.intentionsBlock ?? '';
    }
    // Support both {{peticiones}} (new) and {{invitaciones}} (legacy)
    if (key === 'peticiones' || key === 'invitaciones') {
      return resolvedStats?.invitationsBlock ?? '';
    }
    // New {{solicitudes}} key - requests received from other characters
    if (key === 'solicitudes') {
      return resolvedStats?.solicitudesBlock ?? '';
    }

    // Attribute keys - only replace if defined in stats config
    // If stats are disabled or attribute not defined, leave the key alone
    if (resolvedStats?.attributes && key in resolvedStats.attributes) {
      return resolvedStats.attributes[key];
    }

    // Unknown key - leave it alone (might be handled by other template systems)
    return match;
  });
}

/**
 * Get all stats keys from a text
 */
export function extractStatsKeys(text: string): string[] {
  const keys: string[] = [];
  let match;
  
  const pattern = new RegExp(STATS_KEY_PATTERN.source, 'g');
  
  while ((match = pattern.exec(text)) !== null) {
    if (!keys.includes(match[1])) {
      keys.push(match[1]);
    }
  }
  
  return keys;
}

/**
 * Check if text contains stats keys
 */
export function hasStatsKeys(text: string): boolean {
  STATS_KEY_PATTERN.lastIndex = 0;
  return STATS_KEY_PATTERN.test(text);
}

// ============================================
// Prompt Section Builder
// ============================================

/**
 * Build prompt sections from resolved stats
 */
export function buildStatsPromptSections(
  resolvedStats: ResolvedStats | null,
  characterName: string
): Array<{ type: string; label: string; content: string; color: string }> {
  if (!resolvedStats) return [];
  
  const sections: Array<{ type: string; label: string; content: string; color: string }> = [];
  
  // Add attributes section if there are any
  const attrValues = Object.values(resolvedStats.attributes);
  if (attrValues.length > 0) {
    sections.push({
      type: 'stats',
      label: `${characterName} Stats`,
      content: attrValues.join('\n'),
      color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    });
  }
  
  // Add skills block if available
  if (resolvedStats.skillsBlock) {
    sections.push({
      type: 'skills',
      label: 'Habilidades',
      content: resolvedStats.skillsBlock,
      color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    });
  }
  
  // Add intentions block if available
  if (resolvedStats.intentionsBlock) {
    sections.push({
      type: 'intentions',
      label: 'Intenciones',
      content: resolvedStats.intentionsBlock,
      color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    });
  }
  
  // Add invitations block if available
  if (resolvedStats.invitationsBlock) {
    sections.push({
      type: 'invitations',
      label: 'Invitaciones',
      content: resolvedStats.invitationsBlock,
      color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
    });
  }
  
  return sections;
}
