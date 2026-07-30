# ExecPlan Template

Every plan uses this structure. Drop only sections explicitly marked conditional.

```markdown
# <Title>

**Status:** draft | approved | in-progress | blocked | completed
**Origin:** <issue URL or in-session request>
**Base:** <branch and commit inspected>
**Goal:** <observable outcome>

## Analysis (verified <date>, do not re-derive without new evidence)

### Current behavior
- <claim with file:line evidence>

### Root cause or design gap
<One falsifiable paragraph.>

### Scope
- In: <paths and behaviors>
- Out: <deliberate exclusions and why>
- Recover excluded context from: <paths or references>

### Candidate approaches
| Approach | Decision | Evidence and trade-off |
|---|---|---|
| <approach> | chosen/rejected | <reason> |

### Independent opinion
<ran with disclosed providers and consent, not run with reason, or not applicable>

## Locked decisions

Append only. Reverse a decision with a new row that names the superseded row.

| # | Decision | Choice | Evidence/rationale | Revisit if |
|---|---|---|---|---|
| 1 | <axis> | <choice> | <why> | <condition> |

## Acceptance criteria
- [ ] <observable truth>

## Workstreams

### W0: Reproduce (bug fix only)
- [ ] Add or identify a test/command that fails for the claimed reason before the fix.
- [ ] Preserve the failing evidence, then prove the same case passes after the fix.

### W1: <bounded outcome>
- Scope: <files>
- Excluded: <files>; recover from <path>
- [ ] <task with acceptance evidence>

## Verification matrix

| # | Surface/path | Scenario | Expected evidence | Depth |
|---|---|---|---|---|
| 1 | <surface> | <happy/edge/error case> | <assertion or command> | behavior+edge+error / happy / smoke |

**Coverage:** <covered paths>/<identified paths>. Gaps: <explicit list or none>.

**Exhaustiveness rationale:** The identified paths are the union of <dimensions>. <Property, parameterization, or reason that avoids combinatorial padding>.

## Review plan
- Routed agents: <package-qualified Pi Forge reviewers>
- Review artifact: <diff/source/test evidence each receives>
- Critical/Major evidence gate: <how parent will verify>

## Budget
- Fix rounds: <default 3 or justified value>
- Delegated launches: <number>
- Writer concurrency: <default 1>
- Final evidence: <commands after final edit>

## Risks and rollback
- Risk: <failure mode and mitigation>
- Rollback: <reversible action, without authorizing it>

## External side effects
- <commit, push, issue, PR, migration, deployment, publication, or none>
- Authorization status: <not authorized / explicitly authorized>

## Progress
- [x] Analysis and draft plan
- [ ] User approval
- [ ] Implementation
- [ ] Final verification and review

## Surprises and discoveries
<Update during execution with evidence.>

## Execution decisions
<Append-only rows for decisions made after approval.>

## Outcomes and retrospective
<Fill when closing or abandoning the plan.>
```
