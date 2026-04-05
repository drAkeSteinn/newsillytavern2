'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dices,
  Brain,
  CloudSun,
  Globe,
  Bell,
  Wrench,
  Info,
  Zap,
  Eye,
  ArrowRight,
  Terminal,
} from 'lucide-react';
import { useTavernStore } from '@/store/tavern-store';
import type { ToolDefinition, ToolsSettings } from '@/types';
import { DEFAULT_TOOLS_SETTINGS } from '@/types';

// ============================================
// Built-in tools list (must match backend registry)
// ============================================

const BUILT_IN_TOOLS: ToolDefinition[] = [
  {
    id: 'roll_dice',
    name: 'roll_dice',
    label: 'Tirar Dados',
    icon: 'Dices',
    description: 'Tira dados para resolver acciones aleatorias (ej: 1d20, 2d6). Ideal para RPGs y juegos de rol.',
    category: 'in_character',
    parameters: { type: 'object', properties: { dice: { type: 'string', description: 'Notación (ej: 1d20)', required: true }, label: { type: 'string', description: 'Descripción', required: false } }, required: ['dice'] },
    permissionMode: 'auto',
  },
  {
    id: 'search_memory',
    name: 'search_memory',
    label: 'Buscar Memoria',
    icon: 'Brain',
    description: 'Busca en tu memoria información sobre un tema específico. Útil para recordar conversaciones pasadas.',
    category: 'cognitive',
    parameters: { type: 'object', properties: { query: { type: 'string', description: 'Qué buscar', required: true }, max_results: { type: 'number', description: 'Cuántos resultados (default: 5)', required: false } }, required: ['query'] },
    permissionMode: 'auto',
  },
  {
    id: 'get_weather',
    name: 'get_weather',
    label: 'Consultar Clima',
    icon: 'CloudSun',
    description: 'Obtén el clima actual de una ciudad. El LLM la usa cuando el usuario pregunta sobre el tiempo.',
    category: 'real_world',
    parameters: { type: 'object', properties: { city: { type: 'string', description: 'Ciudad', required: true }, units: { type: 'string', description: 'metric o imperial', required: false } }, required: ['city'] },
    permissionMode: 'auto',
  },
  {
    id: 'search_web',
    name: 'search_web',
    label: 'Buscar en Internet',
    icon: 'Globe',
    description: 'Busca información actualizada en internet. Se activa cuando el LLM necesita datos que no tiene.',
    category: 'real_world',
    parameters: { type: 'object', properties: { query: { type: 'string', description: 'Qué buscar', required: true }, max_results: { type: 'number', description: 'Cuántos resultados (default: 3)', required: false } }, required: ['query'] },
    permissionMode: 'auto',
  },
  {
    id: 'set_reminder',
    name: 'set_reminder',
    label: 'Crear Recordatorio',
    icon: 'Bell',
    description: 'Crea un recordatorio que se mencionará en conversaciones futuras.',
    category: 'real_world',
    parameters: { type: 'object', properties: { content: { type: 'string', description: 'Qué recordar', required: true } }, required: ['content'] },
    permissionMode: 'auto',
  },
];

const TOOL_ICONS: Record<string, any> = {
  Dices,
  Brain,
  CloudSun,
  Globe,
  Bell,
  Wrench,
};

const CATEGORY_LABELS: Record<string, string> = {
  in_character: 'In-Character',
  cognitive: 'Cognitivas',
  real_world: 'Mundo Real',
  system: 'Sistema',
};

const CATEGORY_COLORS: Record<string, string> = {
  in_character: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  cognitive: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  real_world: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  system: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
};

const NATIVE_TOOL_PROVIDERS = ['OpenAI', 'Anthropic', 'Ollama', 'vLLM', 'LM Studio', 'Custom'];

// ============================================
// Component
// ============================================

export function ToolsSettingsPanel() {
  const characters = useTavernStore(s => s.characters);
  const settings = useTavernStore(s => s.settings);
  const updateSettings = useTavernStore(s => s.updateSettings);
  const llmConfigs = useTavernStore(s => s.llmConfigs);

  const toolsSettings: ToolsSettings = {
    ...DEFAULT_TOOLS_SETTINGS,
    ...settings.tools,
  };

  const [selectedCharacterId, setSelectedCharacterId] = useState<string>('__all__');
  const [localSettings, setLocalSettings] = useState<ToolsSettings>(toolsSettings);

  const saveSettings = (newSettings: ToolsSettings) => {
    setLocalSettings(newSettings);
    updateSettings({ tools: newSettings });
  };

  // Check if active LLM provider supports native tool calling
  const activeConfig = llmConfigs.find(c => c.isActive);
  const providerLabel = activeConfig?.provider || 'ninguno';
  const providerSupportsTools = activeConfig
    ? ['openai', 'vllm', 'lm-studio', 'custom', 'anthropic', 'ollama'].includes(activeConfig.provider)
    : false;

  // Get enabled tools for a character
  const getCharacterEnabledTools = (characterId: string): string[] => {
    const config = localSettings.characterConfigs.find(c => c.characterId === characterId);
    return config?.enabledTools || [];
  };

  // Toggle a tool for a character
  const toggleToolForCharacter = (characterId: string, toolId: string) => {
    const current = getCharacterEnabledTools(characterId);
    const newTools = current.includes(toolId)
      ? current.filter(id => id !== toolId)
      : [...current, toolId];

    const newConfigs = [...localSettings.characterConfigs];
    const configIndex = newConfigs.findIndex(c => c.characterId === characterId);

    if (configIndex >= 0) {
      newConfigs[configIndex] = { ...newConfigs[configIndex], enabledTools: newTools };
    } else {
      newConfigs.push({ characterId, enabledTools: newTools });
    }

    saveSettings({ ...localSettings, characterConfigs: newConfigs });
  };

  // Check if a tool is enabled for a character
  const isToolEnabled = (characterId: string, toolId: string): boolean => {
    const enabled = getCharacterEnabledTools(characterId);
    const config = localSettings.characterConfigs.find(c => c.characterId === characterId);
    if (!config) return true; // Default: all enabled
    return enabled.includes(toolId);
  };

  // Enable/disable all tools for a character
  const toggleAllToolsForCharacter = (characterId: string, enable: boolean) => {
    const newConfigs = [...localSettings.characterConfigs];
    const configIndex = newConfigs.findIndex(c => c.characterId === characterId);

    if (enable) {
      if (configIndex >= 0) {
        newConfigs.splice(configIndex, 1);
      }
    } else {
      if (configIndex >= 0) {
        newConfigs[configIndex] = { ...newConfigs[configIndex], enabledTools: [] };
      } else {
        newConfigs.push({ characterId, enabledTools: [] });
      }
    }

    saveSettings({ ...localSettings, characterConfigs: newConfigs });
  };

  const displayedCharacterId = selectedCharacterId === '__all__' ? null : selectedCharacterId;
  const displayName = selectedCharacterId === '__all__'
    ? 'Todos los personajes'
    : characters.find(c => c.id === selectedCharacterId)?.name || 'Personaje';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-500/20 rounded-lg">
            <Wrench className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-medium text-amber-600 dark:text-amber-400">
              Herramientas / Acciones
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              Permite que los personajes usen herramientas como tirar dados, buscar en internet,
              consultar el clima y más. Usa el sistema nativo de <strong>Tool Calling</strong> del modelo.
            </p>
          </div>
        </div>
      </div>

      {/* Provider Compatibility Notice */}
      <div className={`p-3 rounded-lg border ${providerSupportsTools ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
        <div className="flex items-start gap-2.5">
          <Terminal className={`w-4 h-4 shrink-0 mt-0.5 ${providerSupportsTools ? 'text-emerald-500' : 'text-amber-500'}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">Proveedor activo: {providerLabel}</span>
              {providerSupportsTools ? (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  Soporta Tool Calling
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  No soporta Tool Calling
                </Badge>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {providerSupportsTools
                ? 'Tu modelo puede usar herramientas de forma nativa. El LLM decide cuándo usarlas según la conversación.'
                : 'El proveedor actual no soporta tool calling nativo. Las herramientas no estarán disponibles. Cambia a OpenAI, Anthropic u Ollama para usarlas.'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Master Toggle */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-amber-500/15 rounded-md">
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <Label className="text-sm font-medium">Sistema de Herramientas</Label>
            <p className="text-xs text-muted-foreground">Interruptor maestro para todas las herramientas</p>
          </div>
        </div>
        <Switch
          checked={localSettings.enabled && providerSupportsTools}
          disabled={!providerSupportsTools}
          onCheckedChange={(checked) =>
            saveSettings({ ...localSettings, enabled: checked })
          }
        />
      </div>

      {localSettings.enabled && providerSupportsTools && (
        <>
          <Separator />

          {/* Max tool calls per turn */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Máximo de herramientas por turno</Label>
              <span className="text-sm font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {localSettings.maxToolCallsPerTurn}
              </span>
            </div>
            <Slider
              value={[localSettings.maxToolCallsPerTurn]}
              onValueChange={([val]) =>
                saveSettings({ ...localSettings, maxToolCallsPerTurn: val })
              }
              min={1}
              max={5}
              step={1}
            />
            <p className="text-xs text-muted-foreground">
              Herramientas que puede usar el personaje en una sola respuesta. Más herramientas = más tokens consumidos.
            </p>
          </div>

          <Separator />

          {/* Character selector */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Configurar por Personaje</Label>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Eye className="w-3 h-3" />
                <span>Verás notificaciones cuando use herramientas</span>
              </div>
            </div>
            <Select value={selectedCharacterId} onValueChange={setSelectedCharacterId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona un personaje" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos los personajes (global)</SelectItem>
                <SelectSeparator />
                {characters.map(char => (
                  <SelectItem key={char.id} value={char.id}>
                    {char.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {characters.length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                No hay personajes creados. Los ajustes globales se aplicarán por defecto.
              </p>
            )}
          </div>

          {/* Tools list */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">
                Herramientas: <span className="text-primary">{displayName}</span>
              </h4>
              {displayedCharacterId && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => {
                    const allEnabled = isToolEnabled(displayedCharacterId, BUILT_IN_TOOLS[0]?.id);
                    toggleAllToolsForCharacter(displayedCharacterId, !allEnabled);
                  }}
                >
                  {isToolEnabled(displayedCharacterId, BUILT_IN_TOOLS[0]?.id) ? 'Desactivar todas' : 'Activar todas'}
                </Button>
              )}
            </div>

            <ScrollArea className="max-h-96">
              <div className="space-y-2 pr-2">
                {BUILT_IN_TOOLS.map(tool => {
                  const Icon = TOOL_ICONS[tool.icon] || Wrench;
                  const enabled = displayedCharacterId
                    ? isToolEnabled(displayedCharacterId, tool.id)
                    : true;

                  return (
                    <div
                      key={tool.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                        enabled
                          ? 'border-border bg-background'
                          : 'border-border/50 bg-muted/30 opacity-60'
                      }`}
                    >
                      <div className={`p-2 rounded-lg shrink-0 ${CATEGORY_COLORS[tool.category]}`}>
                        <Icon className="w-4 h-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{tool.label}</span>
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0"
                          >
                            {CATEGORY_LABELS[tool.category]}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {tool.description}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1 font-mono">
                          {tool.name}({Object.keys(tool.parameters.properties).join(', ')})
                        </p>
                      </div>

                      {displayedCharacterId && (
                        <Switch
                          checked={enabled}
                          onCheckedChange={() =>
                            toggleToolForCharacter(displayedCharacterId, tool.id)
                          }
                          className="shrink-0 mt-1"
                        />
                      )}
                      {!displayedCharacterId && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-1 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-xs">
                              <p>Selecciona un personaje para configurar herramientas individuales.</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Por defecto, todas las herramientas están habilitadas.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* How it works - Native Tool Calling flow */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h5 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
              Cómo funciona (Tool Calling Nativo)
            </h5>
            <div className="space-y-2.5">
              {[
                { step: '1', text: 'Las herramientas se envían al LLM como parámetros de la API (no en el prompt)', icon: Terminal },
                { step: '2', text: 'El modelo decide si necesita usar una herramienta basándose en la conversación', icon: Brain },
                { step: '3', text: 'Si la necesita, la API devuelve un tool_call con nombre y parámetros validados', icon: Zap },
                { step: '4', text: 'El sistema ejecuta la herramienta y muestra una notificación en el chat', icon: Wrench },
                { step: '5', text: 'El resultado se envía de vuelta al LLM que genera una respuesta natural', icon: Dices },
              ].map(item => (
                <div key={item.step} className="flex items-start gap-2.5">
                  <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">
                      {item.step}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground leading-relaxed">{item.text}</span>
                </div>
              ))}
            </div>

            <div className="mt-3 p-2.5 bg-background rounded-md border space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground">Ejemplo: El usuario pregunta &quot;¿Qué clima hace en Tokyo?&quot;</p>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/80 flex-wrap">
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0">API envía tools al LLM</Badge>
                <ArrowRight className="w-3 h-3 text-muted-foreground/40" />
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0">LLM responde: tool_call(get_weather, city=&quot;Tokyo&quot;)</Badge>
                <ArrowRight className="w-3 h-3 text-muted-foreground/40" />
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">LLM genera: &quot;En Tokyo hace 22°C con cielo despejado&quot;</Badge>
              </div>
            </div>

            <div className="mt-2 p-2 bg-background rounded-md border">
              <p className="text-[10px] text-muted-foreground">
                <strong>Requiere:</strong> Modelos que soporten tool calling nativo (OpenAI, Anthropic, Ollama con Llama 3.1+, etc.).
                El formato es garantizado por la API, no por el modelo.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
