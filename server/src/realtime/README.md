# realtime/

The single WebSocket gateway the frontend talks to (brief section 2.4).
Clients connect to `/ws`, send `{type:"subscribe", projectId}`, and
receive pushes — the frontend never connects to solence-vision directly.

Events today: `subscribed`, `simulation` (full `SimulationResult` after
every recompute), and `ai-progress` (staged solence-vision job progress
— queued/running_wall_segmentation/running_detection/fusing/done/
applied/error — relayed by `../routes/vision.ts`, which is the only
thing that ever calls solence-vision).

To push a new event type: call `broadcastToProject(projectId, event)`
from wherever the state changes (see the simulate route), document the
event in `../../docs/api.md`, and handle it in the client store's
`onmessage` (`client/lib/editor-store.ts`).
