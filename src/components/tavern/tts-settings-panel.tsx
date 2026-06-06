// ============================================
// TTS Settings Panel - Configure TTS integration
// Supports TTS-WebUI and OmniVoice Studio providers
// ============================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Volume2,
  Mic,
  Upload,
  Play,
  Square,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Loader2,
  Settings,
  Music,
  FileAudio,
  Save,
  Ear,
  Activity,
  Radio,
  Zap,
  ChevronDown,
  Globe,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TTSWebUIConfig, TTSProviderType, ASRConfig, WakeWordConfig, VADConfig, VoiceInfo, OmniVoiceProfile, OmniVoiceArchetype, OmniVoiceEngine } from '@/types';

// Supported languages
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

// Available TTS models per provider
const TTS_WEBUI_MODELS = [
  { id: 'multilingual', name: 'Chatterbox Multilingual', description: 'Multi-language TTS with voice cloning' },
  { id: 'chatterbox', name: 'Chatterbox', description: 'English TTS with voice cloning' },
  { id: 'chatterbox-turbo', name: 'Chatterbox Turbo', description: 'Fast TTS (350M params)' },
];

const OMNIVOICE_MODELS = [
  { id: 'omnivoice', name: 'OmniVoice', description: 'Default multi-engine (646+ languages)' },
  { id: 'cosyvoice', name: 'CosyVoice 3', description: '9 langs + 18 dialects, voice cloning' },
  { id: 'voxcpm2', name: 'VoxCPM2', description: '30 languages, voice cloning + instruct' },
  { id: 'moss-tts-nano', name: 'MOSS-TTS-Nano', description: '20 languages, lightweight' },
  { id: 'kitten-tts', name: 'KittenTTS', description: 'English, CPU-friendly' },
  { id: 'gpt-sovits', name: 'GPT-SoVITS', description: 'Voice cloning + instruct' },
];

// Provider configurations
const PROVIDER_CONFIGS: Record<TTSProviderType, { 
  name: string; 
  defaultUrl: string; 
  defaultModel: string;
  description: string;
}> = {
  'tts-webui': {
    name: 'TTS-WebUI',
    defaultUrl: 'http://localhost:7778',
    defaultModel: 'multilingual',
    description: 'Chatterbox TTS — Voice cloning, 23 languages',
  },
  'omnivoice': {
    name: 'OmniVoice Studio',
    defaultUrl: 'http://localhost:3900',
    defaultModel: 'omnivoice',
    description: 'Multi-engine TTS — 646+ languages, Voice Design',
  },
  'z-ai': {
    name: 'Z.ai',
    defaultUrl: '',
    defaultModel: 'default',
    description: 'Z.ai Cloud TTS',
  },
  'custom': {
    name: 'Custom',
    defaultUrl: 'http://localhost:8000',
    defaultModel: 'tts-1',
    description: 'OpenAI-compatible endpoint',
  },
};

interface ServiceStatus {
  status: 'online' | 'offline' | 'checking';
  endpoint: string;
  error?: string;
}

// Default configuration
const DEFAULT_TTS_CONFIG: TTSWebUIConfig = {
  enabled: false,
  autoGeneration: false,
  provider: 'tts-webui',
  baseUrl: 'http://localhost:7778',
  model: 'multilingual',
  whisperModel: 'whisper-large-v3',
  speed: 1.0,
  responseFormat: 'wav',
  language: 'es',
  exaggeration: 0.5,
  cfgWeight: 0.5,
  temperature: 0.8,
  generateDialogues: true,
  generateNarrations: true,
  generatePlainText: true,
  applyRegex: false,
  voiceDesign: '',
  instruct: '',
};

const DEFAULT_ASR_CONFIG: ASRConfig = {
  enabled: false,
  provider: 'tts-webui',
  model: 'openai/whisper-small',
};

const DEFAULT_KWS_CONFIG: WakeWordConfig = {
  enabled: false,
  wakeWords: [],
  sensitivity: 'medium',
  cooldownMs: 3000,
  language: 'es-ES',
};

const DEFAULT_VAD_CONFIG: VADConfig = {
  enabled: true,
  silenceThreshold: 30,
  silenceDurationMs: 1500,
  minRecordingMs: 500,
  maxRecordingMs: 30000,
};

export function TTSSettingsPanel() {
  const [ttsConfig, setTtsConfig] = useState<TTSWebUIConfig>(DEFAULT_TTS_CONFIG);
  const [asrConfig, setAsrConfig] = useState<ASRConfig>(DEFAULT_ASR_CONFIG);
  const [kwsConfig, setKwsConfig] = useState<WakeWordConfig>(DEFAULT_KWS_CONFIG);
  const [vadConfig, setVadConfig] = useState<VADConfig>(DEFAULT_VAD_CONFIG);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>({
    status: 'checking',
    endpoint: DEFAULT_TTS_CONFIG.baseUrl,
  });
  const [availableVoices, setAvailableVoices] = useState<VoiceInfo[]>([]);
  const [omniVoiceProfiles, setOmniVoiceProfiles] = useState<OmniVoiceProfile[]>([]);
  const [omniVoiceArchetypes, setOmniVoiceArchetypes] = useState<OmniVoiceArchetype[]>([]);
  const [omniVoiceEngines, setOmniVoiceEngines] = useState<OmniVoiceEngine[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);
  const [isLoadingArchetypes, setIsLoadingArchetypes] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testText, setTestText] = useState('Hola, esta es una prueba de voz.');
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const isOmniVoice = ttsConfig.provider === 'omnivoice';
  const currentModels = isOmniVoice ? OMNIVOICE_MODELS : TTS_WEBUI_MODELS;

  // Load saved config on mount
  useEffect(() => {
    loadSavedConfig();
  }, []);

  // Check service status when URL changes
  useEffect(() => {
    if (ttsConfig.baseUrl) {
      checkServiceStatus();
      loadAvailableVoices();
      // Also load OmniVoice-specific data if that provider is selected
      if (ttsConfig.provider === 'omnivoice') {
        loadOmniVoiceProfiles();
        loadOmniVoiceArchetypes();
      }
    }
  }, [ttsConfig.baseUrl, ttsConfig.provider]);

  // Load saved configuration
  const loadSavedConfig = async () => {
    try {
      const response = await fetch('/api/tts/config');
      const data = await response.json();
      if (data.success && data.config) {
        const loadedTts = { ...DEFAULT_TTS_CONFIG, ...data.config.tts };
        setTtsConfig(loadedTts);
        setAsrConfig(data.config.asr);
        if (data.config.kws) setKwsConfig(data.config.kws);
        if (data.config.vad) setVadConfig(data.config.vad);
      }
    } catch (error) {
      console.warn('[TTS Settings] Failed to load TTS config:', error);
    }
  };

  // Save configuration
  const saveConfig = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/tts/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tts: ttsConfig, 
          asr: asrConfig,
          kws: kwsConfig,
          vad: vadConfig,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setHasChanges(false);
      }
    } catch (error) {
      console.warn('[TTS Settings] Failed to save TTS config:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Check service status
  const checkServiceStatus = useCallback(async () => {
    setServiceStatus(prev => ({ ...prev, status: 'checking' }));

    try {
      const response = await fetch(`/api/tts/speech?endpoint=${encodeURIComponent(ttsConfig.baseUrl)}&provider=${ttsConfig.provider}`);
      const data = await response.json();

      setServiceStatus({
        status: data.status,
        endpoint: ttsConfig.baseUrl,
        error: data.error,
      });
    } catch (error) {
      setServiceStatus({
        status: 'offline',
        endpoint: ttsConfig.baseUrl,
        error: error instanceof Error ? error.message : 'Cannot connect',
      });
    }
  }, [ttsConfig.baseUrl, ttsConfig.provider]);

  // Load available voices from TTS service
  const loadAvailableVoices = async () => {
    try {
      const response = await fetch(`/api/tts/available-voices?endpoint=${encodeURIComponent(ttsConfig.baseUrl)}&provider=${ttsConfig.provider}`);
      const data = await response.json();
      if (data.success && data.voices && data.voices.length > 0) {
        setAvailableVoices(data.voices);
      } else {
        setAvailableVoices([]);
      }
      // Capture engines info from OmniVoice
      if (data.engines && Array.isArray(data.engines)) {
        setOmniVoiceEngines(data.engines);
      } else {
        setOmniVoiceEngines([]);
      }
    } catch (error) {
      console.warn('[TTS Settings] Failed to load available voices:', error);
      setAvailableVoices([]);
      setOmniVoiceEngines([]);
    }
  };

  // Load OmniVoice voice profiles
  const loadOmniVoiceProfiles = async () => {
    setIsLoadingProfiles(true);
    try {
      const response = await fetch(`/api/tts/omnivoice/profiles?endpoint=${encodeURIComponent(ttsConfig.baseUrl)}`);
      const data = await response.json();
      if (data.success && data.profiles) {
        setOmniVoiceProfiles(data.profiles);
      } else {
        setOmniVoiceProfiles([]);
      }
    } catch (error) {
      console.warn('[TTS Settings] Failed to load OmniVoice profiles:', error);
      setOmniVoiceProfiles([]);
    } finally {
      setIsLoadingProfiles(false);
    }
  };

  // Load OmniVoice archetypes (curated voice designs)
  const loadOmniVoiceArchetypes = async () => {
    setIsLoadingArchetypes(true);
    try {
      const response = await fetch(`/api/tts/omnivoice/archetypes?endpoint=${encodeURIComponent(ttsConfig.baseUrl)}`);
      const data = await response.json();
      if (data.success && data.archetypes) {
        setOmniVoiceArchetypes(data.archetypes);
      } else {
        setOmniVoiceArchetypes([]);
      }
    } catch (error) {
      console.warn('[TTS Settings] Failed to load OmniVoice archetypes:', error);
      setOmniVoiceArchetypes([]);
    } finally {
      setIsLoadingArchetypes(false);
    }
  };

  // Apply an archetype to create a voice profile
  const applyArchetype = async (archetypeId: string, archetypeName: string) => {
    try {
      const response = await fetch('/api/tts/omnivoice/archetypes/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: ttsConfig.baseUrl,
          id: archetypeId,
          name: archetypeName,
        }),
      });
      const data = await response.json();
      if (data.success && data.profile) {
        // Refresh profiles after creating one from archetype
        await loadOmniVoiceProfiles();
        await loadAvailableVoices();
      }
    } catch (error) {
      console.warn('[TTS Settings] Failed to use archetype:', error);
    }
  };

  // Update TTS config and mark as changed
  const updateTtsConfig = (updates: Partial<TTSWebUIConfig>) => {
    setTtsConfig(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  // Handle provider change
  const handleProviderChange = (newProvider: TTSProviderType) => {
    const providerConfig = PROVIDER_CONFIGS[newProvider];
    setTtsConfig(prev => ({
      ...prev,
      provider: newProvider,
      baseUrl: providerConfig.defaultUrl,
      model: providerConfig.defaultModel,
    }));
    setHasChanges(true);
  };

  // Update ASR config and mark as changed
  const updateAsrConfig = (updates: Partial<ASRConfig>) => {
    setAsrConfig(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  // Update KWS config and mark as changed
  const updateKwsConfig = (updates: Partial<WakeWordConfig>) => {
    setKwsConfig(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  // Update VAD config and mark as changed
  const updateVadConfig = (updates: Partial<VADConfig>) => {
    setVadConfig(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  // Test TTS
  const handleTestTTS = async () => {
    if (!testText.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/tts/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: testText,
          model: ttsConfig.model,
          voice: ttsConfig.defaultVoice,
          speed: ttsConfig.speed,
          response_format: ttsConfig.responseFormat,
          language: ttsConfig.language,
          endpoint: ttsConfig.baseUrl,
          provider: ttsConfig.provider,
          // TTS-WebUI specific
          exaggeration: ttsConfig.exaggeration,
          cfg_weight: ttsConfig.cfgWeight,
          temperature: ttsConfig.temperature,
          // OmniVoice specific
          voiceDesign: ttsConfig.voiceDesign,
          instruct: ttsConfig.instruct,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || `Error del servidor (${response.status})`;
        console.warn('[TTS] Test error:', errorMsg);
        alert(`Error TTS: ${errorMsg}`);
      } else if (data.success && data.audio) {
        // Create audio blob URL
        const audioBlob = base64ToBlob(data.audio, `audio/${data.format}`);
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);

        // Play audio — handle autoplay policy gracefully
        const audio = new Audio(url);
        setIsPlaying(true);
        audio.play().catch((error) => {
          const errorMsg = error?.message || String(error);
          if (errorMsg.includes("user didn't interact") || 
              errorMsg.includes('NotAllowedError') ||
              errorMsg.includes('play() failed')) {
            console.warn('[TTS] Autoplay blocked — click the Play button to hear the test');
            setIsPlaying(false);
          } else {
            console.warn('[TTS] Playback error:', error);
            setIsPlaying(false);
          }
        });
        audio.onended = () => setIsPlaying(false);
      } else {
        console.warn('[TTS] Test error:', data.error);
        alert(`Error TTS: ${data.error}`);
      }
    } catch (error) {
      console.warn('[TTS] Failed to test TTS:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Stop playback
  const handleStopPlayback = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setIsPlaying(false);
  };

  // Helper: base64 to blob
  const base64ToBlob = (base64: string, mimeType: string) => {
    const byteCharacters = atob(base64);
    const byteArrays: BlobPart[] = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray as BlobPart);
    }

    return new Blob(byteArrays, { type: mimeType });
  };

  return (
    <div className="space-y-4">
      {/* Service Status Banner */}
      <Card className={cn(
        'border-2',
        serviceStatus.status === 'online' ? 'border-green-500/30 bg-green-500/5' :
        serviceStatus.status === 'offline' ? 'border-red-500/30 bg-red-500/5' :
        'border-yellow-500/30 bg-yellow-500/5'
      )}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {serviceStatus.status === 'checking' ? (
                <Loader2 className="w-5 h-5 animate-spin text-yellow-500" />
              ) : serviceStatus.status === 'online' ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-500" />
              )}
              <div>
                <p className="font-medium">
                  {PROVIDER_CONFIGS[ttsConfig.provider].name} {serviceStatus.status === 'online' ? 'Conectado' : serviceStatus.status === 'checking' ? 'Verificando...' : 'Desconectado'}
                </p>
                <p className="text-xs text-muted-foreground">{serviceStatus.endpoint}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={checkServiceStatus}
              disabled={serviceStatus.status === 'checking'}
            >
              <RefreshCw className={cn('w-4 h-4 mr-2', serviceStatus.status === 'checking' && 'animate-spin')} />
              Verificar
            </Button>
          </div>
          {serviceStatus.error && (
            <p className="mt-2 text-xs text-red-500">{serviceStatus.error}</p>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      {hasChanges && (
        <Button onClick={saveConfig} disabled={isSaving} className="w-full">
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Guardar Configuración
        </Button>
      )}

      <Tabs defaultValue="kws" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="kws" className="gap-2">
            <Ear className="w-4 h-4" />
            Voz (KWS)
          </TabsTrigger>
          <TabsTrigger value="tts" className="gap-2">
            <Volume2 className="w-4 h-4" />
            TTS
          </TabsTrigger>
          <TabsTrigger value="voices" className="gap-2">
            <Music className="w-4 h-4" />
            Voces
          </TabsTrigger>
        </TabsList>

        {/* TTS Tab */}
        <TabsContent value="tts" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Configuración TTS
              </CardTitle>
              <CardDescription>
                Configura la síntesis de voz
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Enable TTS */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="tts-enabled">Habilitar TTS</Label>
                  <p className="text-xs text-muted-foreground">
                    Activa el sistema de texto-a-voz
                  </p>
                </div>
                <Switch
                  id="tts-enabled"
                  checked={ttsConfig.enabled}
                  onCheckedChange={(checked) => updateTtsConfig({ enabled: checked })}
                />
              </div>

              {/* Auto Generation */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-generation">Generación Automática</Label>
                  <p className="text-xs text-muted-foreground">
                    Reproducir audio automáticamente en nuevos mensajes
                  </p>
                </div>
                <Switch
                  id="auto-generation"
                  checked={ttsConfig.autoGeneration || false}
                  onCheckedChange={(checked) => updateTtsConfig({ autoGeneration: checked })}
                  disabled={!ttsConfig.enabled}
                />
              </div>

              {/* Text Filtering Section */}
              <Collapsible defaultOpen>
                <div className="flex items-center justify-between pt-2 border-t">
                  <Label className="text-sm font-medium">Qué Generar</Label>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                      <ChevronDown className="w-3.5 h-3.5 transition-transform [[data-state=open]>rotate-180]" />
                      {ttsConfig.enabled ? 'Mostrando' : 'Colapsado'}
                    </Button>
                  </CollapsibleTrigger>
                </div>
                
                <CollapsibleContent>
                <div className="space-y-3 pt-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="generate-dialogues" className="text-xs">
                      Diálogos ("texto entre comillas")
                    </Label>
                  </div>
                  <Switch
                    id="generate-dialogues"
                    checked={ttsConfig.generateDialogues ?? true}
                    onCheckedChange={(checked) => updateTtsConfig({ generateDialogues: checked })}
                    disabled={!ttsConfig.enabled}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="generate-narrations" className="text-xs">
                      Narración (*texto entre asteriscos*)
                    </Label>
                  </div>
                  <Switch
                    id="generate-narrations"
                    checked={ttsConfig.generateNarrations ?? true}
                    onCheckedChange={(checked) => updateTtsConfig({ generateNarrations: checked })}
                    disabled={!ttsConfig.enabled}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="generate-plain-text" className="text-xs">
                      Texto plano (sin formato)
                    </Label>
                  </div>
                  <Switch
                    id="generate-plain-text"
                    checked={ttsConfig.generatePlainText ?? true}
                    onCheckedChange={(checked) => updateTtsConfig({ generatePlainText: checked })}
                    disabled={!ttsConfig.enabled}
                  />
                </div>

                <div className="text-[10px] bg-muted/50 p-2 rounded border">
                  <p className="text-muted-foreground mb-1">Ejemplo:</p>
                  <p className="font-mono">*Camina* "Hola" y sonríe.</p>
                  <div className="mt-1 space-y-0.5">
                    <p className="text-blue-600">✓ Diálogos: "Hola"</p>
                    <p className="text-purple-600">✓ Narración: Camina</p>
                    <p className="text-orange-600">✓ Texto plano: y sonríe.</p>
                  </div>
                </div>
                </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Provider Selection */}
              <div className="space-y-2 pt-2 border-t">
                <Label>Proveedor TTS</Label>
                <Select
                  value={ttsConfig.provider || 'tts-webui'}
                  onValueChange={(value: TTSProviderType) => handleProviderChange(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(PROVIDER_CONFIGS) as [TTSProviderType, typeof PROVIDER_CONFIGS[TTSProviderType]][]).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex flex-col">
                          <span>{config.name}</span>
                          <span className="text-xs text-muted-foreground">{config.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Selecciona el proveedor de TTS. Cambiar el proveedor actualizará la URL y el modelo por defecto.
                </p>
              </div>

              {/* Endpoint */}
              <div className="space-y-2">
                <Label>URL del Servicio</Label>
                <Input
                  value={ttsConfig.baseUrl}
                  onChange={(e) => updateTtsConfig({ baseUrl: e.target.value })}
                  placeholder={PROVIDER_CONFIGS[ttsConfig.provider].defaultUrl}
                />
                <p className="text-xs text-muted-foreground">
                  URL base del servidor {PROVIDER_CONFIGS[ttsConfig.provider].name}
                </p>
              </div>

              {/* Model Selection */}
              <div className="space-y-2">
                <Label>Modelo TTS</Label>
                <Select
                  value={ttsConfig.model}
                  onValueChange={(value) => updateTtsConfig({ model: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {currentModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <div className="flex flex-col">
                          <span>{model.name}</span>
                          <span className="text-xs text-muted-foreground">{model.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Language Selection */}
              <div className="space-y-2">
                <Label>Idioma</Label>
                <Select
                  value={ttsConfig.language || 'es'}
                  onValueChange={(value) => updateTtsConfig({ language: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar idioma" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name} ({lang.code.toUpperCase()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {isOmniVoice 
                    ? 'OmniVoice soporta 646+ idiomas' 
                    : 'Selecciona el idioma para el modelo multilingüe'}
                </p>
              </div>

              {/* Voice Selection Dropdown */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Voz de Referencia</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadAvailableVoices}
                    className="h-7 text-xs"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Actualizar
                  </Button>
                </div>
                <Select
                  value={ttsConfig.defaultVoice || 'none'}
                  onValueChange={(value) => updateTtsConfig({ 
                    defaultVoice: value === 'none' ? undefined : value 
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar voz" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      {isOmniVoice ? 'Por defecto (OmniVoice)' : 'Por defecto (sin voz de referencia)'}
                    </SelectItem>
                    {availableVoices.length === 0 && (
                      <SelectItem value="_loading" disabled>
                        Carga voces con el botón Actualizar
                      </SelectItem>
                    )}
                    {availableVoices.map((voice) => (
                      <SelectItem key={voice.id} value={voice.id}>
                        {voice.name}
                        {voice.language && (
                          <span className="text-xs text-muted-foreground ml-2">
                            ({voice.language})
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {availableVoices.length > 0 
                    ? `${availableVoices.length} voces disponibles`
                    : `Presiona "Actualizar" para cargar las voces desde ${PROVIDER_CONFIGS[ttsConfig.provider].name}`
                  }
                </p>
              </div>

              {/* Speed */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Velocidad</Label>
                  <span className="text-sm text-muted-foreground">{ttsConfig.speed.toFixed(1)}x</span>
                </div>
                <Slider
                  value={[ttsConfig.speed]}
                  min={0.25}
                  max={isOmniVoice ? 4.0 : 2.0}
                  step={0.1}
                  onValueChange={([value]) => updateTtsConfig({ speed: value })}
                />
              </div>

              {/* Response Format */}
              <div className="space-y-2">
                <Label>Formato de Audio</Label>
                <Select
                  value={ttsConfig.responseFormat}
                  onValueChange={(value: 'mp3' | 'wav' | 'ogg' | 'flac') =>
                    updateTtsConfig({ responseFormat: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mp3">MP3</SelectItem>
                    <SelectItem value="wav">WAV</SelectItem>
                    <SelectItem value="ogg">OGG</SelectItem>
                    <SelectItem value="flac">FLAC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* OmniVoice-specific: Voice Design */}
          {isOmniVoice && (
            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  OmniVoice — Voice Design
                </CardTitle>
                <CardDescription>
                  Crea voces desde una descripción de texto (solo OmniVoice)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Voice Design Description */}
                <div className="space-y-2">
                  <Label>Diseño de Voz</Label>
                  <Input
                    value={ttsConfig.voiceDesign || ''}
                    onChange={(e) => updateTtsConfig({ voiceDesign: e.target.value })}
                    placeholder="Ej: mujer joven, tono cálido, acento latino"
                  />
                  <p className="text-xs text-muted-foreground">
                    Describe la voz que quieres generar. Ej: "young female, warm tone", "hombre mayor, voz profunda"
                  </p>
                </div>

                {/* Style Instruction */}
                <div className="space-y-2">
                  <Label>Instrucción de Estilo</Label>
                  <Input
                    value={ttsConfig.instruct || ''}
                    onChange={(e) => updateTtsConfig({ instruct: e.target.value })}
                    placeholder="Ej: habla lentamente, con emoción"
                  />
                  <p className="text-xs text-muted-foreground">
                    Instrucciones para el estilo de habla. Ej: "speak slowly", "whisper", "excited"
                  </p>
                </div>

                {/* OmniVoice Info */}
                <div className="text-xs bg-muted/50 p-3 rounded border space-y-2">
                  <p className="font-medium text-amber-600 dark:text-amber-400">✨ Características OmniVoice</p>
                  <div className="space-y-1 text-muted-foreground">
                    <p>• <strong>646+ idiomas</strong> — Mayor soporte de idiomas que cualquier otro TTS</p>
                    <p>• <strong>Voice Design</strong> — Crea voces desde descripción de texto</p>
                    <p>• <strong>6+ motores</strong> — OmniVoice, CosyVoice, VoxCPM2, GPT-SoVITS, etc.</p>
                    <p>• <strong>Clonación zero-shot</strong> — Desde 3 segundos de audio</p>
                    <p>• <strong>100% local</strong> — Sin API keys, sin cloud</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Advanced TTS Parameters - Collapsible */}
          <Card>
            <Collapsible>
              <CardHeader className="pb-0">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-sm">Parámetros Avanzados</CardTitle>
                    <CardDescription>
                      {isOmniVoice 
                        ? 'Parámetros adicionales para OmniVoice' 
                        : 'Controla la expresividad y variabilidad de la voz (Chatterbox)'}
                    </CardDescription>
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 shrink-0">
                      <ChevronDown className="w-3.5 h-3.5 transition-transform [[data-state=open]>rotate-180]" />
                      Ajustes
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="space-y-4 pt-4">
                  {/* Exaggeration - TTS-WebUI only */}
                  {!isOmniVoice && (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>Exageración</Label>
                        <span className="text-sm text-muted-foreground">{ttsConfig.exaggeration.toFixed(2)}</span>
                      </div>
                      <Slider
                        value={[ttsConfig.exaggeration]}
                        min={0}
                        max={1}
                        step={0.05}
                        onValueChange={([value]) => updateTtsConfig({ exaggeration: value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Controla la expresividad de la voz (0 = neutral, 1 = muy expresivo)
                      </p>
                    </div>
                  )}

                  {/* CFG Weight - TTS-WebUI only */}
                  {!isOmniVoice && (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>Peso CFG</Label>
                        <span className="text-sm text-muted-foreground">{ttsConfig.cfgWeight.toFixed(2)}</span>
                      </div>
                      <Slider
                        value={[ttsConfig.cfgWeight]}
                        min={0}
                        max={1}
                        step={0.05}
                        onValueChange={([value]) => updateTtsConfig({ cfgWeight: value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Guía de flujo libre del clasificador (mayor = más adherencia al texto)
                      </p>
                    </div>
                  )}

                  {/* Temperature */}
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Temperatura</Label>
                      <span className="text-sm text-muted-foreground">{ttsConfig.temperature.toFixed(2)}</span>
                    </div>
                    <Slider
                      value={[ttsConfig.temperature]}
                      min={0.1}
                      max={2}
                      step={0.1}
                      onValueChange={([value]) => updateTtsConfig({ temperature: value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Variabilidad de la muestra (menor = más consistente, mayor = más variado)
                    </p>
                  </div>

                  {/* OmniVoice note for advanced params */}
                  {isOmniVoice && (
                    <div className="text-xs bg-muted/50 p-2 rounded border">
                      <p className="text-muted-foreground">
                        💡 OmniVoice no soporta Exageración ni Peso CFG. Usa "Diseño de Voz" e "Instrucción de Estilo" en su lugar para controlar la expresividad.
                      </p>
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Test TTS */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Probar TTS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder="Texto a sintetizar..."
                className="w-full h-24 p-3 text-sm rounded-md border resize-none bg-background"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleTestTTS}
                  disabled={isLoading || isPlaying || !testText.trim()}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  {isLoading ? 'Generando...' : 'Probar'}
                </Button>
                {isPlaying && (
                  <Button variant="destructive" onClick={handleStopPlayback}>
                    <Square className="w-4 h-4 mr-2" />
                    Detener
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* KWS Tab - Wake Word Detection (Alexa-style) */}
        <TabsContent value="kws" className="space-y-4 mt-4">
          {/* KWS Info Banner */}
          <Card className="border-2 border-green-500/30 bg-green-500/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Radio className="w-5 h-5 text-green-500" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-green-600 dark:text-green-400">
                    Activación por Voz - Estilo Alexa
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Di el nombre del personaje + tu mensaje + silencio. El mensaje se envía automáticamente.
                    Funciona 100% en el navegador con Web Speech API (Chrome/Edge).
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Ear className="w-4 h-4" />
                Configuración de Voz
              </CardTitle>
              <CardDescription>
                Configura cómo funciona la activación por voz
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Language */}
              <div className="space-y-2">
                <Label>Idioma de Reconocimiento</Label>
                <Select
                  value={kwsConfig.language || 'es-ES'}
                  onValueChange={(value) => updateKwsConfig({ language: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar idioma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es-ES">Español (España)</SelectItem>
                    <SelectItem value="es-MX">Español (México)</SelectItem>
                    <SelectItem value="en-US">English (US)</SelectItem>
                    <SelectItem value="en-GB">English (UK)</SelectItem>
                    <SelectItem value="ja-JP">日本語</SelectItem>
                    <SelectItem value="zh-CN">中文</SelectItem>
                    <SelectItem value="ko-KR">한국어</SelectItem>
                    <SelectItem value="fr-FR">Français</SelectItem>
                    <SelectItem value="de-DE">Deutsch</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Idioma para el reconocimiento de voz
                </p>
              </div>

              {/* Silence Duration */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Tiempo de Silencio para Enviar</Label>
                  <span className="text-sm text-muted-foreground">{vadConfig.silenceDurationMs}ms</span>
                </div>
                <Slider
                  value={[vadConfig.silenceDurationMs]}
                  min={500}
                  max={3000}
                  step={100}
                  onValueChange={([value]) => updateVadConfig({ silenceDurationMs: value })}
                />
                <p className="text-xs text-muted-foreground">
                  Cuánto tiempo de silencio esperar antes de enviar el mensaje (recomendado: 1500ms)
                </p>
              </div>

              {/* Sensitivity */}
              <div className="space-y-2">
                <Label>Sensibilidad de Detección</Label>
                <Select
                  value={kwsConfig.sensitivity}
                  onValueChange={(value: 'low' | 'medium' | 'high') => 
                    updateKwsConfig({ sensitivity: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">
                      <div className="flex flex-col">
                        <span>Baja</span>
                        <span className="text-xs text-muted-foreground">Menos falsos positivos</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="medium">
                      <div className="flex flex-col">
                        <span>Media ⭐ Recomendado</span>
                        <span className="text-xs text-muted-foreground">Balance</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="high">
                      <div className="flex flex-col">
                        <span>Alta</span>
                        <span className="text-xs text-muted-foreground">Más sensible</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Cooldown */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Tiempo entre Mensajes</Label>
                  <span className="text-sm text-muted-foreground">{kwsConfig.cooldownMs}ms</span>
                </div>
                <Slider
                  value={[kwsConfig.cooldownMs]}
                  min={1000}
                  max={10000}
                  step={500}
                  onValueChange={([value]) => updateKwsConfig({ cooldownMs: value })}
                />
                <p className="text-xs text-muted-foreground">
                  Tiempo mínimo entre mensajes para evitar envíos accidentales
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Custom Wake Words */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Palabras de Activación
              </CardTitle>
              <CardDescription>
                Palabras que activan la captura del mensaje. El nombre del personaje actual siempre está incluido.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Palabras Configuradas</Label>
                <div className="flex flex-wrap gap-2">
                  {kwsConfig.wakeWords.length > 0 ? (
                    kwsConfig.wakeWords.map((word, index) => (
                      <div 
                        key={index}
                        className="flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs"
                      >
                        <span>{word}</span>
                        <button
                          onClick={() => {
                            const newWords = kwsConfig.wakeWords.filter((_, i) => i !== index);
                            updateKwsConfig({ wakeWords: newWords });
                          }}
                          className="ml-1 hover:text-red-400"
                        >
                          ×
                        </button>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Solo se usará el nombre del personaje activo
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Nueva palabra (ej: hey, oye, orden)"
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const input = e.target as HTMLInputElement;
                      const word = input.value.trim().toLowerCase();
                      if (word && !kwsConfig.wakeWords.includes(word)) {
                        updateKwsConfig({ wakeWords: [...kwsConfig.wakeWords, word] });
                        input.value = '';
                      }
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                    const word = input.value.trim().toLowerCase();
                    if (word && !kwsConfig.wakeWords.includes(word)) {
                      updateKwsConfig({ wakeWords: [...kwsConfig.wakeWords, word] });
                      input.value = '';
                    }
                  }}
                >
                  Agregar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Presiona Enter o clic en Agregar. Estas palabras + el nombre del personaje activarán la captura.
              </p>
            </CardContent>
          </Card>

          {/* How it works */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">¿Cómo Funciona?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center text-[10px] font-bold">1</span>
                <p><strong>Activa el botón 🎧</strong> - Haz clic en el botón Ear junto al micrófono en el chat.</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center text-[10px] font-bold">2</span>
                <p><strong>Di el nombre + mensaje</strong> - Ejemplo: "Luna, ¿cómo estás hoy?" o "Hey Luna, cuéntame un chiste".</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center text-[10px] font-bold">3</span>
                <p><strong>Espera el silencio</strong> - Deja de hablar y el mensaje se enviará automáticamente.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Voices Tab */}
        <TabsContent value="voices" className="space-y-4 mt-4">
          {/* Load Voices Button */}
          <Button
            variant="outline"
            onClick={() => {
              loadAvailableVoices();
              if (isOmniVoice) {
                loadOmniVoiceProfiles();
                loadOmniVoiceArchetypes();
              }
            }}
            className="w-full"
            disabled={isLoading}
          >
            {isLoading || isLoadingProfiles || isLoadingArchetypes ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Cargar Voces desde {PROVIDER_CONFIGS[ttsConfig.provider].name}
          </Button>

          {/* OMNIVOICE: Profiles + Archetypes */}
          {isOmniVoice && (
            <>
              {/* Voice Profiles Section */}
              <Card className="border-emerald-500/20">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Mic className="w-4 h-4 text-emerald-500" />
                    Perfiles de Voz
                    {omniVoiceProfiles.length > 0 && (
                      <span className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                        {omniVoiceProfiles.length}
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Perfiles de voz creados en OmniVoice Studio con audio de referencia y diseño
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingProfiles ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                      <span className="ml-2 text-sm text-muted-foreground">Cargando perfiles...</span>
                    </div>
                  ) : omniVoiceProfiles.length > 0 ? (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {omniVoiceProfiles.map((profile) => (
                        <div
                          key={profile.id}
                          className={cn(
                            'flex items-center justify-between p-3 rounded-lg border',
                            ttsConfig.defaultVoice === profile.id
                              ? 'bg-emerald-500/10 border-emerald-500/30'
                              : 'bg-card hover:bg-muted/50'
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium truncate">{profile.name}</p>
                              {profile.is_demo === 1 && (
                                <span className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">
                                  Demo
                                </span>
                              )}
                              {profile.is_locked === 1 && (
                                <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded">
                                  Bloqueado
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {profile.language && profile.language !== 'Auto' && (
                                <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                  <Globe className="w-3 h-3 inline mr-0.5" />
                                  {profile.language}
                                </span>
                              )}
                              {profile.instruct && (
                                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {profile.instruct}
                                </span>
                              )}
                            </div>
                          </div>
                          <Button
                            variant={ttsConfig.defaultVoice === profile.id ? 'default' : 'outline'}
                            size="sm"
                            className="shrink-0 ml-2"
                            onClick={() => updateTtsConfig({ defaultVoice: profile.id })}
                          >
                            {ttsConfig.defaultVoice === profile.id ? 'Activa' : 'Usar'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <Mic className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No hay perfiles de voz</p>
                      <p className="text-xs mt-1">Crea perfiles en OmniVoice Studio o usa un Arquetipo</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Archetypes Section */}
              <Card className="border-purple-500/20">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-500" />
                    Arquetipos de Voz
                    {omniVoiceArchetypes.length > 0 && (
                      <span className="text-xs bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full">
                        {omniVoiceArchetypes.length}
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Voces pre-diseñadas listas para usar. Selecciona una para crear un perfil automáticamente.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingArchetypes ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                      <span className="ml-2 text-sm text-muted-foreground">Cargando arquetipos...</span>
                    </div>
                  ) : omniVoiceArchetypes.length > 0 ? (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {omniVoiceArchetypes.map((archetype) => (
                        <div
                          key={archetype.id}
                          className="p-3 rounded-lg border bg-card hover:bg-muted/50"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{archetype.name}</p>
                              {archetype.is_featured && (
                                <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded">
                                  Destacado
                                </span>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => applyArchetype(archetype.id, archetype.name)}
                            >
                              <Sparkles className="w-3 h-3 mr-1" />
                              Usar
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {archetype.facets.gender && (
                              <span className="text-[10px] bg-pink-500/10 text-pink-600 dark:text-pink-400 px-1.5 py-0.5 rounded">
                                {archetype.facets.gender}
                              </span>
                            )}
                            {archetype.facets.age && (
                              <span className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">
                                {archetype.facets.age}
                              </span>
                            )}
                            {archetype.facets.pitch && (
                              <span className="text-[10px] bg-green-500/10 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded">
                                {archetype.facets.pitch}
                              </span>
                            )}
                            {archetype.facets.accent && (
                              <span className="text-[10px] bg-orange-500/10 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded">
                                {archetype.facets.accent}
                              </span>
                            )}
                            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                              {archetype.use_case}
                            </span>
                          </div>
                          {archetype.instruct && (
                            <p className="text-xs text-muted-foreground mt-1 italic">
                              {archetype.instruct}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No hay arquetipos disponibles</p>
                      <p className="text-xs mt-1">Inicia OmniVoice Studio para ver los arquetipos</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* System Voices (both providers) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Music className="w-4 h-4" />
                {isOmniVoice ? 'Voces del Sistema' : 'Voces Disponibles'}
              </CardTitle>
              <CardDescription>
                {isOmniVoice
                  ? 'Voces integradas y aliases de OpenAI disponibles en OmniVoice'
                  : `Voces disponibles en ${PROVIDER_CONFIGS[ttsConfig.provider].name}`
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {availableVoices.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {availableVoices.map((voice) => (
                    <div
                      key={voice.id}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-lg border',
                        ttsConfig.defaultVoice === voice.id
                          ? 'bg-primary/10 border-primary/30'
                          : 'bg-card hover:bg-muted/50'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{voice.name}</p>
                          {voice.type === 'profile' && (
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded">
                              Perfil
                            </span>
                          )}
                          {voice.type === 'openai_alias' && (
                            <span className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">
                              OpenAI
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {voice.language && (
                            <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              <Globe className="w-3 h-3 inline mr-1" />
                              {voice.language}
                            </span>
                          )}
                          {voice.description && (
                            <span className="text-xs text-muted-foreground truncate max-w-[250px]">
                              {voice.description}
                            </span>
                          )}
                          {!voice.description && (
                            <span className="text-xs text-muted-foreground">{voice.id}</span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant={ttsConfig.defaultVoice === voice.id ? 'default' : 'outline'}
                        size="sm"
                        className="shrink-0 ml-2"
                        onClick={() => updateTtsConfig({ defaultVoice: voice.id })}
                      >
                        {ttsConfig.defaultVoice === voice.id ? 'Activa' : 'Usar'}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Music className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No hay voces disponibles</p>
                  <p className="text-xs mt-1">
                    Haz clic en "Cargar Voces" para obtener las voces del servidor
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* OmniVoice Engines Info */}
          {isOmniVoice && omniVoiceEngines.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Motores TTS Disponibles
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {omniVoiceEngines.map((engine) => (
                    <div key={engine.id} className="flex items-center justify-between p-2 rounded border bg-card">
                      <div>
                        <p className="text-sm font-medium">{engine.display_name}</p>
                        <p className="text-xs text-muted-foreground">{engine.id}</p>
                      </div>
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full',
                        engine.available
                          ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                          : 'bg-red-500/10 text-red-600 dark:text-red-400'
                      )}>
                        {engine.available ? 'Disponible' : engine.reason}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Voice Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Subir Voz de Referencia
              </CardTitle>
              <CardDescription>
                Sube un archivo de audio para usar como referencia de voz (clonación)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <FileAudio className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  Arrastra un archivo de audio o haz clic para seleccionar
                </p>
                <p className="text-xs text-muted-foreground">
                  Formatos: WAV, MP3, OGG (máx. 10MB, 5-30 seg recomendado)
                </p>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    const formData = new FormData();
                    formData.append('voice', file);

                    try {
                      const response = await fetch('/api/tts/voices', {
                        method: 'POST',
                        body: formData,
                      });
                      const data = await response.json();
                      if (data.success) {
                        updateTtsConfig({ defaultVoice: data.voice.id });
                        loadAvailableVoices();
                      }
                    } catch (error) {
                      console.error('Failed to upload voice:', error);
                    }
                  }}
                  className="hidden"
                  id="voice-upload"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => document.getElementById('voice-upload')?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Seleccionar Archivo
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
