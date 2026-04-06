// ============================================
// Tool: Set Reminder
// ============================================
// Category: real_world
// Permission: auto
// Stores reminders as structured memory (in-memory, per session)

import type { ToolDefinition, ToolContext, ToolExecutionResult } from '../types';

// In-memory store for reminders (per session)
// In a future version this could be persisted in Prisma
const sessionReminders = new Map<string, Array<{
  id: string;
  content: string;
  characterId: string;
  createdAt: string;
  mentioned: number;
}>>();

/** Get active reminders for a session */
export function getSessionReminders(sessionId: string) {
  return sessionReminders.get(sessionId) || [];
}

/** Mark a reminder as mentioned (increment counter) */
export function mentionReminder(sessionId: string, reminderId: string) {
  const reminders = sessionReminders.get(sessionId);
  if (reminders) {
    const reminder = reminders.find(r => r.id === reminderId);
    if (reminder) reminder.mentioned++;
  }
}

/** Clear all reminders for a session */
export function clearSessionReminders(sessionId: string) {
  sessionReminders.delete(sessionId);
}

export const setReminderTool: ToolDefinition = {
  id: 'set_reminder',
  name: 'set_reminder',
  label: 'Crear Recordatorio',
  icon: 'Bell',
  description:
    'Crea un recordatorio para recordar algo importante en conversaciones futuras. ' +
    'Usa esta herramienta cuando el usuario te pida recordar algo, ' +
    'o cuando quieras anotar información importante para referencia futura.',
  category: 'real_world',
  parameters: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'Qué recordar (ej: "El usuario tiene reunión el viernes a las 3 PM")',
        required: true,
      },
  },
  required: ['content'],
  },
  permissionMode: 'auto',
};

export async function setReminderExecutor(
  params: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolExecutionResult> {
  const content = String(params.content || '').trim();

  if (!content || content.length < 5) {
    return {
      success: false,
      toolName: 'set_reminder',
      result: null,
      displayMessage: 'El recordatorio debe tener al menos 5 caracteres',
      error: 'EMPTY_CONTENT',
    };
  }

  try {
    const sessionId = context.sessionId || 'default';
    const reminder = {
      id: `rem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      content,
      characterId: context.characterId,
      createdAt: new Date().toISOString(),
      mentioned: 0,
    };

    // Store in session
    if (!sessionReminders.has(sessionId)) {
      sessionReminders.set(sessionId, []);
    }
    sessionReminders.get(sessionId)!.push(reminder);

    // Limit reminders per session (keep last 50)
    const reminders = sessionReminders.get(sessionId)!;
    if (reminders.length > 50) {
      sessionReminders.set(sessionId, reminders.slice(-50));
    }

    const displayMessage = `⏰ Recordatorio creado: "${content}"`;

    return {
      success: true,
      toolName: 'set_reminder',
      result: { reminder },
      displayMessage,
    };
  } catch (error) {
    return {
      success: false,
      toolName: 'set_reminder',
      result: null,
      displayMessage: 'Error al crear el recordatorio',
      error: error instanceof Error ? error.message : 'Unknown',
    };
  }
}
