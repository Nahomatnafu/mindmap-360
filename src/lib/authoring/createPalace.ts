import { EXPORT_SCHEMA_VERSION, type AssetPayload, type PalaceBundle } from '@/lib/model/types';
import { normalizeYaw } from '@/lib/model/validation';
import { createId } from '@/lib/model/ids';

export interface PanoramaSource {
  blob: Blob;
  name: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  width: number;
  height: number;
}

interface CreatePalaceOptions {
  now?: string;
  idFactory?: () => string;
}

const defaultIdFactory = createId;

const sceneTitle = (name: string, index: number) => {
  const withoutExtension = name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
  return withoutExtension || `Scene ${index + 1}`;
};

export function validatePanoramaSource(source: PanoramaSource): void {
  if (!source.width || !source.height) throw new Error(`${source.name} has invalid image dimensions.`);
  const ratio = source.width / source.height;
  if (Math.abs(ratio - 2) > 0.12) {
    throw new Error(`${source.name} is ${source.width}×${source.height}. A 360° equirectangular image should be close to a 2:1 ratio.`);
  }
}

export function createPalaceFromPanoramas(
  title: string,
  sources: PanoramaSource[],
  options: CreatePalaceOptions = {},
): { bundle: PalaceBundle; assetPayloads: AssetPayload[] } {
  if (!sources.length) throw new Error('Select at least one panorama.');
  sources.forEach(validatePanoramaSource);

  const idFactory = options.idFactory ?? defaultIdFactory;
  const now = options.now ?? new Date().toISOString();
  const palaceId = idFactory();

  const assets = sources.map((source) => ({
    id: idFactory(),
    palaceId,
    purpose: 'panorama-viewer' as const,
    mimeType: source.mimeType,
    width: source.width,
    height: source.height,
    bytes: source.blob.size,
  }));
  const scenes = sources.map((source, index) => ({
    id: idFactory(),
    palaceId,
    title: sceneTitle(source.name, index),
    panoramaAssetId: assets[index].id,
    sortOrder: index,
    initialYaw: 0,
    initialPitch: 0,
    initialHfov: 100,
  }));

  const hotspots = scenes.slice(0, -1).flatMap((scene, index) => {
    const next = scenes[index + 1];
    return [
      {
        id: idFactory(),
        kind: 'move' as const,
        sceneId: scene.id,
        targetSceneId: next.id,
        yaw: normalizeYaw(0),
        pitch: -22,
        label: `Walk to ${next.title}`,
        iconKey: 'walk',
        color: '#c9a84c',
        size: 44,
      },
      {
        id: idFactory(),
        kind: 'move' as const,
        sceneId: next.id,
        targetSceneId: scene.id,
        yaw: normalizeYaw(180),
        pitch: -22,
        label: `Walk to ${scene.title}`,
        iconKey: 'walk',
        color: '#c9a84c',
        size: 44,
      },
    ];
  });

  return {
    bundle: {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      palace: {
        id: palaceId,
        title: title.trim() || 'Untitled palace',
        startSceneId: scenes[0].id,
        createdAt: now,
        updatedAt: now,
        revision: 0,
      },
      scenes,
      hotspots,
      memories: [],
      routes: [],
      practiceSessions: [],
      recallResults: [],
      assets,
    },
    assetPayloads: assets.map((asset, index) => ({
      assetId: asset.id,
      blob: sources[index].blob,
    })),
  };
}
