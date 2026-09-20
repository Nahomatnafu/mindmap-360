import { type Table } from "dexie";
import { validatePalaceBundle } from "@/lib/model/validation";
import type {
  AssetPayload,
  Palace,
  PalaceBundle,
  PalaceWithPayloads,
} from "@/lib/model/types";
import { MindPalaceDatabase, mindPalaceDatabase } from "./database";

export class PalaceValidationError extends Error {
  constructor(public readonly issues: ReturnType<typeof validatePalaceBundle>["issues"]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
    this.name = "PalaceValidationError";
  }
}

export class PalaceRevisionConflictError extends Error {
  constructor(public readonly expected: number, public readonly actual: number) {
    super(`Palace revision changed from ${expected} to ${actual}. Reload before saving.`);
    this.name = "PalaceRevisionConflictError";
  }
}

const replacePalaceRows = async <T, TKey, TInsert>(
  table: Table<T, TKey, TInsert>,
  rows: readonly TInsert[],
  existingKeys: TKey[],
) => {
  if (existingKeys.length) await table.bulkDelete(existingKeys);
  if (rows.length) await table.bulkPut(rows);
};

export class PalaceRepository {
  constructor(private readonly db: MindPalaceDatabase = mindPalaceDatabase) {}

  async listPalaces(): Promise<Palace[]> {
    return this.db.palaces.orderBy("updatedAt").reverse().toArray();
  }

  async loadPalace(palaceId: string): Promise<PalaceWithPayloads | undefined> {
    const palace = await this.db.palaces.get(palaceId);
    if (!palace) return undefined;

    const [scenes, memories, routes, practiceSessions, assets] = await Promise.all([
      this.db.scenes.where("palaceId").equals(palaceId).sortBy("sortOrder"),
      this.db.memories.where("palaceId").equals(palaceId).toArray(),
      this.db.routes.where("palaceId").equals(palaceId).toArray(),
      this.db.practiceSessions.where("palaceId").equals(palaceId).toArray(),
      this.db.assets.where("palaceId").equals(palaceId).toArray(),
    ]);
    const sceneIds = scenes.map((scene) => scene.id);
    const hotspots = sceneIds.length
      ? await this.db.hotspots.where("sceneId").anyOf(sceneIds).toArray()
      : [];
    const sessionIds = practiceSessions.map((session) => session.id);
    const recallResults = sessionIds.length
      ? await this.db.recallResults.where("sessionId").anyOf(sessionIds).toArray()
      : [];
    const assetIds = assets.map((asset) => asset.id);
    const assetPayloads = assetIds.length
      ? await this.db.assetPayloads.where("assetId").anyOf(assetIds).toArray()
      : [];

    return {
      schemaVersion: 1,
      palace,
      scenes,
      hotspots,
      memories,
      routes,
      practiceSessions,
      recallResults,
      assets,
      assetPayloads,
    };
  }

  async savePalace(
    bundle: PalaceBundle,
    assetPayloads: AssetPayload[] = [],
    expectedRevision?: number,
  ): Promise<Palace> {
    const validation = validatePalaceBundle(bundle);
    if (!validation.ok) throw new PalaceValidationError(validation.issues);

    const payloadIds = new Set(assetPayloads.map((payload) => payload.assetId));
    for (const assetId of payloadIds) {
      if (!bundle.assets.some((asset) => asset.id === assetId)) {
        throw new PalaceValidationError([{ path: `assetPayloads.${assetId}`, message: "Payload has no asset metadata." }]);
      }
    }

    return this.db.transaction("rw", this.db.tables, async () => {
      const existing = await this.db.palaces.get(bundle.palace.id);
      if (expectedRevision !== undefined && (existing?.revision ?? 0) !== expectedRevision) {
        throw new PalaceRevisionConflictError(expectedRevision, existing?.revision ?? 0);
      }

      const now = new Date().toISOString();
      const savedPalace: Palace = {
        ...bundle.palace,
        createdAt: existing?.createdAt ?? bundle.palace.createdAt ?? now,
        updatedAt: now,
        revision: (existing?.revision ?? 0) + 1,
      };

      const existingScenes = await this.db.scenes.where("palaceId").equals(savedPalace.id).primaryKeys();
      const existingMemories = await this.db.memories.where("palaceId").equals(savedPalace.id).primaryKeys();
      const existingRoutes = await this.db.routes.where("palaceId").equals(savedPalace.id).primaryKeys();
      const existingSessions = await this.db.practiceSessions.where("palaceId").equals(savedPalace.id).primaryKeys();
      const existingAssets = await this.db.assets.where("palaceId").equals(savedPalace.id).primaryKeys();
      const existingHotspots = existingScenes.length
        ? await this.db.hotspots.where("sceneId").anyOf(existingScenes).primaryKeys()
        : [];
      const existingResults = existingSessions.length
        ? await this.db.recallResults.where("sessionId").anyOf(existingSessions).primaryKeys()
        : [];

      await replacePalaceRows(this.db.recallResults, bundle.recallResults, existingResults);
      await replacePalaceRows(this.db.hotspots, bundle.hotspots, existingHotspots);
      await replacePalaceRows(this.db.practiceSessions, bundle.practiceSessions, existingSessions);
      await replacePalaceRows(this.db.routes, bundle.routes, existingRoutes);
      await replacePalaceRows(this.db.memories, bundle.memories, existingMemories);
      await replacePalaceRows(this.db.scenes, bundle.scenes, existingScenes);

      const removedAssetIds = existingAssets.filter((id) => !bundle.assets.some((asset) => asset.id === id));
      await replacePalaceRows(this.db.assets, bundle.assets, existingAssets);
      if (removedAssetIds.length) await this.db.assetPayloads.bulkDelete(removedAssetIds);
      if (assetPayloads.length) await this.db.assetPayloads.bulkPut(assetPayloads);
      await this.db.palaces.put(savedPalace);

      return savedPalace;
    });
  }

  async deletePalace(palaceId: string): Promise<void> {
    const bundle = await this.loadPalace(palaceId);
    if (!bundle) return;

    await this.db.transaction("rw", this.db.tables, async () => {
      await this.db.recallResults.bulkDelete(bundle.recallResults.map((row) => row.id));
      await this.db.practiceSessions.bulkDelete(bundle.practiceSessions.map((row) => row.id));
      await this.db.routes.bulkDelete(bundle.routes.map((row) => row.id));
      await this.db.hotspots.bulkDelete(bundle.hotspots.map((row) => row.id));
      await this.db.memories.bulkDelete(bundle.memories.map((row) => row.id));
      await this.db.scenes.bulkDelete(bundle.scenes.map((row) => row.id));
      await this.db.assetPayloads.bulkDelete(bundle.assets.map((row) => row.id));
      await this.db.assets.bulkDelete(bundle.assets.map((row) => row.id));
      await this.db.palaces.delete(palaceId);
    });
  }
}
