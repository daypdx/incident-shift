# Privacy and safety

## Local-only data

Incident Shift has no backend, account, analytics SDK, advertising SDK, telemetry endpoint, or runtime AI. The prototype stores only local settings, immutable scenario-event logs, scores and score dimensions, move/disruption summaries, mode completion, badges, and timestamps in browser LocalStorage.

It does not require or collect:

- name or email
- real IP address or device fingerprint
- employer, school, tenant, or account connection
- credential, token, MFA code, or uploaded file
- analytics identifier
- free-text reflection in persistence or export

The local export contains only scenario IDs, modes, completion timestamps, scores, rank labels, badges, progress, and settings.

## Simulation boundary

- All organizations, people, devices, accounts, domains, and artifacts are fictional or synthetic.
- Network examples use RFC documentation ranges or clearly internal synthetic addresses.
- Scenario domains use `.example`.
- The application does not execute commands, accept targets, fetch user-entered URLs, connect to tenants, emulate a real terminal, or open external labs.
- No malware, exploit, phishing kit, active HTML, attacker infrastructure, real credential, or operational malicious command is present.
- Scenario strings render as text; the app does not use `dangerouslySetInnerHTML`.
- External citations appear only as inert documentation in the repository, not as in-case actions.

## Operational judgment

- Authority, disruption, and intent remain visible in Coach and Independent modes.
- Prohibited actions require deliberate impact confirmation and apply an explicit final-score cap.
- Correct escalation can earn full credit.
- Verification must test the original outcome or immediate protective state.
- Timers do not affect score.
- Unsupported certainty is preserved and explained in the debrief.
- Ranks describe an attempt, never a person's professional ability.

## Product-claim boundary

Game progression reflects completed scenarios, not employment qualification. The prototype does not claim job readiness, certification credit, professional competence, real SOC experience, or mastery of cybersecurity.

## Reset and recovery

Settings provides a local reset that removes only keys prefixed `incident-shift.` from the current browser profile. There is no remote copy to recover after reset. Export local test data first if a record is needed.
