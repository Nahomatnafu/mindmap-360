# Mind Palace 360 — prototype plan (v3)

This is a build specification, not an implementation or test report. The code findings below come from the earlier static review of GitHub commit `58e3616`; recheck the current branch before implementation. No build, migration, deployment, or runtime test is claimed by this document.

## 1. Goal and delivery stages

Build a personal memory palace from 360° equirectangular photos. Import viewpoints, connect them with movement hotspots, attach poems or images to recognizable objects, and practice recalling those memories along an ordered route.

**First usable build:** import three scenes, connect them, create and customize memory markers, save locally, export a complete backup, and restore it in another browser. Serve the application at a stable hosted URL.

**Completed Phase 1:** add guided Practice mode, route authoring, session results, and retrying missed stops. Verify the full experience on desktop and a phone.

**Phase 2:** add accounts and cloud-backed saving. Cross-device synchronization, sharing, and offline synchronization are separate decisions rather than implicit capabilities.

The walkthrough moves between photographed viewpoints. Free movement, depth reconstruction, and a Matterport-style dollhouse are outside this scope.

## 2. What changed from v2

- Backup and restore move immediately after local persistence, before substantial authoring.
- Website hosting stays in Phase 1, using a stable origin; cloud data storage remains in Phase 2.
- Photo import becomes an explicit feature with progress, validation, and failure handling.
- The viewer adapter includes scene-loading completion, camera movement, and viewer events needed by Practice mode.
- Recall results belong to a specific practice session.
- A minimal ordered practice experience comes before a polished route editor.
- One implementation owner and one reviewer are the default workflow. Additional agents and phone notifications are optional.
- The full Phase 1 budget is approximately 12–20 focused hours, including verification. A shorter first session targets the usable authoring and backup path.

## 3. Scope

| First usable build | Complete Phase 1 | Phase 2 and later |
|---|---|---|
| Import and name scenes | Ordered route builder | Authentication |
| Movement links and arrival views | Guided recall sessions | Cloud-backed database and media |
| Text/image memory hotspots | Got it / Missed scoring | Cross-device access |
| Custom marker appearance | Retry missed stops | Read-only sharing |
| Reposition and delete | Session history sufficient for verification | Search and spaced repetition |
| IndexedDB saving | Broader mobile and failure testing | Optional offline synchronization |
| ZIP export and restore | Tested integrated release | Later VR exploration |
| Stable hosted app and demo | | |

Keep polygon highlights, uploaded HTML/SVG, video, gyroscope controls, photo retouching, automatic scene-link inference, collaboration, billing, and full offline launch outside Phase 1. A viewer supporting an extra feature is not a reason to expand scope.

Local persistence does not imply that the application can launch without a network connection. A service worker and offline update strategy would be separate work.

## 4. Existing foundation and corrections

The reviewed repository uses Next.js, React, TypeScript, and Tailwind. `TourViewer.tsx` renders Pannellum, with three hard-coded scenes and a flashcard editor. Photo Sphere Viewer core and markers packages are also installed. Its virtual-tour plugin is a separate package and would need to be added if chosen. The older Kuula iframe component is not the active viewer.

Address these findings before extending the product:

1. **Missing scene ownership:** flashcards have no scene ID and are inserted into every scene. Every hotspot must belong to exactly one scene.
2. **Global scene configuration:** replace the shared constant with palace-owned scenes and links.
3. **Stale rendered hotspots:** reconcile against previously rendered IDs, including deletions and scene switches.
4. **Initialization and stale-state risks:** replace the browser-storage path with explicit `loading | ready | error` states. Never seed defaults until loading is complete and the database is genuinely empty.
5. **Interaction conflicts:** distinguish panning, selecting, navigating, and explicit placement. Implement touch placement rather than relying on mouse events.
6. **Viewer lifecycle:** load a single pinned engine client-side, remove the redundant CDN injection, and clean up listeners and viewer instances.
7. **Destructive image processing:** preserve source files. Produce thumbnails and optimized copies separately.

At the earlier inspection, the GitHub default branch was `master`, and the local workspace was an empty Git repository without a remote. Verify both before checkout; do not assume the default branch is `main` or overwrite the plan files in this workspace.

## 5. Architecture

| Concern | Decision |
|---|---|
| Application | Retain Next.js, React, TypeScript, and Tailwind |
| Baseline maintenance | Check current security advisories; apply compatible patched Next.js/React versions and commit the lockfile |
| Viewer | Keep Pannellum unless a bounded comparison demonstrates a concrete reason to switch |
| Viewer isolation | Engine-independent adapter; application models never import engine types |
| Local database | IndexedDB through Dexie |
| Files | IndexedDB Blobs, resolved to temporary object URLs for rendering |
| Backup | Versioned ZIP containing `palace.json` and `assets/` |
| Hosting | Vercel, with one stable URL for personal use |
| Demo content | Small owned or appropriately licensed panoramas, separate from private test assets |
| Future cloud | Supabase Auth, Postgres, and private Storage |

Separate application metadata from file access. The asset interface should offer operations such as `putAsset`, `readAsset`, and `deleteAsset`; application components should not depend on how Dexie stores a Blob. A cloud backend will need its own implementation and migration work.

### Viewer comparison — maximum one hour

Use the same small fixture in both engines: three scenes, one movement link, one custom image marker, and one memory marker. Assess:

- Accurate positioning while panning and zooming.
- Touch selection and placement without accidental extra markers.
- Scene switching, arrival camera, and programmatic focus on a marker.
- Loading/error handling and cleanup when switching or unmounting.
- Integration effort and behavior on the target phone.

Write the decision and evidence in `docs/DECISIONS.md`. If the hour does not reveal a material advantage, retain Pannellum. Only one engine ships. Remove unused viewer dependencies and obsolete implementation paths once the chosen path works.

Use Kuula as a product-behavior reference during this comparison, not as a third rendering-engine candidate. Compare the prototype's basic authoring and navigation experience with Kuula's documented hotspots, connections, backlinks, initial heading, custom icons, cards, and transitions. The existing Kuula iframe component may remain temporarily as a comparison harness, but the Phase 1 palace must work from locally imported files without requiring a Kuula-hosted tour.

### Viewer adapter contract

The exact TypeScript types are implementation work, but the contract must include:

- `loadScene(scene, camera?): Promise<void>` — resolves when navigation is ready; rejects on failure.
- `setHotspots(hotspots)` — reconciles the current scene's markers, including removals.
- `getCamera()` — returns yaw, pitch, and horizontal field of view.
- `lookAt(camera, options?): Promise<void>` — supports reduced-motion behavior.
- Placement and hotspot-selection callbacks that are distinct from panorama drag gestures.
- Scene-change, loading, and error subscriptions with unsubscribe functions.
- `destroy()` — releases listeners, resources, and pending operations.

Practice waits for `loadScene` before calling `lookAt`. A newer navigation request must supersede an older one so rapid Next presses cannot land on a stale scene.

## 6. Data model and invariants

Use UUIDs, one timestamp convention, and a documented coordinate convention: degrees; yaw in `[-180, 180)`; pitch in `[-90, 90]`. Convert engine-specific units inside the adapter only.

| Entity | Minimum fields |
|---|---|
| Palace | `id`, `title`, `startSceneId?`, `createdAt`, `updatedAt`, `revision` |
| Scene | `id`, `palaceId`, `title`, `panoramaAssetId`, `thumbnailAssetId?`, `sortOrder`, `initialYaw`, `initialPitch`, `initialHfov`, optional viewing limits |
| Hotspot | `id`, `sceneId`, `kind`, `yaw`, `pitch`, `label`, `iconKey`, `customAssetId?`, `color`, `size`, movement target/camera or `memoryId` |
| Memory | `id`, `palaceId`, `title`, `body`, `prompt?`, `answer?`, `imageAssetId?` |
| Route | `id`, `palaceId`, `title`, `stops: hotspotId[]`, `updatedAt` |
| PracticeSession | `id`, `palaceId`, `routeId?`, snapshot of ordered stop IDs, `startedAt`, `completedAt?`, optional `parentSessionId` |
| RecallResult | `id`, `sessionId`, `stopIndex`, `hotspotId`, `memoryId`, `result`, `at` |
| Asset metadata | `id`, `palaceId`, `purpose`, `mimeType`, dimensions, byte count |
| Local asset payload | `assetId`, `blob` |

Use separate database migration versions and export `schemaVersion` values. Do not make per-palace fields responsible for upgrading the whole database.

Validation rules:

- Use a discriminated union: movement hotspots require a target scene; memory hotspots require a memory.
- Every reference remains within the same palace.
- An empty palace may have no start scene. Once populated, its start scene must exist.
- Deleting the start scene requires choosing a replacement or deleting the palace's final scene.
- Scene/hotspot deletion removes or repairs incoming links and route stops in the same transaction.
- Route stops reference memory hotspots. Reject duplicate stops for Phase 1.
- Preserve historical recall records if source content is later deleted; display unavailable content clearly. Do not let history block deletion.
- Prevent editing a route during an active practice session, or continue using the captured stop snapshot. The first version can simply exit practice before editing.

### Legacy migration

Offer a downloaded JSON backup before migrating existing localStorage data. Keep the original key untouched until the migration succeeds, and make the migration repeatable without duplicating records.

Old flashcards have no scene attribution. Convert them to memories in an **Unassigned** list; create their hotspots only when the owner places them. Do not invent a scene or duplicate cards across rooms.

Migration can read only localStorage accessible from the current origin. If old data exists at another website address, export it from that address first; a new deployment cannot read it automatically.

## 7. Local persistence and backup

Provide visible `Saving`, `Saved on this device`, and `Save failed` states in Phase 1. Report success only after the IndexedDB transaction commits. Keep unsaved form content available after a failure and offer retry.

Use transactions for multi-record operations such as adding a scene with assets or deleting a scene with dependent links. Detect stale edits from another tab using a revision check and offer reload instead of silent overwriting.

Use `navigator.storage.estimate()` where available to inform capacity checks. Offer a persistent-storage request where supported and handle denial. Neither persistent storage nor IndexedDB replaces an external backup. Browser clearing and private browsing still matter.

### ZIP format

```text
palace-backup.zip
  palace.json
  assets/
    <asset-id>.<extension>
```

`palace.json` contains `schemaVersion`, export time, entity records, and an asset manifest with relative paths, MIME types, byte counts, and checksums. Include routes and practice history when present. Include all referenced image data needed to reopen the palace without the source folder or an external image URL.

Never serialize temporary `blob:` URLs as durable asset references.

### Import behavior

- Validate supported schema version, required fields, IDs, coordinates, and cross-record references.
- Reject missing assets, invalid image data, unexpected paths, and mismatched checksums.
- Apply documented limits to archive size, expanded size, image dimensions, and entry count before allocating large amounts of memory.
- Import as a **new palace** by default, remapping IDs and references. Defer merge/overwrite import.
- Parse and validate first, then commit records and payloads together in a transaction. Failure must not corrupt existing palaces.
- Show progress and useful error messages; allow cancellation before the final commit.

The completion check is a real export, followed by import into a fresh browser or phone, with every scene and attachment opening correctly.

## 8. Photo import and image handling

The product must include **Add photos**, not just a developer script.

User flow: choose one or more files → inspect per-file validation → generate derivatives → save assets and scenes → name/reorder scenes → connect viewpoints manually.

- Validate file size, actual decodability, supported image type, and pixel dimensions. Use a 2:1 aspect-ratio check for the initial full-equirectangular workflow, explaining that it does not prove correct spherical coverage.
- Show per-file progress, success, and failure. A bad file must not prevent the remaining valid files from importing.
- Keep source files unchanged. Store the imported original separately from the viewer copy and thumbnail.
- Generate derivatives in the browser for user uploads, processing one image at a time. Begin with a conservative pixel cap and preserve the full frame and aspect ratio.
- The optional Sharp script produces demo/development fixtures only; it is not the phone upload pipeline.
- Store a scene only when its required image assets are ready, with retry after failed processing or database writes.
- Create temporary object URLs only when needed; release them after consumers finish or scenes are discarded.

### Supplied testing photos

The nine files in `D:/OpenView Homes_First AD_Batch/` were checked for dimensions: all are 3840 × 1920 and total about 32 MiB. Keep these property photos out of public repositories, public fixtures, and deployments. Import them locally for testing. Do not infer ownership or publication rights from their presence.

Images 01 and 03 were visually inspected previously. Image 01 has a substantial blank lower area; its cause is unconfirmed. Inspect it in the chosen viewer and use appropriate viewing limits or omit it from the initial route. A cosmetic nadir patch would not restore missing scene data.

Start with three verified interior viewpoints. Establish their actual adjacency visually; filenames alone do not establish a walking route.

### Demo palace

Use three owned or clearly licensed images with an attribution record, a small manifest, and a **Load demo palace** button. Locate assets in a directory actually served by the application, or explicitly copy fixture files during the build. A `fixtures/` directory is not automatically a public URL.

Load demo data only on request and never overwrite an existing palace. Demo preparation must not require publishing private test photos.

## 9. Authoring and exploration

Use a large panorama canvas, a collapsible scene list, and a properties panel. Mobile uses drawers and a bottom sheet. The main mode switch is **Explore / Edit / Practice**.

In Edit:

- Explicitly choose **Add hotspot**, then tap a location. Normal dragging only pans the panorama.
- For movement, choose destination and arrival camera. Place reverse links independently.
- For memories, enter title, multiline body, optional prompt/answer, and an optional image. Preserve poem line breaks.
- Style markers with label, color, size, built-in icon, or a transparent PNG/WebP image.
- Provide Reposition and Delete actions. Direct dragging is not necessary for the first release.
- Render a halo or ring for the first object-highlight treatment. No polygon editor.

Apply decorative scaling to an inner marker element so it does not replace the engine's positioning transform. Render user content as text, not interpolated HTML. Do not accept arbitrary uploaded SVG or HTML.

In Explore, movement markers navigate and memory markers open a readable panel. Provide scene and memory lists as alternative navigation. Close panels with Escape and restore focus appropriately. Respect reduced-motion preferences and support touch targets and keyboard activation.

A marker anchors to an angular location in one photograph. It does not automatically track an object across other photos.

## 10. Practice and routes

### Minimal practice first

Start with an ordered list of selected memory hotspots. Up/down buttons are sufficient; a drag interface is optional later.

For each stop:

1. Load the stop's scene and turn toward its marker.
2. Show its prompt, falling back to “What is stored here?”
3. Hide memory text, attached images, answer-bearing labels, and unrelated memory popovers until Reveal.
4. On Reveal, display the explicit answer when present, otherwise the body, plus any attached image.
5. Enable **Got it** and **Missed**, write one result for that session stop, then continue.

Disable repeated scoring while a write is in progress. Keep the revealed memory visible if saving a result fails. A failed scene load should offer retry or end session; it must not count as a missed answer.

This is guided practice: the app navigates to the next stop. Manual navigation remains available in Explore.

### Route builder and results

Allow creating, naming, and editing an ordered route across scenes. Show scene names beside memory titles to distinguish similar objects.

At completion, show results from the current session only. **Retry missed** creates a new session containing that session's missed stops in order. Keep the original results intact. Handle zero missed stops and incomplete sessions explicitly.

Mid-session resume and spaced-repetition scheduling are deferred. A refreshed incomplete session may be shown as unfinished and restarted as a new attempt.

## 11. Hosting and performance

Deploy the application during Phase 1. Use one stable production URL or designated stable branch alias for persistent personal use. Unique deployment previews are for demo and disposable tests.

Browser data is specific to its origin. Different preview hostnames, localhost ports, and phone/desktop browsers do not share palaces. Explain this in the UI: **Stored on this device. Export to back up or transfer.**

Keep personal uploads in IndexedDB in Phase 1; do not send them to the host or analytics. Do not ship private test assets inside the deployment bundle. Test deployment protection where preview access is intended to be restricted.

Performance approach:

- Load and decode the active panorama first. Optionally prefetch one likely destination, with a bounded cache.
- Preserve the last usable scene until the next is ready; show loading and retry on failure.
- Avoid decoding all nine images or all archive images simultaneously.
- Keep the viewer instance stable during ordinary form and state changes.
- Use single-image panoramas initially; adopt multiresolution tiles only if larger assets or measurements justify them.

Proposed targets, to measure on a documented device/network profile:

- Immediate loading feedback.
- First useful panorama in approximately three seconds on broadband.
- Cached scene changes around one second or less.
- Smooth panning on a representative mid-range phone.

These are targets, not measured performance. A 3840 × 1920 RGBA image is approximately 28 MiB decoded before additional rendering overhead.

Kuula's embed performance documentation is useful when benchmarking the existing Kuula component or embedding an external Kuula tour. Parameters such as `initload`, `sd`, and `thumbs`, along with JavaScript-versus-iframe embed behavior, apply to Kuula's hosted player and should not be copied into the self-hosted viewer configuration. If the comparison harness remains, record its exact embed parameters so performance results are reproducible and check Kuula's status page before diagnosing a third-party outage as an application defect.

## 12. Milestones and estimates

Estimates are provisional until the baseline runs. The complete Phase 1 is approximately **12–20 focused hours** for an experienced implementer with coding assistance. Account access, unavailable fixtures, dependency failures, and integration bugs can extend this.

| Milestone | Work | Estimate | Completion check |
|---|---|---|---|
| M1 | Establish checkout, apply compatible security patches, run baseline, create necessary test scripts | 0.5–1 h | Existing app runs; failures recorded; no fictional test commands |
| M2 | Bounded viewer comparison and decision | Up to 1 h | Same fixture tested; one selected engine and a documented reason |
| M3 | Model, viewer contract, Dexie storage, save states, legacy migration | 2–3 h | Scene ownership, transactional changes, reload, and migration checks pass |
| M4 | Basic ZIP export/import | 1.5–2.5 h | A fixture palace with images restores in a fresh browser; invalid import leaves existing data untouched |
| M5 | Photo import and authoring | 2–3 h | Three real scenes can be imported, linked, annotated, styled, repositioned, deleted, and backed up |
| M6 | Guided practice, route editor, session results | 2–3 h | Five stops across at least two scenes can be practiced and missed stops retried |
| M7 | Stable deployment and demo | 1–2 h | Hosted app works on phone and desktop; demo contains no private photos |
| M8 | Integration, failure handling, and final verification | 2–4 h | Definition of done below passes with recorded evidence |

Hosting/demo work can begin once the baseline is stable. Integrate tests throughout rather than leaving all verification until M8.

**If tonight runs short:** target M1–M5 plus a basic stable deployment. Practice remains a clearly unfinished Phase 1 milestone. End with a verified export, not just a saved browser database. If authoring slips too, preserve and report the smaller completed slice honestly.

## 13. Definition of done

The first usable build is complete when checks 1–4 and the relevant build/accessibility checks pass. Full Phase 1 requires all checks.

1. Import three scenes, name them, and connect a navigable route with sensible arrival directions.
2. Create a poem memory and an image memory; customize markers; reposition one and delete another.
3. Pan, zoom, change scenes, return, and reload: markers stay anchored, scene-specific, and free of duplicates or stale deletions.
4. Export the palace, import it on a phone or fresh browser, and open every scene and attachment without the original source folder.
5. Build a five-stop route across two or more scenes, complete practice, and retry only that session's missed stops.
6. Verify touch placement, panel scrolling, narrow layouts, keyboard activation, focus restoration, and reduced motion.
7. Exercise invalid image files, malformed archives, failed database writes, failed scene loads, stale tab edits, and interrupted operations. Preserve existing data and provide useful recovery.
8. Pass production build, type checking, lint, focused validation/migration/import tests, and an end-to-end create → link → annotate → practice → export → import test. Record what actually ran and any remaining limitations.

Use deterministic owned/licensed fixtures. Automated tests should not depend on a developer's private image folder.

## 14. Phase 2 — cloud-backed use

The default Phase 2 approach is **cloud-authoritative saving with a local cache**, avoiding bidirectional offline synchronization initially.

- Add Supabase Auth, Postgres ownership fields, and private Storage.
- Migrate a local palace through an explicit **Upload this palace** flow, with progress, retries, and a verified local backup first.
- Enable row-level security and storage policies checked through palace ownership.
- Upload media directly to authorized storage; renew signed URLs as needed. Store durable object paths rather than signed URLs.
- Keep privileged credentials server-side.
- Use transactional database operations or server-side procedures where multi-record changes need atomicity.
- Detect stale cloud writes with a server-enforced revision check. Do not silently overwrite edits from another device.
- Require connectivity for committed cloud edits in this phase. Preserve unsaved drafts and make their status visible; do not describe them as synchronized.
- Test access using a second account and a signed-out session, including media retrieval.
- Verify the same palace opens from a second device after cloud saving.

Read-only sharing follows verified private saving. Decide public versus authenticated access explicitly, including the referenced media. Add publishing snapshots before editing live shared tours.

Offline bidirectional sync, deletion tombstones, conflict resolution, memory search, and spaced repetition are later work. A repository interface helps isolate implementation, but does not solve these features automatically.

## 15. Build workflow

### Default staffing

Use one implementation owner and one independent reviewer. The implementer owns data-model and storage decisions and integration. The reviewer checks specific completed changes against requirements and tests. Either tool can fill either role based on availability.

A third worker is optional for a bounded independent task such as the fixture derivative script or documentation. Multi-agent setup and notifications must not block building the first usable experience.

### Repository coordination

- Inspect the actual default branch; the previously reviewed repository used `master`.
- Create one branch/worktree per active implementer. Keep shared instructions and initial interfaces committed before dependent work starts.
- Document task owner, permitted file areas, acceptance checks, and dependencies in `docs/TASKS.md`.
- One owner changes package manifests and lockfiles. Coordinate dependency needs before other agents edit them.
- If another file is needed, request a scope adjustment and continue independent work. Do not silently change shared contracts or stop all work over a routine issue.
- Review bounded PRs with test evidence. The integrator resolves conflicts and runs integration checks after combining changes.
- For published feature branches, prefer fetching and merging the verified integration branch to avoid unnecessary history rewriting. Use rebase only when deliberately agreed.
- Human input is reserved for unresolved product choices, credentials, and actions that actually require approval. Routine reversible implementation proceeds within the agreed task.

Suggested documents are `AGENTS.md`, `docs/PLAN.md`, `docs/TASKS.md`, and `docs/DECISIONS.md`. Keep status notes short and useful; avoid maintaining redundant logs just to satisfy a process.

Suggested project rules:

```markdown
- Read the plan and assigned task before making changes.
- Preserve source images and keep private photos out of Git and deployments.
- Keep engine types out of application models.
- Coordinate changes to model, storage, dependencies, and lockfiles with their owner.
- Implement visible persistence errors and never claim a failed write succeeded.
- Run the checks defined by the task; run integration checks before release.
- Report what was tested, what failed, and any unverified behavior.
- Request scope adjustments when needed and continue unaffected work.
```

### Optional phone notifications

Add notifications only when they save more time than they cost to configure. Prefer milestones ready for inspection and genuine blockers; suppress routine unchanged status.

If using ntfy, choose the access model deliberately and send minimal status without secrets, personal content, or private media. A random public topic is not authenticated privacy. Check HTTP responses, add a timeout, and handle network failures without misreporting the build result.

Codex `notify` receives a JSON event argument and currently supports turn-complete events. It needs an adapter to a generic notification script and is not a substitute for approval-request handling. Verify each tool's current notification behavior before wiring hooks. Do not require external notifications for task completion.

### Suggested kickoff task

> Read this plan and inspect the current repository. Establish the baseline and report actual build failures. Complete the bounded viewer decision, then implement scene-owned data, reliable local persistence, and tested export/import before adding substantial authoring features. Preserve source images and existing data. Keep the first usable target to three imported scenes with movement links and customized text/image memories at a stable hosted URL. After that path passes, implement guided practice and the route editor. Record test evidence and remaining limitations at each milestone.

This is a future implementation prompt, not a claim that implementation has started.

## 16. Kuula product and developer reference library

Kuula is the primary product reference for interaction quality, authoring ergonomics, hosted delivery, and the longer-term feature backlog. Its documentation is research input rather than implementation instructions. During Phase 1, use the pages mapped below to answer concrete design questions and record any adopted behavior in `docs/DECISIONS.md`.

### How to use the library

| Plan area | Kuula references to consult | What to study |
|---|---|---|
| Photo import | Getting started, uploading, image specifications | Accepted inputs, validation language, upload feedback, and user expectations |
| Scene graph | Virtual tours, managing tours, adding photos | Scene organization, naming, ordering, and adding content later |
| Navigation | Hotspots, connections, backlinks, Walkthrough Mode, Click Anywhere | Link creation, reverse-link behavior, arrival orientation, and navigation clarity |
| Authoring | Addons, stickers/text, custom icons, master addons, Apply to All | Marker customization and repeatable defaults without expanding Phase 1 scope |
| Camera setup | Initial heading, zoom, level correction | Initial view controls and correction concepts; do not promise image retouching in Phase 1 |
| Memory content | Interactive cards, galleries, forms, audio, video | Interaction patterns and future content types; Phase 1 remains text plus one image |
| Quality control | Replacing images, integrity audit, keyboard shortcuts | Broken-reference checks, non-destructive replacement, and efficient authoring |
| Delivery | Sharing, embeds, branding, autoplay, analytics | Phase 2 publishing and product backlog; not Phase 1 acceptance criteria |
| Performance | Embed integration, Export Editor, export formats, system status | Kuula comparison-harness settings and external-service diagnosis |
| Developer integration | Player API, demo, embed guide, CSS, iOS limitations | Capabilities and limits of the existing Kuula iframe comparison path |

Do not try to reproduce Kuula feature-for-feature. For each referenced feature, classify it as: required for the current milestone, deferred backlog, or intentionally excluded. Phase 1 remains governed by the scope and definition of done above.

### Main official resources

- [Kuula Support and documentation index](https://kuula.co/support)
- [Kuula Blog](https://blog.kuula.co/)
- [Kuula YouTube channel](https://www.youtube.com/c/kuulapic)
- [Product changelog](https://kuula.co/page/changelog)
- [System status](https://stats.uptimerobot.com/0nWR3fJJOn)
- [Diagnostic/debug page](https://kuula.co/test)
- [Kuula Users Facebook group](https://www.facebook.com/groups/kuulapic/)

For technical problems with Kuula itself, prefer its support form because it can include browser and system details. The user-provided reference list also identifies `support@kuula.co` and `contact@kuula.co`; verify current contact information on Kuula's official site before use.

### Getting started

- [360 photography and equipment guide](https://kuula.co/help/getting-started-360-photo)
- [Uploading a single image](https://kuula.co/help/upload-post)
- [Creating a virtual tour](https://kuula.co/help/virtual-tours)
- [Image formats, sizes, and specifications](https://kuula.co/help/image-specs)
- [Tour settings and organization](https://kuula.co/help/managing-tours)
- [Adding photos to an existing tour](https://kuula.co/help/add-to-tour)

### Tour editor: connecting and navigating

- [Hotspots](https://kuula.co/help/hotspots)
- [Fast hotspot connections](https://kuula.co/help/connections)
- [Backlinks](https://kuula.co/help/backlinks)
- [Walkthrough Mode](https://kuula.co/help/sha)
- [Click Anywhere navigation](https://kuula.co/help/click-anywhere)
- [Cross-linking separate tours](https://kuula.co/help/cross-link-tours)
- [Tour Menu and shortcuts](https://kuula.co/help/menu)
- [Animated transitions](https://kuula.co/help/col-settings)
- [Floor plans](https://kuula.co/help/floor-plan)

### Tour editor: editing and appearance

- [Editing addons](https://kuula.co/help/editing-addons)
- [Images, stickers, and text labels](https://kuula.co/help/stickers-and-text)
- [Custom hotspot icons](https://kuula.co/help/custom-hotspot-icons)
- [Master addons](https://kuula.co/help/masters/content/help/page/support)
- [Batch editing and Apply to All](https://kuula.co/help/apply2all)
- [Initial heading and orientation](https://kuula.co/help/heading)
- [Zoom settings](https://kuula.co/help/zoom)
- [Thumbnails and cover images](https://kuula.co/help/thumbnails)
- [Retouching, HDR tone mapping, and sharpening](https://kuula.co/help/retouching)
- [Level correction](https://kuula.co/help/level-correction)
- [Nadir and zenith patches](https://kuula.co/help/nadir-zenith-patches)
- [Replacing an image without rebuilding the tour](https://kuula.co/help/replace-image)
- [Tour integrity and broken-connection checks](https://kuula.co/help/tour-integrity-audit)
- [Editor keyboard shortcuts](https://kuula.co/help/keyboard-shortcuts)

### Interactive content

- [Interactive cards](https://kuula.co/help/interactive-cards)
- [Image galleries inside cards](https://blog.kuula.co/tutorials-image-gallery)
- [Forms, lead capture, surveys, and quizzes](https://blog.kuula.co/google-forms)
- [Audio](https://kuula.co/help/audio)
- [Video](https://kuula.co/help/video)

### Sharing, hosting, and delivery

- [Sharing and embedding](https://kuula.co/help/share-embed)
- [Export Editor](https://kuula.co/help/export-editor)
- [Export formats](https://kuula.co/help/embed-code)
- [Branding and white labeling](https://kuula.co/help/whitelisting-branding-logo)
- [Contact cards and lead information](https://kuula.co/help/contact-cards)
- [Automatic rotation and autoplay](https://blog.kuula.co/auto-rotate-autoplay)
- [Saving snapshots and tiny planets](https://kuula.co/help/save-image)
- [Recording tour videos](https://kuula.co/help/record-video)
- [QR codes](https://blog.kuula.co/qrcode)
- [MLS publishing](https://blog.kuula.co/mls)
- [Google Street View publishing](https://kuula.co/help/google-street-view)
- [Property address and listing information](https://kuula.co/help/address-property-information)
- [Analytics and Google Analytics integration](https://kuula.co/help/analytics)

### Domains and Kuula-hosted websites

- [Custom domain setup](https://kuula.co/help/custom-domain)
- [Branded tour links on a custom domain](https://kuula.co/help/branded-links)
- [Short links and custom paths](https://kuula.co/help/short-links)
- [Kuula Website Editor](https://kuula.co/help/website-editor)
- [Website Editor settings](https://kuula.co/help/website-settings)

### Official developer documentation

- [Player API documentation](https://kuula.co/help/getting-started-api)
- [Interactive Player API demo](https://static.kuula.io/demo/basic.html)
- [Embed integration guide](https://kuula.co/help/embed-integration)
- [Export formats and JavaScript-versus-iframe embeds](https://kuula.co/help/embed-code)
- [Responsive and full-window embed CSS](https://kuula.co/help/embed-css)
- [Full-window embed demonstration](https://static.kuula.io/demo/fullwindow.html)
- [iPhone, fullscreen, gyroscope, and VR limitations](https://kuula.co/help/ios)
- [General troubleshooting](https://kuula.co/help/troubleshooting)

Kuula's official developer offering appears centered on its browser Player API, hosted scripts, and embed configuration. The Player API is relevant to the existing comparison component because it exposes loading, hotspot, and orientation events along with navigation, camera, hotspot-appearance, and autorotation commands. Verify the current event and command names against the official Player API page during implementation.

Kuula's hosted scripts are documented as:

```html
<script src="https://static.kuula.io/api.js"></script>
<script src="https://static.kuula.io/embed.js"></script>
```

These remote scripts belong only in an explicit Kuula integration or comparison harness. The self-hosted Mind Palace viewer should not depend on them.

### Kuula embed performance notes

The key pages are the [embed integration guide](https://kuula.co/help/embed-integration), [Export Editor](https://kuula.co/help/export-editor), [export formats](https://kuula.co/help/embed-code), and [status page](https://stats.uptimerobot.com/0nWR3fJJOn).

The user-provided research identifies these Kuula parameters and behaviors; confirm them against the current official pages before changing an embed:

- `initload=0` presents a title screen before loading the full tour; `initload=1` starts immediately.
- `sd=1` restricts the player to 4K assets and may improve desktop load time.
- `thumbs=0` reduces thumbnail navigation; `thumbs=-1` removes tour navigation.
- Kuula's JavaScript embed can coordinate multiple players more efficiently than separate iframe embeds.

Performance measurements for Kuula-hosted content and the local viewer must be reported separately. A Kuula outage or network delay says nothing about IndexedDB or the selected local panorama engine.

### Community-maintained developer tools

- [guilledll/kuula on GitHub](https://github.com/guilledll/kuula) — unofficial TypeScript declarations for the Player API
- [@guille/kuula on JSR](https://jsr.io/@guille/kuula) — packaged version of the same community project

Treat these as implementation aids, not authoritative specifications. Pin the version if adopted, compare its event/method definitions with the current official Player API, and add a small runtime adapter instead of spreading community types through application code. Do not assume an official Kuula REST API, account-management API, GitHub organization, or SDK unless current official documentation establishes one.

### Independent discussion communities

- [r/VirtualTour](https://www.reddit.com/r/VirtualTour/)
- [r/RealEstatePhotography](https://www.reddit.com/r/RealEstatePhotography/)
- [THETA 360 developer community](https://community.theta360.guide/)
- [Kuula Users Facebook group](https://www.facebook.com/groups/kuulapic/)

Use community discussions for workflow ideas and reports of practical limitations. Verify technical behavior against official documentation and the actual prototype before turning it into a requirement.

## References

- [Existing repository](https://github.com/Nahomatnafu/mindmap-360)
- [Pannellum configuration](https://pannellum.org/documentation/reference/)
- [Pannellum custom hotspots](https://pannellum.org/documentation/examples/custom-hot-spots/)
- [Photo Sphere Viewer markers](https://photo-sphere-viewer.js.org/plugins/markers)
- [Photo Sphere Viewer virtual tours](https://photo-sphere-viewer.js.org/plugins/virtual-tour)
- [Dexie transactions and database design](https://dexie.org/docs/Tutorial/Design)
- [Browser storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [Vercel deployment and branch URLs](https://vercel.com/docs/deployments/generated-urls)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase storage access](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Codex notification configuration](https://learn.chatgpt.com/docs/config-file/config-advanced#notifications)
- [ntfy publishing](https://docs.ntfy.sh/publish/)
