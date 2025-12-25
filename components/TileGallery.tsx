import React from 'react';
import { MediaItem } from '../constants';

interface TileGalleryProps {
  items: MediaItem[];
  onSelect: (item: MediaItem) => void;
  mediaScale: number;
  gap: number;
}

const TileGallery: React.FC<TileGalleryProps> = ({ items, onSelect, gap }) => {
  // We remove the complex height math. Let the browser calculate natural height.
  const gutter = Math.max(1, gap);

  return (
    <div className="w-full h-full overflow-y-auto px-4 pb-10 pt-24">
      <div
        // standard tailwind columns. 
        // gap-x handles horizontal space, gap-y isn't supported in columns directly usually, 
        // so we use marginBottom on the item.
        className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 mx-auto max-w-[1920px]"
        style={{ columnGap: `${gutter}px` }}
      >
        {items.map((item) => {
          return (
            <article
              key={item.id}
              className="break-inside-avoid cursor-pointer transition-transform duration-300 hover:-translate-y-1 relative group"
              style={{ marginBottom: `${gutter}px` }}
              onClick={() => onSelect(item)}
            >
              <div className="bg-white rounded-xl shadow-sm hover:shadow-md overflow-hidden border border-slate-100">
                {item.kind === 'video' ? (
                  <video
                    src={item.videoUrl || item.fullUrl}
                    // w-full makes it fill column width
                    // h-auto makes it calculate height based on intrinsic ratio
                    className="block w-full h-auto"
                    autoPlay
                    muted
                    loop
                    playsInline
                    // If we happen to know aspect ratio from DB, use it to prevent layout shift
                    style={item.aspectRatio ? { aspectRatio: item.aspectRatio } : undefined}
                  />
                ) : (
                  <img
                    src={item.fallbackPreview || item.previewUrl}
                    alt="gallery item"
                    // w-full + h-auto is the key to original ratio
                    className="block w-full h-auto"
                    loading="lazy"
                    // If we happen to know aspect ratio from DB, use it to prevent layout shift
                    style={item.aspectRatio ? { aspectRatio: item.aspectRatio } : undefined}
                  />
                )}
                
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 pointer-events-none rounded-xl" />
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};

export default TileGallery;
