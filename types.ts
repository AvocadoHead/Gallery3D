export interface Artwork {
  id: string;
  previewUrl: string;
  fullUrl: string;
}

export interface GalleryItemProps {
  artwork: Artwork;
  position: [number, number, number];
  rotation: [number, number, number];
  onClick: (artwork: Artwork) => void;
}
