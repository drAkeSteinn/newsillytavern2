'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type {
  SpriteTimelineCollection,
  TimelineSprite,
  TimelineTrack,
  TimelineKeyframe,
  SoundKeyframeValue,
  SpriteAnimationFormat,
  SoundTrigger,
  TimelineData,
} from '@/types';
import {
  DEFAULT_SOUND_KEYFRAME_VALUE,
  createDefaultTimelineData,
} from '@/types';
import {
  Play,
  Pause,
  Square,
  Trash2,
  Upload,
  RefreshCw,
  Volume2,
  VolumeX,
  Image as ImageIcon,
  Film,
  Music,
  Clock,
  Layers,
  ZoomIn,
  ZoomOut,
  Magnet,
  FileVideo,
  Sparkles,
  Loader2,
  FolderOpen,
  GripVertical,
  Save,
  Move,
} from 'lucide-react';
import { useTavernStore } from '@/store/tavern-store';
import { useToast } from '@/hooks/use-toast';

// Audio cache for preloading sounds
const audioCache = new Map<string, HTMLAudioElement>();

// Format time in MM:SS.mmm format
const formatTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
};

// Parse time from MM:SS.mmm format
const parseTime = (str: string): number => {
  const match = str.match(/^(\d+):(\d+)\.?(\d*)$/);
  if (!match) return 0;
  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  const milliseconds = parseInt((match[3] || '0').padEnd(3, '0'), 10);
  return minutes * 60 * 1000 + seconds * 1000 + milliseconds;
};

// Get format icon
const getFormatIcon = (format: string) => {
  switch (format) {
    case 'webm':
    case 'mp4':
      return <FileVideo className="w-4 h-4 text-blue-400" />;
    case 'gif':
      return <Film className="w-4 h-4 text-purple-400" />;
    case 'webp':
      return <ImageIcon className="w-4 h-4 text-green-400" />;
    default:
      return <ImageIcon className="w-4 h-4 text-muted-foreground" />;
  }
};

// Get format from filename
const getFormatFromFilename = (filename: string): SpriteAnimationFormat => {
  const ext = filename.split('.').pop()?.toLowerCase() || 'png';
  if (ext === 'webm') return 'webm';
  if (ext === 'mp4') return 'mp4';
  if (ext === 'gif') return 'gif';
  if (ext === 'webp') return 'webp';
  if (ext === 'jpg' || ext === 'jpeg') return 'jpg';
  return 'png';
};

// Sprite collection file from API (now includes metadata)
interface SpriteCollectionFile {
  name: string;
  url: string;
  type: 'image' | 'animation';
  // Timeline data from metadata
  label?: string;
  duration?: number;
  timeline?: TimelineData;
}

interface SpriteCollectionFromAPI {
  id: string;
  name: string;
  path: string;
  files: SpriteCollectionFile[];
}

// ============================================
// Main Component
// ============================================

export function SpriteTimelineEditor() {
  const {
    editorState,
    selectCollection,
    selectSprite,
    selectKeyframe,
    setZoom,
    toggleSnap,
    soundTriggers,
    soundCollections,
  } = useTavernStore();

  const { toast } = useToast();
  
  // Local state for collections loaded from filesystem
  const [spriteCollections, setSpriteCollections] = useState<SpriteCollectionFromAPI[]>([]);
  const [timelineCollections, setTimelineCollections] = useState<SpriteTimelineCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // UI state
  const [playbackTime, setPlaybackTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const animationRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  
  // Playhead dragging state
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  
  // Keyframe dragging state
  const [draggingKeyframe, setDraggingKeyframe] = useState<{trackId: string; keyframeId: string} | null>(null);
  
  // Track which keyframes have been triggered during playback
  const triggeredKeyframesRef = useRef<Set<string>>(new Set());
  
  // Audio context for playing sounds
  const audioContextRef = useRef<AudioContext | null>(null);

  // Get selected items
  const selectedCollection = timelineCollections.find(c => c.id === editorState.selectedCollectionId);
  const selectedSprite = selectedCollection?.sprites.find(s => s.id === editorState.selectedSpriteId);
  const selectedTrack = selectedSprite?.timeline.tracks.find(t => t.id === editorState.selectedTrackId);
  const selectedKeyframe = selectedTrack?.keyframes.find(k => k.id === editorState.selectedKeyframeId);

  // Fetch sprite collections from filesystem (now includes metadata)
  const fetchCollections = useCallback(async () => {
    try {
      const response = await fetch('/api/sprites/collections');
      const data = await response.json();
      const apiCollections: SpriteCollectionFromAPI[] = data.collections || [];
      
      setSpriteCollections(apiCollections);
      
      // Convert to timeline collections - USE METADATA IF AVAILABLE
      const timelineCols: SpriteTimelineCollection[] = apiCollections.map(col => {
        const sprites: TimelineSprite[] = col.files.map(file => {
          const format = getFormatFromFilename(file.name);
          
          // Use metadata if available, otherwise use defaults
          const timeline = file.timeline || createDefaultTimelineData();
          const duration = file.duration || (format === 'webm' || format === 'mp4' || format === 'gif' ? 3000 : 0);
          const label = file.label || file.name.replace(/\.[^/.]+$/, '');
          
          return {
            id: `${col.id}_${file.name}`,
            label,
            url: file.url,
            format,
            duration,
            timeline: {
              ...timeline,
              duration: duration, // Sync duration
            },
            triggerKeys: [],
            triggerRequirePipes: false,
            triggerCaseSensitive: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        });
        
        return {
          id: col.id,
          name: col.name,
          sprites,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });
      
      setTimelineCollections(timelineCols);
      
      return timelineCols;
    } catch (error) {
      console.error('Failed to fetch sprite collections:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las colecciones de sprites',
        variant: 'destructive',
      });
      return [];
    }
  }, [toast]);

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchCollections();
      
      // Also load sound collections if not loaded
      if (soundCollections.length === 0) {
        try {
          const response = await fetch('/api/sounds/collections');
          const data = await response.json();
          if (data.collections && Array.isArray(data.collections)) {
            useTavernStore.getState().setSoundCollections(data.collections);
            console.log('[TimelineEditor] Loaded sound collections:', data.collections.length);
          }
        } catch (error) {
          console.error('[TimelineEditor] Failed to load sound collections:', error);
        }
      }
      
      setLoading(false);
    };
    init();
  }, [fetchCollections, soundCollections.length]);

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchCollections();
    setRefreshing(false);
  };

  // Handle collection selection
  const handleSelectCollection = (collectionId: string) => {
    selectCollection(collectionId);
  };

  // Handle sprite selection
  const handleSelectSprite = (spriteId: string) => {
    selectSprite(spriteId);
    setPlaybackTime(0);
    setIsPlaying(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !selectedCollection) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'sprite');
        formData.append('collection', selectedCollection.name);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();
        
        if (data.success) {
          const format = getFormatFromFilename(file.name);
          const newSprite: TimelineSprite = {
            id: `${selectedCollection.id}_${file.name}`,
            label: file.name.replace(/\.[^/.]+$/, ''),
            url: data.url,
            format,
            duration: format === 'webm' || format === 'mp4' || format === 'gif' ? 3000 : 0,
            timeline: createDefaultTimelineData(),
            triggerKeys: [],
            triggerRequirePipes: false,
            triggerCaseSensitive: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          
          setTimelineCollections(prev => prev.map(col => 
            col.id === selectedCollection.id
              ? { ...col, sprites: [...col.sprites, newSprite] }
              : col
          ));
        }
      }
      
      toast({
        title: 'Sprites subidos',
        description: `${files.length} sprite(s) subido(s) correctamente`,
      });
    } catch (error) {
      console.error('Failed to upload sprite:', error);
      toast({
        title: 'Error',
        description: 'No se pudo subir el sprite',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle sprite deletion
  const handleDeleteSprite = async (spriteId: string) => {
    if (!selectedCollection) return;
    
    const sprite = selectedCollection.sprites.find(s => s.id === spriteId);
    if (!sprite) return;
    
    if (!confirm(`¿Eliminar el sprite "${sprite.label}"?`)) return;
    
    try {
      setTimelineCollections(prev => prev.map(col =>
        col.id === selectedCollection.id
          ? { ...col, sprites: col.sprites.filter(s => s.id !== spriteId) }
          : col
      ));
      
      if (editorState.selectedSpriteId === spriteId) {
        selectSprite(null);
      }
      
      toast({
        title: 'Sprite eliminado',
        description: `El sprite "${sprite.label}" ha sido eliminado`,
      });
    } catch (error) {
      console.error('Failed to delete sprite:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el sprite',
        variant: 'destructive',
      });
    }
  };

  // Handle sprite update
  const handleUpdateSprite = (spriteId: string, updates: Partial<TimelineSprite>) => {
    if (!selectedCollection) return;
    
    setTimelineCollections(prev => prev.map(col =>
      col.id === selectedCollection.id
        ? {
            ...col,
            sprites: col.sprites.map(s =>
              s.id === spriteId ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
            ),
            updatedAt: new Date().toISOString(),
          }
        : col
    ));
  };

  // Save sprite configuration to JSON - AUTOSAVE
  const handleSaveConfiguration = useCallback(async () => {
    if (!selectedCollection || !selectedSprite) return;
    
    setSaving(true);
    try {
      // Extract filename from sprite id
      const filename = selectedSprite.id.replace(`${selectedCollection.id}_`, '');
      
      const spriteData = {
        filename,
        label: selectedSprite.label,
        duration: selectedSprite.duration,
        timeline: selectedSprite.timeline,
      };
      
      const response = await fetch('/api/sprites/collections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectionName: selectedCollection.name,
          spriteData,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Guardado',
          description: `Configuración de "${selectedSprite.label}" guardada correctamente`,
        });
      } else {
        throw new Error(result.error || 'Error al guardar');
      }
    } catch (error) {
      console.error('Failed to save sprite configuration:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar la configuración',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, [selectedCollection, selectedSprite, toast]);

  // Update preview media position
  const updatePreviewPosition = useCallback((time: number) => {
    const video = previewVideoRef.current;
    
    if (video && selectedSprite && (selectedSprite.format === 'webm' || selectedSprite.format === 'mp4')) {
      const videoTime = (time / 1000);
      if (video.duration > 0) {
        video.currentTime = videoTime % video.duration;
      }
    }
  }, [selectedSprite]);

  // Play sound from sound trigger
  const playSoundFromTrigger = useCallback(async (trigger: SoundTrigger, volume: number = 1) => {
    try {
      console.log('[TimelineEditor] 🎵 Attempting to play trigger:', trigger.name, 'collection:', trigger.collection);
      
      // Get the collection for this trigger
      const collection = soundCollections.find(c => c.name === trigger.collection);
      if (!collection) {
        console.warn('[TimelineEditor] ⚠️ Collection NOT found:', trigger.collection, 'Available:', soundCollections.map(c => c.name));
        return;
      }
      
      if (!collection.files || collection.files.length === 0) {
        console.warn('[TimelineEditor] ⚠️ Collection has no files:', trigger.collection);
        return;
      }
      
      // Pick a sound based on play mode
      let soundFile: string;
      if (trigger.playMode === 'random') {
        soundFile = collection.files[Math.floor(Math.random() * collection.files.length)];
      } else {
        // Cyclic mode - use currentIndex
        const index = trigger.currentIndex || 0;
        soundFile = collection.files[index % collection.files.length];
      }
      
      // The soundFile already contains the full path like "/sounds/glohg/glohg1.wav"
      // So we use it directly
      const soundUrl = soundFile;
      console.log('[TimelineEditor] 🔊 Playing sound:', soundUrl, 'volume:', volume);
      
      // Get or create audio element from cache
      let audio = audioCache.get(soundUrl);
      if (!audio) {
        audio = new Audio(soundUrl);
        audio.load();
        audioCache.set(soundUrl, audio);
      }
      
      // Clone and play (allows overlapping sounds)
      const audioClone = audio.cloneNode() as HTMLAudioElement;
      audioClone.volume = volume * (trigger.volume || 1);
      audioClone.currentTime = 0;
      
      await audioClone.play().catch(e => {
        console.warn('[TimelineEditor] ❌ Audio play failed:', e);
      });
      
      console.log('[TimelineEditor] ✅ Sound playing successfully');
      
      // Clean up after playback
      audioClone.onended = () => {
        audioClone.remove();
      };
    } catch (error) {
      console.error('[TimelineEditor] ❌ Failed to play sound:', error);
    }
  }, [soundCollections]);
  
  // Check and play sounds at current time
  const checkAndPlaySounds = useCallback((currentTime: number) => {
    if (!selectedSprite) return;
    
    // Reset triggered keyframes if we've looped back
    if (currentTime < 100) {
      triggeredKeyframesRef.current.clear();
    }
    
    // Check each track for keyframes to trigger
    selectedSprite.timeline.tracks.forEach((track, trackIndex) => {
      if (track.muted) {
        console.log(`[TimelineEditor] 🔇 Track ${trackIndex} (${track.name}) is muted, skipping`);
        return;
      }
      
      track.keyframes.forEach(keyframe => {
        const keyframeId = keyframe.id;
        const keyframeTime = keyframe.time;
        
        // Check if playhead is crossing this keyframe (within 100ms tolerance for smoother detection)
        const isCrossing = currentTime >= keyframeTime && currentTime < keyframeTime + 100;
        
        if (isCrossing && !triggeredKeyframesRef.current.has(keyframeId)) {
          triggeredKeyframesRef.current.add(keyframeId);
          
          // Get sound trigger info
          const soundValue = keyframe.value as SoundKeyframeValue & { 
            soundTriggerId?: string; 
            soundTriggerName?: string;
          };
          
          console.log(`[TimelineEditor] 🎯 Keyframe triggered at ${keyframeTime}ms (current: ${currentTime}ms)`, {
            soundTriggerId: soundValue.soundTriggerId,
            soundTriggerName: soundValue.soundTriggerName,
            play: soundValue.play,
            volume: soundValue.volume
          });
          
          if (soundValue.soundTriggerId && soundValue.play) {
            // Find the sound trigger
            const trigger = soundTriggers?.find((t: SoundTrigger) => t.id === soundValue.soundTriggerId);
            if (trigger) {
              console.log(`[TimelineEditor] 🎵 Found trigger:`, trigger.name, 'collection:', trigger.collection);
              playSoundFromTrigger(trigger, soundValue.volume || 1);
            } else {
              console.warn(`[TimelineEditor] ⚠️ Trigger not found with ID:`, soundValue.soundTriggerId);
              console.log(`[TimelineEditor] Available triggers:`, soundTriggers?.map(t => ({ id: t.id, name: t.name })));
            }
          } else {
            console.log(`[TimelineEditor] ⏭️ Keyframe has no sound trigger or play=false`);
          }
        }
      });
    });
  }, [selectedSprite, soundTriggers, playSoundFromTrigger]);

  // Handle playback controls
  const handlePlay = useCallback(() => {
    if (!selectedSprite) return;
    
    // Reset triggered keyframes when starting playback
    if (playbackTime === 0) {
      triggeredKeyframesRef.current.clear();
    }
    
    setIsPlaying(true);
    const startTime = Date.now() - playbackTime;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const duration = selectedSprite.timeline.duration;
      const currentTime = elapsed % duration;
      setPlaybackTime(currentTime);
      updatePreviewPosition(currentTime);
      
      // Check and play sounds at current position
      checkAndPlaySounds(currentTime);
      
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
    
    // Also play the video if it's a video sprite
    const video = previewVideoRef.current;
    if (video && (selectedSprite.format === 'webm' || selectedSprite.format === 'mp4')) {
      video.play().catch(() => {});
    }
  }, [selectedSprite, playbackTime, updatePreviewPosition, checkAndPlaySounds]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    // Clear triggered keyframes on pause so they can be replayed when seeking back
    triggeredKeyframesRef.current.clear();
    
    const video = previewVideoRef.current;
    if (video) {
      video.pause();
    }
  }, []);

  const handleStop = useCallback(() => {
    setIsPlaying(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setPlaybackTime(0);
    triggeredKeyframesRef.current.clear(); // Clear triggered keyframes
    
    const video = previewVideoRef.current;
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
  }, []);

  // Handle seek to specific time
  const handleSeek = useCallback((time: number) => {
    if (!selectedSprite) return;
    
    const duration = selectedSprite.timeline.duration;
    const clampedTime = Math.max(0, Math.min(time, duration));
    
    setPlaybackTime(clampedTime);
    updatePreviewPosition(clampedTime);
    
    // Clear triggered keyframes when seeking to allow sounds to play again
    // We need to clear all keyframes that are AFTER the new position
    // so they can be triggered again when the playhead crosses them
    triggeredKeyframesRef.current.clear();
    
    // Update video position
    const video = previewVideoRef.current;
    if (video && (selectedSprite.format === 'webm' || selectedSprite.format === 'mp4')) {
      if (video.duration > 0) {
        video.currentTime = (clampedTime / 1000) % video.duration;
      }
    }
  }, [selectedSprite, updatePreviewPosition]);

  // Track if there are unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const lastSavedSpriteRef = useRef<TimelineSprite | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Auto-save when sprite changes are detected
  useEffect(() => {
    if (!selectedSprite || !selectedCollection) return;
    
    // Skip if this is the initial load or no changes detected
    if (!hasUnsavedChanges) return;
    
    // Debounce auto-save
    const saveTimeout = setTimeout(() => {
      handleSaveConfiguration();
      setHasUnsavedChanges(false);
    }, 1000); // Save after 1 second of inactivity
    
    return () => clearTimeout(saveTimeout);
  }, [selectedSprite?.timeline, selectedSprite?.duration, selectedSprite?.label, hasUnsavedChanges]);

  // Mark changes when timeline data changes
  useEffect(() => {
    if (selectedSprite && selectedCollection) {
      // Check if sprite data actually changed
      if (lastSavedSpriteRef.current) {
        const hasChanges = 
          JSON.stringify(selectedSprite.timeline) !== JSON.stringify(lastSavedSpriteRef.current.timeline) ||
          selectedSprite.duration !== lastSavedSpriteRef.current.duration ||
          selectedSprite.label !== lastSavedSpriteRef.current.label;
        
        if (hasChanges) {
          setHasUnsavedChanges(true);
        }
      }
    }
  }, [selectedSprite?.timeline, selectedSprite?.duration, selectedSprite?.label, selectedSprite, selectedCollection]);

  // Save when switching sprites or collections
  useEffect(() => {
    // Save previous sprite before switching
    if (lastSavedSpriteRef.current && hasUnsavedChanges) {
      handleSaveConfiguration();
    }
    
    // Update ref to current sprite
    if (selectedSprite) {
      lastSavedSpriteRef.current = { ...selectedSprite };
    } else {
      lastSavedSpriteRef.current = null;
    }
    
    setHasUnsavedChanges(false);
  }, [editorState.selectedSpriteId, editorState.selectedCollectionId]);

  // Handle add track
  const handleAddTrack = () => {
    if (!selectedSprite) return;
    
    const trackId = crypto.randomUUID ? crypto.randomUUID() : `track_${Date.now()}`;
    const newTrack: TimelineTrack = {
      id: trackId,
      type: 'sound',
      name: `Sound Track ${selectedSprite.timeline.tracks.length + 1}`,
      keyframes: [],
      enabled: true,
      locked: false,
      muted: false,
      volume: 1,
    };
    
    setTimelineCollections(prev => prev.map(col => ({
      ...col,
      sprites: col.sprites.map(s =>
        s.id === selectedSprite.id
          ? { ...s, timeline: { ...s.timeline, tracks: [...s.timeline.tracks, newTrack] } }
          : s
      ),
    })));
  };

  // Handle track update
  const handleUpdateTrack = (trackId: string, updates: Partial<TimelineTrack>) => {
    if (!selectedSprite) return;
    
    setTimelineCollections(prev => prev.map(col => ({
      ...col,
      sprites: col.sprites.map(s =>
        s.id === selectedSprite.id
          ? { ...s, timeline: { ...s.timeline, tracks: s.timeline.tracks.map(t => t.id === trackId ? { ...t, ...updates } : t) } }
          : s
      ),
    })));
  };

  // Handle track delete
  const handleDeleteTrack = (trackId: string) => {
    if (!selectedSprite) return;
    
    setTimelineCollections(prev => prev.map(col => ({
      ...col,
      sprites: col.sprites.map(s =>
        s.id === selectedSprite.id
          ? { ...s, timeline: { ...s.timeline, tracks: s.timeline.tracks.filter(t => t.id !== trackId) } }
          : s
      ),
    })));
  };

  // Handle keyframe update
  const handleUpdateKeyframe = (trackId: string, keyframeId: string, updates: Partial<TimelineKeyframe>) => {
    if (!selectedSprite) return;
    
    setTimelineCollections(prev => prev.map(col => ({
      ...col,
      sprites: col.sprites.map(s =>
        s.id === selectedSprite.id
          ? {
              ...s,
              timeline: {
                ...s.timeline,
                tracks: s.timeline.tracks.map(t =>
                  t.id === trackId
                    ? { ...t, keyframes: t.keyframes.map(k => k.id === keyframeId ? { ...k, ...updates } : k) }
                    : t
                ),
              },
            }
          : s
      ),
    })));
  };

  // Handle keyframe delete
  const handleDeleteKeyframe = (trackId: string, keyframeId: string) => {
    if (!selectedSprite) return;
    
    setTimelineCollections(prev => prev.map(col => ({
      ...col,
      sprites: col.sprites.map(s =>
        s.id === selectedSprite.id
          ? {
              ...s,
              timeline: {
                ...s.timeline,
                tracks: s.timeline.tracks.map(t =>
                  t.id === trackId
                    ? { ...t, keyframes: t.keyframes.filter(k => k.id !== keyframeId) }
                    : t
                ),
              },
            }
          : s
      ),
    })));
    
    if (editorState.selectedKeyframeId === keyframeId) {
      selectKeyframe(null);
    }
  };

  // Handle keyframe move
  const handleMoveKeyframe = (trackId: string, keyframeId: string, newTime: number) => {
    if (!selectedSprite) return;
    
    let time = newTime;
    if (editorState.snapEnabled && editorState.snapInterval > 0) {
      time = Math.round(newTime / editorState.snapInterval) * editorState.snapInterval;
    }
    time = Math.max(0, time);
    
    setTimelineCollections(prev => prev.map(col => ({
      ...col,
      sprites: col.sprites.map(s =>
        s.id === selectedSprite.id
          ? {
              ...s,
              timeline: {
                ...s.timeline,
                tracks: s.timeline.tracks.map(t =>
                  t.id === trackId
                    ? { ...t, keyframes: t.keyframes.map(k => k.id === keyframeId ? { ...k, time } : k).sort((a, b) => a.time - b.time) }
                    : t
                ),
              },
            }
          : s
      ),
    })));
  };

  // Handle drag start for sound trigger
  const handleDragStart = (e: React.DragEvent, trigger: SoundTrigger) => {
    e.dataTransfer.setData('soundTrigger', JSON.stringify(trigger));
    e.dataTransfer.effectAllowed = 'copy';
  };

  // Handle drop on timeline track
  const handleTrackDrop = (e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    
    const triggerData = e.dataTransfer.getData('soundTrigger');
    if (!triggerData || !selectedSprite) return;
    
    try {
      const trigger: SoundTrigger = JSON.parse(triggerData);
      
      // Calculate time from drop position
      const rect = e.currentTarget.getBoundingClientRect();
      const scrollLeft = timelineScrollRef.current?.scrollLeft || 0;
      const trackHeaderWidth = 180;
      const mouseX = e.clientX - rect.left + scrollLeft - trackHeaderWidth;
      const time = mouseX / editorState.zoom;
      
      // Create keyframe with sound trigger reference
      const keyframeId = crypto.randomUUID ? crypto.randomUUID() : `kf_${Date.now()}`;
      let keyframeTime = Math.max(0, time);
      
      // Apply snap
      if (editorState.snapEnabled && editorState.snapInterval > 0) {
        keyframeTime = Math.round(keyframeTime / editorState.snapInterval) * editorState.snapInterval;
      }
      
      const newKeyframe: TimelineKeyframe = {
        id: keyframeId,
        time: keyframeTime,
        value: {
          type: 'sound',
          soundUrl: '',
          soundTriggerId: trigger.id,
          soundTriggerName: trigger.name,
          volume: trigger.volume,
          pan: 0,
          play: true,
          stop: false,
        } as SoundKeyframeValue & { soundTriggerId?: string; soundTriggerName?: string },
        interpolation: 'hold',
      };
      
      setTimelineCollections(prev => prev.map(col => ({
        ...col,
        sprites: col.sprites.map(s =>
          s.id === selectedSprite.id
            ? {
                ...s,
                timeline: {
                  ...s.timeline,
                  tracks: s.timeline.tracks.map(t =>
                    t.id === trackId
                      ? { ...t, keyframes: [...t.keyframes, newKeyframe].sort((a, b) => a.time - b.time) }
                      : t
                  ),
                },
              }
            : s
        ),
      })));
      
      toast({
        title: 'Sonido agregado',
        description: `Trigger "${trigger.name}" agregado al timeline`,
      });
    } catch (error) {
      console.error('Failed to drop sound trigger:', error);
    }
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  // Safe video play handler for thumbnails
  const handleVideoHover = (spriteId: string, isEntering: boolean) => {
    const video = videoRefs.current.get(spriteId);
    if (!video) return;
    
    try {
      if (isEntering) {
        video.currentTime = 0;
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {});
        }
      } else {
        video.pause();
        video.currentTime = 0;
      }
    } catch {}
  };

  // ===== PLAYHEAD DRAG HANDLERS =====
  const handlePlayheadMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingPlayhead(true);
    if (isPlaying) {
      handlePause();
    }
  }, [isPlaying, handlePause]);

  const handlePlayheadMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingPlayhead || !selectedSprite || !timelineScrollRef.current || !rulerRef.current) return;
    
    const container = timelineScrollRef.current;
    const rect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft;
    const trackHeaderWidth = 180;
    
    // Calculate position relative to track content
    const mouseX = e.clientX - rect.left + scrollLeft - trackHeaderWidth;
    const time = mouseX / editorState.zoom;
    
    handleSeek(time);
  }, [isDraggingPlayhead, selectedSprite, editorState.zoom, handleSeek]);

  const handlePlayheadMouseUp = useCallback(() => {
    setIsDraggingPlayhead(false);
  }, []);

  // Add/remove mouse event listeners for playhead dragging
  useEffect(() => {
    if (isDraggingPlayhead) {
      window.addEventListener('mousemove', handlePlayheadMouseMove);
      window.addEventListener('mouseup', handlePlayheadMouseUp);
      return () => {
        window.removeEventListener('mousemove', handlePlayheadMouseMove);
        window.removeEventListener('mouseup', handlePlayheadMouseUp);
      };
    }
  }, [isDraggingPlayhead, handlePlayheadMouseMove, handlePlayheadMouseUp]);

  // ===== KEYFRAME DRAG HANDLERS =====
  const handleKeyframeMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingKeyframe || !selectedSprite || !timelineScrollRef.current) return;
    
    const container = timelineScrollRef.current;
    const rect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft;
    const trackHeaderWidth = 180;
    
    // Calculate position relative to track content
    const mouseX = e.clientX - rect.left + scrollLeft - trackHeaderWidth;
    let newTime = mouseX / editorState.zoom;
    
    // Apply snap
    if (editorState.snapEnabled && editorState.snapInterval > 0) {
      newTime = Math.round(newTime / editorState.snapInterval) * editorState.snapInterval;
    }
    
    // Clamp to valid range
    newTime = Math.max(0, Math.min(newTime, selectedSprite.timeline.duration));
    
    handleMoveKeyframe(draggingKeyframe.trackId, draggingKeyframe.keyframeId, newTime);
  }, [draggingKeyframe, selectedSprite, editorState.zoom, editorState.snapEnabled, editorState.snapInterval, handleMoveKeyframe]);

  const handleKeyframeMouseUp = useCallback(() => {
    setDraggingKeyframe(null);
  }, []);

  // Add/remove mouse event listeners for keyframe dragging
  useEffect(() => {
    if (draggingKeyframe) {
      window.addEventListener('mousemove', handleKeyframeMouseMove);
      window.addEventListener('mouseup', handleKeyframeMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleKeyframeMouseMove);
        window.removeEventListener('mouseup', handleKeyframeMouseUp);
      };
    }
  }, [draggingKeyframe, handleKeyframeMouseMove, handleKeyframeMouseUp]);

  // Handle timeline ruler click for seeking
  const handleRulerClick = (e: React.MouseEvent) => {
    if (!selectedSprite || !timelineScrollRef.current || !rulerRef.current) return;
    
    const rect = rulerRef.current.getBoundingClientRect();
    const scrollLeft = timelineScrollRef.current.scrollLeft;
    const trackHeaderWidth = 180;
    const clickX = e.clientX - rect.left + scrollLeft - trackHeaderWidth;
    const time = clickX / editorState.zoom;
    
    handleSeek(time);
  };

  // Calculate pixels per millisecond based on zoom
  const pixelsPerMs = editorState.zoom;
  const timelineWidth = selectedSprite ? Math.max(selectedSprite.timeline.duration * pixelsPerMs, 800) : 800;
  
  // Generate ruler marks with subdivisions (5 per second = 200ms intervals)
  const generateRulerMarks = () => {
    if (!selectedSprite) return null;
    
    const duration = selectedSprite.timeline.duration;
    const marks: JSX.Element[] = [];
    const subdivisionMs = 200; // 5 divisions per second
    
    // Calculate how many seconds we can fit
    const totalSeconds = Math.ceil(duration / 1000);
    
    for (let second = 0; second <= totalSeconds; second++) {
      // Main second mark
      const mainPosition = second * 1000 * pixelsPerMs;
      
      // Add subdivision marks
      for (let sub = 0; sub < 5; sub++) {
        const subMs = second * 1000 + sub * subdivisionMs;
        if (subMs > duration) break;
        
        const position = subMs * pixelsPerMs;
        const isMainMark = sub === 0;
        
        marks.push(
          <div
            key={`mark-${subMs}`}
            className="absolute top-0 flex flex-col items-center"
            style={{ left: `${position}px` }}
          >
            <div 
              className={cn(
                "w-px bg-muted-foreground/50",
                isMainMark ? "h-3" : "h-1.5 opacity-50"
              )} 
            />
            {isMainMark && (
              <span className="text-[10px] text-muted-foreground mt-0.5">{second}s</span>
            )}
          </div>
        );
      }
    }
    
    return marks;
  };

  // Loading state
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Cargando colecciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*,video/*"
        multiple
        onChange={handleFileUpload}
      />
      
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold">Editor de Sprite Timeline</h3>
          <Badge variant="outline" className="text-xs">
            {spriteCollections.length} colecciones
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveConfiguration}
            disabled={saving || !selectedSprite}
            title="Guardar configuración"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Recargar colecciones"
          >
            {refreshing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleSnap(!editorState.snapEnabled)}
            className={cn(editorState.snapEnabled && "bg-primary/10")}
            title="Activar/Desactivar Snap"
          >
            <Magnet className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom(Math.max(editorState.zoom / 1.5, 0.1))}
            disabled={editorState.zoom <= 0.1}
            title="Alejar (ver más timeline)"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom(Math.min(editorState.zoom * 1.5, 2))}
            disabled={editorState.zoom >= 2}
            title="Acercar (ver más detalle)"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 flex gap-4 overflow-hidden">
        {/* Left Panel - Collections & Sprites */}
        <div className="w-56 flex-shrink-0 flex flex-col gap-3 overflow-hidden border rounded-lg bg-muted/20 p-3">
          {/* Collections */}
          <div className="space-y-2">
            <Label className="text-xs font-medium flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Colecciones
            </Label>
            <ScrollArea className="h-32">
              <div className="space-y-1 pr-2">
                {spriteCollections.map((collection) => (
                  <div
                    key={collection.id}
                    className={cn(
                      "flex items-center justify-between p-2 rounded cursor-pointer transition-colors",
                      editorState.selectedCollectionId === collection.id
                        ? "bg-primary/20 border border-primary/30"
                        : "bg-muted/30 hover:bg-muted/50"
                    )}
                    onClick={() => handleSelectCollection(collection.id)}
                  >
                    <div className="flex items-center gap-2">
                      <FolderOpen className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm truncate">{collection.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {collection.files.length}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Sprites */}
          <div className="flex-1 min-h-0 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                Sprites
              </Label>
              {selectedCollection && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Upload className="w-3 h-3 mr-1" />
                  )}
                  Subir
                </Button>
              )}
            </div>
            <ScrollArea className="h-full">
              {selectedCollection ? (
                selectedCollection.sprites.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No hay sprites</p>
                    <p className="text-xs mt-1">Sube imágenes o videos</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 pr-2">
                    {selectedCollection.sprites.map((sprite) => (
                      <div
                        key={sprite.id}
                        className={cn(
                          "relative group rounded border overflow-hidden cursor-pointer transition-all",
                          editorState.selectedSpriteId === sprite.id
                            ? "ring-2 ring-primary"
                            : "hover:ring-1 hover:ring-primary/50"
                        )}
                        onClick={() => handleSelectSprite(sprite.id)}
                      >
                        <div className="aspect-square bg-muted/30 flex items-center justify-center">
                          {sprite.format === 'webm' || sprite.format === 'mp4' ? (
                            <video
                              ref={(el) => {
                                if (el) videoRefs.current.set(sprite.id, el);
                                else videoRefs.current.delete(sprite.id);
                              }}
                              src={sprite.url}
                              className="w-full h-full object-cover"
                              muted
                              playsInline
                              preload="metadata"
                              onMouseEnter={() => handleVideoHover(sprite.id, true)}
                              onMouseLeave={() => handleVideoHover(sprite.id, false)}
                            />
                          ) : (
                            <img
                              src={sprite.thumbnail || sprite.url}
                              alt={sprite.label}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <div className="p-1 bg-background/80">
                          <div className="flex items-center gap-1">
                            {getFormatIcon(sprite.format)}
                            <span className="text-xs truncate flex-1">{sprite.label}</span>
                          </div>
                        </div>
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-5 w-5"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSprite(sprite.id);
                            }}
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <p>Selecciona una colección</p>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* Center - Preview & Timeline */}
        <div className="flex-1 flex flex-col overflow-hidden border rounded-lg bg-muted/20">
          {selectedSprite ? (
            <>
              {/* Preview Area */}
              <div className="flex gap-4 p-3 border-b bg-muted/30 flex-shrink-0">
                {/* Sprite Preview */}
                <div className="relative w-48 h-32 bg-black/20 rounded-lg overflow-hidden flex items-center justify-center">
                  {selectedSprite.format === 'webm' || selectedSprite.format === 'mp4' ? (
                    <video
                      ref={previewVideoRef}
                      src={selectedSprite.url}
                      className="max-w-full max-h-full object-contain"
                      muted
                      playsInline
                      loop
                    />
                  ) : selectedSprite.format === 'gif' ? (
                    <img
                      src={selectedSprite.url}
                      alt={selectedSprite.label}
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <img
                      src={selectedSprite.url}
                      alt={selectedSprite.label}
                      className="max-w-full max-h-full object-contain"
                    />
                  )}
                  {/* Time overlay */}
                  <div className="absolute bottom-1 right-1 bg-black/70 px-2 py-0.5 rounded text-xs font-mono text-white">
                    {formatTime(playbackTime)}
                  </div>
                </div>

                {/* Controls */}
                <div className="flex-1 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={isPlaying ? handlePause : handlePlay}
                      >
                        {isPlaying ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleStop}
                      >
                        <Square className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-mono">{formatTime(playbackTime)}</span>
                      <span className="text-xs text-muted-foreground">/ {formatTime(selectedSprite.timeline.duration)}</span>
                    </div>
                    
                    {/* Save button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 ml-2"
                      onClick={handleSaveConfiguration}
                      disabled={saving}
                    >
                      {saving ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Save className="w-3 h-3 mr-1" />
                      )}
                      Guardar
                    </Button>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Duración:</Label>
                      <Input
                        type="text"
                        value={formatTime(selectedSprite.timeline.duration)}
                        onChange={(e) => {
                          const newDuration = parseTime(e.target.value);
                          if (newDuration > 0) {
                            handleUpdateSprite(selectedSprite.id, {
                              duration: newDuration,
                              timeline: { ...selectedSprite.timeline, duration: newDuration },
                            });
                          }
                        }}
                        className="w-24 h-7 text-xs font-mono"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Loop:</Label>
                      <Switch
                        checked={selectedSprite.timeline.loop}
                        onCheckedChange={(checked) => handleUpdateSprite(selectedSprite.id, {
                          timeline: { ...selectedSprite.timeline, loop: checked },
                        })}
                      />
                    </div>

                    <Button variant="outline" size="sm" className="h-7 ml-auto" onClick={handleAddTrack}>
                      <Music className="w-3 h-3 mr-1" />
                      Añadir Track
                    </Button>
                  </div>

                  {/* Sprite info */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      {getFormatIcon(selectedSprite.format)}
                      {selectedSprite.format.toUpperCase()}
                    </span>
                    <span>Tracks: {selectedSprite.timeline.tracks.length}</span>
                    <span>Keyframes: {selectedSprite.timeline.tracks.reduce((acc, t) => acc + t.keyframes.length, 0)}</span>
                    <span className="text-muted-foreground">|</span>
                    <span>Zoom: {(editorState.zoom * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>

              {/* Timeline Area with horizontal scroll */}
              <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                {/* Timeline Container with horizontal scrollbar */}
                <div 
                  ref={timelineScrollRef}
                  className="flex-1 overflow-x-auto overflow-y-auto"
                  style={{ scrollbarWidth: 'thin' }}
                >
                  <div 
                    ref={timelineContainerRef}
                    className="relative"
                    style={{ width: `${timelineWidth + 180}px`, minWidth: '100%' }}
                  >
                    {/* Timeline Ruler - Clickable for seeking */}
                    <div 
                      ref={rulerRef}
                      className="h-6 border-b bg-muted/50 sticky top-0 z-10 cursor-crosshair"
                      onClick={handleRulerClick}
                    >
                      <div className="relative h-full" style={{ width: `${timelineWidth}px`, marginLeft: '180px' }}>
                        {/* Ruler marks with subdivisions */}
                        {generateRulerMarks()}
                        
                        {/* Playhead on ruler - DRAGGABLE with larger hit area */}
                        <div
                          className={cn(
                            "absolute top-0 bottom-0 z-30 select-none",
                            isDraggingPlayhead ? "cursor-grabbing" : "cursor-grab"
                          )}
                          style={{ 
                            left: `${playbackTime * pixelsPerMs}px`,
                            width: '20px',
                            marginLeft: '-10px',
                            display: 'flex',
                            justifyContent: 'center'
                          }}
                          onMouseDown={handlePlayheadMouseDown}
                        >
                          {/* Invisible larger hit area for easier grabbing */}
                          <div className="absolute inset-0 z-40" />
                          
                          {/* Playhead line - visible part */}
                          <div className={cn(
                            "w-0.5 bg-red-500 h-full transition-all",
                            isDraggingPlayhead ? "w-1" : "hover:w-1"
                          )} />
                          
                          {/* Playhead handle - more visible and easier to grab */}
                          <div 
                            className={cn(
                              "absolute top-0 left-1/2 -translate-x-1/2 w-5 h-5 bg-red-500 rounded-full",
                              "flex items-center justify-center shadow-lg",
                              "border-2 border-white z-50",
                              "hover:scale-110 transition-transform",
                              isDraggingPlayhead && "scale-125 bg-red-600"
                            )}
                            style={{ cursor: isDraggingPlayhead ? 'grabbing' : 'grab' }}
                          >
                            <div className="w-2 h-2 bg-white rounded-full" />
                          </div>
                          {/* Playhead line extending through tracks */}
                          <div className="absolute top-6 left-1/2 -translate-x-1/2 w-0.5 h-[2000px] bg-red-500/30 pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    {/* Track rows */}
                    {selectedSprite.timeline.tracks.map((track) => (
                      <div key={track.id} className="flex border-b min-h-[50px]">
                        {/* Track header - Fixed width */}
                        <div className="w-44 flex-shrink-0 p-2 border-r bg-muted/30 flex flex-col gap-1 sticky left-0 z-10">
                          <div className="flex items-center gap-2">
                            <Music className="w-3 h-3 text-blue-400" />
                            <span className="text-xs font-medium truncate flex-1">{track.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={() => handleUpdateTrack(track.id, { muted: !track.muted })}
                            >
                              {track.muted ? (
                                <VolumeX className="w-2.5 h-2.5 text-muted-foreground" />
                              ) : (
                                <Volume2 className="w-2.5 h-2.5" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteTrack(track.id)}
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </Button>
                          </div>
                        </div>
                        
                        {/* Track content - Keyframes area */}
                        <div
                          className="flex-1 relative min-h-[50px] bg-muted/10"
                          style={{ width: `${timelineWidth}px` }}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleTrackDrop(e, track.id)}
                        >
                          {/* Keyframes */}
                          {track.keyframes.map((keyframe) => (
                            <div
                              key={keyframe.id}
                              className={cn(
                                "absolute top-1/2 -translate-y-1/2 w-5 h-7 rounded cursor-grab active:cursor-grabbing group",
                                editorState.selectedKeyframeId === keyframe.id 
                                  ? "bg-amber-500 hover:bg-amber-400 border-2 border-amber-300" 
                                  : "bg-blue-500 hover:bg-blue-400 border border-blue-300",
                                draggingKeyframe?.keyframeId === keyframe.id && "scale-110 bg-amber-500 border-2 border-white"
                              )}
                              style={{ left: `${keyframe.time * pixelsPerMs - 10}px` }}
                              onClick={(e) => {
                                e.stopPropagation();
                                selectKeyframe(keyframe.id);
                              }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                selectKeyframe(keyframe.id);
                                setDraggingKeyframe({ trackId: track.id, keyframeId: keyframe.id });
                              }}
                            >
                              <Move className="w-3 h-3 text-white m-auto opacity-70 group-hover:opacity-100" />
                              {/* Keyframe info tooltip */}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-black/80 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-30">
                                {formatTime(keyframe.time)}
                                {(keyframe.value as SoundKeyframeValue & { soundTriggerName?: string })?.soundTriggerName && (
                                  <span className="block text-blue-300">
                                    {(keyframe.value as SoundKeyframeValue & { soundTriggerName?: string }).soundTriggerName}
                                  </span>
                                )}
                              </div>
                              {/* Delete button */}
                              <button
                                className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteKeyframe(track.id, keyframe.id);
                                }}
                              >
                                <span className="text-[8px] text-white">×</span>
                              </button>
                            </div>
                          ))}
                          
                          {/* Playhead indicator for this track */}
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-red-500/50 pointer-events-none"
                            style={{ left: `${playbackTime * pixelsPerMs}px` }}
                          />
                        </div>
                      </div>
                    ))}
                    
                    {/* Empty state for tracks */}
                    {selectedSprite.timeline.tracks.length === 0 && (
                      <div className="flex border-b min-h-[100px]">
                        <div className="w-44 flex-shrink-0 p-2 border-r bg-muted/30 flex items-center justify-center sticky left-0 z-10">
                          <span className="text-xs text-muted-foreground">Sin tracks</span>
                        </div>
                        <div 
                          className="flex-1 flex items-center justify-center text-muted-foreground text-sm"
                          style={{ width: `${timelineWidth}px` }}
                        >
                          Haz clic en "Añadir Track" para crear un track de sonido
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>Selecciona un sprite para editar su timeline</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Properties & Resources */}
        <div className="w-64 flex-shrink-0 flex flex-col overflow-hidden border rounded-lg bg-muted/20">
          <Tabs defaultValue="properties" className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
              <TabsTrigger value="properties" className="text-xs">Propiedades</TabsTrigger>
              <TabsTrigger value="resources" className="text-xs">Recursos</TabsTrigger>
            </TabsList>
            
            <TabsContent value="properties" className="flex-1 overflow-hidden m-0">
              <ScrollArea className="h-full p-3">
                {selectedKeyframe ? (
                  <div className="space-y-3">
                    <Label className="text-xs font-medium">Keyframe Seleccionado</Label>
                    
                    <div className="space-y-2">
                      <Label className="text-xs">Tiempo</Label>
                      <Input
                        type="text"
                        value={formatTime(selectedKeyframe.time)}
                        onChange={(e) => {
                          const newTime = parseTime(e.target.value);
                          if (newTime >= 0) {
                            handleMoveKeyframe(selectedTrack!.id, selectedKeyframe.id, newTime);
                          }
                        }}
                        className="w-full h-7 text-xs font-mono"
                      />
                    </div>
                    
                    {(selectedKeyframe.value as SoundKeyframeValue).type === 'sound' && (
                      <>
                        <div className="space-y-2">
                          <Label className="text-xs">Volumen</Label>
                          <Input
                            type="number"
                            min="0"
                            max="2"
                            step="0.1"
                            value={(selectedKeyframe.value as SoundKeyframeValue).volume || 1}
                            onChange={(e) => handleUpdateKeyframe(selectedTrack!.id, selectedKeyframe.id, {
                              value: { ...selectedKeyframe.value, volume: parseFloat(e.target.value) || 1 }
                            })}
                            className="w-full h-7 text-xs"
                          />
                        </div>
                        
                        {(selectedKeyframe.value as SoundKeyframeValue & { soundTriggerName?: string }).soundTriggerName && (
                          <div className="p-2 bg-blue-500/10 rounded border border-blue-500/30">
                            <span className="text-xs text-blue-400">Trigger: </span>
                            <span className="text-xs font-medium">
                              {(selectedKeyframe.value as SoundKeyframeValue & { soundTriggerName?: string }).soundTriggerName}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                    
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full h-7 text-xs"
                      onClick={() => handleDeleteKeyframe(selectedTrack!.id, selectedKeyframe.id)}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Eliminar Keyframe
                    </Button>
                  </div>
                ) : selectedSprite ? (
                  <div className="space-y-3">
                    <Label className="text-xs font-medium">Sprite: {selectedSprite.label}</Label>
                    
                    <div className="space-y-2">
                      <Label className="text-xs">Nombre</Label>
                      <Input
                        type="text"
                        value={selectedSprite.label}
                        onChange={(e) => handleUpdateSprite(selectedSprite.id, { label: e.target.value })}
                        className="w-full h-7 text-xs"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-xs">Duración (ms)</Label>
                      <Input
                        type="number"
                        min="100"
                        step="100"
                        value={selectedSprite.timeline.duration}
                        onChange={(e) => handleUpdateSprite(selectedSprite.id, {
                          duration: parseInt(e.target.value) || 3000,
                          timeline: { ...selectedSprite.timeline, duration: parseInt(e.target.value) || 3000 }
                        })}
                        className="w-full h-7 text-xs"
                      />
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={selectedSprite.timeline.loop}
                        onCheckedChange={(checked) => handleUpdateSprite(selectedSprite.id, {
                          timeline: { ...selectedSprite.timeline, loop: checked }
                        })}
                      />
                      <Label className="text-xs">Loop</Label>
                    </div>
                    
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground">
                        Tracks: {selectedSprite.timeline.tracks.length}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Keyframes: {selectedSprite.timeline.tracks.reduce((acc, t) => acc + t.keyframes.length, 0)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <p>Selecciona un sprite</p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="resources" className="flex-1 overflow-hidden m-0">
              <ScrollArea className="h-full p-3">
                <div className="space-y-2">
                  <Label className="text-xs font-medium flex items-center gap-2">
                    <Music className="w-3 h-3" />
                    Sound Triggers (arrastrar al timeline)
                  </Label>
                  
                  {soundTriggers && soundTriggers.length > 0 ? (
                    <div className="space-y-1">
                      {soundTriggers.map((trigger: SoundTrigger) => (
                        <div
                          key={trigger.id}
                          className="flex items-center gap-2 p-2 bg-muted/30 rounded cursor-grab active:cursor-grabbing hover:bg-muted/50 transition-colors"
                          draggable
                          onDragStart={(e) => handleDragStart(e, trigger)}
                        >
                          <Volume2 className="w-3 h-3 text-blue-400" />
                          <span className="text-xs truncate flex-1">{trigger.name}</span>
                          <Badge variant="secondary" className="text-[10px]">
                            {trigger.sounds?.length || 0}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground text-xs">
                      <p>No hay sound triggers</p>
                      <p className="mt-1">Crea triggers en Settings → Sounds</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
