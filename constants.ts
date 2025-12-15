/* ===============================
   TYPES
================================ */

export type MediaType = 'image' | 'video';

export interface MediaItem {
  id: string;
  url: string;
  previewUrl: string;
  type: MediaType;
}

/* ===============================
   DEFAULT GALLERY (284 ITEMS)
   ⚠️ Put your real list here
================================ */

export const ARTWORK_ITEMS: MediaItem[] = [
  // EXAMPLE – replace with your real 284 urls
  ...Array.from({ length: 284 }).map((_, i) => {
    const driveId = 'YOUR_GOOGLE_DRIVE_ID_' + i;
    return {
      id: `artwork-${i}`,
      url: `https://drive.google.com/file/d/${driveId}/view`,
      previewUrl: `https://drive.google.com/uc?export=view&id=${driveId}`,
      type: 'image',
    };
  }),
];

/* ===============================
   BUILDERS
================================ */

export const buildMediaItemsFromUrls = (urls: string[]): MediaItem[] => {
  return urls.map((url, i) => {
    const isVideo =
      url.includes('youtube') ||
      url.includes('youtu.be') ||
      url.includes('vimeo') ||
      url.endsWith('.mp4');

    return {
      id: `custom-${i}-${Date.now()}`,
      url,
      previewUrl: buildPreviewUrl(url),
      type: isVideo ? 'video' : 'image',
    };
  });
};

const buildPreviewUrl = (url: string) => {
  // Google Drive
  const driveMatch = url.match(/[-\w]{25,}/);
  if (driveMatch) {
    return `https://drive.google.com/uc?export=view&id=${driveMatch[0]}`;
  }

  // YouTube
  if (url.includes('youtu')) {
    const id = url.split('v=')[1]?.split('&')[0];
    if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  }

  // Vimeo (fallback)
  if (url.includes('vimeo')) {
    return url;
  }

  return url;
};

/* ===============================
   SHARE ENCODE / DECODE
================================ */

export const encodeGalleryParam = (
  items: MediaItem[],
  meta?: {
    displayName?: string;
    contactWhatsapp?: string;
    contactEmail?: string;
  }
) => {
  const payload = {
    urls: items.map(i => i.url),
    ...meta,
  };

  return btoa(encodeURIComponent(JSON.stringify(payload)));
};

export const decodeGalleryParam = (encoded: string | null) => {
  if (!encoded) return null;

  try {
    const decoded = decodeURIComponent(atob(encoded));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};

/* ===============================
   SPHERE COORDINATES
================================ */

export const getSphereCoordinates = (
  count: number,
  radius: number
): { position: [number, number, number] }[] => {
  const points: { position: [number, number, number] }[] = [];

  for (let i = 0; i < count; i++) {
    const phi = Math.acos(1 - 2 * (i + 0.5) / count);
    const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);

    const x = radius * Math.cos(theta) * Math.sin(phi);
    const y = radius * Math.sin(theta) * Math.sin(phi);
    const z = radius * Math.cos(phi);

    points.push({ position: [x, y, z] });
  }

  return points;
};

/* ===============================
   UTIL
================================ */

export const sanitizeWhatsapp = (value: string) => {
  if (!value) return '';
  return value.replace(/\D/g, '').replace(/^0/, '972');
};
