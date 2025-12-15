import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Float, Html } from '@react-three/drei';
import * as THREE from 'three';
import { MediaItem, getSphereCoordinates } from '../constants';

interface GallerySceneProps {
  items: MediaItem[];
  onSelect: (item: MediaItem) => void;
  clearing?: boolean;
}

const GalleryItem = ({
  item,
  position,
  index,
  onClick,
}: {
  item: MediaItem;
  position: [number, number, number];
  index: number;
  onClick: (item: MediaItem) => void;
}) => {
  const ref = useRef<THREE.Group>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), index * 20);
    return () => clearTimeout(t);
  }, [index]);

  useFrame(({ camera }) => {
    if (ref.current) ref.current.lookAt(camera.position);
  });

  return (
    <group ref={ref} position={position}>
      <Float speed={1.5} floatIntensity={0.6}>
        <Html transform distanceFactor={12}>
          <div
            onClick={() => onClick(item)}
            className={`cursor-pointer transition-all duration-700 ${
              mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
            }`}
          >
            <img
              src={item.previewUrl}
              alt=""
              draggable={false}
              className="w-[220px] h-[220px] object-cover rounded-xl shadow-xl"
            />
          </div>
        </Html>
      </Float>
    </group>
  );
};

const GalleryScene: React.FC<GallerySceneProps> = ({
  items,
  onSelect,
  clearing = false,
}) => {
  const radius = Math.min(80, 48 + items.length * 0.15);

  const coords = useMemo(
    () => getSphereCoordinates(items.length || 1, radius),
    [items.length, radius]
  );

  if (!items.length) return null;

  return (
    <>
      <ambientLight intensity={1} />
      <Environment preset="city" />

      {items.map((item, i) => (
        <GalleryItem
          key={item.id}
          item={item}
          index={i}
          position={coords[i].position}
          onClick={onSelect}
        />
      ))}

      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={0}
        maxDistance={110}
        autoRotate={!clearing}
        autoRotateSpeed={0.6}
      />
    </>
  );
};

export default GalleryScene;
