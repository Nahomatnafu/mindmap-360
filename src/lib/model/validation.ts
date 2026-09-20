import {
  EXPORT_SCHEMA_VERSION,
  type Hotspot,
  type PalaceBundle,
  type ValidationIssue,
  type ValidationResult,
} from "./types";

const isFiniteInRange = (value: number, min: number, max: number) =>
  Number.isFinite(value) && value >= min && value <= max;

const hasDuplicates = (values: string[]) => new Set(values).size !== values.length;

export function normalizeYaw(yaw: number): number {
  if (!Number.isFinite(yaw)) return yaw;
  return ((yaw + 180) % 360 + 360) % 360 - 180;
}

export function validateHotspotCoordinates(hotspot: Hotspot): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!Number.isFinite(hotspot.yaw) || hotspot.yaw < -180 || hotspot.yaw >= 180) {
    issues.push({ path: `hotspots.${hotspot.id}.yaw`, message: "Yaw must be in [-180, 180)." });
  }
  if (!isFiniteInRange(hotspot.pitch, -90, 90)) {
    issues.push({ path: `hotspots.${hotspot.id}.pitch`, message: "Pitch must be in [-90, 90]." });
  }
  if (!Number.isFinite(hotspot.size) || hotspot.size <= 0 || hotspot.size > 256) {
    issues.push({ path: `hotspots.${hotspot.id}.size`, message: "Marker size must be greater than 0 and at most 256." });
  }
  return issues;
}

export function validatePalaceBundle(bundle: PalaceBundle): ValidationResult {
  const issues: ValidationIssue[] = [];
  const sceneIds = new Set(bundle.scenes.map((scene) => scene.id));
  const hotspotIds = new Set(bundle.hotspots.map((hotspot) => hotspot.id));
  const memoryIds = new Set(bundle.memories.map((memory) => memory.id));
  const routeIds = new Set(bundle.routes.map((route) => route.id));
  const sessionIds = new Set(bundle.practiceSessions.map((session) => session.id));
  const assetIds = new Set(bundle.assets.map((asset) => asset.id));

  if (bundle.schemaVersion !== EXPORT_SCHEMA_VERSION) {
    issues.push({ path: "schemaVersion", message: `Unsupported schema version ${bundle.schemaVersion}.` });
  }
  if (!bundle.palace.id || !bundle.palace.title.trim()) {
    issues.push({ path: "palace", message: "A palace ID and title are required." });
  }
  if (bundle.palace.startSceneId && !sceneIds.has(bundle.palace.startSceneId)) {
    issues.push({ path: "palace.startSceneId", message: "Start scene does not exist in this palace." });
  }

  for (const scene of bundle.scenes) {
    if (scene.palaceId !== bundle.palace.id) {
      issues.push({ path: `scenes.${scene.id}.palaceId`, message: "Scene belongs to another palace." });
    }
    if (!assetIds.has(scene.panoramaAssetId)) {
      issues.push({ path: `scenes.${scene.id}.panoramaAssetId`, message: "Panorama asset is missing." });
    }
    if (scene.thumbnailAssetId && !assetIds.has(scene.thumbnailAssetId)) {
      issues.push({ path: `scenes.${scene.id}.thumbnailAssetId`, message: "Thumbnail asset is missing." });
    }
    if (!isFiniteInRange(scene.initialYaw, -180, 180) || scene.initialYaw === 180) {
      issues.push({ path: `scenes.${scene.id}.initialYaw`, message: "Initial yaw must be in [-180, 180)." });
    }
    if (!isFiniteInRange(scene.initialPitch, -90, 90)) {
      issues.push({ path: `scenes.${scene.id}.initialPitch`, message: "Initial pitch must be in [-90, 90]." });
    }
    if (!isFiniteInRange(scene.initialHfov, 20, 160)) {
      issues.push({ path: `scenes.${scene.id}.initialHfov`, message: "Initial field of view must be between 20 and 160." });
    }
  }

  for (const memory of bundle.memories) {
    if (memory.palaceId !== bundle.palace.id) {
      issues.push({ path: `memories.${memory.id}.palaceId`, message: "Memory belongs to another palace." });
    }
    if (memory.imageAssetId && !assetIds.has(memory.imageAssetId)) {
      issues.push({ path: `memories.${memory.id}.imageAssetId`, message: "Memory image is missing." });
    }
  }

  for (const asset of bundle.assets) {
    if (asset.palaceId !== bundle.palace.id) {
      issues.push({ path: `assets.${asset.id}.palaceId`, message: "Asset belongs to another palace." });
    }
    if (!Number.isInteger(asset.width) || asset.width <= 0 || !Number.isInteger(asset.height) || asset.height <= 0) {
      issues.push({ path: `assets.${asset.id}`, message: "Asset dimensions must be positive integers." });
    }
    if (!Number.isInteger(asset.bytes) || asset.bytes < 0) {
      issues.push({ path: `assets.${asset.id}.bytes`, message: "Asset byte count is invalid." });
    }
  }

  for (const hotspot of bundle.hotspots) {
    issues.push(...validateHotspotCoordinates(hotspot));
    if (!sceneIds.has(hotspot.sceneId)) {
      issues.push({ path: `hotspots.${hotspot.id}.sceneId`, message: "Hotspot scene is missing." });
    }
    if (hotspot.customAssetId && !assetIds.has(hotspot.customAssetId)) {
      issues.push({ path: `hotspots.${hotspot.id}.customAssetId`, message: "Custom marker asset is missing." });
    }
    if (hotspot.kind === "move" && !sceneIds.has(hotspot.targetSceneId)) {
      issues.push({ path: `hotspots.${hotspot.id}.targetSceneId`, message: "Movement target scene is missing." });
    }
    if (hotspot.kind === "memory" && !memoryIds.has(hotspot.memoryId)) {
      issues.push({ path: `hotspots.${hotspot.id}.memoryId`, message: "Memory reference is missing." });
    }
  }

  for (const route of bundle.routes) {
    if (route.palaceId !== bundle.palace.id) {
      issues.push({ path: `routes.${route.id}.palaceId`, message: "Route belongs to another palace." });
    }
    if (hasDuplicates(route.stops)) {
      issues.push({ path: `routes.${route.id}.stops`, message: "A route cannot contain duplicate stops in Phase 1." });
    }
    for (const hotspotId of route.stops) {
      const hotspot = bundle.hotspots.find((candidate) => candidate.id === hotspotId);
      if (!hotspotIds.has(hotspotId) || hotspot?.kind !== "memory") {
        issues.push({ path: `routes.${route.id}.stops`, message: `Route stop ${hotspotId} is not a memory hotspot.` });
      }
    }
  }

  for (const session of bundle.practiceSessions) {
    if (session.palaceId !== bundle.palace.id) {
      issues.push({ path: `practiceSessions.${session.id}.palaceId`, message: "Practice session belongs to another palace." });
    }
    if (session.routeId && !routeIds.has(session.routeId)) {
      issues.push({ path: `practiceSessions.${session.id}.routeId`, message: "Practice route is missing." });
    }
    for (const hotspotId of session.stopIds) {
      if (!hotspotIds.has(hotspotId)) {
        issues.push({ path: `practiceSessions.${session.id}.stopIds`, message: `Practice stop ${hotspotId} is missing.` });
      }
    }
  }

  for (const result of bundle.recallResults) {
    if (!sessionIds.has(result.sessionId)) {
      issues.push({ path: `recallResults.${result.id}.sessionId`, message: "Practice session is missing." });
    }
  }

  return { ok: issues.length === 0, issues };
}
