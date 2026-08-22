# Second Opinion Contract

## Entry points

`/second-opinion <focus>` is a prompt alias for the `second-opinion` skill. The current parent model first resolves the strongest supportable subject, inspects only relevant evidence, distinguishes verified facts from assumptions and gaps, redacts unnecessary private material, and prepares counterexample and falsification questions. It first asks `convene_opt_in_expert_panel` to apply persistent trusted-project or session consent. If automatic consent is unavailable, it calls the editable `convene_expert_panel` fallback itself. A launched operation is collected through `await_expert_panel`; the user never has to invoke another command or relay a run ID.

`/expert-panel <artifact>` skips parent-model preparation and immediately enters the guarded preflight for an artifact that is already self-contained. With no argument, it selects the latest non-empty assistant text block. Immediate means no preparation turn; it does not bypass provider confirmation or send the artifact before consent.

Every path refuses payloads above 200,000 characters instead of truncating them silently. Manual prepared and immediate paths require digest-bound confirmation before launch; the manual prepared path additionally opens its rendered brief in an editor. Persistent trusted-project and one-shot session consent intentionally replace those per-run dialogs for sanitized payloads while retaining the scanner, fixed chain, runtime checks, and isolation preflights.

## Prepared brief

The skill supplies six explicit fields to the tool:

- review objective;
- exact subject under review;
- verified context and constraints;
- evidence;
- assumptions, uncertainties, and evidence gaps;
- ordered questions for the panel.

Before calling a launcher, the parent shows a concise preparation note. Missing evidence remains labelled rather than invented. Under persistent or session automatic consent, the scanner evaluates the rendered brief and no per-run editor opens. Under manual fallback, the tool opens that exact payload so the user can inspect, redact, accept, or cancel it. The accepted brief, never parent conversation or project context, becomes the chain task.

## Disclosure

Before launch, Pi Forge validates the generated chain digest, verifies that the active RPC responder is exactly pi-subagents 0.37.2, and preflights every effective agent contract. It rejects user/project shadowing, context inheritance, fallback models, extra skills, ambient extensions, or tools beyond `structured_output`. The preflight runs again after consent, immediately before spawn.

On a manual launch, the user then sees:

- the exact editable payload when the prepared skill path is used;
- accepted payload size and SHA-256 digest;
- all four panelist provider and model IDs;
- the separate OpenAI synthesis call and its inputs;
- excluded context and capabilities.

Persistent enrollment discloses the fixed providers, synthesis, maximum calls, headless trusted-project scope, scanner limits, and revocation once; later matching sanitized operations do not repeat the dialogs. Cancellation of a manual launch creates no child.

## Independent review

Four `independent-critic` children receive the same prepared brief or direct artifact and common evidence-bound adversarial examiner role in fresh context:

| Perspective | Model |
|---|---|
| A | `openai-codex/gpt-5.6-sol` |
| B | `anthropic/claude-fable-5` |
| C | `google/gemini-3.6-flash` |
| D | `deepseek/deepseek-v4-pro` |

Every critic must use the same ordered contract: steelman the subject, identify its weakest dependency, construct the strongest concrete counterexample supported by the artifact, define a falsification test, and state what survives. A challenge becomes a finding only when supplied evidence supports it after that sequence. The schema requires all five moves, but does not require any finding; `accept` with an empty findings array is valid.

The children receive no parent conversation, project context, skill catalog, ambient extension list, filesystem, shell, or network tools, or sibling output. Pi-subagents enables only its internal `structured_output` tool so each critic can return schema-validated findings.

## Synthesis

A fresh, package-qualified `opinion-synthesizer` receives:

- the original artifact, sent to OpenAI for a second time;
- reports labeled A through D;
- no model identity metadata supplied by the chain.

Critics are instructed not to self-identify, but arbitrary text cannot make anonymity a hard guarantee. The design therefore minimizes identity bias rather than claiming perfect blindness.

The synthesizer first reconstructs the strongest supportable steelman. It separates consensus, disagreement, priority findings, discarded claims, and evidence still needed. Only challenges supported by the artifact or a concrete falsification path become priority findings; unsupported, performative, duplicate, or missing-context attacks are discarded with reasons. Agreement and majority vote are not proof, and an accepted artifact may produce no priority findings. A panel result, including agreement or surviving challenges, does not independently verify facts or prove correctness or causality. Synthesis uses `openai-codex/gpt-5.6-sol` in the initial implementation.

## Automatic consent and correlated operations

`/auto-panel enable` retains the memory-only one-shot session grant. It names the fixed providers, OpenAI synthesis, five model calls, lack of per-run dialogs, scanner limits, reset behavior, and inability to revoke calls after spawn. A direct complete protected Socratic recommendation mints the same current-turn receipt; the first session automatic attempt consumes the receipt and then the grant. Session mode remains interactive, resets on session start or `/reload`, never retries, and is managed with `/auto-panel status` and `/auto-panel disable`.

`/auto-panel enable persistent` creates a user-level mode-0600 consent record beneath the effective Pi agent directory. Persistent enrollment is unavailable on Windows because Node cannot durably fsync directory metadata there; manual and one-shot session consent remain available. The one-time dialog discloses that the grant applies to every project for which `ctx.isProjectTrusted()` is true, including headless runs; that trusted-project agents may initiate disclosure; that one normal operation makes five model calls; and that one bounded replacement may raise the total to ten calls. It also discloses one active operation at a time, at most three persistent operations and 400,000 cumulative disclosed characters per Pi session, with a replacement payload counted again. The record is bound to the exact provider roster, generated chain digest, pi-subagents runtime, synthesizer, scanner patterns, payload size, concurrency, per-session operation and character limits, proof-gated retry, and unknown-launch policy. Contract drift makes it stale rather than silently widening consent. Usage counters and the active-operation reservation are session-bound custom entries restored across `/reload`; an in-flight pre-reload operation therefore keeps the persistent slot closed even though its await correlation is not reconstructed. Consent is reloaded with project trust, session ownership, and budget adjacent to each persistent spawn. `/auto-panel disable persistent` deletes the exact record and prevents future launches; it cannot recall calls already spawned.

Persistent mode does not require a Socratic receipt, so Plan Forge, PR Review, Second Opinion, and other parent-owned trusted-project workflows can submit a truthfully sanitized prepared brief directly. It allows one active persistent operation at a time within the three-operation and 400,000-character session budgets. Session mode retains its direct Socratic receipt requirement. Both automatic modes require literal `classification: sanitized` and reject obvious private-key, credential, provider-token, authorization-header, personal-email, and private-path shapes without echoing rejected content. The checks are heuristics, not proof of privacy. Persistent payload rejection leaves the durable grant available for a corrected payload; session rejection consumes the recommendation receipt. A blocked persistent grant does not suppress a separately enrolled session grant: the session path still requires its fresh protected Socratic receipt and interactive owner.

Every acknowledged launcher requires a canonical run ID and normally returns an opaque operation ID. `await_expert_panel` waits on that exact same-session operation and returns the final synthesis as untrusted evidence, never instructions, so parent agents do not ask users to relay run IDs or scrape Herdr panes. If the run acknowledgement succeeds but same-session operation tracking cannot be established, the launcher reports `launched-uncorrelated`: the provider run is active, `/subagents-fleet` is the recovery surface, and reconvening is forbidden. Persistent correlation failure also blocks the persistent grant. An aborted or timed-out await leaves work active and may safely be repeated with the same operation ID; reconvening is never recovery. The extension retains the 20 newest settled results in session memory and returns an explicit `expired` diagnosis for a recently pruned ID. Pi Forge registers the logical operation through pi-subagents' background-work v1 registry; headless auto-drain and `subagent_wait` therefore do not lose the gap between a failed first run and its replacement.

A persistent operation retries the full fixed chain at most once, only after a normal pi-subagents lifecycle-v3 result definitively reports `success: false`, state `failed`, structured child results, the exact owning session ID, and enough remaining character budget for the repeated payload. Paused, stopped, malformed, stale-reconciled, missing-terminal-proof, unknown-acknowledgement, foreign-session, session-changed, or over-budget outcomes never retry. Consent, project trust, session usage, and session ownership are rechecked before the replacement preflight and adjacent to spawn. A negative, run-ID-less, timed-out, aborted, synchronously failed post-emission acknowledgement, or persistent correlation failure is unknown and atomically changes the persistent record to a blocked state, fsyncing both the record and its containing directory before reporting success. Persistent launches remain unavailable until the user inspects the owning fleet and interactively re-enables persistent consent; an independent session grant remains usable. The model never performs retry itself. Manual and one-shot session operations remain single-attempt. Operation correlation and retry targets stay in extension memory: the consent and usage checkpoint survive `/reload`, but an already-running pre-reload operation must be inspected through its original pi-subagents run because `await_expert_panel` cannot reconstruct the redacted retry target.

## Failure behavior

The parallel group does not fail fast, so every provider gets a chance to answer. A missing or schema-invalid report prevents a complete synthesis; it is never treated as agreement or silently omitted. Under persistent consent, that definite normal-run failure may consume the one replacement attempt and repeat the payload against the cumulative character budget. If the replacement also fails, its result is final. Launch acknowledgement uncertainty and repaired stale state remain unknown or failed without retry because a provider call might still exist. Unknown launch acknowledgement and persistent correlation failure block persistent automation; `/auto-panel status` exposes that state and the current active/operation/character usage, and re-enrollment warns that the fleet must be reconciled first. A blocked or untrusted persistent grant does not suppress a separately granted, receipt-bound one-shot session launch.

## Security boundary

This workflow provides conversational and data isolation. It is not an OS sandbox. The critics have no filesystem, shell, or network tools, so they cannot read or execute local files, but the supplied artifact is transmitted to each configured provider. The internal structured-output tool has no general filesystem capability. Automatic modes replace exact-payload consent with standing consent; a model can misclassify sensitive content and the local scanner can miss it. Pi project trust is an input-loading and consent signal, not containment against repository prompt injection or same-user processes.

Pi-subagents RPC v1 cannot atomically bind a preflight digest to spawn. Pi Forge therefore assumes trusted local configuration and no concurrent mutation of package, agent, or settings files during the few instructions between the final preflight and spawn. A local actor able to mutate those files can also modify Pi Forge itself and is outside this boundary.
