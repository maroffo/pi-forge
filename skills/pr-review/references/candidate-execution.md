# Candidate Execution Environment

Use this only after `PI_FORGE_ALLOW_CANDIDATE_CODE=1` is confirmed and `--no-exec` is absent, or inside a known credential-free ephemeral runner prepared for untrusted PRs. `CI=true` alone is not evidence of isolation.

## Before execution

1. Name every candidate-controlled command that will run.
2. Explain that it executes with current-user filesystem and network permissions.
3. Create mode-0700 directories inside the recorded review temp root for `HOME`, `TMPDIR`, `XDG_CONFIG_HOME`, `XDG_CACHE_HOME`, and `XDG_DATA_HOME`.
4. Do not copy user configuration, package-manager credentials, netrc files, cloud settings, SSH material, or Git credentials into them.
5. Check out the recorded exact head OID with hooks disabled only after this environment is ready.

## Environment

Launch checkout, dependency, build, test, lint, generator, and project commands with `env -i`. Pass only:

- temporary `HOME`, `TMPDIR`, and XDG paths;
- a reviewed absolute-only `PATH` required to locate local tools, with empty, relative, and current-directory entries removed;
- non-secret locale and terminal values such as `LANG`, `LC_ALL`, `TERM`, and `NO_COLOR` when needed;
- `CI=1`;
- `GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL=/dev/null`, `GIT_TERMINAL_PROMPT=0`, and non-interactive empty credential behavior;
- task-specific non-secret values explicitly disclosed before execution.

Do not pass provider keys, `GITHUB_TOKEN`, cloud variables, package registry tokens, credential-helper settings, `SSH_AUTH_SOCK`, signing agents, database URLs, service credentials, or the parent's complete environment. A command that requires one is not eligible for local PR execution.

Use Git with `core.hooksPath` pointed at an empty directory for checkout and subsequent Git operations. The no-checkout clone was fetched before candidate execution, so review commands do not need network credentials.

## Residual boundary

This is environment minimization, not sandboxing. Candidate code still has the current user's operating-system identity. It can inspect user-readable filesystem paths outside the temporary HOME and can use unrestricted network access unless the operating environment prevents it. It may also consume CPU, memory, disk, and process limits.

When those capabilities are unacceptable, do not execute locally. Use a disposable runner with no credentials, a read-only or disposable filesystem, bounded resources, and an explicit network policy, or report runtime verification as not run.
