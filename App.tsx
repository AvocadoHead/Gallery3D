import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import GalleryScene from './components/FloatingGallery';
import Overlay from './components/Overlay';
import {
  buildDefaultMediaItems,
  buildMediaItemsFromUrls,
  decodeGalleryParam,
  encodeGalleryParam,
  MediaItem,
} from './constants';

const Loader = () => (
  <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
    </div>
  </div>
);

const App: React.FC = () => {
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [galleryItems, setGalleryItems] = useState<MediaItem[]>([]);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    const extractGallery = () => {
      const params = new URLSearchParams(window.location.search);
      const encoded = params.get('gallery');
      if (encoded) return encoded;

      const match = window.location.href.match(/[?&]gallery=([^&#]+)/);
      return match ? match[1] : null;
    };

    const incoming = decodeGalleryParam(extractGallery());
    if (incoming.length) {
      setGalleryItems(buildMediaItemsFromUrls(incoming));
      setIsCustom(true);
      return;
    }
    setGalleryItems(buildDefaultMediaItems());
  }, []);

  const handleAddMedia = () => {
    const entries = inputValue
      .split(/[,\n]/)
      .map((v) => v.trim())
      .filter(Boolean);
    if (!entries.length) return;
    const nextItems = buildMediaItemsFromUrls(entries);
    setGalleryItems((prev) => [...prev, ...nextItems]);
    setInputValue('');
    setSelectedItem(null);
  };

  const handleCreateNew = () => {
    setIsClearing(true);
    setIsCustom(true);
    setSelectedItem(null);
    setBuilderOpen(true);
    setShareLink('');

    // Gentle wipe-out animation before emptying items
    setTimeout(() => {
      setGalleryItems([]);
      setIsClearing(false);
    }, 650);
  };

  const sharePayload = useMemo(() => {
    if (!galleryItems.length) return '';
    return `${window.location.origin}${window.location.pathname}?gallery=${encodeGalleryParam(galleryItems)}`;
  }, [galleryItems]);

  const handleShare = async () => {
    if (!sharePayload) return;
    setShareLink(sharePayload);
    window.history.replaceState(null, '', sharePayload);
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Aether Gallery', url: sharePayload });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(sharePayload);
      }
    } catch (error) {
      console.warn('Share cancelled', error);
    }
  };

  return (
    <div className="w-full h-screen relative bg-gradient-to-br from-[#f8fafc] to-[#e2e8f0] overflow-hidden">
      
      {/* 3D Scene Wrapper */}
      <div
        className={`
          absolute inset-0 transition-all duration-700 ease-out
          ${selectedItem ? 'scale-105 blur-sm opacity-50' : 'scale-100 blur-0 opacity-100'}
        `}
      >
        <Suspense fallback={<Loader />}>
          <Canvas
            // Position z: 75 ensures the whole sphere (radius 58) is visible on load
            camera={{ position: [0, 0, 75], fov: 50 }}
            dpr={[1, 1.5]}
            gl={{ antialias: false, alpha: true }}
            className="bg-transparent"
          >
            <GalleryScene onSelect={setSelectedItem} items={galleryItems} clearing={isClearing} />
          </Canvas>
        </Suspense>
      </div>

      {/* UI Overlay for Zoomed Image */}
      <Overlay artwork={selectedItem} onClose={() => setSelectedItem(null)} />

      {/* Header */}
      <div className={`
        fixed top-8 left-8 z-20 pointer-events-auto select-none transition-opacity duration-500 space-y-3
        ${selectedItem ? 'opacity-0 pointer-events-none' : 'opacity-100'}
      `}>
        <button
          onClick={() => setBuilderOpen((prev) => !prev)}
          className="text-left group"
        >
          <h1 className="text-3xl font-light text-slate-800 tracking-tighter group-hover:text-slate-900">Aether</h1>
          <p className="text-xs text-slate-400 font-medium tracking-widest uppercase mt-1 ml-1">Gallery</p>
        </button>

        {builderOpen && (
          <div className="w-[540px] max-w-[calc(100vw-2.5rem)] bg-gradient-to-br from-white/90 via-white/85 to-slate-50/85 backdrop-blur-xl border border-white/80 rounded-[28px] shadow-2xl p-6 space-y-5 ring-1 ring-slate-100/70">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">Build your own gallery</p>
                <p className="text-xs text-slate-500">Share a custom Aether sphere with your media.</p>
              </div>
              <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">New</span>
            </div>

            <div className="bg-slate-900 text-white rounded-2xl p-4 flex items-center gap-3 shadow-inner ring-1 ring-white/10">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-300 via-amber-400 to-pink-500 flex items-center justify-center text-slate-900 font-bold shadow-lg">1$</div>
              <div className="text-sm leading-tight space-y-1">
                <p className="font-semibold text-base">Enjoying the gallery?</p>
                <p className="text-slate-200 text-xs">A friendly tip (1$ / 5₪) keeps the lights on.</p>
                <div className="flex items-center flex-wrap gap-2 mt-2">
                  <a href="https://www.bitpay.co.il/app/me/705695EF-357F-6632-4165-6032ED7F44AE0278" target="_blank" rel="noreferrer" className="text-xs underline hover:text-amber-200">Bit</a>
                  <a href="https://links.payboxapp.com/hyc1wV1p0Yb" target="_blank" rel="noreferrer" className="text-xs underline hover:text-amber-200">Pay</a>
                  <a href="https://pay.google.com" target="_blank" rel="noreferrer" className="text-xs underline hover:text-amber-200">Google&nbsp;Pay</a>
                  <a href="https://buymeacoffee.com/Optopia" target="_blank" rel="noreferrer" className="text-xs underline hover:text-amber-200">Buy&nbsp;Me&nbsp;a&nbsp;Coffee</a>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs text-slate-600">
              <div className="flex flex-col gap-2 p-3 rounded-xl bg-white/70 border border-slate-100">
                <p className="font-semibold text-slate-800">Create</p>
                <p>Start clean and drop links (images or videos) separated by commas.</p>
                <button
                  onClick={handleCreateNew}
                  className="mt-auto inline-flex items-center justify-center px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold shadow-md hover:shadow-lg hover:-translate-y-[1px] transition"
                >
                  Create new gallery
                </button>
              </div>
              <div className="flex flex-col gap-2 p-3 rounded-xl bg-white/70 border border-slate-100">
                <p className="font-semibold text-slate-800">Donate</p>
                <p>Quick scan for Israeli friends.</p>
                <div className="grid grid-cols-3 gap-2">
                  <img src="https://raw.githubusercontent.com/AvocadoHead/Gallery3D/main/assets/%20Bit%20QR.png" alt="Bit QR" className="w-full rounded-lg shadow" />
                  <img src="https://raw.githubusercontent.com/AvocadoHead/Gallery3D/main/assets/Pay%20Group%20QR.png" alt="Pay QR" className="w-full rounded-lg shadow" />
                  <img src="https://raw.githubusercontent.com/AvocadoHead/Gallery3D/main/assets/Buy%20me%20Coffee%20QR.png" alt="Buy Me a Coffee QR" className="w-full rounded-lg shadow" />
                </div>
                <p className="text-[10px] text-slate-500 mt-auto">054-773-1650 works for both.</p>
              </div>
            </div>

            {isCustom && (
              <div className="space-y-3 rounded-2xl bg-white/70 border border-slate-100 p-3">
                <label className="text-xs text-slate-700 font-semibold">Paste media URLs</label>
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Drop Google Drive, YouTube, Vimeo, mp4... use commas or line breaks"
                  className="w-full h-20 rounded-xl border border-slate-200 bg-white/60 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{galleryItems.length ? `${galleryItems.length} media in your sphere` : 'Add your first item'}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddMedia}
                      className="px-3 py-2 rounded-lg bg-slate-900 text-white font-semibold shadow hover:-translate-y-[1px] transition"
                    >
                      Add media
                    </button>
                    <button
                      onClick={handleShare}
                      className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:-translate-y-[1px] transition"
                    >
                      Finalize & share
                    </button>
                  </div>
                </div>
                {shareLink && (
                  <div className="flex flex-col gap-2 text-xs text-slate-600">
                    <p className="font-semibold text-slate-800">Share as easy as 1-2-3</p>
                    <div className="flex flex-wrap gap-2">
                      <a
                        className="px-3 py-1.5 rounded-full bg-green-500 text-white font-semibold shadow"
                        href={`https://api.whatsapp.com/send?text=${encodeURIComponent('Look at my Aether gallery ' + shareLink)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        WhatsApp
                      </a>
                      <a
                        className="px-3 py-1.5 rounded-full bg-blue-600 text-white font-semibold shadow"
                        href={`mailto:?subject=Aether%20gallery&body=${encodeURIComponent(shareLink)}`}
                      >
                        Email
                      </a>
                      <button
                        className="px-3 py-1.5 rounded-full bg-slate-200 text-slate-800 font-semibold shadow"
                        onClick={() => navigator.clipboard?.writeText(shareLink)}
                      >
                        Copy link
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500">Recipients open the link and instantly see your uploaded packet.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={`
        fixed bottom-8 right-8 z-20 transition-opacity duration-500
        ${selectedItem ? 'opacity-0 pointer-events-none' : 'opacity-100'}
      `}>
        <a
          href="https://api.whatsapp.com/send/?phone=97236030603&text&type=phone_number&app_absent=0"
          target="_blank" 
          rel="noreferrer"
          className="flex items-center gap-3 px-5 py-2.5 bg-white/80 backdrop-blur-sm rounded-full shadow-sm hover:shadow-md hover:bg-white transition-all duration-300 text-slate-600 hover:text-slate-900 text-sm font-medium border border-white"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
          Contact
        </a>
      </div>
    </div>
  );
};

export default App;
