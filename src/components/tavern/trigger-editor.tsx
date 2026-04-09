'use client';

import { useState } from 'react';
import { useTavernStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { getLogger } from '@/lib/logger';

const triggerLogger = getLogger('trigger');
import { 
  Volume2, 
  Image as ImageIcon, 
  Sparkles, 
  Plus, 
  Trash2, 
  Play,
  Settings
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { SFXTrigger, BackgroundTrigger } from '@/types/triggers';

interface TriggerEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TriggerEditor({ open, onOpenChange }: TriggerEditorProps) {
  const store = useTavernStore();
  const settings = store.settings;
  
  // Get triggers from store
  const sfxTriggers = store.soundTriggers || [];
  const backgroundTriggers = store.backgroundTriggers || [];

  const [newSFXKeyword, setNewSFXKeyword] = useState('');
  const [newSoundPath, setNewSoundPath] = useState('/sounds/pop/pop1.wav');
  const [newBgKeyword, setNewBgKeyword] = useState('');
  const [newBgPath, setNewBgPath] = useState('');

  const handleAddSFXTrigger = () => {
    if (!newSFXKeyword.trim()) return;
    
    const newTrigger: SFXTrigger = {
      id: `sfx_${Date.now()}`,
      title: newSFXKeyword,
      active: true,
      keywords: [newSFXKeyword.toLowerCase()],
      requirePipes: true,
      caseSensitive: false,
      src: newSoundPath,
      volume: 1.0,
      cooldownMs: 800,
      repeatCount: 1,
      soundPack: 'custom',
    };
    
    store.setSoundTriggers([...sfxTriggers, newTrigger]);
    setNewSFXKeyword('');
  };

  const handleAddBackgroundTrigger = () => {
    if (!newBgKeyword.trim()) return;
    
    const newTrigger: BackgroundTrigger = {
      id: `bg_${Date.now()}`,
      title: newBgKeyword,
      active: true,
      keywords: [newBgKeyword.toLowerCase()],
      requirePipes: true,
      caseSensitive: false,
      backgroundName: newBgPath || 'Room',
      cooldownMs: 1500,
    };
    
    store.setBackgroundTriggers([...backgroundTriggers, newTrigger]);
    setNewBgKeyword('');
    setNewBgPath('');
  };

  const handleDeleteSFXTrigger = (id: string) => {
    store.setSoundTriggers(sfxTriggers.filter(t => t.id !== id));
  };

  const handleDeleteBackgroundTrigger = (id: string) => {
    store.setBackgroundTriggers(backgroundTriggers.filter(t => t.id !== id));
  };

  const handleTestSound = (src: string) => {
    const audio = new Audio(src);
    audio.volume = settings.sound?.globalVolume ?? 0.85;
    audio.play().catch((error) => triggerLogger.error('Audio play failed', { error }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Trigger Configuration
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="sfx" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="sfx" className="gap-1">
              <Volume2 className="w-4 h-4" />
              SFX
            </TabsTrigger>
            <TabsTrigger value="backgrounds" className="gap-1">
              <ImageIcon className="w-4 h-4" />
              Backgrounds
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1">
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            {/* SFX Triggers Tab */}
            <TabsContent value="sfx" className="space-y-4 mt-0">
              {/* Add new trigger */}
              <div className="p-4 border rounded-lg space-y-3">
                <h4 className="font-medium">Add Sound Trigger</h4>
                <div className="flex gap-2">
                  <Input
                    placeholder="Keyword (e.g., golpe)"
                    value={newSFXKeyword}
                    onChange={(e) => setNewSFXKeyword(e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Sound path"
                    value={newSoundPath}
                    onChange={(e) => setNewSoundPath(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleAddSFXTrigger}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Existing triggers */}
              <div className="space-y-2">
                {sfxTriggers.map((trigger) => (
                  <div
                    key={trigger.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleTestSound(trigger.src)}
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                      <div>
                        <p className="font-medium">{trigger.title}</p>
                        <div className="flex gap-1">
                          {trigger.keywords.slice(0, 3).map((kw) => (
                            <Badge key={kw} variant="secondary" className="text-xs">
                              |{kw}|
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{Math.round(trigger.volume * 100)}%</Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDeleteSFXTrigger(trigger.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Backgrounds Tab */}
            <TabsContent value="backgrounds" className="space-y-4 mt-0">
              <div className="p-4 border rounded-lg space-y-3">
                <h4 className="font-medium">Add Background Trigger</h4>
                <div className="flex gap-2">
                  <Input
                    placeholder="Keyword (e.g., baño)"
                    value={newBgKeyword}
                    onChange={(e) => setNewBgKeyword(e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Background name"
                    value={newBgPath}
                    onChange={(e) => setNewBgPath(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleAddBackgroundTrigger}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {backgroundTriggers.map((trigger) => (
                  <div
                    key={trigger.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">{trigger.title}</p>
                      <p className="text-sm text-muted-foreground">
                        → {trigger.backgroundName}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDeleteBackgroundTrigger(trigger.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-6 mt-0">
              {/* Enable/Disable */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Sound Triggers</Label>
                  <p className="text-xs text-muted-foreground">
                    Master switch for sound trigger system
                  </p>
                </div>
                <Switch
                  checked={settings.sound?.enabled ?? true}
                  onCheckedChange={(enabled) => store.updateSettings({ 
                    sound: { ...settings.sound, enabled } 
                  })}
                />
              </div>

              {/* Global Volume */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Global Volume</Label>
                  <span className="text-sm">{Math.round((settings.sound?.globalVolume ?? 0.85) * 100)}%</span>
                </div>
                <Slider
                  value={[settings.sound?.globalVolume ?? 0.85]}
                  min={0}
                  max={1}
                  step={0.05}
                  onValueChange={([volume]) => store.updateSettings({ 
                    sound: { ...settings.sound, globalVolume: volume } 
                  })}
                />
              </div>

              {/* Background Triggers */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Background Triggers</Label>
                  <p className="text-xs text-muted-foreground">
                    Enable background switching from triggers
                  </p>
                </div>
                <Switch
                  checked={settings.backgroundTriggers?.enabled ?? true}
                  onCheckedChange={(enabled) => store.updateSettings({ 
                    backgroundTriggers: { ...settings.backgroundTriggers, enabled } 
                  })}
                />
              </div>

              {/* Realtime Detection */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Realtime Detection</Label>
                  <p className="text-xs text-muted-foreground">
                    Detect triggers during message streaming
                  </p>
                </div>
                <Switch
                  checked={settings.sound?.realtimeEnabled ?? true}
                  onCheckedChange={(realtimeEnabled) => store.updateSettings({ 
                    sound: { ...settings.sound, realtimeEnabled } 
                  })}
                />
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
