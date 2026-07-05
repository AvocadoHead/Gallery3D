import React, { useMemo, useRef, useState } from 'react';
import { MediaItem } from '../constants';

interface CanvasGalleryProps {
  items: MediaItem[];
  onSelect: (item: MediaItem) => void;
  /** Owner is editing (builder open): enables drag-to-move + resize. */
  editable: boolean;
  /** Persist a moved/resized item's placement (Phase 6.2). */
  onCommit: (id: string, canvas: { x: number; y: number; w: number }) => void;
  mediaScale: number;
}

type Box = { x: number; y: number; w: number };
type Session =
  | { kind: 'pan'; sx: number; sy: number; tx: number; ty: number }
  | { kind: 'move' | 'resize'; id: string; sx: number; sy: number; box: Box; moved: boolean };

const clamp = (min: number, max: number, v: number) => Math.min(max, Math.max(min, v));

const CanvasGallery: React.FC<CanvasGalleryProps> = ({ items, onSelect, editable, onCommit, mediaScale }) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const session = useRef<Session | null>(null);
  const [view, setView] = useState({ tx: 80, ty: 80, scale: 0.8 });
  const [draft, setDraft] = useState<{ id: string; box: Box } | null>(null);

  // Auto grid seed for items without an explicit canvas placement.
  const cols = Math.max(1, Math.min(6, Math.round(Math.sqrt(items.length || 1))));
  const seedW = 240 * mediaScale;
  const stride = seedW + 48;
  const seedFor = (i: number): Box => ({
    x: (i % cols) * stride,
    y: Math.floor(i / cols) * stride,
    w: seedW,
  });

  const layoutMap = useMemo(() => {
    const m = new Map<string, Box>();
    items.forEach((it, i) => m.set(it.id, it.canvas ?? seedFor(i)));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, cols, seedW]);

  const boxFor = (id: string): Box =>
    (draft && draft.id === id ? draft.box : layoutMap.get(id)) ?? { x: 0, y: 0, w: seedW };

  const onPointerDown = (e: React.PointerEvent) => {
    const el = (e.target as HTMLElement).closest('[data-canvas-item]') as HTMLElement | null;

    if (el && editable) {
      const id = el.getAttribute('data-canvas-item')!;
      const isHandle = (e.target as HTMLElement).dataset.resize === 'true';
      session.current = {
        kind: isHandle ? 'resize' : 'move',
        id,
        sx: e.clientX,
        sy: e.clientY,
        box: boxFor(id),
        moved: false,
      };
    } else if (el && !editable) {
      return; // read-only: let the item's onClick open the lightbox
    } else {
      session.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, tx: view.tx, ty: view.ty };
    }
    viewportRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const s = session.current;
    if (!s) return;
    if (s.kind === 'pan') {
      setView((v) => ({ ...v, tx: s.tx + (e.clientX - s.sx), ty: s.ty + (e.clientY - s.sy) }));
      return;
    }
    const dx = (e.clientX - s.sx) / view.scale;
    const dy = (e.clientY - s.sy) / view.scale;
    if (Math.hypot(e.clientX - s.sx, e.clientY - s.sy) > 4) s.moved = true;
    if (s.kind === 'move') {
      setDraft({ id: s.id, box: { x: s.box.x + dx, y: s.box.y + dy, w: s.box.w } });
    } else {
      setDraft({ id: s.id, box: { x: s.box.x, y: s.box.y, w: Math.max(80, s.box.w + dx) } });
    }
  };

  const onPointerUp = () => {
    const s = session.current;
    session.current = null;
    if (!s || s.kind === 'pan') return;
    if (s.moved && draft) {
      onCommit(s.id, draft.box);
    } else if (s.kind === 'move' && !s.moved) {
      const it = items.find((i) => i.id === s.id);
      if (it) onSelect(it);
    }
    setDraft(null);
  };

  const onWheel = (e: React.WheelEvent) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    setView((v) => {
      const ns = clamp(0.2, 3, v.scale * (1 - e.deltaY * 0.001));
      const k = ns / v.scale;
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      return { scale: ns, tx: cx - (cx - v.tx) * k, ty: cy - (cy - v.ty) * k };
    });
  };

  const zoomBy = (factor: number) =>
    setView((v) => {
      const ns = clamp(0.2, 3, v.scale * factor);
      const rect = viewportRef.current?.getBoundingClientRect();
      const cx = (rect?.width ?? 0) / 2;
      const cy = (rect?.height ?? 0) / 2;
      const k = ns / v.scale;
      return { scale: ns, tx: cx - (cx - v.tx) * k, ty: cy - (cy - v.ty) * k };
    });

  return (
    <div
      ref={viewportRef}
      className="w-full h-full overflow-hidden relative touch-none select-none"
      style={{ cursor: session.current?.kind === 'pan' ? 'grabbing' : 'grab' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})` }}
      >
        {items.map((item) => {
          const box = boxFor(item.id);
          const h = box.w / (item.aspectRatio || 1);
          const thumb = item.fallbackPreview || item.previewUrl || item.fullUrl;
          return (
            <div
              key={item.id}
              data-canvas-item={item.id}
              onClick={() => { if (!editable) onSelect(item); }}
              className={`absolute rounded-2xl bg-white p-2 shadow-lg ${editable ? 'cursor-move ring-1 ring-blue-300/60' : 'cursor-pointer'}`}
              style={{ left: box.x, top: box.y, width: box.w, height: h + 16 }}
            >
              <div className="w-full h-full rounded-xl overflow-hidden bg-gray-50 relative">
                <img
                  src={thumb}
                  alt={item.title || 'art'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  draggable={false}
                />
                {item.kind === 'video' && (
                  <div className="absolute top-2 right-2 bg-black/50 p-1.5 rounded-full backdrop-blur-sm pointer-events-none">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  </div>
                )}
                {item.title && (
                  <div className="absolute inset-x-0 bottom-0 px-2 py-1.5 bg-gradient-to-t from-black/70 to-transparent pointer-events-none">
                    <span className="block truncate text-white text-sm font-semibold">{item.title}</span>
                  </div>
                )}
              </div>
              {editable && (
                <div
                  data-resize="true"
                  className="absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow cursor-nwse-resize"
                  title="Drag to resize"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full shadow-lg border border-slate-200 p-1">
        <button onClick={() => zoomBy(1 / 1.2)} className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-700 text-lg font-bold">−</button>
        <button onClick={() => setView({ tx: 80, ty: 80, scale: 0.8 })} className="px-3 h-8 rounded-full hover:bg-slate-100 text-slate-600 text-xs font-bold">Reset</button>
        <button onClick={() => zoomBy(1.2)} className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-700 text-lg font-bold">+</button>
      </div>

      {editable && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-full shadow-lg">
          Edit mode · drag to move, corner to resize
        </div>
      )}
    </div>
  );
};

export default CanvasGallery;
