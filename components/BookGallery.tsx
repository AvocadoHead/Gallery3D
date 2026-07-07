import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment, Float, OrbitControls, useProgress } from '@react-three/drei';
import { MediaItem } from '../constants';
import type { TitleStyle } from './FloatingGallery';
import { Book } from './book/Book';
import { buildBookLeaves, BookLeaf } from './book/bookTextures';

export type BookPerPage = 1 | 2 | 4;

const bookUrl = (item: MediaItem): string =>
  item.provider === 'gdrive' ? item.originalUrl : item.previewUrl || item.fullUrl || item.originalUrl;

// Bridge: signals when drei has finished uploading all textures to GPU
const Ready = ({ onReady }: { onReady: () => void }) => {
  const { active } = useProgress();
  useEffect(() => {
    if (!active) onReady();
  }, [active, onReady]);
  return null;
};

/* Responsive framing: on narrow (portrait/phone) viewports the book must sit
   further back or it overflows the screen. Runs on mount + resize only, then
   OrbitControls resumes full ownership of the camera. */
const ResponsiveCamera = ({ controlsRef }: { controlsRef: React.RefObject<any> }) => {
  const { size, camera } = useThree();
  useEffect(() => {
    const aspect = size.width / size.height;
    const dist = aspect >= 1 ? 3.1 : Math.min(7, 3.4 / aspect);
    camera.position.set(0, aspect >= 1 ? 1.7 : 2.1, dist);
    camera.lookAt(0, 0.2, 0);
    controlsRef.current?.update();
  }, [size.width, size.height, camera, controlsRef]);
  return null;
};

const BookScene: React.FC<{
  pages: BookLeaf[];
  page: number;
  setPage: (n: number) => void;
  onReady: () => void;
}> = ({ pages, page, setPage, onReady }) => {
  const controlsRef = useRef<any>(null);
  return (
    <>
      <Float floatIntensity={0.2} speed={1} rotationIntensity={0.12} floatingRange={[-0.02, 0.02]}>
        <Suspense fallback={null}>
          <Book pages={pages} page={page} setPage={setPage} />
        </Suspense>
      </Float>
      <OrbitControls
        ref={controlsRef}
        target={[0, 0.2, 0]}
        minPolarAngle={0.4}
        maxPolarAngle={Math.PI / 2.4}
        minDistance={1.8}
        maxDistance={7}
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
      />
      <ResponsiveCamera controlsRef={controlsRef} />
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
      <Ready onReady={onReady} />
    </>
  );
};

interface BookGalleryProps {
  items: MediaItem[];
  onSelect: (item: MediaItem) => void;
  perPage: BookPerPage;
  title?: string;
  titleDefaults: TitleStyle;
}

/* Self-contained book view: own Canvas (and WebGL context), own build state.
   NOTE (post-mortem of the R6 regression): the book briefly shared one Canvas
   with the sphere/carousel via a per-frame CameraRig. That rig fought
   OrbitControls every frame — dragging the sphere "magnetized" back in a
   glitchy wobble. A separate Canvas costs one context switch (a harmless
   "Context Lost" console log) and keeps every layout's controls untouched.
   Do NOT re-merge the canvases unless the camera handoff is solved without
   any per-frame camera writes. */
const BookGallery: React.FC<BookGalleryProps> = ({ items, perPage, title }) => {
  const [leaves, setLeaves] = useState<BookLeaf[] | null>(null);
  const [page, setPage] = useState(0);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [skipped, setSkipped] = useState(0);
  const [skipDismissed, setSkipDismissed] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [firstFrameReady, setFirstFrameReady] = useState(false);
  const leavesRef = useRef<BookLeaf[] | null>(null);
  leavesRef.current = leaves;

  const urls = useMemo(
    () =>
      items
        .filter((i) => i.kind !== 'text' && !(i.kind === 'video' && !i.previewUrl && !i.fallbackPreview))
        .map(bookUrl)
        .filter(Boolean),
    [items],
  );

  const urlKey = useMemo(() => urls.join('|'), [urls]);

  useEffect(() => {
    let alive = true;
    const isFirstBuild = leavesRef.current === null;

    if (isFirstBuild) {
      setPage(0);
      setProgress({ done: 0, total: 0 });
      setSkipped(0);
      setSkipDismissed(false);
    }

    const delay = isFirstBuild ? 0 : 400;
    const debounce = setTimeout(() => {
      if (!isFirstBuild) setRebuilding(true);
      setProgress({ done: 0, total: 0 });

      buildBookLeaves(urls, perPage, title || 'Gallery', (loaded, total) => {
        if (alive) setProgress({ done: loaded, total });
      }).then(({ leaves: l, skipped: s }) => {
        if (!alive) return;
        setLeaves(l);
        setSkipped(s);
        setRebuilding(false);
        if (!isFirstBuild) setPage((p) => Math.min(p, l.length));
      });
    }, delay);

    return () => {
      alive = false;
      clearTimeout(debounce);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlKey, perPage, title]);

  if (!items.length) {
    return <div className="w-full h-full flex items-center justify-center text-slate-400">Add media to build your book.</div>;
  }

  const { done, total } = progress;
  // Keep overlay until leaves exist AND the scene has rendered its first frame
  const showOverlay = !leaves || !firstFrameReady;

  return (
    <div className="w-full h-full relative">
      {leaves && (
        <Canvas shadows camera={{ position: [0, 1.7, 3.1], fov: 45 }} className="bg-transparent">
          <BookScene
            pages={leaves}
            page={page}
            setPage={setPage}
            onReady={() => setFirstFrameReady(true)}
          />
        </Canvas>
      )}

      {showOverlay && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500 bg-gradient-to-br from-[#f8fafc] to-[#e2e8f0]">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-700 rounded-full animate-spin" />
          <div className="w-56 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-slate-700 rounded-full transition-all duration-300"
              style={{ width: leaves ? '100%' : total ? `${(done / total) * 100}%` : '4%' }}
            />
          </div>
          <p className="text-sm font-medium">
            {leaves ? 'Opening…' : `Binding your book… ${total > 0 ? `${done} / ${total}` : ''}`}
          </p>
        </div>
      )}

      {!showOverlay && (
        <>
          {rebuilding && (
            <div className="absolute bottom-20 left-4 z-10 flex items-center gap-2 px-3 py-1.5 bg-slate-800/90 text-white text-xs font-medium rounded-full shadow-lg backdrop-blur">
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Updating book… {progress.total > 0 && `${progress.done}/${progress.total}`}</span>
            </div>
          )}

          {skipped > 0 && !skipDismissed && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-1.5 bg-slate-800/90 text-white text-xs font-medium rounded-full shadow-lg backdrop-blur">
              <span>{skipped} item{skipped > 1 ? 's' : ''} couldn't be shown in the book</span>
              <button onClick={() => setSkipDismissed(true)} className="text-slate-400 hover:text-white ml-1">✕</button>
            </div>
          )}

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex items-center gap-4">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page <= 0}
              className="w-11 h-11 rounded-full bg-white/90 backdrop-blur shadow-lg border border-slate-200 text-slate-700 disabled:opacity-40 hover:bg-white transition flex items-center justify-center"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="px-3 py-1.5 rounded-full bg-white/90 backdrop-blur shadow text-xs font-semibold text-slate-600 tabular-nums">
              {page === 0 ? 'Cover' : page >= (leaves?.length ?? 0) ? 'End' : `${page} / ${leaves?.length ?? 0}`}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(leaves?.length ?? 0, p + 1))}
              disabled={page >= (leaves?.length ?? 0)}
              className="w-11 h-11 rounded-full bg-white/90 backdrop-blur shadow-lg border border-slate-200 text-slate-700 disabled:opacity-40 hover:bg-white transition flex items-center justify-center"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default BookGallery;
