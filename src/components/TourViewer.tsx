'use client';

import React from 'react';
import { Tour, AppMode, Position, Flashcard } from '@/types';
import { PannellumViewer } from './PannellumViewer';

interface TourViewerProps {
  tour: Tour;
  mode: AppMode;
  selectedFlashcardId: string | null;
  onSelectFlashcard: (id: string | null) => void;
  onAddFlashcard: (position: Position) => void;
  onDeleteFlashcard: (id: string) => void;
  onUpdateFlashcard?: (id: string, updates: Partial<Flashcard>) => void;
}

export function TourViewer({
  tour,
  mode,
  selectedFlashcardId,
  onSelectFlashcard,
  onAddFlashcard,
  onDeleteFlashcard,
}: TourViewerProps) {
  // Use PannellumViewer for 360° panorama tours with hotspot anchoring
  return (
    <PannellumViewer
      tour={tour}
      mode={mode}
      selectedFlashcardId={selectedFlashcardId}
      onSelectFlashcard={onSelectFlashcard}
      onAddFlashcard={onAddFlashcard}
      onDeleteFlashcard={onDeleteFlashcard}
    />
  );
}
