'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Tour, AppMode, Position, Flashcard } from '@/types';

interface KuulaViewerProps {
  tour: Tour;
  mode: AppMode;
  selectedFlashcardId: string | null;
  onSelectFlashcard: (id: string | null) => void;
  onAddFlashcard: (position: Position) => void;
  onDeleteFlashcard: (id: string) => void;
}

declare global {
  interface Window {
    KuulaPlayerAPI: {
      addEventListener: (event: string, callback: (e: any) => void) => void;
      removeEventListener: (event: string, callback: (e: any) => void) => void;
      load: (frameId: string, postId: string) => void;
      setHeading: (frameId: string, value: number) => void;
      setPitch: (frameId: string, value: number) => void;
    };
  }
}

export function KuulaViewer({
  tour,
  mode,
  selectedFlashcardId,
  onSelectFlashcard,
  onAddFlashcard,
  onDeleteFlashcard,
}: KuulaViewerProps) {
  const [frameId, setFrameId] = useState<string | null>(null);
  const [orientation, setOrientation] = useState({ heading: 0, pitch: 0, zoom: 0 });
  const [isApiReady, setIsApiReady] = useState(false);
  const orientationRef = useRef(orientation);
  
  // Keep ref updated
  useEffect(() => { orientationRef.current = orientation; }, [orientation]);

  // Load Kuula API script
  useEffect(() => {
    if (document.querySelector('script[src*="kuula.io/api.js"]')) {
      setIsApiReady(true);
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://static.kuula.io/api.js';
    script.async = true;
    script.onload = () => setIsApiReady(true);
    document.head.appendChild(script);
  }, []);

  // Setup Kuula API event listeners
  useEffect(() => {
    if (!isApiReady || !window.KuulaPlayerAPI) return;

    const handleFrameLoaded = (e: any) => {
      console.log('Kuula frame loaded:', e.frame);
      setFrameId(e.frame);
    };

    const handleOrientation = (e: any) => {
      setOrientation({
        heading: e.data.heading,
        pitch: e.data.pitch,
        zoom: e.data.zoom,
      });
    };

    window.KuulaPlayerAPI.addEventListener('frameloaded', handleFrameLoaded);
    window.KuulaPlayerAPI.addEventListener('orientation', handleOrientation);

    return () => {
      window.KuulaPlayerAPI.removeEventListener('frameloaded', handleFrameLoaded);
      window.KuulaPlayerAPI.removeEventListener('orientation', handleOrientation);
    };
  }, [isApiReady]);

  // Handle adding flashcard at current position
  const handleAddFlashcard = useCallback(() => {
    if (mode !== 'edit') return;
    onAddFlashcard({
      heading: orientationRef.current.heading,
      pitch: orientationRef.current.pitch,
    });
  }, [mode, onAddFlashcard]);

  // Normalize heading difference to -180 to 180 range
  const normalizeHeading = (diff: number) => {
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    return diff;
  };

  // Calculate FOV based on zoom level
  // Kuula zoom: -1 (zoomed in) to 1 (zoomed out)
  // Base FOV at zoom=0, adjusted by zoom level
  const getEffectiveFOV = useCallback(() => {
    const baseH = 90;  // Base horizontal FOV
    const baseV = 70;  // Base vertical FOV
    // Zoom adjusts FOV: zoomed in = smaller FOV, zoomed out = larger FOV
    const zoomFactor = 1 + (orientation.zoom * 0.5); // -1 zoom = 0.5x, +1 zoom = 1.5x
    return {
      h: baseH * zoomFactor,
      v: baseV * zoomFactor
    };
  }, [orientation.zoom]);

  // Check if a flashcard is visible based on current orientation
  const isFlashcardVisible = useCallback((flashcard: Flashcard) => {
    const fov = getEffectiveFOV();
    const headingDiff = normalizeHeading(flashcard.position.heading - orientation.heading);
    const pitchDiff = flashcard.position.pitch - orientation.pitch;

    // Visible if within half the FOV on each axis (with margin)
    const hVisible = Math.abs(headingDiff) < (fov.h / 2) + 10;
    const vVisible = Math.abs(pitchDiff) < (fov.v / 2) + 10;

    return hVisible && vVisible;
  }, [orientation, getEffectiveFOV]);

  // Calculate screen position for a flashcard using proper spherical projection
  const getScreenPosition = useCallback((flashcard: Flashcard) => {
    const fov = getEffectiveFOV();
    const headingDiff = normalizeHeading(flashcard.position.heading - orientation.heading);
    const pitchDiff = flashcard.position.pitch - orientation.pitch;

    // Convert angular difference to screen position using perspective projection
    const hFovRad = (fov.h / 2) * (Math.PI / 180);
    const vFovRad = (fov.v / 2) * (Math.PI / 180);

    const headingRad = headingDiff * (Math.PI / 180);
    const pitchRad = pitchDiff * (Math.PI / 180);

    // Project to screen coordinates
    const x = 50 + (Math.tan(headingRad) / Math.tan(hFovRad)) * 50;
    const y = 50 - (Math.tan(pitchRad) / Math.tan(vFovRad)) * 50;

    // Clamp to screen bounds
    return {
      x: Math.max(2, Math.min(98, x)),
      y: Math.max(2, Math.min(98, y))
    };
  }, [orientation, getEffectiveFOV]);

  const embedUrl = tour.embedUrl + '&chromeless=1';

  return (
    <div className="relative w-full h-full bg-gray-900 overflow-hidden">
      {/* Kuula iframe */}
      <iframe
        src={embedUrl}
        className="absolute inset-0 w-full h-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; xr-spatial-tracking; fullscreen"
        allowFullScreen
        title={tour.name}
      />

      {/* Flashcard markers - only visible ones */}
      <div className="absolute inset-0 pointer-events-none z-20">
        {tour.flashcards.filter(isFlashcardVisible).map(flashcard => {
          const pos = getScreenPosition(flashcard);
          const isSelected = flashcard.id === selectedFlashcardId;
          return (
            <div
              key={flashcard.id}
              className="absolute pointer-events-auto transition-all duration-150"
              style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)' }}
              onClick={() => onSelectFlashcard(flashcard.id)}
            >
              <div className={`bg-white rounded-xl shadow-2xl p-3 min-w-[160px] max-w-[200px] border-l-4 ${isSelected ? 'scale-110' : ''}`}
                   style={{ borderColor: flashcard.color || '#3b82f6' }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                       style={{ background: flashcard.color || '#3b82f6' }}>
                    {isSelected && mode === 'view' ? '✓' : '?'}
                  </div>
                  <span className="text-xs font-semibold uppercase" style={{ color: flashcard.color || '#3b82f6' }}>
                    {isSelected && mode === 'view' ? 'Answer' : 'Question'}
                  </span>
                  {mode === 'edit' && (
                    <button onClick={(e) => { e.stopPropagation(); onDeleteFlashcard(flashcard.id); }}
                            className="ml-auto w-5 h-5 rounded-full bg-red-100 text-red-500 text-xs hover:bg-red-200">✕</button>
                  )}
                </div>
                <p className="text-sm text-gray-800">
                  {isSelected && mode === 'view' ? flashcard.answer : flashcard.question}
                </p>
                {mode === 'view' && (
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    {isSelected ? 'Click to see question' : 'Click to reveal'}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add flashcard button in edit mode */}
      {mode === 'edit' && (
        <button
          onClick={handleAddFlashcard}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-4 px-6 rounded-full shadow-2xl text-lg transition-all hover:scale-110"
        >
          ➕ Add Flashcard Here
        </button>
      )}

      {/* Crosshair in edit mode */}
      {mode === 'edit' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20">
          <div className="w-20 h-20 border-4 border-yellow-400 rounded-full opacity-50" />
          <div className="absolute top-1/2 left-0 w-full h-1 bg-yellow-400 opacity-50" />
          <div className="absolute left-1/2 top-0 w-1 h-full bg-yellow-400 opacity-50" />
        </div>
      )}

      {/* Mode indicator */}
      <div className={`absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full font-medium shadow-lg z-30 ${
        mode === 'edit' ? 'bg-yellow-500 text-black' : 'bg-blue-600 text-white'
      }`}>
        {mode === 'edit' ? '📝 Look at object, click button to add card' : '👁️ Look around • Cards stick to objects!'}
      </div>

      {/* Orientation display with zoom info */}
      <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-2 rounded-lg text-xs font-mono z-30">
        <div>H: {orientation.heading.toFixed(1)}°</div>
        <div>P: {orientation.pitch.toFixed(1)}°</div>
        <div>Z: {orientation.zoom.toFixed(2)}</div>
      </div>

      {/* Card count */}
      <div className="absolute bottom-4 left-4 bg-black/70 text-white px-3 py-2 rounded-lg text-sm z-30">
        🃏 {tour.flashcards.length} card{tour.flashcards.length !== 1 ? 's' : ''}
        ({tour.flashcards.filter(isFlashcardVisible).length} visible)
      </div>

      {/* Tour name */}
      <div className="absolute bottom-4 right-4 bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm font-medium z-30">
        🌐 {tour.name}
      </div>
    </div>
  );
}

