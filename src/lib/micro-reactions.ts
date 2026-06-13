// ============================================
// Micro-Reactions Utility
// FASE 4: Group chat micro-reactions system
// ============================================
//
// After a character speaks in a group chat, other characters
// can have brief, non-verbal reactions based on:
// - Being mentioned by name
// - Emotional relevance (basic keyword matching)
// - Topic relevance
//
// Reactions are short: *suspira*, *sonríe*, *frunce el ceño*, etc.

import type { CharacterCard, MicroReaction, MicroReactionConfig, DEFAULT_MICRO_REACTION_CONFIG } from '@/types';

// Pool of possible reactions by emotional category
const REACTION_POOL = {
  positive: ['*sonríe*', '*asiente*', '*se relaja*', '*ríe suavemente*', '*levanta una ceja con interés*'],
  negative: ['*frunce el ceño*', '*suspira*', '*se cruza de brazos*', '*mira con desconfianza*', '*niega con la cabeza*'],
  surprised: ['*parpadea*', '*abre los ojos con sorpresa*', '*se sobresalta*', '*levanta la vista*'],
  neutral: ['*mira hacia otro lado*', '*bosteza*', '*se ajusta la ropa*', '*toca sus dedos*'],
  concerned: ['*se muerde el labio*', '*inclina la cabeza*', '*se acerca un poco*', '*frunce la nariz*'],
};

// Emotional keywords for basic detection
const EMOTIONAL_KEYWORDS: Record<keyof typeof REACTION_POOL, string[]> = {
  positive: ['feliz', 'contento', 'genial', 'maravilloso', 'amor', 'cariño', 'bien', 'perfecto', 'jaja', 'jeje', 'risa', 'alegría', 'excelente', 'fantástico', 'hermoso'],
  negative: ['odio', 'molesto', 'enojado', 'furioso', 'terrible', 'horrible', 'malo', 'no puedo', 'nunca', 'detesto', 'asco', 'estúpido', 'maldito'],
  surprised: ['¡qué!', 'increíble', 'no puede ser', 'sorpresa', '¡wow!', 'inesperado', 'impresionante', '¡what!', 'inesperadamente'],
  neutral: [],  // Default category
  concerned: ['preocupado', 'peligro', 'cuidado', 'ten cuidado', 'ayuda', 'no sé', 'miedo', 'temor', 'ansioso'],
};

/**
 * Detect if a character is mentioned in a message
 */
function isCharacterMentioned(characterName: string, messageContent: string): boolean {
  const lowerContent = messageContent.toLowerCase();
  const lowerName = characterName.toLowerCase();
  
  // Check full name and common short forms
  if (lowerContent.includes(lowerName)) return true;
  
  // Check first name only (if multi-word name)
  const firstName = lowerName.split(' ')[0];
  if (firstName.length > 2 && lowerContent.includes(firstName)) return true;
  
  // Check nicknames/aliases (common patterns)
  const nameWithoutArticles = lowerName.replace(/^(el |la |los |las |del |de )/g, '');
  if (nameWithoutArticles !== lowerName && lowerContent.includes(nameWithoutArticles)) return true;
  
  return false;
}

/**
 * Detect basic emotional tone of a message
 */
function detectEmotionalTone(content: string): keyof typeof REACTION_POOL {
  const lowerContent = content.toLowerCase();
  
  let maxScore = 0;
  let dominantEmotion: keyof typeof REACTION_POOL = 'neutral';
  
  for (const [emotion, keywords] of Object.entries(EMOTIONAL_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (lowerContent.includes(keyword)) score++;
    }
    if (score > maxScore) {
      maxScore = score;
      dominantEmotion = emotion as keyof typeof REACTION_POOL;
    }
  }
  
  return dominantEmotion;
}

/**
 * Generate micro-reactions for a group chat message
 * 
 * @param speakerId - The character who just spoke
 * @param speakerName - The name of the character who spoke
 * @param messageContent - The content of the message
 * @param otherCharacters - Other characters in the group who could react
 * @param config - Micro-reaction configuration
 * @returns Array of micro-reactions
 */
export function generateMicroReactions(
  speakerId: string,
  speakerName: string,
  messageContent: string,
  otherCharacters: CharacterCard[],
  config?: MicroReactionConfig,
): MicroReaction[] {
  if (!config?.enabled) return [];
  if (otherCharacters.length === 0) return [];
  
  const reactions: MicroReaction[] = [];
  const maxReactions = config.maxReactionsPerMessage ?? 2;
  const chance = config.reactionChance ?? 0.3;
  const triggers = config.triggers ?? ['mention', 'emotional'];
  
  const emotionalTone = detectEmotionalTone(messageContent);
  
  // Shuffle other characters for randomness
  const shuffled = [...otherCharacters].sort(() => Math.random() - 0.5);
  
  for (const character of shuffled) {
    if (reactions.length >= maxReactions) break;
    if (character.id === speakerId) continue;
    
    let shouldReact = false;
    let reactionTrigger: MicroReaction['trigger'] = 'topic';
    
    // Check mention trigger
    if (triggers.includes('mention') && isCharacterMentioned(character.name, messageContent)) {
      shouldReact = true;
      reactionTrigger = 'mention';
    }
    
    // Check emotional trigger
    if (!shouldReact && triggers.includes('emotional') && emotionalTone !== 'neutral') {
      // Higher chance for emotional content
      if (Math.random() < chance * 1.5) {
        shouldReact = true;
        reactionTrigger = 'emotional';
      }
    }
    
    // Check topic trigger (random baseline)
    if (!shouldReact && triggers.includes('topic')) {
      if (Math.random() < chance * 0.5) {
        shouldReact = true;
        reactionTrigger = 'topic';
      }
    }
    
    if (shouldReact) {
      // Pick a reaction from the pool based on emotional tone
      const pool = REACTION_POOL[emotionalTone] || REACTION_POOL.neutral;
      const reaction = pool[Math.floor(Math.random() * pool.length)];
      
      reactions.push({
        characterId: character.id,
        characterName: character.name,
        reaction,
        trigger: reactionTrigger,
        timestamp: new Date().toISOString(),
      });
    }
  }
  
  return reactions;
}
