'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Tour, AppMode, Position, Flashcard } from '@/types';

declare global {
  interface Window {
    pannellum: any;
  }
}

interface PannellumViewerProps {
  tour: Tour;
  mode: AppMode;
  selectedFlashcardId: string | null;
  onSelectFlashcard: (id: string | null) => void;
  onAddFlashcard: (position: Position) => void;
  onDeleteFlashcard: (id: string) => void;
}

export function PannellumViewer({
  tour,
  mode,
  selectedFlashcardId,
  onSelectFlashcard,
  onAddFlashcard,
  onDeleteFlashcard,
}: PannellumViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [currentPos, setCurrentPos] = useState({ yaw: 0, pitch: 0 });

  // Load Pannellum CSS and JS
  useEffect(() => {
    // Add CSS
    if (!document.querySelector('link[href*="pannellum"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css';
      document.head.appendChild(link);
    }

    // Add JS
    if (!window.pannellum) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js';
      script.onload = () => setIsReady(true);
      document.body.appendChild(script);
    } else {
      setIsReady(true);
    }
  }, []);

  // Store mode in ref for event handlers
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  const onAddFlashcardRef = useRef(onAddFlashcard);
  useEffect(() => { onAddFlashcardRef.current = onAddFlashcard; }, [onAddFlashcard]);

  // Initialize viewer when ready
  useEffect(() => {
    if (!isReady || !containerRef.current || !window.pannellum) return;

    // Destroy existing viewer
    if (viewerRef.current) {
      viewerRef.current.destroy();
    }

    // Create hotspots from flashcards
    const hotSpots = tour.flashcards.map(fc => ({
      id: fc.id,
      pitch: fc.position.pitch,
      yaw: fc.position.heading,
      type: 'info',
      text: fc.question,
      cssClass: fc.id === selectedFlashcardId ? 'flashcard-hotspot selected' : 'flashcard-hotspot',
      createTooltipFunc: (hotSpotDiv: HTMLElement) => {
        createFlashcardTooltip(hotSpotDiv, fc, fc.id === selectedFlashcardId);
      },
      clickHandlerFunc: () => {
        onSelectFlashcard(fc.id);
      },
    }));

    // Initialize Pannellum
    viewerRef.current = window.pannellum.viewer(containerRef.current, {
      type: 'equirectangular',
      panorama: tour.embedUrl,
      autoLoad: true,
      showControls: true,  // Show navigation controls
      mouseZoom: true,
      keyboardZoom: true,
      draggable: true,
      friction: 0.15,
      yaw: 0,
      pitch: 0,
      hfov: 100,
      minHfov: 50,
      maxHfov: 120,
      hotSpots: hotSpots,
      compass: false,
    });

    // Handle click to add flashcard at clicked position
    viewerRef.current.on('mousedown', (event: MouseEvent) => {
      if (modeRef.current !== 'edit') return;

      // Store mousedown position to detect if it's a click vs drag
      const startX = event.clientX;
      const startY = event.clientY;

      const handleMouseUp = (upEvent: MouseEvent) => {
        const dx = Math.abs(upEvent.clientX - startX);
        const dy = Math.abs(upEvent.clientY - startY);

        // If mouse didn't move much, treat as click
        if (dx < 5 && dy < 5) {
          // Get coordinates at click position
          const coords = viewerRef.current.mouseEventToCoords(upEvent);
          if (coords) {
            console.log('📍 Click at:', coords);
            onAddFlashcardRef.current({ heading: coords[1], pitch: coords[0] });
          }
        }

        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mouseup', handleMouseUp);
    });

    // Track position changes
    const updatePosition = () => {
      if (viewerRef.current) {
        setCurrentPos({
          yaw: viewerRef.current.getYaw(),
          pitch: viewerRef.current.getPitch(),
        });
      }
    };

    viewerRef.current.on('mouseup', updatePosition);
    viewerRef.current.on('touchend', updatePosition);

    // Update position periodically for smooth tracking
    const interval = setInterval(updatePosition, 100);

    return () => {
      clearInterval(interval);
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [isReady, tour.embedUrl, tour.id]);

  // Update hotspots when flashcards change
  useEffect(() => {
    if (!viewerRef.current || !isReady) return;

    // Remove all existing hotspots
    const existingHotspots = viewerRef.current.getConfig().hotSpots || [];
    existingHotspots.forEach((hs: any) => {
      try { viewerRef.current.removeHotSpot(hs.id); } catch (e) {}
    });

    // Add updated hotspots
    tour.flashcards.forEach(fc => {
      viewerRef.current.addHotSpot({
        id: fc.id,
        pitch: fc.position.pitch,
        yaw: fc.position.heading,
        cssClass: fc.id === selectedFlashcardId ? 'flashcard-hotspot selected' : 'flashcard-hotspot',
        createTooltipFunc: (hotSpotDiv: HTMLElement) => {
          createFlashcardTooltip(hotSpotDiv, fc, fc.id === selectedFlashcardId);
        },
        clickHandlerFunc: () => {
          onSelectFlashcard(fc.id);
        },
      });
    });
  }, [tour.flashcards, selectedFlashcardId, isReady, onSelectFlashcard]);

  // Create tooltip for flashcard
  const createFlashcardTooltip = useCallback((div: HTMLElement, fc: Flashcard, isSelected: boolean) => {
    div.classList.add('flashcard-tooltip');
    const showAnswer = isSelected && mode === 'view';
    div.innerHTML = `
      <div class="fc-card ${isSelected ? 'selected' : ''}" style="border-left-color: ${fc.color || '#3b82f6'}">
        <div class="fc-header">
          <span class="fc-badge" style="background: ${fc.color || '#3b82f6'}">${showAnswer ? '✓' : '?'}</span>
          <span class="fc-label" style="color: ${fc.color || '#3b82f6'}">${showAnswer ? 'Answer' : 'Question'}</span>
        </div>
        <p class="fc-content">${showAnswer ? fc.answer : fc.question}</p>
      </div>
    `;
  }, [mode]);

  return (
    <div className="relative w-full h-full bg-gray-900">
      {/* Pannellum container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Edit mode cursor indicator */}
      {mode === 'edit' && (
        <div className="absolute inset-0 pointer-events-none z-10" style={{ cursor: 'crosshair' }}>
          {/* Small center crosshair */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="w-6 h-6 border-2 border-yellow-400 rounded-full opacity-70" />
          </div>
        </div>
      )}

      {/* Mode indicator */}
      <div className={`absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full font-medium shadow-lg z-30 pointer-events-none ${
        mode === 'edit' ? 'bg-yellow-500 text-black' : 'bg-blue-600 text-white'
      }`}>
        {mode === 'edit' ? '📝 Click anywhere to add flashcard • Drag to look around' : '👁️ Drag to look around • Click cards to flip'}
      </div>

      {/* Position display */}
      <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-2 rounded-lg text-xs font-mono z-30">
        <div>Yaw: {currentPos.yaw.toFixed(1)}°</div>
        <div>Pitch: {currentPos.pitch.toFixed(1)}°</div>
      </div>

      {/* Card count */}
      <div className="absolute bottom-4 left-4 bg-black/70 text-white px-3 py-2 rounded-lg text-sm z-30">
        🃏 {tour.flashcards.length} card{tour.flashcards.length !== 1 ? 's' : ''}
      </div>

      {/* Tour name */}
      <div className="absolute bottom-4 right-4 bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm font-medium z-30">
        🌐 {tour.name}
      </div>

      {/* Styles for hotspots */}
      <style jsx global>{`
        .flashcard-hotspot {
          width: 30px !important;
          height: 30px !important;
          background: #3b82f6 !important;
          border-radius: 50% !important;
          border: 3px solid white !important;
          box-shadow: 0 2px 10px rgba(0,0,0,0.3) !important;
          cursor: pointer !important;
        }
        .flashcard-hotspot.selected {
          background: #22c55e !important;
          transform: scale(1.2);
        }
        .flashcard-tooltip {
          position: absolute;
          left: 20px;
          top: -10px;
          z-index: 100;
        }
        .fc-card {
          background: white;
          border-radius: 12px;
          padding: 12px;
          min-width: 180px;
          max-width: 220px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          border-left: 4px solid #3b82f6;
        }
        .fc-card.selected {
          transform: scale(1.05);
        }
        .fc-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .fc-badge {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 12px;
          font-weight: bold;
        }
        .fc-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .fc-content {
          font-size: 14px;
          color: #1f2937;
          margin: 0;
        }
        .pnlm-hotspot-base {
          cursor: pointer !important;
        }
      `}</style>
    </div>
  );
}

