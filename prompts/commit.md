---
description: Create one safe local Conventional Commit from the current task changes
argument-hint: "[type(scope): subject]"
---

Load and follow the `source-control` skill before making any Git mutation.

Create exactly one local commit containing only the current task's coherent changes. Invoking `/commit` authorizes this commit, but does not authorize a push, amend, branch change, destructive cleanup, or hook bypass.

If supplied, treat this as the requested commit subject and validate it before use:

```text
${ARGUMENTS:-No subject supplied; derive one from the staged intent.}
```

Inspect the worktree and the existing index, preserve unrelated changes, and run checks appropriate to the intended payload. Follow the skill's exact-hunk procedure for files containing mixed changes; never stage a whole mixed file. Review the complete staged diff, then execute the commit through `skills/source-control/scripts/commit-gate.sh` as directed by the skill. Never invoke `git commit` directly. Pass the gate's protected-branch override only when the user explicitly allowed that exact branch.

Afterward, report the commit hash and subject, verification evidence, and every remaining unstaged or untracked path. Never push automatically.
