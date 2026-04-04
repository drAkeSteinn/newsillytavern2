/**
 * Memory Extraction Prompts
 *
 * This file contains ONLY the prompt templates for memory extraction,
 * with NO server-side imports (no lancedb, no llm, no fs).
 * Safe to import from both client and server components.
 */

/** Variables available in the extraction prompt */
export const MEMORY_PROMPT_VARIABLES = {
  characterName: 'Nombre del personaje',
  lastMessage: 'El último mensaje del personaje (respuesta completa)',
  chatContext: 'Contexto reciente de la conversación (opcional, mensajes previos)',
} as const;

/**
 * Default prompt for memory extraction.
 * Variables: {characterName}, {lastMessage}, and optionally {chatContext}
 */
export const DEFAULT_MEMORY_EXTRACTION_PROMPT = `Eres un analista de memoria para un personaje de rol. Tu ÚNICA tarea es extraer hechos memorables del mensaje de un personaje.

Reglas estrictas:
- Solo extrae información NUEVA y RELEVANTE sobre el jugador, relaciones, eventos importantes, secretos o preferencias
- Ignora saludos, descripciones genéricas, acciones rutinarias y narrativa decorativa
- Ignora información que ya es conocimiento general del personaje
- Cada hecho debe ser una FRASE concisa (máximo 50 palabras) en tercera persona
- Usa el contexto de la conversación para entender referencias implícitas (nombres, lugares, eventos mencionados anteriormente)
- Si NO hay nada memorable, responde EXACTAMENTE: []

Responde SOLO con un JSON array, sin explicaciones, sin markdown, sin texto adicional.

Ejemplos:

Contexto reciente:
  Jugador: "Me acabo de mudar a la costa, tengo un gato llamado Milo"
  Personaje: "¡Qué genial! ¿Y cómo te va adaptando?"

Mensaje del personaje:
"Milo se lleva súper bien con los vecinos."

Respuesta correcta:
[{"contenido":"El jugador tiene un gato llamado Milo","tipo":"hecho","importancia":3},{"contenido":"El jugador se mudó recientemente a la costa","tipo":"hecho","importancia":3}]

Mensaje del personaje:
"¡Buenos días! ¿En qué puedo ayudarte hoy?"

Respuesta correcta:
[]

Ahora analiza este mensaje:
{chatContext}
Nombre del personaje: {characterName}
{lastMessage}`;

/**
 * Default prompt for group dynamics extraction.
 * Analyzes a full turn of conversation to extract inter-character relationships.
 * Variables: {turnContext}
 */
export const DEFAULT_GROUP_DYNAMICS_PROMPT = `Eres un analista de dinámicas grupales. Tu ÚNICA tarea es extraer hechos sobre las RELACIONES E INTERACCIONES entre personajes en una conversación grupal.

Reglas estrictas:
- Solo extrae información sobre relaciones, dinámicas, alianzas, conflictos o tendencias entre personajes
- Ignora saludos, acciones rutinarias y narrativa decorativa
- Cada hecho debe ser una FRASE concisa (máximo 50 palabras) en tercera persona
- Usa el nombre real de los personajes, no "el personaje"
- Si NO hay nada memorable sobre dinámicas grupales, responde EXACTAMENTE: []

Responde SOLO con un JSON array, sin explicaciones, sin markdown, sin texto adicional.

Ejemplo:

Conversación:
  Luna: "¡Me encanta la idea! Yo me encargo del pastel."
  Kai: "Yo puedo conseguir la música y las luces."
  Rex: "Yo no voy a ir, no me cae bien Ana."

Respuesta correcta:
[{"contenido":"Luna y Kai colaboran activamente en la organización de eventos","tipo":"relacion","importancia":3},{"contenido":"Rex rechaza participar en eventos que involucren a Ana","tipo":"relacion","importancia":4}]

Ahora analiza esta conversación:
{turnContext}`;
