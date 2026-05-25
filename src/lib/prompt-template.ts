/**
 * Prompt Template Utilities
 * Handles variable replacement for SillyTavern-style templates
 * 
 * Supported variables:
 * - {{user}} - User's name (from active persona)
 * - {{char}} - Character's name
 * - {{userpersona}} - User's persona description
 * - {{#if condition}}...{{/if}} - Conditional blocks (basic support)
 * 
 * Supported example dialogue format:
 * - <START> - Marks the beginning of an example dialogue block
 * - {{user}}: - User's dialogue line
 * - {{char}}: - Character's dialogue line
 * - Multi-turn conversations are preserved in their natural order
 */

import type { CharacterCard, Persona } from '@/types';
import type { ChatApiMessage } from '@/lib/llm/types';

export interface TemplateContext {
  user: string;
  char: string;
  userpersona?: string;
  character?: CharacterCard;
  persona?: Persona;
}

/**
 * Replace template variables in a string
 */
export function replaceTemplateVariables(
  text: string, 
  context: TemplateContext
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

  return result;
}

/**
 * Process conditional blocks {{#if var}}...{{/if}}
 */
function processConditionals(text: string, context: TemplateContext): string {
  // Handle {{#if variable}}content{{/if}}
  const conditionalRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/gi;
  
  return text.replace(conditionalRegex, (_, varName, content) => {
    const value = getVariableValue(varName.toLowerCase(), context);
    return value ? content : '';
  });
}

/**
 * Get variable value by name
 */
function getVariableValue(varName: string, context: TemplateContext): string | undefined {
  switch (varName) {
    case 'user':
      return context.user;
    case 'char':
      return context.char;
    case 'userpersona':
      return context.userpersona;
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

/**
 * Process example dialogue with SillyTavern-style formatting
 * 
 * Parses <START>-delimited blocks and preserves the natural conversation flow.
 * Speaker labels ({{user}}/{{char}}) are kept as-is for later key resolution.
 * 
 * Input:
 * <START>
 * {{user}}: Hello, how are you?
 * {{char}}: "I'm doing great, thank you for asking!"
 * {{user}}: That's nice!
 * {{char}}: *smiles*
 * <START>
 * {{user}}: Tell me about yourself.
 * {{char}}: Well, I'm...
 * 
 * Output (preserves turn-by-turn flow):
 * {{user}}: Hello, how are you?
 * 
 * {{char}}: "I'm doing great, thank you for asking!"
 * 
 * {{user}}: That's nice!
 * 
 * {{char}}: *smiles*
 * 
 * {{user}}: Tell me about yourself.
 * 
 * {{char}}: Well, I'm...
 * 
 * Key resolution ({{user}} → actual name, etc.) happens later in resolveAllKeys().
 */
export function processExampleDialogue(
  mesExample: string,
  userName: string,
  charName: string
): string {
  if (!mesExample || !mesExample.trim()) {
    return '';
  }

  // NOTE: We do NOT replace {{user}}/{{char}} here anymore.
  // Template variable resolution is handled by resolveAllKeys() which runs
  // AFTER this function via resolveSectionsKeys() in buildSystemPrompt().
  // This ensures that ALL template variables ({{user}}, {{char}}, {{stats}},
  // {{descripcion}}, {{activeQuests}}, etc.) are resolved consistently
  // in one place, including lorebook attribute keys.
  let processed = mesExample;

  // Split by <START> tags (case-insensitive)
  const blocks = processed.split(/<START>/gi).filter(block => block.trim());
  
  if (blocks.length === 0) {
    // No <START> tags found, return as-is (variables will be resolved later)
    return processed.trim();
  }

  // Process each block preserving the natural conversation flow
  const formattedBlocks: string[] = [];
  
  for (const block of blocks) {
    const trimmedBlock = block.trim();
    if (!trimmedBlock) continue;
    
    const result = formatDialogueBlock(trimmedBlock, userName, charName);
    if (result) {
      formattedBlocks.push(result);
    }
  }
  
  return formattedBlocks.join('\n\n');
}

/**
 * Parse example dialogue into chat messages for injection into conversation history.
 * This is the SillyTavern approach: example dialogue becomes actual user/assistant
 * message pairs placed before the real chat history.
 *
 * Each <START> block is parsed into separate user/assistant message pairs.
 * Speaker prefixes ({{user}}:/{{char}}:) are STRIPPED from the content since
 * the role already indicates who's speaking.
 *
 * Template variables ({{user}}, {{char}}) are resolved immediately since these
 * messages bypass the section-based key resolution pipeline.
 */
export function parseExampleDialogueToMessages(
  mesExample: string,
  userName: string,
  charName: string
): ChatApiMessage[] {
  if (!mesExample || !mesExample.trim()) {
    return [];
  }

  // Split by <START> tags (case-insensitive)
  const blocks = mesExample.split(/<START>/gi).filter(block => block.trim());

  if (blocks.length === 0) {
    // No <START> tags found, try to parse the whole text as one block
    return parseDialogueBlockToMessages(mesExample.trim(), userName, charName);
  }

  const messages: ChatApiMessage[] = [];
  for (const block of blocks) {
    const trimmedBlock = block.trim();
    if (!trimmedBlock) continue;
    const blockMessages = parseDialogueBlockToMessages(trimmedBlock, userName, charName);
    messages.push(...blockMessages);
  }

  return messages;
}

/**
 * Parse a single dialogue block (content between <START> tags) into chat messages.
 * Speaker prefixes are stripped — the role field carries that information.
 * Continuation lines (no speaker prefix after a speaker line) are appended
 * to the previous message with a newline.
 * Lines without a speaker prefix at the start of a block become system messages
 * (narrative/context).
 */
function parseDialogueBlockToMessages(
  block: string,
  userName: string,
  charName: string
): ChatApiMessage[] {
  const lines = block.split('\n');
  const userPattern = new RegExp(`^(\\{\\{user\\}\\}|${escapeRegExp(userName)})\\s*:\\s*(.*)`, 'i');
  const charPattern = new RegExp(`^(\\{\\{char\\}\\}|${escapeRegExp(charName)})\\s*:\\s*(.*)`, 'i');

  const messages: ChatApiMessage[] = [];
  let lastRole: 'user' | 'assistant' | 'system' | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const userMatch = line.match(userPattern);
    const charMatch = line.match(charPattern);

    if (userMatch) {
      // Strip speaker prefix, keep only the content after the colon
      let content = userMatch[2];
      // Resolve template variables immediately
      content = content.replace(/\{\{user\}\}/gi, userName).replace(/\{\{char\}\}/gi, charName);
      messages.push({ role: 'user', content });
      lastRole = 'user';
    } else if (charMatch) {
      let content = charMatch[2];
      content = content.replace(/\{\{user\}\}/gi, userName).replace(/\{\{char\}\}/gi, charName);
      messages.push({ role: 'assistant', content });
      lastRole = 'assistant';
    } else if (lastRole && messages.length > 0) {
      // Continuation line — append to previous message (preserving same speaker)
      let content = line;
      content = content.replace(/\{\{user\}\}/gi, userName).replace(/\{\{char\}\}/gi, charName);
      messages[messages.length - 1].content += '\n' + content;
      // DON'T reset lastSpeaker - continuation lines belong to the same speaker
    } else {
      // No speaker identified yet — narrative/context line
      let content = line;
      content = content.replace(/\{\{user\}\}/gi, userName).replace(/\{\{char\}\}/gi, charName);
      messages.push({ role: 'system', content });
      lastRole = 'system';
    }
  }

  return messages;
}

/**
 * Format a single dialogue block, preserving the natural turn-by-turn flow.
 *
 * Handles these formats:
 * 1. {{user}}: line / {{char}}: line — Standard speaker-labeled dialogue
 * 2. Lines without speaker prefix — Treated as narrative/context, attached to previous speaker or standalone
 *
 * The output preserves the original speaker labels ({{user}}/{{char}}) since
 * key resolution happens later via resolveAllKeys().
 *
 * Output format preserves the natural conversation flow:
 *   {{user}}: Hola
 *   {{char}}: ¡Hola! ¿Cómo estás?
 *   {{user}}: Bien, ¿y tú?
 *   {{char}}: ¡Genial!
 */
function formatDialogueBlock(
  block: string,
  userName: string,
  charName: string
): string {
  const lines = block.split('\n');
  
  // Regex to match "{{user}}: content" or "{{char}}: content" pattern
  // Also match the already-replaced forms (userName/charName) for backward compat
  const userPattern = new RegExp(`^(\\{\\{user\\}\\}|${escapeRegExp(userName)})\\s*:\\s*(.*)`, 'i');
  const charPattern = new RegExp(`^(\\{\\{char\\}\\}|${escapeRegExp(charName)})\\s*:\\s*(.*)`, 'i');
  
  interface DialogueLine {
    speaker: 'user' | 'char' | 'narrative';
    content: string;  // Full line including speaker prefix
  }
  
  const dialogueLines: DialogueLine[] = [];
  let lastSpeaker: 'user' | 'char' | null = null;
  
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    
    const userMatch = line.match(userPattern);
    const charMatch = line.match(charPattern);
    
    if (userMatch) {
      dialogueLines.push({ speaker: 'user', content: line });
      lastSpeaker = 'user';
    } else if (charMatch) {
      dialogueLines.push({ speaker: 'char', content: line });
      lastSpeaker = 'char';
    } else if (lastSpeaker && dialogueLines.length > 0) {
      // Continuation of previous speaker's line (multi-line dialogue)
      dialogueLines[dialogueLines.length - 1].content += '\n' + line;
    } else {
      // No speaker identified yet — narrative/context line
      dialogueLines.push({ speaker: 'narrative', content: line });
    }
  }
  
  if (dialogueLines.length === 0) return '';
  
  // Build the formatted block preserving the natural conversation order
  const parts: string[] = [];
  let currentGroup: DialogueLine[] = [];
  let currentGroupSpeaker: 'user' | 'char' | 'narrative' | null = null;
  
  function flushGroup() {
    if (currentGroup.length === 0) return;
    
    if (currentGroupSpeaker === 'narrative') {
      // Narrative lines go as-is
      parts.push(currentGroup.map(l => l.content).join('\n'));
    } else {
      // Speaker lines — keep the natural format with speaker labels
      parts.push(currentGroup.map(l => l.content).join('\n'));
    }
    
    currentGroup = [];
    currentGroupSpeaker = null;
  }
  
  for (const dl of dialogueLines) {
    // Group consecutive lines from the same speaker
    if (dl.speaker !== currentGroupSpeaker) {
      flushGroup();
    }
    currentGroup.push(dl);
    currentGroupSpeaker = dl.speaker;
  }
  flushGroup();
  
  return parts.join('\n\n');
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if a text contains <START>-formatted dialogue.
 * Used to detect if a lorebook entry uses the example dialogue format
 * and needs special formatting.
 */
export function containsStartDialogue(text: string): boolean {
  if (!text || !text.trim()) return false;
  return /<START>/gi.test(text);
}

/**
 * Process <START>-formatted dialogue in a lorebook entry or any text.
 * Reuses the same formatting logic as processExampleDialogue but for
 * arbitrary text content.
 * 
 * If the text doesn't contain <START> tags, returns it as-is.
 */
export function processStartDialogueInText(
  text: string,
  userName: string,
  charName: string
): string {
  if (!text || !text.trim()) return text;
  if (!containsStartDialogue(text)) return text;
  
  return processExampleDialogue(text, userName, charName);
}

/**
 * Process all character text fields with template replacement
 */
export function processCharacterTemplate(
  character: CharacterCard, 
  userName: string = 'User',
  persona?: Persona
): CharacterCard {
  const context: TemplateContext = {
    user: userName,
    char: character.name,
    userpersona: persona?.description,
    character,
    persona
  };

  return {
    ...character,
    description: replaceTemplateVariables(character.description, context),
    personality: replaceTemplateVariables(character.personality, context),
    scenario: replaceTemplateVariables(character.scenario, context),
    firstMes: replaceTemplateVariables(character.firstMes, context),
    mesExample: replaceTemplateVariables(character.mesExample, context),
    systemPrompt: replaceTemplateVariables(character.systemPrompt, context),
    postHistoryInstructions: replaceTemplateVariables(character.postHistoryInstructions, context),
    characterNote: replaceTemplateVariables(character.characterNote, context),
    authorNote: replaceTemplateVariables(character.authorNote, context),
    // Process alternate greetings
    alternateGreetings: character.alternateGreetings.map(greeting => 
      replaceTemplateVariables(greeting, context)
    )
  };
}

/**
 * Process a single message with template replacement
 */
export function processMessageTemplate(
  message: string,
  characterName: string,
  userName: string = 'User'
): string {
  const context: TemplateContext = {
    user: userName,
    char: characterName
  };

  return replaceTemplateVariables(message, context);
}

/**
 * Build context from store state
 */
export function buildTemplateContext(
  character: CharacterCard,
  persona?: Persona
): TemplateContext {
  return {
    user: persona?.name || 'User',
    char: character.name,
    userpersona: persona?.description,
    character,
    persona
  };
}
