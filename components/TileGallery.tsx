import React from 'react';
import { MediaItem } from '../constants';

interface TileGalleryProps {
  items: MediaItem[];
  onSelect: (item: MediaItem) => void;
  mediaScale: number;
  gap: number;
}

const TileGallery: React.FC<TileGalleryProps> = ({ items, onSelect, gap }) => {
  // Use a tight gap by default for that "Midjourney" density, or use the slider value
  const gutter = gap ? gap : 12;

  return (
    <div className="w-full h-full overflow-y-auto px-4 pt-24 pb-12 custom-scrollbar">
      {/* 
        CSS Columns (Masonry) Configuration:
        - columns-xs/sm/md/lg controls how many columns appear based on screen width.
        - gap-x handles horizontal spacing.
        - space-y handles vertical spacing.
      */}
      <div 
        className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6 gap-x-4 space-y-4 mx-auto"
        style={{ 
          columnGap: `${gutter}px`,
          maxWidth: '1800px' // Prevent lines from getting too wide on massive screens
        }}
      >
        {items.map((item) => (
          <div
            key={item.id}
            // break-inside-avoid is CRITICAL. It prevents the browser from slicing an image in half 
            // at the bottom of a column.
            className="break-inside-avoid relative group mb-4" 
            style={{ marginBottom: `${gutter}px` }}
            onClick={() => onSelect(item)}
          >
            {/* 
               The Card Container 
               - Removed 'h-full', 'aspect-ratio'.
               - 'w-full' ensures it fills the column width.
               - 'fit-content' allows it to shrink to the image height.
            */}
            <div className="w-full bg-slate-200 rounded-lg overflow-hidden cursor-pointer shadow-sm transition-all duration-200 hover:shadow-md hover:brightness-110">
              
              {item.kind === 'video' ? (
                <video
                  src={item.videoUrl || item.fullUrl}
                  // w-full makes it fit the column.
                  // h-auto allows the video to set its own height based on resolution.
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
                  // w-full makes it fit the column.
                  // h-auto ensures 1:1 stays 1:1, 9:16 stays 9:16, etc.
                  className="block w-full h-auto align-middle"
                  loading="lazy"
                />
              )}

              {/* Midjourney-style Hover Overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 pointer-events-none flex items-end p-4">
                 <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-2 group-hover:translate-y-0">
                    {/* Optional: Add icon or text here if desired */}
                 </div>
              </div>

            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TileGallery;
