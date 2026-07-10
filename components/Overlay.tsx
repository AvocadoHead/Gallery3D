import React, { useEffect, useLayoutEffect, useState, useMemo, useRef, useCallback } from 'react';
import { MediaItem, TITLE_SIZE_PX } from '../constants';

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const MIN_SCALE = 1;
const MAX_SCALE = 8;

interface OverlayProps {
  artwork: MediaItem | null;
  items?: MediaItem[];
  onNavigate?: (item: MediaItem) => void;
  onClose: () => void;
  titleDefaults?: { font?: string; size?: 'S' | 'M' | 'L' | 'XL'; color?: string };
  galleryId?: string | null;
  onCommentItem?: (item: MediaItem) => void;
}

const extractDriveId = (url: string): string | null => {
  if (!url) return null;
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  const m3 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m3) return m3[1];
  return null;
};

const Overlay: React.FC<OverlayProps> = ({ artwork, items = [], onNavigate, onClose, titleDefaults = {}, galleryId, onCommentItem }) => {
  const [visible, setVisible] = useState(false);
  const [driveMode, setDriveMode] = useState<'loading' | 'image' | 'iframe'>('loading');

  // --- Zoom / pan state ---
  const [scale, setScale] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const pinchDist = useRef<number | null>(null);
  const imgWrapRef = useRef<HTMLDivElement>(null);

  const resetZoom = useCallback(() => { setScale(1); setPanX(0); setPanY(0); }, []);

  // Reset when artwork changes
  useEffect(() => { resetZoom(); }, [artwork, resetZoom]);

  // Prev / next navigation
  const currentIndex = artwork ? items.findIndex((i) => i.id === artwork.id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < items.length - 1;
  const goTo = useCallback((index: number) => {
    if (items[index] && onNavigate) onNavigate(items[index]);
  }, [items, onNavigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && hasPrev) goTo(currentIndex - 1);
      if (e.key === 'ArrowRight' && hasNext) goTo(currentIndex + 1);
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasPrev, hasNext, currentIndex, goTo, onClose]);

  // Drive type detection
  useEffect(() => {
    if (!artwork) { setVisible(false); return; }
    requestAnimationFrame(() => setVisible(true));
    setDriveMode('loading');

    const isDrive = artwork.fullUrl.includes('drive.google.com') || (artwork as any).provider === 'gdrive';
    if (!isDrive) { setDriveMode('image'); return; }

    const id = extractDriveId(artwork.fullUrl) || extractDriveId((artwork as any).embedUrl);
    if (!id) { setDriveMode('iframe'); return; }

    // No API key — use direct Drive URL; falls back to iframe on load error
    if (!GOOGLE_API_KEY) { setDriveMode('image'); return; }

    fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=mimeType&key=${GOOGLE_API_KEY}`)
      .then((r) => r.json())
      .then((d) => setDriveMode(d.mimeType?.startsWith('image/') ? 'image' : 'iframe'))
      .catch(() => setDriveMode('iframe'));
  }, [artwork]);

  // Non-passive wheel listener — useLayoutEffect fires synchronously after DOM
  // mutations, so imgWrapRef.current is guaranteed to be set when driveMode='image'.
  useLayoutEffect(() => {
    const el = imgWrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 0.9;
      setScale((prev) => {
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev * factor));
        if (next <= MIN_SCALE) { setPanX(0); setPanY(0); }
        return next;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [artwork, driveMode]);

  // Global mouse tracking while dragging
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      setPanX(e.clientX - dragStart.current.x);
      setPanY(e.clientY - dragStart.current.y);
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= MIN_SCALE) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStart.current = { x: e.clientX - panX, y: e.clientY - panY };
  };

  const getPinchDist = (touches: React.TouchList) =>
    Math.hypot(touches[1].clientX - touches[0].clientX, touches[1].clientY - touches[0].clientY);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchDist.current = getPinchDist(e.touches);
    } else if (e.touches.length === 1 && scale > MIN_SCALE) {
      setIsDragging(true);
      dragStart.current = { x: e.touches[0].clientX - panX, y: e.touches[0].clientY - panY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchDist.current !== null) {
      const newDist = getPinchDist(e.touches);
      const factor = newDist / pinchDist.current;
      setScale((prev) => {
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev * factor));
        if (next <= MIN_SCALE) { setPanX(0); setPanY(0); }
        return next;
      });
      pinchDist.current = newDist;
    } else if (e.touches.length === 1 && isDragging) {
      setPanX(e.touches[0].clientX - dragStart.current.x);
      setPanY(e.touches[0].clientY - dragStart.current.y);
    }
  };

  const handleTouchEnd = () => { setIsDragging(false); pinchDist.current = null; };

  const config = useMemo(() => {
    if (!artwork) return null;
    const url = artwork.fullUrl;

    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = url.split('v=')[1] || url.split('/').pop();
      const cleanId = videoId?.split('&')[0].split('?')[0];
      return { type: 'iframe', src: `https://www.youtube.com/embed/${cleanId}?autoplay=1&rel=0`, ratio: 'fixed' };
    }

    if (url.includes('vimeo.com')) {
      const match = url.match(/vimeo\.com\/(?:.*\/)?(\d+)/);
      const videoId = match ? match[1] : null;
      if (videoId) return { type: 'iframe', src: `https://player.vimeo.com/video/${videoId}?autoplay=1&title=0&byline=0&portrait=0`, ratio: 'fixed' };
    }

    const isDrive = url.includes('drive.google.com') || (artwork as any).provider === 'gdrive';
    if (isDrive) {
      const id = extractDriveId(url) || extractDriveId((artwork as any).embedUrl);
      if (id) {
        if (driveMode === 'loading') return { type: 'loading' };
        if (driveMode === 'image') {
            const src = GOOGLE_API_KEY
              ? `https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${GOOGLE_API_KEY}`
              : `https://drive.google.com/uc?export=view&id=${id}`;
            return { type: 'image', src };
          }
        return { type: 'iframe', src: `https://drive.google.com/file/d/${id}/preview`, ratio: 'flexible' };
      }
    }

    if (artwork.kind === 'video' || url.match(/\.(mp4|webm|mov|ogg)$/i)) return { type: 'video', src: artwork.videoUrl || url };
    return { type: 'image', src: url };
  }, [artwork, driveMode]);

  if (!artwork || !config) return null;

  const isZoomed = scale > MIN_SCALE;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">

      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* Content layer */}
      <div className={`relative z-10 w-full h-full flex flex-col items-center justify-center pointer-events-none transition-transform duration-500 ${visible ? 'scale-100' : 'scale-90'}`}>

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 pointer-events-auto p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition z-50 backdrop-blur-md shadow-lg"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Prev / Next chevrons */}
        {hasPrev && (
          <button
            onClick={() => goTo(currentIndex - 1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-auto p-3 rounded-full bg-white/10 text-white hover:bg-white/25 active:scale-95 transition z-50 backdrop-blur-md shadow-lg"
            aria-label="Previous"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        {hasNext && (
          <button
            onClick={() => goTo(currentIndex + 1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-auto p-3 rounded-full bg-white/10 text-white hover:bg-white/25 active:scale-95 transition z-50 backdrop-blur-md shadow-lg"
            aria-label="Next"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Zoom hint */}
        {isZoomed && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-auto z-50">
            <button
              onClick={resetZoom}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-full text-white/80 text-[11px] font-medium border border-white/10"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 11h4M11 9v4" /></svg>
              {Math.round(scale * 100)}% · double-click to reset
            </button>
          </div>
        )}

        {/* Media container */}
        <div
          className="pointer-events-auto flex items-center justify-center"
          style={{ maxWidth: '95vw', maxHeight: '85vh' }}
          onClick={(e) => e.stopPropagation()}
        >
          {config.type === 'loading' ? (
            <div className="flex items-center justify-center text-white/80">
              <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          ) : config.type === 'iframe' ? (
            <div className={`bg-black shadow-2xl rounded-lg overflow-hidden ${config.ratio === 'fixed' ? 'w-[90vw] max-w-7xl aspect-video max-h-[80vh]' : 'w-[90vw] h-[80vh] max-w-7xl'}`}>
              <iframe src={config.src} title="Content" className="w-full h-full border-0" allow="autoplay; encrypted-media; fullscreen" allowFullScreen />
            </div>
          ) : config.type === 'video' ? (
            <video src={config.src} controls autoPlay playsInline className="max-w-full max-h-[85vh] w-auto h-auto object-contain rounded-lg shadow-2xl" />
          ) : (
            /* Zoomable image */
            <div
              ref={imgWrapRef}
              onMouseDown={handleMouseDown}
              onDoubleClick={resetZoom}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{
                cursor: isZoomed ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
                touchAction: 'none',
                userSelect: 'none',
              }}
            >
              <img
                src={config.src}
                alt={artwork.title || 'Artwork'}
                className="max-w-[90vw] max-h-[85vh] w-auto h-auto object-contain rounded-lg shadow-2xl block"
                style={{
                  transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
                  transformOrigin: 'center center',
                  transition: isDragging ? 'none' : 'transform 0.12s ease-out',
                }}
                draggable={false}
                onError={() => setDriveMode('iframe')}
              />
            </div>
          )}
        </div>

        {/* Info bar */}
        {(artwork.title || artwork.description) && (
          <div className="mt-4 pointer-events-auto px-6 py-3 bg-black/60 backdrop-blur-md rounded-full text-white text-center max-w-xl animate-in slide-in-from-bottom-4 duration-700 border border-white/10 shadow-lg">
            {artwork.title && (
              <h2
                className="font-bold"
                style={{
                  fontFamily: `'${artwork.titleFont || titleDefaults.font || 'Inter'}', sans-serif`,
                  fontSize: `${TITLE_SIZE_PX[artwork.titleSize || titleDefaults.size || 'M']}px`,
                  color: artwork.titleColor || titleDefaults.color || undefined,
                }}
              >
                {artwork.title}
              </h2>
            )}
            {artwork.description && <p className="text-xs text-slate-300 mt-0.5">{artwork.description}</p>}
          </div>
        )}

        {/* Comment on this piece */}
        {galleryId && onCommentItem && (
          <button
            onClick={() => onCommentItem(artwork)}
            className="mt-3 pointer-events-auto flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white text-xs font-semibold border border-white/20 transition animate-in slide-in-from-bottom-4 duration-700"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            Comment on this piece
          </button>
        )}
      </div>
    </div>
  );
};

export default Overlay;
