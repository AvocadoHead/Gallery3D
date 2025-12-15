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

  const [displayName, setDisplayName] = useState('');
  const [contactWhatsapp, setContactWhatsapp] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const [inputValue, setInputValue] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [contactMenuOpen, setContactMenuOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  /** 🔑 LOAD GALLERY (shared OR default) */
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

    // 🔥 fallback – default 284 artworks
    setGalleryItems(ARTWORK_ITEMS);
  }, []);

  const handleAddMedia = () => {
    const entries = inputValue
      .split(/[,\n]/)
      .map(v => v.trim())
      .filter(Boolean);

    if (!entries.length) return;

    setGalleryItems(prev => [...prev, ...buildMediaItemsFromUrls(entries)]);
    setInputValue('');
  };

  const handleCreateNew = () => {
    setIsClearing(true);
    setSelectedItem(null);
    setBuilderOpen(true);
    setShareLink('');

    setTimeout(() => {
      setGalleryItems([]);
      setIsClearing(false);
    }, 600);
  };

  const sharePayload = useMemo(() => {
    if (!galleryItems.length) return '';
    return `${window.location.origin}${window.location.pathname}?gallery=${encodeGalleryParam(
      galleryItems,
      { displayName, contactWhatsapp, contactEmail }
    )}`;
  }, [galleryItems, displayName, contactWhatsapp, contactEmail]);

  const handleShare = async () => {
    if (!sharePayload) return;

    setShareLink(sharePayload);
    window.history.replaceState(null, '', sharePayload);

    try {
      await navigator.clipboard.writeText(sharePayload);
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 1500);
    } catch {}
  };

  const handleContactClick = () => {
    const phone = sanitizeWhatsapp(contactWhatsapp);
    if (phone && contactEmail) return setContactMenuOpen(v => !v);
    if (phone) return window.open(`https://wa.me/${phone}`, '_blank');
    if (contactEmail) return window.open(`mailto:${contactEmail}`);
    window.open('https://api.whatsapp.com/send/?phone=97236030603', '_blank');
  };

  return (
    <div className="w-full h-screen relative bg-gradient-to-br from-slate-50 to-slate-200 overflow-hidden">

      <Suspense fallback={<Loader />}>
        <Canvas camera={{ position: [0, 0, 75], fov: 50 }}>
          <GalleryScene
            items={galleryItems}
            onSelect={setSelectedItem}
            clearing={isClearing}
          />
        </Canvas>
      </Suspense>

      <Overlay artwork={selectedItem} onClose={() => setSelectedItem(null)} />

      {/* HEADER */}
      <div className="fixed top-8 left-8 z-20">
        <button onClick={() => setBuilderOpen(v => !v)} className="text-left">
          <h1 className="text-3xl font-light">Aether</h1>
          <p className="text-xs uppercase tracking-widest">Gallery</p>
          {displayName && <p className="text-xs">{displayName}</p>}
        </button>

        {builderOpen && (
          <div className="mt-4 w-[520px] bg-white/90 backdrop-blur-xl rounded-3xl p-6 space-y-4 shadow-xl">
            <button
              onClick={handleCreateNew}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg"
            >
              Create new gallery
            </button>

            <textarea
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder="Paste image / video URLs"
              className="w-full h-20 border rounded-xl p-3"
            />

            <div className="flex gap-2">
              <button onClick={handleAddMedia} className="px-3 py-2 bg-slate-900 text-white rounded-lg">
                Add media
              </button>
              <button onClick={handleShare} className="px-3 py-2 border rounded-lg">
                Share
              </button>
            </div>

            {shareLink && (
              <div className="text-xs">
                <button onClick={handleShare} className="underline">
                  Copy link
                </button>
                {toastVisible && <span className="ml-2">Link copied</span>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="fixed bottom-8 right-8 z-20">
        <button
          onClick={handleContactClick}
          className="px-5 py-2 bg-white/80 rounded-full shadow"
        >
          Contact
        </button>

        {contactMenuOpen && (
          <div className="absolute bottom-12 right-0 bg-white rounded-xl shadow border">
            {contactWhatsapp && (
              <button onClick={() => window.open(`https://wa.me/${sanitizeWhatsapp(contactWhatsapp)}`)}>
                WhatsApp
              </button>
            )}
            {contactEmail && (
              <button onClick={() => window.open(`mailto:${contactEmail}`)}>
                Email
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
