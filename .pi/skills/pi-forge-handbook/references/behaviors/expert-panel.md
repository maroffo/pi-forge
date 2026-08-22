# Expert Panel

## Purpose

Prepare or accept one self-contained review artifact, disclose the exact multi-provider boundary, launch four isolated evidence-bound adversarial examinations, and synthesize only supported surviving challenges without inheriting parent context or capabilities. The optional Socratic workflow can construct and examine the claim map before separately authorized escalation.

## Triggers

The Socratic path starts from `socratic-analysis-skill` and may use `socratic-analyst-agent` to recommend escalation. By default that recommendation is non-authorizing; either a session one-shot grant or persistent trusted-project consent may authorize a sanitized automatic launch. Prepared Second Opinion, Plan Forge, and PR Review call the automatic launcher directly and fall back to the editable manual tool when automatic consent is unavailable. The immediate manual path starts from the `expert-panel` command. Parent workflows capture operation IDs and await synthesis rather than directing users to relay run IDs.

## Inputs

The Socratic path receives an optional focus through `socratic-analysis-prompt`, resolves a self-contained artifact, and returns a claim map plus an escalation recommendation. `socratic-analysis-doc` records its public contract. The prepared path receives evidence-labelled brief fields and produces one editable payload. The immediate path receives explicit command text or the latest assistant text. Both panel paths use the fixed chain, runtime pin, provider roster, and current Pi extension context.

## Outputs

A launch outcome is launched, cancelled, or unknown. Successful acknowledgement must include a canonical run ID; a missing ID is unknown. The asynchronous chain produces four structured perspectives followed by one synthesis.

## State transitions

Socratic analysis asks at most one material question per parent turn and launches only the protected artifact-only analyst. Manual escalation requires a separate explicit yes. Session automatic escalation first requires an interactive memory-only one-shot grant, then a direct complete protected recommendation that mints a current-turn receipt bound to the exact tool result and literal sanitized classification. Persistent automation stores a private, file-and-directory-fsynced user-level record on supported non-Windows filesystems through `persistent-panel-consent-store`; `persistent-panel-consent-contract` binds it to providers, chain, pi-subagents runtime, synthesis, scanner, concurrency, proof-gated retry, and unknown-launch semantics. It applies only when Pi reports the project trusted, permits one active operation per session, and does not require a Socratic receipt. `automatic-panel-command-parser` constrains both grant scopes, while `automatic-panel-payload-gate` remains mandatory.

Manual preparation validates substantive fields, renders the brief, and opens interactive review. At extension registration, the shared launcher captures, validates, and recursively freezes one chain snapshot with its imported integrity binding. Each launch revalidates that snapshot and runtime, performs preflight and ping, requests digest-bound consent only for manual mode, repeats preflight, emits spawn, and classifies acknowledgement. Acknowledged tool launches return a logical operation ID registered with background-work v1. Await resolves the exact same-session final synthesis and may safely be repeated for the same ID after a timeout or abort. Completion events require the exact owning session. Persistent mode may replace one definitively failed normal lifecycle-v3 run; paused, stopped, stale-repaired, malformed, unknown, foreign-session, session-changed, or pre-reload outcomes settle or remain ignored without retry. Unknown launch acknowledgement blocks persistent consent until fleet reconciliation and interactive re-enrollment. Consent persists across reload, while the redacted target and logical operation correlation intentionally remain memory-only. Every critic uses the same steelman, weakest-dependency, counterexample, falsification-test, and surviving-judgment schema. Generated chain resources remain bound to canonical generator inputs.

## Exceptional paths

Missing UI on manual/session paths, invalid brief content, runtime drift, shadowed agents, changed capabilities, failed ping, declined consent, pre-spawn abort, post-spawn abort, and acknowledgement timeout fail or return without model-driven retry. Session automatic mode additionally rejects missing or stale protected recommendation receipts and reused grants. Persistent mode rejects missing, malformed, stale, blocked, or unsafe consent records, untrusted projects, missing session identity, and an already-active operation. It reloads consent with trust and session ownership adjacent to spawn. Both reject obvious sensitive-data shapes. Post-emission uncertainty remains unknown because the run may already exist. Persistent replacement requires a normal lifecycle-v3 failed result with structured children and rechecks consent, trust, session ownership, runtime, and preflight before spawn.

## Source of truth

Canonical behavior begins at `socratic-analysis-skill`, `socratic-analysis-prompt`, `socratic-analysis-doc`, `socratic-analyst-agent`, `automatic-panel-command-parser`, `automatic-panel-payload-gate`, `second-opinion-skill`, `second-opinion-brief-builder`, `second-opinion-disclosure-validator`, `second-opinion-preflight`, `second-opinion-runtime-validator`, `expert-panel-launcher`, and `second-opinion-extension`. Chain structure originates at `build-second-opinion-chain`; package metadata pins the shared runtime through `package-runtime-version` and `lock-runtime-version`.

## Generated artifacts

`second-opinion-chain` and `chain-integrity-constant` are generated from the chain builder and canonical model configuration. Existing generator checks, not behavior-map fingerprints, establish generated output equality.

## Tests

The focused Socratic contract and escalation checks live in the mapped Socratic tests. The adversarial schema, generated behavior, private persistent store, trust gate, operation await, proof-gated retry, launcher, and cancellation matrix live in the mapped second-opinion tests. Orchestration tests cover direct parent-tool guidance without user-relayed IDs. Runtime probes cover package prompt expansion, command discovery, preflight, consent cancellation, and upgrade compatibility.

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
- `persistent-panel-consent-contract`
- `persistent-panel-consent-store`
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
