// ============================================
// Prompt-Based Tool Call Parser
// ============================================
//
// Parses tool calls from LLM text output when the model
// doesn't support native tool calling.
//
// Expected format in LLM output:
//   ```tool_call
//   {"name": "tool_name", "parameters": {"key": "value"}}
//   ```

import type { ParsedToolCall } from '../types';

/**
 * Try to parse a tool call from the LLM's text output.
 * Returns null if no tool call is found.
 */
export function parseToolCallFromText(text: string): ParsedToolCall | null {
  if (!text) return null;

  const trimmed = text.trim();

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

  // Pattern 3: Standalone JSON with "name" and "parameters" keys
  // Look for JSON object at start of text or on its own line
  const jsonPatterns = [
    /^\s*\{[\s\S]*?"name"\s*:\s*"[^"]+"[\s\S]*?"parameters"\s*:\s*\{[\s\S]*?\}\s*\}/m,
  ];

  for (const pattern of jsonPatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      const parsed = parseToolCallJSON(match[0]);
      if (parsed) return parsed;
    }
  }

  return null;
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

  // Remove standalone JSON tool calls
  result = result.replace(/^\s*\{[\s\S]*?"name"\s*:\s*"[^"]+"[\s\S]*?"parameters"\s*:\s*\{[\s\S]*?\}\s*\}\s*/gm, '');

  return result.trim();
}
