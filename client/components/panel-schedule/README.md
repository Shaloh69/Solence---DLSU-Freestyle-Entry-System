# components/panel-schedule/

Generated schedule tables driven by `SimulationResult.schedule` and
`.directory`: the panel schedule (per-circuit breaker/conductor/run with
totals and phase balance) and the panel directory list. Row colors match
the canvas/3D circuit coding. Presentational only — computation happens
in `server/src/engine/load-calc/`.
