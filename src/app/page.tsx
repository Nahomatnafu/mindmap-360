'use client';

import { useState, useCallback } from 'react';
import { useTourContext } from '@/context/TourContext';
import { TourViewer } from '@/components/TourViewer';
import { TourSidebar } from '@/components/TourSidebar';
import { FlashcardEditor } from '@/components/FlashcardEditor';
import { Position } from '@/types';

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

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [pendingPosition, setPendingPosition] = useState<Position | null>(null);

  // Handle adding a new flashcard at a position
  const handleAddFlashcard = useCallback((position: Position) => {
    setPendingPosition(position);
    setEditorOpen(true);
  }, []);

  // Handle saving flashcard from editor
  const handleSaveFlashcard = useCallback((data: { question: string; answer: string; color?: string }) => {
    if (!activeTour) return;

    if (selectedFlashcard) {
      void updateFlashcard(activeTour.id, selectedFlashcard.id, data);
    } else if (pendingPosition) {
      void addFlashcard(activeTour.id, { ...data, position: pendingPosition });
    }

    setPendingPosition(null);
    selectFlashcard(null);
  }, [activeTour, selectedFlashcard, pendingPosition, addFlashcard, updateFlashcard, selectFlashcard]);

  // Handle selecting a flashcard
  const handleSelectFlashcard = useCallback((id: string | null) => {
    selectFlashcard(id);
    if (id && mode === 'edit') {
      setEditorOpen(true);
    }
  }, [selectFlashcard, mode]);

  // Handle deleting a flashcard
  const handleDeleteFlashcard = useCallback((id: string) => {
    if (!activeTour) return;
    void deleteFlashcard(activeTour.id, id);
  }, [activeTour, deleteFlashcard]);

  // Close editor
  const handleCloseEditor = useCallback(() => {
    setEditorOpen(false);
    setPendingPosition(null);
    selectFlashcard(null);
  }, [selectFlashcard]);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col" style={{ background: 'var(--bg)' }}>

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between shrink-0 px-6"
        style={{ height: 52, background: 'var(--panel)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-4">
          {/* Sidebar toggle */}
          <button onClick={() => setSidebarOpen(o => !o)}
            className="text-xs uppercase tracking-widest transition-colors px-2 py-1 rounded"
            style={{ color: sidebarOpen ? 'var(--gold)' : 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>
            {sidebarOpen ? '← Hide' : '☰ Spaces'}
          </button>
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
          {/* Active tour name */}
          <span style={{ color: 'var(--text-dim)', fontSize: 11, letterSpacing: '0.08em', fontFamily: 'var(--font-ui)' }}>
            {activeTour?.name ?? 'No space selected'}
          </span>
        </div>
        {/* Card count pill */}
        {activeTour && (
          <div className="text-xs px-3 py-1 rounded-full"
            style={{ background: 'rgba(201,168,76,0.12)', color: 'var(--gold)', border: '1px solid rgba(201,168,76,0.25)', fontFamily: 'var(--font-ui)', letterSpacing: '0.06em' }}>
            {activeTour.flashcards.length} marker{activeTour.flashcards.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="shrink-0 overflow-hidden transition-all duration-300"
          style={{ width: sidebarOpen ? 260 : 0 }}>
          <TourSidebar
            tours={tours}
            selectedTourId={activeTour?.id || null}
            mode={mode}
            onSelectTour={setActiveTour}
            onModeChange={setMode}
            selectedFlashcardId={selectedFlashcard?.id || null}
            onSelectFlashcard={handleSelectFlashcard}
          />
        </div>

        {/* Viewer */}
        <main className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-xs uppercase tracking-widest"
              style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-ui)' }}>
              Loading your palace…
            </div>
          ) : activeTour ? (
            <TourViewer
              tour={activeTour}
              mode={mode}
              selectedFlashcardId={selectedFlashcard?.id || null}
              onSelectFlashcard={handleSelectFlashcard}
              onAddFlashcard={handleAddFlashcard}
              onDeleteFlashcard={handleDeleteFlashcard}
              onUpdateFlashcard={(id, updates) => void updateFlashcard(activeTour.id, id, updates)}
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
        </main>
      </div>

      {error && (
        <div className="fixed left-1/2 top-16 z-50 flex -translate-x-1/2 items-center gap-3 rounded px-4 py-3 shadow-2xl"
          role="alert" style={{ background: 'var(--panel)', border: '1px solid var(--danger)', color: 'var(--text)' }}>
          <span>{error}</span>
          <button onClick={clearError} aria-label="Dismiss error" style={{ color: 'var(--danger)', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      <FlashcardEditor
        flashcard={selectedFlashcard || undefined}
        isOpen={editorOpen}
        onClose={handleCloseEditor}
        onSave={handleSaveFlashcard}
      />
    </div>
  );
}
