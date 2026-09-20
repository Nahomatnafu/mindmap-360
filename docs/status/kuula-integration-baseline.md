# Kuula integration baseline status

Date: 2026-09-20

## Source lineage

- Product/UI source: `origin/feature/kuula-api-integration` at `73b3922`
- Secure baseline replayed from: `a079538`
- Local model/storage replayed from: `326d644`
- Integration branch: `codex/kuula-integration-baseline`

The original branches remain unchanged as recovery points.

## Preserved from the newer branch

- Loci interface and design tokens
- Kuula Player API viewer and screen projection helpers
- Matterport SDK experiment
- Existing self-hosted Pannellum walkthrough
- Three included test panoramas

## Carried forward

- Patched Next.js, React, Pannellum, and Sharp dependencies
- Offline-safe system font stack
- Engine-independent palace, scene, hotspot, route, practice, and asset types
- Dexie repository, revision checks, and repeatable legacy migration
- Model and storage tests

## Verification

- Production build: passed
- Typecheck: passed
- Unit tests: 10 passed
- Dependency audit: 0 vulnerabilities
- Full lint: 19 errors and 11 warnings remain in legacy viewer, editor, context, hook, and image-script code

## Next integration boundary

The current UI still writes its legacy `Tour` and `Flashcard` shape to localStorage. The next authoring branch must adapt the UI to the new repository and add scene ownership to every navigation and memory hotspot before export/import or practice screens are wired in.
