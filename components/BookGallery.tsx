import React, { useMemo, useRef, useState, forwardRef } from 'react';
// react-pageflip (StPageFlip) — a proven, battle-tested flip-book engine, so we
// don't hand-roll fragile 3D page-turn math.
import HTMLFlipBook from 'react-pageflip';
import { MediaItem, TITLE_SIZE_PX } from '../constants';
import type { TitleStyle } from './FloatingGallery';

// react-pageflip requires every setting as a prop in its typings; cast to a
// permissive type so we can pass only the ones we care about.
const FlipBook = HTMLFlipBook as unknown as React.ComponentType<any>;

export type BookPerPage = 1 | 2 | 4;

interface BookGalleryProps {
  items: MediaItem[];
  onSelect: (item: MediaItem) => void;
  perPage: BookPerPage;
  title?: string;
  titleDefaults: TitleStyle;
}

/* A single media/text cell inside a page. */
const Cell: React.FC<{ item: MediaItem; onSelect: (i: MediaItem) => void; titleDefaults: TitleStyle }> = ({ item, onSelect, titleDefaults }) => {
  if (item.kind === 'text') {
    const font = item.titleFont || titleDefaults.font || 'Inter';
    const size = TITLE_SIZE_PX[item.titleSize || titleDefaults.size || 'L'];
    const color = item.titleColor || titleDefaults.color || '#0f172a';
    return (
      <div className="w-full h-full flex items-center justify-center text-center p-3 break-words" style={{ fontFamily: `'${font}', sans-serif`, fontSize: size, color, fontWeight: 700 }}>
        {item.text || 'Text'}
      </div>
    );
  }
  const thumb = item.fallbackPreview || item.previewUrl || item.fullUrl;
  return (
    <button onClick={() => onSelect(item)} className="group relative w-full h-full rounded-lg overflow-hidden bg-slate-100 block">
      <img src={thumb} alt={item.title || 'art'} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-full h-full object-cover" draggable={false} />
      {item.kind === 'video' && (
        <div className="absolute top-2 right-2 bg-black/50 p-1.5 rounded-full backdrop-blur-sm">
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        </div>
      )}
      {item.title && (
        <div className="absolute inset-x-0 bottom-0 px-2 py-1 bg-gradient-to-t from-black/70 to-transparent">
          <span className="block truncate text-white text-xs font-semibold">{item.title}</span>
        </div>
      )}
    </button>
  );
};

/* One book page (must forward a ref for react-pageflip). */
const Page = forwardRef<HTMLDivElement, { children: React.ReactNode; hard?: boolean }>(({ children, hard }, ref) => (
  <div ref={ref} data-density={hard ? 'hard' : 'soft'} className="bg-white overflow-hidden">
    <div className="w-full h-full p-4">{children}</div>
  </div>
));
Page.displayName = 'Page';

const gridForPerPage: Record<BookPerPage, string> = {
  1: 'grid-cols-1 grid-rows-1',
  2: 'grid-cols-1 grid-rows-2',
  4: 'grid-cols-2 grid-rows-2',
};

const BookGallery: React.FC<BookGalleryProps> = ({ items, onSelect, perPage, title, titleDefaults }) => {
  const bookRef = useRef<any>(null);
  const [page, setPage] = useState(0);

  const pages = useMemo(() => {
    const chunks: MediaItem[][] = [];
    for (let i = 0; i < items.length; i += perPage) chunks.push(items.slice(i, i + perPage));
    return chunks;
  }, [items, perPage]);

  const totalLeaves = pages.length + 2; // + front & back cover

  if (!items.length) {
    return <div className="w-full h-full flex items-center justify-center text-slate-400">Add media to build your book.</div>;
  }

  const flip = (dir: 1 | -1) => {
    const api = bookRef.current?.pageFlip?.();
    if (!api) return;
    dir === 1 ? api.flipNext() : api.flipPrev();
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center pt-24 pb-16 px-4">
      <FlipBook
        ref={bookRef}
        width={420}
        height={560}
        size="stretch"
        minWidth={280}
        maxWidth={640}
        minHeight={380}
        maxHeight={780}
        maxShadowOpacity={0.5}
        showCover
        mobileScrollSupport
        disableFlipByClick /* clicks open items; turn via corners or the arrows */
        useMouseEvents
        drawShadow
        className=""
        style={{}}
        onFlip={(e: any) => setPage(e.data)}
      >
        {/* front cover */}
        <Page hard>
          <div className="w-full h-full rounded-lg bg-gradient-to-br from-slate-800 to-slate-950 text-white flex flex-col items-center justify-center text-center p-6">
            <div className="text-4xl mb-3">◈</div>
            <h2 className="text-xl font-light tracking-wide" style={{ fontFamily: `'${titleDefaults.font || 'Inter'}', sans-serif` }}>{title || 'Gallery'}</h2>
            <p className="text-[11px] text-slate-400 mt-3 uppercase tracking-widest">{items.length} pieces</p>
          </div>
        </Page>

        {/* content pages */}
        {pages.map((chunk, i) => (
          <Page key={i}>
            <div className={`w-full h-full grid gap-3 ${gridForPerPage[perPage]}`}>
              {chunk.map((item) => (
                <Cell key={item.id} item={item} onSelect={onSelect} titleDefaults={titleDefaults} />
              ))}
            </div>
          </Page>
        ))}

        {/* back cover */}
        <Page hard>
          <div className="w-full h-full rounded-lg bg-gradient-to-br from-slate-800 to-slate-950 text-white flex items-center justify-center text-sm text-slate-400">
            The End
          </div>
        </Page>
      </FlipBook>

      {/* navigation */}
      <div className="mt-5 flex items-center gap-4">
        <button onClick={() => flip(-1)} disabled={page <= 0} className="w-10 h-10 rounded-full bg-white shadow border border-slate-200 text-slate-700 disabled:opacity-40 hover:bg-slate-50 transition flex items-center justify-center">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <span className="text-xs font-semibold text-slate-500 tabular-nums">{Math.min(page + 1, totalLeaves)} / {totalLeaves}</span>
        <button onClick={() => flip(1)} disabled={page >= totalLeaves - 1} className="w-10 h-10 rounded-full bg-white shadow border border-slate-200 text-slate-700 disabled:opacity-40 hover:bg-slate-50 transition flex items-center justify-center">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </div>
  );
};

export default BookGallery;
