import React, { useEffect, useState, useMemo } from 'react';
import { MediaItem } from '../constants';

// Your Google Drive API Key
const GOOGLE_API_KEY = 'AIzaSyAj12fDKnD9GMA9b369DyuAvZuLXeS_orI'; 

interface OverlayProps {
  artwork: MediaItem | null;
  onClose: () => void;
}

// Helper to reliably extract Drive File ID
const extractDriveId = (url: string): string | null => {
  // Pattern 1: /file/d/ID/
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  
  // Pattern 2: id=ID
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  
  // Pattern 3: /d/ID (catch-all)
  const m3 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m3) return m3[1];
  
  return null;
};

const Overlay: React.FC<OverlayProps> = ({ artwork, onClose }) => {
  const [visible, setVisible] = useState(false);
  
  // State for the Drive Check
  // 'loading' = asking Google API
  // 'image'   = Google confirmed it is an image
  // 'iframe'  = Google confirmed it is a video (or API failed)
  const [driveMode, setDriveMode] = useState<'loading' | 'image' | 'iframe'>('loading');

  useEffect(() => {
    if (artwork) {
      requestAnimationFrame(() => setVisible(true));
      setDriveMode('loading');

      // --- GOOGLE DRIVE DETECTION ---
      if (artwork.fullUrl.includes('drive.google.com')) {
        const id = extractDriveId(artwork.fullUrl);
        
        if (id && GOOGLE_API_KEY) {
          // 1. Ask Google Drive API for the mimeType
          fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=mimeType&key=${GOOGLE_API_KEY}`)
            .then((res) => res.json())
            .then((data) => {
              if (data.error) {
                console.warn('Drive API Error:', data.error);
                setDriveMode('iframe'); // Fallback to player
              } else if (data.mimeType && data.mimeType.startsWith('image/')) {
                setDriveMode('image');
              } else {
                setDriveMode('iframe'); // It's a video, audio, or PDF
              }
            })
            .catch(() => {
              setDriveMode('iframe'); // Network fail -> Fallback to player
            });
        } else {
          // No ID found or Key missing -> Fallback
          setDriveMode('iframe');
        }
      } else {
        // Not a Drive link -> Standard image/video logic applies
        setDriveMode('image'); 
      }

    } else {
      setVisible(false);
    }
  }, [artwork]);

  // --- CONFIGURATION ---
  const config = useMemo(() => {
    if (!artwork) return null;
    const url = artwork.fullUrl;

    // 1. YouTube (Always Iframe)
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = url.split('v=')[1] || url.split('/').pop();
      const cleanId = videoId?.split('&')[0].split('?')[0];
      return { type: 'iframe', src: `https://www.youtube.com/embed/${cleanId}?autoplay=1&rel=0`, ratio: 'fixed' };
    }
    
    // 2. Vimeo (Always Iframe)
    if (url.includes('vimeo.com')) {
      const match = url.match(/vimeo\.com\/(?:.*\/)?(\d+)/);
      const videoId = match ? match[1] : null;
      if (videoId) {
        return { type: 'iframe', src: `https://player.vimeo.com/video/${videoId}?autoplay=1&title=0&byline=0&portrait=0`, ratio: 'fixed' };
      }
    }

    // 3. Google Drive (Dependent on API Result)
    if (url.includes('drive.google.com')) {
      const id = extractDriveId(url);
      if (id) {
        // Still checking API...
        if (driveMode === 'loading') return { type: 'loading' };

        // API said: "It's an Image" -> Render Native Image
        if (driveMode === 'image') {
           return { 
             type: 'image', 
             src: `https://drive.google.com/uc?export=view&id=${id}` 
           };
        }

        // API said: "It's a Video" -> Render Player
        return { 
          type: 'iframe', 
          src: `https://drive.google.com/file/d/${id}/preview`,
          ratio: 'flexible'
        };
      }
    }

    // 4. Direct Video Files (MP4)
    if (artwork.kind === 'video' || url.match(/\.(mp4|webm|mov|ogg)$/i)) {
      return { type: 'video', src: artwork.videoUrl || url };
    }

    // 5. Standard Image
    return { type: 'image', src: url };
  }, [artwork, driveMode]);

  if (!artwork || !config) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      
      {/* LAYER 1: BACKDROP - Light & Blurred */}
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
              /* 
                 IFRAME PLAYER 
                 - YT/Vimeo: Fixed 16:9 Aspect Ratio
                 - Drive Video: Flexible Container (Minimizes black bars)
              */
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
              /* NATIVE VIDEO (Direct MP4) */
              <video
                src={config.src}
                controls
                autoPlay
                playsInline
                className="max-w-full max-h-[85vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
              />
            ) : (
              /* NATIVE IMAGE (Native Ratio, No Frame) */
              <img
                src={config.src}
                alt={artwork.title || "Artwork"}
                className="max-w-full max-h-[85vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
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
