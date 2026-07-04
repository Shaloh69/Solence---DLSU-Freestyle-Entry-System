# realtime/

The single WebSocket gateway the frontend talks to (brief section 2.4).
Clients connect to `/ws`, send `{type:"subscribe", projectId}`, and
receive pushes — the frontend never connects to solence-vision directly.

Events today: `subscribed`, `simulation` (full `SimulationResult` after
every recompute). Planned: `ai-progress` relaying solence-vision job
stages.

To push a new event type: call `broadcastToProject(projectId, event)`
from wherever the state changes (see the simulate route), document the
event in `../../docs/api.md`, and handle it in the client store's
`onmessage` (`client/lib/editor-store.ts`).
