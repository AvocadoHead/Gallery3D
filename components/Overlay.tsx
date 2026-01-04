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
  const embedConfig = useMemo(() => {
    if (!artwork) return null;
    const url = artwork.fullUrl;

    // 1. YouTube (Always iframe)
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = url.split('v=')[1] || url.split('/').pop();
      const cleanId = videoId?.split('&')[0].split('?')[0];
      return { 
        type: 'iframe', 
        src: `https://www.youtube.com/embed/${cleanId}?autoplay=1&rel=0` 
      };
    }
    
    // 2. Vimeo (Always iframe)
    if (url.includes('vimeo.com')) {
      const match = url.match(/vimeo\.com\/(?:.*\/)?(\d+)/);
      const videoId = match ? match[1] : null;
      if (videoId) {
        return { 
          type: 'iframe', 
          src: `https://player.vimeo.com/video/${videoId}?autoplay=1&title=0&byline=0&portrait=0` 
        };
      }
    }

    // 3. Google Drive Handling
    if (url.includes('drive.google.com')) {
      const parts = url.split('/d/');
      if (parts.length > 1) {
        const idPart = parts[1].split('/')[0];

        // CRITICAL FIX: 
        // If it's an IMAGE, use the direct download link so it renders naturally (no iframe black bars).
        // We assume 'image' kind if explicit, OR if not 'video'/'embed'.
        if (artwork.kind === 'image') {
           return {
             type: 'image',
             src: `https://drive.google.com/uc?export=view&id=${idPart}`
           };
        }

        // If it's a VIDEO, use the preview iframe player
        return { 
          type: 'iframe', 
          src: `https://drive.google.com/file/d/${idPart}/preview` 
        };
      }
    }

    // 4. Direct Video Files
    if (artwork.kind === 'video' || url.match(/\.(mp4|webm|mov|ogg)$/i)) {
      return { type: 'video', src: artwork.videoUrl || url };
    }

    // 5. Default Fallback (Image)
    return { type: 'image', src: url };
  }, [artwork]);

  if (!artwork || !embedConfig) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      
      {/* LAYER 1: BACKDROP */}
      <div 
        className={`
          absolute inset-0 bg-black/30 backdrop-blur-xl transition-opacity duration-300 ease-out
          ${visible ? 'opacity-100' : 'opacity-0'}
        `}
        onClick={onClose}
      />

      {/* LAYER 2: CONTENT */}
      <div 
        className={`
           relative z-10 w-full h-full flex flex-col items-center justify-center pointer-events-none
           transition-transform duration-500 cubic-bezier(0.175, 0.885, 0.32, 1.275)
           ${visible ? 'scale-100' : 'scale-90'}
        `}
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 pointer-events-auto p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition z-50 backdrop-blur-md"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* MEDIA CONTAINER */}
        <div 
            className="pointer-events-auto flex items-center justify-center"
            style={{ maxWidth: '95vw', maxHeight: '85vh' }}
            onClick={(e) => e.stopPropagation()}
        >
            {embedConfig.type === 'iframe' ? (
              /* 
                 IFRAMES (Video Embeds)
                 These still need a box to live in, but we removed the 'bg-black' 
                 so it blends better if dimensions mismatch.
              */
              <div 
                className="shadow-2xl rounded-lg overflow-hidden"
                style={{ width: '85vw', height: '48vw', maxWidth: '1200px', maxHeight: '80vh' }}
              >
                <iframe
                  src={embedConfig.src}
                  title={artwork.title || "Content"}
                  className="w-full h-full border-0"
                  allow="autoplay; encrypted-media; fullscreen"
                  allowFullScreen
                />
              </div>
            ) : embedConfig.type === 'video' ? (
              /* DIRECT VIDEO (MP4) */
              <video
                src={embedConfig.src}
                controls
                autoPlay
                playsInline
                className="max-w-full max-h-[85vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
              />
            ) : (
              /* 
                 IMAGE (Now includes Google Drive Images!)
                 Renders "naked" with native aspect ratio.
              */
              <img
                src={embedConfig.src}
                alt={artwork.title || "Artwork"}
                className="max-w-full max-h-[85vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
              />
            )}
        </div>

        {/* Bottom Title Bar */}
        {(artwork.title || artwork.description) && (
          <div className="mt-4 pointer-events-auto px-6 py-3 bg-black/60 backdrop-blur-md rounded-full text-white text-center max-w-xl animate-in slide-in-from-bottom-4 duration-700 border border-white/10">
             {artwork.title && <h2 className="text-sm font-bold">{artwork.title}</h2>}
             {artwork.description && <p className="text-xs text-slate-300 mt-0.5">{artwork.description}</p>}
          </div>
        )}

      </div>
    </div>
  );
};

export default Overlay;
