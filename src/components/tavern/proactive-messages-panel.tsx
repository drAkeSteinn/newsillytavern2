// ============================================
// Proactive Messages Panel - Timer Configuration
// Configures when/how a character sends messages without user input
// ============================================

'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
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
        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/40">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium">Mensajes Proactivos</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>El personaje enviará mensajes sin que el usuario hable primero, basado en un temporizador configurable.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(checked) => updateSettings({ enabled: checked })}
          />
        </div>

        {settings.enabled ? (
          <>
            {/* Interval Configuration */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  Intervalo de Envío
                </CardTitle>
                <CardDescription>
                  Cada cuánto tiempo sin mensajes en el chat el personaje puede enviar un mensaje proactivo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Preset Buttons */}
                <div className="grid grid-cols-3 gap-2">
                  {INTERVAL_PRESETS.map((preset) => (
                    <Button
                      key={preset.value}
                      variant={settings.intervalSeconds === preset.value ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => updateSettings({ intervalSeconds: preset.value })}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>

                {/* Custom Interval */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Intervalo personalizado</Label>
                    <span className="text-xs font-medium text-amber-400">
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

            {/* Conditions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-500" />
                  Condiciones
                </CardTitle>
                <CardDescription>
                  Cuándo se permiten los mensajes proactivos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Minimum messages before start */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <MessageCircle className="w-3.5 h-3.5 text-blue-400" />
                      <Label className="text-xs">Mensajes mínimos antes de activar</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>El personaje esperará a que haya al menos esta cantidad de mensajes en el chat antes de enviar mensajes proactivos.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <span className="text-xs font-mono font-medium text-blue-400 w-8 text-right">
                      {settings.minMessagesBeforeStart}
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
                    <span>20 mensajes</span>
                  </div>
                </div>

                {/* Max per session */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Timer className="w-3.5 h-3.5 text-purple-400" />
                      <Label className="text-xs">Máximo por sesión</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Límite de mensajes proactivos por sesión de chat. 0 = sin límite.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <span className="text-xs font-mono font-medium text-purple-400 w-8 text-right">
                      {settings.maxPerSession === 0 ? '∞' : settings.maxPerSession}
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
                    <span>20 mensajes</span>
                  </div>
                </div>

                {/* Trigger States */}
                <div className="space-y-2 pt-1">
                  <Label className="text-xs">Activar cuando:</Label>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between p-2 bg-muted/30 rounded border border-border/30">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-400" />
                        <span className="text-xs">Inactividad del usuario</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>El personaje envía un mensaje cuando no hay actividad en el chat (ningún mensaje) durante el intervalo configurado.</p>
                          </TooltipContent>
                        </Tooltip>
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
                    <div className="flex items-center justify-between p-2 bg-muted/30 rounded border border-border/30">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-400" />
                        <span className="text-xs">Usuario fuera de la pestaña</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>El personaje envía un mensaje cuando el usuario cambia a otra pestaña o ventana.</p>
                          </TooltipContent>
                        </Tooltip>
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

            {/* Custom Prompt */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-pink-500" />
                  Instrucción Personalizada
                </CardTitle>
                <CardDescription>
                  Instrucciones adicionales para cuando el personaje envía un mensaje proactivo (opcional)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <textarea
                  className="w-full min-h-[80px] p-3 text-xs bg-muted/50 rounded-lg border border-border/40 resize-y focus:outline-none focus:ring-2 focus:ring-amber-500/50 placeholder:text-muted-foreground/60"
                  placeholder="Ejemplo: Suele iniciar hablando del clima o preguntando cómo está el usuario. A veces comparte pensamientos en voz alta..."
                  value={settings.customPrompt || ''}
                  onChange={(e) => updateSettings({ customPrompt: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Si se deja vacío, se usará una instrucción predeterminada que mantiene al personaje en rol.
                </p>
              </CardContent>
            </Card>

            {/* Info Box */}
            <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20 text-xs text-amber-200/80 space-y-1">
              <p className="font-medium text-amber-300 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                Cómo funciona
              </p>
              <ul className="space-y-0.5 ml-4 list-disc text-amber-200/60">
                <li>El temporizador mide el tiempo transcurrido desde el último mensaje del chat</li>
                <li>Cualquier mensaje nuevo (usuario o personaje) reinicia el temporizador</li>
                <li>Los mensajes proactivos no se envían durante la generación de una respuesta</li>
                <li>Solo funciona en chat individual (no en chat grupal)</li>
                <li>Los mensajes aparecerán con un indicador visual especial</li>
              </ul>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg border border-border/40">
            <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">Mensajes proactivos desactivados</p>
            <p className="text-xs mt-1">Activa para que el personaje pueda iniciar conversaciones.</p>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
