# Socratic Analysis Contract

## Entry points

`/socratic-analysis <focus>` is a prompt alias for the public `socratic-analysis` skill. `skill:socratic-analysis` exposes the same parent-owned workflow directly. The optional focus selects the subject but is not treated as complete evidence.

## Parent and child roles

The parent owns conversation state, evidence selection, one-question-at-a-time clarification, launch parameters, and any later escalation decision. It prepares one self-contained artifact and launches `pi-forge.socratic-analyst` on the current parent provider/model.

The analyst is package-qualified and protected as an artifact-only agent. It receives fresh context, a replacement system prompt, no inherited project context or skills, and no filesystem, shell, network, extension, MCP, persistence, sharing, or subagent capability. The parent must use `pi-forge.socratic-analyst`; the unqualified alias is rejected before discovery so a project agent cannot capture the workflow. The analyst cannot ask the user directly or invoke a slash command.

## Analysis contract

The analyst separates thesis, supplied facts, inferences, assumptions, constraints, strongest alternative, falsifiers, reconstructed conclusion, confidence, and unresolved evidence. It is constructive rather than automatically oppositional. When one missing input is material, it returns exactly one question; the parent validates and relays that question.

Each launch is stateless. Follow-up evidence requires a new self-contained artifact and a new protected launch. Protected runs are never resumed.

## Second Opinion escalation

The analyst may recommend Second Opinion only for an unresolved high-impact assumption, conflicting evidence, or a decision that is costly to reverse. This is a recommendation, not authorization by itself.

By default, the parent explains the reason and asks a separate yes-or-no question. Only an explicit yes after that recommendation permits the parent to follow the `second-opinion` skill. The existing editable payload, SHA-256 binding, fixed-provider disclosure, repeated preflight, and final consent remain mandatory. No, cancellation, silence, ambiguity, or prior approval launches nothing manually.

### Automatic consent

`/auto-panel enable` retains the separate in-memory one-shot session grant. It resets on a new session or `/reload`, can be revoked before use with `/auto-panel disable`, and remains observable with `/auto-panel status`. After a direct complete Socratic recommendation, the extension mints the current-turn receipt bound to the exact protected call input and result digest. The first session automatic attempt consumes that receipt; headless use, payload rejection, or launch failure requires a new recommendation. Session mode never retries.

`/auto-panel enable persistent` is a separate user-level grant for every project Pi currently marks trusted. It persists across sessions and reloads, works headlessly, does not require a Socratic receipt, and can be revoked with `/auto-panel disable persistent`. This Socratic workflow nevertheless escalates only after its own direct complete recommendation. Other parent-owned workflows such as Plan Forge and PR Review may use the same persistent tool without manufacturing a Socratic step. The stored grant becomes stale when its fixed provider, chain, pi-subagents runtime, scanner, concurrency, three-operation session cap, 400,000-character cumulative session cap, retry, or unknown-launch contract changes. Session usage and the active-operation reservation survive extension reload through Pi custom entries, and replacement payloads count again. An unknown persistent launch acknowledgement or correlation failure blocks the grant until the owning fleet is reconciled and the user interactively re-enrolls; that persistent-only block never suppresses an independently granted one-shot session path, including in a trusted project.

Both modes require a bounded brief and literal `classification: sanitized`. The extension rejects obvious credential, private-key, provider-token, personal-email, and private-path patterns. This scanner and the model's classification are heuristics, not proof of privacy. Accepted automatic paths preserve chain integrity, runtime pinning, ping, and both isolation preflights while intentionally skipping per-run editing and digest confirmation.

An acknowledged launch with a canonical run ID normally returns an exact operation ID. The parent calls `await_expert_panel` and receives the correlated final synthesis instead of asking the user to relay a run ID; an interrupted wait reuses that same ID and never reconvenes the panel. A `launched-uncorrelated` result means the run is active but has no await handle: inspect `/subagents-fleet`, stop, and never fall back or reconvene. Persistent mode allows one active operation at a time, three operations and 400,000 cumulative disclosed characters per Pi session, and one whole-chain replacement only after a normal lifecycle-v3 terminal failure with remaining character budget. Paused, stopped, stale-reconciled, malformed, unknown, or session-changed outcomes never retry. Exhausted character budget also prevents retry. The model never implements retry, and panel children cannot recurse because they receive only `structured_output`.

If automation is disabled, consumed, blocked after an unknown launch, stale, invalid, untrusted, over its session operation or character budget, missing a required session receipt, or rejects the payload, no automatic provider call occurs. The parent can then offer the manual reviewed path through a new yes-or-no question. That path calls the guarded tool directly and awaits its operation; it never asks the user to invoke a slash command. `launched-uncorrelated` is different because a call was emitted: it forbids fallback and points only to fleet inspection. Calls already emitted cannot be revoked reliably.

## Limitations

Socratic structure does not prove correctness or causality. The result is bounded by the supplied artifact and may be inconclusive. The workflow does not provide project reconnaissance, trace-derived skill learning, synthetic task generation, source edits, automatic promotion, or automatic provider fan-out.
