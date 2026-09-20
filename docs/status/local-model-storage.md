# Local model and storage status

Date: 2026-09-20
Branch: `codex/local-model-storage`

## Implemented

- Engine-independent palace, scene, hotspot, memory, route, practice-session, result, and asset types.
- Discriminated movement and memory hotspot types.
- Coordinate, ownership, reference, route, and asset validation.
- Dexie schema with metadata and Blob payloads separated from asset records.
- Transactional palace save/load/delete operations.
- Revision checks that reject stale writes instead of silently overwriting them.
- Legacy localStorage parser that creates unassigned memories without inventing scene placement.
- Deterministic legacy IDs and a migration marker so interrupted migration can be retried without duplicating already imported palaces.

## Verification

- `npm test`: 2 files and 10 tests passed.
- `npm run build`: passed, including TypeScript validation.
- Focused ESLint on `src/lib` and `vitest.config.mts`: passed.
- `npm audit --audit-level=moderate`: 0 vulnerabilities.

## Remaining integration

The existing screen still uses the legacy `TourContext` and localStorage. The photo-authoring feature will replace that UI path with the new repository and visible loading/saving/error states. Keeping this commit focused makes the model and storage contract safe for parallel backup/import and practice work.

## Safe parallel branches

- `codex/backup-import`: implement versioned ZIP round-trip against `PalaceBundle`, `AssetRecord`, and `AssetPayload`.
- `codex/practice-routes`: implement route ordering and practice state against `Route`, `PracticeSession`, and `RecallResult`; avoid changing storage/model contracts without coordination.
- Fixture and derivative tooling can proceed independently without accessing or committing the private property photos.
