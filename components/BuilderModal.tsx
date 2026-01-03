import React, { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { GallerySummary } from '../supabaseClient';

const IconGoogle = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="currentColor" d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.64 2 12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c5.19 0 9.49-3.73 9.49-10c0-1.3-.15-2.29-.14-2.9z" />
  </svg>
);
const IconEdit = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>;
const IconLibrary = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>;
const IconSettings = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>;
const IconHeart = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>;
const IconShare = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>;

interface BuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
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
  viewMode: 'sphere' | 'tile';
  setViewMode: (mode: 'sphere' | 'tile') => void;
  mediaScale: number;
  setMediaScale: (val: number) => void;
  sphereBase: number;
  setSphereBase: (val: number) => void;
  tileGap: number;
  setTileGap: (val: number) => void;
  myGalleries: GallerySummary[];
  isLoadingMyGalleries: boolean;
  savedGalleryId: string;
  isSupabaseConfigured: boolean;
  isSaving: boolean;
  loadError: string;
  authMessage: string;
  authEmail: string;
  setAuthEmail: (val: string) => void;
  onAddMedia: () => void;
  onClear: () => void;
  onSave: (asNew?: boolean) => void;
  onCopyLink: (link?: string) => void;
  onLoadGallery: (slug: string) => void;
  onGoogleLogin: () => void;
  onEmailLogin: () => void;
  onSignOut: () => void;
}

const BuilderModal: React.FC<BuilderModalProps> = (props) => {
  const [activeTab, setActiveTab] = useState<'editor' | 'library' | 'settings' | 'support'>('editor');
  const [showToast, setShowToast] = useState(false);
  
  if (!props.isOpen) return null;

  // Fix Issue 3 & 5: Construct share URL with params
  const constructShareUrl = () => {
    // Note: If no savedGalleryId, App.tsx handles the heavy encoding. 
    // This helper is mainly for the social buttons when an ID exists or for current window fallback.
    const baseUrl = window.location.origin;
    const params = new URLSearchParams();
    
    if (props.savedGalleryId) {
      params.set('gallery', props.savedGalleryId);
    }
    
    // Add layout params
    params.set('layout', props.viewMode);
    params.set('scale', Math.round(props.mediaScale * 100).toString());
    if (props.viewMode === 'sphere') params.set('radius', props.sphereBase.toString());
    if (props.viewMode === 'tile') params.set('gap', props.tileGap.toString());

    return `${baseUrl}/?${params.toString()}`;
  };

  const handleCopyLink = () => {
    props.onCopyLink(); // App.tsx handles the clipboard logic
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  const NavItem = ({ id, label, icon: Icon }: any) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors rounded-xl ${
        activeTab === id
          ? 'bg-slate-900 text-white shadow-md'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <Icon />
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm pointer-events-auto">
      {/* Fix Issue 8: Mobile Responsive Width */}
      <div className="w-[850px] max-w-full h-[600px] max-h-[90vh] flex flex-col sm:flex-row bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-slate-900/5 relative">
        
        {/* --- SIDEBAR --- */}
        {/* Fix Issue 9: Mobile Sidebar Navigation */}
        <div className="w-full sm:w-64 bg-slate-50 border-b sm:border-b-0 sm:border-r border-slate-100 flex flex-col p-4 shrink-0">
          <div className="px-4 py-2 mb-2 sm:mb-6 flex justify-between items-center sm:block">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Aether</h2>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Builder Tool</p>
            </div>
            {/* Mobile close button shown in header */}
            <button 
               onClick={props.onClose} 
               className="sm:hidden w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-600"
            >
               ×
            </button>
          </div>

          <nav className="flex sm:flex-col space-x-2 sm:space-x-0 sm:space-y-2 overflow-x-auto pb-2 sm:pb-0">
            <NavItem id="editor" label="Editor" icon={IconEdit} />
            <NavItem id="library" label="My Galleries" icon={IconLibrary} />
            <NavItem id="settings" label="Appearance" icon={IconSettings} />
            <NavItem id="support" label="Support" icon={IconHeart} />
          </nav>

          <div className="mt-auto pt-4 border-t border-slate-200 space-y-3 hidden sm:block">
            {!props.session ? (
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                <p className="text-xs text-slate-500 mb-3 font-medium">Save your work</p>
                <button
                  onClick={props.onGoogleLogin}
                  disabled={!props.isSupabaseConfigured}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition shadow-sm"
                >
                  <IconGoogle /> Log in with Google
                </button>
              </div>
            ) : (
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                 <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                    {(props.session.user.email?.[0] || 'U').toUpperCase()}
                 </div>
                 <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate">{props.session.user.email}</p>
                    <button onClick={props.onSignOut} className="text-[10px] text-red-500 hover:text-red-600 font-medium hover:underline">
                       Sign out
                    </button>
                 </div>
              </div>
            )}
          </div>
        </div>

        {/* --- MAIN CONTENT --- */}
        <div className="flex-1 flex flex-col min-w-0 bg-white relative h-full overflow-hidden">
            <button 
               onClick={props.onClose} 
               className="hidden sm:flex absolute top-4 right-4 z-10 w-8 h-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            >
               ×
            </button>

            {/* Fix Issue 4: Toast Inside Modal */}
            {showToast && (
               <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-lg animate-in fade-in zoom-in slide-in-from-top-2 duration-300">
                  Link Copied!
               </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 sm:p-8">
               {props.loadError && (
                  <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-sm flex items-center gap-2">
                     <span className="font-bold">Error:</span> {props.loadError}
                  </div>
               )}

               {/* === EDITOR TAB === */}
               {activeTab === 'editor' && (
                  <div className="space-y-6 max-w-lg mx-auto animate-in fade-in duration-300 pb-8">
                     <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-800">Gallery Content</h3>
                        <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-500">{props.galleryItemsCount} items</span>
                     </div>
                     
                     <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Paste Links</label>
                        <textarea
                           value={props.inputValue}
                           onChange={(e) => props.setInputValue(e.target.value)}
                           className="w-full h-32 p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:ring-2 focus:ring-slate-900 outline-none resize-none font-mono"
                           placeholder="https://youtu.be/..."
                        />
                        <div className="flex justify-end gap-2">
                           <button onClick={props.onClear} className="text-xs font-bold text-slate-400 hover:text-rose-500 px-3 py-2 transition">Clear</button>
                           <button onClick={props.onAddMedia} className="bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-lg hover:translate-y-[-1px] transition">Apply Changes</button>
                        </div>
                     </div>

                     <div className="space-y-4 pt-4 border-t border-slate-100">
                        <h3 className="text-sm font-bold text-slate-800">Details</h3>
                        <div className="space-y-3">
                           <input 
                              value={props.displayName} 
                              onChange={(e) => props.setDisplayName(e.target.value)}
                              placeholder="Gallery Title"
                              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 outline-none"
                           />
                           <div className="grid grid-cols-2 gap-4">
                              <input 
                                 value={props.contactEmail} 
                                 onChange={(e) => props.setContactEmail(e.target.value)}
                                 placeholder="Email Address"
                                 className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 outline-none"
                              />
                              <input 
                                 value={props.contactWhatsapp} 
                                 onChange={(e) => props.setContactWhatsapp(e.target.value)}
                                 placeholder="WhatsApp (Number)"
                                 className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 outline-none"
                              />
                           </div>
                        </div>
                     </div>

                     <div className="pt-6 mt-4">
                        {!props.session ? (
                           <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-center justify-between">
                              <p className="text-xs text-amber-800 font-medium">Log in to save this gallery permanently.</p>
                              <button onClick={() => setActiveTab('library')} className="text-xs bg-white border border-amber-200 text-amber-800 font-bold px-3 py-1.5 rounded-lg hover:bg-amber-100 shadow-sm">Go to Login</button>
                           </div>
                        ) : (
                           <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 space-y-3">
                              <div className="flex justify-between items-center">
                                 <p className="text-xs font-bold text-emerald-800 uppercase">Publishing</p>
                                 {props.savedGalleryId && <span className="text-[10px] font-mono text-emerald-600">ID: {props.savedGalleryId}</span>}
                              </div>
                              <div className="flex gap-2">
                                 {/* SMART SAVE BUTTONS: Only show what's relevant */}
                                 {props.savedGalleryId ? (
                                    <>
                                       <button 
                                          onClick={() => props.onSave(false)}
                                          disabled={props.isSaving}
                                          className="flex-1 bg-white border border-emerald-200 text-emerald-700 text-xs font-bold py-2.5 rounded-lg hover:bg-emerald-100 transition shadow-sm"
                                       >
                                          {props.isSaving ? 'Updating...' : 'Update Gallery'}
                                       </button>
                                       <button 
                                          onClick={() => props.onSave(true)}
                                          disabled={props.isSaving}
                                          className="px-4 bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold py-2.5 rounded-lg hover:bg-emerald-200 transition shadow-sm"
                                          title="Save as a new copy"
                                       >
                                          Save New
                                       </button>
                                    </>
                                 ) : (
                                    <button 
                                       onClick={() => props.onSave(true)}
                                       disabled={props.isSaving}
                                       className="w-full bg-emerald-600 text-white text-xs font-bold py-2.5 rounded-lg hover:bg-emerald-700 transition shadow-lg"
                                    >
                                       {props.isSaving ? 'Saving...' : 'Save Gallery'}
                                    </button>
                                 )}
                              </div>
                           </div>
                        )}
                        <button onClick={handleCopyLink} className="w-full mt-2 py-2 text-slate-400 hover:text-slate-600 text-xs font-medium transition">
                            Share current view (Copy Link)
                        </button>
                        
                        {/* Fix Issue 5: Social Sharing Buttons */}
                        {props.savedGalleryId && (
                           <div className="flex gap-2 mt-2">
                              <button 
                                 onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(constructShareUrl())}`)}
                                 className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#25D366] hover:bg-[#22c35e] text-white text-xs font-bold rounded-lg transition"
                              >
                                 WhatsApp
                              </button>
                              <button 
                                 onClick={() => window.location.href = `mailto:?subject=Check out my gallery&body=${encodeURIComponent(constructShareUrl())}`}
                                 className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition"
                              >
                                 Email
                              </button>
                           </div>
                        )}
                     </div>
                  </div>
               )}

               {/* === LIBRARY TAB === */}
               {activeTab === 'library' && (
                  <div className="space-y-6 animate-in fade-in duration-300 pb-8">
                     <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-800">My Galleries</h3>
                     </div>

                     {!props.session ? (
                        <div className="flex flex-col items-center justify-center h-64 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center p-6">
                           <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mb-3 text-slate-400">
                              <IconLibrary />
                           </div>
                           <p className="text-sm font-bold text-slate-700">Authentication Required</p>
                           <p className="text-xs text-slate-500 mt-1 mb-4 max-w-xs">Log in with Google via the sidebar to access your saved collections.</p>
                           <button onClick={() => props.onGoogleLogin()} className="sm:hidden px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg">Login with Google</button>
                        </div>
                     ) : (
                        <div className="space-y-2">
                           {props.myGalleries.length === 0 && !props.isLoadingMyGalleries && (
                              <p className="text-center py-10 text-slate-400 text-sm">No galleries yet. Go to Editor to create one.</p>
                           )}
                           
                           {props.myGalleries.map(g => (
                              <div key={g.id} className="group flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl hover:border-slate-300 hover:shadow-sm transition">
                                 <div className="min-w-0">
                                    <h4 className="font-bold text-slate-800 text-sm truncate">{g.display_name || 'Untitled Gallery'}</h4>
                                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{new Date(g.updated_at).toLocaleDateString()} • {g.slug || g.id}</p>
                                 </div>
                                 <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                    <button 
                                       onClick={() => props.onLoadGallery(g.slug || g.id)}
                                       className="px-3 py-1.5 bg-slate-50 hover:bg-slate-900 hover:text-white text-slate-600 text-xs font-bold rounded-lg transition"
                                    >
                                       Edit / Load
                                    </button>
                                    <button 
                                       onClick={() => props.onCopyLink(`${window.location.origin}/?gallery=${g.slug || g.id}`)}
                                       className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                       title="Copy Link"
                                    >
                                       <IconShare />
                                    </button>
                                 </div>
                              </div>
                           ))}
                        </div>
                     )}
                  </div>
               )}

               {/* === SETTINGS TAB === */}
               {activeTab === 'settings' && (
                  <div className="space-y-8 max-w-lg mx-auto animate-in fade-in duration-300 pb-8">
                     <h3 className="text-lg font-bold text-slate-800">Visual Settings</h3>
                     
                     <div className="space-y-4">
                        <label className="block">
                           <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Layout Mode</span>
                           <div className="grid grid-cols-2 gap-2 mt-2">
                              <button 
                                 onClick={() => props.setViewMode('sphere')}
                                 className={`p-3 rounded-xl border text-sm font-bold transition flex items-center justify-center gap-2 ${props.viewMode === 'sphere' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                              >
                                 Sphere
                              </button>
                              <button 
                                 onClick={() => props.setViewMode('tile')}
                                 className={`p-3 rounded-xl border text-sm font-bold transition flex items-center justify-center gap-2 ${props.viewMode === 'tile' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                              >
                                 Masonry
                              </button>
                           </div>
                        </label>

                        <div className="space-y-6 pt-4 border-t border-slate-100">
                           <div className="space-y-2">
                              <div className="flex justify-between">
                                 <span className="text-xs font-bold text-slate-700">Card Scale</span>
                                 <span className="text-xs text-slate-400">{Math.round(props.mediaScale * 100)}%</span>
                              </div>
                              {/* Fix Issue 10: Larger padding for touch targets */}
                              <input 
                                type="range" 
                                min={0.5} 
                                max={3.0} 
                                step={0.1} 
                                value={props.mediaScale} 
                                onChange={(e) => props.setMediaScale(parseFloat(e.target.value))} 
                                className="w-full accent-slate-900 py-4 sm:py-2" 
                              />
                           </div>                         
                           {props.viewMode === 'sphere' && (
                              <div className="space-y-2">
                                 <div className="flex justify-between">
                                    <span className="text-xs font-bold text-slate-700">Sphere Radius</span>
                                    <span className="text-xs text-slate-400">{props.sphereBase}</span>
                                 </div>
                                 {/* Fix Issue 1: Extended range 20-200, larger step */}
                                 <input 
                                    type="range" 
                                    min={20} 
                                    max={200} 
                                    step={5} 
                                    value={props.sphereBase} 
                                    onChange={(e) => props.setSphereBase(parseFloat(e.target.value))} 
                                    className="w-full accent-slate-900 py-4 sm:py-2" 
                                 />
                              </div>
                           )}

                           {props.viewMode === 'tile' && (
                              <div className="space-y-2">
                                 <div className="flex justify-between">
                                    <span className="text-xs font-bold text-slate-700">Grid Gap</span>
                                    <span className="text-xs text-slate-400">{props.tileGap}px</span>
                                 </div>
                                 <input 
                                    type="range" 
                                    min={0} 
                                    max={30} 
                                    step={1} 
                                    value={props.tileGap} 
                                    onChange={(e) => props.setTileGap(parseFloat(e.target.value))} 
                                    className="w-full accent-slate-900 py-4 sm:py-2" 
                                 />
                              </div>
                           )}
                        </div>
                     </div>
                  </div>
               )}

               {/* === SUPPORT TAB === */}
               {activeTab === 'support' && (
                  <div className="space-y-6 animate-in fade-in duration-300 pb-8">
                     <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
                        <h3 className="text-xl font-bold">Support the Project</h3>
                        <p className="text-indigo-100 text-sm mt-2 opacity-90">Your contributions help keep Aether free and open for everyone.</p>
                     </div>
                     
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                         <div className="flex flex-col gap-3 p-4 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md transition">
                           <div className="aspect-square rounded-lg overflow-hidden bg-slate-50">
                             <img 
                               src="https://raw.githubusercontent.com/AvocadoHead/Gallery3D/main/assets/%20Bit%20QR.png" 
                               alt="Bit QR" 
                               className="w-full h-full object-cover mix-blend-multiply" 
                             />
                           </div>
                           <div className="text-center">
                              <span className="block font-bold text-slate-800 text-sm">Bit</span>
                              <a href="https://bitpay.co.il" target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">Open Link</a>
                           </div>
                         </div>

                         <div className="flex flex-col gap-3 p-4 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md transition">
                           <div className="aspect-square rounded-lg overflow-hidden bg-slate-50">
                             <img 
                               src="https://raw.githubusercontent.com/AvocadoHead/Gallery3D/main/assets/Pay%20Group%20QR.png" 
                               alt="PayBox QR" 
                               className="w-full h-full object-cover mix-blend-multiply" 
                             />
                           </div>
                           <div className="text-center">
                              <span className="block font-bold text-slate-800 text-sm">Paybox</span>
                              <a href="https://links.payboxapp.com" target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">Open Link</a>
                           </div>
                         </div>

                         <div className="flex flex-col gap-3 p-4 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md transition">
                           <div className="aspect-square rounded-lg overflow-hidden bg-slate-50">
                             <img 
                               src="https://raw.githubusercontent.com/AvocadoHead/Gallery3D/main/assets/Buy%20me%20Coffee%20QR.png" 
                               alt="Coffee QR" 
                               className="w-full h-full object-cover mix-blend-multiply" 
                             />
                           </div>
                           <div className="text-center">
                              <span className="block font-bold text-slate-800 text-sm">Buy me Coffee</span>
                              <a href="https://buymeacoffee.com" target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">Open Link</a>
                           </div>
                         </div>
                     </div>
                     <div className="text-center text-xs text-slate-400">
                        054-773-1650 (Direct)
                     </div>
                  </div>
               )}

            </div>
        </div>
      </div>
    </div>
  );
};

export default BuilderModal;
