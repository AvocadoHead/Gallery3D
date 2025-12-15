import React, { useState, useEffect, useMemo } from 'react';
import { MediaItem } from '../constants';

interface OverlayProps {
  artwork: MediaItem | null;
  onClose: () => void;
}

const Overlay: React.FC<OverlayProps> = ({ artwork, onClose }) => {
  const [loaded, setLoaded] = useState(false);
  const [visible, setVisible] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [modalMuted, setModalMuted] = useState(true);

  useEffect(() => {
    if (artwork) {
      setLoaded(false);
      setHasError(false);
      setModalMuted(true);
      requestAnimationFrame(() => setVisible(true));
      document.body.style.overflow = 'hidden';
    } else {
      setVisible(false);
      document.body.style.overflow = '';
    }
  }, [artwork]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!artwork) return null;

  const previewUrl = artwork.previewUrl;
  const fullUrl = artwork.fullUrl;

  const renderContent = useMemo(() => {
    if (artwork.kind === 'video' && !hasError) {
      return (
        <div className="relative">
          <video
            src={fullUrl}
            className={`
              max-w-full max-h-[85vh] object-contain rounded-xl select-none
              transition-opacity duration-500
              ${loaded ? 'opacity-100' : 'opacity-0'}
            `}
            autoPlay
            loop
            playsInline
            muted={modalMuted}
            controls
            onLoadedData={() => setLoaded(true)}
            onError={() => setHasError(true)}
          />
          <button
            className="absolute bottom-4 right-4 px-3 py-1.5 rounded-full bg-black/60 text-white text-xs shadow"
            onClick={() => setModalMuted((prev) => !prev)}
          >
            {modalMuted ? 'Enable sound' : 'Mute'}
          </button>
        </div>
      );
    }

    if (artwork.kind === 'embed') {
      const embedUrl = `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}autoplay=1&mute=${modalMuted ? '1' : '0'}&playsinline=1`;
      return (
        <div className="relative w-[80vw] max-w-5xl aspect-video">
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 rounded-xl">
              <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-800 rounded-full animate-spin" />
            </div>
          )}
          <iframe
            src={embedUrl}
            allow="autoplay; fullscreen; picture-in-picture"
            className={`w-full h-full rounded-xl border-0 ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500`}
            onLoad={() => setLoaded(true)}
          />
          <button
            className="absolute bottom-4 right-4 px-3 py-1.5 rounded-full bg-black/60 text-white text-xs shadow"
            onClick={() => setModalMuted((prev) => !prev)}
          >
            {modalMuted ? 'Enable sound' : 'Mute'}
          </button>
        </div>
      );
    }

    return (
      <img
        src={hasError ? (artwork.fallbackPreview || previewUrl) : fullUrl}
        alt="Artwork"
        className={`
          max-w-full max-h-[85vh] object-contain rounded-xl select-none
          transition-opacity duration-500
          ${loaded ? 'opacity-100' : 'opacity-0'}
        `}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (!hasError) setHasError(true);
        }}
      />
    );
  }, [artwork.kind, artwork.fallbackPreview, fullUrl, hasError, loaded, modalMuted, previewUrl]);

  return (
    <div
      className={`
        fixed inset-0 z-50 flex items-center justify-center
        transition-all duration-500 ease-out
        ${visible ? 'bg-black/70 backdrop-blur-sm' : 'bg-transparent backdrop-blur-none pointer-events-none'}
      `}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className={`
          absolute top-8 right-8 w-12 h-12 flex items-center justify-center rounded-full bg-white shadow-lg text-gray-800 hover:scale-105 transition-all duration-300 z-50 border border-gray-100
          ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}
        `}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div
        className={`
          relative p-2 bg-white rounded-2xl shadow-2xl overflow-hidden
          transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1)
          ${visible ? 'scale-100 opacity-100 translate-y-0' : 'scale-90 opacity-0 translate-y-12'}
        `}
        style={{ maxWidth: '92vw', maxHeight: '92vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {!loaded && !hasError && artwork.kind !== 'embed' && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-gray-50/50">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-800 rounded-full animate-spin" />
          </div>
        )}
        {renderContent}
      </div>
    </div>
  );
};

export default Overlay;
