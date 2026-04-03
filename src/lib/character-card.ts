/**
 * Character Card Import/Export Utilities
 * Handles parsing PNG files with embedded character data (TavernCard format)
 * Extended to support TavernFlow-specific data (sprites, stats, etc.)
 */

import type { CharacterCard, CharacterCardV2 } from '@/types';

// PNG tEXt chunk header for character cards
const PNG_CHUNK_HEADER = 'tEXt';
const TAVERN_CHAR_KEY = 'chara';

/**
 * Parse a PNG file to extract embedded character card data
 * Character cards are stored in tEXt chunks with key "chara"
 * The value is Base64 encoded JSON
 */
export async function parseCharacterCardFromPng(file: File): Promise<{
  character: Partial<CharacterCard>;
  avatar: string;
} | null> {
  try {
    // Read the file as ArrayBuffer
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);
    
    // Verify PNG signature
    const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    for (let i = 0; i < 8; i++) {
      if (view.getUint8(i) !== pngSignature[i]) {
        console.error('Invalid PNG file');
        return null;
      }
    }
    
    // Parse PNG chunks
    let offset = 8; // Skip PNG signature
    let characterData: string | null = null;
    
    while (offset < buffer.byteLength) {
      const chunkLength = view.getUint32(offset);
      offset += 4;
      
      const chunkType = String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3)
      );
      offset += 4;
      
      if (chunkType === PNG_CHUNK_HEADER) {
        // Read chunk data
        const chunkData = new Uint8Array(buffer, offset, chunkLength);
        
        // Find the null separator between key and value
        let separatorIndex = -1;
        for (let i = 0; i < chunkData.length; i++) {
          if (chunkData[i] === 0) {
            separatorIndex = i;
            break;
          }
        }
        
        if (separatorIndex > 0) {
          const key = new TextDecoder().decode(chunkData.slice(0, separatorIndex));
          
          if (key === TAVERN_CHAR_KEY) {
            const value = new TextDecoder().decode(chunkData.slice(separatorIndex + 1));
            characterData = value;
          }
        }
      }
      
      // Skip chunk data and CRC
      offset += chunkLength + 4;
      
      // Stop at IEND chunk
      if (chunkType === 'IEND') break;
    }
    
    if (!characterData) {
      console.log('No character data found in PNG');
      return null;
    }
    
    // Decode Base64 and parse JSON
    const jsonStr = atob(characterData);
    const jsonData = JSON.parse(jsonStr);
    
    // Parse the character data
    const character = parseCharacterData(jsonData);
    
    // Create avatar data URL from the PNG
    const avatar = await fileToDataUrl(file);
    
    return { character, avatar };
  } catch (error) {
    console.error('Error parsing character card:', error);
    return null;
  }
}

/**
 * Parse character data from various formats (V1, V2, TavernFlow extended)
 */
function parseCharacterData(data: unknown): Partial<CharacterCard> {
  // Handle V2 format (including TavernFlow extended)
  if (typeof data === 'object' && data !== null && 'spec' in data && (data as Record<string, unknown>).spec === 'chara_card_v2') {
    const v2Data = data as CharacterCardV2;
    const extensions = v2Data.data.extensions as Record<string, unknown> | undefined;
    
    return {
      name: v2Data.data.name || '',
      description: v2Data.data.description || '',
      personality: v2Data.data.personality || '',
      scenario: v2Data.data.scenario || '',
      firstMes: v2Data.data.first_mes || '',
      mesExample: v2Data.data.mes_example || '',
      creatorNotes: v2Data.data.creator_notes || '',
      characterNote: v2Data.data.character_note || '',
      systemPrompt: v2Data.data.system_prompt || '',
      postHistoryInstructions: v2Data.data.post_history_instructions || '',
      authorNote: (v2Data.data as Record<string, unknown>).author_note as string || '',
      alternateGreetings: v2Data.data.alternate_greetings || [],
      tags: v2Data.data.tags || [],
      // TavernFlow extended fields from extensions
      avatar: (extensions?.avatar as string) || '',
      sprites: (extensions?.sprites as CharacterCard['sprites']) || [],
      // V2 Sprite System
      spritePacksV2: extensions?.spritePacksV2 as CharacterCard['spritePacksV2'],
      stateCollectionsV2: extensions?.stateCollectionsV2 as CharacterCard['stateCollectionsV2'],
      triggerCollections: extensions?.triggerCollections as CharacterCard['triggerCollections'],
      spriteLibraries: extensions?.spriteLibraries as CharacterCard['spriteLibraries'],
      spriteIndex: extensions?.spriteIndex as CharacterCard['spriteIndex'],
      // Legacy sprite system
      spriteConfig: extensions?.spriteConfig as CharacterCard['spriteConfig'],
      spriteTriggers: extensions?.spriteTriggers as CharacterCard['spriteTriggers'],
      spritePacks: extensions?.spritePacks as CharacterCard['spritePacks'],
      // Other extensions
      voice: extensions?.voice as CharacterCard['voice'],
      hudTemplateId: extensions?.hudTemplateId as string | null,
      statsConfig: extensions?.statsConfig as CharacterCard['statsConfig'],
      lorebookIds: extensions?.lorebookIds as string[],
      questTemplateIds: extensions?.questTemplateIds as string[],
      // Embeddings
      embeddingNamespaces: extensions?.embeddingNamespaces as string[],
      memory: extensions?.memory as CharacterCard['memory'],
      chatStats: extensions?.chatStats as CharacterCard['chatStats'],
    };
  }
  
  // Handle V1 format (flat object with snake_case keys)
  if (typeof data === 'object' && data !== null) {
    const v1Data = data as Record<string, unknown>;
    return {
      name: (v1Data.name as string) || (v1Data.char_name as string) || '',
      description: (v1Data.description as string) || (v1Data.char_persona as string) || '',
      personality: (v1Data.personality as string) || '',
      scenario: (v1Data.scenario as string) || (v1Data.world_scenario as string) || '',
      firstMes: (v1Data.first_mes as string) || (v1Data.char_greeting as string) || '',
      mesExample: (v1Data.mes_example as string) || '',
      creatorNotes: (v1Data.creator_notes as string) || '',
      characterNote: (v1Data.character_note as string) || '',
      systemPrompt: (v1Data.system_prompt as string) || '',
      postHistoryInstructions: (v1Data.post_history_instructions as string) || '',
      authorNote: (v1Data.author_note as string) || '',
      alternateGreetings: (v1Data.alternate_greetings as string[]) || [],
      tags: (v1Data.tags as string[]) || [],
      // Extended fields
      avatar: (v1Data.avatar as string) || '',
      sprites: (v1Data.sprites as CharacterCard['sprites']) || [],
      // V2 Sprite System
      spritePacksV2: v1Data.spritePacksV2 as CharacterCard['spritePacksV2'],
      stateCollectionsV2: v1Data.stateCollectionsV2 as CharacterCard['stateCollectionsV2'],
      triggerCollections: v1Data.triggerCollections as CharacterCard['triggerCollections'],
      spriteLibraries: v1Data.spriteLibraries as CharacterCard['spriteLibraries'],
      spriteIndex: v1Data.spriteIndex as CharacterCard['spriteIndex'],
      // Legacy sprite system
      spriteConfig: v1Data.spriteConfig as CharacterCard['spriteConfig'],
      spriteTriggers: v1Data.spriteTriggers as CharacterCard['spriteTriggers'],
      spritePacks: v1Data.spritePacks as CharacterCard['spritePacks'],
      // Other extensions
      voice: v1Data.voice as CharacterCard['voice'],
      hudTemplateId: v1Data.hudTemplateId as string | null,
      statsConfig: v1Data.statsConfig as CharacterCard['statsConfig'],
      lorebookIds: v1Data.lorebookIds as string[],
      questTemplateIds: v1Data.questTemplateIds as string[],
      memory: v1Data.memory as CharacterCard['memory'],
      chatStats: v1Data.chatStats as CharacterCard['chatStats'],
      // Embeddings
      embeddingNamespaces: v1Data.embeddingNamespaces as string[],
    };
  }
  
  return {};
}

/**
 * Convert File to Data URL (for importing)
 */
async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Upload an image to the server and return the URL
 */
async function uploadImage(file: File, type: string = 'avatar'): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to upload image');
  }

  const { url } = await response.json();
  return url;
}

/**
 * Upload a data URL to the server and return the URL
 */
async function uploadDataUrl(dataUrl: string, type: string = 'avatar'): Promise<string> {
  // Convert data URL to Blob
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  
  // Create a File object
  const file = new File([blob], `imported-${Date.now()}.png`, { type: blob.type || 'image/png' });
  
  return uploadImage(file, type);
}

/**
 * Parse JSON character card file
 */
export async function parseCharacterCardFromJson(file: File): Promise<{
  character: Partial<CharacterCard>;
  avatar?: string;
} | null> {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const character = parseCharacterData(data);
    
    // Check if avatar is included in the JSON
    let avatar: string | undefined;
    if (data.avatar && typeof data.avatar === 'string') {
      avatar = data.avatar;
    }
    
    return { character, avatar };
  } catch (error) {
    console.error('Error parsing JSON character card:', error);
    return null;
  }
}

/**
 * Import a character card from file (PNG or JSON)
 */
export async function importCharacterCard(file: File): Promise<{
  character: Partial<CharacterCard>;
  avatar: string;
} | null> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  
  try {
    if (extension === 'png' || file.type === 'image/png') {
      const result = await parseCharacterCardFromPng(file);
      if (result) {
        // Upload the avatar to the server instead of storing base64
        const avatarUrl = await uploadDataUrl(result.avatar, 'avatar');
        return {
          character: result.character,
          avatar: avatarUrl
        };
      }
    } else if (extension === 'json' || file.type === 'application/json') {
      const result = await parseCharacterCardFromJson(file);
      if (result) {
        let avatarUrl = '';
        if (result.avatar) {
          // If avatar is a data URL, upload it
          if (result.avatar.startsWith('data:')) {
            avatarUrl = await uploadDataUrl(result.avatar, 'avatar');
          } else {
            avatarUrl = result.avatar;
          }
        }
        return {
          character: result.character,
          avatar: avatarUrl
        };
      }
    }
  } catch (error) {
    console.error('Error importing character card:', error);
    return null;
  }
  
  console.error('Unsupported file format');
  return null;
}

/**
 * Create a PNG with embedded character data (includes all TavernFlow extensions)
 */
export async function exportCharacterCardAsPng(
  character: CharacterCard
): Promise<Blob> {
  // Create character data object (V2 format with TavernFlow extensions)
  const characterData: CharacterCardV2 = {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: character.name,
      description: character.description,
      personality: character.personality,
      scenario: character.scenario,
      first_mes: character.firstMes,
      mes_example: character.mesExample,
      creator_notes: character.creatorNotes,
      character_note: character.characterNote,
      system_prompt: character.systemPrompt,
      post_history_instructions: character.postHistoryInstructions,
      author_note: character.authorNote,
      alternate_greetings: character.alternateGreetings,
      tags: character.tags,
      creator: '',
      character_version: '1.0',
      extensions: {
        // TavernFlow extended data - Core fields
        avatar: character.avatar,
        sprites: character.sprites,
        // V2 Sprite System (NEW)
        spritePacksV2: character.spritePacksV2,
        stateCollectionsV2: character.stateCollectionsV2,
        triggerCollections: character.triggerCollections,
        spriteIndex: character.spriteIndex,
        // Legacy sprite system
        spriteConfig: character.spriteConfig,
        spriteTriggers: character.spriteTriggers,
        spritePacks: character.spritePacks,
        spriteLibraries: character.spriteLibraries,
        // Voice
        voice: character.voice,
        // HUD
        hudTemplateId: character.hudTemplateId,
        // Stats system
        statsConfig: character.statsConfig,
        // Lorebooks
        lorebookIds: character.lorebookIds,
        // Quests
        questTemplateIds: character.questTemplateIds,
        // Embeddings
        embeddingNamespaces: character.embeddingNamespaces,
      }
    }
  };
  
  // If no avatar, create a placeholder
  if (!character.avatar) {
    return createPngWithCharacterData(characterData, null);
  }
  
  // Fetch the avatar image
  try {
    const response = await fetch(character.avatar);
    const imageBlob = await response.blob();
    return createPngWithCharacterData(characterData, imageBlob);
  } catch {
    return createPngWithCharacterData(characterData, null);
  }
}

/**
 * Create a PNG blob with embedded character data
 */
async function createPngWithCharacterData(
  data: CharacterCardV2,
  imageBlob: Blob | null
): Promise<Blob> {
  // If we have an image, inject the character data
  if (imageBlob) {
    const buffer = await imageBlob.arrayBuffer();
    return injectCharacterDataIntoPng(buffer, data);
  }
  
  // Create a minimal 1x1 PNG with the character data
  const width = 1;
  const height = 1;
  
  // Create PNG chunks
  const signature = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  // IHDR chunk
  const ihdrData = new Uint8Array(13);
  const ihdrView = new DataView(ihdrData.buffer);
  ihdrView.setUint32(0, width);
  ihdrView.setUint32(4, height);
  ihdrView.setUint8(8, 8);  // bit depth
  ihdrView.setUint8(9, 6);  // color type (RGBA)
  ihdrView.setUint8(10, 0); // compression
  ihdrView.setUint8(11, 0); // filter
  ihdrView.setUint8(12, 0); // interlace
  const ihdrChunk = createPngChunk('IHDR', ihdrData);
  
  // tEXt chunk with character data
  const jsonStr = JSON.stringify(data);
  const base64Str = btoa(jsonStr);
  const textData = new TextEncoder().encode(`${TAVERN_CHAR_KEY}\x00${base64Str}`);
  const textChunk = createPngChunk('tEXt', textData);
  
  // IDAT chunk (minimal compressed RGBA data)
  const idatData = new Uint8Array([0x78, 0x9C, 0x62, 0x60, 0x60, 0x60, 0x00, 0x00, 0x00, 0x04, 0x00, 0x01]);
  const idatChunk = createPngChunk('IDAT', idatData);
  
  // IEND chunk
  const iendChunk = createPngChunk('IEND', new Uint8Array(0));
  
  // Combine all chunks
  const totalLength = signature.length + ihdrChunk.length + textChunk.length + idatChunk.length + iendChunk.length;
  const pngBuffer = new Uint8Array(totalLength);
  let offset = 0;
  
  pngBuffer.set(signature, offset);
  offset += signature.length;
  pngBuffer.set(ihdrChunk, offset);
  offset += ihdrChunk.length;
  pngBuffer.set(textChunk, offset);
  offset += textChunk.length;
  pngBuffer.set(idatChunk, offset);
  offset += idatChunk.length;
  pngBuffer.set(iendChunk, offset);
  
  return new Blob([pngBuffer], { type: 'image/png' });
}

/**
 * Inject character data into an existing PNG
 */
async function injectCharacterDataIntoPng(
  buffer: ArrayBuffer,
  data: CharacterCardV2
): Promise<Blob> {
  const view = new DataView(buffer);
  const pngChunks: { type: string; data: Uint8Array }[] = [];
  
  // Parse existing chunks
  let offset = 8; // Skip signature
  
  while (offset < buffer.byteLength) {
    const chunkLength = view.getUint32(offset);
    const chunkType = String.fromCharCode(
      view.getUint8(offset + 4),
      view.getUint8(offset + 5),
      view.getUint8(offset + 6),
      view.getUint8(offset + 7)
    );
    
    const chunkData = new Uint8Array(buffer, offset + 8, chunkLength);
    pngChunks.push({ type: chunkType, data: chunkData });
    
    offset += 12 + chunkLength; // length + type + data + CRC
    
    if (chunkType === 'IEND') break;
  }
  
  // Remove existing tEXt chara chunks
  const filteredChunks = pngChunks.filter(c => 
    !(c.type === 'tEXt' && isCharaChunk(c.data))
  );
  
  // Create new tEXt chunk with character data
  const jsonStr = JSON.stringify(data);
  const base64Str = btoa(jsonStr);
  const textData = new TextEncoder().encode(`${TAVERN_CHAR_KEY}\x00${base64Str}`);
  
  // Insert before IEND
  const iendIndex = filteredChunks.findIndex(c => c.type === 'IEND');
  const newChunks = [
    ...filteredChunks.slice(0, iendIndex),
    { type: 'tEXt', data: textData },
    ...filteredChunks.slice(iendIndex)
  ];
  
  // Rebuild PNG
  const signature = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const chunksData = newChunks.map(c => createPngChunk(c.type, c.data));
  
  const totalLength = signature.length + chunksData.reduce((sum, c) => sum + c.length, 0);
  const pngBuffer = new Uint8Array(totalLength);
  
  pngBuffer.set(signature, 0);
  let pos = signature.length;
  for (const chunk of chunksData) {
    pngBuffer.set(chunk, pos);
    pos += chunk.length;
  }
  
  return new Blob([pngBuffer], { type: 'image/png' });
}

/**
 * Check if a tEXt chunk is a chara chunk
 */
function isCharaChunk(data: Uint8Array): boolean {
  for (let i = 0; i < data.length; i++) {
    if (data[i] === 0) {
      const key = new TextDecoder().decode(data.slice(0, i));
      return key === TAVERN_CHAR_KEY;
    }
  }
  return false;
}

/**
 * Create a PNG chunk with CRC
 */
function createPngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  
  // Length (4 bytes, big-endian)
  view.setUint32(0, data.length);
  
  // Type (4 bytes)
  chunk.set(typeBytes, 4);
  
  // Data
  chunk.set(data, 8);
  
  // CRC (4 bytes) - calculated over type + data
  const crc = crc32(new Uint8Array([...typeBytes, ...data]));
  view.setUint32(8 + data.length, crc);
  
  return chunk;
}

/**
 * CRC32 calculation for PNG chunks
 */
function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  const table = getCrc32Table();
  
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
  }
  
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

let crc32Table: Uint32Array | null = null;

function getCrc32Table(): Uint32Array {
  if (crc32Table) return crc32Table;
  
  crc32Table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crc32Table[i] = c;
  }
  
  return crc32Table;
}

/**
 * Export character as JSON (includes all TavernFlow extensions)
 */
export function exportCharacterCardAsJson(character: CharacterCard): string {
  const data: CharacterCardV2 = {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: character.name,
      description: character.description,
      personality: character.personality,
      scenario: character.scenario,
      first_mes: character.firstMes,
      mes_example: character.mesExample,
      creator_notes: character.creatorNotes,
      character_note: character.characterNote,
      system_prompt: character.systemPrompt,
      post_history_instructions: character.postHistoryInstructions,
      author_note: character.authorNote,
      alternate_greetings: character.alternateGreetings,
      tags: character.tags,
      creator: '',
      character_version: '1.0',
      extensions: {
        // TavernFlow extended data - Core fields
        avatar: character.avatar,
        sprites: character.sprites,
        // V2 Sprite System (NEW)
        spritePacksV2: character.spritePacksV2,
        stateCollectionsV2: character.stateCollectionsV2,
        triggerCollections: character.triggerCollections,
        spriteIndex: character.spriteIndex,
        // Legacy sprite system
        spriteConfig: character.spriteConfig,
        spriteTriggers: character.spriteTriggers,
        spritePacks: character.spritePacks,
        spriteLibraries: character.spriteLibraries,
        // Voice
        voice: character.voice,
        // HUD
        hudTemplateId: character.hudTemplateId,
        // Stats system
        statsConfig: character.statsConfig,
        // Lorebooks
        lorebookIds: character.lorebookIds,
        // Quests
        questTemplateIds: character.questTemplateIds,
        // Embeddings
        embeddingNamespaces: character.embeddingNamespaces,
      }
    }
  };
  
  return JSON.stringify(data, null, 2);
}
