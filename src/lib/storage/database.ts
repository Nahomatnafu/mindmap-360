import Dexie, { type EntityTable } from "dexie";
import type {
  AssetPayload,
  AssetRecord,
  Hotspot,
  Memory,
  Palace,
  PracticeSession,
  RecallResult,
  Route,
  Scene,
} from "@/lib/model/types";

export interface StorageMeta {
  key: string;
  value: string;
}

export class MindPalaceDatabase extends Dexie {
  palaces!: EntityTable<Palace, "id">;
  scenes!: EntityTable<Scene, "id">;
  hotspots!: EntityTable<Hotspot, "id">;
  memories!: EntityTable<Memory, "id">;
  routes!: EntityTable<Route, "id">;
  practiceSessions!: EntityTable<PracticeSession, "id">;
  recallResults!: EntityTable<RecallResult, "id">;
  assets!: EntityTable<AssetRecord, "id">;
  assetPayloads!: EntityTable<AssetPayload, "assetId">;
  meta!: EntityTable<StorageMeta, "key">;

  constructor(name = "mind-palace-360") {
    super(name);
    this.version(1).stores({
      palaces: "id, updatedAt",
      scenes: "id, palaceId, [palaceId+sortOrder]",
      hotspots: "id, sceneId, kind, memoryId, targetSceneId",
      memories: "id, palaceId",
      routes: "id, palaceId, updatedAt",
      practiceSessions: "id, palaceId, routeId, startedAt",
      recallResults: "id, sessionId, [sessionId+stopIndex]",
      assets: "id, palaceId, purpose",
      assetPayloads: "assetId",
      meta: "key",
    });
  }
}

export const mindPalaceDatabase = new MindPalaceDatabase();
