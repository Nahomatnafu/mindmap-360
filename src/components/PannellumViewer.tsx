'use client';

import { useEffect, useRef, useState } from 'react';
import type { AppMode, Position, Tour, NavHotspot } from '@/types';
import { useTourContext } from '@/context/TourContext';
import { ConnectionEditor } from './ConnectionEditor';
import { MotionControls } from './MotionControls';
import { DEFAULT_IMAGE_SIZE, imageZoomScale } from '@/lib/viewer/imageScale';
import './panorama.css';

interface Engine {
  destroy(): void;
  resize(): void;
  getPitch(): number;
  getYaw(): number;
  getHfov(): number;
  getScene(): string;
  isLoaded(): boolean;
  setHfov(value: number, duration?: number): void;
  lookAt(pitch: number, yaw: number, hfov?: number, duration?: number): void;
  stopMovement(): void;
  toggleFullscreen(): void;
  loadScene(id: string, pitch?: number, yaw?: number, hfov?: number): void;
  mouseEventToCoords(event: { clientX: number; clientY: number }): [number, number];
  addHotSpot(config: Record<string, unknown>, sceneId: string): void;
  removeHotSpot(id: string, sceneId: string): void;
  on(event: string, callback: (...args: unknown[]) => void): void;
  off(event: string, callback: (...args: unknown[]) => void): void;
  startOrientation(): void;
  stopOrientation(): void;
  isOrientationSupported(): boolean;
  isOrientationActive(): boolean;
}
declare global { interface Window { pannellum?: { viewer(element: HTMLElement, config: Record<string, unknown>): Engine } } }

let enginePromise: Promise<void> | undefined;
function loadEngine() {
  if (!enginePromise) enginePromise = Promise.all([
    new Promise<void>((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = '/vendor/pannellum/pannellum.css';
      css.onload = () => resolve();
      css.onerror = () => { css.remove(); reject(new Error('Could not load the viewer styles. Reload to retry.')); };
      document.head.append(css);
    }),
    new Promise<void>((resolve, reject) => {
      if (window.pannellum) { resolve(); return; }
      const script = document.createElement('script'); script.src = '/vendor/pannellum/pannellum.js';
      script.onload = () => resolve();
      script.onerror = () => { script.remove(); reject(new Error('Could not load the panorama viewer. Reload to retry.')); };
      document.head.append(script);
    }),
  ]).then(() => undefined).catch(error => { enginePromise = undefined; throw error; });
  return enginePromise;
}

interface Props {
  tour: Tour;
  mode: AppMode;
  placingNote?: boolean;
  selectedFlashcardId: string | null;
  onSelectFlashcard(id: string | null): void;
  onAddFlashcard(position: Position): void;
}

export function PannellumViewer(props: Props) {
  const { tour, mode, placingNote = false, selectedFlashcardId } = props;
  const { updateConnection, setMode } = useTourContext();
  const element = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const callbacks = useRef(props);
  const [ready, setReady] = useState(0);
  const [sceneId, setSceneId] = useState(tour.scenes[0]?.id ?? '');
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState('');
  const [tray, setTray] = useState(false);
  const [editing, setEditing] = useState(false);
  const editingConnections = editing && mode === 'edit' && !placingNote;
  const [draft, setDraft] = useState<NavHotspot | null>(null);
  const rendered = useRef<{ id: string; scene: string }[]>([]);
  const camera = useRef<{ scene: string; yaw: number; pitch: number; hfov: number } | null>(null);
  useEffect(() => { callbacks.current = props; }, [props]);

  // Notes, mode switches, and marker edits never recreate WebGL or reset the camera.
  const sceneSources = JSON.stringify(tour.scenes.map(s => ({ id: s.id, image: s.image, thumbnail: s.thumbnail, initialYaw: s.initialYaw, initialPitch: s.initialPitch, initialHfov: s.initialHfov })));
  useEffect(() => {
    let cancelled = false;
    let viewer: Engine | null = null;
    let resizeObserver: ResizeObserver | undefined;
    const root = element.current;
    if (!root) return;
    let start: { x: number; y: number; id: number } | null = null;
    const pointerDown = (event: PointerEvent) => {
      if ((event.target as Element).closest('.loci-anchor, .pnlm-controls')) return;
      if (!event.isPrimary || event.button !== 0) return;
      start = { x: event.clientX, y: event.clientY, id: event.pointerId };
    };
    const pointerUp = (event: PointerEvent) => {
      const origin = start; start = null;
      if (!origin || event.pointerId !== origin.id || Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 6) return;
      if (!callbacks.current.placingNote || !viewer) return;
      const [pitch, heading] = viewer.mouseEventToCoords(event);
      callbacks.current.onAddFlashcard({ pitch, heading, sceneId: viewer.getScene() });
    };
    const pointerCancel = () => { start = null; };
    void loadEngine().then(() => {
      if (cancelled || !window.pannellum) return;
      const scenes: Tour['scenes'] = JSON.parse(sceneSources);
      const remembered = camera.current;
      const first = scenes.some(s => s.id === remembered?.scene) ? remembered!.scene : scenes[0].id;
      viewer = window.pannellum.viewer(root, {
        default: { firstScene: first, autoLoad: true, showControls: false, compass: false, ignoreGPanoXMP: true, minHfov: 45, maxHfov: 115, sceneFadeDuration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450 },
        scenes: Object.fromEntries(scenes.map(s => [s.id, { type: 'equirectangular', panorama: s.image, preview: s.thumbnail, yaw: remembered?.scene === s.id ? remembered.yaw : s.initialYaw, pitch: remembered?.scene === s.id ? remembered.pitch : s.initialPitch, hfov: remembered?.scene === s.id ? remembered.hfov : s.initialHfov, hotSpots: [] }])),
      });
      engine.current = viewer;
      const updateImageScale = () => root.style.setProperty('--memory-zoom', String(imageZoomScale(viewer!.getHfov())));
      updateImageScale();
      viewer.on('zoomchange', updateImageScale);
      viewer.on('load', updateImageScale);
      resizeObserver = new ResizeObserver(() => viewer?.resize());
      resizeObserver.observe(root);
      rendered.current = [];
      setSceneId(first); setLoading(true); setFailure('');
      viewer.on('scenechange', (...args) => { setSceneId(String(args[0])); setLoading(true); setFailure(''); });
      viewer.on('load', () => { setLoading(false); setReady(value => value + 1); });
      viewer.on('error', (...args) => { setLoading(false); setFailure(String(args[0] ?? 'Panorama could not load.')); });
      root.addEventListener('pointerdown', pointerDown);
      root.addEventListener('pointerup', pointerUp);
      root.addEventListener('pointercancel', pointerCancel);
    }).catch(error => { if (!cancelled) { setFailure(String(error)); setLoading(false); } });
    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      if (viewer) { camera.current = { scene: viewer.getScene(), yaw: viewer.getYaw(), pitch: viewer.getPitch(), hfov: viewer.getHfov() }; viewer.destroy(); }
      engine.current = null;
      root.removeEventListener('pointerdown', pointerDown); root.removeEventListener('pointerup', pointerUp); root.removeEventListener('pointercancel', pointerCancel);
    };
  }, [sceneSources]);

  useEffect(() => {
    const viewer = engine.current;
    // Pannellum addHotSpot creates a DOM node even before load; its initial load
    // then creates another. Reconcile only after load, including updates queued
    // while a new viewpoint was loading.
    if (!viewer || !ready || !viewer.isLoaded()) return;
    for (const old of rendered.current) viewer.removeHotSpot(old.id, old.scene);
    rendered.current = [];
    function marker(id: string, scene: string, yaw: number, pitch: number, label: string, kind: string, color: string, action: () => void, imageUrl?: string, size = DEFAULT_IMAGE_SIZE) {
      viewer!.addHotSpot({ id, yaw, pitch, cssClass: 'loci-anchor', createTooltipFunc: (anchor: HTMLElement) => {
        const button = document.createElement('button'); button.type = 'button'; button.className = `loci-marker ${kind}`;
        button.setAttribute('aria-label', label); button.title = label; button.style.setProperty('--marker-color', color);
        const ring = document.createElement('span'); ring.className = 'loci-ring'; ring.setAttribute('aria-hidden', 'true');
        const caption = document.createElement('span'); caption.className = 'loci-caption'; caption.textContent = label;
        if (imageUrl) {
          button.classList.add('image-memory');
          button.style.setProperty('--image-size', `${Math.max(16, Math.min(192, size))}px`);
          const image = document.createElement('img');
          image.src = imageUrl; image.alt = ''; image.draggable = false;
          image.addEventListener('error', () => { image.remove(); button.classList.remove('image-memory'); button.prepend(ring); });
          button.append(image, caption);
        } else button.append(ring, caption);
        for (const event of ['pointerdown', 'mousedown', 'touchstart', 'dblclick']) button.addEventListener(event, e => e.stopPropagation());
        button.addEventListener('click', event => { event.stopPropagation(); action(); });
        anchor.append(button);
      } }, scene);
      rendered.current.push({ id, scene });
    }
    for (const original of tour.navHotspots) {
      const link = draft?.id === original.id ? draft : original;
      marker(link.id, link.fromScene, link.position.heading, link.position.pitch, link.label || 'Walk here', link.surface === 'wall' ? 'wall' : 'floor', '#ffffff', () => {
        if (editingConnections) { setDraft(link); return; }
        callbacks.current.onSelectFlashcard(null);
        viewer.stopMovement();
        const target = tour.scenes.find(s => s.id === link.toScene);
        if (link.preserveView) viewer.loadScene(link.toScene, viewer.getPitch(), viewer.getYaw(), viewer.getHfov());
        else viewer.loadScene(link.toScene, target?.initialPitch, target?.initialYaw, target?.initialHfov);
      });
    }
    for (const note of tour.flashcards) if (note.position.sceneId) {
      marker(note.id, note.position.sceneId, note.position.heading, note.position.pitch, note.question, `note ${selectedFlashcardId === note.id ? 'selected' : ''}`, note.color || '#c9a84c', () => callbacks.current.onSelectFlashcard(note.id), note.imageUrl, note.size);
    }
  }, [ready, tour, draft, editingConnections, selectedFlashcardId]);

  useEffect(() => {
    const viewer = engine.current;
    const note = tour.flashcards.find(item => item.id === selectedFlashcardId);
    if (viewer && ready && note?.position.sceneId && viewer.getScene() !== note.position.sceneId) {
      viewer.stopMovement();
      viewer.loadScene(note.position.sceneId, note.position.pitch, note.position.heading, 95);
    }
  }, [ready, selectedFlashcardId, tour.flashcards]);

  const scene = tour.scenes.find(s => s.id === sceneId) ?? tour.scenes[0];
  const mainScenes = tour.scenes.filter(s => !s.alternate);
  const mainSceneId = scene?.alternate ? tour.navHotspots.find(h => h.fromScene === sceneId && h.preserveView)?.toScene : sceneId;
  const mainIndex = Math.max(0, mainScenes.findIndex(s => s.id === mainSceneId));
  function navigate(id: string) {
    if (loading) return;
    const target = tour.scenes.find(s => s.id === id);
    callbacks.current.onSelectFlashcard(null);
    engine.current?.stopMovement(); engine.current?.loadScene(id, target?.initialPitch, target?.initialYaw, target?.initialHfov);
    setTray(false); setDraft(null);
  }
  return <div className="loci-viewer">
    <div ref={element} className="loci-canvas" />
    <div className="viewer-topline"><span>{placingNote ? 'Tap an object to pin your note · drag to look around' : scene?.name}</span>
      {!placingNote && <button onClick={() => { setEditing(!editingConnections); setMode(editingConnections ? 'view' : 'edit'); setDraft(null); }}> {editingConnections ? 'Close connections' : 'Edit connections'}</button>}
    </div>
    {loading && <div role="status" className="viewer-loading">Loading viewpoint…</div>}
    {failure && <div role="alert" className="viewer-error">{failure}</div>}
    <MotionControls viewer={engine} ready={ready} paused={loading || placingNote || mode === 'edit' || Boolean(selectedFlashcardId)} pitch={scene?.initialPitch ?? 0} yaw={scene?.initialYaw ?? 0} />
    <div className="viewer-tools">
      <button aria-label="Zoom in" onClick={() => engine.current?.setHfov(Math.max(45, (engine.current?.getHfov() ?? 95) - 12), 180)}>+</button>
      <button aria-label="Zoom out" onClick={() => engine.current?.setHfov(Math.min(115, (engine.current?.getHfov() ?? 95) + 12), 180)}>−</button>
      <button aria-label="Fullscreen panorama" onClick={() => engine.current?.toggleFullscreen()}>⛶</button>
    </div>
    {editingConnections && <ConnectionEditor key={sceneId} scene={scene} links={tour.navHotspots.filter(h => h.fromScene === sceneId)} draft={draft}
      onDraft={value => { setDraft(value); engine.current?.lookAt(value.position.pitch, value.position.heading, undefined, 250); }}
      onSave={async value => { await updateConnection(tour.id, value.id, value.position.heading, value.position.pitch, value.surface || 'floor'); setDraft(null); }} />}
    <div className="scene-navigation">
      {tray && <div className="scene-tray">{tour.scenes.map(s => <button key={s.id} onClick={() => navigate(s.id)} disabled={loading} aria-current={s.id === sceneId ? 'true' : undefined}>
        {s.thumbnail && <span className="scene-thumbnail" style={{ backgroundImage: `url("${s.thumbnail}")` }} />}
        <span>{s.name}{s.alternate ? ' · alternate' : ''}</span>
      </button>)}</div>}
      <div className="scene-dock">
        <button aria-label="Previous scene" disabled={loading || mainIndex === 0} onClick={() => navigate(mainScenes[mainIndex - 1].id)}>‹</button>
        <button aria-expanded={tray} onClick={() => setTray(value => !value)}><small>{scene?.alternate ? 'Alternate view' : `${mainIndex + 1} / ${mainScenes.length} viewpoints`}</small><strong>{scene?.name}</strong></button>
        <button aria-label="Next scene" disabled={loading || mainIndex === mainScenes.length - 1} onClick={() => navigate(mainScenes[mainIndex + 1].id)}>›</button>
      </div>
    </div>
  </div>;
}
