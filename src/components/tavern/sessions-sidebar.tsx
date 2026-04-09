'use client';

import { useTavernStore } from '@/store/tavern-store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageSquare, 
  Plus, 
  Trash2, 
  ChevronLeft,
  Settings,
  Users,
  Bot
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export function SessionsSidebar() {
  // Use individual selectors to avoid re-rendering on unrelated store changes
  const sessions = useTavernStore((s) => s.sessions);
  const activeSessionId = useTavernStore((s) => s.activeSessionId);
  const setActiveSession = useTavernStore((s) => s.setActiveSession);
  const createSession = useTavernStore((s) => s.createSession);
  const deleteSession = useTavernStore((s) => s.deleteSession);
  const getCharacterById = useTavernStore((s) => s.getCharacterById);
  const sidebarOpen = useTavernStore((s) => s.sidebarOpen);
  const setSidebarOpen = useTavernStore((s) => s.setSidebarOpen);
  const setSettingsOpen = useTavernStore((s) => s.setSettingsOpen);
  const activeCharacterId = useTavernStore((s) => s.activeCharacterId);
  const groups = useTavernStore((s) => s.groups);

  const handleNewChat = () => {
    if (activeCharacterId) {
      createSession(activeCharacterId);
    }
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('¿Eliminar este chat?')) {
      deleteSession(sessionId);
    }
  };

  // Sort sessions by last activity
  const sortedSessions = [...sessions].sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <div className={cn(
      'w-64 border-r bg-muted/30 flex flex-col h-full transition-all duration-300 relative z-10',
      !sidebarOpen && 'w-0 overflow-hidden border-r-0'
    )}>
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between">
        <h2 className="font-semibold text-sm">Chats</h2>
        <div className="flex gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7"
            onClick={() => setSettingsOpen(true)}
            title="Configuración"
          >
            <Settings className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7"
            onClick={() => setSidebarOpen(false)}
            title="Ocultar panel"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <Button 
          variant="outline" 
          className="w-full justify-start gap-2"
          onClick={handleNewChat}
          disabled={!activeCharacterId}
        >
          <Plus className="w-4 h-4" />
          Nuevo Chat
        </Button>
      </div>

      {/* Sessions List */}
      <ScrollArea className="flex-1">
        <div className="px-2 space-y-1">
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Sin chats aún</p>
            </div>
          ) : (
            sortedSessions.map((session) => {
              const isGroup = !!session.groupId;
              const group = isGroup ? groups.find(g => g.id === session.groupId) : null;
              const character = !isGroup ? getCharacterById(session.characterId) : null;
              
              return (
                <div
                  key={session.id}
                  className={cn(
                    'flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors group',
                    activeSessionId === session.id 
                      ? 'bg-primary/10 border border-primary/20' 
                      : 'hover:bg-muted'
                  )}
                  onClick={() => setActiveSession(session.id)}
                >
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-lg overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
                    {isGroup ? (
                      <div className="w-full h-full bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center">
                        <Users className="w-4 h-4 text-white" />
                      </div>
                    ) : character?.avatar ? (
                      <img 
                        src={character.avatar} 
                        alt={character.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Bot className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {isGroup ? group?.name : character?.name || session.name}
                    </p>
                  </div>

                  {/* Delete button - always visible */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive flex-shrink-0 opacity-60 hover:opacity-100"
                    onClick={(e) => handleDeleteSession(session.id, e)}
                    title="Eliminar"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t space-y-2">
        <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground">
          <Users className="w-4 h-4" />
          Grupos
        </Button>
      </div>
    </div>
  );
}
