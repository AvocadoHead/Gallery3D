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
  onGoogleLogin: () => void;
  onEmailLogin: () => void;
  onSignOut: () => void;
}

const BuilderModal: React.FC<BuilderModalProps> = (props) => {
  const [activeTab, setActiveTab] = useState<'content' | 'appearance' | 'account'>('content');

  if (!props.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] modal-container">
        
        {/* Header Tabs */}
        <div className="flex border-b border-slate-100">
          <button 
            onClick={() => setActiveTab('content')} 
            className={`flex-1 py-4 text-sm font-semibold transition ${activeTab === 'content' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Content
          </button>
          <button 
            onClick={() => setActiveTab('appearance')} 
            className={`flex-1 py-4 text-sm font-semibold transition ${activeTab === 'appearance' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Appearance
          </button>
          <button 
            onClick={() => setActiveTab('account')} 
            className={`flex-1 py-4 text-sm font-semibold transition ${activeTab === 'account' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Save & Share
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
          
          {/* TAB: CONTENT */}
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

          {/* TAB: APPEARANCE */}
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
                  min="0.5"
                  max="2.5"
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
                    max="120"
                    step="1"
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
                    max="50"
                    step="1"
                    value={props.tileGap}
                    onChange={(e) => props.setTileGap(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              )}
            </div>
          )}

          {/* TAB: ACCOUNT / SAVE */}
          {activeTab === 'account' && (
            <div className="space-y-6">
              {!props.session ? (
                <div className="text-center py-4">
                  <p className="text-sm text-slate-600 mb-4">Sign in to save and manage your galleries.</p>
                  <button onClick={props.onGoogleLogin} className="w-full py-2.5 px-4 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition flex items-center justify-center gap-2 mb-3">
                     <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/></svg>
                     Sign in with Google
                  </button>
                  
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-slate-50 px-2 text-slate-400">Or with Email</span></div>
                  </div>

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
                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-xs font-bold text-blue-800 uppercase">Current Session</span>
                       <button onClick={props.onSignOut} className="text-xs text-blue-600 hover:text-blue-800 underline">Sign Out</button>
                    </div>
                    <p className="text-sm text-blue-900 truncate">{props.session.user.email}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                     <button 
                       onClick={() => props.onSave({ asNew: false })} 
                       disabled={props.isSaving}
                       className="py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition shadow-sm disabled:opacity-50"
                     >
                       {props.isSaving ? 'Saving...' : 'Save Changes'}
                     </button>
                     <button 
                       onClick={props.onCopyLink} 
                       className="py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-medium text-sm transition"
                     >
                       Share Link
                     </button>
                  </div>
                  
                  {props.savedGalleryId && (
                     <button 
                       onClick={() => props.onSave({ asNew: true })} 
                       className="w-full py-2 text-slate-500 hover:text-slate-800 text-xs font-medium underline"
                     >
                       Save as New Copy
                     </button>
                  )}

                  {props.myGalleries.length > 0 && (
                    <div className="pt-4 border-t border-slate-200 mt-4">
                      <p className="text-xs font-bold text-slate-500 uppercase mb-3">Your Galleries</p>
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                        {props.myGalleries.map((g) => (
                          <div key={g.id} onClick={() => props.onLoadGallery(g.slug)} className="flex items-center justify-between p-2 hover:bg-white rounded-lg cursor-pointer group transition">
                            <span className="text-sm text-slate-700 font-medium group-hover:text-blue-600 truncate max-w-[180px]">{g.display_name || 'Untitled'}</span>
                            <span className="text-[10px] text-slate-400">{new Date(g.created_at).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                   <button 
                     onClick={props.onStartNew} 
                     className="w-full py-3 border border-dashed border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700 rounded-xl text-sm font-medium mt-2"
                   >
                     + Start Fresh
                   </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Close */}
        <div className="p-4 border-t border-slate-100 bg-white">
          <button onClick={props.onClose} className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-semibold transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default BuilderModal;
