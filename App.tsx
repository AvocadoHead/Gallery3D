import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import GalleryScene from './components/FloatingGallery';
import Overlay from './components/Overlay';
import {
  ARTWORK_ITEMS,
  buildMediaItemsFromUrls,
  decodeGalleryParam,
  encodeGalleryParam,
  sanitizeWhatsapp,
  MediaItem,
} from './constants';

const Loader = () => (
  <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
    <div className="w-10 h-10 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
  </div>
);

const App: React.FC = () => {
  const [galleryItems, setGalleryItems] = useState<MediaItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);

  const [builderOpen, setBuilderOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const [displayName, setDisplayName] = useState('');
  const [contactWhatsapp, setContactWhatsapp] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const [toastVisible, setToastVisible] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // ✅ Load shared gallery or default gallery
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('gallery');

    if (encoded) {
      const decoded = decodeGalleryParam(encoded);
      if (decoded?.urls?.length) {
        setGalleryItems(buildMediaItemsFromUrls(decoded.urls));
        setDisplayName(decoded.displayName || '');
        setContactWhatsapp(decoded.contactWhatsapp || '');
        setContactEmail(decoded.contactEmail || '');
        return;
      }
    }

    setGalleryItems(ARTWORK_ITEMS);
  }, []);

  const handleAddMedia = () => {
    const entries = inputValue
      .split(/[,\n]/)
      .map((v) => v.trim())
      .filter(Boolean);

    if (!entries.length) return;

    setGalleryItems((prev) => [...prev, ...buildMediaItemsFromUrls(entries)]);
    setInputValue('');
  };

  const handleCreateNew = () => {
    setIsClearing(true);
    setSelectedItem(null);
    setBuilderOpen(true);

    setTimeout(() => {
      setGalleryItems([]);
      setIsClearing(false);
    }, 450);
  };

  const shareLink = useMemo(() => {
    if (!galleryItems.length) return '';
    const encoded = encodeGalleryParam(galleryItems, {
      displayName,
      contactWhatsapp,
      contactEmail,
    });
    return `${window.location.origin}${window.location.pathname}?gallery=${encoded}`;
  }, [galleryItems, displayName, contactWhatsapp, contactEmail]);

  const handleCopyShare = async () => {
    if (!shareLink) return;

    window.history.replaceState(null, '', shareLink);

    try {
      await navigator.clipboard.writeText(shareLink);
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 1500);
    } catch {
      // ignore
    }
  };

  const openWhatsApp = () => {
    const phone = sanitizeWhatsapp(contactWhatsapp);
    if (!phone) return;
    window.open(`https://wa.me/${phone}`, '_blank');
  };

  const openEmail = () => {
    if (!contactEmail) return;
    window.open(`mailto:${contactEmail}`, '_blank');
  };

  return (
    <div className="w-full h-screen relative bg-gradient-to-br from-slate-50 to-slate-200 overflow-hidden">
      <Suspense fallback={<Loader />}>
        <Canvas camera={{ position: [0, 0, 75], fov: 50 }}>
          <GalleryScene items={galleryItems} onSelect={setSelectedItem} clearing={isClearing} />
        </Canvas>
      </Suspense>

      <Overlay artwork={selectedItem} onClose={() => setSelectedItem(null)} />

      {/* HEADER (clickable) */}
      <div className="fixed top-8 left-8 z-20">
        <button
          onClick={() => setBuilderOpen((v) => !v)}
          className="text-left select-none"
          style={{ cursor: 'pointer' }}
        >
          <h1 className="text-3xl font-light leading-none">Aether</h1>
          <p className="text-xs uppercase tracking-widest opacity-80">Gallery</p>
          {displayName && <p className="text-xs opacity-70 mt-1">{displayName}</p>}
        </button>

        {builderOpen && (
          <div className="mt-4 w-[520px] bg-white/90 backdrop-blur-xl rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleCreateNew}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg"
              >
                Create new gallery
              </button>
              <button onClick={handleCopyShare} className="px-4 py-2 border rounded-lg">
                Copy share link
              </button>
              {toastVisible && <span className="text-sm opacity-70 self-center">Link copied</span>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="border rounded-xl p-3"
              />
              <input
                value={contactWhatsapp}
                onChange={(e) => setContactWhatsapp(e.target.value)}
                placeholder="WhatsApp (digits)"
                className="border rounded-xl p-3"
              />
              <input
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="Email"
                className="border rounded-xl p-3 col-span-2"
              />
            </div>

            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Paste image / video URLs (one per line or separated by commas)"
              className="w-full h-24 border rounded-xl p-3"
            />

            <div className="flex gap-2">
              <button onClick={handleAddMedia} className="px-4 py-2 bg-slate-900 text-white rounded-lg">
                Add media
              </button>
              <div className="text-xs opacity-70 self-center">
                Items: <b>{galleryItems.length}</b>
              </div>
            </div>

            {/* OPTIONAL: donate images if you have them in /public/assets/ */}
            <details className="text-sm">
              <summary className="cursor-pointer opacity-80">Donate (QR)</summary>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <img src="/assets/donate-qr-1.png" alt="Donate QR 1" className="w-full rounded-xl border" />
                <img src="/assets/donate-qr-2.png" alt="Donate QR 2" className="w-full rounded-xl border" />
              </div>
              <div className="text-xs opacity-60 mt-2">
                If your QR filenames differ, update these image paths.
              </div>
            </details>
          </div>
        )}
      </div>

      {/* FOOTER CONTACT (shown on homepage too) */}
      <div className="fixed bottom-8 right-8 z-20 flex gap-2">
        {contactWhatsapp && (
          <button onClick={openWhatsApp} className="px-5 py-2 bg-white/80 rounded-full shadow">
            WhatsApp
          </button>
        )}
        {contactEmail && (
          <button onClick={openEmail} className="px-5 py-2 bg-white/80 rounded-full shadow">
            Email
          </button>
        )}
      </div>
    </div>
  );
};

export default App;
