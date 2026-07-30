# PR Review Output

```markdown
# <APPROVE | FIX BEFORE MERGE | REJECT AND SPLIT>: <PR title>

**PR:** <URL, head -> base, immutable headRefOid and baseRefOid>
**Snapshot check:** <live OIDs unchanged at report time, restarted, or inconclusive>
**Scope:** <files, additions, deletions, commits>
**Execution:** <commands run and result, or not run with reason>
**Review coverage:** <returned/launched agents and domains>
**Prior approval record:** <verified path or not found>

## Blocking findings

### Critical
- `<file:line>` <claim>
  - Introduced/pre-existing: <commit or merge-base evidence>
  - Evidence: <reproduction, CWE/reachability, measurement, advisory, rule, or principle/cost>
  - Required fix: <root-cause outcome>
  - Reported by: <agents>

### Major
<same shape>

## Minor findings
<Concise list or none.>

## Commit narrative
<How the change evolved, attempted fixes, explicit deferrals, and whether they match behavior.>

## Disputed or unverified claims
<Claim, why evidence was insufficient, second-opinion status if offered, and resulting disposition.>

## Dependencies and operational risk
<Changed dependencies, migrations, rollout, compatibility, or not applicable.>

## Verification gaps
<Unchecked commands, unavailable services, missing reviewer results, omitted files, and why.>

## Recommendation
<Exact merge blockers or residual risks. APPROVE is allowed only with no Critical or Major finding and an unchanged snapshot; verification gaps remain explicit. State that no remote review was posted unless separately authorized.>
```

Do not include secrets, full exploit recipes, unnecessary private source, or raw reviewer transcripts. Quote only the evidence needed to make each decision auditable.
