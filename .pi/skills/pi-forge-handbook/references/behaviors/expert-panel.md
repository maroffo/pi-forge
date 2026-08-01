# Expert Panel

## Purpose

Prepare or accept one self-contained review artifact, disclose the exact multi-provider boundary, launch four isolated evidence-bound adversarial examinations, and synthesize only supported surviving challenges without inheriting parent context or capabilities. The optional Socratic workflow can construct and examine the claim map before separately authorized escalation.

## Triggers

The Socratic path starts from `socratic-analysis-skill` and may use `socratic-analyst-agent` to recommend escalation. By default that recommendation is non-authorizing; a separate session one-shot standing grant can authorize one automatic sanitized launch. The prepared path starts from the `second-opinion` skill and tool. The immediate path starts from the `expert-panel` command. Package planning and PR-review skills may direct users to the immediate path after they have already built a self-contained artifact.

## Inputs

The Socratic path receives an optional focus through `socratic-analysis-prompt`, resolves a self-contained artifact, and returns a claim map plus an escalation recommendation. `socratic-analysis-doc` records its public contract. The prepared path receives evidence-labelled brief fields and produces one editable payload. The immediate path receives explicit command text or the latest assistant text. Both panel paths use the fixed chain, runtime pin, provider roster, and current Pi extension context.

## Outputs

A launch outcome is launched, cancelled, or unknown. Successful acknowledgement may include a canonical run ID. The asynchronous chain produces four structured perspectives followed by one synthesis.

## State transitions

Socratic analysis asks at most one material question per parent turn and launches only the protected artifact-only analyst. Manual escalation requires a separate explicit yes. Automatic escalation first requires an interactive, memory-only one-shot grant, then a direct complete protected Socratic recommendation that mints a one-attempt receipt bound to the exact tool result, literal sanitized classification, and `automatic-panel-payload-gate`; `automatic-panel-command-parser` constrains grant management. The receipt is cleared by the next user input or consumed on the first automatic tool attempt, while the grant is consumed before the shared launcher and never retried. Manual preparation validates substantive fields, renders the brief, and opens interactive review. The shared launcher validates chain integrity and runtime, performs preflight and ping, requests digest-bound consent only for manual mode, repeats preflight, emits spawn, and classifies acknowledgement. Every critic uses the same steelman, weakest-dependency, counterexample, falsification-test, and surviving-judgment schema. Generated chain resources remain bound to canonical generator inputs.

## Exceptional paths

Missing UI, invalid brief content, runtime drift, shadowed agents, changed capabilities, failed ping, declined consent, pre-spawn abort, post-spawn abort, and acknowledgement timeout fail or return without automatic retry. Automatic mode additionally rejects missing standing grant, missing or stale protected recommendation receipt, reused grant, and obvious sensitive-data shapes. It consumes the receipt on the first tool attempt and the grant before launcher work, including known failure or uncertain acknowledgement. Post-emission uncertainty remains unknown because the run may already exist.

## Source of truth

Canonical behavior begins at `socratic-analysis-skill`, `socratic-analysis-prompt`, `socratic-analysis-doc`, `socratic-analyst-agent`, `automatic-panel-command-parser`, `automatic-panel-payload-gate`, `second-opinion-skill`, `second-opinion-brief-builder`, `second-opinion-disclosure-validator`, `second-opinion-preflight`, `second-opinion-runtime-validator`, `expert-panel-launcher`, and `second-opinion-extension`. Chain structure originates at `build-second-opinion-chain`; package metadata pins the shared runtime through `package-runtime-version` and `lock-runtime-version`.

## Generated artifacts

`second-opinion-chain` and `chain-integrity-constant` are generated from the chain builder and canonical model configuration. Existing generator checks, not behavior-map fingerprints, establish generated output equality.

## Tests

The focused Socratic contract and escalation checks live in the mapped Socratic tests. The adversarial schema, generated behavior, launcher, and cancellation matrix live in the mapped second-opinion tests. Orchestration tests cover user-entry guidance. Runtime probes cover package prompt expansion, command discovery, preflight, consent cancellation, and upgrade compatibility.

## Registers

- `pi-subagents-version`
- `expert-panel-chain-digest`

## Locators

- `socratic-analysis-skill`
- `socratic-analysis-prompt`
- `socratic-analysis-doc`
- `socratic-analyst-agent`
- `automatic-panel-command-parser`
- `automatic-panel-payload-gate`
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
