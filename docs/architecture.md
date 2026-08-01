# Architecture

## Goal

Pi Forge provides Pi-native context, skills, agents, workflows, enforcement, and telemetry. It preserves useful Claude Forge outcomes without emulating Claude Code APIs.

## Principles

1. Role first, provider second.
2. Functional parity, not file parity.
3. Independent context by default for adversarial review.
4. Identity-minimized synthesis before provider labels can bias judgment.
5. Evidence over votes.
6. Minimum necessary disclosure to every provider.
7. One writer per checkout.
8. Docker or OS sandbox only when an execution boundary is required.
9. Model assignments measured, never assumed.

## Resource boundaries

| Concern | Pi mechanism |
|---|---|
| Global working agreement | Installable `AGENTS.md.example` |
| Domain knowledge | Skills |
| Repeatable user workflows | Commands and chains |
| Specialized reasoning roles | pi-subagents agents |
| Deterministic guards | Extensions |
| Multi-provider collaboration | Explicit parallel model assignments |
| Measurement | Session and provider evaluation artifacts |

## Context isolation

Fresh context prevents conversation inheritance. It does not restrict filesystem or network access by itself.

Pi Forge combines:

- `context: "fresh"` at launch;
- `systemPromptMode: replace`;
- `inheritProjectContext: false`;
- `inheritSkills: false`;
- empty `tools` and `extensions` lists, except for pi-subagents' internal structured-output tool when schemas are active;
- an explicit artifact embedded in the task;
- package-qualified agent names plus launch-contract preflight that rejects shadowed or overridden agents before disclosure.

Worktrees remain useful for mutation-based validation, but they share Git state and are not security boundaries. OS sandboxing or containers remain appropriate for untrusted execution.

Pi Forge assumes its local package and settings are not mutated concurrently between a validated preflight and launch. Pi-subagents RPC v1 has no atomic preflight-token binding, so hostile local mutation is outside the extension's isolation boundary.

## Dependency compatibility

Pi Forge pins and bundles pi-subagents because it consumes the preflight API and requires the separately active RPC extension to implement the same reviewed contract. Package checks fail when the manifest, lockfile, or runtime constant diverge.

The upgrade gate tests a candidate in a temporary copy with isolated `HOME` and `PI_CODING_AGENT_DIR` values. It verifies static checks, unit tests, explicit candidate-extension loading, agent discovery, effective-contract preflight through RPC, cancellation before Pi Forge sends the spawn request, and inclusion of the candidate preflight API in the publish tarball. Weekly checks test the newest npm release without mutating the repository.

The isolated Pi configuration is not an OS sandbox. Candidate extension code runs with process permissions and could initiate arbitrary network traffic independently of Pi Forge. The probe sanitizes inherited environment variables but cannot constrain filesystem access. New versions are therefore tested automatically only in an ephemeral CI runner with checkout credentials disabled. Local testing of a version different from the pin requires `PI_FORGE_ALLOW_CANDIDATE_CODE=1`.

## Implementation writer contract

The package implementation writer uses an invocation-private `skillPath` relative to its agent definition. This keeps the implementation contract out of the parent skill catalog and gives it precedence over identically named project skills. The published-artifact test verifies this behavior with a deliberate collision.

Agent definitions remain configurable by pi-subagents, but the supported Pi Forge launch path does not accept overrides for the protected implementation writer identity. Every writer launch is one direct call with explicit `async: false` and a locally approved provider/model. The parent rejects `forceTopLevelAsync` and verifies that the effective model and sole candidate match exactly; repository async or model defaults cannot choose execution mode or provider. The parent policy also verifies the package file, private skill, context, tools, extensions, MCP, fallback candidates, and runtime version before spawn.

## Technical writing contract

The technical writer is a separate artifact-only content drafter, not a second checkout writer. Its generated replacement prompt compiles one private writing contract into the package agent. It receives only the audience, format, evidence, requirements, and voice samples embedded in the task. It has fresh context and no tools, runtime skills, project instructions, fallback models, extensions, or MCP.

The parent policy requires an explicit model, `artifacts: false`, `acceptance: false`, and `agentContract: { version: 1 }`. It rejects sharing, custom session destinations, injected reads, output persistence, and delayed launches. The agent returns Markdown in its response but cannot inspect the repository, persist output, publish content, or modify files.

## Review contract

Seven reviewer identities are generated from one canonical artifact-review contract plus domain-specific focus. The contract owns severity, evidence, confidence, deduplication, recommendation, safety, and output semantics. Generation checks prevent domain prompts from drifting into incompatible formats.

Reviewers use replacement system prompts and fresh context. They inherit no project instructions, skills, fallback models, tools, extensions, or MCP. The parent prepares an explicit review artifact containing the diff, relevant context, requirements, and verification evidence. Missing evidence stays listed as not checked rather than triggering filesystem or network access.

Pi-subagents permits project agents with package-qualified names and invocation-time capability changes. The parent `agent-policy` extension preflights every protected agent found in immediate single, parallel, or chain `subagent` tool calls and rejects changed source paths or capabilities before spawn. Reviewers require an explicit model, `artifacts: false`, `acceptance: false`, and the compatibility-only `agentContract: { version: 1 }`; repository defaults cannot select the provider. Scheduling, appended steps, clarification UI, acceptance commands, output persistence, output schemas, invocation-time thinking, and skills are unsupported for protected reviewers. Legacy execution aliases are normalized before the same policy checks run.

Direct RPC launch is outside this protected path. The parent records run classification and source kind in Pi custom entries whenever a correlated `subagent` result contains a canonical run id, including failed children. Generic foreground runs may resume only while the originating policy runtime remains active. Restored foreground attestations fail closed because pi-subagents may reinterpret the short id as a prefix. Generic async attestations survive reload only while their exact canonical directory can be re-established. Protected, mixed, unknown, directory-addressed, prefix-addressed, chain-attaching, and stale foreground resumes fail closed. Protected continuation is a new normal launch containing the prior result and follow-up, so the existing launch preflight applies again.

A true protected resume requires an atomic pi-subagents resume contract and single-use token. The upstream API proposal is in `pi-subagents-resume-contract.md`. As with second-opinion preflight, concurrent hostile local mutation between preflight and execution remains outside the current extension boundary.

## Maintainer Behavior Map pilot

The trusted Pi Forge source project exposes `.pi/skills/pi-forge-handbook` as a maintainer-only location index. It maps only Expert Panel and protected-agent launch/resume policy. The npm package does not publish `.pi/`, and the public package skill roster remains unchanged.

The map routes from one direct index to concise behavior cards and cross-file registers. Typed locators cover regular files, JavaScript or TypeScript declarations, Markdown headings, skill names, and JSON pointers. Agents must reopen every locator in current source before planning or editing. Cards contain no source bodies or persistent line numbers.

Checker-owned roots and workflow vocabularies discover the lexical pilot universe independently of the manifest. Every discovered file must be mapped, explicitly unmapped, or excluded with a rationale. This catches known vocabulary in new files but cannot prove semantic completeness.

`npm run check:behavior-map` enforces structural validity and is part of the standard source check. `npm run check:behavior-map:freshness` separately compares canonical authored files with an explicit whole-file snapshot. Drift freezes the affected card for trusted routing, but it is a review signal rather than proof that the prose is wrong. Generated outputs are linked to fingerprinted canonical inputs and remain governed by their existing generator checks. `npm run refresh:behavior-map` is an explicit post-review action and never runs automatically.

The pilot does not change `plan-forge`, `orchestrator`, runtime extensions, or the ExecPlan template. Promotion requires evidence from at least three real planning tasks: sites surfaced, sites missed, stale false positives, navigation and token cost, and maintenance work.

## Maintainer release boundary

Pi Forge release policy is source-project tooling, not a public package capability. `.pi/skills/pi-forge-release` owns the prepare, tag, publish, verify, reconcile, and bad-release recovery protocol. `scripts/check-release.mjs` runs only fixed Pi Forge verification commands, temporary pack probes, and read-only Git, GitHub, and npm queries. It reports pass, fail, or indeterminate and never performs a Git or registry mutation.

The preflight requires package, lockfile, README, exact HEAD, `origin/main`, both named GitHub workflows, tag provenance, registry state, pack roster, and phase-specific verification as applicable. Missing or ambiguous remote evidence fails closed. Static release evidence is validated before any project script or local pack command runs. Those commands receive a temporary HOME and a minimal environment without inherited release/provider credentials; the helper then recollects Git, tags, registry, and CI so project-side mutation invalidates the result. Tag creation, tag push, and npm publication remain separate explicit user authorizations. Unknown mutation results stop retry and enter reconcile.

A trusted project extension adds a second ordinary-command confirmation for local tag creation and npm publication in Pi's Bash tool. It blocks forced tag creation unconditionally, blocks other covered calls headless, and is excluded from npm with all `.pi/` resources. It is a workflow guard, not state binding or a shell security parser: aliases, custom tools, user shells, external terminals, and obfuscation remain outside observation.

## Delivery workflows

`/socratic-analysis` is a prompt alias for a parent-owned conversational skill. The parent resolves the examination, asks at most one material question per turn, minimizes evidence, and launches `pi-forge.socratic-analyst` with a fresh artifact-only contract. The child has no inherited project context, skills, or tools and cannot invoke slash commands. By default, a recommendation requires a separate yes before the parent follows manual Second Opinion.

`/auto-panel enable` adds a distinct, weaker consent boundary for true automatic escalation. An interactive, memory-only standing grant permits one later sanitized payload after a direct complete protected Socratic recommendation. The extension consumes the grant before launcher work, refuses reuse and recursion, resets on session start or reload, and rejects obvious sensitive-data shapes. The automatic tool reuses chain/runtime/ping/preflight mechanics but intentionally skips per-run editing and digest confirmation. Scanner success and model classification are not proof of privacy. Manual panel entry points never consult this state.

`/second-opinion` is a prompt alias for a parent-model skill. The skill gathers only decision-relevant evidence, labels facts and uncertainties, and calls `convene_expert_panel` with a structured brief. The tool requires substantive fields and at least two distinct questions, opens the exact payload for user inspection or redaction, and binds the next consent dialog to its digest. It then owns chain validation, runtime check, two preflights, and RPC spawn. Every critic in the shared chain uses the same evidence-bound adversarial sequence: steelman, weakest dependency, concrete counterexample, falsification test, and surviving judgment. Synthesis promotes only supported surviving challenges; no finding is required. `/expert-panel` exposes the same adversarial launcher directly for an artifact that is already self-contained, without a parent-model preparation turn.

`/plan-forge` turns issue or in-session evidence into a self-contained ExecPlan. It writes only a draft plan, records provider disclosure and consent when second opinion runs, and emits a fresh-session `/orchestrator` handoff. It does not implement, commit, or publish.

`/orchestrator` keeps the parent in control of localization, one scoped writer, final verification, protected artifact-only review, bounded fix rounds, and presentation. Reviewer tasks contain redacted evidence rather than filesystem access. Numeric `/score` output measures repository gates only and cannot override unresolved review findings.

`/pr-review` keeps the active checkout read-only, pins immutable base and head OIDs, and uses a recorded mode-0700 throwaway clone for commit attribution and source verification. PR-controlled builds, tests, dependency installers, hooks, generators, and project commands are skipped locally unless `PI_FORGE_ALLOW_CANDIDATE_CODE=1` is present. Allowed commands receive a minimal environment with temporary HOME and XDG directories, disabled ambient Git configuration, and no inherited credential variables or agent sockets. The opt-in remains permission under current-user filesystem and network privileges, not isolation. Remote comments, approvals, labels, pushes, and merges require separate authorization.

## Lifecycle enforcement

The lifecycle extension intercepts ordinary parent `tool_call` events for sensitive paths and Git or shell mutations, failing closed without interactive confirmation. Direct Bash-tool commits are always redirected to the source-control gate. It observes successful tool results to invalidate stale verification and queues at most one corrective follow-up per observed source-mutation sequence. Protected implementation writers run as a single direct foreground call, without supervisor or nested-subagent tools, so their result is joined before this final verification boundary.

Lifecycle counters persist as custom entries outside model context. The one verification follow-up is intentionally a custom message inside context because it must trigger another agent turn. Shell parsing and tool observation are incomplete by construction, so this remains a workflow control rather than a security boundary.

## Session telemetry

Telemetry is derived from the active Pi session branch and checkpointed as sanitized schema-v2 custom entries. One pure result classifier aligns aggregate and event semantics for successful direct source edits, genuinely launched protected writers, errors, and successful recognized verification. The offline extractor continues to accept historical raw Pi v2/v3 sessions and emits active-branch-only schema-v2 JSONL without prompt, response, thinking, source, paths, commands, outputs, findings, environment, secrets, or provider/model identities.

The public cohort aggregator reads only 5 to 100 explicit regular non-symlink session files with per-file, line, count, cumulative-byte, filesystem-identity, and header-identity bounds. It emits totals, medians, counts, rates, and fixed warnings only. Duplicate header IDs stay internal, sessions without observed mutations are excluded from the final-mutation verification denominator, and no row, extrema, timestamp, ID, hash, or input path is exposed. Safe output is no-follow, non-overwriting by default, mode 0600, single-link, and distinct from every input.

Harness interpretation is a separate project-only workflow. `skill:pi-forge-harness-audit` requires an operator-approved cohort artifact, explicit comparability assertion, separated observations, hypotheses, and gaps, and one falsifiable change contract. It does not read raw sessions by default, edit source, refresh the Behavior Map, claim causality, invoke another provider, or promote a mutation. Accepted contracts return to normal planning and approval. No trace or cohort file is created automatically, and no telemetry leaves the machine without exact-artifact authorization.

## Project quality-gate onboarding

`/project-checks` is a prompt-backed public skill with a deterministic, read-only metadata inspector. The inspector and `/score` share one conservative literal-Make policy, so onboarding cannot claim compatibility for syntax the score command rejects. Inspection reads only fixed, size-bounded, non-symlink root metadata for JavaScript/TypeScript, Python, Go, Ruby, and Rust. It does not run discovered scripts, inspect arbitrary files, install tools, or write a Makefile.

Candidates retain their evidence class. An observed package script can support a parent-reviewed target proposal; a conventional ecosystem command remains a question for the user. Existing or duplicate required targets, unsupported Make syntax, conflicting package managers, and unsupported build systems freeze proposals. A project without a real E2E or user-flow command remains score-inconclusive rather than receiving a fabricated gate.

## Deterministic scoring

`/score` is an extension command, not a model-authored judgment. It resolves the Git project root, requires project trust, and statically requires literal, top-level `check` and `test-e2e` definitions in the root Makefile. Conditional, generated, escaped, continued, or otherwise ambiguous definitions are inconclusive. Its local process runner invokes `make check` followed by `make test-e2e` without a shell, removes inherited Make and shell control variables, bounds captured output, and preserves signal and spawn-error state. A definite numeric gate failure produces score 0. Missing gates, process errors, signals, and timeouts are inconclusive. Two passing gates produce the static baseline of 100, with review deductions explicitly reported as not evaluated.

The command stores numeric history under Git metadata rather than the working tree and persists a sanitized Pi session entry. Failure excerpts are shown through the current UI and are not sent as model-context messages. History failures never change readiness. Gate code still runs with the current user's process permissions; trust is disclosure and consent, not an OS sandbox.
