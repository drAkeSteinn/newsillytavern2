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
 */

import type { CharacterCard, Persona } from '@/types';

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
 * Converts <START> blocks into formatted instruction/response pairs:
 * 
 * Input:
 * <START>
 * {{user}}: Hello, how are you?
 * {{char}}: "I'm doing great, thank you for asking!"
 * <START>
 * 
 * Output:
 * ### Instruction:
 * userName: Hello, how are you?
 * 
 * ### Response:
 * charName: "I'm doing great, thank you for asking!"
 * 
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

  // Split by <START> tags
  const blocks = processed.split(/<START>/gi).filter(block => block.trim());
  
  if (blocks.length === 0) {
    // No <START> tags found, return as-is (variables will be resolved later)
    return processed.trim();
  }

  // Process each block into formatted instruction/response pairs
  const formattedBlocks: string[] = [];
  
  for (const block of blocks) {
    const trimmedBlock = block.trim();
    if (!trimmedBlock) continue;
    
    const lines = trimmedBlock.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) continue;
    
    const userLines: string[] = [];
    const charLines: string[] = [];
    const otherLines: string[] = [];  // Lines that aren't "Name: content" dialogue
    
    // Regex to match "{{user}}: content" or "{{char}}: content" pattern
    // Also match the already-replaced forms (userName/charName) for backward compat
    const userPattern = new RegExp(`^(\\{\\{user\\}\\}|${escapeRegExp(userName)})\\s*:\\s*(.*)`, 'i');
    const charPattern = new RegExp(`^(\\{\\{char\\}\\}|${escapeRegExp(charName)})\\s*:\\s*(.*)`, 'i');
    
    let lastSpeaker: 'user' | 'char' | null = null;
    
    for (const line of lines) {
      const userMatch = line.match(userPattern);
      const charMatch = line.match(charPattern);
      
      if (userMatch) {
        userLines.push(line.trim());
        lastSpeaker = 'user';
      } else if (charMatch) {
        charLines.push(line.trim());
        lastSpeaker = 'char';
      } else if (lastSpeaker) {
        // Continuation of previous line (multi-line dialogue or narrative)
        if (lastSpeaker === 'user') {
          userLines[userLines.length - 1] += '\n' + line.trim();
        } else {
          charLines[charLines.length - 1] += '\n' + line.trim();
        }
      } else {
        // No speaker identified yet - this is a narrative/action line or key content
        // Keep it as context before the dialogue
        otherLines.push(line.trim());
      }
    }
    
    // Format the block
    if (userLines.length > 0 || charLines.length > 0 || otherLines.length > 0) {
      let formattedBlock = '';
      
      // Narrative/context lines first
      if (otherLines.length > 0) {
        formattedBlock += otherLines.join('\n') + '\n\n';
      }
      
      if (userLines.length > 0) {
        formattedBlock += `### Instruction:\n${userLines.join('\n')}\n\n`;
      }
      
      if (charLines.length > 0) {
        formattedBlock += `### Response:\n${charLines.join('\n')}`;
      }
      
      formattedBlocks.push(formattedBlock);
    }
  }
  
  return formattedBlocks.join('\n\n');
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
