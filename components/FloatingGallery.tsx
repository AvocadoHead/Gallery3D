import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Float, Html } from '@react-three/drei';
import * as THREE from 'three';
import { getSphereCoordinates, MediaItem } from '../constants';

// --- Single Gallery Item ---
interface ItemProps {
  item: MediaItem;
  position: [number, number, number];
  onClick: (item: MediaItem) => void;
  index: number;
  radius: number;
  clearing: boolean;
  scale: number;
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

const GalleryItem = ({ item, position, onClick, index, radius, clearing, scale }: ItemProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHover] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [muted, setMuted] = useState(true);
  
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

  useEffect(() => {
    const timeout = setTimeout(() => {
      setMounted(true);
    }, index * 20); 
    return () => clearTimeout(timeout);
  }, [index]);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.lookAt(state.camera.position);

    const edgeTilt = Math.min(0.35, (Math.abs(position[0]) / radius) * 0.35 + (Math.abs(position[1]) / radius) * 0.15);
    if (edgeTilt > 0) {
      groupRef.current.rotateY(position[0] >= 0 ? edgeTilt : -edgeTilt);
    }
  });

  useEffect(() => {
    if (!useVideo || !videoRef.current) return;
    if (hovered) {
        videoRef.current.play().catch(() => {});
        videoRef.current.muted = false;
    } else {
        videoRef.current.pause();
        videoRef.current.muted = true;
    }
  }, [hovered, useVideo]);

  // Volume Fading Logic
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

  const renderMedia = () => {
    if (item.kind === 'embed' || !useVideo) {
      const thumb = item.fallbackPreview || item.previewUrl || item.fullUrl;
      return (
        <img
          src={thumb}
          alt="art"
          className={`w-full h-full object-contain rounded-xl transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
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
        className={`w-full h-full object-contain rounded-xl ${loaded ? 'opacity-100' : 'opacity-0'}`}
        playsInline
        loop
        muted={muted}
        onLoadedMetadata={(e) => handleSize((e.target as HTMLVideoElement).videoWidth, (e.target as HTMLVideoElement).videoHeight)}
        onLoadedData={() => setLoaded(true)}
        onError={() => setUseVideo(false)}
      />
    );
  };

  return (
    <group position={position} ref={groupRef}>
      <Float
        speed={1.5} 
        rotationIntensity={0.05} 
        floatIntensity={0.5} 
        floatingRange={[-0.1, 0.1]}
      >
        {/* FIX: 'occlude="blending"' causes missing items on mobile. 
            Standard 'occlude' is faster and 100% stable. */}
        <Html 
            transform 
            occlude 
            distanceFactor={12} 
            zIndexRange={[100, 0]}
            style={{ 
                // Force hardware acceleration to prevent jitter
                transform: 'translate3d(0,0,0)',
                willChange: 'opacity, transform' 
            }}
        >
          <div
            className={`
              relative group cursor-pointer select-none
              /* FIX: Changed transition-all to transition-opacity. 
                 transition-all fights with the 3D positioning engine. */
              transition-opacity duration-700 ease-out
              ${mounted && !clearing ? 'opacity-100' : 'opacity-0'}
              ${clearing ? 'scale-75 blur-[1px]' : hovered ? 'scale-110 z-50' : 'scale-100 z-0'}
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
              // We apply scale via inline style for hover effects to avoid CSS class conflicts
              transform: hovered && !clearing ? 'scale(1.1)' : 'scale(1)',
              transition: 'transform 0.2s ease-out, opacity 0.5s ease-out'
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
              </div>
            </div>
          </div>
        </Html>
      </Float>
    </group>
  );
};

interface GallerySceneProps {
  onSelect: (item: MediaItem) => void;
  items: MediaItem[];
  clearing: boolean;
  cardScale: number;
  radiusBase: number;
}

const GalleryScene: React.FC<GallerySceneProps> = ({ onSelect, items, clearing, cardScale, radiusBase }) => {
  const radius = Math.max(
    24,
    Math.min(95, (radiusBase || 62) * (1 + Math.min(1, items.length * 0.004)) * Math.max(0.6, cardScale)),
  );
  
  const coords = useMemo(() => getSphereCoordinates(items.length || 1, radius), [items.length, radius]);

  return (
    <>
      <ambientLight intensity={1} />
      <Environment preset="city" />

      <group>
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
