export const EXPORT_SCHEMA_VERSION = 1;

export type Id = string;

export interface CameraPosition {
  yaw: number;
  pitch: number;
  hfov?: number;
}

export interface Palace {
  id: Id;
  title: string;
  startSceneId?: Id;
  createdAt: string;
  updatedAt: string;
  revision: number;
}

export interface Scene {
  id: Id;
  palaceId: Id;
  title: string;
  panoramaAssetId: Id;
  thumbnailAssetId?: Id;
  alternate?: boolean;
  sortOrder: number;
  initialYaw: number;
  initialPitch: number;
  initialHfov: number;
  pitchMin?: number;
  pitchMax?: number;
}

export interface HotspotAppearance {
  label: string;
  iconKey: string;
  customAssetId?: Id;
  color: string;
  size: number;
  surface?: 'floor' | 'wall';
}

interface HotspotBase extends HotspotAppearance {
  id: Id;
  sceneId: Id;
  yaw: number;
  pitch: number;
}

export interface MoveHotspot extends HotspotBase {
  kind: "move";
  targetSceneId: Id;
  targetYaw?: number;
  targetPitch?: number;
  targetHfov?: number;
  preserveView?: boolean;
}

export interface MemoryHotspot extends HotspotBase {
  kind: "memory";
  memoryId: Id;
}

export type Hotspot = MoveHotspot | MemoryHotspot;

export interface Memory {
  id: Id;
  palaceId: Id;
  title: string;
  body: string;
  prompt?: string;
  answer?: string;
  imageAssetId?: Id;
}

export interface Route {
  id: Id;
  palaceId: Id;
  title: string;
  stops: Id[];
  updatedAt: string;
}

export interface PracticeSession {
  id: Id;
  palaceId: Id;
  routeId?: Id;
  stopIds: Id[];
  startedAt: string;
  completedAt?: string;
  parentSessionId?: Id;
}

export interface RecallResult {
  id: Id;
  sessionId: Id;
  stopIndex: number;
  hotspotId: Id;
  memoryId: Id;
  result: "got" | "missed";
  at: string;
}

export type AssetPurpose =
  | "panorama-original"
  | "panorama-viewer"
  | "thumbnail"
  | "memory-image"
  | "marker-image";

export interface AssetRecord {
  id: Id;
  palaceId: Id;
  purpose: AssetPurpose;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
  bytes: number;
  checksum?: string;
}

export interface AssetPayload {
  assetId: Id;
  blob: Blob;
}

export interface PalaceBundle {
  schemaVersion: typeof EXPORT_SCHEMA_VERSION;
  palace: Palace;
  scenes: Scene[];
  hotspots: Hotspot[];
  memories: Memory[];
  routes: Route[];
  practiceSessions: PracticeSession[];
  recallResults: RecallResult[];
  assets: AssetRecord[];
}

export interface PalaceWithPayloads extends PalaceBundle {
  assetPayloads: AssetPayload[];
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}
