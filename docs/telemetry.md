# Session Telemetry

Pi Forge telemetry is local, aggregate, and excluded from model context.

## Runtime snapshots

`extensions/telemetry.ts` derives counters from the active Pi session branch and stores changed snapshots as `pi-forge.telemetry.v2` custom entries at settled, compaction, model-change, and shutdown boundaries. Tree navigation forces a sanitized checkpoint on the selected branch, making that branch the last persisted leaf for offline extraction. Custom entries are durable session data but are not converted to LLM messages.

`/forge-telemetry` displays the current aggregate locally. It does not trigger a model call.

The snapshot contains:

- user-turn and assistant-message counts;
- bucketed built-in tool-call counts and errors;
- observed source mutations;
- recognized successful verification commands;
- subagent launches;
- compactions and model changes;
- aggregate token and cost totals.

## Schema-v2 single-session output

`skills/session-telemetry/scripts/extract-session-trace.mjs` reads one persisted Pi v2/v3 session JSONL file and follows only the current leaf's parent chain. Historical raw Pi session format versions remain input formats. Pi Forge's sanitized output schema is separately versioned as v2:

```json
{"v":2,"sequence":1,"kind":"user_turn","timestamp":"...","data":{}}
```

Supported kinds are `user_turn`, `assistant`, `tool_call`, `tool_result`, `score`, `compaction`, `branch_summary`, `model_change`, and `thinking_change`. Summary mode emits one schema-v2 `summary` record containing aggregate metrics.

Version 2 changes the version 1 mutation meaning. One pure result classifier now drives both counters and ordered events. A successful direct `edit` or `write` result for a source path is an observed mutation. A protected software-writer result is an observed mutation only when its result carries a real foreground `runId` or asynchronous `asyncId`, including a launched run that later reports an error. A failed or nominally successful writer result without launch identity is not treated as a mutation. A successful recognized Bash verification is classified by the same ordered result projection.

The extractor requires one valid raw v2/v3 header, canonical timestamps, unique IDs, prior parents, and one rooted tree. It rejects malformed entries, lines above 2 MiB, sessions above 250 MiB, ambiguous arguments, non-regular or symbolic-link input, implicit overwrite, symlink or multi-hardlink output, and input/output identity. Explicit output uses no-follow file descriptors and forces mode 0600, including overwritten regular files.

## Cohort schema

`skills/session-telemetry/scripts/aggregate-session-traces.mjs` accepts 5 to 100 repeated `--input` arguments. It performs no directory discovery or glob expansion. Inputs must be regular non-symlink raw Pi v2/v3 session files, each at most 250 MiB, with a 2 MiB line limit and a 1 GiB cumulative limit.

The aggregator rejects duplicate filesystem device/inode identity and duplicate raw header IDs. Header IDs exist only inside duplicate detection. They are never emitted, hashed, or used as stable identifiers.

Output schema version 1 records `traceSchemaVersion: 2` and only:

- aggregate totals for sanitized counters and tool buckets;
- medians for the same numeric projections;
- session counts and rates for errors, mutations, verifications, compactions, subagent use, score evidence, and score at or above its recorded threshold;
- `verificationAfterFinalMutation` eligible, passing, and rate values;
- fixed interpretation warnings.

The final-mutation numerator counts a session only if a successful recognized verification result occurs after its final observed direct or launched protected-writer mutation. Sessions without an observed mutation do not enter that denominator. Input trees are projected sequentially and discarded before the next session, so the 1 GiB input allowance does not become a retained cohort tree. The output contains no per-session row, extrema, timestamp, identifier, hash, or input path.

Cohort file output reuses the extractor's no-follow writer. It refuses implicit overwrite, enforces one hard link and mode 0600, and rejects identity with any input before truncation. `--force` requires a separately approved exact output path.

## Excluded data

Snapshots and extracted traces exclude prompt, response, thinking, and summary text; source and paths; commands and arguments; tool output and error strings; findings and subagent output; session paths and environment values; secrets; provider and model identifiers. Custom tool names are bucketed as `other`.

Cohort output also excludes session IDs or hashes, timestamps, per-session values, and extrema. Strict canonical timestamps in a single-session trace, known stop-reason values, and numeric usage remain because they support local sequencing, cost, and workflow analysis. Usage includes assistant, tool, compaction, and branch-summary billing on the active branch.

Telemetry remains local. Reading an artifact into a model context or sending it elsewhere requires separate authorization for the exact artifact and destination. The project-only harness-audit skill does not invoke another provider and requires this consent before reading a cohort artifact.

## Interpretation limits

Telemetry reflects observable Pi events, not all process behavior. A shell command may mutate files internally, a custom tool may hide several actions, and verification recognition is an allowlist. Missing events mean not observed. Aggregate differences do not prove task comparability or causality. A maintainer must assert cohort comparability, keep observations separate from hypotheses and gaps, and evaluate one proposed mutation through a distinct post-change cohort.
