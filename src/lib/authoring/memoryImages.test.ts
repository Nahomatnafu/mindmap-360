import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { createPalaceFromPanoramas } from './createPalace';
import { validateMemoryImage, writeMemory } from './memoryImages';
import { MindPalaceDatabase } from '../storage/database';
import { PalaceRepository } from '../storage/repository';

const databases: MindPalaceDatabase[] = [];
afterEach(async () => { for (const db of databases.splice(0)) { db.close(); await db.delete(); } });
const fixture = () => {
  const created = createPalaceFromPanoramas('Memory test', [{ blob: new Blob(['panorama']), mimeType: 'image/jpeg', width: 1000, height: 500, name: 'Room' }]);
  return { ...created.bundle, assetPayloads: created.assetPayloads };
};
const image = { blob: new Blob(['png-image'], { type: 'image/png' }), width: 128, height: 128 };

describe('image memories', () => {
  it('rejects HTML, SVG and oversized files before decoding', () => {
    for (const type of ['text/html', 'image/svg+xml']) expect(() => validateMemoryImage(new Blob(['x'], { type }))).toThrow(/PNG/);
    expect(() => validateMemoryImage(new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], { type: 'image/png' }))).toThrow(/10 MB/);
  });

  it('persists the image and position together, retains it through edits, and removes replaced payloads', async () => {
    const original = fixture();
    const db = new MindPalaceDatabase(`memory-${crypto.randomUUID()}`); databases.push(db);
    const repository = new PalaceRepository(db);
    await repository.savePalace(original, original.assetPayloads, 0);
    const base = (await repository.loadPalace(original.palace.id))!;
    const draft = { question: 'Krypton', answer: 'Krypto is my sound association.', position: { heading: 200, pitch: -20, sceneId: base.scenes[0].id }, size: 72 };
    const created = writeMemory(base, draft, image);
    await repository.savePalace(created.bundle, created.payloads, base.palace.revision);
    const loaded = (await repository.loadPalace(base.palace.id))!;
    expect(loaded.hotspots[0]).toMatchObject({ yaw: -160, pitch: -20, size: 72 });
    expect(await loaded.assetPayloads.find(p => p.assetId === loaded.memories[0].imageAssetId)!.blob.text()).toBe('png-image');
    const edited = writeMemory(loaded, { ...draft, id: created.hotspotId, answer: 'Updated note', position: { ...draft.position, heading: 40 }, size: 48 });
    expect(edited.bundle.memories[0].imageAssetId).toBe(loaded.memories[0].imageAssetId);
    expect(edited.payloads).toHaveLength(0);
    const replacement = writeMemory(loaded, { ...draft, id: created.hotspotId }, image);
    await repository.savePalace(replacement.bundle, replacement.payloads, loaded.palace.revision);
    expect(await db.assetPayloads.get(loaded.memories[0].imageAssetId!)).toBeUndefined();
    const current = (await repository.loadPalace(base.palace.id))!;
    const removed = writeMemory(current, { ...draft, id: created.hotspotId }, null);
    expect(removed.bundle.memories[0].imageAssetId).toBeUndefined();
    expect(removed.bundle.assets).toEqual(original.assets);
  });

  it('rolls back image and note changes when a database write fails', async () => {
    const original = fixture();
    const db = new MindPalaceDatabase(`failure-${crypto.randomUUID()}`); databases.push(db);
    const repository = new PalaceRepository(db);
    await repository.savePalace(original, original.assetPayloads, 0);
    const base = (await repository.loadPalace(original.palace.id))!;
    const edit = writeMemory(base, { question: 'Gold', answer: 'Bracelet', position: { sceneId: base.scenes[0].id, heading: 0, pitch: 0 } }, image);
    db.assetPayloads.hook('creating', () => { throw new Error('Simulated quota failure'); });
    await expect(repository.savePalace(edit.bundle, edit.payloads, base.palace.revision)).rejects.toThrow(/quota/);
    const reloaded = (await repository.loadPalace(base.palace.id))!;
    expect(reloaded.memories).toEqual([]);
    expect(reloaded.assets).toEqual(base.assets);
    expect(reloaded.palace.revision).toBe(base.palace.revision);
  });
});
