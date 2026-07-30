# Pi Forge

Opinionated, multi-provider coding harness for the pi agent.

Pi Forge is a Pi-native sibling of Claude Forge. It targets functional parity, not file parity: context, skills, agents, workflows, enforcement, and telemetry use Pi's own extension and subagent APIs.

## Status

Implemented vertical slices:

- `/second-opinion`, four isolated critics plus evidence-based synthesis;
- `source-control`, with `/commit` as a thin Pi prompt alias;
- `refine-requirements`, conversational scope and decision refinement;
- `pi-forge.software-engineer`, a scoped implementation writer using a private contract;
- `pi-forge.tech-writer`, an artifact-only technical content drafter;
- seven package-qualified reviewers sharing one evidence and severity contract;
- `/orchestrator`, a bounded parent-owned delivery and review loop;
- `/plan-forge`, evidence-backed ExecPlans and fresh-session handoffs;
- `/pr-review`, read-only commit-aware PR review with candidate-execution consent;
- lifecycle guards for Git mutations, sensitive paths, and post-edit verification;
- local sanitized session telemetry plus an offline active-branch extractor;
- `/score`, deterministic commit, PR, and excellence readiness from repository gates.

The second-opinion workflow:

1. select an explicit target, or use the latest assistant response;
2. confirm disclosure to four providers;
3. launch four independent critics with fresh context and no filesystem, shell, or network tools;
4. synthesize the letter-labelled reports while minimizing model-identity bias.

The fixed critic models are:

- `openai-codex/gpt-5.6-sol`
- `anthropic/claude-fable-5`
- `google/gemini-3.6-flash`
- `deepseek/deepseek-v4-pro`

Synthesis currently uses `openai-codex/gpt-5.6-sol`, for five model calls in total.

## Requirements

- pi coding agent
- GNU Make for `/score`
- GitHub CLI for issue-backed `/plan-forge` and `/pr-review`
- [`pi-subagents`](https://github.com/nicobailon/pi-subagents) extension, version 0.37.2
- authentication configured in Pi for all four providers

## Local development install

```bash
pi install npm:pi-subagents@0.37.2
pi install /absolute/path/to/pi-forge
```

Run `/reload` after editing package resources.

## Usage

Review an explicit artifact:

```text
/second-opinion Evaluate whether this API design preserves backward compatibility: ...
```

Review the latest assistant response:

```text
/second-opinion
```

Create one local commit from the current task changes:

```text
/commit
/commit fix(config): preserve empty values
```

Create a plan, execute an approved plan, or review a pull request:

```text
/plan-forge 123
/orchestrator quality_reports/plans/active/2026-07-30_example.md
/pr-review 456 --no-exec
```

Run deterministic local quality gates for a target threshold:

```text
/score
/score pr
/score excellence
```

Load engineering skills explicitly when needed:

```text
/skill:source-control
/skill:refine-requirements
/skill:orchestrator
/skill:plan-forge
/skill:pr-review
/skill:session-telemetry
```

`/commit` authorizes one local commit, not a push, amend, branch change, destructive cleanup, or hook bypass. The source-control skill treats an existing index as protected, separates mixed-file changes by exact hunk, and places `git commit` behind an aborting branch conditional.

`/orchestrator` coordinates one scoped writer, fresh artifact-only reviewers, final verification, bounded fix rounds, and presentation. `/plan-forge` writes a self-contained draft plan but does not implement or commit it. `/pr-review` pins immutable base and head OIDs in a mode-0700 throwaway clone and never posts, approves, or merges. Builds, tests, package scripts, Make targets, and other candidate-controlled code are skipped unless `PI_FORGE_ALLOW_CANDIDATE_CODE=1` is explicitly present or execution occurs in appropriately restricted ephemeral CI. Local candidate commands run with a stripped environment plus temporary HOME and XDG directories, without inherited credentials or agent sockets. That opt-in still grants execution with current-user filesystem and network permissions; it is not a sandbox.

`/forge-telemetry` shows aggregate session counters from custom entries that never enter model context. The `session-telemetry` skill can extract a sanitized active-branch JSONL trace or summary from `$PI_SESSION_FILE`. It excludes prompt and response text, thinking, source, paths, commands, output, findings, secrets, session paths, and provider/model identifiers. Nothing is transmitted automatically.

The lifecycle extension blocks direct Bash-tool commits, requires interactive confirmation for push, destructive Git and sensitive-path operations, and schedules one bounded verification follow-up after observed source changes without a later successful recognized check. It is a workflow guard, not a shell parser or OS sandbox; obfuscated commands, aliases, custom processes, and internal filesystem operations remain outside complete observation. See `docs/lifecycle.md` and `docs/telemetry.md`.

The second-opinion command validates the generated chain digest, verifies the exact pi-subagents runtime version, preflights the effective agent definitions, pings pi-subagents, then displays the exact providers and payload size before any model is called. Shadowed agents, fallback models, context inheritance, added tools, skills, or ambient extensions are rejected. The preflight repeats immediately before spawn. The command also discloses that OpenAI receives the original target a second time together with all four reports for synthesis.

The workflow does not share the parent conversation, project instructions, discovered skills, ambient extensions, or filesystem, shell, and network tools with its children. Pi-subagents still enables its internal `structured_output` tool to enforce result schemas.

## Development

```bash
make check
make test-e2e
```

Test the newest pi-subagents release without changing the working tree:

```bash
make test-upgrade
```

Test the currently pinned release through the full harness:

```bash
npm run test:pi-subagents-upgrade -- 0.37.2 --force
```

A new candidate's extension executes with the current user's process permissions. Prefer the ephemeral GitHub Actions runner. Local execution therefore requires explicit acknowledgement:

```bash
PI_FORGE_ALLOW_CANDIDATE_CODE=1 npm run test:pi-subagents-upgrade -- 0.38.0
```

The upgrade gate creates a temporary repository copy, synchronizes the candidate version there, installs with lifecycle scripts disabled, runs package and unit tests, explicitly loads the candidate RPC extension under an isolated Pi configuration, and checks the publish tarball. The probe declines consent before Pi Forge sends a spawn request. The child process receives a minimal environment with a temporary `HOME` and no inherited provider variables. Candidate code can still perform arbitrary filesystem or network operations, which this gate does not instrument or prevent. The temporary copy is deleted afterward. This is configuration isolation, not an OS sandbox.

`.github/workflows/ci.yml` validates every pull request and push to `main`, including discovery from the packed npm artifact. `.github/workflows/pi-subagents-upgrade.yml` additionally runs the dependency gate for relevant changes, every Monday, and manual version or npm-tag requests. Scheduled runs test `latest`; they upload the complete compatibility log without changing the repository.

`/score` requires a trusted project and literal, top-level `check` and `test-e2e` targets in the root Makefile. Conditional, generated, escaped, or continued target definitions are inconclusive rather than interpreted. It runs `make check` followed by `make test-e2e` with fail-fast, shell-free execution, strips inherited Make control variables, preserves process signals, and never invokes a model. A definite gate failure scores 0; missing gates, process errors, signals, and timeouts are inconclusive rather than fabricated scores. Passing gates establish a static 100 baseline, explicitly without review deductions. Numeric runs are recorded under local Git metadata and do not dirty the worktree. Failure excerpts are shown through the current UI but excluded from persisted Pi score entries and model context. Repository gates execute project code with the current user's permissions; this is not a sandbox.

The review fleet is available as:

```text
pi-forge.architecture-reviewer
pi-forge.database-reviewer
pi-forge.dependency-reviewer
pi-forge.dx-reviewer
pi-forge.performance-reviewer
pi-forge.security-reviewer
pi-forge.test-reviewer
```

The agents use fresh context and a generated replacement system prompt containing the canonical review contract. They do not inherit conversation history, project instructions, fallback models, skills, tools, extensions, or MCP. Reviewers inspect only the artifact embedded in the task; the parent must collect the diff, relevant files, requirements, and verification evidence before launch.

Every supported reviewer launch must set an explicit model on each reviewer, `artifacts: false`, `acceptance: false`, and `agentContract: { version: 1 }`. Scheduled launches, appended chain steps, protected-run resume, clarification UI, session sharing or destinations, injected reads, acceptance commands, other agent contracts, output persistence, output schemas, thinking overrides, and skill overrides are rejected. Model choice remains local and provider-neutral, but cannot come from repository-controlled defaults.

The packaged implementation writer is available as `pi-forge.software-engineer`. It inherits project instructions and resolves `pi-forge-implementation-contract` through an agent-private package path, so an identically named project skill cannot replace the contract. Every launch must be one direct call with explicit `async: false` and an approved provider/model. `forceTopLevelAsync` and repository model overrides fail closed, so forked context or source cannot be silently detached or routed to another provider. The writer has no supervisor or nested-subagent tool and stays within assigned paths and never commits or pushes unless its task explicitly authorizes that action.

`pi-forge.tech-writer` creates Markdown drafts for posts, tutorials, changelogs, release notes, and project updates from an artifact embedded in its task. It has fresh context and no tools, project instructions, runtime skills, fallback models, extensions, or MCP. The parent must supply the intended audience, format, evidence, and any voice samples. The agent does not inspect the repository, write files, publish content, or invent missing facts. Launches require the same explicit model, disabled artifacts, disabled acceptance, and v1 agent contract as reviewers.

Pi-subagents intentionally allows user or project definitions and invocation-time skill overrides. Pi Forge's parent `agent-policy` extension therefore fails closed before `subagent` tool launches of protected package agents: it rejects qualified-name shadowing, changed context, added skills, tools, extensions, MCP, fallback candidates, or output schemas. Raw pi-subagents RPC calls bypass parent tool hooks and are not a supported launch path for these agents.

The policy records session-local run attestations in Pi custom entries, including failed runs with a canonical result id. Resume is allowed only when every recorded child is generic. Foreground runs may resume during the same extension runtime; after policy reload they fail closed because pi-subagents may reinterpret the eight-character id as a prefix. Async runs may resume after reload only while their exact canonical directory still exists. Protected, mixed, unknown, directory-addressed, prefix-addressed, chain-attaching, and stale foreground resumes fail closed. To continue a protected agent, launch it again through the normal preflight and embed the prior result plus the new follow-up in the task. The proposed atomic upstream contract is documented in `docs/pi-subagents-resume-contract.md`.

`AGENTS.md.example` is an installable global context template. The repository deliberately does not ship an `AGENTS.md`, because Pi would load it while developing Pi Forge.

## License

MIT
