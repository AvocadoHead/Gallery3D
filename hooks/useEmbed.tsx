import React, { useEffect, useState } from 'react';

/**
 * Opt-in embed mode — true ONLY for `?embed=1`.
 *
 * Deliberately not auto-detecting `window.self !== window.top`: that would
 * change behaviour for anyone already framing the app today. This app is a
 * client-only Vite SPA (no SSR), so reading the flag once in a useState
 * initializer is safe — no hydration to mismatch.
 */
export function useEmbedMode(): boolean {
  const [isEmbed] = useState(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('embed') === '1',
  );
  return isEmbed;
}

/**
 * Click-to-activate gate for embed mode.
 *
 * Until the visitor taps once, an embedded gallery must not swallow the host
 * page's scroll — otherwise the page it's embedded in becomes unscrollable on
 * mobile and whoever installed it takes it back out. Two things make that work:
 *  1. A full-cover overlay sits above the canvas, so none of the gallery's
 *     wheel/touch handlers (OrbitControls etc.) receive events before the tap.
 *  2. index.css sets `touch-action: none` on <body> for the live app; while the
 *     gate is up we relax it to `auto` so a swipe scrolls the host page instead
 *     of being eaten. On activation it's restored to the CSS default.
 *
 * For non-embed loads this is inert: `active` starts true and the effect is a
 * no-op, so the normal app is completely unaffected.
 */
export function useEmbedActivation(isEmbed: boolean): {
  active: boolean;
  overlay: React.ReactNode;
} {
  const [active, setActive] = useState(!isEmbed);

  useEffect(() => {
    if (!isEmbed) return;
    document.body.style.touchAction = active ? '' : 'auto';
    return () => {
      document.body.style.touchAction = '';
    };
  }, [isEmbed, active]);

  const overlay =
    isEmbed && !active ? (
      <button
        type="button"
        onClick={() => setActive(true)}
        aria-label="Activate gallery"
        className="absolute inset-0 z-40 grid place-items-center border-0 bg-black/20 text-white cursor-pointer"
      >
        <span className="px-6 py-3 rounded-full bg-black/55 backdrop-blur-md border border-white/20 text-sm font-semibold">
          Tap to explore
        </span>
      </button>
    ) : null;

  return { active, overlay };
}
