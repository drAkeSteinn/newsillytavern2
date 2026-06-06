// ============================================
// Character Voice Panel - Dual Voice Configuration
// Configures dialogue voice and narrator voice separately
// ============================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Volume2,
  Mic,
  RefreshCw,
  HelpCircle,
  MessageSquare,
  BookOpen,
  Settings,
  Check,
  Loader2,
  AlertCircle,
  Globe,
  Sparkles,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { 
  CharacterVoiceSettings, 
  CharacterVoiceConfig, 
  VoiceInfo,
  TTSWebUIConfig,
  OmniVoiceProfile,
} from '@/types';
import { 
  DEFAULT_CHARACTER_VOICE_SETTINGS, 
  DEFAULT_VOICE_CONFIG 
} from '@/types';

// Supported languages for multilingual model
const SUPPORTED_LANGUAGES = [
  { code: 'es', name: 'Español' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ko', name: 'Korean' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
];

interface CharacterVoicePanelProps {
  voiceSettings: CharacterVoiceSettings | null;
  onChange: (settings: CharacterVoiceSettings) => void;
  globalConfig?: TTSWebUIConfig | null;
}

export function CharacterVoicePanel({ 
  voiceSettings, 
  onChange,
  globalConfig 
}: CharacterVoicePanelProps) {
  const [availableVoices, setAvailableVoices] = useState<VoiceInfo[]>([]);
  const [omniVoiceProfiles, setOmniVoiceProfiles] = useState<OmniVoiceProfile[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [activeSection, setActiveSection] = useState<'dialogue' | 'narrator'>('dialogue');

  const isOmniVoice = globalConfig?.provider === 'omnivoice';

  // Initialize settings if null, ensuring all nested objects exist
  const settings: CharacterVoiceSettings = {
    ...DEFAULT_CHARACTER_VOICE_SETTINGS,
    ...voiceSettings,
    dialogueVoice: {
      ...DEFAULT_VOICE_CONFIG,
      ...voiceSettings?.dialogueVoice,
    },
    narratorVoice: {
      ...DEFAULT_VOICE_CONFIG,
      ...voiceSettings?.narratorVoice,
    },
  };

  // Load voices from TTS provider via server-side proxy (avoids CORS and direct connection errors)
  const loadVoices = useCallback(async () => {
    const baseUrl = globalConfig?.baseUrl || 'http://localhost:7778';
    const provider = globalConfig?.provider || 'tts-webui';
    setIsLoadingVoices(true);

    try {
      const response = await fetch(`/api/tts/available-voices?endpoint=${encodeURIComponent(baseUrl)}&provider=${provider}`);
      
      if (response.ok) {
        const data = await response.json();
        
        // Use the voices array directly - the API now returns properly parsed voices
        if (data.voices && Array.isArray(data.voices)) {
          setAvailableVoices(data.voices);
        } else {
          setAvailableVoices([]);
        }
      }

      // Also load OmniVoice profiles if using OmniVoice provider
      if (provider === 'omnivoice') {
        try {
          const profilesResponse = await fetch(`/api/tts/omnivoice/profiles?endpoint=${encodeURIComponent(baseUrl)}`);
          if (profilesResponse.ok) {
            const profilesData = await profilesResponse.json();
            if (profilesData.success && profilesData.profiles) {
              setOmniVoiceProfiles(profilesData.profiles);
            }
          }
        } catch {
          // Silently fail - profiles may not be available
        }
      }
    } catch (error) {
      // Silently fail - TTS service may not be available
      // This is expected when the service isn't running
      console.log('[TTS] Voice service not available, using defaults');
      setAvailableVoices([]);
    } finally {
      setIsLoadingVoices(false);
    }
  }, [globalConfig?.baseUrl, globalConfig?.provider]);

  // Load voices on mount
  useEffect(() => {
    loadVoices();
  }, [loadVoices]);

  // Update settings helper
  const updateSettings = (updates: Partial<CharacterVoiceSettings>) => {
    onChange({ ...settings, ...updates });
  };

  // Update voice config helper
  const updateVoiceConfig = (
    type: 'dialogueVoice' | 'narratorVoice',
    updates: Partial<CharacterVoiceConfig>
  ) => {
    onChange({
      ...settings,
      [type]: {
        ...settings[type],
        ...updates,
      },
    });
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Voice Toggle */}
        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/40">
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-pink-500" />
            <span className="text-sm font-medium">Activar Voz para este Personaje</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Cuando está activado, las respuestas del personaje se reproducirán como audio.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(checked) => updateSettings({ enabled: checked })}
          />
        </div>

        {settings.enabled && (
          <>
            {/* Text Generation Options - Positive Logic */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Qué Generar
                </CardTitle>
                <CardDescription>
                  Selecciona qué tipos de texto convertir a voz
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-500" />
                    <Label className="text-xs">Diálogos ("texto entre comillas")</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Generar audio para el texto entre comillas dobles.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Switch
                    checked={settings.generateDialogues ?? true}
                    onCheckedChange={(checked) => updateSettings({ generateDialogues: checked })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-purple-500" />
                    <Label className="text-xs">Narración (*texto entre asteriscos*)</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Generar audio para el texto entre asteriscos.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Switch
                    checked={settings.generateNarrations ?? true}
                    onCheckedChange={(checked) => updateSettings({ generateNarrations: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-orange-500" />
                    <Label className="text-xs">Texto plano (sin formato)</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Generar audio para texto sin comillas ni asteriscos.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Switch
                    checked={settings.generatePlainText ?? true}
                    onCheckedChange={(checked) => updateSettings({ generatePlainText: checked })}
                  />
                </div>

                {/* Example */}
                <div className="text-xs bg-muted/50 p-2 rounded border">
                  <p className="text-muted-foreground mb-1">Ejemplo:</p>
                  <p className="font-mono">*Camina* "Hola, ¿cómo estás?"</p>
                  <div className="mt-1 space-y-0.5">
                    <p className="text-blue-600">✓ Diálogos: "Hola, ¿cómo estás?"</p>
                    <p className="text-purple-600">✓ Narración: Camina</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dual Voice Configuration */}
            <div className="grid grid-cols-2 gap-3">
              {/* Dialogue Voice */}
              <Card className={cn(
                "cursor-pointer transition-all",
                activeSection === 'dialogue' && "ring-2 ring-pink-500/50"
              )}>
                <CardHeader 
                  className="pb-2 cursor-pointer"
                  onClick={() => setActiveSection('dialogue')}
                >
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-500" />
                    Voz de Diálogo
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Texto entre "comillas"
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <VoiceConfigEditor
                    config={settings.dialogueVoice}
                    onChange={(updates) => updateVoiceConfig('dialogueVoice', updates)}
                    voices={availableVoices}
                    profiles={omniVoiceProfiles}
                    isLoadingVoices={isLoadingVoices}
                    onRefreshVoices={loadVoices}
                    globalLanguage={globalConfig?.language}
                    isOmniVoice={isOmniVoice}
                  />
                </CardContent>
              </Card>

              {/* Narrator Voice */}
              <Card className={cn(
                "cursor-pointer transition-all",
                activeSection === 'narrator' && "ring-2 ring-purple-500/50"
              )}>
                <CardHeader 
                  className="pb-2 cursor-pointer"
                  onClick={() => setActiveSection('narrator')}
                >
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-purple-500" />
                    Voz del Narrador
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Texto entre *asteriscos*
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <VoiceConfigEditor
                    config={settings.narratorVoice}
                    onChange={(updates) => updateVoiceConfig('narratorVoice', updates)}
                    voices={availableVoices}
                    profiles={omniVoiceProfiles}
                    isLoadingVoices={isLoadingVoices}
                    onRefreshVoices={loadVoices}
                    globalLanguage={globalConfig?.language}
                    isOmniVoice={isOmniVoice}
                  />
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {!settings.enabled && (
          <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg border border-border/40">
            <Mic className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">Voz desactivada</p>
            <p className="text-xs mt-1">Activa el sistema para configurar texto-a-voz.</p>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

// ============================================
// Voice Config Editor Component
// ============================================

interface VoiceConfigEditorProps {
  config: CharacterVoiceConfig;
  onChange: (updates: Partial<CharacterVoiceConfig>) => void;
  voices: VoiceInfo[];
  profiles: OmniVoiceProfile[];
  isLoadingVoices: boolean;
  onRefreshVoices: () => void;
  globalLanguage?: string;
  isOmniVoice?: boolean;
}

function VoiceConfigEditor({
  config,
  onChange,
  voices,
  profiles,
  isLoadingVoices,
  onRefreshVoices,
  globalLanguage,
  isOmniVoice,
}: VoiceConfigEditorProps) {
  // Safety check: ensure config exists
  if (!config) {
    return (
      <div className="text-xs text-muted-foreground p-2">
        Configuración no disponible
      </div>
    );
  }

  // Filter voices by language if set
  const configLanguage = config.language;
  const filteredVoices = configLanguage
    ? voices.filter(v => v.language === configLanguage)
    : voices;

  return (
    <div className="space-y-3">
      {/* Enable this voice */}
      <div className="flex items-center justify-between">
        <Label className="text-xs">Habilitar</Label>
        <Switch
          checked={config.enabled}
          onCheckedChange={(checked) => onChange({ enabled: checked })}
        />
      </div>

      {config.enabled && (
        <>
          {/* Voice Selection */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Voz</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 text-[10px] px-1"
                onClick={onRefreshVoices}
                disabled={isLoadingVoices}
              >
                {isLoadingVoices ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
              </Button>
            </div>
            <Select
              value={config.voiceId || 'default'}
              onValueChange={(value) => onChange({ voiceId: value })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Seleccionar voz" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Por defecto (global)</SelectItem>
                
                {/* OmniVoice: Show profiles as a separate group */}
                {isOmniVoice && profiles.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <User className="w-3 h-3" />
                      Perfiles de Voz
                    </div>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        <span className="flex items-center gap-1">
                          {profile.name}
                          {profile.is_demo === 1 && (
                            <span className="text-[9px] bg-blue-500/10 text-blue-500 px-1 rounded">demo</span>
                          )}
                          {profile.language && profile.language !== 'Auto' && (
                            <span className="text-[9px] text-muted-foreground">({profile.language})</span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </>
                )}
                
                {/* OmniVoice: Show system voices (OpenAI aliases, etc.) */}
                {isOmniVoice && voices.filter(v => v.type === 'openai_alias').length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Voces OpenAI
                    </div>
                    {voices
                      .filter(v => v.type === 'openai_alias')
                      .map((voice) => (
                        <SelectItem key={voice.id} value={voice.id}>
                          {voice.name}
                        </SelectItem>
                      ))}
                  </>
                )}
                
                {/* TTS-WebUI: Show all voices */}
                {!isOmniVoice && filteredVoices.map((voice) => (
                  <SelectItem key={voice.id} value={voice.id}>
                    {voice.name}
                    {voice.language && (
                      <span className="text-muted-foreground ml-1">
                        ({voice.language.toUpperCase()})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Language */}
          <div className="space-y-1">
            <Label className="text-xs">Idioma</Label>
            <Select
              value={config.language || globalLanguage || 'es'}
              onValueChange={(value) => onChange({ language: value })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Exaggeration */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs">Exageración</Label>
              <span className="text-[10px] text-muted-foreground">
                {config.exaggeration?.toFixed(2) || '0.50'}
              </span>
            </div>
            <Slider
              value={[config.exaggeration ?? 0.5]}
              min={0}
              max={1}
              step={0.05}
              onValueChange={([value]) => onChange({ exaggeration: value })}
              className="py-1"
            />
          </div>

          {/* CFG Weight */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs">CFG Weight</Label>
              <span className="text-[10px] text-muted-foreground">
                {config.cfgWeight?.toFixed(2) || '0.50'}
              </span>
            </div>
            <Slider
              value={[config.cfgWeight ?? 0.5]}
              min={0}
              max={1}
              step={0.05}
              onValueChange={([value]) => onChange({ cfgWeight: value })}
              className="py-1"
            />
          </div>

          {/* Temperature */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs">Temperatura</Label>
              <span className="text-[10px] text-muted-foreground">
                {config.temperature?.toFixed(2) || '0.80'}
              </span>
            </div>
            <Slider
              value={[config.temperature ?? 0.8]}
              min={0.1}
              max={2}
              step={0.1}
              onValueChange={([value]) => onChange({ temperature: value })}
              className="py-1"
            />
          </div>

          {/* Speed */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs">Velocidad</Label>
              <span className="text-[10px] text-muted-foreground">
                {config.speed?.toFixed(1) || '1.0'}x
              </span>
            </div>
            <Slider
              value={[config.speed ?? 1.0]}
              min={0.5}
              max={2}
              step={0.1}
              onValueChange={([value]) => onChange({ speed: value })}
              className="py-1"
            />
          </div>
        </>
      )}
    </div>
  );
}

// ============================================
// Helper Functions
// ============================================

function extractLanguage(voiceId: string): string | undefined {
  const match = voiceId.match(/\/([a-z]{2})-/);
  return match ? match[1] : undefined;
}
