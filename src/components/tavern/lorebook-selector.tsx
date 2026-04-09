'use client';

/**
 * LorebookSelector Component
 * 
 * Multi-select dropdown for selecting lorebooks for a character or group.
 * Used in the character/group editor.
 */

import { useTavernStore } from '@/store';
import type { Lorebook } from '@/types';
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { BookOpen, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LorebookSelectorProps {
  value: string[] | undefined;
  onChange: (lorebookIds: string[]) => void;
  placeholder?: string;
}

export function LorebookSelector({ value = [], onChange, placeholder = 'Sin lorebooks' }: LorebookSelectorProps) {
  const lorebooks = useTavernStore((state) => state.lorebooks);

  const handleToggle = (lorebookId: string) => {
    const newValue = value.includes(lorebookId)
      ? value.filter(id => id !== lorebookId)
      : [...value, lorebookId];
    onChange(newValue);
  };

  const handleRemove = (lorebookId: string) => {
    onChange(value.filter(id => id !== lorebookId));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  // Get selected lorebooks
  const selectedLorebooks = lorebooks.filter(lb => value.includes(lb.id));
  const activeLorebooks = lorebooks.filter(lb => lb.active);

  return (
    <div className="space-y-2">
      {/* Selected lorebooks display */}
      {selectedLorebooks.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedLorebooks.map((lb) => (
            <Badge
              key={lb.id}
              variant="secondary"
              className="gap-1 pr-1 text-xs"
            >
              <BookOpen className="w-3 h-3" />
              {lb.name}
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => handleRemove(lb.id)}
              >
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          ))}
          {selectedLorebooks.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 text-xs text-muted-foreground"
              onClick={handleClearAll}
            >
              Limpiar
            </Button>
          )}
        </div>
      )}

      {/* Dropdown selector */}
      <Select>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder}>
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              <span>
                {selectedLorebooks.length > 0
                  ? `${selectedLorebooks.length} lorebook${selectedLorebooks.length > 1 ? 's' : ''} seleccionado${selectedLorebooks.length > 1 ? 's' : ''}`
                  : placeholder
                }
              </span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {lorebooks.length === 0 ? (
            <div className="px-2 py-3 text-center text-sm text-muted-foreground">
              No hay lorebooks creados.
              <br />
              Crea uno en Configuración → Lorebooks
            </div>
          ) : (
            <div className="max-h-[200px] overflow-y-auto">
              {lorebooks.map((lb) => (
                <div
                  key={lb.id}
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted/50 rounded cursor-pointer"
                  onClick={() => handleToggle(lb.id)}
                >
                  <Checkbox
                    checked={value.includes(lb.id)}
                    onCheckedChange={() => handleToggle(lb.id)}
                    className="pointer-events-none"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm">{lb.name}</span>
                      {!lb.active && (
                        <Badge variant="outline" className="text-[10px] px-1 h-4">
                          Inactivo
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {lb.entries.length} entrada{lb.entries.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {value.includes(lb.id) && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </div>
              ))}
            </div>
          )}
        </SelectContent>
      </Select>

      {/* Info text */}
      {selectedLorebooks.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Solo los lorebooks activos inyectarán contenido en el prompt.
        </p>
      )}
    </div>
  );
}

export default LorebookSelector;
