import React, { useEffect, useState, useMemo } from 'react';
import { MediaItem } from '../constants';

// FIX: Read from Environment Variable
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

interface OverlayProps {
  artwork: MediaItem | null;
  onClose: () => void;
}

// Helper to reliably extract Drive File ID
const extractDriveId = (url: string): string | null => {
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
  const [driveMode, setDriveMode] = useState<'loading' | 'image' | 'iframe'>('loading');

  useEffect(() => {
    if (artwork) {
      requestAnimationFrame(() => setVisible(true));
      setDriveMode('loading');

      // --- GOOGLE DRIVE DETECTION ---
      if (artwork.provider === 'gdrive' && artwork.embedUrl) {
        const id = extractDriveId(artwork.embedUrl);
        
        if (id) {
          // If Key exists, ask API. If not, fallback to player immediately.
          if (!GOOGLE_API_KEY) {
             console.warn('Google API Key missing. Defaulting Drive links to Video Player.');
             setDriveMode('iframe');
             return;
          }

          fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=mimeType&key=${GOOGLE_API_KEY}`)
            .then(async (res) => {
                if (!res.ok) throw new Error('API Request Failed'); 
                return res.json();
            })
            .then((data) => {
              if (data.mimeType && data.mimeType.startsWith('image/')) {
                setDriveMode('image');
              } else {
                setDriveMode('iframe'); 
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
        setDriveMode('image'); 
      }
    } else {
      setVisible(false);
    }
  }, [artwork]);

  // --- SMART URL DETECTION ---
  const embedConfig = useMemo(() => {
    if (!artwork) return null;
    const url = artwork.fullUrl;

    // Priority: Check provider field first for Google Drive
    if (artwork.provider === 'gdrive' && artwork.embedUrl) {
      return {
        type: 'iframe',
        src: artwork.embedUrl
      };
    }

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
      const match = url.match(/vimeo\.com\/(?:.*\/)?(\d+)/);
      const videoId = match ? match[1] : null;
      if (videoId) {
        return { 
          type: 'iframe', 
          src: `https://player.vimeo.com/video/${videoId}?autoplay=1&title=0&byline=0&portrait=0` 
        };
      }
    }

    // 3. Direct Video Files
    if (artwork.kind === 'video' || url.match(/\.(mp4|webm|mov|ogg)$/i)) {
      return { type: 'video', src: artwork.videoUrl || url };
    }

    // 4. Default to Image
    return { type: 'image', src: url };
  }, [artwork]);

  if (!artwork || !embedConfig) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      
      {/* LAYER 1: BACKDROP */}
      <div 
        className={`
          absolute inset-0 bg-black/10 backdrop-blur-xl transition-opacity duration-300 ease-out
          ${visible ? 'opacity-100' : 'opacity-0'}
        `}
        onClick={onClose}
      />

      {/* LAYER 2: CONTENT */}
      <div 
        className={`
          relative z-10 w-full h-full p-2 md:p-8 flex flex-col items-center justify-center pointer-events-none
          transition-transform duration-500 cubic-bezier(0.175, 0.885, 0.32, 1.275)
          ${visible ? 'scale-100' : 'scale-90'}
        `}
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 pointer-events-auto p-3 rounded-full bg-white text-slate-900 shadow-xl hover:scale-110 transition-transform z-50"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Media Container */}
        <div 
          className="relative pointer-events-auto shadow-2xl rounded-xl overflow-hidden"
          style={{ 
            maxWidth: '100%', 
            maxHeight: '85vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          
          {embedConfig.type === 'iframe' ? (
            /* IFRAME (Google Drive, YT, Vimeo) */
            <div className="w-[90vw] h-[50vw] max-w-[1200px] max-h-[80vh] md:w-[80vw] md:h-[45vw] bg-black">
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
              className="max-w-full max-h-[85vh] w-auto h-auto object-contain bg-black"
            />
          ) : (
            /* IMAGE */
            <img
              src={embedConfig.src}
              alt={artwork.title || "Artwork"}
              className="max-w-full max-h-[85vh] w-auto h-auto object-contain"
            />
          )}
        </div>

        {/* Title / Description Bar */}
        {(artwork.title || artwork.description) && (
          <div className="mt-4 px-6 py-3 bg-black/60 backdrop-blur-md rounded-full text-white text-center max-w-xl animate-in slide-in-from-bottom-4 duration-700 pointer-events-auto">
            {artwork.title && <h2 className="text-sm font-bold">{artwork.title}</h2>}
            {artwork.description && <p className="text-xs text-slate-300 mt-0.5">{artwork.description}</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default Overlay;
