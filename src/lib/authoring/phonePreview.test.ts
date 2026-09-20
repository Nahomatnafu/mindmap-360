import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MindPalaceDatabase } from '../storage/database';
import { PalaceRepository } from '../storage/repository';
import { ensurePhonePreview } from './phonePreview';

const databases: MindPalaceDatabase[] = [];
function repository() {
  const db = new MindPalaceDatabase(`phone-preview-${crypto.randomUUID()}`);
  databases.push(db);
  return new PalaceRepository(db);
}
afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(databases.splice(0).map(async db => { db.close(); await db.delete(); }));
});

describe('phone preview', () => {
  it('seeds one scene once and preserves later note edits on reload', async () => {
    const repo = repository();
    const download = vi.fn(async () => new Response(new Blob(['fixture'], { type: 'image/jpeg' })));
    vi.stubGlobal('fetch', download);
    await Promise.all([ensurePhonePreview(repo), ensurePhonePreview(repo)]);
    const palaces = await repo.listPalaces();
    expect(palaces).toHaveLength(1);
    const saved = (await repo.loadPalace(palaces[0].id))!;
    expect(saved.scenes).toHaveLength(1);
    expect(saved.assetPayloads).toHaveLength(1);
    saved.memories[0].body = 'My phone note';
    await repo.savePalace(saved, [], saved.palace.revision);
    await ensurePhonePreview(repo);
    expect((await repo.loadPalace(palaces[0].id))!.memories[0].body).toBe('My phone note');
    expect(download).toHaveBeenCalledTimes(1);
  });

  it('does not create partial data when the preview photo is missing', async () => {
    const repo = repository();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
    await expect(ensurePhonePreview(repo)).rejects.toThrow('photo is unavailable');
    expect(await repo.listPalaces()).toEqual([]);
  });
});
