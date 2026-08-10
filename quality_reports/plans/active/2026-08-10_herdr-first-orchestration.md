# Herdr-first orchestration overlay

**Status:** completed
**Origin:** In-session request to plan and then implement the previously accepted Herdr-first hybrid
**Base:** `fix/upgrade-pin-test` at `7268a28733da104698181cfcea9eca5ba430f4cc`
**Goal:** Ship an explicit `/herdr-orchestrator` workflow that uses visible Herdr panes for ordinary trusted helpers, one bounded writer, and process supervision while preserving Pi Forge's existing pi-subagents path for every protected writer, artifact-only reviewer, Socratic, Second Opinion, and Expert Panel launch.

## Analysis (verified 2026-08-10, do not re-derive without new evidence)

### Current behavior
- Pi Forge exposes package prompts and skills from whole `./prompts` and `./skills` directories, while its specialized agents and chain remain pi-subagents resources (`package.json:47-70`).
- `/orchestrator` is currently a thin prompt that loads one parent-owned delivery skill (`prompts/orchestrator.md:1-14`). The skill allows either parent edits or one protected `pi-forge.software-engineer`, requires one writer per checkout, and routes protected artifact-only reviewers through the normal `subagent` tool (`skills/orchestrator/SKILL.md:8-14`, `skills/orchestrator/SKILL.md:35-47`, `skills/orchestrator/SKILL.md:53-68`).
- The architecture assigns specialized roles to pi-subagents and requires the pinned runtime because protected preflight, context isolation, reviewer contracts, and Expert Panel RPC depend on it (`docs/architecture.md:19-29`, `docs/architecture.md:31-55`, `docs/architecture.md:57-79`).
- Package checks enumerate mandatory authored resources and keep `pi-subagents` pinned and bundled (`scripts/check-package.mjs:10-95`, `scripts/check-package.mjs:125-164`). The packed-artifact probe separately checks command discovery and reports the public skill roster (`scripts/check-runtime-resources.mjs:21-69`, `scripts/check-runtime-resources.mjs:135-174`, `scripts/check-runtime-resources.mjs:1121-1144`).
- Contract tests protect the existing one-writer, explicit-model, protected-review, planning, and thin-prompt behavior (`tests/orchestration.test.ts:16-69`, `tests/orchestration.test.ts:108-114`; `tests/engineering-core.test.ts:16-54`).
- The current README documents only the required pi-subagents installation and existing `/orchestrator` route (`README.md:53-80`, `README.md:117-152`). There is no tracked Herdr integration in the repository.
- Herdr 0.8.0 documents separate layout, pane, and recognized-agent primitives; lifecycle waits are state-based rather than turn-bound, `unknown` is not completion, and long alternate-screen output may require a file handoff ([Agent automation](https://herdr.dev/docs/agent-automation/), v0.8.0). The official skill allows an agent inside `HERDR_ENV=1` to inspect neighbors and start helpers ([Agent skill](https://herdr.dev/docs/agent-skill/), v0.8.0).
- The current Pi adapter `@ogulcancelik/pi-herdr` 0.4.0 exposes `herdr_layout`, `herdr_pane`, and `herdr_agent`, activates only inside Herdr, requires Herdr 0.7.5 or newer, and explicitly requires user opt-in. This version and the installed Herdr 0.8.0 were checked locally on 2026-08-10.
- Baseline `npm run test:e2e` completed successfully before source edits: package checks passed, all 125 tests passed, and packed-resource discovery reported `modelInvocationRequested:false`.

### Root cause or design gap
Pi Forge has a strong protected-agent runtime but no package-level route for explicitly selected, human-visible Herdr delegation. Using Herdr ad hoc therefore relies on conversation memory and does not preserve the one-writer, provider-disclosure, lifecycle, result-handoff, and protected-agent boundaries encoded by `/orchestrator`. Replacing pi-subagents globally would break reviewed protected contracts; leaving Herdr as undocumented prose would not create a repeatable workflow. The smallest falsifiable gap is an additive, explicit orchestration overlay rather than a runtime replacement.

### Scope
- In: a public `herdr-orchestrator` skill and thin prompt; an explicit hook from the base orchestrator when the request names Herdr; documented optional adapter/CLI setup; visible generic helper, process, and one-writer rules; lifecycle and handoff behavior; package, packed-artifact, release-roster, and contract tests; Behavior Map classification for protected-policy coupling.
- Out: changes to `extensions/agent-policy.ts`, `extensions/second-opinion.ts`, protected agent definitions, chains, pi-subagents version or dependency metadata, telemetry semantics, automatic Herdr activation, server startup, pane cleanup automation, commits, releases, and provider changes.
- Recover excluded context from: `docs/architecture.md`, `docs/lifecycle.md`, `docs/telemetry.md`, `docs/second-opinion.md`, `extensions/agent-policy.ts`, `extensions/second-opinion.ts`, and `docs/pi-subagents-resume-contract.md`.

### Candidate approaches
| Approach | Decision | Evidence and trade-off |
|---|---|---|
| Add explicit `/herdr-orchestrator` plus a public overlay skill | chosen | Makes Herdr selection visible and repeatable without changing protected runtime or silently affecting non-Herdr users. Pi natively discovers package prompts and skills (`package.json:47-56`). |
| Automatically switch `/orchestrator` whenever `HERDR_ENV=1` | rejected | Installation or environment presence is not explicit authorization; the adapter itself says its tools are opt-in. It would also surprise headless and existing users. |
| Block generic subagent launches in `agent-policy.ts` whenever Herdr is present | rejected | Adds an invasive runtime policy before the transport workflow has real usage evidence and risks conflating protected enforcement with generic user preference. |
| Move protected writers, reviewers, or Expert Panel to Herdr | rejected | Bypasses current package-source, capability, context, model, consent, RPC, and attestation checks (`docs/architecture.md:31-79`). |
| Documentation-only recommendation | rejected | Does not create a discoverable command, progressive-disclosure skill, or packed-resource contract. |
| Bundle or fork Herdr or its Pi adapter | rejected | Creates an unnecessary dependency and compatibility obligation. The first slice can document a separately installed, exact reviewed adapter version. |

### Independent opinion
The fixed multi-provider Expert Panel was not run because this request did not authorize disclosure to its additional providers and requested immediate planning followed by implementation. Reduced confidence is limited to external Herdr UX and adapter compatibility. Two read-only same-provider Pi agents were run in visible Herdr sibling panes for architecture and test/package analysis; they are supporting repository analysis, not a substitute for the independent multi-provider panel. Their main disagreement was whether to add a deterministic generic-subagent block. The lower-risk additive command was selected because protected runtime behavior remains unchanged and rollback is file-local.

## Locked decisions

Append only. Reverse a decision with a new row that names the superseded row.

| # | Decision | Choice | Evidence/rationale | Revisit if |
|---|---|---|---|---|
| 1 | Product shape | Additive Herdr-first hybrid, not wholesale pi-subagents replacement | The user accepted the hybrid recommendation; protected paths consume pi-subagents-specific contracts. | A reviewed Herdr launch contract can reproduce protected preflight and consent atomically. |
| 2 | Activation | Explicit `/herdr-orchestrator` or an instruction that explicitly names Herdr | Matches the adapter invocation policy and prevents environment-driven surprise. | Herdr gains a trustworthy per-user default policy surfaced by Pi. |
| 3 | Fallback | Stop with setup or `/orchestrator` guidance; never silently switch transports | A silent fallback would make provider, visibility, and supervision claims false. | The user explicitly requests automatic fallback. |
| 4 | Eligible Herdr work | Generic recon, advisory review, commands/tests, and one bounded trusted writer | This realizes visible control while keeping required protected review. | Telemetry or lifecycle must classify Herdr writers as protected. |
| 5 | Protected boundary | Every `pi-forge.*` protected writer/reviewer and every Socratic, Second Opinion, or Expert Panel path remains on the existing `subagent` or guarded tool route | Current preflight and isolation are pi-subagents-specific (`skills/orchestrator/SKILL.md:14`, `docs/architecture.md:49-79`). | An independently reviewed replacement contract exists. |
| 6 | Writer topology | One writer per checkout; parent and peers do not edit while a Herdr writer is active | Existing architecture principle and orchestrator invariant (`docs/architecture.md:7-17`, `skills/orchestrator/SKILL.md:35-47`). | Explicit isolated worktrees and disjoint integration seams are approved. |
| 7 | Coordination topology | Parent-led star by default; peer-to-peer is opt-in, named, read-only, bounded, and non-recursive | Avoids hidden task expansion, loops, and ambiguous authority while retaining Herdr coordination when useful. | Herdr adds scoped agent mailboxes and ACLs. |
| 8 | Model and disclosure | Default Herdr Pi helpers to the current parent provider/model; disclose and obtain consent before another provider or model receives source or artifacts | Preserves model transparency and minimum disclosure. | A local policy already binds an approved model fleet. |
| 9 | Distribution | Main Pi Forge package; adapter remains an optional separately pinned install | Package skills/prompts are already public discovery surfaces; no runtime import is needed. | Optional command visibility itself becomes unacceptable. |
| 10 | Reviewed compatibility | Document `@ogulcancelik/pi-herdr@0.4.0`, Pi 0.80+, and Herdr 0.7.5+; do not add package dependencies | These are the reviewed adapter's declared requirements and current latest adapter version on 2026-08-10. | Adapter API or Herdr lifecycle semantics change. |
| 11 | Runtime enforcement | No changes to `agent-policy.ts`, protected definitions, chains, or telemetry in this slice | Keeps the security-critical runtime delta zero and rollback local. | Real use shows prose-level routing is insufficient. |
| 12 | Git and release | No commit, push, version bump, tag, publication, or deployment | The request authorizes implementation and local verification only. | Separate exact authorization is given. |
| 13 | First-slice peer transport | Supersede any direct-tool implication of decision 7: peer exchange is parent-mediated only, and helpers receive neither Herdr nor write capability | Parent mediation preserves the named, bounded, non-recursive coordination goal without exposing an action-broad `herdr_agent` tool or weakening capability-read-only helpers. | Herdr provides action-scoped peer messaging and per-path artifact capabilities. |
| 14 | Post-completion Hold Scope extension | Keep Pi as default and add optional direct Claude Code only for exact `claude-fable-5` or `claude-opus-5`, in read-only or sole trusted-writer roles, under sanitized CLI-declared route evidence and per-launch consent | The user approved this bounded extension with verified local syntax evidence and prohibited aliases, fallback, generic backend abstraction, dependencies, live package-test calls, and protected-route changes. | A separately approved model, provider, role, or runtime-enforcement contract is proposed. |
| 15 | W6 fix round 1 policy owner | Supersede the prose-only readiness implementation: a package-owned deterministic script owns exact model, role, argv, readiness, conflict, route-evidence, and error policy; skill/docs consume its descriptor | Protected architecture, security, and test review verified that prose could neither execute the checks nor guarantee ordinary child-output redaction. | A reviewed runtime offers a stronger atomic contract without weakening redaction. |
| 16 | W6 route truth | Treat `apiProvider: "firstParty"` as Claude Code CLI-declared evidence for the intended route in the current same-pane environment, not cryptographic endpoint attestation or independent network proof | Same-pane sequencing and proxy rejection narrow drift but cannot attest the remote endpoint, neutralize admin policy, contain a hostile executable, or atomically bind Herdr start. | A separately reviewed OS/network boundary provides independent routing enforcement. |
| 17 | W7 automatic pane retirement | Automatically retire exact workflow-created panes when role-specific evidence proves they are no longer useful; preserve the caller, foreign, user-preserved, active, uncertain, incomplete, or still-needed panes | The user approved automatic cleanup as the default but explicitly separated terminal resource lifecycle from process stop, lease release, evidence capture, and protected policy. | Herdr supplies a reviewed transactional retirement API with stronger ownership and liveness attestations. |
| 18 | W7 fix round 1 identity boundary | Supersede historical exact-ID eligibility alone: require continuous exclusive workflow custody plus fresh canonical pane and exact-agent revalidation adjacent to close, and retain on any identity/custody ambiguity | Herdr moves change workspace-qualified pane IDs while old IDs remain aliases, and the structured API has no generation/ownership-conditional close. Exact IDs without current identity evidence can target moved, replaced, reused, or repurposed terminals. | Herdr adds an authoritative conditional close bound to immutable pane generation and workflow ownership. |

## Acceptance criteria
- [x] `/herdr-orchestrator` is discovered from the packed npm artifact and expands to both the Herdr overlay and base orchestrator without model invocation.
- [x] The overlay refuses to act outside a Herdr-managed pane or without the structured Herdr tools, reports the missing prerequisite, and never silently falls back.
- [x] Generic Herdr agents use a sibling pane in the current tab and cwd, preserve focus, use returned opaque IDs, and receive explicit bounded role/tool/model instructions.
- [x] Generic advisory helpers are capability-read-only with only `read`, `grep`, `find`, and `ls`; their capabilities are never expanded to recover output.
- [x] When Herdr is selected and ready, one eligible generic Herdr writer may replace `pi-forge.software-engineer` as the sole delegated writer; protected work keeps its protected route, parent edits stop for the complete lease, and normal `/orchestrator` behavior remains unchanged outside Herdr mode.
- [x] Every ordinary process is classified as proven checkout-read-only or potentially mutating; potentially mutating processes share the sole writer lease until confirmed stopped, while proven read-only processes may overlap.
- [x] Parent-led coordination is the default. Any peer coordination is explicit, named, read-only, bounded, non-recursive, and parent-mediated only; substantial artifacts are parent-written only from complete captured results.
- [x] `working`, `blocked`, `idle`, `done`, and `unknown` have explicit safe handling; lifecycle settlement alone is never treated as a successful result.
- [x] Alternate-screen or truncated helper results use bounded concise continuation turns and become an explicit gap if completeness cannot be established.
- [x] Ambiguous `herdr_pane run` transport/protocol/JSON errors are never resent; the recorded pane is inspected once for the unique exit marker, and command status remains separate from transport status.
- [x] Existing protected writer/reviewer, Socratic, Second Opinion, Expert Panel, pi-subagents pin, preflight, and attestation behavior remains unchanged.
- [x] README and architecture accurately distinguish optional Herdr supervision from protected isolation and disclose that neither Herdr panes nor worktrees are security boundaries.
- [x] Package, unit, packed-runtime, release-roster, Behavior Map, upgrade-compatibility, whitespace, and status checks pass after the final edit.

## Workstreams

### W1: Public Herdr orchestration contract
- Scope: `skills/herdr-orchestrator/SKILL.md`, `prompts/herdr-orchestrator.md`, `skills/orchestrator/SKILL.md`, `AGENTS.md.example`
- Excluded: protected agent definitions and runtime extensions; recover from `docs/architecture.md` and `extensions/agent-policy.ts`
- [x] Add a progressive-disclosure overlay with readiness, topology, role, model, provider-consent, lifecycle, coordination, one-writer, handoff, cleanup, and protected-path rules.
- [x] Add a thin explicit prompt alias that loads both skills and treats arguments as untrusted task data.
- [x] Make base `/orchestrator` load the overlay only when the request explicitly selected Herdr.

### W2: Public documentation and architecture
- Scope: `README.md`, `docs/architecture.md`
- Excluded: package version, lockfile, release publication; recover from `package.json` and `.pi/skills/pi-forge-release/`
- [x] Document optional exact adapter installation, CLI/runtime requirements, invocation, trust model, fallback, and protected exclusions.
- [x] Add the Herdr control-plane boundary to architecture without weakening the pi-subagents dependency contract.

### W3: Package and runtime discovery verification
- Scope: `scripts/check-package.mjs`, `scripts/check-runtime-resources.mjs`, `scripts/check-release.mjs`, `tests/orchestration.test.ts`, `tests/engineering-core.test.ts`
- Excluded: live Herdr server in CI and external adapter tests; recover from the adapter repository and Herdr docs
- [x] Require and discover the new prompt and skill in source and packed artifacts.
- [x] Add a prompt-expansion probe that aborts before model invocation and does not require Herdr.
- [x] Add contract tests for explicit opt-in, no silent fallback, lifecycle handling, one-writer behavior, provider disclosure, peer limits, and protected routing.
- [x] Preserve assertions for the exact pi-subagents pin and protected workflow.

### W4: Maintainer Behavior Map
- Scope: `.pi/skills/pi-forge-handbook/references/manifest.json`, `.pi/skills/pi-forge-handbook/references/fingerprints.json`, and behavior card only if current navigation changes
- Excluded: promotion of the two-workflow pilot; recover from `.pi/skills/pi-forge-handbook/SKILL.md`
- [x] Classify the new protected-policy-coupled skill and prompt surfaces.
- [x] Run structure before refresh, review affected mapped files and card, then explicitly refresh fingerprints and rerun freshness.

### W5: Final verification, protected review, and fixes
- Scope: final diff and plan progress
- Excluded: commit, push, release, and `/score`
- [x] Run the final command matrix after the last source edit.
- [x] Build a redacted artifact and route architecture, security, test, and DX review through protected fresh-context reviewers on the current parent model.
- [x] Apply parent-verified fix round 1 findings with the sole Herdr writer and update targeted contracts, probes, docs, and the living plan.
- [x] Run focused follow-up protected security review, verify and disposition every remaining Critical or Major against source/evidence, rerun affected gates, and update this plan.

### W6: Post-completion exact direct-Claude extension
- Scope: the Herdr skill and package-owned preflight script, public docs, working agreement, deterministic fixture and contract tests, package/runtime/release rosters, reviewed Behavior Map navigation, and this living plan
- Excluded: package dependencies, live model calls, generic provider abstraction, protected agents or routes, telemetry, Herdr runtime implementation, endpoint attestation, and writer-owned fingerprint refresh
- [x] Add exact Claude Code CLI-declared route readiness, per-launch disclosure and consent, two-model allowlist, closed read-only/writer argument contracts, failure handling, and protected-route exclusions.
- [x] Document separate Claude Code 2.1.226+ installation/authentication, both approved roles, local session persistence, trust boundaries, and no-fallback behavior.
- [x] Add static contract tests for exact models, kind, role args, denied aliases/models/flags, sanitized readiness, consent, lease, and protected boundaries without a live model call.
- [x] Run the W6 targeted tests and whitespace check without invoking Herdr, Pi, Claude, subagent, or agent CLIs.
- [x] Apply protected-review fix round 1: add the executable descriptor and fake-command adversarial fixtures, strengthen same-pane/proxy evidence, correct route claims, add copy-safe examples, and make exported policy constants the test source.
- [x] Add the script to package, packed-runtime, and release rosters and update Behavior Map navigation/classification for the new canonical locator and fixture test without refreshing fingerprints.
- [x] Parent reruns protected final review, reviews affected Behavior Map surfaces, explicitly refreshes fingerprints, reruns freshness, and makes the final W6 completion decision.

#### W6 acceptance additions
- [x] Pi remains default, and direct Claude cannot activate from installation, Herdr selection, or prior consent.
- [x] Only full IDs `claude-fable-5` and `claude-opus-5` are accepted for `kind: "claude"`; aliases, other models, fallback, and extra native args fail closed.
- [x] The package-owned script emits only one fixed error or ready descriptor, requires stable Claude Code 2.1.226+, CLI-declared `apiProvider: "firstParty"`, allowlisted auth tokens, all required flags, and no named routing or HTTP(S)/ALL proxy variables before source disclosure.
- [x] Every launch receives the exact CLI-declared route evidence and endpoint-attestation limitation, model/data/purpose/admin-policy/session-persistence disclosure, and fresh explicit consent.
- [x] Both the capability-read-only role and sole trusted-writer role have closed argument lists and retain existing trust, lifecycle, lease, handoff, and parent-verification boundaries.
- [x] Direct Claude remains generic trusted work and never replaces package-qualified or guarded Pi Forge paths.

### W7: Post-completion automatic Herdr pane retirement
- Scope: the Herdr orchestration skill, public README and architecture, working agreement, static orchestration/engineering contracts, and this living plan
- Excluded: Herdr runtime code, raw CLI, process cancellation, Claude preflight policy, protected agents/chains/extensions, dependencies, telemetry, Behavior Map navigation, and fingerprint refresh
- [x] Replace the no-automatic-cleanup rule with an invocation-local registry of exact created pane IDs, ownership, role/process, lease, lifecycle/result, follow-up, and preservation state.
- [x] Define evidence-backed eligibility for read-only agents, the retained writer, one-shot processes, and servers/watchers; exclude every active, uncertain, incomplete, preserved, foreign, or still-useful pane.
- [x] Define one exact structured close attempt, no raw keys/CLI, no close-to-stop or close-to-release, and one exact-ID read-only topology verification after ambiguous close.
- [x] Require early retirement of eligible helper/process panes, retention of the writer through review/fixes, one registry-only final pass, and concise residual reporting.
- [x] Document the default and preservation override, evidence-loss boundary, and distinction from process cancellation and protected policy.
- [x] Add static acceptance tests and run the approved targeted checks without invoking Herdr or any agent/provider CLI.
- [x] Apply accepted architecture/security Major fix round 1: extend canonical identity/custody records, permanently invalidate custody on move/alias/repurposing evidence, require adjacent exact pane/agent revalidation, replace pane-list inference, and disclose residual TOCTOU.
- [x] Parent performs focused W7 follow-up review, reviews affected Behavior Map surfaces, explicitly refreshes fingerprints, reruns freshness, and makes the final W7 completion decision.

#### W7 acceptance additions
- [x] The caller and foreign panes can never enter the cleanup target registry; focus, names, globs, broad lists, and workspace sweeps cannot select a target.
- [x] User preservation of all workflow panes or exact created IDs overrides automatic retirement.
- [x] `idle` and `done` never establish eligibility without complete captured and inspected role evidence.
- [x] Closing is attempted exactly once only after all role-specific conditions pass and never stops a process or releases a lease.
- [x] Registry identity includes expected current canonical ID, original ID/aliases, exact workspace/tab, expected agent name, role/foreground/cwd, and continuous exclusive custody.
- [x] Any observed or suspected move, alias/canonical change, rename, replacement, reuse, repurposing, external input, or unexpected foreground/cwd permanently disables automatic close.
- [x] Immediately adjacent pre-close `herdr_pane get` and, for agents, exact-name `herdr_agent get` must match every expected identity/state field; historical eligibility never suffices.
- [x] Ambiguous close is never retried and gets only one exact `herdr_pane get` on the pre-close canonical ID; workspace-list absence is never closure proof.
- [x] Revalidation narrows but does not eliminate TOCTOU; automatic close requires a trusted no-concurrent-local-mutation assumption and is disabled when stronger safety is needed.
- [x] Interactive context is discarded only after the parent owns the complete handoff/evidence; no transcript persistence is assumed.
- [x] Protected Pi Forge routes and the direct-Claude executable policy remain unchanged.

## Verification matrix

| # | Surface/path | Scenario | Expected evidence | Depth |
|---|---|---|---|---|
| 1 | `prompts/herdr-orchestrator.md` | explicit invocation with a goal or plan | expands with arguments, loads both skills, and remains untrusted task data | behavior+edge+error |
| 2 | `skills/herdr-orchestrator/SKILL.md` | not in Herdr or tools unavailable | stops, identifies prerequisite, offers normal orchestrator, no fallback claim | behavior+edge+error |
| 3 | same | generic read-only helper | sibling pane/current cwd/no focus, only read/grep/find/ls, bounded wait and result read | behavior+edge+error |
| 4 | base plus overlay | writer composition | ready Herdr may use one generic writer instead of software-engineer; protected work and non-Herdr behavior remain unchanged; parent edit lease stops | behavior+edge+error |
| 5 | overlay writer | trusted generic writer | explicit model and declared scope, Bash bypass disclosed and forbidden, no commit/push, complete handoff, parent re-verification | behavior+edge+error |
| 6 | overlay lifecycle | blocked or unknown lifecycle | read once, escalate decisions, never claim completion or restart destructively | behavior+edge+error |
| 7 | overlay retrieval | long alternate-screen output | bounded concise continuations recover complete evidence or an explicit gap; no capability expansion | edge+error |
| 8 | overlay coordination | peer coordination | named read-only peers, parent relay only, no recursive spawn, no active-writer prompt, parent artifact only from complete capture | behavior+edge+error |
| 9 | overlay process panes | ordinary command | preclassified read-only or mutating; mutating process holds sole writer lease until confirmed stopped | behavior+edge+error |
| 10 | overlay process panes | `herdr_pane run` returns transport/protocol/JSON error | no resend; one exact-pane marker inspection; command and transport statuses separated; inconclusive result remains unknown/open | edge+error |
| 11 | protected workflows | required writer/reviewer/panel launch | unchanged normal `subagent` or guarded tool path and existing tests remain green | behavior+edge+error |
| 12 | package artifact | positive and negative Pi RPC prompt expansion | Herdr prompt explicitly selects both skills; ordinary orchestrator and plain prompt text do not explicitly select Herdr; all abort before provider invocation and do not claim model compliance | behavior+edge+error |
| 13 | Behavior Map and release roster | changed mapped surfaces and packed members | structure and reviewed freshness pass without pilot expansion; new public resources remain mandatory tarball members | happy+error |
| 14 | whole repository | final state | `npm run test:e2e`, pinned upgrade probe, `git diff --check`, and clean index evidence | smoke |
| 15 | direct Claude readiness | CLI-declared intended-route preflight before source disclosure | exact sanitized schema, version floor, login/provider/method/subscription checks, required flags, named conflict booleans only, one-submit/no-retry, no live model call | behavior+edge+error |
| 16 | direct Claude launch | either exact allowed model in read-only or sole writer role | `kind: "claude"`, unique name, returned pane, exact closed args, fresh disclosure/consent, local persistence notice | behavior+edge+error |
| 17 | direct Claude denial paths | alias/other model/extra flag/fallback/auth/start/blocked/unknown/incomplete result | explicit gap with no retry, resume, alias, fallback, provider or transport switch | edge+error |
| 18 | protected and package boundaries | direct Claude alongside existing package | no dependency or live package-test call; direct session remains generic; protected identities and guarded routes unchanged | behavior+edge+error |
| 19 | `prepare-claude-launch.mjs` | approved Fable read-only and Opus writer inputs | exactly three captured shell-free no-model CLI calls and one sanitized descriptor with exact frozen-policy argv | behavior+edge |
| 20 | same executable | invalid input, version/help/auth/size/route/proxy failure | one enumerated fixed error, nonzero exit, no captured secret/identity/control/path output, zero retry; pre-spawn failures invoke nothing | edge+error |
| 21 | same-pane handoff | descriptor followed by consent and Herdr start | same unchanged recorded pane and exact descriptor args; no intervening command; CLI route evidence limitation disclosed; ambiguity stops without Pi fallback | behavior+edge+error |
| 22 | package and Behavior Map | packed/public structured source | script is a mandatory package/runtime/release member and mapped fingerprinted canonical locator; adversarial test is mapped; reviewed freshness passes | happy+error |
| 23 | pane ownership registry | workflow creates helpers/processes | original ID/aliases, expected current canonical ID, exact workspace/tab, agent name, role/foreground/cwd, lease/result/follow-up/preservation, and continuous custody; caller/foreign excluded | behavior+edge+error |
| 24 | agent retirement | read-only result or writer review/fix loop | read-only closes only after complete inspected evidence and no relay; writer remains until final handoff, released lease, captured evidence, and no follow-up | behavior+edge+error |
| 25 | process retirement | one-shot or server/watcher | marker/status/output/no-child/released-lease proof, or separately authorized stop plus confirmed termination; close never cancels or releases | behavior+edge+error |
| 26 | unsafe or ambiguous cleanup | custody loss, identity mismatch, concurrent risk, or close transport error | retain on any mismatch; pane/agent gets and close are adjacent; close runs once; ambiguous result gets one exact canonical `herdr_pane get`, never pane-list inference | edge+error |
| 27 | early and final retirement | helper completion, cancellation, or final handoff | eligible panes retire promptly only under continuous custody/trusted no-concurrency assumption; final registry pass reports residuals or `no workflow panes remain` | behavior+edge+error |

**Coverage:** 27/27 identified paths. Gaps: no automated live Herdr/close transcript or Claude session in CI, no generation/ownership-aware conditional close, unavoidable residual local TOCTOU, no cryptographic or independent endpoint attestation, no atomic preflight-to-Herdr-start binding, no support or binding proof for any other non-Pi agent/model, and no telemetry classification for Herdr child edits.

**Exhaustiveness rationale:** The paths are the union of activation, layout, role, lifecycle, coordination, process and pane retirement, protected boundary, package discovery, maintainer map, and release publication surfaces. State handling is parameterized by Herdr's five lifecycle states and role-specific evidence rather than combining every state with every role.

## Review plan
- Routed agents: `pi-forge.architecture-reviewer`, `pi-forge.security-reviewer`, `pi-forge.test-reviewer`, `pi-forge.dx-reviewer`.
- Review artifact: goal, locked decisions, complete changed-file roster, relevant full diff, baseline and final commands, packed discovery output, Behavior Map output, and explicit live-Herdr CI gap. No private paths, credentials, or unrelated source.
- Critical/Major evidence gate: parent reopens each cited file, reproduces contract/test failures where practical, and reruns every affected deterministic gate after fixes.

## Budget
- W1-W5 fix rounds: 3 total; their fix round 1 is consumed. W6 reopened with a separate 3-round budget; only W6 fix round 1 was consumed.
- W1-W5 delegated launches: one visible Herdr writer session, four initial protected reviewers, and one focused follow-up reviewer. The two read-only planning helpers are recorded separately.
- W6 delegation: the existing sole Herdr writer received one implementation turn and one fix turn; four initial and three focused follow-up protected reviewer launches completed. No concurrent writer was used.
- W7 delegation: the existing sole visible Herdr writer received one implementation turn and one fix-round turn; no concurrent writer was used. The parent retained that pane through focused follow-up, then closed it after exact pane/agent revalidation.
- W7 fix rounds: 3 available; fix round 1 is consumed.
- Writer concurrency: 1.
- Final evidence: `node --experimental-strip-types --test tests/orchestration.test.ts tests/engineering-core.test.ts tests/herdr-claude.test.ts`; `npm run check`; parent-owned `npm run check:behavior-map:freshness`; `npm run test:runtime`; `npm run test:e2e`; `npm run test:pi-subagents-upgrade -- 0.37.2 --force`; `npm pack --dry-run --json`; `git diff --check`; `git status --short --branch`.

## Risks and rollback
- Risk: Herdr is mistaken for a security boundary. Mitigation: explicit trusted-worker and non-sandbox language, protected roles unchanged.
- Risk: an active Herdr writer overlaps parent edits. Mitigation: one-writer stop rule and mandatory handoff before parent resumes changes.
- Risk: lifecycle status is mistaken for task completion. Mitigation: always read the result and require evidence; handle `unknown` conservatively.
- Risk: adapter or CLI drift. Mitigation: document exact reviewed adapter and minimum Herdr versions; installed binary remains syntax authority.
- Risk: command visibility implies automatic activation. Mitigation: explicit invocation only and no silent fallback.
- Risk: Herdr child edits are not represented by current parent telemetry/lifecycle counters. Mitigation: disclose the gap and keep telemetry changes out of this slice.
- Risk: a trusted generic writer can use `bash` to invoke installed CLIs or write outside declared paths. Mitigation: disclose that tool/path restrictions are not enforcement, forbid bypasses, and require an OS sandbox or protected path when trust is insufficient.
- Risk: a pane command may execute even when the adapter reports a transport/protocol/JSON error. Mitigation: never resend, inspect the recorded pane once for the unique marker, keep transport and command outcomes separate, and retain a mutating lease while stop state is unknown.
- Risk: Claude safe mode, permission modes, strict MCP selection, and tool lists do not remove admin-managed policy, current-user environment behavior, Bash bypass, or local session persistence. Mitigation: executable same-pane preflight, exact closed args, per-launch limitation disclosure/consent, trusted-worker-only scope, and OS isolation for untrusted work.
- Risk: raw Claude authentication JSON and command failures may contain identity or secret data. Mitigation: the package script captures bounded stdio, accepts only finite safe tokens, ignores identity fields, emits one fixed schema, and never prints raw output, values, paths, or exception details.
- Risk: CLI-declared `apiProvider: "firstParty"` is mistaken for endpoint proof. Mitigation: reject named route/proxy variables, preserve the same unchanged pane, disclose that evidence is neither cryptographic nor independently observed, and require an OS/network boundary when endpoint enforcement is necessary.
- Risk: a hostile/replaced executable or concurrent local mutation bypasses ordinary captured-output assumptions. Mitigation: keep this path trusted-only, stop on stale or ambiguous local state, and make no containment or atomic-binding claim.
- Risk: cleanup closes an active, foreign, preserved, or still-useful pane. Mitigation: invocation-local exact-ID registry, caller exclusion, no discovery by focus/name/glob/list, preservation overrides, role-specific evidence gates, and one close attempt only.
- Risk: closing an interactive pane discards evidence needed for review or fixes. Mitigation: require complete parent-captured handoff/evidence and finished follow-up, and retain the writer through the review/fix loop without assuming transcript persistence.
- Risk: pane closure is mistaken for process termination or lease release. Mitigation: require separate authorized stop and confirmed termination/release before eligibility; never close to stop work; ambiguous close remains a gap.
- Risk: a moved pane keeps its old ID as an alias, or an ID is replaced, reused, or repurposed before cleanup. Mitigation: continuous exclusive custody, permanent invalidation on any identity/external-change evidence, fresh exact canonical pane and agent revalidation, and never treating historical alias or workspace absence as ownership/closure proof.
- Risk: local mutation occurs after revalidation but before non-conditional close. Mitigation: adjacent same-turn calls with no unrelated tool/user round and trusted no-concurrent-mutation assumption; disable auto-close and retain/ask whenever concurrency is possible or stronger safety is required. This narrows but does not eliminate TOCTOU.
- Rollback: remove the additive prompt and skill, revert their documentation/discovery/test/map entries, and retain unchanged `/orchestrator` plus protected pi-subagents runtime. This describes recovery only and does not authorize a Git revert or release action.

## External side effects
- None. No commit, push, issue or PR mutation, worktree creation, deployment, publication, package installation, or release is authorized by this plan.
- Authorization status: source edits and local verification explicitly authorized; all listed external side effects not authorized.

## Progress
- [x] Analysis and draft plan
- [x] User approval (the 2026-08-10 in-session instruction explicitly requested this accepted hybrid be planned and then implemented through orchestrator)
- [x] Implementation (W1-W4)
- [x] Parent-verified fix round 1
- [x] Follow-up protected review and final W5 completion
- [x] W6 direct-Claude contract, docs, and initial static validation
- [x] W6 protected-review fix round 1 executable policy, adversarial fixtures, route-truth corrections, packaging, and map navigation
- [x] Parent protected final review, Behavior Map review, fingerprint refresh, freshness check, and final W6 completion
- [x] W7 automatic pane retirement contract, docs, and static validation
- [x] W7 protected-review fix round 1 canonical identity, custody, fresh revalidation, and ambiguity correction
- [x] Parent focused W7 follow-up, Behavior Map review, fingerprint refresh, freshness check, and final completion

## Surprises and discoveries
- 2026-08-10: Two Herdr planning agents completed independently in sibling panes. Their architectural disagreement exposed a useful scope choice: an additive explicit overlay is safer than changing generic subagent enforcement in the first slice.
- 2026-08-10: A visible `herdr_pane run` did execute `npm run test:e2e` successfully, but the locally installed adapter reported `Expected JSON output` for the CLI submission response. The pane output still proved completion. This external compatibility wrinkle reinforces using the adapter's structured tool contract conservatively and recording live integration as a residual gap rather than adding package-level runtime enforcement now.
- 2026-08-10: After the new canonical Behavior Map paths were classified, the required pre-refresh structure run reported only the expected `fingerprint-shape` mismatch. The pre-edit structure gate had passed; explicit refresh then produced 40 canonical fingerprints, and structure plus freshness passed with 43 discovered surfaces.
- 2026-08-10: The packed-runtime probe discovered `/herdr-orchestrator` and `skill:herdr-orchestrator`, expanded the prompt with both public skills, and aborted in `before_agent_start` with `modelInvocationRequested:false`; no Herdr server or adapter was needed for that probe.
- 2026-08-10: Reopening the protected-policy card and every named locator found no source contradiction. Protected definitions, launch enforcement, runtime pin, lifecycle identity, telemetry identity, and guarded workflows required no edits.
- 2026-08-10: Parent-verified review found an ownership ambiguity between the base protected writer wording and the overlay's generic writer, plus a missing writer lease for process panes. Fix round 1 makes the mode branch and shared lease explicit without changing protected runtime code.
- 2026-08-10: The observed adapter `Expected JSON output` failure means pane submission errors can be ambiguous rather than definitive non-execution. The overlay now records the pane, never resends, and separates one marker-based command observation from the transport failure.
- 2026-08-10: Fix-round Behavior Map review found no card or manifest navigation change. Post-edit structure passed with 43 surfaces, explicit refresh retained 40 canonical files, and freshness passed.
- 2026-08-10: Pi's `before_agent_start` skill metadata contains every discovered public skill, not only skills selected by the prompt. The negative probe therefore verifies prompt-level non-selection and explicitly does not claim model compliance or runtime tool choice.
- 2026-08-10: Initial protected review reported six Major findings and one Minor across architecture, security, test, and DX. Fix round 1 resolved writer composition, mutating-process leases, helper capabilities, peer mediation, ambiguous pane submission, and negative prompt probes. The transcript-simulator/live-Herdr request was dispositioned as an explicit gap because this slice owns only a skill and prompt. Focused fresh security follow-up reported no findings.
- 2026-08-10: Final post-fix evidence passed: 127/127 repository tests, packed prompt/skill discovery, positive and negative prompt probes without model invocation, pinned pi-subagents 0.37.2 compatibility, npm pack inclusion without `.pi`, Behavior Map structure/freshness, and whitespace checks.
- 2026-08-10: The user reopened the completed plan with a Hold Scope W6 that supplies verified Herdr 0.8.0 and Claude Code 2.1.226 syntax/auth evidence. W6 intentionally uses that evidence without invoking a provider or printing raw identity-bearing auth JSON.
- 2026-08-10: Existing Behavior Map navigation classified the initial W6 public skill, docs, and tests, while fingerprint refresh remained reserved for parent review.
- 2026-08-10: Protected architecture, security, and test review accepted one Major root cause: the readiness contract was prose-only, so no package code owned execution, redaction, or exact argv. W6 fix round 1 adds a dependency-free descriptor script and adversarial fake-command tests without a model call.
- 2026-08-10: The accepted bounded route finding distinguishes Claude Code's `apiProvider: "firstParty"` report from endpoint attestation. Same-pane sequencing and route/proxy rejection provide useful local evidence but not independent network proof or atomic Herdr binding.
- 2026-08-10: The new executable policy is a genuine source-of-truth navigation change. The protected-policy card and manifest now locate it and its fixture test; fingerprints remain intentionally untouched and stale for parent review.
- 2026-08-10: The accepted DX Minor adds copy-safe Fable read-only and Opus sole-writer requests. Each request still requires descriptor evidence, limitation disclosure, and fresh launch consent.
- 2026-08-10: Focused fresh architecture, security, and test follow-up reported no findings. The parent separately verified the executable and tests, then added the new canonical script to `fingerprintPaths`, which the first fix pass had omitted.
- 2026-08-10: After the required one-time fingerprint shape placeholder, explicit refresh produced 41 canonical fingerprints. Structure still passes with 43 discovered surfaces and freshness passes.
- 2026-08-10: The package-owned preflight ran against the installed Claude Code without a model call and returned `status: ready`, version 2.1.226, `apiProvider: firstParty`, no named route/proxy conflicts, and the exact Fable read-only descriptor. This remains CLI-declared route evidence, not endpoint attestation.
- 2026-08-10: Final W6 evidence passed with 180/180 repository tests, packed prompt/skill/script membership without `.pi` or a Claude dependency, pinned pi-subagents 0.37.2 compatibility, runtime prompt probes without provider invocation, fresh Behavior Map state, and clean whitespace.
- 2026-08-10: The user reopened the completed plan for W7 and approved automatic retirement as the default only for exact workflow-created panes whose role-specific usefulness and evidence gates are complete.
- 2026-08-10: Pre-W7 Behavior Map structure and freshness passed with 43 discovered surfaces and 41 canonical files. W7 changes only already mapped public prose/tests and does not change protected-policy source navigation, so manifest/card edits are not justified and post-edit fingerprints remain parent-owned.
- 2026-08-10: W7 explicitly treats close as terminal resource lifecycle rather than process stop, lease release, lifecycle success, protected policy, or transcript persistence. The current writer pane remains parent-retained through review/fix and was not closed during implementation.
- 2026-08-10: W7 targeted evidence passed with 70/70 tests, including unchanged direct-Claude fixtures and protected-route contracts; `npm run check` and whitespace validation also passed without invoking Herdr or any model/agent CLI.
- 2026-08-10: Initial W7 architecture/security review accepted one Major: historical registry eligibility could close a moved, repurposed, replaced, reused, or concurrently changed terminal because Herdr preserves old pane IDs as aliases and exposes no generation-aware conditional close.
- 2026-08-10: Fix round 1 requires continuous exclusive custody and fresh exact canonical `herdr_pane get`, plus exact-name `herdr_agent get` for agents, immediately adjacent to the sole close attempt. Any identity/custody mismatch or possible concurrency retains the pane.
- 2026-08-10: Workspace `pane_list` absence was removed as ambiguous-close evidence because a moved pane can leave that workspace while its old ID remains a live alias. Post-error verification now uses one exact `herdr_pane get` on the pre-close canonical ID and preserves ambiguity truthfully.
- 2026-08-10: Behavior Map navigation remains unchanged: the fix changes already mapped terminal-lifecycle prose/tests, not a protected identity, locator, canonical source, or runtime enforcement path. Fingerprints remain stale for parent review.
- 2026-08-10: W7 fix-round evidence passed with 70/70 targeted tests, including unchanged direct-Claude and protected-route contracts; `npm run check` passed with 43 discovered Behavior Map surfaces.
- 2026-08-10: Focused fresh architecture and security follow-up reported no findings and accepted the residual non-atomic close race as accurately bounded by the trusted no-concurrent-mutation eligibility gate.
- 2026-08-10: Parent review corrected one adapter-observability detail: `herdr_pane get` must match only canonical identity, workspace, and exposed occupant fields; a recorded tab remains audit-only when the structured result does not expose it.
- 2026-08-10: Reviewed fingerprint refresh retained 41 canonical files; Behavior Map structure and freshness pass. Final E2E and pinned-upgrade runs each passed all 181 tests, runtime prompt probes remained provider-free, and the package dry-run retained all required Herdr resources.
- 2026-08-10: The two obsolete helper panes were closed when W7 began. After final review and tests, the parent freshly revalidated exact pane `wF:p4` plus agent `pf-herdr-writer` as done, then closed it successfully. No workflow-created helper or writer pane remains open.

## Execution decisions
| # | Decision | Choice | Evidence/rationale | Revisit if |
|---|---|---|---|---|
| E1 | Approval interpretation | Proceed immediately after plan creation | The user explicitly asked for `/plan-forge` followed by orchestrator implementation of the already accepted hybrid, and no new external side effect is required. | A material product, provider, or security choice emerges outside the locked decisions. |
| E2 | W1-W4 writer allocation | Keep all source edits in the parent and launch zero agents | The implementation request makes the current parent the sole source writer and explicitly prohibits agents or subagents; the plan's launch budget is an upper bound, not permission to violate that instruction. | A later fix round is separately delegated with one-writer isolation. |
| E3 | Read-only helper handoff capability | Permit `write` only for a parent-named temporary Markdown path outside the repository | Source-read-only helpers still need the locked alternate-screen and substantial-artifact handoff path. The prompt and allowlist remain trusted workflow controls, not a sandbox. | The adapter supports per-path write capabilities or direct non-terminal result retrieval. |
| E4 | Behavior card maintenance | Classify and fingerprint the new coupled prompt and skill without changing the protected-policy card | Post-edit review showed that the card's source-of-truth navigation and protected contract did not change; the overlay is a coupled public surface only. | Protected identities, launch enforcement, or the card's navigation contract changes. |
| E5 | Supersedes E3 helper handoff capability | Keep read-only helpers capability-read-only with only read/grep/find/ls; use bounded concise continuations, and let only the parent persist a complete captured result | A helper `write` exception weakened the read-only contract and still was not path-enforced. Incomplete retrieval remains a disclosed gap rather than a reason to expand capabilities. | Pi provides a dedicated result channel with bounded complete transcript retrieval. |
| E6 | Supersedes direct peer capability in the initial overlay | Parent-mediated peer exchange only; no helper receives `herdr_agent` | The adapter tool is action-broad, so prose cannot limit it to one safe prompt action. Parent relay preserves bounded coordination and non-recursion. | Herdr exposes action-scoped, recipient-scoped peer messaging. |
| E7 | Process mutation ownership | Potentially mutating process panes acquire the same sole writer lease; uncertainty is mutating | Builds, generators, watchers, tests, and child processes may write even though they are presented as ordinary supervision. | A deterministic process contract proves checkout read-only behavior. |
| E8 | Trusted writer Bash disposition | Retain the approved generic writer but disclose that Bash can bypass visible tool and path instructions; forbid agent CLI invocation without claiming enforcement | This is an inherent residual of a trusted prose-only writer. Building a sandbox or command proxy is outside the approved slice. | The generic writer becomes suitable for untrusted work or runtime enforcement is authorized. |
| E9 | Runtime-test depth | Add positive and negative pre-provider prompt-expansion probes plus static contracts; do not add a transcript simulator or live Herdr CI | The package adds a prompt and skill, not an orchestration runtime or adapter dependency. Live integration remains an explicit gap. | Pi Forge imports or owns a Herdr runtime, or CI gains an approved live service fixture. |
| E10 | Deferred boundaries | Keep non-Pi model binding and Herdr-child telemetry classification out of scope | Both gaps were already explicit and fix round 1 supplies no reviewed runtime contract for either. | A separately approved plan defines exact binding or telemetry semantics. |
| E11 | Supersedes E2 writer allocation record | W1-W4 and fix round 1 were implemented by one visible Herdr Pi writer under a sole checkout lease; the parent inspected and then made one prompt-probe truthfulness correction after release | The prior E2 row was an inaccurate child-authored record. Herdr lifecycle and transcript evidence identify the writer, and the final diff plus checks were independently inspected by the parent. | Session evidence contradicts the recorded writer identity. |
| E12 | Negative probe semantics | Verify prompt-level explicit selection only; do not infer loaded-skill or model compliance from `before_agent_start.skills` | Live failure showed Pi supplies all discovered skill metadata in this hook. Prompt text is observable before provider invocation; model behavior is not. | Pi adds an authoritative selected-skill/runtime-call trace. |
| E13 | Review disposition | Fix actionable ownership, capability, lease, and ambiguous-submit findings; treat a full transcript simulator/live Herdr CI as a declared residual rather than an unresolved Major for this prompt-and-skill slice | The package owns no Herdr runtime or adapter dependency. Static contracts plus positive/negative pre-provider probes truthfully bound what is verified, and focused security follow-up found no reportable issue. | Pi Forge imports or implements the Herdr runtime. |
| E14 | W6 Hold Scope model boundary | Pi remains default; direct Claude supports only exact `claude-fable-5` and `claude-opus-5` through canonical `kind: "claude"`, for read-only or sole trusted-writer roles | This is the exact user-approved extension. Aliases, other models, fallback, and generic backend design remain excluded. | A separately approved extension names another exact model/provider contract. |
| E15 | W6 provider/readiness boundary | Require a fixed sanitized, checkout-read-only, one-submit probe showing Claude Code 2.1.226+, logged-in status that reports `apiProvider: "firstParty"`, required flags, and no named ambient third-party routing before source disclosure | Raw auth JSON carries identity risk, while provider/model ambiguity would invalidate consent. This original prose-only decision is superseded by E18 and its route claim is bounded by E19. | Claude Code offers an identity-free atomic provider/model attestation. |
| E16 | W6 consent/session boundary | Obtain exact per-launch disclosure consent and disclose local interactive-session persistence; prior installation, Herdr selection, or consent never carries forward | The intended route/model receives a separately bounded disclosure and may persist state under its own policy; E19 requires disclosure that the route evidence is CLI-declared rather than independently attested. | A user-approved standing policy explicitly replaces per-launch consent. |
| E17 | W6 package/test boundary | Add no dependency and perform static contract verification only; do not execute a live Claude model in package tests | Claude Code and Herdr remain separately installed external tools, and deterministic package CI must not require provider credentials or disclosure. | Pi Forge owns a reviewed direct-Claude runtime fixture. |
| E18 | Supersedes E15 and E17 implementation depth | Add one dependency-free executable descriptor and deterministic fake-`claude` fixtures; keep consent and lifecycle parent-owned | Protected review established that package-owned policy and captured redaction are executable in scope, while Herdr consent/lifecycle are not because the package owns no Herdr runtime. | Pi Forge adopts a reviewed Herdr runtime with enforceable consent/lifecycle hooks. |
| E19 | W6 local route evidence | Reject four Claude route selectors and uppercase/lowercase HTTP(S)/ALL proxies before spawn, then require the same unchanged pane and descriptor args | This strengthens current-environment evidence without claiming endpoint attestation or atomic binding. Any ambiguity stops and never falls back to Pi. | A reviewed network boundary independently attests and enforces the endpoint. |
| E20 | W6 Behavior Map navigation | Add `herdr-claude-launch-policy` plus the adversarial test to protected-policy navigation/classification and update the card; do not refresh fingerprints | The executable became the structured policy source, so navigation truly changed. Fingerprint refresh remains explicitly parent-owned. | Parent review finds the coupled classification or locator inaccurate. |
| E21 | W6 reviewed fingerprint completion | Add the executable policy to protected-policy `fingerprintPaths`, establish the new snapshot shape, then explicitly refresh after source/card review | A canonical locator without freshness coverage would leave future policy drift invisible. Structure and freshness now pass with 41 canonical files. | The Behavior Map pilot changes its canonical-input rules. |
| E22 | W7 cleanup ownership | Maintain an invocation-local exact-ID registry and automatically retire only entries created by this invocation; exclude caller, foreign, broadly discovered, and preserved panes | Ownership must be established at creation rather than inferred during cleanup. User preservation overrides the default. | Herdr supplies unforgeable per-invocation ownership attestations. |
| E23 | W7 eligibility | Base retirement on complete captured evidence, finished follow-up, confirmed process termination, and released leases, with distinct read-only, writer, one-shot, and server/watcher gates | `idle`, `done`, pane closure, and cancellation do not independently prove usefulness ended or work stopped. | Herdr exposes an atomic result/process/lease completion proof. |
| E24 | W7 close ambiguity | Use one structured exact-ID close call; never retry an ambiguous result; perform one read-only exact-ID topology verification and report uncertainty | Retrying can close an unintended reused target or obscure transport truth. Closing is not cancellation and lifecycle is not closure evidence. | Herdr returns an idempotent close token with authoritative outcome. |
| E25 | W7 Behavior Map disposition | Keep manifest/card navigation unchanged and leave fingerprints for parent review | W7 changes terminal lifecycle prose within already mapped skill/docs/tests and introduces no new source-of-truth file, locator, protected identity, or enforcement path. | Parent review finds a new canonical source or protected contract change. |
| E26 | W7 custody correction | Original IDs and aliases are audit history only; automatic close requires uninterrupted exclusive workflow custody of the expected current canonical pane identity | Herdr moves preserve historical aliases, while manual/external interaction, replacement, reuse, or repurposing destroys ownership confidence. Any suspicion permanently disables auto-close. | Herdr exposes immutable generation and ownership attestations. |
| E27 | W7 pre-close correction | Freshly revalidate canonical pane/workspace and every occupant field exposed by `herdr_pane get`, plus exact agent name/state, immediately adjacent to close; tab remains audit-only when unexposed | Historical eligibility cannot establish current target identity. Adjacent checks narrow but cannot remove TOCTOU because close is not conditional. | Herdr adds atomic compare-and-close semantics. |
| E28 | W7 ambiguous-close correction | Replace workspace pane-list absence with one exact `herdr_pane get` on the pre-close canonical ID; confirm only conclusive exact nonexistence | Moved panes can be absent from the old workspace while the historical ID remains an alias to a live terminal. Same/different/ambiguous resolution remains unresolved and is never closed again. | Herdr returns authoritative idempotent close outcomes. |
| E29 | W7 fix-round map disposition | Keep Behavior Map navigation unchanged and reserve fingerprint refresh for parent review | Fresh revalidation remains prose/test behavior in the existing mapped Herdr skill/docs. No new source or protected enforcement site was introduced. | Follow-up review finds navigation drift. |
| E30 | W7 completion and live cleanup | Accept the bounded non-atomic residual, refresh the unchanged 41-file canonical snapshot, and close the exact retained writer pane only after adjacent pane/agent revalidation | Focused architecture/security follow-up found no reportable issue; full gates passed; the exact close succeeded and no workflow helper/writer pane remains. | Herdr adds conditional close or live evidence contradicts the skill contract. |

## Outcomes and retrospective
Completed. W7 changes the default from retained panes to evidence-backed automatic retirement for exact workflow-created panes under continuous exclusive custody. Read-only helpers and finished one-shot processes retire promptly; the writer remains through protected review and accepted fixes. Every close requires complete evidence, released leases, no follow-up, fresh canonical `herdr_pane get`, exact-name `herdr_agent get` for agents, and one adjacent exact-ID close. Moves, aliases, replacement, reuse, repurposing, external interaction, unexpected occupant state, or ambiguity permanently disable automatic close. Post-error workspace-list inference is removed; only conclusive exact-pane nonexistence can confirm an ambiguous close, with no retry. Herdr lacks generation-aware conditional close, so a disclosed TOCTOU remains and automatic close is disabled whenever trusted no-concurrent-mutation custody cannot be affirmed. Initial architecture/security review found this identity defect; fix round 1 resolved and bounded it, and focused follow-up found no reportable issues. Final evidence passed 181/181 tests, runtime/package/upgrade probes, npm pack, Behavior Map structure/freshness with 41 canonical files, and whitespace checks. The obsolete helper panes and final writer pane were closed successfully; no workflow panes remain. Direct-Claude policy and protected Pi Forge routes remain unchanged. No commit, push, publication, or release occurred.
