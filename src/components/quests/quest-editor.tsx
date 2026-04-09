'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  Trash2,
  Target,
  Trophy,
  Star,
  EyeOff,
  Save,
  X,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { 
  Quest, 
  QuestObjective, 
  QuestReward, 
  QuestPriority,
  QuestObjectiveType,
  QuestTrigger
} from '@/types';

// ============================================
// Quest Editor Props
// ============================================

interface QuestEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (quest: Omit<Quest, 'id' | 'updatedAt'>) => void;
  quest?: Quest;
  sessionId: string;
}

// ============================================
// Default Values
// ============================================

const DEFAULT_OBJECTIVE: Omit<QuestObjective, 'id'> = {
  description: '',
  type: 'custom',
  currentCount: 0,
  targetCount: 1,
  isCompleted: false,
  isOptional: false,
};

const DEFAULT_REWARD: Omit<QuestReward, 'type'> & { type: QuestReward['type'] } = {
  type: 'item',
  name: '',
  quantity: 1,
};

const DEFAULT_TRIGGERS: QuestTrigger = {
  startKeywords: [],
  completionKeywords: [],
  autoStart: false,
  autoComplete: true,
  trackProgress: true,
};

const ICONS = ['⚔️', '📜', '🗺️', '💎', '👑', '🔮', '🗝️', '🏆', '⭐', '🌟', '💀', '❤️', '🛡️', '🗡️', '🎁', '💰'];

// ============================================
// Quest Editor Component
// ============================================

export function QuestEditor({
  open,
  onOpenChange,
  onSave,
  quest,
  sessionId,
}: QuestEditorProps) {
  // Initialize state with quest data or defaults
  const [title, setTitle] = useState(quest?.title || '');
  const [description, setDescription] = useState(quest?.description || '');
  const [priority, setPriority] = useState<QuestPriority>(quest?.priority || 'side');
  const [icon, setIcon] = useState(quest?.icon || '⚔️');
  const [isHidden, setIsHidden] = useState(quest?.isHidden || false);
  const [isRepeatable, setIsRepeatable] = useState(quest?.isRepeatable || false);
  const [objectives, setObjectives] = useState<QuestObjective[]>(quest?.objectives || []);
  const [rewards, setRewards] = useState<QuestReward[]>(quest?.rewards || []);
  const [triggers, setTriggers] = useState<QuestTrigger>(quest?.triggers || DEFAULT_TRIGGERS);
  const [notes, setNotes] = useState(quest?.notes || '');
  
  const resetForm = useCallback(() => {
    setTitle('');
    setDescription('');
    setPriority('side');
    setIcon('⚔️');
    setIsHidden(false);
    setIsRepeatable(false);
    setObjectives([]);
    setRewards([]);
    setTriggers(DEFAULT_TRIGGERS);
    setNotes('');
  }, []);
  
  const handleSave = useCallback(() => {
    if (!title.trim()) return;
    
    onSave({
      sessionId,
      title: title.trim(),
      description: description.trim(),
      status: 'active',
      priority,
      icon,
      isHidden,
      isRepeatable,
      objectives,
      rewards,
      triggers,
      notes,
      progress: 0,
      startedAt: new Date().toISOString(),
    });
    
    onOpenChange(false);
    resetForm();
  }, [title, description, priority, icon, isHidden, isRepeatable, objectives, rewards, triggers, notes, sessionId, onSave, onOpenChange, resetForm]);
  
  // Objective handlers
  const addObjective = useCallback(() => {
    setObjectives(prev => [...prev, { ...DEFAULT_OBJECTIVE, id: `obj-${Date.now()}` }]);
  }, []);
  
  const updateObjective = useCallback((index: number, updates: Partial<QuestObjective>) => {
    setObjectives(prev => prev.map((o, i) => i === index ? { ...o, ...updates } : o));
  }, []);
  
  const removeObjective = useCallback((index: number) => {
    setObjectives(prev => prev.filter((_, i) => i !== index));
  }, []);
  
  // Reward handlers
  const addReward = useCallback(() => {
    setRewards(prev => [...prev, { ...DEFAULT_REWARD }]);
  }, []);
  
  const updateReward = useCallback((index: number, updates: Partial<QuestReward>) => {
    setRewards(prev => prev.map((r, i) => i === index ? { ...r, ...updates } : r));
  }, []);
  
  const removeReward = useCallback((index: number) => {
    setRewards(prev => prev.filter((_, i) => i !== index));
  }, []);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[90vw] max-h-[85vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="p-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            {quest ? 'Editar Misión' : 'Nueva Misión'}
          </DialogTitle>
          <DialogDescription>
            Crea o edita una misión para la sesión actual.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 grid grid-cols-2 gap-4">
            {/* LEFT COLUMN */}
            <div className="space-y-4">
              {/* Basic Info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Información Básica</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Icono</Label>
                      <Select value={icon} onValueChange={setIcon}>
                        <SelectTrigger className="w-14 h-9">
                          <span className="text-base">{icon}</span>
                        </SelectTrigger>
                        <SelectContent className="max-h-[200px]">
                          {ICONS.map(ic => (
                            <SelectItem key={ic} value={ic} className="text-base">
                              {ic}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Título</Label>
                      <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Título de la misión"
                        className="h-9"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs">Descripción</Label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe la misión..."
                      className="min-h-[60px] text-sm"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Prioridad</Label>
                      <Select value={priority} onValueChange={(v) => setPriority(v as QuestPriority)}>
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="main">
                            <div className="flex items-center gap-2">
                              <Star className="w-3.5 h-3.5 text-amber-500" />
                              Principal
                            </div>
                          </SelectItem>
                          <SelectItem value="side">
                            <div className="flex items-center gap-2">
                              <Target className="w-3.5 h-3.5 text-blue-400" />
                              Secundaria
                            </div>
                          </SelectItem>
                          <SelectItem value="hidden">
                            <div className="flex items-center gap-2">
                              <EyeOff className="w-3.5 h-3.5 text-gray-400" />
                              Oculta
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end gap-3 pb-1">
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <Switch checked={isHidden} onCheckedChange={setIsHidden} className="scale-75" />
                        Ocultar
                      </label>
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <Switch checked={isRepeatable} onCheckedChange={setIsRepeatable} className="scale-75" />
                        Repetible
                      </label>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Rewards */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Trophy className="w-3.5 h-3.5 text-amber-500" />
                      Recompensas
                    </CardTitle>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={addReward}>
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Agregar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {rewards.length === 0 ? (
                    <div className="text-center py-3 text-muted-foreground text-xs border rounded-lg border-dashed">
                      Sin recompensas
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {rewards.map((reward, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                          <Select 
                            value={reward.type} 
                            onValueChange={(v) => updateReward(index, { type: v as QuestReward['type'] })}
                          >
                            <SelectTrigger className="w-[90px] h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="item">Objeto</SelectItem>
                              <SelectItem value="experience">Exp.</SelectItem>
                              <SelectItem value="relationship">Relación</SelectItem>
                              <SelectItem value="unlock">Desbloqueo</SelectItem>
                              <SelectItem value="custom">Otro</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            value={reward.name}
                            onChange={(e) => updateReward(index, { name: e.target.value })}
                            placeholder="Nombre"
                            className="flex-1 h-7 text-xs"
                          />
                          <Input
                            type="number"
                            value={reward.quantity || ''}
                            onChange={(e) => updateReward(index, { quantity: parseInt(e.target.value) || undefined })}
                            placeholder="#"
                            className="w-14 h-7 text-xs"
                            min={1}
                          />
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeReward(index)}>
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Auto Detection */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                    Detección Automática
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs">Auto-completar</Label>
                      <p className="text-[10px] text-muted-foreground">Detecta cuando se completa</p>
                    </div>
                    <Switch
                      checked={triggers.autoComplete}
                      onCheckedChange={(checked) => setTriggers(prev => ({ ...prev, autoComplete: checked }))}
                      className="scale-75"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs">Seguir progreso</Label>
                      <p className="text-[10px] text-muted-foreground">Detecta menciones</p>
                    </div>
                    <Switch
                      checked={triggers.trackProgress}
                      onCheckedChange={(checked) => setTriggers(prev => ({ ...prev, trackProgress: checked }))}
                      className="scale-75"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Palabras clave</Label>
                    <Input
                      value={triggers.completionKeywords.join(', ')}
                      onChange={(e) => 
                        setTriggers(prev => ({ 
                          ...prev, 
                          completionKeywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                        }))
                      }
                      placeholder="completado, terminado, logrado"
                      className="h-7 text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">Separadas por coma</p>
                  </div>
                </CardContent>
              </Card>
              
              {/* Notes */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Notas</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notas personales..."
                    className="min-h-[50px] text-xs"
                  />
                </CardContent>
              </Card>
            </div>
            
            {/* RIGHT COLUMN */}
            <div className="space-y-4">
              {/* Objectives - Takes more space */}
              <Card className="flex-1">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Target className="w-3.5 h-3.5" />
                      Objetivos
                    </CardTitle>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={addObjective}>
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Agregar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {objectives.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-xs border rounded-lg border-dashed">
                      <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      Sin objetivos. Agrega uno para empezar.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {objectives.map((obj, index) => (
                        <div 
                          key={obj.id}
                          className="p-2.5 rounded-lg border bg-muted/30 space-y-2"
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-1 space-y-1">
                              <Input
                                value={obj.description}
                                onChange={(e) => updateObjective(index, { description: e.target.value })}
                                placeholder="Descripción del objetivo"
                                className="h-8 text-xs"
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              onClick={() => removeObjective(index)}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Select 
                              value={obj.type} 
                              onValueChange={(v) => updateObjective(index, { type: v as QuestObjectiveType })}
                            >
                              <SelectTrigger className="w-[100px] h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="collect">Coleccionar</SelectItem>
                                <SelectItem value="reach">Alcanzar</SelectItem>
                                <SelectItem value="defeat">Derrotar</SelectItem>
                                <SelectItem value="talk">Hablar</SelectItem>
                                <SelectItem value="discover">Descubrir</SelectItem>
                                <SelectItem value="custom">Personalizado</SelectItem>
                              </SelectContent>
                            </Select>
                            
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                value={obj.targetCount}
                                onChange={(e) => updateObjective(index, { targetCount: parseInt(e.target.value) || 1 })}
                                className="w-14 h-7 text-xs"
                                min={1}
                              />
                              <span className="text-xs text-muted-foreground">veces</span>
                            </div>
                            
                            <label className="flex items-center gap-1 text-xs ml-auto cursor-pointer">
                              <input
                                type="checkbox"
                                checked={obj.isOptional}
                                onChange={(e) => updateObjective(index, { isOptional: e.target.checked })}
                                className="rounded scale-75"
                              />
                              <span className="text-muted-foreground">Opcional</span>
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Quick Tips */}
              <Card className="bg-muted/50">
                <CardContent className="p-3">
                  <h4 className="text-xs font-medium mb-2 flex items-center gap-1.5">
                    💡 Tips para misiones
                  </h4>
                  <ul className="text-[10px] text-muted-foreground space-y-1">
                    <li>• Los objetivos opcionales no cuentan para el progreso</li>
                    <li>• Usa palabras clave que el LLM usaría naturalmente</li>
                    <li>• Las misiones ocultas no aparecen hasta ser descubiertas</li>
                    <li>• Marcar "Repetible" permite reiniciar la misión</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </ScrollArea>
        
        <DialogFooter className="p-3 border-t shrink-0 flex flex-row justify-end gap-2 bg-background">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-1.5" />
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!title.trim()}>
            <Save className="w-4 h-4 mr-1.5" />
            {quest ? 'Guardar Cambios' : 'Crear Misión'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default QuestEditor;
