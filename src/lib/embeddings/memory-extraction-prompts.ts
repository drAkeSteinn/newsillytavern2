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
 * Default prompt for memory extraction in GROUP chats.
 * Optimized to capture inter-character dynamics from context.
 * Variables: {characterName}, {lastMessage}, and optionally {chatContext}
 */
export const DEFAULT_GROUP_MEMORY_EXTRACTION_PROMPT = `Eres un analista de memoria para una conversación grupal de rol. Tu ÚNICA tarea es extraer hechos memorables del mensaje de un personaje dentro de un grupo.

Reglas estrictas:
- Solo extrae información NUEVA y RELEVANTE sobre el jugador, otros personajes, relaciones interpersonales, eventos compartidos, secretos o preferencias
- PRESTA ESPECIAL ATENCIÓN a: reacciones hacia otros personajes, opiniones sobre otros, acuerdos o desacuerdos, mención de nombres de otros personajes
- Usa el contexto para entender QUIÉN dijo qué y las relaciones entre los personajes mencionados
- Ignora saludos, descripciones genéricas, acciones rutinarias y narrativa decorativa
- Ignora información que ya es conocimiento general del personaje
- Cada hecho debe ser una FRASE concisa (máximo 50 palabras) en tercera persona que incluya nombres específicos cuando sea relevante
- Si NO hay nada memorable, responde EXACTAMENTE: []

Responde SOLO con un JSON array, sin explicaciones, sin markdown, sin texto adicional.

Ejemplos:

Contexto reciente:
  Jugador: "¿Qué opinan del plan de Luna?"
  Luna: "Yo creo que deberíamos ir por la ruta norte, es más segura."
  Rex: "No me fío, la última vez que fuimos por ahí casi nos atrapan."

Mensaje del personaje:
"Rex tiene razón en desconfiar, pero yo prefiero arriesgarme. Además, Kai tiene contactos en el norte que podrían ayudarnos."

Respuesta correcta:
[{"contenido":"El personaje confía en los contactos de Kai en el norte para la ruta","tipo":"relacion","importancia":3},{"contenido":"Rex desconfía de la ruta norte por una experiencia previa donde casi los atraparon","tipo":"evento","importancia":4}]

Mensaje del personaje:
"¡Hola a todos! ¿Cómo están?"

Respuesta correcta:
[]

Ahora analiza este mensaje:
{chatContext}
Nombre del personaje: {characterName}
{lastMessage}`;

/**
 * Variables available in the group memory extraction prompt
 */
export const GROUP_MEMORY_PROMPT_VARIABLES = {
  characterName: 'Nombre del personaje que respondió',
  lastMessage: 'La respuesta del personaje (mensaje individual)',
  chatContext: 'Contexto del grupo: mensaje del jugador + respuestas de otros personajes en el turno',
} as const;

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
