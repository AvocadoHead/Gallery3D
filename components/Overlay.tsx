import React, { useEffect, useState, useMemo } from 'react';
import { MediaItem } from '../constants';

interface OverlayProps {
  artwork: MediaItem | null;
  onClose: () => void;
}

const Overlay: React.FC<OverlayProps> = ({ artwork, onClose }) => {
  const [visible, setVisible] = useState(false);
  // This state tracks if a Google Drive link turned out to be a video
  const [isDriveVideo, setIsDriveVideo] = useState(false);

  useEffect(() => {
    if (artwork) {
      // Reset video detection state when opening a new item
      setIsDriveVideo(false);
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [artwork]);

  const config = useMemo(() => {
    if (!artwork) return null;
    const url = artwork.fullUrl;

    // 1. YouTube (Always Iframe)
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = url.split('v=')[1] || url.split('/').pop();
      const cleanId = videoId?.split('&')[0].split('?')[0];
      return { type: 'iframe', src: `https://www.youtube.com/embed/${cleanId}?autoplay=1&rel=0`, ratio: 'aspect-video' };
    }
    
    // 2. Vimeo (Always Iframe)
    if (url.includes('vimeo.com')) {
      const match = url.match(/vimeo\.com\/(?:.*\/)?(\d+)/);
      const videoId = match ? match[1] : null;
      if (videoId) {
        return { type: 'iframe', src: `https://player.vimeo.com/video/${videoId}?autoplay=1&title=0&byline=0&portrait=0`, ratio: 'aspect-video' };
      }
    }

    // 3. Google Drive (The Smart Check)
    if (url.includes('drive.google.com')) {
      const parts = url.split('/d/');
      if (parts.length > 1) {
        const idPart = parts[1].split('/')[0];
        
        // If we previously detected this failed as an image, render the Video Player Iframe
        if (isDriveVideo) {
           return { 
             type: 'iframe', 
             src: `https://drive.google.com/file/d/${idPart}/preview`,
             ratio: 'flexible' // Allow player to size itself roughly
           };
        }

        // Otherwise, TRY to render as a Direct Image first (Native Ratio)
        return { 
          type: 'drive-image-try', 
          src: `https://drive.google.com/uc?export=view&id=${idPart}`
        };
      }
    }

    // 4. Direct Video (Native Player)
    if (artwork.kind === 'video' || url.match(/\.(mp4|webm|mov|ogg)$/i)) {
      return { type: 'video', src: artwork.videoUrl || url };
    }

    // 5. Standard Image
    return { type: 'image', src: url };
  }, [artwork, isDriveVideo]);

  if (!artwork || !config) return null;

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
            className="pointer-events-auto flex items-center justify-center p-4"
            style={{ width: '100%', height: '100%', maxWidth: '100vw', maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
        >
            {config.type === 'iframe' ? (
              /* 
                 IFRAME (Videos)
                 YouTube/Vimeo get aspect-video (16:9).
                 Drive Videos get a flexible box to minimize black bars.
              */
              <div 
                className={`bg-black shadow-2xl rounded-lg overflow-hidden ${config.ratio === 'aspect-video' ? 'w-full max-w-5xl aspect-video' : 'w-[90vw] h-[80vh] max-w-6xl'}`}
              >
                <iframe
                  src={config.src}
                  title={artwork.title || "Content"}
                  className="w-full h-full border-0"
                  allow="autoplay; encrypted-media; fullscreen"
                  allowFullScreen
                />
              </div>
            ) : config.type === 'video' ? (
              /* DIRECT VIDEO (MP4) */
              <video
                src={config.src}
                controls
                autoPlay
                playsInline
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
            ) : (
              /* 
                 IMAGE (Standard OR Google Drive Try)
                 Renders completely naked. 
                 If it's a Drive link and fails (onError), we flip the state to render Iframe instead.
              */
              <img
                src={config.src}
                alt={artwork.title || "Artwork"}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                onError={() => {
                    // If this was a "drive-image-try" type, it failed because it's a video.
                    // Switch to iframe mode.
                    if (config.type === 'drive-image-try') {
                        setIsDriveVideo(true);
                    }
                }}
              />
            )}
        </div>

        {/* Footer Title */}
        {(artwork.title || artwork.description) && (
          <div className="absolute bottom-8 pointer-events-auto px-6 py-3 bg-black/60 backdrop-blur-md rounded-full text-white text-center max-w-xl animate-in slide-in-from-bottom-4 duration-700 border border-white/10">
             {artwork.title && <h2 className="text-sm font-bold">{artwork.title}</h2>}
             {artwork.description && <p className="text-xs text-slate-300 mt-0.5">{artwork.description}</p>}
          </div>
        )}

      </div>
    </div>
  );
};

export default Overlay;
