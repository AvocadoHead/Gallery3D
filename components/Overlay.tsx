import React, { useEffect, useMemo, useState } from 'react';
import { MediaItem } from '../constants';

interface OverlayProps {
  artwork: MediaItem | null;
  onClose: () => void;
}

const Overlay: React.FC<OverlayProps> = ({ artwork, onClose }) => {
  const [loaded, setLoaded] = useState(false);
  const [visible, setVisible] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [modalMuted, setModalMuted] = useState(false); // ✅ clicked video should have sound

  useEffect(() => {
    if (artwork) {
      setLoaded(false);
      setHasError(false);
      setModalMuted(false);
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

  const url = artwork.url;

  const isEmbed = useMemo(() => {
    const u = url.toLowerCase();
    return u.includes('youtube') || u.includes('youtu.be') || u.includes('vimeo');
  }, [url]);

  const content = useMemo(() => {
    // VIDEO: direct file (.mp4 etc.)
    if (artwork.type === 'video' && !isEmbed && !hasError) {
      return (
        <div className="relative">
          <video
            src={url}
            className={`max-w-full max-h-[85vh] object-contain rounded-xl select-none transition-opacity duration-500 ${
              loaded ? 'opacity-100' : 'opacity-0'
            }`}
            autoPlay
            playsInline
            controls
            muted={modalMuted}
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

    // VIDEO: embed (YouTube)
    if (artwork.type === 'video' && isEmbed) {
      let embedUrl = url;

      if (url.includes('youtube') || url.includes('youtu.be')) {
        const id =
          url.split('v=')[1]?.split('&')[0] ??
          url.replace('https://youtu.be/', '').split('?')[0];
        embedUrl = `https://www.youtube.com/embed/${id}?autoplay=1&mute=${
          modalMuted ? '1' : '0'
        }&playsinline=1`;
      }

      // Vimeo: best-effort (if you pass a vimeo player url, it will work)
      if (url.includes('vimeo.com') && !url.includes('player.vimeo.com')) {
        const vid = url.split('/').pop();
        if (vid) {
          embedUrl = `https://player.vimeo.com/video/${vid}?autoplay=1&muted=${
            modalMuted ? '1' : '0'
          }`;
        }
      }

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
            className={`w-full h-full rounded-xl border-0 ${
              loaded ? 'opacity-100' : 'opacity-0'
            } transition-opacity duration-500`}
            onLoad={() => setLoaded(true)}
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

    // IMAGE
    return (
      <img
        src={hasError ? artwork.previewUrl : url}
        alt="Artwork"
        className={`max-w-full max-h-[85vh] object-contain rounded-xl select-none transition-opacity duration-500 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (!hasError) setHasError(true);
        }}
      />
    );
  }, [artwork.type, isEmbed, hasError, url, loaded, modalMuted, artwork.previewUrl]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-500 ease-out ${
        visible
          ? 'bg-black/70 backdrop-blur-sm'
          : 'bg-transparent backdrop-blur-none pointer-events-none'
      }`}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className={`absolute top-8 right-8 w-12 h-12 flex items-center justify-center rounded-full bg-white shadow-lg text-gray-800 hover:scale-105 transition-all duration-300 z-50 border border-gray-100 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
        }`}
      >
        ✕
      </button>

      <div
        className={`relative p-2 bg-white rounded-2xl shadow-2xl overflow-hidden transition-all duration-500 ${
          visible ? 'scale-100 opacity-100 translate-y-0' : 'scale-90 opacity-0 translate-y-12'
        }`}
        style={{ maxWidth: '92vw', maxHeight: '92vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {!loaded && !hasError && !isEmbed && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-gray-50/50">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-800 rounded-full animate-spin" />
          </div>
        )}
        {content}
      </div>
    </div>
  );
};

export default Overlay;
