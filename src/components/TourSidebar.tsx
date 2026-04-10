'use client';

import React from 'react';
import { Tour, AppMode, generateId } from '@/types';
import { useTourContext } from '@/context/TourContext';

interface TourSidebarProps {
  tours: Tour[];
  selectedTourId: string | null;
  onSelectTour: (id: string) => void;
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  selectedFlashcardId: string | null;
  onSelectFlashcard: (id: string | null) => void;
}

export function TourSidebar({
  tours, selectedTourId, onSelectTour,
  mode, onModeChange,
  selectedFlashcardId, onSelectFlashcard,
}: TourSidebarProps) {
  const { addTour } = useTourContext();
  const selectedTour = tours.find(t => t.id === selectedTourId);

  const handleAddTour = () => {
    const url = prompt('Enter 360 tour URL or image path:');
    if (!url) return;
    const name = prompt('Tour name:') || 'New Tour';
    addTour({
      name,
      description: '',
      type: url.includes('kuula.co') ? 'kuula' : url.includes('matterport') ? 'matterport' : 'panorama',
      tourId: generateId(),
      embedUrl: url,
      flashcards: [],
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden"
      style={{ width: 260, background: 'var(--panel)', borderRight: '1px solid var(--border)' }}>
      <div className="px-5 pt-6 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontFamily: 'var(--font-content)', fontSize: 22, color: 'var(--gold)', letterSpacing: '0.04em' }}>Loci</div>
        <div style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 3 }}>memory palace · flashcards</div>
      </div>
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex rounded overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {(['view', 'edit'] as AppMode[]).map(m => (
            <button key={m} onClick={() => onModeChange(m)}
              className="flex-1 py-2 text-xs uppercase tracking-widest transition-colors"
              style={{
                background: mode === m ? (m === 'edit' ? 'var(--gold)' : 'var(--panel-light)') : 'transparent',
                color:      mode === m ? (m === 'edit' ? 'var(--bg)'   : 'var(--gold)')        : 'var(--text-dim)',
                fontFamily: 'var(--font-ui)',
              }}>
              {m === 'view' ? '👁 View' : '✏ Edit'}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>Spaces</span>
          <button onClick={handleAddTour} className="w-5 h-5 rounded-full flex items-center justify-center text-xs"
            style={{ background: 'var(--gold-dim)', color: 'var(--bg)' }} title="Add tour">+</button>
        </div>
        <div className="flex flex-col gap-2">
          {tours.map(tour => {
            const active = tour.id === selectedTourId;
            return (
              <button key={tour.id} onClick={() => onSelectTour(tour.id)}
                className="w-full text-left px-3 py-3 rounded transition-colors"
                style={{
                  background: active ? 'var(--panel-light)' : 'transparent',
                  border: `1px solid ${active ? 'var(--gold-dim)' : 'var(--border)'}`,
                  color: active ? 'var(--gold)' : 'var(--text)',
                }}>
                <div style={{ fontFamily: 'var(--font-content)', fontSize: 15 }}>{tour.name}</div>
                <div className="mt-0.5 text-xs" style={{ color: 'var(--text-dim)' }}>
                  {tour.flashcards.length} card{tour.flashcards.length !== 1 ? 's' : ''} · {tour.type}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      {selectedTour && selectedTour.flashcards.length > 0 && (
        <div className="overflow-y-auto px-4 py-3" style={{ borderTop: '1px solid var(--border)', maxHeight: 240 }}>
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--text-dim)' }}>Cards</div>
          <div className="flex flex-col gap-1">
            {selectedTour.flashcards.map(fc => {
              const active = fc.id === selectedFlashcardId;
              return (
                <button key={fc.id} onClick={() => onSelectFlashcard(active ? null : fc.id)}
                  className="w-full text-left px-3 py-2 rounded flex items-center gap-2 transition-colors"
                  style={{
                    background: active ? 'rgba(201,168,76,0.1)' : 'transparent',
                    border: `1px solid ${active ? 'var(--gold-dim)' : 'transparent'}`,
                    color: active ? 'var(--gold)' : 'var(--text)',
                    fontFamily: 'var(--font-content)', fontSize: 13,
                  }}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: fc.color || 'var(--gold)' }} />
                  <span className="truncate">{fc.question}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
