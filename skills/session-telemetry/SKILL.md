---
name: session-telemetry
description: Inspect or extract sanitized local telemetry from a Pi session without sending prompts, source, paths, commands, outputs, or findings to a model or provider. Use for session metrics, trace extraction, token/cost summaries, or harness analysis.
compatibility: Requires Node.js and a persisted Pi session file.
---

# Session Telemetry

Pi Forge records aggregate snapshots as `pi-forge.telemetry.v1` custom session entries. Custom entries do not participate in model context. The snapshots contain counters and usage totals only.

Use the bundled extractor for deterministic offline analysis. Resolve paths relative to this skill directory.

## Summary

```bash
node scripts/extract-session-trace.mjs "$PI_SESSION_FILE" --summary
```

The summary reports user turns, assistant messages, bucketed tool calls, errors, source mutations observed through write/edit or the protected writer, recognized successful verification commands, subagent launches, compactions, model changes, token totals, and cost. Token and cost totals include active-branch assistant, tool, compaction, and branch-summary usage.

## Event trace

```bash
node scripts/extract-session-trace.mjs "$PI_SESSION_FILE"
```

Each JSONL record uses schema version 1 and contains only an event kind, sequence, optional timestamp, and sanitized fields. It follows the active session branch and excludes abandoned branches.

Write an artifact only when the user requests it:

```bash
node scripts/extract-session-trace.mjs "$PI_SESSION_FILE" --output ./session-trace.jsonl
```

The extractor refuses to overwrite by default. `--force` is valid only with an exact user-approved output path. It rejects symlink or multi-hardlink output and input/output identity, uses a no-follow file descriptor, forces mode 0600 even for an existing regular file, and never creates parent directories.

## Privacy boundary

The default schema excludes:

- prompt, assistant, thinking, summary, and issue text;
- source excerpts and file paths;
- shell commands and tool arguments;
- tool output and errors;
- reviewer findings and subagent output;
- session paths, environment values, credentials, and secrets;
- provider and model identifiers.

Telemetry stays local unless the user explicitly authorizes an exact artifact and destination. Do not paste a full trace into a model turn when the aggregate summary answers the question.

## Interpretation limits

A counter is evidence only for the event surface Pi observed. Shell commands can mutate files without using write/edit, custom tools are bucketed as `other`, and recognized verification commands are a conservative allowlist. A missing event means not observed, not proof that the action did not happen. Telemetry is measurement, not a security boundary or a quality score.
