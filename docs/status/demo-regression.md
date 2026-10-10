# Hackathon demo regression

October 10, 2026. Branch: `codex/demo-regression`. Integration owner: Codex.
Live app: https://mindmap-360.vercel.app

## Fix found during testing

The 118-memory fixture initially produced 236 image-marker DOM nodes. Pannellum's `addHotSpot` creates a node before loading, then its initial load creates another node for the same hotspot. The adapter now reconciles hotspots only when the engine reports loaded, and increments readiness on every scene load so changes made during loading are applied afterward.

The deployed fix rendered exactly 118 markers, 118 decoded images, and one viewer canvas. Adding and replacing one additional image memory produced 119 markers and 119 decoded images after saving and refreshing. Five forward/backward scene changes each rendered only the destination scene's single memory and one canvas.

## Checks completed

- `npm run typecheck`, `npm run lint`, `npm test` (42 tests), and `npm run build` passed after the viewer fix.
- Three synthetic 2:1 JPEGs imported into a new palace; the palace and viewpoints survived refresh.
- ZIP restore created separate test palaces without replacing the existing demo. A corrupt archive was rejected. Automated tests also cover checksums, asset dimensions, paths, references, and atomic restore.
- Manual PNG placement, note opening/editing, image resizing, repositioning, and refresh persistence passed. HTML-looking note content remained literal text, with no injected bold element.
- A square non-panorama image and an SVG memory upload were rejected with visible errors; the original saved data remained intact.
- Saved connection yaw `30`, pitch `-18`, and wall-circle appearance reopened correctly after refresh. Wall-circle and floor-ring navigation reached their destinations. Forward/backward controls passed repeated transitions.
- Zoomed image widths followed panorama magnification rather than the inverse scaling reported by the user. Dense fixture markers start at 24px; the app default remains 40px.
- Hosted AI rejected missing/wrong access codes, invalid concepts, oversized requests, and cross-origin requests. The phone-sized UI returned three Ocean associations, generated one transparent 768×768 Flare image, used it to replace a manual image, and reopened the saved image and association note after refresh.
- Portrait viewports 390×844 and 320×568 had no horizontal overflow. The memory editor remained scrollable and usable. Landscape 844×390 editor also fit and scrolled. Browser viewport overrides were temporary.
- Desktop motion controls showed the unavailable-sensor message. The post-fix browser console had no errors or warnings during the scene/density checks; deliberate failed AI requests may appear as network failures.
- The deployed production build was Ready. Private source photos, environment files, and local ZIP backups were excluded from deployment.

## Repeatable synthetic fixtures

Run `node scripts/create-regression-fixtures.mjs`. Outputs go to ignored `.preview-runtime/regression/`; no private source photo is read or changed.

Restore `three-scenes.mindpalace.zip` to exercise scene-scoped memory rendering and circular portal navigation. Restore `dense-118.mindpalace.zip` to verify there are 118 `.image-memory` nodes, 118 decoded marker images, and one canvas after load and refresh. The generated portals have separate yaw positions so they do not overlap each other. The first test run used the original overlapping portal positions; floor-ring navigation was verified in portrait after selecting the visible ring.

The density fixture uses 118 memories sharing one small PNG. It verifies marker count, layout, rendering lifecycle, and interactions; it is not a benchmark of 118 distinct large textures.

## Physical device checks still needed

Actual Android Chrome sensor movement, touch/pinch handling, screen rotation, frame rate, and GPU/memory behavior cannot be established by desktop viewport checks. Open the HTTPS live URL directly in Chrome, import a 2:1 panorama or restore a backup, enable Motion view, move the phone, and use Recenter. Try a marker, edit its note, refresh, then export a ZIP.

Browser storage belongs to each device and origin. Desktop-local photos and notes do not automatically appear on the hosted site or phone; use Export ZIP → Restore ZIP to transfer them. Private panoramas are not bundled with the public deployment.

Cloud sync, guided practice, VR, distributed AI rate limiting, and production monitoring remain outside this hackathon demo.
