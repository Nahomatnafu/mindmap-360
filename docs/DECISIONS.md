# Architecture decisions

## ADR-001: Branch-per-feature workflow

- **Status:** Accepted
- **Date:** 2026-09-20
- **Decision:** Use short-lived `codex/` feature branches. The current integration baseline is `codex/kuula-integration-baseline`; create later feature branches from its latest reviewed commit. Use separate worktrees when multiple builders operate concurrently.
- **Reason:** Shared model and storage contracts need a single integration point, while bounded UI, backup, practice, and deployment work can be reviewed independently afterward.

## ADR-002: Retain Pannellum for Phase 1

- **Status:** Accepted
- **Date:** 2026-09-20
- **Decision:** Retain the patched Pannellum 2.5.7 engine for the Phase 1 implementation and place it behind the planned viewer adapter. Kuula remains a product reference and optional comparison harness.
- **Evidence:** The existing Pannellum implementation was run locally after the framework upgrade. The first panorama rendered, scene buttons loaded distinct panoramas, and Edit mode converted a panorama click into an angular position and opened the marker editor. Pannellum also exposes the scene-link, camera, custom-hotspot, and load-event primitives required by the Phase 1 adapter.
- **Tradeoff:** Photo Sphere Viewer has richer polygon and image-layer features, but those features are outside Phase 1. Switching engines now would replace working navigation before the product model and persistence layer exist.
- **Revisit when:** Polygon highlights, multiresolution requirements, or a measured Pannellum limitation becomes a committed milestone.

## ADR-003: Treat hosted-player integrations as adapters

- **Status:** Accepted
- **Date:** 2026-09-20
- **Decision:** Preserve the Kuula and Matterport viewers as optional adapters for tours already hosted by those services. Use the self-hosted panorama viewer and the app's own data model for user-imported JPEGs, connections, memories, and backups.
- **Reason:** Kuula's public Player API controls an embedded Kuula tour but does not provide account upload, storage, or full tour-authoring APIs. Matterport similarly requires a hosted model and SDK credentials. The prototype must remain usable with the user's own local images and without either paid service.
- **Implementation consequence:** Normalize viewer events behind one adapter contract. Do not store product data solely inside a vendor embed or use a remote hotspot name as a database key.
