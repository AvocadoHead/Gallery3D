import React, { useEffect, useState } from 'react';

// Retry only a distinct, smaller Drive preview. Never download the multi-MB
// original for every thumbnail, or loop on inaccessible/private source files.
export function previewSources(src: string): string[] {
  try {
    const url = new URL(src);
    if (url.hostname === 'drive.google.com' && url.pathname === '/thumbnail' && url.searchParams.has('id')) {
      const fallback = new URL(url);
      fallback.searchParams.set('sz', 'w400');
      return [...new Set([src, fallback.href])];
    }
  } catch { /* invalid/empty sources become an explicit unavailable card */ }
  return src ? [src] : [];
}

type Props = React.ImgHTMLAttributes<HTMLImageElement> & { src: string };
export default function ResilientImage({ src, onError, ...props }: Props) {
  const [attempt, setAttempt] = useState({ src, index: 0 });
  const sources = previewSources(src);
  const index = attempt.src === src ? attempt.index : 0;
  useEffect(() => setAttempt({ src, index: 0 }), [src]);
  if (index >= sources.length) {
    return <div role="img" aria-label={`${props.alt || 'Image'} unavailable`} className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-500 text-xs text-center p-3">Preview unavailable</div>;
  }
  return <img {...props} src={sources[index]} onError={(event) => {
    setAttempt({ src, index: index + 1 });
    if (index + 1 >= sources.length) onError?.(event);
  }} />;
}
