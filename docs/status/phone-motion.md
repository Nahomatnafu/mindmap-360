# Phone motion controls

The user explicitly requested tilt-to-look on Android Chrome, expanding the original Phase 1 exclusion of gyroscope controls.

The viewer now has a Motion view button backed by Pannellum's orientation implementation, which handles device rotation and screen orientation. Permission requests occur only after a tap where the platform requires consent. The control stays in a waiting state until valid sensor readings arrive, reports unavailable/blocked sensors, and offers Recenter while active. Manual dragging, editing, opening a note, changing scenes, and backgrounding the page stop motion. Re-enable it with Motion view.

The note's visible center changed from 26px with a large halo to 14px with a small outline. Its invisible tap target remains 44px. This change does not resize floor navigation rings.

HTTPS testing exposed a stylesheet-loading race that could initialize the panorama with the wrong canvas dimensions. Engine startup now waits for both script and stylesheet, and a ResizeObserver keeps the render dimensions aligned with the viewer container when toolbars, sidebars, or screen orientation change.

Android Chrome requires a trusted secure context for device orientation. The existing HTTP home-Wi-Fi preview can show the feature but cannot provide sensor access. It displays an explicit explanation instead of pretending motion is active. A trusted HTTPS preview or trusted local HTTPS setup is required for the real-device check. No browser security flags or certificate-warning bypasses are part of this implementation.

Verification: production build, TypeScript, ESLint, and all 28 tests passed. Motion tests cover blocked HTTP, denied permission, valid sensor readiness, delayed permission after cancellation, sensor timeout, and listener cleanup. The production Wi-Fi URL was checked in the browser for the smaller marker and the HTTP restriction message. These checks do not establish physical gyroscope behavior; the user's Android phone test remains required.

References: [Pannellum API](https://pannellum.org/documentation/api/), [device orientation and secure contexts](https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent), and the installed Pannellum 2.5.7 source.

The user subsequently approved a temporary HTTPS Cloudflare preview containing the single living-room image. A loopback gateway (`scripts/phone-preview-gateway.mjs`) exposes only the app shell, compiled static assets, the panorama engine, and that sample photo. Other tour assets and non-GET/HEAD requests are rejected. The gateway supplies sensor Permissions-Policy headers. Checks confirmed 200 for the sample/app and 404 for excluded paths. The tunnel is temporary and depends on the computer remaining awake; its current URL is given in the task response, not persisted in source. Local notes do not transfer between HTTP and HTTPS origins.
