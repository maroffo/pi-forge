---
name: session-telemetry
description: Inspect or extract sanitized local telemetry from a Pi session without sending prompts, source, paths, commands, outputs, or findings to a model or provider. Use for session metrics, trace extraction, cohort aggregation, token/cost summaries, or harness analysis.
compatibility: Requires Node.js and persisted Pi session files.
---

# Session Telemetry

Pi Forge records aggregate snapshots as `pi-forge.telemetry.v2` custom session entries. Custom entries do not participate in model context. The snapshots contain counters and usage totals only.

Use the bundled scripts for deterministic offline analysis. Resolve paths relative to this skill directory.

## Single-session summary

```bash
node scripts/extract-session-trace.mjs "$PI_SESSION_FILE" --summary
```

The summary reports user turns, assistant messages, bucketed tool calls, errors, source mutations observed through successful direct write/edit results or genuinely launched protected writers, recognized successful verification commands, subagent launches, compactions, model changes, token totals, and cost. Token and cost totals include active-branch assistant, tool, compaction, and branch-summary usage.

## Schema-v2 event trace

```bash
node scripts/extract-session-trace.mjs "$PI_SESSION_FILE"
```

Each JSONL record uses schema version 2 and contains only an event kind, sequence, optional timestamp, and sanitized fields. It follows the active session branch and excludes abandoned branches. Version 2 aligns summary and event mutation semantics through one classifier. Unlike version 1, a protected writer result is a mutation only when its result contains a real foreground or asynchronous launch identity. A failed call without launch identity is not a mutation.

Write an artifact only when the user requests it:

```bash
node scripts/extract-session-trace.mjs "$PI_SESSION_FILE" --output ./session-trace.jsonl
```

The extractor refuses to overwrite by default. `--force` is valid only with an exact user-approved output path. It rejects non-regular or symbolic-link input, symlink or multi-hardlink output, and input/output identity. It uses no-follow file descriptors, forces mode 0600 even for an existing regular output, and never creates parent directories.

## Cohort aggregate

Supply every raw Pi session file explicitly. The script does not discover directories or expand globs:

```bash
node scripts/aggregate-session-traces.mjs \
  --input ./session-01.jsonl \
  --input ./session-02.jsonl \
  --input ./session-03.jsonl \
  --input ./session-04.jsonl \
  --input ./session-05.jsonl \
  --output ./cohort-summary.json
```

A cohort requires 5 to 100 regular non-symlink Pi v2/v3 session files. Each file is limited to 250 MiB, each line to 2 MiB, and cumulative input to 1 GiB. Duplicate device/inode identities and duplicate raw session header IDs are rejected internally. Header IDs are used only for duplicate detection and are never emitted or hashed.

The cohort schema contains only schema fields, aggregate totals, medians, session counts and rates, and fixed observation-limit warnings. Counts and rates include sessions with compaction, subagent use, score evidence, score at or above its recorded threshold, and successful verification after the final mutation. `verificationAfterFinalMutation` includes only sessions with an observed direct or protected-writer mutation. Its numerator requires a later successful recognized verification after the final observed mutation. Sessions without an observed mutation are excluded from that metric's denominator. Inputs are projected one at a time, so the aggregator does not retain every session tree in memory.

Cohort output has the same no-follow, no-overwrite-by-default, mode-0600, single-link, and input/output identity protections across every input. `--force` still requires one exact approved output path.

## Privacy boundary

Single-session and cohort schemas exclude:

- prompt, assistant, thinking, summary, and issue text;
- source excerpts and file paths;
- shell commands and tool arguments;
- tool output and error strings;
- reviewer findings and subagent output;
- session paths, IDs, hashes, environment values, credentials, and secrets;
- provider and model identifiers.

Cohort output additionally excludes per-session rows, extrema, and timestamps. Telemetry stays local unless the user explicitly authorizes an exact artifact and destination. Do not paste a trace or cohort artifact into a model turn when local inspection answers the question.

## Interpretation limits

A counter is evidence only for the event surface Pi observed. Shell commands can mutate files without using write/edit, custom tools are bucketed as `other`, and recognized verification commands are a conservative allowlist. Cohort task comparability is an operator assertion, not something content-free telemetry can infer. A missing event means not observed, not proof that the action did not happen. Telemetry is measurement, not causality, a security boundary, or a quality score.
