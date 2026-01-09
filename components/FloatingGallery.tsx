import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Float, Html } from '@react-three/drei';
import * as THREE from 'three';
import { getSphereCoordinates, MediaItem } from '../constants';

interface ItemProps {
  item: MediaItem;
  position: [number, number, number];
  rotation?: [number, number, number];
  onClick: (item: MediaItem) => void;
  index: number;
  radius: number;
  clearing: boolean;
  scale: number;
  shadowOpacity: number;
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

const GalleryItem = ({ item, position, rotation, onClick, index, radius, clearing, scale, shadowOpacity }: ItemProps) => {
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

  useEffect(() => {
    const timeout = setTimeout(() => {
      setMounted(true);
    }, index * 20); 
    return () => clearTimeout(timeout);
  }, [index]);

  useFrame((state) => {
    if (!groupRef.current) return;
    
    // Carousel Rotation (Static)
    if (rotation) {
        groupRef.current.rotation.set(rotation[0], rotation[1], rotation[2]);
        return;
    }

    // Sphere Billboarding
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
          className={`w-full h-full object-contain rounded-xl ${loaded ? 'opacity-100' : 'opacity-0'}`}
          loading="eager"
          decoding="sync"
          referrerPolicy="no-referrer" // Fix for Google/External
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
        preload="auto"
        referrerPolicy="no-referrer"
        onLoadedMetadata={(e) => handleSize((e.target as HTMLVideoElement).videoWidth, (e.target as HTMLVideoElement).videoHeight)}
        onLoadedData={() => setLoaded(true)}
        onError={() => setUseVideo(false)}
      />
    );
  };

  return (
    <group position={position} ref={groupRef}>
      <Float speed={1.5} rotationIntensity={0.05} floatIntensity={0.5} floatingRange={[-0.1, 0.1]}>
        <Html transform distanceFactor={12} zIndexRange={[100, 0]} style={{ transform: 'translate3d(0,0,0)' }}>
          <div
            className={`
              relative group cursor-pointer select-none
              ${mounted && !clearing ? 'opacity-100' : 'opacity-0'}
              ${clearing ? 'scale-75 blur-[1px]' : 'scale-100'}
              ${hovered ? 'scale-110 z-50' : 'z-0'}
            `}
            onClick={(e) => { e.stopPropagation(); onClick(item); }}
            onPointerEnter={() => setHover(true)}
            onPointerLeave={() => setHover(false)}
            style={{
              width: `${computedSize.width}px`,
              height: `${computedSize.height}px`,
              transform: hovered && !clearing ? 'scale(1.1)' : 'scale(1)',
              transition: 'transform 0.2s ease-out'
            }}
          >
            <div
              className={`w-full h-full bg-white rounded-2xl p-2 transition-shadow duration-300`}
              style={{
                 // Dynamic Shadow
                 boxShadow: hovered && !clearing 
                    ? `0 20px 50px rgba(0,0,0,${shadowOpacity + 0.1})` 
                    : `0 10px 30px rgba(0,0,0,${shadowOpacity})`
              }}
            >
              <div className="w-full h-full rounded-xl overflow-hidden bg-gray-50 relative">
                {renderMedia()}
                {!loaded && <div className="absolute inset-0 flex items-center justify-center bg-white/40"><div className="w-7 h-7 border-2 border-gray-200 border-t-slate-500 rounded-full animate-spin" /></div>}
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
  shadowOpacity: number;
  bgColor: string;
  isCarousel?: boolean;
}

const GalleryScene: React.FC<GallerySceneProps> = ({ onSelect, items, clearing, cardScale, radiusBase, shadowOpacity, bgColor, isCarousel }) => {
  const radius = Math.max(10, Math.min(200, (radiusBase || 62) * (1 + Math.min(1, items.length * 0.004)) * Math.max(0.6, cardScale)));
  
  const coords = useMemo(() => {
    if (isCarousel) {
        return items.map((_, i) => {
            const angle = i * 0.5;
            const y = -i * 10 + (items.length * 10) / 2;
            return {
                position: [Math.sin(angle) * radius, y * 0.1, Math.cos(angle) * radius] as [number, number, number],
                rotation: [0, angle, 0] as [number, number, number]
            };
        });
    }
    return getSphereCoordinates(items.length || 1, radius).map(p => ({ position: p.position, rotation: undefined }));
  }, [items.length, radius, isCarousel]);

  return (
    <>
      <ambientLight intensity={1} />
      <Environment preset="city" />
      {/* Fog blends the distance into the background color */}
      <fog attach="fog" args={[bgColor, radius * 1.5, radius * 3.5]} />

      <group>
        {items.map((item, i) => (
          <GalleryItem
            key={item.id}
            item={item}
            index={i}
            position={coords[i].position}
            rotation={coords[i].rotation}
            onClick={onSelect}
            radius={radius}
            clearing={clearing}
            scale={cardScale}
            shadowOpacity={shadowOpacity}
          />
        ))}
      </group>

      <OrbitControls
        enablePan={isCarousel}
        enableZoom
        minDistance={Math.max(2, radius * 0.08)}
        maxDistance={Math.max(90, radius * 2.5)}
        autoRotate={!isCarousel}
        autoRotateSpeed={0.6}
        dampingFactor={0.08}
        rotateSpeed={0.55}
        zoomSpeed={4.5}
      />
    </>
  );
};

export default GalleryScene;
