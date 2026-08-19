# Test report

Date: 2026-08-18
Browser: Playwright Chromium
Target: local Vite application

## Automated behavior coverage

### Unit and content tests

- Zod parsing and semantic validation for all four scenarios
- duplicate entity IDs rejected
- broken evidence/action/message references rejected
- dimension weights not totaling 100 rejected
- expired review date rejected
- zero correct decision choices rejected
- action prerequisite and duplicate-action enforcement
- unique evidence reveal
- authored evidence-relation scoring
- supporting-observation and verification-plan decision gates
- high-confidence contradiction/alternative gate
- deterministic event replay and score equivalence
- prohibited-action final-score cap
- unsupported-certainty Communication cap
- exact LocalStorage attempt restore and incompatible migration rejection
- deterministic Daily Incident selection
- evidence provenance, pre-debrief answer-hiding, action-density, impact confirmation, and focus return components
- stage-to-route resume mapping for briefing, investigate, resolve, verify, communicate, and debrief
- classification revision/removal replay with final-relation scoring
- player-derived hypothesis states with no authored Independent-mode labels
- identical deterministic evidence and scoring across Coach and Independent modes
- retired-setting normalization and private progress-dimension persistence

### Playwright flows

1. Training Shift completed with keyboard-operable controls.
2. SD-001 completed through the intended evidence path.
3. SD-001 prohibited shared-router restart completed deliberately; debrief proves maximum 59 and explains the cap.
4. Correct SD-001 cause guessed early; the evidence commitment gate prevents submission and top rank.
5. ID-001 completed as a bounded benign VPN-location closure in Independent mode.
6. SOC-001 completed with correct escalation, ownership, and handoff.
7. Mid-case refresh preserves byte-identical persisted events and restores derived state.
8. Axe smoke checks pass on landing, shift board, settings, progress, briefing, active case, decision, resolution, verification, communication, and debrief.
9. Impact dialog returns focus to the initiating action.
10. Landing and active case have no page-level horizontal scroll at 320px.
11. Mobile actions use a labeled, closable full-height sheet.
12. Critical briefing controls remain available at 200% browser zoom.
13. Visual-QA capture test produces all required screenshot artifacts.
14. Exit and Resume preserve the byte-identical saved attempt.
15. Restart requires confirmation; cancellation preserves and confirmation replaces the event log.
16. Resolve, Verify, and Communicate resume at their exact routes.
17. Independent ID and SOC cases expose no authored hypothesis strength before debrief.
18. Daily Incident requires training or an explicit bypass.
19. Evidence links can be revised and removed from the visible ledger.
20. Evidence and Authority Case File controls produce visible, keyboard-operable state changes.
21. Mobile Actions traps focus, closes on Escape, restores focus, keeps Close sticky, and makes the background inert at 320×568 and 390×844.
22. Axe passes with the mobile Actions dialog open.
23. Reduced-motion and high-contrast preferences persist; no inert Sound control remains.

## Final results

```text
Content validation: 4 scenarios passed Zod + semantic checks
TypeScript: strict project build passed
ESLint: passed with --max-warnings 0
Vitest: 5 test files passed, 22 tests passed
Vite production build: passed
Playwright: 21 tests passed
Axe: zero violations on tested major routes
320px overflow: document scrollWidth <= clientWidth
Dependency audit: 0 vulnerabilities reported by npm audit
Secret scan: no high-confidence credential patterns found outside ignored/generated dependencies
```

The Playwright web-server output includes Node's informational `NO_COLOR`/`FORCE_COLOR` warning; it does not affect results.

## Visual QA artifacts

Reviewed directly for clipping, overlap, contrast, density, focus hierarchy, and spoiler exposure:

- 1440×900: landing, shift board, DNS with four clues, DNS debrief
- 1024×768: active case/actions, decision
- 768×1024: briefing, active case
- 390×844: landing, active evidence, action sheet, verification, debrief
- 320×568: active case, impact confirmation
- QA repair captures: 1440×900 landing/active/debrief; 390×844 landing/Actions open; 320×568 landing/Actions open/Actions scrolled to end

All files are in `artifacts/screenshots/`.
