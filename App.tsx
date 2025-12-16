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

  // ---- helpers ----
  const splitUrls = (text: string) =>
    text
      .split(/[\n,]/)
      .map((v) => v.trim())
      .filter(Boolean);

  // Extract the ORIGINAL url field from MediaItem safely (depends on your constants implementation)
  const mediaItemToUrl = (item: any): string => {
    return (
      item?.sourceUrl ||
      item?.originalUrl ||
      item?.url ||
      item?.href ||
      item?.src ||
      ''
    );
  };

  // --- 1) URL PARAM PARSING (supports ?gallery= and #gallery= and extra params) ---
  useEffect(() => {
    const getParamFromHref = (key: string): string | null => {
      const href = window.location.href;

      // Prefer query (?key=)
      const qMatch = href.match(new RegExp(`[?&]${key}=([^&#]*)`));
      if (qMatch?.[1]) return qMatch[1];

      // Fallback hash (#key=)
      const hMatch = href.match(new RegExp(`[#&]${key}=([^&#]*)`));
      if (hMatch?.[1]) return hMatch[1];

      return null;
    };

    const decodeLoose = (v: string) => {
      try {
        // decodeURIComponent but keep + as + (messengers sometimes mutate it)
        const d = decodeURIComponent(v);
        return d.replace(/ /g, '+');
      } catch {
        return v.replace(/ /g, '+');
      }
    };

    const loadDefaults = () => {
      setIsCustom(false);
      setDisplayName('');
      setContactWhatsapp('');
      setContactEmail('');
      setGalleryItems(buildDefaultMediaItems());
    };

    const syncFromUrl = () => {
      // read simple params
      const nameRaw = getParamFromHref('name');
      const waRaw = getParamFromHref('wa');
      const emailRaw = getParamFromHref('email');

      const name = nameRaw ? decodeLoose(nameRaw) : '';
      const wa = waRaw ? decodeLoose(waRaw) : '';
      const email = emailRaw ? decodeLoose(emailRaw) : '';

      const galleryRaw = getParamFromHref('gallery');

      if (!galleryRaw) {
        loadDefaults();
        return;
      }

      const token = decodeLoose(galleryRaw);

      try {
        // decodeGalleryParam MUST return either:
        //  - Array<string> (old working format)
        //  - Object with { urls: string[] } (we still support it for backward compatibility)
        const incoming: any = decodeGalleryParam(token);

        let urls: string[] | null = null;

        if (Array.isArray(incoming)) urls = incoming;
        else if (incoming?.urls && Array.isArray(incoming.urls)) urls = incoming.urls;

        if (!urls || !urls.length) {
          loadDefaults();
          return;
        }

        setGalleryItems(buildMediaItemsFromUrls(urls));
        setIsCustom(true);

        // Prefer explicit query params (new approach)
        // If missing, fallback to old object payload if present
        setDisplayName(name || incoming?.displayName || '');
        setContactWhatsapp(wa || incoming?.contactWhatsapp || '');
        setContactEmail(email || incoming?.contactEmail || '');
      } catch (err) {
        console.error('Parse error:', err);
        loadDefaults();
      }
    };

    syncFromUrl();
    window.addEventListener('popstate', syncFromUrl);
    window.addEventListener('hashchange', syncFromUrl);

    return () => {
      window.removeEventListener('popstate', syncFromUrl);
      window.removeEventListener('hashchange', syncFromUrl);
    };
  }, []);

  // --- builder logic ---
  const handleAddMedia = () => {
    const entries = splitUrls(inputValue);
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

  // Draft items preview (not yet committed)
  const draftUrls = useMemo(() => splitUrls(inputValue), [inputValue]);
  const draftItems = useMemo(
    () => (draftUrls.length ? buildMediaItemsFromUrls(draftUrls) : []),
    [draftUrls],
  );

  const effectiveItems = useMemo(() => {
    if (!draftItems.length) return galleryItems;
    return [...galleryItems, ...draftItems];
  }, [draftItems, galleryItems]);

  // --- 2) SHARE URL GENERATION (BACK TO OLD WORKING FORMAT) ---
  const sharePayload = useMemo(() => {
    // IMPORTANT:
    // Encode ONLY the URL ARRAY (old WyJ... format).
    // Contact info goes as separate plain params (name/wa/email).
    const urls = effectiveItems
      .map(mediaItemToUrl)
      .map((u) => u.trim())
      .filter(Boolean);

    if (!urls.length) return '';

    // This must produce the old token style, i.e. base64(JSON.stringify(urls))
    const token = encodeGalleryParam(urls);

    const q = new URLSearchParams();
    q.set('gallery', token);

    if (displayName.trim()) q.set('name', displayName.trim());
    if (contactWhatsapp.trim()) q.set('wa', contactWhatsapp.trim());
    if (contactEmail.trim()) q.set('email', contactEmail.trim());

    return `${shareBase}/?${q.toString()}`;
  }, [effectiveItems, displayName, contactWhatsapp, contactEmail, shareBase]);

  useEffect(() => {
    setShareLink(sharePayload);
  }, [sharePayload]);

  const shareMessage = useMemo(() => {
    if (!sharePayload) return '';
    // Put the link on its own line. Messengers love this.
    return `Look at my Aether gallery:\n${sharePayload}`;
  }, [sharePayload]);

  const handleShare = async () => {
    if (!sharePayload) return;

    // ensure the address bar reflects the share link
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
    if (!sharePayload) return;
    try {
      await navigator.clipboard.writeText(shareMessage);
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
            {/* IMPORTANT: render effectiveItems so drafts preview correctly */}
            <GalleryScene onSelect={setSelectedItem} items={effectiveItems} clearing={isClearing} />
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
                      onClick={handleCreateNew}
                      className="px-3 py-2 rounded-lg bg-slate-900 text-white font-semibold shadow hover:-translate-y-[1px] transition"
                    >
                      Create new gallery
                    </button>
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
            </div>
          </div>
        )}
      </div>

      {/* Contact button (if you have it elsewhere, keep your existing UI wiring) */}
      {/* If needed, you can call handleContactClick() from your existing footer button */}
      {/* contactMenuOpen remains intact for your dropdown usage */}
    </div>
  );
};

export default App;
