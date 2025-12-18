import React, { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import { Session } from '@supabase/supabase-js';
import { Canvas } from '@react-three/fiber';
import GalleryScene from './components/FloatingGallery';
import Overlay from './components/Overlay';
import TileGallery from './components/TileGallery';
import {
  GalleryRecord,
  GallerySummary,
  isSupabaseConfigured,
  listenToAuth,
  loadGalleryRecord,
  listUserGalleries,
  saveGalleryRecord,
  signInWithEmail,
  signInWithGoogle,
  signOut,
} from './supabaseClient';
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
  const shareBase = useMemo(
    () => (typeof window !== 'undefined' ? window.location.origin : 'https://gallery3-d.vercel.app'),
    [],
  );
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
  const [viewMode, setViewMode] = useState<'sphere' | 'tile'>('sphere');
  const [mediaScale, setMediaScale] = useState(1);
  const [sphereBase, setSphereBase] = useState(62);
  const [tileGap, setTileGap] = useState(8);
  const [savedGalleryId, setSavedGalleryId] = useState('');
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [myGalleries, setMyGalleries] = useState<GallerySummary[]>([]);
  const [isLoadingMyGalleries, setIsLoadingMyGalleries] = useState(false);

  const applyLoadedRecord = useCallback(
    (record: GalleryRecord) => {
      setGalleryItems(record.items || []);
      setIsCustom(true);
      setDisplayName(record.display_name || '');
      setContactWhatsapp(record.contact_whatsapp || '');
      setContactEmail(record.contact_email || '');
      const id = record.slug || record.id;
      setSavedGalleryId(id);
      const link = `${shareBase}/?gallery=${id}`;
      setShareLink(link);
      return link;
    },
    [shareBase],
  );

  useEffect(() => {
    const extractGallery = () => {
      const params = new URLSearchParams(window.location.search);
      const encoded = params.get('gallery');
      if (encoded) return encoded;

      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const hashEncoded = hashParams.get('gallery');
      if (hashEncoded) return hashEncoded;

      const match = window.location.href.match(/[?&]gallery=([^&#]+)/);
      return match ? match[1] : null;
    };

    const syncFromQuery = async () => {
      setLoadError('');
      const encoded = extractGallery();
      const incoming = decodeGalleryParam(encoded);

      if (incoming.urls.length) {
        setGalleryItems(buildMediaItemsFromUrls(incoming.urls));
        setIsCustom(true);
        setDisplayName(incoming.displayName || '');
        setContactWhatsapp(incoming.contactWhatsapp || '');
        setContactEmail(incoming.contactEmail || '');
        setSavedGalleryId('');
        return;
      }

      if (encoded && isSupabaseConfigured) {
        setLoadingRemote(true);
        try {
          const record = await loadGalleryRecord(encoded);
          if (record?.items?.length) {
            applyLoadedRecord(record);
            return;
          }
          setLoadError('No saved gallery found for this link.');
        } catch (err) {
          console.warn('Failed to load gallery from Supabase', err);
          setLoadError('Unable to load saved gallery right now.');
        } finally {
          setLoadingRemote(false);
        }
      }

      setIsCustom(false);
      setSavedGalleryId('');
      setDisplayName('');
      setContactWhatsapp('');
      setContactEmail('');
      setShareLink('');
      setGalleryItems(buildDefaultMediaItems());
    };

    syncFromQuery();
    window.addEventListener('popstate', syncFromQuery);
    return () => window.removeEventListener('popstate', syncFromQuery);
  }, [applyLoadedRecord, shareBase]);

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
    setSavedGalleryId('');
    setShareLink('');
  };

  const handleCreateNew = () => {
    setIsClearing(true);
    setIsCustom(true);
    setSelectedItem(null);
    setBuilderOpen(true);
    setShareLink('');
    setSavedGalleryId('');

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

  const sharePayload = useMemo(() => {
    if (savedGalleryId) return `${shareBase}/?gallery=${savedGalleryId}`;
    if (!effectiveItems.length) return '';
    return `${shareBase}/?gallery=${encodeGalleryParam(effectiveItems, {
      displayName,
      contactWhatsapp,
      contactEmail,
    })}`;
  }, [contactEmail, contactWhatsapp, displayName, effectiveItems, savedGalleryId, shareBase]);

  useEffect(() => {
    setShareLink(sharePayload);
  }, [sharePayload]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const unsubscribe = listenToAuth(setSession);
    return () => unsubscribe && unsubscribe();
  }, []);

  // ✅ IMPORTANT FIX:
  // Make the outgoing message include the link AND the raw URLs, like it used to.
  const composeShareMessage = (link: string) => {
    if (!link) return '';
    const urlLines = effectiveItems
      .map((i) => (i.originalUrl || '').trim())
      .filter(Boolean)
      .join('\n');

    return `Look at my Aether gallery ${link}\n\n${urlLines}`;
  };

  const shareMessage = useMemo(() => composeShareMessage(sharePayload), [sharePayload, effectiveItems]);

  const formatDate = (value?: string | null) => {
    if (!value) return 'just now';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const refreshMyGalleries = useCallback(async () => {
    if (!session?.user?.id || !isSupabaseConfigured) return;
    setIsLoadingMyGalleries(true);
    try {
      const data = await listUserGalleries(session.user.id);
      setMyGalleries(data);
    } catch (err) {
      console.warn('Unable to list user galleries', err);
    } finally {
      setIsLoadingMyGalleries(false);
    }
  }, [isSupabaseConfigured, session?.user?.id]);

  useEffect(() => {
    if (!session) {
      setMyGalleries([]);
      return;
    }
    refreshMyGalleries();
  }, [refreshMyGalleries, session]);

  const loadSavedGallery = async (slugOrId: string) => {
    if (!isSupabaseConfigured) {
      setLoadError('Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return;
    }
    setLoadError('');
    setLoadingRemote(true);
    try {
      const record = await loadGalleryRecord(slugOrId);
      if (record?.items?.length) {
        const link = applyLoadedRecord(record);
        window.history.replaceState(null, '', link);
        setBuilderOpen(true);
        return;
      }
      setLoadError('No saved gallery found for this link.');
    } catch (err) {
      console.warn('Failed to load gallery from Supabase', err);
      setLoadError('Unable to load saved gallery right now.');
    } finally {
      setLoadingRemote(false);
    }
  };

  const handleSaveGallery = async (options?: { asNew?: boolean }) => {
    if (!galleryItems.length) return null;
    if (!isSupabaseConfigured) {
      setLoadError('Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return null;
    }

    setIsSaving(true);
    setLoadError('');
    try {
      const record = await saveGalleryRecord(
        {
          id: options?.asNew ? undefined : savedGalleryId || undefined,
          slug: options?.asNew ? undefined : savedGalleryId || undefined,
          items: galleryItems,
          display_name: displayName || null,
          contact_email: contactEmail || null,
          contact_whatsapp: contactWhatsapp || null,
        },
        session,
        { asNew: options?.asNew },
      );
      const link = applyLoadedRecord(record);
      refreshMyGalleries();
      return link;
    } catch (err: any) {
      console.warn('Unable to save gallery', err);
      setLoadError(err?.message || 'Unable to save gallery right now.');
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    let link = sharePayload;
    if (isSupabaseConfigured && !savedGalleryId && galleryItems.length) {
      const saved = await handleSaveGallery();
      if (saved) link = saved;
    }

    if (!link) return;

    setShareLink(link);
    window.history.replaceState(null, '', link);

    const message = composeShareMessage(link);

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Aether Gallery',
          text: message || link,
          url: link,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(message || link);
        setToastVisible(true);
        setTimeout(() => setToastVisible(false), 1600);
      }
    } catch (error) {
      console.warn('Share cancelled', error);
    } finally {
      if (navigator.clipboard && !navigator.share) {
        setToastVisible(true);
        setTimeout(() => setToastVisible(false), 1600);
      }
    }
  };

  const handleCopyLink = async () => {
    let linkToUse = sharePayload || shareLink;

    if (isSupabaseConfigured && !savedGalleryId && galleryItems.length) {
      const saved = await handleSaveGallery();
      if (saved) linkToUse = saved;
    }

    if (!linkToUse) return;
    if (!shareLink && linkToUse) setShareLink(linkToUse);

    try {
      await navigator.clipboard.writeText(composeShareMessage(linkToUse) || linkToUse);
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 1600);
    } catch (err) {
      console.warn('Clipboard unavailable', err);
    }
  };

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

  const handleGoogleLogin = async () => {
    if (!isSupabaseConfigured) {
      setLoadError('Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return;
    }

    try {
      setAuthMessage('Opening Google sign-in…');
      await signInWithGoogle(window.location.origin);
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to start Google sign-in.');
    }
  };

  const handleEmailLogin = async () => {
    if (!isSupabaseConfigured) {
      setLoadError('Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return;
    }

    if (!authEmail.trim()) {
      setLoadError('Enter an email address to continue.');
      return;
    }

    try {
      setAuthMessage('Magic link sent! Check your inbox.');
      setLoadError('');
      await signInWithEmail(authEmail.trim(), window.location.origin);
      setAuthEmail('');
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to send the sign-in link right now.');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setSession(null);
    setSavedGalleryId('');
    setShareLink('');
    setMyGalleries([]);
    setAuthMessage('');
  };

  return (
    <div className="w-full h-screen relative bg-gradient-to-br from-[#f8fafc] to-[#e2e8f0] overflow-hidden">
      <div
        className={`
          absolute inset-0 transition-all duration-700 ease-out
          ${selectedItem ? 'scale-105 blur-sm opacity-50' : 'scale-100 blur-0 opacity-100'}
        `}
      >
        {viewMode === 'sphere' ? (
          <Suspense fallback={<Loader />}>
            <Canvas
              camera={{ position: [0, 0, 75], fov: 50 }}
              dpr={[1, 1.5]}
              gl={{ antialias: false, alpha: true }}
              className="bg-transparent"
            >
              <GalleryScene
                onSelect={setSelectedItem}
                items={galleryItems}
                clearing={isClearing}
                cardScale={mediaScale}
                radiusBase={sphereBase}
              />
            </Canvas>
          </Suspense>
        ) : (
          <TileGallery items={galleryItems} onSelect={setSelectedItem} mediaScale={mediaScale} gap={tileGap} />
        )}

        {loadingRemote && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm z-10">
            <div className="flex flex-col items-center gap-2 text-sm text-slate-600">
              <div className="w-8 h-8 border-2 border-gray-200 border-t-slate-500 rounded-full animate-spin" />
              <span>Loading your saved gallery…</span>
            </div>
          </div>
        )}
      </div>

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

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">View</span>
          <div className="inline-flex items-center rounded-full bg-white/80 shadow-sm border border-slate-200">
            <button
              className={`px-3 py-1 text-xs font-semibold rounded-full transition ${
                viewMode === 'sphere' ? 'bg-slate-900 text-white shadow' : 'text-slate-600'
              }`}
              onClick={() => setViewMode('sphere')}
            >
              Sphere
            </button>
            <button
              className={`px-3 py-1 text-xs font-semibold rounded-full transition ${
                viewMode === 'tile' ? 'bg-slate-900 text-white shadow' : 'text-slate-600'
              }`}
              onClick={() => setViewMode('tile')}
            >
              Masonry
            </button>
          </div>
        </div>

        {loadError && (
          <p className="text-[11px] text-rose-600 bg-white/70 border border-rose-100 rounded-xl px-3 py-2 max-w-xs shadow-sm">
            {loadError}
          </p>
        )}

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
                  <p className="text-xs text-slate-500">
                    Share a custom Aether sphere with your media.
                  </p>
                </div>
                <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                  New
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-700">
                <button
                  onClick={() => {
                    setBuilderOpen(true);
                    handleCreateNew();
                  }}
                  className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white font-semibold shadow hover:-translate-y-[1px] transition"
                >
                  Add a gallery
                </button>
                <button
                  onClick={handleShare}
                  className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold shadow hover:-translate-y-[1px] transition"
                >
                  Share gallery
                </button>
                <button
                  onClick={() => setBuilderOpen(true)}
                  className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-semibold shadow hover:-translate-y-[1px] transition"
                >
                  My galleries
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-700">
                <div className="flex flex-col gap-2 p-3 rounded-xl bg-white/80 border border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">Log in</span>
                  </div>
                  {!session ? (
                    <>
                      <button
                        onClick={handleGoogleLogin}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold shadow hover:-translate-y-[1px] transition disabled:opacity-60"
                        disabled={!isSupabaseConfigured}
                      >
                        Continue with Google
                      </button>
                      <div className="flex items-center gap-2">
                        <input
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="flex-1 rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
                        />
                        <button
                          onClick={handleEmailLogin}
                          className="px-3 py-2 rounded-lg bg-white text-slate-800 text-xs font-semibold shadow border border-slate-200 hover:-translate-y-[1px] transition disabled:opacity-60"
                          disabled={!isSupabaseConfigured}
                        >
                          Email link
                        </button>
                      </div>
                      {authMessage && <p className="text-[11px] text-emerald-600">{authMessage}</p>}
                    </>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-semibold text-slate-700">Signed in</span>
                        <span className="text-[11px] text-slate-500">
                          {session.user.email || session.user.user_metadata?.name || 'Google user'}
                        </span>
                      </div>
                      <button
                        onClick={handleSignOut}
                        className="px-3 py-2 rounded-lg bg-white text-slate-800 text-xs font-semibold shadow border border-slate-200 hover:-translate-y-[1px] transition"
                      >
                        Sign out
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 p-3 rounded-xl bg-white/80 border border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">My galleries</span>
                    {isLoadingMyGalleries && <span className="text-[11px] text-slate-500">Refreshing…</span>}
                  </div>
                  {!session && (
                    <p className="text-[11px] text-slate-500">Sign in to view your saved galleries.</p>
                  )}
                  {session && (
                    <div className="flex flex-col gap-2 max-h-32 overflow-y-auto pr-1">
                      {myGalleries.length === 0 && !isLoadingMyGalleries ? (
                        <p className="text-[11px] text-slate-500">Save your first gallery to list it here.</p>
                      ) : (
                        myGalleries.map((record) => (
                          <button
                            key={record.id}
                            onClick={() => loadSavedGallery(record.slug || record.id)}
                            className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 bg-white/70 hover:bg-slate-50 transition shadow-sm"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-slate-800 text-[12px] truncate">
                                {record.display_name || record.slug || record.id}
                              </span>
                              <span className="text-[10px] text-slate-500">{formatDate(record.updated_at)}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 break-all">
                              Link: {record.slug || record.id}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 p-3 rounded-xl bg-white/80 border border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">Admin</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Admin access is limited to eyalizenman@gmail.com. Sign in to manage galleries.
                  </p>
                  {session?.user?.email === 'eyalizenman@gmail.com' ? (
                    <div className="space-y-1 text-[11px] text-slate-600">
                      <p className="font-semibold text-slate-800">Actions</p>
                      <p>- Load any gallery from the list to inspect.</p>
                      <p>- Use Save as new to duplicate variants.</p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500">Sign in as admin to see management options.</p>
                  )}
                </div>
              </div>

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
                <div className="flex flex-col gap-3 p-3 rounded-xl bg-white/70 border border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">View & spacing</span>
                    <span className="text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      Live
                    </span>
                  </div>

                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-slate-700">Media size</span>
                    <input
                      type="range"
                      min={0.7}
                      max={1.4}
                      step={0.05}
                      value={mediaScale}
                      onChange={(e) => {
                        setMediaScale(parseFloat(e.target.value));
                        setSavedGalleryId('');
                        setShareLink('');
                      }}
                      className="accent-slate-900"
                    />
                    <span className="text-[11px] text-slate-500">
                      {Math.round(mediaScale * 100)}% of default card size
                    </span>
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-slate-700">Sphere size</span>
                    <input
                      type="range"
                      min={28}
                      max={96}
                      step={2}
                      value={sphereBase}
                      onChange={(e) => {
                        setSphereBase(parseFloat(e.target.value));
                        setSavedGalleryId('');
                        setShareLink('');
                      }}
                      className="accent-slate-900"
                      disabled={viewMode !== 'sphere'}
                    />
                    <span className="text-[11px] text-slate-500">
                      {viewMode === 'sphere'
                        ? `Radius set to ${Math.round(sphereBase)}`
                        : 'Sphere radius disabled in masonry view'}
                    </span>
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-slate-700">Tile spacing</span>
                    <input
                      type="range"
                      min={4}
                      max={22}
                      step={1}
                      value={tileGap}
                      onChange={(e) => {
                        setTileGap(parseFloat(e.target.value));
                        setSavedGalleryId('');
                        setShareLink('');
                      }}
                      className="accent-slate-900"
                    />
                    <span className="text-[11px] text-slate-500">Gap set to {tileGap}px (tighter masonry)</span>
                  </label>
                </div>

                <label className="flex flex-col gap-1 p-3 rounded-xl bg-white/70 border border-slate-100">
                  <span className="font-semibold text-slate-800">Display name</span>
                  <input
                    value={displayName}
                    onChange={(e) => {
                      setDisplayName(e.target.value);
                      setSavedGalleryId('');
                      setShareLink('');
                    }}
                    placeholder="e.g. Maya Cohen"
                    className="rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </label>

                <label className="flex flex-col gap-1 p-3 rounded-xl bg-white/70 border border-slate-100">
                  <span className="font-semibold text-slate-800">WhatsApp</span>
                  <input
                    value={contactWhatsapp}
                    onChange={(e) => {
                      setContactWhatsapp(e.target.value);
                      setSavedGalleryId('');
                      setShareLink('');
                    }}
                    placeholder="972... or local"
                    className="rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </label>

                <label className="flex flex-col gap-1 p-3 rounded-xl bg-white/70 border border-slate-100">
                  <span className="font-semibold text-slate-800">Email</span>
                  <input
                    value={contactEmail}
                    onChange={(e) => {
                      setContactEmail(e.target.value);
                      setSavedGalleryId('');
                      setShareLink('');
                    }}
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
                    onChange={(e) => {
                      setInputValue(e.target.value);
                      setSavedGalleryId('');
                      setShareLink('');
                    }}
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-slate-600">
                    <div className="flex flex-col gap-2 p-3 rounded-xl bg-white/70 border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">Account</span>
                        <span
                          className={`text-[10px] px-2 py-1 rounded-full border ${
                            isSupabaseConfigured
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : 'bg-amber-50 text-amber-700 border-amber-100'
                          }`}
                        >
                          {isSupabaseConfigured ? 'Supabase ready' : 'Add Supabase keys'}
                        </span>
                      </div>

                      {!session ? (
                        <div className="space-y-2">
                          <button
                            onClick={handleGoogleLogin}
                            className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-800 font-semibold shadow hover:-translate-y-[1px] transition disabled:opacity-60"
                            disabled={!isSupabaseConfigured}
                          >
                            Continue with Google
                          </button>
                          <div className="flex items-center gap-2">
                            <input
                              value={authEmail}
                              onChange={(e) => setAuthEmail(e.target.value)}
                              placeholder="you@example.com"
                              className="flex-1 rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
                            />
                            <button
                              onClick={handleEmailLogin}
                              className="px-3 py-2 rounded-lg bg-slate-900 text-white font-semibold shadow hover:-translate-y-[1px] transition disabled:opacity-60"
                              disabled={!isSupabaseConfigured}
                            >
                              Email link
                            </button>
                          </div>
                          {authMessage && <p className="text-[11px] text-emerald-600">{authMessage}</p>}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-semibold text-slate-700">Signed in</span>
                            <span className="text-[11px] text-slate-500">
                              {session.user.email || session.user.user_metadata?.name || 'Google user'}
                            </span>
                          </div>
                          <button
                            onClick={handleSignOut}
                            className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-800 font-semibold shadow hover:-translate-y-[1px] transition"
                          >
                            Sign out
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 p-3 rounded-xl bg-white/70 border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">Save & share</span>
                        {isSaving && <span className="text-[11px] text-slate-500">Saving…</span>}
                      </div>
                      <p>Persist your gallery to Supabase for short links. Save a fresh link to keep multiple versions.</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleSaveGallery()}
                          className="px-3 py-2 rounded-lg bg-emerald-600 text-white font-semibold shadow hover:-translate-y-[1px] transition disabled:opacity-60"
                          disabled={!isSupabaseConfigured || isSaving}
                        >
                          Save / update link
                        </button>
                        <button
                          onClick={() => handleSaveGallery({ asNew: true })}
                          className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 font-semibold shadow-sm border border-emerald-100 hover:-translate-y-[1px] transition disabled:opacity-60"
                          disabled={!isSupabaseConfigured || isSaving}
                        >
                          Save as new link
                        </button>
                        <button
                          onClick={handleCopyLink}
                          className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-800 font-semibold shadow hover:-translate-y-[1px] transition"
                        >
                          Copy link
                        </button>
                      </div>
                      {savedGalleryId && (
                        <p className="text-[11px] text-slate-500">
                          Saved as <span className="font-semibold">{savedGalleryId}</span>
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 p-3 rounded-xl bg-white/70 border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">My galleries</span>
                        {isLoadingMyGalleries && (
                          <span className="text-[11px] text-slate-500">Refreshing…</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Load any gallery you have saved without overwriting others.
                      </p>

                      {!session && (
                        <p className="text-[11px] text-slate-500">
                          Sign in to see a list of your saved galleries.
                        </p>
                      )}

                      {session && (
                        <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
                          {myGalleries.length === 0 && !isLoadingMyGalleries ? (
                            <p className="text-[11px] text-slate-500">Save your first gallery to list it here.</p>
                          ) : (
                            myGalleries.map((record) => (
                              <button
                                key={record.id}
                                onClick={() => loadSavedGallery(record.slug || record.id)}
                                className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 bg-white/70 hover:bg-slate-50 transition shadow-sm"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-semibold text-slate-800 text-[12px] truncate">
                                    {record.display_name || record.slug || record.id}
                                  </span>
                                  <span className="text-[10px] text-slate-500">{formatDate(record.updated_at)}</span>
                                </div>
                                <p className="text-[10px] text-slate-500 break-all">
                                  Link: {record.slug || record.id}
                                </p>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {shareLink && (
                    <div className="flex flex-col gap-2 text-xs text-slate-600">
                      <p className="font-semibold text-slate-800">Share as easy as 1-2-3</p>
                      <div className="flex flex-wrap gap-2">
                        <a
                          className="px-3 py-1.5 rounded-full bg-green-500 text-white font-semibold shadow"
                          href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                            shareMessage || sharePayload || shareLink,
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          WhatsApp
                        </a>
                        <a
                          className="px-3 py-1.5 rounded-full bg-blue-600 text-white font-semibold shadow"
                          href={`mailto:?subject=Aether%20gallery&body=${encodeURIComponent(
                            shareMessage || sharePayload || shareLink,
                          )}`}
                        >
                          Email
                        </a>
                        <button
                          className="relative px-3 py-1.5 rounded-full bg-slate-200 text-slate-800 font-semibold shadow"
                          onClick={handleCopyLink}
                        >
                          Copy link
                          {toastVisible && (
                            <span className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-1 rounded-full bg-slate-900 text-white text-[10px] shadow-lg">
                              Link copied
                            </span>
                          )}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Recipients open the link and instantly see your uploaded packet.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className={`
        fixed bottom-8 right-8 z-20 transition-opacity duration-500
        ${selectedItem ? 'opacity-0 pointer-events-none' : 'opacity-100'}
      `}
      >
        <div className="relative">
          <button
            onClick={handleContactClick}
            className="flex items-center gap-3 px-5 py-2.5 bg-white/80 backdrop-blur-sm rounded-full shadow-sm hover:shadow-md hover:bg-white transition-all duration-300 text-slate-600 hover:text-slate-900 text-sm font-medium border border-white"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
            Contact
          </button>

          {contactMenuOpen && (
            <div className="absolute bottom-12 right-0 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden">
              {sanitizeWhatsapp(contactWhatsapp) && (
                <button
                  className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 w-full text-left"
                  onClick={() => {
                    window.open(`https://wa.me/${sanitizeWhatsapp(contactWhatsapp)}`, '_blank');
                    setContactMenuOpen(false);
                  }}
                >
                  WhatsApp {sanitizeWhatsapp(contactWhatsapp)}
                </button>
              )}

              {contactEmail && (
                <button
                  className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 w-full text-left"
                  onClick={() => {
                    window.open(`mailto:${contactEmail}`);
                    setContactMenuOpen(false);
                  }}
                >
                  Email {contactEmail}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
