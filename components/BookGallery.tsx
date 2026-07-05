import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, Float, OrbitControls } from '@react-three/drei';
import { MediaItem } from '../constants';
import type { TitleStyle } from './FloatingGallery';
import { Book } from './book/Book';
import { buildBookLeaves, BookLeaf } from './book/bookTextures';

export type BookPerPage = 1 | 2 | 4;

interface BookGalleryProps {
  items: MediaItem[];
  onSelect: (item: MediaItem) => void;
  perPage: BookPerPage;
  title?: string;
  titleDefaults: TitleStyle;
}

/** Best still-image URL for a gallery item (Drive links normalise to lh3). */
const bookUrl = (item: MediaItem): string =>
  item.provider === 'gdrive' ? item.originalUrl : item.previewUrl || item.fullUrl || item.originalUrl;

const BookScene: React.FC<{ pages: BookLeaf[]; page: number; setPage: (n: number) => void }> = ({ pages, page, setPage }) => (
  <>
    <Float rotation-x={-Math.PI / 4} floatIntensity={0.2} speed={1} rotationIntensity={0.4} floatingRange={[-0.02, 0.02]}>
      <Suspense fallback={null}>
        <Book pages={pages} page={page} setPage={setPage} />
      </Suspense>
    </Float>
    <OrbitControls maxPolarAngle={Math.PI / 2} minDistance={1.5} maxDistance={12} enablePan={false} />
    <Environment preset="studio" environmentIntensity={0.5} />
    <ambientLight intensity={1.5} />
    <directionalLight
      position={[2, 5, 2]}
      intensity={1}
      castShadow
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-bias={-0.0001}
    />
    <mesh position-y={-1.5} rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[100, 100]} />
      <shadowMaterial transparent opacity={0.2} />
    </mesh>
  </>
);

const BookGallery: React.FC<BookGalleryProps> = ({ items, perPage, title }) => {
  const [leaves, setLeaves] = useState<BookLeaf[] | null>(null);
  const [page, setPage] = useState(0);

  const urls = useMemo(
    () => items.filter((i) => i.kind !== 'text').map(bookUrl).filter(Boolean),
    [items],
  );

  useEffect(() => {
    let alive = true;
    setLeaves(null);
    setPage(0);
    buildBookLeaves(urls, perPage, title || 'Gallery').then((l) => {
      if (alive) setLeaves(l);
    });
    return () => { alive = false; };
  }, [urls, perPage, title]);

  if (!items.length) {
    return <div className="w-full h-full flex items-center justify-center text-slate-400">Add media to build your book.</div>;
  }

  if (!leaves) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-500">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-700 rounded-full animate-spin" />
        <p className="text-sm font-medium">Binding your book…</p>
      </div>
    );
  }

  const totalLeaves = leaves.length;

  return (
    <div className="w-full h-full relative">
      <Canvas shadows camera={{ position: [-0.5, 1, 4], fov: 45 }} className="bg-transparent">
        <BookScene pages={leaves} page={page} setPage={setPage} />
      </Canvas>

      {/* navigation */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex items-center gap-4">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page <= 0}
          className="w-11 h-11 rounded-full bg-white/90 backdrop-blur shadow-lg border border-slate-200 text-slate-700 disabled:opacity-40 hover:bg-white transition flex items-center justify-center"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <span className="px-3 py-1.5 rounded-full bg-white/90 backdrop-blur shadow text-xs font-semibold text-slate-600 tabular-nums">
          {page === 0 ? 'Cover' : page >= totalLeaves ? 'End' : `${page} / ${totalLeaves}`}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalLeaves, p + 1))}
          disabled={page >= totalLeaves}
          className="w-11 h-11 rounded-full bg-white/90 backdrop-blur shadow-lg border border-slate-200 text-slate-700 disabled:opacity-40 hover:bg-white transition flex items-center justify-center"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </div>
  );
};

export default BookGallery;
