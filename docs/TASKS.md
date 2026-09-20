# Mind Palace 360 task board

Updated September 20, 2026.

| Status | Branch | Owner | Scope | Depends on | Completion evidence |
|---|---|---|---|---|---|
| Superseded | `codex/foundation-baseline` | Codex | First secure baseline built from `master`; retained as a recovery point | None | Replaced by the newer Kuula branch integration |
| Complete | `codex/local-model-storage` | Codex | Engine-independent model, validation, Dexie repository, repeatable legacy migration | Foundation/viewer decision | Core transaction, validation, conflict, and migration tests pass |
| Complete | `codex/kuula-integration-baseline` | Codex | Newer Kuula/Matterport/Loci UI plus patched dependencies and the tested data layer | `feature/kuula-api-integration`, local model/storage | Build, typecheck, 10 tests, and audit pass; legacy lint debt recorded |
| Planned | `codex/backup-import` | Unassigned | Versioned ZIP export/import and validation | Local model/storage | Fresh-browser round trip and invalid-archive test |
| Complete | `codex/photo-authoring` | Codex | Multi-photo import, scene naming, IndexedDB persistence, scene-scoped memories, movement portals, responsive scene navigator | Local model/storage and viewer adapter | Nine-scene OpenView tour verified; portal, previous/next, and memory placement flows pass |
| Planned | `codex/practice-routes` | Unassigned | Ordered routes, guided practice, session results, retry missed | Stable model and viewer adapter | Five-stop practice flow verified |
| Planned | `codex/hosted-demo` | Unassigned | Stable deployment, owned demo assets, phone verification | Foundation; can begin after viewer decision | Desktop/phone preview evidence |
| Complete | `codex/image-previews` | Image pipeline agent | Preserve originals; generate 3840px viewer images, 512px thumbnails, and temporary 1536px editing previews | Photo authoring | Three derivative tests; applied to the nine-photo browser tour |
| Complete | `codex/note-workflow` | Notes agent | Explicit placement, readable notes, awaited saves, modal editing | Photo authoring | Couch sample saved, opened, reloaded, and reopened through sidebar |
| Complete | `codex/spatial-tour-editor` | Integration owner with spatial review agent | Floor rings, wall circles, reviewed room graph, live placement map, stable viewer lifecycle | Image previews and note workflow | Production build, typecheck, lint, 20 tests; browser navigation and responsive editor verified |
| Ready for user phone test | `codex/phone-preview` | Codex | Opt-in one-image sample; production server on home Wi-Fi; local HTTP note IDs | Spatial tour editor | Production build, lint, 23 tests; Wi-Fi URL renders sample in browser. Physical phone verification pending |
| Ready for physical phone test | `codex/phone-motion` | Codex | Permission-aware motion view, sensor readiness, recenter, smaller notes | Phone preview; approved HTTPS tunnel | Build, typecheck, lint, 28 tests; actual HTTP restriction and small marker verified; restricted HTTPS preview running. User explicitly expanded scope to motion controls |

## Partition point

New feature branches should start from `codex/spatial-tour-editor`. The model and storage contracts are now committed, so bounded work can be partitioned safely:

- A second builder can own `codex/practice-routes` against the committed interfaces.
- Another model can build fixture/image tooling or `codex/hosted-demo` without touching private images.
- Export/import can run in parallel with authoring only after asset and repository interfaces are stable.

One owner must coordinate `package.json`, `package-lock.json`, viewer adapter, and persistence contract changes across active branches. The UI now reads and writes the repository. See `docs/status/spatial-tour-editor.md` for the reviewed implementation and remaining limits.
