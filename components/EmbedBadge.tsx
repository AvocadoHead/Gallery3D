import React from 'react';

/**
 * Attribution badge — embed mode only, bottom-right.
 *
 * The growth loop: every gallery embedded on a designer's site becomes a link
 * back. Quiet enough that people leave it in, visible enough that it gets
 * clicked. Sits above the canvas but clears the Explore control (which is
 * hidden in embed anyway) and any canvas UI.
 */
export const EmbedBadge: React.FC = () => {
  const href =
    typeof window !== 'undefined'
      ? `${window.location.origin}/?utm_source=embed`
      : '/';

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="absolute bottom-3 right-3 z-50 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white/90 no-underline backdrop-blur-md border border-white/15 hover:bg-black/70 transition"
    >
      Made with Aether Gallery
    </a>
  );
};

export default EmbedBadge;
