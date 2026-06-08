'use client';

import { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Layers, Package, Zap } from 'lucide-react';
import type { 
  SpriteConfig, 
  SpriteCollection, 
  CharacterCard,
  SpriteIndexEntry
} from '@/types';
import { SpritePackEditorV2 } from './sprite-pack-editor-v2';
import { StateCollectionEditorV2 } from './state-collection-editor-v2';
import { TriggerCollectionEditor } from './trigger-collection-editor';
import { getLogger } from '@/lib/logger';

const spriteLogger = getLogger('sprite');

interface SpriteManagerProps {
  character: CharacterCard;
  onChange: (updates: Partial<CharacterCard>) => void;
}

export function SpriteManager({ character, onChange }: SpriteManagerProps) {
  const [collections, setCollections] = useState<SpriteCollection[]>([]);
  const [allSprites, setAllSprites] = useState<SpriteIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Get current sprite config - memoized to prevent infinite loops
  const spriteConfig: SpriteConfig = useMemo(() => {
    return character.spriteConfig || {
      enabled: true,
      collection: '',
      sprites: {},
      stateCollections: {},
    };
  }, [character.spriteConfig]);

  // Fetch sprite collections and custom sprites
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [collectionsRes, spritesRes] = await Promise.all([
          fetch('/api/sprites/collections'),
          fetch('/api/sprites/index'),
        ]);
        
        const collectionsData = await collectionsRes.json();
        const spritesData = await spritesRes.json();
        
        setCollections(collectionsData.collections || []);
        setAllSprites(spritesData.sprites || []);
      } catch (error) {
        spriteLogger.error('Error fetching sprite data', { error });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [character.spriteConfig?.collection]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Package className="w-6 h-6 animate-pulse text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tabs for Sprite Packs, States and Triggers */}
      <Tabs defaultValue="packs" className="w-full">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="packs" className="text-xs gap-1">
            <Layers className="w-3.5 h-3.5" />
            Sprite Packs
          </TabsTrigger>
          <TabsTrigger value="states" className="text-xs gap-1">
            <Package className="w-3.5 h-3.5" />
            Estados
          </TabsTrigger>
          <TabsTrigger value="triggers" className="text-xs gap-1">
            <Zap className="w-3.5 h-3.5" />
            Triggers
          </TabsTrigger>
        </TabsList>

        {/* Sprite Packs Tab - Pass ALL sprites so users can add from any collection */}
        <TabsContent value="packs" className="space-y-4 mt-3">
          <SpritePackEditorV2
            character={character}
            customSprites={allSprites}
            collections={collections}
            onChange={onChange}
          />
        </TabsContent>

        {/* States Tab */}
        <TabsContent value="states" className="space-y-4 mt-3">
          <StateCollectionEditorV2
            character={character}
            onChange={onChange}
          />
        </TabsContent>

        {/* Triggers Tab */}
        <TabsContent value="triggers" className="space-y-4 mt-3">
          <TriggerCollectionEditor
            character={character}
            onChange={onChange}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default SpriteManager;
