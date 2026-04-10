'use client';

import React, { useState, useEffect } from 'react';
import { Flashcard, Position } from '@/types';

interface FlashcardEditorProps {
  flashcard?: Flashcard;
  position?: Position;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { question: string; answer: string; color?: string }) => void;
}

const COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Cyan', value: '#06b6d4' },
];

export function FlashcardEditor({ flashcard, position, isOpen, onClose, onSave }: FlashcardEditorProps) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [color, setColor] = useState(COLORS[0].value);

  useEffect(() => {
    if (flashcard) {
      setQuestion(flashcard.question);
      setAnswer(flashcard.answer);
      setColor(flashcard.color || COLORS[0].value);
    } else {
      setQuestion('');
      setAnswer('');
      setColor(COLORS[0].value);
    }
  }, [flashcard, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    onSave({ question: question.trim(), answer: answer.trim(), color });
    onClose();
  };

  if (!isOpen) return null;

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 4,
    background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
    color: 'var(--text)', fontFamily: 'var(--font-content)', fontSize: 15,
    outline: 'none', resize: 'none' as const, lineHeight: 1.6,
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', marginBottom: 5, fontSize: 10,
    color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase' as const,
    fontFamily: 'var(--font-ui)',
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(8,8,16,0.75)' }} onClick={onClose}>
      <div className="w-full max-w-md m-4 rounded shadow-2xl"
        style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontFamily: 'var(--font-content)', fontSize: 20, color: 'var(--text)', fontWeight: 300 }}>
            {flashcard ? 'Edit Marker' : 'New Marker'}
          </h2>
          <button onClick={onClose} style={{ color: 'var(--text-dim)', background: 'none', border: 'none', fontSize: 16, cursor: 'pointer' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
          <div>
            <label style={labelStyle}>Question</label>
            <textarea value={question} onChange={e => setQuestion(e.target.value)}
              style={inputStyle} rows={2} placeholder="What do you want to remember?" autoFocus />
          </div>

          <div>
            <label style={labelStyle}>Answer</label>
            <textarea value={answer} onChange={e => setAnswer(e.target.value)}
              style={inputStyle} rows={3} placeholder="The answer or information to recall" />
          </div>

          <div>
            <label style={labelStyle}>Marker Color</label>
            <div className="flex gap-2 mt-1">
              {COLORS.map(c => (
                <button key={c.value} type="button" onClick={() => setColor(c.value)}
                  className="w-7 h-7 rounded-full transition-transform"
                  style={{
                    backgroundColor: c.value,
                    transform: color === c.value ? 'scale(1.3)' : 'scale(1)',
                    outline: color === c.value ? `2px solid ${c.value}` : 'none',
                    outlineOffset: 2,
                  }} title={c.name} />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded text-xs uppercase tracking-widest transition-colors"
              style={{ border: '1px solid var(--border)', color: 'var(--text-dim)', background: 'transparent', fontFamily: 'var(--font-ui)', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={!question.trim() || !answer.trim()}
              className="flex-1 py-2 rounded text-xs uppercase tracking-widest transition-colors"
              style={{
                background: 'var(--gold-dim)', border: '1px solid var(--gold)',
                color: 'var(--gold-bright)', fontFamily: 'var(--font-ui)',
                cursor: !question.trim() || !answer.trim() ? 'not-allowed' : 'pointer',
                opacity: !question.trim() || !answer.trim() ? 0.4 : 1,
              }}>
              {flashcard ? 'Update' : 'Save'} Marker
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

