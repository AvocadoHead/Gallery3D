import { describe, it, expect } from 'vitest';
import { previewSources } from './ResilientImage';
describe('preview fallback budget', () => {
  it('retries a Drive preview once at a smaller size', () => {
    expect(previewSources('https://drive.google.com/thumbnail?id=abc&sz=w800')).toEqual([
      'https://drive.google.com/thumbnail?id=abc&sz=w800',
      'https://drive.google.com/thumbnail?id=abc&sz=w400',
    ]);
  });
  it('does not retry duplicate or unrelated sources', () => {
    expect(previewSources('https://drive.google.com/thumbnail?id=abc&sz=w400')).toHaveLength(1);
    expect(previewSources('https://example.com/photo.jpg')).toEqual(['https://example.com/photo.jpg']);
    expect(previewSources('')).toEqual([]);
  });
});
