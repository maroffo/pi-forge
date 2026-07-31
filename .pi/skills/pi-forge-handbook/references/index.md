# Pi Forge Behavior Map Index

Start here. Open only the card and registers relevant to the requested behavior.

## Mapped pilot behaviors

- `expert-panel`: [Expert Panel](behaviors/expert-panel.md), registers `pi-subagents-version` and `expert-panel-chain-digest`.
- `protected-agent-policy`: [Protected Agent Policy](behaviors/protected-agent-policy.md), registers `pi-subagents-version`, `protected-agent-identities`, and `run-attestations`.

## Register view

See [registers.md](registers.md) for definitions and cross-behavior consumers.

## Explicitly unmapped workflows

The pilot keeps these workflow IDs explicitly unmapped:

- `lifecycle-enforcement`
- `session-telemetry`
- `deterministic-scoring`
- `source-control`
- `planning-delivery`
- `pr-review`

Mentions of Expert Panel or protected agents inside those files are mapped only as coupled surfaces of the two pilot behaviors. Use direct repository search and current source evidence for every unmapped workflow.
