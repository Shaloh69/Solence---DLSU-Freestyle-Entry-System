# components/compliance/

The live PEC violation panel: renders `SimulationResult.violations`
(and routing errors) with severity chips and the PEC reference each rule
implements. Purely presentational — rules live in
`server/src/engine/compliance/`; new rules appear here automatically as
long as they emit the standard `Violation` shape.
