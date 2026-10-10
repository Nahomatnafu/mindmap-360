import type { PalaceBundle } from '../model/types';

type Row = Record<string, unknown>;
function object(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid backup record.');
  return value as Row;
}
function fields(row: Row, required: string[], optional: string[] = [], numbers: string[] = [], lists: string[] = []) {
  for (const key of required) if (typeof row[key] !== 'string') throw new Error(`Invalid ${key}.`);
  for (const key of optional) if (row[key] !== undefined && typeof row[key] !== 'string') throw new Error(`Invalid ${key}.`);
  for (const key of numbers) if (typeof row[key] !== 'number' || !Number.isFinite(row[key])) throw new Error(`Invalid ${key}.`);
  for (const key of lists) if (!Array.isArray(row[key]) || row[key].some(v => typeof v !== 'string')) throw new Error(`Invalid ${key}.`);
}
function optionalNumber(row: Row, names: string[]) {
  for (const name of names) if (row[name] !== undefined && (typeof row[name] !== 'number' || !Number.isFinite(row[name]))) throw new Error(`Invalid ${name}.`);
}

/** Runtime boundary for JSON; model validation below checks relationships and ranges. */
export function assertBackupShape(value: unknown): asserts value is PalaceBundle {
  const bundle = object(value), palace = object(bundle.palace);
  fields(palace, ['id', 'title', 'createdAt', 'updatedAt'], ['startSceneId'], ['revision']);
  for (const name of ['scenes', 'hotspots', 'memories', 'routes', 'practiceSessions', 'recallResults', 'assets']) {
    const collection = bundle[name];
    if (!Array.isArray(collection) || collection.length > 10_000) throw new Error('Invalid collection.');
    for (const value of collection) {
      const row = object(value);
      fields(row, ['id']);
      if (name === 'scenes') {
        fields(row, ['palaceId', 'title', 'panoramaAssetId'], ['thumbnailAssetId'], ['sortOrder', 'initialYaw', 'initialPitch', 'initialHfov']);
        optionalNumber(row, ['pitchMin', 'pitchMax']);
        if (row.alternate !== undefined && typeof row.alternate !== 'boolean') throw new Error('Invalid alternate flag.');
      } else if (name === 'hotspots') {
        fields(row, ['sceneId', 'label', 'iconKey', 'color'], ['customAssetId'], ['yaw', 'pitch', 'size']);
        if (row.kind === 'memory') fields(row, ['memoryId']);
        else if (row.kind === 'move') fields(row, ['targetSceneId']);
        else throw new Error('Invalid hotspot kind.');
        optionalNumber(row, ['targetYaw', 'targetPitch', 'targetHfov']);
        if (row.surface !== undefined && !['floor', 'wall'].includes(row.surface as string)) throw new Error('Invalid surface.');
        if (row.preserveView !== undefined && typeof row.preserveView !== 'boolean') throw new Error('Invalid view flag.');
      } else if (name === 'memories') fields(row, ['palaceId', 'title', 'body'], ['prompt', 'answer', 'imageAssetId']);
      else if (name === 'routes') fields(row, ['palaceId', 'title', 'updatedAt'], [], [], ['stops']);
      else if (name === 'practiceSessions') fields(row, ['palaceId', 'startedAt'], ['routeId', 'completedAt', 'parentSessionId'], [], ['stopIds']);
      else if (name === 'recallResults') {
        fields(row, ['sessionId', 'hotspotId', 'memoryId', 'at'], [], ['stopIndex']);
        if (!['got', 'missed'].includes(row.result as string)) throw new Error('Invalid recall result.');
      } else {
        fields(row, ['palaceId', 'mimeType'], ['checksum'], ['width', 'height', 'bytes']);
        if (!['panorama-original', 'panorama-viewer', 'thumbnail', 'memory-image', 'marker-image'].includes(row.purpose as string)) throw new Error('Invalid asset purpose.');
      }
    }
  }
}
