/**
 * Text Splitters for Embedding Chunking
 * 
 * Different strategies for splitting text into chunks before embedding.
 */

export interface SplitterConfig {
  chunkSize: number;
  chunkOverlap: number;
}

export interface ChunkResult {
  chunks: string[];
  totalChunks: number;
  totalCharacters: number;
  avgChunkSize: number;
}

export type SplitterType =
  | 'character'
  | 'recursive-character'
  | 'markdown'
  | 'code';

// ============ Character Text Splitter ============
// Simple split by character count

export function characterTextSplit(
  text: string,
  config: SplitterConfig
): ChunkResult {
  const { chunkSize, chunkOverlap } = config;
  if (!text || text.trim().length === 0) {
    return { chunks: [], totalChunks: 0, totalCharacters: 0, avgChunkSize: 0 };
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    let chunk = text.slice(start, end);

    // If not at the end, try to break at a space
    if (end < text.length) {
      const lastSpace = chunk.lastIndexOf(' ');
      if (lastSpace > chunkSize * 0.5) {
        chunk = chunk.slice(0, lastSpace);
        start += lastSpace + 1;
      } else {
        start = end;
      }
    } else {
      start = end;
    }

    if (chunk.trim()) {
      chunks.push(chunk.trim());
    }

    // Apply overlap
    if (chunkOverlap > 0 && chunks.length > 0) {
      const lastChunk = chunks[chunks.length - 1];
      const overlapStart = Math.max(0, lastChunk.length - chunkOverlap);
      start = Math.max(start - (lastChunk.length - overlapStart), start);
    }
  }

  return {
    chunks,
    totalChunks: chunks.length,
    totalCharacters: text.length,
    avgChunkSize: chunks.length > 0 ? Math.round(chunks.reduce((a, c) => a + c.length, 0) / chunks.length) : 0,
  };
}

// ============ Recursive Character Text Splitter ============
// Splits by separators in order: \n\n, \n, space, then character

const RECURSIVE_SEPARATORS = ['\n\n', '\n', ' ', ''];

export function recursiveCharacterSplit(
  text: string,
  config: SplitterConfig
): ChunkResult {
  const { chunkSize, chunkOverlap } = config;
  if (!text || text.trim().length === 0) {
    return { chunks: [], totalChunks: 0, totalCharacters: 0, avgChunkSize: 0 };
  }

  const chunks = splitTextWithOverlap(text, chunkSize, chunkOverlap);

  return {
    chunks,
    totalChunks: chunks.length,
    totalCharacters: text.length,
    avgChunkSize: chunks.length > 0 ? Math.round(chunks.reduce((a, c) => a + c.length, 0) / chunks.length) : 0,
  };
}

function splitTextWithOverlap(
  text: string,
  chunkSize: number,
  chunkOverlap: number
): string[] {
  // Try each separator
  for (const separator of RECURSIVE_SEPARATORS) {
    const splits = separator === '' ? text.split('') : text.split(separator);

    // If all splits are small enough, we can use this separator
    if (splits.every(s => s.length <= chunkSize)) {
      return mergeSplits(splits, separator, chunkSize, chunkOverlap);
    }
  }

  // Fallback: character-by-character
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start = end - chunkOverlap;
  }
  return chunks;
}

function mergeSplits(
  splits: string[],
  separator: string,
  chunkSize: number,
  chunkOverlap: number
): string[] {
  const chunks: string[] = [];
  let currentChunk = '';

  for (const split of splits) {
    if (!split) continue;

    if (currentChunk.length + split.length + (separator ? separator.length : 0) <= chunkSize) {
      currentChunk += (currentChunk ? separator : '') + split;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }

      // Start new chunk with overlap
      if (chunkOverlap > 0 && currentChunk) {
        const overlapText = currentChunk.slice(-chunkOverlap);
        currentChunk = overlapText + (separator ? separator : '') + split;
      } else {
        currentChunk = split;
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// ============ Markdown Text Splitter ============
// Splits by markdown headings first, then recursively

export function markdownTextSplit(
  text: string,
  config: SplitterConfig
): ChunkResult {
  const { chunkSize, chunkOverlap } = config;
  if (!text || text.trim().length === 0) {
    return { chunks: [], totalChunks: 0, totalCharacters: 0, avgChunkSize: 0 };
  }

  // Split by headings (# ## ### etc.)
  const headingRegex = /^(#{1,6})\s+.+$/gm;
  const sections: string[] = [];
  let lastIndex = 0;
  let match;

  while ((match = headingRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      sections.push(text.slice(lastIndex, match.index));
    }
    lastIndex = match.index;
  }

  if (lastIndex < text.length) {
    sections.push(text.slice(lastIndex));
  }

  if (sections.length === 0) {
    sections.push(text);
  }

  // Process each section: if too big, split recursively
  const chunks: string[] = [];
  for (const section of sections) {
    const trimmed = section.trim();
    if (trimmed.length <= chunkSize) {
      chunks.push(trimmed);
    } else {
      // Split large sections recursively
      const subChunks = splitTextWithOverlap(trimmed, chunkSize, chunkOverlap);
      chunks.push(...subChunks);
    }
  }

  return {
    chunks,
    totalChunks: chunks.length,
    totalCharacters: text.length,
    avgChunkSize: chunks.length > 0 ? Math.round(chunks.reduce((a, c) => a + c.length, 0) / chunks.length) : 0,
  };
}

// ============ Code Text Splitter ============
// Splits by code blocks, functions, classes

const CODE_SEPARATORS = [
  '\nclass ',
  '\nfunction ',
  '\nasync function ',
  '\nconst ',
  '\nlet ',
  '\nvar ',
  '\ndef ',
  '\nasync def ',
  '\n\n',
  '\n',
  '  ',
  ' ',
  '',
];

export function codeTextSplit(
  text: string,
  config: SplitterConfig
): ChunkResult {
  const { chunkSize, chunkOverlap } = config;
  if (!text || text.trim().length === 0) {
    return { chunks: [], totalChunks: 0, totalCharacters: 0, avgChunkSize: 0 };
  }

  // Try to split by code structures
  for (const separator of CODE_SEPARATORS) {
    const splits = text.split(separator);

    if (splits.every(s => s.length <= chunkSize)) {
      const chunks = mergeSplits(splits, separator, chunkSize, chunkOverlap);
      return {
        chunks,
        totalChunks: chunks.length,
        totalCharacters: text.length,
        avgChunkSize: chunks.length > 0 ? Math.round(chunks.reduce((a, c) => a + c.length, 0) / chunks.length) : 0,
      };
    }
  }

  // Fallback
  const chunks = splitTextWithOverlap(text, chunkSize, chunkOverlap);
  return {
    chunks,
    totalChunks: chunks.length,
    totalCharacters: text.length,
    avgChunkSize: chunks.length > 0 ? Math.round(chunks.reduce((a, c) => a + c.length, 0) / chunks.length) : 0,
  };
}

// ============ Main Splitter Function ============

export function splitText(
  text: string,
  type: SplitterType,
  config: SplitterConfig
): ChunkResult {
  switch (type) {
    case 'character':
      return characterTextSplit(text, config);
    case 'recursive-character':
      return recursiveCharacterSplit(text, config);
    case 'markdown':
      return markdownTextSplit(text, config);
    case 'code':
      return codeTextSplit(text, config);
    default:
      return recursiveCharacterSplit(text, config);
  }
}

export const SPLITTER_INFO: Record<SplitterType, { name: string; description: string; defaultChunkSize: number; defaultOverlap: number }> = {
  'character': {
    name: 'Character Text Splitter',
    description: 'Simple split by character count. Breaks at spaces when possible.',
    defaultChunkSize: 1000,
    defaultOverlap: 200,
  },
  'recursive-character': {
    name: 'Recursive Character Splitter',
    description: 'Tries multiple separators (paragraphs, lines, words) for natural breaks.',
    defaultChunkSize: 1000,
    defaultOverlap: 200,
  },
  'markdown': {
    name: 'Markdown Text Splitter',
    description: 'Splits by markdown headings first, then recursively within sections.',
    defaultChunkSize: 1000,
    defaultOverlap: 200,
  },
  'code': {
    name: 'Code Text Splitter',
    description: 'Splits by code structures (classes, functions, blocks).',
    defaultChunkSize: 1500,
    defaultOverlap: 300,
  },
};
