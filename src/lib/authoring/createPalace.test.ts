import { describe, expect, it } from 'vitest';
import { createPalaceFromPanoramas, validatePanoramaSource, type PanoramaSource } from './createPalace';

const panorama = (name: string): PanoramaSource => ({
  blob: new Blob(['image']),
  name,
  mimeType: 'image/jpeg',
  width: 4000,
  height: 2000,
});

describe('createPalaceFromPanoramas', () => {
  it('creates scenes, payloads, and bidirectional links', () => {
    let sequence = 0;
    const result = createPalaceFromPanoramas('Home', [panorama('Living Room.jpg'), panorama('Kitchen.jpg')], {
      now: '2026-09-20T00:00:00.000Z',
      idFactory: () => `id-${sequence += 1}`,
    });

    expect(result.bundle.palace.startSceneId).toBe(result.bundle.scenes[0].id);
    expect(result.bundle.scenes.map((scene) => scene.title)).toEqual(['Living Room', 'Kitchen']);
    expect(result.bundle.hotspots).toHaveLength(2);
    expect(result.bundle.hotspots[0]).toMatchObject({
      kind: 'move',
      sceneId: result.bundle.scenes[0].id,
      targetSceneId: result.bundle.scenes[1].id,
    });
    expect(result.assetPayloads).toHaveLength(2);
  });

  it('rejects flat images that are not equirectangular', () => {
    expect(() => validatePanoramaSource({ ...panorama('portrait.jpg'), width: 1000, height: 1400 }))
      .toThrow(/2:1 ratio/);
  });
});
