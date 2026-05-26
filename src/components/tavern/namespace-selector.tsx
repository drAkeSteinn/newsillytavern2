'use client';

/**
 * NamespaceSelector Component
 *
 * Multi-select dropdown for selecting embedding namespaces for a character or group.
 * Fetches available namespaces from the embeddings API.
 *
 * Only shows CONTEXT namespaces (manually created for specialized knowledge).
 * Session/auto namespaces (memory-character-*, character-*, world, etc.) are
 * automatically included by the RAG strategy and are hidden from selection.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Database, X, Check, Loader2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface NamespaceInfo {
  namespace: string;
  description?: string;
  metadata?: Record<string, unknown>;
  embedding_count: number;
  isSessionNamespace?: boolean;
  sessionReason?: 'always_included' | 'auto_created' | 'auto_pattern';
}

interface NamespaceSelectorProps {
  value: string[] | undefined;
  onChange: (namespaces: string[]) => void;
  placeholder?: string;
}

export function NamespaceSelector({
  value = [],
  onChange,
  placeholder = 'Solo namespaces automáticos',
}: NamespaceSelectorProps) {
  const [namespaces, setNamespaces] = useState<NamespaceInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [dbAvailable, setDbAvailable] = useState(true);

  const fetchNamespaces = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/embeddings/namespaces');
      const data = await res.json();
      if (data.success && data.data) {
        setNamespaces(data.data.namespaces || []);
        setDbAvailable(data.data.dbAvailable);
      }
    } catch {
      setDbAvailable(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNamespaces();
  }, [fetchNamespaces]);

  const handleToggle = (namespace: string) => {
    const newValue = value.includes(namespace)
      ? value.filter(n => n !== namespace)
      : [...value, namespace];
    onChange(newValue);
  };

  const handleRemove = (namespace: string) => {
    onChange(value.filter(n => n !== namespace));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  // Deduplicate namespaces by name — keeps the entry with the highest
  // embedding_count when duplicates exist (defence-in-depth for a backend
  // race condition in upsertNamespace that can produce duplicate rows).
  const dedupedNamespaces = useMemo(() => {
    const map = new Map<string, NamespaceInfo>();
    for (const ns of namespaces) {
      const existing = map.get(ns.namespace);
      if (!existing || ns.embedding_count >= existing.embedding_count) {
        map.set(ns.namespace, ns);
      }
    }
    return Array.from(map.values());
  }, [namespaces]);

  // Split into context namespaces (selectable) and session namespaces (auto-included)
  const contextNamespaces = useMemo(
    () => dedupedNamespaces.filter(ns => !ns.isSessionNamespace),
    [dedupedNamespaces]
  );

  const selectedNamespaces = useMemo(
    () => contextNamespaces.filter(n => value.includes(n.namespace)),
    [contextNamespaces, value]
  );

  const availableToSelect = useMemo(
    () => contextNamespaces.filter(n => !value.includes(n.namespace)),
    [contextNamespaces, value]
  );

  const hasContextNamespaces = contextNamespaces.length > 0;

  return (
    <div className="space-y-2">
      {/* Selected namespaces display */}
      {selectedNamespaces.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedNamespaces.map((ns) => (
            <Badge
              key={ns.namespace}
              variant="secondary"
              className="gap-1 pr-1 text-xs bg-violet-500/20 text-violet-600 dark:text-violet-400 border-violet-500/30"
            >
              <Database className="w-3 h-3" />
              {ns.namespace}
              <span className="text-muted-foreground">({ns.embedding_count})</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => handleRemove(ns.namespace)}
              >
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          ))}
          {selectedNamespaces.length > 1 && (
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
              <Database className="w-4 h-4" />
              <span>
                {selectedNamespaces.length > 0
                  ? `${selectedNamespaces.length} colección${selectedNamespaces.length > 1 ? 'es' : ''} de contexto`
                  : placeholder
                }
              </span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {loading ? (
            <div className="px-2 py-3 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando namespaces...
            </div>
          ) : !dbAvailable ? (
            <div className="px-2 py-3 text-center text-sm text-muted-foreground">
              Base de datos de embeddings no disponible.
              <br />
              Configura Ollama en Embeddings primero.
            </div>
          ) : !hasContextNamespaces ? (
            <div className="px-3 py-3 text-center text-sm text-muted-foreground space-y-1">
              <Info className="w-5 h-5 mx-auto text-muted-foreground/50" />
              <p>No hay colecciones de contexto disponibles.</p>
              <p className="text-xs">
                Los namespaces de sesión y personaje se incluyen automáticamente.
                <br />
                Crea un namespace personalizado en{' '}
                <span className="font-medium">Configuración → Embeddings</span> para
                agregar contexto especializado.
              </p>
            </div>
          ) : (
            <div className="max-h-[300px] overflow-y-auto">
              {/* Info banner at top */}
              <div className="px-2 py-1.5 border-b bg-muted/30">
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Solo se muestran colecciones de contexto. Los namespaces de sesión y personaje se incluyen automáticamente.
                </p>
              </div>

              {/* Available namespaces (not yet selected) */}
              {availableToSelect.length > 0 && (
                <div className="px-2 py-1">
                  <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
                    <Database className="w-3 h-3" />
                    Colecciones disponibles
                  </div>
                  {availableToSelect.map((ns) => (
                    <NamespaceOption
                      key={ns.namespace}
                      ns={ns}
                      isSelected={false}
                      onToggle={() => handleToggle(ns.namespace)}
                    />
                  ))}
                </div>
              )}

              {/* Already selected (shown at bottom for reference) */}
              {selectedNamespaces.length > 0 && availableToSelect.length > 0 && (
                <div className="border-t my-1" />
              )}

              {selectedNamespaces.length > 0 && (
                <div className="px-2 py-1">
                  <div className="flex items-center gap-1 text-xs font-medium text-violet-600 dark:text-violet-400 mb-1">
                    <Check className="w-3 h-3" />
                    Seleccionados
                  </div>
                  {selectedNamespaces.map((ns) => (
                    <NamespaceOption
                      key={ns.namespace}
                      ns={ns}
                      isSelected={true}
                      onToggle={() => handleToggle(ns.namespace)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </SelectContent>
      </Select>

      {/* Info text */}
      {selectedNamespaces.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Estas colecciones se añadirán a los namespaces automáticos de la sesión y del personaje al chatear.
        </p>
      )}
      {selectedNamespaces.length === 0 && dbAvailable && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="text-xs text-muted-foreground cursor-help underline decoration-dotted underline-offset-2">
                Sin seleccionar — se usarán solo los namespaces automáticos (sesión + personaje + mundo).
              </p>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>Los namespaces automáticos incluyen:</p>
              <ul className="text-xs mt-1 space-y-0.5 list-disc list-inside">
                <li><code className="text-[10px]">memory-character-*</code> — Memorias de sesión</li>
                <li><code className="text-[10px]">character-*</code> — Lore del personaje</li>
                <li><code className="text-[10px]">world</code>, <code className="text-[10px]">world-building</code> — Mundo global</li>
              </ul>
              <p className="text-xs mt-1">Crea namespaces personalizados para agregar contexto especializado.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

// ============================================
// Namespace Option Component
// ============================================

interface NamespaceOptionProps {
  ns: NamespaceInfo;
  isSelected: boolean;
  onToggle: () => void;
}

function NamespaceOption({ ns, isSelected, onToggle }: NamespaceOptionProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer",
        "hover:bg-muted/50 transition-colors",
        isSelected && "bg-violet-500/5"
      )}
      onClick={onToggle}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={onToggle}
        className="pointer-events-none"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="truncate text-sm font-medium">{ns.namespace}</span>
        </div>
        {ns.description && (
          <p className="text-xs text-muted-foreground truncate ml-5.5">
            {ns.description}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] px-1.5 h-4",
            ns.embedding_count > 0
              ? "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20"
              : "text-muted-foreground"
          )}
        >
          {ns.embedding_count}
        </Badge>
        {isSelected && (
          <Check className="w-4 h-4 text-violet-600 dark:text-violet-400" />
        )}
      </div>
    </div>
  );
}

export default NamespaceSelector;
