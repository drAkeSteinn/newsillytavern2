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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Palette,
  Type,
  MessageSquare,
  User,
  Sparkles,
  RotateCcw,
  HelpCircle,
  Paintbrush,
  Droplet,
  Square,
  Circle,
  Monitor,
  Eye,
  Wand2,
  Zap,
  ChevronDown,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type {
  ChatboxTheme,
  AvatarShape,
  BubbleStyleType,
  StreamingAnimationStyle,
  StreamingCursorStyle,
  FontFamilyType,
  ChatboxAppearanceSettings,
} from '@/types';
import { DEFAULT_CHATBOX_APPEARANCE } from '@/types';

// ============================================
// Theme Presets
// ============================================

const THEME_PRESETS: { value: ChatboxTheme; label: string; colors: { primary: string; bg: string }; icon?: string }[] = [
  { value: 'default', label: 'Por defecto', colors: { primary: '#3b82f6', bg: '#18181b' } },
  { value: 'midnight', label: 'Medianoche', colors: { primary: '#6366f1', bg: '#0f0f23' } },
  { value: 'forest', label: 'Bosque', colors: { primary: '#22c55e', bg: '#0a1f0a' } },
  { value: 'sunset', label: 'Atardecer', colors: { primary: '#f97316', bg: '#1a0f0a' } },
  { value: 'ocean', label: 'Océano', colors: { primary: '#0ea5e9', bg: '#0a1520' } },
  { value: 'lavender', label: 'Lavanda', colors: { primary: '#a855f7', bg: '#1a0f20' } },
  { value: 'cherry', label: 'Cerezo', colors: { primary: '#ec4899', bg: '#1a0a10' } },
  { value: 'custom', label: 'Personalizado', colors: { primary: '#ffffff', bg: '#000000' } },
  // Special themes with effects
  { value: 'cyberpunk', label: 'Cyberpunk', colors: { primary: '#00FFFF', bg: '#0A0A0F' }, icon: '🌆' },
  { value: 'steampunk', label: 'Steampunk', colors: { primary: '#B5A642', bg: '#3C2415' }, icon: '⚙️' },
  { value: 'gothic', label: 'Gótico', colors: { primary: '#C0C0C0', bg: '#0D0D0D' }, icon: '🕯️' },
  { value: 'retro', label: 'Retro', colors: { primary: '#00FF00', bg: '#0A0A0A' }, icon: '📺' },
  { value: 'pixelart', label: 'Pixel Art', colors: { primary: '#00A800', bg: '#0A0A0A' }, icon: '👾' },
];

// Font family options
const FONT_FAMILY_OPTIONS: { value: FontFamilyType; label: string; preview: string }[] = [
  { value: 'system', label: 'Sistema', preview: 'font-sans' },
  { value: 'serif', label: 'Serif', preview: 'font-serif' },
  { value: 'sans', label: 'Sans Serif', preview: 'font-sans' },
  { value: 'mono', label: 'Monoespaciado', preview: 'font-mono' },
  { value: 'custom', label: 'Personalizado', preview: '' },
];

// Avatar shape options
const AVATAR_SHAPE_OPTIONS: { value: AvatarShape; label: string; icon: typeof Circle }[] = [
  { value: 'circle', label: 'Círculo', icon: Circle },
  { value: 'square', label: 'Cuadrado', icon: Square },
  { value: 'rounded', label: 'Redondeado', icon: Square },
  { value: 'rectangular', label: 'Rectangular', icon: Square },
];

// Bubble style options
const BUBBLE_STYLE_OPTIONS: { value: BubbleStyleType; label: string; description: string }[] = [
  { value: 'modern', label: 'Moderno', description: 'Limpio y redondeado' },
  { value: 'classic', label: 'Clásico', description: 'Estilo cómic' },
  { value: 'minimal', label: 'Minimal', description: 'Borde simple' },
  { value: 'neon', label: 'Neón', description: 'Efecto brillante' },
  { value: 'elegant', label: 'Elegante', description: 'Decorativo' },
  { value: 'dark', label: 'Oscuro', description: 'Modo oscuro' },
];

// Streaming animation options
const STREAMING_ANIMATION_OPTIONS: { value: StreamingAnimationStyle; label: string }[] = [
  { value: 'typing-cursor', label: 'Cursor de escritura' },
  { value: 'fade-in', label: 'Aparición gradual' },
  { value: 'grow', label: 'Crecimiento' },
  { value: 'typewriter', label: 'Máquina de escribir' },
];

// Cursor style options
const CURSOR_STYLE_OPTIONS: { value: StreamingCursorStyle; label: string; char: string }[] = [
  { value: 'block', label: 'Bloque', char: '▋' },
  { value: 'line', label: 'Línea', char: '|' },
  { value: 'underscore', label: 'Guion bajo', char: '_' },
  { value: 'dot', label: 'Punto', char: '●' },
];

// Color picker component
function ColorPicker({ 
  value, 
  onChange, 
  label,
  disabled = false 
}: { 
  value: string; 
  onChange: (color: string) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-8 h-8 rounded border cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="#000000"
          className="h-8 text-xs font-mono flex-1"
        />
      </div>
    </div>
  );
}

// ============================================
// Live Preview Component
// ============================================

function LivePreview({ settings }: { settings: ChatboxAppearanceSettings }) {
  const avatarSizeMap = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-12 h-12', xl: 'w-14 h-14' };
  const avatarSize = avatarSizeMap[settings.avatars.size];
  
  const getAvatarRadius = () => {
    if (settings.avatars.shape === 'circle') return 'rounded-full';
    if (settings.avatars.shape === 'square') return 'rounded-none';
    if (settings.avatars.shape === 'rounded') return 'rounded-lg';
    return 'rounded-sm';
  };
  
  const getBubbleStyle = () => {
    const base = 'rounded-2xl px-4 py-3 relative max-w-[85%]';
    const radius = settings.bubbles.borderRadius;
    
    switch (settings.bubbles.style) {
      case 'modern':
        return `${base} shadow-sm`;
      case 'classic':
        return `${base} border-2 border-current`;
      case 'minimal':
        return `${base} border`;
      case 'neon':
        return `${base} shadow-[0_0_10px_rgba(255,255,255,0.3)]`;
      case 'elegant':
        return `${base} border border-opacity-50 shadow-md`;
      case 'dark':
        return `${base} bg-opacity-90`;
      default:
        return base;
    }
  };
  
  const fontSizeMap = { xs: 'text-xs', sm: 'text-sm', base: 'text-base', lg: 'text-lg', xl: 'text-xl' };
  const fontWeightMap = { normal: 'font-normal', medium: 'font-medium', semibold: 'font-semibold', bold: 'font-bold' };
  const lineHeightMap = { tight: 'leading-tight', normal: 'leading-normal', relaxed: 'leading-relaxed', loose: 'leading-loose' };
  
  const getFontFamily = () => {
    switch (settings.font.fontFamily) {
      case 'system': return 'font-sans';
      case 'serif': return 'font-serif';
      case 'sans': return 'font-sans';
      case 'mono': return 'font-mono';
      case 'custom': return settings.font.customFontFamily || 'font-sans';
      default: return 'font-sans';
    }
  };
  
  return (
    <Card className="border-2 overflow-hidden">
      <CardHeader className="pb-2 bg-gradient-to-r from-violet-500/10 to-pink-500/10">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Eye className="w-4 h-4 text-violet-500" />
          Vista Previa en Vivo
        </CardTitle>
        <CardDescription className="text-xs">
          Los cambios se reflejan en tiempo real
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3">
        <div 
          className={cn(
            'rounded-lg p-3 space-y-3 transition-all',
            getFontFamily(),
            fontSizeMap[settings.font.fontSize],
            fontWeightMap[settings.font.fontWeight],
            lineHeightMap[settings.font.lineHeight]
          )}
          style={{
            backgroundColor: settings.background.customBackgroundColor || 'rgba(24, 24, 27, 0.95)',
            backdropFilter: settings.background.useGlassEffect ? `blur(${settings.background.blur}px)` : undefined,
            opacity: settings.background.transparency,
          }}
        >
          {/* User Message */}
          <div className="flex gap-2 justify-end">
            {settings.avatars.show && (
              <div 
                className={cn(avatarSize, getAvatarRadius(), 'flex-shrink-0 border-2 flex items-center justify-center bg-gradient-to-br from-blue-400 to-blue-600')}
                style={{ 
                  borderColor: settings.avatars.borderColor,
                  borderWidth: settings.avatars.showBorder ? settings.avatars.borderWidth : 0
                }}
              >
                <span className="text-white font-bold text-xs">U</span>
              </div>
            )}
            <div 
              className={cn(getBubbleStyle(), 'rounded-tr-sm')}
              style={{ 
                backgroundColor: settings.bubbles.userBubbleColor,
                borderRadius: settings.bubbles.borderRadius,
                maxWidth: `${settings.bubbles.maxWidth}%`,
              }}
            >
              <p style={{ color: settings.bubbles.userBubbleTextColor }} className="text-sm">
                "Hola, ¿cómo estás hoy?"
              </p>
            </div>
          </div>
          
          {/* Character Message */}
          <div className="flex gap-2">
            {settings.avatars.show && (
              <div 
                className={cn(avatarSize, getAvatarRadius(), 'flex-shrink-0 border-2 flex items-center justify-center bg-gradient-to-br from-amber-400 to-orange-600')}
                style={{ 
                  borderColor: settings.avatars.borderColor,
                  borderWidth: settings.avatars.showBorder ? settings.avatars.borderWidth : 0
                }}
              >
                <span className="text-white font-bold text-xs">A</span>
              </div>
            )}
            <div 
              className={cn(getBubbleStyle(), 'rounded-tl-sm')}
              style={{ 
                backgroundColor: settings.bubbles.characterBubbleColor,
                borderRadius: settings.bubbles.borderRadius,
                maxWidth: `${settings.bubbles.maxWidth}%`,
              }}
            >
              <p style={{ color: settings.bubbles.characterBubbleTextColor }} className="text-sm">
                "¡Muy bien! *sonríe* Gracias por preguntar."
              </p>
              {settings.streaming.showCursor && (
                <span 
                  className="inline-block ml-0.5 animate-pulse"
                  style={{ color: settings.streaming.cursorColor }}
                >
                  {CURSOR_STYLE_OPTIONS.find(c => c.value === settings.streaming.cursorStyle)?.char || '▋'}
                </span>
              )}
            </div>
          </div>
          
          {/* Narrator Message */}
          <div className="flex gap-2">
            {settings.avatars.show && (
              <div 
                className={cn(avatarSize, getAvatarRadius(), 'flex-shrink-0 border-2 flex items-center justify-center bg-gradient-to-br from-violet-400 to-violet-600')}
                style={{ 
                  borderColor: settings.avatars.borderColor,
                  borderWidth: settings.avatars.showBorder ? settings.avatars.borderWidth : 0
                }}
              >
                <span className="text-white font-bold text-xs">N</span>
              </div>
            )}
            <div 
              className={cn(getBubbleStyle(), 'rounded-tl-sm italic')}
              style={{ 
                backgroundColor: settings.bubbles.narratorBubbleColor,
                borderRadius: settings.bubbles.borderRadius,
                maxWidth: `${settings.bubbles.maxWidth}%`,
              }}
            >
              <p style={{ color: settings.bubbles.narratorBubbleTextColor }} className="text-sm">
                El sol brillaba en el cielo mientras los personajes conversaban.
              </p>
            </div>
          </div>
          
          {/* Input Preview */}
          <div 
            className="mt-4 p-2 rounded-lg"
            style={{
              backgroundColor: settings.input.backgroundColor,
              borderColor: settings.input.borderColor,
              borderRadius: settings.input.borderRadius,
              borderWidth: 1,
            }}
          >
            <p 
              className="text-sm"
              style={{ color: settings.input.placeholderColor }}
            >
              Escribe un mensaje...
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// Main Component
// ============================================

export function AppearanceSettingsPanel() {
  const {
    settings,
    updateChatboxAppearance,
    updateChatboxBackground,
    updateChatboxFont,
    updateChatboxTextFormatting,
    updateChatboxTextColors,
    updateMessageBubbles,
    updateChatboxAvatars,
    updateChatboxStreaming,
    updateChatboxInput,
    resetChatboxAppearance,
  } = useTavernStore();
  
  const appearance = settings.chatboxAppearance || DEFAULT_CHATBOX_APPEARANCE;
  
  // Live preview visibility - hide by default on small screens
  const getInitialPreview = () => typeof window !== 'undefined' && window.innerWidth <= 1024 ? false : true;
  const [previewVisible, setPreviewVisible] = useState(getInitialPreview);
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => setPreviewVisible(!e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  
  // Ensure all nested objects exist with defaults
  const safeAppearance = useMemo(() => ({
    ...DEFAULT_CHATBOX_APPEARANCE,
    ...appearance,
    enableAnimations: appearance?.enableAnimations ?? DEFAULT_CHATBOX_APPEARANCE.enableAnimations,
    enableParticles: appearance?.enableParticles ?? DEFAULT_CHATBOX_APPEARANCE.enableParticles,
    animationIntensity: appearance?.animationIntensity ?? DEFAULT_CHATBOX_APPEARANCE.animationIntensity,
    background: { ...DEFAULT_CHATBOX_APPEARANCE.background, ...appearance?.background },
    font: { ...DEFAULT_CHATBOX_APPEARANCE.font, ...appearance?.font },
    textFormatting: { ...DEFAULT_CHATBOX_APPEARANCE.textFormatting, ...appearance?.textFormatting },
    textColors: { ...DEFAULT_CHATBOX_APPEARANCE.textColors, ...appearance?.textColors },
    bubbles: { ...DEFAULT_CHATBOX_APPEARANCE.bubbles, ...appearance?.bubbles },
    avatars: { ...DEFAULT_CHATBOX_APPEARANCE.avatars, ...appearance?.avatars },
    streaming: { ...DEFAULT_CHATBOX_APPEARANCE.streaming, ...appearance?.streaming },
    input: { ...DEFAULT_CHATBOX_APPEARANCE.input, ...appearance?.input },
  }), [appearance]);
  
  // Check if current theme is a special effects theme
  const isSpecialTheme = ['cyberpunk', 'steampunk', 'gothic', 'retro', 'pixelart'].includes(safeAppearance.theme);

  return (
    <TooltipProvider>
      <div className="flex gap-4 h-full">
        {/* Settings Panel */}
        <div className="flex-1 overflow-y-auto pr-2 min-w-0">
          <Tabs defaultValue="theme" className="w-full">
            <div className="flex items-center justify-between mb-4">
              <TabsList className="grid grid-cols-5 h-9">
                <TabsTrigger value="theme" className="text-xs gap-1">
                  <Palette className="w-3 h-3" />
                  <span className="hidden sm:inline">Tema</span>
                </TabsTrigger>
              <TabsTrigger value="bubbles" className="text-xs gap-1">
                <MessageSquare className="w-3 h-3" />
                Burbujas
              </TabsTrigger>
              <TabsTrigger value="avatars" className="text-xs gap-1">
                <User className="w-3 h-3" />
                Avatares
              </TabsTrigger>
              <TabsTrigger value="streaming" className="text-xs gap-1">
                <Sparkles className="w-3 h-3" />
                Streaming
              </TabsTrigger>
              <TabsTrigger value="input" className="text-xs gap-1">
                <Monitor className="w-3 h-3" />
                <span className="hidden sm:inline">Entrada</span>
              </TabsTrigger>
            </TabsList>
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs gap-1.5 shrink-0"
                onClick={() => setPreviewVisible(!previewVisible)}
              >
                {previewVisible ? (
                  <><PanelRightClose className="w-4 h-4" /> Ocultar Vista</>
                ) : (
                  <><PanelRightOpen className="w-4 h-4" /> Vista Previa</>
                )}
              </Button>
            </div>

            {/* Theme Tab */}
            <TabsContent value="theme" className="space-y-4 mt-0">
              {/* Theme Presets */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Palette className="w-4 h-4 text-violet-500" />
                    Tema del Chat
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Selecciona un tema predefinido o personaliza los colores
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2">
                    {THEME_PRESETS.map((theme) => (
                      <button
                        key={theme.value}
                        onClick={() => updateChatboxAppearance({ theme: theme.value })}
                        className={cn(
                          'p-2 rounded-lg border text-xs transition-all flex flex-col items-center gap-1',
                          safeAppearance.theme === theme.value
                            ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                            : 'hover:bg-muted/50'
                        )}
                      >
                        <div 
                          className="w-6 h-6 rounded-full border"
                          style={{ 
                            background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.bg})` 
                          }}
                        />
                        <span>{theme.label}</span>
                      </button>
                    ))}
                  </div>
                  
                  {safeAppearance.theme === 'custom' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-muted/30">
                      <ColorPicker
                        label="Principal"
                        value={safeAppearance.customThemeColors?.primary || '#3b82f6'}
                        onChange={(primary) => updateChatboxAppearance({ 
                          customThemeColors: { 
                            primary,
                            secondary: safeAppearance.customThemeColors?.secondary || '#6366f1',
                            accent: safeAppearance.customThemeColors?.accent || '#f59e0b',
                            background: safeAppearance.customThemeColors?.background || '#18181b',
                            surface: safeAppearance.customThemeColors?.surface || '#27272a',
                            text: safeAppearance.customThemeColors?.text || '#fafafa',
                          } 
                        })}
                      />
                      <ColorPicker
                        label="Secundario"
                        value={safeAppearance.customThemeColors?.secondary || '#6366f1'}
                        onChange={(secondary) => updateChatboxAppearance({ 
                          customThemeColors: { 
                            primary: safeAppearance.customThemeColors?.primary || '#3b82f6',
                            secondary,
                            accent: safeAppearance.customThemeColors?.accent || '#f59e0b',
                            background: safeAppearance.customThemeColors?.background || '#18181b',
                            surface: safeAppearance.customThemeColors?.surface || '#27272a',
                            text: safeAppearance.customThemeColors?.text || '#fafafa',
                          } 
                        })}
                      />
                      <ColorPicker
                        label="Acento"
                        value={safeAppearance.customThemeColors?.accent || '#f59e0b'}
                        onChange={(accent) => updateChatboxAppearance({ 
                          customThemeColors: { 
                            primary: safeAppearance.customThemeColors?.primary || '#3b82f6',
                            secondary: safeAppearance.customThemeColors?.secondary || '#6366f1',
                            accent,
                            background: safeAppearance.customThemeColors?.background || '#18181b',
                            surface: safeAppearance.customThemeColors?.surface || '#27272a',
                            text: safeAppearance.customThemeColors?.text || '#fafafa',
                          } 
                        })}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Theme Effects - Only for special themes */}
              {isSpecialTheme && (
                <Card className="border-purple-500/30 bg-purple-500/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Wand2 className="w-4 h-4 text-purple-500" />
                      Efectos de Tema
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Animaciones y partículas especiales para este tema
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Animation Toggle */}
                    <label className="flex items-center justify-between p-2 rounded-lg border cursor-pointer hover:bg-muted/50">
                      <div className="space-y-0.5">
                        <Label className="text-xs flex items-center gap-2">
                          <Zap className="w-3 h-3" />
                          Animaciones
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Efectos animados temáticos
                        </p>
                      </div>
                      <Switch
                        checked={safeAppearance.enableAnimations}
                        onCheckedChange={(enableAnimations) => updateChatboxAppearance({ enableAnimations })}
                      />
                    </label>
                    
                    {/* Particles Toggle */}
                    <label className="flex items-center justify-between p-2 rounded-lg border cursor-pointer hover:bg-muted/50">
                      <div className="space-y-0.5">
                        <Label className="text-xs flex items-center gap-2">
                          <Sparkles className="w-3 h-3" />
                          Partículas
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Partículas flotantes decorativas
                        </p>
                      </div>
                      <Switch
                        checked={safeAppearance.enableParticles}
                        onCheckedChange={(enableParticles) => updateChatboxAppearance({ enableParticles })}
                      />
                    </label>
                    
                    {/* Intensity Slider */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span>Intensidad de efectos</span>
                        <span className="text-muted-foreground">{safeAppearance.animationIntensity}%</span>
                      </div>
                      <Slider
                        value={[safeAppearance.animationIntensity]}
                        min={0}
                        max={100}
                        step={5}
                        onValueChange={([animationIntensity]) => updateChatboxAppearance({ animationIntensity })}
                      />
                    </div>
                    
                    {/* Theme-specific description */}
                    <div className="p-2 rounded bg-muted/30 text-xs text-muted-foreground">
                      {safeAppearance.theme === 'cyberpunk' && '🌆 Efectos: Glitch, líneas de escaneo, neones pulsantes'}
                      {safeAppearance.theme === 'steampunk' && '⚙️ Efectos: Engranajes giratorios, tonos cobrizos'}
                      {safeAppearance.theme === 'gothic' && '🕯️ Efectos: Luces de vela, ambiente oscuro'}
                      {safeAppearance.theme === 'retro' && '📺 Efectos: Líneas CRT, fósforo verde'}
                      {safeAppearance.theme === 'pixelart' && '👾 Efectos: Rejilla de píxeles, partículas 8-bit'}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Background Settings */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Droplet className="w-4 h-4 text-blue-500" />
                    Fondo del Chat
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span>Transparencia</span>
                      <span className="text-muted-foreground">{Math.round(safeAppearance.background.transparency * 100)}%</span>
                    </div>
                    <Slider
                      value={[safeAppearance.background.transparency * 100]}
                      min={0}
                      max={100}
                      step={5}
                      onValueChange={([v]) => updateChatboxBackground({ transparency: v / 100 })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span>Desenfoque</span>
                      <span className="text-muted-foreground">{safeAppearance.background.blur}px</span>
                    </div>
                    <Slider
                      value={[safeAppearance.background.blur]}
                      min={0}
                      max={20}
                      step={1}
                      onValueChange={([blur]) => updateChatboxBackground({ blur })}
                    />
                  </div>
                  
                  <label className="flex items-center justify-between p-2 rounded-lg border cursor-pointer hover:bg-muted/50">
                    <div className="space-y-0.5">
                      <Label className="text-xs">Efecto cristal</Label>
                      <p className="text-xs text-muted-foreground">Glassmorphism</p>
                    </div>
                    <Switch
                      checked={safeAppearance.background.useGlassEffect}
                      onCheckedChange={(useGlassEffect) => updateChatboxBackground({ useGlassEffect })}
                    />
                  </label>
                  
                  <ColorPicker
                    label="Color de fondo personalizado"
                    value={safeAppearance.background.customBackgroundColor || '#18181b'}
                    onChange={(color) => updateChatboxBackground({ customBackgroundColor: color })}
                  />
                </CardContent>
              </Card>

              {/* Font Settings */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Type className="w-4 h-4 text-amber-500" />
                    Tipografía
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Familia de fuente</Label>
                    <Select
                      value={safeAppearance.font.fontFamily}
                      onValueChange={(v) => updateChatboxFont({ fontFamily: v as FontFamilyType })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FONT_FAMILY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <span className={option.preview}>{option.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {safeAppearance.font.fontFamily === 'custom' && (
                    <div className="space-y-1">
                      <Label className="text-xs">Fuente personalizada</Label>
                      <Input
                        value={safeAppearance.font.customFontFamily || ''}
                        onChange={(e) => updateChatboxFont({ customFontFamily: e.target.value })}
                        placeholder="ej: 'Roboto', sans-serif"
                        className="h-9 text-xs"
                      />
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Tamaño</Label>
                      <Select
                        value={safeAppearance.font.fontSize}
                        onValueChange={(v) => updateChatboxFont({ fontSize: v as typeof safeAppearance.font.fontSize })}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="xs">Muy pequeño</SelectItem>
                          <SelectItem value="sm">Pequeño</SelectItem>
                          <SelectItem value="base">Normal</SelectItem>
                          <SelectItem value="lg">Grande</SelectItem>
                          <SelectItem value="xl">Muy grande</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-xs">Peso</Label>
                      <Select
                        value={safeAppearance.font.fontWeight}
                        onValueChange={(v) => updateChatboxFont({ fontWeight: v as typeof safeAppearance.font.fontWeight })}
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
                      <Label className="text-xs">Altura de línea</Label>
                      <Select
                        value={safeAppearance.font.lineHeight}
                        onValueChange={(v) => updateChatboxFont({ lineHeight: v as typeof safeAppearance.font.lineHeight })}
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
                    
                    <div className="space-y-1">
                      <Label className="text-xs">Espaciado</Label>
                      <Select
                        value={safeAppearance.font.letterSpacing}
                        onValueChange={(v) => updateChatboxFont({ letterSpacing: v as typeof safeAppearance.font.letterSpacing })}
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

              {/* Text Formatting */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Paintbrush className="w-4 h-4 text-pink-500" />
                    Formato de Texto
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center justify-between p-2 rounded-lg border cursor-pointer hover:bg-muted/50">
                      <Label className="text-xs">Markdown</Label>
                      <Switch
                        checked={safeAppearance.textFormatting.enableMarkdown}
                        onCheckedChange={(v) => updateChatboxTextFormatting({ enableMarkdown: v })}
                      />
                    </label>
                    
                    <label className="flex items-center justify-between p-2 rounded-lg border cursor-pointer hover:bg-muted/50">
                      <Label className="text-xs">Código</Label>
                      <Switch
                        checked={safeAppearance.textFormatting.enableCodeHighlight}
                        onCheckedChange={(v) => updateChatboxTextFormatting({ enableCodeHighlight: v })}
                      />
                    </label>
                    
                    <label className="flex items-center justify-between p-2 rounded-lg border cursor-pointer hover:bg-muted/50">
                      <Label className="text-xs">Citas</Label>
                      <Switch
                        checked={safeAppearance.textFormatting.enableQuotes}
                        onCheckedChange={(v) => updateChatboxTextFormatting({ enableQuotes: v })}
                      />
                    </label>
                    
                    <div className="space-y-1">
                      <Label className="text-xs">Tema código</Label>
                      <Select
                        value={safeAppearance.textFormatting.codeBlockTheme}
                        onValueChange={(v) => updateChatboxTextFormatting({ codeBlockTheme: v as typeof safeAppearance.textFormatting.codeBlockTheme })}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dark">Oscuro</SelectItem>
                          <SelectItem value="light">Claro</SelectItem>
                          <SelectItem value="auto">Auto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Text Colors */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Colores de Texto</CardTitle>
                  <CardDescription className="text-xs">
                    Colores para diferentes tipos de mensajes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <ColorPicker
                      label="Usuario"
                      value={safeAppearance.textColors.userMessage}
                      onChange={(v) => updateChatboxTextColors({ userMessage: v })}
                    />
                    <ColorPicker
                      label="Personaje"
                      value={safeAppearance.textColors.characterMessage}
                      onChange={(v) => updateChatboxTextColors({ characterMessage: v })}
                    />
                    <ColorPicker
                      label="Narrador"
                      value={safeAppearance.textColors.narratorMessage}
                      onChange={(v) => updateChatboxTextColors({ narratorMessage: v })}
                    />
                    <ColorPicker
                      label="Sistema"
                      value={safeAppearance.textColors.systemMessage}
                      onChange={(v) => updateChatboxTextColors({ systemMessage: v })}
                    />
                    <ColorPicker
                      label="Enlaces"
                      value={safeAppearance.textColors.linkColor}
                      onChange={(v) => updateChatboxTextColors({ linkColor: v })}
                    />
                    <ColorPicker
                      label="Código"
                      value={safeAppearance.textColors.codeColor}
                      onChange={(v) => updateChatboxTextColors({ codeColor: v })}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Bubbles Tab */}
            <TabsContent value="bubbles" className="space-y-4 mt-0">
              {/* Bubble Style */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <MessageSquare className="w-4 h-4 text-blue-500" />
                    Estilo de Burbujas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {BUBBLE_STYLE_OPTIONS.map((style) => (
                      <button
                        key={style.value}
                        onClick={() => updateMessageBubbles({ style: style.value })}
                        className={cn(
                          'p-2 rounded-lg border text-xs transition-all',
                          safeAppearance.bubbles.style === style.value
                            ? 'border-primary bg-primary/10'
                            : 'hover:bg-muted/50'
                        )}
                      >
                        <div className="font-medium">{style.label}</div>
                        <div className="text-muted-foreground text-[10px]">{style.description}</div>
                      </button>
                    ))}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span>Radio de borde</span>
                      <span className="text-muted-foreground">{safeAppearance.bubbles.borderRadius}px</span>
                    </div>
                    <Slider
                      value={[safeAppearance.bubbles.borderRadius]}
                      min={0}
                      max={32}
                      step={2}
                      onValueChange={([v]) => updateMessageBubbles({ borderRadius: v })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span>Ancho máximo</span>
                      <span className="text-muted-foreground">{safeAppearance.bubbles.maxWidth}%</span>
                    </div>
                    <Slider
                      value={[safeAppearance.bubbles.maxWidth]}
                      min={50}
                      max={100}
                      step={5}
                      onValueChange={([v]) => updateMessageBubbles({ maxWidth: v })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span>Transparencia</span>
                      <span className="text-muted-foreground">{Math.round(safeAppearance.bubbles.transparency * 100)}%</span>
                    </div>
                    <Slider
                      value={[safeAppearance.bubbles.transparency * 100]}
                      min={0}
                      max={100}
                      step={5}
                      onValueChange={([v]) => updateMessageBubbles({ transparency: v / 100 })}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center justify-between p-2 rounded-lg border cursor-pointer hover:bg-muted/50">
                      <Label className="text-xs">Sombra</Label>
                      <Switch
                        checked={safeAppearance.bubbles.shadowEnabled}
                        onCheckedChange={(v) => updateMessageBubbles({ shadowEnabled: v })}
                      />
                    </label>
                    
                    {safeAppearance.bubbles.shadowEnabled && (
                      <div className="space-y-1">
                        <Label className="text-xs">Intensidad</Label>
                        <Select
                          value={safeAppearance.bubbles.shadowIntensity}
                          onValueChange={(v) => updateMessageBubbles({ shadowIntensity: v as typeof safeAppearance.bubbles.shadowIntensity })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="soft">Suave</SelectItem>
                            <SelectItem value="medium">Media</SelectItem>
                            <SelectItem value="strong">Fuerte</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Bubble Colors - Collapsible */}
              <Card>
                <Collapsible>
                  <CardHeader className="pb-0">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-sm">Colores de Burbujas</CardTitle>
                        <CardDescription className="text-xs">
                          Personaliza los colores de fondo y texto para cada tipo de mensaje
                        </CardDescription>
                      </div>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 shrink-0">
                          <ChevronDown className="w-3.5 h-3.5 transition-transform [[data-state=open]>rotate-180]" />
                          Colores
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="space-y-4 pt-4">
                  {/* User Bubble */}
                  <div className="p-3 rounded-lg bg-blue-500/10 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-blue-600">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      Burbuja de Usuario
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <ColorPicker
                        label="Fondo"
                        value={safeAppearance.bubbles.userBubbleColor}
                        onChange={(v) => updateMessageBubbles({ userBubbleColor: v })}
                      />
                      <ColorPicker
                        label="Texto"
                        value={safeAppearance.bubbles.userBubbleTextColor}
                        onChange={(v) => updateMessageBubbles({ userBubbleTextColor: v })}
                      />
                    </div>
                  </div>
                  
                  {/* Character Bubble */}
                  <div className="p-3 rounded-lg bg-amber-500/10 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-amber-600">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      Burbuja de Personaje
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <ColorPicker
                        label="Fondo"
                        value={safeAppearance.bubbles.characterBubbleColor}
                        onChange={(v) => updateMessageBubbles({ characterBubbleColor: v })}
                      />
                      <ColorPicker
                        label="Texto"
                        value={safeAppearance.bubbles.characterBubbleTextColor}
                        onChange={(v) => updateMessageBubbles({ characterBubbleTextColor: v })}
                      />
                    </div>
                  </div>
                  
                  {/* Narrator Bubble */}
                  <div className="p-3 rounded-lg bg-violet-500/10 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-violet-600">
                      <div className="w-3 h-3 rounded-full bg-violet-500" />
                      Burbuja de Narrador
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <ColorPicker
                        label="Fondo"
                        value={safeAppearance.bubbles.narratorBubbleColor}
                        onChange={(v) => updateMessageBubbles({ narratorBubbleColor: v })}
                      />
                      <ColorPicker
                        label="Texto"
                        value={safeAppearance.bubbles.narratorBubbleTextColor}
                        onChange={(v) => updateMessageBubbles({ narratorBubbleTextColor: v })}
                      />
                    </div>
                  </div>
                  
                  {/* System Bubble */}
                  <div className="p-3 rounded-lg bg-gray-500/10 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-600">
                      <div className="w-3 h-3 rounded-full bg-gray-500" />
                      Mensaje de Sistema
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <ColorPicker
                        label="Fondo"
                        value={safeAppearance.bubbles.systemBubbleColor}
                        onChange={(v) => updateMessageBubbles({ systemBubbleColor: v })}
                      />
                      <ColorPicker
                        label="Texto"
                        value={safeAppearance.bubbles.systemBubbleTextColor}
                        onChange={(v) => updateMessageBubbles({ systemBubbleTextColor: v })}
                      />
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
                </Collapsible>
              </Card>
            </TabsContent>

            {/* Avatars Tab */}
            <TabsContent value="avatars" className="space-y-4 mt-0">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-green-500" />
                    Configuración de Avatares
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <label className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Mostrar avatares</Label>
                      <p className="text-xs text-muted-foreground">Muestra las imágenes de avatar junto a los mensajes</p>
                    </div>
                    <Switch
                      checked={safeAppearance.avatars.show}
                      onCheckedChange={(v) => updateChatboxAvatars({ show: v })}
                    />
                  </label>
                  
                  {safeAppearance.avatars.show && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs">Forma</Label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {AVATAR_SHAPE_OPTIONS.map((shape) => {
                            const Icon = shape.icon;
                            return (
                              <button
                                key={shape.value}
                                onClick={() => updateChatboxAvatars({ shape: shape.value })}
                                className={cn(
                                  'p-2 rounded-lg border text-xs transition-all flex flex-col items-center gap-1',
                                  safeAppearance.avatars.shape === shape.value
                                    ? 'border-primary bg-primary/10'
                                    : 'hover:bg-muted/50'
                                )}
                              >
                                <Icon className="w-5 h-5" />
                                <span>{shape.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-xs">Tamaño</Label>
                        <Select
                          value={safeAppearance.avatars.size}
                          onValueChange={(v) => updateChatboxAvatars({ size: v as typeof safeAppearance.avatars.size })}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sm">Pequeño (32px)</SelectItem>
                            <SelectItem value="md">Mediano (40px)</SelectItem>
                            <SelectItem value="lg">Grande (48px)</SelectItem>
                            <SelectItem value="xl">Muy grande (56px)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {safeAppearance.avatars.shape !== 'circle' && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span>Radio de borde</span>
                            <span className="text-muted-foreground">{safeAppearance.avatars.borderRadius}px</span>
                          </div>
                          <Slider
                            value={[safeAppearance.avatars.borderRadius]}
                            min={0}
                            max={50}
                            step={2}
                            onValueChange={([v]) => updateChatboxAvatars({ borderRadius: v })}
                          />
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-3">
                        <label className="flex items-center justify-between p-2 rounded-lg border cursor-pointer hover:bg-muted/50">
                          <Label className="text-xs">Borde</Label>
                          <Switch
                            checked={safeAppearance.avatars.showBorder}
                            onCheckedChange={(v) => updateChatboxAvatars({ showBorder: v })}
                          />
                        </label>
                        
                        {safeAppearance.avatars.showBorder && (
                          <ColorPicker
                            label="Color del borde"
                            value={safeAppearance.avatars.borderColor}
                            onChange={(v) => updateChatboxAvatars({ borderColor: v })}
                          />
                        )}
                      </div>
                      
                      {safeAppearance.avatars.showBorder && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span>Ancho del borde</span>
                            <span className="text-muted-foreground">{safeAppearance.avatars.borderWidth}px</span>
                          </div>
                          <Slider
                            value={[safeAppearance.avatars.borderWidth]}
                            min={1}
                            max={4}
                            step={1}
                            onValueChange={([v]) => updateChatboxAvatars({ borderWidth: v })}
                          />
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Streaming Tab */}
            <TabsContent value="streaming" className="space-y-4 mt-0">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Sparkles className="w-4 h-4 text-yellow-500" />
                    Animación de Streaming
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Configura cómo se muestra el texto mientras se genera
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Estilo de animación</Label>
                    <Select
                      value={safeAppearance.streaming.animationStyle}
                      onValueChange={(v) => updateChatboxStreaming({ animationStyle: v as StreamingAnimationStyle })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STREAMING_ANIMATION_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span>Velocidad</span>
                      <span className="text-muted-foreground">{safeAppearance.streaming.animationSpeed} c/s</span>
                    </div>
                    <Slider
                      value={[safeAppearance.streaming.animationSpeed]}
                      min={10}
                      max={200}
                      step={10}
                      onValueChange={([v]) => updateChatboxStreaming({ animationSpeed: v })}
                    />
                  </div>
                  
                  <ColorPicker
                    label="Color del texto en streaming"
                    value={safeAppearance.streaming.streamingTextColor}
                    onChange={(v) => updateChatboxStreaming({ streamingTextColor: v })}
                  />
                  
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-sm font-medium">Cursor</Label>
                      <Switch
                        checked={safeAppearance.streaming.showCursor}
                        onCheckedChange={(v) => updateChatboxStreaming({ showCursor: v })}
                      />
                    </div>
                    
                    {safeAppearance.streaming.showCursor && (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label className="text-xs">Estilo del cursor</Label>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {CURSOR_STYLE_OPTIONS.map((style) => (
                              <button
                                key={style.value}
                                onClick={() => updateChatboxStreaming({ cursorStyle: style.value })}
                                className={cn(
                                  'p-2 rounded-lg border text-lg transition-all flex items-center justify-center',
                                  safeAppearance.streaming.cursorStyle === style.value
                                    ? 'border-primary bg-primary/10'
                                    : 'hover:bg-muted/50'
                                )}
                              >
                                {style.char}
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        <ColorPicker
                          label="Color del cursor"
                          value={safeAppearance.streaming.cursorColor}
                          onChange={(v) => updateChatboxStreaming({ cursorColor: v })}
                        />
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span>Velocidad de parpadeo</span>
                            <span className="text-muted-foreground">{safeAppearance.streaming.cursorBlinkRate}ms</span>
                          </div>
                          <Slider
                            value={[safeAppearance.streaming.cursorBlinkRate]}
                            min={200}
                            max={1000}
                            step={50}
                            onValueChange={([v]) => updateChatboxStreaming({ cursorBlinkRate: v })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Input Tab */}
            <TabsContent value="input" className="space-y-4 mt-0">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Monitor className="w-4 h-4 text-cyan-500" />
                    Caja de Entrada
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Personaliza la apariencia del campo de entrada de mensajes
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <ColorPicker
                      label="Fondo"
                      value={safeAppearance.input.backgroundColor}
                      onChange={(v) => updateChatboxInput({ backgroundColor: v })}
                    />
                    <ColorPicker
                      label="Texto"
                      value={safeAppearance.input.textColor}
                      onChange={(v) => updateChatboxInput({ textColor: v })}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <ColorPicker
                      label="Placeholder"
                      value={safeAppearance.input.placeholderColor}
                      onChange={(v) => updateChatboxInput({ placeholderColor: v })}
                    />
                    <ColorPicker
                      label="Borde"
                      value={safeAppearance.input.borderColor}
                      onChange={(v) => updateChatboxInput({ borderColor: v })}
                    />
                  </div>
                  
                  <ColorPicker
                    label="Borde al enfocar"
                    value={safeAppearance.input.focusBorderColor}
                    onChange={(v) => updateChatboxInput({ focusBorderColor: v })}
                  />
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span>Radio de borde</span>
                      <span className="text-muted-foreground">{safeAppearance.input.borderRadius}px</span>
                    </div>
                    <Slider
                      value={[safeAppearance.input.borderRadius]}
                      min={0}
                      max={24}
                      step={2}
                      onValueChange={([v]) => updateChatboxInput({ borderRadius: v })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs">Tamaño de fuente</Label>
                    <Select
                      value={safeAppearance.input.fontSize}
                      onValueChange={(v) => updateChatboxInput({ fontSize: v as typeof safeAppearance.input.fontSize })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sm">Pequeño</SelectItem>
                        <SelectItem value="base">Normal</SelectItem>
                        <SelectItem value="lg">Grande</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          
          {/* Reset Button */}
          <div className="mt-4 pt-4 border-t flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={resetChatboxAppearance}
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Restablecer valores
            </Button>
          </div>
        </div>
        
        {/* Live Preview Panel */}
        {previewVisible && (
          <div className="w-[320px] xl:w-[380px] flex-shrink-0">
            <div className="sticky top-0">
              <LivePreview settings={safeAppearance} />
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
