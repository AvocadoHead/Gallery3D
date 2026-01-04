import React, { useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { GallerySummary } from '../supabaseClient';

interface BuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: Session | null;
  galleryItemsCount: number;
  
  // Data
  inputValue: string;
  setInputValue: (val: string) => void;
  displayName: string;
  setDisplayName: (val: string) => void;
  contactWhatsapp: string;
  setContactWhatsapp: (val: string) => void;
  contactEmail: string;
  setContactEmail: (val: string) => void;

  // Visuals
  viewMode: 'sphere' | 'tile';
  setViewMode: (val: 'sphere' | 'tile') => void;
  mediaScale: number;
  setMediaScale: (val: number) => void;
  sphereBase: number;
  setSphereBase: (val: number) => void;
  tileGap: number;
  setTileGap: (val: number) => void;

  // Remote
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
  onSave: (options?: { asNew?: boolean }) => void;
  onStartNew: () => void;
  onCopyLink: () => void;
  onLoadGallery: (slug: string) => void;
  onDeleteGallery: (id: string) => void; // New Prop
  onGoogleLogin: () => void;
  onEmailLogin: () => void;
  onSignOut: () => void;
}

const BuilderModal: React.FC<BuilderModalProps> = (props) => {
  const [activeTab, setActiveTab] = useState<'content' | 'appearance' | 'galleries' | 'support'>('content');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!props.isOpen) return null;

  const handleRowCopy = async (slug: string) => {
    const url = `${window.location.origin}/?gallery=${slug}`;
    try {
        await navigator.clipboard.writeText(url);
        setCopiedId(slug);
        setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
        console.warn('Copy failed', err);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] modal-container">
        
        {/* Top Right Close Button (X) */}
        <button 
            onClick={props.onClose} 
            className="absolute top-4 right-4 z-20 p-2 text-slate-400 hover:text-slate-700 bg-white/50 hover:bg-white rounded-full transition"
        >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>

        {/* Header Tabs */}
        <div className="flex border-b border-slate-100 overflow-x-auto no-scrollbar pt-2 pr-12">
          <button 
            onClick={() => setActiveTab('content')} 
            className={`flex-1 min-w-[80px] py-4 text-xs font-bold uppercase tracking-wide transition whitespace-nowrap ${activeTab === 'content' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Edit
          </button>
          <button 
            onClick={() => setActiveTab('appearance')} 
            className={`flex-1 min-w-[80px] py-4 text-xs font-bold uppercase tracking-wide transition whitespace-nowrap ${activeTab === 'appearance' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Look
          </button>
          <button 
            onClick={() => setActiveTab('galleries')} 
            className={`flex-1 min-w-[100px] py-4 text-xs font-bold uppercase tracking-wide transition whitespace-nowrap ${activeTab === 'galleries' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
          >
            My Galleries
          </button>
          <button 
            onClick={() => setActiveTab('support')} 
            className={`flex-1 min-w-[80px] py-4 text-xs font-bold uppercase tracking-wide transition whitespace-nowrap ${activeTab === 'support' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Support
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50 pb-8">
          
          {/* TAB 1: CONTENT (EDIT) */}
          {activeTab === 'content' && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Image/Video URLs</label>
                <textarea
                  className="w-full h-32 p-3 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none font-mono"
                  placeholder="Paste URLs here (one per line)..."
                  value={props.inputValue}
                  onChange={(e) => props.setInputValue(e.target.value)}
                />
                <div className="flex gap-2 mt-3">
                  <button onClick={props.onAddMedia} className="flex-1 bg-slate-800 hover:bg-slate-900 text-white py-2 rounded-lg text-sm font-medium transition">
                    Update Gallery ({props.galleryItemsCount})
                  </button>
                  <button onClick={props.onClear} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-white transition">
                    Clear
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Gallery Info</label>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Gallery Title"
                    className="w-full p-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={props.displayName}
                    onChange={(e) => props.setDisplayName(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="WhatsApp Number (e.g. 15551234567)"
                    className="w-full p-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={props.contactWhatsapp}
                    onChange={(e) => props.setContactWhatsapp(e.target.value)}
                  />
                  <input
                    type="email"
                    placeholder="Contact Email"
                    className="w-full p-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={props.contactEmail}
                    onChange={(e) => props.setContactEmail(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: APPEARANCE (LOOK) */}
          {activeTab === 'appearance' && (
            <div className="space-y-8">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-4">View Mode</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => props.setViewMode('sphere')}
                    className={`p-3 rounded-xl border text-sm font-medium transition flex flex-col items-center gap-2 ${
                      props.viewMode === 'sphere' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full border-2 border-current opacity-60"></div>
                    3D Sphere
                  </button>
                  <button
                    onClick={() => props.setViewMode('tile')}
                    className={`p-3 rounded-xl border text-sm font-medium transition flex flex-col items-center gap-2 ${
                      props.viewMode === 'tile' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="w-8 h-8 grid grid-cols-2 gap-0.5 opacity-60"><div className="bg-current"></div><div className="bg-current"></div><div className="bg-current"></div><div className="bg-current"></div></div>
                    Masonry Grid
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Card Size</label>
                  <span className="text-xs text-slate-400">{Math.round(props.mediaScale * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="3.0"
                  step="0.1"
                  value={props.mediaScale}
                  onChange={(e) => props.setMediaScale(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              {props.viewMode === 'sphere' ? (
                <div>
                   <div className="flex justify-between mb-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Sphere Radius</label>
                    <span className="text-xs text-slate-400">{props.sphereBase}</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="150"
                    step="5"
                    value={props.sphereBase}
                    onChange={(e) => props.setSphereBase(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              ) : (
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Grid Gap</label>
                    <span className="text-xs text-slate-400">{props.tileGap}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="2"
                    value={props.tileGap}
                    onChange={(e) => props.setTileGap(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              )}

              {/* Added: Specific Save Layout Button */}
              {props.session && (
                 <button 
                   onClick={() => props.onSave({ asNew: false })} 
                   disabled={props.isSaving}
                   className="w-full py-3 mt-4 bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 rounded-xl font-medium text-sm transition shadow-sm"
                 >
                   {props.isSaving ? 'Saving...' : 'Save Layout Settings'}
                 </button>
              )}
            </div>
          )}

          {/* TAB 3: MY GALLERIES */}
          {activeTab === 'galleries' && (
            <div className="space-y-6">
              {!props.session ? (
                // NOT LOGGED IN VIEW
                <div className="text-center py-4">
                   <p className="text-sm text-slate-600 mb-4">Sign in to access your saved galleries.</p>
                   <button onClick={props.onGoogleLogin} className="w-full py-2.5 px-4 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition flex items-center justify-center gap-2 mb-3">
                      <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/></svg>
                      Sign in with Google
                   </button>
                   <div className="flex gap-2">
                     <input 
                       type="email" 
                       placeholder="email@example.com" 
                       className="flex-1 p-2 text-sm border border-slate-200 rounded-lg"
                       value={props.authEmail}
                       onChange={(e) => props.setAuthEmail(e.target.value)}
                     />
                     <button onClick={props.onEmailLogin} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm">Send Link</button>
                   </div>
                   {props.authMessage && <p className="text-xs text-green-600 mt-2">{props.authMessage}</p>}
                </div>
              ) : (
                // LOGGED IN VIEW
                <div className="space-y-4">
                   <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-100 mb-4">
                      <span className="text-xs text-blue-800 truncate">{props.session.user.email}</span>
                      <button onClick={props.onSignOut} className="text-xs font-bold text-blue-600 hover:underline">Sign Out</button>
                   </div>

                   <button 
                     onClick={props.onStartNew} 
                     className="w-full py-3 border border-dashed border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700 rounded-xl text-sm font-medium"
                   >
                     + Create New Gallery
                   </button>

                   <div className="pt-2">
                      <p className="text-xs font-bold text-slate-500 uppercase mb-3">Saved Galleries</p>
                      {props.isLoadingMyGalleries ? (
                        <div className="text-center text-sm text-slate-400 py-4">Loading...</div>
                      ) : props.myGalleries.length === 0 ? (
                        <div className="text-center text-sm text-slate-400 py-4 italic">No galleries found.</div>
                      ) : (
                        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                          {props.myGalleries.map((g) => (
                            <div key={g.id} className="p-3 bg-white border border-slate-100 rounded-lg hover:shadow-sm transition group">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-slate-700 font-bold truncate max-w-[180px]">{g.display_name || 'Untitled'}</span>
                                <span className="text-[10px] text-slate-400">{new Date(g.created_at).toLocaleDateString()}</span>
                              </div>
                              
                              <div className="flex items-center gap-2 mt-2">
                                {/* Load Button */}
                                <button 
                                   onClick={() => props.onLoadGallery(g.slug)}
                                   className="flex-1 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-medium rounded border border-slate-200"
                                >
                                   Edit/Load
                                </button>
                                
                                {/* Share Button */}
                                <button 
                                   onClick={() => handleRowCopy(g.slug)}
                                   className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-blue-600 border border-slate-200 rounded relative"
                                   title="Copy Link"
                                >
                                   {copiedId === g.slug ? (
                                     <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap">Copied!</span>
                                   ) : null}
                                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                </button>

                                {/* Delete Button */}
                                <button 
                                   onClick={() => props.onDeleteGallery(g.id)}
                                   className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-500 border border-red-100 rounded"
                                   title="Delete"
                                >
                                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                   </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SUPPORT */}
          {activeTab === 'support' && (
            <div className="space-y-6 text-center">
               <p className="text-sm text-slate-600 leading-relaxed">
                 Aether Gallery is a free tool for 3D spatial curation.
                 If you enjoy using it, consider supporting the development.
               </p>
               
               <div className="grid grid-cols-2 gap-4">
                  {/* Bit */}
                  <div className="flex flex-col gap-3 p-4 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md transition">
                      <div className="aspect-square rounded-lg overflow-hidden bg-slate-50">
                        <img 
                          src="https://raw.githubusercontent.com/AvocadoHead/Gallery3D/main/assets/Bit%20QR.png" 
                          alt="Bit QR" 
                          className="w-full h-full object-cover mix-blend-multiply" 
                        />
                      </div>
                      <div className="text-center">
                         <span className="block font-bold text-slate-800 text-sm">Bit</span>
                      </div>
                  </div>

                  {/* Paybox */}
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

                  {/* Buy Me A Coffee */}
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
               
               <div className="text-xs text-slate-400 pt-4 border-t border-slate-100">
                 Built with React Three Fiber + Supabase.
               </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default BuilderModal;
