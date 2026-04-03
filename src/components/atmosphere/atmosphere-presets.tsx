'use client';

import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Sun, CloudRain, CloudSnow, Moon, CloudLightning, Leaf, Flame, Cloud } from 'lucide-react';

// ============================================
// Atmosphere Presets Quick Select
// ============================================

interface AtmospherePresetsProps {
  className?: string;
}

export function AtmospherePresets({ className }: AtmospherePresetsProps) {
  const {
    atmospherePresets,
    activeAtmospherePresetId,
    activateAtmospherePreset,
    clearAtmosphereLayers,
  } = useTavernStore();
  
  const handlePresetClick = (presetId: string) => {
    if (presetId === activeAtmospherePresetId) {
      clearAtmosphereLayers();
    } else {
      activateAtmospherePreset(presetId);
    }
  };
  
  return (
    <div className={cn('grid grid-cols-2 sm:grid-cols-3 gap-2', className)}>
      {atmospherePresets.map((preset) => (
        <Button
          key={preset.id}
          variant={activeAtmospherePresetId === preset.id ? 'default' : 'outline'}
          className={cn(
            'h-auto flex flex-col items-center gap-1 py-3 px-2',
            activeAtmospherePresetId === preset.id && 'ring-2 ring-primary ring-offset-2'
          )}
          onClick={() => handlePresetClick(preset.id)}
        >
          <span className="text-2xl">{preset.icon || getIconForPreset(preset.id)}</span>
          <span className="text-xs font-medium">{preset.name}</span>
          {preset.description && (
            <span className="text-[10px] text-muted-foreground text-center line-clamp-2">
              {preset.description}
            </span>
          )}
        </Button>
      ))}
    </div>
  );
}

// Helper to get icon component for preset
function getIconForPreset(presetId: string) {
  switch (presetId) {
    case 'clear':
      return <Sun className="w-6 h-6 text-amber-500" />;
    case 'rainy-day':
      return <CloudRain className="w-6 h-6 text-blue-400" />;
    case 'stormy-night':
      return <CloudLightning className="w-6 h-6 text-purple-500" />;
    case 'snowy-wonderland':
      return <CloudSnow className="w-6 h-6 text-cyan-300" />;
    case 'summer-night':
      return <Moon className="w-6 h-6 text-yellow-400" />;
    case 'autumn-day':
      return <Leaf className="w-6 h-6 text-orange-500" />;
    case 'cozy-fire':
      return <Flame className="w-6 h-6 text-orange-600" />;
    default:
      return <Cloud className="w-6 h-6 text-gray-400" />;
  }
}

// Export compact version for quick access
export function AtmospherePresetsCompact({ className }: AtmospherePresetsProps) {
  const {
    atmospherePresets,
    activeAtmospherePresetId,
    activateAtmospherePreset,
    clearAtmosphereLayers,
  } = useTavernStore();
  
  const handlePresetClick = (presetId: string) => {
    if (presetId === activeAtmospherePresetId) {
      clearAtmosphereLayers();
    } else {
      activateAtmospherePreset(presetId);
    }
  };
  
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {atmospherePresets.map((preset) => (
        <Button
          key={preset.id}
          variant="ghost"
          size="sm"
          className={cn(
            'h-8 w-8 p-0',
            activeAtmospherePresetId === preset.id && 'bg-primary/20 ring-1 ring-primary'
          )}
          onClick={() => handlePresetClick(preset.id)}
          title={preset.name}
        >
          <span className="text-lg">{preset.icon || '🌤️'}</span>
        </Button>
      ))}
    </div>
  );
}

export default AtmospherePresets;
