# Mind Palace 360

A general-purpose visual memory palace. Import your own 360° photographs, place small image associations in the room, and tap each picture to reveal a note. Subjects and associations are yours; the app is not tied to any curriculum.

Hosted app: [mindmap-360.vercel.app](https://mindmap-360.vercel.app). AI requires the owner's demo access code. Uploads and ZIP restoration remain local to your browser.

## Demo workflow

1. Open **Spaces → Import 360 photos**, select 2:1 JPEG/PNG/WebP panoramas, and name the palace.
2. Tap **Add memory**, then tap a location in the room.
3. Enter a concept. Upload your own picture, or request three associations and generate one image. Review the preview and choose **Use this image**.
4. Add your note and save. Tap the picture to reveal it; edit its size or reposition it from the note panel.
5. Use **Export ZIP** in Spaces before changing browsers/devices. **Restore ZIP** creates a new palace with the images and notes.

Pictures default to a compact 40px reference size and scale with panorama zoom. Try 24–40px when placing many memories. Labels appear on hover/focus. There is no automatic cloud synchronization: photos and notes live in this browser's IndexedDB. Backups support up to 99 MB of image payloads.

## Run locally

Use Node.js 22 or newer, then `npm ci`. Put these variables in ignored `.env.local`:

```dotenv
OPENROUTER_API_KEY=your-key
AI_DEMO_ACCESS_CODE=choose-a-private-demo-code
# Optional model overrides:
OPENROUTER_TEXT_MODEL=google/gemini-2.5-flash-lite
OPENROUTER_IMAGE_MODEL=openai/gpt-image-2.5-flare
```

Run `npm run dev`, or `npm run build` followed by `npm start`. Open `http://127.0.0.1:3000`. No API key is needed for uploading images, editing notes, or backup/restore. Never prefix the OpenRouter key with `NEXT_PUBLIC_` or commit `.env.local`.

Only the concept/image description goes to OpenRouter. Room photos and saved notes are not sent to the AI routes. Production AI requires the demo access code. Generation makes one paid request when you press Generate; it does not automatically retry. The server limits each process to 30 image requests and 100 suggestion requests per hour. These limits are not a distributed billing cap; use a provider key spending limit for a public demo.

## Phone and hosting

Motion view needs HTTPS on Android Chrome and actual device sensor access. The desktop browser can verify layout, but cannot verify physical phone motion.

The local Windows helper is `powershell -File scripts/start-phone-preview.ps1` (or add `-SkipBuild` after a successful build). It expects Cloudflare's official `cloudflared.exe` in ignored `.preview-runtime`. Its gateway exposes only compiled app assets, the explicitly approved single photo, and three AI routes. Keep the computer awake; a quick tunnel is temporary and gets a new origin when restarted. Browser data does not move between origins: export a ZIP first.

The Vercel deployment excludes `.env*`, private preview photos, local backups, and runtime logs. Configure `OPENROUTER_API_KEY` and `AI_DEMO_ACCESS_CODE` as production secrets. Import photos or restore your ZIP in the hosted app; the hosted app does not ship private room photos.

## Checks and feature branches

`npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` are required before integration. The current suite includes transactional persistence failures, image replacement, AI authorization/response validation, zoom projection, ZIP corruption checks, and backup round trips.

Integration branch: `codex/hackathon-demo`. Separate branches: `codex/image-memories`, `codex/association-suggestions`, `codex/association-image-generation`, `codex/dependency-refresh`, `codex/spatial-image-scale`, `codex/demo-backup`, `codex/demo-delivery`, and `codex/demo-regression`.

See `docs/TASKS.md` and `docs/status/demo-regression.md` for evidence and remaining work. Guided practice, cloud sync, and VR remain later work. A 118-marker scene with a shared image passed desktop and phone-sized browser checks; distinct-image memory use, frame rate, and physical Android motion still need device testing. Production dependency audit passed with zero vulnerabilities; five reported high-severity development-only issues remain in ESLint's transitive file-globbing dependencies, with no compatible patched resolution found during this pass.
