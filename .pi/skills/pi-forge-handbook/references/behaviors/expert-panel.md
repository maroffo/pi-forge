# Expert Panel

## Purpose

Prepare or accept one self-contained review artifact, disclose the exact multi-provider boundary, launch four isolated perspectives, and synthesize their evidence without inheriting parent context or capabilities.

## Triggers

The prepared path starts from the `second-opinion` skill and tool. The immediate path starts from the `expert-panel` command. Package planning and PR-review skills may direct users to the immediate path after they have already built a self-contained artifact.

## Inputs

The prepared path receives evidence-labelled brief fields and produces one editable payload. The immediate path receives explicit command text or the latest assistant text. Both paths use the fixed chain, runtime pin, provider roster, and current Pi extension context.

## Outputs

A launch outcome is launched, cancelled, or unknown. Successful acknowledgement may include a canonical run ID. The asynchronous chain produces four structured perspectives followed by one synthesis.

## State transitions

Preparation validates substantive fields, renders the brief, and opens interactive review. The shared launcher validates chain integrity and runtime, performs preflight and ping, requests digest-bound consent, repeats preflight, emits spawn, and classifies acknowledgement. Generated chain resources remain bound to canonical generator inputs.

## Exceptional paths

Missing UI, invalid brief content, runtime drift, shadowed agents, changed capabilities, failed ping, declined consent, pre-spawn abort, post-spawn abort, and acknowledgement timeout fail or return without automatic retry. Post-emission uncertainty remains unknown because the run may already exist.

## Source of truth

Canonical behavior begins at `second-opinion-skill`, `second-opinion-brief-builder`, `second-opinion-disclosure-validator`, `second-opinion-preflight`, `second-opinion-runtime-validator`, `expert-panel-launcher`, and `second-opinion-extension`. Chain structure originates at `build-second-opinion-chain`; package metadata pins the shared runtime through `package-runtime-version` and `lock-runtime-version`.

## Generated artifacts

`second-opinion-chain` and `chain-integrity-constant` are generated from the chain builder and canonical model configuration. Existing generator checks, not behavior-map fingerprints, establish generated output equality.

## Tests

The focused behavior and cancellation matrix lives in the mapped second-opinion tests. Orchestration tests cover the user-entry guidance. Runtime probes cover package prompt expansion, command discovery, preflight, consent cancellation, and upgrade compatibility.

## Registers

- `pi-subagents-version`
- `expert-panel-chain-digest`

## Locators

- `second-opinion-skill`
- `second-opinion-prompt`
- `second-opinion-brief-builder`
- `second-opinion-disclosure-validator`
- `second-opinion-preflight`
- `second-opinion-runtime-validator`
- `expert-panel-launcher`
- `second-opinion-extension`
- `build-second-opinion-chain`
- `second-opinion-chain`
- `chain-integrity-constant`
- `second-opinion-entry-points`
- `independent-critic-agent`
- `opinion-synthesizer-agent`
- `package-runtime-version`
- `lock-runtime-version`
