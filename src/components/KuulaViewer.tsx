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
  const containerRef = useRef<HTMLDivElement>(null);
  const [frameId, setFrameId] = useState<string | null>(null);
  const [orientation, setOrientation] = useState({ heading: 0, pitch: 0, zoom: 0 });
  const [isApiReady, setIsApiReady] = useState(false);
  const orientationRef = useRef(orientation);

  // Keep ref updated for use in callbacks
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
      console.log('✅ Kuula frame loaded:', e.frame);
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

  // Handle adding flashcard at EXACT current position
  const handleAddFlashcard = useCallback(() => {
    if (mode !== 'edit') return;

    // Store the EXACT heading and pitch from Kuula
    const pos = {
      heading: orientationRef.current.heading,
      pitch: orientationRef.current.pitch,
    };
    console.log('📍 Adding flashcard at:', pos);
    onAddFlashcard(pos);
  }, [mode, onAddFlashcard]);

  // Normalize angle to -180 to 180
  const normalizeAngle = (angle: number): number => {
    while (angle > 180) angle -= 360;
    while (angle < -180) angle += 360;
    return angle;
  };

  // Get screen position for a flashcard
  // This uses a direct linear mapping calibrated for Kuula's viewer
  const getFlashcardStyle = useCallback((flashcard: Flashcard): React.CSSProperties | null => {
    // Calculate angular difference from current view
    const dHeading = normalizeAngle(flashcard.position.heading - orientation.heading);
    const dPitch = flashcard.position.pitch - orientation.pitch;

    // Kuula's approximate visible range (calibrated values)
    // These define how many degrees are visible on screen
    const visibleH = 100 * (1 - orientation.zoom * 0.3); // ~100° horizontal at zoom 0
    const visibleV = 75 * (1 - orientation.zoom * 0.3);  // ~75° vertical at zoom 0

    // Check if within visible range
    if (Math.abs(dHeading) > visibleH / 2 || Math.abs(dPitch) > visibleV / 2) {
      return null; // Not visible
    }

    // Map angular position to screen percentage
    // Center of screen is 50%, edges are 0% and 100%
    const screenX = 50 + (dHeading / visibleH) * 100;
    const screenY = 50 - (dPitch / visibleV) * 100;

    return {
      position: 'absolute' as const,
      left: `${screenX}%`,
      top: `${screenY}%`,
      transform: 'translate(-50%, -50%)',
      transition: 'left 0.05s linear, top 0.05s linear', // Smooth movement
    };
  }, [orientation]);

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

      {/* Flashcard markers - rendered at their exact saved positions */}
      <div ref={containerRef} className="absolute inset-0 pointer-events-none z-20">
        {tour.flashcards.map(flashcard => {
          const style = getFlashcardStyle(flashcard);
          if (!style) return null; // Not visible

          const isSelected = flashcard.id === selectedFlashcardId;
          return (
            <div
              key={flashcard.id}
              className="pointer-events-auto"
              style={style}
              onClick={() => onSelectFlashcard(flashcard.id)}
            >
              <div className={`bg-white rounded-xl shadow-2xl p-3 min-w-40 max-w-[200px] border-l-4 cursor-pointer
                              ${isSelected ? 'scale-110 ring-2 ring-yellow-400' : 'hover:scale-105'}`}
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
                {/* Debug: show saved position */}
                <p className="text-[10px] text-gray-300 mt-1">
                  H:{flashcard.position.heading.toFixed(1)}° P:{flashcard.position.pitch.toFixed(1)}°
                </p>
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
      </div>

      {/* Tour name */}
      <div className="absolute bottom-4 right-4 bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm font-medium z-30">
        🌐 {tour.name}
      </div>
    </div>
  );
}

