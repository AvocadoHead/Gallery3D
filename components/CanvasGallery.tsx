import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MediaItem, TITLE_SIZE_PX, createTextItem } from '../constants';
import type { TitleStyle } from './FloatingGallery';
import AnimatedVideoThumbnail, { useAnimatedVideoPreviewSource } from './VideoThumbnail';

export type CanvasMode = 'grid' | 'free';

interface CanvasGalleryProps {
  items: MediaItem[];
  onSelect: (item: MediaItem) => void;
  editable: boolean;
  mode: CanvasMode;
  onChangeMode: (mode: CanvasMode) => void;
  onChangeItems: (items: MediaItem[]) => void;
  onExitEdit: () => void;
  mediaScale: number;
  tileGap: number;
  titleDefaults: TitleStyle;
}

type Box = { x: number; y: number; w: number; h: number };

const clamp = (min: number, max: number, v: number) => Math.min(max, Math.max(min, v));

/* ---------- media thumb (shared by both modes) ---------- */
const ItemMedia: React.FC<{ item: MediaItem; titleDefaults: TitleStyle }> = ({ item, titleDefaults }) => {
  const [videoFailed, setVideoFailed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const videoPreviewSource = useAnimatedVideoPreviewSource(item, hovered);

  useEffect(() => {
    setVideoFailed(false);
  }, [item.id, videoPreviewSource]);
  if (item.kind === 'text') {
    const font = item.titleFont || titleDefaults.font || 'Inter';
    const size = TITLE_SIZE_PX[item.titleSize || titleDefaults.size || 'L'];
    const color = item.titleColor || titleDefaults.color || '#0f172a';
    return (
      <div
        className="w-full h-full flex items-center justify-center text-center p-2 leading-tight break-words"
        style={{ fontFamily: `'${font}', sans-serif`, fontSize: size, color, fontWeight: 700 }}
      >
        {item.text || 'Text'}
      </div>
    );
  }
  const showVideoPreview = !!videoPreviewSource && !videoFailed;
  const thumb = item.fallbackPreview || item.previewUrl || item.fullUrl;
  return (
    <div
      className="w-full h-full rounded-xl overflow-hidden bg-gray-50 relative"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      {showVideoPreview ? (
        <AnimatedVideoThumbnail item={item} sourceOverride={videoPreviewSource} className="w-full h-full object-cover" onError={() => setVideoFailed(true)} />
      ) : (
        <img
          src={thumb}
          alt={item.title || 'art'}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          draggable={false}
        />
      )}
      {showVideoPreview && (
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
  );
};

const CanvasGallery: React.FC<CanvasGalleryProps> = ({
  items,
  onSelect,
  editable,
  mode,
  onChangeMode,
  onChangeItems,
  onExitEdit,
  mediaScale,
  tileGap,
  titleDefaults,
}) => {
  const seedW = 240 * mediaScale;
  const gap = Math.max(0, tileGap);
  const viewportRef = useRef<HTMLDivElement>(null);
  const session = useRef<any>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [view, setView] = useState({ tx: 80, ty: 80, scale: 0.8 });
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [editingText, setEditingText] = useState<string | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);

  /* auto grid seed for items without explicit free placement */
  const seedMap = useMemo(() => {
    const cols = Math.max(1, Math.min(6, Math.round(Math.sqrt(items.length || 1))));
    const stride = seedW + gap;
    const m = new Map<string, { x: number; y: number }>();
    items.forEach((it, i) => m.set(it.id, { x: (i % cols) * stride, y: Math.floor(i / cols) * stride }));
    return m;
  }, [items, seedW, gap]);

  const box = (it: MediaItem): Box => {
    const s = seedMap.get(it.id) || { x: 0, y: 0 };
    const w = it.canvas?.w ?? seedW;
    const h = it.canvas?.h ?? (it.kind === 'text' ? 90 : w / (it.aspectRatio || 1));
    return { x: it.canvas?.x ?? s.x, y: it.canvas?.y ?? s.y, w, h };
  };

  const setItems = (fn: (arr: MediaItem[]) => MediaItem[]) => onChangeItems(fn(items));

  const writeCanvas = (it: MediaItem, next: Box): MediaItem => {
    const c: NonNullable<MediaItem['canvas']> = { ...(it.canvas || {}), x: next.x, y: next.y, w: next.w };
    if (it.kind === 'text') c.h = next.h;
    return { ...it, canvas: c };
  };

  // Patch z/rotation without forcing a height onto images (keeps aspect intact).
  const patchFields = (it: MediaItem, fields: Partial<NonNullable<MediaItem['canvas']>>): MediaItem => {
    const b = box(it);
    const base: Partial<NonNullable<MediaItem['canvas']>> = it.canvas || {};
    const c: NonNullable<MediaItem['canvas']> = {
      x: base.x ?? b.x,
      y: base.y ?? b.y,
      w: base.w ?? b.w,
      ...(base.h != null ? { h: base.h } : {}),
      ...(base.z != null ? { z: base.z } : {}),
      ...(base.rotation != null ? { rotation: base.rotation } : {}),
      ...fields,
    };
    return { ...it, canvas: c };
  };

  /* ---------------- keyboard ---------------- */
  useEffect(() => {
    if (!editable) return;
    const down = (e: KeyboardEvent) => {
      if (editingText) return;
      if (e.code === 'Space') setSpaceDown(true);
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected.size) {
        e.preventDefault();
        setItems((arr) => arr.filter((it) => !selected.has(it.id)));
        setSelected(new Set());
      }
      if (e.key === 'Escape') {
        if (selected.size) setSelected(new Set());
        else onExitEdit();
      }
    };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setSpaceDown(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable, editingText, selected, items]);

  /* ---------------- selection helpers ---------------- */
  const selectionBBox = (): Box | null => {
    const boxes = items.filter((it) => selected.has(it.id)).map(box);
    if (!boxes.length) return null;
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    const x2 = Math.max(...boxes.map((b) => b.x + b.w));
    const y2 = Math.max(...boxes.map((b) => b.y + b.h));
    return { x, y, w: x2 - x, h: y2 - y };
  };

  /* ============================================================
     GRID MODE — reorder (native DnD) + resize, CSS reflow
     ============================================================ */
  const dragId = useRef<string | null>(null);
  const resizing = useRef(false);
  const reorder = (overId: string) => {
    const from = items.findIndex((i) => i.id === dragId.current);
    const to = items.findIndex((i) => i.id === overId);
    if (from < 0 || to < 0 || from === to) return;
    const arr = [...items];
    const [m] = arr.splice(from, 1);
    arr.splice(to, 0, m);
    onChangeItems(arr);
  };

  const gridResize = (e: React.PointerEvent, item: MediaItem) => {
    e.stopPropagation();
    e.preventDefault();
    resizing.current = true;
    const startX = e.clientX;
    const startW = box(item).w;
    const move = (ev: PointerEvent) => {
      const w = clamp(80, 900, startW + (ev.clientX - startX));
      setItems((arr) => arr.map((it) => (it.id === item.id ? writeCanvas(it, { ...box(it), w }) : it)));
    };
    const up = () => {
      resizing.current = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const renderGrid = () => (
    <div className="w-full h-full overflow-y-auto no-scrollbar px-4 pt-28 pb-28">
      <div className="flex flex-wrap justify-center items-start max-w-6xl mx-auto" style={{ gap }}>
        {items.map((item) => {
          const w = box(item).w;
          const isSel = selected.has(item.id);
          return (
            <div
              key={item.id}
              data-item={item.id}
              draggable={editable && editingText !== item.id}
              onDragStart={(e) => { if (resizing.current) { e.preventDefault(); return; } dragId.current = item.id; }}
              onDragOver={(e) => { if (editable && dragId.current) { e.preventDefault(); reorder(item.id); } }}
              onDragEnd={() => { dragId.current = null; }}
              onClick={() => {
                if (!editable) { if (item.kind !== 'text') onSelect(item); return; }
                setSelected(new Set([item.id]));
              }}
              onDoubleClick={() => { if (editable && item.kind === 'text') setEditingText(item.id); }}
              className={`relative rounded-2xl bg-white p-2 shadow-lg transition-shadow ${editable ? 'cursor-move' : 'cursor-pointer'} ${isSel ? 'ring-2 ring-blue-500' : ''}`}
              style={{ width: w, height: box(item).h + 16 }}
            >
              {editingText === item.id ? (
                <TextEditor item={item} onCommit={(t) => { setItems((arr) => arr.map((it) => it.id === item.id ? { ...it, text: t } : it)); setEditingText(null); }} />
              ) : (
                <ItemMedia item={item} titleDefaults={titleDefaults} />
              )}
              {editable && (
                <div
                  onPointerDown={(e) => gridResize(e, item)}
                  className="absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow cursor-nwse-resize"
                  title="Drag to resize"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  /* ============================================================
     FREE MODE — absolute, pan/zoom, marquee, group move/resize
     ============================================================ */
  const toWorld = (clientX: number, clientY: number) => {
    const r = viewportRef.current!.getBoundingClientRect();
    return { x: (clientX - r.left - view.tx) / view.scale, y: (clientY - r.top - view.ty) / view.scale };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (mode !== 'free') return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const el = (e.target as HTMLElement).closest('[data-item]') as HTMLElement | null;
    const handle = (e.target as HTMLElement).dataset.handle;

    // Second pointer on empty space → start pinch zoom
    if (pointers.current.size === 2 && !el) {
      const pts = [...pointers.current.values()];
      const cx = (pts[0].x + pts[1].x) / 2;
      const cy = (pts[0].y + pts[1].y) / 2;
      const startDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      session.current = { kind: 'pinch', startDist, startScale: view.scale, cx, cy };
      viewportRef.current?.setPointerCapture(e.pointerId);
      return;
    }

    if (!editable) {
      if (!el) { session.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, tx: view.tx, ty: view.ty }; viewportRef.current?.setPointerCapture(e.pointerId); }
      return;
    }

    if (spaceDown && !el) {
      session.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, tx: view.tx, ty: view.ty };
      viewportRef.current?.setPointerCapture(e.pointerId);
      return;
    }

    if (handle === 'resize') {
      const bbox = selectionBBox()!;
      session.current = { kind: 'resize', sx: e.clientX, bbox, boxes: snapshot() };
      viewportRef.current?.setPointerCapture(e.pointerId);
      return;
    }

    if (el) {
      const id = el.getAttribute('data-item')!;
      let next = new Set(selected);
      if (e.shiftKey) { next.has(id) ? next.delete(id) : next.add(id); }
      else if (!next.has(id)) next = new Set([id]);
      setSelected(next);
      session.current = { kind: 'move', sx: e.clientX, sy: e.clientY, ids: [...next], boxes: snapshot(next), moved: false };
      viewportRef.current?.setPointerCapture(e.pointerId);
      return;
    }

    // empty space → marquee select
    if (!e.shiftKey) setSelected(new Set());
    const w = toWorld(e.clientX, e.clientY);
    session.current = { kind: 'marquee', base: e.shiftKey ? new Set(selected) : new Set<string>() };
    setMarquee({ x0: w.x, y0: w.y, x1: w.x, y1: w.y });
    viewportRef.current?.setPointerCapture(e.pointerId);
  };

  const snapshot = (ids?: Set<string>) => {
    const m = new Map<string, Box>();
    items.forEach((it) => { if (!ids || ids.has(it.id)) m.set(it.id, box(it)); });
    return m;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const s = session.current;
    if (!s) return;
    if (s.kind === 'pinch') {
      const pts = [...pointers.current.values()];
      if (pts.length < 2) return;
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const r = viewportRef.current?.getBoundingClientRect();
      if (!r) return;
      setView((v) => {
        const ns = clamp(0.2, 3, s.startScale * dist / s.startDist);
        const k = ns / v.scale;
        const cx = s.cx - r.left;
        const cy = s.cy - r.top;
        return { scale: ns, tx: cx - (cx - v.tx) * k, ty: cy - (cy - v.ty) * k };
      });
      return;
    }
    if (s.kind === 'pan') { setView((v) => ({ ...v, tx: s.tx + (e.clientX - s.sx), ty: s.ty + (e.clientY - s.sy) })); return; }
    if (s.kind === 'move') {
      const dx = (e.clientX - s.sx) / view.scale;
      const dy = (e.clientY - s.sy) / view.scale;
      if (Math.hypot(e.clientX - s.sx, e.clientY - s.sy) > 3) s.moved = true;
      setItems((arr) => arr.map((it) => {
        const b = s.boxes.get(it.id);
        return b && s.ids.includes(it.id) ? writeCanvas(it, { ...b, x: b.x + dx, y: b.y + dy }) : it;
      }));
      return;
    }
    if (s.kind === 'resize') {
      const bbox: Box = s.bbox;
      const factor = clamp(0.1, 8, (bbox.w + (e.clientX - s.sx) / view.scale) / bbox.w);
      setItems((arr) => arr.map((it) => {
        const b: Box | undefined = s.boxes.get(it.id);
        if (!b || !selected.has(it.id)) return it;
        return writeCanvas(it, {
          x: bbox.x + (b.x - bbox.x) * factor,
          y: bbox.y + (b.y - bbox.y) * factor,
          w: b.w * factor,
          h: b.h * factor,
        });
      }));
      return;
    }
    if (s.kind === 'marquee') {
      const w = toWorld(e.clientX, e.clientY);
      setMarquee((m) => (m ? { ...m, x1: w.x, y1: w.y } : m));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const s = session.current;
    if (s?.kind === 'pinch') { session.current = null; return; }
    session.current = null;
    if (!s) return;
    if (s.kind === 'move' && !s.moved) {
      // treat as click: open lightbox for a single media item
      const id = s.ids[0];
      const it = items.find((i) => i.id === id);
      if (it && s.ids.length === 1) { if (it.kind !== 'text') onSelect(it); }
    }
    if (s.kind === 'marquee' && marquee) {
      const rx = Math.min(marquee.x0, marquee.x1), ry = Math.min(marquee.y0, marquee.y1);
      const rw = Math.abs(marquee.x1 - marquee.x0), rh = Math.abs(marquee.y1 - marquee.y0);
      const hit = new Set(s.base as Set<string>);
      items.forEach((it) => {
        const b = box(it);
        if (b.x < rx + rw && b.x + b.w > rx && b.y < ry + rh && b.y + b.h > ry) hit.add(it.id);
      });
      setSelected(hit);
      setMarquee(null);
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    if (mode !== 'free') return;
    const r = viewportRef.current?.getBoundingClientRect();
    if (!r) return;
    setView((v) => {
      const ns = clamp(0.2, 3, v.scale * (1 - e.deltaY * 0.001));
      const k = ns / v.scale;
      const cx = e.clientX - r.left, cy = e.clientY - r.top;
      return { scale: ns, tx: cx - (cx - v.tx) * k, ty: cy - (cy - v.ty) * k };
    });
  };

  const renderFree = () => {
    const bbox = editable ? selectionBBox() : null;
    return (
      <div
        ref={viewportRef}
        className="w-full h-full overflow-hidden relative touch-none select-none"
        style={{ cursor: spaceDown ? 'grab' : 'default' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => onPointerUp(e)}
        onPointerCancel={(e) => onPointerUp(e)}
        onWheel={onWheel}
      >
        <div className="absolute top-0 left-0 origin-top-left" style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})` }}>
          {items.map((item) => {
            const b = box(item);
            const isSel = selected.has(item.id);
            return (
              <div
                key={item.id}
                data-item={item.id}
                onClick={() => { if (!editable && item.kind !== 'text') onSelect(item); }}
                onDoubleClick={() => { if (editable && item.kind === 'text') setEditingText(item.id); }}
                className={`absolute rounded-2xl bg-white p-2 shadow-lg ${editable ? 'cursor-move' : 'cursor-pointer'} ${isSel ? 'ring-2 ring-blue-500' : ''}`}
                style={{
                  left: b.x, top: b.y, width: b.w, height: b.h + 16,
                  zIndex: item.canvas?.z ?? 1,
                  transform: item.canvas?.rotation ? `rotate(${item.canvas.rotation}deg)` : undefined,
                }}
              >
                {editingText === item.id ? (
                  <TextEditor item={item} onCommit={(t) => { setItems((arr) => arr.map((it) => it.id === item.id ? { ...it, text: t } : it)); setEditingText(null); }} />
                ) : (
                  <ItemMedia item={item} titleDefaults={titleDefaults} />
                )}
              </div>
            );
          })}

          {/* selection bounding box + group resize handle */}
          {bbox && (
            <div className="absolute border-2 border-blue-500/70 pointer-events-none" style={{ left: bbox.x, top: bbox.y, width: bbox.w, height: bbox.h + 16 }}>
              <div data-handle="resize" className="absolute -bottom-2 -right-2 w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow pointer-events-auto cursor-nwse-resize" style={{ transform: `scale(${1 / view.scale})` }} />
            </div>
          )}
        </div>

        {/* marquee rectangle */}
        {marquee && (
          <div
            className="absolute border border-blue-500 bg-blue-500/10 pointer-events-none"
            style={{
              left: Math.min(marquee.x0, marquee.x1) * view.scale + view.tx,
              top: Math.min(marquee.y0, marquee.y1) * view.scale + view.ty,
              width: Math.abs(marquee.x1 - marquee.x0) * view.scale,
              height: Math.abs(marquee.y1 - marquee.y0) * view.scale,
            }}
          />
        )}
      </div>
    );
  };

  /* ---------------- toolbar actions ---------------- */
  const addText = () => {
    const t = createTextItem();
    const center = mode === 'free' && viewportRef.current
      ? toWorld(viewportRef.current.clientWidth / 2, viewportRef.current.clientHeight / 2)
      : { x: 40, y: 40 };
    t.canvas = { x: center.x, y: center.y, w: 220 * mediaScale, h: 90 };
    onChangeItems([...items, t]);
    setSelected(new Set([t.id]));
    setEditingText(t.id);
  };

  const bumpZ = (dir: 1 | -1) => {
    const zs = items.map((it) => it.canvas?.z ?? 1);
    const edge = dir === 1 ? Math.max(...zs, 1) + 1 : Math.min(...zs, 1) - 1;
    setItems((arr) => arr.map((it) => (selected.has(it.id) ? patchFields(it, { z: edge }) : it)));
  };

  const rotateSel = () =>
    setItems((arr) => arr.map((it) => (selected.has(it.id)
      ? patchFields(it, { rotation: ((it.canvas?.rotation ?? 0) + 15) % 360 })
      : it)));

  const arrangeGrid = () => {
    const cols = Math.max(1, Math.min(6, Math.round(Math.sqrt(items.length || 1))));
    const stride = seedW + gap;
    setItems((arr) => arr.map((it, i) => writeCanvas(it, { ...box(it), x: (i % cols) * stride, y: Math.floor(i / cols) * stride })));
  };

  const deleteSel = () => { setItems((arr) => arr.filter((it) => !selected.has(it.id))); setSelected(new Set()); };

  return (
    <div className="w-full h-full relative">
      {mode === 'grid' ? renderGrid() : renderFree()}

      {/* zoom controls (free mode) */}
      {mode === 'free' && (
        <div className="absolute bottom-6 right-6 z-20 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full shadow-lg border border-slate-200 p-1">
          <button onClick={() => setView((v) => ({ ...v, scale: clamp(0.2, 3, v.scale / 1.2) }))} className="w-8 h-8 rounded-full hover:bg-slate-100 text-lg font-bold">−</button>
          <button onClick={() => setView({ tx: 80, ty: 80, scale: 0.8 })} className="px-3 h-8 rounded-full hover:bg-slate-100 text-xs font-bold">Reset</button>
          <button onClick={() => setView((v) => ({ ...v, scale: clamp(0.2, 3, v.scale * 1.2) }))} className="w-8 h-8 rounded-full hover:bg-slate-100 text-lg font-bold">+</button>
        </div>
      )}

      {/* edit toolbar */}
      {editable && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-white/95 backdrop-blur-sm rounded-full shadow-xl border border-slate-200 p-1 text-xs font-bold text-slate-700">
          <div className="inline-flex rounded-full bg-slate-100 p-0.5 mr-1">
            <button onClick={() => onChangeMode('grid')} className={`px-3 py-1.5 rounded-full ${mode === 'grid' ? 'bg-slate-900 text-white' : ''}`}>Grid</button>
            <button onClick={() => onChangeMode('free')} className={`px-3 py-1.5 rounded-full ${mode === 'free' ? 'bg-slate-900 text-white' : ''}`}>Free</button>
          </div>
          <button onClick={addText} className="px-3 py-1.5 rounded-full hover:bg-slate-100">+ Text</button>
          {mode === 'free' && <button onClick={arrangeGrid} className="px-3 py-1.5 rounded-full hover:bg-slate-100" title="Pack into a grid">Tidy</button>}
          {mode === 'free' && selected.size > 0 && (
            <>
              <span className="w-px h-5 bg-slate-200 mx-0.5" />
              <button onClick={() => bumpZ(1)} className="px-2 py-1.5 rounded-full hover:bg-slate-100" title="Bring to front">▲</button>
              <button onClick={() => bumpZ(-1)} className="px-2 py-1.5 rounded-full hover:bg-slate-100" title="Send to back">▼</button>
              <button onClick={rotateSel} className="px-2 py-1.5 rounded-full hover:bg-slate-100" title="Rotate 15°">⟳</button>
            </>
          )}
          {selected.size > 0 && <button onClick={deleteSel} className="px-3 py-1.5 rounded-full hover:bg-red-50 text-red-500">Delete</button>}
          <span className="w-px h-5 bg-slate-200 mx-0.5" />
          <button onClick={onExitEdit} className="px-3 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-500">Done</button>
        </div>
      )}
    </div>
  );
};

/* Inline text editor for a text block. */
const TextEditor: React.FC<{ item: MediaItem; onCommit: (text: string) => void }> = ({ item, onCommit }) => {
  const [val, setVal] = useState(item.text || '');
  return (
    <textarea
      autoFocus
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => onCommit(val)}
      onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onCommit(val); }}
      className="w-full h-full resize-none outline-none text-center bg-transparent p-1 text-slate-900 font-bold"
      onPointerDown={(e) => e.stopPropagation()}
    />
  );
};

export default CanvasGallery;
