// components/BuilderModal.tsx
import React, { useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { GallerySummary } from '../supabaseClient'; // Adjust path if needed

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
  const [activeTab, setActiveTab] = useState<'editor' | 'library' | 'appearance'>('editor');

  if (!isOpen) return null;

  const TabButton = ({ id, label }: { id: typeof activeTab; label: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-4 py-2 text-sm font-semibold rounded-full transition-all ${
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
      <div className="w-[600px] max-w-full max-h-[85vh] flex flex-col bg-white/95 backdrop-blur-xl border border-white/50 rounded-[32px] shadow-2xl pointer-events-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header / Tabs */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-white/50">
          <div className="flex gap-2">
            <TabButton id="editor" label="Editor" />
            <TabButton id="library" label="Library" />
            <TabButton id="appearance" label="View" />
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
          >
            ×
          </button>
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
                  <span className="text-xs text-slate-400">{galleryItemsCount} items loaded</span>
                </div>
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Paste Google Drive, YouTube, or Image links here..."
                  className="w-full h-32 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm focus:ring-2 focus:ring-slate-900 outline-none resize-none transition-all"
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

              <div className="h-px bg-slate-100" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 ml-1">Gallery Title</label>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="My Awesome Gallery"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-slate-900 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 ml-1">Contact (Email/WA)</label>
                  <input
                    value={contactEmail || contactWhatsapp}
                    onChange={(e) => {
                      // Simple logic: if it has @ treat as email, else whatsapp
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
                 <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Actions</span>
                    {savedGalleryId && <span className="text-[10px] text-emerald-600 font-mono bg-emerald-100 px-2 py-1 rounded">ID: {savedGalleryId}</span>}
                 </div>
                 <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => onSave(false)} disabled={isSaving || !isSupabaseConfigured} className="py-2.5 bg-white border border-emerald-200 text-emerald-700 font-semibold rounded-xl text-xs hover:bg-emerald-50 transition">
                       {isSaving ? 'Saving...' : savedGalleryId ? 'Update Saved' : 'Save to Cloud'}
                    </button>
                    <button onClick={() => onSave(true)} disabled={isSaving || !isSupabaseConfigured} className="py-2.5 bg-white border border-emerald-200 text-emerald-700 font-semibold rounded-xl text-xs hover:bg-emerald-50 transition">
                       Save as New
                    </button>
                    <button onClick={onShare} className="col-span-2 py-3 bg-emerald-600 text-white font-bold rounded-xl text-sm shadow-md hover:bg-emerald-700 transition">
                       Share Gallery
                    </button>
                 </div>
                 <button onClick={onCopyLink} className="text-center text-xs text-slate-400 hover:text-slate-600 underline decoration-dotted">
                    Just copy link to clipboard
                 </button>
              </div>
            </div>
          )}

          {/* --- LIBRARY TAB --- */}
          {activeTab === 'library' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              
              {/* Auth Section */}
              {!session ? (
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                  <div className="text-center space-y-1">
                    <h3 className="font-bold text-slate-900">Sign in to Aether</h3>
                    <p className="text-xs text-slate-500">Access your saved galleries across devices.</p>
                  </div>
                  
                  <button 
                    onClick={onGoogleLogin} 
                    disabled={!isSupabaseConfigured}
                    className="w-full py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition flex items-center justify-center gap-2"
                  >
                    <span className="text-lg">G</span> Continue with Google
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
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                    <button onClick={onEmailLogin} disabled={!isSupabaseConfigured} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold">
                      Send Link
                    </button>
                  </div>
                  {authMessage && <p className="text-center text-xs text-emerald-600">{authMessage}</p>}
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 bg-slate-900 text-white rounded-2xl shadow-lg">
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Logged in as</p>
                    <p className="text-sm font-medium">{session.user.email || 'User'}</p>
                  </div>
                  <button onClick={onSignOut} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-semibold transition">
                    Sign Out
                  </button>
                </div>
              )}

              {/* List Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800">My Saved Galleries</h3>
                  {isLoadingMyGalleries && <span className="text-xs text-slate-400 animate-pulse">Syncing...</span>}
                </div>
                
                <div className="grid gap-2 max-h-[400px] overflow-y-auto pr-2">
                  {!session && (
                    <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      Sign in to view your saved collection
                    </div>
                  )}
                  {session && myGalleries.length === 0 && (
                    <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      No galleries found. Create one in the Editor!
                    </div>
                  )}
                  {myGalleries.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => onLoadGallery(g.slug || g.id)}
                      className="group flex flex-col items-start p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-400 hover:shadow-md transition-all w-full text-left"
                    >
                      <span className="font-semibold text-slate-800 text-sm group-hover:text-blue-600 transition-colors">
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
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
               <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="font-bold text-slate-700">Display Mode</span>
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
                  </label>
               </div>

               <div className="space-y-6 px-2">
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

        </div>
        
        {/* Footer (Donation) */}
        <div className="p-4 bg-slate-50 border-t border-slate-200">
           <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Support Aether:</span>
              <a href="https://bitpay.co.il" target="_blank" className="hover:text-blue-600 hover:underline">Bit</a>
              <span className="text-slate-300">|</span>
              <a href="https://payboxapp.com" target="_blank" className="hover:text-blue-600 hover:underline">Paybox</a>
           </div>
        </div>
      </div>
    </div>
  );
};

export default BuilderModal;
