import { createPalaceFromPanoramas } from './createPalace';
import { PalaceRepository, PalaceRevisionConflictError } from '../storage/repository';

const previewId = '71360000-0000-4000-8000-000000000001';
let pending: Promise<void> | undefined;

/** Opt-in, one-photo preview. Never replace a saved preview or an existing workspace. */
export function ensurePhonePreview(repository: PalaceRepository): Promise<void> {
  if (!pending) pending = seed(repository).finally(() => { pending = undefined; });
  return pending;
}

async function seed(repository: PalaceRepository) {
  if ((await repository.listPalaces()).length) return;
  const response = await fetch('/phone-preview/living-room.jpg');
  if (!response.ok) throw new Error('The phone preview photo is unavailable. You can still import your own panorama.');
  const blob = await response.blob();
  let sequence = 0;
  const { bundle, assetPayloads } = createPalaceFromPanoramas('Phone preview · Living Room', [{
    name: 'Living Room.jpg', blob, mimeType: 'image/jpeg', width: 2560, height: 1280,
  }], { idFactory: () => `71360000-0000-4000-8000-${String(++sequence).padStart(12, '0')}` });
  bundle.scenes[0].initialYaw = -20;
  bundle.scenes[0].initialPitch = -15;
  bundle.scenes[0].initialHfov = 95;
  const memoryId = '71360000-0000-4000-8000-000000000004';
  bundle.memories.push({ id: memoryId, palaceId: previewId, title: 'Try a note on the couch',
    body: 'Drag to look around. Tap Add note, then tap an object to pin your own memory. Your notes stay in this phone’s browser. This temporary preview has one viewpoint.' });
  bundle.hotspots.push({ id: '71360000-0000-4000-8000-000000000005', kind: 'memory',
    sceneId: bundle.scenes[0].id, memoryId, yaw: 4, pitch: -22,
    label: 'Try a note on the couch', iconKey: 'note', color: '#4f8cff', size: 30 });
  // Another tab may have seeded while this tab downloaded the image.
  try { await repository.savePalace(bundle, assetPayloads, 0); }
  catch (error) { if (!(error instanceof PalaceRevisionConflictError)) throw error; }
}
