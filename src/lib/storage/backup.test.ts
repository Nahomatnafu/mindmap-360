import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { createPalaceFromPanoramas } from '../authoring/createPalace';
import { writeMemory } from '../authoring/memoryImages';
import { assertRasterImage } from '../authoring/rasterImage';
import { MindPalaceDatabase } from './database';
import { PalaceRepository } from './repository';
import { exportPalace, importPalace } from './backup';

const databases: MindPalaceDatabase[] = [];
afterEach(async () => { for (const db of databases.splice(0)) { db.close(); await db.delete(); } });
const inspect = async (blob: Blob) => {
  const { width, height } = await sharp(Buffer.from(await blob.arrayBuffer())).metadata();
  return { width, height };
};
async function fixture() {
  const panorama = await sharp({ create: { width: 1000, height: 500, channels: 3, background: '#abcdef' } }).jpeg().toBuffer();
  const photo = new Blob([new Uint8Array(panorama)], { type: 'image/jpeg' });
  const created = createPalaceFromPanoramas('General memory palace', [{ blob: photo, mimeType: 'image/jpeg', width: 1000, height: 500, name: 'Room' }]);
  const png = await sharp({ create: { width: 32, height: 32, channels: 4, background: '#ffffff00' } }).png().toBuffer();
  return writeMemory({ ...created.bundle, assetPayloads: created.assetPayloads }, {
    question: 'A poem', answer: '<strong>Remember this as plain text</strong>',
    position: { sceneId: created.bundle.scenes[0].id, heading: 15, pitch: -12 }, size: 40,
  }, { blob: new Blob([new Uint8Array(png)], { type: 'image/png' }), width: 32, height: 32 }).bundle;
}
async function alter(blob: Blob, change: (entries: Record<string, Uint8Array>) => void) {
  const entries = unzipSync(new Uint8Array(await blob.arrayBuffer())); change(entries);
  return new Blob([new Uint8Array(zipSync(entries))]);
}

describe('portable palace backups', () => {
  it('round trips images and memories into a new palace without overwriting the original', async () => {
    const original = await fixture();
    const db = new MindPalaceDatabase(`backup-${crypto.randomUUID()}`); databases.push(db);
    const repository = new PalaceRepository(db);
    await repository.savePalace(original, original.assetPayloads, 0);
    const restored = await importPalace(await exportPalace(original), inspect);
    await repository.savePalace(restored, restored.assetPayloads, 0);
    expect(await repository.listPalaces()).toHaveLength(2);
    expect(restored.palace.id).not.toBe(original.palace.id);
    expect(restored.memories[0].body).toBe(original.memories[0].body);
    expect(restored.hotspots[0]).toMatchObject({ sceneId: restored.scenes[0].id, memoryId: restored.memories[0].id, size: 40, yaw: 15, pitch: -12 });
    expect(restored.assets.some(a => a.id === restored.memories[0].imageAssetId)).toBe(true);
    for (let i = 0; i < original.assetPayloads.length; i++) expect(await restored.assetPayloads[i].blob.arrayBuffer()).toEqual(await original.assetPayloads[i].blob.arrayBuffer());
  });
  it('rejects damaged payloads and incorrect dimensions', async () => {
    const zip = await exportPalace(await fixture());
    const damaged = await alter(zip, entries => { entries['assets/0.jpg'][20] ^= 255; });
    await expect(importPalace(damaged, inspect)).rejects.toThrow(/damaged/);
    await expect(importPalace(zip, async () => ({ width: 1, height: 1 }))).rejects.toThrow(/dimensions/);
  });
  it('rejects unsupported versions, structured content and unexpected archive paths', async () => {
    const zip = await exportPalace(await fixture());
    const wrongVersion = await alter(zip, entries => { const data = JSON.parse(strFromU8(entries['palace.json'])); data.version = 99; entries['palace.json'] = strToU8(JSON.stringify(data)); });
    await expect(importPalace(wrongVersion, inspect)).rejects.toThrow(/valid supported/);
    const invalidContent = await alter(zip, entries => { const data = JSON.parse(strFromU8(entries['palace.json'])); data.bundle.memories[0].body = { html: 'bad' }; entries['palace.json'] = strToU8(JSON.stringify(data)); });
    await expect(importPalace(invalidContent, inspect)).rejects.toThrow(/valid supported/);
    const traversal = await alter(zip, entries => { entries['../unsafe.html'] = strToU8('bad'); });
    await expect(importPalace(traversal, inspect)).rejects.toThrow(/valid supported/);
  });
  it('rejects mislabeled SVG and HTML before browser decoding', async () => {
    for (const content of ['<svg xmlns="http://www.w3.org/2000/svg"></svg>', '<html>bad</html>']) {
      await expect(assertRasterImage(new Blob([content], { type: 'image/png' }))).rejects.toThrow(/real PNG/);
    }
  });
});
