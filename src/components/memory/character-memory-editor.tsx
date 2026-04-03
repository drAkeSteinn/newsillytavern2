'use client';

import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Heart,
  Brain,
  Plus,
  Trash2,
  Edit3,
  Calendar,
  User,
  MapPin,
  Package,
  Sparkles,
  TrendingUp
} from 'lucide-react';
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { MemoryEvent, RelationshipMemory } from '@/types';

// Extract the event type from MemoryEvent
type MemoryEventType = MemoryEvent['type'];

interface CharacterMemoryEditorProps {
  characterId: string;
  characterName: string;
  className?: string;
}

// Event type configurations
const EVENT_TYPES: { type: MemoryEventType; label: string; icon: React.ReactNode; color: string }[] = [
  { type: 'fact', label: 'Hecho', icon: <Brain className="w-3 h-3" />, color: 'bg-blue-500' },
  { type: 'relationship', label: 'Relación', icon: <Heart className="w-3 h-3" />, color: 'bg-pink-500' },
  { type: 'event', label: 'Evento', icon: <Sparkles className="w-3 h-3" />, color: 'bg-purple-500' },
  { type: 'emotion', label: 'Emoción', icon: <Heart className="w-3 h-3" />, color: 'bg-red-500' },
  { type: 'location', label: 'Ubicación', icon: <MapPin className="w-3 h-3" />, color: 'bg-green-500' },
  { type: 'item', label: 'Objeto', icon: <Package className="w-3 h-3" />, color: 'bg-amber-500' },
  { type: 'state_change', label: 'Cambio', icon: <TrendingUp className="w-3 h-3" />, color: 'bg-cyan-500' },
];

export function CharacterMemoryEditor({ 
  characterId, 
  characterName,
  className 
}: CharacterMemoryEditorProps) {
  const { 
    getCharacterMemory, 
    addMemoryEvent, 
    removeMemoryEvent,
    updateRelationship,
    removeRelationship,
    setCharacterNotes
  } = useTavernStore();
  
  const memory = getCharacterMemory(characterId);
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [addRelationOpen, setAddRelationOpen] = useState(false);
  const [newEvent, setNewEvent] = useState<Partial<MemoryEvent>>({
    type: 'fact',
    content: '',
    importance: 0.5
  });
  const [newRelation, setNewRelation] = useState<Partial<RelationshipMemory>>({
    targetId: '',
    targetName: '',
    relationship: '',
    sentiment: 0,
    notes: ''
  });

  const handleAddEvent = useCallback(() => {
    if (!newEvent.content?.trim()) return;
    
    addMemoryEvent(characterId, {
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: newEvent.type || 'fact',
      content: newEvent.content,
      timestamp: new Date().toISOString(),
      importance: newEvent.importance || 0.5
    });
    
    setNewEvent({ type: 'fact', content: '', importance: 0.5 });
    setAddEventOpen(false);
  }, [characterId, newEvent, addMemoryEvent]);

  const handleAddRelation = useCallback(() => {
    if (!newRelation.targetName?.trim() || !newRelation.relationship?.trim()) return;
    
    updateRelationship(characterId, {
      targetId: newRelation.targetId || `target-${Date.now()}`,
      targetName: newRelation.targetName,
      relationship: newRelation.relationship,
      sentiment: newRelation.sentiment || 0,
      notes: newRelation.notes || '',
      lastUpdated: new Date().toISOString()
    });
    
    setNewRelation({ targetId: '', targetName: '', relationship: '', sentiment: 0, notes: '' });
    setAddRelationOpen(false);
  }, [characterId, newRelation, updateRelationship]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Memory Events */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-500" />
                Eventos Recordados
              </CardTitle>
              <CardDescription>
                Momentos importantes de la conversación con {characterName}
              </CardDescription>
            </div>
            <Dialog open={addEventOpen} onOpenChange={setAddEventOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="w-4 h-4 mr-1" />
                  Agregar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Agregar Memoria</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Tipo de evento</Label>
                    <div className="flex flex-wrap gap-2">
                      {EVENT_TYPES.map((et) => (
                        <Badge
                          key={et.type}
                          variant={newEvent.type === et.type ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => setNewEvent(prev => ({ ...prev, type: et.type }))}
                        >
                          {et.icon}
                          <span className="ml-1">{et.label}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Descripción</Label>
                    <Textarea
                      value={newEvent.content}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, content: e.target.value }))}
                      placeholder="Describe el evento o hecho importante..."
                      className="min-h-[100px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Importancia: {Math.round((newEvent.importance || 0.5) * 100)}%</Label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={newEvent.importance || 0.5}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, importance: parseFloat(e.target.value) }))}
                      className="w-full"
                    />
                  </div>
                  <Button onClick={handleAddEvent} className="w-full">
                    Guardar Memoria
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {memory?.events && memory.events.length > 0 ? (
            <ScrollArea className="max-h-[250px]">
              <div className="space-y-2 pr-4">
                {memory.events.map((event) => {
                  const typeConfig = EVENT_TYPES.find(t => t.type === event.type);
                  return (
                    <div 
                      key={event.id}
                      className="p-3 rounded-lg border bg-muted/30 group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1">
                          <div className={cn(
                            "p-1.5 rounded mt-0.5",
                            typeConfig?.color || 'bg-gray-500'
                          )}>
                            {typeConfig?.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">{event.content}</p>
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(event.timestamp)}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={() => removeMemoryEvent(characterId, event.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <Brain className="w-8 h-8 mx-auto mb-2 opacity-50" />
              Sin eventos recordados
            </div>
          )}
        </CardContent>
      </Card>

      {/* Relationships */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Heart className="w-4 h-4 text-pink-500" />
                Relaciones
              </CardTitle>
              <CardDescription>
                Cómo {characterName} se relaciona con otros
              </CardDescription>
            </div>
            <Dialog open={addRelationOpen} onOpenChange={setAddRelationOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="w-4 h-4 mr-1" />
                  Agregar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Agregar Relación</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Nombre del objetivo</Label>
                    <Input
                      value={newRelation.targetName}
                      onChange={(e) => setNewRelation(prev => ({ ...prev, targetName: e.target.value }))}
                      placeholder="Nombre del personaje o usuario"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de relación</Label>
                    <Input
                      value={newRelation.relationship}
                      onChange={(e) => setNewRelation(prev => ({ ...prev, relationship: e.target.value }))}
                      placeholder="ej: amigo cercano, rival, amor..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Sentimiento: {newRelation.sentiment}</Label>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="10"
                      value={newRelation.sentiment}
                      onChange={(e) => setNewRelation(prev => ({ ...prev, sentiment: parseInt(e.target.value) }))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Hostil</span>
                      <span>Neutral</span>
                      <span>Positivo</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Notas</Label>
                    <Textarea
                      value={newRelation.notes}
                      onChange={(e) => setNewRelation(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Detalles adicionales sobre esta relación..."
                      className="min-h-[80px]"
                    />
                  </div>
                  <Button onClick={handleAddRelation} className="w-full">
                    Guardar Relación
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {memory?.relationships && memory.relationships.length > 0 ? (
            <div className="space-y-2">
              {memory.relationships.map((rel) => (
                <div 
                  key={rel.targetId}
                  className="p-3 rounded-lg border bg-muted/30 group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center",
                        rel.sentiment > 30 ? "bg-green-500/20 text-green-600" :
                        rel.sentiment < -30 ? "bg-red-500/20 text-red-600" :
                        "bg-gray-500/20 text-gray-600"
                      )}>
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{rel.targetName}</span>
                          <Badge variant="secondary" className="text-xs">
                            {rel.relationship}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{rel.notes}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-muted-foreground">Sentimiento:</span>
                          <div className="flex-1 h-1.5 bg-muted rounded-full max-w-[100px]">
                            <div 
                              className={cn(
                                "h-full rounded-full",
                                rel.sentiment > 30 ? "bg-green-500" :
                                rel.sentiment < -30 ? "bg-red-500" :
                                "bg-gray-400"
                              )}
                              style={{ width: `${Math.abs(rel.sentiment) / 2}%`, marginLeft: rel.sentiment < 0 ? 'auto' : 0 }}
                            />
                          </div>
                          <span className="text-xs font-mono">{rel.sentiment}</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={() => removeRelationship(characterId, rel.targetId)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <Heart className="w-8 h-8 mx-auto mb-2 opacity-50" />
              Sin relaciones registradas
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-amber-500" />
            Notas del Personaje
          </CardTitle>
          <CardDescription>
            Notas personales sobre {characterName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={memory?.notes || ''}
            onChange={(e) => setCharacterNotes(characterId, e.target.value)}
            placeholder="Escribe notas sobre este personaje..."
            className="min-h-[100px]"
          />
        </CardContent>
      </Card>
    </div>
  );
}
