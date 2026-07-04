# lib/api-client/

The only path between the frontend and the Express API — typed fetch
wrappers (`index.ts`) plus the mirrored contract types (`types.ts`).
No compliance/sizing/routing math belongs on the client; if a component
needs a computed value, it comes from a `SimulationResult` field.

Keep `types.ts` in lockstep with `server/src/engine/types.ts` and
`server/docs/api.md` whenever the contract changes. `realtimeUrl()`
derives the WebSocket endpoint from `NEXT_PUBLIC_API_URL`.
