import React, { useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { postGalleryNote } from '../supabaseClient';

interface NoteFormProps {
  galleryId: string;
  itemId?: string;
  itemTitle?: string;
  session: Session | null;
  onClose: () => void;
}

const NoteForm: React.FC<NoteFormProps> = ({ galleryId, itemId, itemTitle, session, onClose }) => {
  const [name, setName] = useState(session?.user?.email?.split('@')[0] || '');
  const [body, setBody] = useState('');
  const [allowShare, setAllowShare] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const isPiece = Boolean(itemId);
  const heading = isPiece
    ? `Comment on "${itemTitle || 'this piece'}"`
    : 'Leave a comment';

  const handleSubmit = async () => {
    if (!body.trim()) return;
    setSending(true);
    setError('');
    try {
      await postGalleryNote(
        galleryId,
        { author_name: name.trim() || undefined, body: body.trim(), allow_share: allowShare, item_id: itemId },
        session,
      );
      setSubmitted(true);
    } catch {
      setError('Could not send. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">{heading}</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500"
            aria-label="Close"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-3">
          {submitted ? (
            <div className="text-center py-6 space-y-2">
              <div className="text-2xl">✉️</div>
              <p className="font-bold text-slate-900 text-sm">Comment sent!</p>
              <p className="text-xs text-slate-500">The gallery creator will see it privately.</p>
              <button onClick={onClose} className="mt-3 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg">
                Close
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Your name (optional)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Anonymous"
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Message</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value.slice(0, 1000))}
                  placeholder={isPiece ? 'What did you think of this piece?' : 'What did you think of this gallery?'}
                  rows={4}
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <p className="text-[10px] text-slate-300 text-right">{body.length}/1000</p>
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowShare}
                  onChange={(e) => setAllowShare(e.target.checked)}
                  className="mt-0.5 accent-slate-900"
                />
                <span className="text-xs text-slate-500">The gallery owner may share this comment publicly</span>
              </label>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSubmit}
                  disabled={!body.trim() || sending}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-lg transition disabled:opacity-40"
                >
                  {sending ? 'Sending…' : 'Send'}
                </button>
                <button onClick={onClose} className="px-4 py-2.5 border border-slate-200 text-slate-500 text-xs font-bold rounded-lg hover:bg-slate-50 transition">
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default NoteForm;
