'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Tour, AppMode, Position, Flashcard, TOUR_SCENES } from '@/types';

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
  const [currentScene, setCurrentScene] = useState(TOUR_SCENES.defaultScene);

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

    // Build scenes with navigation hotspots
    const scenes: any = {};

    TOUR_SCENES.scenes.forEach(scene => {
      const hotSpots: any[] = [];

      // Add navigation hotspots to other rooms - make them very visible
      TOUR_SCENES.navHotspots
        .filter(nav => nav.fromScene === scene.id)
        .forEach(nav => {
          hotSpots.push({
            id: nav.id,
            pitch: nav.position.pitch,
            yaw: nav.position.heading,
            type: 'scene',
            sceneId: nav.toScene,
            text: nav.label || 'Go',
          });
        });

      scenes[scene.id] = {
        type: 'equirectangular',
        panorama: scene.image,
        hotSpots: hotSpots,
        autoLoad: true,
      };
    });

    console.log('🏠 Initializing tour with scenes:', Object.keys(scenes));
    console.log('🔗 Navigation hotspots:', TOUR_SCENES.navHotspots);

    // Initialize Pannellum with multi-scene tour
    viewerRef.current = window.pannellum.viewer(containerRef.current, {
      default: {
        firstScene: 'room1',
        autoLoad: true,
        showControls: true,
        mouseZoom: true,
        keyboardZoom: true,
        draggable: true,
        friction: 0.15,
        hfov: 100,
        minHfov: 50,
        maxHfov: 120,
        compass: false,
        sceneFadeDuration: 1000,
        hotSpotDebug: true, // Show hotspot positions for debugging
      },
      scenes: scenes,
    });

    // Track scene changes
    viewerRef.current.on('scenechange', (sceneId: string) => {
      console.log('🚶 Moved to scene:', sceneId);
      setCurrentScene(sceneId);
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
  }, [isReady, tour.id]);

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

      {/* Current scene indicator */}
      <div className="absolute bottom-4 left-4 bg-black/70 text-white px-3 py-2 rounded-lg text-sm z-30">
        <div className="font-medium">📍 {TOUR_SCENES.scenes.find(s => s.id === currentScene)?.name || currentScene}</div>
        <div className="text-xs text-gray-400 mt-1">🃏 {tour.flashcards.length} cards total</div>
      </div>

      {/* Scene selector */}
      <div className="absolute bottom-4 right-4 flex gap-2 z-30">
        {TOUR_SCENES.scenes.map(scene => (
          <button
            key={scene.id}
            onClick={() => {
              if (viewerRef.current) {
                viewerRef.current.loadScene(scene.id);
              }
            }}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              currentScene === scene.id
                ? 'bg-emerald-600 text-white'
                : 'bg-black/70 text-white hover:bg-black/90'
            }`}
          >
            {scene.name}
          </button>
        ))}
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

        /* Navigation hotspots - floor markers to walk between rooms */
        .nav-hotspot {
          width: 50px !important;
          height: 50px !important;
          background: rgba(255, 255, 255, 0.9) !important;
          border-radius: 50% !important;
          border: 4px solid #10b981 !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.4) !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
        }
        .nav-hotspot:hover {
          transform: scale(1.2) !important;
          background: #10b981 !important;
        }
        .nav-hotspot::before {
          content: '🚶';
          font-size: 24px;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }
        .nav-hotspot span {
          position: absolute;
          bottom: -25px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0,0,0,0.8);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          white-space: nowrap;
        }

        /* Pannellum scene transition */
        .pnlm-render-container {
          transition: opacity 0.3s ease;
        }
      `}</style>
    </div>
  );
}

