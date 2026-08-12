# PR Review Output

```markdown
# <APPROVE | FIX BEFORE MERGE | REJECT AND SPLIT>: <PR title>

**PR:** <URL, head -> base, immutable headRefOid and baseRefOid>
**Snapshot check:** <live OIDs unchanged at report time, restarted, or inconclusive>
**Scope:** <files, additions, deletions, commits>
**Execution:** <commands run and result, or not run with reason>
**Review coverage:** <returned/launched agents and domains>
**Prior approval record:** <verified path or not found>
**Remote event:** COMMENT for this immutable snapshot; the heading is a textual recommendation, not a GitHub approval

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
<Use the same verified evidence and required-fix shape as blocking findings, or state none.>

## Commit narrative
<How the change evolved, attempted fixes, explicit deferrals, and whether they match behavior.>

## Disputed or unverified claims
<Claim, why evidence was insufficient, second-opinion status if offered, and resulting disposition.>

## Dependencies and operational risk
<Changed dependencies, migrations, rollout, compatibility, or not applicable.>

## Verification gaps
<Unchecked commands, unavailable services, missing reviewer results, omitted files, and why.>

## Recommendation
<Exact merge blockers or residual risks. APPROVE is allowed only with no Critical or Major finding and an unchanged snapshot; verification gaps remain explicit. This is the complete sanitized report payload and must not claim a publication receipt before submission.>
```

Do not include secrets, full exploit recipes, unnecessary private source, private temp paths, or raw reviewer transcripts. Quote only the evidence needed to make each decision auditable.

After the helper settles, append a local-only `## Publication receipt` with its status, attempt count, reviewed OIDs, and review ID or URL when available. For `already-posted`, state that the newly rendered report was not posted and whether it exactly matches the existing review body. If posting failed or remained ambiguous, use `## Publication failure`, mark `/pr-review` incomplete, and include the fixed error code plus `remote state: confirmed-absent | unknown`. Never imply remote success or advise retry while remote state is unknown.
