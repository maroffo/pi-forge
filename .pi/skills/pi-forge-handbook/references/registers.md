# Pi Forge Behavior Registers

Registers are cross-file values or invariants. Locator IDs resolve through `manifest.json`; reopen every target in current source.

## `pi-subagents-version`

The reviewed runtime version is defined by `runtime-version-constant`, duplicated in package dependency metadata at `package-runtime-version` and `lock-runtime-version`, and consumed at `second-opinion-runtime-validator` and `protected-launch-validator`. Changes require package, lock, runtime validation, generator, upgrade-probe, and documentation review.

Behaviors: `expert-panel`, `protected-agent-policy`.

## `expert-panel-chain-digest`

The generated chain and integrity binding originate at `build-second-opinion-chain`. `chain-integrity-constant` is generated, while `chain-disclosure-validator` checks the exact digest, agent order, model order, and synthesis contract before disclosure.

Behavior: `expert-panel`.

## `protected-agent-identities`

Canonical protected identities begin at `artifact-agent-names`, `writer-agent-name`, `reviewer-agent-names`, `tech-writer-agent-name`, and `socratic-analyst-agent-name`. `protected-launch-validator` enforces their effective source and capability ceilings. `lifecycle-writer-agent` and `telemetry-writer-input` are coupled consumers that must remain consistent even though their wider workflows are outside the pilot.

Behavior: `protected-agent-policy`.

## `run-attestations`

`run-attestation-entry` names the persisted custom entry. `protected-resume-validator` interprets exact run identity, classification, source kind, restore state, and canonical async directory before resume. `agent-policy-extension` restores and records attestations around subagent tool events.

Behavior: `protected-agent-policy`.
