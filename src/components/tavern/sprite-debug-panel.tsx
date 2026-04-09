'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Bug, Play, Trash2, Search, Key, Hash, Brackets } from 'lucide-react';
import {
  extractPipeTokens,
  extractWordTokens,
  extractHudTokens,
  buildTokenSet,
} from '@/hooks/use-sprite-triggers';

interface DetectedToken {
  token: string;
  type: 'pipe' | 'word' | 'hud';
  position: number;
}

interface DebugPanelProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function SpriteDebugPanel({ isOpen = true, onClose }: DebugPanelProps) {
  const [text, setText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'pipe' | 'word' | 'hud'>('all');

  // Analyze text for tokens using useMemo to avoid setState in effect
  const detectedTokens = useMemo(() => {
    const tokens: DetectedToken[] = [];

    // Extract pipe tokens with positions
    const pipeRegex = /\|([^\n]{1,80}?)\|/g;
    let match;
    while ((match = pipeRegex.exec(text)) !== null) {
      if (match[1]) {
        tokens.push({
          token: match[1],
          type: 'pipe',
          position: match.index,
        });
      }
    }

    // Extract HUD tokens with positions
    const hudRegex = /\[([^\]]{1,400})\]/g;
    while ((match = hudRegex.exec(text)) !== null) {
      const inside = match[1];
      if (inside) {
        for (const part of inside.split('|')) {
          const p = part.trim();
          if (p) {
            tokens.push({
              token: p,
              type: 'hud',
              position: match.index,
            });
          }
        }
      }
    }

    // Extract word tokens
    const plainText = text.replace(/\|[^\n]{1,80}?\|/g, ' ').replace(/\[[^\]]{1,400}\]/g, ' ');
    const wordRegex = /[\p{L}\p{N}_-]{2,40}/gu;
    while ((match = wordRegex.exec(plainText)) !== null) {
      if (match[0]) {
        tokens.push({
          token: match[0],
          type: 'word',
          position: match.index,
        });
      }
    }

    // Sort by position
    tokens.sort((a, b) => a.position - b.position);
    return tokens;
  }, [text]);

  // Filter tokens
  const filteredTokens = useMemo(() => 
    detectedTokens.filter(t => filterType === 'all' || t.type === filterType),
    [detectedTokens, filterType]
  );

  // Get token set for matching
  const tokenSet = useMemo(() => buildTokenSet(
    {
      pipeTokens: detectedTokens.filter(t => t.type === 'pipe').map(t => t.token),
      wordTokens: detectedTokens.filter(t => t.type === 'word').map(t => t.token),
      hudTokens: detectedTokens.filter(t => t.type === 'hud').map(t => t.token),
    },
    caseSensitive
  ), [detectedTokens, caseSensitive]);

  // Test keyword matching
  const [testKeyword, setTestKeyword] = useState('');
  const [keywordMatch, setKeywordMatch] = useState<boolean | null>(null);

  const testKeywordMatch = () => {
    if (!testKeyword.trim()) return;
    const needle = caseSensitive ? testKeyword : testKeyword.toLowerCase();
    setKeywordMatch(tokenSet.has(needle));
  };

  if (!isOpen) return null;

  return (
    <div className="bg-card border rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Panel de Depuración de Sprites</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {detectedTokens.length} tokens
          </Badge>
          {onClose && (
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
              ×
            </Button>
          )}
        </div>
      </div>

      {/* Input */}
      <div>
        <Label className="text-xs">Texto a analizar</Label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe texto con |pipes|, [HUD] tokens, y palabras..."
          className="mt-1 w-full h-20 px-3 py-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Options */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={caseSensitive}
            onChange={(e) => setCaseSensitive(e.target.checked)}
            className="rounded"
          />
          Distinguir mayúsculas
        </label>

        <div className="flex gap-1">
          {(['all', 'pipe', 'word', 'hud'] as const).map((type) => (
            <Button
              key={type}
              variant={filterType === type ? 'default' : 'outline'}
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => setFilterType(type)}
            >
              {type === 'pipe' && <Hash className="w-3 h-3 mr-1" />}
              {type === 'word' && <Key className="w-3 h-3 mr-1" />}
              {type === 'hud' && <Brackets className="w-3 h-3 mr-1" />}
              {type}
            </Button>
          ))}
        </div>
      </div>

      {/* Token List */}
      <ScrollArea className="h-[150px] border rounded-lg">
        {filteredTokens.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No hay tokens detectados
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredTokens.map((token, index) => (
              <div
                key={`${token.token}-${index}`}
                className={cn(
                  "flex items-center gap-2 px-2 py-1 rounded text-xs",
                  token.type === 'pipe' && "bg-purple-500/10 text-purple-600",
                  token.type === 'word' && "bg-blue-500/10 text-blue-600",
                  token.type === 'hud' && "bg-green-500/10 text-green-600"
                )}
              >
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                  {token.type}
                </Badge>
                <span className="font-mono">{token.token}</span>
                <span className="text-muted-foreground ml-auto">
                  @{token.position}
                </span>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Keyword Test */}
      <div className="border-t pt-3">
        <Label className="text-xs">Probar Keyword</Label>
        <div className="flex gap-2 mt-1">
          <Input
            value={testKeyword}
            onChange={(e) => {
              setTestKeyword(e.target.value);
              setKeywordMatch(null);
            }}
            placeholder="Keyword a probar..."
            className="h-8"
            onKeyDown={(e) => e.key === 'Enter' && testKeywordMatch()}
          />
          <Button size="sm" className="h-8" onClick={testKeywordMatch}>
            <Search className="w-3.5 h-3.5" />
          </Button>
        </div>
        {keywordMatch !== null && (
          <div className={cn(
            "mt-2 text-xs px-2 py-1 rounded",
            keywordMatch ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
          )}>
            {keywordMatch ? '✓ Keyword ENCONTRADA en tokens' : '✗ Keyword NO encontrada'}
          </div>
        )}
      </div>

      {/* Token Set Preview */}
      <div className="border-t pt-3">
        <div className="text-xs text-muted-foreground mb-2">Token Set ({tokenSet.size} únicos)</div>
        <div className="flex flex-wrap gap-1">
          {Array.from(tokenSet).slice(0, 30).map((token) => (
            <Badge key={token} variant="secondary" className="text-[10px] font-mono">
              {token}
            </Badge>
          ))}
          {tokenSet.size > 30 && (
            <Badge variant="outline" className="text-[10px]">
              +{tokenSet.size - 30} más
            </Badge>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => {
            setText('');
            setTestKeyword('');
            setKeywordMatch(null);
          }}
        >
          <Trash2 className="w-3 h-3 mr-1" />
          Limpiar
        </Button>
      </div>
    </div>
  );
}
