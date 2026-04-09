// ============================================
// LLM Utils - SSE and encoding utilities
// ============================================

// Create a TextEncoder for streaming
const encoder = new TextEncoder();

/**
 * Create a Server-Sent Events response
 */
export function createSSEResponse(data: string): Uint8Array {
  return encoder.encode(`data: ${data}\n\n`);
}

/**
 * Create a JSON SSE message
 */
export function createSSEJSON(data: object): Uint8Array {
  return createSSEResponse(JSON.stringify(data));
}

/**
 * Parse SSE data from a buffer
 */
export function parseSSELine(line: string): { data: string } | null {
  const trimmedLine = line.trim();
  if (!trimmedLine || !trimmedLine.startsWith('data: ')) {
    return null;
  }
  return { data: trimmedLine.slice(6) };
}

/**
 * Clean response content by removing character name prefix
 */
export function cleanResponseContent(content: string, characterName: string): string {
  let cleaned = content.trim();
  
  const namePrefix = `${characterName}:`;
  const namePrefixAlt = `${characterName} :`;
  
  if (cleaned.startsWith(namePrefix)) {
    cleaned = cleaned.slice(namePrefix.length).trim();
  } else if (cleaned.startsWith(namePrefixAlt)) {
    cleaned = cleaned.slice(namePrefixAlt.length).trim();
  }
  
  return cleaned;
}

/**
 * Create a default error response for streaming
 */
export function createErrorStream(error: string): ReadableStream {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(createSSEJSON({ type: 'error', error }));
      controller.close();
    }
  });
}

/**
 * Create a JSON error response
 */
export function createErrorResponse(error: string, status: number = 500): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Create SSE stream response with proper headers
 */
export function createSSEStreamResponse(stream: ReadableStream): Response {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
