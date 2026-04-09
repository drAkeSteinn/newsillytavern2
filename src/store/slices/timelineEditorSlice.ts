// ============================================
// Timeline Editor Slice - Sprite Timeline Editor State
// ============================================
//
// This slice manages the state for the Sprite Timeline Editor,
// a new system for creating animated sprites with keyframe-based
// sound triggers and multiple tracks.
//

import type {
  SpriteTimelineCollection,
  TimelineSprite,
  TimelineTrack,
  TimelineKeyframe,
  TimelineEditorState,
  TimelinePlaybackState,
  KeyframeValue,
  SoundKeyframeValue,
  SpriteAnimationFormat,
} from '@/types';
import {
  createDefaultTimelineCollection,
  createDefaultTimelineSprite,
  createDefaultTimelineTrack,
  createDefaultTimelineEditorState,
  DEFAULT_SOUND_KEYFRAME_VALUE,
} from '@/types';

// ============================================
// Timeline Editor Slice Interface
// ============================================

export interface TimelineEditorSlice {
  // Collections (folders of sprites)
  collections: SpriteTimelineCollection[];
  
  // Editor UI state
  editorState: TimelineEditorState;
  
  // Sound collections (from existing sound system)
  soundCollections: { name: string; files: string[] }[];
  
  // ============================================
  // Collection Actions
  // ============================================
  
  // Create a new collection
  createCollection: (name: string, description?: string) => SpriteTimelineCollection;
  
  // Update collection
  updateCollection: (id: string, updates: Partial<SpriteTimelineCollection>) => void;
  
  // Delete collection
  deleteCollection: (id: string) => void;
  
  // Get collection by ID
  getCollectionById: (id: string) => SpriteTimelineCollection | undefined;
  
  // Select collection
  selectCollection: (id: string | null) => void;
  
  // ============================================
  // Sprite Actions
  // ============================================
  
  // Add sprite to collection
  addSpriteToCollection: (collectionId: string, sprite: Omit<TimelineSprite, 'id' | 'createdAt' | 'updatedAt'>) => void;
  
  // Update sprite
  updateSprite: (collectionId: string, spriteId: string, updates: Partial<TimelineSprite>) => void;
  
  // Delete sprite
  deleteSprite: (collectionId: string, spriteId: string) => void;
  
  // Select sprite
  selectSprite: (spriteId: string | null) => void;
  
  // Get sprite by ID
  getSpriteById: (collectionId: string, spriteId: string) => TimelineSprite | undefined;
  
  // Duplicate sprite
  duplicateSprite: (collectionId: string, spriteId: string) => void;
  
  // ============================================
  // Track Actions
  // ============================================
  
  // Add track to sprite timeline
  addTrack: (spriteId: string, type: 'sprite' | 'sound' | 'effect', name?: string) => void;
  
  // Update track
  updateTrack: (spriteId: string, trackId: string, updates: Partial<TimelineTrack>) => void;
  
  // Delete track
  deleteTrack: (spriteId: string, trackId: string) => void;
  
  // Select track
  selectTrack: (trackId: string | null) => void;
  
  // Reorder tracks
  reorderTracks: (spriteId: string, trackIds: string[]) => void;
  
  // ============================================
  // Keyframe Actions
  // ============================================
  
  // Add keyframe
  addKeyframe: (spriteId: string, trackId: string, time: number, value: KeyframeValue) => void;
  
  // Update keyframe
  updateKeyframe: (spriteId: string, trackId: string, keyframeId: string, updates: Partial<TimelineKeyframe>) => void;
  
  // Delete keyframe
  deleteKeyframe: (spriteId: string, trackId: string, keyframeId: string) => void;
  
  // Select keyframe
  selectKeyframe: (keyframeId: string | null) => void;
  
  // Move keyframe (change time)
  moveKeyframe: (spriteId: string, trackId: string, keyframeId: string, newTime: number) => void;
  
  // Duplicate keyframe
  duplicateKeyframe: (spriteId: string, trackId: string, keyframeId: string) => void;
  
  // ============================================
  // Playback Actions
  // ============================================
  
  // Play timeline
  playTimeline: (spriteId: string) => void;
  
  // Pause timeline
  pauseTimeline: () => void;
  
  // Stop timeline
  stopTimeline: () => void;
  
  // Seek to time
  seekTimeline: (time: number) => void;
  
  // Set playback rate
  setPlaybackRate: (rate: number) => void;
  
  // ============================================
  // UI Actions
  // ============================================
  
  // Set zoom level
  setZoom: (zoom: number) => void;
  
  // Set scroll position
  setScroll: (x: number, y: number) => void;
  
  // Toggle snap
  toggleSnap: (enabled?: boolean) => void;
  
  // Set snap interval
  setSnapInterval: (interval: number) => void;
  
  // Toggle panels
  toggleTimelinePanel: (show?: boolean) => void;
  togglePropertiesPanel: (show?: boolean) => void;
  toggleSoundLibraryPanel: (show?: boolean) => void;
  
  // ============================================
  // Sound Actions
  // ============================================
  
  // Set sound collections (from existing sound system)
  setSoundCollections: (collections: { name: string; files: string[] }[]) => void;
  
  // Add sound keyframe at time
  addSoundKeyframe: (spriteId: string, trackId: string, time: number, soundUrl: string, volume?: number) => void;
  
  // ============================================
  // Import/Export Actions
  // ============================================
  
  // Import sprite from file
  importSprite: (collectionId: string, file: File, label?: string) => Promise<TimelineSprite>;
  
  // Export timeline data
  exportTimelineData: (spriteId: string) => string;
  
  // Load collections from data
  loadCollections: (collections: SpriteTimelineCollection[]) => void;
}

// ============================================
// Helper Functions
// ============================================

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// ============================================
// Slice Creation
// ============================================

export const createTimelineEditorSlice = (set: any, get: any): TimelineEditorSlice => ({
  // ============================================
  // Initial State
  // ============================================
  
  collections: [],
  editorState: createDefaultTimelineEditorState(),
  soundCollections: [],
  
  // ============================================
  // Collection Actions
  // ============================================
  
  createCollection: (name: string, description?: string) => {
    const collection = createDefaultTimelineCollection(name);
    if (description) {
      collection.description = description;
    }
    
    set((state: any) => ({
      collections: [...state.collections, collection],
    }));
    
    return collection;
  },
  
  updateCollection: (id: string, updates: Partial<SpriteTimelineCollection>) => {
    set((state: any) => ({
      collections: state.collections.map((c: SpriteTimelineCollection) =>
        c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
      ),
    }));
  },
  
  deleteCollection: (id: string) => {
    set((state: any) => ({
      collections: state.collections.filter((c: SpriteTimelineCollection) => c.id !== id),
      editorState: state.editorState.selectedCollectionId === id
        ? { ...state.editorState, selectedCollectionId: null, selectedSpriteId: null }
        : state.editorState,
    }));
  },
  
  getCollectionById: (id: string) => {
    return get().collections.find((c: SpriteTimelineCollection) => c.id === id);
  },
  
  selectCollection: (id: string | null) => {
    set((state: any) => ({
      editorState: {
        ...state.editorState,
        selectedCollectionId: id,
        selectedSpriteId: null,
        selectedTrackId: null,
        selectedKeyframeId: null,
      },
    }));
  },
  
  // ============================================
  // Sprite Actions
  // ============================================
  
  addSpriteToCollection: (collectionId: string, sprite: Omit<TimelineSprite, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newSprite: TimelineSprite = {
      ...sprite,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    
    set((state: any) => ({
      collections: state.collections.map((c: SpriteTimelineCollection) =>
        c.id === collectionId
          ? { ...c, sprites: [...c.sprites, newSprite], updatedAt: now }
          : c
      ),
    }));
  },
  
  updateSprite: (collectionId: string, spriteId: string, updates: Partial<TimelineSprite>) => {
    const now = new Date().toISOString();
    
    set((state: any) => ({
      collections: state.collections.map((c: SpriteTimelineCollection) =>
        c.id === collectionId
          ? {
              ...c,
              sprites: c.sprites.map((s: TimelineSprite) =>
                s.id === spriteId ? { ...s, ...updates, updatedAt: now } : s
              ),
              updatedAt: now,
            }
          : c
      ),
    }));
  },
  
  deleteSprite: (collectionId: string, spriteId: string) => {
    const now = new Date().toISOString();
    
    set((state: any) => ({
      collections: state.collections.map((c: SpriteTimelineCollection) =>
        c.id === collectionId
          ? {
              ...c,
              sprites: c.sprites.filter((s: TimelineSprite) => s.id !== spriteId),
              updatedAt: now,
            }
          : c
      ),
      editorState: state.editorState.selectedSpriteId === spriteId
        ? { ...state.editorState, selectedSpriteId: null, selectedTrackId: null, selectedKeyframeId: null }
        : state.editorState,
    }));
  },
  
  selectSprite: (spriteId: string | null) => {
    set((state: any) => ({
      editorState: {
        ...state.editorState,
        selectedSpriteId: spriteId,
        selectedTrackId: null,
        selectedKeyframeId: null,
      },
    }));
  },
  
  getSpriteById: (collectionId: string, spriteId: string) => {
    const collection = get().collections.find((c: SpriteTimelineCollection) => c.id === collectionId);
    return collection?.sprites.find((s: TimelineSprite) => s.id === spriteId);
  },
  
  duplicateSprite: (collectionId: string, spriteId: string) => {
    const collection = get().collections.find((c: SpriteTimelineCollection) => c.id === collectionId);
    const sprite = collection?.sprites.find((s: TimelineSprite) => s.id === spriteId);
    
    if (!sprite) return;
    
    const now = new Date().toISOString();
    const newSprite: TimelineSprite = {
      ...sprite,
      id: generateId(),
      label: `${sprite.label} (copy)`,
      createdAt: now,
      updatedAt: now,
    };
    
    set((state: any) => ({
      collections: state.collections.map((c: SpriteTimelineCollection) =>
        c.id === collectionId
          ? { ...c, sprites: [...c.sprites, newSprite], updatedAt: now }
          : c
      ),
    }));
  },
  
  // ============================================
  // Track Actions
  // ============================================
  
  addTrack: (spriteId: string, type: 'sprite' | 'sound' | 'effect', name?: string) => {
    const trackName = name || (type === 'sound' ? `Sound Track` : type === 'effect' ? 'Effect Track' : 'Sprite Track');
    const track = createDefaultTimelineTrack(type, trackName);
    
    set((state: any) => ({
      collections: state.collections.map((c: SpriteTimelineCollection) => ({
        ...c,
        sprites: c.sprites.map((s: TimelineSprite) =>
          s.id === spriteId
            ? { ...s, timeline: { ...s.timeline, tracks: [...s.timeline.tracks, track] }, updatedAt: new Date().toISOString() }
            : s
        ),
      })),
    }));
  },
  
  updateTrack: (spriteId: string, trackId: string, updates: Partial<TimelineTrack>) => {
    set((state: any) => ({
      collections: state.collections.map((c: SpriteTimelineCollection) => ({
        ...c,
        sprites: c.sprites.map((s: TimelineSprite) =>
          s.id === spriteId
            ? {
                ...s,
                timeline: {
                  ...s.timeline,
                  tracks: s.timeline.tracks.map((t: TimelineTrack) =>
                    t.id === trackId ? { ...t, ...updates } : t
                  ),
                },
                updatedAt: new Date().toISOString(),
              }
            : s
        ),
      })),
    }));
  },
  
  deleteTrack: (spriteId: string, trackId: string) => {
    set((state: any) => ({
      collections: state.collections.map((c: SpriteTimelineCollection) => ({
        ...c,
        sprites: c.sprites.map((s: TimelineSprite) =>
          s.id === spriteId
            ? {
                ...s,
                timeline: {
                  ...s.timeline,
                  tracks: s.timeline.tracks.filter((t: TimelineTrack) => t.id !== trackId),
                },
                updatedAt: new Date().toISOString(),
              }
            : s
        ),
      })),
      editorState: state.editorState.selectedTrackId === trackId
        ? { ...state.editorState, selectedTrackId: null, selectedKeyframeId: null }
        : state.editorState,
    }));
  },
  
  selectTrack: (trackId: string | null) => {
    set((state: any) => ({
      editorState: {
        ...state.editorState,
        selectedTrackId: trackId,
        selectedKeyframeId: null,
      },
    }));
  },
  
  reorderTracks: (spriteId: string, trackIds: string[]) => {
    set((state: any) => ({
      collections: state.collections.map((c: SpriteTimelineCollection) => ({
        ...c,
        sprites: c.sprites.map((s: TimelineSprite) => {
          if (s.id !== spriteId) return s;
          
          const trackMap = new Map(s.timeline.tracks.map((t: TimelineTrack) => [t.id, t]));
          const reorderedTracks = trackIds
            .map(id => trackMap.get(id))
            .filter((t): t is TimelineTrack => t !== undefined);
          
          return {
            ...s,
            timeline: { ...s.timeline, tracks: reorderedTracks },
            updatedAt: new Date().toISOString(),
          };
        }),
      })),
    }));
  },
  
  // ============================================
  // Keyframe Actions
  // ============================================
  
  addKeyframe: (spriteId: string, trackId: string, time: number, value: KeyframeValue) => {
    const keyframe: TimelineKeyframe = {
      id: generateId(),
      time,
      value,
      interpolation: 'hold',
    };
    
    set((state: any) => ({
      collections: state.collections.map((c: SpriteTimelineCollection) => ({
        ...c,
        sprites: c.sprites.map((s: TimelineSprite) =>
          s.id === spriteId
            ? {
                ...s,
                timeline: {
                  ...s.timeline,
                  tracks: s.timeline.tracks.map((t: TimelineTrack) =>
                    t.id === trackId
                      ? { ...t, keyframes: [...t.keyframes, keyframe].sort((a, b) => a.time - b.time) }
                      : t
                  ),
                },
                updatedAt: new Date().toISOString(),
              }
            : s
        ),
      })),
    }));
  },
  
  updateKeyframe: (spriteId: string, trackId: string, keyframeId: string, updates: Partial<TimelineKeyframe>) => {
    set((state: any) => ({
      collections: state.collections.map((c: SpriteTimelineCollection) => ({
        ...c,
        sprites: c.sprites.map((s: TimelineSprite) =>
          s.id === spriteId
            ? {
                ...s,
                timeline: {
                  ...s.timeline,
                  tracks: s.timeline.tracks.map((t: TimelineTrack) =>
                    t.id === trackId
                      ? {
                          ...t,
                          keyframes: t.keyframes.map((k: TimelineKeyframe) =>
                            k.id === keyframeId ? { ...k, ...updates } : k
                          ),
                        }
                      : t
                  ),
                },
                updatedAt: new Date().toISOString(),
              }
            : s
        ),
      })),
    }));
  },
  
  deleteKeyframe: (spriteId: string, trackId: string, keyframeId: string) => {
    set((state: any) => ({
      collections: state.collections.map((c: SpriteTimelineCollection) => ({
        ...c,
        sprites: c.sprites.map((s: TimelineSprite) =>
          s.id === spriteId
            ? {
                ...s,
                timeline: {
                  ...s.timeline,
                  tracks: s.timeline.tracks.map((t: TimelineTrack) =>
                    t.id === trackId
                      ? { ...t, keyframes: t.keyframes.filter((k: TimelineKeyframe) => k.id !== keyframeId) }
                      : t
                  ),
                },
                updatedAt: new Date().toISOString(),
              }
            : s
        ),
      })),
      editorState: state.editorState.selectedKeyframeId === keyframeId
        ? { ...state.editorState, selectedKeyframeId: null }
        : state.editorState,
    }));
  },
  
  selectKeyframe: (keyframeId: string | null) => {
    set((state: any) => ({
      editorState: {
        ...state.editorState,
        selectedKeyframeId: keyframeId,
      },
    }));
  },
  
  moveKeyframe: (spriteId: string, trackId: string, keyframeId: string, newTime: number) => {
    // Apply snapping if enabled
    const editorState = get().editorState;
    let time = newTime;
    
    if (editorState.snapEnabled && editorState.snapInterval > 0) {
      time = Math.round(newTime / editorState.snapInterval) * editorState.snapInterval;
    }
    
    // Ensure time is non-negative
    time = Math.max(0, time);
    
    set((state: any) => ({
      collections: state.collections.map((c: SpriteTimelineCollection) => ({
        ...c,
        sprites: c.sprites.map((s: TimelineSprite) =>
          s.id === spriteId
            ? {
                ...s,
                timeline: {
                  ...s.timeline,
                  tracks: s.timeline.tracks.map((t: TimelineTrack) =>
                    t.id === trackId
                      ? {
                          ...t,
                          keyframes: t.keyframes
                            .map((k: TimelineKeyframe) =>
                              k.id === keyframeId ? { ...k, time } : k
                            )
                            .sort((a, b) => a.time - b.time),
                        }
                      : t
                  ),
                },
                updatedAt: new Date().toISOString(),
              }
            : s
        ),
      })),
    }));
  },
  
  duplicateKeyframe: (spriteId: string, trackId: string, keyframeId: string) => {
    const collection = get().collections.find((c: SpriteTimelineCollection) =>
      c.sprites.some((s: TimelineSprite) => s.id === spriteId)
    );
    const sprite = collection?.sprites.find((s: TimelineSprite) => s.id === spriteId);
    const track = sprite?.timeline.tracks.find((t: TimelineTrack) => t.id === trackId);
    const keyframe = track?.keyframes.find((k: TimelineKeyframe) => k.id === keyframeId);
    
    if (!keyframe) return;
    
    const newKeyframe: TimelineKeyframe = {
      ...keyframe,
      id: generateId(),
      time: keyframe.time + 100, // Offset by 100ms
    };
    
    set((state: any) => ({
      collections: state.collections.map((c: SpriteTimelineCollection) => ({
        ...c,
        sprites: c.sprites.map((s: TimelineSprite) =>
          s.id === spriteId
            ? {
                ...s,
                timeline: {
                  ...s.timeline,
                  tracks: s.timeline.tracks.map((t: TimelineTrack) =>
                    t.id === trackId
                      ? { ...t, keyframes: [...t.keyframes, newKeyframe].sort((a, b) => a.time - b.time) }
                      : t
                  ),
                },
                updatedAt: new Date().toISOString(),
              }
            : s
        ),
      })),
    }));
  },
  
  // ============================================
  // Playback Actions
  // ============================================
  
  playTimeline: (spriteId: string) => {
    set((state: any) => ({
      editorState: {
        ...state.editorState,
        playback: {
          ...state.editorState.playback,
          playheadState: 'playing',
          startTime: Date.now() - state.editorState.playback.currentTime,
        },
      },
    }));
  },
  
  pauseTimeline: () => {
    set((state: any) => ({
      editorState: {
        ...state.editorState,
        playback: {
          ...state.editorState.playback,
          playheadState: 'paused',
        },
      },
    }));
  },
  
  stopTimeline: () => {
    set((state: any) => ({
      editorState: {
        ...state.editorState,
        playback: {
          ...state.editorState.playback,
          playheadState: 'stopped',
          currentTime: 0,
          activeSounds: [],
        },
      },
    }));
  },
  
  seekTimeline: (time: number) => {
    set((state: any) => ({
      editorState: {
        ...state.editorState,
        playback: {
          ...state.editorState.playback,
          currentTime: time,
          startTime: Date.now() - time,
        },
      },
    }));
  },
  
  setPlaybackRate: (rate: number) => {
    const clampedRate = Math.max(0.25, Math.min(2, rate));
    set((state: any) => ({
      editorState: {
        ...state.editorState,
        playback: {
          ...state.editorState.playback,
          playbackRate: clampedRate,
        },
      },
    }));
  },
  
  // ============================================
  // UI Actions
  // ============================================
  
  setZoom: (zoom: number) => {
    const clampedZoom = Math.max(0.01, Math.min(1, zoom));
    set((state: any) => ({
      editorState: {
        ...state.editorState,
        zoom: clampedZoom,
      },
    }));
  },
  
  setScroll: (x: number, y: number) => {
    set((state: any) => ({
      editorState: {
        ...state.editorState,
        scrollX: Math.max(0, x),
        scrollY: Math.max(0, y),
      },
    }));
  },
  
  toggleSnap: (enabled?: boolean) => {
    set((state: any) => ({
      editorState: {
        ...state.editorState,
        snapEnabled: enabled !== undefined ? enabled : !state.editorState.snapEnabled,
      },
    }));
  },
  
  setSnapInterval: (interval: number) => {
    set((state: any) => ({
      editorState: {
        ...state.editorState,
        snapInterval: Math.max(10, interval),
      },
    }));
  },
  
  toggleTimelinePanel: (show?: boolean) => {
    set((state: any) => ({
      editorState: {
        ...state.editorState,
        showTimeline: show !== undefined ? show : !state.editorState.showTimeline,
      },
    }));
  },
  
  togglePropertiesPanel: (show?: boolean) => {
    set((state: any) => ({
      editorState: {
        ...state.editorState,
        showProperties: show !== undefined ? show : !state.editorState.showProperties,
      },
    }));
  },
  
  toggleSoundLibraryPanel: (show?: boolean) => {
    set((state: any) => ({
      editorState: {
        ...state.editorState,
        showSoundLibrary: show !== undefined ? show : !state.editorState.showSoundLibrary,
      },
    }));
  },
  
  // ============================================
  // Sound Actions
  // ============================================
  
  setSoundCollections: (collections: { name: string; files: string[] }[]) => {
    set({ soundCollections: collections });
  },
  
  addSoundKeyframe: (spriteId: string, trackId: string, time: number, soundUrl: string, volume: number = 1) => {
    const value: SoundKeyframeValue = {
      ...DEFAULT_SOUND_KEYFRAME_VALUE,
      soundUrl,
      volume,
    };
    get().addKeyframe(spriteId, trackId, time, value);
  },
  
  // ============================================
  // Import/Export Actions
  // ============================================
  
  importSprite: async (collectionId: string, file: File, label?: string): Promise<TimelineSprite> => {
    return new Promise((resolve, reject) => {
      // Create object URL for the file
      const url = URL.createObjectURL(file);
      
      // Determine format from file extension
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const format: SpriteAnimationFormat = 
        ext === 'webm' ? 'webm' :
        ext === 'mp4' ? 'mp4' :
        ext === 'gif' ? 'gif' :
        ext === 'webp' ? 'webp' :
        ext === 'jpg' || ext === 'jpeg' ? 'jpg' : 'png';
      
      // Create sprite
      const sprite = createDefaultTimelineSprite(url, label || file.name.replace(/\.[^/.]+$/, ''));
      sprite.format = format;
      
      // For video formats, try to detect duration
      if (format === 'webm' || format === 'mp4') {
        const video = document.createElement('video');
        video.preload = 'metadata';
        
        video.onloadedmetadata = () => {
          sprite.duration = Math.round(video.duration * 1000);
          sprite.width = video.videoWidth;
          sprite.height = video.videoHeight;
          
          // Add to collection
          get().addSpriteToCollection(collectionId, sprite);
          URL.revokeObjectURL(url);
          resolve(sprite);
        };
        
        video.onerror = () => {
          // Still add the sprite even if we can't get metadata
          get().addSpriteToCollection(collectionId, sprite);
          URL.revokeObjectURL(url);
          resolve(sprite);
        };
        
        video.src = url;
      } else if (format === 'gif' || format === 'webp') {
        // For animated GIF/WebP, we need to try to detect duration
        // This is more complex and may require additional libraries
        // For now, set a default duration
        sprite.duration = 3000; // 3 seconds default
        
        // Try to get dimensions
        const img = new Image();
        img.onload = () => {
          sprite.width = img.width;
          sprite.height = img.height;
          
          get().addSpriteToCollection(collectionId, sprite);
          URL.revokeObjectURL(url);
          resolve(sprite);
        };
        
        img.onerror = () => {
          get().addSpriteToCollection(collectionId, sprite);
          URL.revokeObjectURL(url);
          resolve(sprite);
        };
        
        img.src = url;
      } else {
        // Static image
        const img = new Image();
        img.onload = () => {
          sprite.width = img.width;
          sprite.height = img.height;
          
          get().addSpriteToCollection(collectionId, sprite);
          URL.revokeObjectURL(url);
          resolve(sprite);
        };
        
        img.onerror = () => {
          get().addSpriteToCollection(collectionId, sprite);
          URL.revokeObjectURL(url);
          resolve(sprite);
        };
        
        img.src = url;
      }
    });
  },
  
  exportTimelineData: (spriteId: string): string => {
    const collection = get().collections.find((c: SpriteTimelineCollection) =>
      c.sprites.some((s: TimelineSprite) => s.id === spriteId)
    );
    const sprite = collection?.sprites.find((s: TimelineSprite) => s.id === spriteId);
    
    if (!sprite) return '{}';
    
    return JSON.stringify({
      sprite: {
        id: sprite.id,
        label: sprite.label,
        url: sprite.url,
        duration: sprite.duration,
        timeline: sprite.timeline,
      },
    }, null, 2);
  },
  
  loadCollections: (collections: SpriteTimelineCollection[]) => {
    set({ collections });
  },
});

// ============================================
// Selector Hooks (for use in components)
// ============================================

export const useTimelineEditorCollections = () => {
  return (state: { timelineEditor: TimelineEditorSlice }) => state.timelineEditor.collections;
};

export const useTimelineEditorState = () => {
  return (state: { timelineEditor: TimelineEditorSlice }) => state.timelineEditor.editorState;
};

export const useSelectedCollection = () => {
  return (state: { timelineEditor: TimelineEditorSlice }) => {
    const id = state.timelineEditor.editorState.selectedCollectionId;
    return id ? state.timelineEditor.collections.find(c => c.id === id) : undefined;
  };
};

export const useSelectedSprite = () => {
  return (state: { timelineEditor: TimelineEditorSlice }) => {
    const collectionId = state.timelineEditor.editorState.selectedCollectionId;
    const spriteId = state.timelineEditor.editorState.selectedSpriteId;
    if (!collectionId || !spriteId) return undefined;
    const collection = state.timelineEditor.collections.find(c => c.id === collectionId);
    return collection?.sprites.find(s => s.id === spriteId);
  };
};
