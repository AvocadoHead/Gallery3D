import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Float, Html } from '@react-three/drei';
import * as THREE from 'three';
import {
  getSphereCoordinates,
  getCarouselCoordinates,
  MediaItem,
  TITLE_SIZE_PX,
} from '../constants';

/* ============================================================
   🔹 VIDEO BUDGET (Phase 3.2)
   At most K direct-video cards actually decode/play (muted) at once —
   the ones nearest the camera. Everything else stays a poster/first frame.
   Managed imperatively (no React state) so it never triggers re-renders.
   ============================================================ */
const VIDEO_BUDGET = 6;

const videoRegistry = {
  distances: new Map<string, number>(),
  active: new Set<string>(),
  recompute() {
    if (this.distances.size <= VIDEO_BUDGET) {
      this.active = new Set(this.distances.keys());
      return;
    }
    const sorted = [...this.distances.entries()].sort((a, b) => a[1] - b[1]);
    this.active = new Set(sorted.slice(0, VIDEO_BUDGET).map((e) => e[0]));
  },
};

/** Recomputes the active video set a few times a second, from one place. */
const VideoBudgetTicker: React.FC = () => {
  const frame = useRef(0);
  useFrame(() => {
    frame.current += 1;
    if (frame.current % 12 === 0) videoRegistry.recompute();
  });
  return null;
};

export interface TitleStyle {
  font?: string;
  size?: 'S' | 'M' | 'L' | 'XL';
  color?: string;
}

interface ItemProps {
  item: MediaItem;
  position: [number, number, number];
  onClick: (item: MediaItem) => void;
  index: number;
  radius: number;
  clearing: boolean;
  scale: number;
  tiltEnabled: boolean;
  floatEnabled: boolean;
  titleDefaults: TitleStyle;
}

const normalizeSize = (aspectRatio: number | undefined, scale: number) => {
  const base = 220 * scale;
  const min = 150 * scale;
  const max = 260 * scale;

  if (!aspectRatio || Number.isNaN(aspectRatio)) {
    return { width: base, height: base };
  }

  if (aspectRatio >= 1) {
    const width = base;
    const height = Math.min(max, Math.max(min, base / aspectRatio));
    return { width, height };
  }

  const height = base;
  const width = Math.min(max, Math.max(min, base * aspectRatio));
  return { width, height };
};

const GalleryItem = ({
  item,
  position,
  onClick,
  index,
  radius,
  clearing,
  scale,
  tiltEnabled,
  floatEnabled,
  titleDefaults,
}: ItemProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHover] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [muted, setMuted] = useState(true);
  const [mounted, setMounted] = useState(false);

  const hasDedicatedPreview = useMemo(
    () => !!(item.fallbackPreview || (item.previewUrl && item.videoUrl && item.previewUrl !== item.videoUrl)),
    [item.fallbackPreview, item.previewUrl, item.videoUrl],
  );

  const shouldShowVideoInCard = item.kind === 'video' && !hasDedicatedPreview && !item.previewUrl;
  const [useVideo, setUseVideo] = useState(shouldShowVideoInCard);

  const [computedSize, setComputedSize] = useState<{ width: number; height: number }>(() =>
    normalizeSize(item.aspectRatio, scale),
  );
  const videoRef = useRef<HTMLVideoElement>(null);

  // FIX 1: Traversal Logic — ensure EVERY internal part is never culled.
  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.traverse((obj) => {
      obj.frustumCulled = false;
    });
    groupRef.current.frustumCulled = false;
  }, []);

  // Phase 1.2: cap the mount stagger so the last card never waits >1.5s.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setMounted(true);
    }, Math.min(index * 20, 1500));
    return () => clearTimeout(timeout);
  }, [index]);

  // Phase 3.2: register/unregister this video with the budget manager.
  useEffect(() => {
    if (!useVideo) return;
    const id = item.id;
    return () => {
      videoRegistry.distances.delete(id);
      videoRegistry.active.delete(id);
    };
  }, [useVideo, item.id]);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.lookAt(state.camera.position);

    // Phase 1.2: the subtle edge-tilt is invisible at high density — skip the
    // per-frame rotation entirely for big galleries.
    if (tiltEnabled) {
      const edgeTilt = Math.min(
        0.35,
        (Math.abs(position[0]) / radius) * 0.35 + (Math.abs(position[1]) / radius) * 0.15,
      );
      if (edgeTilt > 0) {
        groupRef.current.rotateY(position[0] >= 0 ? edgeTilt : -edgeTilt);
      }
    }

    // Phase 3.2: bounded muted playback for in-card videos.
    if (useVideo && videoRef.current && !hovered) {
      videoRegistry.distances.set(
        item.id,
        groupRef.current.position.distanceTo(state.camera.position),
      );
      const v = videoRef.current;
      const isActive = videoRegistry.active.has(item.id);
      if (isActive && v.paused) {
        v.play().catch(() => {});
      } else if (!isActive && !v.paused) {
        v.pause();
      }
    }
  });

  // Hover: promote to full playback with sound (budget is ignored while hovered).
  useEffect(() => {
    if (!useVideo || !videoRef.current) return;
    if (hovered) {
      videoRef.current.play().catch(() => {});
      videoRef.current.muted = false;
    } else {
      videoRef.current.muted = true;
    }
  }, [hovered, useVideo]);

  // Hover audio fade (existing behaviour, retained).
  useEffect(() => {
    if (!useVideo) return;
    let raf: number;
    const fadeVolume = () => {
      if (!videoRef.current) return;
      const target = hovered ? 0.9 : 0;
      const current = videoRef.current.volume;
      const step = 0.08;
      const next = hovered ? Math.min(1, current + step) : Math.max(0, current - step);
      videoRef.current.volume = next;

      const shouldMute = next < 0.05;
      if (muted !== shouldMute) setMuted(shouldMute);

      if (Math.abs(next - target) > 0.02) raf = requestAnimationFrame(fadeVolume);
    };

    raf = requestAnimationFrame(fadeVolume);
    return () => cancelAnimationFrame(raf);
  }, [hovered, muted, useVideo]);

  useEffect(() => {
    setComputedSize((prev) => {
      const aspect = prev.width && prev.height ? prev.width / prev.height : item.aspectRatio;
      return normalizeSize(aspect, scale);
    });
  }, [scale, item.aspectRatio]);

  const handleSize = (width: number, height: number) => {
    const aspect = width && height ? width / height : undefined;
    setComputedSize(normalizeSize(aspect, scale));
  };

  const titleFont = item.titleFont || titleDefaults.font || 'Inter';
  const titleSizePx = TITLE_SIZE_PX[item.titleSize || titleDefaults.size || 'M'];
  const titleColor = item.titleColor || titleDefaults.color || '#ffffff';

  const renderMedia = () => {
    if (item.kind === 'embed' || !useVideo) {
      const thumb = item.fallbackPreview || item.previewUrl || item.fullUrl;
      return (
        <img
          src={thumb}
          alt={item.title || 'art'}
          className={`w-full h-full object-contain rounded-xl ${loaded ? 'opacity-100' : 'opacity-0'}`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={(e) => {
            const el = e.target as HTMLImageElement;
            handleSize(el.naturalWidth, el.naturalHeight);
            setLoaded(true);
          }}
          onError={() => setLoaded(true)}
          draggable={false}
        />
      );
    }

    return (
      <video
        ref={videoRef}
        src={item.videoUrl || item.previewUrl}
        poster={item.fallbackPreview || item.previewUrl || undefined}
        className={`w-full h-full object-contain rounded-xl ${loaded ? 'opacity-100' : 'opacity-0'}`}
        playsInline
        loop
        muted={muted}
        preload="metadata"
        onLoadedMetadata={(e) => handleSize((e.target as HTMLVideoElement).videoWidth, (e.target as HTMLVideoElement).videoHeight)}
        onLoadedData={() => setLoaded(true)}
        onError={() => setUseVideo(false)}
      />
    );
  };

  const card = (
    <Html
      transform
      distanceFactor={12}
      zIndexRange={[100, 0]}
      style={{ transform: 'translate3d(0,0,0)' }}
    >
      <div
        className={`
          relative group cursor-pointer select-none
          ${mounted && !clearing ? 'opacity-100' : 'opacity-0'}
          ${clearing ? 'scale-75 blur-[1px]' : 'scale-100'}
          ${hovered ? 'scale-110 z-50' : 'z-0'}
        `}
        onClick={(e) => {
          e.stopPropagation();
          onClick(item);
        }}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
        style={{
          width: `${computedSize.width}px`,
          height: `${computedSize.height}px`,
          transform: hovered && !clearing ? 'scale(1.1)' : 'scale(1)',
          transition: 'transform 0.2s ease-out',
        }}
      >
        <div
          className={`
            w-full h-full bg-white rounded-2xl p-2
            transition-shadow duration-300
            ${hovered && !clearing ? 'shadow-[0_20px_50px_rgba(0,0,0,0.25)] ring-2 ring-white/50' : 'shadow-lg'}
          `}
        >
          <div className="w-full h-full rounded-xl overflow-hidden bg-gray-50 relative">
            {renderMedia()}
            {!loaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/40">
                <div className="w-7 h-7 border-2 border-gray-200 border-t-slate-500 rounded-full animate-spin" />
              </div>
            )}

            {/* Phase 3.1: play badge on video cards */}
            {item.kind === 'video' && (
              <div className="absolute top-2 right-2 bg-black/50 p-1.5 rounded-full backdrop-blur-sm pointer-events-none">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              </div>
            )}

            {/* Phase 4: title caption on hover */}
            {item.title && (
              <div
                className={`absolute inset-x-0 bottom-0 px-2 py-1.5 bg-gradient-to-t from-black/70 to-transparent transition-opacity duration-200 pointer-events-none ${
                  hovered ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <span
                  className="block truncate font-semibold leading-tight"
                  style={{ fontFamily: `'${titleFont}', sans-serif`, fontSize: `${titleSizePx}px`, color: titleColor }}
                >
                  {item.title}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Html>
  );

  return (
    <group position={position} ref={groupRef}>
      {floatEnabled ? (
        <Float speed={1.5} rotationIntensity={0.05} floatIntensity={0.5} floatingRange={[-0.1, 0.1]}>
          {card}
        </Float>
      ) : (
        card
      )}
    </group>
  );
};

interface GallerySceneProps {
  onSelect: (item: MediaItem) => void;
  items: MediaItem[];
  clearing: boolean;
  cardScale: number;
  radiusBase: number;
  layout?: 'sphere' | 'carousel';
  titleDefaults?: TitleStyle;
}

const GalleryScene: React.FC<GallerySceneProps> = ({
  onSelect,
  items,
  clearing,
  cardScale,
  radiusBase,
  layout = 'sphere',
  titleDefaults = {},
}) => {
  const radius = Math.max(
    10,
    Math.min(200, (radiusBase || 62) * (1 + Math.min(1, items.length * 0.004)) * Math.max(0.6, cardScale)),
  );

  // Phase 1.2: density-based perf gates.
  const tiltEnabled = items.length <= 150;
  const floatEnabled = items.length <= 200;

  const coords = useMemo(
    () =>
      layout === 'carousel'
        ? getCarouselCoordinates(items.length || 1, radius)
        : getSphereCoordinates(items.length || 1, radius),
    [items.length, radius, layout],
  );

  return (
    <>
      <ambientLight intensity={1} />
      <Environment preset="city" />
      <VideoBudgetTicker />

      <group frustumCulled={false}>
        {items.map((item, i) => (
          <GalleryItem
            key={item.id}
            item={item}
            index={i}
            position={coords[i].position}
            onClick={onSelect}
            radius={radius}
            clearing={clearing}
            scale={cardScale}
            tiltEnabled={tiltEnabled}
            floatEnabled={floatEnabled}
            titleDefaults={titleDefaults}
          />
        ))}
      </group>

      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={Math.max(2, radius * 0.08)}
        maxDistance={Math.max(90, radius * 1.35)}
        autoRotate
        autoRotateSpeed={0.6}
        dampingFactor={0.08}
        rotateSpeed={0.55}
        zoomSpeed={4.5}
      />
    </>
  );
};

export default GalleryScene;
