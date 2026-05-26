'use client';

import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Trash2, 
  Check, 
  User,
  Edit2,
  Upload,
  Loader2,
  HelpCircle,
  Users,
  Mail,
  Inbox,
  Send,
  Settings2,
  ArrowLeft,
  Save,
  Coins,
  Minus,
  PackageOpen,
  X,
} from 'lucide-react';
import { useState, useRef, useMemo } from 'react';
import type { 
  Persona, 
  CharacterCard, 
  CharacterStatsConfig, 
  SolicitudDefinition, 
  Item,
} from '@/types';
import { getLogger } from '@/lib/logger';
import { StatsEditor } from './stats-editor';
import { 
  getItemTypeIcon, 
  getItemTypeLabel, 
  getRarityColor, 
  getRarityBgColor,
} from '@/store/slices/inventorySlice';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const personaLogger = getLogger('persona');

export function PersonaPanel() {
  const { 
    personas, 
    activePersonaId,
    characters,
    addPersona, 
    updatePersona, 
    deletePersona, 
    setActivePersona,
    items,
    addToPersona,
    removeFromPersona,
    getPersonaItems,
  } = useTavernStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    description: string;
    avatar: string;
    statsConfig?: CharacterStatsConfig;
    currency: number;
    currencyName: string;
    currencyIcon: string;
  }>({
    name: '',
    description: '',
    avatar: '',
    statsConfig: undefined,
    currency: 0,
    currencyName: 'Divisa',
    currencyIcon: '💰',
  });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showStatsEditor, setShowStatsEditor] = useState<string | null>(null);

  // Get all characters with their solicitud definitions for the invitation editor
  const charactersWithSolicitudes = useMemo(() => {
    return characters
      .filter(c => c.statsConfig?.enabled && (c.statsConfig.solicitudDefinitions?.length || 0) > 0)
      .map(c => ({
        id: c.id,
        name: c.name,
        solicitudDefinitions: c.statsConfig?.solicitudDefinitions || [],
      }));
  }, [characters]);

  // Build available targets for target_attribute rewards: other characters + persona
  const availableTargets = useMemo(() => {
    const targets: Array<{
      id: string;
      name: string;
      attributes: Array<{ key: string; name: string; type: 'number' | 'keyword' | 'text'; min?: number; max?: number }>;
    }> = [];
    // Add characters with attributes
    characters.forEach(c => {
      if (c.statsConfig?.enabled && (c.statsConfig.attributes?.length || 0) > 0) {
        targets.push({
          id: c.id,
          name: c.name,
          attributes: (c.statsConfig.attributes || []).map(a => ({
            key: a.key,
            name: a.name,
            type: a.type,
            min: a.min,
            max: a.max,
          })),
        });
      }
    });
    // Add active persona with attributes
    const activePersona = personas.find(p => p.id === activePersonaId);
    if (activePersona?.statsConfig?.enabled && (activePersona.statsConfig.attributes?.length || 0) > 0) {
      targets.push({
        id: '__user__',
        name: activePersona.name || 'Persona',
        attributes: (activePersona.statsConfig.attributes || []).map(a => ({
          key: a.key,
          name: a.name,
          type: a.type,
          min: a.min,
          max: a.max,
        })),
      });
    }
    return targets;
  }, [characters, personas, activePersonaId]);

  const handleCreatePersona = () => {
    const newPersona: Omit<Persona, 'id' | 'createdAt' | 'updatedAt'> = {
      name: 'Nueva Persona',
      description: '',
      avatar: '',
      isActive: false,
      currency: 0,
      currencyName: 'Divisa',
      currencyIcon: '💰',
      inventoryItems: [],
    };
    addPersona(newPersona);
    // Start editing the new persona
    const newId = personas.length > 0 ? 'new' : 'temp'; // Will be replaced
    setEditingId(newId);
    setEditForm({
      name: 'Nueva Persona',
      description: '',
      avatar: '',
      statsConfig: undefined,
      currency: 0,
      currencyName: 'Divisa',
      currencyIcon: '💰',
    });
  };

  const handleStartEdit = (persona: Persona) => {
    setEditingId(persona.id);
    setEditForm({
      name: persona.name,
      description: persona.description,
      avatar: persona.avatar,
      statsConfig: persona.statsConfig ? { ...persona.statsConfig } : undefined,
      currency: persona.currency ?? 0,
      currencyName: persona.currencyName ?? 'Divisa',
      currencyIcon: persona.currencyIcon ?? '💰',
    });
  };

  const handleSaveEdit = (id: string) => {
    if (!editForm.name.trim()) return;
    
    updatePersona(id, {
      name: editForm.name.trim(),
      description: editForm.description,
      avatar: editForm.avatar,
      statsConfig: editForm.statsConfig,
      currency: editForm.currency,
      currencyName: editForm.currencyName,
      currencyIcon: editForm.currencyIcon,
    });
    setEditingId(null);
    setEditForm({ name: '', description: '', avatar: '', statsConfig: undefined, currency: 0, currencyName: 'Divisa', currencyIcon: '💰' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: '', description: '', avatar: '', statsConfig: undefined, currency: 0, currencyName: 'Divisa', currencyIcon: '💰' });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>, personaId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 2MB for base64)
    if (file.size > 2 * 1024 * 1024) {
      alert('Imagen muy grande. El tamaño máximo es 2MB.');
      return;
    }

    setUploading(true);
    
    try {
      // Convert to base64 for persistent storage
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        
        if (personaId) {
          // Update existing persona
          updatePersona(personaId, { avatar: base64 });
        } else {
          // Update edit form
          setEditForm(prev => ({ ...prev, avatar: base64 }));
        }
        setUploading(false);
      };
      reader.onerror = () => {
        alert('Error al leer la imagen');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      personaLogger.error('Upload error', { error });
      alert(error instanceof Error ? error.message : 'Error al subir imagen');
      setUploading(false);
    } finally {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = (id: string) => {
    if (id === 'default') {
      alert('No se puede eliminar la persona por defecto');
      return;
    }
    if (confirm('¿Estás seguro de que deseas eliminar esta persona?')) {
      deletePersona(id);
    }
  };

  // ============================================
  // Stats Config Handlers
  // ============================================
  // Find the persona being edited
  const editingPersona = editingId ? personas.find(p => p.id === editingId) : undefined;

  return (
    <TooltipProvider>
      {editingId ? (
        <PersonaEditorPanel
          persona={editingPersona}
          editForm={editForm}
          setEditForm={setEditForm}
          uploading={uploading}
          fileInputRef={fileInputRef}
          showStatsEditor={showStatsEditor}
          setShowStatsEditor={setShowStatsEditor}
          handleSaveEdit={handleSaveEdit}
          handleCancelEdit={handleCancelEdit}
          handleAvatarUpload={handleAvatarUpload}
          charactersWithSolicitudes={charactersWithSolicitudes}
          availableTargets={availableTargets}
          items={items}
          addToPersona={addToPersona}
          removeFromPersona={removeFromPersona}
          getPersonaItems={getPersonaItems}
        />
      ) : (
        <div className="h-full flex flex-col gap-4 overflow-hidden">
        {/* Banner Informativo */}
        <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-lg p-3 flex-shrink-0">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-violet-500/20 rounded-lg">
              <Users className="w-5 h-5 text-violet-500" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-violet-600 dark:text-violet-400">Sistema de Personas</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Las personas definen tu <strong>identidad</strong> en el roleplay. La IA usará esta información 
                para entender con quién está hablando y adaptar sus respuestas.
              </p>
            </div>
          </div>
        </div>

        {/* Active Persona Preview */}
        {activePersonaId && (
          <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20 flex-shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-emerald-600 font-medium">Persona Activa</span>
            </div>
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10 border-2 border-emerald-500/30">
                <AvatarImage src={personas.find(p => p.id === activePersonaId)?.avatar} />
                <AvatarFallback className="bg-emerald-500/20">
                  <User className="w-5 h-5 text-emerald-600" />
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">
                  {personas.find(p => p.id === activePersonaId)?.name || 'Usuario'}
                </p>
                {personas.find(p => p.id === activePersonaId)?.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {personas.find(p => p.id === activePersonaId)?.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Sección: Lista de Personas - con scroll interno */}
        <div className="p-3 bg-muted/30 rounded-lg border border-border/40 flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <User className="w-3.5 h-3.5" />
              <span className="font-medium">Personas</span>
              <Badge variant="secondary" className="text-xs">{personas.length}</Badge>
            </div>
            <Button size="sm" className="h-7 text-xs" onClick={handleCreatePersona}>
              <Plus className="w-3 h-3 mr-1" />
              Nueva
            </Button>
          </div>

          <ScrollArea className="flex-1 min-h-0 pr-2">
            <div className="grid grid-cols-1 gap-3 pr-2">
              {personas.map((persona) => (
                <div
                  key={persona.id}
                  className={cn(
                    'p-3 rounded-lg border transition-colors',
                    persona.id === activePersonaId 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border/40 bg-background hover:bg-muted/50'
                  )}
                >
                  {/* View Mode */}
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <Avatar className="w-9 h-9 flex-shrink-0">
                        <AvatarImage src={persona.avatar} />
                        <AvatarFallback>
                          <User className="w-4 h-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-sm truncate">{persona.name}</p>
                          {persona.id === activePersonaId && (
                            <Badge className="text-[10px] bg-emerald-500/20 text-emerald-600 border-0 py-0 px-1.5">
                              Activa
                            </Badge>
                          )}
                        </div>
                        {persona.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {persona.description}
                          </p>
                        )}
                        {/* Show stats badges */}
                        <div className="flex gap-1 mt-1">
                          {persona.statsConfig?.enabled && (
                            <>
                              {(persona.statsConfig.attributes?.length || 0) > 0 && (
                                <Badge className="text-[9px] bg-violet-500/10 text-violet-400 border-violet-500/20">
                                  {persona.statsConfig.attributes?.length} atributos
                                </Badge>
                              )}
                              {(persona.statsConfig.invitations?.length || 0) > 0 && (
                                <Badge className="text-[9px] bg-blue-500/10 text-blue-400 border-blue-500/20">
                                  <Send className="w-2.5 h-2.5 mr-0.5" />
                                  {persona.statsConfig.invitations?.length} peticiones
                                </Badge>
                              )}
                              {(persona.statsConfig.solicitudDefinitions?.length || 0) > 0 && (
                                <Badge className="text-[9px] bg-amber-500/10 text-amber-400 border-amber-500/20">
                                  <Inbox className="w-2.5 h-2.5 mr-0.5" />
                                  {persona.statsConfig.solicitudDefinitions?.length} solicitudes
                                </Badge>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      {persona.id !== activePersonaId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                          onClick={() => setActivePersona(persona.id)}
                        >
                          <Check className="w-3 h-3 mr-1" />
                          Activar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => handleStartEdit(persona)}
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      {persona.id !== 'default' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(persona.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {personas.length === 0 && (
                <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
                  <User className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm font-medium">Sin personas creadas</p>
                  <p className="text-xs mt-1">Crea una persona para definir quien eres en los roleplays</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Help Text */}
        <div className="p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-lg text-xs flex-shrink-0">
          <div className="flex items-start gap-2">
            <HelpCircle className="w-4 h-4 text-cyan-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground">Acerca de Personas</p>
              <p className="text-muted-foreground mt-1">
                Las personas definen tu identidad en el roleplay. Cuando creas una persona con un nombre 
                y descripcion, la IA usara esta informacion para entender con quien esta hablando.
              </p>
              <p className="text-muted-foreground mt-1">
                <strong>Peticiones:</strong> Solicitudes que puedes hacer a los personajes. Apareceran como tags rapidos en el chatbox.
              </p>
              <p className="text-muted-foreground mt-1">
                <strong>Solicitudes:</strong> Peticiones que los personajes pueden hacerte. Apareceran en un panel para aceptar o rechazar.
              </p>
            </div>
          </div>
        </div>
      </div>
      )}
    </TooltipProvider>
  );
}

// ============================================
// Persona Editor Panel (Full-Screen)
// ============================================

interface PersonaEditorPanelProps {
  persona: Persona | undefined;
  editForm: {
    name: string;
    description: string;
    avatar: string;
    statsConfig?: CharacterStatsConfig;
    currency: number;
    currencyName: string;
    currencyIcon: string;
  };
  setEditForm: React.Dispatch<React.SetStateAction<{
    name: string;
    description: string;
    avatar: string;
    statsConfig?: CharacterStatsConfig;
    currency: number;
    currencyName: string;
    currencyIcon: string;
  }>>;
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  showStatsEditor: string | null;
  setShowStatsEditor: (id: string | null) => void;
  handleSaveEdit: (id: string) => void;
  handleCancelEdit: () => void;
  handleAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  charactersWithSolicitudes: { id: string; name: string; solicitudDefinitions: SolicitudDefinition[] }[];
  availableTargets?: Array<{
    id: string;
    name: string;
    attributes: Array<{ key: string; name: string; type: 'number' | 'keyword' | 'text'; min?: number; max?: number }>;
  }>;
  items: Item[];
  addToPersona: (personaId: string, itemId: string, quantity?: number) => void;
  removeFromPersona: (personaId: string, itemId: string, quantity?: number) => void;
  getPersonaItems: (personaId: string) => Array<{ entry: { itemId: string; quantity: number; equipped: boolean }; item: Item }>;
}

function PersonaEditorPanel({
  persona,
  editForm,
  setEditForm,
  uploading,
  fileInputRef,
  showStatsEditor,
  setShowStatsEditor,
  handleSaveEdit,
  handleCancelEdit,
  handleAvatarUpload,
  charactersWithSolicitudes,
  availableTargets,
  items,
  addToPersona,
  removeFromPersona,
  getPersonaItems,
}: PersonaEditorPanelProps) {
  if (!persona) return null;

  // Get current persona inventory items
  const personaInventoryItems = getPersonaItems(persona.id);
  // Items NOT in persona's inventory (available to add)
  const availableItemsToAdd = items.filter(
    item => !persona.inventoryItems?.some(e => e.itemId === item.id)
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="h-full flex flex-col"
    >
      {/* Compact Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <Button variant="ghost" size="icon" onClick={handleCancelEdit} className="h-8 w-8 shrink-0" disabled={uploading}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Avatar className="w-8 h-8 border-2 border-violet-500/30 shrink-0">
            <AvatarImage src={editForm.avatar} />
            <AvatarFallback className="bg-violet-500/20">
              <User className="w-4 h-4 text-violet-600" />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="text-base font-bold truncate">{editForm.name || 'Nueva Persona'}</h2>
            <p className="text-[11px] text-muted-foreground truncate">Edita la información y configuración de la persona</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleCancelEdit} disabled={uploading}>
            Cancelar
          </Button>
          <Button 
            size="sm"
            onClick={() => handleSaveEdit(persona.id)} 
            disabled={uploading || !editForm.name.trim()}
            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
            Guardar
          </Button>
        </div>
      </div>

      {/* Scrollable Content - Two columns on lg+ */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_340px] gap-6 p-6 w-full">
          {/* Left Column - Editor */}
          <div className="space-y-6 min-w-0">
            {/* Basic Info - Horizontal layout: avatar left, fields right */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <div className="p-1.5 rounded-md bg-violet-500/10">
                  <User className="w-4 h-4 text-violet-500" />
                </div>
                Información Básica
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-5 p-4 rounded-xl border border-border/60 bg-gradient-to-br from-muted/30 to-muted/10">
                {/* Avatar Column */}
                <div className="relative shrink-0">
                  <Avatar 
                    className={cn(
                      "w-24 h-24 border-2 border-dashed border-muted-foreground/30",
                      !uploading && "cursor-pointer hover:border-violet-500/50"
                    )} 
                    onClick={() => !uploading && fileInputRef.current?.click()}
                  >
                    <AvatarImage src={editForm.avatar} />
                    <AvatarFallback className="bg-violet-500/20">
                      {uploading ? (
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                      ) : (
                        <User className="w-8 h-8 text-muted-foreground" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Upload className="w-3 h-3" />
                    )}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={uploading}
                  />
                </div>
                {/* Fields Column */}
                <div className="flex flex-col space-y-3 min-w-0">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Nombre de la Persona</Label>
                    <Input
                      value={editForm.name}
                      onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Nombre de Persona"
                      className="h-10"
                      disabled={uploading}
                    />
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <Label className="text-xs text-muted-foreground">Descripción</Label>
                    <Textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe la personalidad, antecedentes, motivaciones..."
                      rows={6}
                      className="text-sm resize-none flex-1"
                      disabled={uploading}
                    />
                  </div>
                </div>
              </div>
            </div>

            <Separator className="bg-border/50" />

            {/* Divisa Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <div className="p-1.5 rounded-md bg-amber-500/10">
                  <Coins className="w-4 h-4 text-amber-500" />
                </div>
                Divisa
              </div>
              <div className="p-4 rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-amber-500/10 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Currency Icon */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Icono</Label>
                    <Input
                      value={editForm.currencyIcon}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.length <= 4) {
                          setEditForm(prev => ({ ...prev, currencyIcon: val }));
                        }
                      }}
                      placeholder="💰"
                      className="h-10 text-center text-lg"
                      maxLength={4}
                      disabled={uploading}
                    />
                  </div>
                  {/* Currency Name */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Nombre</Label>
                    <Input
                      value={editForm.currencyName}
                      onChange={(e) => setEditForm(prev => ({ ...prev, currencyName: e.target.value }))}
                      placeholder="Divisa"
                      className="h-10"
                      disabled={uploading}
                    />
                  </div>
                  {/* Currency Amount */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Cantidad</Label>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 shrink-0 border-amber-500/30 hover:bg-amber-500/10"
                        onClick={() => setEditForm(prev => ({ ...prev, currency: Math.max(0, prev.currency - 1) }))}
                        disabled={uploading}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <Input
                        type="number"
                        value={editForm.currency}
                        onChange={(e) => setEditForm(prev => ({ ...prev, currency: Math.max(0, parseInt(e.target.value) || 0) }))}
                        className="h-10 text-center font-mono"
                        min={0}
                        disabled={uploading}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 shrink-0 border-amber-500/30 hover:bg-amber-500/10"
                        onClick={() => setEditForm(prev => ({ ...prev, currency: prev.currency + 1 }))}
                        disabled={uploading}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                {/* Currency preview */}
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/15">
                  <span className="text-lg">{editForm.currencyIcon || '💰'}</span>
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                    {editForm.currencyName || 'Divisa'}
                  </span>
                  <span className="text-sm font-bold text-amber-600 dark:text-amber-400 ml-auto">
                    {editForm.currency}
                  </span>
                </div>
              </div>
            </div>

            <Separator className="bg-border/50" />

            {/* Inventory Items Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <div className="p-1.5 rounded-md bg-emerald-500/10">
                  <PackageOpen className="w-4 h-4 text-emerald-500" />
                </div>
                Items del Inventario
                {personaInventoryItems.length > 0 && (
                  <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px]">
                    {personaInventoryItems.length} items
                  </Badge>
                )}
              </div>
              <div className="p-4 rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 space-y-4">
                {/* Current inventory items */}
                {personaInventoryItems.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {personaInventoryItems.map(({ entry, item }) => (
                      <div
                        key={entry.itemId}
                        className={cn(
                          'flex items-center gap-2.5 p-2.5 rounded-lg border',
                          getRarityBgColor(item.rarity)
                        )}
                      >
                        <span className="text-lg shrink-0">{item.icon || getItemTypeIcon(item.type || 'consumable')}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={cn('text-sm font-medium truncate', getRarityColor(item.rarity))}>
                              {item.name}
                            </span>
                            <Badge className={cn('text-[9px] px-1.5 py-0 border', getRarityBgColor(item.rarity))}>
                              {getItemTypeLabel(item.type || 'consumable')}
                            </Badge>
                            {entry.equipped && (
                              <Badge className="text-[9px] px-1.5 py-0 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                Equipado
                              </Badge>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{item.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {entry.quantity > 1 && (
                            <span className="text-xs text-muted-foreground font-mono">x{entry.quantity}</span>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => removeFromPersona(persona.id, entry.itemId)}
                            disabled={uploading}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <PackageOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Sin items en el inventario</p>
                    <p className="text-xs mt-1">Agrega items del registro global</p>
                  </div>
                )}

                {/* Add item from registry - Multi-add dropdown */}
                {availableItemsToAdd.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-emerald-500/15">
                    <Label className="text-xs text-muted-foreground">Agregar items del registro</Label>
                    <div className="relative">
                      <Select
                        onValueChange={(itemId) => {
                          addToPersona(persona.id, itemId, 1);
                        }}
                      >
                        <SelectTrigger className="flex-1 h-10">
                          <SelectValue placeholder="Seleccionar item para agregar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableItemsToAdd.map(item => (
                            <SelectItem key={item.id} value={item.id}>
                              <span className="flex items-center gap-2">
                                <span>{item.icon || getItemTypeIcon(item.type || 'consumable')}</span>
                                <span>{item.name}</span>
                                <span className="text-xs text-muted-foreground">({getItemTypeLabel(item.type || 'consumable')})</span>
                                {item.price > 0 && (
                                  <span className="text-xs text-amber-400 ml-1">💰{item.price}</span>
                                )}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Selecciona un item para agregarlo. Puedes agregar varios uno por uno.
                      </p>
                    </div>
                    {/* Quick add buttons for fast multi-selection */}
                    {availableItemsToAdd.length <= 8 && (
                      <div className="flex flex-wrap gap-1.5">
                        {availableItemsToAdd.map(item => (
                          <button
                            key={item.id}
                            onClick={() => addToPersona(persona.id, item.id, 1)}
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                            title={`Agregar ${item.name}`}
                          >
                            <span>{item.icon || getItemTypeIcon(item.type || 'consumable')}</span>
                            <span>{item.name}</span>
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {items.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    No hay items en el registro global. Crea items primero en la sección de Inventario.
                  </p>
                )}
              </div>
            </div>

            <Separator className="bg-border/50" />

            {/* Stats System - Uses shared StatsEditor component (same as character editor) */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <div className="p-1.5 rounded-md bg-cyan-500/10">
                  <Settings2 className="w-4 h-4 text-cyan-500" />
                </div>
                Atributos y Estadísticas
                {(editForm.statsConfig?.attributes?.length || 0) > 0 && (
                  <Badge className="bg-violet-500/20 text-violet-400 text-[10px]">
                    {editForm.statsConfig?.attributes?.length} atributos
                  </Badge>
                )}
                {(editForm.statsConfig?.invitations?.length || 0) > 0 && (
                  <Badge className="bg-blue-500/20 text-blue-400 text-[10px]">
                    {editForm.statsConfig?.invitations?.length} peticiones
                  </Badge>
                )}
                {(editForm.statsConfig?.solicitudDefinitions?.length || 0) > 0 && (
                  <Badge className="bg-amber-500/20 text-amber-400 text-[10px]">
                    {editForm.statsConfig?.solicitudDefinitions?.length} solicitudes
                  </Badge>
                )}
              </div>

              <StatsEditor
                statsConfig={editForm.statsConfig}
                onChange={(statsConfig) => setEditForm(prev => ({ ...prev, statsConfig }))}
                allCharacters={charactersWithSolicitudes}
                availableTargets={availableTargets}
              />
            </div>
          </div>

          {/* Right Sidebar - Info (visible on lg+) */}
          <div className="hidden lg:block space-y-4">
            <div className="sticky top-0 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <div className="p-1.5 rounded-md bg-slate-500/10">
                  <HelpCircle className="w-4 h-4 text-slate-500" />
                </div>
                Información
              </div>
              <div className="p-4 rounded-xl border border-border/60 bg-gradient-to-br from-muted/30 to-muted/10 space-y-3">
                <p className="text-xs text-muted-foreground">
                  <strong>Divisa:</strong> La moneda del persona. Personaliza el icono, nombre y cantidad. Se usa en el sistema de tienda y se incluye en el prompt del inventario.
                </p>
                <p className="text-xs text-muted-foreground">
                  <strong>Items:</strong> Los objetos que posee el persona. Los consumibles tienen efectos temporales por turnos; el equipo modifica atributos permanentemente mientras está equipado.
                </p>
                <p className="text-xs text-muted-foreground">
                  <strong>Atributos:</strong> Propiedades del usuario (vida, resistencia, etc.) que se muestran en el HUD y se resuelven como {'{key}'} en la descripción.
                </p>
                <p className="text-xs text-muted-foreground">
                  <strong>Peticiones:</strong> Solicitudes que puedes hacer a los personajes. Aparecerán como tags rapidos en el chatbox.
                </p>
                <p className="text-xs text-muted-foreground">
                  <strong>Solicitudes:</strong> Peticiones que los personajes pueden hacerte. Aparecerán en un panel para aceptar o rechazar.
                </p>
              </div>

              {/* Quick Stats Summary */}
              <>
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <div className="p-1.5 rounded-md bg-emerald-500/10">
                    <Settings2 className="w-4 h-4 text-emerald-500" />
                  </div>
                  Resumen
                </div>
                <div className="p-4 rounded-xl border border-border/60 bg-gradient-to-br from-muted/30 to-muted/10 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{editForm.currencyIcon} {editForm.currencyName || 'Divisa'}</span>
                    <span className="font-medium text-amber-600 dark:text-amber-400">{editForm.currency}</span>
                  </div>
                  <Separator className="bg-border/30" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Items</span>
                    <span className="font-medium">{personaInventoryItems.length}</span>
                  </div>
                  <Separator className="bg-border/30" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Equipados</span>
                    <span className="font-medium">{personaInventoryItems.filter(({ entry }) => entry.equipped).length}</span>
                  </div>
                  {editForm.statsConfig?.enabled && (
                    <>
                      <Separator className="bg-border/30" />
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Atributos</span>
                        <span className="font-medium">{(editForm.statsConfig.attributes?.length || 0)}</span>
                      </div>
                      <Separator className="bg-border/30" />
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Acciones</span>
                        <span className="font-medium">{(editForm.statsConfig.skills?.length || 0)}</span>
                      </div>
                      <Separator className="bg-border/30" />
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Intenciones</span>
                        <span className="font-medium">{(editForm.statsConfig.intentions?.length || 0)}</span>
                      </div>
                      <Separator className="bg-border/30" />
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Peticiones</span>
                        <span className="font-medium">{(editForm.statsConfig.invitations?.length || 0)}</span>
                      </div>
                      <Separator className="bg-border/30" />
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Solicitudes</span>
                        <span className="font-medium">{(editForm.statsConfig.solicitudDefinitions?.length || 0)}</span>
                      </div>
                    </>
                  )}
                </div>
              </>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

