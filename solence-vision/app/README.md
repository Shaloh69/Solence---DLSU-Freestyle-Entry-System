# app/

The FastAPI service Express calls (brief §7.4). `main.py` — HTTP +
WebSocket job endpoints (staged progress events); `pipeline.py` — the
model-agnostic staged run (injectable predictors keep it testable
without weights); `fusion.py` — pure-numpy mask+detection fusion;
`models.py` — lazy weight loading that fails with the exact command to
run. Recognition returns 503 until both models are trained.
