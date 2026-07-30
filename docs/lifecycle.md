# Lifecycle Enforcement

Pi Forge's lifecycle extension observes normal parent-session Pi tool events.

## Enforced boundaries

- Direct `git commit` through the Bash tool is blocked. Authorized commits must use the source-control skill and `commit-gate.sh`.
- Git push, destructive Git state changes, recursive deletion, privilege escalation, and broad permission changes require one interactive confirmation for the exact tool call. Headless execution fails closed.
- Write and edit calls targeting common environment files, credential stores, Git hooks/configuration, and credential-bearing user configuration require one interactive confirmation. Existing paths and their nearest existing parent are canonicalized through symlinks first.
- The protected implementation writer is accepted only as one direct launch with explicit `async: false`. `forceTopLevelAsync` blocks the launch, and repository async defaults cannot replace the explicit value. The writer has no supervisor or subagent tool, so it must finish or return a clarification request before the parent verifies.
- A successful observed source or build-input write/edit, or an actually launched protected writer, invalidates earlier verification. If no recognized successful check follows, `agent_end` queues one bounded follow-up asking for fresh verification or an explicit unchecked-risk statement.

Lifecycle state is persisted as `pi-forge.lifecycle.v1` custom entries. Those entries contain only monotonic counters and do not participate in model context. The verification follow-up is a visible custom message and does enter context because it must trigger the corrective turn.

## Evidence rules

Verification recognition is deliberately conservative. It accepts common test, lint, type, build, and validation commands, including safe `&&` chains. It rejects pipelines, semicolon chains, `||`, newlines, commands that merely quote tool names, failed results, and checks that ran before the last observed source mutation.

A custom project check may not be recognized. The follow-up fires once per mutation sequence; the agent can then run a recognized equivalent or state why the custom evidence applies and what remains unchecked.

## Limits

This extension is a workflow control, not a shell sandbox or complete command parser. Obfuscated shell, aliases, custom tools, direct filesystem APIs inside a process, and project code can bypass tool-name and command-shape observation. Bash commands can mutate source without a write/edit event. Git aliases can hide subcommands. Interactive confirmation establishes intent for one visible call, not containment.

Package identity and capability enforcement for protected subagents remains in `extensions/agent-policy.ts`. OS-level isolation remains necessary for hostile execution.
