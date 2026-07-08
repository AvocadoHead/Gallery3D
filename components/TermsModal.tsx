import React from 'react';

interface TermsModalProps {
  onClose: () => void;
}

const TermsModal: React.FC<TermsModalProps> = ({ onClose }) => (
  <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
    <div className="bg-white w-full max-w-lg max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-5 border-b border-slate-100">
        <h2 className="text-base font-bold text-slate-900">Terms &amp; Accessibility</h2>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6 text-sm text-slate-700 leading-relaxed">
        <section>
          <h3 className="font-bold text-slate-900 mb-2">Terms of Use</h3>
          <p>
            Aether Gallery is a display tool. It lets you collect links to media hosted elsewhere and
            present them in a 3D gallery — like sharing a playlist. Aether displays the links you
            paste; it never uploads, copies, or hosts any content itself.
          </p>
          <p className="mt-2">
            You are responsible for the links you paste into your gallery. By creating a gallery you
            confirm you have the right to link to the media you include. Aether does not pre-screen
            content.
          </p>
          <p className="mt-2">
            To request removal of a gallery or report misuse, contact:{' '}
            <a href="mailto:eyalizenman@gmail.com" className="text-blue-600 underline">
              eyalizenman@gmail.com
            </a>
            .
          </p>
        </section>

        <section>
          <h3 className="font-bold text-slate-900 mb-2">Accessibility</h3>
          <p>
            The Sphere, Carousel, and Book layouts are immersive 3D experiences built with WebGL.
            They are inherently visual and are not guaranteed to be screen-reader accessible.
          </p>
          <p className="mt-2">
            The <strong>Masonry</strong> layout is the accessible alternative — it renders as a
            standard HTML grid with no 3D rendering. If you need an accessible viewing experience,
            select Masonry using the layout picker at the top of the page.
          </p>
          <p className="mt-2">
            Feedback is welcome at{' '}
            <a href="mailto:eyalizenman@gmail.com" className="text-blue-600 underline">
              eyalizenman@gmail.com
            </a>
            .
          </p>
        </section>

        <p className="text-xs text-slate-400 pt-2 border-t border-slate-100">
          Last updated: July 2026. These are operational terms, not legal advice. A lawyer's review
          is recommended before relying on them for compliance purposes.
        </p>
      </div>
    </div>
  </div>
);

export default TermsModal;
