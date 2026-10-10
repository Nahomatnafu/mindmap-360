# Mind Palace 360 contributor guide

Read `PROTOTYPE_PLAN_V3.md` and your assigned task in `docs/TASKS.md` before making changes.

- Preserve source images. Never modify files in `D:/OpenView Homes_First AD_Batch/` and never commit private property photos.
- Keep panorama-engine types behind the viewer adapter. Application data models must remain engine-independent.
- Coordinate changes to the data model, persistence layer, dependencies, and lockfile with the current integration owner.
- Use a `codex/` branch for Codex work and a separate branch or worktree for each independently reviewable feature.
- Do not claim that a behavior works without running the relevant check. Report exact checks and remaining limitations.
- Show persistence failures in the interface. A failed IndexedDB write must never appear as successfully saved.
- Render memory content as text. Do not interpolate user-provided HTML or accept uploaded HTML/SVG in Phase 1.
- Continue unaffected work when a task needs a scope adjustment; record the dependency in `docs/TASKS.md`.
- Run the production build, type check, lint, and feature-specific tests before requesting integration.

The implementation owner controls shared contracts until they are committed. Reviewers should report actionable findings with file references and avoid unrelated rewrites.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
