import React, { useState, useEffect } from 'react';
import { getFullUrl, getPreviewUrl } from '../constants';

interface OverlayProps {
  artworkId: string | null;
  onClose: () => void;
}

const Overlay: React.FC<OverlayProps> = ({ artworkId, onClose }) => {
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (artworkId) {
      setLoaded(false);
      setHasError(false);
      // Small delay to allow mounting before animating in
      requestAnimationFrame(() => setVisible(true));
      document.body.style.overflow = 'hidden';
    } else {
      setVisible(false);
      document.body.style.overflow = '';
    }
  }, [artworkId]);

  if (!artworkId) return null;

  const fullUrl = getFullUrl(artworkId);
  const previewUrl = getPreviewUrl(artworkId);

  return (
    <div 
      className={`
        fixed inset-0 z-50 flex items-center justify-center 
        transition-all duration-500 ease-out
        ${visible ? 'bg-white/60 backdrop-blur-xl' : 'bg-transparent backdrop-blur-none pointer-events-none'}
      `}
      onClick={onClose}
    >
      <button 
        onClick={onClose}
        className={`
          absolute top-8 right-8 w-12 h-12 flex items-center justify-center rounded-full bg-white shadow-lg text-gray-800 hover:scale-105 transition-all duration-300 z-50 border border-gray-100
          ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}
        `}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div 
        className={`
          relative p-2 bg-white rounded-2xl shadow-2xl overflow-hidden
          transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1)
          ${visible ? 'scale-100 opacity-100 translate-y-0' : 'scale-90 opacity-0 translate-y-12'}
        `}
        style={{
          maxWidth: '92vw',
          maxHeight: '92vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {!loaded && !hasError && (
           <div className="absolute inset-0 flex items-center justify-center z-10 bg-gray-50/50">
             <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-800 rounded-full animate-spin"></div>
           </div>
        )}

        <img 
          src={hasError ? previewUrl : fullUrl}
          alt="Artwork"
          className={`
            max-w-full max-h-[85vh] object-contain rounded-xl select-none
            transition-opacity duration-500
            ${loaded ? 'opacity-100' : 'opacity-0'}
          `}
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (!hasError) setHasError(true);
          }}
        />
      </div>
    </div>
  );
};

export default Overlay;