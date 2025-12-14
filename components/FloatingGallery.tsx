import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Float, Html } from '@react-three/drei';
import * as THREE from 'three';
import { PlayCircle } from 'lucide-react';
import { ARTWORK_ITEMS, getSphereCoordinates, ArtworkItem } from '../constants';

const getDriveId = (url: string) => {
  const match = url.match(/[-\w]{25,}/);
  return match ? match[0] : null;
};

const getThumbUrl = (item: ArtworkItem) => {
  const driveId = getDriveId(item.url);
  if (!driveId) return item.url;

  if (item.type === 'image') {
    return `https://drive.google.com/uc?export=view&id=${driveId}`;
  }

  return `https://drive.google.com/file/d/${driveId}/preview?autoplay=1&mute=1&controls=0`;
};

interface ItemProps {
  item: ArtworkItem;
  position: [number, number, number];
  onClick: (id: string) => void;
  index: number;
}

const GalleryItem = ({ item, position, onClick, index }: ItemProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHover] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);

  const isVideo = item.type === 'video';
  const driveId = getDriveId(item.url);
  const thumbUrl = useMemo(() => getThumbUrl(item), [item]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setMounted(true);
    }, index * 20);
    return () => clearTimeout(timeout);
  }, [index]);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.lookAt(state.camera.position);
    }
  });

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
              ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}
              ${hovered ? 'scale-110 z-50' : 'scale-100 z-0'}
            `}
            onClick={(e) => {
              e.stopPropagation();
              onClick(item.id);
            }}
            onPointerEnter={() => setHover(true)}
            onPointerLeave={() => setHover(false)}
            style={{
              width: '240px',
              height: '240px',
            }}
          >
            <div
              className={`
                w-full h-full bg-white rounded-2xl p-2 shadow-xl
                transition-all duration-300
                ${hovered ? 'shadow-[0_20px_50px_rgba(0,0,0,0.25)] ring-2 ring-white/50' : 'shadow-lg'}
              `}
            >
              <div className="w-full h-full rounded-xl overflow-hidden bg-gray-50 relative">
                {isVideo && driveId ? (
                  <>
                    <iframe
                      src={thumbUrl}
                      title={`preview-${item.id}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        pointerEvents: 'none',
                      }}
                      allow="autoplay"
                    />
                    <div
                      className="absolute inset-0"
                      style={{ pointerEvents: 'auto' }}
                    />
                    <div className="absolute bottom-3 right-3 z-10 bg-black/60 rounded-full p-2 text-white">
                      <PlayCircle size={20} />
                    </div>
                  </>
                ) : (
                  <img
                    src={thumbUrl}
                    alt="art"
                    className={`
                      w-full h-full object-cover
                      transition-opacity duration-500
                      ${loaded ? 'opacity-100' : 'opacity-0'}
                    `}
                    onLoad={() => setLoaded(true)}
                    draggable={false}
                  />
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
  onSelect: (id: string) => void;
}

const GalleryScene: React.FC<GallerySceneProps> = ({ onSelect }) => {
  const radius = 58;
  const coords = useMemo(
    () => getSphereCoordinates(ARTWORK_ITEMS.length, radius),
    []
  );

  return (
    <>
      <ambientLight intensity={1} />
      <Environment preset="city" />

      <group>
        {ARTWORK_ITEMS.map((item, i) => (
          <GalleryItem
            key={item.id}
            item={item}
            index={i}
            position={coords[i].position}
            onClick={onSelect}
          />
        ))}
      </group>

      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={0}
        maxDistance={110}
        autoRotate
        autoRotateSpeed={0.6}
        dampingFactor={0.05}
        rotateSpeed={0.5}
        zoomSpeed={4}
      />
    </>
  );
};

export default GalleryScene;