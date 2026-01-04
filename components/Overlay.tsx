import React, { useEffect, useState, useMemo } from 'react';
import { MediaItem } from '../constants';

interface OverlayProps {
  artwork: MediaItem | null;
  onClose: () => void;
}

const Overlay: React.FC<OverlayProps> = ({ artwork, onClose }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (artwork) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [artwork]);

  // Helper to convert standard URLs to Embed URLs for the Overlay
  const embedSrc = useMemo(() => {
    if (!artwork) return '';
    const url = artwork.fullUrl;

    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = url.split('v=')[1] || url.split('/').pop();
      // Remove any timestamp/playlist params for clean ID
      const cleanId = videoId?.split('&')[0].split('?')[0];
      return `https://www.youtube.com/embed/${cleanId}?autoplay=1&rel=0`;
    }
    
    if (url.includes('vimeo.com')) {
      const videoId = url.split('.com/')[1]?.split('/')[0];
      return `https://player.vimeo.com/video/${videoId}?autoplay=1&title=0&byline=0&portrait=0`;
    }

    return url;
  }, [artwork]);

  if (!artwork) return null;

  return (
    <div
      className={`
        fixed inset-0 z-[200] flex items-center justify-center 
        /* Tweak: Lighter blur and less dark background */
        bg-slate-900/40 backdrop-blur-sm
        transition-opacity duration-500 ease-out
        ${visible ? 'opacity-100' : 'opacity-0'}
      `}
      onClick={onClose}
    >
      {/* Close Button */}
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 z-[210] p-3 rounded-full bg-black/20 hover:bg-black/40 text-white transition backdrop-blur-md"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* 
         Layout Container 
         - Removed the bg-white box.
         - Flex layout centers the content.
         - 'p-4' ensures it doesn't touch the screen edges on mobile.
      */}
      <div 
        className={`
           w-full h-full p-4 md:p-10 flex flex-col items-center justify-center
           transition-transform duration-500 cubic-bezier(0.175, 0.885, 0.32, 1.275)
           ${visible ? 'scale-100' : 'scale-95'}
        `}
        onClick={(e) => e.stopPropagation()} 
      >
        
        {/* === CASE 1: YOUTUBE / VIMEO === */}
        {artwork.kind === 'embed' ? (
          <div className="relative w-full max-w-5xl aspect-video shadow-2xl rounded-xl overflow-hidden bg-black">
            <iframe
              src={embedSrc}
              title={artwork.title || "Video"}
              className="w-full h-full"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : 
        
        /* === CASE 2: DIRECT VIDEO (MP4) === */
        artwork.kind === 'video' ? (
          // max-h-[85vh] ensures portrait videos don't get cut off verticaly
          <video
            src={artwork.videoUrl || artwork.fullUrl}
            controls
            autoPlay
            playsInline
            className="max-w-full max-h-[85vh] w-auto h-auto object-contain rounded-lg shadow-2xl drop-shadow-2xl"
          />
        ) : 
        
        /* === CASE 3: IMAGE === */
        (
          <img
            src={artwork.fullUrl}
            alt={artwork.title || "Artwork"}
            className="max-w-full max-h-[85vh] w-auto h-auto object-contain rounded-lg shadow-2xl drop-shadow-2xl"
          />
        )}

        {/* Optional Title Overlay (At bottom) */}
        {(artwork.title || artwork.description) && (
          <div className="mt-4 px-6 py-3 bg-black/60 backdrop-blur-md rounded-full text-white text-center max-w-xl animate-in slide-in-from-bottom-4 duration-700">
             {artwork.title && <h2 className="text-sm font-bold">{artwork.title}</h2>}
             {artwork.description && <p className="text-xs text-slate-300 mt-0.5">{artwork.description}</p>}
          </div>
        )}

      </div>
    </div>
  );
};

export default Overlay;
