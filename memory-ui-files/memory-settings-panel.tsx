'use client';

import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Brain,
  MessageSquare,
  Users,
  Settings2,
  RotateCcw,
  ChevronDown,
  FileText,
  Save,
  Sparkles,
  Clock,
  Info,
  Database,
  User,
  Layers,
  Settings,
  Pencil,
  Eye,
} from 'lucide-react';
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { DEFAULT_SUMMARY_SETTINGS } from '@/types';
import { DEFAULT_MEMORY_EXTRACTION_PROMPT, DEFAULT_GROUP_MEMORY_EXTRACTION_PROMPT } from '@/lib/embeddings/memory-extraction-prompts';
import { CharacterMemoryEditor } from '@/components/memory/character-memory-editor';
import { SummaryViewer } from '@/components/memory/summary-viewer';

// ============================================
// Default embeddings chat settings (shared constant)
// ============================================

const DEFAULT_EMBEDDINGS_CHAT = {
  enabled: false,
  maxTokenBudget: 1024,
  namespaceStrategy: 'character' as const,
  showInPromptViewer: true,
  memoryExtractionEnabled: false,
  memoryExtractionFrequency: 5,
  memoryExtractionMinImportance: 2,
  memoryConsolidationEnabled: false,
  memoryConsolidationThreshold: 50,
  memoryConsolidationKeepRecent: 10,
  memoryConsolidationKeepHighImportance: 4,
  memoryExtractionPrompt: DEFAULT_MEMORY_EXTRACTION_PROMPT,
  groupMemoryExtractionPrompt: DEFAULT_GROUP_MEMORY_EXTRACTION_PROMPT,
  memoryExtractionContextDepth: 2,
  searchContextDepth: 2,
  groupDynamicsExtraction: false,
  memoryReinforcementEnabled: false,
  memoryReinforcementThreshold: 0.7,
  memoryExtractionFromUserEnabled: false,
  extractionModelEnabled: false,
  extractionModelProvider: 'ollama',
  extractionModelEndpoint: 'http://localhost:11434',
  extractionModelApiKey: '',
  extractionModelName: 'llama3.1:8b',
};

// ============================================
// Preview data for extraction prompts
// ============================================

const NORMAL_PREVIEW = {
  characterName: 'Alvar',
  chatContext: 'Contexto reciente de la conversación:\n  Jugador: "Me acabo de mudar a la costa, tengo un gato llamado Milo"\n  Personaje: "¡Qué genial! ¿Y cómo te va adaptando?"\n',
  lastMessage: '"Milo se lleva súper bien con los vecinos."',
};

const GROUP_PREVIEW = {
  characterName: 'Kai',
  chatContext: 'Contexto reciente del grupo:\n  Jugador: "¿Qué opinan del plan de Luna?"\n  Luna: "Yo creo que deberíamos ir por la ruta norte, es más segura."\n  Rex: "No me fío, la última vez que fuimos por ahí casi nos atrapan."\n',
  lastMessage: '"Rex tiene razón en desconfiar, pero yo prefiero arriesgarme. Además, Kai tiene contactos en el norte que podrían ayudarnos."',
};

// ============================================
// Sub-tab 1: Resúmenes
// ============================================

function ResumenesTab() {
  const summarySettings = useTavernStore((s) => s.summarySettings);
  const setSummarySettings = useTavernStore((s) => s.setSummarySettings);
  const activeSessionId = useTavernStore((s) => s.activeSessionId);

  const [promptEditorOpen, setPromptEditorOpen] = useState(false);

  // Ensure promptTemplate exists with default fallback
  const promptTemplate = summarySettings.promptTemplate ?? DEFAULT_SUMMARY_SETTINGS.promptTemplate ?? '';
  const [localPrompt, setLocalPrompt] = useState(promptTemplate);

  // Update local prompt when settings change
  const handlePromptSave = useCallback(() => {
    setSummarySettings({ promptTemplate: localPrompt });
    setPromptEditorOpen(false);
  }, [localPrompt, setSummarySettings]);

  // Reset prompt to default
  const handleResetPrompt = useCallback(() => {
    const defaultPrompt = DEFAULT_SUMMARY_SETTINGS.promptTemplate ?? '';
    setLocalPrompt(defaultPrompt);
    setSummarySettings({ promptTemplate: defaultPrompt });
  }, [setSummarySettings]);

  return (
    <div className="space-y-6">
      {/* Summary Viewer */}
      <SummaryViewer sessionId={activeSessionId ?? undefined} />

      {/* Main Enable/Disable */}
      <Card className="border-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="w-5 h-5 text-purple-500" />
            Sistema de Memoria y Resúmenes
          </CardTitle>
          <CardDescription>
            Genera resúmenes automáticos de la conversación para mantener contexto en chats largos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Activar Memoria</Label>
              <p className="text-sm text-muted-foreground">
                Genera resúmenes automáticos cuando la conversación alcance el límite configurado.
              </p>
            </div>
            <Switch
              checked={summarySettings.enabled}
              onCheckedChange={(enabled) => setSummarySettings({ enabled })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Message Interval Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="w-4 h-4 text-blue-500" />
            Intervalo de Resúmenes
          </CardTitle>
          <CardDescription>
            Define cada cuántos mensajes se generarán resúmenes automáticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Normal Chat Interval */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                <Label className="font-medium">Chat Normal</Label>
              </div>
              <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
                {summarySettings.normalChatInterval} mensajes
              </span>
            </div>
            <Slider
              value={[summarySettings.normalChatInterval]}
              min={5}
              max={50}
              step={5}
              disabled={!summarySettings.enabled}
              onValueChange={([normalChatInterval]) =>
                setSummarySettings({ normalChatInterval })
              }
            />
            <p className="text-xs text-muted-foreground">
              Se generará un resumen cada {summarySettings.normalChatInterval} mensajes en chats individuales.
            </p>
          </div>

          {/* Group Chat Interval */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <Label className="font-medium">Chat Grupal</Label>
              </div>
              <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
                {summarySettings.groupChatInterval} mensajes
              </span>
            </div>
            <Slider
              value={[summarySettings.groupChatInterval]}
              min={5}
              max={40}
              step={5}
              disabled={!summarySettings.enabled}
              onValueChange={([groupChatInterval]) =>
                setSummarySettings({ groupChatInterval })
              }
            />
            <p className="text-xs text-muted-foreground">
              Se generará un resumen cada {summarySettings.groupChatInterval} mensajes en chats grupales.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Summary Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="w-4 h-4 text-green-500" />
            Configuración de Resumen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Messages to keep */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">Mensajes recientes a conservar</Label>
              <Input
                type="number"
                value={summarySettings.keepRecentMessages}
                onChange={(e) =>
                  setSummarySettings({ keepRecentMessages: parseInt(e.target.value) || 10 })
                }
                disabled={!summarySettings.enabled}
                min={5}
                max={50}
                className="h-9"
              />
              <p className="text-xs text-muted-foreground">
                Estos mensajes no se incluirán en el resumen.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Tokens máx. del resumen</Label>
              <Input
                type="number"
                value={summarySettings.maxSummaryTokens}
                onChange={(e) =>
                  setSummarySettings({ maxSummaryTokens: parseInt(e.target.value) || 500 })
                }
                disabled={!summarySettings.enabled}
                min={100}
                max={2000}
                step={100}
                className="h-9"
              />
              <p className="text-xs text-muted-foreground">
                Límite de tokens para el resumen generado.
              </p>
            </div>
          </div>

          {/* Behavior toggles */}
          <div className="space-y-3 pt-2">
            <label className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
              <div className="space-y-0.5">
                <Label className="text-sm">Resumir al fin de turno</Label>
                <p className="text-xs text-muted-foreground">
                  Generar resumen después de que todos los personajes respondan (grupos).
                </p>
              </div>
              <Switch
                checked={summarySettings.summarizeOnTurnEnd}
                onCheckedChange={(summarizeOnTurnEnd) =>
                  setSummarySettings({ summarizeOnTurnEnd })
                }
                disabled={!summarySettings.enabled}
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
              <div className="space-y-0.5">
                <Label className="text-sm">Incluir pensamientos internos</Label>
                <p className="text-xs text-muted-foreground">
                  Incluir pensamientos y reflexiones de los personajes en el resumen.
                </p>
              </div>
              <Switch
                checked={summarySettings.includeCharacterThoughts}
                onCheckedChange={(includeCharacterThoughts) =>
                  setSummarySettings({ includeCharacterThoughts })
                }
                disabled={!summarySettings.enabled}
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
              <div className="space-y-0.5">
                <Label className="text-sm">Preservar momentos emocionales</Label>
                <p className="text-xs text-muted-foreground">
                  Destacar momentos emocionales importantes en el resumen.
                </p>
              </div>
              <Switch
                checked={summarySettings.preserveEmotionalMoments}
                onCheckedChange={(preserveEmotionalMoments) =>
                  setSummarySettings({ preserveEmotionalMoments })
                }
                disabled={!summarySettings.enabled}
              />
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Prompt Template Editor */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="w-4 h-4 text-orange-500" />
            Prompt de Resumen
          </CardTitle>
          <CardDescription>
            Personaliza el prompt que se envía al LLM para generar resúmenes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Collapsible open={promptEditorOpen} onOpenChange={setPromptEditorOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between"
                disabled={!summarySettings.enabled}
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Editar Prompt Personalizado
                </span>
                <ChevronDown className={cn(
                  "w-4 h-4 transition-transform",
                  promptEditorOpen && "rotate-180"
                )} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-4">
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                    <p><strong>Variables disponibles:</strong></p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li><code className="bg-blue-500/20 px-1 rounded">{'{{conversation}}'}</code> - Se reemplaza con la conversación a resumir</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Textarea
                value={localPrompt}
                onChange={(e) => setLocalPrompt(e.target.value)}
                disabled={!summarySettings.enabled}
                placeholder="Escribe tu prompt personalizado..."
                className="min-h-[200px] font-mono text-sm"
              />

              <div className="flex items-center justify-between">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!summarySettings.enabled}
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Restaurar Default
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Restaurar prompt por defecto?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esto reemplazará tu prompt personalizado con el prompt por defecto. Esta acción no se puede deshacer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleResetPrompt}>
                        Restaurar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Button
                  size="sm"
                  onClick={handlePromptSave}
                  disabled={!summarySettings.enabled || localPrompt === promptTemplate}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Guardar Cambios
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Prompt Preview */}
          {!promptEditorOpen && (
            <div className="mt-3">
              <Label className="text-xs text-muted-foreground mb-2 block">Vista previa del prompt:</Label>
              <div className="p-3 rounded-lg bg-muted/50 text-xs font-mono max-h-[100px] overflow-y-auto text-muted-foreground">
                {promptTemplate.length > 300
                  ? `${promptTemplate.slice(0, 300)}...`
                  : promptTemplate
                }
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// Sub-tab 2: Personaje
// ============================================

function PersonajeTab() {
  const activeCharacterId = useTavernStore((s) => s.activeCharacterId);
  const characters = useTavernStore((s) => s.characters);
  const activeCharacter = characters.find((c: any) => c.id === activeCharacterId);

  if (!activeCharacterId || !activeCharacter) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <User className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground text-sm">
            Selecciona un personaje en el panel derecho para editar su memoria.
          </p>
          <p className="text-muted-foreground/70 text-xs mt-1">
            Los eventos, relaciones y notas del personaje aparecerán aquí.
          </p>
        </CardContent>
      </Card>
    );
  }

  const characterName = activeCharacter.name || activeCharacter.data?.name || 'Personaje';

  return (
    <CharacterMemoryEditor
      characterId={activeCharacterId}
      characterName={characterName}
    />
  );
}

// ============================================
// Sub-tab 3: Extracción
// ============================================

function ExtraccionTab() {
  const embeddingsChat = useTavernStore((state) => state.settings.embeddingsChat) ?? DEFAULT_EMBEDDINGS_CHAT;
  const updateSettings = useTavernStore((state) => state.updateSettings);

  // Prompt editor state
  const [activePromptTab, setActivePromptTab] = useState<'normal' | 'group'>('normal');
  const [localPrompt, setLocalPrompt] = useState(() => embeddingsChat.memoryExtractionPrompt || DEFAULT_MEMORY_EXTRACTION_PROMPT);
  const [localGroupPrompt, setLocalGroupPrompt] = useState(() => embeddingsChat.groupMemoryExtractionPrompt || DEFAULT_GROUP_MEMORY_EXTRACTION_PROMPT);
  const [showPreview, setShowPreview] = useState(false);

  const isNormal = activePromptTab === 'normal';
  const currentPrompt = isNormal ? localPrompt : localGroupPrompt;
  const currentStored = isNormal
    ? (embeddingsChat.memoryExtractionPrompt || DEFAULT_MEMORY_EXTRACTION_PROMPT)
    : (embeddingsChat.groupMemoryExtractionPrompt || DEFAULT_GROUP_MEMORY_EXTRACTION_PROMPT);
  const previewData = isNormal ? NORMAL_PREVIEW : GROUP_PREVIEW;

  const handleSavePrompt = () => {
    if (isNormal) {
      updateSettings({ embeddingsChat: { ...embeddingsChat, memoryExtractionPrompt: localPrompt } });
    } else {
      updateSettings({ embeddingsChat: { ...embeddingsChat, groupMemoryExtractionPrompt: localGroupPrompt } });
    }
  };

  const handleRestoreDefault = () => {
    if (isNormal) {
      setLocalPrompt(DEFAULT_MEMORY_EXTRACTION_PROMPT);
      updateSettings({ embeddingsChat: { ...embeddingsChat, memoryExtractionPrompt: DEFAULT_MEMORY_EXTRACTION_PROMPT } });
    } else {
      setLocalGroupPrompt(DEFAULT_GROUP_MEMORY_EXTRACTION_PROMPT);
      updateSettings({ embeddingsChat: { ...embeddingsChat, groupMemoryExtractionPrompt: DEFAULT_GROUP_MEMORY_EXTRACTION_PROMPT } });
    }
  };

  const handleChange = (value: string) => {
    if (isNormal) setLocalPrompt(value);
    else setLocalGroupPrompt(value);
  };

  const previewText = currentPrompt
    .replace('{characterName}', previewData.characterName)
    .replace('{chatContext}', previewData.chatContext)
    .replace('{lastMessage}', previewData.lastMessage);

  const hasChanges = currentPrompt !== currentStored;

  return (
    <div className="space-y-6">
      {/* Note about needing Embeddings enabled */}
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Requiere Embeddings</p>
            <p className="text-xs text-muted-foreground">
              Estos ajustes requieren que Embeddings esté activado. Configúralo en la pestaña <strong>Base de Conocimiento</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Memory Extraction Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="w-4 h-4 text-violet-500" />
            Extracción Automática de Memoria
          </CardTitle>
          <CardDescription>
            Extrae hechos memorables de las respuestas del personaje y los guarda como embeddings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Activar Extracción</Label>
              <p className="text-[10px] text-muted-foreground">
                Extrae automáticamente hechos memorables tras cada respuesta del personaje
              </p>
            </div>
            <Switch
              checked={!!embeddingsChat.memoryExtractionEnabled}
              onCheckedChange={(enabled) => {
                updateSettings({
                  embeddingsChat: { ...embeddingsChat, memoryExtractionEnabled: enabled },
                });
              }}
            />
          </div>

          {embeddingsChat.memoryExtractionEnabled && (
            <div className="space-y-3 pl-1 border-l-2 border-violet-300/30">
              <div className="space-y-2">
                <Label className="text-xs">Frecuencia: cada {embeddingsChat.memoryExtractionFrequency || 5} turnos</Label>
                <Slider
                  value={[embeddingsChat.memoryExtractionFrequency || 5]}
                  min={1}
                  max={20}
                  step={1}
                  onValueChange={([v]) => {
                    updateSettings({
                      embeddingsChat: { ...embeddingsChat, memoryExtractionFrequency: v },
                    });
                  }}
                />
                <p className="text-[10px] text-muted-foreground">
                  Un turno = 1 mensaje del usuario + respuesta(s). Más frecuente = más contexto, pero más uso del LLM.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Importancia mínima: {embeddingsChat.memoryExtractionMinImportance || 2}/5</Label>
                <Slider
                  value={[embeddingsChat.memoryExtractionMinImportance || 2]}
                  min={1}
                  max={5}
                  step={1}
                  onValueChange={([v]) => {
                    updateSettings({
                      embeddingsChat: { ...embeddingsChat, memoryExtractionMinImportance: v },
                    });
                  }}
                />
                <p className="text-[10px] text-muted-foreground">
                  Solo se guardan hechos con importancia igual o mayor. Más alto = solo lo más relevante.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Profundidad de contexto: {embeddingsChat.memoryExtractionContextDepth ?? 2} mensajes</Label>
                <Slider
                  value={[embeddingsChat.memoryExtractionContextDepth ?? 2]}
                  min={0}
                  max={5}
                  step={1}
                  onValueChange={([v]) => {
                    updateSettings({
                      embeddingsChat: { ...embeddingsChat, memoryExtractionContextDepth: v },
                    });
                  }}
                />
                <p className="text-[10px] text-muted-foreground">
                  Cuántos mensajes recientes incluir como contexto para el LLM. 0 = solo la respuesta del personaje. Más contexto = mejor comprensión de referencias, pero más tokens.
                </p>
              </div>

              <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Brain className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Memoria con Contexto</p>
                    <ul className="text-[10px] text-muted-foreground space-y-0.5 list-disc list-inside">
                      <li>Se incluyen los últimos N mensajes como contexto para que el LLM entienda referencias implícitas</li>
                      <li>En grupo, cada personaje ve las respuestas de los demás para capturar dinámicas de conversación</li>
                      <li>La extracción es asíncrona — no afecta la velocidad de respuesta</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* User Message Extraction Toggle */}
              <div className="flex items-center justify-between pt-2">
                <div className="space-y-0.5">
                  <Label className="text-sm">Extraer también de mensajes del usuario</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Captura hechos, preferencias y datos personales que el jugador comparte en sus mensajes
                  </p>
                </div>
                <Switch
                  checked={!!embeddingsChat.memoryExtractionFromUserEnabled}
                  onCheckedChange={(enabled) => {
                    updateSettings({
                      embeddingsChat: { ...embeddingsChat, memoryExtractionFromUserEnabled: enabled },
                    });
                  }}
                />
              </div>

              {embeddingsChat.memoryExtractionFromUserEnabled && (
                <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <User className="w-4 h-4 text-cyan-500 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-cyan-600 dark:text-cyan-400">Memoria del Usuario</p>
                      <ul className="text-[10px] text-muted-foreground space-y-0.5 list-disc list-inside">
                        <li>Se extraen hechos del último mensaje del jugador (nombre, preferencias, datos personales)</li>
                        <li>Solo se procesan mensajes con más de 20 caracteres (se ignoran respuestas cortas)</li>
                        <li>Las memorias del usuario se marcan con sujeto "usuario" para distinguirlas</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Separate Extraction Model Section */}
      {embeddingsChat.memoryExtractionEnabled && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="w-4 h-4 text-teal-500" />
              Modelo de Extracción Separado
            </CardTitle>
            <CardDescription>
              Usa un modelo diferente (más rápido/barato) para extracción y consolidación de memoria
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Usar modelo separado</Label>
                <p className="text-[10px] text-muted-foreground">
                  Desvía la carga de extracción a un modelo más eficiente
                </p>
              </div>
              <Switch
                checked={!!embeddingsChat.extractionModelEnabled}
                onCheckedChange={(enabled) => {
                  updateSettings({
                    embeddingsChat: { ...embeddingsChat, extractionModelEnabled: enabled },
                  });
                }}
              />
            </div>

            {embeddingsChat.extractionModelEnabled && (
              <div className="space-y-3 pl-1 border-l-2 border-teal-300/30">
                <div className="space-y-2">
                  <Label className="text-xs">Proveedor</Label>
                  <Select
                    value={embeddingsChat.extractionModelProvider || 'ollama'}
                    onValueChange={(v) => {
                      updateSettings({
                        embeddingsChat: { ...embeddingsChat, extractionModelProvider: v },
                      });
                    }}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ollama">Ollama (Local)</SelectItem>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="grok">Grok (xAI)</SelectItem>
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                      <SelectItem value="z-ai">Z-AI</SelectItem>
                      <SelectItem value="lm-studio">LM Studio</SelectItem>
                      <SelectItem value="text-generation-webui">Text Generation WebUI</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Endpoint (for providers that need it) */}
                {!['z-ai'].includes(embeddingsChat.extractionModelProvider || 'ollama') && (
                  <div className="space-y-2">
                    <Label className="text-xs">Endpoint</Label>
                    <Input
                      type="text"
                      value={embeddingsChat.extractionModelEndpoint || 'http://localhost:11434'}
                      onChange={(e) => {
                        updateSettings({
                          embeddingsChat: { ...embeddingsChat, extractionModelEndpoint: e.target.value },
                        });
                      }}
                      className="h-8 text-sm"
                      placeholder="http://localhost:11434"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      URL del servidor del modelo de extracción
                    </p>
                  </div>
                )}

                {/* API Key (for providers that need it) */}
                {['openai', 'grok', 'anthropic', 'custom'].includes(embeddingsChat.extractionModelProvider || 'ollama') && (
                  <div className="space-y-2">
                    <Label className="text-xs">API Key</Label>
                    <Input
                      type="password"
                      value={embeddingsChat.extractionModelApiKey || ''}
                      onChange={(e) => {
                        updateSettings({
                          embeddingsChat: { ...embeddingsChat, extractionModelApiKey: e.target.value },
                        });
                      }}
                      className="h-8 text-sm"
                      placeholder="sk-..."
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Clave API para el proveedor seleccionado
                    </p>
                  </div>
                )}

                {/* Model name */}
                <div className="space-y-2">
                  <Label className="text-xs">Modelo</Label>
                  <Input
                    type="text"
                    value={embeddingsChat.extractionModelName || 'llama3.1:8b'}
                    onChange={(e) => {
                      updateSettings({
                        embeddingsChat: { ...embeddingsChat, extractionModelName: e.target.value },
                      });
                    }}
                    className="h-8 text-sm"
                    placeholder="llama3.1:8b"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Nombre del modelo para extracción. Se recomienda un modelo rápido y barato (ej: llama3.1:8b, gpt-4o-mini)
                  </p>
                </div>

                <div className="bg-teal-500/5 border border-teal-500/20 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Settings className="w-4 h-4 text-teal-500 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-teal-600 dark:text-teal-400">Modelo Separado</p>
                      <ul className="text-[10px] text-muted-foreground space-y-0.5 list-disc list-inside">
                        <li>La extracción y consolidación de memoria usan este modelo en lugar del modelo de chat</li>
                        <li>Ideal para usar un modelo local (Ollama) o barato (gpt-4o-mini) para tareas de fondo</li>
                        <li>Ahorra tokens y costo al no usar el modelo principal de chat para extracción</li>
                        <li>El modelo de extracción solo necesita entender texto y generar JSON</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Memory Consolidation Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="w-4 h-4 text-violet-500" />
            Consolidación de Memoria
          </CardTitle>
          <CardDescription>
            Comprime memorias antiguas cuando un namespace excede el límite
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Activar Consolidación</Label>
              <p className="text-[10px] text-muted-foreground">
                Comprime automáticamente memorias antiguas para ahorrar espacio
              </p>
            </div>
            <Switch
              checked={!!embeddingsChat.memoryConsolidationEnabled}
              onCheckedChange={(enabled) => {
                updateSettings({
                  embeddingsChat: { ...embeddingsChat, memoryConsolidationEnabled: enabled },
                });
              }}
            />
          </div>

          {embeddingsChat.memoryConsolidationEnabled && (
            <div className="space-y-3 pl-1 border-l-2 border-violet-300/30">
              <div className="space-y-2">
                <Label className="text-xs">Umbral de consolidación: {embeddingsChat.memoryConsolidationThreshold || 50} embeddings</Label>
                <Slider
                  value={[embeddingsChat.memoryConsolidationThreshold || 50]}
                  min={20}
                  max={200}
                  step={10}
                  onValueChange={([v]) => {
                    updateSettings({
                      embeddingsChat: { ...embeddingsChat, memoryConsolidationThreshold: v },
                    });
                  }}
                />
                <p className="text-[10px] text-muted-foreground">
                  Cuando un namespace supera esta cantidad, se consolida automáticamente
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Memorias recientes protegidas: {embeddingsChat.memoryConsolidationKeepRecent || 10}</Label>
                <Slider
                  value={[embeddingsChat.memoryConsolidationKeepRecent || 10]}
                  min={3}
                  max={30}
                  step={1}
                  onValueChange={([v]) => {
                    updateSettings({
                      embeddingsChat: { ...embeddingsChat, memoryConsolidationKeepRecent: v },
                    });
                  }}
                />
                <p className="text-[10px] text-muted-foreground">
                  Las N memorias más recientes nunca se consolidan
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Proteger importancia ≥ {embeddingsChat.memoryConsolidationKeepHighImportance || 4}/5</Label>
                <Slider
                  value={[embeddingsChat.memoryConsolidationKeepHighImportance || 4]}
                  min={2}
                  max={5}
                  step={1}
                  onValueChange={([v]) => {
                    updateSettings({
                      embeddingsChat: { ...embeddingsChat, memoryConsolidationKeepHighImportance: v },
                    });
                  }}
                />
                <p className="text-[10px] text-muted-foreground">
                  Memorias con esta importancia o mayor nunca se consolidan
                </p>
              </div>

              <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Layers className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Consolidación Inteligente</p>
                    <ul className="text-[10px] text-muted-foreground space-y-0.5 list-disc list-inside">
                      <li>Agrupa memorias antiguas por tipo (hechos, eventos, relaciones...)</li>
                      <li>El LLM combina hechos relacionados en resúmenes concisos</li>
                      <li>Las memorias de alta importancia y recientes siempre se preservan</li>
                      <li>Se ejecuta automáticamente después de cada extracción que supera el umbral</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Memory Reinforcement Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Refuerzo de Memorias
          </CardTitle>
          <CardDescription>
            Incrementa importancia cuando el LLM menciona memorias existentes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Activar Refuerzo</Label>
              <p className="text-[10px] text-muted-foreground">
                Las memorias mencionadas se refuerzan automáticamente
              </p>
            </div>
            <Switch
              checked={!!embeddingsChat.memoryReinforcementEnabled}
              onCheckedChange={(enabled) => {
                updateSettings({
                  embeddingsChat: { ...embeddingsChat, memoryReinforcementEnabled: enabled },
                });
              }}
            />
          </div>

          {embeddingsChat.memoryReinforcementEnabled && (
            <div className="space-y-3 pl-1 border-l-2 border-amber-300/30">
              <div className="space-y-2">
                <Label className="text-xs">Umbral de similitud: {Math.round((embeddingsChat.memoryReinforcementThreshold || 0.7) * 100)}%</Label>
                <Slider
                  value={[embeddingsChat.memoryReinforcementThreshold || 0.7]}
                  min={0.3}
                  max={0.95}
                  step={0.05}
                  onValueChange={([v]) => {
                    updateSettings({
                      embeddingsChat: { ...embeddingsChat, memoryReinforcementThreshold: v },
                    });
                  }}
                />
                <p className="text-[10px] text-muted-foreground">
                  Cuánta similitud para considerar que una memoria fue mencionada. Más bajo = más memorias refuerzo, pero puede haber falsos positivos.
                </p>
              </div>
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Refuerzo por Repetición</p>
                    <ul className="text-[10px] text-muted-foreground space-y-0.5 list-disc list-inside">
                      <li>Cuando el LLM menciona o parafrasea una memoria existente</li>
                      <li>La importancia de esa memoria aumenta automáticamente</li>
                      <li>Las memorias más reforzadas se preservan mejor en la consolidación</li>
                      <li>Ayuda a que el sistema priorice memorias que el personaje "recuerda"</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Group Dynamics Extraction */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="w-4 h-4 text-fuchsia-500" />
            Dinámicas Grupales
          </CardTitle>
          <CardDescription>
            Extrae relaciones entre personajes en chats de grupo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Activar Dinámicas Grupales</Label>
              <p className="text-[10px] text-muted-foreground">
                Detecta automáticamente interacciones y relaciones entre personajes
              </p>
            </div>
            <Switch
              checked={!!embeddingsChat.groupDynamicsExtraction}
              onCheckedChange={(enabled) => {
                updateSettings({
                  embeddingsChat: { ...embeddingsChat, groupDynamicsExtraction: enabled },
                });
              }}
            />
          </div>

          {embeddingsChat.groupDynamicsExtraction && (
            <div className="bg-fuchsia-500/5 border border-fuchsia-500/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Layers className="w-4 h-4 text-fuchsia-500 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-fuchsia-600 dark:text-fuchsia-400">Dinámicas de Grupo</p>
                  <ul className="text-[10px] text-muted-foreground space-y-0.5 list-disc list-inside">
                    <li>Analiza todo el turno de conversación para detectar interacciones entre personajes</li>
                    <li>Extrae alianzas, conflictos, y tendencias de relación</li>
                    <li>Se ejecuta automáticamente cuando 2+ personajes responden en el mismo turno</li>
                    <li>Las dinámicas se guardan en el namespace del grupo</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search Context Depth */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="w-4 h-4 text-cyan-500" />
            Contexto de Búsqueda
          </CardTitle>
          <CardDescription>
            Configura cuánto contexto se usa al buscar embeddings relevantes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Contexto de búsqueda: {embeddingsChat.searchContextDepth ?? 1} mensajes</Label>
            <Slider
              value={[embeddingsChat.searchContextDepth ?? 1]}
              min={0}
              max={5}
              step={1}
              onValueChange={([v]) => {
                updateSettings({
                  embeddingsChat: { ...embeddingsChat, searchContextDepth: v },
                });
              }}
            />
            <p className="text-[10px] text-muted-foreground">
              Mensajes recientes que se agregan a tu pregunta para enriquecer la búsqueda de embeddings. 0 = solo tu mensaje. Valores altos = mejores resultados con referencias implícitas ("¿recuerdas eso?").
            </p>
          </div>
        </CardContent>
      </Card>

      {/* How it works info box */}
      <div className="bg-violet-500/5 border border-violet-500/20 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <Brain className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-xs font-medium text-violet-600 dark:text-violet-400">Cómo funciona</p>
            <ul className="text-[10px] text-muted-foreground space-y-0.5 list-disc list-inside">
              <li>Cuando envías un mensaje, el sistema genera un vector embedding de tu texto</li>
              <li>Si hay contexto de búsqueda, se concatena con tu mensaje para encontrar resultados más relevantes</li>
              <li>Busca en los namespaces seleccionados embeddings similares</li>
              <li>Los mejores resultados se inyectan en el prompt de la IA como contexto</li>
              <li>La IA usa este contexto para generar respuestas más informadas</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Prompts Editor */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Pencil className="w-4 h-4 text-violet-500" />
            Prompts de Extracción
          </CardTitle>
          <CardDescription>
            Personaliza los prompts que el LLM usa para extraer hechos memorables
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Prompt type info */}
          <div className="bg-violet-500/5 border border-violet-500/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Pencil className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-xs font-medium text-violet-600 dark:text-violet-400">Prompts de Extracción de Memoria</p>
                <p className="text-[10px] text-muted-foreground">
                  Personaliza los prompts que el LLM usa para extraer hechos memorables. Puedes configurar un prompt diferente para chat normal y chats de grupo.
                </p>
              </div>
            </div>
          </div>

          {/* Sub-tabs for normal vs group */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            <button
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                isNormal ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setActivePromptTab('normal')}
            >
              <MessageSquare className="w-3 h-3" />
              Chat Normal
              {embeddingsChat.memoryExtractionPrompt && embeddingsChat.memoryExtractionPrompt !== DEFAULT_MEMORY_EXTRACTION_PROMPT && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Personalizado" />
              )}
            </button>
            <button
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                !isNormal ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setActivePromptTab('group')}
            >
              <Layers className="w-3 h-3" />
              Chat Grupo
              {embeddingsChat.groupMemoryExtractionPrompt && embeddingsChat.groupMemoryExtractionPrompt !== DEFAULT_GROUP_MEMORY_EXTRACTION_PROMPT && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Personalizado" />
              )}
            </button>
          </div>

          {/* Info box for current prompt type */}
          {isNormal ? (
            <div className="text-[10px] text-muted-foreground space-y-1 bg-blue-500/5 border border-blue-500/20 rounded-lg p-2.5">
              <p className="font-medium text-blue-600 dark:text-blue-400">Chat Normal (1:1)</p>
              <p>Optimizado para la relación entre el jugador y un único personaje. Se enfoca en hechos sobre el usuario, preferencias y eventos compartidos.</p>
              <p>Variables: <code className="bg-muted px-1 py-0.5 rounded">{'{characterName}'}</code> <code className="bg-muted px-1 py-0.5 rounded">{'{lastMessage}'}</code> <code className="bg-muted px-1 py-0.5 rounded">{'{chatContext}'}</code></p>
            </div>
          ) : (
            <div className="text-[10px] text-muted-foreground space-y-1 bg-fuchsia-500/5 border border-fuchsia-500/20 rounded-lg p-2.5">
              <p className="font-medium text-fuchsia-600 dark:text-fuchsia-400">Chat Grupo (individual por personaje)</p>
              <p>Optimizado para capturar interacciones entre personajes. Presta atención a reacciones, opiniones sobre otros y dinámicas interpersonales del contexto grupal.</p>
              <p>Variables: <code className="bg-muted px-1 py-0.5 rounded">{'{characterName}'}</code> <code className="bg-muted px-1 py-0.5 rounded">{'{lastMessage}'}</code> <code className="bg-muted px-1 py-0.5 rounded">{'{chatContext}'}</code> (incluye respuestas de otros personajes)</p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Prompt personalizado</Label>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[10px] px-2"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  <Eye className="w-3 h-3 mr-1" />
                  {showPreview ? 'Ocultar Vista Previa' : 'Vista Previa'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[10px] px-2 text-muted-foreground hover:text-foreground"
                  onClick={handleRestoreDefault}
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Restaurar Predeterminado
                </Button>
              </div>
            </div>
            <Textarea
              value={currentPrompt}
              onChange={(e) => handleChange(e.target.value)}
              rows={18}
              className="text-xs font-mono leading-relaxed"
              placeholder={isNormal ? "Escribe el prompt personalizado para extracción de memoria en chat normal..." : "Escribe el prompt personalizado para extracción de memoria en chat de grupo..."}
            />
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">
                {currentPrompt.length} caracteres
                {hasChanges && (
                  <span className="text-amber-500 ml-2">● Sin guardar</span>
                )}
              </p>
              <Button
                size="sm"
                disabled={!hasChanges}
                onClick={handleSavePrompt}
              >
                Guardar Prompt
              </Button>
            </div>
          </div>

          {showPreview && (
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1.5">
                <Eye className="w-3 h-3" />
                Vista Previa — {isNormal ? 'Chat Normal' : 'Chat Grupo'} (con variables reemplazadas)
              </Label>
              <div className="p-3 rounded-lg border bg-muted/30 max-h-96 overflow-y-auto">
                <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground">{previewText}</pre>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Variables reemplazadas: <code className="bg-muted px-1 py-0.5 rounded text-[10px]">{'{characterName}'}</code> → &quot;{previewData.characterName}&quot;,
                <code className="bg-muted px-1 py-0.5 rounded text-[10px] ml-1">{'{chatContext}'}</code> → contexto de ejemplo,
                <code className="bg-muted px-1 py-0.5 rounded text-[10px] ml-1">{'{lastMessage}'}</code> → un mensaje de ejemplo.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// Sub-tab 4: Contexto
// ============================================

function ContextoTab() {
  const settings = useTavernStore((s) => s.settings);
  const updateSettings = useTavernStore((s) => s.updateSettings);
  const embeddingsChat = settings.embeddingsChat ?? DEFAULT_EMBEDDINGS_CHAT;

  // Context settings with defaults
  const contextSettings = settings.context ?? {
    maxMessages: 50,
    maxTokens: 4096,
    keepFirstN: 1,
    keepLastN: 20,
  };

  // Update context settings helper
  const updateContextSettings = useCallback((updates: Partial<typeof contextSettings>) => {
    updateSettings({
      context: { ...contextSettings, ...updates }
    });
  }, [contextSettings, updateSettings]);

  return (
    <div className="space-y-6">
      {/* Context Limits Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="w-4 h-4 text-cyan-500" />
            Límites de Contexto
          </CardTitle>
          <CardDescription>
            Controla cuántos mensajes se envían al LLM. Un contexto más pequeño ahorra tokens,
            mientras que un contexto más grande mantiene más historial.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Max Messages Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <Label>Máximo de Mensajes</Label>
              <span className="text-muted-foreground">{contextSettings.maxMessages}</span>
            </div>
            <Slider
              value={[contextSettings.maxMessages]}
              min={10}
              max={200}
              step={5}
              onValueChange={([maxMessages]) => updateContextSettings({ maxMessages })}
            />
            <p className="text-xs text-muted-foreground">
              Ventana deslizante de mensajes. Los mensajes más antiguos se excluyen.
            </p>
          </div>

          {/* Max Tokens Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <Label>Límite de Tokens</Label>
              <span className="text-muted-foreground">{contextSettings.maxTokens}</span>
            </div>
            <Slider
              value={[contextSettings.maxTokens]}
              min={1024}
              max={128000}
              step={512}
              onValueChange={([maxTokens]) => updateContextSettings({ maxTokens })}
            />
            <p className="text-xs text-muted-foreground">
              Presupuesto de tokens para el historial. Se ajusta según el proveedor.
            </p>
          </div>

          {/* Keep First/Last N */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Conservar Primeros N</Label>
              <Input
                type="number"
                value={contextSettings.keepFirstN}
                onChange={(e) => updateContextSettings({ keepFirstN: parseInt(e.target.value) || 1 })}
                min={0}
                max={10}
                className="h-9"
              />
              <p className="text-xs text-muted-foreground">Mensaje de saludo</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Conservar Últimos N</Label>
              <Input
                type="number"
                value={contextSettings.keepLastN}
                onChange={(e) => updateContextSettings({ keepLastN: parseInt(e.target.value) || 20 })}
                min={5}
                max={50}
                className="h-9"
              />
              <p className="text-xs text-muted-foreground">Mensajes recientes</p>
            </div>
          </div>

          {/* Info box */}
          <div className="p-3 rounded-lg bg-muted/30 text-xs space-y-1">
            <p className="font-medium">¿Cómo funciona la ventana deslizante?</p>
            <ul className="text-muted-foreground space-y-1">
              <li>• Los mensajes se excluyen del centro cuando exceden el límite.</li>
              <li>• El mensaje de saludo siempre se conserva.</li>
              <li>• Los últimos N mensajes recientes siempre se incluyen.</li>
              <li>• El límite de tokens tiene prioridad sobre el conteo de mensajes.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Embeddings Chat Context */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="w-4 h-4 text-purple-500" />
            Contexto de Embeddings en Chat
          </CardTitle>
          <CardDescription>
            Recupera automáticamente embeddings relevantes al chatear y los inyecta como contexto en el prompt de la IA.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Activar en Chat</Label>
              <p className="text-[10px] text-muted-foreground">
                Busca embeddings en cada mensaje y agrega contexto al prompt
              </p>
            </div>
            <Switch
              checked={embeddingsChat.enabled}
              onCheckedChange={(enabled) => {
                updateSettings({
                  embeddingsChat: { ...embeddingsChat, enabled },
                });
              }}
            />
          </div>

          {embeddingsChat.enabled && (
            <>
              <Separator />

              <div className="space-y-2">
                <Label className="text-xs">Estrategia de Búsqueda por Namespace</Label>
                <Select
                  value={embeddingsChat.namespaceStrategy}
                  onValueChange={(v) => {
                    updateSettings({
                      embeddingsChat: { ...embeddingsChat, namespaceStrategy: v as 'global' | 'character' | 'session' },
                    });
                  }}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="character">
                      <div className="flex flex-col">
                        <span>Por Personaje</span>
                        <span className="text-[10px] text-muted-foreground">Busca namespaces específicos del personaje + default + mundo</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="session">
                      <div className="flex flex-col">
                        <span>Por Sesión</span>
                        <span className="text-[10px] text-muted-foreground">Busca namespaces de sesión + personaje + default</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="global">
                      <div className="flex flex-col">
                        <span>Global (Todos)</span>
                        <span className="text-[10px] text-muted-foreground">Busca todos los namespaces sin importar personaje o sesión</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Presupuesto de Tokens de Contexto: ~{embeddingsChat.maxTokenBudget} tokens</Label>
                <Slider
                  value={[embeddingsChat.maxTokenBudget]}
                  min={128}
                  max={4096}
                  step={128}
                  onValueChange={([v]) => {
                    updateSettings({
                      embeddingsChat: { ...embeddingsChat, maxTokenBudget: v },
                    });
                  }}
                />
                <p className="text-[10px] text-muted-foreground">
                  Limita cuántos tokens de contexto de embeddings se agregan al prompt. Valores más altos dan más contexto pero usan más de la ventana de contexto.
                </p>
              </div>

              {/* How it works info box for context retrieval */}
              <div className="bg-violet-500/5 border border-violet-500/20 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Brain className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-violet-600 dark:text-violet-400">Cómo funciona la recuperación de contexto</p>
                    <ul className="text-[10px] text-muted-foreground space-y-0.5 list-disc list-inside">
                      <li>Cuando envías un mensaje, el sistema genera un vector embedding de tu texto</li>
                      <li>Si hay contexto de búsqueda, se concatena con tu mensaje para encontrar resultados más relevantes</li>
                      <li>Busca en los namespaces seleccionados embeddings similares</li>
                      <li>Los mejores resultados se inyectan en el prompt de la IA como contexto</li>
                      <li>La IA usa este contexto para generar respuestas más informadas</li>
                    </ul>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// Main Panel Component
// ============================================

export function MemorySettingsPanel() {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="resumenes" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="resumenes" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Resúmenes</span>
            <span className="sm:hidden">Resum.</span>
          </TabsTrigger>
          <TabsTrigger value="personaje" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <User className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Personaje</span>
            <span className="sm:hidden">Pers.</span>
          </TabsTrigger>
          <TabsTrigger value="extraccion" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Brain className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Extracción</span>
            <span className="sm:hidden">Ext.</span>
          </TabsTrigger>
          <TabsTrigger value="contexto" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Database className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Contexto</span>
            <span className="sm:hidden">Ctx.</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumenes" className="mt-4">
          <ResumenesTab />
        </TabsContent>

        <TabsContent value="personaje" className="mt-4">
          <PersonajeTab />
        </TabsContent>

        <TabsContent value="extraccion" className="mt-4">
          <ExtraccionTab />
        </TabsContent>

        <TabsContent value="contexto" className="mt-4">
          <ContextoTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
