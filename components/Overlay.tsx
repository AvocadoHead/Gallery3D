import React, { useEffect, useState, useMemo } from 'react';
import { MediaItem } from '../constants';

// Read from Environment Variable
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

interface OverlayProps {
  artwork: MediaItem | null;
  onClose: () => void;
}

// Helper to reliably extract Drive File ID
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

const Overlay: React.FC<OverlayProps> = ({ artwork, onClose }) => {
  const [visible, setVisible] = useState(false);
  
  // 'loading' | 'image' | 'iframe'
  const [driveMode, setDriveMode] = useState<'loading' | 'image' | 'iframe'>('loading');

  useEffect(() => {
    if (artwork) {
      requestAnimationFrame(() => setVisible(true));
      setDriveMode('loading');

      // --- GOOGLE DRIVE DETECTION & API CHECK ---
      const isDrive = artwork.fullUrl.includes('drive.google.com') || (artwork as any).provider === 'gdrive';
      
      if (isDrive) {
        const id = extractDriveId(artwork.fullUrl) || extractDriveId((artwork as any).embedUrl);
        
        if (id) {
          if (!GOOGLE_API_KEY) {
             console.warn('Google API Key missing. Defaulting to Player.');
             setDriveMode('iframe');
             return;
          }

          // Ask Google API for MimeType
          fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=mimeType&key=${GOOGLE_API_KEY}`)
            .then(async (res) => {
                if (!res.ok) throw new Error('API Request Failed'); 
                return res.json();
            })
            .then((data) => {
              if (data.mimeType && data.mimeType.startsWith('image/')) {
                setDriveMode('image'); // CONFIRMED IMAGE
              } else {
                setDriveMode('iframe'); // VIDEO / OTHER
              }
            })
            .catch((err) => {
              console.warn('Drive API check failed, defaulting to Player:', err);
              setDriveMode('iframe');
            });
        } else {
          setDriveMode('iframe');
        }
      } else {
        setDriveMode('image'); // Not drive, assume standard image logic
      }
    } else {
      setVisible(false);
    }
  }, [artwork]);

  // --- CONFIGURATION ---
  const config = useMemo(() => {
    if (!artwork) return null;
    const url = artwork.fullUrl;

    // 1. YouTube
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = url.split('v=')[1] || url.split('/').pop();
      const cleanId = videoId?.split('&')[0].split('?')[0];
      return { type: 'iframe', src: `https://www.youtube.com/embed/${cleanId}?autoplay=1&rel=0`, ratio: 'fixed' };
    }
    
    // 2. Vimeo
    if (url.includes('vimeo.com')) {
      const match = url.match(/vimeo\.com\/(?:.*\/)?(\d+)/);
      const videoId = match ? match[1] : null;
      if (videoId) {
        return { type: 'iframe', src: `https://player.vimeo.com/video/${videoId}?autoplay=1&title=0&byline=0&portrait=0`, ratio: 'fixed' };
      }
    }

    // 3. Google Drive
    const isDrive = url.includes('drive.google.com') || (artwork as any).provider === 'gdrive';
    
    if (isDrive) {
      const id = extractDriveId(url) || extractDriveId((artwork as any).embedUrl);
      
      if (id) {
        if (driveMode === 'loading') return { type: 'loading' };

        if (driveMode === 'image') {
           return { 
             type: 'image', 
             src: `https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${GOOGLE_API_KEY}` 
           };
        }

        return { 
          type: 'iframe', 
          src: `https://drive.google.com/file/d/${id}/preview`,
          ratio: 'flexible'
        };
      }
    }

    // 4. Direct Video Files
    if (artwork.kind === 'video' || url.match(/\.(mp4|webm|mov|ogg)$/i)) {
      return { type: 'video', src: artwork.videoUrl || url };
    }

    // 5. Standard Image
    return { type: 'image', src: url };
  }, [artwork, driveMode]);

  if (!artwork || !config) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      
      {/* 
         LAYER 1: BACKDROP 
         Changed 'backdrop-blur-xl' (Heavy) to 'backdrop-blur-sm' (Subtle) 
      */}
      <div 
        className={`
          absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-300 ease-out
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
          className="absolute top-4 right-4 pointer-events-auto p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition z-50 backdrop-blur-md shadow-lg"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* CONTAINER */}
        <div 
            className="pointer-events-auto flex items-center justify-center"
            style={{ maxWidth: '95vw', maxHeight: '85vh' }}
            onClick={(e) => e.stopPropagation()}
        >
            {config.type === 'loading' ? (
               <div className="flex flex-col items-center justify-center text-white/80">
                  <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin mb-2" />
               </div>
            ) : config.type === 'iframe' ? (
              <div 
                className={`bg-black shadow-2xl rounded-lg overflow-hidden ${config.ratio === 'fixed' ? 'w-full max-w-5xl aspect-video' : 'w-[90vw] h-[80vh] max-w-6xl'}`}
              >
                <iframe
                  src={config.src}
                  title="Content"
                  className="w-full h-full border-0"
                  allow="autoplay; encrypted-media; fullscreen"
                  allowFullScreen
                />
              </div>
            ) : config.type === 'video' ? (
              <video
                src={config.src}
                controls
                autoPlay
                playsInline
                className="max-w-full max-h-[85vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
              />
            ) : (
              <img
                src={config.src}
                alt={artwork.title || "Artwork"}
                className="max-w-full max-h-[85vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
                onError={() => {
                    setDriveMode('iframe');
                }}
              />
            )}
        </div>

        {/* INFO BAR */}
        {(artwork.title || artwork.description) && (
          <div className="mt-4 pointer-events-auto px-6 py-3 bg-black/60 backdrop-blur-md rounded-full text-white text-center max-w-xl animate-in slide-in-from-bottom-4 duration-700 border border-white/10 shadow-lg">
             {artwork.title && <h2 className="text-sm font-bold">{artwork.title}</h2>}
             {artwork.description && <p className="text-xs text-slate-300 mt-0.5">{artwork.description}</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default Overlay;
