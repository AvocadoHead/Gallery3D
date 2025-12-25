import React from 'react';
import { MediaItem } from '../constants';

interface TileGalleryProps {
  items: MediaItem[];
  onSelect: (item: MediaItem) => void;
  mediaScale: number;
  gap: number;
}

const TileGallery: React.FC<TileGalleryProps> = ({ items, onSelect, mediaScale, gap }) => {
  const baseWidth = 240 * mediaScale;
  const gutter = Math.max(1, gap);

  const pickHeightMultiplier = (id: string, index: number) => {
    const seed = Array.from(id || `${index}`)
      .slice(0, 8)
      .reduce((acc, char, idx) => acc + char.charCodeAt(0) * (idx + 1), 0);
    const normalized = (Math.sin(seed) + 1) / 2; // 0 - 1
    return 0.55 + normalized * 1.45; // 0.55 - 2.0
  };

  return (
    <div
      className="w-full h-full overflow-y-auto px-4 pb-10 pt-24"
    >
      <div
        className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 mx-auto max-w-[1600px]"
        style={{ columnGap: `${gutter}px` }}
      >
        {items.map((item, index) => {
          const ratio = item.aspectRatio && !Number.isNaN(item.aspectRatio) ? item.aspectRatio : undefined;
          
          // Calculate height for fallback (if no ratio exists)
          const multiplier = pickHeightMultiplier(item.id, index);
          const estimatedHeight = baseWidth * multiplier;

          return (
            <article
              key={item.id}
              className="break-inside-avoid cursor-pointer transition-transform duration-300 hover:-translate-y-1 relative group"
              style={{ marginBottom: `${gutter}px` }}
              onClick={() => onSelect(item)}
            >
              <div
                className="bg-white rounded-xl shadow-sm hover:shadow-md overflow-hidden border border-slate-100"
                style={{ width: '100%' }}
              >
                <div
                  className="relative w-full bg-slate-50"
                  style={{ 
                    // If we have a ratio, let CSS handle height (auto). 
                    // If not, force the calculated randomized height.
                    height: ratio ? 'auto' : `${estimatedHeight}px`,
                    aspectRatio: ratio ? `${ratio}` : undefined 
                  }}
                >
                  {item.kind === 'video' ? (
                    <video
                      src={item.videoUrl || item.fullUrl}
                      className="block w-full h-full object-cover"
                      autoPlay
                      muted
                      loop
                      playsInline
                    />
                  ) : (
                    <img
                      src={item.fallbackPreview || item.previewUrl}
                      alt="gallery item"
                      className="block w-full h-full object-cover"
                      loading="lazy"
                    />
                  )}
                  
                  {/* Optional: Hover overlay effect */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 pointer-events-none" />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};

export default TileGallery;
