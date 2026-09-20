# Spatial tour editor — September 20, 2026

The previous static OpenView viewer was built with Pannellum, a handwritten room graph, and a separate laundry reveal. Its build writeup and `dist/tour.js` were reviewed alongside the current nine panoramas. The current batch numbers run in reverse of the earlier edited-image numbers. A generic next-file/previous-file graph was therefore the wrong walkthrough model.

Three bounded agents handled photo/room review, image derivatives, and note interaction. Their commits were integrated on `codex/spatial-tour-editor`; the integration owner implemented and verified the viewer and connection editor.

## What changed

- White floor rings replace arrows. Wall circles identify the laundry reveal. Positions remain spherical yaw/pitch coordinates.
- The reviewed graph connects entry, hall, living area, kitchen, patio, and yard. Laundry is an alternate view of the hall and keeps the camera direction when toggled. The main navigation strip has eight stops; all nine photos remain available in the thumbnail tray.
- **Edit connections** opens a compressed equirectangular preview. Select a destination, tap the preview or edit yaw/pitch, choose floor/wall, and save. Draft changes immediately update the full panorama. Saving waits for IndexedDB and shows failures.
- **Add note** explicitly enters placement mode. Dragging looks around; tapping places the note. A dialog collects title, multiline text, and marker color. The colored marker opens the note, and **Edit note** updates it. Selecting a sidebar note in viewing mode loads its room.
- Note and marker changes update hotspots without destroying the WebGL viewer. Stable object URLs prevent metadata saves from reloading images, and metadata-only edits do not rewrite original photo blobs.
- Image preparation preserves original bytes in local storage, creates viewer JPEGs up to 3840px wide and thumbnails up to 512px wide, and uses temporary 1536px editing previews. Derivatives are generated sequentially and repeat preparation is idempotent. The viewer script and stylesheet are served locally with their MIT license.

## Applied and verified

The existing local **OpenView Homes** tour was updated through the app's **Apply reviewed OpenView layout** action. Source files were not edited, private images were not added to Git, and the existing Laundry note was preserved. A clearly labeled instructional sample, **A memory on the couch**, was added to the living room through the normal note dialog.

- Production build: passed.
- TypeScript: passed.
- ESLint: passed.
- Vitest: 20 tests across five files passed, including transaction/revision safety, migration, image preservation/idempotence, and reviewed layout/reference preservation.
- Browser: floor-ring navigation from Front Entry to Entryway; thumbnail navigation; live position editing and successful persistence feedback; note creation and reading; full reload followed by reopening the saved note and loading its room. No captured browser error logs during these checks.
- Responsive browser: note panel and live editor inspected at 390 × 844; page scroll width stayed 390px. Normal viewport restored afterward. This is a browser-size check, not a physical-phone device test.

## Remaining scope

Storage remains local to this browser and origin. Supabase/Cloudinary hosting, cross-device sync, portable ZIP backups, note image attachments, custom uploaded icons, and VR are not implemented here. Generic new imports still need their route authored; the reviewed OpenView preset only accepts its known nine scenes.

The rings are perspective-styled overlays anchored to spherical positions, not reconstructed 3D surfaces. Scene changes crossfade between photographs; they do not provide Matterport-style depth movement. All reviewed coordinates remain editable, and not every direction in every room has received an interactive visual pass.

Next independent tasks can cover backup export/import, image-backed memories, and hosted delivery. Coordinate model changes before implementing attachments or synchronization.
