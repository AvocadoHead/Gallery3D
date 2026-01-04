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

  // --- SMART URL DETECTION ---
  // Transforms links into embeddable formats (YouTube, Vimeo, Google Drive)
  const embedConfig = useMemo(() => {
    if (!artwork) return null;
    const url = artwork.fullUrl;

    // 1. YouTube
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = url.split('v=')[1] || url.split('/').pop();
      const cleanId = videoId?.split('&')[0].split('?')[0];
      return { 
        type: 'iframe', 
        src: `https://www.youtube.com/embed/${cleanId}?autoplay=1&rel=0` 
      };
    }
    
    // 2. Vimeo
    if (url.includes('vimeo.com')) {
      const videoId = url.split('.com/')[1]?.split('/')[0];
      return { 
        type: 'iframe', 
        src: `https://player.vimeo.com/video/${videoId}?autoplay=1&title=0&byline=0&portrait=0` 
      };
    }

    // 3. Google Drive (The Fix for your issue)
    // Converts /view or /sharing links to /preview for embedding
    if (url.includes('drive.google.com')) {
      // Extract ID usually between /d/ and /view
      const parts = url.split('/d/');
      if (parts.length > 1) {
        const idPart = parts[1].split('/')[0];
        return { 
          type: 'iframe', 
          src: `https://drive.google.com/file/d/${idPart}/preview` 
        };
      }
    }

    // 4. Direct Video Files (mp4, webm, mov)
    // Sometimes 'kind' isn't set correctly, so we check extension too
    if (artwork.kind === 'video' || url.match(/\.(mp4|webm|mov|ogg)$/i)) {
      return { type: 'video', src: artwork.videoUrl || url };
    }

    // 5. Default to Image
    return { type: 'image', src: url };
  }, [artwork]);

  if (!artwork || !embedConfig) return null;

  return (
    <div
      className={`
        fixed inset-0 z-[200] flex items-center justify-center 
        bg-slate-900/80 backdrop-blur-md
        transition-opacity duration-300 ease-out
        ${visible ? 'opacity-100' : 'opacity-0'}
      `}
      onClick={onClose}
    >
      {/* 
         Close Button - Fixed Design 
         Removed backdrop-blur on the button itself to prevent "smudge" look.
         Now distinct solid white with high contrast.
      */}
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 z-[210] p-3 rounded-full bg-white text-slate-900 shadow-xl hover:scale-110 transition-transform"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Content Wrapper */}
      <div 
        className={`
           w-full h-full p-2 md:p-10 flex flex-col items-center justify-center
           transition-transform duration-500 cubic-bezier(0.175, 0.885, 0.32, 1.275)
           ${visible ? 'scale-100' : 'scale-90'}
        `}
        onClick={(e) => e.stopPropagation()} 
      >
        
        {/* === RENDER LOGIC === */}
        
        {embedConfig.type === 'iframe' ? (
          /* 
             IFRAME (Google Drive, YT, Vimeo)
             - Removed 'aspect-video' so it doesn't crush portrait videos.
             - Uses w-full h-full but constrained by max-w/max-h to keep it floating nicely.
          */
          <div className="relative w-full h-full max-w-5xl max-h-[85vh] shadow-2xl rounded-lg overflow-hidden bg-black">
            <iframe
              src={embedConfig.src}
              title={artwork.title || "Content"}
              className="w-full h-full border-0"
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
            />
          </div>
        ) : embedConfig.type === 'video' ? (
          /* DIRECT VIDEO */
          <video
            src={embedConfig.src}
            controls
            autoPlay
            playsInline
            className="max-w-full max-h-[85vh] w-auto h-auto object-contain rounded shadow-2xl bg-black"
          />
        ) : (
          /* IMAGE */
          <img
            src={embedConfig.src}
            alt={artwork.title || "Artwork"}
            className="max-w-full max-h-[85vh] w-auto h-auto object-contain rounded shadow-2xl"
          />
        )}

        {/* Title / Description Bar */}
        {(artwork.title || artwork.description) && (
          <div className="mt-4 px-6 py-3 bg-black/70 backdrop-blur-md rounded-full text-white text-center max-w-xl animate-in slide-in-from-bottom-4 duration-700 border border-white/10">
             {artwork.title && <h2 className="text-sm font-bold">{artwork.title}</h2>}
             {artwork.description && <p className="text-xs text-slate-300 mt-0.5">{artwork.description}</p>}
          </div>
        )}

      </div>
    </div>
  );
};

export default Overlay;
