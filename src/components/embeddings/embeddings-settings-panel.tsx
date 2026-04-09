'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Brain,
  Search,
  Plus,
  Trash2,
  RefreshCw,
  Database,
  Settings,
  ChevronDown,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  MessageSquare,
  FolderOpen,
  Tag,
  BarChart3,
  Globe,
  FileText,
  Layers,
  Upload,
  File,
  Eye,
  ArrowLeft,
  FileCode,
  Code,
  FileType,
  List,
  Pencil,
  RotateCcw,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useTavernStore } from '@/store/tavern-store';
import { DEFAULT_MEMORY_EXTRACTION_PROMPT, DEFAULT_GROUP_MEMORY_EXTRACTION_PROMPT, MEMORY_PROMPT_VARIABLES, GROUP_MEMORY_PROMPT_VARIABLES } from '@/lib/embeddings/memory-extraction-prompts';

interface EmbeddingConfig {
  ollamaUrl: string;
  model: string;
  dimension: number;
  similarityThreshold: number;
  maxResults: number;
  tableDimension?: number | null;
}

interface EmbeddingRecord {
  id: string;
  content: string;
  metadata: Record<string, any>;
  namespace: string;
  source_type?: string;
  source_id?: string;
  created_at: string;
}

interface NamespaceRecord {
  id: string;
  namespace: string;
  description?: string;
  type?: string;
  created_at: string;
  updated_at: string;
  embedding_count?: number;
}

interface DocumentRecord {
  source_id: string;
  source_type: string;
  count: number;
  firstChunk: string;
  created_at: string;
  ids: string[];
}

interface EmbeddingStats {
  totalEmbeddings: number;
  totalNamespaces: number;
  embeddingsByNamespace: Record<string, number>;
  embeddingsBySourceType: Record<string, number>;
}

interface SearchResult {
  id: string;
  content: string;
  namespace: string;
  source_type?: string;
  similarity: number;
}

interface SearchMeta {
  model: string;
  threshold: number;
  limit: number;
  namespace: string;
}

interface ChunkPreview {
  chunks: string[];
  totalChunks: number;
  totalCharacters: number;
  avgChunkSize: number;
}

const KNOWN_MODELS = [
  { name: 'nomic-embed-text', dimension: 768 },
  { name: 'nomic-embed-text:latest', dimension: 768 },
  { name: 'nomic-embed-text-v2-moe', dimension: 768 },
  { name: 'nomic-embed-text-v2-moe:latest', dimension: 768 },
  { name: 'bge-m3', dimension: 1024 },
  { name: 'bge-m3:567m', dimension: 1024 },
  { name: 'mxbai-embed-large', dimension: 1024 },
  { name: 'all-minilm', dimension: 384 },
  { name: 'snowflake-arctic-embed', dimension: 1024 },
];

const SPLITTER_OPTIONS = [
  {
    value: 'character',
    label: 'Divisor por Caracteres',
    icon: FileType,
    description: 'División simple por conteo de caracteres',
    defaultChunkSize: 1000,
    defaultOverlap: 200,
  },
  {
    value: 'recursive-character',
    label: 'Divisor Recursivo',
    icon: List,
    description: 'Intenta párrafos, líneas, palabras para cortes naturales',
    defaultChunkSize: 1000,
    defaultOverlap: 200,
  },
  {
    value: 'markdown',
    label: 'Divisor Markdown',
    icon: FileText,
    description: 'Divide por encabezados markdown primero',
    defaultChunkSize: 1000,
    defaultOverlap: 200,
  },
  {
    value: 'code',
    label: 'Divisor de Código',
    icon: Code,
    description: 'Divide por estructuras de código (clases, funciones)',
    defaultChunkSize: 1500,
    defaultOverlap: 300,
  },
];

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
  searchContextDepth: 1,
  groupDynamicsExtraction: false,
};

// ============================================
// Chat Integration Sub-component (inline content, no Collapsible)
// ============================================

function EmbeddingsChatIntegrationContent() {
  const embeddingsChat = useTavernStore((state) => state.settings.embeddingsChat) ?? DEFAULT_EMBEDDINGS_CHAT;
  const updateSettings = useTavernStore((state) => state.updateSettings);

  const handleToggleEnabled = (enabled: boolean) => {
    updateSettings({
      embeddingsChat: { ...embeddingsChat, enabled },
    });
  };

  const handleStrategyChange = (strategy: 'global' | 'character' | 'session') => {
    updateSettings({
      embeddingsChat: { ...embeddingsChat, namespaceStrategy: strategy },
    });
  };

  const handleBudgetChange = (value: number) => {
    updateSettings({
      embeddingsChat: { ...embeddingsChat, maxTokenBudget: value },
    });
  };

  const handleToggleMemoryExtraction = (enabled: boolean) => {
    updateSettings({
      embeddingsChat: { ...embeddingsChat, memoryExtractionEnabled: enabled },
    });
  };

  const handleFrequencyChange = (value: number) => {
    updateSettings({
      embeddingsChat: { ...embeddingsChat, memoryExtractionFrequency: value },
    });
  };

  const handleMinImportanceChange = (value: number) => {
    updateSettings({
      embeddingsChat: { ...embeddingsChat, memoryExtractionMinImportance: value },
    });
  };

  const handleToggleConsolidation = (enabled: boolean) => {
    updateSettings({
      embeddingsChat: { ...embeddingsChat, memoryConsolidationEnabled: enabled },
    });
  };

  const handleThresholdChange = (value: number) => {
    updateSettings({
      embeddingsChat: { ...embeddingsChat, memoryConsolidationThreshold: value },
    });
  };

  const handleKeepRecentChange = (value: number) => {
    updateSettings({
      embeddingsChat: { ...embeddingsChat, memoryConsolidationKeepRecent: value },
    });
  };

  const handleKeepHighImportanceChange = (value: number) => {
    updateSettings({
      embeddingsChat: { ...embeddingsChat, memoryConsolidationKeepHighImportance: value },
    });
  };

  const handleExtractionContextDepthChange = (value: number) => {
    updateSettings({
      embeddingsChat: { ...embeddingsChat, memoryExtractionContextDepth: value },
    });
  };

  const handleSearchContextDepthChange = (value: number) => {
    updateSettings({
      embeddingsChat: { ...embeddingsChat, searchContextDepth: value },
    });
  };

  const handleToggleGroupDynamics = (enabled: boolean) => {
    updateSettings({
      embeddingsChat: { ...embeddingsChat, groupDynamicsExtraction: enabled },
    });
  };

  return (
    <Card>
      <CardContent className="pt-4 space-y-4">
        <p className="text-xs text-muted-foreground">
          Recupera automáticamente embeddings relevantes al chatear y los inyecta como contexto en el prompt de la IA.
          Funciona tanto en chats normales como grupales.
        </p>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm">Activar en Chat</Label>
            <p className="text-[10px] text-muted-foreground">
              Busca embeddings en cada mensaje y agrega contexto al prompt
            </p>
          </div>
          <Switch
            checked={embeddingsChat.enabled}
            onCheckedChange={handleToggleEnabled}
          />
        </div>

        {embeddingsChat.enabled && (
          <>
            <Separator />

            <div className="space-y-2">
              <Label className="text-xs">Estrategia de Búsqueda por Namespace</Label>
              <Select value={embeddingsChat.namespaceStrategy} onValueChange={(v) => handleStrategyChange(v as 'global' | 'character' | 'session')}>
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
                onValueChange={([v]) => handleBudgetChange(v)}
              />
              <p className="text-[10px] text-muted-foreground">
                Limita cuántos tokens de contexto de embeddings se agregan al prompt. Valores más altos dan más contexto pero usan más de la ventana de contexto.
              </p>
            </div>

            <Separator />

            {/* Memory Extraction Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm">🧠 Extracción Automática de Memoria</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Extrae hechos memorables de las respuestas del personaje y los guarda como embeddings
                  </p>
                </div>
                <Switch
                  checked={!!embeddingsChat.memoryExtractionEnabled}
                  onCheckedChange={handleToggleMemoryExtraction}
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
                      onValueChange={([v]) => handleFrequencyChange(v)}
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
                      onValueChange={([v]) => handleMinImportanceChange(v)}
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
                      onValueChange={([v]) => handleExtractionContextDepthChange(v)}
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
                </div>
              )}
            </div>

            <Separator />

            {/* Memory Consolidation Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-violet-500" />
                    Consolidación de Memoria
                  </Label>
                  <p className="text-[10px] text-muted-foreground">
                    Comprime memorias antiguas cuando un namespace excede el límite
                  </p>
                </div>
                <Switch
                  checked={!!embeddingsChat.memoryConsolidationEnabled}
                  onCheckedChange={handleToggleConsolidation}
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
                      onValueChange={([v]) => handleThresholdChange(v)}
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
                      onValueChange={([v]) => handleKeepRecentChange(v)}
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
                      onValueChange={([v]) => handleKeepHighImportanceChange(v)}
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
            </div>

            {/* Search Context Depth */}
            <div className="space-y-2">
              <Label className="text-xs">Contexto de búsqueda: {embeddingsChat.searchContextDepth ?? 1} mensajes</Label>
              <Slider
                value={[embeddingsChat.searchContextDepth ?? 1]}
                min={0}
                max={5}
                step={1}
                onValueChange={([v]) => handleSearchContextDepthChange(v)}
              />
              <p className="text-[10px] text-muted-foreground">
                Mensajes recientes que se agregan a tu pregunta para enriquecer la búsqueda de embeddings. 0 = solo tu mensaje. Valores altos = mejores resultados con referencias implícitas ("¿recuerdas eso?").
              </p>
            </div>

            {/* Group Dynamics Extraction */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-fuchsia-500" />
                  Dinámicas Grupales
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  Extrae relaciones entre personajes en chats de grupo
                </p>
              </div>
              <Switch
                checked={!!embeddingsChat.groupDynamicsExtraction}
                onCheckedChange={handleToggleGroupDynamics}
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
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// Prompts Tab Sub-component
// ============================================

/** Preview data for each prompt type */
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

function PromptsTabContent() {
  const embeddingsChat = useTavernStore((state) => state.settings.embeddingsChat) ?? DEFAULT_EMBEDDINGS_CHAT;
  const updateSettings = useTavernStore((state) => state.updateSettings);
  const [activePromptTab, setActivePromptTab] = useState<'normal' | 'group'>('normal');
  const [localPrompt, setLocalPrompt] = useState(() => embeddingsChat.memoryExtractionPrompt || DEFAULT_MEMORY_EXTRACTION_PROMPT);
  const [localGroupPrompt, setLocalGroupPrompt] = useState(() => embeddingsChat.groupMemoryExtractionPrompt || DEFAULT_GROUP_MEMORY_EXTRACTION_PROMPT);
  const [showPreview, setShowPreview] = useState(false);

  const isNormal = activePromptTab === 'normal';
  const currentPrompt = isNormal ? localPrompt : localGroupPrompt;
  const currentStored = isNormal ? (embeddingsChat.memoryExtractionPrompt || DEFAULT_MEMORY_EXTRACTION_PROMPT) : (embeddingsChat.groupMemoryExtractionPrompt || DEFAULT_GROUP_MEMORY_EXTRACTION_PROMPT);
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
    <div className="space-y-4">
      {/* Prompt type selector */}
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
    </div>
  );
}

// ============================================
// Main Panel Component
// ============================================

export function EmbeddingsSettingsPanel() {
  const { toast } = useToast();

  // Config state
  const [config, setConfig] = useState<EmbeddingConfig>({
    ollamaUrl: 'http://localhost:11434',
    model: 'bge-m3:567m',
    dimension: 1024,
    similarityThreshold: 0.5,
    maxResults: 5,
  });

  // Data state
  const [stats, setStats] = useState<EmbeddingStats | null>(null);
  const [namespaces, setNamespaces] = useState<NamespaceRecord[]>([]);
  const [embeddings, setEmbeddings] = useState<EmbeddingRecord[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchMeta, setSearchMeta] = useState<SearchMeta | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Individual service status
  const [ollamaStatus, setOllamaStatus] = useState<'unknown' | 'ok' | 'error'>('unknown');
  const [ollamaError, setOllamaError] = useState<string | undefined>();
  const [lanceDBStatus, setLanceDBStatus] = useState<'unknown' | 'ok' | 'error'>('unknown');
  const [lanceDBError, setLanceDBError] = useState<string | undefined>();
  const [checkingOllama, setCheckingOllama] = useState(false);
  const [checkingLanceDB, setCheckingLanceDB] = useState(false);
  const [refreshingModels, setRefreshingModels] = useState(false);
  const [searchNamespace, setSearchNamespace] = useState<string>('all');
  const [searching, setSearching] = useState(false);
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(null);

  // Dialogs
  const [createEmbeddingOpen, setCreateEmbeddingOpen] = useState(false);
  const [createNamespaceOpen, setCreateNamespaceOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [newEmbedding, setNewEmbedding] = useState({ content: '', namespace: 'default', source_type: 'custom' });
  const [newNamespace, setNewNamespace] = useState({ namespace: '', description: '', type: '' });
  const [editingNamespace, setEditingNamespace] = useState<NamespaceRecord | null>(null);
  const [customTypeText, setCustomTypeText] = useState('');
  const [editCustomTypeText, setEditCustomTypeText] = useState('');

  // Advanced collapsible
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);

  // Namespace documents
  const [nsDocuments, setNsDocuments] = useState<DocumentRecord[]>([]);
  const [viewingNsDocuments, setViewingNsDocuments] = useState<string | null>(null);
  const [loadingDocuments, setLoadingDocuments] = useState(false);

  // File upload state
  const [uploadedFile, setUploadedFile] = useState<{
    fileName: string;
    fileSize: number;
    content: string;
    characterCount: number;
  } | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [refreshingEmbeddings, setRefreshingEmbeddings] = useState(false);
  const [splitterType, setSplitterType] = useState('recursive-character');
  const [chunkSize, setChunkSize] = useState(1000);
  const [chunkOverlap, setChunkOverlap] = useState(200);
  const [previewChunks, setPreviewChunks] = useState<ChunkPreview | null>(null);
  const [previewingChunks, setPreviewingChunks] = useState(false);
  const [creatingEmbeddings, setCreatingEmbeddings] = useState(false);
  const [uploadNamespace, setUploadNamespace] = useState('default');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load config
  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/embeddings/config');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setConfig(data.data);
          setConfigLoaded(true);
        }
      }
    } catch {
      setConfigLoaded(true);
    }
  }, []);

  const saveConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/embeddings/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setConfig(data.data);
          if (data.meta?.dimensionMismatch) {
            toast({
              title: 'Tabla de embeddings recreada',
              description: `Dimensión cambiada de ${data.meta.oldDimension}D a ${data.meta.newDimension}D. Los embeddings anteriores fueron eliminados automáticamente. Recrea tus embeddings con el nuevo modelo.`,
              variant: 'default',
            });
          } else if (data.meta?.modelChanged) {
            toast({
              title: 'Configuración guardada',
              description: `Modelo cambiado a ${config.model}. Los nuevos embeddings se crearán con este modelo. Los embeddings existentes pueden no ser compatibles si la dimensión es diferente.`,
            });
          } else {
            toast({ title: 'Configuración guardada', description: 'Configuración de embeddings actualizada.' });
          }
          // Refresh stats/namespaces in case data was cleared
          loadStats();
          loadNamespaces();
        }
      }
    } catch {
      toast({ title: 'Error', description: 'Error al guardar configuración.', variant: 'destructive' });
    }
    setLoading(false);
  };

  const testConnection = async () => {
    if (!configLoaded) await fetchConfig();
    try {
      const res = await fetch('/api/embeddings/test', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setOllamaStatus(data.data.connections.ollama ? 'ok' : 'error');
        setOllamaError(data.data.ollamaError);
        setLanceDBStatus(data.data.connections.db ? 'ok' : 'error');
        setLanceDBError(data.data.dbError);
        setConnectionStatus(data.data.connections.db && data.data.connections.ollama ? 'connected' : 'disconnected');
        setStats(data.data.stats);
        setOllamaModels(data.data.ollamaModels || []);
        toast({
          title: 'Prueba de conexión',
          description: `Ollama: ${data.data.connections.ollama ? 'Conectado' : 'Desconectado'} | LanceDB: ${data.data.connections.db ? 'Conectado' : 'Desconectado'}`,
        });
      } else {
        setConnectionStatus('disconnected');
        setOllamaStatus('error');
        setLanceDBStatus('error');
        toast({ title: 'Conexión fallida', description: data.error, variant: 'destructive' });
      }
    } catch {
      setConnectionStatus('disconnected');
      toast({ title: 'Error', description: 'Error al probar conexiones.', variant: 'destructive' });
    }
  };

  const checkOllama = async () => {
    setCheckingOllama(true);
    try {
      const res = await fetch(config.ollamaUrl + '/api/tags', { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const data = await res.json();
        const models = (data.models || []).map((m: any) => m.name);
        setOllamaModels(models);
        setOllamaStatus('ok');
        setOllamaError(undefined);
        toast({ title: 'Ollama conectado', description: `${models.length} modelos disponibles.` });
      } else {
        setOllamaStatus('error');
        setOllamaError(`HTTP ${res.status}`);
        toast({ title: 'Ollama error', description: `Server returned HTTP ${res.status}`, variant: 'destructive' });
      }
    } catch (e: any) {
      setOllamaStatus('error');
      setOllamaError(e.message || 'Cannot reach server');
      toast({ title: 'Ollama inalcanzable', description: e.message || 'Verifica que Ollama esté ejecutándose.', variant: 'destructive' });
    }
    setCheckingOllama(false);
  };

  const refreshModels = async () => {
    setRefreshingModels(true);
    try {
      const res = await fetch(config.ollamaUrl + '/api/tags', { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const data = await res.json();
        const models = (data.models || []).map((m: any) => m.name);
        setOllamaModels(models);
        setOllamaStatus('ok');
        setOllamaError(undefined);
        toast({ title: 'Modelos actualizados', description: `Se encontraron ${models.length} modelos en Ollama.` });
      } else {
        toast({ title: 'Error al actualizar', description: `HTTP ${res.status}`, variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error al actualizar', description: e.message || 'No se puede conectar a Ollama.', variant: 'destructive' });
    }
    setRefreshingModels(false);
  };

  const checkLanceDB = async () => {
    setCheckingLanceDB(true);
    try {
      const res = await fetch('/api/embeddings/test', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setLanceDBStatus(data.data.connections.db ? 'ok' : 'error');
        setLanceDBError(data.data.dbError);
        setStats(data.data.stats);
        if (data.data.connections.db) {
          toast({ title: 'LanceDB activo', description: 'Base de datos conectada y funcionando.' });
        } else {
          toast({ title: 'LanceDB no disponible', description: data.data.dbError || 'No se pudo inicializar.', variant: 'destructive' });
        }
      } else {
        setLanceDBStatus('error');
        setLanceDBError(data.error);
        toast({ title: 'Error de LanceDB', description: data.error || 'Revisa los logs.', variant: 'destructive' });
      }
    } catch {
      setLanceDBStatus('error');
      setLanceDBError('Failed to test');
      toast({ title: 'Error de LanceDB', description: 'Error al probar la conexión.', variant: 'destructive' });
    }
    setCheckingLanceDB(false);
  };

  const loadStats = async () => {
    try {
      const res = await fetch('/api/embeddings/stats');
      if (res.ok) {
        const data = await res.json();
        if (data.success) setStats(data.data);
      }
    } catch { /* ignore */ }
    setLanceDBStatus(stats !== null ? 'ok' : 'unknown');
  };

  const loadNamespaces = async () => {
    try {
      const res = await fetch('/api/embeddings/namespaces');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          const enriched = data.data.namespaces.map((ns: any) => ({
            ...ns,
            type: ns.metadata?.type || '',
          }));
          setNamespaces(enriched);
          if (data.data.dbAvailable === false) {
            setLanceDBStatus('error');
            setLanceDBError(data.data.dbError);
          }
        }
      }
    } catch { /* ignore */ }
  };

  // Load config and namespaces on mount
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      await fetchConfig();
      if (mounted) {
        await Promise.all([loadNamespaces(), loadStats()]);
      }
    };
    init();
    return () => { mounted = false; };
  }, []);

  const loadEmbeddings = async (namespace?: string) => {
    try {
      const params = new URLSearchParams();
      if (namespace) params.set('namespace', namespace);
      params.set('limit', '100');
      const res = await fetch(`/api/embeddings?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) setEmbeddings(data.data.embeddings);
      }
    } catch { /* ignore */ }
  };

  const loadNamespaceDocuments = async (namespace: string) => {
    setLoadingDocuments(true);
    try {
      const res = await fetch(`/api/embeddings/namespaces/${encodeURIComponent(namespace)}/documents`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setNsDocuments(data.data.documents);
        }
      }
    } catch {
      toast({ title: 'Error', description: 'Error al cargar documentos.', variant: 'destructive' });
    }
    setLoadingDocuments(false);
  };

  const handleViewNamespaceDocuments = (namespace: string) => {
    setViewingNsDocuments(namespace);
    loadNamespaceDocuments(namespace);
  };

  const handleDeleteDocument = async (namespace: string, sourceId: string) => {
    try {
      const res = await fetch(`/api/embeddings/namespaces/${encodeURIComponent(namespace)}/documents`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: sourceId }),
      });
      if (res.ok) {
        toast({ title: 'Documento eliminado', description: `Documento "${sourceId}" y sus embeddings eliminados.` });
        loadNamespaceDocuments(namespace);
        loadStats();
        loadNamespaces();
      }
    } catch {
      toast({ title: 'Error', description: 'Error al eliminar documento.', variant: 'destructive' });
    }
  };

  const handleClearNamespaceDocuments = async (namespace: string) => {
    try {
      const res = await fetch(`/api/embeddings/namespaces/${encodeURIComponent(namespace)}/documents`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast({ title: 'Limpiado', description: `Todos los documentos en "${namespace}" eliminados.` });
        setNsDocuments([]);
        loadStats();
        loadNamespaces();
      }
    } catch {
      toast({ title: 'Error', description: 'Error al limpiar namespace.', variant: 'destructive' });
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch('/api/embeddings/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          model: config.model,
          namespace: searchNamespace === 'all' ? undefined : searchNamespace,
          limit: config.maxResults,
          threshold: config.similarityThreshold,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.data.results);
        setSearchMeta(data.data.meta || null);
        if (data.data.results.length === 0) {
          toast({ title: 'Sin resultados', description: 'No se encontraron embeddings similares sobre el umbral.' });
        }
      } else {
        toast({ title: 'Error de búsqueda', description: data.error || 'Error desconocido al buscar.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error de búsqueda', description: 'Error al buscar embeddings.', variant: 'destructive' });
    }
    setSearching(false);
  };

  const handleCreateEmbedding = async () => {
    if (!newEmbedding.content.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEmbedding),
      });
      if (res.ok) {
        toast({ title: 'Embedding creado', description: 'Nuevo embedding almacenado.' });
        setCreateEmbeddingOpen(false);
        setNewEmbedding({ content: '', namespace: 'default', source_type: 'custom' });
        loadStats();
        if (selectedNamespace) loadEmbeddings(selectedNamespace);
      }
    } catch {
      toast({ title: 'Error', description: 'Error al crear embedding.', variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleCreateNamespace = async () => {
    if (!newNamespace.namespace.trim()) return;
    setLoading(true);
    try {
      const metadata: Record<string, any> = {};
      const typeValue = newNamespace.type === '__custom__' ? customTypeText.trim() : newNamespace.type.trim();
      if (typeValue && typeValue !== '__none__') {
        metadata.type = typeValue;
      }
      const res = await fetch('/api/embeddings/namespaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ namespace: newNamespace.namespace, description: newNamespace.description, metadata }),
      });
      if (res.ok) {
        toast({ title: 'Namespace creado', description: `Namespace "${newNamespace.namespace}" creado.` });
        setCreateNamespaceOpen(false);
        setNewNamespace({ namespace: '', description: '', type: '' });
        setCustomTypeText('');
        loadNamespaces();
      }
    } catch {
      toast({ title: 'Error', description: 'Error al crear namespace.', variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleUpdateNamespace = async () => {
    if (!editingNamespace) return;
    setLoading(true);
    try {
      const metadata: Record<string, any> = {};
      const typeValue = editingNamespace.type === '__custom__' ? editCustomTypeText.trim() : (editingNamespace.type?.trim() || '');
      if (typeValue && typeValue !== '__none__') {
        metadata.type = typeValue;
      }
      const res = await fetch('/api/embeddings/namespaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ namespace: editingNamespace.namespace, description: editingNamespace.description, metadata }),
      });
      if (res.ok) {
        toast({ title: 'Namespace actualizado', description: `Namespace "${editingNamespace.namespace}" actualizado.` });
        setEditingNamespace(null);
        loadNamespaces();
      }
    } catch {
      toast({ title: 'Error', description: 'Error al actualizar namespace.', variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleDeleteEmbedding = async (id: string) => {
    try {
      const res = await fetch(`/api/embeddings/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'Eliminado', description: 'Embedding eliminado.' });
        loadStats();
        if (selectedNamespace) loadEmbeddings(selectedNamespace);
      }
    } catch { /* ignore */ }
  };

  const handleDeleteNamespace = async (namespace: string) => {
    try {
      const res = await fetch(`/api/embeddings/namespaces/${encodeURIComponent(namespace)}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        toast({
          title: 'Eliminado',
          description: `Namespace "${namespace}" eliminado (${data.deletedEmbeddings || 0} embeddings eliminados).`,
        });
        setSelectedNamespace(null);
        setViewingNsDocuments(null);
        loadNamespaces();
        loadStats();
      }
    } catch { /* ignore */ }
  };

  const handleResetAll = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/embeddings/reset', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        toast({
          title: 'Reinicio completado',
          description: `Se eliminaron ${data.data.deletedEmbeddings} embeddings y ${data.data.deletedNamespaces} namespaces.`,
        });
        setResetConfirmOpen(false);
        setStats(null);
        setNamespaces([]);
        setEmbeddings([]);
        setSearchResults([]);
        setSelectedNamespace(null);
        setViewingNsDocuments(null);
      }
    } catch {
      toast({ title: 'Error', description: 'Error al reiniciar.', variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleModelChange = (modelName: string) => {
    const knownModel = KNOWN_MODELS.find(m => m.name === modelName);
    setConfig(prev => ({
      ...prev,
      model: modelName,
      dimension: knownModel?.dimension || prev.dimension,
    }));
  };

  const handleSelectNamespace = (ns: string | null) => {
    setSelectedNamespace(ns);
    if (ns) loadEmbeddings(ns);
    else { setEmbeddings([]); loadStats(); }
  };

  const refreshEmbeddingsTab = async () => {
    setRefreshingEmbeddings(true);
    await Promise.all([loadStats(), loadNamespaces(), loadEmbeddings(selectedNamespace || undefined)]);
    setRefreshingEmbeddings(false);
  };

  const handleTabChange = (tab: string) => {
    if (tab === 'namespaces') { loadNamespaces(); setViewingNsDocuments(null); }
    if (tab === 'embeddings') { refreshEmbeddingsTab(); }
    if (tab === 'archivos') { loadNamespaces(); }
  };

  // File upload handlers
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/embeddings/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setUploadedFile({
          fileName: data.data.fileName,
          fileSize: data.data.fileSize,
          content: data.data.content,
          characterCount: data.data.characterCount,
        });
        setPreviewChunks(null);
        toast({ title: 'Archivo cargado', description: `${data.data.fileName} (${data.data.characterCount.toLocaleString()} caracteres)` });
      } else {
        toast({ title: 'Error al subir', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error al subir archivo.', variant: 'destructive' });
    }
    setUploadingFile(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSplitterChange = (value: string) => {
    setSplitterType(value);
    const opt = SPLITTER_OPTIONS.find(o => o.value === value);
    if (opt) {
      setChunkSize(opt.defaultChunkSize);
      setChunkOverlap(opt.defaultOverlap);
    }
    setPreviewChunks(null);
  };

  const handlePreviewChunks = async () => {
    if (!uploadedFile?.content) return;
    setPreviewingChunks(true);
    try {
      const res = await fetch('/api/embeddings/preview-chunks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: uploadedFile.content,
          splitterType,
          chunkSize,
          chunkOverlap,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPreviewChunks(data.data);
      } else {
        toast({ title: 'Error en vista previa', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error al previsualizar fragmentos.', variant: 'destructive' });
    }
    setPreviewingChunks(false);
  };

  const handleCreateEmbeddings = async () => {
    if (!uploadedFile?.content) return;
    setCreatingEmbeddings(true);
    try {
      const res = await fetch('/api/embeddings/create-from-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: uploadedFile.content,
          namespace: uploadNamespace,
          splitterType,
          chunkSize,
          chunkOverlap,
          source_type: 'file',
          source_id: uploadedFile.fileName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Embeddings creados',
          description: `${data.data.createdCount} embeddings en "${uploadNamespace}" (${data.data.errorCount} errores)`,
        });
        setUploadedFile(null);
        setPreviewChunks(null);
        loadStats();
        loadNamespaces();
      } else {
        toast({ title: 'Fallido', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error al crear embeddings.', variant: 'destructive' });
    }
    setCreatingEmbeddings(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Header Info Banner */}
      <div className="bg-gradient-to-r from-purple-500/10 to-fuchsia-500/10 border border-purple-500/20 rounded-lg p-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <Brain className="w-5 h-5 text-purple-500" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-medium text-purple-600 dark:text-purple-400">
              Embeddings Vectoriales
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              Búsqueda semántica con <strong>Ollama</strong> + <strong>LanceDB</strong>. Almacena embeddings de texto y busca por significado, no solo palabras clave.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={connectionStatus === 'connected' ? 'default' : connectionStatus === 'disconnected' ? 'destructive' : 'outline'}>
              {connectionStatus === 'connected' ? <CheckCircle className="w-3 h-3 mr-1" /> :
               connectionStatus === 'disconnected' ? <XCircle className="w-3 h-3 mr-1" /> :
               <AlertCircle className="w-3 h-3 mr-1" />}
              {connectionStatus === 'connected' ? 'Todo Conectado' : connectionStatus === 'disconnected' ? 'Problemas Detectados' : 'Sin Probar'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Tabs - 7 tabs */}
      <Tabs defaultValue="configuracion" onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="configuracion" className="text-xs">
            <Settings className="w-3 h-3 mr-1" />Configuración
          </TabsTrigger>
          <TabsTrigger value="integracion" className="text-xs">
            <MessageSquare className="w-3 h-3 mr-1" />Integración del chat
          </TabsTrigger>
          <TabsTrigger value="search" className="text-xs">
            <Search className="w-3 h-3 mr-1" />Búsqueda
          </TabsTrigger>
          <TabsTrigger value="archivos" className="text-xs">
            <Upload className="w-3 h-3 mr-1" />Archivos
          </TabsTrigger>
          <TabsTrigger value="namespaces" className="text-xs">
            <FolderOpen className="w-3 h-3 mr-1" />Namespaces
          </TabsTrigger>
          <TabsTrigger value="embeddings" className="text-xs">
            <Database className="w-3 h-3 mr-1" />Examinar
          </TabsTrigger>
          <TabsTrigger value="prompts" className="text-xs">
            <Pencil className="w-3 h-3 mr-1" />Prompts
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Configuración */}
        <TabsContent value="configuracion" className="space-y-3 mt-3">
          <Card>
            <CardContent className="pt-4 space-y-4">

              {/* Service Status Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Ollama Status Card */}
                <div className={cn(
                  'p-3 rounded-lg border transition-colors',
                  ollamaStatus === 'ok' ? 'border-emerald-500/30 bg-emerald-500/5' :
                  ollamaStatus === 'error' ? 'border-red-500/30 bg-red-500/5' :
                  'border-border bg-muted/20'
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {ollamaStatus === 'ok' ? <CheckCircle className="w-4 h-4 text-emerald-500" /> :
                       ollamaStatus === 'error' ? <XCircle className="w-4 h-4 text-red-500" /> :
                       <AlertCircle className="w-4 h-4 text-muted-foreground" />}
                      <span className="text-sm font-medium">Ollama</span>
                    </div>
                    <Badge variant={ollamaStatus === 'ok' ? 'default' : ollamaStatus === 'error' ? 'destructive' : 'outline'}
                      className={cn(ollamaStatus === 'ok' && 'bg-emerald-500 border-emerald-500')}>
                      {ollamaStatus === 'ok' ? 'Conectado' : ollamaStatus === 'error' ? 'Error' : 'Desconocido'}
                    </Badge>
                  </div>
                  {ollamaError && (
                    <p className="text-[10px] text-red-500/80 mb-2 line-clamp-2">{ollamaError}</p>
                  )}
                  {ollamaStatus === 'ok' && ollamaModels.length > 0 && (
                    <p className="text-[10px] text-muted-foreground mb-2">{ollamaModels.length} modelos disponibles</p>
                  )}
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={checkOllama} disabled={checkingOllama}>
                      {checkingOllama ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                      Verificar
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={refreshModels} disabled={refreshingModels}>
                      {refreshingModels ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                      Actualizar Modelos
                    </Button>
                  </div>
                </div>

                {/* LanceDB Status Card */}
                <div className={cn(
                  'p-3 rounded-lg border transition-colors',
                  lanceDBStatus === 'ok' ? 'border-emerald-500/30 bg-emerald-500/5' :
                  lanceDBStatus === 'error' ? 'border-red-500/30 bg-red-500/5' :
                  'border-border bg-muted/20'
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {lanceDBStatus === 'ok' ? <CheckCircle className="w-4 h-4 text-emerald-500" /> :
                       lanceDBStatus === 'error' ? <XCircle className="w-4 h-4 text-red-500" /> :
                       <AlertCircle className="w-4 h-4 text-muted-foreground" />}
                      <span className="text-sm font-medium">LanceDB</span>
                    </div>
                    <Badge variant={lanceDBStatus === 'ok' ? 'default' : lanceDBStatus === 'error' ? 'destructive' : 'outline'}
                      className={cn(lanceDBStatus === 'ok' && 'bg-emerald-500 border-emerald-500')}>
                      {lanceDBStatus === 'ok' ? 'Activo' : lanceDBStatus === 'error' ? 'Error' : 'Desconocido'}
                    </Badge>
                  </div>
                  {lanceDBError && (
                    <p className="text-[10px] text-red-500/80 mb-2 line-clamp-2">{lanceDBError}</p>
                  )}
                  {lanceDBStatus === 'ok' && stats && (
                    <p className="text-[10px] text-muted-foreground mb-2">{stats.totalEmbeddings} embeddings, {stats.totalNamespaces} namespaces</p>
                  )}
                  <Button size="sm" variant="outline" className="h-7 text-xs w-full" onClick={checkLanceDB} disabled={checkingLanceDB}>
                    {checkingLanceDB ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Database className="w-3 h-3 mr-1" />}
                    Verificar BD
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Ollama URL */}
              <div className="space-y-2">
                <Label className="text-xs">URL de Ollama</Label>
                <Input
                  value={config.ollamaUrl}
                  onChange={(e) => setConfig(prev => ({ ...prev, ollamaUrl: e.target.value }))}
                  placeholder="http://localhost:11434"
                  className="h-8 text-sm"
                />
              </div>

              {/* Embedding Model */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Modelo de Embedding</Label>
                  {ollamaModels.length > 0 && (
                    <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1.5 text-muted-foreground"
                      onClick={refreshModels} disabled={refreshingModels}>
                      {refreshingModels ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    </Button>
                  )}
                </div>
                <Select value={config.model} onValueChange={handleModelChange}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KNOWN_MODELS.map(m => (
                      <SelectItem key={m.name} value={m.name}>
                        <div className="flex items-center justify-between gap-4">
                          <span>{m.name}</span>
                          <span className="text-[10px] text-muted-foreground">{m.dimension}D</span>
                        </div>
                      </SelectItem>
                    ))}
                    {ollamaModels.filter(m => !KNOWN_MODELS.find(k => k.name === m)).length > 0 && (
                      <>
                        <SelectItem value="__separator__" disabled>
                          <Separator className="my-1" />
                        </SelectItem>
                        {ollamaModels.filter(m => !KNOWN_MODELS.find(k => k.name === m)).map(m => (
                          <SelectItem key={m} value={m}>
                            <div className="flex items-center justify-between gap-4">
                              <span className="truncate">{m}</span>
                              <span className="text-[10px] text-muted-foreground shrink-0">Ollama</span>
                            </div>
                          </SelectItem>
                        ))}
                      </>
                    )}
                    {ollamaModels.length === 0 && (
                      <SelectItem value="no-models" disabled>
                        <span className="text-muted-foreground">No hay modelos escaneados — haz clic en "Actualizar Modelos"</span>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Similarity Threshold + Max Results */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Umbral de Similitud: {(config.similarityThreshold * 100).toFixed(0)}%</Label>
                  <Slider
                    value={[config.similarityThreshold]}
                    min={0} max={1} step={0.05}
                    onValueChange={([v]) => setConfig(prev => ({ ...prev, similarityThreshold: v }))}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {config.similarityThreshold === 0 ? 'Cualquier resultado' :
                     config.similarityThreshold >= 0.9 ? 'Solo coincidencias muy cercanas' :
                     config.similarityThreshold >= 0.7 ? 'Coincidencias moderadas' :
                     'Resultados más amplios'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Máx. Resultados: {config.maxResults}</Label>
                  <Slider
                    value={[config.maxResults]}
                    min={1} max={50} step={1}
                    onValueChange={([v]) => setConfig(prev => ({ ...prev, maxResults: v }))}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Número máximo de embeddings retornados por búsqueda
                  </p>
                </div>
              </div>

              {/* Advanced Settings */}
              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronDown className={cn('w-3 h-3 transition-transform', advancedOpen && 'rotate-180')} />
                  Ajustes Avanzados
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 mt-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Dimensión Vectorial: {config.dimension}</Label>
                    <Input
                      type="number"
                      value={config.dimension}
                      onChange={(e) => setConfig(prev => ({ ...prev, dimension: parseInt(e.target.value) || 1024 }))}
                      className="h-8 text-sm"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Dimension Mismatch Warning */}
              {config.tableDimension != null && config.tableDimension !== config.dimension && (
                <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                        Incompatibilidad de dimensiones detectada
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        La tabla de embeddings tiene {config.tableDimension}D pero el modelo actual usa {config.dimension}D.
                        Guarda la configuración para recrear automáticamente la tabla con la dimensión correcta.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Save Config Button */}
              <div className="flex gap-2 pt-2">
                <Button onClick={saveConfig} disabled={loading} size="sm" className="flex-1 sm:flex-none">
                  {loading ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : null}
                  Guardar Config
                </Button>
                <Button onClick={testConnection} size="sm" variant="outline" className="flex-1 sm:flex-none">
                  Probar Todo
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Integración */}
        <TabsContent value="integracion" className="space-y-3 mt-3">
          <EmbeddingsChatIntegrationContent />
        </TabsContent>

        {/* Tab 3: Búsqueda */}
        <TabsContent value="search" className="space-y-3 mt-3">
          <div className="flex gap-2">
            <Input
              placeholder="Buscar por significado... (ej. 'espada mágica', 'bosque antiguo')"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 h-9 text-sm"
            />
            <Select value={searchNamespace} onValueChange={setSearchNamespace}>
              <SelectTrigger className="w-36 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Namespaces</SelectItem>
                {namespaces.map(ns => (
                  <SelectItem key={ns.namespace} value={ns.namespace}>{ns.namespace}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleSearch} disabled={searching || !searchQuery.trim()} size="sm">
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {searchResults.length} resultados encontrados
                </p>
                {searchMeta && (
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px]">
                      Modelo: {searchMeta.model}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      Umbral: {(searchMeta.threshold * 100).toFixed(0)}%
                    </Badge>
                  </div>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto space-y-1.5">
                {searchResults.map((result, i) => (
                  <div key={result.id} className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm line-clamp-2">{result.content}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant="outline" className="text-[10px]">
                            {(result.similarity * 100).toFixed(1)}% match
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{result.namespace}</span>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">#{i + 1}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {searchQuery && searchResults.length === 0 && !searching && (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No se encontraron resultados. Intenta una consulta diferente o baja el umbral.</p>
            </div>
          )}

          {!searchQuery && (
            <div className="text-center py-8 text-muted-foreground">
              <Brain className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Escribe una consulta para buscar embeddings por similitud semántica.</p>
              <p className="text-xs mt-1">Los resultados se ordenan por similitud coseno.</p>
            </div>
          )}
        </TabsContent>

        {/* Tab 4: Archivos (Files) */}
        <TabsContent value="archivos" className="mt-3">
          <Card>
            <CardContent className="pt-4 space-y-4">
              {/* File Upload */}
              <div className="space-y-2">
                <Label className="text-xs">Subir Archivo</Label>
                <div className="flex gap-2">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md,.json,.csv,.html,.py,.js,.ts,.java,.c,.cpp,.rb,.go,.rs,.xml,.yaml,.yml,.log"
                    onChange={handleFileUpload}
                    className="h-9 text-sm"
                    disabled={uploadingFile}
                  />
                  {uploadingFile && (
                    <Button size="sm" disabled>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      Cargando...
                    </Button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Soportados: .txt, .md, .json, .csv, .html, archivos de código (.py, .js, .ts, .java, etc.) — Máx. 10MB
                </p>
              </div>

              {uploadedFile && (
                <>
                  <Separator />

                  {/* File Info */}
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                    <File className="w-5 h-5 text-blue-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{uploadedFile.fileName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatFileSize(uploadedFile.fileSize)} · {uploadedFile.characterCount.toLocaleString()} caracteres
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setUploadedFile(null); setPreviewChunks(null); }}>
                      Eliminar
                    </Button>
                  </div>

                  {/* Namespace Selection */}
                  <div className="space-y-2">
                    <Label className="text-xs">Namespace Destino</Label>
                    <Select value={uploadNamespace} onValueChange={setUploadNamespace}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {namespaces.map(ns => (
                          <SelectItem key={ns.namespace} value={ns.namespace}>{ns.namespace}</SelectItem>
                        ))}
                        <SelectItem value="default">default</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Text Splitter Selection */}
                  <div className="space-y-2">
                    <Label className="text-xs">Divisor de Texto</Label>
                    <Select value={splitterType} onValueChange={handleSplitterChange}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SPLITTER_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <div className="flex items-center gap-2">
                              <opt.icon className="w-3.5 h-3.5" />
                              <div>
                                <span className="text-sm">{opt.label}</span>
                                <p className="text-[10px] text-muted-foreground">{opt.description}</p>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Chunk Size + Overlap */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Tamaño de Fragmento: {chunkSize} caracteres</Label>
                      <Slider
                        value={[chunkSize]}
                        min={100} max={4000} step={50}
                        onValueChange={([v]) => { setChunkSize(v); setPreviewChunks(null); }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Solapamiento: {chunkOverlap} caracteres</Label>
                      <Slider
                        value={[chunkOverlap]}
                        min={0} max={Math.min(chunkSize, 1000)} step={10}
                        onValueChange={([v]) => { setChunkOverlap(v); setPreviewChunks(null); }}
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      onClick={handlePreviewChunks}
                      disabled={previewingChunks || !uploadedFile}
                      size="sm"
                      variant="outline"
                      className="flex-1"
                    >
                      {previewingChunks ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Eye className="w-4 h-4 mr-1" />}
                      Vista Previa
                    </Button>
                    <Button
                      onClick={handleCreateEmbeddings}
                      disabled={creatingEmbeddings || !uploadedFile}
                      size="sm"
                      className="flex-1 bg-purple-600 hover:bg-purple-700"
                    >
                      {creatingEmbeddings ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Layers className="w-4 h-4 mr-1" />}
                      Crear Embeddings
                    </Button>
                  </div>

                  {/* Preview Chunks - Fixed height scrollable */}
                  {previewChunks && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                          <Layers className="w-4 h-4 text-purple-500" />
                          Vista Previa de Fragmentos
                        </h4>
                        <Badge variant="outline">
                          {previewChunks.totalChunks} fragmentos · promedio {previewChunks.avgChunkSize} caracteres
                        </Badge>
                      </div>
                      <ScrollArea className="h-48 rounded-lg border">
                        <div className="p-3 space-y-2">
                          {previewChunks.chunks.map((chunk, i) => (
                            <div key={i} className="p-2 rounded bg-muted/50 text-xs font-mono">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="secondary" className="text-[10px] h-4 px-1">#{i + 1}</Badge>
                                <span className="text-[10px] text-muted-foreground">{chunk.length} caracteres</span>
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-3">{chunk}</p>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </>
              )}

              {!uploadedFile && (
                <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                  <Upload className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Sube un archivo para crear embeddings</p>
                  <p className="text-xs mt-1">Texto, markdown, código y más</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: Namespaces */}
        <TabsContent value="namespaces" className="space-y-3 mt-3">
          {viewingNsDocuments ? (
            /* Documents View for selected namespace */
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setViewingNsDocuments(null)}>
                  <ArrowLeft className="w-3 h-3 mr-1" />
                  Volver a Namespaces
                </Button>
                <h3 className="text-sm font-medium">Documentos en &quot;{viewingNsDocuments}&quot;</h3>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {loadingDocuments ? 'Cargando...' : `${nsDocuments.length} documentos`}
                </span>
                {nsDocuments.length > 0 && (
                  <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleClearNamespaceDocuments(viewingNsDocuments)}>
                    <Trash2 className="w-3 h-3 mr-1" />Limpiar Todo
                  </Button>
                )}
              </div>

              {loadingDocuments ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : nsDocuments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Sin documentos en este namespace</p>
                </div>
              ) : (
                <ScrollArea className="max-h-80">
                  <div className="space-y-1.5">
                    {nsDocuments.map(doc => (
                      <div key={doc.source_id} className="p-3 rounded-lg border border-border/40 hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              <span className="text-sm font-medium truncate">{doc.source_id}</span>
                              <Badge variant="secondary" className="text-[10px]">
                                {doc.count} fragmentos
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {doc.source_type}
                              </Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground line-clamp-2 ml-5">
                              {doc.firstChunk}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1 ml-5">
                              {new Date(doc.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => handleDeleteDocument(viewingNsDocuments, doc.source_id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          ) : (
            /* Namespace List View */
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{namespaces.length} namespaces</span>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { loadNamespaces(); loadStats(); }}>
                    <RefreshCw className="w-3 h-3 mr-1" />Actualizar
                  </Button>
                  <Button size="sm" className="h-7 text-xs" onClick={() => setCreateNamespaceOpen(true)}>
                    <Plus className="w-3 h-3 mr-1" />Nuevo
                  </Button>
                </div>
              </div>

              <ScrollArea className="max-h-80">
                {namespaces.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Sin namespaces aún. Crea uno para organizar embeddings.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {namespaces.map(ns => (
                      <div
                        key={ns.id}
                        className={cn(
                          'p-3 rounded-lg border transition-colors',
                          selectedNamespace === ns.namespace
                            ? 'border-primary bg-primary/5'
                            : 'border-border/40 hover:bg-muted/50'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="text-sm font-medium truncate">{ns.namespace}</span>
                            {ns.type && (
                              <Badge variant="secondary" className="text-[10px] shrink-0 bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                                {ns.type}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              {ns.embedding_count || 0} emb
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                const isCustomType = ns.type && !['MEMORIA DEL PERSONAJE', 'EVENTOS RECIENTES', 'LORE DEL MUNDO', 'REGLAS Y MECANICAS', 'RELACIONES'].includes(ns.type);
                                setEditingNamespace({ ...ns, type: isCustomType ? '__custom__' : (ns.type || '') });
                                setEditCustomTypeText(isCustomType ? (ns.type || '') : '');
                              }}
                              title="Editar tipo"
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => handleViewNamespaceDocuments(ns.namespace)}
                            >
                              <FileText className="w-3 h-3 mr-1" />
                              Docs
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteNamespace(ns.namespace)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        {ns.description && (
                          <p className="text-xs text-muted-foreground mt-1 ml-5">{ns.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </>
          )}
        </TabsContent>

        {/* Tab 6: Examinar (Browse Embeddings) */}
        <TabsContent value="embeddings" className="space-y-3 mt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {selectedNamespace ? `${embeddings.length} en "${selectedNamespace}"` : `${stats?.totalEmbeddings || 0} total`}
              </span>
              {selectedNamespace && (
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => handleSelectNamespace(null)}>
                  Mostrar todo
                </Button>
              )}
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={refreshEmbeddingsTab} disabled={refreshingEmbeddings}>
                {refreshingEmbeddings ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                Actualizar
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={() => setCreateEmbeddingOpen(true)}>
                <Plus className="w-3 h-3 mr-1" />Agregar
              </Button>
            </div>
          </div>

          {refreshingEmbeddings ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground ml-2">Cargando embeddings...</span>
            </div>
          ) : embeddings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Database className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sin embeddings almacenados.</p>
              <p className="text-xs mt-1">Agrega embeddings manualmente o importa desde archivos.</p>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto space-y-1.5 pr-1">
              {embeddings.map(emb => (
                <div key={emb.id} className="p-3 rounded-lg border border-border/40 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm line-clamp-2">{emb.content}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">
                          <Tag className="w-2.5 h-2.5 mr-0.5" />
                          {emb.namespace}
                        </Badge>
                        {emb.source_type && (
                          <Badge variant="secondary" className="text-[10px]">
                            <Globe className="w-2.5 h-2.5 mr-0.5" />
                            {emb.source_type}
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(emb.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => handleDeleteEmbedding(emb.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Danger Zone */}
          {stats && stats.totalEmbeddings > 0 && (
            <div className="pt-3">
              <Separator className="mb-3" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-destructive">Peligro: Reiniciar todo</span>
                <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => setResetConfirmOpen(true)}>
                  <Trash2 className="w-3 h-3 mr-1" />Reiniciar Todo
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Tab 7: Prompts */}
        <TabsContent value="prompts" className="space-y-3 mt-3">
          <PromptsTabContent />
        </TabsContent>
      </Tabs>

      {/* Create Embedding Dialog */}
      <Dialog open={createEmbeddingOpen} onOpenChange={setCreateEmbeddingOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Agregar Embedding</DialogTitle>
            <DialogDescription>Almacena un nuevo embedding de texto para búsqueda semántica.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Contenido</Label>
              <Textarea
                value={newEmbedding.content}
                onChange={(e) => setNewEmbedding(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Ingresa el texto para incrustar..."
                rows={4}
                className="text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Namespace</Label>
                <Select value={newEmbedding.namespace} onValueChange={(v) => setNewEmbedding(prev => ({ ...prev, namespace: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">default</SelectItem>
                    {namespaces.map(ns => (
                      <SelectItem key={ns.namespace} value={ns.namespace}>{ns.namespace}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de Origen</Label>
                <Select value={newEmbedding.source_type} onValueChange={(v) => setNewEmbedding(prev => ({ ...prev, source_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Personalizado</SelectItem>
                    <SelectItem value="character">Personaje</SelectItem>
                    <SelectItem value="world">Mundo</SelectItem>
                    <SelectItem value="lorebook">Lorebook</SelectItem>
                    <SelectItem value="session">Sesión</SelectItem>
                    <SelectItem value="memory">Memoria</SelectItem>
                    <SelectItem value="file">Archivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateEmbeddingOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateEmbedding} disabled={loading || !newEmbedding.content.trim()}>
              {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Namespace Dialog */}
      <Dialog open={createNamespaceOpen} onOpenChange={setCreateNamespaceOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crear Namespace</DialogTitle>
            <DialogDescription>Los namespaces organizan embeddings en grupos lógicos. El tipo se usa para agrupar embeddings en el prompt del chat.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={newNamespace.namespace}
                onChange={(e) => setNewNamespace(prev => ({ ...prev, namespace: e.target.value }))}
                placeholder="ej. historia-personaje, eventos-recientes"
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo <span className="text-muted-foreground text-[10px]">(agrupa en el prompt del chat)</span></Label>
              <Select
                value={newNamespace.type === '__custom__' || (!['__none__', 'MEMORIA DEL PERSONAJE', 'EVENTOS RECIENTES', 'LORE DEL MUNDO', 'REGLAS Y MECANICAS', 'RELACIONES'].includes(newNamespace.type) && newNamespace.type) ? '__custom__' : (newNamespace.type || '__none__')}
                onValueChange={(v) => {
                  if (v === '__custom__') {
                    setCustomTypeText('');
                  }
                  setNewNamespace(prev => ({ ...prev, type: v }));
                }}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Sin tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    <span className="text-muted-foreground">Sin tipo</span>
                  </SelectItem>
                  <SelectItem value="MEMORIA DEL PERSONAJE">
                    <div className="flex flex-col">
                      <span>🧠 Memoria del Personaje</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="EVENTOS RECIENTES">
                    <div className="flex flex-col">
                      <span>📅 Eventos Recientes</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="LORE DEL MUNDO">
                    <div className="flex flex-col">
                      <span>🌍 Lore del Mundo</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="REGLAS Y MECANICAS">
                    <div className="flex flex-col">
                      <span>⚙️ Reglas y Mecánicas</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="RELACIONES">
                    <div className="flex flex-col">
                      <span>👥 Relaciones</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="__custom__">
                    <div className="flex flex-col">
                      <span>✏️ Tipo personalizado...</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {newNamespace.type === '__custom__' && (
                <Input
                  autoFocus
                  value={customTypeText}
                  onChange={(e) => setCustomTypeText(e.target.value)}
                  placeholder="Escribe el tipo personalizado"
                  className="text-sm"
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>Descripción (opcional)</Label>
              <Input
                value={newNamespace.description}
                onChange={(e) => setNewNamespace(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descripción breve de este namespace"
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateNamespaceOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateNamespace} disabled={loading || !newNamespace.namespace.trim()}>
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Namespace Dialog */}
      <Dialog open={!!editingNamespace} onOpenChange={(open) => { if (!open) setEditingNamespace(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Namespace</DialogTitle>
            <DialogDescription>Modifica el tipo y descripción del namespace. Los embeddings no se afectan.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={editingNamespace?.namespace || ''}
                disabled
                className="text-sm bg-muted"
              />
              <p className="text-[10px] text-muted-foreground">El nombre no se puede cambiar después de crearlo.</p>
            </div>
            <div className="space-y-2">
              <Label>Tipo <span className="text-muted-foreground text-[10px]">(agrupa en el prompt del chat)</span></Label>
              <Select
                value={editingNamespace?.type === '__custom__' || (!['__none__', 'MEMORIA DEL PERSONAJE', 'EVENTOS RECIENTES', 'LORE DEL MUNDO', 'REGLAS Y MECANICAS', 'RELACIONES', ''].includes(editingNamespace?.type || '') && editingNamespace?.type) ? '__custom__' : (editingNamespace?.type || '__none__')}
                onValueChange={(v) => {
                  if (v === '__custom__') {
                    setEditCustomTypeText('');
                  }
                  setEditingNamespace(prev => prev ? { ...prev, type: v } : prev);
                }}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Sin tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    <span className="text-muted-foreground">Sin tipo</span>
                  </SelectItem>
                  <SelectItem value="MEMORIA DEL PERSONAJE">
                    <div className="flex flex-col">
                      <span>🧠 Memoria del Personaje</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="EVENTOS RECIENTES">
                    <div className="flex flex-col">
                      <span>📅 Eventos Recientes</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="LORE DEL MUNDO">
                    <div className="flex flex-col">
                      <span>🌍 Lore del Mundo</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="REGLAS Y MECANICAS">
                    <div className="flex flex-col">
                      <span>⚙️ Reglas y Mecánicas</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="RELACIONES">
                    <div className="flex flex-col">
                      <span>👥 Relaciones</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="__custom__">
                    <div className="flex flex-col">
                      <span>✏️ Tipo personalizado...</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {editingNamespace?.type === '__custom__' && (
                <Input
                  autoFocus
                  value={editCustomTypeText}
                  onChange={(e) => setEditCustomTypeText(e.target.value)}
                  placeholder="Escribe el tipo personalizado"
                  className="text-sm"
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>Descripción (opcional)</Label>
              <Input
                value={editingNamespace?.description || ''}
                onChange={(e) => setEditingNamespace(prev => prev ? { ...prev, description: e.target.value } : prev)}
                placeholder="Descripción breve de este namespace"
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingNamespace(null)}>Cancelar</Button>
            <Button onClick={handleUpdateNamespace} disabled={loading}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Confirm Dialog */}
      <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Reiniciar Todos los Embeddings</DialogTitle>
            <DialogDescription>
              Esto eliminará permanentemente todos los {stats?.totalEmbeddings || 0} embeddings y {stats?.totalNamespaces || 0} namespaces. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetConfirmOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleResetAll} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
              Eliminar Todo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default EmbeddingsSettingsPanel;
