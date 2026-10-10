import { createId } from '../model/ids';
import type { AssetPayload, PalaceWithPayloads } from '../model/types';
import { normalizeYaw } from '../model/validation';
import type { MemoryDraft, Position } from '@/types';
import { DEFAULT_IMAGE_SIZE } from '../viewer/imageScale';

export interface PreparedMemoryImage { blob: Blob; width: number; height: number }

export function validateMemoryImage(blob: Blob) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(blob.type)) throw new Error('Choose a PNG, JPEG, or WebP image. SVG and HTML are not supported.');
  if (!blob.size || blob.size > 10 * 1024 * 1024) throw new Error('Choose an image smaller than 10 MB.');
}

/** Creates a separate display copy; never edits the supplied file. PNG preserves alpha. */
export async function prepareMemoryImage(blob: Blob): Promise<PreparedMemoryImage> {
  validateMemoryImage(blob);
  const url = URL.createObjectURL(blob);
  const image = new Image();
  try {
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 24_000_000) throw new Error('Choose an image with at most 24 megapixels.');
    const ratio = Math.min(1, 768 / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * ratio));
    const height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    try {
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Your browser could not prepare this image.');
      context.drawImage(image, 0, 0, width, height);
      const copy = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Image preparation failed.')), 'image/png'));
      return { blob: copy, width, height };
    } finally { canvas.width = 0; canvas.height = 0; }
  } finally { image.removeAttribute('src'); URL.revokeObjectURL(url); }
}

export function pruneMemoryImages(bundle: PalaceWithPayloads): PalaceWithPayloads {
  const referenced = new Set([
    ...bundle.memories.map(m => m.imageAssetId), ...bundle.hotspots.map(h => h.customAssetId),
    ...bundle.scenes.flatMap(s => [s.panoramaAssetId, s.thumbnailAssetId]),
  ]);
  const assets = bundle.assets.filter(a => !['memory-image', 'marker-image'].includes(a.purpose) || referenced.has(a.id));
  const retained = new Set(assets.map(a => a.id));
  return { ...bundle, assets, assetPayloads: bundle.assetPayloads.filter(p => retained.has(p.assetId)) };
}

/** Engine-independent edit assembled before one repository transaction. */
export function writeMemory(bundle: PalaceWithPayloads, draft: MemoryDraft & { position: Position; id?: string }, image?: PreparedMemoryImage | null) {
  const oldHotspot = draft.id ? bundle.hotspots.find(h => h.id === draft.id && h.kind === 'memory') : undefined;
  if (draft.id && (!oldHotspot || oldHotspot.kind !== 'memory')) throw new Error('This memory is no longer available.');
  const oldMemory = oldHotspot?.kind === 'memory' ? bundle.memories.find(m => m.id === oldHotspot.memoryId) : undefined;
  const sceneId = draft.position.sceneId;
  if (!bundle.scenes.some(s => s.id === sceneId)) throw new Error('Choose a scene for this memory.');
  if (!draft.question.trim() || !draft.answer.trim()) throw new Error('Add a concept and a note.');
  const memoryId = oldMemory?.id ?? createId();
  const hotspotId = oldHotspot?.id ?? createId();
  const assetId = image ? createId() : image === null ? undefined : oldMemory?.imageAssetId;
  const memory = { ...oldMemory, id: memoryId, palaceId: bundle.palace.id, title: draft.question.trim(), body: draft.answer.trim(), prompt: draft.question.trim(), answer: draft.answer.trim(), imageAssetId: assetId };
  const hotspot = { ...oldHotspot, id: hotspotId, kind: 'memory' as const, memoryId, sceneId: sceneId!, yaw: normalizeYaw(draft.position.heading), pitch: draft.position.pitch, label: memory.title, color: draft.color ?? oldHotspot?.color ?? '#c9a84c', iconKey: 'note', size: draft.size ?? oldHotspot?.size ?? DEFAULT_IMAGE_SIZE, customAssetId: undefined };
  const payloads: AssetPayload[] = image && assetId ? [{ assetId, blob: image.blob }] : [];
  const next = pruneMemoryImages({
    ...bundle,
    memories: [...bundle.memories.filter(m => m.id !== memoryId), memory],
    hotspots: [...bundle.hotspots.filter(h => h.id !== hotspotId), hotspot],
    assets: image && assetId ? [...bundle.assets, { id: assetId, palaceId: bundle.palace.id, purpose: 'memory-image', mimeType: 'image/png', width: image.width, height: image.height, bytes: image.blob.size }] : bundle.assets,
    assetPayloads: [...bundle.assetPayloads, ...payloads],
  });
  return { bundle: next, payloads, hotspotId };
}
