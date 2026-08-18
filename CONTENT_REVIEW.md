# Content review ledger

Review baseline: 2026-08-17. Build validation fails after a scenario's `reviewBy` date.

## TRAIN-001 — Wrong Output

- Stability: evergreen
- Last reviewed: 2026-08-17
- Review by: 2027-08-17
- Source: https://www.comptia.org/en/certifications/a/core-1-v15/
- Note: Unscored synthetic training case teaching scope, observation, authority, and verification.

## SD-001 — No Names, Only Numbers

- Stability: evergreen
- Last reviewed: 2026-08-17
- Review by: 2027-08-17
- Source: https://www.comptia.org/en/certifications/a/core-1-v15/
- Note: Synthetic DNS-isolation case using documentation-range addresses and `.example` domains.

## ID-001 — Impossible Travel?

- Stability: review annually
- Last reviewed: 2026-08-17
- Review by: 2027-08-17
- Sources:
  - https://support.google.com/a/answer/7102416
  - https://attack.mitre.org/techniques/T1078/
  - https://www.cisa.gov/audiences/small-and-medium-businesses/secure-your-business/require-multifactor-authentication
- Note: Teaches that geolocation is a lead rather than proof and requires device, authentication, VPN, user, and activity correlation.

## SOC-001 — The Help Desk Is Calling

- Stability: review quarterly
- Last reviewed: 2026-08-17
- Review by: 2026-11-17
- Sources:
  - https://www.microsoft.com/en-us/security/security-insider/threat-landscape/microsoft-digital-defense-report-2025
  - https://www.cisa.gov/audiences/small-and-medium-businesses/secure-your-business/require-multifactor-authentication
  - https://attack.mitre.org/techniques/T1078/
- Note: Synthetic social-engineering case containing no executable attacker command, real infrastructure, or working contact flow.

## Public-release gate

These dates establish currency, not public-release approval. Before public use, every case still requires technical plausibility review by an experienced practitioner and a second evidence-path reviewer.
