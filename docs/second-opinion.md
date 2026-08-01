# Second Opinion Contract

## Entry points

`/second-opinion <focus>` is a prompt alias for the `second-opinion` skill. The current parent model first resolves the strongest supportable subject, inspects only relevant evidence, distinguishes verified facts from assumptions and gaps, redacts unnecessary private material, and prepares counterexample and falsification questions. It then calls `convene_expert_panel` once.

`/expert-panel <artifact>` skips parent-model preparation and immediately enters the guarded preflight for an artifact that is already self-contained. With no argument, it selects the latest non-empty assistant text block. Immediate means no preparation turn; it does not bypass provider confirmation or send the artifact before consent.

Both paths refuse payloads above 200,000 characters instead of truncating them silently. Both paths require the digest-bound confirmation before launch. The prepared path additionally opens its rendered brief in an editor before that confirmation; the immediate path confirms the exact artifact supplied to the command.

## Prepared brief

The skill supplies six explicit fields to the tool:

- review objective;
- exact subject under review;
- verified context and constraints;
- evidence;
- assumptions, uncertainties, and evidence gaps;
- ordered questions for the panel.

Before calling the tool, the parent shows a concise preparation note. The tool then opens the exact rendered payload in an editor so the user can inspect, redact, accept, or cancel it. Missing evidence remains labelled rather than invented. The accepted brief, not the parent conversation or project context, becomes the chain task.

## Disclosure

Before launch, Pi Forge validates the generated chain digest, verifies that the active RPC responder is exactly pi-subagents 0.37.2, and preflights every effective agent contract. It rejects user/project shadowing, context inheritance, fallback models, extra skills, ambient extensions, or tools beyond `structured_output`. The preflight runs again after consent, immediately before spawn.

The user then sees:

- the exact editable payload when the skill path is used;
- accepted payload size and SHA-256 digest;
- all four panelist provider and model IDs;
- the separate OpenAI synthesis call and its inputs;
- excluded context and capabilities.

Cancellation launches no child.

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

## Session opt-in automatic path

`/auto-panel enable` opens a standing-consent dialog that names the fixed providers, OpenAI synthesis, five model calls, one-shot scope, lack of a per-run editor or confirmation, scanner limitations, reset behavior, and inability to revoke calls after spawn. Decline or headless use leaves the mode disabled. `/auto-panel status` reports state; `/auto-panel disable` revokes an unused grant.

The grant exists only in extension memory and resets on session start or `/reload`. A direct protected `pi-forge.socratic-analyst` call that returns a complete Second Opinion recommendation while the grant is enabled mints a receipt bound to the exact tool-result input and a digest of its task and output. The receipt remains valid only during the current parent agent run; the next user `input` event clears it. The first automatic tool attempt consumes that receipt. The automatic tool requires the same prepared fields plus literal `classification: sanitized`. It rejects obvious private-key, credential, provider-token, personal-email, and private-path patterns without echoing the rejected content. These checks are heuristics and do not prove sanitization; headless or payload-policy rejection requires a fresh Socratic recommendation before another automatic attempt.

An accepted payload consumes the grant before runtime validation or RPC work. The automatic path uses the same generated chain, runtime pin, ping, and two isolation preflights, but skips the payload editor and per-run digest confirmation under the prior standing consent. Failure, cancellation, abort, and unknown acknowledgement remain consumed and are never retried automatically. The one-shot state and protected Socratic receipt prevent recursive automatic panels. Existing manual paths do not consult this state and retain their full consent flow.

## Failure behavior

The parallel group does not fail fast, so every provider gets a chance to answer. A missing or schema-invalid report prevents a complete synthesis; it is never treated as agreement or silently omitted.

## Security boundary

This workflow provides conversational and data isolation. It is not an OS sandbox. The critics have no filesystem, shell, or network tools, so they cannot read or execute local files, but the supplied artifact is transmitted to each configured provider. The internal structured-output tool has no general filesystem capability. Automatic mode replaces exact-payload consent with bounded standing consent; a model can misclassify sensitive content and the local scanner can miss it.

Pi-subagents RPC v1 cannot atomically bind a preflight digest to spawn. Pi Forge therefore assumes trusted local configuration and no concurrent mutation of package, agent, or settings files during the few instructions between the final preflight and spawn. A local actor able to mutate those files can also modify Pi Forge itself and is outside this boundary.
