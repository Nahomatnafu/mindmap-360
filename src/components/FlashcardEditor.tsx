'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { Flashcard } from '@/types';

interface FlashcardEditorProps {
  flashcard?: Flashcard;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { question: string; answer: string; color?: string }) => Promise<void>;
}

const COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Cyan', value: '#06b6d4' },
];

export function FlashcardEditor({ flashcard, isOpen, onClose, onSave }: FlashcardEditorProps) {
  if (!isOpen) return null;
  return <FlashcardEditorForm key={flashcard?.id ?? 'new-memory'} flashcard={flashcard} onClose={onClose} onSave={onSave} />;
}

function FlashcardEditorForm({ flashcard, onClose, onSave }: Omit<FlashcardEditorProps, 'isOpen'>) {
  const [question, setQuestion] = useState(flashcard?.question ?? '');
  const [answer, setAnswer] = useState(flashcard?.answer ?? '');
  const [color, setColor] = useState(flashcard?.color || COLORS[0].value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => { dialog?.close(); previousFocus?.focus(); };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submittingRef.current || !question.trim() || !answer.trim()) return;
    submittingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await onSave({ question: question.trim(), answer: answer.trim(), color });
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Your note could not be saved. Please try again.');
    } finally { submittingRef.current = false; setSaving(false); }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', borderRadius: 12,
    background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
    color: 'var(--text)', fontFamily: 'var(--font-content)', fontSize: 16,
    resize: 'vertical', lineHeight: 1.65,
  };

  return (
    <dialog ref={dialogRef} aria-labelledby={`${id}-heading`} aria-describedby={`${id}-hint`}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl p-0 shadow-2xl backdrop:bg-black/70"
      style={{ background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--text)' }}
      onCancel={event => { event.preventDefault(); if (!submittingRef.current) onClose(); }}>
      <div className="flex items-start justify-between gap-4 px-6 pt-6">
        <div>
          <h2 id={`${id}-heading`} className="text-xl font-medium">{flashcard ? 'Edit note' : 'Add a note here'}</h2>
          <p id={`${id}-hint`} className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-dim)' }}>
            Pin a thought, poem, or memory to this spot. Your line breaks are preserved.
          </p>
        </div>
        <button type="button" onClick={onClose} disabled={saving} aria-label="Close note editor"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-40">✕</button>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-6" aria-busy={saving}>
        <div>
          <label htmlFor={`${id}-title`} className="mb-2 block text-sm">Title</label>
          <input id={`${id}-title`} value={question} onChange={event => setQuestion(event.target.value)}
            style={inputStyle} required disabled={saving} placeholder="A memory on the couch" autoFocus />
        </div>
        <div>
          <label htmlFor={`${id}-body`} className="mb-2 block text-sm">Note</label>
          <textarea id={`${id}-body`} value={answer} onChange={event => setAnswer(event.target.value)}
            style={inputStyle} rows={6} required disabled={saving} placeholder="Write something you want to remember…" />
        </div>
        <fieldset disabled={saving}>
          <legend className="mb-3 text-sm">Marker color</legend>
          <div className="flex flex-wrap gap-2">
            {COLORS.map(choice => (
              <button key={choice.value} type="button" onClick={() => setColor(choice.value)}
                aria-label={`${choice.name} marker`} aria-pressed={color === choice.value}
                className="flex h-11 w-11 items-center justify-center rounded-full border-2"
                style={{ borderColor: color === choice.value ? 'var(--text)' : 'transparent' }}>
                <span className="h-7 w-7 rounded-full" style={{ backgroundColor: choice.value }} />
              </button>
            ))}
          </div>
        </fieldset>
        {error && <p role="alert" className="rounded-xl border p-3 text-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
          Save failed: {error} Your text is still here. Try saving again.
        </p>}
        <p className="text-xs" style={{ color: 'var(--text-dim)' }}>Saved on this device after you press Save note.</p>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} disabled={saving} className="min-h-11 flex-1 rounded-xl border text-sm disabled:opacity-40"
            style={{ borderColor: 'var(--border)' }}>Cancel</button>
          <button type="submit" disabled={saving || !question.trim() || !answer.trim()}
            className="min-h-11 flex-1 rounded-xl text-sm font-medium disabled:opacity-40"
            style={{ background: 'var(--gold)', color: 'var(--bg)' }}>{saving ? 'Saving…' : 'Save note'}</button>
        </div>
      </form>
    </dialog>
  );
}
