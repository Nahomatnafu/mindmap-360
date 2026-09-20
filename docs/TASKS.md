# Mind Palace 360 task board

Updated September 20, 2026.

| Status | Branch | Owner | Scope | Depends on | Completion evidence |
|---|---|---|---|---|---|
| In progress | `codex/foundation-baseline` | Codex | Repository setup, patched dependencies, reproducible baseline, coordination docs, viewer decision | None | Build/audit/lint results recorded; branch committed |
| Planned | `codex/local-model-storage` | Unassigned | Engine-independent model, validation, Dexie repository, migration, visible save state | Foundation/viewer decision | Transaction and migration tests; reload verification |
| Planned | `codex/backup-import` | Unassigned | Versioned ZIP export/import and validation | Local model/storage | Fresh-browser round trip and invalid-archive test |
| Planned | `codex/photo-authoring` | Unassigned | Photo import, scene ownership, placement, movement links, memory markers | Local model/storage and viewer adapter | Three-scene authoring flow verified |
| Planned | `codex/practice-routes` | Unassigned | Ordered routes, guided practice, session results, retry missed | Stable model and viewer adapter | Five-stop practice flow verified |
| Planned | `codex/hosted-demo` | Unassigned | Stable deployment, owned demo assets, phone verification | Foundation; can begin after viewer decision | Desktop/phone preview evidence |

## Partition point

Do not split model, storage, viewer contracts, and authoring across independent implementations before the contracts land. Once `codex/local-model-storage` defines and commits the shared interfaces, the work can be partitioned safely:

- A second builder can own `codex/practice-routes` against the committed interfaces.
- Another model can build fixture/image tooling or `codex/hosted-demo` without touching private images.
- Export/import can run in parallel with authoring only after asset and repository interfaces are stable.

One owner must coordinate `package.json` and `package-lock.json` changes across active branches.
