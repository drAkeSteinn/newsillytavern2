// ============================================
// Test Tools Route - Tests all 3 tools via Grok API (using z-ai SDK)
// ============================================
// POST /api/test-tools
// Tests: manage_quest, manage_solicitud, manage_memory tool definitions
// against the LLM API to verify tool construction and activation.

import { NextRequest } from 'next/server';
import { createErrorResponse, createSSEStreamResponse, createSSEJSON } from '@/lib/llm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const model = body.model || 'grok-3-mini-beta';

    // Get the tool definitions statically (no runtime registry needed)
    const tools = buildTestToolDefinitions();

    const openaiTools = tools.map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    console.log(`[TestTools] Testing ${tools.length} tools with model: ${model}`);

    // Create a ReadableStream for SSE responses
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: unknown) => {
          controller.enqueue(createSSEJSON(data));
        };

        try {
          send({ type: 'test_start', message: '🔍 Iniciando pruebas de herramientas...', tools: tools.map(t => t.name) });

          // Import SDK dynamically (server-only)
          const sdk = (await import('z-ai-web-dev-sdk')).default;
          const client = await sdk.create();
          send({ type: 'info', message: `✅ SDK conectado. Modelo: ${model}` });

          // ========================================
          // TEST 1: manage_quest - Normal Chat
          // ========================================
          send({ type: 'test', name: 'manage_quest (chat normal)', message: 'Probando manage_quest...' });
          const r1 = await testToolCall(client, model, openaiTools,
            `Eres un aventurero llamado Kael. Acabas de derrotar a un lobo en el bosque oscuro.
Tienes una misión activa "Limpiar el Bosque" con el objetivo "Derrotar 3 lobos" (0/3).
Usa manage_quest con get_quests para ver tus misiones y progress_objective para registrar la victoria.
Responde SOLO con la llamada a herramienta.`,
            'Kael'
          );
          send(r1);

          // ========================================
          // TEST 2: manage_solicitud - Normal Chat
          // ========================================
          send({ type: 'test', name: 'manage_solicitud (chat normal)', message: 'Probando manage_solicitud...' });
          const r2 = await testToolCall(client, model, openaiTools,
            `Eres un herrero llamado Thoren. Necesitas madera para construir una puerta.
Hay un leñador llamada Luna en el grupo.
Primero usa get_peticiones para ver qué peticiones puedes hacer,
luego usa activate_peticion con la petición de madera dirigida a Luna.
Responde SOLO con las llamadas a herramientas.`,
            'Thoren'
          );
          send(r2);

          // ========================================
          // TEST 3: manage_memory - Normal Chat
          // ========================================
          send({ type: 'test', name: 'manage_memory (chat normal)', message: 'Probando manage_memory...' });
          const r3 = await testToolCall(client, model, openaiTools,
            `Eres una exploradora llamada Arya. Acabas de descubrir una cueva secreta con cristales brillantes.
Sientes emoción y asombro. También notas que el usuario te ayudó a encontrarla.
Usa manage_memory con:
1. save_memory para guardar el descubrimiento (tipo "event", importancia 0.9)
2. update_relationship para mejorar tu relación con "usuario" (sentiment_delta: 25)
Responde SOLO con las llamadas a herramientas.`,
            'Arya'
          );
          send(r3);

          // ========================================
          // TEST 4: manage_quest - Group Chat
          // ========================================
          send({ type: 'test', name: 'manage_quest (grupo)', message: 'Probando manage_quest en grupo...' });
          const r4 = await testToolCall(client, model, openaiTools,
            `Eres un guerrero llamado Kael en un grupo de aventureros. Tu grupo completa la misión "Rescatar al Rey".
Tienes el objetivo "Encontrar la entrada al castillo" que ya completaste.
Usa manage_quest: get_quests para ver estado, luego complete_objective para completar el objetivo.
Responde SOLO con la llamada a herramienta.`,
            'Kael (grupo)'
          );
          send(r4);

          // ========================================
          // TEST 5: manage_solicitud - Group Chat
          // ========================================
          send({ type: 'test', name: 'manage_solicitud (grupo)', message: 'Probando manage_solicitud en grupo...' });
          const r5 = await testToolCall(client, model, openaiTools,
            `Eres una maga llamada Zara en un grupo. El guerrero Kael te envió una solicitud para darle un escudo mágico.
Usa manage_solicitud: get_solicitudes para ver solicitudes pendientes,
luego complete_solicitud para completar la solicitud de Kael con key "entregar_escudo".
Responde SOLO con la llamada a herramienta.`,
            'Zara (grupo)'
          );
          send(r5);

          // ========================================
          // TEST 6: manage_memory - Group Chat
          // ========================================
          send({ type: 'test', name: 'manage_memory (grupo)', message: 'Probando manage_memory en grupo...' });
          const r6 = await testToolCall(client, model, openaiTools,
            `Eres una curandera llamada Elara en un grupo. El guerrero Kael casi muere en batalla pero lo salvaste.
Usa manage_memory con:
1. get_relationships para ver tu relación con otros
2. update_relationship para mejorar sentimiento hacia Kael (sentiment_delta: 20)
3. save_memory para guardar el evento de casi-muerte (tipo "event", importancia 1.0)
Responde SOLO con las llamadas a herramientas.`,
            'Elara (grupo)'
          );
          send(r6);

          // ========================================
          // TEST 7: Combined - Multiple tools in one response
          // ========================================
          send({ type: 'test', name: 'múltiples herramientas (combinado)', message: 'Probando múltiples herramientas...' });
          const r7 = await testToolCall(client, model, openaiTools,
            `Eres un aventurero que acaba de completar una misión y hacer un nuevo amigo.
Haz lo siguiente:
1. manage_quest get_quests para ver tus misiones
2. manage_memory save_memory con un evento importante (tipo "event", importancia 0.8)
3. manage_memory update_relationship con sentimiento positivo hacia "usuario" (sentiment_delta: 15)
Responde SOLO con las llamadas a herramientas.`,
            'Héroe (combinado)'
          );
          send(r7);

          // ========================================
          // SUMMARY
          // ========================================
          send({ type: 'test_complete', message: '✅ Todas las pruebas completadas' });

        } catch (error) {
          send({ type: 'fatal_error', message: error instanceof Error ? error.message : String(error) });
        } finally {
          controller.enqueue('data: [DONE]\n\n');
          controller.close();
        }
      },
    });

    return createSSEStreamResponse(stream);
  } catch (error) {
    return createErrorResponse(error instanceof Error ? error.message : 'Unknown error', 500);
  }
}

// ============================================
// Tool Definitions (static, matching the registered tools)
// ============================================

function buildTestToolDefinitions() {
  return [
    // manage_quest
    {
      name: 'manage_quest',
      description: 'Gestiona las misiones y objetivos del personaje durante el roleplay. Usa get_quests para ver las misiones activas. Usa progress_objective cuando el personaje avance hacia un objetivo. Usa complete_objective para marcar un objetivo como completado.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['get_quests', 'progress_objective', 'complete_objective'], description: 'La acción a realizar' },
          quest_id: { type: 'string', description: 'ID de la misión (templateId).' },
          objective_id: { type: 'string', description: 'ID del objetivo (objective templateId).' },
          amount: { type: 'number', description: 'Cantidad a progressar (solo para progress_objective). Default: 1.' },
          reason: { type: 'string', description: 'Razón narrativa del cambio.' },
        },
        required: ['action'],
      },
    },
    // manage_solicitud
    {
      name: 'manage_solicitud',
      description: 'Gestiona las peticiones y solicitudes del personaje. Usa get_peticiones para ver peticiones disponibles. Usa get_solicitudes para ver solicitudes pendientes. Usa activate_peticion para hacer una petición. Usa complete_solicitud para completar una solicitud.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['get_peticiones', 'get_solicitudes', 'activate_peticion', 'complete_solicitud'], description: 'La acción a realizar' },
          peticion_key: { type: 'string', description: 'Key de la petición a activar.' },
          solicitud_key: { type: 'string', description: 'Key de la solicitud a completar.' },
          target_character_name: { type: 'string', description: 'Nombre del personaje objetivo.' },
          reason: { type: 'string', description: 'Razón narrativa.' },
        },
        required: ['action'],
      },
    },
    // manage_memory
    {
      name: 'manage_memory',
      description: 'Gestiona la memoria del personaje. Usa get_memories para ver eventos y notas. Usa get_relationships para ver relaciones. Usa save_memory para guardar un evento importante. Usa update_relationship para actualizar sentimiento hacia otro. Usa update_notes para actualizar notas personales.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['get_memories', 'get_relationships', 'save_memory', 'update_relationship', 'update_notes'], description: 'La acción a realizar' },
          memory_type: { type: 'string', enum: ['fact', 'relationship', 'event', 'emotion', 'location', 'item', 'state_change'], description: 'Tipo de memoria (solo para save_memory).' },
          content: { type: 'string', description: 'Contenido de la memoria o nota.' },
          importance: { type: 'number', description: 'Importancia de 0 a 1 (solo para save_memory).' },
          target_name: { type: 'string', description: 'Nombre del objetivo (solo para update_relationship).' },
          relationship_label: { type: 'string', description: 'Etiqueta de relación (solo para update_relationship).' },
          sentiment_delta: { type: 'number', description: 'Cambio de sentimiento -100 a 100 (solo para update_relationship).' },
          reason: { type: 'string', description: 'Razón narrativa.' },
        },
        required: ['action'],
      },
    },
  ];
}

// ============================================
// Helper: Call LLM with tools via z-ai SDK
// ============================================

interface TestResult {
  type: 'test_result';
  test: string;
  success: boolean;
  toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>;
  error?: string;
  raw?: string;
  finishReason?: string;
}

async function testToolCall(
  client: any,
  model: string,
  tools: Array<{ type: 'function'; function: any }>,
  prompt: string,
  characterName: string,
): Promise<TestResult> {
  try {
    const startTime = Date.now();

    const response = await client.createChatCompletion({
      model,
      messages: [
        {
          role: 'system',
          content: `Eres ${characterName}, un personaje en un roleplay de fantasía. Tienes herramientas disponibles y DEBES usarlas cuando la situación lo requiera. Responde SOLO con tool_calls, sin texto adicional.`,
        },
        { role: 'user', content: prompt },
      ],
      tools,
      tool_choice: 'auto',
      temperature: 0.3,
      max_tokens: 1024,
    });

    const duration = Date.now() - startTime;
    const choice = response.choices?.[0];
    const finishReason = choice?.finish_reason;
    const message = choice?.message;

    const nativeToolCalls = message?.tool_calls;
    if (nativeToolCalls && nativeToolCalls.length > 0) {
      const parsedCalls = nativeToolCalls.map((tc: any) => ({
        name: tc.function?.name || 'unknown',
        arguments: (() => {
          try { return JSON.parse(tc.function?.arguments || '{}'); }
          catch { return { raw: tc.function?.arguments }; }
        })(),
      }));

      return {
        type: 'test_result',
        test: characterName,
        success: true,
        toolCalls: parsedCalls,
        finishReason,
        raw: `✅ ${parsedCalls.length} tool_call(s) en ${duration}ms | ${parsedCalls.map(c => `${c.name}(${JSON.stringify(c.arguments).slice(0, 60)}...)`).join(', ')}`,
      };
    }

    return {
      type: 'test_result',
      test: characterName,
      success: false,
      toolCalls: [],
      finishReason,
      error: `No se activó ninguna herramienta. finish_reason: ${finishReason}. Respuesta: "${(message?.content || '').slice(0, 200)}"`,
      raw: message?.content?.slice(0, 300),
    };
  } catch (error) {
    return {
      type: 'test_result',
      test: characterName,
      success: false,
      toolCalls: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
