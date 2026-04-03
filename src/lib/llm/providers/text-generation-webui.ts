// ============================================
// Text Generation WebUI / KoboldCPP Provider
// ============================================

import type { LLMConfig, GenerateResponse } from '../types';

/**
 * Check if the Text Generation WebUI API is available
 */
export async function checkTextGenerationWebUIHealth(
  config: LLMConfig
): Promise<{ available: boolean; message: string }> {
  const endpoint = config.endpoint.replace(/\/$/, '');
  
  try {
    // Try to connect to the API
    const response = await fetch(`${endpoint}/api/v1/model`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    
    if (response.ok) {
      return { available: true, message: 'API disponible' };
    }
    
    if (response.status === 404) {
      return { 
        available: false, 
        message: `API no encontrada. Verifica que el servidor esté corriendo con --api en puerto 5000 (no 7860). Endpoint: ${endpoint}` 
      };
    }
    
    return { available: false, message: `Error ${response.status}: ${response.statusText}` };
  } catch (error) {
    return { 
      available: false, 
      message: `No se puede conectar a ${endpoint}. ¿Está el servidor corriendo?` 
    };
  }
}

/**
 * Stream from Text Generation WebUI / KoboldCPP API
 * Supports both legacy API (/api/v1/generate) and OpenAI-compatible API (/v1/completions)
 */
export async function* streamTextGenerationWebUI(
  prompt: string,
  config: LLMConfig
): AsyncGenerator<string> {
  const endpoint = config.endpoint.replace(/\/$/, '');
  
  // Try OpenAI-compatible streaming endpoint first (modern)
  const modernEndpoint = `${endpoint}/v1/completions`;
  const legacyEndpoint = `${endpoint}/api/v1/generate`;
  
  const requestBody = {
    prompt: prompt,
    max_tokens: config.parameters.maxTokens,
    max_new_tokens: config.parameters.maxTokens,  // Legacy format
    temperature: config.parameters.temperature,
    top_p: config.parameters.topP,
    top_k: config.parameters.topK,
    repetition_penalty: config.parameters.repetitionPenalty,
    stop: config.parameters.stopStrings?.length ? config.parameters.stopStrings : undefined,
    stream: true
  };

  // Try modern OpenAI-compatible endpoint first
  let response = await fetch(modernEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(60000)
  });

  // If modern endpoint fails with 404, try legacy endpoint
  if (response.status === 404) {
    response = await fetch(legacyEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(60000)
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    
    // Provide helpful error messages
    if (response.status === 404) {
      throw new Error(
        `Text Generation WebUI API no encontrada.\n\n` +
        `Posibles causas:\n` +
        `1. El servidor no está corriendo con la flag --api\n` +
        `2. Puerto incorrecto - usa 5000 (no 7860)\n` +
        `3. Endpoint configurado: ${endpoint}\n\n` +
        `Para iniciar: python server.py --api --listen-port 5000`
      );
    }
    
    let errorMessage = errorText;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.detail || errorJson.message || errorText;
    } catch {
      // Keep original error text
    }
    throw new Error(`Text Generation WebUI Error (${response.status}): ${errorMessage}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        
        // Handle SSE format (data: {...})
        if (trimmedLine.startsWith('data: ')) {
          const data = trimmedLine.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            // OpenAI-compatible format
            const content = parsed.choices?.[0]?.text || parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              yield content;
            }
            continue;
          } catch {
            // Fall through to try legacy format
          }
        }

        // Try legacy format (plain JSON)
        try {
          const parsed = JSON.parse(trimmedLine);
          const content = parsed.results?.[0]?.text || parsed.text || parsed.token?.text || '';
          if (content) {
            yield content;
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Call Text Generation WebUI / KoboldCPP API (non-streaming)
 */
export async function callTextGenerationWebUI(
  prompt: string,
  config: LLMConfig
): Promise<GenerateResponse> {
  const endpoint = config.endpoint.replace(/\/$/, '');
  
  const modernEndpoint = `${endpoint}/v1/completions`;
  const legacyEndpoint = `${endpoint}/api/v1/generate`;
  
  const requestBody = {
    prompt: prompt,
    max_tokens: config.parameters.maxTokens,
    max_new_tokens: config.parameters.maxTokens,
    temperature: config.parameters.temperature,
    top_p: config.parameters.topP,
    top_k: config.parameters.topK,
    repetition_penalty: config.parameters.repetitionPenalty,
    stop: config.parameters.stopStrings?.length ? config.parameters.stopStrings : undefined,
    stream: false
  };

  // Try modern endpoint first
  let response = await fetch(modernEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(60000)
  });

  // If 404, try legacy endpoint
  if (response.status === 404) {
    response = await fetch(legacyEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(60000)
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    
    if (response.status === 404) {
      throw new Error(
        `Text Generation WebUI API no encontrada.\n\n` +
        `Posibles causas:\n` +
        `1. El servidor no está corriendo con la flag --api\n` +
        `2. Puerto incorrecto - usa 5000 (no 7860)\n` +
        `3. Endpoint configurado: ${endpoint}\n\n` +
        `Para iniciar: python server.py --api --listen-port 5000`
      );
    }
    
    throw new Error(`Text Generation WebUI Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  // Handle both modern and legacy response formats
  const message = data.choices?.[0]?.text || data.results?.[0]?.text || data.text || '';

  return {
    message,
    usage: {
      promptTokens: data.usage?.prompt_tokens || data.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || data.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || (data.prompt_tokens || 0) + (data.completion_tokens || 0)
    },
    model: data.model || config.model
  };
}
