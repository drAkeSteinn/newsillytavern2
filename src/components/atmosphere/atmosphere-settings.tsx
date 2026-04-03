'use client';

import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Cloud,
  CloudRain,
  CloudSnow,
  CloudFog,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Zap,
  Settings2,
  Sparkles,
} from 'lucide-react';
import { AtmospherePresets } from './atmosphere-presets';

// ============================================
// Atmosphere Settings Panel
// ============================================

interface AtmosphereSettingsProps {
  className?: string;
}

export function AtmosphereSettings({ className }: AtmosphereSettingsProps) {
  const {
    atmosphereSettings,
    setAtmosphereSettings,
    atmosphereGlobalIntensity,
    setAtmosphereGlobalIntensity,
    atmosphereAudioEnabled,
    setAtmosphereAudioEnabled,
    activeAtmosphereLayers,
    activeAtmospherePresetId,
  } = useTavernStore();
  
  const activeLayerCount = activeAtmosphereLayers.length;
  
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Presets Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Presets de Atmósfera
          </CardTitle>
          <CardDescription>
            Selecciona una configuración predefinida de efectos atmosféricos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AtmospherePresets />
        </CardContent>
      </Card>
      
      {/* Active Layers */}
      {activeLayerCount > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Capas Activas</span>
              <Badge variant="secondary">{activeLayerCount}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {activeAtmosphereLayers.map(layer => (
                <Badge
                  key={layer.id}
                  variant="outline"
                  className="flex items-center gap-1"
                >
                  {getLayerIcon(layer.category)}
                  {layer.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* General Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Configuración General
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Efectos de Atmósfera</Label>
              <p className="text-sm text-muted-foreground">
                Activa los efectos atmosféricos en el chat
              </p>
            </div>
            <Switch
              checked={atmosphereSettings.enabled}
              onCheckedChange={(checked) => 
                setAtmosphereSettings({ enabled: checked })
              }
            />
          </div>
          
          <Separator />
          
          {/* Auto Detect */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Detección Automática</Label>
              <p className="text-sm text-muted-foreground">
                Detecta clima/atmósfera en los mensajes
              </p>
            </div>
            <Switch
              checked={atmosphereSettings.autoDetect}
              onCheckedChange={(checked) => 
                setAtmosphereSettings({ autoDetect: checked })
              }
            />
          </div>
          
          {/* Realtime Detection */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Detección en Tiempo Real</Label>
              <p className="text-sm text-muted-foreground">
                Detecta durante el streaming de mensajes
              </p>
            </div>
            <Switch
              checked={atmosphereSettings.realtimeEnabled}
              onCheckedChange={(checked) => 
                setAtmosphereSettings({ realtimeEnabled: checked })
              }
            />
          </div>
          
          <Separator />
          
          {/* Global Intensity */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Intensidad Global</Label>
              <span className="text-sm text-muted-foreground">
                {Math.round(atmosphereGlobalIntensity * 100)}%
              </span>
            </div>
            <Slider
              value={[atmosphereGlobalIntensity]}
              onValueChange={([value]) => setAtmosphereGlobalIntensity(value)}
              min={0}
              max={1}
              step={0.05}
            />
          </div>
          
          {/* Global Volume */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                {atmosphereAudioEnabled ? (
                  <Volume2 className="w-4 h-4" />
                ) : (
                  <VolumeX className="w-4 h-4" />
                )}
                <Label>Audio Atmosférico</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Sonidos ambiente como lluvia, viento, etc.
              </p>
            </div>
            <Switch
              checked={atmosphereAudioEnabled}
              onCheckedChange={setAtmosphereAudioEnabled}
            />
          </div>
          
          {atmosphereAudioEnabled && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Volumen</Label>
                <span className="text-sm text-muted-foreground">
                  {Math.round(atmosphereSettings.globalVolume * 100)}%
                </span>
              </div>
              <Slider
                value={[atmosphereSettings.globalVolume]}
                onValueChange={([value]) => 
                  setAtmosphereSettings({ globalVolume: value })
                }
                min={0}
                max={1}
                step={0.05}
              />
            </div>
          )}
          
          <Separator />
          
          {/* Performance Mode */}
          <div className="space-y-3">
            <Label>Modo de Rendimiento</Label>
            <Select
              value={atmosphereSettings.performanceMode}
              onValueChange={(value) => 
                setAtmosphereSettings({ 
                  performanceMode: value as 'quality' | 'balanced' | 'performance' 
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quality">
                  <div className="flex flex-col items-start">
                    <span>Calidad</span>
                    <span className="text-xs text-muted-foreground">
                      Más partículas, mejor visualización
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="balanced">
                  <div className="flex flex-col items-start">
                    <span>Equilibrado</span>
                    <span className="text-xs text-muted-foreground">
                      Balance entre rendimiento y calidad
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="performance">
                  <div className="flex flex-col items-start">
                    <span>Rendimiento</span>
                    <span className="text-xs text-muted-foreground">
                      Menos partículas, mejor rendimiento
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper to get icon for layer category
function getLayerIcon(category: string) {
  switch (category) {
    case 'precipitation':
      return <CloudRain className="w-3 h-3" />;
    case 'particles':
      return <Sparkles className="w-3 h-3" />;
    case 'fog':
      return <CloudFog className="w-3 h-3" />;
    case 'light':
      return <Sun className="w-3 h-3" />;
    case 'overlay':
      return <Cloud className="w-3 h-3" />;
    default:
      return null;
  }
}

export default AtmosphereSettings;
