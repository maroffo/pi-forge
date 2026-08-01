# Harness Change Contract

One contract covers one proposed harness mutation. Keep every status explicit. Do not fill gaps with assumptions.

## Status

- Contract state: `draft | approved-for-planning | rejected | evaluated`
- Implementation approval: `not-authorized | separately-authorized`
- Result: `not-run | supported | falsified | inconclusive | rolled-back`

## Baseline cohort

- Cohort artifact: exact operator-approved aggregate artifact
- Aggregate schema: `schemaVersion: 1`, `traceSchemaVersion: 2`
- Session count: 5 to 100
- Cohort selection protocol:
- Operator comparability assertion:
- Aggregate observations:
- Artifact warnings:

## Primary hypothesis

State one tentative and falsifiable explanation. Do not claim causality.

## Proposed mutation

Describe one exact harness behavior change. If two edits are mechanically inseparable, explain why they form one test unit.

## Predicted effect

Name the aggregate metric, direction, and magnitude expected in the evaluation cohort.

## Protected invariants

List safety, privacy, isolation, consent, capability, verification, compatibility, and side-effect boundaries that must not regress.

## Evidence gaps

Separate unknowns, selection limits, unobserved behavior, and alternative explanations from observations and hypotheses.

## Measurement protocol

- Baseline inclusion/exclusion rule:
- Post-change inclusion/exclusion rule:
- Distinct evaluation cohort size, minimum 5:
- Operator comparability assertion required for both cohorts:
- Aggregator command uses repeated explicit files only:
- Confounders to hold stable or record:

## Falsification threshold

Define an objective result that rejects the primary hypothesis or makes the result inconclusive. Do not rewrite this threshold after observing the evaluation cohort.

## Evaluation cohort

- Aggregate artifact:
- Session count:
- Comparability assertion:
- Observations:
- Evidence gaps:

## Rollback

State the smallest reversible restoration, its verification, and the condition that triggers it.

## Approval

- Contract approved for planning by:
- Approval evidence:
- Separate implementation plan or authorization:
- Provider or artifact disclosure authorization, if any:

## Result

- Outcome against predicted effect:
- Protected-invariant checks:
- Falsification decision:
- Residual uncertainty:
- Rollback status:
- Promotion decision: `none | return-to-plan-forge`

A result never promotes itself. Any retained change follows normal planning, implementation, review, and authorization.
