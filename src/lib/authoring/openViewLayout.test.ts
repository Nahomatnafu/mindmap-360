import { describe, expect, it } from 'vitest';
import type { PalaceWithPayloads } from '@/lib/model/types';
import { createPalaceFromPanoramas } from './createPalace';
import { applyOpenViewLayout } from './openViewLayout';

function importedPhotos(): PalaceWithPayloads {
  let id = 0;
  const { bundle, assetPayloads } = createPalaceFromPanoramas('OpenView Homes',
    Array.from({ length: 9 }, (_, index) => ({
      name: `ov_batch_${String(index + 1).padStart(2, '0')}.jpg`,
      blob: new Blob([`fixture ${index}`], { type: 'image/jpeg' }),
      mimeType: 'image/jpeg' as const,
      width: 3840,
      height: 1920,
    })), { idFactory: () => `fixture-${++id}`, now: '2026-09-20T00:00:00Z' });
  return { ...bundle, assetPayloads };
}

describe('applyOpenViewLayout', () => {
  it('uses photographed room adjacency rather than filename sequence', () => {
    const result = applyOpenViewLayout(importedPhotos());
    const sceneNames = new Map(result.scenes.map(scene => [scene.id, scene.title]));
    const destinations = (room: string) => result.hotspots
      .filter(hotspot => hotspot.kind === 'move' && sceneNames.get(hotspot.sceneId) === room)
      .map(hotspot => hotspot.kind === 'move' ? sceneNames.get(hotspot.targetSceneId) : undefined)
      .sort();

    expect(destinations('Front Entry')).toEqual(['Entryway']);
    expect(destinations('Entryway')).toEqual(['Front Entry', 'Main Hall']);
    expect(destinations('Main Hall')).toEqual(['Entryway', 'Laundry', 'Living & Kitchen']);
    expect(destinations('Laundry')).toEqual(['Entryway', 'Living & Kitchen', 'Main Hall']);
    expect(destinations('Living & Kitchen')).toEqual(['Kitchen', 'Living Room', 'Main Hall']);
    expect(destinations('Living Room')).toEqual(['Back Patio', 'Kitchen', 'Living & Kitchen']);
    expect(destinations('Kitchen')).toEqual(['Living & Kitchen', 'Living Room']);
    expect(destinations('Back Patio')).toEqual(['Backyard', 'Living Room']);
    expect(destinations('Backyard')).toEqual(['Back Patio']);
    expect(sceneNames.get(result.palace.startSceneId!)).toBe('Front Entry');
  });

  it('keeps the laundry reveal out of the eight-stop walking sequence and preserves its camera', () => {
    const result = applyOpenViewLayout(importedPhotos());
    const sceneNames = new Map(result.scenes.map(scene => [scene.id, scene.title]));
    const walkingOrder = result.scenes.filter(scene => !scene.alternate)
      .sort((a, b) => a.sortOrder - b.sortOrder).map(scene => scene.title);
    expect(walkingOrder).toEqual([
      'Front Entry', 'Entryway', 'Main Hall', 'Living & Kitchen',
      'Kitchen', 'Living Room', 'Back Patio', 'Backyard',
    ]);
    expect(result.scenes.filter(scene => scene.alternate).map(scene => scene.title)).toEqual(['Laundry']);
    const reveals = result.hotspots.filter(hotspot => hotspot.kind === 'move' && hotspot.preserveView);
    expect(reveals).toHaveLength(2);
    expect(reveals.map(hotspot => hotspot.kind === 'move'
      ? `${sceneNames.get(hotspot.sceneId)} → ${sceneNames.get(hotspot.targetSceneId)}` : '').sort())
      .toEqual(['Laundry → Main Hall', 'Main Hall → Laundry']);
    reveals.forEach(hotspot => expect(hotspot).toMatchObject({ surface: 'wall', iconKey: 'reveal' }));
    result.hotspots.filter(hotspot => hotspot.kind === 'move' && !hotspot.preserveView)
      .forEach(hotspot => expect(hotspot).toMatchObject({ surface: 'floor', iconKey: 'walk' }));
  });

  it('preserves existing notes, their markers, practice references, and image payloads', () => {
    const original = importedPhotos();
    original.memories.push({ id: 'poem', palaceId: original.palace.id, title: 'Couch poem', body: 'Remember this verse.' });
    original.hotspots.push({
      id: 'couch-note', kind: 'memory', sceneId: original.scenes[5].id, memoryId: 'poem',
      yaw: 4, pitch: -20, label: 'Poem', iconKey: 'note', color: '#ffffff', size: 40,
    });
    original.routes.push({ id: 'route', palaceId: original.palace.id, title: 'Practice', stops: ['couch-note'], updatedAt: original.palace.updatedAt });
    const originalSceneTitles = original.scenes.map(scene => scene.title);
    const originalHotspotIds = original.hotspots.map(hotspot => hotspot.id);
    const result = applyOpenViewLayout(original);

    expect(result.memories).toEqual(original.memories);
    expect(result.hotspots.filter(hotspot => hotspot.kind === 'memory'))
      .toEqual(original.hotspots.filter(hotspot => hotspot.kind === 'memory'));
    expect(result.routes).toEqual(original.routes);
    expect(result.assetPayloads).toBe(original.assetPayloads);
    expect(result.assets).toEqual(original.assets);
    expect(result.scenes.map(scene => scene.panoramaAssetId)).toEqual(original.scenes.map(scene => scene.panoramaAssetId));
    expect(original.scenes.map(scene => scene.title)).toEqual(originalSceneTitles);
    expect(original.hotspots.map(hotspot => hotspot.id)).toEqual(originalHotspotIds);
  });

  it('recognizes named scenes regardless of collection order and can be applied again without duplicates', () => {
    const first = applyOpenViewLayout(importedPhotos());
    const shuffled = { ...first, scenes: [...first.scenes].reverse() };
    expect(applyOpenViewLayout(shuffled)).toEqual(first);
    expect(new Set(first.hotspots.map(hotspot => hotspot.id)).size).toBe(first.hotspots.length);
  });

  it('rejects an incomplete or unrelated photo set rather than guessing its layout', () => {
    const missing = importedPhotos();
    missing.scenes.pop();
    expect(() => applyOpenViewLayout(missing)).toThrow(/nine original OpenView scenes/);
    const unrelated = importedPhotos();
    unrelated.scenes[5].title = 'Different property';
    expect(() => applyOpenViewLayout(unrelated)).toThrow(/nine original OpenView scenes/);
    const duplicate = importedPhotos();
    duplicate.scenes[5].title = duplicate.scenes[4].title;
    expect(() => applyOpenViewLayout(duplicate)).toThrow(/nine original OpenView scenes/);
  });
});
