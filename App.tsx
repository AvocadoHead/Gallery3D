import React, { useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import GalleryScene from './components/FloatingGallery';
import Overlay from './components/Overlay';

const Loader = () => (
  <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
    </div>
  </div>
);

const App: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="w-full h-screen relative bg-gradient-to-br from-[#f8fafc] to-[#e2e8f0] overflow-hidden">
      
      {/* 3D Scene Wrapper */}
      <div 
        className={`
          absolute inset-0 transition-all duration-700 ease-out
          ${selectedId ? 'scale-105 blur-sm opacity-50' : 'scale-100 blur-0 opacity-100'}
        `}
      >
        <Suspense fallback={<Loader />}>
          <Canvas 
            // Position z: 75 ensures the whole sphere (radius 58) is visible on load
            camera={{ position: [0, 0, 75], fov: 50 }}
            dpr={[1, 1.5]} 
            gl={{ antialias: false, alpha: true }} 
            className="bg-transparent"
          >
            <GalleryScene onSelect={setSelectedId} />
          </Canvas>
        </Suspense>
      </div>

      {/* UI Overlay for Zoomed Image */}
      <Overlay artworkId={selectedId} onClose={() => setSelectedId(null)} />

      {/* Header */}
      <div className={`
        fixed top-8 left-8 z-10 pointer-events-none select-none transition-opacity duration-500
        ${selectedId ? 'opacity-0' : 'opacity-100'}
      `}>
        <h1 className="text-3xl font-light text-slate-800 tracking-tighter">Aether</h1>
        <p className="text-xs text-slate-400 font-medium tracking-widest uppercase mt-1 ml-1">Gallery</p>
      </div>

      {/* Footer */}
      <div className={`
        fixed bottom-8 right-8 z-20 transition-opacity duration-500
        ${selectedId ? 'opacity-0 pointer-events-none' : 'opacity-100'}
      `}>
        <a 
          href="https://wa.me/" 
          target="_blank" 
          rel="noreferrer"
          className="flex items-center gap-3 px-5 py-2.5 bg-white/80 backdrop-blur-sm rounded-full shadow-sm hover:shadow-md hover:bg-white transition-all duration-300 text-slate-600 hover:text-slate-900 text-sm font-medium border border-white"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
          Contact
        </a>
      </div>
    </div>
  );
};

export default App;