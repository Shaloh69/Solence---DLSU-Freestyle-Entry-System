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
- Real corpus first: E2E and vision tests load plans from
  `test-assets/manifest.json` by id, never by ad-hoc path. Each real plan
  has expected values in `test-assets/expectations/<id>.json`
  (room count ± tolerance, wall IoU vs ground-truth SVG ≥ threshold,
  simulation must complete, PDF must render).
- Every bug fix lands with a test that failed before the fix.
- Never: `.only`, `.skip`, `xit`, `test.fixme`, retries to hide flakes,
  `waitForTimeout` (wait for a condition instead), mocking the engine in
  E2E, or lowering thresholds. `check:test-hygiene` scans for these.
- Flaky = failing. Fix it or quarantine it with an issue link and the
  user's approval; quarantined tests still run and report.
- Playwright: `page.on('console')` and `pageerror` are collected in every
  test; any error fails the test.
- Keep outputs out of the conversation: reporters write to
  `.artifacts/`; read `.artifacts/gate-summary.md`, not raw logs.
