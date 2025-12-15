import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Float, Html } from '@react-three/drei';
import * as THREE from 'three';
import { ARTWORK_IDS, getPreviewUrl, getSphereCoordinates } from '../constants';

// --- Single Gallery Item ---
interface ItemProps {
  id: string;
  position: [number, number, number];
  onClick: (id: string) => void;
  index: number;
}

const GalleryItem = ({ id, position, onClick, index }: ItemProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHover] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  const url = useMemo(() => getPreviewUrl(id), [id]);

  useEffect(() => {
    // Staggered entry animation
    const timeout = setTimeout(() => {
      setMounted(true);
    }, index * 20); 
    return () => clearTimeout(timeout);
  }, [index]);

  useFrame((state) => {
    if (groupRef.current) {
      // Billboard behavior: always face the camera
      // This works perfectly both outside and INSIDE the sphere
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
              onClick(id);
            }}
            onPointerEnter={() => setHover(true)}
            onPointerLeave={() => setHover(false)}
            style={{
              width: '240px',
              height: '240px',
            }}
          >
            {/* Card Container */}
            <div 
              className={`
                w-full h-full bg-white rounded-2xl p-2 shadow-xl
                transition-all duration-300
                ${hovered ? 'shadow-[0_20px_50px_rgba(0,0,0,0.25)] ring-2 ring-white/50' : 'shadow-lg'}
              `}
            >
              {/* Image Container */}
              <div className="w-full h-full rounded-xl overflow-hidden bg-gray-50 relative">
                <img 
                  src={url} 
                  alt="art" 
                  className={`
                    w-full h-full object-cover
                    transition-opacity duration-500
                    ${loaded ? 'opacity-100' : 'opacity-0'}
                  `}
                  onLoad={() => setLoaded(true)}
                  draggable={false}
                />
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
  onSelect: (id: string) => void;
}

const GalleryScene: React.FC<GallerySceneProps> = ({ onSelect }) => {
  // Increased radius significantly to 58 to absolutely prevent overlapping
  const radius = 58;
  const coords = useMemo(() => getSphereCoordinates(ARTWORK_IDS.length, radius), []);

  return (
    <>
      <ambientLight intensity={1} />
      <Environment preset="city" />
      
      <group>
        {ARTWORK_IDS.map((id, i) => (
          <GalleryItem 
            key={id} 
            id={id} 
            index={i}
            position={coords[i].position} 
            onClick={onSelect} 
          />
        ))}
      </group>

      <OrbitControls 
        enablePan={false} 
        enableZoom={true} 
        // minDistance 0 allows fully entering the sphere to the center
        // maxDistance 110 allows viewing the whole sphere from afar
        minDistance={0} 
        maxDistance={110} 
        autoRotate 
        autoRotateSpeed={0.6}
        dampingFactor={0.05}
        rotateSpeed={0.5}
        // Increased zoomSpeed to create larger movement per scroll
        zoomSpeed={4}
      />
    </>
  );
};

export default GalleryScene;