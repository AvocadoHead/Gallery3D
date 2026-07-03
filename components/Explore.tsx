import React, { useEffect, useState } from 'react';
import { listPublicGalleries, PublicGallery, isSupabaseConfigured } from '../supabaseClient';

interface ExploreProps {
  /** Open a public gallery by its slug. */
  onOpen: (slug: string) => void;
  /** Return to wherever the user came from (landing / gallery). */
  onBack: () => void;
  /** Start building a new gallery. */
  onBuild: () => void;
}

const IconEye = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const Card: React.FC<{ g: PublicGallery; onOpen: (slug: string) => void }> = ({ g, onOpen }) => {
  const [loaded, setLoaded] = useState(false);
  const authorName = g.author?.handle ? `@${g.author.handle}` : g.author?.display_name || 'Anonymous';

  return (
    <button
      onClick={() => g.slug && onOpen(g.slug)}
      className="group text-left rounded-2xl overflow-hidden bg-white border border-slate-200/80 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
    >
      <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
        {g.cover_url ? (
          <img
            src={g.cover_url}
            alt={g.display_name || 'Gallery'}
            referrerPolicy="no-referrer"
            loading="lazy"
            onLoad={() => setLoaded(true)}
            className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300 text-3xl">◈</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white text-[10px] font-semibold">
          <IconEye /> {g.view_count}
        </div>
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-white/85 backdrop-blur-sm text-slate-700 text-[10px] font-bold">
          {g.item_count} pieces
        </div>
      </div>
      <div className="p-3">
        <h3 className="text-sm font-bold text-slate-800 truncate">{g.display_name || 'Untitled gallery'}</h3>
        <p className="text-xs text-slate-400 mt-0.5 truncate">{authorName}</p>
      </div>
    </button>
  );
};

const Explore: React.FC<ExploreProps> = ({ onOpen, onBack, onBuild }) => {
  const [galleries, setGalleries] = useState<PublicGallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const data = await listPublicGalleries(60);
        if (alive) setGalleries(data);
      } catch (err: any) {
        if (alive) setError(err?.message || 'Could not load galleries.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[120] bg-gradient-to-br from-slate-50 to-slate-100 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200/70">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
              aria-label="Back"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-light text-slate-800 tracking-tight">Explore</h1>
              <p className="text-xs text-slate-400 -mt-0.5">Public galleries from the community</p>
            </div>
          </div>
          <button
            onClick={onBuild}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-black transition-colors shadow-sm"
          >
            + Create yours
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-6xl mx-auto px-5 py-8">
        {!isSupabaseConfigured ? (
          <div className="text-center py-24 text-slate-400">Connect Supabase to browse public galleries.</div>
        ) : loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden bg-white border border-slate-200/80">
                <div className="aspect-[4/3] bg-slate-200 animate-pulse" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-slate-200 rounded animate-pulse w-3/4" />
                  <div className="h-2 bg-slate-100 rounded animate-pulse w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-24 text-slate-400">{error}</div>
        ) : galleries.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">🌌</div>
            <h2 className="text-lg font-bold text-slate-700">No public galleries yet</h2>
            <p className="text-sm text-slate-400 mt-1 mb-6">Be the very first to share one.</p>
            <button
              onClick={onBuild}
              className="px-6 py-3 rounded-2xl bg-slate-900 text-white font-bold hover:bg-black transition-colors shadow-lg"
            >
              Build the first gallery
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {galleries.map((g) => (
              <Card key={g.id} g={g} onOpen={onOpen} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Explore;
