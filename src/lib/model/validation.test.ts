import { describe, expect, it } from "vitest";
import { EXPORT_SCHEMA_VERSION, type PalaceBundle } from "./types";
import { normalizeYaw, validatePalaceBundle } from "./validation";

const emptyBundle = (): PalaceBundle => ({
  schemaVersion: EXPORT_SCHEMA_VERSION,
  palace: {
    id: "palace-1",
    title: "Test palace",
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

describe("normalizeYaw", () => {
  it.each([
    [180, -180],
    [540, -180],
    [-181, 179],
    [45, 45],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeYaw(input)).toBe(expected);
  });
});

describe("validatePalaceBundle", () => {
  it("accepts an empty palace before photos are imported", () => {
    expect(validatePalaceBundle(emptyBundle())).toEqual({ ok: true, issues: [] });
  });

  it("rejects cross-palace scenes and missing panorama assets", () => {
    const bundle = emptyBundle();
    bundle.scenes.push({
      id: "scene-1",
      palaceId: "other-palace",
      title: "Hall",
      panoramaAssetId: "asset-missing",
      sortOrder: 0,
      initialYaw: 0,
      initialPitch: 0,
      initialHfov: 100,
    });

    const result = validatePalaceBundle(bundle);
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.path)).toContain("scenes.scene-1.palaceId");
    expect(result.issues.map((issue) => issue.path)).toContain("scenes.scene-1.panoramaAssetId");
  });

  it("requires route stops to be unique memory hotspots", () => {
    const bundle = emptyBundle();
    bundle.routes.push({
      id: "route-1",
      palaceId: "palace-1",
      title: "Route",
      stops: ["missing", "missing"],
      updatedAt: "2026-09-20T00:00:00.000Z",
    });

    const result = validatePalaceBundle(bundle);
    expect(result.issues.some((issue) => issue.message.includes("duplicate"))).toBe(true);
    expect(result.issues.some((issue) => issue.message.includes("not a memory hotspot"))).toBe(true);
  });
});
