// ============================================
// Proactive Messages Panel - Timer Configuration
// Configures when/how a character sends messages without user input
// FASE 3: Enhanced with Nudge Variation, Context, Cooldown, Group Chat
// ============================================

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Sparkles,
  HelpCircle,
  Clock,
  MessageCircle,
  Shield,
  Timer,
  Send,
  Zap,
  Shuffle,
  Eye,
  Snowflake,
  Users,
  Plus,
  Trash2,
  GripVertical,
  Brain,
  Heart,
  Layers,
  BookOpen,
  ArrowLeftRight,
} from 'lucide-react';
import { DEFAULT_PROACTIVE_MESSAGES_CONFIG } from '@/types';
import type { ProactiveMessagesConfig } from '@/types';

// Preset interval options (in seconds)
const INTERVAL_PRESETS = [
  { value: 60, label: '1 min', description: 'Muy frecuente' },
  { value: 120, label: '2 min', description: 'Frecuente' },
  { value: 300, label: '5 min', description: 'Normal' },
  { value: 600, label: '10 min', description: 'Espaciado' },
  { value: 900, label: '15 min', description: 'Lento' },
  { value: 1800, label: '30 min', description: 'Muy lento' },
];

// Default nudge template suggestions for the pool
const NUDGE_SUGGESTIONS = [
  '[La escena continúa] {{user}} parece distraído así que {{char}} decide hacer o decir algo para que todo continúe.',
  '[El silencio se prolonga] {{char}} nota que {{user}} está en silencio y decide romper la quietud con un comentario o acción.',
  '[Pensando en voz alta] {{char}} murmura algo para sí mismo mientras observa su entorno, buscando algo que decir.',
  '[Un momento pasa] {{char}} siente la necesidad de llenar el silencio con algo, sea un pensamiento, una pregunta o una pequeña acción.',
  '[Curiosidad] Algo llama la atención de {{char}}, quien decide compartirlo con {{user}}.',
  '[Inquietud] {{char}} no puede quedarse callado más tiempo y encuentra una excusa para hablar.',
];

interface ProactiveMessagesPanelProps {
  config: ProactiveMessagesConfig | undefined;
  onChange: (config: ProactiveMessagesConfig) => void;
  // FASE 4: Micro-reaction config (group chat reactions)
  microReactionConfig?: import('@/types').MicroReactionConfig;
  onMicroReactionConfigChange?: (config: import('@/types').MicroReactionConfig) => void;
}

export function ProactiveMessagesPanel({
  config,
  onChange,
  microReactionConfig,
  onMicroReactionConfigChange,
}: ProactiveMessagesPanelProps) {
  // Initialize with defaults if undefined
  const settings: ProactiveMessagesConfig = {
    ...DEFAULT_PROACTIVE_MESSAGES_CONFIG,
    ...config,
  };

  const [newTemplateValue, setNewTemplateValue] = useState('');

  const updateSettings = (updates: Partial<ProactiveMessagesConfig>) => {
    onChange({ ...settings, ...updates });
  };

  const formatInterval = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins} min`;
  };

  const addNudgeTemplate = (template: string) => {
    if (!template.trim()) return;
    const existing = settings.nudgeTemplates || [];
    if (!existing.includes(template.trim())) {
      updateSettings({ nudgeTemplates: [...existing, template.trim()] });
    }
    setNewTemplateValue('');
  };

  const removeNudgeTemplate = (index: number) => {
    const existing = settings.nudgeTemplates || [];
    updateSettings({ nudgeTemplates: existing.filter((_, i) => i !== index) });
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Main Toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg border bg-gradient-to-r from-amber-500/5 to-orange-500/5 border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10">
              <Sparkles className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <span className="text-sm font-medium">Mensajes Proactivos</span>
              <p className="text-xs text-muted-foreground">El personaje envía mensajes automáticamente tras un periodo de inactividad</p>
            </div>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(checked) => updateSettings({ enabled: checked })}
          />
        </div>

        {settings.enabled ? (
          <>
            {/* ─── How It Works ─── */}
            <div className="p-4 rounded-lg border bg-card space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-semibold">Cómo funciona</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex gap-2.5 p-2.5 rounded-md bg-muted/40">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/10 shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-blue-500">1</span>
                  </div>
                  <div>
                    <p className="text-xs font-medium">Temporizador</p>
                    <p className="text-[11px] text-muted-foreground">Se mide el tiempo desde el último mensaje en el chat</p>
                  </div>
                </div>
                <div className="flex gap-2.5 p-2.5 rounded-md bg-muted/40">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/10 shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-amber-500">2</span>
                  </div>
                  <div>
                    <p className="text-xs font-medium">Condición</p>
                    <p className="text-[11px] text-muted-foreground">Si hay inactividad ≥ intervalo configurado → se activa</p>
                  </div>
                </div>
                <div className="flex gap-2.5 p-2.5 rounded-md bg-muted/40">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500/10 shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-green-500">3</span>
                  </div>
                  <div>
                    <p className="text-xs font-medium">Mensaje</p>
                    <p className="text-[11px] text-muted-foreground">El personaje genera y envía un mensaje en contexto</p>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-muted/30 border border-border/30">
                <Clock className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-[11px] text-muted-foreground">
                  <strong>Reinicio:</strong> Cualquier mensaje nuevo (del usuario o del personaje) reinicia el temporizador. 
                  Los mensajes proactivos no se envían durante la generación de respuestas.
                </p>
              </div>
            </div>

            {/* ─── Interval Configuration ─── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  Intervalo de Inactividad
                </CardTitle>
                <CardDescription>
                  Tiempo que debe pasar sin mensajes para que el personaje envíe un mensaje proactivo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Preset Buttons */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {INTERVAL_PRESETS.map((preset) => (
                    <Button
                      key={preset.value}
                      variant={settings.intervalSeconds === preset.value ? 'default' : 'outline'}
                      size="sm"
                      className="h-9 text-xs"
                      onClick={() => updateSettings({ intervalSeconds: preset.value })}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>

                {/* Custom Interval */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Intervalo personalizado</Label>
                    <span className="text-xs font-mono font-medium text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">
                      {formatInterval(settings.intervalSeconds)}
                    </span>
                  </div>
                  <Slider
                    value={[settings.intervalSeconds]}
                    min={30}
                    max={3600}
                    step={30}
                    onValueChange={([value]) => updateSettings({ intervalSeconds: value })}
                    className="py-1"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>30s</span>
                    <span>30 min</span>
                    <span>60 min</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ─── Conditions ─── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-500" />
                  Condiciones de Activación
                </CardTitle>
                <CardDescription>
                  Define cuándo y cuántos mensajes proactivos se permiten
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Minimum messages before start */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <MessageCircle className="w-3.5 h-3.5 text-blue-400" />
                      <Label className="text-xs font-medium">Mensajes mínimos antes de activar</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>El personaje esperará a que haya al menos esta cantidad de mensajes en el chat antes de enviar mensajes proactivos.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <span className="text-xs font-mono font-medium text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                      {settings.minMessagesBeforeStart === 0 ? 'Inmediato' : settings.minMessagesBeforeStart}
                    </span>
                  </div>
                  <Slider
                    value={[settings.minMessagesBeforeStart]}
                    min={0}
                    max={20}
                    step={1}
                    onValueChange={([value]) => updateSettings({ minMessagesBeforeStart: value })}
                    className="py-1"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Inmediato</span>
                    <span>10</span>
                    <span>20 mensajes</span>
                  </div>
                </div>

                {/* Max per session */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Timer className="w-3.5 h-3.5 text-purple-400" />
                      <Label className="text-xs font-medium">Máximo por sesión</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Límite de mensajes proactivos por sesión de chat. 0 = sin límite.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <span className="text-xs font-mono font-medium text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                      {settings.maxPerSession === 0 ? '∞ Sin límite' : settings.maxPerSession}
                    </span>
                  </div>
                  <Slider
                    value={[settings.maxPerSession]}
                    min={0}
                    max={20}
                    step={1}
                    onValueChange={([value]) => updateSettings({ maxPerSession: value })}
                    className="py-1"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Sin límite</span>
                    <span>10</span>
                    <span>20</span>
                  </div>
                </div>

                {/* Trigger States */}
                <div className="space-y-2.5 pt-1">
                  <Label className="text-xs font-medium">Activar cuando:</Label>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/30">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                        <div>
                          <span className="text-xs font-medium">Inactividad del usuario</span>
                          <p className="text-[10px] text-muted-foreground">El chat está abierto pero no hay mensajes nuevos</p>
                        </div>
                      </div>
                      <Switch
                        checked={settings.allowedStates?.includes('idle') ?? true}
                        onCheckedChange={(checked) => {
                          const current = settings.allowedStates ?? ['idle'];
                          const updated = checked
                            ? [...new Set([...current, 'idle'])]
                            : current.filter(s => s !== 'idle');
                          updateSettings({ allowedStates: updated.length > 0 ? updated : ['idle'] });
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/30">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                        <div>
                          <span className="text-xs font-medium">Usuario fuera de la pestaña</span>
                          <p className="text-[10px] text-muted-foreground">El usuario cambió a otra pestaña o ventana del navegador</p>
                        </div>
                      </div>
                      <Switch
                        checked={settings.allowedStates?.includes('user_away') ?? false}
                        onCheckedChange={(checked) => {
                          const current = settings.allowedStates ?? ['idle'];
                          const updated = checked
                            ? [...new Set([...current, 'user_away'])]
                            : current.filter(s => s !== 'user_away');
                          updateSettings({ allowedStates: updated.length > 0 ? updated : ['idle'] });
                        }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ─── Custom Prompt ─── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-pink-500" />
                  Instrucción Personalizada
                </CardTitle>
                <CardDescription>
                  Instrucciones adicionales para guiar el mensaje proactivo (opcional)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  className="min-h-[100px] text-xs"
                  placeholder="Ejemplo: Suele iniciar hablando del clima o preguntando cómo está el usuario. A veces comparte pensamientos en voz alta. Le gusta mencionar lo que ve por la ventana..."
                  value={settings.customPrompt || ''}
                  onChange={(e) => updateSettings({ customPrompt: e.target.value })}
                />
                <div className="mt-2 p-2.5 rounded-md bg-muted/30 border border-border/30">
                  <p className="text-[11px] text-muted-foreground">
                    <strong>Si se deja vacío</strong>, se usa la instrucción predeterminada.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* ─── Nudge Template ─── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Send className="w-4 h-4 text-emerald-500" />
                  Mensaje de Impulso (Nudge) Principal
                </CardTitle>
                <CardDescription>
                  Mensaje que se envía como si fuera del usuario para "impulsar" al personaje a responder. Se procesa con las mismas variables de plantilla que el resto del prompt.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  className="min-h-[80px] text-xs"
                  placeholder="[La escena continúa] {{user}} parece distraído así que {{char}} decide hacer o decir algo para que todo continúe."
                  value={settings.nudgeTemplate || ''}
                  onChange={(e) => updateSettings({ nudgeTemplate: e.target.value })}
                />
                <div className="mt-2 p-2.5 rounded-md bg-muted/30 border border-border/30">
                  <p className="text-[11px] text-muted-foreground">
                    <strong>Si se deja vacío</strong>, se usa el nudge predeterminado:
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1 italic font-mono">
                    [La escena continúa] {'{{user}}'} parece distraído así que {'{{char}}'} decide hacer o decir algo para que todo continúe.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* ─── FASE 3: Proactividad Inteligente ─── */}
            {/* ═══════════════════════════════════════════════════════════════ */}

            {/* ─── Nudge Variation Pool ─── */}
            <Card className="border-emerald-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shuffle className="w-4 h-4 text-emerald-500" />
                  Variación de Nudges
                </CardTitle>
                <CardDescription>
                  Agrega plantillas alternativas de nudge que rotan automáticamente, añadiendo variedad a los mensajes proactivos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Current templates list */}
                {(settings.nudgeTemplates || []).length > 0 && (
                  <div className="space-y-2">
                    {(settings.nudgeTemplates || []).map((tmpl, index) => (
                      <div key={index} className="flex items-start gap-2 p-2 rounded-md bg-muted/30 border border-border/30 group">
                        <GripVertical className="w-3.5 h-3.5 text-muted-foreground mt-2 shrink-0 opacity-50" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-foreground/80 font-mono truncate">{tmpl}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={() => removeNudgeTemplate(index)}
                        >
                          <Trash2 className="w-3 h-3 text-red-400" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new template */}
                <div className="flex gap-2">
                  <Input
                    className="text-xs flex-1"
                    placeholder="Escribe una nueva plantilla de nudge..."
                    value={newTemplateValue}
                    onChange={(e) => setNewTemplateValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addNudgeTemplate(newTemplateValue);
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 shrink-0"
                    onClick={() => addNudgeTemplate(newTemplateValue)}
                    disabled={!newTemplateValue.trim()}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {/* Quick-add suggestions */}
                <div className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground font-medium">Sugerencias rápidas:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {NUDGE_SUGGESTIONS.filter(s => !(settings.nudgeTemplates || []).includes(s) && s !== settings.nudgeTemplate).slice(0, 4).map((suggestion, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        className="h-6 text-[9px] px-2 max-w-[200px] truncate"
                        onClick={() => addNudgeTemplate(suggestion)}
                      >
                        <Plus className="w-2.5 h-2.5 mr-1 shrink-0" />
                        {suggestion.slice(0, 40)}...
                      </Button>
                    ))}
                  </div>
                </div>

                {(settings.nudgeTemplates || []).length > 0 && (
                  <div className="p-2 rounded-md bg-emerald-500/5 border border-emerald-500/20">
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                      <strong>{(settings.nudgeTemplates || []).length + (settings.nudgeTemplate ? 1 : 0)}</strong> plantillas en rotación. 
                      Se seleccionan aleatoriamente sin repetir las usadas recientemente.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ─── Context Messages ─── */}
            <Card className="border-blue-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="w-4 h-4 text-blue-500" />
                  Contexto de Conversación
                </CardTitle>
                <CardDescription>
                  Incluye los últimos mensajes del chat como contexto en el nudge proactivo para que el personaje responda de forma más coherente
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5 text-blue-400" />
                    <Label className="text-xs font-medium">Mensajes recientes incluidos</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Número de pares de mensajes (usuario+personaje) que se incluirán como contexto. 0 = desactivado.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <span className="text-xs font-mono font-medium text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                    {settings.contextMessagesCount ?? 3}
                  </span>
                </div>
                <Slider
                  value={[settings.contextMessagesCount ?? 3]}
                  min={0}
                  max={10}
                  step={1}
                  onValueChange={([value]) => updateSettings({ contextMessagesCount: value })}
                  className="py-1"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Desactivado</span>
                  <span>5</span>
                  <span>10 mensajes</span>
                </div>
                {(settings.contextMessagesCount ?? 3) > 0 && (
                  <div className="p-2 rounded-md bg-blue-500/5 border border-blue-500/20">
                    <p className="text-[10px] text-blue-600 dark:text-blue-400">
                      El personaje verá los últimos {(settings.contextMessagesCount ?? 3) * 2} mensajes como contexto antes de generar su respuesta proactiva.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ─── Thematic Cooldown ─── */}
            <Card className="border-cyan-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Snowflake className="w-4 h-4 text-cyan-500" />
                  Enfriamiento Temático
                </CardTitle>
                <CardDescription>
                  Evita que el personaje repita el mismo tema en mensajes proactivos consecutivos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Timer className="w-3.5 h-3.5 text-cyan-400" />
                    <Label className="text-xs font-medium">Tiempo de espera</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Minutos que deben pasar antes de que el personaje pueda hablar de un tema similar. 0 = desactivado.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <span className="text-xs font-mono font-medium text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">
                    {settings.thematicCooldownMinutes ?? 0} min
                  </span>
                </div>
                <Slider
                  value={[settings.thematicCooldownMinutes ?? 0]}
                  min={0}
                  max={60}
                  step={5}
                  onValueChange={([value]) => updateSettings({ thematicCooldownMinutes: value })}
                  className="py-1"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Desactivado</span>
                  <span>30 min</span>
                  <span>60 min</span>
                </div>
                {(settings.thematicCooldownMinutes ?? 0) > 0 && (
                  <div className="p-2 rounded-md bg-cyan-500/5 border border-cyan-500/20">
                    <p className="text-[10px] text-cyan-600 dark:text-cyan-400">
                      El personaje evitará repetir temas de sus últimos mensajes proactivos durante {settings.thematicCooldownMinutes} minutos.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ─── Group Chat Proactivity ─── */}
            <Card className="border-purple-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-500" />
                  Proactividad en Chat Grupal
                </CardTitle>
                <CardDescription>
                  Permite que el personaje envíe mensajes proactivos en conversaciones grupales
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/30">
                  <div className="flex items-center gap-2.5">
                    <Users className="w-4 h-4 text-purple-400" />
                    <div>
                      <span className="text-xs font-medium">Activar en chats grupales</span>
                      <p className="text-[10px] text-muted-foreground">El personaje puede intervenir proactivamente cuando hay otros personajes en la conversación</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.groupChatEnabled ?? false}
                    onCheckedChange={(checked) => updateSettings({ groupChatEnabled: checked })}
                  />
                </div>

                {settings.groupChatEnabled && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Estrategia de intervención</Label>
                    <Select
                      value={settings.groupChatStrategy ?? 'any_speaker'}
                      onValueChange={(value: 'any_speaker' | 'mentioned_only' | 'emotional_reaction') => 
                        updateSettings({ groupChatStrategy: value })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any_speaker">
                          <div className="flex items-center gap-2">
                            <MessageCircle className="w-3 h-3 text-purple-400" />
                            <span>Cualquier interlocutor</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="mentioned_only">
                          <div className="flex items-center gap-2">
                            <Brain className="w-3 h-3 text-amber-400" />
                            <span>Solo si es mencionado</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="emotional_reaction">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-3 h-3 text-rose-400" />
                            <span>Reacción emocional</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="p-2.5 rounded-md bg-muted/30 border border-border/30 space-y-1.5">
                      <p className="text-[10px] text-muted-foreground">
                        {settings.groupChatStrategy === 'any_speaker' && 'El personaje puede intervenir después de que cualquiera hable, si hay inactividad.'}
                        {settings.groupChatStrategy === 'mentioned_only' && 'El personaje solo interviene si alguien lo menciona por nombre en el chat grupal.'}
                        {settings.groupChatStrategy === 'emotional_reaction' && 'El personaje reacciona cuando detecta emociones fuertes en la conversación (enfado, sorpresa, tristeza).'}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* ─── FASE 9: Contexto para Proactividad ─── */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <Card className="border-teal-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Brain className="w-4 h-4 text-teal-500" />
                  Contexto para Proactividad
                  <span className="text-[9px] bg-teal-500/10 text-teal-500 px-1.5 py-0.5 rounded font-medium ml-auto">
                    FASE 9
                  </span>
                </CardTitle>
                <CardDescription>
                  Inyecta contexto profundo en el prompt del sistema para que los mensajes proactivos sean más coherentes con la conversación, emociones y relaciones.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Context in System Prompt toggle */}
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/30">
                  <div className="flex items-center gap-2.5">
                    <Layers className="w-4 h-4 text-teal-400" />
                    <div>
                      <span className="text-xs font-medium">Inyectar contexto en el prompt del sistema</span>
                      <p className="text-[10px] text-muted-foreground">El contexto se incluye en el system prompt en vez de solo en el nudge. Más coherente para el LLM.</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.contextInSystemPrompt ?? true}
                    onCheckedChange={(checked) => onChange({ ...settings, contextInSystemPrompt: checked })}
                  />
                </div>

                {/* Emotional context */}
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/30">
                  <div className="flex items-center gap-2.5">
                    <Heart className="w-4 h-4 text-red-400" />
                    <div>
                      <span className="text-xs font-medium">Incluir estado emocional</span>
                      <p className="text-[10px] text-muted-foreground">Si el personaje tiene emociones activas, se incluyen como contexto para el mensaje proactivo.</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.includeEmotionalContext ?? true}
                    onCheckedChange={(checked) => onChange({ ...settings, includeEmotionalContext: checked })}
                  />
                </div>

                {/* Relationship context */}
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/30">
                  <div className="flex items-center gap-2.5">
                    <Users className="w-4 h-4 text-pink-400" />
                    <div>
                      <span className="text-xs font-medium">Incluir relaciones</span>
                      <p className="text-[10px] text-muted-foreground">Incluye la relación actual con el usuario para que el mensaje sea consistente.</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.includeRelationshipContext ?? true}
                    onCheckedChange={(checked) => onChange({ ...settings, includeRelationshipContext: checked })}
                  />
                </div>

                {/* Quest context */}
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/30">
                  <div className="flex items-center gap-2.5">
                    <BookOpen className="w-4 h-4 text-amber-400" />
                    <div>
                      <span className="text-xs font-medium">Incluir misiones activas</span>
                      <p className="text-[10px] text-muted-foreground">Muestra misiones activas para que el personaje pueda hacer referencia a ellas sutilmente.</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.includeQuestContext ?? true}
                    onCheckedChange={(checked) => onChange({ ...settings, includeQuestContext: checked })}
                  />
                </div>

                {/* Context message max chars */}
                <div className="space-y-2 p-3 bg-muted/30 rounded-lg border border-border/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <MessageCircle className="w-3.5 h-3.5 text-blue-400" />
                      <Label className="text-xs font-medium">Caracteres máx. por mensaje de contexto</Label>
                    </div>
                    <span className="text-xs font-mono font-medium text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                      {settings.contextMessageMaxChars ?? 300}
                    </span>
                  </div>
                  <Slider
                    value={[settings.contextMessageMaxChars ?? 300]}
                    min={100}
                    max={1000}
                    step={50}
                    onValueChange={([value]) => onChange({ ...settings, contextMessageMaxChars: value })}
                    className="py-1"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>100 chars</span>
                    <span>1000 chars</span>
                  </div>
                </div>

                {/* Abandoned topics detection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/30">
                    <div className="flex items-center gap-2.5">
                      <ArrowLeftRight className="w-4 h-4 text-orange-400" />
                      <div>
                        <span className="text-xs font-medium">Retomar temas abandonados</span>
                        <p className="text-[10px] text-muted-foreground">Si se habló de un tema y se abandonó, el personaje puede retomarlo proactivamente.</p>
                      </div>
                    </div>
                    <Switch
                      checked={settings.retomarAbandonedTopics ?? false}
                      onCheckedChange={(checked) => onChange({ ...settings, retomarAbandonedTopics: checked })}
                    />
                  </div>
                  {settings.retomarAbandonedTopics && (
                    <div className="pl-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-orange-400" />
                          <Label className="text-xs font-medium">Turnos de silencio para considerar "abandonado"</Label>
                        </div>
                        <span className="text-xs font-mono font-medium text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded">
                          {settings.abandonedTopicThreshold ?? 10}
                        </span>
                      </div>
                      <Slider
                        value={[settings.abandonedTopicThreshold ?? 10]}
                        min={5}
                        max={30}
                        step={5}
                        onValueChange={([value]) => onChange({ ...settings, abandonedTopicThreshold: value })}
                        className="py-1"
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>5 turnos</span>
                        <span>30 turnos</span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* ─── FASE 4: Micro-Reacciones en Chat Grupal ─── */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            {onMicroReactionConfigChange && (
              <Card className="border-violet-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="w-4 h-4 text-violet-500" />
                    Micro-Reacciones (Chat Grupal)
                  </CardTitle>
                  <CardDescription>
                    Cuando este personaje habla en un chat grupal, otros personajes pueden reaccionar brevemente con acciones como *suspira*, *sonríe*, etc.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/30">
                    <div className="flex items-center gap-2.5">
                      <Sparkles className="w-4 h-4 text-violet-400" />
                      <div>
                        <span className="text-xs font-medium">Activar micro-reacciones</span>
                        <p className="text-[10px] text-muted-foreground">Otros personajes reaccionan brevemente cuando este personaje habla</p>
                      </div>
                    </div>
                    <Switch
                      checked={microReactionConfig?.enabled ?? false}
                      onCheckedChange={(checked) => onMicroReactionConfigChange({ 
                        enabled: checked,
                        maxReactionsPerMessage: microReactionConfig?.maxReactionsPerMessage ?? 2,
                        reactionChance: microReactionConfig?.reactionChance ?? 0.3,
                        triggers: microReactionConfig?.triggers ?? ['mention', 'emotional'],
                      })}
                    />
                  </div>

                  {microReactionConfig?.enabled && (() => {
                    const mrc = microReactionConfig;
                    return (
                    <>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <MessageCircle className="w-3.5 h-3.5 text-violet-400" />
                            <Label className="text-xs font-medium">Máx. reacciones por mensaje</Label>
                          </div>
                          <span className="text-xs font-mono font-medium text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded">
                            {mrc.maxReactionsPerMessage}
                          </span>
                        </div>
                        <Slider
                          value={[mrc.maxReactionsPerMessage]}
                          min={1}
                          max={5}
                          step={1}
                          onValueChange={([value]) => onMicroReactionConfigChange({ ...mrc, maxReactionsPerMessage: value })}
                          className="py-1"
                        />
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>1</span>
                          <span>3</span>
                          <span>5</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Shuffle className="w-3.5 h-3.5 text-violet-400" />
                            <Label className="text-xs font-medium">Probabilidad de reacción</Label>
                          </div>
                          <span className="text-xs font-mono font-medium text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded">
                            {Math.round((mrc.reactionChance ?? 0.3) * 100)}%
                          </span>
                        </div>
                        <Slider
                          value={[Math.round((mrc.reactionChance ?? 0.3) * 100)]}
                          min={10}
                          max={100}
                          step={10}
                          onValueChange={([value]) => onMicroReactionConfigChange({ ...mrc, reactionChance: value / 100 })}
                          className="py-1"
                        />
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>10%</span>
                          <span>50%</span>
                          <span>100%</span>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <Label className="text-xs font-medium">Disparadores de reacción</Label>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg border border-border/30">
                            <div>
                              <span className="text-xs font-medium">Mención</span>
                              <p className="text-[10px] text-muted-foreground">Reaccionar cuando alguien menciona su nombre</p>
                            </div>
                            <Switch
                              checked={mrc.triggers?.includes('mention') ?? true}
                              onCheckedChange={(checked) => {
                                const current = mrc.triggers || ['mention', 'emotional'];
                                const updated = checked
                                  ? [...new Set([...current, 'mention'])]
                                  : current.filter(t => t !== 'mention');
                                onMicroReactionConfigChange({ ...mrc, triggers: updated.length > 0 ? updated : ['mention'] });
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg border border-border/30">
                            <div>
                              <span className="text-xs font-medium">Emocional</span>
                              <p className="text-[10px] text-muted-foreground">Reaccionar a contenido emocional (enfado, sorpresa, etc.)</p>
                            </div>
                            <Switch
                              checked={mrc.triggers?.includes('emotional') ?? true}
                              onCheckedChange={(checked) => {
                                const current = mrc.triggers || ['mention', 'emotional'];
                                const updated = checked
                                  ? [...new Set([...current, 'emotional'])]
                                  : current.filter(t => t !== 'emotional');
                                onMicroReactionConfigChange({ ...mrc, triggers: updated.length > 0 ? updated : ['emotional'] });
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg border border-border/30">
                            <div>
                              <span className="text-xs font-medium">Tema</span>
                              <p className="text-[10px] text-muted-foreground">Reaccionar aleatoriamente al tema de conversación</p>
                            </div>
                            <Switch
                              checked={mrc.triggers?.includes('topic') ?? false}
                              onCheckedChange={(checked) => {
                                const current = mrc.triggers || ['mention', 'emotional'];
                                const updated = checked
                                  ? [...new Set([...current, 'topic'])]
                                  : current.filter(t => t !== 'topic');
                                onMicroReactionConfigChange({ ...mrc, triggers: updated.length > 0 ? updated : ['mention'] });
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )})()}
                </CardContent>
              </Card>
            )}

            {/* ─── Template Variables Reference ─── */}
            <div className="p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <HelpCircle className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-xs font-semibold">Variables de Plantilla Disponibles</h3>
              </div>
              <p className="text-[11px] text-muted-foreground mb-2">
                Puedes usar estas variables tanto en la instrucción personalizada como en el mensaje de impulso. Se reemplazan automáticamente con los valores correspondientes:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {[
                  { var: '{{char}}', desc: 'Nombre del personaje' },
                  { var: '{{user}}', desc: 'Nombre del usuario' },
                  { var: '{{userpersona}}', desc: 'Descripción del usuario' },
                  { var: '{{stats}}', desc: 'Estadísticas del personaje' },
                  { var: '{{activeQuests}}', desc: 'Misiones activas' },
                  { var: '{{outlet::*}}', desc: 'Secciones del Lorebook' },
                ].map(item => (
                  <div key={item.var} className="flex items-start gap-1.5 p-1.5 rounded bg-muted/30">
                    <code className="text-[10px] font-mono text-amber-500 bg-amber-500/10 px-1 py-0.5 rounded shrink-0">{item.var}</code>
                    <span className="text-[10px] text-muted-foreground leading-tight">{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ─── Status Summary ─── */}
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-3">
                <Send className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-semibold">Resumen de Configuración</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-2.5 rounded-md bg-muted/30 text-center">
                  <Clock className="w-4 h-4 mx-auto text-amber-500 mb-1" />
                  <p className="text-lg font-bold">{formatInterval(settings.intervalSeconds)}</p>
                  <p className="text-[10px] text-muted-foreground">Intervalo</p>
                </div>
                <div className="p-2.5 rounded-md bg-muted/30 text-center">
                  <MessageCircle className="w-4 h-4 mx-auto text-blue-500 mb-1" />
                  <p className="text-lg font-bold">{settings.minMessagesBeforeStart === 0 ? '0' : settings.minMessagesBeforeStart}</p>
                  <p className="text-[10px] text-muted-foreground">Mensajes mín.</p>
                </div>
                <div className="p-2.5 rounded-md bg-muted/30 text-center">
                  <Timer className="w-4 h-4 mx-auto text-purple-500 mb-1" />
                  <p className="text-lg font-bold">{settings.maxPerSession === 0 ? '∞' : settings.maxPerSession}</p>
                  <p className="text-[10px] text-muted-foreground">Máx/sesión</p>
                </div>
                <div className="p-2.5 rounded-md bg-muted/30 text-center">
                  <Shield className="w-4 h-4 mx-auto text-green-500 mb-1" />
                  <p className="text-lg font-bold">
                    {settings.allowedStates?.includes('idle') && settings.allowedStates?.includes('user_away') ? 'Ambos' :
                     settings.allowedStates?.includes('user_away') ? 'Ausente' : 'Inactivo'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Modo</p>
                </div>
              </div>
              {/* FASE 3 summary row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                <div className="p-2.5 rounded-md bg-muted/30 text-center">
                  <Shuffle className="w-4 h-4 mx-auto text-emerald-500 mb-1" />
                  <p className="text-lg font-bold">{(settings.nudgeTemplates || []).length + (settings.nudgeTemplate ? 1 : 0)}</p>
                  <p className="text-[10px] text-muted-foreground">Nudges</p>
                </div>
                <div className="p-2.5 rounded-md bg-muted/30 text-center">
                  <Eye className="w-4 h-4 mx-auto text-blue-500 mb-1" />
                  <p className="text-lg font-bold">{settings.contextMessagesCount ?? 3}</p>
                  <p className="text-[10px] text-muted-foreground">Ctx msgs</p>
                </div>
                <div className="p-2.5 rounded-md bg-muted/30 text-center">
                  <Snowflake className="w-4 h-4 mx-auto text-cyan-500 mb-1" />
                  <p className="text-lg font-bold">{settings.thematicCooldownMinutes ?? 0}m</p>
                  <p className="text-[10px] text-muted-foreground">Cooldown</p>
                </div>
                <div className="p-2.5 rounded-md bg-muted/30 text-center">
                  <Users className="w-4 h-4 mx-auto text-purple-500 mb-1" />
                  <p className="text-lg font-bold">{settings.groupChatEnabled ? 'Sí' : 'No'}</p>
                  <p className="text-[10px] text-muted-foreground">Grupal</p>
                </div>
              </div>
              {/* FASE 9 summary row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                <div className="p-2.5 rounded-md bg-muted/30 text-center">
                  <Layers className="w-4 h-4 mx-auto text-teal-500 mb-1" />
                  <p className="text-sm font-bold">{settings.contextInSystemPrompt !== false ? 'Sí' : 'No'}</p>
                  <p className="text-[10px] text-muted-foreground">Ctx en Prompt</p>
                </div>
                <div className="p-2.5 rounded-md bg-muted/30 text-center">
                  <Heart className="w-4 h-4 mx-auto text-red-500 mb-1" />
                  <p className="text-sm font-bold">{settings.includeEmotionalContext !== false ? 'Sí' : 'No'}</p>
                  <p className="text-[10px] text-muted-foreground">Emociones</p>
                </div>
                <div className="p-2.5 rounded-md bg-muted/30 text-center">
                  <BookOpen className="w-4 h-4 mx-auto text-amber-500 mb-1" />
                  <p className="text-sm font-bold">{settings.includeQuestContext !== false ? 'Sí' : 'No'}</p>
                  <p className="text-[10px] text-muted-foreground">Misiones</p>
                </div>
                <div className="p-2.5 rounded-md bg-muted/30 text-center">
                  <ArrowLeftRight className="w-4 h-4 mx-auto text-orange-500 mb-1" />
                  <p className="text-sm font-bold">{settings.retomarAbandonedTopics ? 'Sí' : 'No'}</p>
                  <p className="text-[10px] text-muted-foreground">Temas Aband.</p>
                </div>
              </div>
            </div>

            {/* ─── Important Notes ─── */}
            <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20 text-xs space-y-1.5">
              <p className="font-medium text-amber-300 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                Notas importantes
              </p>
              <ul className="space-y-1 ml-4 list-disc text-amber-200/60">
                <li>El temporizador se reinicia con <strong>cualquier mensaje nuevo</strong> (usuario o personaje)</li>
                <li>Los mensajes proactivos <strong>no se envían</strong> durante la generación de una respuesta</li>
                {settings.groupChatEnabled ? (
                  <li>Funciona tanto en <strong>chat individual</strong> como en <strong>chat grupal</strong></li>
                ) : (
                  <li>Solo funciona en <strong>chat individual</strong> (activa la opción grupal para chats grupales)</li>
                )}
                <li>Los mensajes aparecen con un <strong>indicador visual ✨</strong> en el chat</li>
                <li>Se requiere un <strong>proveedor LLM configurado</strong> para generar los mensajes</li>
                <li>Las plantillas de nudge <strong>rotan automáticamente</strong> para evitar repetición</li>
              </ul>
            </div>
          </>
        ) : (
          <div className="text-center py-10 text-muted-foreground bg-muted/30 rounded-lg border border-border/40">
            <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Mensajes proactivos desactivados</p>
            <p className="text-xs mt-1 max-w-xs mx-auto">
              Activa para que el personaje pueda iniciar conversaciones automáticamente tras un periodo de inactividad.
            </p>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
