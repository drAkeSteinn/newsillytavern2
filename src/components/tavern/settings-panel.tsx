'use client';

import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Settings, 
  Bot, 
  Palette, 
  Volume2, 
  Keyboard,
  Database,
  Plus,
  Check,
  Trash2,
  ExternalLink,
  Music,
  Image as ImageIcon,
  MessageSquare,
  GripVertical,
  User,
  BookOpen,
  Download,
  Upload,
  Layers,
  Cloud,
  Brain,
  Target,
  Package,
  FileJson,
  Settings2,
  AlertCircle,
  CheckCircle,
  Info,
  HelpCircle,
  Cpu,
  Sliders,
  Zap,
  Sparkles,
  X,
  ChevronDown,
  RefreshCw,
  Loader2,
  Wrench,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { LLMProvider, AppSettings } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { SoundTriggersSettings } from './sound-triggers-settings';
import { BackgroundTriggersSettings } from './background-triggers-settings';
import { PersonaPanel } from './persona-panel';
import { LorebookPanel } from './lorebook-panel';
import { HUDManager } from '@/components/settings/hud-manager';
import { AtmosphereSettings } from '@/components/atmosphere';
import { MemorySettingsPanel } from '@/components/memory';
import { QuestSettingsPanel } from '@/components/quests';
import { DialogueSettingsPanel } from '@/components/dialogue';
import { InventoryPanel } from '@/components/inventory';
import { AppearanceSettingsPanel } from './appearance-settings-panel';
import { TTSSettingsPanel } from './tts-settings-panel';
import { SpriteGeneralPanel } from './sprite-general-panel';
import { EmbeddingsSettingsPanel } from '@/components/embeddings/embeddings-settings-panel';
import { ToolsSettingsPanel } from '@/components/tools/tools-settings-panel';
import { HandyControlPanel } from './handy-control-panel';

// ============================================
// LM Studio Model Selector
// Fetches available models from LM Studio's /v1/models endpoint
// ============================================

interface LMStudioModelSelectorProps {
  endpoint: string;
  currentModel: string;
  onModelChange: (model: string) => void;
}

function LMStudioModelSelector({ endpoint, currentModel, onModelChange }: LMStudioModelSelectorProps) {
  const [models, setModels] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchModels = useCallback(async () => {
    if (!endpoint) {
      toast({ variant: 'destructive', description: 'Configura el endpoint de LM Studio primero' });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use server-side proxy to avoid CORS issues with localhost
      const response = await fetch(`/api/lm-studio/models?endpoint=${encodeURIComponent(endpoint)}`, {
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(errData.error || `Servidor respondió con ${response.status}`);
      }

      const data = await response.json();
      const modelList = (data.data || [])
        .map((m: { id: string }) => ({
          id: m.id,
          name: m.id.split('/').pop() || m.id,
        }))
        .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));

      if (modelList.length === 0) {
        setError('No se encontraron modelos');
        toast({ description: 'No hay modelos disponibles en LM Studio', variant: 'destructive' });
      } else {
        setModels(modelList);
        toast({ description: `${modelList.length} modelo(s) encontrado(s) en LM Studio` });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error de conexión';
      setError(msg);
      toast({ variant: 'destructive', description: `Error al obtener modelos: ${msg}` });
    } finally {
      setLoading(false);
    }
  }, [endpoint, toast]);

  // Auto-fetch models when endpoint changes and we haven't loaded yet
  const lastFetchedEndpoint = useRef<string>('');
  useEffect(() => {
    if (endpoint && endpoint !== lastFetchedEndpoint.current) {
      lastFetchedEndpoint.current = endpoint;
      fetchModels();
    }
  }, [endpoint, fetchModels]);

  // Check if current model is in the fetched list
  const isModelInList = models.some(m => m.id === currentModel);

  return (
    <div className="mt-1 space-y-1.5">
      <div className="flex items-center gap-1.5">
        {/* Model dropdown */}
        <Select
          value={isModelInList ? currentModel : '__custom__'}
          onValueChange={(value) => {
            if (value === '__default__') {
              onModelChange('loaded');
            } else if (value === '__custom__') {
              // Keep current custom value
            } else {
              onModelChange(value);
            }
          }}
        >
          <SelectTrigger className="h-8 text-sm flex-1">
            <SelectValue placeholder="Seleccionar modelo..." />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {/* Default: use whatever is loaded in LM Studio */}
            <SelectItem value="__default__">
              <span className="flex items-center gap-2">
                <Cpu className="h-3.5 w-3.5 text-emerald-500" />
                <span className="font-medium">Por defecto (cargado en LM Studio)</span>
              </span>
            </SelectItem>

            {models.length > 0 && <SelectSeparator />}

            {models.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                <span className="truncate block max-w-[280px]" title={model.id}>
                  {model.name}
                </span>
              </SelectItem>
            ))}

            {/* Show custom option if current model isn't in the list */}
            {!isModelInList && currentModel && (
              <>
                <SelectSeparator />
                <SelectItem value="__custom__" disabled>
                  <span className="truncate text-muted-foreground" title={currentModel}>
                    {currentModel} (personalizado)
                  </span>
                </SelectItem>
              </>
            )}
          </SelectContent>
        </Select>

        {/* Refresh button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={fetchModels}
                disabled={loading || !endpoint}
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Refrescar modelos desde LM Studio</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Manual input for custom model name */}
      <div className="flex items-center gap-2">
        <Input
          value={currentModel === 'loaded' ? '' : currentModel}
          onChange={(e) => onModelChange(e.target.value || 'loaded')}
          placeholder={currentModel === 'loaded' ? 'Usando modelo cargado en LM Studio' : 'O escribe un nombre personalizado...'}
          className="h-7 text-xs"
        />
      </div>

      {/* Info text */}
      {currentModel === 'loaded' && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <CheckCircle className="h-3 w-3 text-emerald-500" />
          Usará el modelo que tengas cargado en LM Studio
        </p>
      )}

      {/* Error message */}
      {error && models.length === 0 && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
}

// ============================================
// Ollama Model Selector
// Fetches available models from Ollama's /api/tags endpoint
// ============================================

interface OllamaModelSelectorProps {
  endpoint: string;
  currentModel: string;
  onModelChange: (model: string) => void;
}

function OllamaModelSelector({ endpoint, currentModel, onModelChange }: OllamaModelSelectorProps) {
  const [models, setModels] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchModels = useCallback(async () => {
    if (!endpoint) {
      toast({ variant: 'destructive', description: 'Configura el endpoint de Ollama primero' });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/ollama/models?endpoint=${encodeURIComponent(endpoint)}`, {
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(errData.error || `Servidor respondió con ${response.status}`);
      }

      const data = await response.json();
      const modelList = (data.data || [])
        .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));

      if (modelList.length === 0) {
        setError('No se encontraron modelos');
        toast({ description: 'No hay modelos disponibles en Ollama. Usa "ollama pull" para descargar uno.', variant: 'destructive' });
      } else {
        setModels(modelList);
        toast({ description: `${modelList.length} modelo(s) encontrado(s) en Ollama` });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error de conexión';
      setError(msg);
      toast({ variant: 'destructive', description: `Error al obtener modelos: ${msg}` });
    } finally {
      setLoading(false);
    }
  }, [endpoint, toast]);

  // Auto-fetch models when endpoint changes and we haven't loaded yet
  const lastFetchedEndpoint = useRef<string>('');
  useEffect(() => {
    if (endpoint && endpoint !== lastFetchedEndpoint.current) {
      lastFetchedEndpoint.current = endpoint;
      fetchModels();
    }
  }, [endpoint, fetchModels]);

  // Check if current model is in the fetched list
  const isModelInList = models.some(m => m.id === currentModel);

  return (
    <div className="mt-1 space-y-1.5">
      <div className="flex items-center gap-1.5">
        {/* Model dropdown */}
        <Select
          value={isModelInList ? currentModel : '__custom__'}
          onValueChange={(value) => {
            if (value === '__custom__') {
              // Keep current custom value
            } else {
              onModelChange(value);
            }
          }}
        >
          <SelectTrigger className="h-8 text-sm flex-1">
            <SelectValue placeholder="Seleccionar modelo..." />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {models.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                <span className="truncate block max-w-[280px]" title={model.id}>
                  {model.name}
                </span>
              </SelectItem>
            ))}

            {/* Show custom option if current model isn't in the list */}
            {!isModelInList && currentModel && (
              <>
                <SelectSeparator />
                <SelectItem value="__custom__" disabled>
                  <span className="truncate text-muted-foreground" title={currentModel}>
                    {currentModel} (personalizado)
                  </span>
                </SelectItem>
              </>
            )}
          </SelectContent>
        </Select>

        {/* Refresh button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={fetchModels}
                disabled={loading || !endpoint}
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Refrescar modelos desde Ollama</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Manual input for custom model name */}
      <div className="flex items-center gap-2">
        <Input
          value={currentModel || ''}
          onChange={(e) => onModelChange(e.target.value)}
          placeholder="O escribe un nombre personalizado (ej: qwen3.5:9b)..."
          className="h-7 text-xs"
        />
      </div>

      {/* Info text when model is selected */}
      {isModelInList && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <CheckCircle className="h-3 w-3 text-emerald-500" />
          Modelo disponible en Ollama
        </p>
      )}

      {/* Error message */}
      {error && models.length === 0 && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
}

// ============================================
// Grok Model Selector
// Fetches available models from xAI API
// ============================================

const GROK_POPULAR_MODELS = [
  { id: 'grok-4.20-reasoning', label: 'Grok 4.20 (Reasoning)', desc: 'Última versión con razonamiento avanzado' },
  { id: 'grok-4.20-non-reasoning', label: 'Grok 4.20 (Fast)', desc: 'Última versión sin razonamiento' },
  { id: 'grok-4-1-fast-reasoning', label: 'Grok 4.1 Fast (Reasoning)', desc: 'Rápido con razonamiento' },
  { id: 'grok-4-1-fast-non-reasoning', label: 'Grok 4.1 Fast', desc: 'Rápido sin razonamiento' },
  { id: 'grok-4.1', label: 'Grok 4.1', desc: 'Flagship - Mejor calidad' },
  { id: 'grok-4.1-mini', label: 'Grok 4.1 Mini', desc: 'Económico y rápido' },
  { id: 'grok-3', label: 'Grok 3', desc: 'Generación anterior' },
  { id: 'grok-3-mini', label: 'Grok 3 Mini', desc: 'Generación anterior - Rápido' },
  { id: 'grok-code-fast-1', label: 'Grok Code Fast', desc: 'Especializado en código' },
  { id: 'grok-4-0709', label: 'Grok 4.0', desc: 'Versión estable' },
  { id: 'grok-2-image-1212', label: 'Grok 2 Image', desc: 'Generación de imágenes' },
  { id: 'grok-2-vision-1212', label: 'Grok 2 Vision', desc: 'Visión y texto' },
];

interface GrokModelSelectorProps {
  apiKey: string;
  currentModel: string;
  onModelChange: (model: string) => void;
}

function GrokModelSelector({ apiKey, currentModel, onModelChange }: GrokModelSelectorProps) {
  const [models, setModels] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllModels, setShowAllModels] = useState(false);
  const { toast } = useToast();

  const fetchModels = useCallback(async () => {
    if (!apiKey) {
      setError('Ingresa tu API Key de xAI primero');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/grok/models?apiKey=${encodeURIComponent(apiKey)}`, {
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(errData.error || `Servidor respondió con ${response.status}`);
      }

      const data = await response.json();
      const modelList = (data.data || [])
        .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));

      if (modelList.length === 0) {
        setError('No se encontraron modelos');
        toast({ description: 'No hay modelos disponibles en xAI', variant: 'destructive' });
      } else {
        setModels(modelList);
        toast({ description: `${modelList.length} modelo(s) encontrado(s) en Grok` });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error de conexión';
      setError(msg);
      toast({ variant: 'destructive', description: `Error al obtener modelos: ${msg}` });
    } finally {
      setLoading(false);
    }
  }, [apiKey, toast]);

  useEffect(() => {
    if (apiKey) {
      fetchModels();
    }
  }, [apiKey, fetchModels]);

  const isModelInList = models.some(m => m.id === currentModel);
  
  const getModelLabel = (id: string): string => {
    const popular = GROK_POPULAR_MODELS.find(m => m.id === id);
    return popular?.label || id;
  };

  return (
    <div className="mt-1 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Select
          value={isModelInList ? currentModel : currentModel || '__select__'}
          onValueChange={(value) => {
            if (value === '__select__' || value === '__custom__') {
              // Keep current value
            } else {
              onModelChange(value);
            }
          }}
        >
          <SelectTrigger className="h-8 text-sm flex-1">
            <SelectValue placeholder="Seleccionar modelo..." />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Modelos Populares
            </div>
            {GROK_POPULAR_MODELS.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                <div className="flex flex-col">
                  <span className="font-medium">{model.label}</span>
                  <span className="text-[10px] text-muted-foreground">{model.desc}</span>
                </div>
              </SelectItem>
            ))}
            
            {models.length > 0 && (
              <>
                <SelectSeparator />
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center justify-between">
                  <span>Todos los modelos ({models.length})</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 text-[10px] px-1"
                    onClick={() => setShowAllModels(!showAllModels)}
                  >
                    {showAllModels ? 'Ocultar' : 'Ver'}
                  </Button>
                </div>
                {showAllModels && models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{getModelLabel(model.id)}</span>
                      <span className="text-[10px] text-muted-foreground">{model.id}</span>
                    </div>
                  </SelectItem>
                ))}
              </>
            )}

            {!isModelInList && currentModel && !GROK_POPULAR_MODELS.find(m => m.id === currentModel) && (
              <>
                <SelectSeparator />
                <SelectItem value="__custom__" disabled>
                  <span className="text-muted-foreground">
                    {currentModel} (personalizado)
                  </span>
                </SelectItem>
              </>
            )}
          </SelectContent>
        </Select>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={fetchModels}
                disabled={loading || !apiKey}
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Refrescar modelos desde Grok</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={currentModel || ''}
          onChange={(e) => onModelChange(e.target.value)}
          placeholder="grok-4.1, grok-4.20-reasoning, etc."
          className="h-7 text-xs"
        />
      </div>

      {currentModel && (
        <div className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3 text-emerald-500" />
          <p className="text-xs text-muted-foreground">
            {GROK_POPULAR_MODELS.find(m => m.id === currentModel)?.desc || 'Modelo personalizado'}
          </p>
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
}

const LLM_PROVIDERS: { value: LLMProvider; label: string; defaultEndpoint: string; needsEndpoint: boolean; description: string }[] = [
  { value: 'test-mock', label: '🧪 Test Mock (Prueba)', defaultEndpoint: '', needsEndpoint: false, description: 'Prueba del sistema de peticiones sin LLM real' },
  { value: 'z-ai', label: 'Z.ai Chat', defaultEndpoint: '', needsEndpoint: false, description: 'SDK integrado, sin configuración' },
  { value: 'text-generation-webui', label: 'Text Generation WebUI', defaultEndpoint: 'http://localhost:5000', needsEndpoint: true, description: 'API en puerto 5000 (iniciar con --api). Soporta tool calling con modelos compatibles (Qwen, Mistral, Llama 4).' },
  { value: 'ollama', label: 'Ollama', defaultEndpoint: 'http://localhost:11434', needsEndpoint: true, description: 'Servidor Ollama local' },
  { value: 'koboldcpp', label: 'KoboldCPP', defaultEndpoint: 'http://localhost:5001', needsEndpoint: true, description: 'Servidor KoboldCPP' },
  { value: 'vllm', label: 'vLLM', defaultEndpoint: 'http://localhost:8000', needsEndpoint: true, description: 'Servidor vLLM' },
  { value: 'lm-studio', label: 'LM Studio', defaultEndpoint: 'http://localhost:1234/v1', needsEndpoint: true, description: 'Servidor LM Studio local (OpenAI-compatible)' },
  { value: 'openai', label: 'OpenAI', defaultEndpoint: 'https://api.openai.com/v1', needsEndpoint: true, description: 'API de OpenAI' },
  { value: 'anthropic', label: 'Anthropic', defaultEndpoint: 'https://api.anthropic.com/v1', needsEndpoint: true, description: 'API de Anthropic' },
  { value: 'grok', label: 'Grok (xAI)', defaultEndpoint: 'https://api.x.ai/v1', needsEndpoint: false, description: 'API de xAI (Grok). Solo requiere API Key.' },
  { value: 'custom', label: 'Personalizado', defaultEndpoint: '', needsEndpoint: true, description: 'Endpoint personalizado OpenAI-compatible' }
];

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: string;
}

export function SettingsPanel({ open, onOpenChange, initialTab = 'llm' }: SettingsPanelProps) {
  const { toast } = useToast();
  const store = useTavernStore();
  const { 
    settings, 
    updateSettings, 
    llmConfigs, 
    addLLMConfig, 
    updateLLMConfig, 
    setActiveLLMConfig,
    deleteLLMConfig 
  } = store;

  const [newConfigOpen, setNewConfigOpen] = useState(false);
  const [recordingHotkey, setRecordingHotkey] = useState<string | null>(null);
  const [editingQuickReply, setEditingQuickReply] = useState<number | null>(null);
  const [editingQuickReplyLabel, setEditingQuickReplyLabel] = useState('');
  const [editingQuickReplyValue, setEditingQuickReplyValue] = useState('');
  const [newQuickReplyLabel, setNewQuickReplyLabel] = useState('');
  const [newQuickReplyValue, setNewQuickReplyValue] = useState('');
  const hotkeyContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newConfig, setNewConfig] = useState({
    name: '',
    provider: 'z-ai' as LLMProvider,
    endpoint: '',
    apiKey: ''
  });

  // Export all configuration (without characters/sessions)
  const handleExportConfig = () => {
    try {
      const configData = {
        version: '2.0',
        exportedAt: new Date().toISOString(),
        type: 'config',
        data: {
          // Settings
          settings: store.settings,
          // LLM & TTS
          llmConfigs: store.llmConfigs,
          ttsConfigs: store.ttsConfigs,
          promptTemplates: store.promptTemplates,
          // Personas
          personas: store.personas,
          // Lorebooks
          lorebooks: store.lorebooks,
          activeLorebookIds: store.activeLorebookIds,
          // Sound system
          soundTriggers: store.soundTriggers,
          soundCollections: store.soundCollections,
          soundSequenceTriggers: store.soundSequenceTriggers,
          // Visual systems - Backgrounds
          backgrounds: store.backgrounds,
          backgroundPacks: store.backgroundPacks,
          backgroundIndex: store.backgroundIndex,
          backgroundTriggerPacks: store.backgroundTriggerPacks,
          backgroundCollections: store.backgroundCollections,
          // Visual systems - Sprites (V2)
          spritePacksV2: store.spritePacksV2,
          // HUD
          hudTemplates: store.hudTemplates,
          // Atmosphere
          atmosphereSettings: store.atmosphereSettings,
          activeAtmospherePresetId: store.activeAtmospherePresetId,
          // Memory
          summarySettings: store.summarySettings,
          characterMemories: store.characterMemories,
          sessionTracking: store.sessionTracking,
          // Quest
          questSettings: store.questSettings,
          questTemplates: store.questTemplates,
          questNotifications: store.questNotifications,
          // Dialogue
          dialogueSettings: store.dialogueSettings,
          // Inventory
          inventorySettings: store.inventorySettings,
          inventoryNotifications: store.inventoryNotifications,
        }
      };

      const blob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tavernflow-config-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Configuración exportada',
        description: 'El archivo de configuración se ha descargado correctamente.',
      });
    } catch (error) {
      toast({
        title: 'Error al exportar',
        description: 'No se pudo exportar la configuración.',
        variant: 'destructive',
      });
    }
  };

  // Import configuration
  const handleImportConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const imported = JSON.parse(content);

        // Validate structure
        if (!imported.data) {
          throw new Error('Invalid config file structure');
        }

        const { data } = imported;
        const updates: Record<string, unknown> = {};

        // Config data keys (same as in export)
        const configKeys = [
          'settings', 'llmConfigs', 'ttsConfigs', 'promptTemplates',
          'personas', 'lorebooks', 'activeLorebookIds',
          'soundTriggers', 'soundCollections', 'soundSequenceTriggers',
          'backgrounds', 'backgroundPacks', 'backgroundIndex', 'backgroundTriggerPacks', 'backgroundCollections',
          'spritePacksV2',
          'hudTemplates',
          'atmosphereSettings', 'activeAtmospherePresetId',
          'summarySettings', 'characterMemories', 'sessionTracking',
          'questSettings', 'questTemplates', 'questNotifications',
          'dialogueSettings',
          'inventorySettings', 'inventoryNotifications'
        ];

        configKeys.forEach(key => {
          if (data[key] !== undefined) {
            updates[key] = data[key];
          }
        });

        if (Object.keys(updates).length > 0) {
          useTavernStore.setState(updates);
        }

        toast({
          title: 'Configuración importada',
          description: `${Object.keys(updates).length} secciones de configuración importadas correctamente.`,
        });
      } catch (error) {
        toast({
          title: 'Error al importar',
          description: 'El archivo no tiene un formato válido.',
          variant: 'destructive',
        });
      }
    };
    reader.readAsText(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Export everything (config + characters + sessions + groups)
  const handleExportAll = () => {
    try {
      const allData = {
        version: '2.0',
        exportedAt: new Date().toISOString(),
        type: 'full',
        data: {
          // Configuration
          settings: store.settings,
          llmConfigs: store.llmConfigs,
          ttsConfigs: store.ttsConfigs,
          promptTemplates: store.promptTemplates,
          personas: store.personas,
          // Lorebooks
          lorebooks: store.lorebooks,
          activeLorebookIds: store.activeLorebookIds,
          // Sound system
          soundTriggers: store.soundTriggers,
          soundCollections: store.soundCollections,
          soundSequenceTriggers: store.soundSequenceTriggers,
          // Visual systems - Backgrounds
          backgrounds: store.backgrounds,
          backgroundPacks: store.backgroundPacks,
          backgroundIndex: store.backgroundIndex,
          backgroundTriggerPacks: store.backgroundTriggerPacks,
          backgroundCollections: store.backgroundCollections,
          // Visual systems - Sprites (V2)
          spritePacksV2: store.spritePacksV2,
          // HUD
          hudTemplates: store.hudTemplates,
          // Atmosphere
          atmosphereSettings: store.atmosphereSettings,
          activeAtmospherePresetId: store.activeAtmospherePresetId,
          // Memory
          summarySettings: store.summarySettings,
          summaries: store.summaries,
          characterMemories: store.characterMemories,
          sessionTracking: store.sessionTracking,
          // Quest
          questSettings: store.questSettings,
          questTemplates: store.questTemplates,
          quests: store.quests,
          questNotifications: store.questNotifications,
          // Dialogue
          dialogueSettings: store.dialogueSettings,
          // Inventory
          inventorySettings: store.inventorySettings,
          items: store.items,
          containers: store.containers,
          currencies: store.currencies,
          inventoryNotifications: store.inventoryNotifications,
          // Timeline
          collections: store.collections,
          // Data
          characters: store.characters,
          sessions: store.sessions,
          groups: store.groups,
          // Active states
          activeSessionId: store.activeSessionId,
          activeCharacterId: store.activeCharacterId,
          activeGroupId: store.activeGroupId,
          activeBackground: store.activeBackground,
          activeOverlayBack: store.activeOverlayBack,
          activeOverlayFront: store.activeOverlayFront,
          activePersonaId: store.activePersonaId,
        }
      };

      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tavernflow-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Backup completo exportado',
        description: 'Todos los datos se han exportado correctamente.',
      });
    } catch (error) {
      toast({
        title: 'Error al exportar',
        description: 'No se pudo crear el backup.',
        variant: 'destructive',
      });
    }
  };

  // Import everything
  const handleImportAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const imported = JSON.parse(content);

        if (!imported.data) {
          throw new Error('Invalid backup file structure');
        }

        const { data } = imported;
        const updates: Record<string, unknown> = {};

        // All data keys (same as in export)
        const allDataKeys = [
          // Config
          'settings', 'llmConfigs', 'ttsConfigs', 'promptTemplates',
          'personas', 'lorebooks', 'activeLorebookIds',
          'soundTriggers', 'soundCollections', 'soundSequenceTriggers',
          'backgrounds', 'backgroundPacks', 'backgroundIndex', 'backgroundTriggerPacks', 'backgroundCollections',
          'spritePacksV2',
          'hudTemplates',
          'atmosphereSettings', 'activeAtmospherePresetId',
          'summarySettings', 'summaries', 'characterMemories', 'sessionTracking',
          'questSettings', 'questTemplates', 'quests', 'questNotifications',
          'dialogueSettings',
          'inventorySettings', 'items', 'containers', 'currencies', 'inventoryNotifications',
          // Timeline
          'collections',
          // Data
          'characters', 'sessions', 'groups',
          // Active states
          'activeSessionId', 'activeCharacterId', 'activeGroupId',
          'activeBackground', 'activeOverlayBack', 'activeOverlayFront', 'activePersonaId'
        ];

        allDataKeys.forEach(key => {
          if (data[key] !== undefined) {
            updates[key] = data[key];
          }
        });

        if (Object.keys(updates).length > 0) {
          useTavernStore.setState(updates);
        }

        toast({
          title: 'Backup importado',
          description: `${Object.keys(updates).length} secciones importadas correctamente.`,
        });
      } catch (error) {
        toast({
          title: 'Error al importar',
          description: 'El archivo no tiene un formato válido.',
          variant: 'destructive',
        });
      }
    };
    reader.readAsText(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Cancel hotkey recording when clicking outside or pressing Escape
  useEffect(() => {
    if (!recordingHotkey) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (hotkeyContainerRef.current && !hotkeyContainerRef.current.contains(e.target as Node)) {
        setRecordingHotkey(null);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setRecordingHotkey(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [recordingHotkey]);

  const handleAddConfig = () => {
    addLLMConfig({
      ...newConfig,
      model: '',
      parameters: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxTokens: 512,
        contextSize: 4096,
        repetitionPenalty: 1.1,
        frequencyPenalty: 0,
        presencePenalty: 0,
        stopStrings: [],
        stream: true
      },
      isActive: false
    });
    setNewConfigOpen(false);
    setNewConfig({
      name: '',
      provider: 'z-ai',
      endpoint: '',
      apiKey: ''
    });
  };

  const handleProviderChange = (provider: LLMProvider) => {
    const providerConfig = LLM_PROVIDERS.find(p => p.value === provider);
    const defaultEndpoint = providerConfig?.defaultEndpoint || '';
    setNewConfig(prev => ({ 
      ...prev, 
      provider, 
      endpoint: defaultEndpoint,
      apiKey: provider === 'z-ai' ? '' : prev.apiKey
    }));
  };

  // Hotkey recording handler
  const handleHotkeyKeyDown = (action: string, e: React.KeyboardEvent) => {
    if (!recordingHotkey) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Build the hotkey string
    const parts: string[] = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');
    if (e.metaKey) parts.push('Meta');
    
    // Add the main key (but not modifier keys themselves)
    const key = e.key;
    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
      parts.push(key);
    }
    
    if (parts.length > 0 && !['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
      const hotkeyString = parts.join('+');
      updateSettings({
        hotkeys: {
          ...settings.hotkeys,
          [action]: hotkeyString
        }
      });
      setRecordingHotkey(null);
    }
  };

  // Format hotkey for display
  const formatHotkeyDisplay = (hotkey: string) => {
    return hotkey
      .replace(/\+/g, ' + ')
      .replace(/Arrow/g, '')
      .replace(/Enter/g, '↵')
      .replace(/Shift/g, '⇧')
      .replace(/Ctrl/g, '⌃')
      .replace(/Alt/g, '⌥');
  };

  // Hotkey action labels
  const hotkeyLabels: Record<string, { label: string; description: string }> = {
    send: { label: 'Enviar mensaje', description: 'Envía el mensaje actual' },
    newLine: { label: 'Nueva línea', description: 'Inserta una nueva línea' },
    regenerate: { label: 'Regenerar', description: 'Regenera la última respuesta' },
    swipeLeft: { label: 'Deslizar izquierda', description: 'Ver respuesta alternativa anterior' },
    swipeRight: { label: 'Deslizar derecha', description: 'Ver siguiente respuesta alternativa' }
  };

  // Active tab state (controlled)
  const [activeTab, setActiveTab] = useState(initialTab);

  // Sync active tab when initialTab prop changes or panel opens
  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
    }
  }, [initialTab, open]);

  // Close panel on Escape (unless recording a hotkey)
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !recordingHotkey) {
        e.preventDefault();
        onOpenChangeRef.current(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, recordingHotkey]);

  // Settings navigation tabs
  const settingsTabs = [
    { value: 'llm', label: 'LLM', icon: Bot },
    { value: 'persona', label: 'Persona', icon: User },
    { value: 'lorebooks', label: 'Lorebooks', icon: BookOpen },
    { value: 'appearance', label: 'Apariencia', icon: Palette },
    { value: 'sounds', label: 'Sonidos', icon: Music },
    { value: 'backgrounds', label: 'Fondos', icon: ImageIcon },
    { value: 'voice', label: 'Voz / TTS', icon: Volume2 },
    { value: 'hotkeys', label: 'Atajos', icon: Keyboard },
    { value: 'data', label: 'Datos', icon: Database },
    { value: 'hud', label: 'HUD', icon: Layers },
    { value: 'atmosphere', label: 'Atmósfera', icon: Cloud },
    { value: 'memory', label: 'Memoria', icon: Brain },
    { value: 'quests', label: 'Misiones', icon: Target },
    { value: 'inventory', label: 'Inventario', icon: Package },
    { value: 'sprites', label: 'Sprites', icon: Sparkles },
    { value: 'embeddings', label: 'Embeddings', icon: Brain },
    { value: 'tools', label: 'Herramientas', icon: Wrench },
    { value: 'handy', label: 'Haptic', icon: Zap },
  ];

  // Separators after these tabs to group related sections
  const separatorAfter = new Set(['lorebooks', 'voice', 'data', 'sprites', 'tools']);

  return (
    <>
      {/* Full-screen settings overlay */}
      <AnimatePresence mode="wait">
        {open && (
          <motion.div
            key="settings-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="fixed inset-0 z-50 bg-background"
          >
            <div className="h-full flex">
              {/* ===== Sidebar ===== */}
              <motion.aside
                initial={{ x: -16, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.25, delay: 0.05, ease: 'easeOut' }}
                className="w-14 md:w-60 border-r bg-muted/30 flex flex-col flex-shrink-0"
              >
                {/* Sidebar header with title and close button */}
                <div className="flex items-center justify-between px-2 py-3 md:px-4 border-b">
                  <div className="flex items-center gap-2 min-w-0">
                    <Settings className="w-5 h-5 shrink-0 text-muted-foreground" />
                    <span className="hidden md:inline font-semibold text-sm truncate">
                      Configuración
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => onOpenChange(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* Scrollable navigation */}
                <ScrollArea className="flex-1">
                  <TooltipProvider delayDuration={400}>
                    <nav className="p-1.5 md:p-2 space-y-0.5">
                      {settingsTabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.value;

                        return (
                          <div key={tab.value}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => setActiveTab(tab.value)}
                                  className={cn(
                                    'w-full flex items-center gap-3 rounded-md text-sm transition-all duration-150',
                                    'px-0 md:px-3 py-2 justify-center md:justify-start',
                                    isActive
                                      ? 'bg-primary/10 text-primary font-medium shadow-sm'
                                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                                  )}
                                >
                                  <Icon className={cn(
                                    'w-4 h-4 shrink-0 transition-colors',
                                    isActive && 'text-primary'
                                  )} />
                                  <span className="hidden md:inline truncate">
                                    {tab.label}
                                  </span>
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="md:hidden">
                                {tab.label}
                              </TooltipContent>
                            </Tooltip>
                            {separatorAfter.has(tab.value) && (
                              <Separator className="my-1.5 md:my-2" />
                            )}
                          </div>
                        );
                      })}
                    </nav>
                  </TooltipProvider>
                </ScrollArea>

                {/* Sidebar footer - version info */}
                <div className="hidden md:flex items-center px-4 py-2 border-t text-xs text-muted-foreground">
                  <Settings2 className="w-3 h-3 mr-1.5" />
                  <span>TavernFlow v2.0</span>
                </div>
              </motion.aside>

              {/* ===== Main content area ===== */}
              <motion.main
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.1, ease: 'easeOut' }}
                className="flex-1 overflow-hidden min-w-0"
              >
                <Tabs
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="h-full"
                >
                  {/* Content container with proper height */}
                  <div className="h-full overflow-hidden">
            {/* LLM Settings */}
            <TabsContent value="llm" className="h-full overflow-y-auto p-6 m-0 data-[state=inactive]:hidden">
              <TooltipProvider>
              <div className="space-y-4">
                {/* Info Banner */}
                <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Bot className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-blue-600 dark:text-blue-400">Configuración de LLM</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Gestiona tus conexiones a modelos de lenguaje. Soporta proveedores locales como <strong>Ollama</strong>, <strong>KoboldCPP</strong> y APIs remotas.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {/* Left: LLM Connections List */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <Cpu className="w-4 h-4" />
                      <span className="font-medium">Conexiones LLM</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-3.5 h-3.5 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Las conexiones LLM definen cómo TavernFlow se comunica con los modelos de lenguaje.</p>
                        </TooltipContent>
                      </Tooltip>
                      <Button size="sm" className="ml-auto h-6 text-xs" onClick={() => setNewConfigOpen(true)}>
                        <Plus className="w-3 h-3 mr-1" />
                        Agregar
                      </Button>
                    </div>

                  <div className="p-3 bg-muted/30 rounded-lg border border-border/40 space-y-3">
                    {llmConfigs.map((config) => (
                      <div 
                        key={config.id} 
                        className={cn(
                          'p-3 rounded-lg border transition-colors cursor-pointer',
                          config.isActive ? 'border-primary bg-primary/5' : 'border-border/40 hover:bg-muted/50'
                        )}
                        onClick={() => !config.isActive && setActiveLLMConfig(config.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'w-2.5 h-2.5 rounded-full',
                              config.isActive ? 'bg-green-500' : 'bg-muted-foreground'
                            )} />
                            <div>
                              <p className="font-medium text-sm">{config.name}</p>
                              <p className="text-xs text-muted-foreground">{config.provider}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {!config.isActive && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="h-7 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveLLMConfig(config.id);
                                }}
                              >
                                <Check className="w-3 h-3 mr-1" />
                                Activar
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteLLMConfig(config.id);
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                        {config.endpoint && config.provider !== 'z-ai' && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1 ml-5">
                            <ExternalLink className="w-3 h-3" />
                            {config.endpoint}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Active Config Parameters */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <Sliders className="w-4 h-4" />
                    <span className="font-medium">Parámetros</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3.5 h-3.5 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Ajusta los parámetros de generación como temperatura, top-p, y límites de tokens.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  {llmConfigs.find(c => c.isActive) ? (
                    (() => {
                      const config = llmConfigs.find(c => c.isActive)!;
                      const providerInfo = LLM_PROVIDERS.find(p => p.value === config.provider);
                      return (
                        <div className="p-3 bg-muted/30 rounded-lg border border-border/40 space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{config.name}</span>
                            <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                              {providerInfo?.label || config.provider}
                            </span>
                          </div>
                          
                          {/* Connection Settings - Show endpoint/model/apiKey */}
                          <div className="space-y-3 p-3 rounded-lg border border-border/40 bg-background/50">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Zap className="w-3.5 h-3.5" />
                              <span className="font-medium">Configuración de Conexión</span>
                            </div>
                            
                            {/* Endpoint field - for providers that need it */}
                            {providerInfo?.needsEndpoint && (
                              <div>
                                <Label className="text-xs">URL del Endpoint</Label>
                                <Input
                                  value={config.endpoint || ''}
                                  onChange={(e) => 
                                    updateLLMConfig(config.id, { endpoint: e.target.value })
                                  }
                                  placeholder={providerInfo.defaultEndpoint}
                                  className="mt-1 h-8 text-sm"
                                />
                              </div>
                            )}
                            
                            {/* Model field - for providers that need model selection */}
                            {config.provider !== 'z-ai' && config.provider !== 'test-mock' && (
                              <div>
                                <Label className="text-xs">Modelo {(config.provider === 'lm-studio' || config.provider === 'ollama' || config.provider === 'grok') ? '' : '(opcional)'}</Label>
                                
                                {/* LM Studio: Model selector with refresh and dropdown */}
                                {config.provider === 'lm-studio' ? (
                                  <LMStudioModelSelector
                                    endpoint={config.endpoint}
                                    currentModel={config.model || ''}
                                    onModelChange={(model) => updateLLMConfig(config.id, { model })}
                                  />
                                ) : config.provider === 'ollama' ? (
                                  <OllamaModelSelector
                                    endpoint={config.endpoint}
                                    currentModel={config.model || ''}
                                    onModelChange={(model) => updateLLMConfig(config.id, { model })}
                                  />
                                ) : config.provider === 'grok' ? (
                                  <GrokModelSelector
                                    apiKey={config.apiKey || ''}
                                    currentModel={config.model || ''}
                                    onModelChange={(model) => updateLLMConfig(config.id, { model })}
                                  />
                                ) : (
                                  <Input
                                    value={config.model || ''}
                                    onChange={(e) => 
                                      updateLLMConfig(config.id, { model: e.target.value })
                                    }
                                    placeholder={config.provider === 'openai' ? 'gpt-4o-mini' : config.provider === 'anthropic' ? 'claude-sonnet-4-20250514' : config.provider === 'grok' ? 'grok-3, grok-2' : ''}
                                    className="mt-1 h-8 text-sm"
                                  />
                                )}
                              </div>
                            )}
                            
                            {/* API Key field - for providers that need it */}
                            {config.provider !== 'z-ai' && (
                              <div>
                                <Label className="text-xs">API Key {config.provider === 'openai' || config.provider === 'anthropic' || config.provider === 'grok' ? '(requerido)' : '(opcional)'}</Label>
                                <div className="flex gap-2 mt-1">
                                  <Input
                                    type="password"
                                    value={config.apiKey || ''}
                                    onChange={(e) => 
                                      updateLLMConfig(config.id, { apiKey: e.target.value })
                                    }
                                    placeholder={config.provider === 'grok' ? 'xai-...' : 'sk-...'}
                                    className="h-8 text-sm flex-1"
                                  />
                                  {config.provider === 'grok' && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 text-xs gap-1"
                                      onClick={async () => {
                                        if (!config.apiKey) {
                                          toast({ variant: 'destructive', description: 'Ingresa tu API Key de xAI primero' });
                                          return;
                                        }
                                        try {
                                          const response = await fetch(`/api/grok/models?apiKey=${encodeURIComponent(config.apiKey!)}`, {
                                            signal: AbortSignal.timeout(10000),
                                          });
                                          if (response.ok) {
                                            const data = await response.json();
                                            toast({ description: `Conexión exitosa. ${data.data?.length || 0} modelos disponibles.` });
                                          } else {
                                            const err = await response.json().catch(() => ({ error: 'Error desconocido' }));
                                            toast({ variant: 'destructive', description: `Error: ${err.error || response.statusText}` });
                                          }
                                        } catch (err) {
                                          toast({ variant: 'destructive', description: `Error de conexión: ${err instanceof Error ? err.message : 'Desconocido'}` });
                                        }
                                      }}
                                    >
                                      <Zap className="h-3 w-3" />
                                      Probar
                                    </Button>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {/* Z.ai info */}
                            {config.provider === 'z-ai' && (
                              <div className="space-y-3">
                                <div className="p-2 bg-green-500/10 rounded text-xs text-green-600 dark:text-green-400">
                                  ✓ Z.ai usa el SDK integrado.
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs">Token JWT (opcional)</Label>
                                  <Input
                                    type="password"
                                    value={config.apiKey || ''}
                                    onChange={(e) => 
                                      updateLLMConfig(config.id, { apiKey: e.target.value })
                                    }
                                    placeholder="Si el servidor requiere X-Token header"
                                    className="h-8 text-sm"
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Algunos servidores Z.ai requieren un token JWT. Si ves error "missing X-Token header", necesitas este campo.
                                  </p>
                                </div>
                              </div>
                            )}
                            
                            {/* Test Mock custom response */}
                            {config.provider === 'test-mock' && (
                              <div className="space-y-2">
                                <Label className="text-xs">Respuesta de Prueba (Mock Response)</Label>
                                <textarea
                                  value={config.mockResponse || ''}
                                  onChange={(e) => 
                                    updateLLMConfig(config.id, { mockResponse: e.target.value })
                                  }
                                  placeholder={`Escribe la respuesta simulada del personaje.\nUsa [key] para activar peticiones.\n\nEjemplo:\n*El personaje te mira*\n\n[peticion_madera]\n\n¿Podrías conseguirme madera?`}
                                  className="mt-1 w-full h-32 p-2 text-sm rounded-md border border-input bg-background resize-y"
                                />
                                <p className="text-xs text-muted-foreground">
                                  Usa <code className="bg-muted px-1 rounded">[clave]</code> para simular activación de peticiones.
                                </p>
                              </div>
                            )}
                          </div>
                          
                          {/* Sliders in 2 columns */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>Temperatura</span>
                                <span className="text-muted-foreground">{config.parameters.temperature}</span>
                              </div>
                              <Slider
                                value={[config.parameters.temperature]}
                                min={0}
                                max={2}
                                step={0.1}
                                onValueChange={([value]) => 
                                  updateLLMConfig(config.id, {
                                    parameters: { ...config.parameters, temperature: value }
                                  })
                                }
                              />
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>Top P</span>
                                <span className="text-muted-foreground">{config.parameters.topP}</span>
                              </div>
                              <Slider
                                value={[config.parameters.topP]}
                                min={0}
                                max={1}
                                step={0.05}
                                onValueChange={([value]) => 
                                  updateLLMConfig(config.id, {
                                    parameters: { ...config.parameters, topP: value }
                                  })
                                }
                              />
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>Top K</span>
                                <span className="text-muted-foreground">{config.parameters.topK}</span>
                              </div>
                              <Slider
                                value={[config.parameters.topK]}
                                min={1}
                                max={100}
                                step={1}
                                onValueChange={([value]) => 
                                  updateLLMConfig(config.id, {
                                    parameters: { ...config.parameters, topK: value }
                                  })
                                }
                              />
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>Penalización de Repetición</span>
                                <span className="text-muted-foreground">{config.parameters.repetitionPenalty}</span>
                              </div>
                              <Slider
                                value={[config.parameters.repetitionPenalty]}
                                min={1}
                                max={2}
                                step={0.05}
                                onValueChange={([value]) => 
                                  updateLLMConfig(config.id, {
                                    parameters: { ...config.parameters, repetitionPenalty: value }
                                  })
                                }
                              />
                            </div>
                          </div>

                          {/* Number inputs in responsive columns */}
                          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                            <div>
                              <Label className="text-xs">Tokens Máx.</Label>
                              <Input
                                type="number"
                                value={config.parameters.maxTokens}
                                onChange={(e) => 
                                  updateLLMConfig(config.id, {
                                    parameters: { ...config.parameters, maxTokens: parseInt(e.target.value) }
                                  })
                                }
                                className="mt-1 h-8"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Contexto</Label>
                              <Input
                                type="number"
                                value={config.parameters.contextSize}
                                onChange={(e) => 
                                  updateLLMConfig(config.id, {
                                    parameters: { ...config.parameters, contextSize: parseInt(e.target.value) }
                                  })
                                }
                                className="mt-1 h-8"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Freq. Penal.</Label>
                              <Input
                                type="number"
                                step={0.1}
                                value={config.parameters.frequencyPenalty}
                                onChange={(e) => 
                                  updateLLMConfig(config.id, {
                                    parameters: { ...config.parameters, frequencyPenalty: parseFloat(e.target.value) }
                                  })
                                }
                                className="mt-1 h-8"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Pres. Penal.</Label>
                              <Input
                                type="number"
                                step={0.1}
                                value={config.parameters.presencePenalty}
                                onChange={(e) => 
                                  updateLLMConfig(config.id, {
                                    parameters: { ...config.parameters, presencePenalty: parseFloat(e.target.value) }
                                  })
                                }
                                className="mt-1 h-8"
                              />
                            </div>
                          </div>

                          {/* Toggles in row */}
                          <div className="flex items-center gap-6 pt-2">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                              <Switch
                                checked={config.parameters.stream}
                                onCheckedChange={(checked) => 
                                  updateLLMConfig(config.id, {
                                    parameters: { ...config.parameters, stream: checked }
                                  })
                                }
                              />
                              Streaming
                            </label>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="p-3 bg-muted/30 rounded-lg border border-border/40 text-center py-8 text-muted-foreground">
                      <Bot className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Selecciona una conexión para ver sus parámetros</p>
                    </div>
                  )}
                </div>
              </div>
              </div>
              </TooltipProvider>
            </TabsContent>

            {/* Persona Settings */}
            <TabsContent value="persona" className="h-full overflow-hidden p-6 m-0 data-[state=inactive]:hidden">
              <PersonaPanel />
            </TabsContent>

            {/* Lorebook Settings */}
            <TabsContent value="lorebooks" className="h-full overflow-hidden p-6 m-0 data-[state=inactive]:hidden">
              <LorebookPanel />
            </TabsContent>

            {/* Appearance Settings */}
            <TabsContent value="appearance" className="h-full overflow-hidden m-0 p-4 data-[state=inactive]:hidden">
              <AppearanceSettingsPanel />
            </TabsContent>

            {/* Sound Triggers Settings */}
            <TabsContent value="sounds" className="h-full overflow-hidden p-6 m-0 data-[state=inactive]:hidden">
              <SoundTriggersSettings />
            </TabsContent>

            {/* Background Triggers Settings */}
            <TabsContent value="backgrounds" className="h-full overflow-hidden p-6 m-0 data-[state=inactive]:hidden">
              <BackgroundTriggersSettings />
            </TabsContent>

            {/* Voice Settings */}
            <TabsContent value="voice" className="h-full overflow-y-auto p-6 m-0 data-[state=inactive]:hidden">
              <TTSSettingsPanel />
            </TabsContent>

            {/* Hotkeys Settings */}
            <TabsContent value="hotkeys" className="h-full overflow-y-auto p-6 m-0 data-[state=inactive]:hidden">
              <div className="space-y-4">
                {/* Banner Informativo */}
                <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-500/20 rounded-lg">
                      <Keyboard className="w-5 h-5 text-amber-500" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-amber-600">Atajos de Teclado</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Personaliza los atajos de teclado para acciones rápidas. 
                        Haz clic en un atajo para editarlo y presiona la nueva combinación.
                      </p>
                    </div>
                  </div>
                </div>

                <div ref={hotkeyContainerRef}>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">Atajos de Teclado</h3>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => updateSettings({
                        hotkeys: {
                          send: 'Enter',
                          newLine: 'Shift+Enter',
                          regenerate: 'Ctrl+R',
                          swipeLeft: 'ArrowLeft',
                          swipeRight: 'ArrowRight'
                        }
                      })}
                    >
                      Restablecer
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    {Object.entries(settings.hotkeys).map(([action, key]) => {
                      const info = hotkeyLabels[action] || { label: action, description: '' };
                      const isRecording = recordingHotkey === action;
                      
                      return (
                        <div 
                          key={action} 
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer",
                            isRecording && "border-primary bg-primary/5 ring-2 ring-primary/20"
                          )}
                          onClick={() => setRecordingHotkey(action)}
                          onKeyDown={(e) => handleHotkeyKeyDown(action, e)}
                          tabIndex={0}
                          role="button"
                        >
                          <div>
                            <Label className="text-sm">{info.label}</Label>
                            {info.description && (
                              <p className="text-xs text-muted-foreground">{info.description}</p>
                            )}
                          </div>
                          <kbd 
                            className={cn(
                              "px-3 py-1.5 rounded text-xs font-mono min-w-[80px] text-center transition-colors",
                              isRecording 
                                ? "bg-primary text-primary-foreground animate-pulse" 
                                : "bg-muted"
                            )}
                          >
                            {isRecording ? 'Presiona tecla...' : formatHotkeyDisplay(key)}
                          </kbd>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <Collapsible defaultOpen={false}>
                <button
                  onClick={(e) => {
                    const trigger = e.currentTarget;
                    const content = trigger.nextElementSibling;
                    if (content) {
                      content.classList.toggle('hidden');
                      const icon = trigger.querySelector('.chevron-icon');
                      if (icon) icon.classList.toggle('rotate-180');
                    }
                  }}
                  className="flex items-center justify-between w-full p-3 rounded-lg border bg-muted/30 text-sm hover:bg-muted/50 transition-colors"
                >
                  <h4 className="font-medium text-foreground">Cómo usar los atajos</h4>
                  <ChevronDown className="w-4 h-4 text-muted-foreground chevron-icon transition-transform duration-200" />
                </button>
                <div className="hidden p-4 rounded-b-lg border border-t-0 bg-muted/30 text-sm space-y-3">
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Haz clic en un atajo para editarlo y presiona la nueva combinación de teclas.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span><strong>Enviar:</strong> Envía el mensaje cuando estás en el campo de texto.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span><strong>Nueva línea:</strong> Inserta un salto de línea en el mensaje.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span><strong>Regenerar:</strong> Vuelve a generar la última respuesta del personaje.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span><strong>Deslizar:</strong> Navega entre respuestas alternativas (cuando están disponibles).</span>
                    </li>
                  </ul>
                  
                  <div className="pt-2 border-t mt-4">
                    <p className="text-xs text-muted-foreground">
                      Tip: Puedes usar combinaciones como Ctrl+Enter, Shift+R, o teclas de flecha.
                    </p>
                  </div>
                </div>
                </Collapsible>

                {/* Respuestas Rápidas */}
                <div className="border-t pt-4 mt-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-emerald-500/20 rounded-lg">
                      <MessageSquare className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-emerald-600">Respuestas Rápidas</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Botones de acceso rápido en el chat. <strong>Etiqueta</strong> es lo que se ve, <strong>Respuesta</strong> es lo que se envía.
                      </p>
                    </div>
                  </div>

                  {/* Existing items */}
                  <div className="space-y-2">
                    {settings.quickReplies.map((item, index) => (
                      <div
                        key={index}
                        className="rounded-lg border group"
                      >
                        {editingQuickReply === index ? (
                          <div className="p-2 space-y-2">
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-muted-foreground w-16 flex-shrink-0">Etiqueta</Label>
                              <Input
                                value={editingQuickReplyLabel}
                                onChange={(e) => setEditingQuickReplyLabel(e.target.value)}
                                className="h-8 text-sm flex-1"
                                placeholder="Texto visible en el botón..."
                                maxLength={20}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-muted-foreground w-16 flex-shrink-0">Respuesta</Label>
                              <Input
                                value={editingQuickReplyValue}
                                onChange={(e) => setEditingQuickReplyValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && editingQuickReplyValue.trim() && editingQuickReplyLabel.trim()) {
                                    const updated = [...settings.quickReplies];
                                    updated[index] = { label: editingQuickReplyLabel.trim(), response: editingQuickReplyValue.trim() };
                                    updateSettings({ quickReplies: updated });
                                    setEditingQuickReply(null);
                                    setEditingQuickReplyValue('');
                                    setEditingQuickReplyLabel('');
                                  }
                                  if (e.key === 'Escape') {
                                    setEditingQuickReply(null);
                                    setEditingQuickReplyValue('');
                                    setEditingQuickReplyLabel('');
                                  }
                                }}
                                className="h-8 text-sm flex-1"
                                placeholder="Texto que se envía como mensaje..."
                                maxLength={200}
                              />
                            </div>
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                                disabled={!editingQuickReplyValue.trim() || !editingQuickReplyLabel.trim()}
                                onClick={() => {
                                  if (editingQuickReplyValue.trim() && editingQuickReplyLabel.trim()) {
                                    const updated = [...settings.quickReplies];
                                    updated[index] = { label: editingQuickReplyLabel.trim(), response: editingQuickReplyValue.trim() };
                                    updateSettings({ quickReplies: updated });
                                  }
                                  setEditingQuickReply(null);
                                  setEditingQuickReplyValue('');
                                  setEditingQuickReplyLabel('');
                                }}
                              >
                                <Check className="w-3.5 h-3.5 mr-1" />
                                Guardar
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                  setEditingQuickReply(null);
                                  setEditingQuickReplyValue('');
                                  setEditingQuickReplyLabel('');
                                }}
                              >
                                <X className="w-3.5 h-3.5 mr-1" />
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 p-2">
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium">{item.label}</span>
                              {item.response !== item.label && (
                                <p className="text-xs text-muted-foreground truncate mt-0.5">{item.response}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                  setEditingQuickReply(index);
                                  setEditingQuickReplyLabel(item.label);
                                  setEditingQuickReplyValue(item.response);
                                }}
                              >
                                <Settings2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-red-400 hover:text-red-500 hover:bg-red-500/10"
                                onClick={() => {
                                  const updated = settings.quickReplies.filter((_, i) => i !== index);
                                  updateSettings({ quickReplies: updated });
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Add new quick reply */}
                  {settings.quickReplies.length < 12 && (
                    <div className="p-3 rounded-lg border border-dashed space-y-2">
                      <p className="text-xs text-muted-foreground font-medium">Agregar nueva respuesta rápida</p>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground w-16 flex-shrink-0">Etiqueta</Label>
                        <Input
                          value={newQuickReplyLabel}
                          onChange={(e) => setNewQuickReplyLabel(e.target.value)}
                          className="h-8 text-sm flex-1"
                          placeholder="Ej: Buscar..."
                          maxLength={20}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground w-16 flex-shrink-0">Respuesta</Label>
                        <Input
                          value={newQuickReplyValue}
                          onChange={(e) => setNewQuickReplyValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newQuickReplyValue.trim() && newQuickReplyLabel.trim()) {
                              updateSettings({
                                quickReplies: [...settings.quickReplies, { label: newQuickReplyLabel.trim(), response: newQuickReplyValue.trim() }]
                              });
                              setNewQuickReplyValue('');
                              setNewQuickReplyLabel('');
                            }
                          }}
                          className="h-8 text-sm flex-1"
                          placeholder="Ej: Busca en internet las últimas noticias de tecnología"
                          maxLength={200}
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-full"
                        disabled={!newQuickReplyValue.trim() || !newQuickReplyLabel.trim()}
                        onClick={() => {
                          updateSettings({
                            quickReplies: [...settings.quickReplies, { label: newQuickReplyLabel.trim(), response: newQuickReplyValue.trim() }]
                          });
                          setNewQuickReplyValue('');
                          setNewQuickReplyLabel('');
                        }}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Agregar
                      </Button>
                    </div>
                  )}

                  {settings.quickReplies.length >= 12 && (
                    <p className="text-xs text-muted-foreground text-center">
                      Máximo 12 respuestas rápidas permitidas.
                    </p>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => updateSettings({
                      quickReplies: [
                        { label: 'Continue', response: 'Continue' },
                        { label: '...', response: '...' },
                        { label: 'Yes', response: 'Yes' },
                        { label: 'No', response: 'No' },
                      ]
                    })}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Restablecer valores predeterminados
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

            {/* Data Settings */}
            <TabsContent value="data" className="h-full overflow-y-auto p-6 m-0 data-[state=inactive]:hidden">
              {/* Hidden file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportConfig}
                className="hidden"
                id="import-config-input"
              />
              <input
                type="file"
                accept=".json"
                onChange={handleImportAll}
                className="hidden"
                id="import-all-input"
              />
              
              <div className="space-y-6">
                {/* Settings Toggles */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-medium">Preferencias de Datos</h3>
                    
                    <label className="flex items-center justify-between p-4 rounded-lg border cursor-pointer hover:bg-muted/50">
                      <div>
                        <Label className="font-medium">Auto-guardado</Label>
                        <p className="text-xs text-muted-foreground">Guardar cambios automáticamente</p>
                      </div>
                      <Switch
                        checked={settings.autoSave}
                        onCheckedChange={(autoSave) => updateSettings({ autoSave })}
                      />
                    </label>

                    <label className="flex items-center justify-between p-4 rounded-lg border cursor-pointer hover:bg-muted/50">
                      <div>
                        <Label className="font-medium">Confirmar Eliminación</Label>
                        <p className="text-xs text-muted-foreground">Preguntar antes de eliminar</p>
                      </div>
                      <Switch
                        checked={settings.confirmDelete}
                        onCheckedChange={(confirmDelete) => updateSettings({ confirmDelete })}
                      />
                    </label>
                  </div>

                  <div className="p-4 rounded-lg border bg-muted/30 text-sm space-y-2">
                    <h4 className="font-medium text-foreground">Almacenamiento</h4>
                    <p className="text-muted-foreground">
                      Los datos se guardan en archivos JSON locales y se sincronizan automáticamente.
                    </p>
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                      <CheckCircle className="w-4 h-4" />
                      <span>Sincronización activa</span>
                    </div>
                  </div>
                </div>

                {/* Export/Import Configuration */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-5 h-5" />
                    <h3 className="font-medium">Configuración</h3>
                    <span className="text-xs text-muted-foreground">(Sin datos de personajes/sesiones)</span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button 
                      variant="outline" 
                      className="h-auto py-4 flex flex-col gap-2"
                      onClick={handleExportConfig}
                    >
                      <FileJson className="w-5 h-5" />
                      <span>Exportar Config</span>
                      <span className="text-xs text-muted-foreground">LLM, sonidos, fondos, etc.</span>
                    </Button>
                    <label className="cursor-pointer">
                      <Button 
                        variant="outline" 
                        className="h-auto py-4 flex flex-col gap-2 w-full"
                        asChild
                      >
                        <span>
                          <Upload className="w-5 h-5" />
                          <span>Importar Config</span>
                          <span className="text-xs text-muted-foreground">Restaurar configuración</span>
                        </span>
                      </Button>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImportConfig}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Export/Import All Data */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    <h3 className="font-medium">Backup Completo</h3>
                    <span className="text-xs text-muted-foreground">(Todo: config + personajes + sesiones)</span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button 
                      variant="outline" 
                      className="h-auto py-4 flex flex-col gap-2"
                      onClick={handleExportAll}
                    >
                      <Download className="w-5 h-5" />
                      <span>Exportar Todo</span>
                      <span className="text-xs text-muted-foreground">Backup completo</span>
                    </Button>
                    <label className="cursor-pointer">
                      <Button 
                        variant="outline" 
                        className="h-auto py-4 flex flex-col gap-2 w-full"
                        asChild
                      >
                        <span>
                          <Upload className="w-5 h-5" />
                          <span>Importar Todo</span>
                          <span className="text-xs text-muted-foreground">Restaurar backup</span>
                        </span>
                      </Button>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImportAll}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Info box */}
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <p className="font-medium text-amber-600 dark:text-amber-400">Recomendación</p>
                      <p className="text-muted-foreground">
                        Exporta regularmente un backup completo para respaldar toda tu información.
                        El archivo de configuración es más ligero y solo incluye ajustes.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* HUD Settings */}
            <TabsContent value="hud" className="h-full overflow-hidden p-6 m-0 data-[state=inactive]:hidden">
              <HUDManager />
            </TabsContent>

            {/* Atmosphere Settings */}
            <TabsContent value="atmosphere" className="h-full overflow-y-auto p-6 m-0 data-[state=inactive]:hidden">
              <AtmosphereSettings />
            </TabsContent>

            {/* Memory Settings */}
            <TabsContent value="memory" className="h-full overflow-y-auto p-6 m-0 data-[state=inactive]:hidden">
              <MemorySettingsPanel />
            </TabsContent>
            
            {/* Quest Settings */}
            <TabsContent value="quests" className="h-full overflow-hidden p-0 m-0 data-[state=inactive]:hidden">
              <QuestSettingsPanel />
            </TabsContent>
            
            {/* Inventory Settings */}
            <TabsContent value="inventory" className="h-full overflow-hidden m-0 p-0 data-[state=inactive]:hidden">
              <InventoryPanel />
            </TabsContent>
            
            {/* Sprites General Panel */}
            <TabsContent value="sprites" className="h-full overflow-hidden m-0 p-0 data-[state=inactive]:hidden">
              <SpriteGeneralPanel />
            </TabsContent>
            <TabsContent value="embeddings" className="h-full overflow-y-auto p-6 m-0 data-[state=inactive]:hidden">
              <EmbeddingsSettingsPanel />
            </TabsContent>

            {/* Tools / Actions Settings */}
            <TabsContent value="tools" className="h-full overflow-y-auto p-6 m-0 data-[state=inactive]:hidden">
              <ToolsSettingsPanel />
            </TabsContent>

            {/* Handy Haptic Device */}
            <TabsContent value="handy" className="h-full overflow-y-auto p-6 m-0 data-[state=inactive]:hidden">
              <HandyControlPanel />
            </TabsContent>
                </div>
                </Tabs>
              </motion.main>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Config Dialog */}
      <Dialog open={newConfigOpen} onOpenChange={setNewConfigOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar Conexión LLM</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre</Label>
              <Input
                value={newConfig.name}
                onChange={(e) => setNewConfig(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Mi Conexión LLM"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Proveedor</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {LLM_PROVIDERS.map((provider) => (
                  <Button
                    key={provider.value}
                    variant={newConfig.provider === provider.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleProviderChange(provider.value)}
                  >
                    {provider.label}
                  </Button>
                ))}
              </div>
            </div>

            {LLM_PROVIDERS.find(p => p.value === newConfig.provider)?.needsEndpoint && (
              <div>
                <Label>URL del Endpoint</Label>
                <Input
                  value={newConfig.endpoint}
                  onChange={(e) => setNewConfig(prev => ({ ...prev, endpoint: e.target.value }))}
                  placeholder="http://localhost:7860"
                  className="mt-1"
                />
              </div>
            )}

            {newConfig.provider !== 'z-ai' && (
              <div>
                <Label>API Key (opcional)</Label>
                <Input
                  type="password"
                  value={newConfig.apiKey}
                  onChange={(e) => setNewConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="sk-..."
                  className="mt-1"
                />
              </div>
            )}

            {newConfig.provider === 'z-ai' && (
              <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                <p>Z.ai usa el SDK integrado. No requiere endpoint ni API key.</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setNewConfigOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleAddConfig} 
                disabled={
                  !newConfig.name || 
                  (LLM_PROVIDERS.find(p => p.value === newConfig.provider)?.needsEndpoint && !newConfig.endpoint)
                }
              >
                Agregar Conexión
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
