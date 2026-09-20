# Photo authoring status

Date: 2026-09-20
Branch: `codex/photo-authoring`

## Delivered

- Multi-file 360 panorama import with a 2:1 equirectangular validation check
- Named tour creation and browser-local image storage in IndexedDB
- Persisted palace, scene, asset, memory, and hotspot records through `PalaceRepository`
- Automatic bidirectional movement links between consecutive imported scenes
- Scene-scoped memory placement, editing, and deletion
- Batch scene-name editor that also updates movement labels
- Compact previous/next navigator and scene tray suitable for longer tours
- Distinct in-world designs for movement portals and memory markers
- Hidden bundled demo so a new workspace begins with the user's own tour
- Retired localStorage hook and cleaned the remaining legacy lint errors

## OpenView verification

Nine 3840×1920 panoramas were imported into a local `OpenView Homes` tour. They were named Front Entry, Entryway, Main Hall, Laundry, Living & Kitchen, Living Room, Kitchen, Back Patio, and Backyard.

The bottom navigator moved from Front Entry to Entryway. The in-world portal then moved from Entryway to Main Hall. In Edit mode, clicking a surface in Main Hall opened a new memory editor; the smoke-test editor was canceled without adding placeholder content.

The imported images are stored only in the browser's IndexedDB database. They are not copied into the repository or committed to Git.

## Verification

- Production build: passed
- Typecheck: passed
- Unit tests: 12 passed
- Full repository lint: passed with zero findings
