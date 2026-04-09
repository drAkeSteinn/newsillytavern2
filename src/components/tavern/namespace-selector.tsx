'use client';

/**
 * NamespaceSelector Component
 *
 * Multi-select dropdown for selecting embedding namespaces for a character or group.
 * Fetches available namespaces from the embeddings API.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Database, X, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NamespaceInfo {
  namespace: string;
  description?: string;
  metadata?: Record<string, unknown>;
  embedding_count: number;
}

interface NamespaceSelectorProps {
  value: string[] | undefined;
  onChange: (namespaces: string[]) => void;
  placeholder?: string;
}

export function NamespaceSelector({
  value = [],
  onChange,
  placeholder = 'Usar estrategia global',
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

  const selectedNamespaces = namespaces.filter(n => value.includes(n.namespace));
  const availableToSelect = namespaces.filter(n => !value.includes(n.namespace));

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
                  ? `${selectedNamespaces.length} namespace${selectedNamespaces.length > 1 ? 's' : ''} seleccionado${selectedNamespaces.length > 1 ? 's' : ''}`
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
          ) : namespaces.length === 0 ? (
            <div className="px-2 py-3 text-center text-sm text-muted-foreground">
              No hay namespaces creados.
              <br />
              Crea uno en Configuración → Embeddings → Namespaces
            </div>
          ) : (
            <div className="max-h-[300px] overflow-y-auto">
              {/* Available namespaces (not yet selected) */}
              {availableToSelect.length > 0 && (
                <div className="px-2 py-1">
                  <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
                    <Database className="w-3 h-3" />
                    Namespaces disponibles
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
          Los embeddings se buscarán solo en estos namespaces al chatear con este personaje/grupo.
        </p>
      )}
      {selectedNamespaces.length === 0 && dbAvailable && namespaces.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Sin seleccionar — se usará la estrategia definida en la configuración de embeddings.
        </p>
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
