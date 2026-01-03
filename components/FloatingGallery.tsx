import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
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
  // Track visibility state to unmount/hide DOM elements when behind the sphere
  const [isVisible, setIsVisible] = useState(true);
  
  const hasDedicatedPreview = useMemo(
    () => !!(item.fallbackPreview || (item.previewUrl && item.videoUrl && item.previewUrl !== item.videoUrl)),
    [item.fallbackPreview, item.previewUrl, item.videoUrl],
  );
  
  // OPTIMIZATION: Never auto-play videos on sphere on mobile. It kills performance.
  const shouldShowVideoInCard = !isMobile && item.kind === 'video' && !hasDedicatedPreview && !item.previewUrl;
  const [useVideo, setUseVideo] = useState(shouldShowVideoInCard);
  
  const [computedSize, setComputedSize] = useState<{ width: number; height: number }>(() =>
    normalizeSize(item.aspectRatio, scale),
  );
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const camera = useThree((state) => state.camera);
  const vec = useMemo(() => new THREE.Vector3(), []);

  // --- CRITICAL OPTIMIZATION: MANUAL CULLING ---
  // Instead of relying on expensive 'occlude' prop, we manually check if the item 
  // is on the front hemisphere relative to the camera.
  useFrame(() => {
    if (!groupRef.current) return;

    // 1. Billboard effect (look at camera)
    groupRef.current.lookAt(camera.position);

    // 2. Optimization: Calculate Dot Product to determine visibility
    // Get the world position of the item
    groupRef.current.getWorldPosition(vec);
    
    // Calculate distance/angle to camera. 
    // This is a simplified check: is the item closer to the camera than the center of the sphere?
    // Or simpler: Is the angle between the item vector and camera vector < 90 degrees?
    
    // Actually, for a sphere gallery, we can check the distance squared.
    // If distance(item, camera) < distance(center, camera), it's in front.
    const distToCamSq = vec.distanceToSquared(camera.position);
    const centerToCamSq = camera.position.lengthSq(); // Assuming sphere center is 0,0,0
    
    // Add a small buffer (radius * radius) to prevent flickering at the edge
    const visible = distToCamSq < (centerToCamSq + (radius * radius * 0.2));

    if (visible !== isVisible) {
      setIsVisible(visible);
    }

    // 3. Desktop only: Edge tilt effect (expensive on mobile)
    if (!isMobile && visible) {
      const edgeTilt = Math.min(0.35, (Math.abs(position[0]) / radius) * 0.35 + (Math.abs(position[1]) / radius) * 0.15);
      if (edgeTilt > 0) {
        groupRef.current.rotateY(position[0] >= 0 ? edgeTilt : -edgeTilt);
      }
    }
  });

  // --- Video Logic (Desktop Only) ---
  useEffect(() => {
    if (!useVideo || !videoRef.current || !isVisible) return; // Don't play if hidden
    
    if (hovered) {
        videoRef.current.play().catch(() => {});
        videoRef.current.muted = false;
    } else {
        videoRef.current.pause();
        videoRef.current.muted = true;
    }
  }, [hovered, useVideo, isVisible]);

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
    // 1. Embeds/Images
    if (item.kind === 'embed' || !useVideo) {
      const thumb = item.fallbackPreview || item.previewUrl || item.fullUrl;
      return (
        <img
          src={thumb}
          alt="art"
          className={`w-full h-full object-contain rounded-xl ${loaded ? 'opacity-100' : 'opacity-0'}`}
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

    // 2. Video (Desktop only active state)
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

  // If culled, render nothing or an empty group to keep React Fiber happy but save DOM
  // We use style display:none instead of null to keep the Float physics active if needed, 
  // preventing a "jump" when it comes back into view.
  
  return (
    <group position={position} ref={groupRef}>
      <Float
        speed={isMobile ? 0 : 1.5} // Disable float movement on mobile
        rotationIntensity={isMobile ? 0 : 0.05} 
        floatIntensity={isMobile ? 0 : 0.5} 
        floatingRange={[-0.1, 0.1]}
      >
        <Html 
          transform 
          distanceFactor={12} 
          zIndexRange={[100, 0]}
          // If not visible, hide entirely from DOM layout to save mobile compositor
          style={{ 
            display: isVisible ? 'block' : 'none',
            pointerEvents: 'none'
          }} 
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
              // Use hardware acceleration
              willChange: 'transform, opacity',
              // Simplified transition for mobile
              transition: isMobile ? 'opacity 0.2s' : 'transform 0.1s ease-out, opacity 0.3s'
            }}
            onClick={(e) => {
              e.stopPropagation();
              onClick(item);
            }}
            onPointerEnter={() => !isMobile && setHover(true)} // Disable hover effects on mobile scrolling
            onPointerLeave={() => !isMobile && setHover(false)}
          >
            <div
              className={`
                w-full h-full bg-white rounded-2xl p-2
                ${hovered ? 'shadow-2xl ring-2 ring-white/50 scale-105' : 'shadow-lg'}
              `}
            >
              <div className="w-full h-full rounded-xl overflow-hidden bg-gray-50 relative">
                {isVisible && renderMedia()} 
                {/* Only render <img> tag if visible to save memory */}
                
                {!loaded && isVisible && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/40">
                    <div className="w-5 h-5 border-2 border-gray-300 border-t-slate-600 rounded-full animate-spin" />
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
  cardScale: number;
  radiusBase: number;
  isMobile: boolean; // Note: We need to pass this from App.tsx
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
