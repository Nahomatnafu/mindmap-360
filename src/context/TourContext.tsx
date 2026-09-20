'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPalaceFromPanoramas, type PanoramaSource } from '@/lib/authoring/createPalace';
import { createId } from '@/lib/model/ids';
import { applyOpenViewLayout } from '@/lib/authoring/openViewLayout';
import { optimizePalaceImages } from '@/lib/authoring/imageDerivatives';
import { ensurePhonePreview } from '@/lib/authoring/phonePreview';
import { normalizeYaw } from '@/lib/model/validation';
import type { MemoryHotspot, PalaceBundle, PalaceWithPayloads } from '@/lib/model/types';
import { mindPalaceDatabase } from '@/lib/storage/database';
import { migrateLegacyLocalStorage } from '@/lib/storage/legacyMigration';
import { PalaceRepository } from '@/lib/storage/repository';
import type { AppMode, Flashcard, Tour } from '@/types';

interface TourContextType {
  tours: Tour[];
  activeTour: Tour | null;
  mode: AppMode;
  selectedFlashcard: Flashcard | null;
  isLoading: boolean;
  error: string | null;
  createTourFromFiles: (files: File[], title?: string) => Promise<string>;
  updateTour: (id: string, updates: Pick<Partial<Tour>, 'name'>) => Promise<void>;
  renameScenes: (tourId: string, namesBySceneId: Record<string, string>) => Promise<void>;
  deleteTour: (id: string) => Promise<void>;
  setActiveTour: (id: string | null) => void;
  addFlashcard: (tourId: string, flashcard: Omit<Flashcard, 'id' | 'createdAt'>) => Promise<void>;
  updateFlashcard: (tourId: string, flashcardId: string, updates: Partial<Flashcard>) => Promise<void>;
  deleteFlashcard: (tourId: string, flashcardId: string) => Promise<void>;
  selectFlashcard: (id: string | null) => void;
  setMode: (mode: AppMode) => void;
  clearError: () => void;
  prepareTour: (id: string, reviewedLayout?: boolean) => Promise<void>;
  preparation: string | null;
  updateConnection: (tourId: string, id: string, yaw: number, pitch: number, surface: 'floor' | 'wall') => Promise<void>;
}

const TourContext = createContext<TourContextType | null>(null);
const repository = new PalaceRepository();

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong.';

const supportedMime = (blob: Blob): PanoramaSource['mimeType'] => {
  if (blob.type === 'image/png' || blob.type === 'image/webp') return blob.type;
  return 'image/jpeg';
};

const readImageDimensions = (blob: Blob) => new Promise<{ width: number; height: number }>((resolve, reject) => {
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.onload = () => {
    resolve({ width: image.naturalWidth, height: image.naturalHeight });
    URL.revokeObjectURL(url);
  };
  image.onerror = () => {
    reject(new Error('One of the selected files is not a readable image.'));
    URL.revokeObjectURL(url);
  };
  image.src = url;
});

async function toPanoramaSource(blob: Blob, name: string): Promise<PanoramaSource> {
  const dimensions = await readImageDimensions(blob);
  return { blob, name, mimeType: supportedMime(blob), ...dimensions };
}

const withoutPayloads = (bundle: PalaceWithPayloads): PalaceBundle => ({
  schemaVersion: bundle.schemaVersion,
  palace: bundle.palace,
  scenes: bundle.scenes,
  hotspots: bundle.hotspots,
  memories: bundle.memories,
  routes: bundle.routes,
  practiceSessions: bundle.practiceSessions,
  recallResults: bundle.recallResults,
  assets: bundle.assets,
});

function toTour(bundle: PalaceWithPayloads, assetUrls: Map<string, string>): Tour {
  const memories = new Map(bundle.memories.map((memory) => [memory.id, memory]));
  const scenes = bundle.scenes
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((scene) => ({
      id: scene.id,
      name: scene.title,
      image: assetUrls.get(scene.panoramaAssetId) ?? '',
      thumbnail: scene.thumbnailAssetId ? assetUrls.get(scene.thumbnailAssetId) : undefined,
      alternate: scene.alternate,
      sortOrder: scene.sortOrder,
      initialYaw: scene.initialYaw,
      initialPitch: scene.initialPitch,
      initialHfov: scene.initialHfov,
    }));
  const flashcards = bundle.hotspots.flatMap((hotspot): Flashcard[] => {
    if (hotspot.kind !== 'memory') return [];
    const memory = memories.get(hotspot.memoryId);
    if (!memory) return [];
    return [{
      id: hotspot.id,
      question: memory.prompt || memory.title,
      answer: memory.answer || memory.body,
      position: { heading: hotspot.yaw, pitch: hotspot.pitch, sceneId: hotspot.sceneId },
      createdAt: Date.parse(bundle.palace.updatedAt),
      color: hotspot.color,
      icon: hotspot.iconKey,
    }];
  });
  const navHotspots = bundle.hotspots.flatMap((hotspot) => hotspot.kind === 'move' ? [{
    id: hotspot.id,
    fromScene: hotspot.sceneId,
    toScene: hotspot.targetSceneId,
    position: { heading: hotspot.yaw, pitch: hotspot.pitch, sceneId: hotspot.sceneId },
    label: hotspot.label,
    surface: hotspot.surface,
    preserveView: hotspot.preserveView,
  }] : []);

  return {
    id: bundle.palace.id,
    name: bundle.palace.title,
    description: `${scenes.length} scene${scenes.length === 1 ? '' : 's'}`,
    type: 'panorama',
    embedUrl: scenes[0]?.image ?? '',
    tourId: bundle.palace.id,
    flashcards,
    scenes,
    navHotspots,
    createdAt: Date.parse(bundle.palace.createdAt),
    updatedAt: Date.parse(bundle.palace.updatedAt),
    revision: bundle.palace.revision,
  };
}

const isBundledDemo = (bundle: PalaceWithPayloads) =>
  bundle.palace.title === 'Room Tour'
  && bundle.scenes.length === 3
  && bundle.scenes.every((scene, index) => scene.title === `Spot ${index + 1}`)
  && bundle.memories.length === 0;

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [tours, setTours] = useState<Tour[]>([]);
  const [activeTourId, setActiveTourId] = useState<string | null>(null);
  const [mode, setMode] = useState<AppMode>('view');
  const [selectedFlashcardId, setSelectedFlashcardId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preparation, setPreparation] = useState<string | null>(null);
  const bundlesRef = useRef(new Map<string, PalaceWithPayloads>());
  const objectUrlsRef = useRef(new Map<string, string>());
  const disposalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const retained = new Set(tours.flatMap(tour => tour.scenes.flatMap(scene => [scene.image, scene.thumbnail])));
    for (const [id, url] of objectUrlsRef.current) {
      if (!retained.has(url)) { URL.revokeObjectURL(url); objectUrlsRef.current.delete(id); }
    }
  }, [tours]);

  useEffect(() => {
    if (disposalRef.current) clearTimeout(disposalRef.current);
    const urls = objectUrlsRef.current;
    return () => {
      // Defer disposal so React's development effect replay keeps valid URLs.
      disposalRef.current = setTimeout(() => { urls.forEach(url => URL.revokeObjectURL(url)); urls.clear(); }, 0);
    };
  }, []);

  const loadWorkspace = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    const palaces = await repository.listPalaces();
    const bundles = (await Promise.all(palaces.map((palace) => repository.loadPalace(palace.id))))
      .filter((bundle): bundle is PalaceWithPayloads => Boolean(bundle));

    const visibleBundles = bundles.filter((bundle) => bundle.scenes.length > 0 && !isBundledDemo(bundle));
    const nextTours = visibleBundles.map((bundle) => {
      const assetUrls = new Map(bundle.assetPayloads.filter(payload => bundle.assets.find(a => a.id === payload.assetId)?.purpose !== 'panorama-original').map((payload) => {
        const url = objectUrlsRef.current.get(payload.assetId) ?? URL.createObjectURL(payload.blob);
        objectUrlsRef.current.set(payload.assetId, url);
        return [payload.assetId, url];
      }));
      return toTour(bundle, assetUrls);
    });

    bundlesRef.current = new Map(visibleBundles.map((bundle) => [bundle.palace.id, bundle]));
    setTours(nextTours);
    setActiveTourId((current) => current && nextTours.some((tour) => tour.id === current) ? current : nextTours[0]?.id ?? null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      try {
        try {
          await migrateLegacyLocalStorage(repository, mindPalaceDatabase, window.localStorage);
        } catch (migrationError) {
          console.warn('Legacy data could not be migrated:', migrationError);
        }
        if (active) {
          try {
            if (new URLSearchParams(window.location.search).get('preview') === '1') await ensurePhonePreview(repository);
          } catch (previewError) {
            if (active) setError(errorMessage(previewError));
          }
          if (active) await loadWorkspace();
        }
      } catch (initializationError) {
        if (active) {
          setError(errorMessage(initializationError));
          setIsLoading(false);
        }
      }
    };
    void initialize();
    return () => {
      active = false;
    };
  }, [loadWorkspace]);

  const saveBundle = useCallback(async (bundle: PalaceWithPayloads) => {
    try {
      await repository.savePalace(withoutPayloads(bundle), [], bundle.palace.revision);
      await loadWorkspace();
    } catch (failure) { setError(errorMessage(failure)); throw failure; }
  }, [loadWorkspace]);

  const prepareTour = useCallback(async (id: string, reviewedLayout = false) => {
    const bundle = bundlesRef.current.get(id);
    if (!bundle) throw new Error('Tour is not loaded.');
    setError(null);
    setPreparation('Preparing images…');
    try {
      const optimized = await optimizePalaceImages(bundle, (done, total) => setPreparation(`Preparing images ${done}/${total}`));
      const next = reviewedLayout ? applyOpenViewLayout(optimized) : optimized;
      await repository.savePalace(withoutPayloads(next), next.assetPayloads, bundle.palace.revision);
      await loadWorkspace();
    } catch (failure) { setError(errorMessage(failure)); throw failure; }
    finally { setPreparation(null); }
  }, [loadWorkspace]);

  const updateConnection = useCallback(async (tourId: string, id: string, yaw: number, pitch: number, surface: 'floor' | 'wall') => {
    const bundle = bundlesRef.current.get(tourId);
    if (!bundle) throw new Error('Tour is not loaded.');
    await saveBundle({ ...bundle, hotspots: bundle.hotspots.map(h => h.id === id ? { ...h, yaw: normalizeYaw(yaw), pitch, surface } : h) });
  }, [saveBundle]);

  const createTourFromFiles = useCallback(async (files: File[], title?: string) => {
    setError(null);
    try {
      const sources = await Promise.all(files.map((file) => toPanoramaSource(file, file.name)));
      const fallbackTitle = files[0]?.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
      const created = createPalaceFromPanoramas(title || fallbackTitle || 'New palace', sources);
      const saved = await repository.savePalace(created.bundle, created.assetPayloads, 0);
      await loadWorkspace();
      setActiveTourId(saved.id);
      return saved.id;
    } catch (creationError) {
      const message = errorMessage(creationError);
      setError(message);
      throw creationError;
    }
  }, [loadWorkspace]);

  const updateTour = useCallback(async (id: string, updates: Pick<Partial<Tour>, 'name'>) => {
    const bundle = bundlesRef.current.get(id);
    if (!bundle) throw new Error('This tour is no longer loaded. Reload and try again.');
    await saveBundle({
      ...bundle,
      palace: { ...bundle.palace, title: updates.name?.trim() || bundle.palace.title },
    });
  }, [saveBundle]);

  const renameScenes = useCallback(async (tourId: string, namesBySceneId: Record<string, string>) => {
    const bundle = bundlesRef.current.get(tourId);
    if (!bundle) throw new Error('This tour is no longer loaded. Reload and try again.');
    await saveBundle({
      ...bundle,
      scenes: bundle.scenes.map((scene) => ({
        ...scene,
        title: namesBySceneId[scene.id]?.trim() || scene.title,
      })),
      hotspots: bundle.hotspots.map((hotspot) => hotspot.kind === 'move' ? {
        ...hotspot,
        label: `Walk to ${namesBySceneId[hotspot.targetSceneId]?.trim() || bundle.scenes.find((scene) => scene.id === hotspot.targetSceneId)?.title || 'next scene'}`,
      } : hotspot),
    });
  }, [saveBundle]);

  const deleteTour = useCallback(async (id: string) => {
    await repository.deletePalace(id);
    setSelectedFlashcardId(null);
    await loadWorkspace();
  }, [loadWorkspace]);

  const addFlashcard = useCallback(async (
    tourId: string,
    flashcard: Omit<Flashcard, 'id' | 'createdAt'>,
  ) => {
    const bundle = bundlesRef.current.get(tourId);
    if (!bundle) throw new Error('This tour is no longer loaded. Reload and try again.');
    const sceneId = flashcard.position.sceneId || bundle.palace.startSceneId || bundle.scenes[0]?.id;
    if (!sceneId) throw new Error('Add a scene before placing a memory.');
    const memoryId = createId();
    const hotspotId = createId();
    await saveBundle({
      ...bundle,
      memories: [...bundle.memories, {
        id: memoryId,
        palaceId: tourId,
        title: flashcard.question,
        body: flashcard.answer,
        prompt: flashcard.question,
        answer: flashcard.answer,
      }],
      hotspots: [...bundle.hotspots, {
        id: hotspotId,
        kind: 'memory',
        sceneId,
        memoryId,
        yaw: normalizeYaw(flashcard.position.heading),
        pitch: flashcard.position.pitch,
        label: flashcard.question,
        iconKey: flashcard.icon || 'note',
        color: flashcard.color || '#c9a84c',
        size: 30,
      }],
    });
    setSelectedFlashcardId(hotspotId);
  }, [saveBundle]);

  const updateFlashcard = useCallback(async (tourId: string, flashcardId: string, updates: Partial<Flashcard>) => {
    const bundle = bundlesRef.current.get(tourId);
    const hotspot = bundle?.hotspots.find((candidate): candidate is MemoryHotspot => candidate.id === flashcardId && candidate.kind === 'memory');
    if (!bundle || !hotspot) throw new Error('This note is no longer available. Reload and try again.');
    await saveBundle({
      ...bundle,
      memories: bundle.memories.map((memory) => memory.id === hotspot.memoryId ? {
        ...memory,
        title: updates.question ?? memory.title,
        body: updates.answer ?? memory.body,
        prompt: updates.question ?? memory.prompt,
        answer: updates.answer ?? memory.answer,
      } : memory),
      hotspots: bundle.hotspots.map((candidate) => candidate.id === hotspot.id ? {
        ...candidate,
        label: updates.question ?? candidate.label,
        color: updates.color ?? candidate.color,
      } : candidate),
    });
  }, [saveBundle]);

  const deleteFlashcard = useCallback(async (tourId: string, flashcardId: string) => {
    const bundle = bundlesRef.current.get(tourId);
    const hotspot = bundle?.hotspots.find((candidate): candidate is MemoryHotspot => candidate.id === flashcardId && candidate.kind === 'memory');
    if (!bundle || !hotspot) throw new Error('This note is no longer available. Reload and try again.');
    const remainingHotspots = bundle.hotspots.filter((candidate) => candidate.id !== hotspot.id);
    const memoryStillUsed = remainingHotspots.some((candidate) => candidate.kind === 'memory' && candidate.memoryId === hotspot.memoryId);
    await saveBundle({
      ...bundle,
      hotspots: remainingHotspots,
      memories: memoryStillUsed ? bundle.memories : bundle.memories.filter((memory) => memory.id !== hotspot.memoryId),
    });
    setSelectedFlashcardId(null);
  }, [saveBundle]);

  const activeTour = tours.find((tour) => tour.id === activeTourId) || null;
  const selectedFlashcard = activeTour?.flashcards.find((flashcard) => flashcard.id === selectedFlashcardId) || null;
  const value = useMemo<TourContextType>(() => ({
    tours,
    activeTour,
    mode,
    selectedFlashcard,
    isLoading,
    error,
    createTourFromFiles,
    updateTour,
    renameScenes,
    deleteTour,
    setActiveTour: setActiveTourId,
    addFlashcard,
    updateFlashcard,
    deleteFlashcard,
    selectFlashcard: setSelectedFlashcardId,
    setMode,
    clearError: () => setError(null),
    prepareTour, preparation, updateConnection,
  }), [
    tours, activeTour, mode, selectedFlashcard, isLoading, error, createTourFromFiles, prepareTour, preparation, updateConnection,
    updateTour, renameScenes, deleteTour, addFlashcard, updateFlashcard, deleteFlashcard,
  ]);

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTourContext() {
  const context = useContext(TourContext);
  if (!context) throw new Error('useTourContext must be used within TourProvider');
  return context;
}
