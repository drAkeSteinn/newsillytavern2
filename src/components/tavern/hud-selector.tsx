'use client';

/**
 * HUDSelector Component
 * 
 * Dropdown for selecting a HUD template for a character or group.
 * Used in the character/group editor.
 */

import { useTavernStore } from '@/store';
import type { HUDTemplate } from '@/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Layers, X } from 'lucide-react';

interface HUDSelectorProps {
  value: string | null | undefined;
  onChange: (hudTemplateId: string | null) => void;
  placeholder?: string;
}

export function HUDSelector({ value, onChange, placeholder = 'Sin HUD' }: HUDSelectorProps) {
  const hudTemplates = useTavernStore((state) => state.hudTemplates);
  const setActiveHUD = useTavernStore((state) => state.setActiveHUD);
  
  const handleChange = (newValue: string) => {
    if (newValue === 'none') {
      onChange(null);
      setActiveHUD(null);
    } else {
      onChange(newValue);
      setActiveHUD(newValue);
    }
  };
  
  const handleClear = () => {
    onChange(null);
    setActiveHUD(null);
  };
  
  // Get selected template for preview
  const selectedTemplate = hudTemplates.find((t) => t.id === value);
  
  return (
    <div className="flex items-center gap-2">
      <Select value={value || 'none'} onValueChange={handleChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder}>
            {selectedTemplate ? (
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4" />
                <span>{selectedTemplate.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({selectedTemplate.fields.length} campos)
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">
            <span className="text-muted-foreground">{placeholder}</span>
          </SelectItem>
          {hudTemplates.length === 0 ? (
            <div className="px-2 py-3 text-center text-sm text-muted-foreground">
              No hay templates de HUD.
              <br />
              Crea uno en Configuración → HUDs
            </div>
          ) : (
            hudTemplates.map((template) => (
              <SelectItem key={template.id} value={template.id}>
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  <span>{template.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({template.fields.length} campos)
                  </span>
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      
      {value && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClear}
          title="Quitar HUD"
        >
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}

export default HUDSelector;
