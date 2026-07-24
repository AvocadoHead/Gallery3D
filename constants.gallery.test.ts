import { describe, it, expect } from 'vitest';
import {
  getGalleryRadius,
  getSphereCoordinates,
  getCarouselCoordinates,
  createMediaItem,
} from './constants';

type P = { position: [number, number, number] };
const dist = (a: P, b: P) =>
  Math.hypot(
    a.position[0] - b.position[0],
    a.position[1] - b.position[1],
    a.position[2] - b.position[2],
  );
const minPairwise = (pts: P[]) => {
  let m = Infinity;
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) m = Math.min(m, dist(pts[i], pts[j]));
  return m;
};
const noNaN = (pts: P[]) =>
  pts.every((p) => p.position.every((c) => Number.isFinite(c)));

/* ------------------------------------------------------------------ *
 * getGalleryRadius — the density floor that fixes the clump/flicker/
 * menu-blur bug. Regression-locks the exact production incident: two
 * 284-item galleries, sphereBase 10 vs 30, behaved completely
 * differently because radius ignored item count.
 * ------------------------------------------------------------------ */
describe('getGalleryRadius', () => {
  it('REGRESSION: 284 items at sphereBase 10 no longer collapses (was radius 16)', () => {
    const broken = getGalleryRadius(284, 10, 0.8);
    const healthyTwin = getGalleryRadius(284, 30, 0.8);
    expect(broken).toBeGreaterThan(35); // the old formula gave 16 → unusable clump
    // The two galleries must now land in the same healthy ballpark, not 16 vs 48.
    expect(broken).toBeGreaterThan(healthyTwin * 0.7);
  });

  it('radius never shrinks as the gallery grows (density stays bounded)', () => {
    const counts = [10, 50, 100, 284, 500, 1000];
    for (let i = 1; i < counts.length; i++) {
      expect(getGalleryRadius(counts[i], 10, 0.8)).toBeGreaterThanOrEqual(
        getGalleryRadius(counts[i - 1], 10, 0.8),
      );
    }
  });

  it('leaves small galleries with a generous base untouched', () => {
    // base 62, 10 items, scale 1 → the requested size wins over the floor.
    expect(getGalleryRadius(10, 62, 1)).toBeGreaterThan(60);
  });

  it('is always a positive, finite radius even for degenerate input', () => {
    for (const [n, b, s] of [[1, 0, 0], [0, 0, 0], [1, 10, 0.1]] as const) {
      const r = getGalleryRadius(n, b, s);
      expect(Number.isFinite(r)).toBe(true);
      expect(r).toBeGreaterThanOrEqual(10);
    }
  });
});

/* ------------------------------------------------------------------ *
 * Sphere — even, non-overlapping distribution at a realistic radius.
 * ------------------------------------------------------------------ */
describe('getSphereCoordinates', () => {
  const r = getGalleryRadius(284, 10, 0.8);
  const pts = getSphereCoordinates(284, r);

  it('returns one finite point per item', () => {
    expect(pts).toHaveLength(284);
    expect(noNaN(pts)).toBe(true);
  });

  it('places every card on the sphere surface', () => {
    for (const p of pts) expect(Math.hypot(...p.position)).toBeCloseTo(r, 4);
  });

  it('never collapses two cards onto the same spot (no clumps)', () => {
    expect(minPairwise(pts)).toBeGreaterThan(3);
  });
});

/* ------------------------------------------------------------------ *
 * Carousel — helix must not put every card at the same depth, or the
 * DOM z-index ties dither every frame (the "cards flicker" glitch).
 * ------------------------------------------------------------------ */
describe('getCarouselCoordinates', () => {
  const r = getGalleryRadius(284, 30, 0.8);
  const pts = getCarouselCoordinates(284, r);

  it('returns one finite point per item', () => {
    expect(pts).toHaveLength(284);
    expect(noNaN(pts)).toBe(true);
  });

  it('REGRESSION: cards occupy varied depths so z-index cannot tie/flicker', () => {
    const radial = pts.map((p) => Math.hypot(p.position[0], p.position[2]));
    const spread = Math.max(...radial) - Math.min(...radial);
    expect(spread).toBeGreaterThan(0.5); // a single-radius cylinder → spread 0
  });

  it('does not stack two cards on the same spot', () => {
    expect(minPairwise(pts)).toBeGreaterThan(0.5);
  });
});

/* ------------------------------------------------------------------ *
 * createMediaItem — provider detection incl. the new TikTok path, and
 * the unique-id guarantee the whole render keys on.
 * ------------------------------------------------------------------ */
describe('createMediaItem', () => {
  it('detects Google Drive', () => {
    const it0 = createMediaItem(
      'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456/view',
    );
    expect(it0?.provider).toBe('gdrive');
  });

  it('detects YouTube', () => {
    expect(createMediaItem('https://www.youtube.com/watch?v=dQw4w9WgXcQ')?.provider).toBe(
      'youtube',
    );
  });

  it('detects a canonical TikTok video URL as an embed', () => {
    const t = createMediaItem('https://www.tiktok.com/@someone/video/1234567890123456789');
    expect(t?.provider).toBe('tiktok');
    expect(t?.kind).toBe('embed');
  });

  it('gives every item a unique id (render keys depend on it)', () => {
    const url = 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456/view';
    const ids = new Set(Array.from({ length: 50 }, () => createMediaItem(url)?.id));
    expect(ids.size).toBe(50);
  });
});
