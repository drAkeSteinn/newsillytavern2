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
  const [customSprites, setCustomSprites] = useState<SpriteIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selected collection - initialize from character's saved config
  const [selectedCollectionName, setSelectedCollectionName] = useState<string>(() => {
    return character.spriteConfig?.collection || 'custom';
  });

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
        setCustomSprites(spritesData.sprites || []);
        
        // Set default collection
        if (collectionsData.collections?.length > 0) {
          const collectionNames = collectionsData.collections.map((c: SpriteCollection) => c.name);
          const savedCollection = character.spriteConfig?.collection;
          
          if (savedCollection && collectionNames.includes(savedCollection)) {
            setSelectedCollectionName(savedCollection);
          } else {
            const hasCustom = collectionNames.includes('custom');
            if (hasCustom) {
              setSelectedCollectionName('custom');
            } else {
              setSelectedCollectionName(collectionsData.collections[0].name);
            }
          }
        }
      } catch (error) {
        spriteLogger.error('Error fetching sprite data', { error });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [character.spriteConfig?.collection]);

  // Filter sprites by selected collection
  const spritesInSelectedCollection = useMemo(() => {
    if (!selectedCollectionName) return customSprites;
    return customSprites.filter(s => s.pack === selectedCollectionName);
  }, [customSprites, selectedCollectionName]);

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

        {/* Sprite Packs Tab */}
        <TabsContent value="packs" className="space-y-4 mt-3">
          <SpritePackEditorV2
            character={character}
            customSprites={spritesInSelectedCollection}
            selectedCollectionName={selectedCollectionName}
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
