import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { createId } from '../model/ids';
import type { PalaceBundle, PalaceWithPayloads } from '../model/types';
import { validatePalaceBundle } from '../model/validation';
import { assertBackupShape } from './backupShape';
import { assertRasterImage } from '../authoring/rasterImage';

const MAX_ARCHIVE = 100 * 1024 * 1024;
const MAX_EXPANDED = 128 * 1024 * 1024;
const allowedMimes = ['image/png', 'image/jpeg', 'image/webp'];
interface Manifest { format: 'mind-palace-backup'; version: 1; exportedAt: string; bundle: PalaceBundle; files: { assetId: string; path: string; sha256: string }[] }
const checksum = async (bytes: Uint8Array) => {
  if (!crypto.subtle) throw new Error('Backup and restore require HTTPS or localhost.');
  const hash = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
};

export async function exportPalace(bundle: PalaceWithPayloads): Promise<Blob> {
  if (!validatePalaceBundle(bundle).ok) throw new Error('This palace contains broken references and cannot be exported.');
  const { assetPayloads, ...metadata } = bundle;
  const entries: Record<string, Uint8Array> = Object.create(null);
  const files: Manifest['files'] = [];
  let total = 0;
  for (const [index, asset] of bundle.assets.entries()) {
    const payload = assetPayloads.find(p => p.assetId === asset.id);
    if (!payload || payload.blob.size !== asset.bytes) throw new Error('An image is missing or incomplete. Reload this palace before exporting.');
    if (!allowedMimes.includes(asset.mimeType)) throw new Error('Unsupported image format in this palace.');
    total += payload.blob.size;
    if (total > MAX_ARCHIVE - 1024 * 1024) throw new Error('This demo backup supports up to 99 MB of images. Try a smaller palace.');
    const bytes = new Uint8Array(await payload.blob.arrayBuffer());
    const path = `assets/${index}.${asset.mimeType === 'image/jpeg' ? 'jpg' : asset.mimeType.split('/')[1]}`;
    entries[path] = bytes;
    files.push({ assetId: asset.id, path, sha256: await checksum(bytes) });
  }
  const manifest: Manifest = { format: 'mind-palace-backup', version: 1, exportedAt: new Date().toISOString(), bundle: metadata, files };
  entries['palace.json'] = strToU8(JSON.stringify(manifest));
  // JPEG/PNG/WebP payloads are already compressed. Store them without recompression.
  return new Blob([new Uint8Array(zipSync(entries, { level: 0 }))], { type: 'application/zip' });
}

async function dimensions(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const image = new Image();
  try { image.src = url; await image.decode(); return { width: image.naturalWidth, height: image.naturalHeight }; }
  finally { image.removeAttribute('src'); URL.revokeObjectURL(url); }
}

/** Validates every entry before returning a new palace. Caller commits once, after success. */
export async function importPalace(file: Blob, inspect = dimensions): Promise<PalaceWithPayloads> {
  if (file.size > MAX_ARCHIVE || !file.size) throw new Error('Choose a Mind Palace ZIP backup smaller than 100 MB.');
  let manifest: Manifest;
  let entries: Record<string, Uint8Array>;
  try {
    let total = 0, count = 0;
    const seen = new Set<string>();
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: entry => {
      if ((entry.name !== 'palace.json' && !/^assets\/[0-9]+\.(png|jpg|webp)$/.test(entry.name)) || seen.has(entry.name)) throw new Error('Unexpected archive path.');
      seen.add(entry.name);
      total += entry.originalSize; count++;
      if (total > MAX_EXPANDED || count > 1000 || entry.originalSize > MAX_ARCHIVE || (entry.name === 'palace.json' && entry.originalSize > 2 * 1024 * 1024)) throw new Error('Archive exceeds demo limits.');
      return true;
    } });
    manifest = JSON.parse(strFromU8(entries['palace.json']));
    if (manifest.format !== 'mind-palace-backup' || manifest.version !== 1 || !Array.isArray(manifest.files)) throw new Error('Unsupported backup.');
    assertBackupShape(manifest.bundle);
    if (!manifest.files.every(f => f && typeof f.assetId === 'string' && typeof f.path === 'string' && typeof f.sha256 === 'string')) throw new Error('Invalid image manifest.');
    if (!validatePalaceBundle(manifest.bundle).ok) throw new Error('Invalid palace.');
  } catch { throw new Error('This is not a valid supported Mind Palace ZIP backup. No saved data was changed.'); }
  const bundle = manifest.bundle;
  const rows = [bundle.scenes, bundle.hotspots, bundle.memories, bundle.routes, bundle.practiceSessions, bundle.recallResults, bundle.assets];
  const allIds = [bundle.palace.id, ...rows.flatMap(collection => collection.map(row => row.id))];
  if (allIds.some(id => typeof id !== 'string' || !id) || new Set(allIds).size !== allIds.length) throw new Error('Backup contains invalid or duplicate IDs.');
  if (manifest.files.length !== bundle.assets.length || new Set(manifest.files.map(f => f.assetId)).size !== bundle.assets.length || Object.keys(entries).length !== manifest.files.length + 1 || new Set(manifest.files.map(f => f.path)).size !== manifest.files.length) throw new Error('Backup image manifest is incomplete.');
  const assetPayloads: PalaceWithPayloads['assetPayloads'] = [];
  for (const asset of bundle.assets) {
    if (!allowedMimes.includes(asset.mimeType) || asset.width * asset.height > 128_000_000) throw new Error('Backup contains an unsupported image.');
    const entry = manifest.files.find(f => f.assetId === asset.id);
    const bytes = entry && /^assets\/[0-9]+\.(png|jpg|webp)$/.test(entry.path) ? entries[entry.path] : undefined;
    if (!entry || !bytes || bytes.length !== asset.bytes || await checksum(bytes) !== entry.sha256) throw new Error('A backup image is missing or damaged.');
    const blob = new Blob([new Uint8Array(bytes)], { type: asset.mimeType });
    await assertRasterImage(blob);
    try {
      const actual = await inspect(blob);
      if (actual.width !== asset.width || actual.height !== asset.height) throw new Error('Dimensions mismatch');
    } catch { throw new Error('A backup image could not be decoded or has incorrect dimensions.'); }
    assetPayloads.push({ assetId: asset.id, blob });
  }
  const ids = new Map(allIds.map(id => [id, createId()]));
  const remap = (id: string) => {
    const mapped = ids.get(id);
    if (!mapped) throw new Error('Backup has a broken reference.');
    return mapped;
  };
  const optional = (id?: string) => id ? remap(id) : undefined;
  const now = new Date().toISOString();
  const next: PalaceWithPayloads = {
    schemaVersion: 1,
    palace: { ...bundle.palace, id: remap(bundle.palace.id), title: `${bundle.palace.title} (Restored)`, startSceneId: optional(bundle.palace.startSceneId), revision: 0, createdAt: now, updatedAt: now },
    scenes: bundle.scenes.map(s => ({ ...s, id: remap(s.id), palaceId: remap(s.palaceId), panoramaAssetId: remap(s.panoramaAssetId), thumbnailAssetId: optional(s.thumbnailAssetId) })),
    memories: bundle.memories.map(m => ({ ...m, id: remap(m.id), palaceId: remap(m.palaceId), imageAssetId: optional(m.imageAssetId) })),
    hotspots: bundle.hotspots.map(h => h.kind === 'memory' ? { ...h, id: remap(h.id), sceneId: remap(h.sceneId), customAssetId: optional(h.customAssetId), memoryId: remap(h.memoryId) } : { ...h, id: remap(h.id), sceneId: remap(h.sceneId), customAssetId: optional(h.customAssetId), targetSceneId: remap(h.targetSceneId) }),
    assets: bundle.assets.map(a => ({ ...a, id: remap(a.id), palaceId: remap(a.palaceId) })),
    routes: bundle.routes.map(r => ({ ...r, id: remap(r.id), palaceId: remap(r.palaceId), stops: r.stops.map(remap) })),
    practiceSessions: bundle.practiceSessions.map(s => ({ ...s, id: remap(s.id), palaceId: remap(s.palaceId), routeId: optional(s.routeId), parentSessionId: optional(s.parentSessionId), stopIds: s.stopIds.map(remap) })),
    recallResults: bundle.recallResults.map(r => ({ ...r, id: remap(r.id), sessionId: remap(r.sessionId), hotspotId: ids.get(r.hotspotId) ?? r.hotspotId, memoryId: ids.get(r.memoryId) ?? r.memoryId })),
    assetPayloads: assetPayloads.map(p => ({ ...p, assetId: remap(p.assetId) })),
  };
  if (!validatePalaceBundle(next).ok) throw new Error('Restored palace has broken references. No saved data was changed.');
  return next;
}
