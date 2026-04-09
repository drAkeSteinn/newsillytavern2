// ============================================
// TTS Settings Panel - Configure TTS-WebUI integration
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TTSWebUIConfig, ASRConfig, WakeWordConfig, VADConfig } from '@/types';

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

// Available TTS models
const TTS_MODELS = [
  { id: 'multilingual', name: 'Chatterbox Multilingual', description: 'Multi-language TTS with voice cloning' },
  { id: 'chatterbox', name: 'Chatterbox', description: 'English TTS with voice cloning' },
  { id: 'chatterbox-turbo', name: 'Chatterbox Turbo', description: 'Fast TTS (350M params)' },
];

interface VoiceInfo {
  id: string;
  name: string;
  path: string;
  language?: string;
}

interface ServiceStatus {
  status: 'online' | 'offline' | 'checking';
  endpoint: string;
  error?: string;
}

// Default configuration
const DEFAULT_TTS_CONFIG: TTSWebUIConfig = {
  enabled: false,
  autoGeneration: false,
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
};

const DEFAULT_ASR_CONFIG: ASRConfig = {
  enabled: false,
  provider: 'tts-webui',
  model: 'openai/whisper-small', // Recommended for Spanish
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
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testText, setTestText] = useState('Hola, esta es una prueba de voz.');
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Load saved config on mount
  useEffect(() => {
    loadSavedConfig();
  }, []);

  // Check service status when URL changes
  useEffect(() => {
    if (ttsConfig.baseUrl) {
      checkServiceStatus();
      loadAvailableVoices();
    }
  }, [ttsConfig.baseUrl]);

  // Load saved configuration
  const loadSavedConfig = async () => {
    try {
      const response = await fetch('/api/tts/config');
      const data = await response.json();
      if (data.success && data.config) {
        setTtsConfig(data.config.tts);
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
      const response = await fetch(`/api/tts/speech?endpoint=${encodeURIComponent(ttsConfig.baseUrl)}`);
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
  }, [ttsConfig.baseUrl]);

  // Load available voices from TTS-WebUI
  const loadAvailableVoices = async () => {
    try {
      const response = await fetch(`/api/tts/available-voices?endpoint=${encodeURIComponent(ttsConfig.baseUrl)}`);
      const data = await response.json();
      if (data.success && data.voices && data.voices.length > 0) {
        setAvailableVoices(data.voices);
      } else {
        setAvailableVoices([]);
      }
    } catch (error) {
      console.warn('[TTS Settings] Failed to load available voices:', error);
      setAvailableVoices([]);
    }
  };

  // Update TTS config and mark as changed
  const updateTtsConfig = (updates: Partial<TTSWebUIConfig>) => {
    setTtsConfig(prev => ({ ...prev, ...updates }));
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
          provider: 'tts-webui',
          exaggeration: ttsConfig.exaggeration,
          cfg_weight: ttsConfig.cfgWeight,
          temperature: ttsConfig.temperature,
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
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
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
                  TTS-WebUI {serviceStatus.status === 'online' ? 'Conectado' : serviceStatus.status === 'checking' ? 'Verificando...' : 'Desconectado'}
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
                Configura la síntesis de voz usando TTS-WebUI
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

                {/* Generate Narrations */}
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

                {/* Generate Plain Text */}
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

                {/* Example */}
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

              {/* Endpoint */}
              <div className="space-y-2">
                <Label>URL del Servicio</Label>
                <Input
                  value={ttsConfig.baseUrl}
                  onChange={(e) => updateTtsConfig({ baseUrl: e.target.value })}
                  placeholder="http://localhost:7778"
                />
                <p className="text-xs text-muted-foreground">
                  URL base del servidor TTS-WebUI
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
                    {TTS_MODELS.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                        {model.description && (
                          <span className="text-xs text-muted-foreground ml-2">
                            - {model.description}
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Language Selection (for multilingual model) */}
              {ttsConfig.model === 'multilingual' && (
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
                    Selecciona el idioma para el modelo multilingüe
                  </p>
                </div>
              )}

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
                    <SelectItem value="none">Por defecto (sin voz de referencia)</SelectItem>
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
                    : 'Presiona "Actualizar" para cargar las voces desde TTS-WebUI'
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
                  min={0.5}
                  max={2.0}
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

          {/* Advanced TTS Parameters - Collapsible */}
          <Card>
            <Collapsible>
              <CardHeader className="pb-0">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-sm">Parámetros Avanzados</CardTitle>
                    <CardDescription>
                      Controla la expresividad y variabilidad de la voz
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
                  {/* Exaggeration */}
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

                  {/* CFG Weight */}
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

              {/* Silence Duration - Key setting */}
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
              {/* Current wake words */}
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

              {/* Add new wake word */}
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
                <p><strong>Espera el silencio</strong> - Cuando dejes de hablar, el mensaje se envía automáticamente.</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center text-[10px] font-bold">4</span>
                <p><strong>Repite</strong> - El sistema sigue escuchando para el siguiente mensaje.</p>
              </div>
              <div className="p-2 mt-2 rounded border bg-muted/30">
                <p className="text-amber-600 dark:text-amber-400">
                  💡 <strong>Ejemplo completo:</strong> "Luna, ¿qué piensas del clima de hoy?" 
                  → Detecta "Luna" → Captura "¿qué piensas del clima de hoy?" → Silencio → ¡Enviado!
                </p>
              </div>
              <div className="p-2 rounded border bg-blue-500/10 border-blue-500/20">
                <p className="text-blue-400">
                  🎤 <strong>Palabras clave:</strong> El nombre del personaje actual + las palabras que agregues arriba.
                  Por ejemplo: "Luna", "hey", "oye" → "Oye Luna, ven aquí" funcionará.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Voices Tab */}
        <TabsContent value="voices" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Music className="w-4 h-4" />
                Voces Disponibles en TTS-WebUI
              </CardTitle>
              <CardDescription>
                Lista de voces de referencia para clonación de voz
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" onClick={loadAvailableVoices} className="w-full">
                <RefreshCw className="w-4 h-4 mr-2" />
                Actualizar Lista de Voces
              </Button>

              {availableVoices.length > 0 ? (
                <div className="space-y-2">
                  {availableVoices.map((voice) => (
                    <div
                      key={voice.id}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-lg border',
                        ttsConfig.defaultVoice === voice.id && 'border-primary bg-primary/5'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <FileAudio className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{voice.name}</p>
                          <p className="text-xs text-muted-foreground">{voice.id}</p>
                        </div>
                      </div>
                      <Button
                        variant={ttsConfig.defaultVoice === voice.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => updateTtsConfig({ defaultVoice: voice.id })}
                      >
                        {ttsConfig.defaultVoice === voice.id ? 'Seleccionada' : 'Seleccionar'}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileAudio className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No se encontraron voces</p>
                  <p className="text-xs">Asegúrate de que TTS-WebUI esté corriendo</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
