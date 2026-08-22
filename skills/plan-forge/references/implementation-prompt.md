# Implementation Prompt Template

Fill every placeholder and remove non-applicable clauses.

```text
/orchestrator Implement <task title> from the approved ExecPlan at <plan path>.

Treat that file as the source of truth for verified analysis, locked decisions, scope, workstreams, verification, review routing, and budget. Re-read the cited source before editing and record evidence if current code contradicts the plan.

Execution constraints:
- Work on <branch/current checkout>. If a fresh non-primary destination is still needed, use only the source-control skill's standing-authorized exact `git -c core.hooksPath= -c core.fsmonitor=false switch -c <branch>` form or, from a clean checkout, exact `git -c core.hooksPath= -c core.fsmonitor=false worktree add -b <branch> <absolute-new-path> HEAD` form. Never switch to an existing branch or use another branch/worktree mutation without separate authorization.
- For a bug, complete W0 and record a failure for the claimed reason before writing the fix when practical.
- Keep one writer in this checkout. Delegate bounded implementation only to pi-forge.software-engineer through the protected subagent policy.
- After every workstream, update Progress, Surprises and discoveries, and append-only Execution decisions.
- After the final edit run: <commands>.
- Build a redacted review artifact and route: <review agents>. Verify every Critical/Major against source and executable evidence where practical, fix verified blockers, then rerun affected checks.
- Do not treat /score as review evidence. Completion requires green final checks, no unresolved Critical/Major, and acceptance evidence.
- On a branch other than dev, main, or master, the completed coherent change may be committed through the source-control gate, pushed only to its exact same-name remote branch, and opened as one PR under standing delivery authorization. Do not commit or push a primary branch, switch an existing branch, perform another branch/worktree mutation, force-push, mutate tags, delete refs, modify/close/merge a PR, modify an issue, deploy, publish, or merge unless separately authorized for that exact side effect.
- Stop and present options when a checkpoint or the declared budget is reached.
```

The handoff is paste-ready, but it does not grant any permission absent from the approved plan or current user instruction.
