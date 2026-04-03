// ============================================
// Internationalization (i18n) System
// ============================================

export type Language = 'es' | 'en';

// Translation dictionary type
type TranslationDictionary = Record<string, string>;

// All translations organized by language
const translations: Record<Language, TranslationDictionary> = {
  es: {
    // === Common Actions ===
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'common.delete': 'Eliminar',
    'common.edit': 'Editar',
    'common.create': 'Crear',
    'common.close': 'Cerrar',
    'common.confirm': 'Confirmar',
    'common.reset': 'Restablecer',
    'common.clear': 'Limpiar',
    'common.loading': 'Cargando...',
    'common.uploading': 'Subiendo...',
    'common.search': 'Buscar',
    'common.searchPlaceholder': 'Escribe para buscar...',
    'common.noResults': 'Sin resultados',
    'common.yes': 'Sí',
    'common.no': 'No',
    'common.on': 'Encendido',
    'common.off': 'Apagado',
    'common.enabled': 'Habilitado',
    'common.disabled': 'Deshabilitado',
    'common.select': 'Seleccionar',
    'common.selectAll': 'Seleccionar todo',
    'common.deselect': 'Deseleccionar',
    'common.retry': 'Reintentar',
    'common.copy': 'Copiar',
    'common.copied': '¡Copiado!',
    'common.export': 'Exportar',
    'common.import': 'Importar',
    'common.download': 'Descargar',
    'common.upload': 'Subir',
    'common.browse': 'Explorar',
    'common.refresh': 'Actualizar',
    'common.expandAll': 'Expandir todo',
    'common.collapseAll': 'Colapsar todo',
    
    // === Navigation & Layout ===
    'nav.hidePanels': 'Ocultar paneles',
    'nav.showPanels': 'Mostrar paneles',
    'nav.characters': 'Personajes',
    'nav.groups': 'Grupos',
    'nav.personas': 'Personas',
    'nav.settings': 'Ajustes',
    'nav.backgroundGallery': 'Galería de fondos',
    'nav.lorebooks': 'Lorebooks',
    'nav.soundTriggers': 'Triggers de sonido',
    
    // === Chat Panel ===
    'chat.title': 'Chat',
    'chat.groupTitle': 'Chat Grupal',
    'chat.messagePlaceholder': 'Mensaje...',
    'chat.send': 'Enviar',
    'chat.reset': 'Reiniciar',
    'chat.resetConfirm': '¿Reiniciar chat? Esto borrará todos los mensajes y comenzará de nuevo.',
    'chat.resetFirstConfirm': '¿Reiniciar el chat al primer mensaje del personaje?',
    'chat.clear': 'Limpiar',
    'chat.clearConfirm': '¿Estás seguro de que quieres borrar todos los mensajes? Esta acción no se puede deshacer.',
    'chat.welcome.title': 'Bienvenido a TavernFlow',
    'chat.welcome.subtitle': 'Selecciona un personaje de la barra lateral para comenzar a chatear, o crea un nuevo personaje para iniciar tu aventura.',
    'chat.noCharacter': 'No hay personaje seleccionado',
    'chat.noLLM': 'No hay configuración LLM activa. Por favor, configura una conexión LLM en los ajustes.',
    'chat.noGroupCharacters': 'No hay personajes en este grupo. Añade personajes al grupo primero.',
    'chat.error.streaming': 'Error al iniciar el streaming',
    'chat.error.generation': 'Error al generar la respuesta. Por favor, verifica tu configuración LLM.',
    'chat.error.regeneration': 'Error al regenerar',
    'chat.error.noConfig': 'No hay configuración LLM activa',
    'chat.resetPosition': 'Restablecer posición',
    'chat.messagesCount': ' mensajes',
    
    // === Chat Message ===
    'message.you': 'Tú',
    'message.assistant': 'Asistente',
    'message.viewPrompt': 'Ver Prompt',
    'message.edit': 'Editar respuesta',
    'message.replay': 'Reproducir respuesta',
    'message.swipe.prev': 'Alternativa anterior',
    'message.swipe.next': 'Siguiente alternativa',
    'message.swipe.generate': 'Generar nueva alternativa',
    'message.swipe.position': '{{current}} de {{total}}',
    
    // === Chat Box Settings ===
    'chatbox.settings': 'Ajustes del Chat',
    'chatbox.width': 'Ancho:',
    'chatbox.height': 'Alto:',
    'chatbox.opacity': 'Opacidad:',
    'chatbox.blurBackground': 'Fondo difuminado',
    'chatbox.actions': 'Acciones del chat',
    'chatbox.sessionVariables': 'Variables de Sesión',
    'chatbox.noVariables': 'No hay variables guardadas',
    'chatbox.quests': 'Misiones',
    'chatbox.questsDisabled': 'Sistema de misiones deshabilitado',
    'chatbox.noQuests': 'No hay misiones en esta sesión',
    'chatbox.objectives': 'objetivos',
    'chatbox.availableQuests': 'Misiones disponibles',
    'chatbox.completedQuests': 'Misiones completadas',
    
    // === Characters ===
    'character.new': 'Nuevo personaje',
    'character.edit': 'Editar personaje',
    'character.delete': 'Eliminar personaje',
    'character.deleteConfirm': '¿Estás seguro de que quieres eliminar este personaje? Esta acción no se puede deshacer.',
    'character.name': 'Nombre',
    'character.description': 'Descripción',
    'character.personality': 'Personalidad',
    'character.scenario': 'Escenario',
    'character.firstMessage': 'Primer mensaje',
    'character.exampleDialogue': 'Diálogo de ejemplo',
    'character.systemPrompt': 'Prompt del sistema',
    'character.postHistory': 'Post-historia',
    'character.avatar': 'Avatar',
    'character.tags': 'Etiquetas',
    'character.creator': 'Creador',
    'character.characterVersion': 'Versión del personaje',
    'character.notes': 'Notas',
    'character.tts': 'Texto a voz',
    'character.tts.description': 'Configura texto-a-voz para este personaje.',
    'character.tts.enable': 'Activar voz',
    'character.import': 'Importar personaje',
    'character.export': 'Exportar personaje',
    'character.importError': 'Error al importar el personaje',
    'character.exportError': 'Error al exportar el personaje',
    'character.uploadError': 'Error al subir',
    
    // === Groups ===
    'group.new': 'Nuevo grupo',
    'group.edit': 'Editar grupo',
    'group.delete': 'Eliminar grupo',
    'group.name': 'Nombre del grupo',
    'group.characters': 'Personajes',
    'group.order': 'Orden de respuesta',
    'group.roundRobin': 'Round Robin (por turno)',
    'group.random': 'Aleatorio',
    'group.active': 'Activo',
    'group.inactive': 'Inactivo',
    
    // === Personas ===
    'persona.new': 'Nueva persona',
    'persona.edit': 'Editar persona',
    'persona.delete': 'Eliminar persona',
    'persona.name': 'Nombre',
    'persona.description': 'Descripción',
    'persona.default': 'Por defecto',
    'persona.setAsDefault': 'Establecer como predeterminada',
    'persona.uploadError': 'Error al subir',
    
    // === Lorebooks ===
    'lorebook.title': 'Lorebook',
    'lorebook.new': 'Nuevo lorebook',
    'lorebook.edit': 'Editar lorebook',
    'lorebook.delete': 'Eliminar lorebook',
    'lorebook.entries': 'Entradas',
    'lorebook.entry': 'Entrada',
    'lorebook.keywords': 'Palabras clave',
    'lorebook.content': 'Contenido',
    'lorebook.enabled': 'Habilitado',
    'lorebook.position': 'Posición',
    'lorebook.insertionOrder': 'Orden de inserción',
    'lorebook.probability': 'Probabilidad',
    'lorebook.useProbability': 'Usar probabilidad',
    'lorebook.extensions': 'Extensiones',
    'lorebook.caseSensitive': 'Distinguir mayúsculas',
    'lorebook.scanDepth': 'Profundidad de escaneo',
    'lorebook.tokenBudget': 'Presupuesto de tokens',
    
    // === Sound Triggers ===
    'sound.title': 'Triggers de sonido',
    'sound.new': 'Nuevo trigger',
    'sound.edit': 'Editar trigger',
    'sound.delete': 'Eliminar trigger',
    'sound.trigger': 'Trigger',
    'sound.condition': 'Condición',
    'sound.sound': 'Sonido',
    'sound.volume': 'Volumen',
    'sound.playOn': 'Reproducir al',
    'sound.playOn.messageSent': 'Enviar mensaje',
    'sound.playOn.messageReceived': 'Recibir mensaje',
    'sound.playOn.swipe': 'Cambiar swipe',
    'sound.collections': 'Colecciones de sonidos',
    'sound.error.playback': 'Error al reproducir sonido',
    'sound.error.fetch': 'Error al obtener colecciones de sonidos',
    
    // === Backgrounds ===
    'background.title': 'Galería de fondos',
    'background.upload': 'Subir fondo',
    'background.delete': 'Eliminar fondo',
    'background.blur': 'Difuminar',
    'background.blurAmount': 'Cantidad de desenfoque',
    'background.opacity': 'Opacidad',
    'background.error.fetch': 'Error al obtener fondos',
    
    // === Sprites ===
    'sprite.title': 'Sprites',
    'sprite.collections': 'Colecciones de sprites',
    'sprite.new': 'Nueva colección',
    'sprite.add': 'Añadir sprite',
    'sprite.delete': 'Eliminar sprite',
    'sprite.deleteCollection': 'Eliminar colección',
    'sprite.position': 'Posición',
    'sprite.scale': 'Escala',
    'sprite.error.fetch': 'Error al obtener colecciones de sprites',
    'sprite.error.upload': 'Error al subir sprite',
    'sprite.error.create': 'Error al crear colección',
    
    // === Settings ===
    'settings.title': 'Ajustes',
    'settings.general': 'General',
    'settings.llm': 'LLM',
    'settings.context': 'Contexto',
    'settings.ui': 'Interfaz',
    'settings.theme': 'Tema',
    'settings.theme.light': 'Claro',
    'settings.theme.dark': 'Oscuro',
    'settings.theme.system': 'Sistema',
    'settings.language': 'Idioma',
    
    // === LLM Settings ===
    'llm.provider': 'Proveedor',
    'llm.provider.zai': 'Z.ai Chat',
    'llm.provider.openai': 'OpenAI',
    'llm.provider.anthropic': 'Anthropic',
    'llm.provider.ollama': 'Ollama',
    'llm.provider.tgwui': 'Text Generation WebUI',
    'llm.provider.koboldcpp': 'KoboldCPP',
    'llm.provider.vllm': 'vLLM',
    'llm.provider.custom': 'Personalizado',
    'llm.apiKey': 'Clave API',
    'llm.endpoint': 'Endpoint',
    'llm.model': 'Modelo',
    'llm.temperature': 'Temperatura',
    'llm.maxTokens': 'Tokens máximos',
    'llm.topP': 'Top P',
    'llm.topK': 'Top K',
    'llm.frequencyPenalty': 'Penalización de frecuencia',
    'llm.presencePenalty': 'Penalización de presencia',
    'llm.stopStrings': 'Cadenas de parada',
    'llm.streamResponse': 'Respuesta en streaming',
    'llm.testConnection': 'Probar conexión',
    'llm.connectionSuccess': 'Conexión exitosa',
    'llm.connectionFailed': 'Conexión fallida',
    
    // === Context Settings ===
    'context.maxMessages': 'Máximo de mensajes',
    'context.maxTokens': 'Máximo de tokens',
    'context.keepFirstN': 'Mantener primeros N',
    'context.keepLastN': 'Mantener últimos N',
    'context.enableSummaries': 'Habilitar resúmenes',
    'context.summaryThreshold': 'Umbral de resumen',
    
    // === Prompt Viewer ===
    'prompt.title': 'Visor de Prompt',
    'prompt.sections': 'Secciones del prompt',
    'prompt.copyClean': 'Copiar limpio',
    'prompt.copyWithLabels': 'Copiar con etiquetas',
    'prompt.characterCount': '{{count}} caracteres',
    'prompt.estimatedTokens': '~{{tokens}} tokens',
    'prompt.section.system': 'Sistema',
    'prompt.section.persona': 'Persona',
    'prompt.section.character': 'Personaje',
    'prompt.section.scenario': 'Escenario',
    'prompt.section.history': 'Historial',
    'prompt.section.examples': 'Ejemplos',
    'prompt.section.postHistory': 'Post-historia',
    'prompt.section.instructions': 'Instrucciones',
    'prompt.section.lorebook': 'Lorebook',
    
    // === Errors ===
    'error.generic': 'Ha ocurrido un error',
    'error.network': 'Error de conexión',
    'error.notFound': 'No encontrado',
    'error.unauthorized': 'No autorizado',
    'error.validation': 'Error de validación',
    
    // === Success Messages ===
    'success.saved': 'Guardado correctamente',
    'success.deleted': 'Eliminado correctamente',
    'success.imported': 'Importado correctamente',
    'success.exported': 'Exportado correctamente',
  },
  
  en: {
    // === Common Actions ===
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.create': 'Create',
    'common.close': 'Close',
    'common.confirm': 'Confirm',
    'common.reset': 'Reset',
    'common.clear': 'Clear',
    'common.loading': 'Loading...',
    'common.uploading': 'Uploading...',
    'common.search': 'Search',
    'common.searchPlaceholder': 'Type to search...',
    'common.noResults': 'No results',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.on': 'On',
    'common.off': 'Off',
    'common.enabled': 'Enabled',
    'common.disabled': 'Disabled',
    'common.select': 'Select',
    'common.selectAll': 'Select all',
    'common.deselect': 'Deselect',
    'common.retry': 'Retry',
    'common.copy': 'Copy',
    'common.copied': 'Copied!',
    'common.export': 'Export',
    'common.import': 'Import',
    'common.download': 'Download',
    'common.upload': 'Upload',
    'common.browse': 'Browse',
    'common.refresh': 'Refresh',
    'common.expandAll': 'Expand all',
    'common.collapseAll': 'Collapse all',
    
    // === Navigation & Layout ===
    'nav.hidePanels': 'Hide panels',
    'nav.showPanels': 'Show panels',
    'nav.characters': 'Characters',
    'nav.groups': 'Groups',
    'nav.personas': 'Personas',
    'nav.settings': 'Settings',
    'nav.backgroundGallery': 'Background Gallery',
    'nav.lorebooks': 'Lorebooks',
    'nav.soundTriggers': 'Sound Triggers',
    
    // === Chat Panel ===
    'chat.title': 'Chat',
    'chat.groupTitle': 'Group Chat',
    'chat.messagePlaceholder': 'Message...',
    'chat.send': 'Send',
    'chat.reset': 'Reset',
    'chat.resetConfirm': 'Reset chat? This will clear all messages and start fresh.',
    'chat.resetFirstConfirm': 'Reset chat to the first message from the character?',
    'chat.clear': 'Clear',
    'chat.clearConfirm': 'Are you sure you want to clear all messages? This cannot be undone.',
    'chat.welcome.title': 'Welcome to TavernFlow',
    'chat.welcome.subtitle': 'Select a character from the sidebar to start chatting, or create a new character to begin your adventure.',
    'chat.noCharacter': 'No character selected',
    'chat.noLLM': 'No active LLM configuration. Please configure an LLM connection in settings.',
    'chat.noGroupCharacters': 'No characters in this group. Add characters to the group first.',
    'chat.error.streaming': 'Failed to start streaming',
    'chat.error.generation': 'Failed to generate response. Please check your LLM configuration.',
    'chat.error.regeneration': 'Failed to regenerate',
    'chat.error.noConfig': 'No active LLM configuration',
    'chat.resetPosition': 'Reset Position',
    'chat.messagesCount': ' msgs',
    
    // === Chat Message ===
    'message.you': 'You',
    'message.assistant': 'Assistant',
    'message.viewPrompt': 'View Prompt',
    'message.edit': 'Edit response',
    'message.replay': 'Replay response',
    'message.swipe.prev': 'Previous alternative',
    'message.swipe.next': 'Next alternative',
    'message.swipe.generate': 'Generate new alternative',
    'message.swipe.position': '{{current}} of {{total}}',
    
    // === Chat Box Settings ===
    'chatbox.settings': 'Chat Box Settings',
    'chatbox.width': 'Width:',
    'chatbox.height': 'Height:',
    'chatbox.opacity': 'Opacity:',
    'chatbox.blurBackground': 'Blur Background',
    'chatbox.actions': 'Chat Actions',
    'chatbox.sessionVariables': 'Session Variables',
    'chatbox.noVariables': 'No saved variables',
    'chatbox.quests': 'Quests',
    'chatbox.questsDisabled': 'Quest system is disabled',
    'chatbox.noQuests': 'No quests in this session',
    'chatbox.objectives': 'objectives',
    'chatbox.availableQuests': 'Available Quests',
    'chatbox.completedQuests': 'Completed Quests',
    
    // === Characters ===
    'character.new': 'New Character',
    'character.edit': 'Edit Character',
    'character.delete': 'Delete Character',
    'character.deleteConfirm': 'Are you sure you want to delete this character? This cannot be undone.',
    'character.name': 'Name',
    'character.description': 'Description',
    'character.personality': 'Personality',
    'character.scenario': 'Scenario',
    'character.firstMessage': 'First Message',
    'character.exampleDialogue': 'Example Dialogue',
    'character.systemPrompt': 'System Prompt',
    'character.postHistory': 'Post-History',
    'character.avatar': 'Avatar',
    'character.tags': 'Tags',
    'character.creator': 'Creator',
    'character.characterVersion': 'Character Version',
    'character.notes': 'Notes',
    'character.tts': 'Text to Speech',
    'character.tts.description': 'Configure text-to-speech for this character.',
    'character.tts.enable': 'Enable Voice',
    'character.import': 'Import Character',
    'character.export': 'Export Character',
    'character.importError': 'Failed to import character',
    'character.exportError': 'Failed to export character',
    'character.uploadError': 'Upload error',
    
    // === Groups ===
    'group.new': 'New Group',
    'group.edit': 'Edit Group',
    'group.delete': 'Delete Group',
    'group.name': 'Group Name',
    'group.characters': 'Characters',
    'group.order': 'Response Order',
    'group.roundRobin': 'Round Robin',
    'group.random': 'Random',
    'group.active': 'Active',
    'group.inactive': 'Inactive',
    
    // === Personas ===
    'persona.new': 'New Persona',
    'persona.edit': 'Edit Persona',
    'persona.delete': 'Delete Persona',
    'persona.name': 'Name',
    'persona.description': 'Description',
    'persona.default': 'Default',
    'persona.setAsDefault': 'Set as Default',
    'persona.uploadError': 'Upload error',
    
    // === Lorebooks ===
    'lorebook.title': 'Lorebook',
    'lorebook.new': 'New Lorebook',
    'lorebook.edit': 'Edit Lorebook',
    'lorebook.delete': 'Delete Lorebook',
    'lorebook.entries': 'Entries',
    'lorebook.entry': 'Entry',
    'lorebook.keywords': 'Keywords',
    'lorebook.content': 'Content',
    'lorebook.enabled': 'Enabled',
    'lorebook.position': 'Position',
    'lorebook.insertionOrder': 'Insertion Order',
    'lorebook.probability': 'Probability',
    'lorebook.useProbability': 'Use Probability',
    'lorebook.extensions': 'Extensions',
    'lorebook.caseSensitive': 'Case Sensitive',
    'lorebook.scanDepth': 'Scan Depth',
    'lorebook.tokenBudget': 'Token Budget',
    
    // === Sound Triggers ===
    'sound.title': 'Sound Triggers',
    'sound.new': 'New Trigger',
    'sound.edit': 'Edit Trigger',
    'sound.delete': 'Delete Trigger',
    'sound.trigger': 'Trigger',
    'sound.condition': 'Condition',
    'sound.sound': 'Sound',
    'sound.volume': 'Volume',
    'sound.playOn': 'Play On',
    'sound.playOn.messageSent': 'Message Sent',
    'sound.playOn.messageReceived': 'Message Received',
    'sound.playOn.swipe': 'Swipe',
    'sound.collections': 'Sound Collections',
    'sound.error.playback': 'Failed to play sound',
    'sound.error.fetch': 'Failed to fetch sound collections',
    
    // === Backgrounds ===
    'background.title': 'Background Gallery',
    'background.upload': 'Upload Background',
    'background.delete': 'Delete Background',
    'background.blur': 'Blur',
    'background.blurAmount': 'Blur Amount',
    'background.opacity': 'Opacity',
    'background.error.fetch': 'Error fetching backgrounds',
    
    // === Sprites ===
    'sprite.title': 'Sprites',
    'sprite.collections': 'Sprite Collections',
    'sprite.new': 'New Collection',
    'sprite.add': 'Add Sprite',
    'sprite.delete': 'Delete Sprite',
    'sprite.deleteCollection': 'Delete Collection',
    'sprite.position': 'Position',
    'sprite.scale': 'Scale',
    'sprite.error.fetch': 'Error fetching sprite collections',
    'sprite.error.upload': 'Error uploading sprite',
    'sprite.error.create': 'Error creating collection',
    
    // === Settings ===
    'settings.title': 'Settings',
    'settings.general': 'General',
    'settings.llm': 'LLM',
    'settings.context': 'Context',
    'settings.ui': 'Interface',
    'settings.theme': 'Theme',
    'settings.theme.light': 'Light',
    'settings.theme.dark': 'Dark',
    'settings.theme.system': 'System',
    'settings.language': 'Language',
    
    // === LLM Settings ===
    'llm.provider': 'Provider',
    'llm.provider.zai': 'Z.ai Chat',
    'llm.provider.openai': 'OpenAI',
    'llm.provider.anthropic': 'Anthropic',
    'llm.provider.ollama': 'Ollama',
    'llm.provider.tgwui': 'Text Generation WebUI',
    'llm.provider.koboldcpp': 'KoboldCPP',
    'llm.provider.vllm': 'vLLM',
    'llm.provider.custom': 'Custom',
    'llm.apiKey': 'API Key',
    'llm.endpoint': 'Endpoint',
    'llm.model': 'Model',
    'llm.temperature': 'Temperature',
    'llm.maxTokens': 'Max Tokens',
    'llm.topP': 'Top P',
    'llm.topK': 'Top K',
    'llm.frequencyPenalty': 'Frequency Penalty',
    'llm.presencePenalty': 'Presence Penalty',
    'llm.stopStrings': 'Stop Strings',
    'llm.streamResponse': 'Stream Response',
    'llm.testConnection': 'Test Connection',
    'llm.connectionSuccess': 'Connection successful',
    'llm.connectionFailed': 'Connection failed',
    
    // === Context Settings ===
    'context.maxMessages': 'Max Messages',
    'context.maxTokens': 'Max Tokens',
    'context.keepFirstN': 'Keep First N',
    'context.keepLastN': 'Keep Last N',
    'context.enableSummaries': 'Enable Summaries',
    'context.summaryThreshold': 'Summary Threshold',
    
    // === Prompt Viewer ===
    'prompt.title': 'Prompt Viewer',
    'prompt.sections': 'Prompt Sections',
    'prompt.copyClean': 'Copy Clean',
    'prompt.copyWithLabels': 'Copy with Labels',
    'prompt.characterCount': '{{count}} characters',
    'prompt.estimatedTokens': '~{{tokens}} tokens',
    'prompt.section.system': 'System',
    'prompt.section.persona': 'Persona',
    'prompt.section.character': 'Character',
    'prompt.section.scenario': 'Scenario',
    'prompt.section.history': 'History',
    'prompt.section.examples': 'Examples',
    'prompt.section.postHistory': 'Post-History',
    'prompt.section.instructions': 'Instructions',
    'prompt.section.lorebook': 'Lorebook',
    
    // === Errors ===
    'error.generic': 'An error occurred',
    'error.network': 'Network error',
    'error.notFound': 'Not found',
    'error.unauthorized': 'Unauthorized',
    'error.validation': 'Validation error',
    
    // === Success Messages ===
    'success.saved': 'Saved successfully',
    'success.deleted': 'Deleted successfully',
    'success.imported': 'Imported successfully',
    'success.exported': 'Exported successfully',
  }
};

// Default language
let currentLanguage: Language = 'es';

/**
 * Get the current language
 */
export function getCurrentLanguage(): Language {
  return currentLanguage;
}

/**
 * Set the current language
 */
export function setLanguage(lang: Language): void {
  currentLanguage = lang;
  // Store in localStorage for persistence
  if (typeof window !== 'undefined') {
    localStorage.setItem('tavernflow-language', lang);
  }
}

/**
 * Initialize language from localStorage
 */
export function initLanguage(): void {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('tavernflow-language') as Language | null;
    if (stored && (stored === 'es' || stored === 'en')) {
      currentLanguage = stored;
    }
  }
}

/**
 * Translate a key to the current language
 * Supports interpolation with {{variable}} syntax
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  const translation = translations[currentLanguage]?.[key] || translations.es[key] || key;
  
  if (vars) {
    return Object.entries(vars).reduce(
      (str, [k, v]) => str.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v)),
      translation
    );
  }
  
  return translation;
}

/**
 * Get all translations for a language
 */
export function getTranslations(lang: Language): TranslationDictionary {
  return translations[lang];
}

/**
 * Check if a key exists in translations
 */
export function hasTranslation(key: string): boolean {
  return key in translations.es || key in translations.en;
}

// Export the translations object for direct access if needed
export { translations };
