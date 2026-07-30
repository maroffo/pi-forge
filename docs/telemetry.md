# Session Telemetry

Pi Forge telemetry is local, aggregate, and excluded from model context.

## Runtime snapshots

`extensions/telemetry.ts` derives counters from the active Pi session branch and stores changed snapshots as `pi-forge.telemetry.v1` custom entries at settled, compaction, model-change, and shutdown boundaries. Tree navigation forces a sanitized checkpoint on the selected branch, making that branch the last persisted leaf for offline extraction. Custom entries are durable session data but are not converted to LLM messages.

`/forge-telemetry` displays the current aggregate locally. It does not trigger a model call.

The snapshot contains:

- user-turn and assistant-message counts;
- bucketed built-in tool-call counts and errors;
- observed source mutations;
- recognized successful verification commands;
- subagent launches;
- compactions and model changes;
- aggregate token and cost totals.

## Offline schema

`skills/session-telemetry/scripts/extract-session-trace.mjs` reads one persisted Pi v2/v3 session JSONL file and follows only the current leaf's parent chain. Output schema version 1 uses:

```json
{"v":1,"sequence":1,"kind":"user_turn","timestamp":"...","data":{}}
```

Supported kinds are `user_turn`, `assistant`, `tool_call`, `tool_result`, `score`, `compaction`, `branch_summary`, `model_change`, and `thinking_change`. The summary mode emits one `summary` record containing aggregate metrics.

The extractor requires one valid v2/v3 header, canonical timestamps, unique IDs, prior parents, and one rooted tree. It rejects malformed entries, lines above 2MB, sessions above 250MB, ambiguous arguments, implicit overwrite, symlink or multi-hardlink outputs, and input/output identity. Explicit output uses no-follow file descriptors and forces mode 0600, including overwritten regular files.

## Excluded data

Snapshots and extracted traces exclude prompt, response, thinking and summary text; source and paths; commands and arguments; tool output and error strings; findings and subagent output; session paths and environment values; secrets; provider and model identifiers. Custom tool names are bucketed as `other`.

Strict canonical timestamps, known stop-reason values, and numeric usage remain because they support latency, cost, and workflow analysis. Usage includes assistant, tool, compaction, and branch-summary billing on the active branch. A user must separately authorize sending a telemetry artifact anywhere.

## Interpretation limits

Telemetry reflects observable Pi events, not all process behavior. A shell command may mutate files internally, a custom tool may hide several actions, and verification recognition is an allowlist. Missing events mean not observed. They do not prove absence, quality, security, or task completion.
