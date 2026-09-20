# Baseline status

Date: 2026-09-20

## Repository

- Remote: `https://github.com/Nahomatnafu/mindmap-360.git`
- Starting commit: `58e3616c6c763b653ab471e2fc32b412435f06ac`
- Default remote branch observed: `master`
- Working branch: `codex/foundation-baseline`

## Initial checks

- Locked dependency install completed.
- Initial production build failed because `next/font` attempted to download Google Fonts in the restricted build environment.
- Initial lint reported 15 errors and 8 warnings. These are primarily in legacy viewer code, the localStorage hook, and the CommonJS image script. Preserve the report as refactoring input; do not suppress the rules globally.
- Initial audit reported 15 vulnerabilities: 1 critical, 9 high, 4 moderate, and 1 low.

## Security maintenance

Direct packages were updated from the vulnerable baseline:

- Next.js and `eslint-config-next`: 16.0.5 → 16.3.5
- React and React DOM: 19.2.0 → 19.3.0
- Pannellum: 2.5.6 → 2.5.7
- Sharp: 0.34.5 → 0.35.4

The external Google Fonts dependency was removed from the root layout so builds do not require a font-network request.

## Verified result after maintenance

- `npm run build`: passed on Next.js 16.3.5; this includes the framework TypeScript check.
- `npm run typecheck`: passed.
- `npm audit`: 0 vulnerabilities after compatible transitive updates.
- `npm run lint`: still fails with the original 15 errors and 8 warnings. The failing files are the legacy CommonJS image script, flashcard editor, unused Kuula viewer, active Pannellum viewer, tour context, and localStorage hook. These are recorded work for the viewer and storage branches; no lint rule was disabled.
- Browser smoke check: the first panorama rendered, scene switching loaded another panorama, and a click in explicit Edit mode opened the flashcard editor. The temporary editor was canceled without creating test content.
- Pannellum 2.5.7 was selected for Phase 1; see ADR-002.
