---
name: refine-requirements
description: Structured requirements clarification before planning. Use when a request has material ambiguity, multiple valid approaches, implicit product decisions, or unclear acceptance criteria. Skip when existing requirements already determine the implementation.
---

# Requirements Refinement

Resolve only ambiguities that would materially change behavior, scope, architecture, security, data, or acceptance. Do not turn refinement into a generic questionnaire.

## 1. Select scope behavior

Classify the task before asking other questions:

| Task class | Scope behavior |
|---|---|
| Bug fix or refactor | Hold Scope silently |
| Feature | Ask once: Hold Scope, Selective Expansion, or Reduction |
| Greenfield | Ask once: Hold Scope, Selective Expansion, Expansion, or Reduction |
| Unclear class | Hold Scope silently |

Recommend **Hold Scope** when asking.

- **Hold Scope**: clarify how to deliver the request, never whether to add adjacent features.
- **Selective Expansion**: adjacent additions may be proposed one at a time.
- **Expansion**: wider additions may be proposed one at a time, only for greenfield work.
- **Reduction**: proposed cuts are discussed one at a time; nothing is removed silently.

Declined additions or cuts become deferred ideas, not hidden decisions.

## 2. Find consequential gray areas

Look for decisions appropriate to the domain:

- UI: layout, density, interaction, accessibility, loading and empty states;
- API or CLI: inputs, output shape, compatibility, errors, authentication;
- infrastructure: availability, scaling, recovery, observability, cost;
- integration: protocol, credentials, retries, idempotency, failure recovery;
- data: ownership, migration, retention, consistency, privacy;
- delivery: acceptance evidence, rollout, rollback, operational ownership.

Do not ask about choices already settled by the codebase, working agreement, or request. Inspect available context first when doing so can answer the question safely.

## 3. Ask concrete questions

Ask one focused question at a time. Provide two to four concrete choices, explain only the tradeoff that affects the decision, and include “Use your judgment” when delegation is safe.

Follow the user's answer when it exposes another material decision. Stop when remaining ambiguity can be handled by the simplest reversible implementation.

In non-interactive execution, do not invent product decisions. Return the unresolved choices with a recommended default and explain why work is blocked or which assumption is safe.

## 4. Guard scope

Stay within the selected scope behavior. Capture out-of-radius suggestions under deferred ideas and return to the requested outcome. Never bundle multiple additions or removals into one approval question.

## 5. Produce the handoff

Return a planning-ready block:

```markdown
## Decisions
- Decision: ...
  Rationale: ...
  Acceptance evidence: ...

## Deferred Ideas
- ...

## Open Questions
- None
```

Include only decisions actually made. Preserve unresolved items under `Open Questions`; do not silently convert recommendations into user choices.

## Anti-patterns

- “What are your requirements?” instead of a concrete decision;
- walking a fixed checklist regardless of relevance;
- asking about implementation details discoverable from the repository;
- expanding scope while Hold Scope is active;
- asking the scope-mode question for bug fixes, refactors, or unclear task classes;
- bundling several scope changes into one question;
- continuing to ask after the plan has enough information to proceed safely.
