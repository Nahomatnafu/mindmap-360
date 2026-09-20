import { EXPORT_SCHEMA_VERSION, type Memory, type PalaceBundle } from "@/lib/model/types";
import type { PalaceRepository } from "./repository";
import type { MindPalaceDatabase } from "./database";

const LEGACY_MIGRATION_KEY = "legacy-local-storage-migration-v1";

interface LegacyFlashcard {
  question?: unknown;
  answer?: unknown;
}

interface LegacyTour {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  flashcards?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

const stableHash = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const safeIsoDate = (value: unknown, fallback: string) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
};

export function parseLegacyTours(raw: string, now = new Date().toISOString()): PalaceBundle[] {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("Legacy tour data is not valid JSON.");
  }
  if (!Array.isArray(value)) throw new Error("Legacy tour data must be an array.");

  return value.map((candidate, index) => {
    const legacy = candidate as LegacyTour;
    const identity = typeof legacy.id === "string" && legacy.id.trim()
      ? legacy.id.trim()
      : JSON.stringify([index, legacy.name, legacy.createdAt]);
    const palaceId = `legacy-palace-${stableHash(identity)}`;
    const memories: Memory[] = Array.isArray(legacy.flashcards)
      ? legacy.flashcards.flatMap((item, flashcardIndex) => {
          const flashcard = item as LegacyFlashcard;
          const question = typeof flashcard.question === "string" ? flashcard.question.trim() : "";
          const answer = typeof flashcard.answer === "string" ? flashcard.answer.trim() : "";
          if (!question && !answer) return [];
          return [{
            id: `legacy-memory-${stableHash(`${palaceId}:${flashcardIndex}:${question}:${answer}`)}`,
            palaceId,
            title: question || "Recovered memory",
            body: answer,
            prompt: question || undefined,
            answer: answer || undefined,
          }];
        })
      : [];
    const createdAt = safeIsoDate(legacy.createdAt, now);

    return {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      palace: {
        id: palaceId,
        title: typeof legacy.name === "string" && legacy.name.trim()
          ? `${legacy.name.trim()} (Recovered)`
          : `Recovered palace ${index + 1}`,
        createdAt,
        updatedAt: safeIsoDate(legacy.updatedAt, createdAt),
        revision: 0,
      },
      scenes: [],
      hotspots: [],
      memories,
      routes: [],
      practiceSessions: [],
      recallResults: [],
      assets: [],
    };
  });
}

export async function migrateLegacyLocalStorage(
  repository: PalaceRepository,
  db: MindPalaceDatabase,
  storage: Pick<Storage, "getItem">,
): Promise<{ status: "already-migrated" | "nothing-to-migrate" | "migrated"; palaceIds: string[] }> {
  if (await db.meta.get(LEGACY_MIGRATION_KEY)) {
    return { status: "already-migrated", palaceIds: [] };
  }

  const raw = storage.getItem("mindmap360-tours");
  if (!raw) {
    await db.meta.put({ key: LEGACY_MIGRATION_KEY, value: new Date().toISOString() });
    return { status: "nothing-to-migrate", palaceIds: [] };
  }

  const bundles = parseLegacyTours(raw);
  const palaceIds: string[] = [];
  for (const bundle of bundles) {
    const existing = await repository.loadPalace(bundle.palace.id);
    if (existing) {
      palaceIds.push(existing.palace.id);
      continue;
    }
    const saved = await repository.savePalace(bundle, [], 0);
    palaceIds.push(saved.id);
  }
  await db.meta.put({ key: LEGACY_MIGRATION_KEY, value: new Date().toISOString() });
  return { status: "migrated", palaceIds };
}
