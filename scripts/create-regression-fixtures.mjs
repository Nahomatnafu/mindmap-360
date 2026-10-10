// Synthetic, recoverable QA data. No private property photo is read or exported.
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import sharp from 'sharp';
import { zipSync, strToU8 } from 'fflate';

const folder = new URL('../.preview-runtime/regression/', import.meta.url);
await mkdir(folder, { recursive: true });
const now = new Date().toISOString();
const raster = await sharp({ create: { width: 64, height: 64, channels: 4, background: '#00ccaa00' } })
  .composite([{ input: Buffer.from('<svg width="64" height="64"><circle cx="32" cy="32" r="24" fill="#f6b340"/><circle cx="32" cy="32" r="10" fill="#f1ffff"/></svg>') }]).png().toBuffer();
await writeFile(new URL('marker.png', folder), raster);
await writeFile(new URL('unsupported.svg', folder), '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
await writeFile(new URL('corrupt.zip', folder), 'This is deliberately not a ZIP');

async function fixture(title, sceneCount, memoryCount) {
  const palaceId = randomUUID();
  const bundle = { schemaVersion: 1, palace: { id: palaceId, title, createdAt: now, updatedAt: now, revision: 0 }, scenes: [], hotspots: [], memories: [], routes: [], practiceSessions: [], recallResults: [], assets: [] };
  const entries = {}, files = [];
  function asset(bytes, purpose, mimeType, width, height) {
    const id = randomUUID(), path = `assets/${files.length}.${mimeType === 'image/jpeg' ? 'jpg' : 'png'}`;
    bundle.assets.push({ id, palaceId, purpose, mimeType, width, height, bytes: bytes.length });
    entries[path] = bytes;
    files.push({ assetId: id, path, sha256: createHash('sha256').update(bytes).digest('hex') });
    return id;
  }
  for (let i = 0; i < sceneCount; i++) {
    const color = ['#467c9c', '#98604c', '#4c9872'][i % 3];
    const lines = Array.from({ length: 24 }, (_, x) => `<path d="M${x * 80} 0v960" stroke="#ffffff66"/>`).join('');
    const svg = `<svg width="1920" height="960"><rect width="1920" height="960" fill="${color}"/>${lines}<path d="M0 480h1920 M0 240h1920 M0 720h1920" stroke="#ffffff99" stroke-width="4"/></svg>`;
    const jpeg = await sharp(Buffer.from(svg)).jpeg({ quality: 75 }).toBuffer();
    await writeFile(new URL(`scene-${i + 1}.jpg`, folder), jpeg);
    bundle.scenes.push({ id: randomUUID(), palaceId, title: `QA Scene ${i + 1}`, panoramaAssetId: asset(jpeg, 'panorama-viewer', 'image/jpeg', 1920, 960), sortOrder: i, initialYaw: 0, initialPitch: 0, initialHfov: 95 });
  }
  bundle.palace.startSceneId = bundle.scenes[0].id;
  const memoryImage = asset(raster, 'memory-image', 'image/png', 64, 64);
  for (let i = 0; i < memoryCount; i++) {
    const memoryId = randomUUID(), scene = bundle.scenes[i % sceneCount];
    const dense = memoryCount > 10;
    const title = `QA Memory ${i + 1}`;
    bundle.memories.push({ id: memoryId, palaceId, title, body: `Regression note ${i + 1}. <b>This must be literal text</b>.`, imageAssetId: memoryImage });
    bundle.hotspots.push({ id: randomUUID(), kind: 'memory', sceneId: scene.id, memoryId, yaw: dense ? -170 + (i % 17) * 20 : -25 + i * 20, pitch: dense ? -42 + Math.floor(i / 17) * 14 : -12, label: title, iconKey: 'note', color: '#3b82f6', size: dense ? 24 : 40 });
  }
  for (let i = 0; i < sceneCount - 1; i++) {
    const from = bundle.scenes[i], to = bundle.scenes[i + 1];
    for (const [source, target] of [[from, to], [to, from]]) bundle.hotspots.push({ id: randomUUID(), kind: 'move', sceneId: source.id, targetSceneId: target.id, yaw: source === from ? 25 : -25, pitch: -28, label: `Walk to ${target.title}`, iconKey: 'walk', color: '#ffffff', size: 44, surface: 'floor' });
  }
  entries['palace.json'] = strToU8(JSON.stringify({ format: 'mind-palace-backup', version: 1, exportedAt: now, bundle, files }));
  await writeFile(new URL(`${memoryCount > 10 ? 'dense-118' : 'three-scenes'}.mindpalace.zip`, folder), zipSync(entries, { level: 0 }));
}
await fixture('QA Regression — three scenes', 3, 3);
await fixture('QA Density — 118 images', 1, 118);
console.log('Synthetic fixtures created in .preview-runtime/regression (ignored).');
