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
}

const normalizeSize = (aspectRatio?: number) => {
  const base = 220;
  const min = 150;
  const max = 260;

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

const GalleryItem = ({ item, position, onClick, index, radius, clearing }: ItemProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHover] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [computedSize, setComputedSize] = useState<{ width: number; height: number }>(() => normalizeSize(item.aspectRatio));
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Staggered entry animation
    const timeout = setTimeout(() => {
      setMounted(true);
    }, index * 20); 
    return () => clearTimeout(timeout);
  }, [index]);

  useFrame((state) => {
    if (!groupRef.current) return;
    // Billboard behavior: always face the camera
    // This works perfectly both outside and INSIDE the sphere
    groupRef.current.lookAt(state.camera.position);

    const edgeTilt = Math.min(0.35, (Math.abs(position[0]) / radius) * 0.35 + (Math.abs(position[1]) / radius) * 0.15);
    if (edgeTilt > 0) {
      groupRef.current.rotateY(position[0] >= 0 ? edgeTilt : -edgeTilt);
    }
  });

  useEffect(() => {
    if (!videoRef.current) return;

    const play = () => {
      const el = videoRef.current!;
      const promise = el.play();
      if (promise && typeof promise.then === 'function') {
        promise.catch(() => {});
      }
    };

    play();
  }, [item.previewUrl]);

  useEffect(() => {
    if (!videoRef.current) return;
    const el = videoRef.current;
    const promise = el.play();
    if (promise && typeof promise.then === 'function') {
      promise.catch(() => {});
    }
  }, [hovered]);

  useEffect(() => {
    let raf: number;
    const fadeVolume = () => {
      if (!videoRef.current) return;
      const target = hovered ? 0.9 : 0;
      const current = videoRef.current.volume;
      const step = 0.05;
      const next = hovered ? Math.min(1, current + step) : Math.max(0, current - step);
      videoRef.current.volume = next;
      videoRef.current.muted = next === 0;
      if (Math.abs(next - target) > 0.02) raf = requestAnimationFrame(fadeVolume);
    };

    raf = requestAnimationFrame(fadeVolume);
    return () => cancelAnimationFrame(raf);
  }, [hovered]);

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
          onLoadedMetadata={(e) => handleSize((e.target as HTMLVideoElement).videoWidth, (e.target as HTMLVideoElement).videoHeight)}
          onLoadedData={() => setLoaded(true)}
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
        draggable={false}
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
        <Html transform occlude="blending" distanceFactor={12} zIndexRange={[100, 0]}>
          <div
            className={`
              relative group cursor-pointer select-none
              transition-all duration-700 ease-out
              ${mounted && !clearing ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}
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
            }}
          >
            {/* Card Container */}
            <div
              className={`
                w-full h-full bg-white rounded-2xl p-2 shadow-xl
                transition-all duration-300
                ${hovered && !clearing ? 'shadow-[0_20px_50px_rgba(0,0,0,0.25)] ring-2 ring-white/50' : 'shadow-lg'}
              `}
            >
              {/* Media Container */}
              <div className="w-full h-full rounded-xl overflow-hidden bg-gray-50 relative">
                {item.kind === 'embed' ? (
                  <div className={`w-full h-full flex items-center justify-center ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500`}>
                    <img
                      src={item.previewUrl}
                      alt="preview"
                      className="w-full h-full object-contain"
                      onLoad={(e) => {
                        const el = e.target as HTMLImageElement;
                        handleSize(el.naturalWidth, el.naturalHeight);
                        setLoaded(true);
                      }}
                    />
                  </div>
                ) : (
                  renderMedia()
                )}
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

// --- Main Scene ---
interface GallerySceneProps {
  onSelect: (item: MediaItem) => void;
  items: MediaItem[];
  clearing: boolean;
}

const GalleryScene: React.FC<GallerySceneProps> = ({ onSelect, items, clearing }) => {
  const radius = Math.min(74, 42 + items.length * 0.12);
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
          />
        ))}
      </group>

      <OrbitControls
        enablePan={false}
        enableZoom={true}
        // Broadened zoom range for deep dives and distant overviews
        minDistance={0.008}
        maxDistance={360}
        autoRotate
        autoRotateSpeed={0.6}
        dampingFactor={0.05}
        rotateSpeed={0.5}
        // Increased zoomSpeed to create larger movement per scroll
        zoomSpeed={5.5}
      />
    </>
  );
};

export default GalleryScene;