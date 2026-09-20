import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPalaceFromPanoramas } from './createPalace';
import { createEditingPreview, optimizePalaceImages } from './imageDerivatives';

afterEach(() => vi.unstubAllGlobals());

function mockImageBrowser(failEncoding = false) {
  const release = vi.fn();
  const decode = vi.fn(async () => ({ width: 7680, height: 3840, close: release }));
  const encodes: { width: number; height: number; quality: number }[] = [];
  const canvases: { width: number; height: number }[] = [];
  vi.stubGlobal('createImageBitmap', decode);
  vi.stubGlobal('document', {
    createElement: () => {
      const canvas = {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: vi.fn() }),
        toBlob(callback: (blob: Blob | null) => void, type: string, quality: number) {
          encodes.push({ width: canvas.width, height: canvas.height, quality });
          callback(failEncoding ? null : new Blob(['compressed'], { type }));
        },
      };
      canvases.push(canvas);
      return canvas;
    },
  });
  return { release, decode, encodes, canvases };
}

function fixture() {
  const original = new Blob(['original bytes'], { type: 'image/jpeg' });
  const { bundle, assetPayloads } = createPalaceFromPanoramas('Home', [
    { blob: original, name: 'Hall.jpg', mimeType: 'image/jpeg', width: 7680, height: 3840 },
    { blob: original, name: 'Living.jpg', mimeType: 'image/jpeg', width: 7680, height: 3840 },
  ]);
  return { ...bundle, assetPayloads };
}

describe('browser image derivatives', () => {
  it('preserves source blobs and scene/link IDs, bounds output size, and skips completed work', async () => {
    const browser = mockImageBrowser();
    const input = fixture();
    const sourceIds = input.scenes.map((scene) => scene.panoramaAssetId);
    const progress = vi.fn();
    const output = await optimizePalaceImages(input, progress);
    expect(input.assets).toHaveLength(2);
    expect(output.assets).toHaveLength(6);
    expect(output.scenes.map((scene) => scene.id)).toEqual(input.scenes.map((scene) => scene.id));
    expect(output.hotspots).toBe(input.hotspots);
    expect(output.memories).toBe(input.memories);
    for (const sourceId of sourceIds) {
      expect(output.assets.find((asset) => asset.id === sourceId)?.purpose).toBe('panorama-original');
      expect(output.assetPayloads.find((asset) => asset.assetId === sourceId)?.blob).toBe(input.assetPayloads.find((asset) => asset.assetId === sourceId)?.blob);
    }
    expect(browser.encodes).toEqual([
      { width: 3840, height: 1920, quality: 0.8 }, { width: 512, height: 256, quality: 0.7 },
      { width: 3840, height: 1920, quality: 0.8 }, { width: 512, height: 256, quality: 0.7 },
    ]);
    expect(progress.mock.calls).toEqual([[0, 2], [1, 2], [2, 2]]);
    expect(browser.release).toHaveBeenCalledTimes(2);
    expect(browser.canvases.every((canvas) => canvas.width === 0 && canvas.height === 0)).toBe(true);
    const repeated = await optimizePalaceImages(output);
    expect(repeated).toEqual(output);
    expect(browser.decode).toHaveBeenCalledTimes(2);
  });

  it('releases decoded images and canvases on compression failure without modifying input', async () => {
    const browser = mockImageBrowser(true);
    const input = fixture();
    await expect(optimizePalaceImages(input)).rejects.toThrow('Photo compression failed');
    expect(browser.release).toHaveBeenCalledOnce();
    expect(browser.canvases[0]).toMatchObject({ width: 0, height: 0 });
    expect(input.assets).toHaveLength(2);
    expect(input.scenes[0].thumbnailAssetId).toBeUndefined();
  });

  it('creates a bounded editing preview and rejects non-raster uploads', async () => {
    const browser = mockImageBrowser();
    const preview = await createEditingPreview(new Blob(['photo'], { type: 'image/jpeg' }));
    expect(preview).toMatchObject({ width: 1536, height: 768 });
    expect(browser.encodes).toEqual([{ width: 1536, height: 768, quality: 0.65 }]);
    await expect(createEditingPreview(new Blob(['<svg/>'], { type: 'image/svg+xml' }))).rejects.toThrow('Only JPEG');
  });
});
