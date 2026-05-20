'use client';

import { useRef, useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { XR, createXRStore } from '@react-three/xr';
import { Text, Float, useTexture, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { useTavernStore } from '@/store/tavern-store';
import type { VRSettings, ChatMessage as ChatMessageType, CharacterCard, CharacterGroup, GroupMember } from '@/types';
import { Glasses, ChevronDown, ChevronUp, Smartphone, Headset, X, RotateCcw, Maximize, ScreenShare, Eye } from 'lucide-react';

// ============================================
// Default VR settings (fallback when store has no vrMode)
// ============================================
const DEFAULT_VR_SETTINGS: VRSettings = {
  enabled: false,
  vrType: 'webxr',
  backgroundScale: 1.0,
  spriteScale: 1.0,
  messagesOpacity: 0.9,
  enableParticles: true,
  roomColor: '#1a1a2e',
  spatialAudio: true,
};

// ============================================
// IPD (Inter-Pupillary Distance) for stereoscopic effect
// ============================================
const IPD = 0.064; // 64mm — average human eye distance

// ============================================
// XR Store
// ============================================
const xrStore = createXRStore();

// ============================================
// Helper: get sprite URL for a character
// ============================================
function getCharacterSpriteUrl(
  character: CharacterCard | undefined,
  spriteStates: Record<string, any>
): string | null {
  if (!character) return null;
  const state = spriteStates[character.id];
  if (state?.triggerSpriteUrl) return state.triggerSpriteUrl;
  return character.avatar || null;
}

// ============================================
// Background Wall Component
// ============================================
function BackgroundWall({ url, scale }: { url: string; scale: number }) {
  const texture = useTexture(url);
  const aspect = 16 / 9;

  return (
    <mesh position={[0, 2.5, -6]}>
      <planeGeometry args={[10 * scale * aspect, 10 * scale]} />
      <meshBasicMaterial
        map={texture}
        toneMapped={false}
      />
    </mesh>
  );
}

// ============================================
// Background Placeholder (no background set)
// ============================================
function BackgroundPlaceholder() {
  return (
    <mesh position={[0, 2.5, -6]}>
      <planeGeometry args={[16, 9]} />
      <meshBasicMaterial color="#1a1a2e" />
    </mesh>
  );
}

// ============================================
// Character Sprite in 3D
// ============================================
function CharacterSprite3D({ url, scale, offsetX = 0 }: { url: string | null; scale: number; offsetX?: number }) {
  const texture = useTexture(url || '/placeholder-sprite.png');

  if (!url) return null;

  return (
    <Float
      speed={1.5}
      rotationIntensity={0.1}
      floatIntensity={0.3}
      floatingRange={[-0.05, 0.05]}
    >
      <mesh position={[offsetX, 1.5, -3]}>
        <planeGeometry args={[1.2 * scale, 1.8 * scale]} />
        <meshBasicMaterial
          map={texture}
          transparent
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </Float>
  );
}

// ============================================
// Chat Message Bubble in 3D
// ============================================
function ChatBubble3D({
  text,
  isUser,
  position,
  opacity = 0.85,
  maxChars = 120,
}: {
  text: string;
  isUser: boolean;
  position: [number, number, number];
  opacity?: number;
  maxChars?: number;
}) {
  const displayText = text.length > maxChars ? text.substring(0, maxChars) + '...' : text;

  return (
    <group position={position}>
      <mesh>
        <planeGeometry args={[4, 0.5]} />
        <meshBasicMaterial
          color={isUser ? '#2d2d4a' : '#1e1e32'}
          transparent
          opacity={opacity}
        />
      </mesh>
      <mesh position={[0, 0, -0.001]}>
        <planeGeometry args={[4.04, 0.54]} />
        <meshBasicMaterial
          color={isUser ? '#6366f1' : '#f59e0b'}
          transparent
          opacity={0.5}
        />
      </mesh>
      <Text
        position={[0, 0, 0.01]}
        fontSize={0.1}
        color="white"
        anchorX="center"
        anchorY="middle"
        maxWidth={3.8}
        font={undefined}
      >
        {displayText}
      </Text>
    </group>
  );
}

// ============================================
// Message Name Label
// ============================================
function MessageNameLabel({ name, position }: { name: string; position: [number, number, number] }) {
  return (
    <Text
      position={position}
      fontSize={0.08}
      color="#9ca3af"
      anchorX="center"
      anchorY="bottom"
      font={undefined}
    >
      {name}
    </Text>
  );
}

// ============================================
// Ambient Particles
// ============================================
function AmbientParticles({ count = 200 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 15;
      pos[i * 3 + 1] = Math.random() * 6;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 10;
    }
    return pos;
  }, [count]);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.02;
      const posArray = ref.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < count; i++) {
        posArray[i * 3 + 1] += Math.sin(Date.now() * 0.001 + i) * 0.001;
      }
      ref.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <PointMaterial
        transparent
        color="#f59e0b"
        size={0.02}
        sizeAttenuation
        depthWrite={false}
        opacity={0.4}
      />
    </points>
  );
}

// ============================================
// Lighting
// ============================================
function RoomLighting() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[0, 5, 0]} intensity={0.8} color="#fff5e6" />
      <pointLight position={[-3, 3, -5]} intensity={0.3} color="#f59e0b" />
      <pointLight position={[3, 3, -5]} intensity={0.3} color="#f59e0b" />
    </>
  );
}

// ============================================
// Gyroscope Camera Controller
//
// Listens for deviceorientation events and maps them to camera rotation.
// Falls back to touch/mouse drag on desktop or when gyro is unavailable.
//
// IMPORTANT: The orientation listener is only attached when
// `gyroActive` is true (set by parent after permission is granted).
// ============================================
function GyroCameraController({ gyroActive }: { gyroActive: boolean }) {
  const { camera } = useThree();
  const eulerRef = useRef(new THREE.Euler(-0.1, 0, 0, 'YXZ'));
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const gyroAttachedRef = useRef(false);
  const lastGyroTimeRef = useRef(0);

  useEffect(() => {
    // === Device Orientation Handler ===
    const handleOrientation = (event: DeviceOrientationEvent) => {
      const alpha = event.alpha;
      const beta = event.beta;
      const gamma = event.gamma;

      // Skip if device doesn't actually send orientation data (null values)
      if (alpha === null && beta === null && gamma === null) return;

      lastGyroTimeRef.current = Date.now();

      // Convert to radians and remap:
      // - When phone held upright (beta ≈ 90), look forward (pitch = 0)
      // - alpha = compass heading → yaw
      // - gamma = left-right tilt → subtle roll
      const pitch = THREE.MathUtils.degToRad(((beta ?? 90) - 90) * 0.7);
      const yaw = -THREE.MathUtils.degToRad(alpha ?? 0);
      const roll = THREE.MathUtils.degToRad((gamma ?? 0) * 0.3);

      eulerRef.current.set(pitch, yaw, roll, 'YXZ');
      camera.quaternion.setFromEuler(eulerRef.current);
    };

    // === Attach / Detach Gyro ===
    if (gyroActive && !gyroAttachedRef.current) {
      window.addEventListener('deviceorientation', handleOrientation, true);
      gyroAttachedRef.current = true;
      console.log('[VR] Gyroscope listener attached');
    } else if (!gyroActive && gyroAttachedRef.current) {
      window.removeEventListener('deviceorientation', handleOrientation, true);
      gyroAttachedRef.current = false;
      console.log('[VR] Gyroscope listener detached');
    }

    // === Touch drag fallback ===
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStartRef.current || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - touchStartRef.current.x;
      const dy = e.touches[0].clientY - touchStartRef.current.y;
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };

      // Only use touch drag if no recent gyro data (fallback mode)
      if (Date.now() - lastGyroTimeRef.current < 1000) return;

      eulerRef.current.y -= dx * 0.003;
      eulerRef.current.x -= dy * 0.003;
      eulerRef.current.x = THREE.MathUtils.clamp(eulerRef.current.x, -Math.PI / 2, Math.PI / 2);
      camera.quaternion.setFromEuler(eulerRef.current);
    };

    const handleTouchEnd = () => {
      touchStartRef.current = null;
    };

    // === Mouse drag fallback (desktop testing) ===
    let isMouseDown = false;
    let mouseLast = { x: 0, y: 0 };

    const handleMouseDown = (e: MouseEvent) => {
      isMouseDown = true;
      mouseLast = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isMouseDown) return;
      const dx = e.clientX - mouseLast.x;
      const dy = e.clientY - mouseLast.y;
      mouseLast = { x: e.clientX, y: e.clientY };

      eulerRef.current.y -= dx * 0.003;
      eulerRef.current.x -= dy * 0.003;
      eulerRef.current.x = THREE.MathUtils.clamp(eulerRef.current.x, -Math.PI / 2, Math.PI / 2);
      camera.quaternion.setFromEuler(eulerRef.current);
    };

    const handleMouseUp = () => {
      isMouseDown = false;
    };

    // Attach touch/mouse fallbacks to canvas element
    const canvasEl = (camera as any).domElement || document.querySelector('canvas') || document.body;
    canvasEl.addEventListener('touchstart', handleTouchStart, { passive: true });
    canvasEl.addEventListener('touchmove', handleTouchMove, { passive: true });
    canvasEl.addEventListener('touchend', handleTouchEnd, { passive: true });
    canvasEl.addEventListener('mousedown', handleMouseDown);
    canvasEl.addEventListener('mousemove', handleMouseMove);
    canvasEl.addEventListener('mouseup', handleMouseUp);

    return () => {
      if (gyroAttachedRef.current) {
        window.removeEventListener('deviceorientation', handleOrientation, true);
        gyroAttachedRef.current = false;
      }
      canvasEl.removeEventListener('touchstart', handleTouchStart);
      canvasEl.removeEventListener('touchmove', handleTouchMove);
      canvasEl.removeEventListener('touchend', handleTouchEnd);
      canvasEl.removeEventListener('mousedown', handleMouseDown);
      canvasEl.removeEventListener('mousemove', handleMouseMove);
      canvasEl.removeEventListener('mouseup', handleMouseUp);
    };
  }, [camera, gyroActive]);

  return null;
}

// ============================================
// StereoCameraEffect — CardBox split-screen
//
// Intercepts R3F's gl.render to produce side-by-side stereo output
// using THREE.StereoCamera for left/right eye separation.
// ============================================
function StereoCameraEffect() {
  const { gl } = useThree();
  const stereoRef = useRef(new THREE.StereoCamera());

  useEffect(() => {
    const stereo = stereoRef.current;
    stereo.eyeSep = IPD;

    const originalRender = gl.render;
    const originalAutoClear = gl.autoClear;

    /* eslint-disable react-hooks/immutability */
    gl.autoClear = false;

    gl.render = function (renderScene: THREE.Scene, renderCamera: THREE.Camera) {
      const w = gl.domElement.width;
      const h = gl.domElement.height;

      stereo.update(renderCamera);

      gl.setScissorTest(true);
      gl.clear();

      // Left eye — left half
      gl.setViewport(0, 0, w / 2, h);
      gl.setScissor(0, 0, w / 2, h);
      originalRender.call(gl, renderScene, stereo.cameraL);

      // Right eye — right half
      gl.setViewport(w / 2, 0, w / 2, h);
      gl.setScissor(w / 2, 0, w / 2, h);
      originalRender.call(gl, renderScene, stereo.cameraR);

      // Restore full viewport
      gl.setScissorTest(false);
      gl.setViewport(0, 0, w, h);
    };

    return () => {
      gl.render = originalRender;
      gl.autoClear = originalAutoClear;
      /* eslint-enable react-hooks/immutability */
    };
  }, [gl]);

  return null;
}

// ============================================
// CardBox Camera Setup
// Centers camera on content area for phone VR viewer
// ============================================
function CardBoxCameraSetup() {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0, 2.0, 4.5);
    camera.lookAt(0, 2.0, -4);
    camera.updateProjectionMatrix();
  }, [camera]);

  return null;
}

// ============================================
// Scene Content (shared by both VR and CardBox)
// ============================================
function SceneContent({
  backgroundUrl,
  spriteUrls,
  messages,
  characters,
  groupMembers,
  activeCharacter,
  activeGroup,
  spriteScale,
  backgroundScale,
  messagesOpacity,
  enableParticles,
  roomColor,
}: {
  backgroundUrl: string | null;
  spriteUrls: Array<{ characterId: string; url: string | null; name: string }>;
  messages: Array<{ id: string; role: string; content: string; characterId?: string; isDeleted?: boolean; isNarratorMessage?: boolean }>;
  characters: CharacterCard[];
  groupMembers: GroupMember[];
  activeCharacter: CharacterCard | null;
  activeGroup: CharacterGroup | null;
  spriteScale: number;
  backgroundScale: number;
  messagesOpacity: number;
  enableParticles: boolean;
  roomColor: string;
}) {
  const characterNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const char of characters) {
      map.set(char.id, char.name);
    }
    if (activeGroup) {
      for (const member of activeGroup.members) {
        const char = characters.find(c => c.id === member.characterId);
        if (char) {
          map.set(char.id, char.name);
        }
      }
    }
    return map;
  }, [characters, activeGroup]);

  const resolveMessageName = useCallback((msg: {
    role: string;
    characterId?: string;
    isNarratorMessage?: boolean;
  }): string => {
    if (msg.role === 'user') return 'Tu';
    if (msg.isNarratorMessage) return 'Narrador';
    if (msg.characterId) {
      return characterNameMap.get(msg.characterId) || 'Desconocido';
    }
    if (activeCharacter) return activeCharacter.name;
    return 'Personaje';
  }, [characterNameMap, activeCharacter]);

  const recentMessages = useMemo(() => {
    const visible = messages.filter(m => !m.isDeleted && m.role !== 'system');
    return visible.slice(-6);
  }, [messages]);

  const spriteSpacing = 1.5;
  const totalSpriteWidth = (spriteUrls.length - 1) * spriteSpacing;

  return (
    <>
      <RoomLighting />

      {backgroundUrl ? (
        <Suspense fallback={<BackgroundPlaceholder />}>
          <BackgroundWall url={backgroundUrl} scale={backgroundScale} />
        </Suspense>
      ) : (
        <BackgroundPlaceholder />
      )}

      {spriteUrls.map((sprite, index) => {
        if (!sprite.url) return null;
        const offsetX = -totalSpriteWidth / 2 + index * spriteSpacing;
        return (
          <Suspense key={sprite.characterId} fallback={null}>
            <CharacterSprite3D url={sprite.url} scale={spriteScale} offsetX={offsetX} />
          </Suspense>
        );
      })}

      {recentMessages.map((msg, index) => {
        const y = 3.2 - index * 0.55;
        const isUser = msg.role === 'user';
        const x = isUser ? 1.2 : -1.2;
        const z = -3.5;
        const name = resolveMessageName(msg);

        return (
          <group key={msg.id || index}>
            <MessageNameLabel
              name={name}
              position={[x, y + 0.3, z]}
            />
            <ChatBubble3D
              text={msg.content}
              isUser={isUser}
              position={[x, y, z]}
              opacity={messagesOpacity}
            />
          </group>
        );
      })}

      {enableParticles && <AmbientParticles count={100} />}
    </>
  );
}

// ============================================
// CardBox Entry Screen
//
// This is the screen shown BEFORE entering CardBox mode.
// Like SpankBang VR: a prominent button that triggers
// permission → fullscreen → landscape lock in sequence.
// ============================================
type CardBoxStatus = 'idle' | 'requesting' | 'entering' | 'active' | 'error';

function CardBoxEntryScreen({ onActivate, onExit }: { onActivate: () => void; onExit: () => void }) {
  const [status, setStatus] = useState<CardBoxStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleEnterCardBox = useCallback(async () => {
    setStatus('requesting');
    setErrorMsg('');

    try {
      // Step 1: Request DeviceOrientation permission (iOS 13+ and some Android)
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        console.log('[CardBox] Requesting device orientation permission...');
        try {
          const permResult = await (DeviceOrientationEvent as any).requestPermission();
          if (permResult !== 'granted') {
            setErrorMsg('Permiso de giroscopio denegado. Sin él, la vista no seguirá el movimiento del teléfono.');
            setStatus('error');
            // Continue anyway — touch drag will work as fallback
          } else {
            console.log('[CardBox] Device orientation permission granted');
          }
        } catch (permErr) {
          console.warn('[CardBox] Permission request failed (may not be supported):', permErr);
          // Some browsers don't actually need permission — continue
        }
      }

      // Step 2: Request Fullscreen
      setStatus('entering');
      try {
        const el = document.documentElement as any;
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if (el.webkitRequestFullscreen) {
          await el.webkitRequestFullscreen();
        } else if (el.mozRequestFullScreen) {
          await el.mozRequestFullScreen();
        }
        console.log('[CardBox] Fullscreen activated');
      } catch (fsErr) {
        console.warn('[CardBox] Fullscreen request failed:', fsErr);
        // Non-critical — continue without fullscreen
      }

      // Step 3: Lock to landscape orientation
      try {
        const screenOrientation = screen.orientation as any;
        if (screenOrientation && screenOrientation.lock) {
          await screenOrientation.lock('landscape');
          console.log('[CardBox] Orientation locked to landscape');
        }
      } catch (orientErr) {
        console.warn('[CardBox] Orientation lock failed (non-critical):', orientErr);
        // Some browsers don't support orientation lock — continue
      }

      // Step 4: Activate CardBox VR
      setStatus('active');
      onActivate();

    } catch (err) {
      console.error('[CardBox] Failed to enter CardBox mode:', err);
      setErrorMsg('No se pudo activar el modo CardBox. Intenta de nuevo.');
      setStatus('error');
    }
  }, [onActivate]);

  return (
    <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center p-6">
      {/* Background decorative gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-900/20 via-black to-black pointer-events-none" />

      {/* Phone icon with glow */}
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-2xl shadow-emerald-500/30">
          <Smartphone className="w-12 h-12 text-white" />
        </div>
        <div className="absolute -inset-2 rounded-3xl bg-emerald-500/20 blur-xl pointer-events-none" />
      </div>

      {/* Title */}
      <h2 className="text-2xl font-bold text-white mb-2">Modo CardBox VR</h2>
      <p className="text-sm text-gray-400 text-center max-w-xs mb-8">
        Coloca tu teléfono en un visor VR para ver la conversación en 3D estereoscópico
      </p>

      {/* Main Enter Button */}
      {status === 'idle' || status === 'error' ? (
        <button
          onClick={handleEnterCardBox}
          className="w-full max-w-xs px-8 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold text-lg rounded-2xl shadow-xl shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
        >
          <ScreenShare className="w-6 h-6" />
          Activar CardBox VR
        </button>
      ) : status === 'requesting' ? (
        <div className="flex items-center gap-3 px-8 py-4 bg-emerald-500/20 text-emerald-300 rounded-2xl">
          <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <span className="font-medium">Solicitando permisos...</span>
        </div>
      ) : status === 'entering' ? (
        <div className="flex items-center gap-3 px-8 py-4 bg-emerald-500/20 text-emerald-300 rounded-2xl">
          <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <span className="font-medium">Activando pantalla completa...</span>
        </div>
      ) : null}

      {/* Error message */}
      {errorMsg && (
        <p className="text-xs text-amber-400 mt-4 text-center max-w-xs">{errorMsg}</p>
      )}

      {/* What happens section */}
      <div className="mt-8 space-y-3 w-full max-w-xs">
        <h4 className="text-xs text-gray-500 uppercase tracking-wider font-bold text-center">Qué sucederá al activar:</h4>
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
            <Eye className="w-3 h-3 text-emerald-400" />
          </div>
          <span>Se pedirá acceso al giroscopio</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
            <Maximize className="w-3 h-3 text-emerald-400" />
          </div>
          <span>Pantalla completa + landscape</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-3 h-3 text-emerald-400" />
          </div>
          <span>Vista estereoscópica dividida</span>
        </div>
      </div>

      {/* Back button */}
      <button
        onClick={onExit}
        className="mt-8 px-6 py-2 text-gray-500 hover:text-white text-sm transition-colors"
      >
        ← Volver
      </button>
    </div>
  );
}

// ============================================
// Main VR Viewer Component
// ============================================
export function VRViewer() {
  const activeBackground = useTavernStore((s) => s.activeBackground);
  const activeSessionId = useTavernStore((s) => s.activeSessionId);
  const sessions = useTavernStore((s) => s.sessions);
  const characters = useTavernStore((s) => s.characters);
  const activeCharacter = useTavernStore((s) => {
    const id = s.activeCharacterId;
    return s.characters.find(c => c.id === id) || null;
  });
  const activeGroup = useTavernStore((s) => {
    const id = s.activeGroupId;
    return s.groups.find(g => g.id === id) || null;
  });
  const characterSpriteStates = useTavernStore((s) => s.characterSpriteStates);
  const rawVrSettings = useTavernStore((s) => s.settings?.vrMode);
  const vrSettings = { ...DEFAULT_VR_SETTINGS, ...rawVrSettings };
  const updateSettings = useTavernStore((s) => s.updateSettings);

  const [isInVR, setIsInVR] = useState(false);
  const [showControls, setShowControls] = useState(true);
  // CardBox-specific: 'preview' = show entry screen, 'active' = VR running
  const [cardBoxState, setCardBoxState] = useState<'preview' | 'active'>('preview');
  const [gyroActive, setGyroActive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isCardbox = vrSettings.vrType === 'cardbox';

  // Get sprite URLs — supports both single character and group chat
  const spriteUrls = useMemo(() => {
    const urls: Array<{ characterId: string; url: string | null; name: string }> = [];

    if (activeGroup) {
      for (const member of activeGroup.members) {
        const char = characters.find(c => c.id === member.characterId);
        if (char && member.isPresent) {
          const url = getCharacterSpriteUrl(char, characterSpriteStates);
          urls.push({ characterId: char.id, url, name: char.name });
        }
      }
    } else if (activeCharacter) {
      const url = getCharacterSpriteUrl(activeCharacter, characterSpriteStates);
      urls.push({ characterId: activeCharacter.id, url, name: activeCharacter.name });
    }

    return urls;
  }, [activeCharacter, activeGroup, characters, characterSpriteStates]);

  // Get messages
  const messages = useMemo(() => {
    if (!activeSessionId) return [];
    const session = sessions.find(s => s.id === activeSessionId);
    return session?.messages || [];
  }, [activeSessionId, sessions]);

  // Close VR mode entirely
  const handleClose = useCallback(() => {
    // Exit fullscreen if active
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    // Unlock orientation
    try {
      (screen.orientation as any)?.unlock?.();
    } catch {}
    // Deactivate gyro
    setGyroActive(false);
    setCardBoxState('preview');

    updateSettings({
      vrMode: { ...vrSettings, enabled: false }
    });
  }, [updateSettings, vrSettings]);

  // Enter WebXR VR
  const handleEnterVR = useCallback(() => {
    xrStore.enterVR().then(() => {
      setIsInVR(true);
      setShowControls(false);
    }).catch(err => {
      console.error('[VR] Failed to enter VR:', err);
    });
  }, []);

  // Exit WebXR VR
  const handleExitVR = useCallback(() => {
    xrStore.exitVR().then(() => {
      setIsInVR(false);
      setShowControls(true);
    }).catch(err => {
      console.error('[VR] Failed to exit VR:', err);
    });
  }, []);

  // CardBox: Activate after permissions are granted
  const handleCardBoxActivate = useCallback(() => {
    setCardBoxState('active');
    // Activate gyro after a small delay to let the scene render first
    setTimeout(() => {
      setGyroActive(true);
    }, 500);
  }, []);

  // CardBox: Exit VR viewer (back to entry screen)
  const handleCardBoxExit = useCallback(() => {
    // Exit fullscreen
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    try {
      (screen.orientation as any)?.unlock?.();
    } catch {}
    setGyroActive(false);
    setCardBoxState('preview');
  }, []);

  // Listen for VR session end
  useEffect(() => {
    const onSessionEnd = () => setIsInVR(false);
    const unsub = xrStore.subscribe(onSessionEnd);
    return () => unsub();
  }, []);

  // Listen for fullscreen exit (user pressed back on phone)
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && cardBoxState === 'active') {
        console.log('[CardBox] Fullscreen exited — returning to preview');
        setGyroActive(false);
        setCardBoxState('preview');
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [cardBoxState]);

  // Keyboard shortcut: Escape to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isCardbox && cardBoxState === 'active') {
          handleCardBoxExit();
        } else if (isInVR) {
          handleExitVR();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleExitVR, isInVR, isCardbox, cardBoxState, handleCardBoxExit]);

  // Shared scene props
  const sceneProps = {
    backgroundUrl: activeBackground,
    spriteUrls,
    messages,
    characters,
    groupMembers: activeGroup?.members || [],
    activeCharacter,
    activeGroup,
    spriteScale: vrSettings.spriteScale,
    backgroundScale: vrSettings.backgroundScale,
    messagesOpacity: vrSettings.messagesOpacity,
    enableParticles: vrSettings.enableParticles,
    roomColor: vrSettings.roomColor,
  };

  // ===== RENDER: CardBox Preview Screen =====
  if (isCardbox && cardBoxState === 'preview') {
    return (
      <CardBoxEntryScreen
        onActivate={handleCardBoxActivate}
        onExit={handleClose}
      />
    );
  }

  // ===== RENDER: Active VR / CardBox =====
  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-50 bg-black"
      style={{ display: 'block' }}
    >
      {/* 3D Canvas */}
      <Canvas
        gl={{ antialias: true, alpha: false }}
        camera={{ position: [0, 2.0, 4.5], fov: 70 }}
        style={{ width: '100%', height: '100%' }}
      >
        {isCardbox ? (
          <>
            <CardBoxCameraSetup />
            <GyroCameraController gyroActive={gyroActive} />
            <SceneContent {...sceneProps} />
            <StereoCameraEffect />
          </>
        ) : (
          <XR store={xrStore}>
            <SceneContent {...sceneProps} />
          </XR>
        )}
      </Canvas>

      {/* ===== UI OVERLAY ===== */}
      {/* Top bar: mode badge + close button */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-2 pointer-events-none">
        {/* Left: mode badge */}
        <div className="flex items-center gap-2">
          <div className={`px-3 py-1.5 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 ${
            isCardbox ? 'bg-emerald-500/90' : 'bg-amber-500/90'
          }`}>
            {isCardbox ? (
              <><Smartphone className="w-3.5 h-3.5" /> CardBox {gyroActive ? '• Giroscopio ✓' : ''}</>
            ) : (
              <><Glasses className="w-3.5 h-3.5" /> Modo VR</>
            )}
          </div>
          {activeGroup && (
            <div className="px-3 py-1.5 bg-white/10 backdrop-blur-sm text-white rounded-lg text-xs">
              {activeGroup.name}
            </div>
          )}
          {activeCharacter && !activeGroup && (
            <div className="px-3 py-1.5 bg-white/10 backdrop-blur-sm text-white rounded-lg text-xs">
              {activeCharacter.name}
            </div>
          )}
        </div>

        {/* Right: close + settings */}
        <div className="flex items-center gap-1 pointer-events-auto">
          {/* Close VR button — ALWAYS visible */}
          <button
            onClick={isCardbox ? handleCardBoxExit : handleClose}
            className="p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-lg transition-all hover:scale-105 active:scale-95 shadow-lg"
            title="Cerrar modo VR"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Settings toggle (not in WebXR session) */}
          {!isInVR && !isCardbox && (
            <div className="relative">
              <button
                onClick={() => setShowControls(!showControls)}
                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg backdrop-blur-sm transition-colors"
              >
                {showControls ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {showControls && (
                <div className="mt-1 p-3 bg-black/80 backdrop-blur-md rounded-lg border border-white/10 min-w-[220px]">
                  <VRSettingsPanel />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CardBox divider line (visual separator between eyes) */}
      {isCardbox && cardBoxState === 'active' && (
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20 -translate-x-px pointer-events-none z-10" />
      )}

      {/* Bottom bar: mode-specific controls */}
      <div
        className="absolute bottom-0 left-0 right-0 flex flex-col items-center gap-2 pb-4"
        style={{ pointerEvents: 'none' }}
      >
        {!isCardbox && !isInVR ? (
          <button
            onClick={handleEnterVR}
            className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-lg shadow-amber-500/30 transition-all hover:scale-105 active:scale-95"
            style={{ pointerEvents: 'auto' }}
          >
            🥽 Entrar a VR
          </button>
        ) : !isCardbox && isInVR ? (
          <button
            onClick={handleExitVR}
            className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-lg transition-all hover:scale-105 active:scale-95"
            style={{ pointerEvents: 'auto' }}
          >
            🚪 Salir de VR
          </button>
        ) : null}

        {/* Info text */}
        <p className="text-xs text-white/50">
          {isCardbox && cardBoxState === 'active'
            ? 'Gira el teléfono para mirar alrededor • Esc para salir'
            : !isInVR
              ? 'Activa VR en tu headset y presiona el botón'
              : 'Gira tu cabeza para mirar alrededor • Esc para salir'}
        </p>
      </div>
    </div>
  );
}

// ============================================
// VR Settings Panel (inline)
// ============================================
function VRSettingsPanel() {
  const rawVrSettings = useTavernStore((s) => s.settings?.vrMode);
  const vrSettings = { ...DEFAULT_VR_SETTINGS, ...rawVrSettings };
  const updateSettings = useTavernStore((s) => s.updateSettings);

  const update = (key: keyof typeof vrSettings, value: number | boolean | string) => {
    updateSettings({
      vrMode: { ...vrSettings, [key]: value }
    });
  };

  const handleCloseVR = useCallback(() => {
    updateSettings({
      vrMode: { ...vrSettings, enabled: false }
    });
  }, [updateSettings, vrSettings]);

  return (
    <div className="space-y-3">
      <h4 className="text-white text-xs font-bold uppercase tracking-wider">Configuración VR</h4>

      {/* Exit VR Mode button */}
      <button
        onClick={handleCloseVR}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-500/80 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-all hover:scale-[1.02] active:scale-95"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        Salir del Modo VR
      </button>

      {/* VR Type Toggle: WebXR vs CardBox */}
      <div className="flex gap-1 p-1 bg-white/10 rounded-lg">
        <button
          onClick={() => update('vrType', 'webxr')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            vrSettings.vrType === 'webxr'
              ? 'bg-amber-500 text-white shadow-md'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Headset className="w-3.5 h-3.5" />
          WebXR
        </button>
        <button
          onClick={() => update('vrType', 'cardbox')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            vrSettings.vrType === 'cardbox'
              ? 'bg-emerald-500 text-white shadow-md'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          CardBox
        </button>
      </div>

      {/* Background Scale */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-300">
          <span>Escala del Fondo</span>
          <span>{vrSettings.backgroundScale.toFixed(1)}x</span>
        </div>
        <input
          type="range"
          min={0.5}
          max={2}
          step={0.1}
          value={vrSettings.backgroundScale}
          onChange={(e) => update('backgroundScale', parseFloat(e.target.value))}
          className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-amber-500"
        />
      </div>

      {/* Sprite Scale */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-300">
          <span>Escala del Personaje</span>
          <span>{vrSettings.spriteScale.toFixed(1)}x</span>
        </div>
        <input
          type="range"
          min={0.3}
          max={2}
          step={0.1}
          value={vrSettings.spriteScale}
          onChange={(e) => update('spriteScale', parseFloat(e.target.value))}
          className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-amber-500"
        />
      </div>

      {/* Messages Opacity */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-300">
          <span>Opacidad de Mensajes</span>
          <span>{Math.round(vrSettings.messagesOpacity * 100)}%</span>
        </div>
        <input
          type="range"
          min={0.3}
          max={1}
          step={0.05}
          value={vrSettings.messagesOpacity}
          onChange={(e) => update('messagesOpacity', parseFloat(e.target.value))}
          className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-amber-500"
        />
      </div>

      {/* Particles toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-300">Partículas Ambiente</span>
        <button
          onClick={() => update('enableParticles', !vrSettings.enableParticles)}
          className={`w-8 h-4 rounded-full transition-colors ${vrSettings.enableParticles ? 'bg-amber-500' : 'bg-white/20'}`}
        >
          <div
            className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${vrSettings.enableParticles ? 'translate-x-4' : 'translate-x-0.5'}`}
          />
        </button>
      </div>
    </div>
  );
}
