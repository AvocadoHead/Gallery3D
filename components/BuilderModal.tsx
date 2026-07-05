import React, { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { GallerySummary, Visibility } from '../supabaseClient';
import { MediaItem, CURATED_FONTS } from '../constants';

const VIS_OPTIONS: { value: Visibility; label: string; icon: string; hint: string }[] = [
  { value: 'private', label: 'Private', icon: '🔒', hint: 'Only you can open it.' },
  { value: 'unlisted', label: 'Unlisted', icon: '🔗', hint: 'Anyone with the link can view — not listed publicly.' },
  { value: 'public', label: 'Public', icon: '🌐', hint: 'Shown on the public Explore page.' },
];

const SIZE_OPTIONS: Array<'S' | 'M' | 'L' | 'XL'> = ['S', 'M', 'L', 'XL'];

const IconGoogle = () => <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.64 2 12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c5.19 0 9.49-3.73 9.49-10c0-1.3-.15-2.29-.14-2.9z" /></svg>;
const IconShare = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>;
const IconTrash = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;

interface BuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'content' | 'appearance' | 'galleries' | 'support'; 
  
  session: Session | null;
  galleryItems: MediaItem[];
  setGalleryItems: (items: MediaItem[]) => void;
  galleryItemsCount: number;
  inputValue: string;
  setInputValue: (val: string) => void;
  displayName: string;
  setDisplayName: (val: string) => void;
  contactWhatsapp: string;
  setContactWhatsapp: (val: string) => void;
  contactEmail: string;
  setContactEmail: (val: string) => void;
  visibility: Visibility;
  setVisibility: (val: Visibility) => void;
  viewMode: 'sphere' | 'tile' | 'carousel' | 'book';
  setViewMode: (val: 'sphere' | 'tile' | 'carousel' | 'book') => void;
  canvasMode: 'grid' | 'free';
  setCanvasMode: (val: 'grid' | 'free') => void;
  bookPerPage: 1 | 2 | 4;
  setBookPerPage: (val: 1 | 2 | 4) => void;
  onEditLayout: () => void;
  mediaScale: number;
  setMediaScale: (val: number) => void;
  sphereBase: number;
  setSphereBase: (val: number) => void;
  tileGap: number;
  setTileGap: (val: number) => void;
  titleFont: string;
  setTitleFont: (val: string) => void;
  titleSize: 'S' | 'M' | 'L' | 'XL';
  setTitleSize: (val: 'S' | 'M' | 'L' | 'XL') => void;
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
  onSave: (options?: { asNew?: boolean }) => void;
  onStartNew: () => void;
  onCopyLink: () => void;
  getShareLink: () => string;
  onLoadGallery: (slug: string) => void;
  onDeleteGallery: (id: string) => void;
  onSetVisibility: (id: string, visibility: Visibility) => void;
  onGoogleLogin: () => void;
  onEmailLogin: () => void;
  onSignOut: () => void;
}

const BuilderModal: React.FC<BuilderModalProps> = (props) => {
  const [activeTab, setActiveTab] = useState<'content' | 'appearance' | 'galleries' | 'support'>('galleries');
  const [shareMenuOpen, setShareMenuOpen] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [visMenuOpen, setVisMenuOpen] = useState<string | null>(null);

  const updateItem = (id: string, patch: Partial<MediaItem>) => {
    props.setGalleryItems(props.galleryItems.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  useEffect(() => {
    if (props.isOpen && props.initialTab) {
        setActiveTab(props.initialTab);
    }
  }, [props.isOpen, props.initialTab]);

  if (!props.isOpen) return null;

  const handleShareRowClick = (slug: string) => {
    setShareMenuOpen(shareMenuOpen === slug ? null : slug);
  };

  const handleCopyRow = async (slug: string) => {
    const url = `${window.location.origin}/?gallery=${slug}`;
    try {
        await navigator.clipboard.writeText(url);
        setCopiedId(slug);
        setTimeout(() => setCopiedId(null), 2000);
        setShareMenuOpen(null);
    } catch (err) {
        console.warn(err);
    }
  };

  const handleWhatsAppRow = (slug: string) => {
    const url = `${window.location.origin}/?gallery=${slug}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(url)}`);
    setShareMenuOpen(null);
  };

  const handleShareFooterClick = async () => {
    try {
        props.onCopyLink(); 
        setShareMenuOpen('footer');
    } catch (err) {
        setShareMenuOpen('footer');
    }
  };

  const handleCreateNew = () => {
    props.onStartNew();
    setActiveTab('content');
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden relative">
        
        {/* Top Bar */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-white z-10 pt-2 px-2 pb-0">
          <div className="flex overflow-x-auto no-scrollbar flex-1 gap-4 px-2">
            <button 
              onClick={() => setActiveTab('galleries')} 
              className={`py-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors border-b-2 ${activeTab === 'galleries' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}
            >
              My Galleries
            </button>
            <button 
              onClick={() => setActiveTab('content')} 
              className={`py-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors border-b-2 ${activeTab === 'content' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}
            >
              Edit
            </button>
            <button 
              onClick={() => setActiveTab('appearance')} 
              className={`py-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors border-b-2 ${activeTab === 'appearance' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}
            >
              Look
            </button>
            <button 
              onClick={() => setActiveTab('support')} 
              className={`py-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors border-b-2 ${activeTab === 'support' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}
            >
              Support
            </button>
          </div>
          <button onClick={props.onClose} className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 mb-1 ml-2 shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 bg-slate-50/50">
          
          {/* TAB 1: MY GALLERIES */}
          {activeTab === 'galleries' && (
            <div className="space-y-6">
              {!props.session ? (
                <div className="p-6 bg-slate-100 rounded-2xl text-center border border-slate-200">
                   <p className="text-sm text-slate-600 mb-4 font-medium">Log in to save and manage your galleries.</p>
                   <button onClick={props.onGoogleLogin} className="w-full py-3 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold shadow-sm hover:bg-slate-50 transition flex items-center justify-center gap-2">
                      <IconGoogle /> Sign in with Google
                   </button>
                   <div className="mt-4 flex gap-2">
                     <input type="email" placeholder="Email..." className="flex-1 p-2 text-sm rounded-lg border border-slate-300" value={props.authEmail} onChange={(e) => props.setAuthEmail(e.target.value)} />
                     <button onClick={props.onEmailLogin} className="px-3 bg-slate-800 text-white text-xs font-bold rounded-lg">Link</button>
                   </div>
                   {props.authMessage && <p className="text-xs text-green-600 mt-2 font-bold">{props.authMessage}</p>}
                </div>
              ) : (
                <div className="space-y-4">
                   <div className="flex items-center justify-between p-4 bg-slate-100 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold">
                            {(props.session.user.email?.[0] || 'U').toUpperCase()}
                         </div>
                         <div className="overflow-hidden">
                            <p className="text-xs text-slate-500 font-bold uppercase">Logged in as</p>
                            <p className="text-sm font-bold text-slate-800 truncate max-w-[150px]">{props.session.user.email}</p>
                         </div>
                      </div>
                      <button onClick={props.onSignOut} className="text-xs font-bold text-red-500 hover:underline">Sign Out</button>
                   </div>

                   <div className="flex items-center justify-between pt-2">
                      <h3 className="text-sm font-bold text-slate-500 uppercase">Saved Galleries</h3>
                      <button onClick={handleCreateNew} className="text-xs bg-slate-900 text-white font-bold px-3 py-1.5 rounded-lg shadow-sm">
                         + Create New
                      </button>
                   </div>

                   {props.isLoadingMyGalleries ? (
                      <div className="text-center py-8 text-slate-400 text-sm">Loading...</div>
                   ) : props.myGalleries.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-sm italic">No galleries found.</div>
                   ) : (
                      <div className="space-y-3 pb-4">
                         {props.myGalleries.map((g) => (
                            <div key={g.id} className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm hover:shadow-md transition relative">
                               <div className="flex justify-between items-start mb-3">
                                  <div>
                                     <h4 className="text-sm font-bold text-slate-800 truncate max-w-[150px]">{g.display_name || 'Untitled'}</h4>
                                     <p className="text-[10px] text-slate-400 font-mono">{new Date(g.updated_at).toLocaleDateString()}</p>
                                  </div>
                                  {/* Inline visibility (Phase 2.2) */}
                                  <div className="relative">
                                     <button
                                        onClick={() => setVisMenuOpen(visMenuOpen === g.id ? null : g.id)}
                                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-100 transition"
                                     >
                                        <span>{VIS_OPTIONS.find((o) => o.value === g.visibility)?.icon || '🔗'}</span>
                                        <span className="capitalize">{g.visibility || 'unlisted'}</span>
                                     </button>
                                     {visMenuOpen === g.id && (
                                        <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-xl border border-slate-100 z-30 overflow-hidden animate-in zoom-in-95">
                                           {VIS_OPTIONS.map((opt) => (
                                              <button
                                                 key={opt.value}
                                                 onClick={() => { props.onSetVisibility(g.id, opt.value); setVisMenuOpen(null); }}
                                                 className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2 ${g.visibility === opt.value ? 'text-slate-900 font-bold' : 'text-slate-600'}`}
                                              >
                                                 <span>{opt.icon}</span> {opt.label}
                                              </button>
                                           ))}
                                        </div>
                                     )}
                                  </div>
                               </div>
                               <div className="flex gap-2">
                                  <button onClick={() => { props.onLoadGallery(g.slug || g.id); setActiveTab('content'); }} className="flex-1 py-2 bg-slate-50 hover:bg-slate-900 hover:text-white text-slate-600 text-xs font-bold rounded-lg transition border border-slate-200 hover:border-slate-900">Load</button>
                                  <div className="relative">
                                     <button onClick={() => handleShareRowClick(g.id)} className="p-2 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-slate-200 transition">
                                        <IconShare />
                                     </button>
                                     {shareMenuOpen === g.id && (
                                        <div className="absolute right-0 bottom-full mb-2 w-32 bg-white rounded-lg shadow-xl border border-slate-100 z-20 animate-in zoom-in-95">
                                           <button onClick={() => handleCopyRow(g.slug || g.id)} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 text-slate-700 font-medium">
                                              {copiedId === (g.slug || g.id) ? 'Copied!' : 'Copy Link'}
                                           </button>
                                           <button onClick={() => handleWhatsAppRow(g.slug || g.id)} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 text-slate-700 font-medium border-t border-slate-50">
                                              WhatsApp
                                           </button>
                                        </div>
                                     )}
                                  </div>
                                  <button onClick={() => props.onDeleteGallery(g.id)} className="p-2 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg border border-slate-200 transition"><IconTrash /></button>
                               </div>
                            </div>
                         ))}
                      </div>
                   )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: EDIT */}
          {activeTab === 'content' && (
            <div className="space-y-6">
              {/* Noob-friendly explainer */}
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-[13px] text-blue-900 leading-relaxed">
                <span className="font-bold">New here?</span> Paste one link per line below — Google Drive
                images, YouTube or Vimeo videos, or any direct image URL. Hit <b>Update</b> to see them
                arrange into your 3D gallery, then <b>Share</b> to send it to anyone.
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Media links · one per line</label>
                <textarea
                  className="w-full h-32 p-3 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none font-mono"
                  placeholder={"https://drive.google.com/file/d/.../view\nhttps://youtu.be/...\nhttps://example.com/art.jpg"}
                  value={props.inputValue}
                  onChange={(e) => props.setInputValue(e.target.value)}
                />
                <div className="flex gap-2 mt-2">
                  <button onClick={props.onAddMedia} className="flex-1 bg-slate-900 text-white py-2 rounded-lg text-xs font-bold uppercase tracking-wide shadow-sm hover:bg-black transition">Update ({props.galleryItemsCount})</button>
                  <button onClick={props.onClear} className="px-4 py-2 border border-slate-200 bg-white text-slate-600 rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-slate-50">Clear</button>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-200">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Gallery Info</label>
                <div className="space-y-3">
                  <input type="text" placeholder="Gallery Title" className="w-full p-3 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={props.displayName} onChange={(e) => props.setDisplayName(e.target.value)} />
                  <input type="text" placeholder="WhatsApp (e.g. 15551234567)" className="w-full p-3 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={props.contactWhatsapp} onChange={(e) => props.setContactWhatsapp(e.target.value)} />
                  <input type="email" placeholder="Email Address" className="w-full p-3 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={props.contactEmail} onChange={(e) => props.setContactEmail(e.target.value)} />
                </div>
              </div>

              {/* Per-item titles & descriptions (Phase 4.1) */}
              {props.galleryItems.length > 0 && (
                <div className="pt-4 border-t border-slate-200">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
                    Item Details · {props.galleryItems.length}
                  </label>
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {props.galleryItems.map((item) => {
                      const expanded = expandedItemId === item.id;
                      return (
                        <div key={item.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setExpandedItemId(expanded ? null : item.id)}
                            className="w-full flex items-center gap-3 p-2 text-left hover:bg-slate-50 transition"
                          >
                            <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                              {item.previewUrl || item.fallbackPreview ? (
                                <img src={item.fallbackPreview || item.previewUrl} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-slate-400 text-sm">{item.kind === 'video' ? '▶' : '◈'}</span>
                              )}
                            </div>
                            <span className="flex-1 text-sm text-slate-700 truncate">
                              {item.title || <span className="text-slate-400 italic">Untitled</span>}
                            </span>
                            <svg className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                          </button>
                          {expanded && (
                            <div className="p-3 pt-0 space-y-2 border-t border-slate-100">
                              <input
                                type="text"
                                placeholder="Title"
                                value={item.title || ''}
                                onChange={(e) => updateItem(item.id, { title: e.target.value })}
                                className="w-full p-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                              <textarea
                                placeholder="Description"
                                value={item.description || ''}
                                onChange={(e) => updateItem(item.id, { description: e.target.value })}
                                className="w-full h-16 p-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                              />
                              <div className="flex gap-2">
                                <select
                                  value={item.titleFont || ''}
                                  onChange={(e) => updateItem(item.id, { titleFont: e.target.value || undefined })}
                                  className="flex-1 p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none"
                                >
                                  <option value="">Default font</option>
                                  {CURATED_FONTS.map((f) => (
                                    <option key={f} value={f}>{f}</option>
                                  ))}
                                </select>
                                <select
                                  value={item.titleSize || ''}
                                  onChange={(e) => updateItem(item.id, { titleSize: (e.target.value || undefined) as MediaItem['titleSize'] })}
                                  className="w-24 p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none"
                                >
                                  <option value="">Size</option>
                                  {SIZE_OPTIONS.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Visibility (Phase 2.1) — segmented, defaults to unlisted so links work */}
              <div className="pt-4 border-t border-slate-200">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Visibility</label>
                <div className="grid grid-cols-3 gap-2">
                  {VIS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => props.setVisibility(opt.value)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 ${
                        props.visibility === opt.value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <span className="text-base">{opt.icon}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {VIS_OPTIONS.find((o) => o.value === props.visibility)?.hint}
                </p>
              </div>
              {props.session && (
                 <div className="pt-4 border-t border-slate-100">
                    <button onClick={() => props.onSave({ asNew: true })} disabled={props.isSaving} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md transition disabled:opacity-50">
                        {props.isSaving ? 'Saving...' : 'Save as New Gallery'}
                    </button>
                 </div>
              )}
            </div>
          )}

          {/* TAB 3: APPEARANCE */}
          {activeTab === 'appearance' && (
            <div className="space-y-8">
              {props.displayName && (
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-center justify-between">
                    <span className="text-xs text-blue-500 font-bold uppercase">Editing:</span>
                    <span className="text-xs font-bold text-blue-900 truncate max-w-[150px]">{props.displayName}</span>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Layout</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => props.setViewMode('sphere')} className={`p-3 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 ${props.viewMode === 'sphere' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600'}`}><span className="text-base">◍</span>Sphere</button>
                  <button onClick={() => props.setViewMode('carousel')} className={`p-3 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 ${props.viewMode === 'carousel' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600'}`}><span className="text-base">⟳</span>Carousel</button>
                  <button onClick={() => props.setViewMode('tile')} className={`p-3 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 ${props.viewMode === 'tile' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600'}`}><span className="text-base">▦</span>Masonry</button>
                  <button onClick={() => props.setViewMode('book')} className={`p-3 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 ${props.viewMode === 'book' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600'}`}><span className="text-base">📖</span>Book</button>
                </div>
              </div>

              {/* Masonry / layout editor controls (Phase 6) */}
              {props.viewMode === 'tile' && (
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Arrange mode</span>
                    <div className="inline-flex rounded-lg bg-white border border-slate-200 p-0.5">
                      <button onClick={() => props.setCanvasMode('grid')} className={`px-3 py-1 text-xs font-bold rounded-md transition ${props.canvasMode === 'grid' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Grid</button>
                      <button onClick={() => props.setCanvasMode('free')} className={`px-3 py-1 text-xs font-bold rounded-md transition ${props.canvasMode === 'free' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Free</button>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    <b>Grid</b> reflows items like a masonry — drag to reorder, resize each one.
                    <b> Free</b> lets you place, overlap, and group items anywhere, and add text.
                  </p>
                  {props.session ? (
                    <button onClick={props.onEditLayout} className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm shadow-sm transition">
                      Edit Layout →
                    </button>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">Sign in (My Galleries) to arrange the layout.</p>
                  )}
                </div>
              )}

              {/* Book controls (Phase 7) */}
              {props.viewMode === 'book' && (
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Items per page</span>
                    <div className="inline-flex rounded-lg bg-white border border-slate-200 p-0.5">
                      {([1, 2, 4] as const).map((n) => (
                        <button key={n} onClick={() => props.setBookPerPage(n)} className={`px-3 py-1 text-xs font-bold rounded-md transition ${props.bookPerPage === n ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>{n}</button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    The book paginates your items in order. To reorder or resize them, arrange them in <b>Masonry</b> — the book follows that order.
                  </p>
                  {props.session && (
                    <button onClick={props.onEditLayout} className="w-full py-2.5 bg-white border border-amber-200 text-amber-700 hover:bg-amber-100/50 rounded-lg font-bold text-sm shadow-sm transition">
                      Arrange items in Masonry →
                    </button>
                  )}
                </div>
              )}
              <div className="space-y-6">
                 <div>
                    <div className="flex justify-between mb-2"><span className="text-xs font-bold text-slate-700">Size</span><span className="text-xs text-slate-400">{Math.round(props.mediaScale * 100)}%</span></div>
                    <input type="range" min="0.3" max="3.0" step="0.1" value={props.mediaScale} onChange={(e) => props.setMediaScale(parseFloat(e.target.value))} className="w-full accent-slate-900 h-2 bg-slate-200 rounded-lg appearance-none" />
                 </div>
                 {(props.viewMode === 'sphere' || props.viewMode === 'carousel') && (
                    <div>
                        <div className="flex justify-between mb-2"><span className="text-xs font-bold text-slate-700">Radius</span><span className="text-xs text-slate-400">{props.sphereBase}</span></div>
                        <input type="range" min="10" max="150" step="5" value={props.sphereBase} onChange={(e) => props.setSphereBase(parseInt(e.target.value))} className="w-full accent-slate-900 h-2 bg-slate-200 rounded-lg appearance-none" />
                    </div>
                 )}
              </div>
              {/* Typography defaults (Phase 4.2) — per-item overrides live in Edit */}
              <div className="pt-2 border-t border-slate-200">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Title Typography</label>
                <div className="flex gap-2 mb-3">
                  <select
                    value={props.titleFont}
                    onChange={(e) => props.setTitleFont(e.target.value)}
                    className="flex-1 p-2.5 text-sm bg-white border border-slate-200 rounded-lg outline-none"
                    style={{ fontFamily: `'${props.titleFont}', sans-serif` }}
                  >
                    {CURATED_FONTS.map((f) => (
                      <option key={f} value={f} style={{ fontFamily: `'${f}', sans-serif` }}>{f}</option>
                    ))}
                  </select>
                  <div className="inline-flex items-center rounded-lg bg-slate-100 p-0.5">
                    {SIZE_OPTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => props.setTitleSize(s)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${props.titleSize === s ? 'bg-slate-900 text-white shadow' : 'text-slate-500'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-400">Applies to item titles on card hover and in the lightbox. Set per-item overrides in the Edit tab.</p>
              </div>

              {props.session && props.savedGalleryId && (
                 <button onClick={() => props.onSave({ asNew: false })} disabled={props.isSaving} className="w-full py-3 bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 rounded-xl font-bold text-sm shadow-sm transition">
                   {props.isSaving ? 'Saving...' : 'Save Layout Settings'}
                 </button>
              )}
            </div>
          )}

          {/* TAB 4: SUPPORT */}
          {activeTab === 'support' && (
            <div className="space-y-6 text-center pb-6">
               <div className="bg-indigo-600 text-white p-5 rounded-2xl shadow-lg">
                  <h3 className="font-bold text-lg">Support the Aether Gallery Project</h3>
                  <p className="text-indigo-200 text-xs mt-1">
                    This is an independent project relying on self-funding. 
                    Your contribution helps keep it alive.
                  </p>
               </div>
               
               <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {/* Bit */}
                  <div className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md transition">
                     <a href="https://www.bitpay.co.il/app/me/705695EF-357F-6632-4165-6032ED7F44AE0278" target="_blank" rel="noreferrer" className="block">
                        <div className="w-32 h-32 mx-auto bg-slate-50 rounded-lg mb-2 overflow-hidden">
                            <img src="https://raw.githubusercontent.com/AvocadoHead/Gallery3D/main/assets/%20Bit%20QR.png" className="w-full h-full object-cover mix-blend-multiply" alt="Bit QR" />
                        </div>
                        <span className="text-xs font-bold text-slate-700">Bit</span>
                     </a>
                  </div>

                  {/* Paybox */}
                  <div className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md transition">
                     <a href="https://links.payboxapp.com/hyc1wV1p0Yb" target="_blank" rel="noreferrer" className="block">
                        <div className="w-32 h-32 mx-auto bg-slate-50 rounded-lg mb-2 overflow-hidden">
                            <img src="https://raw.githubusercontent.com/AvocadoHead/Gallery3D/main/assets/Pay%20Group%20QR.png" className="w-full h-full object-cover mix-blend-multiply" alt="Paybox QR" />
                        </div>
                        <span className="text-xs font-bold text-slate-700">Paybox</span>
                     </a>
                  </div>

                  {/* Coffee */}
                  <div className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md transition">
                     <a href="https://buymeacoffee.com/Optopia" target="_blank" rel="noreferrer" className="block">
                        <div className="w-32 h-32 mx-auto bg-slate-50 rounded-lg mb-2 overflow-hidden">
                            <img src="https://raw.githubusercontent.com/AvocadoHead/Gallery3D/main/assets/Buy%20me%20Coffee%20QR.png" className="w-full h-full object-cover mix-blend-multiply" alt="Coffee QR" />
                        </div>
                        <span className="text-xs font-bold text-slate-700">Buy Me Coffee</span>
                     </a>
                  </div>
               </div>
            </div>
          )}
        </div>

        {/* Footer Actions (Editor/Look) */}
        {(activeTab === 'content' || activeTab === 'appearance') && (
            <div className="p-4 bg-white/90 backdrop-blur-md border-t border-slate-100 z-10">
                {props.session && props.savedGalleryId && activeTab === 'content' && (
                    <button onClick={() => props.onSave({ asNew: false })} disabled={props.isSaving} className="w-full mb-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold py-2.5 rounded-lg hover:bg-emerald-100 transition shadow-sm">
                        {props.isSaving ? 'Updating...' : 'Update Current Gallery'}
                    </button>
                )}
                <div className="relative">
                    <button onClick={handleShareFooterClick} className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 text-white text-xs font-bold rounded-lg shadow-lg hover:bg-slate-800 transition">
                        <IconShare /> Share Gallery
                    </button>
                    {shareMenuOpen === 'footer' && (
                        <div className="absolute bottom-full mb-2 left-0 right-0 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in slide-in-from-bottom-2 fade-in zoom-in-95">
                            <button onClick={() => { const link = props.getShareLink(); window.open(`https://wa.me/?text=${encodeURIComponent(link)}`); setShareMenuOpen(null); }} className="w-full px-4 py-3 text-left text-sm hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100"><span className="text-[#25D366] text-lg">📱</span> WhatsApp</button>
                            <button onClick={() => { const link = props.getShareLink(); window.location.href = `mailto:?subject=Gallery&body=${encodeURIComponent(link)}`; setShareMenuOpen(null); }} className="w-full px-4 py-3 text-left text-sm hover:bg-slate-50 flex items-center gap-3"><span className="text-blue-600 text-lg">✉️</span> Email</button>
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default BuilderModal;
