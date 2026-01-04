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
      setVisible(true);
    } else {
      setTimeout(() => setVisible(false), 300);
    }
  }, [artwork]);

  if (!visible && !artwork) return null;

  return (
    <div
      className={`
        fixed inset-0 z-50 flex items-center justify-center 
        transition-all duration-500 ease-out
        ${artwork ? 'bg-white/95 backdrop-blur-xl opacity-100' : 'bg-transparent opacity-0 pointer-events-none'}
      `}
      onClick={onClose}
    >
      {/* Close Button */}
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 p-4 rounded-full bg-slate-100 hover:bg-slate-200 transition z-50 group"
      >
        <svg className="w-6 h-6 text-slate-500 group-hover:text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Content Container */}
      <div 
        className={`
           relative w-full h-full p-4 md:p-12 flex flex-col md:flex-row items-center justify-center gap-8
           transition-all duration-700 delay-100
           ${artwork ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-8'}
        `}
        onClick={(e) => e.stopPropagation()} 
      >
        {artwork && (
          <>
            {/* Media Wrapper - Auto Sizing */}
            <div className="flex-1 w-full h-full flex items-center justify-center overflow-hidden">
                {artwork.kind === 'video' || (artwork.kind === 'embed' && !artwork.previewUrl) ? (
                  <video
                    src={artwork.videoUrl || artwork.fullUrl}
                    controls
                    autoPlay
                    playsInline
                    className="max-w-full max-h-full object-contain rounded shadow-lg"
                  />
                ) : (
                  <img
                    src={artwork.fullUrl}
                    alt="Artwork"
                    className="max-w-full max-h-full object-contain rounded shadow-lg"
                  />
                )}
            </div>

            {/* 
              Future Feature: Title/Description 
              To enable this, simply add 'title' and 'description' fields to your MediaItem objects.
              The UI is ready to render them if present.
            */}
            {(artwork.title || artwork.description) && (
              <div className="w-full md:w-80 flex-shrink-0 bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-sm overflow-y-auto max-h-[30vh] md:max-h-full">
                 {artwork.title && <h2 className="text-xl font-bold text-slate-800 mb-2">{artwork.title}</h2>}
                 {artwork.description && <p className="text-sm text-slate-600 leading-relaxed">{artwork.description}</p>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Overlay;
