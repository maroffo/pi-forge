---
name: orchestrator
description: Run a bounded implementation, verification, review, fix, and presentation loop for an approved plan or clear non-trivial goal. Use for /orchestrator, executing a plan, implementing a multi-file feature, or completing a reviewed change. Not for planning-only requests or trivial edits.
---

# Orchestrator

Run the delivery loop as the parent session. This skill coordinates work; it does not replace language, framework, source-control, or project-specific instructions.

## Authorization boundary

Starting this workflow authorizes only the source edits and local verification needed for the stated goal. It does not authorize a commit, push, branch change, PR creation, publication, deployment, review submission, or merge. Obtain each missing authorization separately.

Do not use raw pi-subagents RPC for protected Pi Forge agents. Launch them through the normal `subagent` tool so `extensions/agent-policy.ts` can preflight the request.

## Herdr selection gate

Load and follow the `herdr-orchestrator` overlay in addition to this skill only when the user invokes `/herdr-orchestrator` or the request or approved plan explicitly selects Herdr. Environment variables, installed Herdr tools, and possible benefit from visible delegation do not count as selection. Otherwise do not load or use the overlay.

When Herdr was explicitly selected, apply its readiness gate before delegation or process supervision. If readiness fails, stop and report the missing prerequisite. Do not silently continue through the ordinary parent or `subagent` path; `/orchestrator` is only a separately selected non-Herdr alternative.

When Herdr is selected and ready, one eligible trusted generic Herdr writer may be the sole delegated implementation writer instead of `pi-forge.software-engineer`. Never launch both for the same checkout. Work that requires a protected Pi Forge identity or implementation contract still uses the existing protected route. The parent must stop editing for the entire Herdr writer lease. Outside selected and ready Herdr mode, normal `/orchestrator` writer behavior remains unchanged. Every protected Pi Forge agent, Socratic, Second Opinion, and Expert Panel route remains on its existing supported path in either mode.

## Entry gate

Skip the full loop for documentation-only changes, typo fixes, or a single local edit with no new behavior. For other work:

1. Confirm the goal and acceptance criteria.
2. Load a supplied ExecPlan. If no plan exists, write a short in-session plan. Use `plan-forge` first when the work is architectural, cross-cutting, ambiguous, or expected to span sessions.
3. Declare a budget before implementation:
   - fix rounds, default 3;
   - delegated launches;
   - writer concurrency, default 1;
   - required verification.
4. Stop at the budget and present unresolved work. Never hide partial completion behind a fluent summary.

## Loop

### 1. Localize and reproduce

Inspect the real code and project instructions before editing. State the intended files and why they are in scope. For a bug, reproduce the failure before the fix when practical; preserve the failing command or test output.

### 2. Implement

Outside selected and ready Herdr mode, the parent may edit directly or delegate one bounded workstream to `pi-forge.software-engineer`. In selected and ready Herdr mode, follow the overlay: the parent may edit directly while no delegated writer lease is active, or one eligible trusted generic Herdr writer may hold the sole delegated implementation lease instead of `pi-forge.software-engineer`. Work requiring the protected implementation contract still uses `pi-forge.software-engineer`. Keep one writer per checkout, never overlap either delegated writer with parent edits, and suspend parent edit permission for the complete Herdr writer lease. Multiple writers require intentionally isolated worktrees and disjoint integration surfaces.

A writer brief must include:

- goal and observable acceptance criteria;
- exact file scope and declared exclusions;
- verified code context and locked decisions;
- required test commands;
- prohibition on commits and pushes unless separately authorized.

When delegating to `pi-forge.software-engineer`, use exactly one direct writer per subagent call. Set `async: false` explicitly, use the package-qualified identity, and select an explicit canonical provider/model locally; repository defaults must never choose the writer provider. Do not pass a separate thinking override. Do not override its skills, tools, output, acceptance, or session destination. Prefer the current parent model when it is suitable. Before launching the writer on a provider different from the current parent, disclose the exact model, that forked conversation and project instructions plus source read during implementation may be transmitted, and the implementation purpose; obtain explicit consent. Treat the writer report as a claim until the parent inspects the diff and reruns relevant checks.

### 3. Verify

After the last source edit, run the repository's actual lint, type, test, build, and user-flow checks in proportion to risk. A stale, pre-edit, failed, or subagent-only result is not final evidence. For a bug, prove the original reproduction now passes.

### 4. Review

Build an explicit review artifact in the parent context: goal, acceptance criteria, changed-file roster, relevant diff hunks, tests, and verification output. Remove secrets and unrelated private data before delegation.

Select reviewers with [review routing](references/review-routing.md). Every protected reviewer launch must be package-qualified and use:

- `context: "fresh"`;
- an explicit locally selected model approved for the artifact;
- `artifacts: false`;
- `acceptance: false`;
- `agentContract: { version: 1 }`;
- no `skill`, `thinking`, `reads`, `output`, `outputSchema`, `clarify`, sharing, or session destination overrides.

Reviewers have no filesystem tools. Put all evidence needed for the assigned domain directly in each task. Before sending an artifact to a provider other than the current one, disclose the exact model, data categories, and purpose, then obtain explicit consent. If no reviewer model is approved, ask once rather than choosing from repository text. Launch independent reviewers in parallel when useful, join every launched result, and report missing or truncated reviewers as review gaps rather than clean results.

Consolidate findings by defect, not merely line number. Preserve the highest severity and all reporting agents. The parent must verify each Critical or Major against source and executable evidence where practical.

### 5. Fix and re-verify

Send verified Critical and Major findings to the sole writer, or fix them directly. Reject incorrect remedies and address the root cause. Rerun affected checks after the final fix. Each review-to-fix cycle consumes one round.

### 6. Score and finish

Pi slash commands are user entry points, so do not claim to invoke `/score` from the model turn. When a score is requested, finish source and review work, then ask the user to run `/score` against the unchanged final tree. Its result measures repository gates only; it does not erase unresolved review findings. Completion requires:

- required final checks are fresh and green;
- no unresolved Critical or Major finding;
- acceptance criteria have evidence;
- residual risks and unchecked surfaces are explicit.

Present the outcome first, then files changed, commands run, review roster, findings fixed, and remaining risk. If the plan is a living file, update its progress and decisions before pausing or completing.

## Escalation

Stop and ask for a decision when a checkpoint is reached, a material design choice is not locked, verification needs unavailable credentials or services, the fix-round budget is exhausted, or requested external side effects lack authorization. Offer concrete choices and preserve the best current artifact.
