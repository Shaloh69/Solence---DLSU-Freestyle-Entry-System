---
paths:
  - "**/tests/**"
  - "**/*.test.ts"
  - "**/*.spec.ts"
  - "client/e2e/**"
  - "solence-vision/tests/**"
---

# Test rules

- A test proves behavior a user or engineer cares about. Assert on
  outcomes (breaker size, violation present, PDF contains "3.5 mm²"),
  not on implementation details.
- Real corpus first. Floor plans: `server/tests/helpers/real-plans.ts`
  (`loadRealPlans()`, `fitOut()`) reads the 12 ResPlan houses from
  `test-assets/plans/resplan/INDEX.json` — use it (or its client E2E
  equivalent) instead of ad-hoc paths; it throws if the corpus is
  missing, never falls back to a toy plan. Other assets (models,
  textures, HDRIs, vision fixtures) come from `test-assets/manifest.json`
  by id once item 0.3 lands; per-asset expected values go in
  `test-assets/expectations/<id>.json` (protected).
- Engine limits live in `server/tests/thresholds.json`, E2E/render limits
  in `client/e2e/**/thresholds.json` — all protected.
- Every bug fix lands with a test that failed before the fix.
- Never: `.only`, `.skip`, `xit`, `test.fixme`, retries to hide flakes,
  `waitForTimeout` (wait for a condition instead), mocking the engine in
  E2E, or lowering thresholds. `npm run check:hygiene` (gate step `hygiene`) scans for these.
- Flaky = failing. Fix it or quarantine it with an issue link and the
  user's approval; quarantined tests still run and report.
- Playwright: `page.on('console')` and `pageerror` are collected in every
  test; any error fails the test.
- Keep outputs out of the conversation: reporters write to
  `.artifacts/`; read `.artifacts/gate-summary.md`, not raw logs.
