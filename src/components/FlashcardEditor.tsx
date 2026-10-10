'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { Flashcard, MemoryDraft } from '@/types';
import { validateMemoryImage } from '@/lib/authoring/memoryImages';
import { AssociationAssistant } from './AssociationAssistant';
import { DEFAULT_IMAGE_SIZE } from '@/lib/viewer/imageScale';

interface FlashcardEditorProps {
  flashcard?: Flashcard;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: MemoryDraft) => Promise<void>;
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
  const [size, setSize] = useState(flashcard?.imageUrl ? flashcard.size ?? DEFAULT_IMAGE_SIZE : DEFAULT_IMAGE_SIZE);
  const [imageBlob, setImageBlob] = useState<Blob | null | undefined>();
  const [preview, setPreview] = useState(flashcard?.imageUrl ?? '');
  const previewUrlRef = useRef('');
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => () => { if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current); }, []);
  function chooseImage(blob: Blob | null) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = blob ? URL.createObjectURL(blob) : '';
    previewUrlRef.current = url;
    setImageBlob(blob); setPreview(url);
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => { dialog?.close(); previousFocus?.focus(); };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submittingRef.current || aiBusy || !question.trim() || !answer.trim()) return;
    submittingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await onSave({ question: question.trim(), answer: answer.trim(), color, size, imageBlob });
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
      onCancel={event => { event.preventDefault(); if (!submittingRef.current && !aiBusy) onClose(); }}>
      <div className="flex items-start justify-between gap-4 px-6 pt-6">
        <div>
          <h2 id={`${id}-heading`} className="text-xl font-medium">{flashcard ? 'Edit memory' : 'Add a memory here'}</h2>
          <p id={`${id}-hint`} className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-dim)' }}>
            Place a picture at this spot. Tap it in the room to reveal what you want to remember.
          </p>
        </div>
        <button type="button" onClick={onClose} disabled={saving || aiBusy} aria-label="Close note editor"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-40">✕</button>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-6" aria-busy={saving}>
        <div>
          <label htmlFor={`${id}-title`} className="mb-2 block text-sm">Concept or title</label>
          <input id={`${id}-title`} value={question} onChange={event => setQuestion(event.target.value)}
            style={inputStyle} maxLength={160} required disabled={saving || aiBusy} placeholder="Krypton, a poem, a memory…" autoFocus />
        </div>
        <AssociationAssistant term={question} disabled={saving} onImage={chooseImage} onBusyChange={setAiBusy} onChoose={association => {
          setAnswer(current => current ? `${current}\n\nAssociation: ${association.label} — ${association.reason}` : `Association: ${association.label} — ${association.reason}`);
        }} />
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)' }}>
          <label htmlFor={`${id}-image`} className="mb-2 block text-sm">Association image</label>
          <input id={`${id}-image`} type="file" accept="image/png,image/jpeg,image/webp" disabled={saving || aiBusy}
            className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-3 file:text-white"
            onChange={event => {
              const file = event.target.files?.[0];
              if (file) try { validateMemoryImage(file); chooseImage(file); setError(null); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Image could not be opened.'); }
              event.target.value = '';
            }} />
          <p className="mt-2 text-xs" style={{ color: 'var(--text-dim)' }}>PNG or WebP cutouts blend into the room. JPEG works too. Up to 10 MB.</p>
          {preview && <>
            <div className="my-4 flex h-48 items-center justify-center rounded-xl" style={{ background: 'repeating-conic-gradient(#252c34 0% 25%, #343d47 0% 50%) 0 0 / 24px 24px' }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- browser-owned Blob URL, no server optimizer */}
              <img src={preview} alt="Memory image preview" style={{ width: size, height: size, objectFit: 'contain' }} />
            </div>
            <label htmlFor={`${id}-size`} className="block text-sm">Size at normal zoom · {size}px</label>
            <input id={`${id}-size`} type="range" min={16} max={192} step={4} value={size} disabled={saving} onChange={event => setSize(Number(event.target.value))} className="mt-2 w-full" />
            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>Scales with the room as you zoom. Try 24–40px for a densely filled palace.</p>
            <button type="button" disabled={saving} className="mt-2 min-h-11 text-sm underline" onClick={() => chooseImage(null)}>Remove image</button>
          </>}
        </div>
        <div>
          <label htmlFor={`${id}-body`} className="mb-2 block text-sm">Note</label>
          <textarea id={`${id}-body`} value={answer} onChange={event => setAnswer(event.target.value)}
            style={inputStyle} rows={4} maxLength={12000} required disabled={saving} placeholder="What does this image help you remember?" />
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
          {error} Your draft is still here.
        </p>}
        <p className="text-xs" style={{ color: 'var(--text-dim)' }}>Saved on this device after you press Save memory.</p>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} disabled={saving || aiBusy} className="min-h-11 flex-1 rounded-xl border text-sm disabled:opacity-40"
            style={{ borderColor: 'var(--border)' }}>Cancel</button>
          <button type="submit" disabled={saving || aiBusy || !question.trim() || !answer.trim()}
            className="min-h-11 flex-1 rounded-xl text-sm font-medium disabled:opacity-40"
            style={{ background: 'var(--gold)', color: 'var(--bg)' }}>{saving ? 'Saving…' : 'Save memory'}</button>
        </div>
      </form>
    </dialog>
  );
}
