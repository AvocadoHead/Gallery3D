import React, { useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { GallerySummary } from '../supabaseClient';

interface BuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  // State
  session: Session | null;
  galleryItemsCount: number;
  inputValue: string;
  setInputValue: (val: string) => void;
  displayName: string;
  setDisplayName: (val: string) => void;
  contactWhatsapp: string;
  setContactWhatsapp: (val: string) => void;
  contactEmail: string;
  setContactEmail: (val: string) => void;
  // Settings
  viewMode: 'sphere' | 'tile';
  setViewMode: (mode: 'sphere' | 'tile') => void;
  mediaScale: number;
  setMediaScale: (val: number) => void;
  sphereBase: number;
  setSphereBase: (val: number) => void;
  tileGap: number;
  setTileGap: (val: number) => void;
  // Data
  myGalleries: GallerySummary[];
  isLoadingMyGalleries: boolean;
  savedGalleryId: string;
  isSupabaseConfigured: boolean;
  isSaving: boolean;
  loadError: string;
  authMessage: string;
  authEmail: string;
  setAuthEmail: (val: string) => void;
  // Actions
  onAddMedia: () => void;
  onClear: () => void;
  onSave: (asNew?: boolean) => void;
  onShare: () => void;
  onCopyLink: () => void;
  onLoadGallery: (slug: string) => void;
  onGoogleLogin: () => void;
  onEmailLogin: () => void;
  onSignOut: () => void;
}

const BuilderModal: React.FC<BuilderModalProps> = ({
  isOpen,
  onClose,
  session,
  galleryItemsCount,
  inputValue,
  setInputValue,
  displayName,
  setDisplayName,
  contactWhatsapp,
  setContactWhatsapp,
  contactEmail,
  setContactEmail,
  viewMode,
  setViewMode,
  mediaScale,
  setMediaScale,
  sphereBase,
  setSphereBase,
  tileGap,
  setTileGap,
  myGalleries,
  isLoadingMyGalleries,
  savedGalleryId,
  isSupabaseConfigured,
  isSaving,
  loadError,
  authMessage,
  authEmail,
  setAuthEmail,
  onAddMedia,
  onClear,
  onSave,
  onShare,
  onCopyLink,
  onLoadGallery,
  onGoogleLogin,
  onEmailLogin,
  onSignOut,
}) => {
  const [activeTab, setActiveTab] = useState<'editor' | 'library' | 'appearance' | 'support'>('editor');

  if (!isOpen) return null;

  const TabButton = ({ id, label }: { id: typeof activeTab; label: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all ${
        activeTab === id
          ? 'bg-slate-900 text-white shadow-md'
          : 'text-slate-500 hover:bg-slate-100'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 pointer-events-none">
      <div className="w-[680px] max-w-full max-h-[85vh] flex flex-col bg-white/95 backdrop-blur-xl border border-white/50 rounded-[32px] shadow-2xl pointer-events-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header with Login Status */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-white/50">
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            <TabButton id="editor" label="Editor" />
            <TabButton id="library" label="Library" />
            <TabButton id="appearance" label="View" />
            <TabButton id="support" label="Support" />
          </div>
          
          <div className="flex items-center gap-3 pl-2">
            {!session ? (
              <button 
                onClick={() => setActiveTab('library')}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition"
              >
                Log In
              </button>
            ) : (
               <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                 <span className="text-[10px] text-slate-500 font-medium max-w-[100px] truncate">
                   {session.user.email}
                 </span>
               </div>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loadError && (
            <div className="p-3 bg-rose-50 text-rose-600 text-xs rounded-xl border border-rose-100">
              {loadError}
            </div>
          )}

          {/* --- EDITOR TAB --- */}
          {activeTab === 'editor' && (
            <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <label className="text-sm font-bold text-slate-800">Media URLs</label>
                  <span className="text-xs text-slate-400">{galleryItemsCount} items active</span>
                </div>
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Paste Google Drive, YouTube, or Image links here (separated by new lines)..."
                  className="w-full h-32 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs focus:ring-2 focus:ring-slate-900 outline-none resize-none transition-all font-mono"
                />
                <div className="flex gap-2 justify-end">
                   <button
                    onClick={onClear}
                    className="px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={onAddMedia}
                    className="px-6 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl shadow-lg hover:transform hover:-translate-y-0.5 transition"
                  >
                    Apply Changes
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 ml-1">Display Name</label>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Summer Collection"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-slate-900 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 ml-1">Contact (Email/WA)</label>
                  <input
                    value={contactEmail || contactWhatsapp}
                    onChange={(e) => {
                      const val = e.target.value;
                      if(val.includes('@')) { setContactEmail(val); setContactWhatsapp(''); }
                      else { setContactWhatsapp(val); setContactEmail(''); }
                    }}
                    placeholder="Email or Phone number"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-slate-900 outline-none"
                  />
                </div>
              </div>

              <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex flex-col gap-3">
                 {!session ? (
                    <div className="flex items-center justify-between">
                       <p className="text-xs text-emerald-800">Want to save your gallery forever?</p>
                       <button onClick={() => setActiveTab('library')} className="text-xs font-bold text-emerald-600 bg-white border border-emerald-200 px-3 py-1 rounded-lg hover:bg-emerald-50">
                          Log in to Save
                       </button>
                    </div>
                 ) : (
                    <>
                       <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Cloud Save</span>
                          {savedGalleryId && <span className="text-[10px] text-emerald-600 font-mono bg-emerald-100 px-2 py-1 rounded">ID: {savedGalleryId}</span>}
                       </div>
                       <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => onSave(false)} disabled={isSaving || !isSupabaseConfigured} className="py-2.5 bg-white border border-emerald-200 text-emerald-700 font-semibold rounded-xl text-xs hover:bg-emerald-50 transition">
                             {isSaving ? 'Saving...' : savedGalleryId ? 'Update Existing' : 'Save Gallery'}
                          </button>
                          <button onClick={() => onSave(true)} disabled={isSaving || !isSupabaseConfigured} className="py-2.5 bg-white border border-emerald-200 text-emerald-700 font-semibold rounded-xl text-xs hover:bg-emerald-50 transition">
                             Save as New
                          </button>
                       </div>
                    </>
                 )}
                 <button onClick={onShare} className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl text-sm shadow-md hover:bg-emerald-700 transition mt-1">
                    Share Now
                 </button>
              </div>
            </div>
          )}

          {/* --- LIBRARY TAB (Login & Lists) --- */}
          {activeTab === 'library' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              
              {!session ? (
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4 shadow-inner">
                  <div className="text-center space-y-1">
                    <h3 className="font-bold text-slate-900">Sign in to Aether</h3>
                    <p className="text-xs text-slate-500">Access your saved galleries across devices.</p>
                  </div>
                  
                  {/* GOOGLE LOGIN BUTTON */}
                  <button 
                    onClick={onGoogleLogin} 
                    disabled={!isSupabaseConfigured}
                    className="w-full py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.64 2 12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c5.19 0 9.49-3.73 9.49-10c0-1.3-.15-2.29-.14-2.9z" />
                    </svg>
                    Continue with Google
                  </button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200"></span></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-slate-50 px-2 text-slate-400">Or with email</span></div>
                  </div>

                  <div className="flex gap-2">
                    <input 
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-slate-900 outline-none"
                    />
                    <button onClick={onEmailLogin} disabled={!isSupabaseConfigured} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold">
                      Send Magic Link
                    </button>
                  </div>
                  {authMessage && <p className="text-center text-xs text-emerald-600 font-medium bg-emerald-50 py-1 rounded">{authMessage}</p>}
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 bg-slate-900 text-white rounded-2xl shadow-lg">
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Currently signed in</p>
                    <p className="text-sm font-medium">{session.user.email}</p>
                  </div>
                  <button onClick={onSignOut} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-semibold transition border border-white/20">
                    Sign Out
                  </button>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800">My Saved Galleries</h3>
                  {isLoadingMyGalleries && <span className="text-xs text-slate-400 animate-pulse">Syncing...</span>}
                </div>
                
                <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                  {!session && (
                    <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs">
                      Sign in above to view your saved collection
                    </div>
                  )}
                  {session && myGalleries.length === 0 && !isLoadingMyGalleries && (
                    <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs">
                      No galleries found. Create one in the Editor!
                    </div>
                  )}
                  {myGalleries.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => onLoadGallery(g.slug || g.id)}
                      className="group flex flex-col items-start p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-400 hover:shadow-md transition-all w-full text-left"
                    >
                      <span className="font-semibold text-slate-800 text-xs group-hover:text-blue-600 transition-colors truncate w-full">
                        {g.display_name || 'Untitled Gallery'}
                      </span>
                      <div className="flex justify-between w-full mt-1">
                        <span className="text-[10px] text-slate-400 font-mono bg-slate-50 px-1.5 py-0.5 rounded">
                          {g.slug || g.id}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(g.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* --- APPEARANCE TAB --- */}
          {activeTab === 'appearance' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 px-1">
               <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-700">Display Mode</span>
                    <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
                      <button 
                        onClick={() => setViewMode('sphere')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${viewMode === 'sphere' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
                      >
                        Sphere
                      </button>
                      <button 
                        onClick={() => setViewMode('tile')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${viewMode === 'tile' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
                      >
                        Masonry
                      </button>
                    </div>
                  </div>
               </div>

               <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <label className="text-xs font-bold text-slate-600">Card Scale</label>
                      <span className="text-xs text-slate-400">{Math.round(mediaScale * 100)}%</span>
                    </div>
                    <input 
                      type="range" min={0.5} max={1.5} step={0.1}
                      value={mediaScale} onChange={(e) => setMediaScale(parseFloat(e.target.value))}
                      className="w-full accent-slate-900 cursor-pointer"
                    />
                  </div>

                  {viewMode === 'sphere' && (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <label className="text-xs font-bold text-slate-600">Sphere Radius</label>
                        <span className="text-xs text-slate-400">{sphereBase}</span>
                      </div>
                      <input 
                        type="range" min={40} max={120} step={2}
                        value={sphereBase} onChange={(e) => setSphereBase(parseFloat(e.target.value))}
                        className="w-full accent-slate-900 cursor-pointer"
                      />
                    </div>
                  )}

                  {viewMode === 'tile' && (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <label className="text-xs font-bold text-slate-600">Grid Gap</label>
                        <span className="text-xs text-slate-400">{tileGap}px</span>
                      </div>
                      <input 
                        type="range" min={0} max={30} step={1}
                        value={tileGap} onChange={(e) => setTileGap(parseFloat(e.target.value))}
                        className="w-full accent-slate-900 cursor-pointer"
                      />
                    </div>
                  )}
               </div>
            </div>
          )}

          {/* --- SUPPORT TAB (RESTORED) --- */}
          {activeTab === 'support' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
               <div className="bg-slate-900 text-white rounded-3xl p-6 flex flex-col md:flex-row items-center gap-6 shadow-xl relative overflow-hidden">
                  <div className="relative z-10 w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-300 via-amber-400 to-pink-500 flex items-center justify-center text-slate-900 font-bold shadow-lg text-2xl flex-shrink-0">
                    1$
                  </div>
                  <div className="relative z-10 text-center md:text-left space-y-2">
                    <p className="font-bold text-lg">Enjoying the gallery?</p>
                    <p className="text-slate-300 text-sm">A friendly tip (1$ / 5₪) keeps the lights on and the servers running.</p>
                  </div>
                  {/* Decorative blur */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/30 blur-3xl rounded-full" />
               </div>

               <div className="grid grid-cols-3 gap-4">
                  <div className="flex flex-col items-center gap-2 p-3 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition">
                    <img
                      src="https://raw.githubusercontent.com/AvocadoHead/Gallery3D/main/assets/%20Bit%20QR.png"
                      alt="Bit QR"
                      className="w-full rounded-lg mix-blend-multiply"
                    />
                    <a href="https://bitpay.co.il" target="_blank" rel="noreferrer" className="text-xs font-bold text-slate-700 hover:text-blue-600 underline">Bit</a>
                  </div>

                  <div className="flex flex-col items-center gap-2 p-3 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition">
                    <img
                      src="https://raw.githubusercontent.com/AvocadoHead/Gallery3D/main/assets/Pay%20Group%20QR.png"
                      alt="Paybox QR"
                      className="w-full rounded-lg mix-blend-multiply"
                    />
                     <a href="https://links.payboxapp.com" target="_blank" rel="noreferrer" className="text-xs font-bold text-slate-700 hover:text-blue-600 underline">Paybox</a>
                  </div>

                  <div className="flex flex-col items-center gap-2 p-3 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition">
                    <img
                      src="https://raw.githubusercontent.com/AvocadoHead/Gallery3D/main/assets/Buy%20me%20Coffee%20QR.png"
                      alt="Coffee QR"
                      className="w-full rounded-lg mix-blend-multiply"
                    />
                     <a href="https://buymeacoffee.com" target="_blank" rel="noreferrer" className="text-xs font-bold text-slate-700 hover:text-blue-600 underline">Buy me coffee</a>
                  </div>
               </div>
               
               <div className="text-center text-[10px] text-slate-400">
                  054-773-1650 works for direct transfers.
               </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default BuilderModal;
