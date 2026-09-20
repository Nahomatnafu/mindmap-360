'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { AppMode, Position, Tour } from '@/types';

interface PannellumHotspot {
  id: string;
  pitch: number;
  yaw: number;
  type: 'info' | 'scene';
  text: string;
  sceneId?: string;
  cssClass?: string;
  clickHandlerFunc?: () => void;
  createTooltipFunc?: (element: HTMLElement, args: { label: string; detail?: string }) => void;
  createTooltipArgs?: { label: string; detail?: string };
}

interface PannellumInstance {
  destroy: () => void;
  getPitch: () => number;
  getYaw: () => number;
  loadScene: (sceneId: string) => void;
  mouseEventToCoords: (event: MouseEvent) => [number, number];
  on: (event: string, callback: (...args: unknown[]) => void) => void;
}

interface PannellumLibrary {
  viewer: (element: HTMLElement, configuration: Record<string, unknown>) => PannellumInstance;
}

declare global {
  interface Window {
    pannellum?: PannellumLibrary;
  }
}

interface PannellumViewerProps {
  tour: Tour;
  mode: AppMode;
  selectedFlashcardId: string | null;
  onSelectFlashcard: (id: string | null) => void;
  onAddFlashcard: (position: Position) => void;
}

const createHotspotTooltip = (element: HTMLElement, args: { label: string; detail?: string }) => {
  const tooltip = document.createElement('span');
  tooltip.className = 'loci-hotspot-tooltip';
  const title = document.createElement('strong');
  title.textContent = args.label;
  tooltip.appendChild(title);
  if (args.detail) {
    const detail = document.createElement('small');
    detail.textContent = args.detail;
    tooltip.appendChild(detail);
  }
  element.appendChild(tooltip);
};

export function PannellumViewer({
  tour,
  mode,
  selectedFlashcardId,
  onSelectFlashcard,
  onAddFlashcard,
}: PannellumViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<PannellumInstance | null>(null);
  const [isReady, setIsReady] = useState(() => typeof window !== 'undefined' && Boolean(window.pannellum));
  const [currentPos, setCurrentPos] = useState({ yaw: 0, pitch: 0 });
  const [currentScene, setCurrentScene] = useState(() => tour.scenes[0]?.id ?? '');
  const [sceneTrayOpen, setSceneTrayOpen] = useState(false);
  const currentSceneRef = useRef(currentScene);
  const modeRef = useRef(mode);
  const addFlashcardRef = useRef(onAddFlashcard);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { addFlashcardRef.current = onAddFlashcard; }, [onAddFlashcard]);

  useEffect(() => {
    if (!document.querySelector('link[href*="pannellum"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.7/build/pannellum.css';
      document.head.appendChild(link);
    }
    if (window.pannellum) return;
    const existing = document.querySelector<HTMLScriptElement>('script[src*="pannellum"]');
    if (existing) {
      existing.addEventListener('load', () => setIsReady(true), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.7/build/pannellum.js';
    script.async = true;
    script.onload = () => setIsReady(true);
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!isReady || !containerRef.current || !window.pannellum || !tour.scenes.length) return;
    viewerRef.current?.destroy();

    const scenes = Object.fromEntries(tour.scenes.map((scene) => {
      const memoryHotspots: PannellumHotspot[] = tour.flashcards
        .filter((flashcard) => flashcard.position.sceneId === scene.id)
        .map((flashcard) => ({
          id: flashcard.id,
          pitch: flashcard.position.pitch,
          yaw: flashcard.position.heading,
          type: 'info',
          text: flashcard.id === selectedFlashcardId && mode === 'view' ? flashcard.answer : flashcard.question,
          cssClass: `memory-hotspot${flashcard.id === selectedFlashcardId ? ' selected' : ''}`,
          clickHandlerFunc: () => onSelectFlashcard(flashcard.id),
          createTooltipFunc: createHotspotTooltip,
          createTooltipArgs: {
            label: flashcard.question,
            detail: flashcard.id === selectedFlashcardId && mode === 'view' ? flashcard.answer : 'Open memory',
          },
        }));
      const movementHotspots: PannellumHotspot[] = tour.navHotspots
        .filter((hotspot) => hotspot.fromScene === scene.id)
        .map((hotspot) => ({
          id: hotspot.id,
          pitch: hotspot.position.pitch,
          yaw: hotspot.position.heading,
          type: 'scene',
          sceneId: hotspot.toScene,
          text: hotspot.label || 'Walk',
          cssClass: 'walk-hotspot',
          createTooltipFunc: createHotspotTooltip,
          createTooltipArgs: { label: hotspot.label || 'Continue', detail: 'Walk to next scene' },
        }));
      return [scene.id, {
        type: 'equirectangular',
        panorama: scene.image,
        yaw: scene.initialYaw,
        pitch: scene.initialPitch,
        hfov: scene.initialHfov,
        hotSpots: [...memoryHotspots, ...movementHotspots],
      }];
    }));
    const firstScene = tour.scenes.some((scene) => scene.id === currentSceneRef.current)
      ? currentSceneRef.current
      : tour.scenes[0].id;

    const viewer = window.pannellum.viewer(containerRef.current, {
      default: {
        firstScene,
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
        sceneFadeDuration: 600,
        hotSpotDebug: false,
      },
      scenes,
    });
    viewerRef.current = viewer;

    viewer.on('scenechange', (...args: unknown[]) => {
      const sceneId = String(args[0]);
      currentSceneRef.current = sceneId;
      setCurrentScene(sceneId);
    });
    viewer.on('mousedown', (...args: unknown[]) => {
      const event = args[0] as MouseEvent;
      if (modeRef.current !== 'edit') return;
      if ((event.target as Element | null)?.closest('.pnlm-hotspot-base')) return;
      const startX = event.clientX;
      const startY = event.clientY;
      const handleMouseUp = (upEvent: MouseEvent) => {
        const moved = Math.abs(upEvent.clientX - startX) >= 5 || Math.abs(upEvent.clientY - startY) >= 5;
        if (!moved) {
          const [pitch, heading] = viewer.mouseEventToCoords(upEvent);
          addFlashcardRef.current({ heading, pitch, sceneId: currentSceneRef.current || firstScene });
        }
        document.removeEventListener('mouseup', handleMouseUp);
      };
      document.addEventListener('mouseup', handleMouseUp);
    });

    const updatePosition = () => setCurrentPos({ yaw: viewer.getYaw(), pitch: viewer.getPitch() });
    viewer.on('mouseup', updatePosition);
    viewer.on('touchend', updatePosition);
    const interval = window.setInterval(updatePosition, 150);

    return () => {
      window.clearInterval(interval);
      viewer.destroy();
      if (viewerRef.current === viewer) viewerRef.current = null;
    };
  }, [isReady, mode, onSelectFlashcard, selectedFlashcardId, tour]);

  if (!tour.scenes.length) {
    return <div className="h-full flex items-center justify-center" style={{ color: 'var(--text-dim)' }}>No scenes yet.</div>;
  }

  const currentSceneIndex = Math.max(0, tour.scenes.findIndex((scene) => scene.id === currentScene));
  const loadSceneAt = (index: number) => {
    const scene = tour.scenes[index];
    if (!scene) return;
    viewerRef.current?.loadScene(scene.id);
    setSceneTrayOpen(false);
  };

  return (
    <div className="relative w-full h-full" style={{ background: 'var(--bg)' }}>
      <div ref={containerRef} className="w-full h-full" />

      {mode === 'edit' && (
        <div className="absolute inset-0 pointer-events-none z-10" style={{ cursor: 'crosshair' }}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="w-6 h-6 rounded-full opacity-70" style={{ border: '2px solid var(--gold)' }} />
          </div>
        </div>
      )}

      <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-xs z-30 pointer-events-none backdrop-blur-md"
        style={{ background: mode === 'edit' ? 'var(--gold)' : 'rgba(8,8,16,0.58)', color: mode === 'edit' ? 'var(--bg)' : 'var(--text)', border: '1px solid rgba(255,255,255,0.12)' }}>
        {mode === 'edit' ? 'Click a surface to place a memory' : 'Drag to look around · select a portal to move'}
      </div>

      {mode === 'edit' && (
        <div className="absolute top-4 right-4 px-3 py-2 rounded-lg text-[10px] z-30 backdrop-blur-md"
          style={{ background: 'rgba(8,8,16,0.62)', color: 'var(--text-dim)', fontFamily: 'var(--font-ui)', border: '1px solid rgba(255,255,255,0.1)' }}>
          {currentPos.yaw.toFixed(1)}° / {currentPos.pitch.toFixed(1)}°
        </div>
      )}

      <div className="absolute bottom-5 left-1/2 z-30 -translate-x-1/2">
        {sceneTrayOpen && (
          <div className="absolute bottom-[calc(100%+10px)] left-1/2 grid max-h-56 w-72 -translate-x-1/2 grid-cols-2 gap-1 overflow-y-auto rounded-2xl p-2 shadow-2xl backdrop-blur-xl"
            style={{ background: 'rgba(8,8,16,0.9)', border: '1px solid rgba(255,255,255,0.12)' }}>
            {tour.scenes.map((scene, index) => (
              <button key={scene.id} onClick={() => loadSceneAt(index)} className="rounded-xl px-3 py-2 text-left transition-colors"
                style={{ background: index === currentSceneIndex ? 'rgba(201,168,76,0.18)' : 'transparent', color: index === currentSceneIndex ? 'var(--gold-bright)' : 'var(--text)' }}>
                <span className="mr-2 text-[10px]" style={{ color: 'var(--text-dim)' }}>{String(index + 1).padStart(2, '0')}</span>
                <span className="text-xs">{scene.name}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1 rounded-2xl p-1.5 shadow-2xl backdrop-blur-xl"
          style={{ background: 'rgba(8,8,16,0.78)', border: '1px solid rgba(255,255,255,0.14)' }}>
          <button onClick={() => loadSceneAt(currentSceneIndex - 1)} disabled={currentSceneIndex === 0}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-xl transition-colors disabled:opacity-25"
            style={{ color: 'var(--text)' }} aria-label="Previous scene">‹</button>
          <button onClick={() => setSceneTrayOpen(open => !open)} className="min-w-44 rounded-xl px-4 py-2 text-left transition-colors"
            style={{ color: 'var(--text)' }} aria-expanded={sceneTrayOpen}>
            <span className="block text-[9px] uppercase tracking-[0.18em]" style={{ color: 'var(--gold)' }}>
              Scene {currentSceneIndex + 1} of {tour.scenes.length}
            </span>
            <span className="block truncate text-sm">{tour.scenes[currentSceneIndex]?.name}</span>
          </button>
          <button onClick={() => loadSceneAt(currentSceneIndex + 1)} disabled={currentSceneIndex === tour.scenes.length - 1}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-xl transition-colors disabled:opacity-25"
            style={{ color: 'var(--text)' }} aria-label="Next scene">›</button>
        </div>
      </div>

      <style jsx global>{`
        .memory-hotspot {
          width: 34px !important;
          height: 34px !important;
          background: rgba(12, 12, 24, 0.78) !important;
          border-radius: 50% !important;
          border: 1px solid var(--gold-bright) !important;
          box-shadow: 0 0 0 6px rgba(201, 168, 76, 0.12), 0 8px 28px rgba(0, 0, 0, 0.45) !important;
          cursor: pointer !important;
          transition: transform 160ms ease, box-shadow 160ms ease !important;
        }
        .memory-hotspot::before {
          content: '✦';
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          color: var(--gold-bright);
          font-size: 15px;
        }
        .memory-hotspot:hover, .memory-hotspot.selected {
          transform: scale(1.14);
          box-shadow: 0 0 0 9px rgba(201, 168, 76, 0.18), 0 10px 34px rgba(0, 0, 0, 0.55) !important;
        }
        .walk-hotspot {
          width: 48px !important;
          height: 48px !important;
          border-radius: 50% !important;
          background: rgba(8, 8, 16, 0.82) !important;
          border: 1px solid var(--gold-bright) !important;
          box-shadow: 0 0 0 7px rgba(201, 168, 76, 0.14), 0 12px 32px rgba(0, 0, 0, 0.42) !important;
          transition: transform 160ms ease, box-shadow 160ms ease !important;
          backdrop-filter: blur(12px);
        }
        .walk-hotspot::before {
          content: '↑';
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          color: var(--gold-bright);
          font-size: 22px;
          font-weight: 500;
        }
        .walk-hotspot:hover {
          transform: translateY(-3px) scale(1.08);
          box-shadow: 0 0 0 10px rgba(201, 168, 76, 0.2), 0 14px 38px rgba(0, 0, 0, 0.5) !important;
        }
        .loci-hotspot-tooltip {
          position: absolute;
          left: 50%;
          bottom: calc(100% + 12px);
          min-width: 150px;
          transform: translateX(-50%);
          border-radius: 12px;
          padding: 10px 12px;
          background: rgba(8, 8, 16, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.13);
          color: var(--text);
          text-align: left;
          opacity: 0;
          pointer-events: none;
          transition: opacity 140ms ease, transform 140ms ease;
          backdrop-filter: blur(14px);
          box-shadow: 0 12px 36px rgba(0,0,0,0.38);
        }
        .loci-hotspot-tooltip strong, .loci-hotspot-tooltip small { display: block; }
        .loci-hotspot-tooltip strong { font: 500 12px var(--font-ui); }
        .loci-hotspot-tooltip small { margin-top: 4px; color: var(--text-dim); font: 11px var(--font-ui); }
        .memory-hotspot:hover .loci-hotspot-tooltip,
        .walk-hotspot:hover .loci-hotspot-tooltip {
          opacity: 1;
          transform: translateX(-50%) translateY(-2px);
        }
        .walk-hotspot .loci-hotspot-tooltip {
          top: calc(100% + 12px);
          bottom: auto;
          min-width: max-content;
          padding: 7px 10px;
          opacity: 1;
        }
        .walk-hotspot .loci-hotspot-tooltip small { display: none; }
        .pnlm-hotspot-base { cursor: pointer !important; }
        .pnlm-render-container { transition: opacity 0.3s ease; }
      `}</style>
    </div>
  );
}
