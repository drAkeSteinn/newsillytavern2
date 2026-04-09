// ============================================
// Mention Detection System for Groups
// ============================================

import type { CharacterCard, CharacterGroup, GroupMember, MentionDetectionResult, GroupActivationStrategy } from '@/types';

interface CharacterWithMentions {
  character: CharacterCard;
  member?: GroupMember;
  aliases: string[];
  pronouns: string[];
}

/**
 * Extract mention triggers from a character
 */
export function extractCharacterTriggers(character: CharacterCard): {
  aliases: string[];
  pronouns: string[];
} {
  const aliases: string[] = [];
  const pronouns: string[] = [];

  // Extract from description/personality for pronouns
  const text = `${character.description} ${character.personality}`.toLowerCase();
  
  // Common pronoun patterns
  if (text.includes('she/her') || text.includes('she is') || text.includes('her ')) {
    pronouns.push('she', 'her', 'hers', 'herself');
  }
  if (text.includes('he/him') || text.includes('he is') || text.includes('him ')) {
    pronouns.push('he', 'him', 'his', 'himself');
  }
  if (text.includes('they/them') || text.includes('they are')) {
    pronouns.push('they', 'them', 'their', 'theirs', 'themself');
  }
  if (text.includes('it/its')) {
    pronouns.push('it', 'its', 'itself');
  }

  // Extract aliases from character name (shortened versions, nicknames)
  const name = character.name.trim();
  if (name.includes(' ')) {
    // Add first name only if character has multiple names
    const firstName = name.split(' ')[0];
    if (firstName.length > 2) {
      aliases.push(firstName);
    }
  }

  // Add lowercase version of name for matching
  aliases.push(name.toLowerCase());

  return { aliases, pronouns };
}

/**
 * Detect mentions of characters in a message
 */
export function detectMentions(
  message: string,
  characters: CharacterCard[],
  group: CharacterGroup
): MentionDetectionResult[] {
  const results: MentionDetectionResult[] = [];
  const messageLower = message.toLowerCase();
  
  // Build character trigger map
  const characterTriggers = new Map<string, CharacterWithMentions>();
  
  for (const character of characters) {
    const member = group.members?.find(m => m.characterId === character.id);
    const triggers = extractCharacterTriggers(character);
    
    characterTriggers.set(character.id, {
      character,
      member,
      aliases: triggers.aliases,
      pronouns: triggers.pronouns
    });
  }

  // Check for each character
  for (const [characterId, data] of characterTriggers) {
    const { character, aliases, pronouns } = data;
    
    // Check for name mention (exact match with word boundaries)
    const nameRegex = new RegExp(`\\b${escapeRegex(character.name)}\\b`, 'gi');
    const nameMatch = messageLower.match(nameRegex);
    if (nameMatch) {
      results.push({
        characterId,
        characterName: character.name,
        triggerType: 'name',
        matchedText: nameMatch[0],
        position: messageLower.indexOf(nameMatch[0])
      });
      continue;
    }

    // Check aliases
    for (const alias of aliases) {
      const aliasRegex = new RegExp(`\\b${escapeRegex(alias)}\\b`, 'i');
      if (aliasRegex.test(messageLower)) {
        results.push({
          characterId,
          characterName: character.name,
          triggerType: 'alias',
          matchedText: alias,
          position: messageLower.search(aliasRegex)
        });
        break;
      }
    }

    // Check additional mention triggers from group settings
    if (group.mentionTriggers && group.mentionTriggers.length > 0) {
      for (const trigger of group.mentionTriggers) {
        if (messageLower.includes(trigger.toLowerCase())) {
          // This is a keyword trigger, doesn't map to specific character
          // Could be used for "everyone" mentions
          if (trigger.toLowerCase() === 'everyone' || trigger.toLowerCase() === 'all') {
            // Add all active members
            for (const [cid, cdata] of characterTriggers) {
              if (cdata.member?.isActive !== false) {
                results.push({
                  characterId: cid,
                  characterName: cdata.character.name,
                  triggerType: 'keyword',
                  matchedText: trigger,
                  position: messageLower.indexOf(trigger.toLowerCase())
                });
              }
            }
          }
        }
      }
    }
  }

  // Remove duplicates (same character mentioned multiple ways)
  const uniqueResults = results.filter((result, index, self) =>
    index === self.findIndex(r => r.characterId === result.characterId)
  );

  return uniqueResults;
}

/**
 * Determine which characters should respond based on strategy and mentions
 */
export function determineResponders(
  message: string,
  characters: CharacterCard[],
  group: CharacterGroup,
  lastResponderId?: string
): CharacterCard[] {
  const strategy = group.activationStrategy;
  const maxResponses = group.maxResponsesPerTurn || 3;
  
  // Get active members
  const activeMembers = group.members?.filter(m => m.isActive && m.isPresent !== false) || [];
  const activeCharacterIds = activeMembers.map(m => m.characterId);
  
  // If no members defined, use characterIds
  const eligibleIds = activeCharacterIds.length > 0 
    ? activeCharacterIds 
    : (group.characterIds || []);
  
  const eligibleCharacters = characters.filter(c => eligibleIds.includes(c.id));

  if (eligibleCharacters.length === 0) {
    return [];
  }

  switch (strategy) {
    case 'all':
      // All active members respond (no limit)
      return eligibleCharacters;

    case 'reactive':
      // Only mentioned characters respond
      const mentions = detectMentions(message, characters, group);
      const mentionedIds = mentions.map(m => m.characterId);
      const mentionedCharacters = eligibleCharacters.filter(c => mentionedIds.includes(c.id));
      
      // If no one mentioned, no one responds (or could default to first character)
      return mentionedCharacters;

    case 'round_robin':
      // Take turns in order
      const sortedMembers = [...activeMembers].sort((a, b) => a.joinOrder - b.joinOrder);
      const sortedIds = sortedMembers.length > 0 
        ? sortedMembers.map(m => m.characterId)
        : eligibleIds;
      
      // Find position of last responder
      let nextIndex = 0;
      if (lastResponderId) {
        const lastIndex = sortedIds.indexOf(lastResponderId);
        if (lastIndex !== -1) {
          nextIndex = (lastIndex + 1) % sortedIds.length;
        }
      }
      
      const roundRobinChar = characters.find(c => c.id === sortedIds[nextIndex]);
      return roundRobinChar ? [roundRobinChar] : [];

    case 'random':
      // Random selection
      const shuffled = [...eligibleCharacters].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, Math.min(maxResponses, shuffled.length));

    case 'smart':
      // AI-like decision: mentioned characters + contextually relevant
      const smartMentions = detectMentions(message, characters, group);
      const smartMentionedIds = smartMentions.map(m => m.characterId);
      const smartMentionedChars = eligibleCharacters.filter(c => smartMentionedIds.includes(c.id));
      
      // Add contextually relevant characters based on message content
      const remainingChars = eligibleCharacters.filter(c => !smartMentionedIds.includes(c.id));
      const additionalCount = Math.max(0, Math.min(maxResponses - smartMentionedChars.length, 2));
      
      // Simple relevance: check if character name/description keywords appear
      const relevantChars = remainingChars.filter(c => {
        const keywords = c.tags.concat(c.name.toLowerCase().split(' '));
        return keywords.some(kw => message.toLowerCase().includes(kw.toLowerCase()));
      }).slice(0, additionalCount);
      
      return [...smartMentionedChars, ...relevantChars].slice(0, maxResponses);

    default:
      return eligibleCharacters.slice(0, maxResponses);
  }
}

/**
 * Helper function to escape regex special characters
 */
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a context string showing which character was mentioned
 */
export function buildMentionContext(
  mentions: MentionDetectionResult[],
  characters: CharacterCard[]
): string {
  if (mentions.length === 0) return '';

  const parts: string[] = ['[The following characters were mentioned:'];
  
  for (const mention of mentions) {
    const char = characters.find(c => c.id === mention.characterId);
    if (char) {
      parts.push(`- ${char.name} (via ${mention.triggerType}: "${mention.matchedText}")`);
    }
  }
  
  parts.push(']');
  return parts.join('\n');
}

/**
 * Format character name for chat display
 */
export function formatCharacterName(character: CharacterCard): string {
  return character.name.trim();
}

/**
 * Check if a message directly addresses a character (starts with their name)
 */
export function isDirectAddress(message: string, character: CharacterCard): boolean {
  const messageTrimmed = message.trim().toLowerCase();
  const nameLower = character.name.toLowerCase();
  
  // Check if message starts with character name followed by punctuation
  const directAddressPattern = new RegExp(`^${escapeRegex(nameLower)}[\\s,:;.!?]`, 'i');
  return directAddressPattern.test(messageTrimmed);
}
