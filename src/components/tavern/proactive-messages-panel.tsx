// ============================================
// Proactive Messages Panel - Timer Configuration
// Configures when/how a character sends messages without user input
// ============================================

'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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

interface ProactiveMessagesPanelProps {
  config: ProactiveMessagesConfig | undefined;
  onChange: (config: ProactiveMessagesConfig) => void;
}

export function ProactiveMessagesPanel({
  config,
  onChange,
}: ProactiveMessagesPanelProps) {
  // Initialize with defaults if undefined
  const settings: ProactiveMessagesConfig = {
    ...DEFAULT_PROACTIVE_MESSAGES_CONFIG,
    ...config,
  };

  const updateSettings = (updates: Partial<ProactiveMessagesConfig>) => {
    onChange({ ...settings, ...updates });
  };

  const formatInterval = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins} min`;
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
                  Mensaje de Impulso (Nudge)
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
                <li>Solo funciona en <strong>chat individual</strong> (no en chat grupal)</li>
                <li>Los mensajes aparecen con un <strong>indicador visual ✨</strong> en el chat</li>
                <li>Se requiere un <strong>proveedor LLM configurado</strong> para generar los mensajes</li>
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
