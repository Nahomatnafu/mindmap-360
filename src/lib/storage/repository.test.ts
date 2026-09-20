import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { EXPORT_SCHEMA_VERSION, type PalaceBundle } from "@/lib/model/types";
import { MindPalaceDatabase } from "./database";
import { parseLegacyTours } from "./legacyMigration";
import { PalaceRepository, PalaceRevisionConflictError } from "./repository";

const databases: MindPalaceDatabase[] = [];

const createRepository = () => {
  const db = new MindPalaceDatabase(`test-${crypto.randomUUID()}`);
  databases.push(db);
  return { db, repository: new PalaceRepository(db) };
};

const makeBundle = (): PalaceBundle => ({
  schemaVersion: EXPORT_SCHEMA_VERSION,
  palace: {
    id: "palace-1",
    title: "My palace",
    createdAt: "2026-09-20T00:00:00.000Z",
    updatedAt: "2026-09-20T00:00:00.000Z",
    revision: 0,
  },
  scenes: [],
  hotspots: [],
  memories: [],
  routes: [],
  practiceSessions: [],
  recallResults: [],
  assets: [],
});

afterEach(async () => {
  await Promise.all(databases.splice(0).map(async (db) => {
    db.close();
    await db.delete();
  }));
});

describe("PalaceRepository", () => {
  it("saves and reloads a palace with a committed revision", async () => {
    const { repository } = createRepository();
    const saved = await repository.savePalace(makeBundle(), [], 0);
    const loaded = await repository.loadPalace(saved.id);

    expect(saved.revision).toBe(1);
    expect(loaded?.palace.title).toBe("My palace");
    expect(loaded?.palace.revision).toBe(1);
  });

  it("rejects a stale revision", async () => {
    const { repository } = createRepository();
    await repository.savePalace(makeBundle(), [], 0);

    await expect(repository.savePalace(makeBundle(), [], 0))
      .rejects.toBeInstanceOf(PalaceRevisionConflictError);
  });
});

describe("legacy migration parser", () => {
  it("recovers flashcards as unassigned memories without inventing scenes", () => {
    const raw = JSON.stringify([{
      id: "old-tour-1",
      name: "Old tour",
      flashcards: [{ question: "Who?", answer: "Ada" }],
    }]);
    const [bundle] = parseLegacyTours(raw, "2026-09-20T00:00:00.000Z");
    const [sameBundle] = parseLegacyTours(raw, "2026-09-21T00:00:00.000Z");

    expect(bundle.palace.title).toBe("Old tour (Recovered)");
    expect(bundle.scenes).toEqual([]);
    expect(bundle.hotspots).toEqual([]);
    expect(bundle.memories).toHaveLength(1);
    expect(bundle.memories[0].prompt).toBe("Who?");
    expect(sameBundle.palace.id).toBe(bundle.palace.id);
    expect(sameBundle.memories[0].id).toBe(bundle.memories[0].id);
  });
});
