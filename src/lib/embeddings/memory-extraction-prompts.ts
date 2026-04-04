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
} as const;

/**
 * Default prompt for memory extraction.
 * Variables: {characterName} and {lastMessage}
 */
export const DEFAULT_MEMORY_EXTRACTION_PROMPT = `Eres un analista de memoria para un personaje de rol. Tu ÚNICA tarea es extraer hechos memorables del mensaje de un personaje.

Reglas estrictas:
- Solo extrae información NUEVA y RELEVANTE sobre el jugador, relaciones, eventos importantes, secretos o preferencias
- Ignora saludos, descripciones genéricas, acciones rutinarias y narrativa decorativa
- Ignora información que ya es conocimiento general del personaje
- Cada hecho debe ser una FRASE concisa (máximo 50 palabras) en tercera persona
- Si NO hay nada memorable, responde EXACTAMENTE: []

Responde SOLO con un JSON array, sin explicaciones, sin markdown, sin texto adicional.

Ejemplos:

Mensaje del personaje:
"*mira con recelo* No confío en ti desde que robaste las gemas del templo. Y sé que le debes dinero a Claudec."

Respuesta correcta:
[{"contenido":"El personaje no confía en el jugador desde que robó las gemas del templo","tipo":"relacion","importancia":4},{"contenido":"El jugador le debe dinero a Claudec","tipo":"hecho","importancia":3}]

Mensaje del personaje:
"¡Buenos días! ¿En qué puedo ayudarte hoy?"

Respuesta correcta:
[]

Ahora analiza este mensaje:

Nombre del personaje: {characterName}
{lastMessage}`;
