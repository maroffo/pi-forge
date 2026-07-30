# Implementation Prompt Template

Fill every placeholder and remove non-applicable clauses.

```text
/orchestrator Implement <task title> from the approved ExecPlan at <plan path>.

Treat that file as the source of truth for verified analysis, locked decisions, scope, workstreams, verification, review routing, and budget. Re-read the cited source before editing and record evidence if current code contradicts the plan.

Execution constraints:
- Work only on <branch/current checkout>; do not switch branches or create a worktree unless explicitly requested.
- For a bug, complete W0 and record a failure for the claimed reason before writing the fix when practical.
- Keep one writer in this checkout. Delegate bounded implementation only to pi-forge.software-engineer through the protected subagent policy.
- After every workstream, update Progress, Surprises and discoveries, and append-only Execution decisions.
- After the final edit run: <commands>.
- Build a redacted review artifact and route: <review agents>. Verify every Critical/Major against source and executable evidence where practical, fix verified blockers, then rerun affected checks.
- Do not treat /score as review evidence. Completion requires green final checks, no unresolved Critical/Major, and acceptance evidence.
- Do not commit, push, open or modify a PR or issue, deploy, publish, or merge unless separately authorized for that exact side effect.
- Stop and present options when a checkpoint or the declared budget is reached.
```

The handoff is paste-ready, but it does not grant any permission absent from the approved plan or current user instruction.
