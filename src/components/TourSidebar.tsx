'use client';

import React, { useRef, useState } from 'react';
import { Tour, AppMode } from '@/types';
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
  const { createTourFromFiles, renameScenes, prepareTour, preparation } = useTourContext();
  const selectedTour = tours.find(t => t.id === selectedTourId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [tourTitle, setTourTitle] = useState('');
  const [sceneEditorOpen, setSceneEditorOpen] = useState(false);
  const [sceneDrafts, setSceneDrafts] = useState<Record<string, string>>({});

  const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;
    const suggestedTitle = files[0].name
      .replace(/\.[^.]+$/, '')
      .replace(/[-_]?\d+$/, '')
      .replace(/[-_]+/g, ' ')
      .trim()
      .replace(/\b\w/g, character => character.toUpperCase());
    setPendingFiles(files);
    setTourTitle(suggestedTitle || 'New memory palace');
  };

  const handleImport = async () => {
    if (!pendingFiles.length || !tourTitle.trim()) return;
    setIsImporting(true);
    try {
      await createTourFromFiles(pendingFiles, tourTitle);
      setPendingFiles([]);
    } catch {
      // The context exposes the actionable error in the page alert.
    } finally {
      setIsImporting(false);
    }
  };

  const openSceneEditor = () => {
    if (!selectedTour) return;
    setSceneDrafts(Object.fromEntries(selectedTour.scenes.map(scene => [scene.id, scene.name])));
    setSceneEditorOpen(true);
  };

  const saveSceneNames = async () => {
    if (!selectedTour) return;
    await renameScenes(selectedTour.id, sceneDrafts);
    setSceneEditorOpen(false);
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
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={handleFiles} />
          <button onClick={() => fileInputRef.current?.click()} disabled={isImporting}
            className="min-w-5 h-5 rounded-full flex items-center justify-center px-1 text-xs"
            style={{ background: 'var(--gold-dim)', color: 'var(--bg)', cursor: isImporting ? 'wait' : 'pointer' }}
            title="Import 360 photos" aria-label="Import 360 photos">
            {isImporting ? '…' : '+'}
          </button>
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
        {selectedTour && mode === 'edit' && (
          <button onClick={openSceneEditor} className="mt-3 w-full rounded-lg px-3 py-2 text-left text-xs uppercase tracking-widest"
            style={{ color: 'var(--gold)', border: '1px solid var(--border)', background: 'rgba(201,168,76,0.06)' }}>
            Manage {selectedTour.scenes.length} scenes
          </button>
        )}
        {selectedTour && <div className="mt-4 space-y-2 text-xs">
          <button disabled={Boolean(preparation)} onClick={() => void prepareTour(selectedTour.id).catch(() => {})} className="w-full rounded-lg border px-3 py-3 text-left" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}> {preparation || 'Create fast previews'} </button>
          {selectedTour.name === 'OpenView Homes' && <button disabled={Boolean(preparation)} onClick={() => void prepareTour(selectedTour.id, true).catch(() => {})} className="w-full rounded-lg border px-3 py-3 text-left" style={{ borderColor: 'var(--gold-dim)', color: 'var(--gold)' }}>Apply reviewed OpenView layout</button>}
          <p style={{ color: 'var(--text-dim)', lineHeight: 1.6 }}>Photos and notes are saved on this device.</p>
        </div>}
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

      {pendingFiles.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,5,12,0.82)' }}>
          <div className="w-full max-w-md rounded-xl p-6 shadow-2xl" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
            <div className="mb-1 text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--gold)' }}>New palace</div>
            <h2 className="mb-2 text-2xl" style={{ color: 'var(--text)', fontFamily: 'var(--font-content)' }}>Name this tour</h2>
            <p className="mb-5 text-sm" style={{ color: 'var(--text-dim)', lineHeight: 1.6 }}>
              {pendingFiles.length} panorama{pendingFiles.length === 1 ? '' : 's'} will become a connected scene sequence.
            </p>
            <label className="mb-2 block text-xs uppercase tracking-widest" htmlFor="tour-title" style={{ color: 'var(--text-dim)' }}>Tour name</label>
            <input id="tour-title" value={tourTitle} onChange={event => setTourTitle(event.target.value)} autoFocus
              className="mb-5 w-full rounded-lg px-4 py-3 outline-none"
              style={{ background: 'var(--panel-light)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setPendingFiles([])} className="rounded-lg px-4 py-2 text-xs uppercase tracking-widest"
                style={{ color: 'var(--text-dim)', border: '1px solid var(--border)' }}>Cancel</button>
              <button onClick={() => void handleImport()} disabled={isImporting || !tourTitle.trim()}
                className="rounded-lg px-5 py-2 text-xs uppercase tracking-widest"
                style={{ background: 'var(--gold)', color: 'var(--bg)', opacity: isImporting ? 0.6 : 1 }}>
                {isImporting ? 'Creating…' : 'Create tour'}
              </button>
            </div>
          </div>
        </div>
      )}

      {sceneEditorOpen && selectedTour && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,5,12,0.82)' }}>
          <div className="w-full max-w-lg rounded-xl p-6 shadow-2xl" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
            <div className="mb-1 text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--gold)' }}>Tour structure</div>
            <h2 className="mb-5 text-2xl" style={{ color: 'var(--text)', fontFamily: 'var(--font-content)' }}>Name each scene</h2>
            <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
              {selectedTour.scenes.map((scene, index) => (
                <label key={scene.id} className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ background: 'var(--panel-light)' }}>
                  <span className="w-6 text-[10px]" style={{ color: 'var(--text-dim)' }}>{String(index + 1).padStart(2, '0')}</span>
                  <input value={sceneDrafts[scene.id] ?? scene.name}
                    onChange={event => setSceneDrafts(current => ({ ...current, [scene.id]: event.target.value }))}
                    aria-label={`Scene ${index + 1} name`} className="min-w-0 flex-1 bg-transparent py-1 outline-none"
                    style={{ color: 'var(--text)' }} />
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setSceneEditorOpen(false)} className="rounded-lg px-4 py-2 text-xs uppercase tracking-widest"
                style={{ color: 'var(--text-dim)', border: '1px solid var(--border)' }}>Cancel</button>
              <button onClick={() => void saveSceneNames()} className="rounded-lg px-5 py-2 text-xs uppercase tracking-widest"
                style={{ background: 'var(--gold)', color: 'var(--bg)' }}>Save scene names</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
