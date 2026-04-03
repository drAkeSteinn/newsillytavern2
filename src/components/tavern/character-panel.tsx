'use client';

import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  Search, 
  Users, 
  MessageSquare,
  MoreVertical,
  Trash2,
  Edit,
  Download,
  Upload,
  FileUp,
  Package,
  PackageOpen
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { CharacterEditor } from './character-editor';
import { GroupEditor } from './group-editor';
import { importCharacterCard, exportCharacterCardAsPng, exportCharacterCardAsJson } from '@/lib/character-card';
import type { CharacterCard, CharacterGroup } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { getLogger } from '@/lib/logger';

const charLogger = getLogger('character');

// Type for exported data
interface ExportedData {
  version: string;
  exportedAt: string;
  characters: CharacterCard[];
  groups: CharacterGroup[];
}

export function CharacterPanel() {
  const [searchQuery, setSearchQuery] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [groupEditorOpen, setGroupEditorOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkImportRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Use individual selectors to avoid re-rendering on unrelated store changes
  const characters = useTavernStore((s) => s.characters);
  const groups = useTavernStore((s) => s.groups);
  const activeCharacterId = useTavernStore((s) => s.activeCharacterId);
  const activeGroupId = useTavernStore((s) => s.activeGroupId);
  const sessions = useTavernStore((s) => s.sessions);
  const setActiveCharacter = useTavernStore((s) => s.setActiveCharacter);
  const setActiveGroup = useTavernStore((s) => s.setActiveGroup);
  const createSession = useTavernStore((s) => s.createSession);
  const setActiveSession = useTavernStore((s) => s.setActiveSession);
  const deleteCharacter = useTavernStore((s) => s.deleteCharacter);
  const deleteGroup = useTavernStore((s) => s.deleteGroup);
  const addCharacter = useTavernStore((s) => s.addCharacter);
  const addGroup = useTavernStore((s) => s.addGroup);
  const sidebarOpen = useTavernStore((s) => s.sidebarOpen);

  const filteredCharacters = characters.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSelectCharacter = (characterId: string) => {
    setActiveCharacter(characterId);
    setActiveGroup(null);

    // Find existing INDIVIDUAL session (not group session) for this character
    // A character can have: 1 individual session + multiple group sessions
    // Priority: individual session (no groupId) > group session
    const individualSession = sessions.find(s =>
      s.characterId === characterId && !s.groupId
    );

    if (individualSession) {
      setActiveSession(individualSession.id);
    } else {
      // No individual session exists, create one
      createSession(characterId);
    }
  };

  const handleSelectGroup = (groupId: string) => {
    setActiveGroup(groupId);
    setActiveCharacter(null);
    
    // Find existing session for this group or create new
    const existingSession = sessions.find(s => s.groupId === groupId);
    if (existingSession) {
      setActiveSession(existingSession.id);
    } else {
      // Create a new session for the group using the store's createSession
      // Pass the first group member's characterId and the groupId
      const group = groups.find(g => g.id === groupId);
      if (group && group.members && group.members.length > 0) {
        // Use the first member's characterId to create the session
        const firstMemberId = group.members[0].characterId;
        createSession(firstMemberId, groupId);
      } else {
        // Fallback: create without character if group has no members
        createSession('', groupId);
      }
    }
  };

  const handleEditCharacter = (characterId: string) => {
    setEditingCharacterId(characterId);
    setEditorOpen(true);
  };

  const handleEditGroup = (groupId: string) => {
    setEditingGroupId(groupId);
    setGroupEditorOpen(true);
  };

  const handleNewGroup = () => {
    setEditingGroupId(null);
    setGroupEditorOpen(true);
  };

  const handleDeleteCharacter = (characterId: string) => {
    if (confirm('¿Estás seguro de que quieres eliminar este personaje?')) {
      deleteCharacter(characterId);
    }
  };

  const handleNewCharacter = () => {
    setEditingCharacterId(null);
    setEditorOpen(true);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    
    try {
      const result = await importCharacterCard(file);
      
      if (!result) {
        toast({
          title: 'Error de Importación',
          description: 'No se pudo analizar la tarjeta del personaje. Asegúrate de que sea un archivo PNG o JSON válido.',
          variant: 'destructive'
        });
        return;
      }

      const { character, avatar } = result;
      
      // Add the character to the store - preserve ALL fields from import
      addCharacter({
        // Basic fields
        name: character.name || 'Personaje sin nombre',
        description: character.description || '',
        personality: character.personality || '',
        scenario: character.scenario || '',
        firstMes: character.firstMes || '',
        mesExample: character.mesExample || '',
        creatorNotes: character.creatorNotes || '',
        characterNote: character.characterNote || '',
        systemPrompt: character.systemPrompt || '',
        postHistoryInstructions: character.postHistoryInstructions || '',
        alternateGreetings: character.alternateGreetings || [],
        tags: character.tags || [],
        avatar: avatar,
        sprites: character.sprites || [],
        voice: character.voice || null,
        statsConfig: character.statsConfig,
        // V2 Sprite System fields
        spritePacksV2: character.spritePacksV2,
        stateCollectionsV2: character.stateCollectionsV2,
        triggerCollections: character.triggerCollections,
        spriteLibraries: character.spriteLibraries,
        spriteIndex: character.spriteIndex,
        // Legacy sprite fields
        spriteConfig: character.spriteConfig,
        spritePacks: character.spritePacks,
        spriteTriggers: character.spriteTriggers,
        // Reference IDs
        hudTemplateId: character.hudTemplateId,
        lorebookIds: character.lorebookIds,
        questTemplateIds: character.questTemplateIds,
        // Additional fields
        creator: character.creator,
        characterVersion: character.characterVersion,
        memory: character.memory,
        chatStats: character.chatStats,
        // Embeddings
        embeddingNamespaces: character.embeddingNamespaces,
      });

      toast({
        title: 'Personaje Importado',
        description: `"${character.name || 'Personaje sin nombre'}" ha sido importado exitosamente.`
      });
    } catch (error) {
      charLogger.error('Import error', { error, source: 'file-input' });
      toast({
        title: 'Error de Importación',
        description: 'Ocurrió un error al importar el personaje.',
        variant: 'destructive'
      });
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleExportCharacter = async (character: CharacterCard, format: 'png' | 'json') => {
    try {
      let blob: Blob;
      let filename: string;
      
      if (format === 'png') {
        blob = await exportCharacterCardAsPng(character);
        filename = `${character.name.replace(/[^a-z0-9]/gi, '_')}.png`;
      } else {
        const jsonStr = exportCharacterCardAsJson(character);
        blob = new Blob([jsonStr], { type: 'application/json' });
        filename = `${character.name.replace(/[^a-z0-9]/gi, '_')}.json`;
      }
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: 'Personaje Exportado',
        description: `"${character.name}" ha sido exportado como ${format.toUpperCase()}.`
      });
    } catch (error) {
      charLogger.error('Export error', { error, characterName: character.name, format });
      toast({
        title: 'Error de Exportación',
        description: 'Ocurrió un error al exportar el personaje.',
        variant: 'destructive'
      });
    }
  };

  // ============================================
  // Bulk Export/Import Functions
  // ============================================

  const handleExportAll = () => {
    try {
      const exportData: ExportedData = {
        version: '2.0',
        exportedAt: new Date().toISOString(),
        characters: characters,
        groups: groups
      };

      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `tavernflow_backup_${timestamp}.json`;
      
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Exportación Completa',
        description: `Exportados ${characters.length} personajes y ${groups.length} grupos.`
      });
    } catch (error) {
      charLogger.error('Bulk export error', { error });
      toast({
        title: 'Error de Exportación',
        description: 'Ocurrió un error al exportar los datos.',
        variant: 'destructive'
      });
    }
  };

  const handleBulkImportClick = () => {
    bulkImportRef.current?.click();
  };

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    try {
      const text = await file.text();
      const data = JSON.parse(text) as ExportedData;

      // Validate structure
      if (!data.version || !Array.isArray(data.characters)) {
        toast({
          title: 'Error de Importación',
          description: 'El archivo no tiene el formato correcto. Debe ser un backup de TavernFlow.',
          variant: 'destructive'
        });
        return;
      }

      let importedCharacters = 0;
      let importedGroups = 0;
      let skippedCharacters = 0;

      // Build a map of old ID to new ID for updating group references
      const idMapping: Record<string, string> = {};

      // Import characters
      for (const character of data.characters) {
        // Check if character with same ID already exists
        const exists = characters.some(c => c.id === character.id);
        if (exists) {
          skippedCharacters++;
          // Map the existing ID to itself for group references
          if (character.id) {
            idMapping[character.id] = character.id;
          }
          continue;
        }

        // Add character using store action - preserve ALL fields including ID
        // Use preserveId=true to maintain the original ID for group/reward references
        addCharacter({
          // Preserve original ID
          id: character.id,
          createdAt: character.createdAt,
          // Basic fields
          name: character.name || 'Personaje sin nombre',
          description: character.description || '',
          personality: character.personality || '',
          scenario: character.scenario || '',
          firstMes: character.firstMes || '',
          mesExample: character.mesExample || '',
          creatorNotes: character.creatorNotes || '',
          characterNote: character.characterNote || '',
          systemPrompt: character.systemPrompt || '',
          postHistoryInstructions: character.postHistoryInstructions || '',
          authorNote: character.authorNote || '',
          alternateGreetings: character.alternateGreetings || [],
          tags: character.tags || [],
          avatar: character.avatar || '',
          sprites: character.sprites || [],
          voice: character.voice || null,
          statsConfig: character.statsConfig,
          // V2 Sprite System fields
          spritePacksV2: character.spritePacksV2,
          stateCollectionsV2: character.stateCollectionsV2,
          triggerCollections: character.triggerCollections,
          spriteLibraries: character.spriteLibraries,
          spriteIndex: character.spriteIndex,
          spriteConfig: character.spriteConfig,
          // Legacy sprite fields
          spritePacks: character.spritePacks,
          spriteTriggers: character.spriteTriggers,
          // Reference IDs
          hudTemplateId: character.hudTemplateId,
          lorebookIds: character.lorebookIds,
          questTemplateIds: character.questTemplateIds,
          // Additional fields
          creator: character.creator,
          characterVersion: character.characterVersion,
          extensions: character.extensions,
          chatStats: character.chatStats,
          memory: character.memory,
          // Embeddings
          embeddingNamespaces: character.embeddingNamespaces,
        }, true); // preserveId = true
        importedCharacters++;
      }

      // Import groups
      if (data.groups && Array.isArray(data.groups)) {
        for (const group of data.groups) {
          // Check if group with same ID already exists
          const exists = groups.some(g => g.id === group.id);
          if (exists) continue;

          // Add group using store action - preserve ALL fields including ID
          // Use preserveId=true to maintain the original ID
          addGroup({
            // Preserve original ID
            id: group.id,
            createdAt: group.createdAt,
            name: group.name || 'Grupo sin nombre',
            description: group.description || '',
            characterIds: group.characterIds || [],
            members: group.members || [],
            avatar: group.avatar || '',
            systemPrompt: group.systemPrompt || '',
            activationStrategy: group.activationStrategy || 'all',
            minResponsesPerTurn: group.minResponsesPerTurn ?? 1,
            maxResponsesPerTurn: group.maxResponsesPerTurn ?? 3,
            allowMentions: group.allowMentions ?? true,
            mentionTriggers: group.mentionTriggers || [],
            conversationStyle: group.conversationStyle || 'sequential',
            // Reference IDs
            hudTemplateId: group.hudTemplateId,
            lorebookIds: group.lorebookIds,
            questTemplateIds: group.questTemplateIds,
            // Narrator settings
            narratorSettings: group.narratorSettings,
            // Embeddings
            embeddingNamespaces: group.embeddingNamespaces,
          }, true); // preserveId = true
          importedGroups++;
        }
      }

      toast({
        title: 'Importación Completa',
        description: `Importados ${importedCharacters} personajes y ${importedGroups} grupos.${skippedCharacters > 0 ? ` (${skippedCharacters} personajes omitidos por duplicados)` : ''}`
      });
    } catch (error) {
      charLogger.error('Bulk import error', { error });
      toast({
        title: 'Error de Importación',
        description: 'No se pudo leer el archivo. Asegúrate de que sea un JSON válido.',
        variant: 'destructive'
      });
    } finally {
      setIsImporting(false);
      if (bulkImportRef.current) {
        bulkImportRef.current.value = '';
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length === 0) return;
    
    const file = files[0];
    setIsImporting(true);
    
    try {
      const result = await importCharacterCard(file);
      
      if (!result) {
        toast({
          title: 'Error de Importación',
          description: 'No se pudo analizar la tarjeta del personaje. Asegúrate de que sea un archivo PNG o JSON válido.',
          variant: 'destructive'
        });
        return;
      }

      const { character, avatar } = result;
      
      // Add character using store action - preserve ALL fields from import
      addCharacter({
        // Basic fields
        name: character.name || 'Personaje sin nombre',
        description: character.description || '',
        personality: character.personality || '',
        scenario: character.scenario || '',
        firstMes: character.firstMes || '',
        mesExample: character.mesExample || '',
        creatorNotes: character.creatorNotes || '',
        characterNote: character.characterNote || '',
        systemPrompt: character.systemPrompt || '',
        postHistoryInstructions: character.postHistoryInstructions || '',
        alternateGreetings: character.alternateGreetings || [],
        tags: character.tags || [],
        avatar: avatar,
        sprites: character.sprites || [],
        voice: character.voice || null,
        statsConfig: character.statsConfig,
        // V2 Sprite System fields
        spritePacksV2: character.spritePacksV2,
        stateCollectionsV2: character.stateCollectionsV2,
        triggerCollections: character.triggerCollections,
        spriteLibraries: character.spriteLibraries,
        spriteIndex: character.spriteIndex,
        // Legacy sprite fields
        spriteConfig: character.spriteConfig,
        spritePacks: character.spritePacks,
        spriteTriggers: character.spriteTriggers,
        // Reference IDs
        hudTemplateId: character.hudTemplateId,
        lorebookIds: character.lorebookIds,
        questTemplateIds: character.questTemplateIds,
        // Additional fields
        creator: character.creator,
        characterVersion: character.characterVersion,
        memory: character.memory,
        chatStats: character.chatStats,
        // Embeddings
        embeddingNamespaces: character.embeddingNamespaces,
      });

      toast({
        title: 'Personaje Importado',
        description: `"${character.name || 'Personaje sin nombre'}" ha sido importado exitosamente.`
      });
    } catch (error) {
      charLogger.error('Import error', { error, source: 'drag-drop' });
      toast({
        title: 'Error de Importación',
        description: 'Ocurrió un error al importar el personaje.',
        variant: 'destructive'
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      {/* Hidden file input for single character import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".png,.json,image/png,application/json"
        onChange={handleFileChange}
        className="hidden"
      />
      
      {/* Hidden file input for bulk import */}
      <input
        ref={bulkImportRef}
        type="file"
        accept=".json,application/json"
        onChange={handleBulkImport}
        className="hidden"
      />
      
      <div 
        className={cn(
          "w-72 border-l bg-background flex flex-col h-full relative z-10 transition-all duration-300",
          !sidebarOpen && "w-0 overflow-hidden border-l-0",
          isDragging && "ring-2 ring-primary ring-inset"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-primary/10 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="bg-background border-2 border-dashed border-primary rounded-lg p-6 text-center">
              <Upload className="w-8 h-8 mx-auto mb-2 text-primary" />
              <p className="text-sm font-medium">Suelta la tarjeta aquí</p>
              <p className="text-xs text-muted-foreground mt-1">PNG o JSON</p>
            </div>
          </div>
        )}
        
        {/* Header */}
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Personajes</h2>
            <div className="flex gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8" 
                onClick={handleImportClick}
                disabled={isImporting}
                title="Importar Personaje"
              >
                {isImporting ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8" 
                onClick={handleNewCharacter} 
                title="Crear Nuevo Personaje"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar personajes..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {/* Characters List */}
          <div className="p-2">
            <div className="flex items-center gap-2 px-2 py-1 text-muted-foreground">
              <MessageSquare className="w-4 h-4" />
              <span className="text-sm font-medium">Personajes</span>
              <span className="text-xs ml-auto">{characters.length}</span>
            </div>
            {filteredCharacters.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? 'No se encontraron personajes' : 'Sin personajes aún'}
                <Button 
                  variant="link" 
                  className="block mx-auto mt-2"
                  onClick={handleNewCharacter}
                >
                  Crea tu primer personaje
                </Button>
              </div>
            ) : (
              <div className="space-y-1 mt-1">
                {filteredCharacters.map((character) => (
                  <div
                    key={character.id}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors',
                      activeCharacterId === character.id 
                        ? 'bg-primary/10 border border-primary/20' 
                        : 'hover:bg-muted'
                    )}
                    onClick={() => handleSelectCharacter(character.id)}
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      {character.avatar ? (
                        <img 
                          src={character.avatar} 
                          alt={character.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-400 to-orange-600">
                          <span className="text-white font-bold">
                            {character.name[0].toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{character.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {character.tags.slice(0, 2).join(', ')}
                      </p>
                    </div>

                    {/* Actions - always visible */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleEditCharacter(character.id);
                        }}>
                          <Edit className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleExportCharacter(character, 'png');
                        }}>
                          <Download className="w-4 h-4 mr-2" />
                          Exportar como PNG
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleExportCharacter(character, 'json');
                        }}>
                          <FileUp className="w-4 h-4 mr-2" />
                          Exportar como JSON
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCharacter(character.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Groups Section */}
          <div className="p-2 border-t mt-2">
            <div className="flex items-center justify-between px-2 py-1 text-muted-foreground">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="text-sm font-medium">Grupos</span>
                <span className="text-xs">{groups.length}</span>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6"
                onClick={handleNewGroup}
                title="Crear Nuevo Grupo"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {groups.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                Sin grupos aún
              </div>
            ) : (
              <div className="space-y-1 mt-1">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors',
                      activeGroupId === group.id 
                        ? 'bg-primary/10 border border-primary/20' 
                        : 'hover:bg-muted'
                    )}
                    onClick={() => handleSelectGroup(group.id)}
                  >
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      {group.avatar ? (
                        <img src={group.avatar} alt={group.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-400 to-purple-600">
                          <Users className="w-5 h-5 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{group.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {group.members?.length || group.characterIds?.length || 0} personajes
                      </p>
                    </div>
                    
                    {/* Group Actions Menu - always visible */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleEditGroup(group.id);
                        }}>
                          <Edit className="w-4 h-4 mr-2" />
                          Editar Grupo
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`¿Estás seguro de que quieres eliminar el grupo "${group.name}"?`)) {
                              deleteGroup(group.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Eliminar Grupo
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-3 border-t space-y-2">
          {/* Single character actions */}
          <Button 
            variant="outline" 
            className="w-full justify-start gap-2"
            onClick={handleNewCharacter}
          >
            <Plus className="w-4 h-4" />
            Nuevo Personaje
          </Button>
          <Button 
            variant="outline" 
            className="w-full justify-start gap-2"
            onClick={handleNewGroup}
          >
            <Users className="w-4 h-4" />
            Nuevo Grupo
          </Button>
          
          {/* Bulk actions */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t">
            <Button 
              variant="secondary" 
              size="sm"
              className="justify-start gap-1.5"
              onClick={handleExportAll}
              disabled={characters.length === 0 && groups.length === 0}
              title="Exportar todos los personajes y grupos"
            >
              <Package className="w-4 h-4" />
              Exportar Todo
            </Button>
            <Button 
              variant="secondary" 
              size="sm"
              className="justify-start gap-1.5"
              onClick={handleBulkImportClick}
              disabled={isImporting}
              title="Importar personajes y grupos desde backup"
            >
              {isImporting ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent animate-spin" />
              ) : (
                <PackageOpen className="w-4 h-4" />
              )}
              Importar Todo
            </Button>
          </div>
        </div>
      </div>

      {/* Character Editor - Full-screen overlay */}
      <CharacterEditor
        key={editingCharacterId || 'new-character'}
        characterId={editingCharacterId}
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
      />

      {/* Group Editor - Full-screen overlay */}
      <GroupEditor 
        key={editingGroupId || 'new-group'}
        groupId={editingGroupId}
        open={groupEditorOpen}
        onClose={() => setGroupEditorOpen(false)}
      />
    </>
  );
}
