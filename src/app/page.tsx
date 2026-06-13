'use client';

import { useTavernStore } from '@/store/tavern-store';
import { ChatPanel } from '@/components/tavern/chat-panel';
import { CharacterPanel } from '@/components/tavern/character-panel';
import { SessionsSidebar } from '@/components/tavern/sessions-sidebar';
import { SettingsPanel } from '@/components/tavern/settings-panel';
import { BackgroundGallery } from '@/components/tavern/background-gallery';
import { InventoryPanel } from '@/components/inventory/inventory-panel';
import { SettingsApplier } from '@/components/tavern/settings-applier';
import { AtmosphereRenderer } from '@/components/atmosphere';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { 
  Menu, 
  Sparkles, 
  PanelLeftClose,
  PanelLeft,
  Settings,
  Loader2,
  Image as ImageIcon,
  BookOpen,
  Music,
  Cloud,
  Package
} from 'lucide-react';
import { useState } from 'react';
import { useHydration } from '@/hooks/use-hydration';
import { useIsMobile } from '@/hooks/use-mobile';
import { t } from '@/lib/i18n';

export default function TavernFlow() {
  // Use individual selectors to avoid re-rendering the entire page on every store change
  const sidebarOpen = useTavernStore((s) => s.sidebarOpen);
  const setSidebarOpen = useTavernStore((s) => s.setSidebarOpen);
  const settingsOpen = useTavernStore((s) => s.settingsOpen);
  const setSettingsOpen = useTavernStore((s) => s.setSettingsOpen);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [backgroundGalleryOpen, setBackgroundGalleryOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('llm');
  const hydrated = useHydration();
  const isMobile = useIsMobile();

  const togglePanels = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const openSettingsTab = (tab: string) => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Settings Applier - Applies user settings to the app */}
      <SettingsApplier />
      
      {/* Atmosphere Effects Renderer */}
      {hydrated && <AtmosphereRenderer />}
      
      {/* Header */}
      <header className="h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Menu className="w-5 h-5" />
          </Button>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
              TavernFlow
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Atmosphere Button */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            onClick={() => openSettingsTab('atmosphere')}
            title={t('nav.atmosphere') || 'Atmósfera'}
          >
            <Cloud className="w-5 h-5" />
          </Button>
          
          {/* Background Gallery Button */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            onClick={() => setBackgroundGalleryOpen(true)}
            title={t('nav.backgroundGallery')}
          >
            <ImageIcon className="w-5 h-5" />
          </Button>
          
          {/* Lorebooks Button */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            onClick={() => openSettingsTab('lorebooks')}
            title={t('nav.lorebooks')}
          >
            <BookOpen className="w-5 h-5" />
          </Button>
          
          {/* Sound Triggers Button */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            onClick={() => openSettingsTab('sounds')}
            title={t('nav.soundTriggers')}
          >
            <Music className="w-5 h-5" />
          </Button>
          
          {/* Inventory Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setInventoryOpen(true)}
            title={t('nav.inventory')}
          >
            <Package className="w-5 h-5" />
          </Button>
          
          {/* Settings Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openSettingsTab('llm')}
            title={t('nav.settings')}
          >
            <Settings className="w-5 h-5" />
          </Button>
          
          {/* Panels Toggle */}
          {hydrated && (
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePanels}
              className="hidden md:flex"
              title={sidebarOpen ? t('nav.hidePanels') : t('nav.showPanels')}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="w-5 h-5" />
              ) : (
                <PanelLeft className="w-5 h-5" />
              )}
            </Button>
          )}
        </div>
      </header>

      {/* Main Content - Only render after hydration */}
      {/* h-[calc(100vh-3.5rem)] provides explicit height so h-full children can resolve percentages */}
      <div className="h-[calc(100vh-3.5rem)] flex overflow-clip">
        {hydrated ? (
          <>
            {/* Sessions Sidebar - hidden on mobile, accessible via mobile menu overlay */}
            {!isMobile && <SessionsSidebar />}

            {/* Chat Area */}
            <ChatPanel />

            {/* Character Panel - hidden on mobile */}
            {!isMobile && <CharacterPanel />}
          </>
        ) : (
          // Placeholder during hydration
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-sm">{t('common.loading')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Settings Panel */}
      {hydrated && <SettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} initialTab={settingsTab} />}

      {/* Background Gallery */}
      {hydrated && <BackgroundGallery open={backgroundGalleryOpen} onOpenChange={setBackgroundGalleryOpen} />}

      {/* Inventory Panel (Slide-over Sheet) */}
      {hydrated && (
        <Sheet open={inventoryOpen} onOpenChange={setInventoryOpen}>
          <SheetContent side="right" className="w-full sm:max-w-[400px] p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>{t('nav.inventory')}</SheetTitle>
            </SheetHeader>
            <InventoryPanel />
          </SheetContent>
        </Sheet>
      )}

      {/* Mobile Menu Overlay */}
      {hydrated && mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div 
            className="absolute left-0 top-0 bottom-0 w-64 bg-background border-r flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <SessionsSidebar />
            {/* Mobile Menu - Inventory Button */}
            <div className="p-3 border-t mt-auto">
              <Button
                variant="ghost"
                className="w-full justify-start gap-2"
                onClick={() => { setMobileMenuOpen(false); setInventoryOpen(true); }}
              >
                <Package className="w-5 h-5" />
                {t('nav.inventory')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
