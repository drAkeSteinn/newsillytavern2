// ============================================
// Prompt-Based Tool Call Parser
// ============================================
//
// Parses tool calls from LLM text output when the model
// doesn't support native tool calling (e.g., LM Studio with
// models that generate tool call JSON as text content).
//
// Expected formats in LLM output:
//   ```tool_call
//   {"name": "tool_name", "parameters": {"key": "value"}}
//   ```
//
//   TOOL_CALL: name | {"key": "value"}
//
//   {"type": "function", "name": "search_web", "parameters": {"query": "..."}}
//
//   {"name": "search_web", "arguments": {"query": "..."}}
//
// Supports nested JSON objects via brace-counting extraction.

import type { ParsedToolCall } from '../types';

// ============================================
// Model Artifact Cleanup
// ============================================

/**
 * Clean special tokens and model artifacts from LLM output.
 * Handles common patterns from:
 * - LLaMA-based models (LM Studio, Ollama): <|reserved_special_token|>, <|startheader_id|>, etc.
 * - ChatML models: <im_start>, <im_end>, <|im_start|>, <|im_end|>
 * - GPT-style:  <|endofprompt|>
 * - Mistral: <s>, </s>
 * - Generic: [INST], [/INST], <<SYS>>, <</SYS>>
 */
export function cleanModelArtifacts(text: string): string {
  if (!text) return text;

  let result = text;

  // LLaMA special tokens (LM Studio common)
  // e.g., <|reserved_special_token_0|>, <|reservedspecialtoken4|>
  result = result.replace(/<\|reserved[_]?special[_]?token[_\d]*\|>/gi, '');
  // <|startheader_id|>assistant: or <|endheader_id|>
  result = result.replace(/<\|start[_]?header[_]?id\|>\s*\w*\s*:?/gi, '');
  result = result.replace(/<\|end[_]?header[_]?id\|>/gi, '');
  // <|eot_id|>, <|eos_id|>
  result = result.replace(/<\|e[oa]s[_]?id\|>/gi, '');

  // ChatML / GPT-NeoX tokens
  result = result.replace(/<\|im_start\|>\s*\w*\s*/gi, '');
  result = result.replace(/<\|im_end\|>/gi, '');

  // Generic special tokens: <|anything|>
  result = result.replace(/<\|[^>]+\|>/g, '');

  // GPT-style end tokens
  result = result.replace(/<\|endoftext\|>/gi, '');
  result = result.replace(/<\|endofprompt\|>/gi, '');

  // Mistral-style
  result = result.replace(/<\/?s>/g, '');

  // LLaMA-style instruction tokens
  result = result.replace(/\[INST\].*?\[\/INST\]\s*/gi, '');
  result = result.replace(/<<SYS>>.*?<\/SYS>>\s*/gi, '');
  result = result.replace(/\[\/INST\]/gi, '');
  result = result.replace(/\[INST\]/gi, '');

  // Clean up multiple consecutive newlines that may result from stripping
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim();
}

// ============================================
// JSON Extraction via Brace Counting
// ============================================

/**
 * Extract a complete JSON object starting at the given position.
 * Uses brace counting to handle nested objects like:
 *   {"name": "search_web", "parameters": {"query": "...", "max_results": 5}}
 *
 * Returns { json: string, endIndex: number } or null if extraction fails.
 */
function extractJsonObject(text: string, startIndex: number): { json: string; endIndex: number } | null {
  if (startIndex >= text.length || text[startIndex] !== '{') return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        // Found the matching closing brace
        return { json: text.slice(startIndex, i + 1), endIndex: i + 1 };
      }
    }
  }

  return null; // Unmatched braces
}

/**
 * Find all JSON objects in text that look like tool calls.
 * Returns array of { json: string, start: number, end: number }.
 */
function findAllToolCallJsonObjects(text: string): Array<{ json: string; start: number; end: number }> {
  const results: Array<{ json: string; start: number; end: number }> = [];

  // Scan for opening braces
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      const extracted = extractJsonObject(text, i);
      if (extracted) {
        // Quick check: does this JSON look like a tool call?
        // Must contain "name" and either "parameters" or "arguments"
        const j = extracted.json;
        if (j.includes('"name"') && (j.includes('"parameters"') || j.includes('"arguments"'))) {
          results.push({ json: j, start: i, end: extracted.endIndex });
          i = extracted.endIndex; // Skip past this object
        } else {
          // Not a tool call, skip past the closing brace
          i = extracted.endIndex - 1;
        }
      }
    }
  }

  return results;
}

// ============================================
// Tool Call Detection (Single)
// ============================================

/**
 * Try to parse the FIRST tool call from the LLM's text output.
 * Returns null if no tool call is found.
 */
export function parseToolCallFromText(text: string): ParsedToolCall | null {
  const allCalls = parseAllToolCallsFromText(text);
  return allCalls.length > 0 ? allCalls[0] : null;
}

/**
 * Parse ALL tool calls from the LLM's text output.
 * Uses brace-counting extraction to handle nested JSON objects.
 * Returns an array of ParsedToolCall (may be empty).
 */
export function parseAllToolCallsFromText(text: string): ParsedToolCall[] {
  if (!text) return [];

  const trimmed = text.trim();

  // Early exit: if text is long and doesn't look like a tool call at all
  if (trimmed.length > 5000 && !trimmed.includes('"name"')) {
    return [];
  }

  // Pattern 1: ```tool_call ... ``` (preferred format)
  const fencedMatches = trimmed.match(/```tool_call\s*\n?([\s\S]*?)\n?```/g);
  if (fencedMatches) {
    const calls: ParsedToolCall[] = [];
    for (const fenced of fencedMatches) {
      const inner = fenced.replace(/```tool_call\s*\n?/, '').replace(/\n?```$/, '').trim();
      const parsed = parseToolCallJSON(inner);
      if (parsed) calls.push(parsed);
    }
    if (calls.length > 0) return calls;
  }

  // Pattern 2: TOOL_CALL: name | {"key": "value"} (alternative format)
  const altMatches = trimmed.match(/TOOL_CALL:\s*(\w+)\s*\|\s*(\{[\s\S]*?\})/gi);
  if (altMatches) {
    const calls: ParsedToolCall[] = [];
    for (const alt of altMatches) {
      const m = alt.match(/TOOL_CALL:\s*(\w+)\s*\|\s*(\{[\s\S]*?\})/i);
      if (m) {
        try {
          const args = JSON.parse(m[2]);
          calls.push({ name: m[1].trim(), arguments: args, raw: m[0] });
        } catch {
          // Skip invalid
        }
      }
    }
    if (calls.length > 0) return calls;
  }

  // Pattern 3: Standalone JSON tool calls using brace-counting extraction
  // This handles nested objects like:
  //   {"type": "function", "name": "search_web", "parameters": {"query": "...", "max_results": 5}}
  const jsonObjects = findAllToolCallJsonObjects(trimmed);
  if (jsonObjects.length > 0) {
    const calls: ParsedToolCall[] = [];
    for (const { json } of jsonObjects) {
      const parsed = parseToolCallJSON(json);
      if (parsed) calls.push(parsed);
    }
    if (calls.length > 0) return calls;
  }

  return [];
}

/**
 * Check if text looks like it might contain a tool call.
 * This is a fast pre-check to avoid full parsing on obvious non-tool-call text.
 */
export function mightContainToolCall(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();

  // Fast checks for likely tool call indicators
  if (trimmed.startsWith('```tool_call')) return true;
  if (trimmed.match(/TOOL_CALL:/i)) return true;
  // Match JSON containing tool call fields
  if (trimmed.includes('"name"') && (trimmed.includes('"parameters"') || trimmed.includes('"arguments"'))) {
    if (trimmed.includes('{') && (trimmed.includes('"type": "function"') || trimmed.includes('"type":"function"'))) return true;
    // Or just {"name": "...", "parameters"/"arguments": {...}}
    if (/\"name\"\s*:\s*\"[^\"]+\"/.test(trimmed)) return true;
  }
  if (trimmed.includes('"type": "function"') || trimmed.includes('"type":"function"')) return true;

  return false;
}

/**
 * Parse tool call from a JSON string
 */
function parseToolCallJSON(jsonStr: string): ParsedToolCall | null {
  try {
    // Try direct parse
    const parsed = JSON.parse(jsonStr);
    if (parsed && typeof parsed.name === 'string' && parsed.name.trim()) {
      return {
        name: parsed.name.trim(),
        arguments: (parsed.parameters || parsed.arguments || {}),
        raw: jsonStr,
      };
    }
  } catch {
    // Try fixing common issues
    try {
      const fixed = jsonStr
        .replace(/,\s*([}\]])/g, '$1') // trailing commas
        .replace(/[\u2018\u2019]/g, "'")   // smart quotes
        .replace(/[\u201C\u201D]/g, '"');
      const parsed = JSON.parse(fixed);
      if (parsed && typeof parsed.name === 'string' && parsed.name.trim()) {
        return {
          name: parsed.name.trim(),
          arguments: (parsed.parameters || parsed.arguments || {}),
          raw: jsonStr,
        };
      }
    } catch {
      // Give up
    }
  }

  return null;
}

/**
 * Remove ALL tool call portions from the LLM's text,
 * returning only the natural language response.
 * Also cleans model artifacts (special tokens).
 * Uses brace-counting for proper nested JSON removal.
 */
export function stripToolCallFromText(text: string): string {
  if (!text) return text;

  let result = text;

  // Remove ```tool_call ... ``` blocks
  result = result.replace(/```tool_call\s*\n?[\s\S]*?\n?```/g, '');

  // Remove TOOL_CALL: lines
  result = result.replace(/TOOL_CALL:\s*\w+\s*\|\s*\{[\s\S]*?\}/gi, '');

  // Remove standalone JSON tool calls using brace-counting extraction
  // Find all JSON objects that look like tool calls and remove them
  const jsonObjects = findAllToolCallJsonObjects(result);
  // Sort by start position (descending) so we can remove from end to start
  jsonObjects.sort((a, b) => b.start - a.start);
  for (const { json, start, end } of jsonObjects) {
    result = result.slice(0, start) + result.slice(end);
  }

  // Clean model artifacts (special tokens from LLaMA, Mistral, etc.)
  result = cleanModelArtifacts(result);

  return result.trim();
}

/**
 * Split text into chunks for replaying buffered content as streaming tokens.
 */
export function splitIntoChunks(text: string, chunkSize: number = 3): string[] {
  if (!text) return [];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}
