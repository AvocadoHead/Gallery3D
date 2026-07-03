import React from 'react';
import { Session } from '@supabase/supabase-js';

interface LandingProps {
  session: Session | null;
  /** Open the builder on the guided first-gallery flow. */
  onBuild: () => void;
  /** Go to the Explore page. */
  onExplore: () => void;
  /** Dismiss the landing and reveal the live demo gallery behind it. */
  onDemo: () => void;
}

const Step = ({ n, title, body }: { n: string; title: string; body: string }) => (
  <div className="flex items-start gap-3 text-left">
    <div className="mt-0.5 w-7 h-7 shrink-0 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-xs font-bold text-white/90">
      {n}
    </div>
    <div>
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="text-xs text-white/60 leading-relaxed mt-0.5">{body}</p>
    </div>
  </div>
);

const Landing: React.FC<LandingProps> = ({ session, onBuild, onExplore, onDemo }) => {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-5 sm:p-8 animate-in fade-in duration-700">
      {/* Cinematic scrim over the live 3D sphere */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-900/55 to-slate-950/80 backdrop-blur-[2px]" />
      <div className="absolute -top-1/3 left-1/2 -translate-x-1/2 w-[80vw] h-[80vw] max-w-3xl max-h-[48rem] rounded-full bg-indigo-500/20 blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-xl text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-white/80 text-[11px] font-semibold tracking-widest uppercase mb-6 animate-in slide-in-from-bottom-3 duration-700">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Aether Gallery
        </div>

        <h1 className="text-4xl sm:text-6xl font-light text-white tracking-tight leading-[1.05] animate-in slide-in-from-bottom-4 duration-700">
          Your images,
          <br />
          <span className="font-medium bg-gradient-to-r from-indigo-300 via-white to-sky-200 bg-clip-text text-transparent">
            a living 3D gallery.
          </span>
        </h1>

        <p className="mt-5 text-base sm:text-lg text-white/70 max-w-md mx-auto leading-relaxed animate-in slide-in-from-bottom-5 duration-700">
          Paste a few links — from Google Drive, YouTube, or anywhere — and Aether spins them into
          an immersive gallery you can share with one link. No design skills needed.
        </p>

        {/* Primary actions */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 animate-in slide-in-from-bottom-6 duration-700">
          <button
            onClick={onBuild}
            className="group w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-white text-slate-900 font-bold shadow-2xl shadow-indigo-900/40 hover:shadow-indigo-500/30 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
          >
            Build yours in 30 seconds
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </button>
          <button
            onClick={onExplore}
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white/10 border border-white/15 text-white font-semibold hover:bg-white/15 transition-all"
          >
            Explore galleries
          </button>
        </div>

        <button
          onClick={onDemo}
          className="mt-4 text-sm text-white/50 hover:text-white/80 transition-colors underline underline-offset-4 decoration-white/20"
        >
          or just watch the demo gallery ↓
        </button>

        {/* How it works */}
        <div className="mt-12 grid sm:grid-cols-3 gap-5 p-5 rounded-3xl bg-white/[0.04] border border-white/10 backdrop-blur-md animate-in fade-in duration-1000">
          <Step n="1" title="Paste links" body="Drive images, YouTube, Vimeo, or direct image URLs." />
          <Step n="2" title="Pick a look" body="Sphere, carousel, or masonry — tune size & spacing live." />
          <Step n="3" title="Share it" body="Save once, get a link. Send it to anyone, anywhere." />
        </div>

        {session && (
          <p className="mt-6 text-xs text-white/40">
            Signed in as {session.user.email} — your saved galleries are one tap away in the menu.
          </p>
        )}
      </div>
    </div>
  );
};

export default Landing;
