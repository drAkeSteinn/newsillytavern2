'use client';

import { useState, useMemo, useCallback } from 'react';
import type { CharacterCard } from '@/types';
import {
  getMigrationStatus,
  migrateCharacterSprites,
  applyMigrationResult,
  type MigrationStatus,
  type MigrationResult,
} from '@/lib/migration/sprite-migration';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Database,
  Zap,
  Package,
  Layers,
  Trash2,
  RefreshCw,
  Info,
} from 'lucide-react';

interface LegacyMigrationPanelProps {
  character: CharacterCard;
  onChange: (updates: Partial<CharacterCard>) => void;
}

export function LegacyMigrationPanel({ character, onChange }: LegacyMigrationPanelProps) {
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [autoMigrate, setAutoMigrate] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const status = useMemo(() => getMigrationStatus(character), [character]);

  const handleMigrate = useCallback(() => {
    setMigrating(true);
    try {
      const result = migrateCharacterSprites(character, {
        defaultPackName: `${character.name || 'Character'} - Migrated`,
        skipIfV2Exists: false, // Allow migration even if V2 exists
      });

      if (result.success) {
        const updates = applyMigrationResult(character, result);
        onChange(updates);
        setMigrationResult(result);
      } else {
        setMigrationResult(result);
      }
    } finally {
      setMigrating(false);
    }
  }, [character, onChange]);

  // Preview what will be created
  const previewResult = useMemo(() => {
    if (!showPreview) return null;
    try {
      return migrateCharacterSprites(character, {
        defaultPackName: `${character.name || 'Character'} - Migrated`,
        skipIfV2Exists: false,
      });
    } catch {
      return null;
    }
  }, [character, showPreview]);

  // Calculate migration progress
  const migrationProgress = useMemo(() => {
    if (!status.hasLegacyData) return 100;
    const total = status.migrationItems.reduce((sum, item) => sum + item.count, 0);
    const migrated = status.hasV2Data ? Math.min(total, 1) : 0; // Simplified
    return total > 0 ? Math.round((migrated / total) * 100) : 0;
  }, [status]);

  // Already fully migrated (no legacy data)
  if (!status.hasLegacyData && status.hasV2Data) {
    return (
      <div className="space-y-4">
        <Alert className="border-emerald-500/30 bg-emerald-500/5">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <AlertTitle className="text-emerald-700 dark:text-emerald-400">
            Sistema V2 Activo
          </AlertTitle>
          <AlertDescription className="text-sm">
            Este personaje ya usa el sistema de sprites V2. No hay datos legacy pendientes de migración.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <Package className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-lg font-semibold">{status.v2Packs}</div>
            <div className="text-xs text-muted-foreground">Packs V2</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <Layers className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-lg font-semibold">{status.v2StateCollections}</div>
            <div className="text-xs text-muted-foreground">Estado V2</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <Zap className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-lg font-semibold">{status.v2Collections}</div>
            <div className="text-xs text-muted-foreground">Triggers V2</div>
          </div>
        </div>
      </div>
    );
  }

  // No data at all
  if (!status.hasLegacyData && !status.hasV2Data) {
    return (
      <Alert className="border-muted bg-muted/20">
        <Info className="h-4 w-4 text-muted-foreground" />
        <AlertTitle>Sin Datos de Sprite</AlertTitle>
        <AlertDescription className="text-sm">
          Este personaje no tiene datos de sprites (ni legacy ni V2). Configura sprites en la pestaña &quot;Sprites&quot;.
        </AlertDescription>
      </Alert>
    );
  }

  // Has legacy data - show migration panel
  return (
    <div className="space-y-4">
      {/* Header alert */}
      <Alert className="border-amber-500/30 bg-amber-500/5">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <AlertTitle className="text-amber-700 dark:text-amber-400">
          Datos Legacy Detectados
        </AlertTitle>
        <AlertDescription className="text-sm">
          Este personaje tiene datos de sprites en formato legacy. Migra al sistema V2 para acceder a las últimas funcionalidades.
        </AlertDescription>
      </Alert>

      {/* Status Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatusCard
          icon={<Database className="w-4 h-4" />}
          label="Sprites Legacy"
          value={status.legacySprites}
          variant="warning"
        />
        <StatusCard
          icon={<Zap className="w-4 h-4" />}
          label="Triggers Legacy"
          value={status.legacyTriggers}
          variant="warning"
        />
        <StatusCard
          icon={<Package className="w-4 h-4" />}
          label="Packs V2"
          value={status.v2Packs}
          variant="success"
        />
        <StatusCard
          icon={<Layers className="w-4 h-4" />}
          label="Estado V2"
          value={status.v2StateCollections}
          variant="success"
        />
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Progreso de Migración</span>
          <span className="font-medium">{migrationProgress}%</span>
        </div>
        <Progress value={migrationProgress} className="h-2" />
      </div>

      {/* Migration Items List */}
      <Accordion type="multiple" defaultValue={['items']} className="w-full">
        <AccordionItem value="items">
          <AccordionTrigger className="text-sm py-2">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-amber-500" />
              <span>Elementos Pendientes ({status.migrationItems.length})</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <ScrollArea className="max-h-64">
              <div className="space-y-2">
                {status.migrationItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-md bg-muted/40 border border-border/50"
                  >
                    <div className="flex items-center gap-2.5">
                      <MigrationItemIcon type={item.type} />
                      <div>
                        <div className="text-sm font-medium">{item.label}</div>
                        <div className="text-xs text-muted-foreground">{item.description}</div>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {item.count}
                    </Badge>
                  </div>
                ))}
                {status.migrationItems.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay elementos pendientes de migración.
                  </p>
                )}
              </div>
            </ScrollArea>
          </AccordionContent>
        </AccordionItem>

        {/* Preview section */}
        <AccordionItem value="preview">
          <AccordionTrigger className="text-sm py-2">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-500" />
              <span>Vista Previa de Migración</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
                className="w-full"
              >
                {showPreview ? 'Ocultar Vista Previa' : 'Generar Vista Previa'}
              </Button>
              {showPreview && previewResult && (
                <div className="p-3 rounded-md bg-muted/40 border border-border/50 space-y-2 text-xs">
                  <div className="font-medium text-sm">Resultado de la migración:</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-muted-foreground">Packs creados:</span>{' '}
                      <span className="font-medium">{previewResult.report.packsCreated}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Triggers migrados:</span>{' '}
                      <span className="font-medium">{previewResult.report.triggersMigrated}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Sprites migrados:</span>{' '}
                      <span className="font-medium">{previewResult.report.spritesMigrated}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Col. de estado:</span>{' '}
                      <span className="font-medium">{previewResult.report.stateCollectionsCreated}</span>
                    </div>
                  </div>
                  {previewResult.warnings.length > 0 && (
                    <div className="mt-2">
                      <div className="font-medium text-amber-600">Advertencias:</div>
                      <ScrollArea className="max-h-24">
                        <ul className="list-disc pl-4 space-y-0.5">
                          {previewResult.warnings.map((w, i) => (
                            <li key={i} className="text-amber-600">{w}</li>
                          ))}
                        </ul>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Auto-migration toggle */}
      <div className="flex items-center gap-3 p-3 rounded-md bg-muted/30 border border-border/50">
        <Switch
          id="auto-migrate"
          checked={autoMigrate}
          onCheckedChange={setAutoMigrate}
        />
        <Label htmlFor="auto-migrate" className="text-sm cursor-pointer">
          Auto-migrar al cargar personaje
        </Label>
      </div>

      {/* Migration result */}
      {migrationResult && (
        <div className={`p-3 rounded-md border ${
          migrationResult.success
            ? 'bg-emerald-500/5 border-emerald-500/30'
            : 'bg-red-500/5 border-red-500/30'
        }`}>
          {migrationResult.success ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span className="font-medium text-sm">Migración Completada</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Packs creados:</span>{' '}
                  <span className="font-medium">{migrationResult.report.packsCreated}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Triggers migrados:</span>{' '}
                  <span className="font-medium">{migrationResult.report.triggersMigrated}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Sprites migrados:</span>{' '}
                  <span className="font-medium">{migrationResult.report.spritesMigrated}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Col. de estado:</span>{' '}
                  <span className="font-medium">{migrationResult.report.stateCollectionsCreated}</span>
                </div>
              </div>
              {migrationResult.warnings.length > 0 && (
                <ScrollArea className="max-h-24">
                  <ul className="text-xs space-y-0.5">
                    {migrationResult.warnings.map((w, i) => (
                      <li key={i} className="text-amber-600">⚠️ {w}</li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-medium text-sm">Error en Migración</span>
              </div>
              <ul className="text-xs space-y-0.5 text-red-600">
                {migrationResult.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          onClick={handleMigrate}
          disabled={migrating || status.migrationItems.length === 0}
          className="flex-1"
        >
          {migrating ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Migrando...
            </>
          ) : (
            <>
              <ArrowRight className="w-4 h-4 mr-2" />
              Migrar a V2
            </>
          )}
        </Button>
        {migrationResult?.success && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMigrationResult(null)}
            title="Limpiar resultado"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Info footer */}
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        La migración preserva los datos V2 existentes. Los datos legacy no se eliminan automáticamente.
        Puedes eliminarlos manualmente después de verificar que la migración fue exitosa.
      </p>
    </div>
  );
}

// ============================================
// Helper Components
// ============================================

function StatusCard({
  icon,
  label,
  value,
  variant,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  variant: 'success' | 'warning' | 'neutral';
}) {
  const colorMap = {
    success: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    neutral: 'text-muted-foreground',
  };

  return (
    <div className="text-center p-2.5 rounded-lg bg-muted/30 border border-border/50">
      <div className={`flex justify-center mb-1 ${colorMap[variant]}`}>{icon}</div>
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function MigrationItemIcon({ type }: { type: string }) {
  switch (type) {
    case 'sprites':
      return <Database className="w-4 h-4 text-amber-500" />;
    case 'triggers':
      return <Zap className="w-4 h-4 text-amber-500" />;
    case 'stateCollections':
      return <Layers className="w-4 h-4 text-amber-500" />;
    case 'configUrls':
      return <Database className="w-4 h-4 text-amber-500" />;
    case 'legacyPacks':
      return <Package className="w-4 h-4 text-orange-500" />;
    default:
      return <Info className="w-4 h-4 text-muted-foreground" />;
  }
}
