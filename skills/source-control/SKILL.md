---
name: source-control
description: Safe Git workflow and Conventional Commits. Use for creating commits, staging changes, branch strategy, rebasing, merge conflicts, and recovery. Do not load merely because an unrelated coding task may later need a commit.
allowed-tools: bash
---

# Source Control

Apply the repository's own working agreement first. This skill adds portable Git defaults and never overrides stricter project rules.

## Commit contract

Treat an explicit request to commit, including `/commit`, as authorization for one local commit only. It does not authorize pushing, amending an existing commit, changing branches, discarding changes, or bypassing hooks.

1. Inspect before mutating:

   ```bash
   git status --short
   git branch --show-current
   git diff
   git diff --cached
   git log -5 --oneline
   ```

2. Stop before committing on `main` or `master` unless the user explicitly authorized that branch.
3. Separate task-owned changes from unrelated or pre-existing work. Treat an existing index as protected: if any staged content is not clearly part of the requested commit, stop rather than unstage it or include it. Never discard or rewrite unrelated work to obtain a clean tree.
4. Run the repository checks relevant to the intended commit. A stale result from before the final edit is not evidence.
5. Stage safely:
   - use `git add <path>...` only when every changed hunk in each path belongs to the commit;
   - for a file containing mixed task and unrelated hunks, stage exact hunks with `git add -p` only in a usable interactive terminal, or create and inspect a temporary patch outside the repository, verify it with `git apply --cached --check`, then apply it with `git apply --cached`;
   - if the hunks cannot be separated confidently, stop and ask rather than staging the whole path;
   - never use `git add -A`, `git add .`, or another broad staging shortcut.
6. Review the complete index, including anything staged before this workflow, with `git diff --cached --stat` and `git diff --cached`. Commit only when every staged hunk belongs to the requested logical change.
7. Execute the commit through this skill's enforcing gate, resolving the path relative to this `SKILL.md`:

   ```bash
   bash <skill-directory>/scripts/commit-gate.sh -- -m "<type>(<scope>): <subject>"
   ```

   The gate refuses a detached head, `main`, `master`, an empty index, hook bypasses such as `--no-verify`, amend, and arguments that implicitly stage content. When the user explicitly authorized committing on `main` or `master`, pass the exact branch as `--allow-branch <authorized-branch>` before `--`. Do not use that option based on inference. Merely printing the branch followed by `&& git commit` is not a gate, and invoking `git commit` directly does not satisfy this workflow.
8. Report the commit hash, subject, checks run, and remaining unstaged or untracked files. Do not push unless separately authorized.

If the staged set is empty, do not create an empty commit unless the user explicitly requested one.

## Conventional Commits

Format:

```text
<type>(<optional-scope>): <imperative subject>
```

Use a lowercase type and an imperative subject without a trailing period. Keep the subject concise, preferably no more than 50 characters.

| Type | Purpose |
|---|---|
| `feat` | User-visible capability |
| `fix` | Defect correction |
| `docs` | Documentation only |
| `refactor` | Structural change without intended behavior change |
| `perf` | Performance improvement |
| `test` | Test-only change |
| `build` | Build system or dependency packaging |
| `ci` | Continuous integration |
| `chore` | Maintenance not covered above |
| `revert` | Revert an earlier commit |

Examples:

```text
feat(auth): validate access tokens
fix: preserve empty configuration
ci: test dependency upgrades
```

Add a body when the reason, migration impact, or non-obvious tradeoff matters. Use `BREAKING CHANGE:` in the footer only for an intentional incompatible change.

## Branches and history

Prefer names such as `feat/session-export`, `fix/cache-race`, and `chore/update-deps`. Follow repository conventions when they differ.

Rebase only with authorization when it rewrites shared history. Use `--force-with-lease`, never bare `--force`, and only when the user explicitly approved the force-push. Resolve conflicts by understanding both sides, then rerun affected checks.

Before destructive or difficult-to-recover commands such as `reset --hard`, `clean`, branch deletion, reflog recovery, or broad restore, confirm the exact target and explain the recovery path.
