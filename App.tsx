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

// --- PATIENCE LOADER (Safe HTML Component) ---
const Loader = () => (
  <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-slate-50/90 backdrop-blur-md transition-opacity duration-700">
    <div className="relative mb-4">
      <div className="w-16 h-16 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
    </div>
    <h2 className="text-xl font-light text-slate-800 tracking-widest uppercase animate-pulse">Curating Gallery</h2>
    <p className="text-xs text-slate-500 mt-2 font-medium max-w-xs text-center leading-relaxed">
      Please have patience.<br/>
      Creating a beautiful 3D experience for you.
    </p>
  </div>
);

const App: React.FC = () => {
  const shareBase = useMemo(
    () => (typeof window !== 'undefined' ? window.location.origin : 'https://gallery3-d.vercel.app'),
    [],
  );

  // --- UI State ---
  const [builderOpen, setBuilderOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<'galleries' | 'support'>('galleries'); 
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [donationToast, setDonationToast] = useState(false);
  const [contactMenuOpen, setContactMenuOpen] = useState(false);

  // --- Gallery Configuration ---
  const [viewMode, setViewMode] = useState<'sphere' | 'tile' | 'carousel'>('sphere');
  const [mediaScale, setMediaScale] = useState(1);
  const [sphereBase, setSphereBase] = useState(62);
  const [tileGap, setTileGap] = useState(12);
  const [bgColor, setBgColor] = useState('#f8fafc'); 
  const [shadowOpacity, setShadowOpacity] = useState(0.25);

  // --- Data State ---
  const [galleryItems, setGalleryItems] = useState<MediaItem[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [contactWhatsapp, setContactWhatsapp] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  
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

  const loadStart = useRef(0);
  const finishLoading = () => {
    const elapsed = Date.now() - loadStart.current;
    // Force at least 2 seconds of loading screen to ensure textures prep
    const remaining = Math.max(0, 2000 - elapsed); 
    setTimeout(() => setLoadingRemote(false), remaining);
  };

  // --- LOADING LOGIC ---
  const applyLoadedRecord = useCallback(
    (record: GalleryRecord) => {
      setGalleryItems(record.items || []);
      setDisplayName(record.display_name || '');
      setContactWhatsapp(record.contact_whatsapp || '');
      setContactEmail(record.contact_email || '');
      setGalleryDbId(record.id);
      
      if (record.settings) {
        if (record.settings.viewMode) setViewMode(record.settings.viewMode);
        if (record.settings.mediaScale) setMediaScale(record.settings.mediaScale);
        if (record.settings.sphereBase) setSphereBase(record.settings.sphereBase);
        if (record.settings.tileGap) setTileGap(record.settings.tileGap);
        if (record.settings.bgColor) setBgColor(record.settings.bgColor);
        if (record.settings.shadowOpacity !== undefined) setShadowOpacity(record.settings.shadowOpacity);
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
      loadStart.current = Date.now();
      setLoadingRemote(true); // START LOADING

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
        finishLoading();
        return;
      }

      if (encoded && isSupabaseConfigured) {
        try {
          const record = await loadGalleryRecord(encoded);
          if (record?.items?.length) {
            applyLoadedRecord(record);
            const urls = record.items.map(i => i.originalUrl).join('\n');
            setInputValue(urls);
            finishLoading();
            return;
          }
          setLoadError('Gallery not found.');
        } catch (err) {
          console.warn(err);
          setLoadError('Unable to load gallery.');
        } finally {
          finishLoading();
        }
      } else {
        // DEFAULT GALLERY
        setGalleryItems(buildDefaultMediaItems());
        setMediaScale(1.5);
        setSphereBase(25);
        setBgColor('#f8fafc');
        finishLoading();
      }
    };
    syncFromQuery();
    window.addEventListener('popstate', syncFromQuery);
    return () => window.removeEventListener('popstate', syncFromQuery);
  }, [applyLoadedRecord]);

  // --- HANDLERS (Same as before) ---
  const handleAddMedia = () => {
    const entries = inputValue.split(/[,\n]/).map((v) => v.trim()).filter(Boolean);
    if (!entries.length) return;
    setGalleryItems(buildMediaItemsFromUrls(entries));
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
    setSavedGalleryId('');
    setGalleryDbId(null);
    setViewMode('sphere');
    setMediaScale(1);
    setSphereBase(62);
    setBgColor('#f8fafc');
    window.history.replaceState(null, '', window.location.pathname);
  };

  const handleDeleteGallery = async (galleryId: string) => {
    if (!supabase || !session) return;
    if (!window.confirm('Delete this gallery?')) return;
    try {
      const { error } = await supabase.from('galleries').delete().eq('id', galleryId);
      if (error) throw error;
      refreshMyGalleries(session.user.id);
      if (galleryId === galleryDbId) handleStartNew();
    } catch (err) { alert('Failed to delete.'); }
  };

  const handleSaveGallery = async (options?: { asNew?: boolean }) => {
    const entries = inputValue.split(/[,\n]/).map((v) => v.trim()).filter(Boolean);
    const itemsToSave = entries.length ? buildMediaItemsFromUrls(entries) : galleryItems;
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
          settings: { viewMode, mediaScale, sphereBase, tileGap, bgColor, shadowOpacity }
        },
        session,
        { asNew },
      );
      const link = applyLoadedRecord(record);
      window.history.replaceState(null, '', link);
      refreshMyGalleries();
      setDonationToast(true);
      setTimeout(() => setDonationToast(false), 6000);
    } catch (err: any) { setLoadError(err?.message || 'Save failed.'); } finally { setIsSaving(false); }
  };

  const handleCopyLink = async () => {
    // Generate link logic inline to avoid deps issue
    let link = '';
    if (savedGalleryId) link = `${shareBase}/?gallery=${savedGalleryId}`;
    else if (galleryItems.length) link = `${shareBase}/?gallery=${encodeGalleryParam(galleryItems, { displayName, contactWhatsapp, contactEmail })}`;
    
    if (!link) return;
    const url = new URL(link);
    url.searchParams.set('layout', viewMode);
    url.searchParams.set('scale', Math.round(mediaScale * 100).toString());
    if (viewMode === 'sphere') url.searchParams.set('radius', sphereBase.toString());
    if (viewMode === 'tile') url.searchParams.set('gap', tileGap.toString());
    
    try {
      await navigator.clipboard.writeText(url.toString());
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 2000);
      setTimeout(() => setDonationToast(true), 1000);
      setTimeout(() => setDonationToast(false), 6000);
    } catch (err) { console.warn(err); }
  };

  const handleUpdateItemMetadata = (id: string, title: string, desc: string) => {
    setGalleryItems(prev => prev.map(item => item.id === id ? { ...item, title, description: desc } : item));
  };
  
  // Auth Handlers (Shortened for brevity, logic same)
  const handleGoogleLogin = async () => { try { setAuthMessage('Redirecting...'); await signInWithGoogle(window.location.origin); } catch (err: any) { setLoadError(err.message); } };
  const handleEmailLogin = async () => { if (!authEmail) return; try { setAuthMessage('Check email!'); await signInWithEmail(authEmail, window.location.origin); } catch (err: any) { setLoadError(err.message); } };
  const handleSignOut = async () => { await signOut(); setSession(null); setMyGalleries([]); setGalleryDbId(null); handleStartNew(); };

  return (
    <div 
      className="w-full h-screen relative overflow-hidden transition-colors duration-700"
      style={{ backgroundColor: bgColor }} 
    >
      
      {/* 3D Scene Wrapper */}
      <div className={`absolute inset-0 transition-opacity duration-700 ease-out z-0 ${selectedItem ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
        
        {/* LOGIC CHECK: Are we loading? If yes, show Loader OUTSIDE Canvas */}
        {loadingRemote && <Loader />}

        {viewMode === 'sphere' || viewMode === 'carousel' ? (
          <Suspense fallback={null}>
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
                shadowOpacity={shadowOpacity}
                bgColor={bgColor}
                isCarousel={viewMode === 'carousel'}
              />
            </Canvas>
          </Suspense>
        ) : (
          <TileGallery items={galleryItems} onSelect={setSelectedItem} mediaScale={mediaScale} gap={tileGap} />
        )}
      </div>

      <Overlay artwork={selectedItem} onClose={() => setSelectedItem(null)} />

      {/* Header */}
      <div className={`fixed top-8 left-8 z-[100] transition-opacity duration-500 flex flex-col items-start gap-3 ${selectedItem ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <div className="flex items-center gap-3">
          <button onClick={() => { setInitialTab('galleries'); setBuilderOpen(true); }} className="p-2 hover:bg-white/50 rounded-lg transition-colors shadow-sm bg-white/30 backdrop-blur-md border border-white/20">
            <svg className="w-6 h-6 text-slate-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="cursor-pointer" onClick={() => window.location.href = window.location.origin}>
            <h1 className="text-3xl font-light text-slate-800 tracking-tighter transition-colors">Aether</h1>
            <div className="flex items-center gap-2"><p className="text-xs text-slate-500 font-medium tracking-widest uppercase mt-1 ml-1 transition-colors">Gallery</p></div>
          </div>
        </div>
        <div className="inline-flex items-center rounded-full bg-white/40 shadow-sm border border-white/30 backdrop-blur-md p-1">
            <button className={`px-3 py-1 text-xs font-semibold rounded-full transition ${viewMode === 'sphere' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:text-slate-900'}`} onClick={() => setViewMode('sphere')}>Sphere</button>
            <button className={`px-3 py-1 text-xs font-semibold rounded-full transition ${viewMode === 'carousel' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:text-slate-900'}`} onClick={() => setViewMode('carousel')}>Carousel</button>
            <button className={`px-3 py-1 text-xs font-semibold rounded-full transition ${viewMode === 'tile' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:text-slate-900'}`} onClick={() => setViewMode('tile')}>Masonry</button>
        </div>
        {displayName && <div className="px-3 py-1 bg-white/40 backdrop-blur-md rounded-lg border border-white/20 shadow-sm text-sm text-slate-800 font-bold tracking-tight" style={{ fontFamily: 'Heebo, sans-serif' }}>{displayName}</div>}
        {toastVisible && <div className="px-3 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-lg animate-bounce flex items-center gap-2">Link Copied!</div>}
      </div>

      {/* Footer Contact */}
      <div className={`fixed bottom-8 right-8 z-[100] transition-opacity duration-500 ${selectedItem ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <div className="relative">
          <button onClick={() => setContactMenuOpen(!contactMenuOpen)} className="flex items-center gap-3 px-5 py-2.5 bg-white/80 backdrop-blur-md rounded-full shadow-lg hover:bg-white transition text-slate-700 text-sm font-medium border border-white/40">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />Contact
          </button>
          {contactMenuOpen && (
            <div className="absolute bottom-14 right-0 bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 overflow-hidden min-w-[200px] animate-in slide-in-from-bottom-2">
              <div className="p-3 border-b border-slate-100 text-xs text-slate-400 font-semibold uppercase">Contact Artist</div>
              {contactWhatsapp ? <a href={`https://wa.me/${sanitizeWhatsapp(contactWhatsapp)}`} target="_blank" rel="noreferrer" className="block px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">WhatsApp</a> : null}
              {contactEmail ? <a href={`mailto:${contactEmail}`} className="block px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">Email</a> : null}
              {!contactWhatsapp && !contactEmail && <div className="px-4 py-3 text-xs text-slate-400 italic">No contact info provided</div>}
            </div>
          )}
        </div>
      </div>

      {/* Donation Toast */}
      {donationToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-500">
           <div className="bg-slate-900/90 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4 border border-white/10">
              <div className="text-sm"><span className="block font-bold mb-0.5">Enjoying Aether? ⚡</span><span className="text-slate-300 text-xs">A small donation keeps the project alive.</span></div>
              <button onClick={() => { setInitialTab('support'); setBuilderOpen(true); setDonationToast(false); }} className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-400 rounded-lg text-xs font-bold transition whitespace-nowrap">Support</button>
              <button onClick={() => setDonationToast(false)} className="text-slate-400 hover:text-white">✕</button>
           </div>
        </div>
      )}

      <BuilderModal
        isOpen={builderOpen}
        onClose={() => setBuilderOpen(false)}
        initialTab={initialTab}
        session={session}
        galleryItems={galleryItems}
        galleryItemsCount={galleryItems.length}
        onUpdateItemMetadata={handleUpdateItemMetadata}
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
        bgColor={bgColor}
        setBgColor={setBgColor}
        shadowOpacity={shadowOpacity}
        setShadowOpacity={setShadowOpacity}
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
        onStartNew={handleStartNew} 
        onCopyLink={handleCopyLink} 
        onDeleteGallery={handleDeleteGallery}
        onLoadGallery={async (slug) => { 
          try {
            setBuilderOpen(false);
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
