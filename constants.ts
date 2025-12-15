export const RAW_LINKS = [
  // (keep your huge list as-is)
  // ...
];

export type MediaKind = 'image' | 'video' | 'embed';

export interface MediaItem {
  id: string;
  originalUrl: string;
  kind: MediaKind;
  previewUrl: string; // thumbnail / lightweight preview
  fullUrl: string;    // overlay url (image full / embed url / video url)
  aspectRatio?: number;
  fallbackPreview?: string;
}

/** Helper: extract Google Drive ID */
export const getDriveId = (url: string): string => {
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m?.[1]) return m[1].split('?', 1)[0];
  const alt = url.match(/id=([a-zA-Z0-9_-]+)/);
  return alt?.[1] ? alt[1].split('?', 1)[0] : '';
};

/** Google Drive image urls (fast + reliable when shared publicly) */
export const getPreviewUrl = (id: string) => `https://lh3.googleusercontent.com/d/${id}=w500`;
export const getFullUrl = (id: string) => `https://lh3.googleusercontent.com/d/${id}=w2000`;

/** Media helpers */
const uniqueId = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);

const isDirectVideo = (url: string) => /\.(mp4|mov|webm|ogg|m4v)(\?|$)/i.test(url);

const getYouTubeId = (url: string) => {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return match ? match[1] : '';
};

const getVimeoId = (url: string) => {
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? match[1] : '';
};

/** Create one canonical MediaItem from ANY url */
export const createMediaItem = (url: string): MediaItem => {
  const trimmed = url.trim();

  const yt = getYouTubeId(trimmed);
  if (yt) {
    return {
      id: uniqueId(),
      originalUrl: trimmed,
      kind: 'embed',
      previewUrl: `https://img.youtube.com/vi/${yt}/hqdefault.jpg`,
      fullUrl: `https://www.youtube.com/embed/${yt}?autoplay=1&mute=1&loop=1&playlist=${yt}&controls=0&modestbranding=1&playsinline=1`,
      aspectRatio: 16 / 9,
    };
  }

  const vimeo = getVimeoId(trimmed);
  if (vimeo) {
    return {
      id: uniqueId(),
      originalUrl: trimmed,
      kind: 'embed',
      previewUrl: `https://vumbnail.com/${vimeo}.jpg`,
      fullUrl: `https://player.vimeo.com/video/${vimeo}?autoplay=1&muted=1&loop=1&title=0&byline=0&portrait=0`,
      aspectRatio: 16 / 9,
    };
  }

  const driveId = getDriveId(trimmed);
  if (driveId) {
    // Drive links in your RAW_LINKS are mostly images. If you later add drive videos,
    // you can mark them by adding a direct video url or extend detection with metadata.
    return {
      id: uniqueId(),
      originalUrl: trimmed,
      kind: 'image',
      previewUrl: getPreviewUrl(driveId),
      fullUrl: getFullUrl(driveId),
      fallbackPreview: getPreviewUrl(driveId),
    };
  }

  if (isDirectVideo(trimmed)) {
    return {
      id: uniqueId(),
      originalUrl: trimmed,
      kind: 'video',
      previewUrl: trimmed,
      fullUrl: trimmed,
    };
  }

  return {
    id: uniqueId(),
    originalUrl: trimmed,
    kind: 'image',
    previewUrl: trimmed,
    fullUrl: trimmed,
    fallbackPreview: trimmed,
  };
};

export const buildMediaItemsFromUrls = (urls: string[]) =>
  urls
    .map((u) => (u || '').trim())
    .filter(Boolean)
    .map(createMediaItem);

export const buildDefaultMediaItems = () => buildMediaItemsFromUrls(RAW_LINKS);

/** URL param encoding: supports meta + backwards compatibility */
export const encodeGalleryParam = (
  items: MediaItem[],
  meta?: { displayName?: string; contactWhatsapp?: string; contactEmail?: string }
): string => {
  const urls = items.map((i) => i.originalUrl);
  const data = {
    u: urls,
    ...(meta?.displayName ? { n: meta.displayName } : {}),
    ...(meta?.contactWhatsapp ? { w: meta.contactWhatsapp } : {}),
    ...(meta?.contactEmail ? { e: meta.contactEmail } : {}),
  };
  return encodeURIComponent(btoa(JSON.stringify(data)));
};

export const decodeGalleryParam = (
  param: string | null
): { urls: string[]; displayName?: string; contactWhatsapp?: string; contactEmail?: string } => {
  if (!param) return { urls: [] };
  try {
    const decoded = JSON.parse(atob(decodeURIComponent(param)));

    // OLD format: ["url1","url2",...]
    if (Array.isArray(decoded)) return { urls: decoded };

    // NEW format: { u: [...], n, w, e }
    return {
      urls: Array.isArray(decoded?.u) ? decoded.u : [],
      displayName: decoded?.n,
      contactWhatsapp: decoded?.w,
      contactEmail: decoded?.e,
    };
  } catch (e) {
    console.warn('Failed to decode gallery param:', e);
    return { urls: [] };
  }
};

export const sanitizeWhatsapp = (phone: string): string => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) return '972' + digits.slice(1);
  return digits;
};

/** Fibonacci sphere */
export const getSphereCoordinates = (count: number, radius: number) => {
  const points: { position: [number, number, number]; rotation: [number, number, number] }[] = [];
  const safeCount = Math.max(1, count);
  const phiSpan = Math.PI * (3 - Math.sqrt(5));

  if (safeCount === 1) return [{ position: [0, 0, radius], rotation: [0, 0, 0] }];

  for (let i = 0; i < safeCount; i++) {
    const y = 1 - (i / (safeCount - 1)) * 2;
    const radiusAtY = Math.sqrt(1 - y * y);
    const theta = phiSpan * i;

    const x = Math.cos(theta) * radiusAtY;
    const z = Math.sin(theta) * radiusAtY;

    points.push({
      position: [x * radius, y * radius, z * radius],
      rotation: [0, 0, 0],
    });
  }

  return points;
};
