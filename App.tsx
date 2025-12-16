import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import GalleryScene from './components/FloatingGallery';
import Overlay from './components/Overlay';
import {
  buildDefaultMediaItems,
  buildMediaItemsFromUrls,
  decodeGalleryParam,
  encodeGalleryParam,
  sanitizeWhatsapp,
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
  const shareBase =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://gallery3-d.vercel.app';

  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [galleryItems, setGalleryItems] = useState<MediaItem[]>([]);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [contactWhatsapp, setContactWhatsapp] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [contactMenuOpen, setContactMenuOpen] = useState(false);

  // --- 1) Robust decoding: supports BOTH ?gallery= and #gallery= ---
  useEffect(() => {
    const extractGalleryToken = (): string | null => {
      const href = window.location.href;

      // Try query first (matches your old working links)
      const qMatch = href.match(/[?&]gallery=([^&#]*)/);
      if (qMatch?.[1]) {
        const raw = qMatch[1];
        try {
          return decodeURIComponent(raw);
        } catch {
          return raw;
        }
      }

      // Also support hash form (#gallery=...), without being blocked by the query branch
      const hMatch = href.match(/#gallery=([^&#]*)/);
      if (hMatch?.[1]) {
        const raw = hMatch[1];
        try {
          return decodeURIComponent(raw);
        } catch {
          return raw;
        }
      }

      return null;
    };

    const loadDefaults = () => {
      setIsCustom(false);
      setDisplayName('');
      setContactWhatsapp('');
      setContactEmail('');
      setGalleryItems(buildDefaultMediaItems());
    };

    const syncFromUrl = () => {
      const token = extractGalleryToken();
      if (!token) {
        loadDefaults();
        return;
      }

      try {
        const incoming = decodeGalleryParam(token);

        // Object format: { urls: [...], displayName, contactWhatsapp, contactEmail }
        if (incoming && typeof incoming === 'object' && !Array.isArray(incoming)) {
          const anyIncoming = incoming as any;

          if (Array.isArray(anyIncoming.urls)) {
            setGalleryItems(buildMediaItemsFromUrls(anyIncoming.urls));
            setIsCustom(true);
            setDisplayName(anyIncoming.displayName || '');
            setContactWhatsapp(anyIncoming.contactWhatsapp || '');
            setContactEmail(anyIncoming.contactEmail || '');
            return;
          }
        }

        // Array format: [url1, url2, ...]
        if (Array.isArray(incoming)) {
          setGalleryItems(buildMediaItemsFromUrls(incoming));
          setIsCustom(true);
          setDisplayName('');
          setContactWhatsapp('');
          setContactEmail('');
          return;
        }
      } catch (err) {
        console.error('Parse error:', err);
      }

      loadDefaults();
    };

    syncFromUrl();
    window.addEventListener('popstate', syncFromUrl);
    window.addEventListener('hashchange', syncFromUrl);

    return () => {
      window.removeEventListener('popstate', syncFromUrl);
      window.removeEventListener('hashchange', syncFromUrl);
    };
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

    setTimeout(() => {
      setGalleryItems([]);
      setIsClearing(false);
    }, 650);
  };

  const draftItems = useMemo(() => {
    const entries = inputValue
      .split(/[\n,]/)
      .map((v) => v.trim())
      .filter(Boolean);

    return entries.length ? buildMediaItemsFromUrls(entries) : [];
  }, [inputValue]);

  const effectiveItems = useMemo(() => {
    if (!draftItems.length) return galleryItems;
    return [...galleryItems, ...draftItems];
  }, [draftItems, galleryItems]);

  // --- 2) Share link: keep ?gallery= like the old working version ---
  const sharePayload = useMemo(() => {
    if (!effectiveItems.length) return '';

    // encodeGalleryParam should create a base64 token (array or object).
    // We keep it and simply URL-encode it. (This is what made old links work.)
    const token = encodeGalleryParam(effectiveItems, {
      displayName,
      contactWhatsapp,
      contactEmail,
    });

    // IMPORTANT: encodeURIComponent so + / = never get mangled by messengers
    const safeToken = encodeURIComponent(token);

    return `${shareBase}/?gallery=${safeToken}`;
  }, [contactEmail, contactWhatsapp, displayName, effectiveItems, shareBase]);

  useEffect(() => {
    setShareLink(sharePayload);
  }, [sharePayload]);

  // Put the URL on its own line — helps WhatsApp highlighting a lot
  const shareMessage = useMemo(() => {
    if (!sharePayload) return '';
    return `Look at my Aether gallery:\n${sharePayload}`;
  }, [sharePayload]);

  const handleShare = async () => {
    if (!sharePayload) return;

    // Keep the browser URL in sync (optional but useful)
    window.history.replaceState(null, '', sharePayload);

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Aether Gallery',
          text: shareMessage,
        });
        return;
      }
      await navigator.clipboard.writeText(shareMessage);
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 1600);
    } catch (error) {
      console.warn('Share cancelled', error);
    }
  };

  const handleCopyLink = async () => {
    if (!sharePayload && !shareLink) return;
    const textToCopy = shareMessage || sharePayload || shareLink;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 1600);
    } catch (err) {
      console.warn('Clipboard unavailable', err);
    }
  };

  const waShareUrl = useMemo(() => {
    if (!shareMessage) return '';
    return `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
  }, [shareMessage]);

  const emailShareUrl = useMemo(() => {
    if (!sharePayload) return '';
    const subject = encodeURIComponent('Aether Gallery');
    const body = encodeURIComponent(shareMessage);
    return `mailto:?subject=${subject}&body=${body}`;
  }, [shareMessage, sharePayload]);

  const handleContactClick = () => {
    const phone = sanitizeWhatsapp(contactWhatsapp);

    if (contactEmail && phone) {
      setContactMenuOpen((prev) => !prev);
      return;
    }
    if (phone) {
      window.open(`https://wa.me/${phone}`, '_blank');
      return;
    }
    if (contactEmail) {
      window.open(`mailto:${contactEmail}`);
      return;
    }
    window.open(
      'https://api.whatsapp.com/send/?phone=97236030603&text&type=phone_number&app_absent=0',
      '_blank',
    );
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
            camera={{ position: [0, 0, 75], fov: 50 }}
            dpr={[1, 1.5]}
            gl={{ antialias: false, alpha: true }}
            className="bg-transparent"
          >
            {/* NOTE: use galleryItems (finalized) not effectiveItems (draft)
                keep as-is; if you want live draft preview in 3D, swap to effectiveItems */}
            <GalleryScene onSelect={setSelectedItem} items={galleryItems} clearing={isClearing} />
          </Canvas>
        </Suspense>
      </div>

      {/* UI Overlay */}
      <Overlay artwork={selectedItem} onClose={() => setSelectedItem(null)} />

      {/* Header */}
      <div
        className={`
          fixed top-8 left-8 z-20 pointer-events-auto select-none transition-opacity duration-500 space-y-3
          ${selectedItem ? 'opacity-0 pointer-events-none' : 'opacity-100'}
        `}
      >
        <button onClick={() => setBuilderOpen((prev) => !prev)} className="text-left group">
          <h1 className="text-3xl font-light text-slate-800 tracking-tighter group-hover:text-slate-900">
            Aether
          </h1>
          <p className="text-xs text-slate-400 font-medium tracking-widest uppercase mt-1 ml-1">
            Gallery
          </p>
          {displayName && (
            <p className="text-[11px] text-slate-500 font-semibold mt-1 ml-[2px]">
              {displayName}
            </p>
          )}
        </button>

        {builderOpen && (
          <div className="fixed inset-0 z-30 flex items-start justify-center pt-16 md:items-center md:pt-0 pointer-events-none">
            <div className="w-[720px] max-w-[calc(100vw-2.5rem)] max-h-[82vh] overflow-y-auto bg-gradient-to-br from-white/95 via-white/90 to-slate-50/90 backdrop-blur-2xl border border-white/80 rounded-[32px] shadow-[0_35px_120px_rgba(15,23,42,0.18)] p-7 space-y-6 ring-1 ring-slate-100/80 pointer-events-auto relative">
              <button
                onClick={() => setBuilderOpen(false)}
                className="absolute top-4 right-4 w-9 h-9 inline-flex items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 shadow-sm"
                aria-label="Close builder"
              >
                ×
              </button>

              <div className="flex items-start justify-between gap-3 pr-10">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Build your own gallery</p>
                  <p className="text-xs text-slate-500">Share a custom Aether sphere with your media.</p>
                </div>
                <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                  New
                </span>
              </div>

              {/* Donation Section */}
              <div className="bg-slate-900 text-white rounded-3xl p-5 flex items-center gap-4 shadow-inner ring-1 ring-white/10">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-300 via-amber-400 to-pink-500 flex items-center justify-center text-slate-900 font-bold shadow-lg text-lg">
                  1$
                </div>
                <div className="text-sm leading-tight space-y-1">
                  <p className="font-semibold text-base">Enjoying the gallery?</p>
                  <p className="text-slate-200 text-xs">A friendly tip (1$ / 5₪) keeps the lights on.</p>
                  <div className="flex items-center flex-wrap gap-2 mt-2">
                    <a
                      href="https://www.bitpay.co.il/app/me/705695EF-357F-6632-4165-6032ED7F44AE0278"
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs underline hover:text-amber-200"
                    >
                      Bit
                    </a>
                    <a
                      href="https://links.payboxapp.com/hyc1wV1p0Yb"
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs underline hover:text-amber-200"
                    >
                      Paybox
                    </a>
                    <a
                      href="https://buymeacoffee.com/Optopia"
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs underline hover:text-amber-200"
                    >
                      Buy&nbsp;Me&nbsp;a&nbsp;Coffee
                    </a>
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
                  <div className="grid grid-cols-3 gap-2 text-[11px] font-semibold text-slate-700">
                    <div className="flex flex-col items-center gap-1">
                      <img
                        src="https://raw.githubusercontent.com/AvocadoHead/Gallery3D/main/assets/%20Bit%20QR.png"
                        alt="Bit QR"
                        className="w-full rounded-lg shadow"
                      />
                      <span>Bit</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <img
                        src="https://raw.githubusercontent.com/AvocadoHead/Gallery3D/main/assets/Pay%20Group%20QR.png"
                        alt="Pay QR"
                        className="w-full rounded-lg shadow"
                      />
                      <span>Paybox</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <img
                        src="https://raw.githubusercontent.com/AvocadoHead/Gallery3D/main/assets/Buy%20me%20Coffee%20QR.png"
                        alt="Buy Me a Coffee QR"
                        className="w-full rounded-lg shadow"
                      />
                      <span>Buy me cofee</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-auto">054-773-1650 works for both.</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs text-slate-600">
                <label className="flex flex-col gap-1 p-3 rounded-xl bg-white/70 border border-slate-100">
                  <span className="font-semibold text-slate-800">Display name</span>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Maya Cohen"
                    className="rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </label>

                <label className="flex flex-col gap-1 p-3 rounded-xl bg-white/70 border border-slate-100">
                  <span className="font-semibold text-slate-800">WhatsApp</span>
                  <input
                    value={contactWhatsapp}
                    onChange={(e) => setContactWhatsapp(e.target.value)}
                    placeholder="972... or local"
                    className="rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </label>

                <label className="flex flex-col gap-1 p-3 rounded-xl bg-white/70 border border-slate-100">
                  <span className="font-semibold text-slate-800">Email</span>
                  <input
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="artist@aether.com"
                    className="rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </label>
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
                    <span>
                      {galleryItems.length ? `${galleryItems.length} media in your sphere` : 'Add your first item'}
                    </span>
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
                    <div className="space-y-3 rounded-2xl bg-white/70 border border-slate-100 p-3">
                      <p className="font-semibold text-slate-800 text-xs">Share as easy as 1-2-3</p>

                      <div className="flex flex-wrap gap-2">
                        <a
                          href={waShareUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-green-500 text-white shadow hover:bg-green-600 transition flex items-center gap-1"
                        >
                          WhatsApp
                        </a>

                        <a
                          href={emailShareUrl}
                          className="px-3 py-1.5 rounded-lg bg-blue-500 text-white shadow hover:bg-blue-600 transition flex items-center gap-1"
                        >
                          Email
                        </a>

                        <button
                          onClick={handleCopyLink}
                          className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-700 shadow hover:bg-slate-300 transition"
                        >
                          Copy Link
                        </button>
                      </div>

                      <p className="p-2 bg-slate-100 rounded border border-slate-200 font-mono text-[10px] break-all select-all whitespace-pre-wrap">
                        {shareMessage}
                      </p>

                      {toastVisible && (
                        <span className="text-emerald-600 font-semibold animate-pulse">
                          Copied to clipboard!
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Optional contact UI hook — you already have handler + menu state */}
      <button
        onClick={handleContactClick}
        className="fixed bottom-6 left-6 z-20 px-3 py-2 rounded-xl bg-white/70 border border-slate-200 shadow hover:bg-white transition text-xs font-semibold text-slate-800"
      >
        Contact
      </button>

      {contactMenuOpen && (
        <div className="fixed bottom-16 left-6 z-30 bg-white/90 border border-slate-200 rounded-xl shadow p-2 text-xs space-y-1">
          {contactWhatsapp && (
            <button
              className="block w-full text-left px-2 py-1 rounded hover:bg-slate-100"
              onClick={() => {
                const phone = sanitizeWhatsapp(contactWhatsapp);
                if (phone) window.open(`https://wa.me/${phone}`, '_blank');
                setContactMenuOpen(false);
              }}
            >
              WhatsApp
            </button>
          )}
          {contactEmail && (
            <button
              className="block w-full text-left px-2 py-1 rounded hover:bg-slate-100"
              onClick={() => {
                window.open(`mailto:${contactEmail}`, '_blank');
                setContactMenuOpen(false);
              }}
            >
              Email
            </button>
          )}
          <button
            className="block w-full text-left px-2 py-1 rounded hover:bg-slate-100 text-slate-500"
            onClick={() => setContactMenuOpen(false)}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
