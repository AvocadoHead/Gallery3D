/* Book texture pipeline — ported from the 3D-book prototype (imageHelpers +
   defaultBook). Composites 1/2/4 images per page onto a canvas and returns
   dataURL textures, so the WebGL skinned-mesh book can map them without CORS
   taint. Google Drive links are rewritten to the CORS-friendly lh3 host. */

export const PAGE_W = 1325;
export const PAGE_H = 1771;
const PAD = 40;

type Slot = { x: number; y: number; w: number; h: number };
const GRID_LAYOUTS: Record<1 | 2 | 4, Slot[]> = {
  1: [{ x: 0, y: 0, w: 1, h: 1 }],
  2: [
    { x: 0, y: 0, w: 1, h: 0.5 },
    { x: 0, y: 0.5, w: 1, h: 0.5 },
  ],
  4: [
    { x: 0, y: 0, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0, w: 0.5, h: 0.5 },
    { x: 0, y: 0.5, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
  ],
};

export type BookLeaf = { front: string; back: string };

const extractDriveId = (input: string): string | null => {
  const m = input.match(/(?:file\/d\/|\/d\/|open\?id=|uc\?export=view&id=|uc\?id=|[?&]id=)([a-zA-Z0-9_-]{25,})/);
  return m ? m[1] : null;
};

/** Drive → lh3 (CORS-friendly); other http(s) pass through. */
export const normalizeImageUrl = (input?: string): string | null => {
  if (!input) return null;
  const clean = input.trim();
  if (!clean) return null;
  const id = extractDriveId(clean);
  if (id) return `https://lh3.googleusercontent.com/d/${id}`;
  if (/^[a-zA-Z0-9_-]{25,}$/.test(clean)) return `https://lh3.googleusercontent.com/d/${clean}`;
  if (/^https?:\/\//i.test(clean) || clean.startsWith('data:')) return clean;
  return null;
};

const blankTexture = (color = '#f5f5f5'): string => {
  const c = document.createElement('canvas');
  c.width = PAGE_W;
  c.height = PAGE_H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c.toDataURL('image/png');
};

/** Load an image cross-origin; on failure retry through a CORS proxy. */
const loadImage = (url: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const src = normalizeImageUrl(url) || url;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      const retry = new Image();
      retry.crossOrigin = 'anonymous';
      retry.onload = () => resolve(retry);
      retry.onerror = () => resolve(null);
      retry.src = `https://corsproxy.io/?${encodeURIComponent(src)}`;
    };
    img.src = src;
  });

const renderLayout = (images: (HTMLImageElement | null)[], slots: Slot[]): string => {
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W;
  canvas.height = PAGE_H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const safeW = PAGE_W - PAD * 2;
  const safeH = PAGE_H - PAD * 2;
  images.forEach((img, i) => {
    if (!img || i >= slots.length) return;
    const s = slots[i];
    const slotW = safeW * s.w - 10;
    const slotH = safeH * s.h - 10;
    const slotX = PAD + safeW * s.x + 5;
    const slotY = PAD + safeH * s.y + 5;
    const scale = Math.min(slotW / img.width, slotH / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, slotX + (slotW - dw) / 2, slotY + (slotH - dh) / 2, dw, dh);
  });
  return canvas.toDataURL('image/png');
};

/** A dark title cover page. */
const coverTexture = (title: string, color = '#0f172a'): string => {
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W;
  canvas.height = PAGE_H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${Math.round(PAGE_W * 0.09)}px Inter, sans-serif`;
  const words = (title || 'Gallery').split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).length > 16) { lines.push(line.trim()); line = w; }
    else line += ' ' + w;
  }
  lines.push(line.trim());
  const lh = PAGE_W * 0.12;
  lines.forEach((l, i) => ctx.fillText(l, PAGE_W / 2, PAGE_H / 2 - ((lines.length - 1) * lh) / 2 + i * lh));
  return canvas.toDataURL('image/png');
};

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/** Build book leaves (front/back texture pairs) from item image URLs. */
export const buildBookLeaves = async (
  urls: string[],
  perPage: 1 | 2 | 4,
  title: string,
): Promise<BookLeaf[]> => {
  const normalized = urls.map(normalizeImageUrl).filter((u): u is string => !!u);

  const images = await Promise.all(normalized.map(loadImage));
  const valid = images.filter((i): i is HTMLImageElement => !!i);

  const contentSides = chunk(valid, perPage).map((group) =>
    renderLayout(group, GRID_LAYOUTS[perPage]),
  );

  const allSides = [coverTexture(title), ...contentSides, blankTexture()];

  const leaves: BookLeaf[] = [];
  for (let i = 0; i < allSides.length; i += 2) {
    leaves.push({ front: allSides[i], back: allSides[i + 1] || blankTexture() });
  }
  // Ensure at least a cover + back leaf so the book is never degenerate.
  if (leaves.length === 0) leaves.push({ front: coverTexture(title), back: blankTexture() });
  return leaves;
};
