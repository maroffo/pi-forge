# Pi Forge

Opinionated, multi-provider coding harness for the pi agent.

Pi Forge is a Pi-native sibling of Claude Forge. It targets functional parity, not file parity: context, skills, agents, workflows, enforcement, and telemetry use Pi's own extension and subagent APIs.

## Status

Implemented vertical slices:

- `/socratic-analysis`, parent-owned claim examination backed by a protected artifact-only analyst;
- `/auto-panel`, default-off one-shot session consent for automatic sanitized Socratic escalation;
- `/second-opinion`, parent-prepared briefs plus four isolated evidence-bound adversarial examiners and synthesis;
- `/expert-panel`, immediate guarded preflight and consent before adversarial fan-out for an already self-contained artifact;
- `source-control`, with `/commit` as a thin Pi prompt alias;
- `refine-requirements`, conversational scope and decision refinement;
- `pi-forge.software-engineer`, a scoped implementation writer using a private contract;
- `pi-forge.tech-writer`, an artifact-only technical content drafter;
- seven package-qualified reviewers sharing one evidence and severity contract;
- `/orchestrator`, a bounded parent-owned delivery and review loop;
- `/herdr-orchestrator`, an explicit visible overlay for trusted generic helpers, one bounded writer, and ordinary process supervision;
- `/plan-forge`, evidence-backed ExecPlans and fresh-session handoffs;
- `/pr-review`, read-only commit-aware PR review with candidate-execution consent;
- lifecycle guards for Git mutations, sensitive paths, and post-edit verification;
- local sanitized schema-v2 session telemetry, active-branch extraction, and explicit-input cohort aggregation;
- `/score`, deterministic commit, PR, and excellence readiness from repository gates;
- `/project-checks`, read-only metadata inspection and truthful Make-gate onboarding for `/score`.

The Socratic workflow keeps conversation state in the parent, asks one material question at a time, and sends only a self-contained artifact to `pi-forge.socratic-analyst`. The protected child separates facts, inferences, assumptions, alternatives, falsifiers, and a reconstructed conclusion. By default, a recommendation still requires a separate explicit yes before preparing any multi-provider payload.

`/auto-panel enable` can replace that per-run approval with one bounded standing grant. After interactive disclosure, one later complete Socratic recommendation mints a one-attempt receipt and may launch one payload classified as sanitized without an editor or per-run confirmation. The receipt is consumed by the first automatic tool attempt; the grant is memory-only, resets on a new session or `/reload`, is consumed before launcher work, and cannot retry or recurse. A local deny scanner blocks obvious secret, email, and private-path shapes, but neither the scanner nor the model's classification proves that data is safe.

The second-opinion workflow:

1. use the current parent model to resolve the decision and strongest supportable subject under review;
2. gather only relevant evidence and separate verified facts from assumptions and gaps;
3. prepare a self-contained, redacted brief with counterexample and falsification questions;
4. confirm disclosure of that brief to four providers;
5. launch four independent panelists with fresh context and no filesystem, shell, or network tools;
6. require each panelist to steelman, identify the weakest dependency, construct a concrete counterexample, define a falsification test, and state what survives;
7. synthesize only evidence-supported surviving challenges while minimizing model-identity bias.

Adversarial review does not require dissent. `accept` with no findings is valid when no challenge survives. `/expert-panel` skips brief preparation and immediately enters the guarded preflight for an already self-contained artifact; it still shows the digest-bound provider confirmation before any launch.

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
- authentication configured in Pi for all four providers

The optional `/herdr-orchestrator` overlay additionally requires Pi 0.80 or newer, Herdr 0.7.5 or newer, and the separately installed reviewed adapter `@ogulcancelik/pi-herdr@0.4.0`.

## Install

Pi packages execute extensions with the current user's permissions. Review the published source before installing.

Install the pinned Pi Subagents runtime, then Pi Forge:

```bash
pi install npm:pi-subagents@0.37.2
pi install npm:@maroffo/pi-forge@0.3.0
```

Restart Pi or run `/reload` after installation. The Pi Forge runtime rejects a different Pi Subagents version rather than silently changing agent behavior.

Herdr support is optional and is not a Pi Forge dependency. To enable its structured tools, install the exact reviewed adapter separately:

```bash
pi install npm:@ogulcancelik/pi-herdr@0.4.0
```

Install Herdr 0.7.5 or newer independently, start Pi inside a Herdr-managed pane, then run `/reload`. Pi Forge does not bundle, install, start, stop, or configure Herdr. Adapter or environment presence never activates Herdr orchestration by itself.

The optional direct-Claude path additionally requires the canonical Claude Code executable at version 2.1.226 or newer, installed and authenticated separately. Pi Forge neither depends on nor installs or authenticates Claude Code. Its preflight accepts the route only when Claude Code reports `apiProvider: "firstParty"` for the observed environment; that is CLI-declared evidence for the intended first-party Anthropic route, not independent or cryptographic endpoint proof. Never paste raw `claude auth status --json` output because it may contain identity fields.

## Local development install

```bash
pi install npm:pi-subagents@0.37.2
pi install /absolute/path/to/pi-forge
```

Run `/reload` after editing package resources.

## Usage

Examine a claim or decision Socratically before choosing whether independent review is warranted:

```text
/socratic-analysis Should this API design replace the current contract?
```

Optionally grant one automatic sanitized escalation for the current session, inspect it, or revoke it before use:

```text
/auto-panel enable
/auto-panel status
/auto-panel disable
```

Prepare context in the parent model, then obtain independent adversarial opinions:

```text
/second-opinion Evaluate whether this API design preserves backward compatibility.
```

Send an already self-contained brief directly to the panel:

```text
/expert-panel <paste a self-contained brief here>
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
/herdr-orchestrator quality_reports/plans/active/2026-07-30_example.md
/pr-review 456 --no-exec
```

Inspect a project and prepare truthful root Make gates, then run deterministic local quality gates:

```text
/project-checks
/score
/score pr
/score excellence
```

`/project-checks` reads fixed, bounded root metadata without executing project commands or writing files. It labels observed, conventional, and unresolved candidates and shows a diff before an existing Makefile is edited. If no real project-owned E2E or user-flow command exists, it leaves `test-e2e` unresolved and `/score` remains intentionally inconclusive.

Load engineering skills explicitly when needed:

```text
/skill:source-control
/skill:refine-requirements
/skill:second-opinion
/skill:socratic-analysis
/skill:orchestrator
/skill:herdr-orchestrator
/skill:plan-forge
/skill:project-checks
/skill:pr-review
/skill:session-telemetry
```

`/commit` authorizes one local commit, not a push, amend, branch change, destructive cleanup, or hook bypass. The source-control skill treats an existing index as protected, separates mixed-file changes by exact hunk, and places `git commit` behind an aborting branch conditional.

### Herdr orchestration

The authoritative workflow contract is `skills/herdr-orchestrator/SKILL.md`; `docs/architecture.md#optional-herdr-control-plane` documents its system boundary.

`/orchestrator` coordinates one scoped writer, fresh artifact-only reviewers, final verification, bounded fix rounds, and presentation. `/herdr-orchestrator` is an explicit opt-in overlay. When selected and ready, one eligible trusted generic Herdr writer may hold the sole delegated implementation lease instead of `pi-forge.software-engineer`; the parent stops editing for that complete lease. Work requiring a protected Pi Forge contract stays on its existing protected route, and normal `/orchestrator` behavior is unchanged outside Herdr mode. Herdr readiness failure never silently falls back or changes transport. A Pi helper using a provider or model different from the parent requires disclosure and consent before receiving source or artifacts; the only supported non-Pi path is the exact direct-Claude contract below.

Generic advisory helpers receive only `read`, `grep`, `find`, and `ls`, without shell, write, Herdr, or subagent capability. Peer exchange is parent-mediated only. The parent may persist a complete captured result to a temporary Markdown artifact outside the repository, but incomplete alternate-screen output is handled with bounded concise continuation turns and then an explicit evidence gap, never a capability expansion or fabricated complete artifact.

#### Optional direct Claude

Pi remains the default Herdr agent. For an approved task, the parent may instead propose canonical Claude Code using exactly `claude-fable-5` or exactly `claude-opus-5`, never `fable`, `opus`, another model, or a fallback. Both roles are supported: a capability-read-only helper uses safe mode, `permission-mode plan`, and only `Read,Grep,Glob`; the one trusted generic writer uses safe mode, `permission-mode acceptEdits`, and only `Read,Grep,Glob,Edit,Write,Bash`. Both disable Chrome and slash commands and require strict MCP configuration. No extra native arguments, resume, plugins, agents, extra directories, remote execution, background mode, or worktree mode are allowed.

The packaged `skills/herdr-orchestrator/scripts/prepare-claude-launch.mjs` script is the structured model, role, argument, readiness, conflict, and route-evidence source. The parent resolves it relative to the loaded skill and submits it once in the future agent pane with exact closed model/role input. It captures child stdio, uses no shell, invokes `claude` only for `--version`, `--help`, and `auth status --json`, and emits either one sanitized ready descriptor or one fixed error. It rejects versions below 2.1.226, prereleases, missing flags, logged-out or non-`firstParty` status, unsafe authentication tokens, the four Claude routing variables, and uppercase or lowercase HTTP(S)/ALL proxy variables. It never emits environment values, raw auth JSON, identity fields, exception details, executable paths, or local paths.

A ready descriptor records that Claude Code declared `apiProvider: "firstParty"` for the preflight process environment. This identifies the intended first-party Anthropic route but does not cryptographically attest the endpoint, independently observe network routing, neutralize admin-managed policy, or atomically bind Herdr's later start. Captured stdio contains ordinary child output, but a hostile or replaced executable or concurrent local mutation is outside the trusted-worker boundary. If that evidence is insufficient, or independently proven routing is required, stop and use an appropriate OS and network boundary. Never silently fall back to Pi.

Copy-safe requests for the two roles are:

```text
/herdr-orchestrator Propose exact model claude-fable-5 as one capability-read-only helper for this task. Show the required same-pane route evidence and limitation, then ask for fresh launch consent.
/herdr-orchestrator Propose exact model claude-opus-5 as the sole trusted generic writer for this task. Show the required same-pane route evidence and limitation, then ask for fresh launch consent.
```

These requests select a proposal only. They do not waive the later disclosure confirmation. After a descriptor passes and before every start, the parent discloses the CLI-declared route evidence and its endpoint-attestation limitation, exact model, precise source/artifact/data categories, purpose and role, admin-policy caveat, and possible local interactive-session persistence. Explicit consent is required for every launch; installation, Herdr selection, a request naming the model, or earlier consent never carries forward.

After consent, Herdr must start `kind: "claude"` in the same unchanged pane with the descriptor's exact `agentArgs`, with no intervening command or environment mutation. A stale or ambiguous descriptor, changed pane/environment, decline, model unavailability, preflight or start failure, unauthorized blocked permission, unknown lifecycle, or incomplete output remains a gap with no alias, retry, resume, fallback, Pi substitution, or transport switch. The package script does not enforce consent or Herdr lifecycle because Pi Forge owns neither the Herdr runtime nor an atomic preflight-to-start binding.

#### Process and pane lifecycle

Every ordinary process is classified before launch. A proven checkout-read-only process may overlap a writer. A potentially mutating generator, build, watcher, server, test, or uncertain command shares the sole writer lease and must be confirmed stopped before parent or agent edits resume. If `herdr_pane run` returns a transport, protocol, or JSON error, the parent does not resend: it inspects the recorded pane once for the unique exit marker and reports the command outcome separately from the transport error, or leaves the result unknown and open.

Automatic pane retirement is the default only for exact workflow-created panes that retain continuous exclusive workflow custody and pass all evidence, process, lease, preservation, and follow-up gates. Retirement is a parent-executed workflow contract from the loaded skill, not a background daemon, Herdr runtime hook, or atomic cleanup service. Users may preserve all created panes or exact created IDs, overriding automatic retirement. Immediately before one close attempt, the parent freshly resolves the recorded current canonical ID with exact `herdr_pane get`; agent panes also require exact-name `herdr_agent get`; revalidation and close stay adjacent with no unrelated call or user round. Any move, alias/canonical-ID change, rename, replacement, reuse, repurposing, external interaction, unexpected foreground/cwd, or possible concurrent mutation permanently disables automatic close for that entry; caller, foreign, preserved, active, uncertain, or incomplete panes remain open. This narrows but cannot eliminate TOCTOU because Herdr has no ownership-conditional close; ambiguous close is never retried and is checked once with exact `herdr_pane get`, never workspace-list absence. Closing never stops work or releases a lease, and a fully successful final pass may report `no workflow panes remain`.

#### Trust boundary

Herdr panes, worktrees, prompts, safe mode, permission modes, declared paths, and tool lists are workflow controls, not security boundaries. Herdr helpers run with current-user permissions and are suitable only for trusted work; admin-managed Claude policy and current-user environment behavior may remain. Same-pane sequencing reduces environment drift but is not cryptographic route attestation or atomic launch binding. A generic writer's `bash` tool can invoke installed Herdr or agent CLIs despite its visible tool list; the same is true of a direct Claude writer's `Bash` tool. The workflow explicitly forbids that behavior but does not claim enforcement or path confinement. `acceptEdits` does not authorize commits, shell bypass, permission expansion, or external side effects. Untrusted execution requires an OS sandbox or container; protected work uses the separately selected protected path. A direct Claude session is never a protected Pi Forge agent or protected-review substitute. Every package-qualified Pi Forge writer, reviewer, technical writer, or analyst, plus Socratic Analysis, Second Opinion, and Expert Panel, stays on its existing pi-subagents or guarded route. Herdr lifecycle settlement is not a result; the parent reads the handoff and reruns evidence.

### Additional workflow boundaries

`/plan-forge` writes a self-contained draft plan but does not implement or commit it. `/pr-review` pins immutable base and head OIDs in a mode-0700 throwaway clone and never posts, approves, or merges. Builds, tests, package scripts, Make targets, and other candidate-controlled code are skipped unless `PI_FORGE_ALLOW_CANDIDATE_CODE=1` is explicitly present or execution occurs in appropriately restricted ephemeral CI. Local candidate commands run with a stripped environment plus temporary HOME and XDG directories, without inherited credentials or agent sockets. That opt-in still grants execution with current-user filesystem and network permissions; it is not a sandbox.

`/forge-telemetry` shows schema-v2 aggregate session counters from custom entries that never enter model context. The public `session-telemetry` skill can extract a sanitized active-branch JSONL trace or summary from historical raw Pi v2/v3 session files. One result classifier aligns successful direct edits, genuinely launched protected writers, errors, and successful recognized verification across counters and ordered events. It excludes prompt and response text, thinking, source, paths, commands, output, findings, secrets, session paths, and provider/model identifiers. Nothing is transmitted automatically.

The bundled cohort aggregator accepts only 5 to 100 repeated explicit regular non-symlink session files, with a 1 GiB cumulative limit and internal filesystem/header duplicate rejection. It emits aggregate totals, medians, session counts and rates, and fixed warnings only, with no rows, extrema, timestamps, identifiers, hashes, or input paths. Its output reuses no-follow, no-implicit-overwrite, mode-0600, single-link, and input-identity protections. The trusted source checkout adds project-only `skill:pi-forge-harness-audit`, which requires exact-artifact disclosure consent, an operator comparability assertion, and one falsifiable change contract. It does not read raw sessions by default, edit source, refresh the Behavior Map, claim causality, invoke another provider, or promote changes automatically.

The lifecycle extension blocks direct Bash-tool commits, requires interactive confirmation for push, destructive Git and sensitive-path operations, and schedules one bounded verification follow-up after observed source changes without a later successful recognized check. It is a workflow guard, not a shell parser or OS sandbox; obfuscated commands, aliases, custom processes, and internal filesystem operations remain outside complete observation. See `docs/lifecycle.md` and `docs/telemetry.md`.

The Socratic analyst is a protected artifact-only agent with fresh context, no inherited project context or skills, and no filesystem, shell, network, extension, MCP, persistence, sharing, or subagent capability. It cannot invoke slash commands or authorize provider disclosure. See `docs/socratic-analysis.md`.

The expert-panel launcher validates the generated adversarial chain digest, verifies the exact pi-subagents runtime version, preflights the effective agent definitions, and pings pi-subagents before any panel model is called. Manual skill use opens the exact rendered payload for inspection and redaction, then binds provider consent to its size and SHA-256 digest. Shadowed agents, fallback models, context inheritance, added tools, skills, or ambient extensions are rejected. The preflight repeats immediately before spawn. The launcher also discloses that OpenAI receives the accepted payload a second time together with all four reports for synthesis.

Automatic launch is a deliberate weaker consent mode, not a shortcut hidden inside the manual tool. It is disabled by default, requires a separate interactive one-shot grant before the Socratic analysis, requires a complete protected-agent recommendation and `classification: sanitized`, and consumes the grant before preflight. It retains chain/runtime checks and both isolation preflights but intentionally skips exact-payload editing and confirmation. Calls already emitted cannot be reliably revoked.

The workflow does not share the parent conversation, project instructions, discovered skills, ambient extensions, or filesystem, shell, and network tools with its children. Pi-subagents still enables its internal `structured_output` tool to enforce result schemas.

## Development

```bash
make check
make test-e2e
```

### Maintainer Behavior Map

The trusted source checkout includes a project-only Behavior Map for maintainers changing Expert Panel or protected-agent launch and resume policy. It is discovered from `.pi/skills/pi-forge-handbook/` and is deliberately excluded from the npm package and public skill catalog.

Load it inside the Pi Forge repository when localizing either mapped workflow:

```text
/skill:pi-forge-handbook
```

The map provides a direct behavior index, cross-file registers, typed source locators, generated-artifact provenance, and explicit unmapped workflow boundaries. It is a location index, not source authority: reopen every locator in the current repository before planning or editing. Its lexical discovery vocabulary cannot prove semantic completeness.

Run the structural and advisory freshness checks directly with:

```bash
npm run check:behavior-map
npm run check:behavior-map:freshness
```

The structural check is also part of `npm run check`. A stale fingerprint freezes the affected card for trusted routing but does not prove that its prose is wrong. After reviewing the changed source and relevant cards, refresh the fixed snapshot explicitly with `npm run refresh:behavior-map`; this never runs automatically.

### Maintainer harness audit

After producing an exact cohort artifact and deciding it may enter the current provider context, load the project-only audit workflow:

```text
/skill:pi-forge-harness-audit
```

The skill validates the aggregate contract, asks for an explicit comparability assertion, and returns at most one draft change contract. It does not read raw sessions, edit the harness, invoke another provider, or authorize implementation.

### Maintainer release workflow

The trusted source checkout also exposes `skill:pi-forge-release` and a project-local ordinary-command guard. Both remain outside the npm package. The non-publishing helper validates one stable release phase without creating tags, pushing, publishing, changing dist-tags, deprecating, or unpublishing:

```bash
node scripts/check-release.mjs --phase prepare --version 0.3.0
node scripts/check-release.mjs --phase tag --version 0.3.0
node scripts/check-release.mjs --phase publish --version 0.3.0
node scripts/check-release.mjs --phase verify --version 0.3.0
node scripts/check-release.mjs --phase reconcile --version 0.3.0
```

`pass`, `fail`, and `indeterminate` are distinct. Missing CLI, authentication, network, exact-HEAD CI, or parse evidence never becomes a pass. Project verification and local pack commands run only after static release prerequisites pass, under a temporary HOME without inherited release/provider credentials; all release invariants are queried again afterward. Local tag creation, tag push, and npm publication require separate explicit authorizations. After an uncertain network result, reconcile authoritative Git and npm state before any retry. The project guard blocks force-tag creation and confirms ordinary Pi Bash-tool tag creation and `npm publish`, but it does not cover aliases, custom tools, user shell commands, external terminals, or obfuscation and does not prove preflight passed.

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

`/score` requires a trusted project and literal, top-level, uniquely defined `check` and `test-e2e` targets in the root Makefile. Conditional, generated, escaped, or continued target definitions are inconclusive rather than interpreted. It runs `make check` followed by `make test-e2e` with fail-fast, shell-free execution, strips inherited Make control variables, preserves process signals, and never invokes a model. A definite gate failure scores 0; missing gates, process errors, signals, and timeouts are inconclusive rather than fabricated scores. Passing gates establish a static 100 baseline, explicitly without review deductions. Numeric runs are recorded under local Git metadata and do not dirty the worktree. Failure excerpts are shown through the current UI but excluded from persisted Pi score entries and model context. Repository gates execute project code with the current user's permissions; this is not a sandbox.

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
