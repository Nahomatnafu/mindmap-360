# Home Wi-Fi preview

The user chose home Wi-Fi access instead of a public Cloudflare preview. No public tunnel was started.

The production build is served on the computer's Wi-Fi interface, port 3001. Open `http://<computer-wifi-address>:3001/?preview=1` from a phone on the same network while the computer remains awake. The current clickable address is provided in the task response. This address can change after reconnecting to Wi-Fi. Guest networks may isolate devices.

The `preview=1` query seeds an empty browser workspace with one living-room panorama and an instructional couch note. It does not replace an existing workspace. Notes remain in each browser's IndexedDB; the computer's existing tour and notes are not synchronized to the phone.

`public/phone-preview/living-room.jpg` is a local, untracked derivative of `ov_batch_06.jpg`, resized to 2560 × 1280 and compressed to 334,552 bytes. The source remains untouched. The private photo and `.preview-runtime` logs, helper download, and PID files are excluded from Git. Cloning this branch alone does not include the sample photo.

Local HTTP lacks `crypto.randomUUID`, so UUID generation now uses `crypto.getRandomValues` when necessary. Image preparation still requires HTTPS or localhost and explains that restriction; the phone sample is already compressed.

Verified: production build, TypeScript, ESLint, 23 tests, and sample rendering at the Wi-Fi URL. Tests cover safe repeated seeding, preserving edited notes, missing image recovery, and UUID generation without secure-context APIs. Actual phone reachability requires the user's device test. Existing Node firewall rules allow the server; no firewall rules or network profiles were changed.

The preview is a temporary local process, not permanent hosting. Runtime process IDs are recorded in `.preview-runtime/server.pid`. Stop only the recorded preview process when it is no longer needed; the development app on port 3000 is separate.
