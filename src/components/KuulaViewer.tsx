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
      setZoom: (frameId: string, value: number) => void;
      setAutoRotate: (frameId: string, value: number | false) => void;
    };
  }
}

/* ─── 3-D spherical projection helpers (ported from memory-palace.html) ── */
const DEG = Math.PI / 180;

function getHFovRad(zoom: number): number {
  // zoom: -1 (narrow) → +1 (wide). Maps to roughly 47°–103° horizontal FOV.
  return Math.max(40, Math.min(130, 75 + zoom * 28)) * DEG;
}

function projectToScreen(
  aH: number, aP: number,
  ori: { heading: number; pitch: number; zoom: number },
  W: number, H: number,
): { x: number; y: number; visible: boolean } {
  const f = (W / 2) / Math.tan(getHFovRad(ori.zoom) / 2);

  // Anchor → world-space unit vector
  const aH_r = aH * DEG, aP_r = aP * DEG;
  const px = Math.cos(aP_r) * Math.sin(aH_r);
  const py = Math.sin(aP_r);
  const pz = Math.cos(aP_r) * Math.cos(aH_r);

  // Rotate into camera space: first by -heading (Y axis), then by -pitch (X axis)
  const cH = ori.heading * DEG, cP = ori.pitch * DEG;
  const cosH = Math.cos(cH), sinH = Math.sin(cH);
  const rx = px * cosH - pz * sinH;
  const ry = py;
  const rz = px * sinH + pz * cosH;

  const cosP = Math.cos(cP), sinP = Math.sin(cP);
  const ex = rx;
  const ey =  ry * cosP + rz * sinP;
  const ez = -ry * sinP + rz * cosP;

  if (ez <= 0.001) return { x: -9999, y: -9999, visible: false };

  const sx = W / 2 + f * (ex / ez);
  const sy = H / 2 - f * (ey / ez);
  const m = 60;
  return { x: sx, y: sy, visible: sx > -m && sx < W + m && sy > -m && sy < H + m };
}

function screenToWorld(
  clickX: number, clickY: number,
  ori: { heading: number; pitch: number; zoom: number },
  W: number, H: number,
): { heading: number; pitch: number } {
  const f = (W / 2) / Math.tan(getHFovRad(ori.zoom) / 2);
  // Screen pixel → camera-space ray
  const cx = clickX - W / 2;
  const cy = -(clickY - H / 2);
  const len = Math.sqrt(cx * cx + cy * cy + f * f);
  const ex = cx / len, ey = cy / len, ez = f / len;

  // Inverse rotation: undo pitch then heading
  const cH = ori.heading * DEG, cP = ori.pitch * DEG;
  const cosP = Math.cos(cP), sinP = Math.sin(cP);
  const rx = ex;
  const ry = ey * cosP - ez * sinP;
  const rz = ey * sinP + ez * cosP;

  const cosH = Math.cos(cH), sinH = Math.sin(cH);
  const wx =  rx * cosH + rz * sinH;
  const wy =  ry;
  const wz = -rx * sinH + rz * cosH;

  const pitch = Math.asin(Math.max(-1, Math.min(1, wy))) / DEG;
  const heading = (((Math.atan2(wx, wz) / DEG) % 360) + 360) % 360;
  return { heading, pitch };
}

export function KuulaViewer({
  tour,
  mode,
  selectedFlashcardId,
  onSelectFlashcard,
  onAddFlashcard,
  onDeleteFlashcard,
}: KuulaViewerProps) {
  const wrapRef   = useRef<HTMLDivElement>(null);
  const [frameId, setFrameId]       = useState<string | null>(null);
  const [currentRoom, setCurrentRoom] = useState<string>('');
  const [orientation, setOrientation] = useState({ heading: 0, pitch: 0, zoom: 0 });
  const [isApiReady, setIsApiReady]  = useState(false);
  const [pinMode, setPinMode]        = useState(false);
  const orientationRef = useRef(orientation);
  const modeRef        = useRef(mode);

  useEffect(() => { orientationRef.current = orientation; }, [orientation]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // Load Kuula API script
  useEffect(() => {
    if (document.querySelector('script[src*="kuula.io/api.js"]')) {
      if (window.KuulaPlayerAPI) setIsApiReady(true);
      else {
        // Script tag exists but may not have fired onload yet — poll briefly
        const interval = setInterval(() => {
          if (window.KuulaPlayerAPI) { setIsApiReady(true); clearInterval(interval); }
        }, 100);
        return () => clearInterval(interval);
      }
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

    // Frame loaded — save frame ID and log available posts/rooms
    const handleFrameLoaded = (e: any) => {
      console.log('✅ Kuula frame loaded, ID:', e.frame);
      console.log('📋 Posts in tour:', e.data.posts);
      setFrameId(e.frame);
    };

    // A new room/post was navigated to
    const handlePostLoaded = (e: any) => {
      console.log('🚶 Room loaded:', e.data.title, e.data);
      setCurrentRoom(e.data.title || '');
    };

    // A Kuula hotspot was clicked — look up flashcard by hotspot name
    const handleHotspot = (e: any) => {
      const hotspotName: string = e.data.name || '';
      console.log('🎯 Kuula hotspot clicked:', hotspotName, e.data);

      if (!hotspotName) return;

      // Find a flashcard whose question matches the hotspot name (as a key)
      // Convention: name hotspots in Kuula editor to match flashcard questions
      const matched = tour.flashcards.find(
        fc => fc.question.toLowerCase() === hotspotName.toLowerCase()
      );
      if (matched) {
        console.log('✅ Matched flashcard:', matched.question);
        onSelectFlashcard(matched.id);
      } else {
        console.log('ℹ️ No flashcard matched hotspot name:', hotspotName);
      }
    };

    // Orientation fires every ~100ms — use for overlay positioning
    const handleOrientation = (e: any) => {
      setOrientation({
        heading: e.data.heading,
        pitch: e.data.pitch,
        zoom: e.data.zoom,
      });
    };

    window.KuulaPlayerAPI.addEventListener('frameloaded', handleFrameLoaded);
    window.KuulaPlayerAPI.addEventListener('postloaded', handlePostLoaded);
    window.KuulaPlayerAPI.addEventListener('hotspot', handleHotspot);
    window.KuulaPlayerAPI.addEventListener('orientation', handleOrientation);

    return () => {
      window.KuulaPlayerAPI.removeEventListener('frameloaded', handleFrameLoaded);
      window.KuulaPlayerAPI.removeEventListener('postloaded', handlePostLoaded);
      window.KuulaPlayerAPI.removeEventListener('hotspot', handleHotspot);
      window.KuulaPlayerAPI.removeEventListener('orientation', handleOrientation);
    };
  }, [isApiReady, tour.flashcards, onSelectFlashcard]);

  // Pin mode click → inverse-project pixel to world heading/pitch
  const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!pinMode || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const pos = screenToWorld(
      e.clientX - rect.left, e.clientY - rect.top,
      orientationRef.current,
      rect.width, rect.height,
    );
    setPinMode(false);
    onAddFlashcard(pos);
  }, [pinMode, onAddFlashcard]);

  // Project each flashcard's anchor to screen pixel coords
  const getMarkerPos = useCallback((flashcard: Flashcard) => {
    if (!wrapRef.current) return null;
    const { offsetWidth: W, offsetHeight: H } = wrapRef.current;
    return projectToScreen(flashcard.position.heading, flashcard.position.pitch, orientation, W, H);
  }, [orientation]);

  const embedUrl = tour.embedUrl;

  return (
    <div ref={wrapRef} className="relative w-full h-full overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* Kuula iframe */}
      <iframe src={embedUrl} className="absolute inset-0 w-full h-full border-0"
        allow="accelerometer; autoplay; gyroscope; xr-spatial-tracking; fullscreen"
        allowFullScreen title={tour.name} />

      {/* Pin-mode click overlay — only captures pointer when active */}
      <div className="absolute inset-0 z-10"
        style={{ cursor: pinMode ? 'crosshair' : 'default', pointerEvents: pinMode ? 'all' : 'none' }}
        onClick={handleOverlayClick} />

      {/* Pin-mode banner */}
      {pinMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-5 py-2 rounded text-xs uppercase tracking-widest pointer-events-none"
          style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid var(--gold)', color: 'var(--gold-bright)', fontFamily: 'var(--font-ui)' }}>
          Click anywhere to place a marker
        </div>
      )}

      {/* Flashcard markers — gold dots with pulse rings, pixel-accurate */}
      <div className="absolute inset-0 pointer-events-none z-20">
        {tour.flashcards.map(flashcard => {
          const pos = getMarkerPos(flashcard);
          if (!pos || !pos.visible) return null;
          const isSelected = flashcard.id === selectedFlashcardId;
          return (
            <div key={flashcard.id} className="absolute pointer-events-auto"
              style={{ left: pos.x, top: pos.y }}>
              {/* Pulse rings */}
              <div className="marker-ring" />
              <div className="marker-ring" />
              {/* Gold dot */}
              <div className={`marker-dot${isSelected ? ' selected' : ''}`}
                onClick={() => onSelectFlashcard(flashcard.id)} />
              {/* Card popup on select */}
              {isSelected && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-52 rounded shadow-2xl z-30"
                  style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
                  <div className="px-4 pt-3 pb-1" style={{ borderBottom: '1px solid var(--border)' }}>
                    <div className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--gold)', fontFamily: 'var(--font-ui)' }}>
                      {mode === 'view' ? 'Answer' : 'Question'}
                    </div>
                    <p style={{ fontFamily: 'var(--font-content)', fontSize: 14, color: 'var(--text)', lineHeight: 1.6 }}>
                      {mode === 'view' ? flashcard.answer : flashcard.question}
                    </p>
                  </div>
                  <div className="flex gap-1 p-2">
                    <button onClick={() => onSelectFlashcard(null)}
                      className="flex-1 py-1 rounded text-xs transition-colors"
                      style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>
                      Close
                    </button>
                    {mode === 'edit' && (
                      <button onClick={() => onDeleteFlashcard(flashcard.id)}
                        className="py-1 px-2 rounded text-xs transition-colors"
                        style={{ background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit mode: Pin Note button */}
      {mode === 'edit' && (
        <button onClick={() => setPinMode(p => !p)}
          className="absolute z-30 px-4 py-2 rounded text-xs uppercase tracking-widest transition-colors"
          style={{
            bottom: 20, left: '50%', transform: 'translateX(-50%)',
            background: pinMode ? 'var(--gold)' : 'var(--gold-dim)',
            border: '1px solid var(--gold)',
            color: pinMode ? 'var(--bg)' : 'var(--gold-bright)',
            fontFamily: 'var(--font-ui)', cursor: 'pointer',
          }}>
          {pinMode ? '✕ Cancel' : '⊕ Pin Note'}
        </button>
      )}

      {/* HUD: room name + orientation */}
      <div className="absolute top-3 right-3 z-30 pointer-events-none text-right"
        style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.8 }}>
        {currentRoom && <div style={{ color: 'var(--text)' }}>{currentRoom}</div>}
        <div>{orientation.heading.toFixed(1)}° · {orientation.pitch.toFixed(1)}°</div>
      </div>
    </div>
  );
}

