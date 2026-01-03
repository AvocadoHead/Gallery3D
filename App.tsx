import React, { useCallback, useEffect, useMemo, useState, Suspense, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { Canvas } from '@react-three/fiber';
import GalleryScene from './components/FloatingGallery';
import Overlay from './components/Overlay';
import TileGallery from './components/TileGallery';
import BuilderModal from './components/BuilderModal';
import {
  GalleryRecord,
  GallerySummary,
  isSupabaseConfigured,
  loadGalleryRecord,
  listUserGalleries,
  saveGalleryRecord,
  signInWithEmail,
  signInWithGoogle,
  signOut,
  supabase,
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
    <div className="w-10 h-10 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
  </div>
);

const App: React.FC = () => {
  const shareBase = useMemo(
    () => (typeof window !== 'undefined' ? window.location.origin : 'https://gallery3-d.vercel.app'),
    [],
  );

  // --- UI State ---
  const [builderOpen, setBuilderOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [contactMenuOpen, setContactMenuOpen] = useState(false);
  
  // --- Gallery Configuration (Defaults) ---
  const [viewMode, setViewMode] = useState<'sphere' | 'tile'>('sphere'); // Default to Sphere
  const [mediaScale, setMediaScale] = useState(1.5);  
  const [sphereBase, setSphereBase] = useState(62);
  const [tileGap, setTileGap] = useState(12);

  // --- Data State ---
  const [galleryItems, setGalleryItems] = useState<MediaItem[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [contactWhatsapp, setContactWhatsapp] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [savedGalleryId, setSavedGalleryId] = useState('');
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

  // Fix Issue 6: Load Parameters from Share URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const layout = params.get('layout');
    const scale = params.get('scale');
    const radius = params.get('radius');
    const gap = params.get('gap');
    
    if (layout) setViewMode(layout as 'sphere' | 'tile');
    if (scale) setMediaScale(parseInt(scale) / 100);
    if (radius) setSphereBase(parseInt(radius));
    if (gap) setTileGap(parseInt(gap));
  }, []);

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
        setBuilderOpen(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
  }, [session, isSupabaseConfigured]);

  // --- URL PARSING & LOADING ---
  const applyLoadedRecord = useCallback(
    (record: GalleryRecord) => {
      setGalleryItems(record.items || []);
      setDisplayName(record.display_name || '');
      setContactWhatsapp(record.contact_whatsapp || '');
      setContactEmail(record.contact_email || '');
      
      // Apply saved settings
      if (record.settings) {
        if (record.settings.viewMode) setViewMode(record.settings.viewMode);
        if (record.settings.mediaScale) setMediaScale(record.settings.mediaScale);
        if (record.settings.sphereBase) setSphereBase(record.settings.sphereBase);
        if (record.settings.tileGap) setTileGap(record.settings.tileGap);
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
        setInputValue(incoming.urls.join('\n')); 
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
    };

    syncFromQuery();
    window.addEventListener('popstate', syncFromQuery);
    return () => window.removeEventListener('popstate', syncFromQuery);
  }, [applyLoadedRecord]);

  // --- HANDLERS ---
  const handleAddMedia = () => {
    const entries = inputValue.split(/[,\n]/).map((v) => v.trim()).filter(Boolean);
    if (!entries.length) return;
    const nextItems = buildMediaItemsFromUrls(entries);
    setGalleryItems(nextItems);
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

  const handleSaveGallery = async (options?: { asNew?: boolean }) => {
    const entries = inputValue.split(/[,\n]/).map((v) => v.trim()).filter(Boolean);
    const itemsToSave = entries.length ? buildMediaItemsFromUrls(entries) : galleryItems;

    if (!itemsToSave.length || !isSupabaseConfigured) return;

    setIsSaving(true);
    try {
      const record = await saveGalleryRecord(
        {
          id: options?.asNew ? undefined : savedGalleryId || undefined,
          slug: options?.asNew ? undefined : savedGalleryId || undefined,
          items: itemsToSave,
          display_name: displayName || null,
          contact_email: contactEmail || null,
          contact_whatsapp: contactWhatsapp || null,
          settings: {
            viewMode,
            mediaScale,
            sphereBase,
            tileGap
          }
        },
        session,
        { asNew: options?.asNew },
      );
      const link = applyLoadedRecord(record);
      window.history.replaceState(null, '', link);
      refreshMyGalleries();
    } catch (err: any) {
      setLoadError(err?.message || 'Save failed.');
    } finally {
      setIsSaving(false);
    }
  };

  // CHANGE: Added suppressToast argument to prevent background toast when modal is open
  const handleCopyLink = async (specificLink?: string, suppressToast?: boolean) => {
    let link = specificLink;
    if (!link) {
        if (savedGalleryId) {
            link = `${shareBase}/?gallery=${savedGalleryId}`;
        } else if (galleryItems.length) {
            link = `${shareBase}/?gallery=${encodeGalleryParam(galleryItems, { displayName, contactWhatsapp, contactEmail })}`;
        }
    }
    if (!link) return;

    if (!link.includes('&layout=')) {
      const url = new URL(link);
      url.searchParams.set('layout', viewMode);
      url.searchParams.set('scale', Math.round(mediaScale * 100).toString());
      if (viewMode === 'sphere') url.searchParams.set('radius', sphereBase.toString());
      if (viewMode === 'tile') url.searchParams.set('gap', tileGap.toString());
      link = url.toString();
    }

    try {
      await navigator.clipboard.writeText(link);
      if (!suppressToast) {
        setToastVisible(true);
        setTimeout(() => setToastVisible(false), 2000);
      }
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
  };

  return (
    <div className="w-full h-screen relative bg-gradient-to-br from-[#f8fafc] to-[#e2e8f0] overflow-hidden">
      
      {/* 3D Scene */}
      <div className={`absolute inset-0 transition-all duration-700 ease-out ${selectedItem ? 'scale-105 blur-sm opacity-50' : 'scale-100 blur-0 opacity-100'}`}>
        {viewMode === 'sphere' ? (
          <Suspense fallback={<Loader />}>
            <Canvas camera={{ position: [0, 0, 65], fov: 50 }} dpr={[1, 1.5]} gl={{ antialias: false, alpha: true }} className="bg-transparent">
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
        {loadingRemote && <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm z-10"><Loader /></div>}
      </div>

      <Overlay artwork={selectedItem} onClose={() => setSelectedItem(null)} />

      {/* Header */}
      <div className={`fixed top-8 left-8 z-20 transition-opacity duration-500 flex flex-col items-start gap-4 ${selectedItem ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <div className="flex items-center gap-3">
        <button onClick={() => setBuilderOpen(true)} className="p-4 -ml-2 hover:bg-slate-100 rounded-lg transition-colors" aria-label="Open menu">
          <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        {/* Title */}
        <div>
          <h1 className="text-3xl font-light text-slate-800 tracking-tighter  transition-colors">Aether</h1>
          {/* Change 1: Removed pill from here */}
          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-400 font-medium tracking-widest uppercase mt-1 ml-1 transition-colors">Gallery</p>
          </div>
        </div>
      </div>
        
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
                viewMode === 'tile' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:text-slate-900'
              }`}
              onClick={() => setViewMode('tile')}
            >
              Masonry
            </button>
        </div>

        {/* Change 1: Added pill here under buttons, bold, heebo font */}
        {displayName && (
           <div 
             className="px-3 py-1 bg-white/60 backdrop-blur-sm rounded-lg border border-slate-200 shadow-sm text-sm text-slate-800 font-bold tracking-tight"
             style={{ fontFamily: 'Heebo, sans-serif' }}
           >
             {displayName}
           </div>
        )}
        
        {toastVisible && (
          <div className="px-3 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-lg animate-bounce">
            Link Copied!
          </div>
        )}
      </div>

      {/* Footer Contact */}
      <div className={`fixed bottom-8 right-8 z-20 transition-opacity duration-500 ${selectedItem ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
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

      <BuilderModal
        isOpen={builderOpen}
        onClose={() => setBuilderOpen(false)}
        session={session}
        galleryItemsCount={galleryItems.length}
        inputValue={inputValue}
        setInputValue={setInputValue}
        displayName={displayName}
        setDisplayName={setDisplayName}
        contactWhatsapp={contactWhatsapp}
        setContactWhatsapp={setContactWhatsapp}
        contactEmail={contactEmail}
        setContactEmail={setContactEmail}
        viewMode={viewMode}
        setViewMode={setViewMode}
        mediaScale={mediaScale}
        setMediaScale={setMediaScale}
        sphereBase={sphereBase}
        setSphereBase={setSphereBase}
        tileGap={tileGap}
        setTileGap={setTileGap}
        myGalleries={myGalleries}
        isLoadingMyGalleries={isLoadingMyGalleries}
        savedGalleryId={savedGalleryId}
        isSupabaseConfigured={isSupabaseConfigured}
        isSaving={isSaving}
        loadError={loadError}
        authMessage={authMessage}
        authEmail={authEmail}
        setAuthEmail={setAuthEmail}
        onAddMedia={handleAddMedia}
        onClear={handleClear}
        onSave={handleSaveGallery}
        // Change 2: Update prop signature to accept suppressToast
        onCopyLink={handleCopyLink}
        onLoadGallery={async (slug) => { 
          try {
            const record = await loadGalleryRecord(slug); 
            if (record) {
              const link = applyLoadedRecord(record);
              window.history.replaceState(null, '', link);
              const urls = record.items.map(i => i.originalUrl).join('\n');
              setInputValue(urls);
            }
          } catch (err) {
            console.error('Load error:', err);
            setLoadError('Failed to load gallery');
          }
        }}        
        onGoogleLogin={handleGoogleLogin}
        onEmailLogin={handleEmailLogin}
        onSignOut={handleSignOut}
      />
    </div>
  );
};

export default App;
