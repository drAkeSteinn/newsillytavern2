// ============================================
// Grok Models API - List available xAI models
// ============================================
// GET /api/grok/models?apiKey=xxx

import { NextRequest } from 'next/server';
import { createErrorResponse } from '@/lib/llm';

export async function GET(request: NextRequest) {
  try {
    const apiKey = request.nextUrl.searchParams.get('apiKey');

    if (!apiKey) {
      return createErrorResponse('Se requiere API Key de xAI', 400);
    }

    const response = await fetch('https://api.x.ai/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      if (response.status === 401) {
        return createErrorResponse('API Key inválida. Verifica tu clave de xAI.', 401);
      }
      return createErrorResponse(`Error de xAI (${response.status}): ${errBody.slice(0, 200)}`, response.status);
    }

    const data = await response.json();
    const models = (data.data || [])
      .map((m: { id: string }) => ({
        id: m.id,
        name: m.id.split('/').pop() || m.id,
      }))
      .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));

    return Response.json({ success: true, data: models });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return createErrorResponse(`Error al obtener modelos: ${msg}`, 500);
  }
}
