import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy endpoint to fetch available models from Ollama's /api/tags endpoint.
 * Avoids CORS issues when calling localhost from the browser.
 *
 * Ollama returns: { models: [{ name: "qwen3.5:9b", model: "qwen3.5:9b", ... }] }
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint');

  if (!endpoint) {
    return NextResponse.json(
      { error: 'Se requiere el parámetro "endpoint"' },
      { status: 400 }
    );
  }

  try {
    const baseUrl = endpoint.replace(/\/+$/, '');
    const tagsUrl = `${baseUrl}/api/tags`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(tagsUrl, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Ollama respondió con ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Normalize to a consistent format (similar to LM Studio's /v1/models response)
    const models = (data.models || []).map((m: { name: string; model: string }) => ({
      id: m.name || m.model,
      name: (m.name || m.model).split(':').slice(0, 2).join(':'),
    }));

    return NextResponse.json({ data: models });
  } catch (err) {
    const message = err instanceof Error && err.name === 'AbortError'
      ? 'Tiempo de espera agotado (5s)'
      : err instanceof Error
        ? err.message
        : 'Error de conexión';

    return NextResponse.json(
      { error: message },
      { status: 502 }
    );
  }
}
