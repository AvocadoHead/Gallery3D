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
  if (/drive\.google\.com\/thumbnail\?/i.test(clean)) return clean;
  const id = extractDriveId(clean);
  if (id) return `https://lh3.googleusercontent.com/d/${id}`;
  if (/^[a-zA-Z0-9_-]{25,}$/.test(clean)) return `https://lh3.googleusercontent.com/d/${clean}`;
  if (/^https?:\/\//i.test(clean) || clean.startsWith('data:')) return clean;
  return null;
};

const blankTexture = (scale: number, color = '#f5f5f5'): string => {
  const c = document.createElement('canvas');
  c.width = Math.round(PAGE_W * scale);
  c.height = Math.round(PAGE_H * scale);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
};

/** Route a URL through weserv.nl, which fetches it server-side and serves it
    back with `Access-Control-Allow-Origin: *` — so the canvas never taints. */
const weserv = (url: string) =>
  `https://images.weserv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//i, ''))}`;

/** Load an image with CORS. Drive thumbnails/lh3 already send ACAO:*;
    loading them through weserv can produce false 404s. Try direct first,
    then use weserv only as a fallback for other hosts that need a proxy. */
const loadImage = (url: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const src = normalizeImageUrl(url) || url;
    const attempt = (candidate: string, next: () => void) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = next;
      img.src = candidate;
    };
    if (src.startsWith('data:')) {
      attempt(src, () => resolve(null));
      return;
    }
    const isDriveImage = /(?:drive\.google\.com\/thumbnail|lh3\.googleusercontent\.com\/d\/)/i.test(src);
    if (isDriveImage) {
      attempt(src, () => resolve(null));
      return;
    }
    attempt(src, () => attempt(weserv(src), () => resolve(null)));
  });

const renderLayout = (images: (HTMLImageElement | null)[], slots: Slot[], scale: number): string => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(PAGE_W * scale);
  canvas.height = Math.round(PAGE_H * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);

  const safeW = PAGE_W - PAD * 2;
  const safeH = PAGE_H - PAD * 2;
  images.forEach((img, i) => {
    if (!img || i >= slots.length) return;
    const s = slots[i];
    const slotW = safeW * s.w - 10;
    const slotH = safeH * s.h - 10;
    const slotX = PAD + safeW * s.x + 5;
    const slotY = PAD + safeH * s.y + 5;
    const imgScale = Math.min(slotW / img.width, slotH / img.height);
    const dw = img.width * imgScale;
    const dh = img.height * imgScale;
    ctx.drawImage(img, slotX + (slotW - dw) / 2, slotY + (slotH - dh) / 2, dw, dh);
  });
  return canvas.toDataURL('image/jpeg', 0.85);
};

/** A dark title cover page. */
const coverTexture = (title: string, scale: number, color = '#0f172a'): string => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(PAGE_W * scale);
  canvas.height = Math.round(PAGE_H * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
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
  return canvas.toDataURL('image/jpeg', 0.85);
};

/** Full-bleed image cover with optional title gradient overlay. */
const imageCoverTexture = (img: HTMLImageElement, scale: number, title?: string): string => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(PAGE_W * scale);
  canvas.height = Math.round(PAGE_H * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  // Cover-crop: scale so image fills the entire page
  const imgScale = Math.max(PAGE_W / img.width, PAGE_H / img.height);
  const dw = img.width * imgScale;
  const dh = img.height * imgScale;
  ctx.drawImage(img, (PAGE_W - dw) / 2, (PAGE_H - dh) / 2, dw, dh);
  if (title) {
    const grad = ctx.createLinearGradient(0, PAGE_H * 0.65, 0, PAGE_H);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, PAGE_H * 0.65, PAGE_W, PAGE_H * 0.35);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${Math.round(PAGE_W * 0.09)}px Inter, sans-serif`;
    const words = title.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      if ((line + ' ' + w).length > 16) { lines.push(line.trim()); line = w; }
      else line += ' ' + w;
    }
    lines.push(line.trim());
    const lh = PAGE_W * 0.12;
    lines.forEach((l, i) => ctx.fillText(l, PAGE_W / 2, PAGE_H * 0.85 - ((lines.length - 1) * lh) / 2 + i * lh));
  }
  return canvas.toDataURL('image/jpeg', 0.85);
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
  onProgress?: (loaded: number, total: number) => void,
): Promise<{ leaves: BookLeaf[]; skipped: number }> => {
  const normalized = urls.map(normalizeImageUrl).filter((u): u is string => !!u);

  // Scale canvas resolution down for large books to limit GPU memory usage
  const sides = Math.ceil(normalized.length / perPage) + 2;
  const scale = sides <= 24 ? 1 : sides <= 80 ? 0.75 : 0.5;

  let done = 0;
  const images = await Promise.all(
    normalized.map((u) =>
      loadImage(u).then((img) => {
        done += 1;
        onProgress?.(done, normalized.length);
        return img;
      }),
    ),
  );

  const valid = images.filter((i): i is HTMLImageElement => !!i);
  const skipped = normalized.length - valid.length;

  // First item → front cover, last item → back cover (need ≥3 so interior is non-empty)
  const coverImg = valid.length >= 1 ? valid[0] : null;
  const backImg = valid.length >= 3 ? valid[valid.length - 1] : null;
  const interior = backImg ? valid.slice(1, -1) : valid.slice(coverImg ? 1 : 0);

  const frontCover = coverImg ? imageCoverTexture(coverImg, scale, title) : coverTexture(title, scale);
  const backCover = backImg ? imageCoverTexture(backImg, scale) : blankTexture(scale);
  const contentSides = chunk(interior, perPage).map((group) =>
    renderLayout(group, GRID_LAYOUTS[perPage], scale),
  );
  // Back cover must land on a leaf BACK — pad to keep contentSides even
  if (contentSides.length % 2 === 1) contentSides.push(blankTexture(scale));
  const allSides = [frontCover, ...contentSides, backCover];

  const leaves: BookLeaf[] = [];
  for (let i = 0; i < allSides.length; i += 2) {
    leaves.push({ front: allSides[i], back: allSides[i + 1] || blankTexture(scale) });
  }
  // Ensure at least a cover + back leaf so the book is never degenerate.
  if (leaves.length === 0) leaves.push({ front: coverTexture(title, scale), back: blankTexture(scale) });
  return { leaves, skipped };
};
