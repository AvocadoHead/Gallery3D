import React, { useMemo } from 'react';
import { MediaItem } from '../constants';

interface TileGalleryProps {
  items: MediaItem[];
  onSelect: (item: MediaItem) => void;
  mediaScale: number; // 0.5 to 3.0
  gap: number;
}

const TileGallery: React.FC<TileGalleryProps> = ({ items, onSelect, mediaScale, gap }) => {
  
  const getColumnCount = () => {
    const width = window.innerWidth;
    let baseCols = 1;
    
    if (width >= 640) baseCols = 2;
    if (width >= 1024) baseCols = 3;
    if (width >= 1500) baseCols = 4;

    // Logic: Smaller Scale -> More Columns
    if (mediaScale <= 0.6) return baseCols + 2; 
    if (mediaScale <= 0.8) return baseCols + 1;
    if (mediaScale >= 1.5) return Math.max(1, baseCols - 1);
    if (mediaScale >= 2.2) return Math.max(1, baseCols - 2);
    
    return baseCols;
  };

  const columns = getColumnCount();

  const columnWrapper = useMemo(() => {
    const cols: MediaItem[][] = Array.from({ length: columns }, () => []);
    items.forEach((item, i) => {
      cols[i % columns].push(item);
    });
    return cols;
  }, [items, columns]);

  return (
    <div 
      className="w-full h-full overflow-y-auto px-4 pt-32 pb-24 no-scrollbar"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <div 
        className="flex justify-center items-start" 
        style={{ gap: `${gap}px` }}
      >
        {columnWrapper.map((col, colIndex) => (
          <div 
            key={colIndex} 
            className="flex flex-col flex-1"
            style={{ gap: `${gap}px` }}
          >
            {col.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelect(item)}
                className="relative group cursor-pointer rounded-lg overflow-hidden bg-slate-100 shadow-sm hover:shadow-md transition-all duration-300"
              >
                <img
                  src={item.fallbackPreview || item.previewUrl || item.fullUrl}
                  alt="gallery item"
                  className="w-full h-auto object-cover block"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
                
                {item.kind === 'video' && (
                  <div className="absolute top-2 right-2 bg-black/50 p-1.5 rounded-full backdrop-blur-sm">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  </div>
                )}
                
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TileGallery;
