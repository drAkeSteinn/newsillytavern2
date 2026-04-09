'use client';

import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FolderOpen, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SpriteCollection } from '@/types';

interface SpriteCollectionSelectorProps {
  value?: string;
  onChange: (collectionName: string) => void;
  placeholder?: string;
}

export function SpriteCollectionSelector({ 
  value, 
  onChange, 
  placeholder = "Sin colección asignada" 
}: SpriteCollectionSelectorProps) {
  const [collections, setCollections] = useState<SpriteCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCollections = async () => {
    try {
      const response = await fetch('/api/sprites/collections');
      const data = await response.json();
      setCollections(data.collections || []);
    } catch (error) {
      console.error('Error fetching sprite collections:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCollections();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchCollections();
  };

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger className="h-8">
          <SelectValue placeholder="Cargando..." />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <div className="flex gap-1 items-center">
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger className="h-8 flex-1">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {collections.length === 0 ? (
            <div className="px-2 py-3 text-center text-xs text-muted-foreground">
              No hay colecciones disponibles
            </div>
          ) : (
            collections.map((collection) => (
              <SelectItem key={collection.id} value={collection.name}>
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-3 h-3" />
                  <span>{collection.name}</span>
                  <Badge variant="outline" className="text-[10px] h-4 px-1 ml-1">
                    {collection.files.length}
                  </Badge>
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 flex-shrink-0"
        onClick={handleRefresh}
        disabled={refreshing}
        title="Actualizar colecciones"
      >
        <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
      </Button>
    </div>
  );
}
