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
  isMobile: boolean;
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

const GalleryItem = ({ item, position, onClick, index, radius, clearing, scale, isMobile }: ItemProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHover] = useState(false);
  const [loaded, setLoaded] = useState(false);
  
  const hasDedicatedPreview = useMemo(
    () => !!(item.fallbackPreview || (item.previewUrl && item.videoUrl && item.previewUrl !== item.videoUrl)),
    [item.fallbackPreview, item.previewUrl, item.videoUrl],
  );
  
  // Disable video autoplay on mobile to save massive resources
  const shouldShowVideoInCard = !isMobile && item.kind === 'video' && !hasDedicatedPreview && !item.previewUrl;
  const [useVideo, setUseVideo] = useState(shouldShowVideoInCard);
  const [computedSize, setComputedSize] = useState<{ width: number; height: number }>(() =>
    normalizeSize(item.aspectRatio, scale),
  );
  const videoRef = useRef<HTMLVideoElement>(null);

  // Simple, lightweight frame loop
  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.lookAt(state.camera.position);
    
    // Only do the edge tilt on Desktop
    if (!isMobile) {
        const edgeTilt = Math.min(0.35, (Math.abs(position[0]) / radius) * 0.35 + (Math.abs(position[1]) / radius) * 0.15);
        if (edgeTilt > 0) {
          groupRef.current.rotateY(position[0] >= 0 ? edgeTilt : -edgeTilt);
        }
    }
  });

  // Video playback logic (Desktop only)
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
          className={`w-full h-full object-contain rounded-xl transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={(e) => {
            const el = e.target as HTMLImageElement;
            handleSize(el.naturalWidth, el.naturalHeight);
            setLoaded(true);
          }}
          onError={() => setLoaded(true)}
          draggable={false}
          loading="lazy"
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
        muted
        onLoadedMetadata={(e) => handleSize((e.target as HTMLVideoElement).videoWidth, (e.target as HTMLVideoElement).videoHeight)}
        onLoadedData={() => setLoaded(true)}
        onError={() => setUseVideo(false)}
      />
    );
  };

  const CardContent = (
    <Html 
      transform 
      distanceFactor={12} 
      zIndexRange={[100, 0]}
      style={{ pointerEvents: 'none' }}
    >
      <div
        className={`
          relative group cursor-pointer select-none
          ${clearing ? 'opacity-0 scale-75' : 'opacity-100 scale-100'}
          ${hovered ? 'z-50' : 'z-0'}
        `}
        style={{
          width: `${computedSize.width}px`,
          height: `${computedSize.height}px`,
          pointerEvents: 'auto',
          // FIX: Only transition opacity and transform scale. NEVER transition 'all'.
          // This prevents the CSS from fighting the 3D engine's updates.
          transition: 'transform 0.1s ease-out, opacity 0.3s'
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick(item);
        }}
        // Disable hover effects on mobile to prevent scrolling glitches
        onPointerEnter={() => !isMobile && setHover(true)}
        onPointerLeave={() => !isMobile && setHover(false)}
      >
        <div
          className={`
            w-full h-full bg-white rounded-2xl p-2
            ${hovered ? 'shadow-2xl ring-2 ring-white/50 scale-105' : 'shadow-lg'}
          `}
          style={{ transition: 'transform 0.2s ease-out, box-shadow 0.2s' }}
        >
          <div className="w-full h-full rounded-xl overflow-hidden bg-gray-50 relative">
            {renderMedia()}
            {!loaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/40">
                <div className="w-5 h-5 border-2 border-gray-300 border-t-slate-600 rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
      </div>
    </Html>
  );

  return (
    <group position={position} ref={groupRef}>
      {!isMobile ? (
        <Float speed={1.5} rotationIntensity={0.05} floatIntensity={0.5} floatingRange={[-0.1, 0.1]}>
            {CardContent}
        </Float>
      ) : (
        CardContent
      )}
    </group>
  );
};

// --- Main Scene ---
interface GallerySceneProps {
  onSelect: (item: MediaItem) => void;
  items: MediaItem[];
  clearing: boolean;
  cardScale: number;
  radiusBase: number;
  isMobile: boolean;
}

const GalleryScene: React.FC<GallerySceneProps> = ({ onSelect, items, clearing, cardScale, radiusBase, isMobile }) => {
  const radius = Math.max(
    24,
    Math.min(200, (radiusBase || 62) * (1 + Math.min(1, items.length * 0.004)) * Math.max(0.6, cardScale)),
  );
  
  const coords = useMemo(() => getSphereCoordinates(items.length || 1, radius), [items.length, radius]);

  return (
    <>
      <ambientLight intensity={1.2} />
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
            isMobile={isMobile}
          />
        ))}
      </group>

      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={radius * 0.01}
        maxDistance={Math.max(90, radius * 2.0)}
        autoRotate
        autoRotateSpeed={0.6}
        dampingFactor={0.08}
        rotateSpeed={0.55}
        zoomSpeed={6.0}
      />
    </>
  );
};

export default GalleryScene;
