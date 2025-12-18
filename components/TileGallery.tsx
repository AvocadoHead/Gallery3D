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
    return 0.55 + normalized * 1.45; // 0.55 - 2.0 for stronger height variance
  };

  return (
    <div
      className="w-full h-full overflow-y-auto px-2 pb-6 pt-12"
      style={{ columnGap: `${gutter}px` }}
    >
      <div
        className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4"
        style={{ columnGap: `${gutter}px`, columnWidth: `${baseWidth}px` }}
      >
        {items.map((item, index) => {
          const ratio = item.aspectRatio && !Number.isNaN(item.aspectRatio) ? item.aspectRatio : undefined;
          const baseHeight = ratio ? baseWidth / ratio : baseWidth * pickHeightMultiplier(item.id, index);
          const height = Math.max(120, baseHeight);
          return (
            <article
              key={item.id}
              className="break-inside-avoid cursor-pointer transition-transform duration-300 hover:-translate-y-1"
              style={{ width: '100%', marginBottom: Math.max(0, gutter * 0.1) }}
              onClick={() => onSelect(item)}
            >
              <div
                className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-100"
                style={{ width: '100%' }}
              >
                <div
                  className="relative w-full bg-slate-50"
                  style={{ height, minHeight: height }}
                >
                  {item.kind === 'video' ? (
                    <video
                      src={item.videoUrl || item.fullUrl}
                      className="w-full h-full rounded-2xl object-contain"
                      autoPlay
                      muted
                      loop
                      playsInline
                    />
                  ) : (
                    <img
                      src={item.fallbackPreview || item.previewUrl}
                      alt="gallery item"
                      className="w-full h-full rounded-2xl object-contain"
                      loading="lazy"
                    />
                  )}
                  <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/60 pointer-events-none" />
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
