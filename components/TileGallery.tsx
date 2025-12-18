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

  return (
    <div
      className="w-full h-full overflow-y-auto px-5 pb-12 pt-20"
      style={{ columnGap: `${gap}px` }}
    >
      <div
        className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4"
        style={{ columnGap: `${gap}px` }}
      >
        {items.map((item) => (
          <article
            key={item.id}
            className="mb-4 break-inside-avoid cursor-pointer transition-transform duration-300 hover:-translate-y-1"
            style={{ width: '100%', maxWidth: baseWidth, marginBottom: gap }}
            onClick={() => onSelect(item)}
          >
            <div
              className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-100"
              style={{ width: '100%' }}
            >
              <div className="relative w-full bg-slate-50">
                {item.kind === 'video' ? (
                  <video
                    src={item.videoUrl || item.fullUrl}
                    className="w-full h-auto rounded-2xl"
                    autoPlay
                    muted
                    loop
                    playsInline
                  />
                ) : (
                  <img
                    src={item.fallbackPreview || item.previewUrl}
                    alt="gallery item"
                    className="w-full h-auto rounded-2xl object-contain"
                    loading="lazy"
                  />
                )}
                <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/60 pointer-events-none" />
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

export default TileGallery;
