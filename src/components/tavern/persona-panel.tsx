'use client';

import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Trash2, 
  Check, 
  User,
  Edit2,
  X,
  Upload,
  Loader2,
  HelpCircle,
  Users,
  Sparkles,
  Mail,
  Inbox,
  Send,
  Target,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Settings2,
  Zap,
  ArrowLeft,
  Save,
} from 'lucide-react';
import { useState, useRef, useMemo } from 'react';
import type { 
  Persona, 
  CharacterCard, 
  CharacterStatsConfig, 
  SolicitudDefinition, 
  InvitationDefinition,
  StatRequirement,
} from '@/types';
import { DEFAULT_STATS_BLOCK_HEADERS } from '@/types';
import { getLogger } from '@/lib/logger';

const personaLogger = getLogger('persona');

// Default stats config for Persona (only petitions/solicitudes, no attributes/skills)
const DEFAULT_PERSONA_STATS_CONFIG: CharacterStatsConfig = {
  enabled: false,
  attributes: [],
  skills: [],
  intentions: [],
  invitations: [],
  solicitudDefinitions: [],
  blockHeaders: DEFAULT_STATS_BLOCK_HEADERS,
};

export function PersonaPanel() {
  const { 
    personas, 
    activePersonaId,
    characters,
    addPersona, 
    updatePersona, 
    deletePersona, 
    setActivePersona 
  } = useTavernStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    description: string;
    avatar: string;
    statsConfig?: CharacterStatsConfig;
  }>({
    name: '',
    description: '',
    avatar: '',
    statsConfig: undefined,
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

  const handleCreatePersona = () => {
    const newPersona: Omit<Persona, 'id' | 'createdAt' | 'updatedAt'> = {
      name: 'Nueva Persona',
      description: '',
      avatar: '',
      isActive: false
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
    });
  };

  const handleStartEdit = (persona: Persona) => {
    setEditingId(persona.id);
    setEditForm({
      name: persona.name,
      description: persona.description,
      avatar: persona.avatar,
      statsConfig: persona.statsConfig ? { ...persona.statsConfig } : undefined,
    });
  };

  const handleSaveEdit = (id: string) => {
    if (!editForm.name.trim()) return;
    
    updatePersona(id, {
      name: editForm.name.trim(),
      description: editForm.description,
      avatar: editForm.avatar,
      statsConfig: editForm.statsConfig,
    });
    setEditingId(null);
    setEditForm({ name: '', description: '', avatar: '', statsConfig: undefined });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: '', description: '', avatar: '', statsConfig: undefined });
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

  const handleToggleStats = (enabled: boolean) => {
    setEditForm(prev => ({
      ...prev,
      statsConfig: enabled 
        ? { ...DEFAULT_PERSONA_STATS_CONFIG, enabled: true }
        : { ...(prev.statsConfig || DEFAULT_PERSONA_STATS_CONFIG), enabled: false },
    }));
  };

  // Solicitud Definition handlers (requests user can receive)
  const handleAddSolicitud = () => {
    const newSolicitud: SolicitudDefinition = {
      id: `solicitud-${Date.now()}`,
      name: 'Nueva Solicitud',
      peticionKey: '',
      solicitudKey: '',
      peticionDescription: '',
      solicitudDescription: '',
      requirements: [],
    };
    setEditForm(prev => ({
      ...prev,
      statsConfig: {
        ...(prev.statsConfig || DEFAULT_PERSONA_STATS_CONFIG),
        solicitudDefinitions: [
          ...(prev.statsConfig?.solicitudDefinitions || []),
          newSolicitud,
        ],
      },
    }));
  };

  const handleUpdateSolicitud = (index: number, updates: Partial<SolicitudDefinition>) => {
    setEditForm(prev => {
      const solicitudes = [...(prev.statsConfig?.solicitudDefinitions || [])];
      solicitudes[index] = { ...solicitudes[index], ...updates };
      return {
        ...prev,
        statsConfig: {
          ...(prev.statsConfig || DEFAULT_PERSONA_STATS_CONFIG),
          solicitudDefinitions: solicitudes,
        },
      };
    });
  };

  const handleDeleteSolicitud = (index: number) => {
    setEditForm(prev => ({
      ...prev,
      statsConfig: {
        ...(prev.statsConfig || DEFAULT_PERSONA_STATS_CONFIG),
        solicitudDefinitions: (prev.statsConfig?.solicitudDefinitions || []).filter((_, i) => i !== index),
      },
    }));
  };

  // Invitation handlers (petitions user can send)
  const handleAddInvitation = () => {
    const newInvitation: InvitationDefinition = {
      id: `invitation-${Date.now()}`,
      name: 'Nueva Peticion',
      requirements: [],
    };
    setEditForm(prev => ({
      ...prev,
      statsConfig: {
        ...(prev.statsConfig || DEFAULT_PERSONA_STATS_CONFIG),
        invitations: [
          ...(prev.statsConfig?.invitations || []),
          newInvitation,
        ],
      },
    }));
  };

  const handleUpdateInvitation = (index: number, updates: Partial<InvitationDefinition>) => {
    setEditForm(prev => {
      const invitations = [...(prev.statsConfig?.invitations || [])];
      invitations[index] = { ...invitations[index], ...updates };
      return {
        ...prev,
        statsConfig: {
          ...(prev.statsConfig || DEFAULT_PERSONA_STATS_CONFIG),
          invitations: invitations,
        },
      };
    });
  };

  const handleDeleteInvitation = (index: number) => {
    setEditForm(prev => ({
      ...prev,
      statsConfig: {
        ...(prev.statsConfig || DEFAULT_PERSONA_STATS_CONFIG),
        invitations: (prev.statsConfig?.invitations || []).filter((_, i) => i !== index),
      },
    }));
  };

  // Find the persona being edited
  const editingPersona = editingId ? personas.find(p => p.id === editingId) : null;

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
          handleToggleStats={handleToggleStats}
          handleAddSolicitud={handleAddSolicitud}
          handleUpdateSolicitud={handleUpdateSolicitud}
          handleDeleteSolicitud={handleDeleteSolicitud}
          handleAddInvitation={handleAddInvitation}
          handleUpdateInvitation={handleUpdateInvitation}
          handleDeleteInvitation={handleDeleteInvitation}
          charactersWithSolicitudes={charactersWithSolicitudes}
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
  };
  setEditForm: React.Dispatch<React.SetStateAction<{
    name: string;
    description: string;
    avatar: string;
    statsConfig?: CharacterStatsConfig;
  }>>;
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  showStatsEditor: string | null;
  setShowStatsEditor: (id: string | null) => void;
  handleSaveEdit: (id: string) => void;
  handleCancelEdit: () => void;
  handleAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleToggleStats: (enabled: boolean) => void;
  handleAddSolicitud: () => void;
  handleUpdateSolicitud: (index: number, updates: Partial<SolicitudDefinition>) => void;
  handleDeleteSolicitud: (index: number) => void;
  handleAddInvitation: () => void;
  handleUpdateInvitation: (index: number, updates: Partial<InvitationDefinition>) => void;
  handleDeleteInvitation: (index: number) => void;
  charactersWithSolicitudes: { id: string; name: string; solicitudDefinitions: SolicitudDefinition[] }[];
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
  handleToggleStats,
  handleAddSolicitud,
  handleUpdateSolicitud,
  handleDeleteSolicitud,
  handleAddInvitation,
  handleUpdateInvitation,
  handleDeleteInvitation,
  charactersWithSolicitudes,
}: PersonaEditorPanelProps) {
  if (!persona) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="h-full flex flex-col"
    >
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleCancelEdit} className="h-9 w-9" disabled={uploading}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10 border-2 border-violet-500/30">
              <AvatarImage src={editForm.avatar} />
              <AvatarFallback className="bg-violet-500/20">
                <User className="w-5 h-5 text-violet-600" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-bold">{editForm.name || 'Nueva Persona'}</h2>
              <p className="text-xs text-muted-foreground">Edita la información y configuración de la persona</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleCancelEdit} disabled={uploading}>
            Cancelar
          </Button>
          <Button 
            onClick={() => handleSaveEdit(persona.id)} 
            disabled={uploading || !editForm.name.trim()}
            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white"
          >
            {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Guardar
          </Button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 2xl:grid-cols-[1fr_320px] gap-6 p-6 max-w-5xl mx-auto w-full">
          {/* Left Column - Editor */}
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <div className="p-1.5 rounded-md bg-violet-500/10">
                  <User className="w-4 h-4 text-violet-500" />
                </div>
                Información Básica
              </div>
              <div className="flex items-start gap-6 p-4 rounded-xl border border-border/60 bg-gradient-to-br from-muted/30 to-muted/10">
                <div className="relative shrink-0">
                  <Avatar 
                    className={cn(
                      "w-20 h-20 border-2 border-dashed border-muted-foreground/30",
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
                <div className="flex-1 space-y-3">
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
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Descripción</Label>
                    <Textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe la personalidad, antecedentes, motivaciones..."
                      rows={4}
                      className="text-sm resize-none"
                      disabled={uploading}
                    />
                  </div>
                </div>
              </div>
            </div>

            <Separator className="bg-border/50" />

            {/* Peticiones y Solicitudes */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <div className="p-1.5 rounded-md bg-cyan-500/10">
                  <Settings2 className="w-4 h-4 text-cyan-500" />
                </div>
                Peticiones y Solicitudes
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

              <div className="space-y-4">
                {/* Enable/Disable */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-gradient-to-br from-muted/30 to-muted/10">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={editForm.statsConfig?.enabled || false}
                      onCheckedChange={handleToggleStats}
                    />
                    <div>
                      <Label className="text-xs font-medium cursor-pointer">Habilitar sistema de peticiones</Label>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Permite enviar peticiones y recibir solicitudes de personajes
                      </p>
                    </div>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Activa el sistema para configurar peticiones y solicitudes.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>

                {editForm.statsConfig?.enabled && (
                  <>
                    {/* Invitaciones (Peticiones) */}
                    <div className="space-y-3 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Send className="w-4 h-4 text-blue-400" />
                          <Label className="text-sm font-medium text-blue-400">Peticiones (enviar)</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Peticiones que puedes hacer a otros personajes.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={handleAddInvitation}
                        >
                          <Plus className="w-3 h-3 mr-1" /> Agregar
                        </Button>
                      </div>
                      
                      {(editForm.statsConfig?.invitations || []).map((invitation, idx) => (
                        <PersonaInvitationEditor
                          key={invitation.id}
                          invitation={invitation}
                          index={idx}
                          allCharacters={charactersWithSolicitudes}
                          onChange={handleUpdateInvitation}
                          onDelete={handleDeleteInvitation}
                        />
                      ))}
                      {(editForm.statsConfig?.invitations || []).length === 0 && (
                        <p className="text-xs text-muted-foreground italic pl-6">
                          Sin peticiones configuradas. Agrega una para poder solicitar cosas a los personajes.
                        </p>
                      )}
                    </div>

                    {/* Solicitudes (recibir) */}
                    <div className="space-y-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Inbox className="w-4 h-4 text-amber-400" />
                          <Label className="text-sm font-medium text-amber-400">Solicitudes (recibir)</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Solicitudes que los personajes pueden hacerte.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={handleAddSolicitud}
                        >
                          <Plus className="w-3 h-3 mr-1" /> Agregar
                        </Button>
                      </div>
                      
                      {(editForm.statsConfig?.solicitudDefinitions || []).map((solicitud, idx) => (
                        <PersonaSolicitudEditor
                          key={solicitud.id}
                          solicitud={solicitud}
                          index={idx}
                          onChange={handleUpdateSolicitud}
                          onDelete={handleDeleteSolicitud}
                        />
                      ))}
                      {(editForm.statsConfig?.solicitudDefinitions || []).length === 0 && (
                        <p className="text-xs text-muted-foreground italic pl-6">
                          Sin solicitudes configuradas. Los personajes no podrán hacerte peticiones.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar - Info (visible on 2xl) */}
          <div className="hidden 2xl:block space-y-4">
            <div className="sticky top-0 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <div className="p-1.5 rounded-md bg-slate-500/10">
                  <HelpCircle className="w-4 h-4 text-slate-500" />
                </div>
                Información
              </div>
              <div className="p-4 rounded-xl border border-border/60 bg-gradient-to-br from-muted/30 to-muted/10 space-y-3">
                <p className="text-xs text-muted-foreground">
                  <strong>Peticiones:</strong> Solicitudes que puedes hacer a los personajes. Aparecerán como tags rapidos en el chatbox.
                </p>
                <p className="text-xs text-muted-foreground">
                  <strong>Solicitudes:</strong> Peticiones que los personajes pueden hacerte. Aparecerán en un panel para aceptar o rechazar.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

interface PersonaInvitationEditorProps {
  invitation: InvitationDefinition;
  index: number;
  allCharacters: { id: string; name: string; solicitudDefinitions: SolicitudDefinition[] }[];
  onChange: (index: number, updates: Partial<InvitationDefinition>) => void;
  onDelete: (index: number) => void;
}

function PersonaInvitationEditor({ 
  invitation, 
  index, 
  allCharacters,
  onChange, 
  onDelete 
}: PersonaInvitationEditorProps) {
  const [expanded, setExpanded] = useState(false);

  // Get selected character's solicitudes
  const selectedCharacter = allCharacters.find(c => c.id === invitation.objetivo?.characterId);
  const selectedSolicitud = selectedCharacter?.solicitudDefinitions.find(
    s => s.id === invitation.objetivo?.solicitudId
  );

  return (
    <div className="border rounded-lg bg-muted/30">
      <div
        className="flex items-center justify-between p-2 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <GripVertical className="w-3 h-3 text-muted-foreground cursor-grab" />
          <Mail className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-xs font-medium">{invitation.name || `Peticion #${index + 1}`}</span>
          {selectedSolicitud && (
            <code className="text-[10px] bg-blue-500/10 text-blue-400 px-1 py-0.5 rounded">
              {selectedSolicitud.peticionKey}
            </code>
          )}
          {selectedCharacter && (
            <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20">
              → {selectedCharacter.name}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={(e) => { e.stopPropagation(); onDelete(index); }}
          >
            <Trash2 className="w-3 h-3 text-destructive" />
          </Button>
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t">
          <div className="pt-2">
            <Label className="text-[10px] mb-1 block">Nombre *</Label>
            <Input
              value={invitation.name}
              onChange={(e) => onChange(index, { name: e.target.value })}
              placeholder="Petición de madera"
              className="h-7 text-xs"
            />
          </div>

          {/* Target Selection */}
          <div className="space-y-1.5 p-2 bg-blue-500/10 rounded border border-blue-500/20">
            <div className="flex items-center gap-1.5">
              <Target className="w-3 h-3 text-blue-400" />
              <Label className="text-[10px] font-medium text-blue-400">Personaje Objetivo</Label>
            </div>

            <Select
              value={invitation.objetivo?.characterId || ''}
              onValueChange={(v) => {
                onChange(index, {
                  objetivo: v ? { characterId: v, solicitudId: '' } : undefined
                });
              }}
            >
              <SelectTrigger className="h-7 bg-background text-xs">
                <SelectValue placeholder="Seleccionar personaje..." />
              </SelectTrigger>
              <SelectContent>
                {allCharacters.filter(c => c.solicitudDefinitions.length > 0).map(char => (
                  <SelectItem key={char.id} value={char.id}>
                    {char.name} ({char.solicitudDefinitions.length} solicitudes)
                  </SelectItem>
                ))}
                {allCharacters.filter(c => c.solicitudDefinitions.length > 0).length === 0 && (
                  <SelectItem value="_none" disabled>No hay personajes con solicitudes</SelectItem>
                )}
              </SelectContent>
            </Select>

            {selectedCharacter && (
              <>
                <Label className="text-[10px] text-blue-300">Solicitud a solicitar:</Label>
                <Select
                  value={invitation.objetivo?.solicitudId || ''}
                  onValueChange={(v) => onChange(index, {
                    objetivo: { ...invitation.objetivo!, solicitudId: v }
                  })}
                >
                  <SelectTrigger className="h-7 bg-background text-xs">
                    <SelectValue placeholder="Seleccionar solicitud..." />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedCharacter.solicitudDefinitions.map(sol => (
                      <SelectItem key={sol.id} value={sol.id}>
                        {sol.name} ({sol.peticionKey})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedSolicitud && (
                  <div className="p-1.5 bg-background/50 rounded border text-[10px] space-y-0.5">
                    <p><strong>Key:</strong> <code className="bg-muted px-1 rounded">{selectedSolicitud.peticionKey}</code></p>
                    <p className="text-muted-foreground">{selectedSolicitud.peticionDescription || '(sin descripción)'}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Persona Solicitud Editor Component
// ============================================

interface PersonaSolicitudEditorProps {
  solicitud: SolicitudDefinition;
  index: number;
  onChange: (index: number, updates: Partial<SolicitudDefinition>) => void;
  onDelete: (index: number) => void;
}

function PersonaSolicitudEditor({ 
  solicitud, 
  index, 
  onChange, 
  onDelete 
}: PersonaSolicitudEditorProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg bg-muted/30">
      <div
        className="flex items-center justify-between p-2 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <GripVertical className="w-3 h-3 text-muted-foreground cursor-grab" />
          <Inbox className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-medium">{solicitud.name || `Solicitud #${index + 1}`}</span>
          {solicitud.peticionKey && (
            <code className="text-[10px] bg-amber-500/10 text-amber-400 px-1 py-0.5 rounded">
              {solicitud.peticionKey}
            </code>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={(e) => { e.stopPropagation(); onDelete(index); }}
          >
            <Trash2 className="w-3 h-3 text-destructive" />
          </Button>
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t">
          <div className="pt-2">
            <Label className="text-[10px] mb-1 block">Nombre *</Label>
            <Input
              value={solicitud.name}
              onChange={(e) => onChange(index, { name: e.target.value })}
              placeholder="Dar madera"
              className="h-7 text-xs"
            />
          </div>

          {/* Peticion Activation Keys */}
          <div className="p-2 bg-amber-500/10 rounded border border-amber-500/20 space-y-2">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-amber-400" />
              <Label className="text-[10px] font-medium text-amber-400">Key de Petición (Activación)</Label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[9px] text-muted-foreground mb-0.5 block">Key principal *</Label>
                <Input
                  value={solicitud.peticionKey}
                  onChange={(e) => onChange(index, { peticionKey: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  placeholder="pedir_madera"
                  className="h-7 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-[9px] text-muted-foreground mb-0.5 block">Keys alternativas</Label>
                <Input
                  value={(solicitud.peticionActivationKeys || []).join(', ')}
                  onChange={(e) => {
                    const keys = e.target.value.split(',').map(k => k.trim().toLowerCase().replace(/\s+/g, '_')).filter(Boolean);
                    onChange(index, { peticionActivationKeys: keys.length > 0 ? keys : undefined });
                  }}
                  placeholder="pm, pedir"
                  className="h-7 text-xs"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={solicitud.peticionKeyCaseSensitive || false}
                onCheckedChange={(checked) => onChange(index, { peticionKeyCaseSensitive: checked })}
                className="scale-75"
              />
              <Label className="text-[9px]">Distinguir mayúsculas/minúsculas</Label>
            </div>
          </div>

          {/* Solicitud Completion Keys */}
          <div className="p-2 bg-emerald-500/10 rounded border border-emerald-500/20 space-y-2">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-emerald-400" />
              <Label className="text-[10px] font-medium text-emerald-400">Key de Solicitud (Completación)</Label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[9px] text-muted-foreground mb-0.5 block">Key principal *</Label>
                <Input
                  value={solicitud.solicitudKey}
                  onChange={(e) => onChange(index, { solicitudKey: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  placeholder="dar_madera"
                  className="h-7 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-[9px] text-muted-foreground mb-0.5 block">Keys alternativas</Label>
                <Input
                  value={(solicitud.solicitudActivationKeys || []).join(', ')}
                  onChange={(e) => {
                    const keys = e.target.value.split(',').map(k => k.trim().toLowerCase().replace(/\s+/g, '_')).filter(Boolean);
                    onChange(index, { solicitudActivationKeys: keys.length > 0 ? keys : undefined });
                  }}
                  placeholder="dm, dar"
                  className="h-7 text-xs"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={solicitud.solicitudKeyCaseSensitive || false}
                onCheckedChange={(checked) => onChange(index, { solicitudKeyCaseSensitive: checked })}
                className="scale-75"
              />
              <Label className="text-[9px]">Distinguir mayúsculas/minúsculas</Label>
            </div>
          </div>

          <div>
            <Label className="text-[10px] mb-1 block">Descripción de Petición</Label>
            <Textarea
              value={solicitud.peticionDescription}
              onChange={(e) => onChange(index, { peticionDescription: e.target.value })}
              placeholder="Lo que vera el personaje cuando quiera hacerte esta peticion..."
              className="min-h-[40px] text-xs"
            />
          </div>

          <div>
            <Label className="text-[10px] mb-1 block">Descripción de Solicitud</Label>
            <Textarea
              value={solicitud.solicitudDescription}
              onChange={(e) => onChange(index, { solicitudDescription: e.target.value })}
              placeholder="Lo que veras tu cuando recibas esta solicitud..."
              className="min-h-[40px] text-xs"
            />
          </div>

          <div>
            <div className="flex items-center gap-1 mb-1">
              <Label className="text-[10px]">Descripción de Completado</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Texto que se guardará en el evento "ultima_solicitud_completada" cuando se complete esta solicitud.</p>
                  <p className="mt-1 text-xs text-muted-foreground">Describe la acción completada.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Textarea
              value={solicitud.completionDescription || ''}
              onChange={(e) => onChange(index, { completionDescription: e.target.value })}
              placeholder="Has entregado madera al solicitante..."
              className="min-h-[40px] text-xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}
