# Mind Palace 360 — prototype implementation plan

Prepared September 19, 2026. This is a proposed build plan, not an implementation or runtime test report.

Build a personal memory palace from uploaded 360-degree photos. The first complete experience is: open a palace, move between viewpoints, click an object marker to open a poem or image, edit that marker, save, and reopen the same palace on another device.

## Feasibility and scope

A useful first version is moderate difficulty because panorama rendering and hotspot positioning already exist in open-source engines. Reliability of editing, persistence, media delivery, and access control is the main work. A focused evening can produce a narrow usable version; it should not be confused with a mature hosted product.

Planning estimate for one experienced developer, assisted by coding tools: 6–10 focused hours for the narrow hosted prototype if accounts and deployment access are ready; 3–7 focused working days for a dependable personal beta. These estimates are provisional until the existing app is built and tested. A commercial multi-user platform would take substantially longer.

The walkthrough will move between photo capture positions with transitions. Ordinary panoramas alone do not provide depth, arbitrary movement through a room, or a reconstructed dollhouse. Keep 3D reconstruction, VR, collaboration, billing, video editing, and automatic room-link inference outside this version.

## What is already present

Reviewed the GitHub default branch at commit `58e3616c6c763b653ab471e2fc32b412435f06ac` through the GitHub API. The current local workspace has an empty Git repository with no remote; it is not yet a checkout of the supplied project.

- Next.js 16.0.5, React 19.2, TypeScript, and Tailwind form the application shell.
- `TourViewer.tsx` renders `PannellumViewer.tsx`. There is also an older Kuula iframe implementation, and Photo Sphere Viewer packages are installed but are not used by the active viewer.
- Pannellum has three hard-coded scenes and navigation links.
- A flashcard editor supports question, answer, and color. Tour state is stored in localStorage.
- The repository contains an image-compression script using Sharp.

Code findings to address before extending the product:

1. Flashcards have no scene ID. Viewer initialization inserts every flashcard into every scene. Give every hotspot a scene owner and filter consistently during initial loading and subsequent changes.
2. Scene configuration is a global constant, so separate tours cannot own separate scene graphs. Move scenes and links into stored palace data.
3. Hotspot updates remove IDs from the new flashcard list. A deleted ID is absent from that list and can remain rendered. Reconcile against previously rendered IDs for each scene, including after scene changes.
4. The localStorage hook loads asynchronously, while sample initialization runs before it has an exposed hydration status. This creates a risk of replacing saved data with defaults. The setter also evaluates functional updates against captured state. Fix initialization and state-update sequencing before relying on this persistence path.
5. The editor is mouse-oriented, and panorama clicks can also reach hotspot interactions. Separate selection, navigation, panning, and explicit placement mode; support touch.
6. The active viewer injects a CDN script despite an installed Pannellum dependency. Bundle a single pinned engine client-side with cleanup and a visible loading/error state.
7. The compressor replaces original files. Change the pipeline to retain originals and write separate derivatives before using it on the supplied assets.

These are static code findings; the app has not been run, and no build or test pass is claimed.

## Architecture decisions

| Concern | Decision | Reason |
|---|---|---|
| App | Retain Next.js, React, TypeScript, Tailwind | Reuse the existing application and editor components |
| Viewer | Keep Pannellum for the first prototype | Existing scene navigation and native custom hotspots cover the initial experience |
| Viewer boundary | Small adapter for loading scenes, hotspots, camera state, and click coordinates | Keep application data independent of the rendering library |
| Database | Supabase Postgres | Store palaces, scenes, hotspots, and memory content |
| Identity | Supabase Auth | Support one owner now and additional accounts later |
| Images and files | Supabase Storage initially | Keep originals, viewer images, note attachments, and hotspot assets together |
| Application hosting | Vercel connected to the existing GitHub repo | Straightforward Next.js deployment and preview workflow |
| Cloudinary | Optional later media-processing provider | Useful for transformations and delivery; it does not replace the relational application database |

Pannellum supports scene links, custom hotspot DOM, angular positions, and destination camera settings. Put custom PNG/WebP images or trusted built-in icons inside native hotspot elements. Apply decorative scaling to an inner element so it does not overwrite the engine's positioning transform.

If tracing polygon highlights around furniture becomes essential, evaluate Photo Sphere Viewer in a bounded spike before building that feature. Its marker plugin supports polygons and image layers. Do not maintain two production viewers in the first release.

## Product behavior

Use a large panorama canvas with a collapsible scene list on the left and a properties panel on the right. On mobile, use drawers and a bottom sheet. Keep a clear Edit / Explore switch.

In Edit mode, choose Add hotspot, then tap a location. The inspector lets the owner choose:

- **Move:** select a destination scene and its arrival direction. Place a return link independently; the opposite yaw is not necessarily the correct return location.
- **Memory:** enter a title and multiline text, preserving poem line breaks, and optionally attach an image. Reuse the existing question/answer content as an optional flashcard style.

Each hotspot can have a label, color, size, built-in icon, or uploaded transparent PNG/WebP asset. Provide a Reposition action for the first version; direct dragging can follow. Use a halo or ring as the initial object highlight. A marker remains attached to an angular location in one photograph; it does not automatically track the same couch across different photos.

In Explore mode, movement hotspots change scenes and memory hotspots open a readable panel. Include a room list and memory list so users can navigate without hunting visually. Notes should support keyboard activation, Escape to close, sensible focus handling, and reduced-motion transitions.

Editing means authoring the tour, links, camera starts, and annotations. Retouching, stitching, or changing objects inside the source photos is a separate feature.

## Data model

| Entity | Minimum fields |
|---|---|
| Palace | `id`, `owner_id`, `title`, `start_scene_id`, `created_at`, `updated_at` |
| Scene | `id`, `palace_id`, `title`, `panorama_asset_id`, `thumbnail_asset_id`, `sort_order`, `initial_yaw`, `initial_pitch`, `initial_hfov` |
| Hotspot | `id`, `scene_id`, `kind`, `yaw`, `pitch`, `label`, `icon_key`, `custom_asset_id`, `color`, `size`, optional `target_scene_id`, destination camera settings, optional `memory_id` |
| Memory | `id`, `palace_id`, `title`, `body`, optional question/answer fields and image asset reference |
| Asset | `id`, `palace_id`, `storage_path`, `purpose`, `mime_type`, dimensions, byte count, processing status |

Use UUIDs and one documented coordinate convention: degrees, yaw normalized to [-180, 180), pitch within [-90, 90]. Translate to engine-specific conventions only in the adapter. Store object paths, not expiring signed URLs.

Enforce required targets for movement hotspots and required memory references for memory hotspots. Validate that all referenced scenes, memories, and assets belong to the same palace. Prevent deleting the start scene until another is selected; remove or repair inbound links when a scene is deleted.

Version imported/exported data. Back up any existing browser data before migration. Old flashcards have no scene attribution: ask the owner to assign them or place them in an explicitly labeled recovery scene, rather than silently duplicating them across rooms.

## Ordered build milestones

| Milestone | Work | Completion check |
|---|---|---|
| 1. Establish baseline, 30–60 min | Check out existing code; install locked dependencies; audit applicable framework patches; run build and lint; capture current behavior | Existing panoramas open; baseline failures are recorded and critical ones resolved |
| 2. Correct model and persistence, 1–1.5 h | Replace global scenes with palace-owned data; add scene IDs; fix hydration and hotspot reconciliation; preserve legacy data | A note appears only in its scene, deletion persists, and reload retains saved data |
| 3. Author the experience, 1.5–2 h | Explicit hotspot placement; movement links and arrival view; memory panel; custom asset styling; edit/reposition/delete | Three real scenes form a usable route, with a poem marker and image marker |
| 4. Add hosted storage, 1.5–2.5 h | Supabase migrations, Auth, database/storage access policies, direct uploads, cloud save/load, retry states | Signing in from a second browser retrieves the same palace and assets |
| 5. Deploy and verify, 1.5–3 h | Deploy Next.js; configure environment and auth redirect URLs; exercise desktop/mobile, failure cases, and access checks | Hosted URL works after refresh, memory edits survive, and another account cannot read the owner's palace |

The timeboxes total roughly 6–10 hours and are estimates, not guarantees. If the evening is shorter, finish milestones 1–3 and preserve the work with local persistence and export. Label that explicitly as a local prototype; cloud synchronization and hosting remain incomplete until milestones 4–5 pass.

## Saving, uploads, and access

Use an explicit Save action for the first version with visible Saving, Saved, and Failed states. Keep failed edits available for retry. Add debounced autosave once this path works. Use a revision or `updated_at` check to detect stale writes from a second tab rather than silently overwriting them.

Keep palaces private by default. Enable row-level security on application tables and policies on storage objects, with ownership checked through the palace. Use private storage and authorized, renewable signed media URLs. Keep privileged Supabase credentials server-side. Hosting a website does not require publishing its private contents.

Upload directly to storage after authentication and policy checks, rather than sending large files through the app host. Verify file type, size, decodability, dimensions, and ownership. Show upload progress and retry. Do not create a ready scene before its panorama is available; remove abandoned upload objects safely later.

Use plain text or safely rendered Markdown for memory content. Do not interpolate user notes into hotspot HTML. Initially allow PNG/WebP uploads and trusted built-in vector icons; arbitrary uploaded HTML/SVG is unnecessary for the prototype.

Read-only sharing is the next milestone after private persistence. Implement private/public visibility explicitly, serve only the approved published data, and check related assets too. Treat an unlisted link as accessible to anyone who receives it; it is not equivalent to authenticated privacy. Add publish snapshots before offering editing of live shared tours.

## Supplied-image and performance plan

Inspected the file metadata for all nine JPGs in `D:/OpenView Homes_First AD_Batch/`: each is 3840 × 1920, approximately 2.9–4.4 MiB, totaling about 32 MiB. Visually inspected images 01 and 03. Image 03 shows a usable interior scene. Image 01 has a large blank lower area already present in the source; inspect it in the viewer and either omit it from the initial route or apply appropriate viewing limits. A 2:1 ratio alone does not prove complete spherical coverage.

- Start with three visually verified interior views. Confirm adjacency from the images; filenames are not proof of physical order.
- Keep originals unchanged and outside the public application bundle.
- Generate small thumbnails and optimized viewer copies without cropping or stretching the panorama. Compare JPEG/WebP visually around text, seams, and fine details.
- Load the active panorama first; optionally prefetch one likely destination. Do not decode all nine images on startup.
- A 3840 × 1920 RGBA image alone is about 28 MiB decoded before GPU and transition overhead, so compressed download size is not the complete memory cost.
- Show a preview/loading indicator, keep the last usable scene on navigation failure, and offer retry.
- Start with single-image panoramas at this resolution. Add multiresolution tiles when larger originals or measured mobile performance justify them.

Proposed performance acceptance targets: visible loading feedback immediately, first useful panorama within roughly three seconds on a defined broadband test profile, cached scene changes around one second or less, and smooth panning on representative desktop and phone hardware. Measure and record actual results; these are targets, not observed performance.

## Definition of a stable personal prototype

1. Import the nine source files with clear per-file status, and manually connect at least three valid scenes.
2. Create a poem note and an image note, customize their markers, reposition one, and delete another.
3. Pan, zoom, switch rooms, leave and return: markers remain anchored and scene-specific, with no duplicate or stale hotspots.
4. Reload and sign in from a second browser: cloud-saved scenes, links, content, and styling survive.
5. Test touch navigation, placement, panel scrolling, keyboard activation, and narrow layouts.
6. Simulate a failed save, failed image request, expired signed URL, and invalid upload. Show actionable recovery without claiming success or losing edits.
7. Verify database and media access using a second account and a signed-out session, not just by hiding editor buttons.
8. Pass build, type checks, lint, targeted schema/access tests, and one end-to-end create → link → annotate → save → reload flow.

After these pass, prioritize autosave and recovery, export/import, read-only sharing, memory search, ordered recall paths, then polygon highlights. Keep memory content and angular hotspot coordinates separate from the viewer so a future VR interface can reuse them; VR interaction itself will require dedicated work.

## References

- [Existing repository](https://github.com/Nahomatnafu/mindmap-360)
- [Pannellum custom hotspots](https://pannellum.org/documentation/examples/custom-hot-spots/)
- [Pannellum tour example](https://pannellum.org/documentation/examples/tour/)
- [Pannellum configuration reference](https://pannellum.org/documentation/reference/)
- [Photo Sphere Viewer marker types](https://photo-sphere-viewer.js.org/plugins/markers)
- [Supabase private and public storage buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Vercel GitHub deployment integration](https://vercel.com/docs/git/vercel-for-github)
- [Cloudinary media upload API](https://cloudinary.com/documentation/image_upload_api_reference)
