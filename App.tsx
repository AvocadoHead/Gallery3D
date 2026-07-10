import React, { useCallback, useEffect, useMemo, useState, Suspense, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { Canvas } from '@react-three/fiber';
import GalleryScene from './components/FloatingGallery';
import Overlay from './components/Overlay';
import CanvasGallery from './components/CanvasGallery';
import BookGallery from './components/BookGallery';
import BuilderModal from './components/BuilderModal';
import Landing from './components/Landing';
import Explore from './components/Explore';
import TermsModal from './components/TermsModal';
import NoteForm from './components/NoteForm';
import {
  GalleryRecord,
  GallerySummary,
  Visibility,
  isSupabaseConfigured,
  loadGalleryRecord,
  listUserGalleries,
  saveGalleryRecord,
  updateGalleryVisibility,
  incrementViews,
  signInWithEmail,
  signInWithGoogle,
  signOut,
  supabase,
  getUnreadByGallery,
} from './supabaseClient';
import {
  buildDefaultMediaItems,
  buildMediaItemsFromUrls,
  mergeMediaItems,
  decodeGalleryParam,
  encodeGalleryParam,
  sanitizeWhatsapp,
  SHARE_INLINE_ITEM_LIMIT,
  DEMO_DISPLAY_NAME,
  DEMO_CONTACT_EMAIL,
  DEMO_CONTACT_WHATSAPP,
  MediaItem,
} from './constants';

type AppView = 'landing' | 'gallery' | 'explore';
// 'tile' (Masonry) is the editable layout: a reflow grid by default, with an
// optional free/overlap sub-mode (see canvasMode). The old separate 'canvas'
// layout was merged into it.
type ViewMode = 'sphere' | 'tile' | 'carousel' | 'book';
type BuilderTab = 'content' | 'appearance' | 'galleries' | 'support';

// --- NEW PATIENCE LOADER ---
const Loader = () => (
  <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-slate-50/90 backdrop-blur-md transition-opacity duration-700">
    <div className="relative mb-4">
      <div className="w-16 h-16 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
      </div>
    </div>
    <h2 className="text-xl font-light text-slate-800 tracking-widest uppercase animate-pulse">Curating your gallery</h2>
    <p className="text-xs text-slate-500 mt-2 font-medium max-w-xs text-center leading-relaxed">
      Arranging your media into a beautiful 3D space…
    </p>
  </div>
);

const App: React.FC = () => {
  const shareBase = useMemo(
    () => (typeof window !== 'undefined' ? window.location.origin : 'https://gallery3-d.vercel.app'),
    [],
  );

  // --- Navigation ---
  const [view, setView] = useState<AppView>(() => {
    if (typeof window === 'undefined') return 'landing';
    const p = new URLSearchParams(window.location.search);
    if (p.get('gallery') || p.get('code') || window.location.hash.includes('gallery=')) return 'gallery';
    if (p.get('view') === 'explore') return 'explore';
    return 'landing';
  });
  // Where to return when the user backs out of Explore (it can be reached from
  // either the landing hero or the gallery header, and should return there).
  const [exploreOrigin, setExploreOrigin] = useState<'landing' | 'gallery'>('landing');

  // --- UI State ---
  const [builderOpen, setBuilderOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<BuilderTab>('galleries');
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [donationToast, setDonationToast] = useState(false);
  const [contactMenuOpen, setContactMenuOpen] = useState(false);
  const [infoToast, setInfoToast] = useState('');
  // Phase 6.2: canvas "arrange" mode (drag/resize items). Kept separate from
  // the builder modal, which would otherwise cover the canvas and block drags.
  const [canvasEdit, setCanvasEdit] = useState(false);

  const [termsOpen, setTermsOpen] = useState(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('page') === 'terms',
  );
  const [noteFormOpen, setNoteFormOpen] = useState(false);
  const [noteFormItemId, setNoteFormItemId] = useState<string | undefined>(undefined);
  const [noteFormItemTitle, setNoteFormItemTitle] = useState<string | undefined>(undefined);
  const [unreadByGallery, setUnreadByGallery] = useState<Record<string, number>>({});
  const [autoOpenNotes, setAutoOpenNotes] = useState(false);

  const flashInfo = useCallback((msg: string) => {
    setInfoToast(msg);
    setTimeout(() => setInfoToast(''), 3500);
  }, []);

  // --- Gallery Configuration ---
  const [viewMode, setViewMode] = useState<ViewMode>('sphere');
  const [mediaScale, setMediaScale] = useState(0.8);
  const [sphereBase, setSphereBase] = useState(30);

  // --- Data State ---
  const [galleryItems, setGalleryItems] = useState<MediaItem[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [contactWhatsapp, setContactWhatsapp] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('unlisted');

  // Gallery-level typography defaults (Phase 4.2).
  const [titleFont, setTitleFont] = useState<string>('Inter');
  const [titleSize, setTitleSize] = useState<'S' | 'M' | 'L' | 'XL'>('M');

  // Canvas layout sub-mode: reflow grid vs freeform overlap (Phase 6).
  const [canvasMode, setCanvasMode] = useState<'grid' | 'free'>('grid');
  // Book layout: items per page (Phase 7).
  const [bookPerPage, setBookPerPage] = useState<1 | 2 | 4>(2);

  // Arrange mode only makes sense in the editable (Masonry) layout.
  useEffect(() => {
    if (viewMode !== 'tile') setCanvasEdit(false);
  }, [viewMode]);

  // Helpers to move between the builder tabs and open the modal.
  const openBuilder = useCallback((tab: BuilderTab = 'galleries') => {
    setInitialTab(tab);
    setBuilderOpen(true);
  }, []);
  
  // Database IDs
  const [savedGalleryId, setSavedGalleryId] = useState(''); 
  const [galleryDbId, setGalleryDbId] = useState<string | null>(null);
  
  const [isClearing, setIsClearing] = useState(false);

  // --- Remote/Auth State ---
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [myGalleries, setMyGalleries] = useState<GallerySummary[]>([]);
  const [isLoadingMyGalleries, setIsLoadingMyGalleries] = useState(false);

  const authProcessing = useRef(false);

  // --- AUTH LOGIC ---
  useEffect(() => {
    if (!supabase) return;

    const handleAuth = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');

      if (code) {
        if (authProcessing.current) return;
        authProcessing.current = true;

        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error && data.session) {
            setSession(data.session);
            refreshMyGalleries(data.session.user.id);
            setBuilderOpen(true);
            window.history.replaceState(null, '', window.location.pathname);
          } else {
             setLoadError('Login failed. Please try again.');
          }
        } catch (err) {
          console.error('Auth exception:', err);
        } finally {
          authProcessing.current = false;
        }
      } else {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setSession(data.session);
          refreshMyGalleries(data.session.user.id);
        }
      }
    };

    handleAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setSession(newSession);
        if (newSession) refreshMyGalleries(newSession.user.id);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setMyGalleries([]);
        flashInfo('Signed out.');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshUnread = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const counts = await getUnreadByGallery();
    setUnreadByGallery(counts);
  }, [isSupabaseConfigured]);

  const refreshMyGalleries = useCallback(async (userId?: string) => {
    const uid = userId || session?.user?.id;
    if (!uid || !isSupabaseConfigured) return;
    setIsLoadingMyGalleries(true);
    try {
      const data = await listUserGalleries(uid);
      setMyGalleries(data);
    } catch (err) {
      console.warn('Unable to list user galleries', err);
    } finally {
      setIsLoadingMyGalleries(false);
    }
    refreshUnread();
  }, [session, isSupabaseConfigured, refreshUnread]);

  // --- URL PARSING & LOADING ---
  const applyLoadedRecord = useCallback(
    (record: GalleryRecord) => {
      setGalleryItems(record.items || []);
      setDisplayName(record.display_name || '');
      setContactWhatsapp(record.contact_whatsapp || '');
      setContactEmail(record.contact_email || '');
      setVisibility(record.visibility || 'unlisted');
      setGalleryDbId(record.id);

      if (record.settings) {
        const vm = record.settings.viewMode === 'canvas' ? 'tile' : record.settings.viewMode; // legacy
        if (vm === 'sphere' || vm === 'tile' || vm === 'carousel' || vm === 'book') setViewMode(vm);
        if (record.settings.bookPerPage) setBookPerPage(record.settings.bookPerPage);
        if (record.settings.mediaScale) setMediaScale(record.settings.mediaScale);
        if (record.settings.sphereBase) setSphereBase(record.settings.sphereBase);
        if (record.settings.titleFont) setTitleFont(record.settings.titleFont);
        if (record.settings.titleSize) setTitleSize(record.settings.titleSize);
        if (record.settings.canvasMode) setCanvasMode(record.settings.canvasMode);
      }

      const id = record.slug || record.id;
      setSavedGalleryId(id);
      return `${shareBase}/?gallery=${id}`;
    },
    [shareBase],
  );

  useEffect(() => {
    const extractGallery = () => {
      const params = new URLSearchParams(window.location.search);
      const encoded = params.get('gallery');
      if (encoded) return encoded;
      
      const hash = window.location.hash;
      if (hash.includes('access_token') || hash.includes('type=recovery')) return null;
      if (window.location.search.includes('code=')) return null;

      const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
      return hashParams.get('gallery');
    };

    // Apply the optional display params a share link may carry (?layout, ?scale, ?radius, ?gap).
    const applyDisplayParams = () => {
      const p = new URLSearchParams(window.location.search);
      const layout = p.get('layout') === 'canvas' ? 'tile' : p.get('layout'); // legacy 'canvas' → Masonry
      if (layout === 'sphere' || layout === 'tile' || layout === 'carousel' || layout === 'book') setViewMode(layout);
      const scale = p.get('scale');
      if (scale) setMediaScale(Math.min(3, Math.max(0.3, parseInt(scale, 10) / 100)));
      const radius = p.get('radius');
      if (radius) setSphereBase(Math.min(150, Math.max(10, parseInt(radius, 10))));
      const perpage = parseInt(p.get('perpage') || '', 10);
      if (perpage === 1 || perpage === 2 || perpage === 4) setBookPerPage(perpage);
      const mode = p.get('mode');
      if (mode === 'grid' || mode === 'free') setCanvasMode(mode);
    };

    const syncFromQuery = async () => {
      setLoadError('');
      const encoded = extractGallery();
      const incoming = decodeGalleryParam(encoded);

      if (incoming.urls.length) {
        setGalleryItems(buildMediaItemsFromUrls(incoming.urls));
        setDisplayName(incoming.displayName || '');
        setContactWhatsapp(incoming.contactWhatsapp || '');
        setContactEmail(incoming.contactEmail || '');
        setSavedGalleryId('');
        setGalleryDbId(null);
        setInputValue(incoming.urls.join('\n'));
        applyDisplayParams();
        setView('gallery');
        return;
      }

      if (encoded && isSupabaseConfigured) {
        setLoadingRemote(true);
        try {
          const record = await loadGalleryRecord(encoded);
          if (record?.items?.length) {
            applyLoadedRecord(record);
            const urls = record.items.map(i => i.originalUrl).join('\n');
            setInputValue(urls);
            setView('gallery');
            if (record.slug) incrementViews(record.slug); // best-effort view count
            return;
          }
          setLoadError('Gallery not found.');
        } catch (err) {
          console.warn(err);
          setLoadError('Unable to load gallery.');
        } finally {
          setLoadingRemote(false);
        }
      }

      setGalleryItems(buildDefaultMediaItems());
      setDisplayName(DEMO_DISPLAY_NAME);
      setContactWhatsapp(DEMO_CONTACT_WHATSAPP);
      setContactEmail(DEMO_CONTACT_EMAIL);
    };

    syncFromQuery();
    window.addEventListener('popstate', syncFromQuery);
    return () => window.removeEventListener('popstate', syncFromQuery);
  }, [applyLoadedRecord]);

  // --- HANDLERS ---
  const handleAddMedia = () => {
    const entries = inputValue.split(/[,\n]/).map((v) => v.trim()).filter(Boolean);
    if (!entries.length) return;
    // Preserve any per-item titles/descriptions for URLs that already existed.
    setGalleryItems(mergeMediaItems(galleryItems, entries));
    setSelectedItem(null);
  };

  const handleClear = () => {
    setIsClearing(true);
    setSelectedItem(null);
    setInputValue('');
    setTimeout(() => {
      setGalleryItems([]);
      setIsClearing(false);
    }, 650);
  };

  const handleStartNew = () => {
    setGalleryItems([]);
    setInputValue('');
    setDisplayName('');
    setContactWhatsapp('');
    setContactEmail('');
    setVisibility('unlisted');
    setSavedGalleryId('');
    setGalleryDbId(null);
    setViewMode('sphere');
    setMediaScale(0.8); // match the app-wide default (Phase 5)
    setTitleFont('Inter');
    setTitleSize('M');
    setCanvasMode('grid');
    setBookPerPage(2);
    setCanvasEdit(false);

    window.history.replaceState(null, '', window.location.pathname);
  };

  const handleDeleteGallery = async (galleryId: string) => {
    if (!supabase || !session) return;
    if (!window.confirm('Are you sure you want to delete this gallery? This cannot be undone.')) return;

    try {
      const { error } = await supabase.from('galleries').delete().eq('id', galleryId);
      if (error) throw error;
      refreshMyGalleries(session.user.id);
      if (galleryId === galleryDbId) {
        handleStartNew();
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete gallery.');
    }
  };

  // Phase 2.2: flip a saved gallery's visibility inline from the My Galleries list.
  const handleSetVisibility = async (galleryId: string, next: Visibility) => {
    try {
      await updateGalleryVisibility(galleryId, next);
      if (galleryId === galleryDbId) setVisibility(next);
      refreshMyGalleries();
    } catch (err: any) {
      console.error('Visibility update failed:', err);
      flashInfo(err?.message || 'Could not update visibility.');
    }
  };

  const handleSaveGallery = async (options?: { asNew?: boolean }) => {
    // galleryItems is the source of truth — it already reflects the URL textarea
    // (via Update) AND all layout-editor changes (canvas placement, sizes, text,
    // order). Rebuilding from the textarea here would wipe that arrangement.
    const entries = inputValue.split(/[,\n]/).map((v) => v.trim()).filter(Boolean);
    const itemsToSave = galleryItems.length ? galleryItems : buildMediaItemsFromUrls(entries);

    if (!itemsToSave.length || !isSupabaseConfigured) return;

    const asNew = options?.asNew === true;

    setIsSaving(true);
    try {
      const idToUse = asNew ? undefined : galleryDbId || undefined;
      const slugToUse = asNew ? undefined : savedGalleryId || undefined;

      const record = await saveGalleryRecord(
        {
          id: idToUse,
          slug: slugToUse,
          items: itemsToSave,
          display_name: displayName || null,
          contact_email: contactEmail || null,
          contact_whatsapp: contactWhatsapp || null,
          visibility,
          layout_settings: {
            viewMode,
            canvasMode,
            bookPerPage,
            mediaScale,
            sphereBase,
            titleFont,
            titleSize,
          }
        },
        session,
        { asNew },
      );
      const link = applyLoadedRecord(record);
      window.history.replaceState(null, '', link);
      setView('gallery');
      refreshMyGalleries();
      
      setDonationToast(true);
      setTimeout(() => setDonationToast(false), 6000);

    } catch (err: any) {
      console.error(err);
      setLoadError(err?.message || 'Save failed.');
    } finally {
      setIsSaving(false);
    }
  };

  const generateShareLink = useCallback(() => {
    let link = '';
    if (savedGalleryId) {
        link = `${shareBase}/?gallery=${savedGalleryId}`;
    } else if (galleryItems.length) {
        link = `${shareBase}/?gallery=${encodeGalleryParam(galleryItems, { displayName, contactWhatsapp, contactEmail })}`;
    }

    if (!link) return window.location.href; 
    
    const url = new URL(link);
    url.searchParams.set('layout', viewMode);
    url.searchParams.set('scale', Math.round(mediaScale * 100).toString());
    if (viewMode === 'sphere' || viewMode === 'carousel') url.searchParams.set('radius', sphereBase.toString());
    if (viewMode === 'book') url.searchParams.set('perpage', String(bookPerPage));
    if (viewMode === 'tile') url.searchParams.set('mode', canvasMode);

    return url.toString();
  }, [shareBase, savedGalleryId, galleryItems, displayName, contactWhatsapp, contactEmail, viewMode, mediaScale, sphereBase, bookPerPage, canvasMode]);

  const handleCopyLink = async () => {
    // A big unsaved gallery would base64-encode into a multi-10KB URL that
    // breaks WhatsApp / some browsers — require a save-to-share short link.
    if (!savedGalleryId && galleryItems.length > SHARE_INLINE_ITEM_LIMIT) {
      flashInfo(`Save this gallery first to share ${galleryItems.length} items with a short link.`);
      openBuilder('galleries');
      return;
    }
    const link = generateShareLink();
    try {
      await navigator.clipboard.writeText(link);
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 2000);
      
      setTimeout(() => setDonationToast(true), 1000);
      setTimeout(() => setDonationToast(false), 6000);
    } catch (err) {
      console.warn('Clipboard error', err);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setAuthMessage('Redirecting...');
      await signInWithGoogle(window.location.origin);
    } catch (err: any) { setLoadError(err.message); }
  };

  const handleEmailLogin = async () => {
    if (!authEmail) return;
    try {
      setAuthMessage('Check email!');
      await signInWithEmail(authEmail, window.location.origin);
    } catch (err: any) { setLoadError(err.message); }
  };

  const handleSignOut = async () => {
    await signOut();
    setSession(null);
    setMyGalleries([]);
    setGalleryDbId(null);
    handleStartNew();
  };

  // Load a gallery by slug/id and show it (used by Explore + the builder list).
  const handleOpenSlug = useCallback(async (slug: string) => {
    setBuilderOpen(false);
    setView('gallery');
    setLoadingRemote(true);
    try {
      const record = await loadGalleryRecord(slug);
      if (record) {
        const link = applyLoadedRecord(record);
        window.history.replaceState(null, '', link);
        setInputValue(record.items.map((i) => i.originalUrl).join('\n'));
        if (record.slug) incrementViews(record.slug);
      } else {
        setLoadError('Gallery not found.');
      }
    } catch (err) {
      console.error('Load error:', err);
      setLoadError('Failed to load gallery');
    } finally {
      setLoadingRemote(false);
    }
  }, [applyLoadedRecord]);

  return (
    <div className="w-full h-screen relative bg-gradient-to-br from-[#f8fafc] to-[#e2e8f0] overflow-hidden">
      
      {/* 3D Scene (always mounted — it doubles as the living backdrop behind the landing) */}
      <div className={`absolute inset-0 transition-opacity duration-700 ease-out z-0 ${selectedItem ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
        {viewMode === 'tile' ? (
          <CanvasGallery
            items={galleryItems}
            onSelect={setSelectedItem}
            editable={canvasEdit && !!session}
            mode={canvasMode}
            onChangeMode={setCanvasMode}
            onChangeItems={setGalleryItems}
            onExitEdit={() => setCanvasEdit(false)}
            mediaScale={mediaScale}
            titleDefaults={{ font: titleFont, size: titleSize }}
          />
        ) : viewMode === 'book' ? (
          // Book owns its Canvas: its camera/controls must never share a rig
          // with the sphere's (see regression note in BookGallery.tsx).
          <BookGallery
            items={galleryItems}
            onSelect={setSelectedItem}
            perPage={bookPerPage}
            title={displayName}
            titleDefaults={{ font: titleFont, size: titleSize }}
          />
        ) : (
          <Suspense fallback={<Loader />}>
            <Canvas
              camera={{ position: [0, 0, 65], fov: 50 }}
              dpr={[1, 1.5]}
              gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
              className="bg-transparent"
            >
              <GalleryScene
                onSelect={setSelectedItem}
                items={galleryItems}
                clearing={isClearing}
                cardScale={mediaScale}
                radiusBase={sphereBase}
                layout={viewMode as 'sphere' | 'carousel'}
                titleDefaults={{ font: titleFont, size: titleSize }}
              />
            </Canvas>
          </Suspense>
        )}
        {loadingRemote && <Loader />}
      </div>

      <Overlay
        artwork={selectedItem}
        items={galleryItems}
        onNavigate={setSelectedItem}
        onClose={() => setSelectedItem(null)}
        titleDefaults={{ font: titleFont, size: titleSize }}
        galleryId={galleryDbId}
        onCommentItem={(item) => {
          setNoteFormItemId(item.id);
          setNoteFormItemTitle(item.title);
          setNoteFormOpen(true);
        }}
      />

      {/* Lightweight info toast (sign-out, share nudges, errors) */}
      {infoToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[300] px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-full shadow-xl border border-white/10 animate-in slide-in-from-top-2 fade-in max-w-[90vw] text-center">
          {infoToast}
        </div>
      )}

      {/* Header */}
      <div className={`fixed top-8 left-8 z-[100] transition-opacity duration-500 flex flex-col items-start gap-3 ${selectedItem || view !== 'gallery' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => openBuilder('galleries')}
            className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors shadow-sm bg-white/50 backdrop-blur-md"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            {Object.values(unreadByGallery).reduce((a, b) => a + b, 0) > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setAutoOpenNotes(true); openBuilder('content'); }}
                className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-red-500 hover:bg-red-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center"
              >
                {Math.min(Object.values(unreadByGallery).reduce((a, b) => a + b, 0), 99)}
              </button>
            )}
          </button>
          
          <div className="cursor-pointer" onClick={() => window.location.href = window.location.origin}>
            <h1 className="text-3xl font-light text-slate-800 tracking-tighter transition-colors">Aether</h1>
            <div className="flex items-center gap-2">
              <p className="text-xs text-slate-400 font-medium tracking-widest uppercase mt-1 ml-1 transition-colors">Gallery</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-full bg-white/80 shadow-sm border border-slate-200 backdrop-blur-sm">
              <button
                className={`px-3 py-1 text-xs font-semibold rounded-full transition ${
                  viewMode === 'sphere' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:text-slate-900'
                }`}
                onClick={() => setViewMode('sphere')}
              >
                Sphere
              </button>
              <button
                className={`px-3 py-1 text-xs font-semibold rounded-full transition ${
                  viewMode === 'carousel' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:text-slate-900'
                }`}
                onClick={() => setViewMode('carousel')}
              >
                Carousel
              </button>
              <button
                className={`px-3 py-1 text-xs font-semibold rounded-full transition ${
                  viewMode === 'tile' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:text-slate-900'
                }`}
                onClick={() => setViewMode('tile')}
              >
                Masonry
              </button>
              <button
                className={`px-3 py-1 text-xs font-semibold rounded-full transition ${
                  viewMode === 'book' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:text-slate-900'
                }`}
                onClick={() => setViewMode('book')}
              >
                Book<sup className="ml-0.5 text-[8px] font-bold text-amber-500">beta</sup>
              </button>
          </div>
          <button
            onClick={() => {
              setExploreOrigin('gallery');
              setView('explore');
            }}
            className="px-3 py-1 text-xs font-semibold rounded-full bg-white/80 shadow-sm border border-slate-200 backdrop-blur-sm text-slate-600 hover:text-slate-900 transition"
          >
            Explore
          </button>
        </div>

        {displayName && (
           <div 
             className="px-3 py-1 bg-white/60 backdrop-blur-sm rounded-lg border border-slate-200 shadow-sm text-sm text-slate-800 font-bold tracking-tight"
             style={{ fontFamily: 'Heebo, sans-serif' }}
           >
             {displayName}
           </div>
        )}
        
        {toastVisible && (
          <div className="px-3 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-lg animate-bounce flex items-center gap-2">
             <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
             Link Copied!
          </div>
        )}
      </div>

      {/* Footer left — Terms + Accessibility */}
      <div className={`fixed bottom-8 left-8 z-[100] transition-opacity duration-500 flex items-center gap-3 ${selectedItem || view !== 'gallery' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <button onClick={() => setTermsOpen(true)} className="text-[10px] text-slate-400 hover:text-slate-600 font-medium transition">Terms</button>
        <span className="text-slate-300 text-[10px]">·</span>
        <button onClick={() => setTermsOpen(true)} className="text-[10px] text-slate-400 hover:text-slate-600 font-medium transition">Accessibility</button>
      </div>

      {/* Footer right — Comment + Contact */}
      <div className={`fixed bottom-8 right-8 z-[100] transition-opacity duration-500 flex items-center gap-2 ${selectedItem || view !== 'gallery' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        {galleryDbId && (
          <button
            onClick={() => { setNoteFormItemId(undefined); setNoteFormItemTitle(undefined); setNoteFormOpen(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition text-slate-600 text-sm font-medium border border-white"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            Comment
          </button>
        )}
        <div className="relative">
          <button
            onClick={() => setContactMenuOpen(!contactMenuOpen)}
            className="flex items-center gap-3 px-5 py-2.5 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition text-slate-600 text-sm font-medium border border-white"
          >
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
            Contact
          </button>
          
          {contactMenuOpen && (
            <div className="absolute bottom-14 right-0 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden min-w-[200px] animate-in slide-in-from-bottom-2">
              <div className="p-3 border-b border-slate-50 text-xs text-slate-400 font-semibold uppercase">Contact Artist</div>
              {contactWhatsapp ? (
                 <a href={`https://wa.me/${sanitizeWhatsapp(contactWhatsapp)}`} target="_blank" rel="noreferrer" className="block px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">WhatsApp</a>
              ) : null}
              {contactEmail ? (
                 <a href={`mailto:${contactEmail}`} className="block px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">Email</a>
              ) : null}
              {!contactWhatsapp && !contactEmail && <div className="px-4 py-3 text-xs text-slate-400 italic">No contact info provided</div>}
            </div>
          )}
        </div>
      </div>

      {/* DONATION TOAST */}
      {donationToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-500">
           <div className="bg-slate-900/90 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4 border border-white/10">
              <div className="text-sm">
                 <span className="block font-bold mb-0.5">Enjoying Aether? ⚡</span>
                 <span className="text-slate-300 text-xs">A small donation keeps the project alive.</span>
              </div>
              <button 
                onClick={() => {
                    setInitialTab('support'); 
                    setBuilderOpen(true);     
                    setDonationToast(false);  
                }} 
                className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-400 rounded-lg text-xs font-bold transition whitespace-nowrap"
              >
                Support
              </button>
              <button onClick={() => setDonationToast(false)} className="text-slate-400 hover:text-white">✕</button>
           </div>
        </div>
      )}

      {/* Landing hero — living 3D sphere behind it */}
      {view === 'landing' && (
        <Landing
          session={session}
          onBuild={() => {
            setView('gallery');
            openBuilder('content');
          }}
          onExplore={() => {
            setExploreOrigin('landing');
            setView('explore');
          }}
          onDemo={() => setView('gallery')}
        />
      )}

      {/* Explore / discovery page */}
      {view === 'explore' && (
        <Explore
          onOpen={handleOpenSlug}
          onBack={() => setView(exploreOrigin)}
          onBuild={() => {
            setView('gallery');
            openBuilder('content');
          }}
        />
      )}

      {termsOpen && <TermsModal onClose={() => setTermsOpen(false)} />}
      {noteFormOpen && galleryDbId && (
        <NoteForm
          galleryId={galleryDbId}
          itemId={noteFormItemId}
          itemTitle={noteFormItemTitle}
          session={session}
          onClose={() => { setNoteFormOpen(false); setNoteFormItemId(undefined); setNoteFormItemTitle(undefined); }}
        />
      )}

      <BuilderModal
        isOpen={builderOpen}
        onClose={() => { setBuilderOpen(false); setAutoOpenNotes(false); }}
        initialTab={initialTab}
        autoOpenNotes={autoOpenNotes}
        session={session}
        galleryItems={galleryItems}
        setGalleryItems={setGalleryItems}
        galleryItemsCount={galleryItems.length}
        inputValue={inputValue}
        setInputValue={setInputValue}
        displayName={displayName}
        setDisplayName={setDisplayName}
        contactWhatsapp={contactWhatsapp}
        setContactWhatsapp={setContactWhatsapp}
        contactEmail={contactEmail}
        setContactEmail={setContactEmail}
        visibility={visibility}
        setVisibility={setVisibility}
        viewMode={viewMode}
        setViewMode={setViewMode}
        canvasMode={canvasMode}
        setCanvasMode={setCanvasMode}
        bookPerPage={bookPerPage}
        setBookPerPage={setBookPerPage}
        onEditLayout={() => { setViewMode('tile'); setCanvasEdit(true); setBuilderOpen(false); }}
        mediaScale={mediaScale}
        setMediaScale={setMediaScale}
        sphereBase={sphereBase}
        setSphereBase={setSphereBase}
        titleFont={titleFont}
        setTitleFont={setTitleFont}
        titleSize={titleSize}
        setTitleSize={setTitleSize}
        myGalleries={myGalleries}
        isLoadingMyGalleries={isLoadingMyGalleries}
        savedGalleryId={savedGalleryId}
        galleryDbId={galleryDbId}
        unreadByGallery={unreadByGallery}
        onNotesRead={refreshUnread}
        isSupabaseConfigured={isSupabaseConfigured}
        isSaving={isSaving}
        loadError={loadError}
        authMessage={authMessage}
        authEmail={authEmail}
        setAuthEmail={setAuthEmail}
        onAddMedia={handleAddMedia}
        onClear={handleClear}
        onSave={handleSaveGallery}
        onStartNew={handleStartNew}
        onCopyLink={handleCopyLink}
        getShareLink={generateShareLink}
        onDeleteGallery={handleDeleteGallery}
        onSetVisibility={handleSetVisibility}
        onLoadGallery={handleOpenSlug}
        onGoogleLogin={handleGoogleLogin}
        onEmailLogin={handleEmailLogin}
        onSignOut={handleSignOut}
      />
    </div>
  );
};

export default App;
