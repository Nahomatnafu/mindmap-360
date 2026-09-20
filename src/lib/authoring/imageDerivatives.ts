import type { AssetRecord, PalaceWithPayloads } from '../model/types';

export interface ImageDerivative {
  blob: Blob;
  width: number;
  height: number;
}

interface DecodedImage {
  image: CanvasImageSource;
  width: number;
  height: number;
  release(): void;
}

async function decodeImage(blob: Blob): Promise<DecodedImage> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.type)) {
    throw new Error('Only JPEG, PNG, and WebP photos can be optimized.');
  }
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob);
    return { image: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  }
  const url = URL.createObjectURL(blob);
  const image = new Image();
  try {
    image.src = url;
    await image.decode();
    return {
      image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => { image.removeAttribute('src'); URL.revokeObjectURL(url); },
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

async function encodeImage(image: DecodedImage, maxWidth: number, quality: number): Promise<ImageDerivative> {
  if (!image.width || !image.height) throw new Error('The photo has invalid dimensions.');
  const width = Math.min(image.width, maxWidth);
  const height = Math.max(1, Math.round(image.height * width / image.width));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  try {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser could not prepare a photo preview.');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image.image, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Photo compression failed.')), 'image/jpeg', quality);
    });
    return { blob, width, height };
  } finally {
    // Reset the backing buffer even when encoding fails.
    canvas.width = 0;
    canvas.height = 0;
  }
}

/** A small temporary equirectangular image for live marker placement; callers own its object URL. */
export async function createEditingPreview(blob: Blob): Promise<ImageDerivative> {
  const decoded = await decodeImage(blob);
  try {
    return await encodeImage(decoded, 1536, 0.65);
  } finally {
    decoded.release();
  }
}

// UUIDv8 identifiers make retries deterministic without adding persisted model fields.
async function derivativeId(sourceId: string, kind: 'viewer' | 'thumbnail'): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`mind-palace:image-v1:${sourceId}:${kind}`)));
  digest[6] = (digest[6] & 0x0f) | 0x80;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = Array.from(digest.slice(0, 16), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Produces a new bundle only. The caller must persist it and report transaction failures. */
export async function optimizePalaceImages(
  bundle: PalaceWithPayloads,
  onProgress?: (completed: number, total: number) => void,
): Promise<PalaceWithPayloads> {
  const assets = new Map(bundle.assets.map((asset) => [asset.id, { ...asset }]));
  const payloads = new Map(bundle.assetPayloads.map((payload) => [payload.assetId, payload]));
  const scenes = bundle.scenes.map((scene) => ({ ...scene }));
  const originalsByViewer = new Map<string, string>();
  for (const asset of bundle.assets) {
    if (asset.purpose === 'panorama-original') originalsByViewer.set(await derivativeId(asset.id, 'viewer'), asset.id);
  }
  let completed = 0;
  onProgress?.(completed, scenes.length);

  // Only one full-resolution decode is alive at a time, including during JPEG encoding.
  for (const scene of scenes) {
    const sourceId = originalsByViewer.get(scene.panoramaAssetId) ?? scene.panoramaAssetId;
    const source = assets.get(sourceId);
    const sourcePayload = payloads.get(sourceId);
    if (!source || !sourcePayload) throw new Error(`The original photo for “${scene.title}” is missing.`);
    const viewerId = await derivativeId(sourceId, 'viewer');
    const thumbnailId = await derivativeId(sourceId, 'thumbnail');
    const needsViewer = !assets.has(viewerId) || !payloads.has(viewerId);
    const existingThumbnailId = scene.thumbnailAssetId;
    const hasExistingThumbnail = !!existingThumbnailId && assets.has(existingThumbnailId) && payloads.has(existingThumbnailId);
    const needsThumbnail = !hasExistingThumbnail && (!assets.has(thumbnailId) || !payloads.has(thumbnailId));

    if (needsViewer || needsThumbnail) {
      const decoded = await decodeImage(sourcePayload.blob);
      try {
        const addDerivative = (id: string, purpose: AssetRecord['purpose'], derivative: ImageDerivative) => {
          assets.set(id, { id, palaceId: bundle.palace.id, purpose, mimeType: 'image/jpeg', width: derivative.width, height: derivative.height, bytes: derivative.blob.size });
          payloads.set(id, { assetId: id, blob: derivative.blob });
        };
        if (needsViewer) addDerivative(viewerId, 'panorama-viewer', await encodeImage(decoded, 3840, 0.8));
        if (needsThumbnail) addDerivative(thumbnailId, 'thumbnail', await encodeImage(decoded, 512, 0.7));
      } finally {
        decoded.release();
      }
    }
    assets.set(sourceId, { ...source, purpose: 'panorama-original' });
    originalsByViewer.set(viewerId, sourceId);
    scene.panoramaAssetId = viewerId;
    if (!hasExistingThumbnail) scene.thumbnailAssetId = thumbnailId;
    onProgress?.(++completed, scenes.length);
  }
  return { ...bundle, scenes, assets: Array.from(assets.values()), assetPayloads: Array.from(payloads.values()) };
}
