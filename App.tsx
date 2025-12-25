import React, { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import { Session } from '@supabase/supabase-js';
import { Canvas } from '@react-three/fiber';
import GalleryScene from './components/FloatingGallery';
import Overlay from './components/Overlay';
import TileGallery from './components/TileGallery';
import BuilderModal from './components/BuilderModal'; // Make sure to import the new component
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
    <div className="w-10 h-10 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
  </div>
);

const App: React.FC = () => {
  // --- Constants ---
  const shareBase = useMemo(
    () => (typeof window !== 'undefined' ? window.location.origin : 'https://gallery3-d.vercel.app'),
    [],
  );

  // --- UI State ---
  const [builderOpen, setBuilderOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [contactMenuOpen, setContactMenuOpen] = useState(false);
  
  // --- Gallery Configuration State ---
  const [viewMode, setViewMode] = useState<'sphere' | 'tile'>('sphere');
  const [mediaScale, setMediaScale] = useState(1);
  const [sphereBase, setSphereBase] = useState(62);
  const [tileGap, setTileGap] = useState(8);

  // --- Gallery Data State ---
  const [galleryItems, setGalleryItems] = useState<MediaItem[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [contactWhatsapp, setContactWhatsapp] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [savedGalleryId, setSavedGalleryId] = useState('');
  const [isClearing, setIsClearing] = useState(false);

  // --- Async/Remote State ---
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // --- Auth State ---
  const [session, setSession] = useState<Session | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [myGalleries, setMyGalleries] = useState<GallerySummary[]>([]);
  const [isLoadingMyGalleries, setIsLoadingMyGalleries] = useState(false);

  // --- URL & Routing Logic ---

  const applyLoadedRecord = useCallback(
    (record: GalleryRecord) => {
      setGalleryItems(record.items || []);
      setDisplayName(record.display_name || '');
      setContactWhatsapp(record.contact_whatsapp || '');
      setContactEmail(record.contact_email || '');
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
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      return hashParams.get('gallery');
    };

    const syncFromQuery = async () => {
      setLoadError('');
      const encoded = extractGallery();
      const incoming = decodeGalleryParam(encoded);

      // Case A: URL contains raw links (Custom, unsaved)
      if (incoming.urls.length) {
        setGalleryItems(buildMediaItemsFromUrls(incoming.urls));
        setDisplayName(incoming.displayName || '');
        setContactWhatsapp(incoming.contactWhatsapp || '');
        setContactEmail(incoming.contactEmail || '');
        setSavedGalleryId('');
        // Populate input value so editor shows current links
        setInputValue(incoming.urls.join('\n')); 
        return;
      }

      // Case B: URL contains an ID (Saved in DB)
      if (encoded && isSupabaseConfigured) {
        setLoadingRemote(true);
        try {
          const record = await loadGalleryRecord(encoded);
          if (record?.items?.length) {
            applyLoadedRecord(record);
            // Populate input value from loaded record
            const urls = record.items.map(i => i.originalUrl).join('\n');
            setInputValue(urls);
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

      // Case C: Default/Empty
      setSavedGalleryId('');
      setDisplayName('');
      setContactWhatsapp('');
      setContactEmail('');
      setGalleryItems(buildDefaultMediaItems());
    };

    syncFromQuery();
    window.addEventListener('popstate', syncFromQuery);
    return () => window.removeEventListener('popstate', syncFromQuery);
  }, [applyLoadedRecord]);

  // --- Handlers ---

  const handleAddMedia = () => {
    const entries = inputValue
      .split(/[,\n]/)
      .map((v) => v.trim())
      .filter(Boolean);

    if (!entries.length) return;

    const nextItems = buildMediaItemsFromUrls(entries);
    setGalleryItems(nextItems); // Replace items instead of append to keep it synced with TextArea
    // We don't clear input value here, we keep it as "source of truth"
    setSelectedItem(null);
    setSavedGalleryId(''); // Modifying makes it a "new" unsaved version potentially
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

  // Auth Handling
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const unsubscribe = listenToAuth(setSession);
    return () => unsubscribe && unsubscribe();
  }, []);

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
    } else {
      refreshMyGalleries();
    }
  }, [refreshMyGalleries, session]);

  // Persistence Handling
  const handleSaveGallery = async (options?: { asNew?: boolean }) => {
    // Sync input before saving
    const entries = inputValue.split(/[,\n]/).map((v) => v.trim()).filter(Boolean);
    const itemsToSave = entries.length ? buildMediaItemsFromUrls(entries) : galleryItems;

    if (!itemsToSave.length) {
      setLoadError('Cannot save an empty gallery');
      return;
    }

    if (!isSupabaseConfigured) {
      setLoadError('Supabase config missing.');
      return;
    }

    setIsSaving(true);
    setLoadError('');
    try {
      const record = await saveGalleryRecord(
        {
          id: options?.asNew ? undefined : savedGalleryId || undefined,
          slug: options?.asNew ? undefined : savedGalleryId || undefined,
          items: itemsToSave,
          display_name: displayName || null,
          contact_email: contactEmail || null,
          contact_whatsapp: contactWhatsapp || null,
        },
        session,
        { asNew: options?.asNew },
      );
      const link = applyLoadedRecord(record);
      window.history.replaceState(null, '', link);
      refreshMyGalleries();
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to save gallery.');
    } finally {
      setIsSaving(false);
    }
  };

  const loadSavedGallery = async (slugOrId: string) => {
     if (!isSupabaseConfigured) return;
     setLoadError('');
     setLoadingRemote(true);
     try {
       const record = await loadGalleryRecord(slugOrId);
       if (record?.items?.length) {
         const link = applyLoadedRecord(record);
         window.history.replaceState(null, '', link);
         // Update Text Area
         const urls = record.items.map(i => i.originalUrl).join('\n');
         setInputValue(urls);
         // setBuilderOpen(false); // Optional: close builder on load?
       }
     } catch (err) {
       setLoadError('Load failed.');
     } finally {
       setLoadingRemote(false);
     }
  };

  const getShareLink = () => {
    if (savedGalleryId) return `${shareBase}/?gallery=${savedGalleryId}`;
    if (!galleryItems.length) return '';
    return `${shareBase}/?gallery=${encodeGalleryParam(galleryItems, {
      displayName,
      contactWhatsapp,
      contactEmail,
    })}`;
  };

  const handleShare = async () => {
    let link = getShareLink();
    
    // Auto-save if logged in and not saved yet
    if (isSupabaseConfigured && session && !savedGalleryId && galleryItems.length) {
       await handleSaveGallery();
       // Re-get link after save
       link = getShareLink(); 
    }

    if (!link) return;

    if (navigator.share) {
      navigator.share({ title: 'Aether Gallery', url: link }).catch(console.warn);
    } else {
      handleCopyLink();
    }
  };

  const handleCopyLink = async () => {
    const link = getShareLink();
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 2000);
    } catch (err) {
      console.warn('Clipboard failed', err);
    }
  };

  // Login Handlers
  const handleGoogleLogin = async () => {
    try {
      setAuthMessage('Redirecting...');
      await signInWithGoogle(window.location.origin);
    } catch (err: any) { setLoadError(err.message); }
  };

  const handleEmailLogin = async () => {
    if (!authEmail) return;
    try {
      setAuthMessage('Check your email!');
      await signInWithEmail(authEmail, window.location.origin);
    } catch (err: any) { setLoadError(err.message); }
  };

  const handleSignOut = async () => {
    await signOut();
    setSession(null);
    setMyGalleries([]);
    setAuthMessage('');
  };

  // --- Render ---

  return (
    <div className="w-full h-screen relative bg-gradient-to-br from-[#f8fafc] to-[#e2e8f0] overflow-hidden">
      
      {/* 3D Scene / Background */}
      <div className={`absolute inset-0 transition-all duration-700 ease-out ${selectedItem ? 'scale-105 blur-sm opacity-50' : 'scale-100 blur-0 opacity-100'}`}>
        {viewMode === 'sphere' ? (
          <Suspense fallback={<Loader />}>
            <Canvas camera={{ position: [0, 0, 75], fov: 50 }} dpr={[1, 1.5]} gl={{ antialias: false, alpha: true }} className="bg-transparent">
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
             <Loader />
          </div>
        )}
      </div>

      <Overlay artwork={selectedItem} onClose={() => setSelectedItem(null)} />

      {/* Header UI */}
      <div className={`fixed top-8 left-8 z-20 transition-opacity duration-500 ${selectedItem ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <button onClick={() => setBuilderOpen(true)} className="group text-left">
          <h1 className="text-3xl font-light text-slate-800 tracking-tighter group-hover:text-slate-900">Aether</h1>
          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-400 font-medium tracking-widest uppercase mt-1 ml-1">Gallery</p>
            {displayName && <span className="text-[11px] bg-white/50 px-2 py-0.5 rounded-full border border-slate-200 text-slate-500">{displayName}</span>}
          </div>
        </button>
        
        <div className="mt-4 flex gap-2">
            <button onClick={() => setBuilderOpen(true)} className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-full shadow-lg hover:transform hover:-translate-y-0.5 transition">
               Open Builder
            </button>
            <button onClick={handleShare} className="px-4 py-2 bg-white text-slate-700 text-xs font-semibold rounded-full shadow-md hover:bg-slate-50 transition border border-slate-100">
               Share
            </button>
        </div>
        
        {toastVisible && (
          <div className="mt-2 px-3 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-lg animate-bounce">
            Link Copied!
          </div>
        )}
      </div>

      {/* Footer / Contact Button */}
      <div className={`fixed bottom-8 right-8 z-20 transition-opacity duration-500 ${selectedItem ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <div className="relative">
          <button
            onClick={() => setContactMenuOpen(!contactMenuOpen)}
            className="flex items-center gap-3 px-5 py-2.5 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition text-slate-600 text-sm font-medium"
          >
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Contact
          </button>
          
          {contactMenuOpen && (
            <div className="absolute bottom-14 right-0 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden min-w-[200px] animate-in slide-in-from-bottom-2">
              <div className="p-3 border-b border-slate-50 text-xs text-slate-400 font-semibold uppercase">Contact Artist</div>
              {contactWhatsapp && (
                 <a href={`https://wa.me/${sanitizeWhatsapp(contactWhatsapp)}`} target="_blank" rel="noreferrer" className="block px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">
                   WhatsApp
                 </a>
              )}
              {contactEmail && (
                 <a href={`mailto:${contactEmail}`} className="block px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">
                   Email
                 </a>
              )}
              {!contactWhatsapp && !contactEmail && (
                 <div className="px-4 py-3 text-xs text-slate-400 italic">No contact info provided</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* The New Builder Modal */}
      <BuilderModal
        isOpen={builderOpen}
        onClose={() => setBuilderOpen(false)}
        session={session}
        galleryItemsCount={galleryItems.length}
        // State Props
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
        // Data Props
        myGalleries={myGalleries}
        isLoadingMyGalleries={isLoadingMyGalleries}
        savedGalleryId={savedGalleryId}
        isSupabaseConfigured={isSupabaseConfigured}
        isSaving={isSaving}
        loadError={loadError}
        authMessage={authMessage}
        authEmail={authEmail}
        setAuthEmail={setAuthEmail}
        // Action Handlers
        onAddMedia={handleAddMedia}
        onClear={handleClear}
        onSave={handleSaveGallery}
        onShare={handleShare}
        onCopyLink={handleCopyLink}
        onLoadGallery={loadSavedGallery}
        onGoogleLogin={handleGoogleLogin}
        onEmailLogin={handleEmailLogin}
        onSignOut={handleSignOut}
      />
    </div>
  );
};

export default App;
