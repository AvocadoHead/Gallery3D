import React from 'react';
import { MediaItem } from '../constants';

interface TileGalleryProps {
  items: MediaItem[];
  onSelect: (item: MediaItem) => void;
  mediaScale: number;
  gap: number;
}

const TileGallery: React.FC<TileGalleryProps> = ({ items, onSelect, gap }) => {
  const gutter = gap ? gap : 12;

  // Function to determine if we should nudge this item to create uneven stagger
  // We use a simple hash of ID to be deterministic but look random
  const getStaggerClass = (index: number) => {
    // Only apply to first few items to offset columns? 
    // Actually, pure CSS columns don't allow easy individual nudging.
    // Instead, we will rely on natural height variance.
    // If you REALLY want to break the grid of 1:1 squares, we can add small random margins.
    const randomShift = (index % 3 === 0) ? 'mt-4' : (index % 7 === 0) ? 'mt-8' : '';
    return randomShift;
  };

  return (
    <div className="w-full h-full overflow-y-auto px-4 pt-24 pb-12 custom-scrollbar">
      <div 
        className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6 gap-x-4 space-y-4 mx-auto"
        style={{ columnGap: `${gutter}px`, maxWidth: '1800px' }}
      >
        {items.map((item, idx) => (
          <div
            key={item.id}
            className={`break-inside-avoid relative group mb-4 ${getStaggerClass(idx)}`}
            style={{ marginBottom: `${gutter}px` }}
            onClick={() => onSelect(item)}
          >
            <div className="w-full bg-slate-200 rounded-lg overflow-hidden cursor-pointer shadow-sm transition-all duration-200 hover:shadow-md hover:brightness-110">
              {item.kind === 'video' ? (
                <video
                  src={item.videoUrl || item.fullUrl}
                  className="block w-full h-auto align-middle"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              ) : (
                <img
                  src={item.fallbackPreview || item.previewUrl}
                  alt={item.title || 'Gallery artwork'}
                  className="block w-full h-auto align-middle"
                  loading="lazy"
                />
              )}
               <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 pointer-events-none" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TileGallery;
