# Architecture decisions

## ADR-001: Branch-per-feature workflow

- **Status:** Accepted
- **Date:** 2026-09-20
- **Decision:** Use short-lived `codex/` feature branches. Establish the baseline on `codex/foundation-baseline`; create later feature branches from the latest integrated baseline. Use separate worktrees when multiple builders operate concurrently.
- **Reason:** Shared model and storage contracts need a single integration point, while bounded UI, backup, practice, and deployment work can be reviewed independently afterward.

## ADR-002: Retain Pannellum for Phase 1

- **Status:** Accepted
- **Date:** 2026-09-20
- **Decision:** Retain the patched Pannellum 2.5.7 engine for the Phase 1 implementation and place it behind the planned viewer adapter. Kuula remains a product reference and optional comparison harness.
- **Evidence:** The existing Pannellum implementation was run locally after the framework upgrade. The first panorama rendered, scene buttons loaded distinct panoramas, and Edit mode converted a panorama click into an angular position and opened the marker editor. Pannellum also exposes the scene-link, camera, custom-hotspot, and load-event primitives required by the Phase 1 adapter.
- **Tradeoff:** Photo Sphere Viewer has richer polygon and image-layer features, but those features are outside Phase 1. Switching engines now would replace working navigation before the product model and persistence layer exist.
- **Revisit when:** Polygon highlights, multiresolution requirements, or a measured Pannellum limitation becomes a committed milestone.
