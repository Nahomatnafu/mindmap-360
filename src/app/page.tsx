'use client';

import { useEffect, useState, useCallback } from 'react';
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
    setActiveTour,
    setMode,
    selectFlashcard,
    addFlashcard,
    updateFlashcard,
    deleteFlashcard,
    initializeSampleTours,
  } = useTourContext();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [pendingPosition, setPendingPosition] = useState<Position | null>(null);

  // Initialize sample tours on first load
  useEffect(() => {
    initializeSampleTours();
  }, [initializeSampleTours]);

  // Auto-select first tour if none selected
  useEffect(() => {
    if (!activeTour && tours.length > 0) {
      setActiveTour(tours[0].id);
    }
  }, [activeTour, tours, setActiveTour]);

  // Handle adding a new flashcard at a position
  const handleAddFlashcard = useCallback((position: Position) => {
    setPendingPosition(position);
    setEditorOpen(true);
  }, []);

  // Handle saving flashcard from editor
  const handleSaveFlashcard = useCallback((data: { question: string; answer: string; color?: string }) => {
    if (!activeTour) return;

    if (selectedFlashcard) {
      updateFlashcard(activeTour.id, selectedFlashcard.id, data);
    } else if (pendingPosition) {
      addFlashcard(activeTour.id, { ...data, position: pendingPosition });
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
    deleteFlashcard(activeTour.id, id);
  }, [activeTour, deleteFlashcard]);

  // Close editor
  const handleCloseEditor = useCallback(() => {
    setEditorOpen(false);
    setPendingPosition(null);
    selectFlashcard(null);
  }, [selectFlashcard]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-900">
      <TourSidebar
        tours={tours}
        activeTourId={activeTour?.id || null}
        mode={mode}
        onSelectTour={setActiveTour}
        onModeChange={setMode}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      <main className={`h-full transition-all duration-300 ${sidebarOpen ? 'lg:ml-80' : ''}`}>
        {activeTour ? (
          <TourViewer
            tour={activeTour}
            mode={mode}
            selectedFlashcardId={selectedFlashcard?.id || null}
            onSelectFlashcard={handleSelectFlashcard}
            onAddFlashcard={handleAddFlashcard}
            onDeleteFlashcard={handleDeleteFlashcard}
            onUpdateFlashcard={(id, updates) => updateFlashcard(activeTour.id, id, updates)}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-white">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Welcome to MindMap 360</h2>
              <p className="text-gray-400">Select a tour from the sidebar to get started</p>
            </div>
          </div>
        )}
      </main>

      <FlashcardEditor
        flashcard={selectedFlashcard || undefined}
        position={pendingPosition || undefined}
        isOpen={editorOpen}
        onClose={handleCloseEditor}
        onSave={handleSaveFlashcard}
      />
    </div>
  );
}
