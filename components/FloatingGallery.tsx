import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Float, Html } from '@react-three/drei';
import * as THREE from 'three';
import { getSphereCoordinates, MediaItem } from '../constants';

interface ItemProps {
  item: MediaItem;
  position: [number, number, number];
  onClick: (item: MediaItem) => void;
  index: number;
  radius: number;
  clearing?: boolean;
}

const normalizeSize = (aspectRatio?: number) => {
  const base = 220;
  const min = 150;
  const max = 260;

  if (!aspectRatio || Number.isNaN(aspectRatio)) return { width: base, height: base };

  if (aspectRatio >= 1) {
    return { width: base, height: Math.min(max, Math.max(min, base / aspectRatio)) };
  }

  return { height: base, width: Math.min(max, Math.max(min, base * aspectRatio)) };
};

const GalleryItem = ({ item, position, onClick, index, radius, clearing }: ItemProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [hovered, setHover] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [computedSize, setComputedSize] = useState<{ width: number; height: number }>(() => normalizeSize(item.aspectRatio));

  useEffect(() => {
    const timeout = setTimeout(() => setMounted(true), index * 20);
    return () => clearTimeout(timeout);
  }, [index]);

  useFrame((state) => {
    if (!groupRef.current) return;

    // Always face camera (works outside + inside sphere)
    groupRef.current.lookAt(state.camera.position);

    // Slight extra tilt near edges to give depth
    const edgeTilt = Math.min(
      0.35,
      (Math.abs(position[0]) / radius) * 0.35 + (Math.abs(position[1]) / radius) * 0.15
    );
    if (edgeTilt > 0) groupRef.current.rotateY(position[0] >= 0 ? edgeTilt : -edgeTilt);
  });

  // Smooth audio fade on hover (videos only)
  useEffect(() => {
    if (item.kind !== 'video') return;

    let raf = 0;
    const tick = () => {
      const el = videoRef.current;
      if (!el) return;

      const target = hovered ? 0.9 : 0;
      const current = el.volume ?? 0;
      const step = 0.06;
      const next = hovered ? Math.min(1, current + step) : Math.max(0, current - step);

      el.volume = next;
      el.muted = next === 0;

      if (Math.abs(next - target) > 0.02) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hovered, item.kind]);

  const handleSize = (width: number, height: number) => {
    const aspect = width && height ? width / height : undefined;
    setComputedSize(normalizeSize(aspect));
  };

  const renderMedia = () => {
    if (item.kind === 'video') {
      return (
        <video
          ref={videoRef}
          src={item.previewUrl}
          className={`
            w-full h-full object-contain rounded-xl
            transition-opacity duration-500
            ${loaded ? 'opacity-100' : 'opacity-0'}
          `}
          autoPlay
          playsInline
          loop
          muted
          preload="metadata"
          onLoadedMetadata={(e) => {
            const el = e.target as HTMLVideoElement;
            handleSize(el.videoWidth, el.videoHeight);
          }}
          onLoadedData={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
      );
    }

    // embed: show thumbnail image in the sphere; play only in overlay
    if (item.kind === 'embed') {
      return (
        <img
          src={item.previewUrl}
          alt="preview"
          className={`
            w-full h-full object-contain rounded-xl
            transition-opacity duration-500
            ${loaded ? 'opacity-100' : 'opacity-0'}
          `}
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
      <img
        src={item.previewUrl}
        alt="art"
        className={`
          w-full h-full object-contain rounded-xl
          transition-opacity duration-500
          ${loaded ? 'opacity-100' : 'opacity-0'}
        `}
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

  return (
    <group position={position} ref={groupRef}>
      <Float speed={1.5} rotationIntensity={0.05} floatIntensity={0.5} floatingRange={[-0.1, 0.1]}>
        <Html transform occlude="blending" distanceFactor={12} zIndexRange={[100, 0]}>
          <div
            className={`
              relative group cursor-pointer select-none
              transition-all duration-700 ease-out
              ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}
              ${hovered ? 'scale-110 z-50' : 'scale-100 z-0'}
              ${clearing ? 'opacity-0 scale-90 translate-y-6' : ''}
            `}
            onClick={(e) => {
              e.stopPropagation();
              onClick(item);
            }}
            onPointerEnter={() => setHover(true)}
            onPointerLeave={() => setHover(false)}
            style={{ width: `${computedSize.width}px`, height: `${computedSize.height}px` }}
          >
            <div
              className={`
                w-full h-full bg-white rounded-2xl p-2 shadow-xl
                transition-all duration-300
                ${hovered ? 'shadow-[0_20px_50px_rgba(0,0,0,0.25)] ring-2 ring-white/50' : 'shadow-lg'}
              `}
            >
              <div className="w-full h-full rounded-xl overflow-hidden bg-gray-50 relative">
                {renderMedia()}
                {!loaded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/40">
                    <div className="w-7 h-7 border-2 border-gray-200 border-t-slate-500 rounded-full animate-spin" />
                  </div>
                )}
                {item.kind !== 'image' && (
                  <div className="absolute bottom-3 right-3 z-10 bg-black/55 rounded-full px-2 py-1 text-white text-[10px]">
                    {item.kind === 'video' ? 'VIDEO' : 'PLAY'}
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
  clearing?: boolean;
}

const GalleryScene: React.FC<GallerySceneProps> = ({ onSelect, items, clearing }) => {
  const radius = Math.min(80, 48 + items.length * 0.15);
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
            position={coords[i]?.position || [0, 0, radius]}
            onClick={onSelect}
            radius={radius}
            clearing={clearing}
          />
        ))}
      </group>

      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={18}
        maxDistance={105}
        autoRotate
        autoRotateSpeed={0.6}
        dampingFactor={0.08}
        rotateSpeed={0.55}
        zoomSpeed={3.6}
      />
    </>
  );
};

export default GalleryScene;
