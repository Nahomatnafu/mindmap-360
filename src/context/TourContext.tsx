'use client';

import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { Tour, Flashcard, AppMode, generateId, SAMPLE_TOURS } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface TourContextType {
  tours: Tour[];
  activeTour: Tour | null;
  mode: AppMode;
  selectedFlashcard: Flashcard | null;
  // Tour operations
  addTour: (tour: Omit<Tour, 'id' | 'createdAt' | 'updatedAt'>) => Tour;
  updateTour: (id: string, updates: Partial<Tour>) => void;
  deleteTour: (id: string) => void;
  setActiveTour: (id: string | null) => void;
  // Flashcard operations
  addFlashcard: (tourId: string, flashcard: Omit<Flashcard, 'id' | 'createdAt'>) => Flashcard;
  updateFlashcard: (tourId: string, flashcardId: string, updates: Partial<Flashcard>) => void;
  deleteFlashcard: (tourId: string, flashcardId: string) => void;
  selectFlashcard: (id: string | null) => void;
  // Mode
  setMode: (mode: AppMode) => void;
  // Initialize sample tours
  initializeSampleTours: () => void;
}

const TourContext = createContext<TourContextType | null>(null);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [tours, setTours] = useLocalStorage<Tour[]>('mindmap360-tours', []);
  const [activeTourId, setActiveTourId] = useState<string | null>(null);
  const [mode, setMode] = useState<AppMode>('view');
  const [selectedFlashcardId, setSelectedFlashcardId] = useState<string | null>(null);

  const activeTour = tours.find(t => t.id === activeTourId) || null;
  const selectedFlashcard = activeTour?.flashcards.find(f => f.id === selectedFlashcardId) || null;

  const addTour = useCallback((tourData: Omit<Tour, 'id' | 'createdAt' | 'updatedAt'>): Tour => {
    const newTour: Tour = {
      ...tourData,
      id: generateId(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setTours(prev => [...prev, newTour]);
    return newTour;
  }, [setTours]);

  const updateTour = useCallback((id: string, updates: Partial<Tour>) => {
    setTours(prev => prev.map(tour => 
      tour.id === id ? { ...tour, ...updates, updatedAt: Date.now() } : tour
    ));
  }, [setTours]);

  const deleteTour = useCallback((id: string) => {
    setTours(prev => prev.filter(tour => tour.id !== id));
    if (activeTourId === id) setActiveTourId(null);
  }, [setTours, activeTourId]);

  const addFlashcard = useCallback((tourId: string, flashcardData: Omit<Flashcard, 'id' | 'createdAt'>): Flashcard => {
    const newFlashcard: Flashcard = {
      ...flashcardData,
      id: generateId(),
      createdAt: Date.now(),
    };
    setTours(prev => prev.map(tour =>
      tour.id === tourId
        ? { ...tour, flashcards: [...tour.flashcards, newFlashcard], updatedAt: Date.now() }
        : tour
    ));
    return newFlashcard;
  }, [setTours]);

  const updateFlashcard = useCallback((tourId: string, flashcardId: string, updates: Partial<Flashcard>) => {
    setTours(prev => prev.map(tour =>
      tour.id === tourId
        ? {
            ...tour,
            flashcards: tour.flashcards.map(fc =>
              fc.id === flashcardId ? { ...fc, ...updates } : fc
            ),
            updatedAt: Date.now(),
          }
        : tour
    ));
  }, [setTours]);

  const deleteFlashcard = useCallback((tourId: string, flashcardId: string) => {
    setTours(prev => prev.map(tour =>
      tour.id === tourId
        ? { ...tour, flashcards: tour.flashcards.filter(fc => fc.id !== flashcardId), updatedAt: Date.now() }
        : tour
    ));
    if (selectedFlashcardId === flashcardId) setSelectedFlashcardId(null);
  }, [setTours, selectedFlashcardId]);

  const initializeSampleTours = useCallback(() => {
    // Initialize with sample tours if empty
    if (tours.length === 0) {
      const newTours = SAMPLE_TOURS.map(tour => ({
        ...tour,
        id: generateId(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
      setTours(newTours);
    }
  }, [tours.length, setTours]);

  return (
    <TourContext.Provider value={{
      tours,
      activeTour,
      mode,
      selectedFlashcard,
      addTour,
      updateTour,
      deleteTour,
      setActiveTour: setActiveTourId,
      addFlashcard,
      updateFlashcard,
      deleteFlashcard,
      selectFlashcard: setSelectedFlashcardId,
      setMode,
      initializeSampleTours,
    }}>
      {children}
    </TourContext.Provider>
  );
}

export function useTourContext() {
  const context = useContext(TourContext);
  if (!context) throw new Error('useTourContext must be used within TourProvider');
  return context;
}

