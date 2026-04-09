'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Image as ImageIcon, Search, RefreshCw, Check, X } from 'lucide-react';
import type { SpriteIndexEntry, SpriteIndex } from '@/types';

interface SpriteSelectorProps {
  value: string;        // Current sprite label
  urlValue?: string;    // Current sprite URL (for custom)
  onChange: (label: string, url?: string) => void;
  onUrlChange?: (url: string) => void;
  className?: string;
}

export function SpriteSelector({ value, urlValue, onChange, onUrlChange, className }: SpriteSelectorProps) {
  const [spriteIndex, setSpriteIndex] = useState<SpriteIndex | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  // Load sprite index
  const loadSpriteIndex = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/sprites/index');
      if (response.ok) {
        const data = await response.json();
        setSpriteIndex(data);
      }
    } catch (error) {
      console.error('Failed to load sprite index:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSpriteIndex();
  }, []);

  // Filter sprites by search
  const filteredSprites = (spriteIndex?.sprites || []).filter(sprite => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      sprite.label.includes(searchLower) ||
      sprite.pack?.includes(searchLower) ||
      sprite.expressions?.some(e => e.includes(searchLower))
    );
  });

  // Group sprites by pack
  const groupedSprites = filteredSprites.reduce((acc, sprite) => {
    const pack = sprite.pack || 'default';
    if (!acc[pack]) acc[pack] = [];
    acc[pack].push(sprite);
    return acc;
  }, {} as Record<string, SpriteIndexEntry[]>);

  const selectedSprite = spriteIndex?.sprites.find(s => s.label === value);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Current Selection Preview */}
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded border overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
          {selectedSprite ? (
            <img
              src={selectedSprite.url}
              alt={selectedSprite.label}
              className="w-full h-full object-cover"
            />
          ) : urlValue ? (
            <img
              src={urlValue}
              alt="Custom sprite"
              className="w-full h-full object-cover"
            />
          ) : (
            <ImageIcon className="w-6 h-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">
            {selectedSprite?.label || (urlValue ? 'Custom URL' : 'No sprite selected')}
          </div>
          {selectedSprite?.pack && (
            <Badge variant="outline" className="text-xs mt-1">
              {selectedSprite.pack}
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7"
          onClick={loadSpriteIndex}
          disabled={loading}
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar sprites..."
          className="pl-8 h-8"
        />
      </div>

      {/* Toggle between index and custom URL */}
      <div className="flex gap-1">
        <Button
          variant={!showCustom ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs flex-1"
          onClick={() => setShowCustom(false)}
        >
          Índice
        </Button>
        <Button
          variant={showCustom ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs flex-1"
          onClick={() => setShowCustom(true)}
        >
          URL Custom
        </Button>
      </div>

      {/* Sprite Grid or Custom URL Input */}
      {showCustom ? (
        <div className="space-y-2">
          <Label className="text-xs">URL del Sprite</Label>
          <Input
            value={urlValue || ''}
            onChange={(e) => {
              onUrlChange?.(e.target.value);
              onChange('', e.target.value); // Clear label when using custom URL
            }}
            placeholder="https://example.com/sprite.png"
            className="h-8"
          />
          {urlValue && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Preview:</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => {
                  onUrlChange?.('');
                  onChange('');
                }}
              >
                <X className="w-3 h-3 mr-1" />
                Limpiar
              </Button>
            </div>
          )}
        </div>
      ) : (
        <ScrollArea className="h-[200px] border rounded-lg">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredSprites.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
              <ImageIcon className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">No hay sprites</p>
              <p className="text-xs mt-1">Añade sprites a /public/sprites/</p>
            </div>
          ) : (
            <div className="p-2 space-y-3">
              {Object.entries(groupedSprites).map(([pack, sprites]) => (
                <div key={pack}>
                  <div className="text-xs font-medium text-muted-foreground mb-1.5 px-1">
                    {pack} ({sprites.length})
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {sprites.map((sprite) => (
                      <button
                        key={sprite.url}
                        type="button"
                        className={cn(
                          "relative aspect-square rounded border overflow-hidden bg-muted hover:ring-2 ring-primary transition-all",
                          value === sprite.label && "ring-2 ring-primary"
                        )}
                        onClick={() => {
                          onChange(sprite.label, sprite.url);
                          onUrlChange?.(''); // Clear custom URL when selecting from index
                        }}
                        title={sprite.label}
                      >
                        <img
                          src={sprite.url}
                          alt={sprite.label}
                          className="w-full h-full object-cover"
                        />
                        {value === sprite.label && (
                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                            <Check className="w-4 h-4 text-primary-foreground drop-shadow" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      )}

      {/* Clear Button */}
      {(value || urlValue) && !showCustom && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 text-xs"
          onClick={() => {
            onChange('');
            onUrlChange?.('');
          }}
        >
          <X className="w-3 h-3 mr-1" />
          Limpiar selección
        </Button>
      )}
    </div>
  );
}
