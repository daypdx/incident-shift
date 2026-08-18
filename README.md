# Incident Shift

**A realistic IT & cyber troubleshooting game**

Incident Shift is a local-first React prototype where players work short synthetic tickets and security alerts, classify evidence against hypotheses, commit to bounded decisions, resolve or escalate within authority, verify the original outcome, and leave an evidence-backed handoff.

Live build: [daypdx.github.io/incident-shift](https://daypdx.github.io/incident-shift/)

## Local setup

Requirements: Node.js 22 or newer and npm 10 or newer.

```powershell
cd C:\Users\zdayp\incident-shift
npm install
npx playwright install chromium
npm run dev
```

Open the local address printed by Vite (normally `http://localhost:5173`). No account, API key, backend, network target, or paid service is used.

## Commands

```text
npm run dev               Start the local development server
npm run validate:content  Validate all scenarios with Zod and semantic checks
npm run generate:content  Regenerate the typed scenario index
npm run typecheck         Run strict TypeScript checks
npm run lint              Run ESLint with zero warnings allowed
npm run test              Run unit and component tests
npm run build             Generate content, typecheck, and build production assets
npm run build:pages       Build the GitHub Pages artifact and direct-route fallback
npm run test:browser      Run Playwright flows, axe checks, responsive tests, and visual captures
npm run check             Run content, type, lint, unit, and build gates
```

## Included cases

- `TRAIN-001 Wrong Output` — unscored guided Training Shift
- `SD-001 No Names, Only Numbers` — DNS isolation and narrow workstation correction
- `ID-001 Impossible Travel?` — bounded benign identity-alert closure
- `SOC-001 The Help Desk Is Calling` — correct security escalation and handoff

All cases use the same framework-independent event engine. Artifact rendering is selected by the versioned `artifactFamily` content field, never by scenario ID.

## Architecture

- React 19 + strict TypeScript + Vite
- Versioned JSON content contract with an equivalent Zod schema
- Immutable event logs with deterministic replay and score recalculation
- LocalStorage persistence for settings, attempts, history, and progress
- CSS-token visual system with desktop, tablet, mobile, reduced-motion, and high-contrast behavior
- Vitest, Testing Library, Playwright, and axe-core verification

The browser never executes user-entered commands, fetches arbitrary URLs, connects to real systems, or grades free text. See `PRIVACY_AND_SAFETY.md` for the complete boundary.

## Content authoring

Scenario files live in `src/content/scenarios/`. Update the JSON Schema and `src/engine/validation.ts` together for any versioned contract change. Then run:

```powershell
npm run validate:content
npm run generate:content
npm run test
```

The build rejects duplicate IDs, broken references, multiple/missing correct choices, invalid score weights, prohibited best-path actions, non-HTTPS citations, expired review dates, and scriptable content.

## Verification artifacts

- `IMPLEMENTATION_LOG.md` — build phases and recorded decisions
- `TEST_REPORT.md` — automated flow coverage and final results
- `CONTENT_REVIEW.md` — source and review-date ledger
- `PRIVACY_AND_SAFETY.md` — local-data and content-safety boundaries
- `artifacts/screenshots/` — required responsive visual-QA captures

The public `main` branch deploys automatically to GitHub Pages after the release checks pass.
