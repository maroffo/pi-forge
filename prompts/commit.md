---
description: Create one safe local Conventional Commit from the current task changes
argument-hint: "[type(scope): subject]"
---

Load and follow the `source-control` skill before making any Git mutation.

Create exactly one local commit containing only the current task's coherent changes. On a non-primary branch, this workflow also carries standing authorization for the source-control skill's exact same-name branch push and one PR creation. It does not authorize amend, branch change, destructive cleanup, hook bypass, force-push, tag mutation, ref deletion, merge, or any broader remote operation. `dev`, `main`, and `master` still require explicit commit and push authorization.

If supplied, treat this as the requested commit subject and validate it before use:

```text
${ARGUMENTS:-No subject supplied; derive one from the staged intent.}
```

Inspect the worktree and the existing index, preserve unrelated changes, and run checks appropriate to the intended payload. Follow the skill's exact-hunk procedure for files containing mixed changes; never stage a whole mixed file. Review the complete staged diff, then execute the commit through `skills/source-control/scripts/commit-gate.sh` as directed by the skill. Never invoke `git commit` directly. Pass the gate's protected-branch override only when the user explicitly allowed that exact branch.

Afterward, report the commit hash and subject, verification evidence, and every remaining unstaged or untracked path. If the current branch is non-primary and delivery is ready, use only the standing-authorized narrow push and PR creation forms from the skill; otherwise stop after the local commit.
