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
      // Small delay to allow CSS transition to render
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
  const url = artwork.url; // FIXED: Was artwork.fullUrl

  // Helper to detect if it's a social embed (YouTube/Vimeo) vs direct file
  const isEmbed = useMemo(() => {
    return (
      url.includes('youtube') ||
      url.includes('youtu.be') ||
      url.includes('vimeo')
    );
  }, [url]);

  const renderContent = useMemo(() => {
    // 1. VIDEO (Direct File like .mp4)
    if (artwork.type === 'video' && !isEmbed && !hasError) {
      return (
        <div className="relative">
          <video
            src={url}
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
            className="absolute bottom-4 right-4 px-3 py-1.5 rounded-full bg-black/60 text-white text-xs shadow hover:bg-black/80 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setModalMuted((prev) => !prev);
            }}
          >
            {modalMuted ? 'Enable sound' : 'Mute'}
          </button>
        </div>
      );
    }

    // 2. VIDEO (Embed - YouTube/Vimeo)
    if (artwork.type === 'video' && isEmbed) {
      let embedUrl = url;
      
      // Convert YouTube standard link to Embed link
      if (url.includes('youtube') || url.includes('youtu.be')) {
         const videoId = url.split('v=')[1]?.split('&')[0] || url.split('/').pop();
         embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=${modalMuted ? '1' : '0'}&playsinline=1`;
      }
      // Simple logic for Vimeo (requires player.vimeo.com normally, but assuming raw link for now)
      // If you are pasting raw vimeo links, you might need a regex to convert to player.vimeo.com/video/ID

      return (
        <div className="relative w-[80vw] max-w-5xl aspect-video bg-black rounded-xl overflow-hidden">
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
        </div>
      );
    }

    // 3. IMAGE (Fallback or Standard)
    return (
      <img
        src={hasError ? previewUrl : url} // Fallback to preview if full load fails
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
  }, [artwork.type, isEmbed, hasError, url, loaded, modalMuted, previewUrl]);

  return (
    <div
      className={`
        fixed inset-0 z-50 flex items-center justify-center
        transition-all duration-500 ease-out
        ${visible ? 'bg-black/70 backdrop-blur-sm' : 'bg-transparent backdrop-blur-none pointer-events-none'}
      `}
      onClick={onClose}
    >
      {/* Close Button */}
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

      {/* Content Container */}
      <div
        className={`
          relative p-2 bg-white rounded-2xl shadow-2xl overflow-hidden
          transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1)
          ${visible ? 'scale-100 opacity-100 translate-y-0' : 'scale-90 opacity-0 translate-y-12'}
        `}
        style={{ maxWidth: '92vw', maxHeight: '92vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Loading Spinner for non-embeds */}
        {!loaded && !hasError && !isEmbed && (
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
