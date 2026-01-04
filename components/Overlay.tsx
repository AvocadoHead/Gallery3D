import React, { useEffect, useState } from 'react';
import { MediaItem } from '../constants';

interface OverlayProps {
  artwork: MediaItem | null;
  onClose: () => void;
}

const Overlay: React.FC<OverlayProps> = ({ artwork, onClose }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (artwork) {
      // Small delay to allow mounting before animating in
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [artwork]);

  if (!artwork) return null;

  return (
    <div
      className={`
        fixed inset-0 z-[200] flex items-center justify-center 
        bg-slate-900/60 backdrop-blur-md
        transition-opacity duration-500 ease-out
        ${visible ? 'opacity-100' : 'opacity-0'}
      `}
      onClick={onClose}
    >
      {/* Close Button */}
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition z-50 backdrop-blur-sm"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Content Container with "Coming to Front" Animation */}
      <div 
        className={`
           relative w-full h-full max-w-7xl max-h-[90vh] p-4 md:p-8 flex flex-col md:flex-row items-center justify-center gap-8
           transition-all duration-500 cubic-bezier(0.175, 0.885, 0.32, 1.275)
           ${visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-4'}
        `}
        onClick={(e) => e.stopPropagation()} 
      >
        {/* Media Wrapper */}
        <div className="flex-1 w-full h-full flex items-center justify-center overflow-hidden rounded-xl shadow-2xl">
            {(artwork.kind === 'video' || (artwork.kind === 'embed' && !artwork.previewUrl)) ? (
              <video
                src={artwork.videoUrl || artwork.previewUrl || artwork.fullUrl}
                controls
                autoPlay
                playsInline
                className="max-w-full max-h-[85vh] object-contain rounded-xl bg-black"
              />
            ) : (
              <img
                src={artwork.fullUrl}
                alt="Artwork"
                className="max-w-full max-h-[85vh] object-contain rounded-xl"
              />
            )}
        </div>

        {/* Info Sidebar (Optional) */}
        {(artwork.title || artwork.description) && (
          <div className="w-full md:w-80 flex-shrink-0 bg-white/90 backdrop-blur-xl p-6 rounded-2xl border border-white/20 shadow-xl overflow-y-auto max-h-[30vh] md:max-h-[60vh] animate-in slide-in-from-right-4 duration-700">
             {artwork.title && <h2 className="text-xl font-bold text-slate-900 mb-2 font-heebo">{artwork.title}</h2>}
             {artwork.description && <p className="text-sm text-slate-700 leading-relaxed">{artwork.description}</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default Overlay;
