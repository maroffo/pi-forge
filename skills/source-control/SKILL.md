---
name: source-control
description: Safe Git workflow and Conventional Commits. Use for creating commits, staging changes, branch strategy, rebasing, merge conflicts, and recovery. Do not load merely because an unrelated coding task may later need a commit.
allowed-tools: bash
---

# Source Control

Apply the repository's own working agreement first. This skill adds portable Git defaults and never overrides stricter project rules.

## Commit contract

A request to implement or change the repository carries standing authorization to prepare an isolated non-primary destination and deliver coherent work there. From an attached existing ref, it may atomically create and switch to one fresh non-primary branch at the current `HEAD` with exactly `git -c core.hooksPath= -c core.fsmonitor=false switch -c <new-branch>`; ordinary staged or unstaged task changes may remain because this same-commit switch preserves them. From a clean attached checkout, it may instead create one fresh non-primary worktree with exactly `git -c core.hooksPath= -c core.fsmonitor=false worktree add -b <new-branch> <absolute-nonexistent-path> HEAD`. The lifecycle gate requires a valid absent local branch, and for worktrees an absent canonical target outside the current project root, beneath its canonical parent or the OS temporary root, and outside common sensitive paths; target canonicalization and nonexistence are repeated after asynchronous Git checks immediately before the tool call is allowed. Existing-branch switches, other start points/options, relative or existing worktree targets, and worktree removal remain outside standing authorization.

After fresh verification, the request also authorizes coherent local commits on the resulting or already-current non-primary branch. `dev`, `main`, and `master` are primary branches and always require explicit commit authorization. Standing authorization never permits amend, discarding changes, bypassing hooks, committing unrelated work, or switching to an existing branch.

On a non-primary branch, it authorizes an ordinary same-name branch push and opening one pull request for that delivered change. Keep both operations narrow: push only `refs/heads/<current>:refs/heads/<current>` to the selected remote, without force, tags, deletion, atomic mode, extra refspecs, or push options, and neutralize inherited push expansion with the exact `-c` settings documented below; create the PR with explicit repository, base, exact current head, title, and inline body. A primary-branch commit or push, force-push, tag mutation, ref deletion, merge, existing-branch switch, PR update/close/merge, worktree removal, and every other local or remote mutation still require separate explicit authorization.

1. Inspect before mutating:

   ```bash
   git status --short
   git branch --show-current
   git diff
   git diff --cached
   git log -5 --oneline
   ```

2. Stop before committing on `dev`, `main`, or `master` unless the user explicitly authorized that exact branch.
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

   The gate refuses a detached head, `dev`, `main`, `master`, an empty index, hook bypasses such as `--no-verify`, amend, and arguments that implicitly stage content. When the user explicitly authorized committing on one of those primary branches, pass the exact branch as `--allow-branch <authorized-branch>` before `--`. Do not use that option based on inference. Merely printing the branch followed by `&& git commit` is not a gate, and invoking `git commit` directly does not satisfy this workflow.
8. Report the commit hash, subject, checks run, and remaining unstaged or untracked files. On an existing non-primary branch, proceed with the standing-authorized narrow push when it completes the requested delivery, using exactly:

   ```bash
   git -c push.followTags=false -c push.gpgSign=false -c push.pushOption= -c push.recurseSubmodules=no -c push.useForceIfIncludes=false push -u <remote> refs/heads/<current>:refs/heads/<current>
   ```

   Then create one PR only with explicit `--repo <owner/name>`, `--base`, `--head <current>`, `--title`, and a nonempty inline `--body` of at most 10,000 characters. Do not use `--body-file` on the standing-authorized path. The worktree and index must be clean immediately before either remote mutation. Otherwise state why delivery was not applicable. Do not infer authorization for any broader Git or GitHub mutation.

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

## Branches, worktrees, and history

Prefer names such as `feat/session-export`, `fix/cache-race`, and `chore/update-deps`. Follow repository conventions when they differ. Create the branch or worktree before implementation when practical. The only standing-authorized preparation forms are:

```bash
git -c core.hooksPath= -c core.fsmonitor=false switch -c <fresh-non-primary-branch>
git -c core.hooksPath= -c core.fsmonitor=false worktree add -b <fresh-non-primary-branch> <absolute-nonexistent-path> HEAD
```

Inspect the exact command and state first. Do not translate these into `checkout`, `branch`, `--create`, `-B`, `-C`, a composed shell command, a different start point, or an existing branch/path. Both forms neutralize checkout hooks and filesystem-monitor commands. The worktree form requires a clean current checkout; it still materializes tracked files and may invoke configured checkout filters, so it is standing-authorized only for the trusted-project workflow described here. The branch form may preserve task-owned staged and unstaged changes because it remains at the exact same `HEAD`. Branch deletion, worktree removal/prune/move/lock/unlock, switching existing branches, and cleanup remain separate decisions.

Rebase only with authorization when it rewrites shared history. Use `--force-with-lease`, never bare `--force`, and only when the user explicitly approved the force-push. Resolve conflicts by understanding both sides, then rerun affected checks.

Before destructive or difficult-to-recover commands such as `reset --hard`, `clean`, branch deletion, reflog recovery, or broad restore, confirm the exact target and explain the recovery path.
