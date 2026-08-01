---
name: pi-forge-harness-audit
description: Maintainer-only, read-only analysis of a privacy-preserving Pi Forge cohort artifact into one falsifiable harness change contract. Use only after a cohort of at least five comparable sessions has been aggregated.
disable-model-invocation: true
---

# Pi Forge Harness Audit

This is a trusted-project maintainer workflow. It turns sanitized cohort observations into at most one falsifiable proposal. It is not source authority, edit authorization, proof of causality, or permission to disclose telemetry.

## Preconditions

1. Require one exact cohort artifact produced by `skills/session-telemetry/scripts/aggregate-session-traces.mjs`.
2. Before reading it into model context, require explicit user authorization for that exact artifact and the currently active provider. Never invoke a subagent, Expert Panel, network tool, or another provider with telemetry.
3. Do not read raw Pi session files, extracted per-session traces, prompts, source, paths, commands, outputs, or findings. If the aggregate is insufficient, record a gap instead of opening raw sessions.
4. Validate the aggregate before interpretation:
   - JSON object with `schemaVersion: 1`, `traceSchemaVersion: 2`, and `kind: cohort_summary`;
   - only `totals`, `medians`, `sessionCounts`, `sessionRates`, and `warnings` beyond schema fields;
   - integer `sessionCounts.total` from 5 through 100;
   - nonnegative finite numeric aggregate values and no per-session rows, identifiers, hashes, timestamps, paths, extrema, or free-form session content.
5. Ask the operator to assert explicitly that the selected sessions are comparable for the intended evaluation. Do not infer task, skill, repository, provider, or workflow comparability from telemetry. Stop if the operator declines or cannot support the assertion.

## Analysis protocol

Keep these sections distinct:

- **Observations:** aggregate values and fixed warnings present in the authorized artifact.
- **Hypotheses:** tentative explanations that could account for an observation. Never state causal attribution.
- **Evidence gaps:** unobserved shell/custom-tool behavior, selection bias, missing baseline context, or any information needed to falsify a hypothesis.

Choose no more than one primary failure hypothesis. If the evidence does not support one narrow, testable proposal, return `insufficient evidence` with the gaps. Do not turn every warning or rate into a recommendation.

## Change contract

Use `references/change-contract-template.md`. One contract proposes one harness mutation. Two mechanically inseparable edits are allowed only when the contract explains why they are one test unit.

The contract must include:

- baseline cohort and the operator's comparability assertion;
- one primary hypothesis;
- one proposed mutation;
- predicted aggregate effect;
- protected invariants;
- evidence gaps;
- measurement protocol and a distinct post-change evaluation cohort;
- numeric or otherwise objective falsification threshold;
- rollback procedure;
- explicit approval state;
- result state.

Missing fields keep the contract in draft and block promotion.

## Hard boundaries

- Do not edit source, configuration, skills, prompts, agents, tests, or telemetry artifacts.
- Do not refresh or expand the Behavior Map.
- Do not claim that a cohort metric caused an outcome or that unobserved behavior did not occur.
- Do not make the change, run an automatic optimization loop, promote a result, or treat this skill as implementation approval.
- Do not expose the artifact to another provider or destination without separate exact-artifact consent.
- Do not combine unrelated mutations to improve an aggregate after seeing the evaluation result.

Present the draft contract in the current conversation. If the user accepts it, route it through a separately approved `plan-forge` or orchestrator plan with normal source inspection, implementation, verification, and review. Approval of the audit contract alone authorizes none of those side effects.
