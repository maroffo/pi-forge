# Second Opinion Contract

## Input

`/second-opinion <artifact>` reviews the explicit command argument. With no argument, it reviews the latest non-empty assistant text block.

The command refuses targets above 200,000 characters instead of truncating them silently.

## Disclosure

Before launch, Pi Forge validates the generated chain digest, verifies that the active RPC responder is exactly pi-subagents 0.37.2, and preflights every effective agent contract. It rejects user/project shadowing, context inheritance, fallback models, extra skills, ambient extensions, or tools beyond `structured_output`. The preflight runs again after consent, immediately before spawn.

The user then sees:

- payload size;
- all four critic provider and model IDs;
- the separate OpenAI synthesis call and its inputs;
- excluded context and capabilities.

Cancellation launches no child.

## Independent review

Four `independent-critic` children receive the same artifact and rubric in fresh context:

| Perspective | Model |
|---|---|
| A | `openai-codex/gpt-5.6-sol` |
| B | `anthropic/claude-fable-5` |
| C | `google/gemini-3.6-flash` |
| D | `deepseek/deepseek-v4-pro` |

The children receive no parent conversation, project context, skill catalog, ambient extension list, filesystem, shell, or network tools, or sibling output. Pi-subagents enables only its internal `structured_output` tool so each critic can return schema-validated findings.

## Synthesis

A fresh, package-qualified `opinion-synthesizer` receives:

- the original artifact, sent to OpenAI for a second time;
- reports labeled A through D;
- no model identity metadata supplied by the chain.

Critics are instructed not to self-identify, but arbitrary text cannot make anonymity a hard guarantee. The design therefore minimizes identity bias rather than claiming perfect blindness.

The synthesizer must separate consensus, disagreement, priority findings, discarded claims, and evidence still needed. It uses `openai-codex/gpt-5.6-sol` in the initial implementation.

## Failure behavior

The parallel group does not fail fast, so every provider gets a chance to answer. A missing or schema-invalid report prevents a complete synthesis; it is never treated as agreement or silently omitted.

## Security boundary

This workflow provides conversational and data isolation. It is not an OS sandbox. The critics have no filesystem, shell, or network tools, so they cannot read or execute local files, but the supplied artifact is transmitted to each configured provider. The internal structured-output tool has no general filesystem capability.

Pi-subagents RPC v1 cannot atomically bind a preflight digest to spawn. Pi Forge therefore assumes trusted local configuration and no concurrent mutation of package, agent, or settings files during the few instructions between the final preflight and spawn. A local actor able to mutate those files can also modify Pi Forge itself and is outside this boundary.
