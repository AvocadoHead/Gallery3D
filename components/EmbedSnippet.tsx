import React, { useMemo, useState } from 'react';

/**
 * Embed-code panel for the Share UI.
 *
 * Origin is always taken from window.location.origin so this keeps working on
 * preview deploys, localhost, and any future custom domain — never a hardcoded
 * host. The `allow` list is trimmed to what this canvas actually uses:
 * navigation is drei OrbitControls (plain pointer events) with no mouse-look
 * and no XR, so pointer-lock / xr-spatial-tracking are intentionally omitted;
 * only fullscreen is granted.
 */
type Ratio = '16/9' | '4/3' | '1/1';
const RATIOS: { value: Ratio; label: string }[] = [
  { value: '16/9', label: 'Wide (16:9)' },
  { value: '4/3', label: 'Standard (4:3)' },
  { value: '1/1', label: 'Square (1:1)' },
];

export const EmbedSnippet: React.FC<{ slug: string; onClose: () => void }> = ({ slug, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [ratio, setRatio] = useState<Ratio>('16/9');

  const snippet = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const src = `${origin}/?gallery=${slug}&embed=1`;
    return `<div style="position:relative;width:100%;aspect-ratio:${ratio}">
  <iframe
    src="${src}"
    style="position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:12px"
    allow="fullscreen"
    allowfullscreen loading="lazy" title="Gallery"></iframe>
</div>`;
  }, [slug, ratio]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800">Embed this gallery</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-500">
            Paste this into your site. Works in Webflow, Squarespace, Wix, Framer and Notion.
          </p>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Shape</label>
            <select
              value={ratio}
              onChange={(e) => setRatio(e.target.value as Ratio)}
              className="text-sm border border-slate-200 rounded-lg px-2 py-1 bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {RATIOS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <textarea
            readOnly
            rows={8}
            value={snippet}
            spellCheck={false}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />

          <button
            onClick={copy}
            className="w-full py-2.5 rounded-lg bg-slate-900 text-white text-xs font-bold shadow hover:bg-slate-800 transition"
          >
            {copied ? 'Copied!' : 'Copy embed code'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmbedSnippet;
