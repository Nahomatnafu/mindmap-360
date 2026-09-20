# Mind Palace 360 task board

Updated September 20, 2026.

| Status | Branch | Owner | Scope | Depends on | Completion evidence |
|---|---|---|---|---|---|
| Complete | `codex/foundation-baseline` | Codex | Repository setup, patched dependencies, reproducible baseline, coordination docs, viewer decision | None | Build/typecheck pass; clean audit; baseline lint debt recorded; browser smoke check |
| In progress | `codex/local-model-storage` | Codex | Engine-independent model, validation, Dexie repository, repeatable legacy migration | Foundation/viewer decision | Core transaction, validation, conflict, and migration tests pass; UI integration continues on authoring branch |
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
