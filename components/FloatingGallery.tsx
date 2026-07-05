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
  clearing: boolean;
  scale: number;
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
  clearing,
  scale,
  floatEnabled,
  titleDefaults,
}: ItemProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHover] = useState(false);
  const [loaded, setLoaded] = useState(item.kind === 'text');
  const [mounted, setMounted] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  // Direct .mp4/.webm items with no thumbnail render as a STATIC video
  // element (first frame only — no in-card playback). Full playback happens
  // in the lightbox. Items with a preview image always use the image.
  const showVideoFrame =
    item.kind === 'video' &&
    !!item.videoUrl &&
    !item.previewUrl &&
    !item.fallbackPreview &&
    !videoFailed;

  const [computedSize, setComputedSize] = useState<{ width: number; height: number }>(() =>
    normalizeSize(item.aspectRatio, scale),
  );

  // Ensure no part of the card is ever frustum-culled by the 3D engine.
  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.traverse((obj) => {
      obj.frustumCulled = false;
    });
    groupRef.current.frustumCulled = false;
  }, []);

  // Staggered entrance, capped so the last card never waits more than 1.5s.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setMounted(true);
    }, Math.min(index * 20, 1500));
    return () => clearTimeout(timeout);
  }, [index]);

  // Pure billboard: keep every card parallel to the screen.
  // NOTE: an earlier version added a per-frame "edge tilt" (rotateY) here.
  // That made cards near the sphere/carousel silhouette intersect each
  // other's planes, which — combined with a coarse zIndexRange — caused the
  // visible "jumping over each other" at the edges. Do not reintroduce a
  // per-card rotation without also solving stacking order.
  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.lookAt(state.camera.position);
  });

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
    if (item.kind === 'text') {
      return (
        <div
          className="w-full h-full flex items-center justify-center text-center p-2 font-bold text-slate-800 opacity-100"
          style={{ fontFamily: `'${titleFont}', sans-serif`, fontSize: titleSizePx, color: titleColor }}
        >
          {item.text || 'Text'}
        </div>
      );
    }
    if (showVideoFrame) {
      return (
        <video
          // #t=0.1 nudges browsers (esp. Safari) to paint the first frame
          // without ever starting playback.
          src={`${item.videoUrl}#t=0.1`}
          className={`w-full h-full object-contain rounded-xl ${loaded ? 'opacity-100' : 'opacity-0'}`}
          playsInline
          muted
          preload="metadata"
          onLoadedMetadata={(e) => {
            const v = e.target as HTMLVideoElement;
            handleSize(v.videoWidth, v.videoHeight);
            setLoaded(true);
          }}
          onError={() => setVideoFailed(true)}
        />
      );
    }

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
  };

  const card = (
    <Html
      transform
      distanceFactor={12}
      // Wide z-index range so hundreds of cards each get a distinct stacking
      // level. The old [100, 0] range quantized ~300 cards into 100 levels;
      // ties at the silhouette flipped every frame as the sphere rotated —
      // the "items jump over each other" glitch. The Canvas wrapper is its
      // own stacking context (z-0), so these values can never cover the UI.
      zIndexRange={[50000, 0]}
      style={{ transform: 'translate3d(0,0,0)' }}
    >
      <div
        className={`
          relative group cursor-pointer select-none
          ${mounted && !clearing ? 'opacity-100' : 'opacity-0'}
          ${clearing ? 'scale-75 blur-[1px]' : 'scale-100'}
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

            {/* Play badge on video cards — playback lives in the lightbox */}
            {item.kind === 'video' && (
              <div className="absolute top-2 right-2 bg-black/50 p-1.5 rounded-full backdrop-blur-sm pointer-events-none">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              </div>
            )}

            {/* Title caption on hover */}
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

  // Density-based perf gate: 200+ independent float animations cost more
  // than they add visually.
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

      <group frustumCulled={false}>
        {items.map((item, i) => (
          <GalleryItem
            key={item.id}
            item={item}
            index={i}
            position={coords[i].position}
            onClick={onSelect}
            clearing={clearing}
            scale={cardScale}
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
