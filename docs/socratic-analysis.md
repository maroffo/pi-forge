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

### Session opt-in automation

`/auto-panel enable` offers a separate interactive standing-consent dialog. If accepted, it grants exactly one automatic provider-launch attempt in the current session or extension instance. The grant resets on a new session or `/reload`, can be revoked before use with `/auto-panel disable`, and is observable with `/auto-panel status`.

After a direct complete Socratic recommendation, the extension mints one in-memory receipt from the exact protected call input and result digest. The receipt is valid only inside the current parent agent run and is cleared by the next user `input` event. The parent may prepare a bounded brief and call `convene_opt_in_expert_panel` with `classification: sanitized`. The first automatic tool attempt consumes that receipt, even when headless or rejected by the payload policy, so an unrelated or corrected brief requires a new protected recommendation. The extension also rejects obvious credential, private-key, personal-email, and private-path patterns. This scanner is a heuristic, not proof that an artifact is safe. A model-provided sanitized classification is also not proof.

When accepted, the grant is consumed before preflight and cannot be retried automatically after failure, cancellation, abort, or unknown acknowledgement. The automatic path keeps chain integrity, runtime pinning, ping, and both isolation preflights, but intentionally skips the per-run editor and digest confirmation. One grant cannot recursively launch another panel. Calls already emitted cannot be revoked reliably.

If automation is disabled, consumed, missing a fresh receipt, headless, or rejects the payload, no automatic provider call occurs. The parent can then offer the manual reviewed path through a new yes-or-no question. Manual `/second-opinion` and `/expert-panel` behavior does not use or weaken the automatic grant.

## Limitations

Socratic structure does not prove correctness or causality. The result is bounded by the supplied artifact and may be inconclusive. The workflow does not provide project reconnaissance, trace-derived skill learning, synthetic task generation, source edits, automatic promotion, or automatic provider fan-out.
