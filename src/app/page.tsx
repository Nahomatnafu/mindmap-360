'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTourContext } from '@/context/TourContext';
import { TourViewer } from '@/components/TourViewer';
import { TourSidebar } from '@/components/TourSidebar';
import { FlashcardEditor } from '@/components/FlashcardEditor';
import { Position, Flashcard, AppMode, MemoryDraft } from '@/types';

export default function Home() {
  const {
    tours,
    activeTour,
    mode,
    selectedFlashcard,
    isLoading,
    error,
    clearError,
    setActiveTour,
    setMode,
    selectFlashcard,
    addFlashcard,
    updateFlashcard,
    deleteFlashcard,
  } = useTourContext();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [pendingPosition, setPendingPosition] = useState<Position | null>(null);
  const [editingFlashcard, setEditingFlashcard] = useState<Flashcard | undefined>();
  const [placingNote, setPlacingNote] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

  const startAddingNote = () => {
    setMovingId(null);
    selectFlashcard(null);
    setEditingFlashcard(undefined);
    setPendingPosition(null);
    setNotice(null);
    setPlacingNote(true);
    setMode('edit');
    setSidebarOpen(false);
  };

  const changeMode = (nextMode: AppMode) => {
    setPlacingNote(false);
    selectFlashcard(null);
    setMode(nextMode);
  };

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || editorOpen) return;
      selectFlashcard(null);
      setPlacingNote(false);
      if (placingNote) setMode('view');
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [editorOpen, placingNote, selectFlashcard, setMode]);

  // Handle adding a new flashcard at a position
  const handleAddFlashcard = useCallback((position: Position) => {
    if (!placingNote || moving) return;
    if (movingId && activeTour) {
      setMoving(true);
      void updateFlashcard(activeTour.id, movingId, { position }).then(() => {
        setMovingId(null); setPlacingNote(false); setMode('view'); setNotice('Memory moved and saved on this device.');
      }).catch((failure: unknown) => setActionError(failure instanceof Error ? failure.message : 'The memory could not be moved. Try again.'))
        .finally(() => setMoving(false));
      return;
    }
    selectFlashcard(null);
    setEditingFlashcard(undefined);
    setPendingPosition(position);
    setEditorOpen(true);
    setPlacingNote(false);
  }, [placingNote, selectFlashcard, moving, movingId, activeTour, updateFlashcard, setMode]);

  // Handle saving flashcard from editor
  const handleSaveFlashcard = useCallback(async (data: MemoryDraft) => {
    if (!activeTour) throw new Error('Select a tour before saving this note.');

    if (editingFlashcard) {
      await updateFlashcard(activeTour.id, editingFlashcard.id, data);
    } else if (pendingPosition) {
      await addFlashcard(activeTour.id, { ...data, position: pendingPosition });
    } else throw new Error('Choose a spot in the scene for your note.');

    setNotice('Memory saved on this device. Tap its picture or marker to read it.');
    setMode('view');
    setPendingPosition(null);
    selectFlashcard(null);
  }, [activeTour, editingFlashcard, pendingPosition, addFlashcard, updateFlashcard, selectFlashcard, setMode]);

  // Handle selecting a flashcard
  const handleSelectFlashcard = useCallback((id: string | null) => {
    selectFlashcard(id);
    if (id && mode === 'edit') {
      setEditingFlashcard(activeTour?.flashcards.find(card => card.id === id));
      setPendingPosition(null);
      setPlacingNote(false);
      setEditorOpen(true);
    }
  }, [selectFlashcard, mode, activeTour]);

  // Handle deleting a flashcard
  const handleDeleteFlashcard = useCallback((id: string) => {
    if (!activeTour) return;
    void deleteFlashcard(activeTour.id, id).catch((deleteError: unknown) => {
      setActionError(deleteError instanceof Error ? deleteError.message : 'The note could not be deleted.');
    });
  }, [activeTour, deleteFlashcard]);

  // Close editor
  const handleCloseEditor = useCallback(() => {
    setEditorOpen(false);
    setEditingFlashcard(undefined);
    setPendingPosition(null);
    setPlacingNote(false);
    setMode('view');
    selectFlashcard(null);
  }, [selectFlashcard, setMode]);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col" style={{ background: 'var(--bg)' }}>

      {/* ── Toolbar ── */}
      <div className="flex min-h-16 items-center justify-between gap-3 shrink-0 px-3 sm:px-6"
        style={{ background: 'var(--panel)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex min-w-0 items-center gap-3">
          {/* Sidebar toggle */}
          <button onClick={() => setSidebarOpen(o => !o)}
            aria-label={sidebarOpen ? 'Hide spaces sidebar' : 'Show spaces sidebar'} aria-expanded={sidebarOpen}
            className="text-xs uppercase tracking-widest transition-colors px-2 py-1 rounded"
            style={{ color: sidebarOpen ? 'var(--gold)' : 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>
            {sidebarOpen ? '← Hide' : '☰ Spaces'}
          </button>
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
          {/* Active tour name */}
          <span className="truncate" style={{ color: 'var(--text-dim)', fontSize: 11, letterSpacing: '0.08em', fontFamily: 'var(--font-ui)' }}>
            {activeTour?.name ?? 'No space selected'}
          </span>
        </div>
        {/* Card count pill */}
        {activeTour && (
          <div className="flex shrink-0 items-center gap-3">
          <span className="hidden text-xs sm:inline" style={{ color: 'var(--text-dim)' }}>{activeTour.flashcards.length} memories</span>
          <button type="button" onClick={startAddingNote} disabled={isLoading || editorOpen || !activeTour.scenes.length}
            className="min-h-11 rounded-full px-5 text-sm font-medium disabled:opacity-40"
            style={{ background: 'rgba(201,168,76,0.12)', color: 'var(--gold)', border: '1px solid rgba(201,168,76,0.25)', fontFamily: 'var(--font-ui)', letterSpacing: '0.06em' }}>
            + Add memory
          </button>
          </div>
        )}
      </div>

      {placingNote && <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm" role="status"
        style={{ background: 'var(--gold)', color: 'var(--bg)' }}>
        <span><strong>{moving ? 'Saving position…' : movingId ? 'Move your memory.' : 'Place your memory.'}</strong> Drag to look around, then tap the couch, wall, or object.</span>
        <button type="button" className="min-h-11 rounded-full border px-4" onClick={() => { setPlacingNote(false); setMode('view'); }}>Cancel</button>
      </div>}
      {notice && <div className="flex items-center justify-between gap-3 px-4 py-2 text-sm" role="status" style={{ background: 'var(--panel)', color: 'var(--text)' }}>
        <span>{notice}</span><button type="button" className="h-10 w-10" aria-label="Dismiss saved message" onClick={() => setNotice(null)}>✕</button>
      </div>}

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="shrink-0 overflow-hidden transition-all duration-300" inert={!sidebarOpen} aria-hidden={!sidebarOpen}
          style={{ width: sidebarOpen ? 260 : 0 }}>
          <TourSidebar
            tours={tours}
            selectedTourId={activeTour?.id || null}
            mode={mode}
            onSelectTour={id => { setActiveTour(id); setPlacingNote(false); selectFlashcard(null); setNotice(null); }}
            onModeChange={changeMode}
            selectedFlashcardId={selectedFlashcard?.id || null}
            onSelectFlashcard={handleSelectFlashcard}
          />
        </div>

        {/* Viewer */}
        <main className="relative min-w-0 flex-1 overflow-hidden">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-xs uppercase tracking-widest"
              style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-ui)' }}>
              Loading your palace…
            </div>
          ) : activeTour ? (
            <TourViewer
              tour={activeTour}
              mode={mode}
              placingNote={placingNote}
              selectedFlashcardId={selectedFlashcard?.id || null}
              onSelectFlashcard={handleSelectFlashcard}
              onAddFlashcard={handleAddFlashcard}
              onDeleteFlashcard={handleDeleteFlashcard}
              onUpdateFlashcard={(id, updates) => void updateFlashcard(activeTour.id, id, updates).catch((updateError: unknown) => {
                setActionError(updateError instanceof Error ? updateError.message : 'The note could not be updated.');
              })}
            />
          ) : (
            <div className="h-full flex items-center justify-center flex-col gap-3"
              style={{ color: 'var(--text-dim)' }}>
              <div style={{ fontFamily: 'var(--font-content)', fontSize: 32, color: 'var(--text)' }}>Build your first palace</div>
              <div className="max-w-md text-center" style={{ lineHeight: 1.7 }}>
                Import one or more 2:1 equirectangular photos. Each photo becomes a scene you can walk through and pin memories inside.
              </div>
            </div>
          )}
          {selectedFlashcard && mode === 'view' && !editorOpen && <section
            className="absolute bottom-24 left-3 right-3 z-40 max-h-[65%] overflow-y-auto rounded-2xl p-5 shadow-2xl sm:left-auto sm:right-5 sm:top-5 sm:bottom-auto sm:w-96"
            aria-label="Selected note" style={{ background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--border)' }}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="break-words text-xl font-medium">{selectedFlashcard.question}</h2>
              <button type="button" className="h-10 w-10 shrink-0 rounded-full" aria-label="Close note" onClick={() => selectFlashcard(null)}>✕</button>
            </div>
            {selectedFlashcard.imageUrl && <div className="mt-3 flex justify-center rounded-xl bg-white/5 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- local Blob URL */}
              <img src={selectedFlashcard.imageUrl} alt={selectedFlashcard.question} className="max-h-48 max-w-full object-contain" />
            </div>}
            <p className="mt-3 whitespace-pre-wrap break-words text-base leading-7">{selectedFlashcard.answer}</p>
            <div className="mt-5 flex items-center justify-between gap-3">
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Saved on this device</span>
              <button type="button" className="min-h-11 rounded-full border px-4 text-sm" style={{ borderColor: 'var(--border)' }}
                onClick={() => { setEditingFlashcard(selectedFlashcard); setPendingPosition(null); setEditorOpen(true); }}>Edit note</button>
            </div>
            <div className="mt-3 flex gap-3">
              <button className="min-h-11 rounded-full border px-4 text-sm" onClick={() => { setMovingId(selectedFlashcard.id); selectFlashcard(null); setPlacingNote(true); setMode('edit'); }}>Reposition</button>
              <button className="min-h-11 px-4 text-sm" style={{ color: 'var(--danger)' }} onClick={() => { if (window.confirm('Delete this memory and its image?')) handleDeleteFlashcard(selectedFlashcard.id); }}>Delete</button>
            </div>
          </section>}
        </main>
      </div>

      {(error || actionError) && (
        <div className="fixed left-1/2 top-16 z-50 flex -translate-x-1/2 items-center gap-3 rounded px-4 py-3 shadow-2xl"
          role="alert" style={{ background: 'var(--panel)', border: '1px solid var(--danger)', color: 'var(--text)' }}>
          <span>{error || actionError}</span>
          <button onClick={() => { clearError(); setActionError(null); }} aria-label="Dismiss error" style={{ color: 'var(--danger)', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      <FlashcardEditor
        flashcard={editingFlashcard}
        isOpen={editorOpen}
        onClose={handleCloseEditor}
        onSave={handleSaveFlashcard}
      />
    </div>
  );
}
