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

import type { ParsedToolCall } from '../types';

/**
 * Try to parse a tool call from the LLM's text output.
 * Returns null if no tool call is found.
 */
export function parseToolCallFromText(text: string): ParsedToolCall | null {
  if (!text) return null;

  const trimmed = text.trim();

  // Early exit: if text is long and doesn't look like a tool call at all
  // (tool call JSON is typically < 500 chars)
  if (trimmed.length > 2000 && !trimmed.includes('"name"')) {
    return null;
  }

  // Pattern 1: ```tool_call ... ``` (preferred format)
  const fencedMatch = trimmed.match(/```tool_call\s*\n?([\s\S]*?)\n?```/);
  if (fencedMatch) {
    return parseToolCallJSON(fencedMatch[1].trim());
  }

  // Pattern 2: TOOL_CALL: name | {"key": "value"} (alternative format)
  const altMatch = trimmed.match(/TOOL_CALL:\s*(\w+)\s*\|\s*(\{[\s\S]*?\})/i);
  if (altMatch) {
    try {
      const args = JSON.parse(altMatch[2]);
      return {
        name: altMatch[1].trim(),
        arguments: args,
        raw: altMatch[0],
      };
    } catch {
      // Fall through to pattern 3
    }
  }

  // Pattern 3: Standalone JSON tool call (LM Studio / small models format)
  // Matches formats like:
  //   {"type": "function", "name": "search_web", "parameters": {"query": "..."}}
  //   {"name": "search_web", "parameters": {"query": "..."}}
  //   {"name": "search_web", "arguments": {"query": "..."}}
  const jsonPatterns = [
    // At start of text/line: {"type": "function", "name": "...", "parameters": {...}}
    /^\s*\{[^{}]*"type"\s*:\s*"function"[^{}]*"name"\s*:\s*"[^"]+"[^{}]*(?:parameters|arguments)\s*:\s*\{[^{}]*\}\s*\}/m,
    // At start of text/line: {"name": "...", "parameters": {...}}
    /^\s*\{[^{}]*"name"\s*:\s*"[^"]+"[^{}]*(?:parameters|arguments)\s*:\s*\{[^{}]*\}\s*\}/m,
  ];

  for (const pattern of jsonPatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      const parsed = parseToolCallJSON(match[0]);
      if (parsed) return parsed;
    }
  }

  // Pattern 4: Try extracting JSON object from any position in text
  // This handles cases where the LLM adds text before the JSON
  const embeddedMatch = trimmed.match(/\{[^{}]*"type"\s*:\s*"function"[^{}]*"name"\s*:\s*"[^"]+"[^{}]*(?:parameters|arguments)\s*:\s*\{[^{}]*\}\s*\}/);
  if (embeddedMatch) {
    const parsed = parseToolCallJSON(embeddedMatch[0]);
    if (parsed) return parsed;
  }

  // Pattern 5: Simple JSON without "type" field, embedded in text
  const simpleEmbeddedMatch = trimmed.match(/\{[^{}]*"name"\s*:\s*"[^"]+"[^{}]*(?:parameters|arguments)\s*:\s*\{[^{}]*\}\s*\}/);
  if (simpleEmbeddedMatch) {
    const parsed = parseToolCallJSON(simpleEmbeddedMatch[0]);
    if (parsed) return parsed;
  }

  return null;
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
  if (trimmed.startsWith('{') && trimmed.includes('"name"') && (trimmed.includes('"parameters"') || trimmed.includes('"arguments"'))) return true;
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
 * Remove the tool call portion from the LLM's text,
 * returning only the natural language response.
 */
export function stripToolCallFromText(text: string): string {
  if (!text) return text;

  let result = text;

  // Remove ```tool_call ... ``` blocks
  result = result.replace(/```tool_call\s*\n?[\s\S]*?\n?```/g, '');

  // Remove TOOL_CALL: lines
  result = result.replace(/TOOL_CALL:\s*\w+\s*\|\s*\{[\s\S]*?\}/gi, '');

  // Remove standalone JSON tool calls with "type": "function"
  result = result.replace(/\{[^{}]*"type"\s*:\s*"function"[^{}]*"name"\s*:\s*"[^"]+"[^{}]*(?:parameters|arguments)\s*:\s*\{[^{}]*\}\s*\}/g, '');

  // Remove standalone JSON tool calls without "type" field
  result = result.replace(/\{[^{}]*"name"\s*:\s*"[^"]+"[^{}]*(?:parameters|arguments)\s*:\s*\{[^{}]*\}\s*\}/g, '');

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
