'use client';

import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Target,
  Settings2,
  RotateCcw,
  ChevronDown,
  Save,
  Bell,
  Sparkles,
  Info,
  List,
  Cog,
  ScrollText,
  Zap,
  Eye,
  FileText,
  HelpCircle,
  Key,
} from 'lucide-react';
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { DEFAULT_QUEST_SETTINGS } from '@/types';
import { QuestLogPanel } from './quest-log-panel';
import { QuestTemplateManager } from '@/components/settings/quest-template-manager';

export function QuestSettingsPanel() {
  const { questSettings, setQuestSettings, activeSessionId } = useTavernStore();
  const [promptEditorOpen, setPromptEditorOpen] = useState(false);
  
  // Ensure promptTemplate exists with default fallback
  const promptTemplate = questSettings.promptTemplate ?? DEFAULT_QUEST_SETTINGS.promptTemplate ?? '';
  const [localPrompt, setLocalPrompt] = useState(promptTemplate);

  const handlePromptSave = useCallback(() => {
    setQuestSettings({ promptTemplate: localPrompt });
    setPromptEditorOpen(false);
  }, [localPrompt, setQuestSettings]);

  const handleResetPrompt = useCallback(() => {
    const defaultPrompt = DEFAULT_QUEST_SETTINGS.promptTemplate ?? '';
    setLocalPrompt(defaultPrompt);
    setQuestSettings({ promptTemplate: defaultPrompt });
  }, [setQuestSettings]);

  return (
    <div className="h-full flex flex-col p-6">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30">
              <Target className="w-5 h-5 text-amber-500" />
            </div>
            Sistema de Misiones
          </h2>
          <p className="text-muted-foreground text-sm ml-12">
            Configura el seguimiento de objetivos y recompensas en tus sesiones de rol
          </p>
        </div>
        <Badge 
          variant="outline" 
          className={cn(
            "px-3 py-1.5 text-sm font-medium transition-all",
            questSettings.enabled 
              ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30" 
              : "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30"
          )}
        >
          {questSettings.enabled ? (
            <>
              <Zap className="w-3.5 h-3.5 mr-1.5" />
              Activo
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5 mr-1.5" />
              Inactivo
            </>
          )}
        </Badge>
      </div>

      <Tabs defaultValue="templates" className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="templates" className="gap-2">
            <ScrollText className="w-4 h-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="quests" className="gap-2">
            <List className="w-4 h-4" />
            Misiones
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Cog className="w-4 h-4" />
            Config
          </TabsTrigger>
        </TabsList>

        {/* Templates Tab - Quest Template Manager */}
        <TabsContent value="templates" className="flex-1 overflow-hidden m-0 mt-4">
          <QuestTemplateManager />
        </TabsContent>

        {/* Quest Management Tab */}
        <TabsContent value="quests" className="flex-1 overflow-hidden m-0 mt-4">
          {activeSessionId ? (
            <QuestLogPanel 
              sessionId={activeSessionId} 
              className="h-full"
            />
          ) : (
            <Card className="border-dashed border-2 bg-gradient-to-br from-muted/50 to-muted/30 h-full">
              <CardContent className="flex flex-col items-center justify-center h-full py-16">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 mb-4">
                  <Target className="w-12 h-12 text-amber-400" />
                </div>
                <h3 className="text-lg font-medium mb-2">Sin sesión activa</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  Selecciona o crea una sesión de chat para gestionar las misiones.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="flex-1 overflow-y-auto m-0 mt-4">
          <div className="space-y-6 pr-2">
            {/* Banner informativo */}
            <div className="rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-500/20 p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20">
                  <Info className="w-4 h-4 text-amber-500" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    Sistema de Misiones
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Las misiones pueden activarse automáticamente por palabras clave, turnos, o manualmente.
                    Los objetivos se detectan en el chat y otorgan recompensas al completarse.
                  </p>
                </div>
              </div>
            </div>

            {/* Main Enable/Disable */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <div className="p-1.5 rounded-md bg-amber-500/10">
                  <Target className="w-4 h-4 text-amber-500" />
                </div>
                Estado del Sistema
              </div>
              
              <div className="pl-8">
                <Card className={cn(
                  "transition-all duration-300 overflow-hidden",
                  questSettings.enabled 
                    ? "border-green-500/30 bg-gradient-to-br from-green-500/5 to-emerald-500/5" 
                    : "border-border/60 bg-gradient-to-br from-card to-muted/30"
                )}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Label className="text-base font-medium">Activar Sistema</Label>
                          {questSettings.enabled && (
                            <Badge className="bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30">
                              <Zap className="w-3 h-3 mr-1" />
                              Activo
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Habilita el seguimiento de misiones en todas las sesiones.
                        </p>
                      </div>
                      <Switch
                        checked={questSettings.enabled}
                        onCheckedChange={(enabled) => setQuestSettings({ enabled })}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <Separator className="bg-border/50" />

            {/* Detection Settings */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <div className="p-1.5 rounded-md bg-purple-500/10">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                </div>
                Detección Automática
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 ml-auto">
                  IA
                </Badge>
              </div>
              
              <div className="pl-8 space-y-3">
                <label className={cn(
                  "flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all",
                  questSettings.enabled 
                    ? "border-border/60 bg-gradient-to-r from-background to-muted/30 hover:border-purple-500/30 hover:bg-purple-500/5" 
                    : "border-border/40 bg-muted/30 opacity-50 cursor-not-allowed"
                )}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                      <Sparkles className="w-4 h-4 text-purple-500" />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Auto-detectar</Label>
                      <p className="text-xs text-muted-foreground">
                        Detectar automáticamente misiones en los mensajes del chat.
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={questSettings.autoDetect}
                    onCheckedChange={(autoDetect) => setQuestSettings({ autoDetect })}
                    disabled={!questSettings.enabled}
                  />
                </label>

                <label className={cn(
                  "flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all",
                  questSettings.enabled 
                    ? "border-border/60 bg-gradient-to-r from-background to-muted/30 hover:border-purple-500/30 hover:bg-purple-500/5" 
                    : "border-border/40 bg-muted/30 opacity-50 cursor-not-allowed"
                )}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-500/10">
                      <Zap className="w-4 h-4 text-cyan-500" />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Detección en tiempo real</Label>
                      <p className="text-xs text-muted-foreground">
                        Detectar durante el streaming de mensajes para respuestas más rápidas.
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={questSettings.realtimeEnabled}
                    onCheckedChange={(realtimeEnabled) => setQuestSettings({ realtimeEnabled })}
                    disabled={!questSettings.enabled}
                  />
                </label>
              </div>
            </div>

            <Separator className="bg-border/50" />

            {/* Key Prefixes Settings */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <div className="p-1.5 rounded-md bg-emerald-500/10">
                  <Key className="w-4 h-4 text-emerald-500" />
                </div>
                Prefijos de Keys
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 ml-auto">
                  Opcional
                </Badge>
              </div>
              
              <div className="pl-8 space-y-3">
                <div className="p-4 rounded-lg border border-border/60 bg-gradient-to-r from-background to-muted/30">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-emerald-500/10">
                      <Info className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="text-xs space-y-1">
                      <p className="font-medium text-emerald-600 dark:text-emerald-400">
                        ¿Qué son los prefijos?
                      </p>
                      <p className="text-muted-foreground">
                        Los prefijos se combinan con las keys de detección para mayor flexibilidad.
                        El sistema detecta automáticamente múltiples variantes.
                      </p>
                      <div className="mt-2 p-2 rounded bg-muted/50 font-mono text-[10px]">
                        <span className="text-muted-foreground">Ejemplo:</span>
                        <br />
                        <span className="text-emerald-500">Prefijo:</span> "Objetivo" + <span className="text-amber-500">Key:</span> "conseguir_madera"
                        <br />
                        <span className="text-muted-foreground">= Detecta:</span> "Objetivo:conseguir_madera", "Objetivo: conseguir madera", "Objetivo=conseguir_madera", etc.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quest Activation Prefix */}
                <div className="p-4 rounded-lg border border-border/60 bg-gradient-to-r from-background to-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <Zap className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="flex-1">
                      <Label className="text-sm font-medium">Prefijo de Activación</Label>
                      <p className="text-xs text-muted-foreground">
                        Para activar misiones. Ej: "Misión:rescate"
                      </p>
                    </div>
                  </div>
                  <Input
                    value={questSettings.questActivationPrefix || ''}
                    onChange={(e) => setQuestSettings({ questActivationPrefix: e.target.value })}
                    disabled={!questSettings.enabled}
                    placeholder="Misión (opcional)"
                    className="font-mono text-sm"
                  />
                </div>

                {/* Quest Completion Prefix */}
                <div className="p-4 rounded-lg border border-border/60 bg-gradient-to-r from-background to-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <Target className="w-4 h-4 text-green-500" />
                    </div>
                    <div className="flex-1">
                      <Label className="text-sm font-medium">Prefijo de Completado</Label>
                      <p className="text-xs text-muted-foreground">
                        Para completar misiones enteras. Ej: "Completado:rescate"
                      </p>
                    </div>
                  </div>
                  <Input
                    value={questSettings.questCompletionPrefix || ''}
                    onChange={(e) => setQuestSettings({ questCompletionPrefix: e.target.value })}
                    disabled={!questSettings.enabled}
                    placeholder="Completado (opcional)"
                    className="font-mono text-sm"
                  />
                </div>

                {/* Objective Completion Prefix */}
                <div className="p-4 rounded-lg border border-border/60 bg-gradient-to-r from-background to-muted/30">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <List className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <Label className="text-sm font-medium">Prefijo de Objetivos</Label>
                      <p className="text-xs text-muted-foreground">
                        Para completar objetivos. Ej: "Objetivo:conseguir_madera"
                      </p>
                    </div>
                  </div>
                  <Input
                    value={questSettings.objectiveCompletionPrefix || ''}
                    onChange={(e) => setQuestSettings({ objectiveCompletionPrefix: e.target.value })}
                    disabled={!questSettings.enabled}
                    placeholder="Objetivo (opcional)"
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            </div>

            <Separator className="bg-border/50" />

            {/* Display Settings */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <div className="p-1.5 rounded-md bg-blue-500/10">
                  <Bell className="w-4 h-4 text-blue-500" />
                </div>
                Visualización
              </div>
              
              <div className="pl-8 space-y-3">
                <label className={cn(
                  "flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all",
                  questSettings.enabled 
                    ? "border-border/60 bg-gradient-to-r from-background to-muted/30 hover:border-blue-500/30 hover:bg-blue-500/5" 
                    : "border-border/40 bg-muted/30 opacity-50 cursor-not-allowed"
                )}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Bell className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Mostrar notificaciones</Label>
                      <p className="text-xs text-muted-foreground">
                        Mostrar alertas cuando se actualice o complete una misión.
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={questSettings.showNotifications}
                    onCheckedChange={(showNotifications) => setQuestSettings({ showNotifications })}
                    disabled={!questSettings.enabled}
                  />
                </label>

                <label className={cn(
                  "flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all",
                  questSettings.enabled 
                    ? "border-border/60 bg-gradient-to-r from-background to-muted/30 hover:border-blue-500/30 hover:bg-blue-500/5" 
                    : "border-border/40 bg-muted/30 opacity-50 cursor-not-allowed"
                )}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10">
                      <List className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Mostrar completadas</Label>
                      <p className="text-xs text-muted-foreground">
                        Mantener misiones completadas en el registro histórico.
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={questSettings.showCompletedInLog}
                    onCheckedChange={(showCompletedInLog) => setQuestSettings({ showCompletedInLog })}
                    disabled={!questSettings.enabled}
                  />
                </label>

                <div className={cn(
                  "p-4 rounded-lg border transition-all",
                  questSettings.enabled 
                    ? "border-border/60 bg-gradient-to-r from-background to-muted/30" 
                    : "border-border/40 bg-muted/30 opacity-50"
                )}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <Target className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Máximo de misiones activas</Label>
                        <Badge variant="secondary" className="font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                          {questSettings.maxActiveQuests}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Límite de misiones que pueden estar activas simultáneamente.
                      </p>
                    </div>
                  </div>
                  <Slider
                    value={[questSettings.maxActiveQuests]}
                    min={1}
                    max={20}
                    step={1}
                    disabled={!questSettings.enabled}
                    onValueChange={([maxActiveQuests]) => 
                      setQuestSettings({ maxActiveQuests })
                    }
                    className="py-2"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>1 misión</span>
                    <span>20 misiones</span>
                  </div>
                </div>
              </div>
            </div>

            <Separator className="bg-border/50" />

            {/* Prompt Settings */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <div className="p-1.5 rounded-md bg-green-500/10">
                  <FileText className="w-4 h-4 text-green-500" />
                </div>
                Integración con Prompt
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 ml-auto">
                  LLM
                </Badge>
              </div>
              
              <div className="pl-8 space-y-3">
                <label className={cn(
                  "flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all",
                  questSettings.enabled 
                    ? "border-border/60 bg-gradient-to-r from-background to-muted/30 hover:border-green-500/30 hover:bg-green-500/5" 
                    : "border-border/40 bg-muted/30 opacity-50 cursor-not-allowed"
                )}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <FileText className="w-4 h-4 text-green-500" />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Incluir en prompt</Label>
                      <p className="text-xs text-muted-foreground">
                        Añadir misiones activas al prompt enviado al LLM.
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={questSettings.promptInclude}
                    onCheckedChange={(promptInclude) => setQuestSettings({ promptInclude })}
                    disabled={!questSettings.enabled}
                  />
                </label>

                <Collapsible open={promptEditorOpen} onOpenChange={setPromptEditorOpen}>
                  <CollapsibleTrigger asChild>
                    <Button 
                      variant="outline" 
                      className={cn(
                        "w-full justify-between transition-all",
                        questSettings.enabled 
                          ? "hover:border-green-500/30 hover:bg-green-500/5" 
                          : "opacity-50 cursor-not-allowed"
                      )}
                      disabled={!questSettings.enabled}
                    >
                      <span className="flex items-center gap-2">
                        <Settings2 className="w-4 h-4 text-green-500" />
                        Editar Template de Prompt
                      </span>
                      <ChevronDown className={cn(
                        "w-4 h-4 transition-transform",
                        promptEditorOpen && "rotate-180"
                      )} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4 space-y-4">
                    <div className="p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-green-500/20">
                          <HelpCircle className="w-4 h-4 text-green-500" />
                        </div>
                        <div className="text-xs space-y-2">
                          <p className="font-medium text-green-600 dark:text-green-400">
                            Variables disponibles:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className="font-mono text-[10px] bg-green-500/10 border-green-500/20">
                              {'{{activeQuests}}'}
                            </Badge>
                            <Badge variant="outline" className="font-mono text-[10px] bg-green-500/10 border-green-500/20">
                              {'{{questCount}}'}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground">
                            Lista de misiones activas formateada para el LLM.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <Textarea
                      value={localPrompt}
                      onChange={(e) => setLocalPrompt(e.target.value)}
                      disabled={!questSettings.enabled}
                      placeholder="Template para incluir misiones en el prompt..."
                      className="min-h-[150px] font-mono text-sm bg-background"
                    />
                    
                    <div className="flex items-center justify-between">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            disabled={!questSettings.enabled}
                            className="hover:border-amber-500/30 hover:bg-amber-500/5"
                          >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Restaurar
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Restaurar template por defecto?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esto reemplazará tu template personalizado con el valor predeterminado.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleResetPrompt}>
                              Restaurar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      <Button 
                        size="sm"
                        onClick={handlePromptSave}
                        disabled={!questSettings.enabled || localPrompt === promptTemplate}
                        className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Guardar
                      </Button>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {!promptEditorOpen && (
                  <div className="p-4 rounded-lg border border-border/60 bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                      <Label className="text-xs text-muted-foreground">Vista previa del template:</Label>
                    </div>
                    <div className="p-3 rounded-lg bg-background text-xs font-mono max-h-[80px] overflow-y-auto text-muted-foreground border border-border/50">
                      {promptTemplate.length > 200 
                        ? `${promptTemplate.slice(0, 200)}...`
                        : promptTemplate || 'Sin template configurado'
                      }
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default QuestSettingsPanel;
