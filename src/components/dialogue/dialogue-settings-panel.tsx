'use client';

import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  MessageSquare,
  Type,
  Palette,
  Sparkles,
  ChevronDown,
  Info,
  RotateCcw,
  Settings2,
  TextCursorInput,
  Paintbrush
} from 'lucide-react';
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { DEFAULT_DIALOGUE_SETTINGS, DEFAULT_TYPOGRAPHY_SETTINGS, DEFAULT_CONTENT_STYLE_SETTINGS } from '@/types';

// ============================================
// Dialogue Settings Panel
// ============================================

// Default typewriter settings for fallback
const DEFAULT_TYPEWRITER = {
  enabled: true,
  speed: 50,
  startDelay: 0,
  pauseOnPunctuation: true,
  punctuationPauseMs: 100,
  cursorChar: '▋',
  showCursor: true,
  cursorBlinkMs: 530,
};

// Color presets for content styles
const COLOR_PRESETS = [
  { value: 'text-foreground', label: 'Por defecto', color: 'bg-foreground' },
  { value: 'text-muted-foreground', label: 'Gris', color: 'bg-muted-foreground' },
  { value: 'text-purple-600 dark:text-purple-400', label: 'Púrpura', color: 'bg-purple-500' },
  { value: 'text-blue-600 dark:text-blue-400', label: 'Azul', color: 'bg-blue-500' },
  { value: 'text-green-600 dark:text-green-400', label: 'Verde', color: 'bg-green-500' },
  { value: 'text-amber-600 dark:text-amber-400', label: 'Ámbar', color: 'bg-amber-500' },
  { value: 'text-red-600 dark:text-red-400', label: 'Rojo', color: 'bg-red-500' },
  { value: 'text-pink-600 dark:text-pink-400', label: 'Rosa', color: 'bg-pink-500' },
  { value: 'text-cyan-600 dark:text-cyan-400', label: 'Cian', color: 'bg-cyan-500' },
];

// Font family options
const FONT_FAMILY_OPTIONS = [
  { value: 'system', label: 'Sistema', preview: 'font-sans' },
  { value: 'serif', label: 'Serif', preview: 'font-serif' },
  { value: 'sans', label: 'Sans Serif', preview: 'font-sans' },
  { value: 'mono', label: 'Monoespaciado', preview: 'font-mono' },
  { value: 'custom', label: 'Personalizado', preview: '' },
];

// Font size options
const FONT_SIZE_OPTIONS = [
  { value: 'xs', label: 'Muy pequeño', class: 'text-xs' },
  { value: 'sm', label: 'Pequeño', class: 'text-sm' },
  { value: 'base', label: 'Normal', class: 'text-base' },
  { value: 'lg', label: 'Grande', class: 'text-lg' },
  { value: 'xl', label: 'Muy grande', class: 'text-xl' },
];

export function DialogueSettingsPanel() {
  const {
    dialogueSettings,
    setDialogueSettings,
    setTypewriterSettings,
    setTypographySettings,
    setDialogueStyle,
    setActionStyle,
    setThoughtStyle,
    setWhisperStyle,
    setNarrationStyle,
    setEmotionStyle,
  } = useTavernStore();

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [contentStylesOpen, setContentStylesOpen] = useState(false);

  // Ensure typewriter settings exist with defaults
  const typewriter = dialogueSettings.typewriter ?? DEFAULT_TYPEWRITER;

  // Ensure typography settings exist with defaults
  const typography = dialogueSettings.typography ?? DEFAULT_TYPOGRAPHY_SETTINGS;

  // Ensure content styles exist with defaults
  const contentStyles = dialogueSettings.contentStyles ?? DEFAULT_CONTENT_STYLE_SETTINGS;

  return (
    <div className="space-y-4">
      {/* Main Toggle */}
      <Card className="border-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="w-4 h-4 text-purple-500" />
            Sistema de Diálogos
          </CardTitle>
          <CardDescription className="text-xs">
            Mejora la presentación visual de mensajes con speech bubbles, typewriter y formateo automático.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Activar Formateo de Diálogos</Label>
              <p className="text-xs text-muted-foreground">
                Detecta automáticamente diálogos, acciones y pensamientos.
              </p>
            </div>
            <Switch
              checked={dialogueSettings.enabled}
              onCheckedChange={(enabled) => setDialogueSettings({ enabled })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs for different settings categories */}
      <Tabs defaultValue="typography" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-9">
          <TabsTrigger value="typography" className="text-xs gap-1">
            <TextCursorInput className="w-3 h-3" />
            Tipografía
          </TabsTrigger>
          <TabsTrigger value="styles" className="text-xs gap-1">
            <Paintbrush className="w-3 h-3" />
            Estilos
          </TabsTrigger>
          <TabsTrigger value="effects" className="text-xs gap-1">
            <Sparkles className="w-3 h-3" />
            Efectos
          </TabsTrigger>
        </TabsList>

        {/* Typography Tab */}
        <TabsContent value="typography" className="mt-4 space-y-4">
          {/* Font Family */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Type className="w-4 h-4 text-blue-500" />
                Familia de Fuente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-5 gap-2">
                {FONT_FAMILY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setTypographySettings({ fontFamily: option.value as typeof typography.fontFamily })}
                    disabled={!dialogueSettings.enabled}
                    className={cn(
                      'p-2 rounded-lg border text-xs transition-all',
                      typography.fontFamily === option.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'hover:bg-muted/50'
                    )}
                  >
                    <span className={cn(option.preview, 'block')}>{option.label}</span>
                  </button>
                ))}
              </div>

              {typography.fontFamily === 'custom' && (
                <div className="space-y-1">
                  <Label className="text-xs">Fuente personalizada</Label>
                  <Input
                    value={typography.customFontFamily ?? ''}
                    onChange={(e) => setTypographySettings({ customFontFamily: e.target.value })}
                    disabled={!dialogueSettings.enabled}
                    placeholder="ej: 'Roboto', 'Open Sans', sans-serif"
                    className="h-8 text-xs"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Font Size & Weight */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Tamaño y Peso</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Tamaño de Fuente</Label>
                <Select
                  value={typography.fontSize}
                  onValueChange={(v) => setTypographySettings({ fontSize: v as typeof typography.fontSize })}
                  disabled={!dialogueSettings.enabled}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_SIZE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <span className={option.class}>{option.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Peso de Fuente</Label>
                <Select
                  value={typography.fontWeight}
                  onValueChange={(v) => setTypographySettings({ fontWeight: v as typeof typography.fontWeight })}
                  disabled={!dialogueSettings.enabled}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="medium">Medio</SelectItem>
                    <SelectItem value="semibold">Semi-negrita</SelectItem>
                    <SelectItem value="bold">Negrita</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Altura de Línea</Label>
                  <Select
                    value={typography.lineHeight}
                    onValueChange={(v) => setTypographySettings({ lineHeight: v as typeof typography.lineHeight })}
                    disabled={!dialogueSettings.enabled}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tight">Compacta</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="relaxed">Relajada</SelectItem>
                      <SelectItem value="loose">Amplia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Espaciado</Label>
                  <Select
                    value={typography.letterSpacing}
                    onValueChange={(v) => setTypographySettings({ letterSpacing: v as typeof typography.letterSpacing })}
                    disabled={!dialogueSettings.enabled}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tighter">Muy compacto</SelectItem>
                      <SelectItem value="tight">Compacto</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="wide">Amplio</SelectItem>
                      <SelectItem value="wider">Muy amplio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card className="bg-muted/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs">Vista Previa</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  'p-3 rounded-lg border bg-background',
                  typography.fontFamily === 'system' && 'font-sans',
                  typography.fontFamily === 'serif' && 'font-serif',
                  typography.fontFamily === 'sans' && 'font-sans',
                  typography.fontFamily === 'mono' && 'font-mono',
                  typography.fontFamily === 'custom' && typography.customFontFamily,
                  `text-${typography.fontSize}`,
                  `font-${typography.fontWeight}`,
                  `leading-${typography.lineHeight}`,
                  `tracking-${typography.letterSpacing}`
                )}
                style={typography.fontFamily === 'custom' && typography.customFontFamily ? {
                  fontFamily: typography.customFontFamily
                } : undefined}
              >
                <p className={contentStyles.narration.color}>
                  El viajero llegó al pueblo al atardecer.
                </p>
                <p className={cn(contentStyles.dialogue.color, 'mt-1')}>
                  "¿Hay alguna posada cerca?"
                </p>
                <p className={cn(contentStyles.action.color, 'mt-1')}>
                  *preguntó mirando a su alrededor*
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Content Styles Tab */}
        <TabsContent value="styles" className="mt-4 space-y-4">
          {/* Dialogue Style */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-foreground"></span>
                Diálogo <code className="text-xs text-muted-foreground">"texto"</code>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Color</Label>
                  <Select
                    value={contentStyles.dialogue.color}
                    onValueChange={(v) => setDialogueStyle({ color: v })}
                    disabled={!dialogueSettings.enabled}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLOR_PRESETS.map((preset) => (
                        <SelectItem key={preset.value} value={preset.value}>
                          <div className="flex items-center gap-2">
                            <span className={cn('w-3 h-3 rounded-full', preset.color)}></span>
                            {preset.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Peso</Label>
                  <Select
                    value={contentStyles.dialogue.fontWeight}
                    onValueChange={(v) => setDialogueStyle({ fontWeight: v as typeof contentStyles.dialogue.fontWeight })}
                    disabled={!dialogueSettings.enabled}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="medium">Medio</SelectItem>
                      <SelectItem value="semibold">Semi-negrita</SelectItem>
                      <SelectItem value="bold">Negrita</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Estilo</Label>
                  <Select
                    value={contentStyles.dialogue.fontStyle}
                    onValueChange={(v) => setDialogueStyle({ fontStyle: v as typeof contentStyles.dialogue.fontStyle })}
                    disabled={!dialogueSettings.enabled}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="italic">Cursiva</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Decoración</Label>
                  <Select
                    value={contentStyles.dialogue.textDecoration}
                    onValueChange={(v) => setDialogueStyle({ textDecoration: v as typeof contentStyles.dialogue.textDecoration })}
                    disabled={!dialogueSettings.enabled}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ninguna</SelectItem>
                      <SelectItem value="underline">Subrayado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Style */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                Acción <code className="text-xs text-muted-foreground">*texto*</code>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Color</Label>
                  <Select
                    value={contentStyles.action.color}
                    onValueChange={(v) => setActionStyle({ color: v })}
                    disabled={!dialogueSettings.enabled}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLOR_PRESETS.map((preset) => (
                        <SelectItem key={preset.value} value={preset.value}>
                          <div className="flex items-center gap-2">
                            <span className={cn('w-3 h-3 rounded-full', preset.color)}></span>
                            {preset.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Estilo</Label>
                  <Select
                    value={contentStyles.action.fontStyle}
                    onValueChange={(v) => setActionStyle({ fontStyle: v as typeof contentStyles.action.fontStyle })}
                    disabled={!dialogueSettings.enabled}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="italic">Cursiva</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Thought Style */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                Pensamiento <code className="text-xs text-muted-foreground">(texto)</code>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Color</Label>
                  <Select
                    value={contentStyles.thought.color}
                    onValueChange={(v) => setThoughtStyle({ color: v })}
                    disabled={!dialogueSettings.enabled}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLOR_PRESETS.map((preset) => (
                        <SelectItem key={preset.value} value={preset.value}>
                          <div className="flex items-center gap-2">
                            <span className={cn('w-3 h-3 rounded-full', preset.color)}></span>
                            {preset.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Estilo</Label>
                  <Select
                    value={contentStyles.thought.fontStyle}
                    onValueChange={(v) => setThoughtStyle({ fontStyle: v as typeof contentStyles.thought.fontStyle })}
                    disabled={!dialogueSettings.enabled}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="italic">Cursiva</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Whisper Style */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-muted-foreground opacity-60"></span>
                Susurro <code className="text-xs text-muted-foreground">~texto~</code>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Color</Label>
                  <Select
                    value={contentStyles.whisper.color}
                    onValueChange={(v) => setWhisperStyle({ color: v })}
                    disabled={!dialogueSettings.enabled}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLOR_PRESETS.map((preset) => (
                        <SelectItem key={preset.value} value={preset.value}>
                          <div className="flex items-center gap-2">
                            <span className={cn('w-3 h-3 rounded-full', preset.color)}></span>
                            {preset.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Opacidad</Label>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[contentStyles.whisper.opacity]}
                      min={30}
                      max={100}
                      step={5}
                      onValueChange={([opacity]) => setWhisperStyle({ opacity })}
                      disabled={!dialogueSettings.enabled}
                      className="flex-1"
                    />
                    <span className="text-xs text-muted-foreground w-8">{contentStyles.whisper.opacity}%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Narration Style */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-muted-foreground"></span>
                Narración <code className="text-xs text-muted-foreground">texto normal</code>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Color</Label>
                  <Select
                    value={contentStyles.narration.color}
                    onValueChange={(v) => setNarrationStyle({ color: v })}
                    disabled={!dialogueSettings.enabled}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLOR_PRESETS.map((preset) => (
                        <SelectItem key={preset.value} value={preset.value}>
                          <div className="flex items-center gap-2">
                            <span className={cn('w-3 h-3 rounded-full', preset.color)}></span>
                            {preset.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Estilo</Label>
                  <Select
                    value={contentStyles.narration.fontStyle}
                    onValueChange={(v) => setNarrationStyle({ fontStyle: v as typeof contentStyles.narration.fontStyle })}
                    disabled={!dialogueSettings.enabled}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="italic">Cursiva</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Effects Tab */}
        <TabsContent value="effects" className="mt-4 space-y-4">
          {/* Bubble Style */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Palette className="w-4 h-4 text-pink-500" />
                Estilo de Burbujas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Estilo Visual</Label>
                <Select
                  value={dialogueSettings.bubbleStyle}
                  onValueChange={(v) => setDialogueSettings({ bubbleStyle: v as typeof dialogueSettings.bubbleStyle })}
                  disabled={!dialogueSettings.enabled}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="modern">Modern - Limpio y redondeado</SelectItem>
                    <SelectItem value="classic">Classic - Estilo cómic</SelectItem>
                    <SelectItem value="minimal">Minimal - Borde simple</SelectItem>
                    <SelectItem value="neon">Neon - Efecto brillante</SelectItem>
                    <SelectItem value="elegant">Elegant - Decorativo</SelectItem>
                    <SelectItem value="dark">Dark - Modo oscuro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <label className="flex flex-col items-center justify-between p-2.5 rounded-lg border cursor-pointer hover:bg-muted/50">
                  <span className="text-xs mb-1">Avatar</span>
                  <Switch
                    checked={dialogueSettings.showCharacterAvatar}
                    onCheckedChange={(showCharacterAvatar) => setDialogueSettings({ showCharacterAvatar })}
                    disabled={!dialogueSettings.enabled}
                    className="scale-75"
                  />
                </label>
                <div className="space-y-1">
                  <Label className="text-xs">Posición</Label>
                  <Select
                    value={dialogueSettings.avatarPosition}
                    onValueChange={(v) => setDialogueSettings({ avatarPosition: v as typeof dialogueSettings.avatarPosition })}
                    disabled={!dialogueSettings.enabled || !dialogueSettings.showCharacterAvatar}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Izquierda</SelectItem>
                      <SelectItem value="right">Derecha</SelectItem>
                      <SelectItem value="hidden">Oculto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tamaño</Label>
                  <Select
                    value={dialogueSettings.avatarSize}
                    onValueChange={(v) => setDialogueSettings({ avatarSize: v as typeof dialogueSettings.avatarSize })}
                    disabled={!dialogueSettings.enabled}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sm">Pequeño</SelectItem>
                      <SelectItem value="md">Mediano</SelectItem>
                      <SelectItem value="lg">Grande</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Ancho máximo</span>
                  <span className="text-muted-foreground">{dialogueSettings.bubbleMaxWidth}%</span>
                </div>
                <Slider
                  value={[dialogueSettings.bubbleMaxWidth]}
                  min={50}
                  max={100}
                  step={5}
                  disabled={!dialogueSettings.enabled}
                  onValueChange={([bubbleMaxWidth]) => setDialogueSettings({ bubbleMaxWidth })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Typewriter */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Type className="w-4 h-4 text-blue-500" />
                Efecto Typewriter
              </CardTitle>
              <CardDescription className="text-xs">
                Efecto de escritura progresiva del texto.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-center justify-between p-2.5 rounded-lg border cursor-pointer hover:bg-muted/50">
                <div className="space-y-0.5">
                  <Label className="text-xs">Activar efecto</Label>
                </div>
                <Switch
                  checked={typewriter.enabled}
                  onCheckedChange={(enabled) => setTypewriterSettings({ enabled })}
                  disabled={!dialogueSettings.enabled}
                  className="scale-75"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Velocidad</span>
                    <span className="text-muted-foreground">{typewriter.speed} c/s</span>
                  </div>
                  <Slider
                    value={[typewriter.speed]}
                    min={10}
                    max={200}
                    step={10}
                    disabled={!dialogueSettings.enabled || !typewriter.enabled}
                    onValueChange={([speed]) => setTypewriterSettings({ speed })}
                  />
                </div>

                <label className="flex items-center justify-between p-2.5 rounded-lg border cursor-pointer hover:bg-muted/50">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Pausa en puntuación</Label>
                  </div>
                  <Switch
                    checked={typewriter.pauseOnPunctuation}
                    onCheckedChange={(pauseOnPunctuation) => setTypewriterSettings({ pauseOnPunctuation })}
                    disabled={!dialogueSettings.enabled || !typewriter.enabled}
                    className="scale-75"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center justify-between p-2.5 rounded-lg border cursor-pointer hover:bg-muted/50">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Mostrar cursor</Label>
                  </div>
                  <Switch
                    checked={typewriter.showCursor}
                    onCheckedChange={(showCursor) => setTypewriterSettings({ showCursor })}
                    disabled={!dialogueSettings.enabled || !typewriter.enabled}
                    className="scale-75"
                  />
                </label>

                <div className="space-y-1">
                  <Label className="text-xs">Cursor</Label>
                  <Input
                    value={typewriter.cursorChar}
                    onChange={(e) => setTypewriterSettings({ cursorChar: e.target.value })}
                    disabled={!dialogueSettings.enabled || !typewriter.enabled}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Format Detection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Detección de Formato
              </CardTitle>
              <CardDescription className="text-xs">
                El sistema detecta automáticamente diferentes tipos de contenido.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center justify-between p-2.5 rounded-lg border cursor-pointer hover:bg-muted/50">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Emociones</Label>
                  </div>
                  <Switch
                    checked={dialogueSettings.parseEmotions}
                    onCheckedChange={(parseEmotions) => setDialogueSettings({ parseEmotions })}
                    disabled={!dialogueSettings.enabled}
                    className="scale-75"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-lg border cursor-pointer hover:bg-muted/50">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Acciones</Label>
                  </div>
                  <Switch
                    checked={dialogueSettings.highlightActions}
                    onCheckedChange={(highlightActions) => setDialogueSettings({ highlightActions })}
                    disabled={!dialogueSettings.enabled}
                    className="scale-75"
                  />
                </label>
              </div>

              {/* Emotion Settings */}
              {dialogueSettings.parseEmotions && (
                <div className="grid grid-cols-2 gap-3 p-2 rounded-lg bg-muted/30">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="space-y-0.5">
                      <Label className="text-xs">Mostrar indicador</Label>
                    </div>
                    <Switch
                      checked={contentStyles.emotion.showIndicator}
                      onCheckedChange={(showIndicator) => setEmotionStyle({ showIndicator })}
                      disabled={!dialogueSettings.enabled}
                      className="scale-75"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="space-y-0.5">
                      <Label className="text-xs">Resaltar texto</Label>
                    </div>
                    <Switch
                      checked={contentStyles.emotion.highlightText}
                      onCheckedChange={(highlightText) => setEmotionStyle({ highlightText })}
                      disabled={!dialogueSettings.enabled}
                      className="scale-75"
                    />
                  </label>
                </div>
              )}

              {/* Format Legend */}
              <div className="p-3 rounded-lg bg-muted/30 space-y-2">
                <Label className="text-xs font-medium">Formatos detectados:</Label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Diálogo:</span>
                    <code className="bg-muted px-1 rounded">"texto"</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Acción:</span>
                    <code className="bg-muted px-1 rounded">*texto*</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Pensamiento:</span>
                    <code className="bg-muted px-1 rounded">(texto)</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Susurro:</span>
                    <code className="bg-muted px-1 rounded">~texto~</code>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Advanced Settings */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between h-9"
                disabled={!dialogueSettings.enabled}
              >
                <span className="flex items-center gap-2 text-xs">
                  <Settings2 className="w-3.5 h-3.5" />
                  Configuración Avanzada
                </span>
                <ChevronDown className={cn(
                  "w-4 h-4 transition-transform",
                  advancedOpen && "rotate-180"
                )} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-4">
              {/* Animation */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Animaciones</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <label className="flex items-center justify-between p-2.5 rounded-lg border cursor-pointer hover:bg-muted/50">
                    <div className="space-y-0.5">
                      <Label className="text-xs">Animar entrada</Label>
                    </div>
                    <Switch
                      checked={dialogueSettings.animateEntry}
                      onCheckedChange={(animateEntry) => setDialogueSettings({ animateEntry })}
                      disabled={!dialogueSettings.enabled}
                      className="scale-75"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Tipo</Label>
                      <Select
                        value={dialogueSettings.entryAnimation}
                        onValueChange={(v) => setDialogueSettings({ entryAnimation: v as typeof dialogueSettings.entryAnimation })}
                        disabled={!dialogueSettings.enabled || !dialogueSettings.animateEntry}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fade">Fade</SelectItem>
                          <SelectItem value="slide">Slide</SelectItem>
                          <SelectItem value="scale">Scale</SelectItem>
                          <SelectItem value="none">Ninguno</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Duración</span>
                        <span className="text-muted-foreground">{dialogueSettings.animationDurationMs}ms</span>
                      </div>
                      <Slider
                        value={[dialogueSettings.animationDurationMs]}
                        min={50}
                        max={500}
                        step={50}
                        disabled={!dialogueSettings.enabled || !dialogueSettings.animateEntry}
                        onValueChange={([animationDurationMs]) => setDialogueSettings({ animationDurationMs })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Spacing */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Espaciado</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    <Label className="text-xs">Espaciado de mensajes</Label>
                    <Select
                      value={dialogueSettings.messageSpacing}
                      onValueChange={(v) => setDialogueSettings({ messageSpacing: v as typeof dialogueSettings.messageSpacing })}
                      disabled={!dialogueSettings.enabled}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="compact">Compacto</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="spacious">Espacioso</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Reset */}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setDialogueSettings(DEFAULT_DIALOGUE_SETTINGS)}
                disabled={!dialogueSettings.enabled}
              >
                <RotateCcw className="w-3.5 h-3.5 mr-2" />
                Restaurar valores por defecto
              </Button>
            </CollapsibleContent>
          </Collapsible>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default DialogueSettingsPanel;
