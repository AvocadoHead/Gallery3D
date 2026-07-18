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
  <div className="group rounded-2xl bg-white/[0.07] p-4 text-left ring-1 ring-white/12 backdrop-blur-md transition hover:bg-white/[0.1]">
    <div className="mb-5 flex items-center justify-between">
      <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">{n}</span>
      <span className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent ml-4" />
    </div>
    <p className="text-[15px] font-semibold text-white">{title}</p>
    <p className="mt-2 text-[13px] leading-6 text-white/62">{body}</p>
  </div>
);

const SphereDiagram = () => (
  <div className="relative h-full w-full overflow-hidden rounded-[1rem] bg-[radial-gradient(circle_at_50%_44%,rgba(30,41,59,0.08),transparent_42%),linear-gradient(135deg,#f8fafc,#cbd5e1)]">
    <div className="absolute left-1/2 top-[44%] h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-400/45" />
    <div className="absolute left-1/2 top-[44%] h-24 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-400/35" />
    <div className="absolute left-1/2 top-[44%] h-10 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-400/35" />
    {[
      ['left-[22%] top-[34%] rotate-[-10deg]', 'h-9 w-7'],
      ['left-[43%] top-[21%] rotate-[6deg]', 'h-7 w-9'],
      ['right-[18%] top-[39%] rotate-[12deg]', 'h-10 w-7'],
      ['left-[34%] bottom-[27%] rotate-[8deg]', 'h-8 w-10'],
      ['right-[29%] bottom-[23%] rotate-[-8deg]', 'h-9 w-7'],
      ['left-[52%] top-[45%] rotate-[2deg]', 'h-10 w-8'],
    ].map(([pos, size], i) => (
      <span key={i} className={`absolute ${pos} ${size} rounded-md bg-white/88 shadow-sm ring-1 ring-slate-300/70`}>
        <span className="block h-full rounded-md bg-gradient-to-br from-indigo-200 via-sky-100 to-slate-200" />
      </span>
    ))}
  </div>
);

const MasonryDiagram = () => (
  <div className="grid h-full w-full grid-cols-3 gap-1.5 rounded-[1rem] bg-gradient-to-br from-slate-50 to-slate-200 p-3">
    {[42, 68, 50, 74, 46, 82, 55, 64, 44].map((h, i) => (
      <span key={i} className="rounded-md bg-white/90 p-1 shadow-sm ring-1 ring-slate-300/70" style={{ height: `${h}px` }}>
        <span className="block h-full rounded bg-gradient-to-br from-slate-200 via-white to-sky-100" />
      </span>
    ))}
  </div>
);

const BookDiagram = () => (
  <div className="relative h-full w-full overflow-hidden rounded-[1rem] bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.92),transparent_42%),linear-gradient(135deg,#e2e8f0,#f8fafc)]">
    <div className="absolute left-1/2 top-[44%] h-28 w-36 -translate-x-1/2 -translate-y-1/2 rotate-[-5deg] rounded-xl bg-slate-300/70 shadow-[0_18px_35px_rgba(15,23,42,0.18)]" />
    <div className="absolute left-[21%] top-[24%] h-28 w-[30%] origin-right rotate-[-2deg] rounded-l-xl rounded-r-sm bg-white p-2 shadow-sm ring-1 ring-slate-300/80">
      <div className="h-full rounded-md bg-gradient-to-br from-indigo-100 via-white to-slate-200" />
    </div>
    <div className="absolute right-[21%] top-[24%] h-28 w-[30%] origin-left rounded-r-xl rounded-l-sm bg-white p-2 shadow-sm ring-1 ring-slate-300/80">
      <div className="h-full rounded-md bg-gradient-to-br from-sky-100 via-white to-slate-200" />
    </div>
    <div className="absolute left-1/2 top-[23%] h-28 w-px -translate-x-1/2 bg-slate-300" />
  </div>
);

const MiniCard = ({ className, label, children }: { className: string; label: string; children: React.ReactNode }) => (
  <div className={`absolute rounded-[1.4rem] bg-white p-1.5 shadow-2xl shadow-black/35 ring-1 ring-white/40 ${className}`}>
    <div className="relative h-full w-full overflow-hidden rounded-[1rem]">
      {children}
      <div className="absolute inset-x-0 bottom-0 flex h-9 items-center justify-between bg-white/82 px-3 backdrop-blur-sm">
        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</span>
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      </div>
    </div>
  </div>
);

const Landing: React.FC<LandingProps> = ({ session, onBuild, onExplore, onDemo }) => {
  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-8 animate-in fade-in duration-700" style={{ touchAction: 'pan-y' }}>
      <div className="absolute inset-0 bg-[#090b12]/72 backdrop-blur-[3px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(99,102,241,0.36),transparent_28%),radial-gradient(circle_at_84%_18%,rgba(14,165,233,0.26),transparent_26%),radial-gradient(circle_at_50%_100%,rgba(255,255,255,0.16),transparent_34%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

      <main className="relative grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="mx-auto w-full max-w-2xl text-center lg:mx-0 lg:text-left">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/[0.08] px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70 ring-1 ring-white/12 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.85)]" />
            Aether Gallery
          </div>

          <h1
            className="text-balance text-[clamp(2.55rem,7vw,5.9rem)] font-light leading-[0.94] tracking-[-0.065em] text-white"
            style={{ textShadow: '0 0 10px rgba(0,0,0,1)' }}
          >
            Turn a folder of work into a living gallery.
          </h1>

          <p className="mt-6 max-w-xl text-pretty text-base leading-8 text-white/68 sm:text-lg lg:mx-0">
            Paste image or video links, choose how the pieces move, then share a polished gallery with one clean link. Built for artists, editors and visual collections that need to feel considered from the first click.
          </p>

          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center lg:justify-start">
            <button
              onClick={onBuild}
              className="group rounded-2xl bg-white px-6 py-4 text-sm font-semibold text-slate-950 shadow-[0_0_0_1px_rgba(255,255,255,0.28),0_22px_70px_rgba(15,23,42,0.45)] transition hover:-translate-y-0.5 hover:bg-slate-50"
            >
              Build a gallery
              <span className="ml-2 inline-block transition-transform group-hover:translate-x-0.5">→</span>
            </button>
            <button
              onClick={onExplore}
              className="rounded-2xl bg-white/[0.08] px-6 py-4 text-sm font-semibold text-white ring-1 ring-white/14 backdrop-blur-md transition hover:bg-white/[0.12]"
            >
              Explore public work
            </button>
            <button
              onClick={onDemo}
              className="rounded-2xl px-4 py-4 text-sm font-medium text-white/52 transition hover:text-white"
            >
              View demo
            </button>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            <Step n="01" title="Paste" body="Use Drive files, direct images, direct videos, YouTube or Vimeo links." />
            <Step n="02" title="Tune" body="Pick sphere, carousel, masonry or book, then adjust size and spacing live." />
            <Step n="03" title="Share" body="Save the gallery once and send a small, durable link to anyone." />
          </div>

          {session && (
            <p className="mt-5 text-xs leading-5 text-white/42">
              Signed in as {session.user.email}. Your saved galleries are available from the menu.
            </p>
          )}
        </section>

        <section className="relative mx-auto hidden aspect-[4/5] w-full max-w-[28rem] lg:block">
          <div className="absolute inset-8 rounded-[2rem] bg-white/[0.06] ring-1 ring-white/12 backdrop-blur-md" />
          <div className="absolute inset-0 rounded-[2.5rem] bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.18),transparent_42%)] ring-1 ring-white/10" />
          <MiniCard label="Sphere" className="left-2 top-10 h-48 w-36 rotate-[-9deg]"><SphereDiagram /></MiniCard>
          <MiniCard label="Masonry" className="right-1 top-24 h-56 w-40 rotate-[7deg]"><MasonryDiagram /></MiniCard>
          <MiniCard label="Book" className="bottom-14 left-16 h-52 w-44 rotate-[3deg]"><BookDiagram /></MiniCard>
          <div className="absolute bottom-6 right-8 rounded-full bg-slate-950/70 px-4 py-2 text-xs font-medium text-white/75 ring-1 ring-white/10 backdrop-blur-md">
            Living preview behind the glass
          </div>
        </section>
      </main>
    </div>
  );
};

export default Landing;
