'use client';

import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  AnimatePresence,
  motion,
} from 'framer-motion';
import {
  Plus,
  Trash2,
  Users,
  UserCheck,
  UserX,
  MessageSquare,
  HelpCircle,
  Sparkles,
  RefreshCw,
  Shuffle,
  Zap,
  Brain,
  Settings,
  Layers,
  BookOpen,
  ScrollText,
  Package,
  Palette,
  Ghost,
  X,
  Search,
  FileText,
  Database,
  Camera,
  Loader2,
} from 'lucide-react';
import { useState, useRef, useMemo, useEffect } from 'react';
import type { GroupMember, GroupActivationStrategy, NarratorResponseMode, NarratorSettings } from '@/types';
import { HUDSelector } from './hud-selector';
import { LorebookSelector } from './lorebook-selector';
import { QuestSelector } from './quest-selector';
import { NamespaceSelector } from './namespace-selector';
import { useToast } from '@/hooks/use-toast';

// Strategy color helper
const getStrategyColorClasses = (color: string) => {
  const colorMap: Record<string, { bg: string; border: string; text: string; bgLight: string; bgSelected: string }> = {
    emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-600', bgLight: 'bg-emerald-500/5', bgSelected: 'bg-emerald-500/20' },
    blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-600', bgLight: 'bg-blue-500/5', bgSelected: 'bg-blue-500/20' },
    purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-600', bgLight: 'bg-purple-500/5', bgSelected: 'bg-purple-500/20' },
    amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-600', bgLight: 'bg-amber-500/5', bgSelected: 'bg-amber-500/20' },
    cyan: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', text: 'text-cyan-600', bgLight: 'bg-cyan-500/5', bgSelected: 'bg-cyan-500/20' },
  };
  return colorMap[color] || colorMap.emerald;
};

// Default narrator settings
const DEFAULT_NARRATOR_SETTINGS: NarratorSettings = {
  responseMode: 'turn_end',
  conditional: {
    minTurnInterval: 0,
    onlyWhenNoActiveQuests: false
  },
  hiddenFromChat: false,
  showSprite: false
};

// Narrator response mode info
const narratorModeInfo: Record<NarratorResponseMode, {
  name: string;
  description: string;
  icon: React.ReactNode;
}> = {
  turn_start: {
    name: 'Inicio del Turno',
    description: 'El narrador habla primero, antes que cualquier personaje',
    icon: <RefreshCw className="w-3.5 h-3.5" />
  },
  turn_end: {
    name: 'Final del Turno',
    description: 'El narrador habla último, después de todos los personajes',
    icon: <RefreshCw className="w-3.5 h-3.5" />
  },
  before_each: {
    name: 'Antes de Cada Personaje',
    description: 'El narrador habla antes de cada respuesta de personaje',
    icon: <Users className="w-3.5 h-3.5" />
  },
  after_each: {
    name: 'Después de Cada Personaje',
    description: 'El narrador habla después de cada respuesta de personaje',
    icon: <Users className="w-3.5 h-3.5" />
  }
};

interface GroupEditorProps {
  groupId: string | null;
  open: boolean;
  onClose: () => void;
}

const strategyInfo: Record<GroupActivationStrategy, { 
  name: string; 
  description: string; 
  icon: React.ReactNode;
  tip: string;
  color: string;
}> = {
  all: { 
    name: 'Todos Responden', 
    description: 'Todos los miembros activos responden',
    icon: <Users className="w-3.5 h-3.5" />,
    tip: 'Ideal para conversaciones grupales animadas.',
    color: 'emerald'
  },
  round_robin: { 
    name: 'Por Turno', 
    description: 'Los miembros responden en orden',
    icon: <RefreshCw className="w-3.5 h-3.5" />,
    tip: 'Útil para mantener un flujo ordenado.',
    color: 'blue'
  },
  random: { 
    name: 'Aleatorio', 
    description: 'Miembro(s) aleatorio(s) responden',
    icon: <Shuffle className="w-3.5 h-3.5" />,
    tip: 'Crea dinamismo y sorpresa.',
    color: 'purple'
  },
  reactive: { 
    name: 'Reactivo', 
    description: 'Menciones + Solicitudes',
    icon: <Zap className="w-3.5 h-3.5" />,
    tip: 'Responden los mencionados, personajes con solicitudes pendientes, o se detiene si hay petición al usuario.',
    color: 'amber'
  },
  smart: { 
    name: 'Inteligente', 
    description: 'La IA decide quién responde',
    icon: <Brain className="w-3.5 h-3.5" />,
    tip: 'El modelo elige el personaje más apropiado.',
    color: 'cyan'
  }
};

const groupEditorTabs = [
  { value: 'info', label: 'Información', icon: Palette },
  { value: 'members', label: 'Miembros', icon: Users },
  { value: 'strategy', label: 'Estrategia', icon: Settings },
  { value: 'prompts', label: 'Prompts', icon: FileText },
];

export function GroupEditor({ groupId, open, onClose }: GroupEditorProps) {
  const {
    characters,
    groups,
    addGroup,
    updateGroup,
    deleteGroup,
    addGroupMember,
    removeGroupMember,
    toggleGroupMemberActive,
    toggleGroupMemberPresent,
    toggleGroupMemberNarrator,
    updateGroupMember
  } = useTavernStore();

  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('info');
  const isNewGroup = !groupId;
  const existingGroup = groups.find(g => g.id === groupId);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, onClose]);

  // Get initial values from existing group or defaults
  const initialValues = useMemo(() => {
    if (existingGroup) {
      return {
        name: existingGroup.name || '',
        description: existingGroup.description || '',
        avatar: existingGroup.avatar || '',
        systemPrompt: existingGroup.systemPrompt || '',
        firstMes: existingGroup.firstMes || '',
        activationStrategy: existingGroup.activationStrategy || 'all' as GroupActivationStrategy,
        minResponsesPerTurn: existingGroup.minResponsesPerTurn ?? 1,
        maxResponsesPerTurn: existingGroup.maxResponsesPerTurn ?? 3,
        allowMentions: existingGroup.allowMentions ?? true,
        mentionTriggers: existingGroup.mentionTriggers || [],
        conversationStyle: existingGroup.conversationStyle || 'sequential' as 'sequential' | 'parallel',
        hudTemplateId: existingGroup?.hudTemplateId || null,
        lorebookIds: existingGroup?.lorebookIds || [],
        questTemplateIds: existingGroup?.questTemplateIds || [],
        embeddingNamespaces: existingGroup?.embeddingNamespaces || [],
        narratorSettings: existingGroup?.narratorSettings || DEFAULT_NARRATOR_SETTINGS
      };
    }
    return {
      name: '',
      description: '',
      avatar: '',
      systemPrompt: '',
      firstMes: '',
      activationStrategy: 'all' as GroupActivationStrategy,
      minResponsesPerTurn: 1,
      maxResponsesPerTurn: 3,
      allowMentions: true,
      mentionTriggers: [],
      conversationStyle: 'sequential' as 'sequential' | 'parallel',
      hudTemplateId: null,
      lorebookIds: [],
      questTemplateIds: [],
      embeddingNamespaces: [],
      narratorSettings: DEFAULT_NARRATOR_SETTINGS
    };
  }, [existingGroup]);

  // Local state for new group members (before saving)
  const [localMembers, setLocalMembers] = useState<GroupMember[]>([]);

  // Initialize state from existing group or defaults
  const [name, setName] = useState(initialValues.name);
  const [description, setDescription] = useState(initialValues.description);
  const [systemPrompt, setSystemPrompt] = useState(initialValues.systemPrompt);
  const [firstMes, setFirstMes] = useState(initialValues.firstMes);
  const [activationStrategy, setActivationStrategy] = useState<GroupActivationStrategy>(initialValues.activationStrategy);
  const [minResponsesPerTurn, setMinResponsesPerTurn] = useState(initialValues.minResponsesPerTurn);
  const [maxResponsesPerTurn, setMaxResponsesPerTurn] = useState(initialValues.maxResponsesPerTurn);
  const [allowMentions, setAllowMentions] = useState(initialValues.allowMentions);
  const [conversationStyle, setConversationStyle] = useState<'sequential' | 'parallel'>(initialValues.conversationStyle);
  const [hudTemplateId, setHudTemplateId] = useState<string | null>(initialValues.hudTemplateId);
  const [lorebookIds, setLorebookIds] = useState<string[]>(initialValues.lorebookIds);
  const [questTemplateIds, setQuestTemplateIds] = useState<string[]>(initialValues.questTemplateIds);
  const [embeddingNamespaces, setEmbeddingNamespaces] = useState<string[]>(initialValues.embeddingNamespaces);
  const [narratorSettings, setNarratorSettings] = useState<NarratorSettings>(initialValues.narratorSettings);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(initialValues.avatar);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const [availableSearchQuery, setAvailableSearchQuery] = useState('');

  // Get members - either from existing group or local state
  const members = useMemo(() => {
    if (isNewGroup) {
      return localMembers;
    }
    return existingGroup?.members || [];
  }, [isNewGroup, localMembers, existingGroup?.members]);

  // Member characters with character data
  const memberCharacters = useMemo(() => {
    return members
      .map(m => ({
        ...m,
        character: characters.find(c => c.id === m.characterId)
      }))
      .filter(m => m.character);
  }, [members, characters]);

  // Get available characters (not in group)
  const memberIds = useMemo(() => members.map(m => m.characterId), [members]);
  const availableCharacters = useMemo(() => 
    characters.filter(c => !memberIds.includes(c.id)),
    [characters, memberIds]
  );

  // Filtered lists for search
  const filteredAvailable = useMemo(() =>
    availableCharacters.filter(c =>
      c.name.toLowerCase().includes(availableSearchQuery.toLowerCase()) ||
      c.tags.some(t => t.toLowerCase().includes(availableSearchQuery.toLowerCase()))
    ),
    [availableCharacters, availableSearchQuery]
  );

  const filteredMembers = useMemo(() =>
    memberCharacters.filter(m =>
      m.character!.name.toLowerCase().includes(memberSearchQuery.toLowerCase())
    ),
    [memberCharacters, memberSearchQuery]
  );

  // Local handlers for new groups
  const handleLocalAddMember = (characterId: string) => {
    const newMember: GroupMember = {
      characterId,
      isActive: true,
      isPresent: true,
      isNarrator: false,
      joinOrder: localMembers.length
    };
    setLocalMembers([...localMembers, newMember]);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Imagen muy grande',
        description: 'El tamaño máximo es 5MB.',
        variant: 'destructive'
      });
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Formato no soportado',
        description: 'Usa JPEG, PNG, GIF o WebP.',
        variant: 'destructive'
      });
      return;
    }

    setAvatarUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'group-avatar');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setAvatarUrl(data.url);
      } else {
        toast({
          title: 'Error al subir la imagen',
          description: data.error || 'Error al subir la imagen',
          variant: 'destructive'
        });
      }
    } catch {
      toast({
        title: 'Error de conexión',
        description: 'Error de conexión al subir la imagen',
        variant: 'destructive'
      });
    } finally {
      setAvatarUploading(false);
      if (avatarFileInputRef.current) {
        avatarFileInputRef.current.value = '';
      }
    }
  };

  const handleLocalRemoveMember = (characterId: string) => {
    setLocalMembers(localMembers.filter(m => m.characterId !== characterId));
  };

  const handleLocalToggleActive = (characterId: string) => {
    setLocalMembers(localMembers.map(m => 
      m.characterId === characterId ? { ...m, isActive: !m.isActive } : m
    ));
  };

  const handleLocalTogglePresent = (characterId: string) => {
    setLocalMembers(localMembers.map(m =>
      m.characterId === characterId ? { ...m, isPresent: !m.isPresent } : m
    ));
  };

  const handleLocalToggleNarrator = (characterId: string) => {
    setLocalMembers(localMembers.map(m =>
      m.characterId === characterId ? { ...m, isNarrator: !m.isNarrator } : m
    ));
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast({
        title: 'Nombre requerido',
        description: 'El nombre del grupo es requerido.',
        variant: 'destructive'
      });
      return;
    }

    if (memberCharacters.length === 0) {
      toast({
        title: 'Sin miembros',
        description: 'Agrega al menos un personaje al grupo.',
        variant: 'destructive'
      });
      return;
    }

    // Check if there's a narrator in the group
    const hasNarrator = members.some(m => m.isNarrator);

    const groupData = {
      name: name.trim(),
      description,
      systemPrompt,
      firstMes: firstMes.trim() || undefined,  // Only save if non-empty
      activationStrategy,
      minResponsesPerTurn,
      maxResponsesPerTurn,
      allowMentions,
      mentionTriggers: [],
      conversationStyle,
      characterIds: memberIds,
      members,
      avatar: avatarUrl,
      hudTemplateId,
      lorebookIds,
      questTemplateIds,
      embeddingNamespaces,
      // Only include narratorSettings if there's a narrator in the group
      ...(hasNarrator && { narratorSettings })
    };

    if (isNewGroup) {
      addGroup(groupData);
    } else {
      updateGroup(groupId, groupData);
    }

    onClose();
  };

  const handleDelete = () => {
    if (!isNewGroup && confirm('¿Estás seguro de que quieres eliminar este grupo?')) {
      deleteGroup(groupId);
      onClose();
    }
  };

  const handleRemoveMember = (characterId: string) => {
    if (isNewGroup) {
      handleLocalRemoveMember(characterId);
    } else {
      removeGroupMember(groupId, characterId);
    }
  };

  const handleToggleActive = (characterId: string) => {
    if (isNewGroup) {
      handleLocalToggleActive(characterId);
    } else {
      toggleGroupMemberActive(groupId, characterId);
    }
  };

  const handleTogglePresent = (characterId: string) => {
    if (isNewGroup) {
      handleLocalTogglePresent(characterId);
    } else {
      toggleGroupMemberPresent(groupId, characterId);
    }
  };

  const handleToggleNarrator = (characterId: string) => {
    if (isNewGroup) {
      handleLocalToggleNarrator(characterId);
    } else {
      toggleGroupMemberNarrator(groupId, characterId);
    }
  };

  // ==========================================
  // Character Avatar helper
  // ==========================================
  const CharacterAvatar = ({ character, size = 'md' }: { character: { name: string; avatar?: string }; size?: 'sm' | 'md' | 'lg' }) => {
    const sizeClasses = {
      sm: 'w-8 h-8 text-xs',
      md: 'w-10 h-10 text-sm',
      lg: 'w-14 h-14 text-lg',
    };
    return (
      <div className={cn(sizeClasses[size], 'rounded-lg overflow-hidden bg-muted flex-shrink-0')}>
        {character.avatar ? (
          <img src={character.avatar} alt={character.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-400 to-orange-600">
            <span className="text-white font-bold">
              {character.name?.[0]?.toUpperCase() || '?'}
            </span>
          </div>
        )}
      </div>
    );
  };

  // ==========================================
  // Tab content renderers
  // ==========================================

  const renderInfoTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Información del Grupo</h3>
        <p className="text-sm text-muted-foreground">
          {isNewGroup
            ? 'Configura los detalles básicos del nuevo grupo.'
            : 'Edita los detalles del grupo.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: Name + Description */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Label htmlFor="name" className="text-sm font-medium">Nombre del Grupo *</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Un nombre descriptivo para identificar el grupo.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre del grupo..."
              className="h-9"
            />
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Label htmlFor="description" className="text-sm font-medium">Descripción / Escenario</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Describe el escenario o contexto del grupo.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe el escenario del grupo..."
              rows={4}
              className="text-sm"
            />
          </div>
        </div>

        {/* Right column: Avatar + Assignments */}
        <div className="space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-6">
            <div
              className={cn(
                'relative group/avatar-wrapper flex-shrink-0',
                !avatarUploading && 'cursor-pointer'
              )}
              onClick={() => !avatarUploading && avatarFileInputRef.current?.click()}
            >
              <div className="w-20 h-20 rounded-xl overflow-hidden bg-muted">
                {avatarUploading ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : avatarUrl ? (
                  <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center">
                    <Users className="w-8 h-8 text-white" />
                  </div>
                )}
              </div>
              <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <Camera className="w-5 h-5 text-white" />
              </div>
            </div>
            <input
              type="file"
              ref={avatarFileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleAvatarUpload}
              disabled={avatarUploading}
            />
            <div>
              <p className="text-xs text-muted-foreground">
                {avatarUrl ? 'Avatar del grupo (clic para cambiar)' : 'Clic para subir avatar'}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Sin avatar se usará el icono del grupo
              </p>
            </div>
          </div>

          {/* Assignments: HUD, Lorebooks, Quests */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium mb-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              <span>Asignaciones</span>
            </div>

            {/* HUD Selector */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-500" />
                <Label className="text-sm">Plantilla HUD</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Plantilla HUD para mostrar estadísticas del grupo.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <HUDSelector
                value={hudTemplateId}
                onChange={setHudTemplateId}
                placeholder="Sin HUD asignado"
              />
            </div>

            {/* Lorebook Selector */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                <Label className="text-sm">Lorebooks</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Lorebooks compartidos por todos los miembros del grupo.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <LorebookSelector
                value={lorebookIds}
                onChange={setLorebookIds}
                placeholder="Sin lorebooks asignados"
              />
            </div>

            {/* Quest Templates Selector */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <ScrollText className="w-3.5 h-3.5 text-purple-500" />
                <Label className="text-sm">Misiones</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Misiones disponibles para el grupo.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <QuestSelector
                value={questTemplateIds}
                onChange={setQuestTemplateIds}
                placeholder="Sin misiones asignadas"
              />
            </div>

            {/* Embedding Namespaces Selector */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Database className="w-3.5 h-3.5 text-violet-500" />
                <Label className="text-sm">Namespaces de Embeddings</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Namespaces donde buscar contexto durante el chat grupal. Si no se selecciona ninguno, se usará la estrategia global.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <NamespaceSelector
                value={embeddingNamespaces}
                onChange={setEmbeddingNamespaces}
                placeholder="Usar estrategia global"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMembersTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Miembros del Grupo</h3>
        <p className="text-sm text-muted-foreground">
          Gestiona los personajes que participan en este grupo. Usa los controles para agregar, quitar y configurar cada miembro.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Available Characters (2/3 width) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserX className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Personajes Disponibles</span>
              <Badge variant="secondary" className="text-xs">{filteredAvailable.length}</Badge>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar personajes..."
              className="pl-9 h-9"
              value={availableSearchQuery}
              onChange={(e) => setAvailableSearchQuery(e.target.value)}
            />
          </div>

          {/* Available characters list */}
          <div className="max-h-[60vh] overflow-y-auto space-y-1.5 pr-1">
            {filteredAvailable.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-10 border-2 border-dashed rounded-lg">
                <UserX className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>{availableSearchQuery ? 'No se encontraron personajes' : 'No hay personajes disponibles'}</p>
                <p className="text-xs mt-1">Todos los personajes ya están en el grupo</p>
              </div>
            ) : (
              filteredAvailable.map((char) => (
                <div
                  key={char.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                >
                  <CharacterAvatar character={char} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{char.name}</p>
                    {char.tags.length > 0 && (
                      <p className="text-xs text-muted-foreground truncate">
                        {char.tags.slice(0, 3).join(', ')}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      if (isNewGroup) {
                        handleLocalAddMember(char.id);
                      } else {
                        addGroupMember(groupId, char.id);
                      }
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Agregar
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Assigned Members (1/3 width) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Miembros</span>
              <Badge variant="secondary" className="text-xs">{memberCharacters.length}</Badge>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Filtrar miembros..."
              className="pl-9 h-9"
              value={memberSearchQuery}
              onChange={(e) => setMemberSearchQuery(e.target.value)}
            />
          </div>

          {/* Member list */}
          <div className="max-h-[60vh] overflow-y-auto space-y-1.5 pr-1">
            {filteredMembers.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-10 border-2 border-dashed rounded-lg">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>Sin miembros aún</p>
                <p className="text-xs mt-1">Agrega personajes desde la lista</p>
              </div>
            ) : (
              filteredMembers.map((member) => (
                <div
                  key={member.characterId}
                  className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors space-y-2"
                >
                  {/* Top row: Avatar + Name + Remove */}
                  <div className="flex items-center gap-2.5">
                    <CharacterAvatar character={member.character!} size="sm" />
                    <p className="font-medium text-sm truncate flex-1">{member.character?.name}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
                      onClick={() => handleRemoveMember(member.characterId)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  {/* Status badges */}
                  <div className="flex items-center gap-1.5 flex-wrap pl-1">
                    <Badge
                      variant={member.isActive ? 'default' : 'secondary'}
                      className={cn(
                        "text-[10px] cursor-pointer py-0 px-1.5",
                        member.isActive && "bg-emerald-500/20 text-emerald-600 hover:bg-emerald-500/30"
                      )}
                      onClick={() => handleToggleActive(member.characterId)}
                    >
                      {member.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                    <Badge
                      variant={member.isPresent ? 'outline' : 'secondary'}
                      className={cn(
                        "text-[10px] cursor-pointer py-0 px-1.5",
                        member.isPresent && "border-blue-500/30 text-blue-600"
                      )}
                      onClick={() => handleTogglePresent(member.characterId)}
                    >
                      {member.isPresent ? 'Presente' : 'Ausente'}
                    </Badge>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant={member.isNarrator ? 'default' : 'secondary'}
                          className={cn(
                            "text-[10px] cursor-pointer py-0 px-1.5",
                            member.isNarrator && "bg-violet-500/20 text-violet-600 hover:bg-violet-500/30"
                          )}
                          onClick={() => handleToggleNarrator(member.characterId)}
                        >
                          <Ghost className="w-2.5 h-2.5 mr-0.5" />
                          {member.isNarrator ? 'Narrador' : 'Normal'}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p><strong>Narrador:</strong> Un personaje narrador es un "fantasma" que puede dirigir la escena. Sus mensajes no aparecen en el historial para otros personajes, pero pueden activar triggers.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderStrategyTab = () => {
    const currentColorClasses = getStrategyColorClasses(strategyInfo[activationStrategy].color);

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-1">Estrategia de Respuesta</h3>
          <p className="text-sm text-muted-foreground">
            Define cómo y cuándo los personajes del grupo responden en la conversación.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Strategy selector + Conversation style */}
          <div className="space-y-6">
            {/* Strategy Selector */}
            <div className="p-4 bg-muted/30 rounded-lg border border-border/40 space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MessageSquare className="w-4 h-4" />
                <span className="font-medium">Modo de Activación</span>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {Object.entries(strategyInfo).map(([key, info]) => {
                  const isSelected = activationStrategy === key;
                  const colors = getStrategyColorClasses(info.color);
                  return (
                    <button
                      key={key}
                      onClick={() => setActivationStrategy(key as GroupActivationStrategy)}
                      className={cn(
                        "p-3 rounded-lg border text-left transition-colors",
                        isSelected
                          ? cn("border-primary bg-primary/10")
                          : "hover:bg-muted/50 border-border/40"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={isSelected ? colors.text : ''}>
                          {info.icon}
                        </span>
                        <span className="text-sm font-medium">{info.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{info.description}</p>
                    </button>
                  );
                })}
              </div>

              <div className={cn(
                "p-3 rounded-lg border",
                currentColorClasses.bg,
                currentColorClasses.border
              )}>
                <p className={cn(
                  "text-sm",
                  currentColorClasses.text
                )}>
                  💡 {strategyInfo[activationStrategy].tip}
                </p>
              </div>
            </div>

            {/* Conversation Style */}
            <div className="p-4 bg-muted/30 rounded-lg border border-border/40 space-y-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Label className="text-sm font-medium">Estilo de Conversación</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p><strong>Secuencial:</strong> Un personaje a la vez. <strong>Paralelo:</strong> Todos responden simultáneamente.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Select
                value={conversationStyle}
                onValueChange={(v) => setConversationStyle(v as 'sequential' | 'parallel')}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sequential">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-blue-500" />
                      <div>
                        <span className="text-sm">Secuencial</span>
                        <p className="text-[10px] text-muted-foreground">Un personaje responde a la vez</p>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="parallel">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-500" />
                      <div>
                        <span className="text-sm">Paralelo</span>
                        <p className="text-[10px] text-muted-foreground">Todos responden simultáneamente</p>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Right: Min/Max responses + Mentions */}
          <div className="space-y-6">
            {/* Response limits */}
            {activationStrategy !== 'all' && (
              <div className="p-4 bg-muted/30 rounded-lg border border-border/40 space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Settings className="w-4 h-4" />
                  <span className="font-medium">Límites de Respuesta</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Label htmlFor="minResponses" className="text-sm">Mín. Respuestas</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Número mínimo de personajes que responderán por turno. Si hay menciones o solicitudes pendientes, se pueden agregar más.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      id="minResponses"
                      type="number"
                      min={1}
                      max={maxResponsesPerTurn}
                      value={minResponsesPerTurn}
                      onChange={(e) => setMinResponsesPerTurn(Math.min(parseInt(e.target.value) || 1, maxResponsesPerTurn))}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Label htmlFor="maxResponses" className="text-sm">Máx. Respuestas</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Número máximo de personajes que responderán por turno.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      id="maxResponses"
                      type="number"
                      min={minResponsesPerTurn}
                      max={10}
                      value={maxResponsesPerTurn}
                      onChange={(e) => setMaxResponsesPerTurn(Math.max(parseInt(e.target.value) || 1, minResponsesPerTurn))}
                      className="h-9"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Mentions */}
            <div className="p-4 bg-muted/30 rounded-lg border border-border/40 space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Zap className="w-4 h-4" />
                <span className="font-medium">Menciones</span>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Label className="text-sm font-medium">Detección de Menciones</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Cuando está activo, los personajes responderán cuando sean mencionados por nombre.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Detectar nombres en mensajes</p>
                </div>
                <Switch
                  checked={allowMentions}
                  onCheckedChange={setAllowMentions}
                />
              </div>
            </div>

            {/* Info card about current strategy */}
            <div className={cn(
              "p-4 rounded-lg border",
              currentColorClasses.bgLight,
              currentColorClasses.border
            )}>
              <div className="flex items-start gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  currentColorClasses.bgSelected
                )}>
                  {strategyInfo[activationStrategy].icon}
                </div>
                <div>
                  <p className="text-sm font-medium">Estrategia: {strategyInfo[activationStrategy].name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {strategyInfo[activationStrategy].description}. {strategyInfo[activationStrategy].tip}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPromptsTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Prompts y Narrador</h3>
        <p className="text-sm text-muted-foreground">
          Configura las instrucciones del sistema y los ajustes del narrador para este grupo.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* First Message - Full width section above the grid */}
        <div className="space-y-3 lg:col-span-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MessageSquare className="w-4 h-4 text-green-500" />
            <span className="font-medium">Primer Mensaje</span>
          </div>

          <div className="p-4 bg-green-500/5 rounded-lg border border-green-500/20 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium">Mensaje Inicial del Grupo</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Mensaje inicial cuando se crea una nueva conversación con este grupo. Si está vacío, se usarán los mensajes iniciales individuales de cada personaje.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Textarea
              id="firstMes"
              value={firstMes}
              onChange={(e) => setFirstMes(e.target.value)}
              placeholder="Escribe el primer mensaje del grupo aquí... (opcional, si está vacío se usarán los mensajes iniciales de cada personaje)"
              rows={6}
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Si este campo está vacío, se usará el primer mensaje de cada personaje miembro. Si se configura, reemplazará todos los mensajes iniciales individuales.
            </p>
          </div>
        </div>

        {/* Left: System Prompt */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="font-medium">Prompt de Sistema</span>
          </div>

          <div className="p-4 bg-muted/30 rounded-lg border border-border/40 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium">Prompt de Sistema Personalizado</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Instrucciones adicionales para todos los personajes del grupo.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Textarea
              id="systemPrompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Instrucciones adicionales para el grupo..."
              rows={12}
              className="text-sm font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Este prompt se añadirá a las instrucciones de cada personaje del grupo.
            </p>
          </div>
        </div>

        {/* Right: Narrator Settings */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Ghost className="w-4 h-4 text-violet-500" />
            <span className="font-medium">Narrador</span>
          </div>

          {members.some(m => m.isNarrator) ? (
            <div className="p-4 bg-violet-500/10 rounded-lg border border-violet-500/20 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-violet-600">Configuración del Narrador</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Configura cómo y cuándo el narrador interviene en la conversación.</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Response Mode */}
              <div>
                <Label className="text-sm mb-2 block">Método de Respuesta</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(narratorModeInfo) as [NarratorResponseMode, typeof narratorModeInfo.turn_start][]).map(([mode, info]) => (
                    <button
                      key={mode}
                      onClick={() => setNarratorSettings(prev => ({ ...prev, responseMode: mode }))}
                      className={cn(
                        "p-2.5 rounded-lg border text-left transition-colors",
                        narratorSettings.responseMode === mode
                          ? "border-violet-500 bg-violet-500/20"
                          : "hover:bg-muted/50 border-border/40"
                      )}
                    >
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="text-violet-500">{info.icon}</span>
                        <span className="text-xs font-medium">{info.name}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-tight">{info.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Narrator Prompt */}
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Label className="text-sm">Prompt del Narrador</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Instrucciones específicas para el narrador. Si está vacío, usa el prompt del grupo.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Textarea
                  value={narratorSettings.customPrompt || ''}
                  onChange={(e) => setNarratorSettings(prev => ({ ...prev, customPrompt: e.target.value }))}
                  placeholder="Eres un narrador omnisciente que describe la escena, ambiente y transiciones..."
                  rows={4}
                  className="text-sm font-mono"
                />
              </div>

              {/* Conditional Settings */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Intervención Condicional</Label>

                {/* Min Turn Interval */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Turnos mínimos entre intervenciones</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>0 = siempre interviene. 1 = cada turno, 2 = cada 2 turnos, etc.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    value={narratorSettings.conditional.minTurnInterval}
                    onChange={(e) => setNarratorSettings(prev => ({
                      ...prev,
                      conditional: { ...prev.conditional, minTurnInterval: parseInt(e.target.value) || 0 }
                    }))}
                    className="w-16 h-8 text-xs"
                  />
                </div>

                {/* Only when no active quests */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Solo cuando no hay misiones activas</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>El narrador solo interviene cuando no hay misiones en curso.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Switch
                    checked={narratorSettings.conditional.onlyWhenNoActiveQuests}
                    onCheckedChange={(checked) => setNarratorSettings(prev => ({
                      ...prev,
                      conditional: { ...prev.conditional, onlyWhenNoActiveQuests: checked }
                    }))}
                  />
                </div>
              </div>

              {/* Hidden from Chat */}
              <div className="flex items-center justify-between pt-3 border-t border-violet-500/20">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium">Ocultar mensajes del narrador</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Los mensajes del narrador no se mostrarán en el chat (pero siguen activando triggers).</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Solo funcionan en segundo plano</p>
                </div>
                <Switch
                  checked={narratorSettings.hiddenFromChat}
                  onCheckedChange={(checked) => setNarratorSettings(prev => ({ ...prev, hiddenFromChat: checked }))}
                />
              </div>

              {/* Show Sprite */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium">Mostrar sprite del narrador</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Muestra el sprite del personaje narrador en pantalla.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-[10px] text-muted-foreground">El narrador suele ser invisible</p>
                </div>
                <Switch
                  checked={narratorSettings.showSprite}
                  onCheckedChange={(checked) => setNarratorSettings(prev => ({ ...prev, showSprite: checked }))}
                />
              </div>
            </div>
          ) : (
            <div className="p-8 bg-muted/30 rounded-lg border border-border/40 text-center">
              <Ghost className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">Sin narrador configurado</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ve a la pestaña <strong>Miembros</strong> y asigna el rol de Narrador a un personaje para ver estas opciones.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'info': return renderInfoTab();
      case 'members': return renderMembersTab();
      case 'strategy': return renderStrategyTab();
      case 'prompts': return renderPromptsTab();
      default: return renderInfoTab();
    }
  };

  return (
    <AnimatePresence mode="wait">
      {open && (
        <motion.div
          key="group-editor-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="fixed inset-0 z-50 bg-background"
        >
          <div className="h-full flex">
            {/* SIDEBAR */}
            <motion.aside
              initial={{ x: -16, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.25, delay: 0.05, ease: 'easeOut' }}
              className="w-14 md:w-60 border-r bg-muted/30 flex flex-col flex-shrink-0"
            >
              {/* Sidebar header */}
              <div className="flex items-center justify-between px-2 py-3 md:px-4 border-b">
                <div className="flex items-center gap-2 min-w-0">
                  <Users className="w-5 h-5 shrink-0 text-muted-foreground" />
                  <span className="hidden md:inline font-semibold text-sm truncate">
                    {name || 'Nuevo Grupo'}
                  </span>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Navigation */}
              <ScrollArea className="flex-1">
                <TooltipProvider delayDuration={400}>
                  <nav className="p-1.5 md:p-2 space-y-0.5">
                    {groupEditorTabs.map(tab => (
                      <Tooltip key={tab.value}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setActiveTab(tab.value)}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                              activeTab === tab.value
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            )}
                          >
                            <tab.icon className="w-4 h-4 shrink-0" />
                            <span className="hidden md:inline truncate">{tab.label}</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <p>{tab.label}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </nav>
                </TooltipProvider>
              </ScrollArea>

              {/* Footer with action buttons */}
              <div className="p-3 md:p-4 border-t space-y-2">
                <div className="hidden md:block text-xs text-muted-foreground mb-2">
                  {isNewGroup ? 'Creando grupo' : 'Editando grupo'}
                </div>
                <Button size="sm" onClick={handleSave} disabled={!name.trim()} className="w-full">
                  {isNewGroup ? 'Crear Grupo' : 'Guardar Cambios'}
                </Button>
                <Button variant="outline" size="sm" onClick={onClose} className="w-full">
                  Cancelar
                </Button>
                {!isNewGroup && (
                  <Button variant="destructive" size="sm" onClick={handleDelete} className="w-full mt-2">
                    <Trash2 className="w-4 h-4 mr-1" /> Eliminar Grupo
                  </Button>
                )}
              </div>
            </motion.aside>

            {/* MAIN CONTENT */}
            <motion.main
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.1, ease: 'easeOut' }}
              className="flex-1 overflow-hidden min-w-0"
            >
              <div className="h-full overflow-y-auto">
                <div className="max-w-5xl mx-auto p-6">
                <TooltipProvider>
                  {renderTabContent()}
                </TooltipProvider>
                </div>
              </div>
            </motion.main>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Button component to open group editor
export function CreateGroupButton() {
  const [editorOpen, setEditorOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        className="w-full justify-start gap-2"
        onClick={() => setEditorOpen(true)}
      >
        <Users className="w-4 h-4" />
        Crear Grupo
      </Button>

      <GroupEditor groupId={null} open={editorOpen} onClose={() => setEditorOpen(false)} />
    </>
  );
}
