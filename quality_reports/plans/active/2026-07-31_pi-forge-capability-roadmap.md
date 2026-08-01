# Close Pi Forge Onboarding, Release, and Harness Evolution Gaps

**Status:** completed
**Origin:** In-session Claude Forge parity review and Max's complete-roadmap selection
**Base:** `main` at `dff20c8c770eaeb158463c4b8448bf9052818ce0`
**Goal:** Add truthful project quality-gate onboarding, a fail-closed maintainer release workflow, and privacy-preserving cohort telemetry plus harness-change contracts, while keeping public and maintainer-only resources separate and preserving all existing Pi Forge safety boundaries.

## Analysis (verified 2026-07-31, do not re-derive without new evidence)

### Current behavior

- Pi Forge publishes every package skill below `skills/`, while `.pi/`, development `scripts/`, and `quality_reports/` are absent from the npm file allowlist (`package.json:18-29`, `package.json:54-56`). The runtime probe verifies a fixed seven-skill public roster from the packed artifact (`scripts/check-runtime-resources.mjs:120-159`, `scripts/check-runtime-resources.mjs:1039`).
- `/score` requires both literal top-level `check` and `test-e2e` Make targets (`extensions/score.ts:9-13`). Its parser rejects conditional, continued, escaped, generated, or otherwise ambiguous syntax (`extensions/score.ts:147-177`), and missing Makefiles or required targets remain inconclusive without running project code (`extensions/score.ts:362-377`). No current Pi Forge resource discovers or proposes those gates.
- The score parser currently lives inside the extension, so a project onboarding helper cannot reuse its exact policy without extracting a shared pure module (`extensions/score.ts:147-180`). Existing tests already exercise literal, escaped, conditional, continued-comment, missing, failing, signaled, and passing cases (`tests/score.test.ts:30-236`).
- Package checks enforce public metadata, the README install version, the pinned `pi-subagents` dependency, forbidden text, and generated resource equality (`scripts/check-package.mjs:100-160`). They do not verify that the package-lock root version equals `package.json`, and they do not model prepare, tag, publish, verify, or recovery release phases (`scripts/check-package.mjs:110-141`).
- GitHub CI runs package E2E on every push to `main` with read-only repository permissions (`.github/workflows/ci.yml:4-35`). A separate workflow runs the pinned or requested `pi-subagents` compatibility gate (`.github/workflows/pi-subagents-upgrade.yml:4-88`). Neither workflow publishes npm artifacts.
- The lifecycle extension confirms ordinary Git pushes and destructive Git mutations (`extensions/lifecycle.ts:159-185`). Its parser deliberately treats non-deleting `git tag` as non-mutating for guard purposes (`src/lifecycle-policy.js:136-168`), and it has no npm publication classifier. Therefore the current release safety boundary is instruction-level for local tag creation and npm publication.
- Pi auto-discovers trusted project extensions from `.pi/extensions/` and project skills from `.pi/skills/`; project-local extensions can block `tool_call` and require interactive confirmation. This is a supported Pi-native boundary rather than a package runtime change (`/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/docs/extensions.md:14-16`, `/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/docs/extensions.md:104-115`, `/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/docs/extensions.md:680-724`).
- Session telemetry derives one active-branch metric set with bucketed tool counts, errors, observed mutations, successful recognized verifications, subagent launches, compactions, tokens, and cost (`src/session-telemetry.js:15-34`, `src/session-telemetry.js:91-148`). It emits one-session schema-v1 events or one summary (`src/session-telemetry.js:174-252`).
- Aggregate metrics treat a completed protected writer call as an observed source mutation, but event traces currently mark only successful `write` and `edit` results as mutations (`src/session-telemetry.js:127-141`, `src/session-telemetry.js:232-243`). A final-mutation verification metric would therefore be unsound until these classifiers share one implementation and the semantic change is versioned.
- The extractor validates a single persisted Pi session, limits file and line sizes, and supports mode-0600 no-follow output with explicit overwrite (`skills/session-telemetry/scripts/extract-session-trace.mjs:11-15`, `skills/session-telemetry/scripts/extract-session-trace.mjs:45-143`). It has no multi-session cohort mode.
- The public privacy contract excludes prompts, responses, thinking, source, paths, commands, outputs, findings, session paths, environment data, secrets, and provider/model identities, and states that missing events prove only non-observation (`skills/session-telemetry/SKILL.md:37-54`, `docs/telemetry.md:21-31`). Any cohort feature must preserve that boundary.
- The maintainer Behavior Map remains a two-workflow pilot. It explicitly forbids mandatory promotion before at least three real planning uses and treats current source as authoritative (`.pi/skills/pi-forge-handbook/SKILL.md:15-35`, `docs/architecture.md:81-91`). `src/session-telemetry.js` is fingerprinted only because it consumes the protected writer identity, so changing it will stale the existing protected-agent card even though cohort telemetry remains outside the mapped workflow (`.pi/skills/pi-forge-handbook/references/manifest.json`, locator `telemetry-writer-input`).
- `docs/parity.md` lists implemented capabilities only. It does not distinguish intentional reuse, deferral, or not-applicable Claude Forge surfaces (`docs/parity.md:1-19`).
- Baseline evidence is green on the inspected commit: `npm run test:e2e` passed 78/78 tests plus packed-artifact discovery; `npm audit --omit=dev --audit-level=moderate` reported zero vulnerabilities; Behavior Map freshness passed for 34 canonical files; `git diff --check` passed; and the worktree was clean.
- The published release state is internally consistent: npm `latest` is `0.2.0`; remote annotated `v0.2.0` dereferences to the inspected commit; GitHub CI run `30613926410` and compatibility run `30613926424` both completed successfully for that commit. This is evidence that manual release succeeded, not evidence that the process is reproducible.

### Root cause or design gap

Pi Forge has strong execution and verification boundaries after a project already exposes its gates, but it lacks a truthful path for creating those gates, a deterministic state model for its own release, and a privacy-preserving outer loop that compares multiple sessions before proposing harness changes. These are three separate behavior gaps with one common cause: current workflows stop at local single-run evidence and rely on the parent to reconstruct setup, release sequencing, or cross-session patterns. The fix must add deterministic observation and fail-closed guidance without fabricating quality, collapsing external side-effect authorization, exposing telemetry content, or allowing automatic harness mutation.

### Scope

- In:
  - one public `project-checks` skill, prompt alias, read-only inspector, and shared literal-Make policy;
  - JavaScript/TypeScript, Python, Go, Ruby, and Rust marker support, plus an explicit unsupported result for other ecosystems or build systems;
  - one maintainer-only release skill, source-only non-publishing phased preflight helper, and project-local ordinary-command guard for tag creation and npm publication;
  - release recovery and reconciliation for uncertain or bad publication states;
  - schema-v2 single-session telemetry with aligned writer-mutation semantics;
  - one public explicit-input cohort aggregator with internal duplicate rejection and minimum cohort privacy floor;
  - one maintainer-only harness-audit skill and change-contract template;
  - package/source discovery, documentation, parity classification, and focused tests.
- Out:
  - automatic Makefile, CI, AGENTS.md, Git, tag, registry, or harness mutation;
  - generated green E2E placeholders, unit-test relabelling, or assumed third-party tools;
  - package-manager publication guards beyond ordinary Pi Forge `git tag` creation and `npm publish` Bash-tool calls in the trusted source repository;
  - session directory discovery, glob expansion inside the aggregator, semantic task classification, raw or per-session telemetry rows, stable session identifiers, hashes exposed in output, or provider transmission;
  - Behavior Map expansion or mandatory planning integration;
  - package version bump, commit, push, tag, npm publication, branch change, PR/issue mutation, deployment, or release execution.
- Recover excluded context from:
  - `extensions/score.ts` and `docs/architecture.md` for score and package boundaries;
  - `skills/source-control/SKILL.md` for commit and push authorization;
  - `docs/telemetry.md` for the telemetry privacy contract;
  - `.pi/skills/pi-forge-handbook/` for the two mapped workflows only;
  - a future plan if real use demonstrates the need for CI rewriting, additional ecosystems, public release tooling, richer telemetry, or Behavior Map promotion.

### Candidate approaches

| Approach | Decision | Evidence and trade-off |
|---|---|---|
| One generic bootstrap that writes Makefile, CI, and AGENTS.md | rejected | It combines unrelated project policy, risks overwriting conventions, and makes rollback ambiguous. `/score` needs only truthful root targets. |
| Public read-only project inspector plus parent-reviewed edits | chosen | Deterministic discovery can share the exact score parser while the parent preserves context, presents a diff, and never executes discovered commands during inspection. |
| Generate conventional language commands unconditionally | rejected | Tool availability and project conventions are not established by a language marker. Conventional candidates may be reported but cannot become observed evidence. |
| Add a failing `test-e2e` placeholder when no E2E exists | rejected by default | Missing evidence should remain inconclusive. A failing placeholder changes readiness from unknown to definite failure without adding a real user-flow test. |
| Rewrite or overwrite existing Make targets | rejected | Existing targets are project-owned behavior. Any existing required target, duplicate definition, or unsupported Make syntax freezes automatic proposal for that target. |
| Public generic release skill | rejected for this phase | Pi Forge's exact npm, GitHub workflow, package roster, and version rules are maintainer-specific. Packaging them for every consumer would add irrelevant metadata and unsafe assumptions. |
| Project-only release skill and non-publishing phased helper | chosen | `.pi/` and root scripts are excluded from npm, while trusted project discovery is already tested. The helper may run the repository's fixed verification commands and read remote state, but it never mutates Git or the registry. |
| Instruction-only publication protection | rejected | The current lifecycle does not classify ordinary tag creation or npm publication. A small project-local extension adds defense in depth without widening public package policy. |
| Preflight receipt that cryptographically authorizes publication | rejected for initial implementation | It adds state, expiration, replay, and branch semantics while still not creating atomicity with npm. The guard confirms the exact ordinary command; the helper is rerun immediately before each authorized phase. |
| Automatic release command | rejected | Tag creation, tag push, and npm publication have separate failure and recovery states and require separate authorization. |
| Enrich telemetry with paths, commands, workflow names, or findings | rejected | It would weaken the established privacy contract and still would not prove causality. |
| Emit cohort output for fewer than five sessions | rejected | Small aggregates can approximate per-session rows. Existing single-session extraction remains available for local diagnostics. |
| Expose salted or hashed session identifiers for deduplication | rejected | Deduplication can use session header IDs internally without creating a stable output identifier. |
| Keep trace schema v1 while changing writer-mutation meaning | rejected | Final-mutation verification would silently change semantics. Single-session trace and runtime snapshot schemas move to v2 explicitly. |
| Automatic harness optimization | rejected | Aggregate symptoms cannot authorize or identify a safe source mutation. A change contract creates a falsifiable proposal and preserves normal planning and review. |
| Three unrelated ExecPlans | rejected for this request | Max selected the complete roadmap. One plan keeps shared package/privacy decisions visible, but mandatory verification checkpoints preserve independent rollback and stop conditions. |

### Independent opinion

Expert Panel run `0b918e95-afad-44d5-96a4-ed010c88fa2e` was launched after exact-payload disclosure and consent to the fixed four providers. It failed in the critic stage because one critic submitted an invalid structured-output enum. Three of four critic calls completed, but the synthesizer did not run. No final panel synthesis or verdict is accepted, and the run was not retried.

Reduced-confidence areas are release guard sufficiency, small-cohort privacy, telemetry schema migration, and whole-roadmap review load. Partial critic text is not treated as an independent synthesis. The parent independently resolved the concrete issues against current source by:

- defining non-overwriting Makefile semantics and unsupported-build-system behavior;
- keeping missing E2E evidence inconclusive rather than generating a placeholder;
- adding a project-only ordinary-command guard for local tag creation and npm publication;
- adding release reconcile and bad-version recovery states;
- making telemetry classifier alignment a prerequisite and versioning the semantic change as v2;
- rejecting duplicate sessions internally and refusing cohort output below five distinct sessions;
- retaining one plan but requiring a green checkpoint after each major capability.

A final independent architecture, security, test, and DX review remains mandatory after implementation.

## Locked decisions

Append only. Reverse a decision with a new row that names the superseded row.

| # | Decision | Choice | Evidence/rationale | Revisit if |
|---|---|---|---|---|
| 1 | Delivery shape | One ExecPlan with three mandatory capability gates and focused prerequisite sub-checks | Max selected the complete roadmap; each capability has a separate rollback boundary and may stop independently. | A gate exposes a shared design contradiction or context limits prevent reliable review. |
| 2 | Public onboarding boundary | Package `project-checks` skill, thin prompt alias, shared policy, and read-only inspector | This directly closes `/score` onboarding without rewriting broader project policy. | Users need a non-Make score backend or repeated evidence supports CI/AGENTS generation. |
| 3 | Inspector execution | Read fixed project metadata only; never run discovered commands or edit files | Project metadata is untrusted and command presence is not execution authorization. | Never for untrusted inspection; only a separately consented verification phase may run project code. |
| 4 | Make policy ownership | Extract literal-target inspection into `src/makefile-policy.js` and reuse it from `/score` and `project-checks` | One parser prevents generated suggestions from disagreeing with the scoring gate. | A formal Make parser replaces the conservative literal contract. |
| 5 | Existing Makefile semantics | Never replace existing targets; freeze proposal for required targets on duplicates or unsupported syntax; append only reviewed missing targets | Make supports complex and merged rules that are unsafe to rewrite mechanically. | A structural editor proves safe on the exact supported subset. |
| 6 | Candidate evidence | Label each command `observed`, `conventional`, or `unresolved`; only observed project-owned commands may be proposed directly | Language markers do not prove tool installation or project intent. | Runtime probing is separately authorized and sandboxed. |
| 7 | Missing E2E | Leave `test-e2e` absent and `/score` inconclusive; do not generate a failing or green placeholder | Truthful unknown evidence is better than a fabricated pass or failure. | Pi Forge adopts a separate unit-only score profile. |
| 8 | Unsupported ecosystems | Return a stable unsupported result and inspect no arbitrary build files | Bazel, Buck, JVM, Swift, .NET, PHP, and custom runners need dedicated evidence before support. | A focused follow-up adds fixtures and conventions for one ecosystem. |
| 9 | Release boundary | Maintainer-only `.pi/skills/pi-forge-release/` plus source-only non-publishing helper | Release rules are exact to Pi Forge and should remain absent from npm metadata. The trusted helper may run fixed local verification and remote read commands, but no Git or registry mutation. | The workflow proves generally reusable without package-specific assumptions. |
| 10 | Release phases | `prepare`, `tag`, `publish`, `verify`, and `reconcile`; each returns pass, fail, or indeterminate | Network absence is not a negative state, and uncertain side effects require authoritative inspection. | A registry API provides stronger transactional semantics. |
| 11 | Release guard | Project-local extension confirms ordinary local tag creation and `npm publish`; headless mode blocks them | This closes the direct Pi Bash-tool bypass without widening package lifecycle policy. It is defense in depth, not a parser or security sandbox. | Bypass evidence justifies stronger state binding or broader command coverage. |
| 12 | Release authorization | Local tag creation, tag push, and npm publication remain three separate explicit user authorizations | They have different reversibility and unknown-state recovery. | Never collapse irreversible remote effects into one implicit permission. |
| 13 | Registry race | Recheck version absence immediately before publish; if npm reports conflict or state is unknown, stop and reconcile, never retry blindly | npm versions are immutable; a concurrent publisher causes failure rather than overwrite, but state must still be inspected. | npm semantics or package ownership model changes. |
| 14 | Bad release recovery | Prefer dist-tag correction, deprecation, and a fixed patch release; never automate unpublish or tag recreation | Recovery must preserve provenance and npm policy constraints. | A specific incident requires a human-approved exception. |
| 15 | Telemetry schema | Move runtime snapshots and event traces to v2 before adding cohort metrics | Protected-writer mutation meaning changes and must not silently reuse v1 semantics. | The implementation can add the metric without changing any existing field meaning, which current source disproves. |
| 16 | Mutation classification | One pure classifier drives aggregate and event-trace mutation semantics | Final-mutation verification must use the same observed event definition as summary metrics. | Pi exposes a canonical mutation event. |
| 17 | Cohort input | Require 5 to 100 explicit regular session files, reject duplicate session header IDs and duplicate filesystem identities internally | The floor limits small-sample disclosure and anecdotal claims; the cap bounds resource use. No identifier is emitted. | Measured use needs a different bound with a reviewed privacy argument. |
| 18 | Cohort output | Aggregate totals, medians, session counts/rates, and warnings only; no per-session rows, extrema, timestamps, IDs, paths, or hashes | These fields support comparison while limiting reconstruction and preserving the current exclusion contract. | A concrete evaluation cannot be falsified without one additional sanitized field. |
| 19 | Comparability | Cohort semantic comparability is an operator assertion, not inferred from session content | Content-free telemetry cannot identify task type or skill use reliably. | An explicit privacy-preserving cohort label is supplied by the user outside session data. |
| 20 | Harness change unit | One change contract per proposed harness mutation, with one primary failure hypothesis | Bundling changes prevents falsification and rollback attribution. | Two edits are mechanically inseparable and the contract explains why. |
| 21 | Harness promotion | No automatic edit or promotion; accepted proposals re-enter `plan-forge` or an approved orchestrator plan | Aggregate telemetry is evidence for a hypothesis, not source authority or authorization. | Never for safety-critical harness code. |
| 22 | Behavior Map | Do not expand or mandate it; directly verify stale mapped source, review affected cards, then explicitly refresh fingerprints | The pilot's existing three-use promotion gate remains binding. | Three documented uses support a separate promotion plan. |
| 23 | Package version | Keep `0.2.0` during implementation; a later authorized release uses the new workflow | Source implementation and package publication are separate side effects. | Max separately authorizes release preparation. |
| 24 | External side effects | No commit, push, tag, publication, branch change, PR/issue mutation, or deployment in this plan's implementation authority | The requested implementation does not imply Git or remote authorization. | Max explicitly authorizes one exact side effect. |

## Acceptance criteria

### Public project checks

- [x] Pi discovers `/project-checks` as a package prompt and `skill:project-checks` as a package skill from the packed npm artifact without invoking a model.
- [x] The inspector and `/score` import the same literal Make target policy, and existing score behavior remains unchanged for all current fixtures.
- [x] The inspector reads only fixed, size-bounded, regular metadata files below the explicit project root and never executes commands, follows symlinks outside the root, scans arbitrary directories, or writes files.
- [x] JavaScript/TypeScript, Python, Go, Ruby, and Rust fixtures produce deterministic ecosystem and command-evidence classifications; unsupported and mixed-build-system fixtures return explicit unresolved results.
- [x] Ambiguous package-manager locks, malformed metadata, duplicate required Make target definitions, and unsupported Make syntax fail closed without a suggested edit.
- [x] Existing `check` or `test-e2e` definitions are never replaced or copied into generated output.
- [x] A missing real E2E command leaves `test-e2e` unresolved and documents that `/score` remains inconclusive; no fixture can produce `true`, a duplicate `check`, or unit-test relabelling as E2E.
- [x] The skill requires a user-visible diff before a parent edits an existing Makefile and requires fresh verification after the edit.

### Maintainer release workflow

- [x] Pi discovers `skill:pi-forge-release` only from the trusted source checkout; npm pack contains neither it nor the release guard/helper.
- [x] The helper accepts only a strict stable `MAJOR.MINOR.PATCH` version and one known phase, returns machine-readable pass/fail/indeterminate checks, and never invokes a Git or registry mutation. It may run only the fixed, documented Pi Forge verification commands and temporary-artifact probes required by that phase.
- [x] `prepare` detects package, package-lock top-level/root, README install, tag, and registry version inconsistencies, including a lock root version drift that current checks miss.
- [x] `tag` requires clean exact `main == origin/main`, both required GitHub workflows green for the exact HEAD, fresh E2E/runtime/upgrade/audit results run by the preflight, matching version surfaces, and absent local/remote tags.
- [x] `publish` requires annotated local and remote tags dereferencing to exact HEAD, registry version absence rechecked immediately before the command, and exact dry-run pack identity and roster.
- [x] `verify` checks the registry version, `latest` dist-tag, remote tag dereference, tarball roster/integrity, and isolated package discovery.
- [x] `reconcile` distinguishes local-only tag, remote-only tag, registry-only publication, changed dist-tag, network unavailability, and fully consistent states without mutating any state.
- [x] Network, auth, timeout, malformed JSON, missing CLI, red CI, and uncertain command results are indeterminate or failing gates, never passes.
- [x] The trusted project extension confirms one ordinary local tag-creation or `npm publish` Bash-tool call interactively and blocks in headless mode; read-only tag/npm commands and quoted prose are not blocked.
- [x] The skill documents recovery after a bad publication: inspect first, do not retry or recreate tags, prefer explicit dist-tag rollback, deprecation, and corrected patch release, and never automate unpublish.

### Cohort telemetry and harness audit

- [x] Runtime snapshot and extracted trace schema v2 align direct edit/write and protected writer mutation events through one classifier, while extraction from historical Pi session v2/v3 files remains supported.
- [x] The cohort aggregator accepts only explicit regular input files and rejects directories, symbolic links, malformed sessions, duplicate filesystem identities, duplicate session header IDs, fewer than five or more than 100 sessions, and cumulative input above the documented bound.
- [x] No cohort output contains prompt/response/thinking/summary text, source, paths, commands, arguments, output, findings, session IDs or hashes, timestamps, environment data, secrets, or provider/model identities.
- [x] Cohort output contains only the locked totals, medians, session rates/counts, schema/version fields, and observation-limit warnings; it contains no per-session rows or extrema.
- [x] `verificationAfterFinalMutation` is true only when a successful recognized verification occurs after the final observed direct or protected-writer mutation in that session; sessions without observed mutations are excluded from its denominator.
- [x] Safe output preserves no-follow, no-overwrite-by-default, mode-0600, single-link, and input/output identity protections across all input files.
- [x] `skill:pi-forge-harness-audit` is source-only and requires a valid cohort artifact with at least five sessions, an explicit comparability assertion, observations separated from hypotheses, and one mutation per change contract.
- [x] The change-contract template requires baseline cohort, primary hypothesis, proposed mutation, predicted effect, protected invariants, evidence gaps, measurement protocol, falsification threshold, post-change cohort, rollback, approval, and result.
- [x] Harness audit never reads raw session files by default, claims causal attribution, edits source, refreshes the Behavior Map, or sends telemetry to another provider.

### Integrated repository

- [x] README and architecture docs explain public versus project-only surfaces, truthful score onboarding, release state/recovery, cohort privacy, and explicit side-effect boundaries.
- [x] `docs/parity.md` identifies implemented, reused, deferred, and not-applicable capabilities instead of implying complete file parity.
- [x] Runtime/package checks require every new resource, discover public and project-only skills in the correct scope, prove the project release resources stay out of npm, and report the updated public roster.
- [x] The protected-agent Behavior Map card is source-verified after telemetry changes; any necessary navigation update is reviewed, and fingerprints are refreshed explicitly only after source/card review.
- [x] `npm run test:e2e`, `npm run test:pi-subagents-upgrade -- 0.37.2 --force`, `npm audit --omit=dev --audit-level=moderate`, `npm run check:behavior-map:freshness`, and `git diff --check` pass after the final edit.
- [x] Independent architecture, security, test, and DX review has no unresolved Critical or Major finding, and every such finding is verified by the parent before fixing.

## Workstreams

### W1: Share the literal Make policy and build the read-only inspector

- Scope:
  - `src/makefile-policy.js`
  - `extensions/score.ts`
  - `skills/project-checks/scripts/inspect-project-checks.mjs`
  - `tests/score.test.ts`
  - `tests/project-checks.test.ts`
- Excluded: Makefile mutation, CI execution, dependency installation, arbitrary recursive project scan.
- [x] Move literal target inspection without semantic change and preserve exports used by current tests.
- [x] Extend inspection results with duplicate required-target detection without accepting more Make syntax than `/score` currently accepts.
- [x] Define a strict inspector CLI and JSON schema with stable observed, conventional, unresolved, unsupported, and malformed states.
- [x] Read only fixed regular root metadata and known lock markers with containment and size checks.
- [x] Detect the five locked ecosystems, package-manager conflicts, existing score target state, and evidence-backed command candidates.
- [x] Keep conventional candidates distinct from observed project commands and never emit an executable Makefile.

**Checkpoint A1:** run focused score and project-check fixtures. Stop if the shared parser changes any current `/score` verdict or if a fixture can fabricate E2E evidence.

### W2: Package the project-checks workflow

- Scope:
  - `skills/project-checks/SKILL.md`
  - `skills/project-checks/references/detection-contract.md`
  - `prompts/project-checks.md`
  - `scripts/check-package.mjs`
  - `scripts/check-runtime-resources.mjs`
  - `tests/engineering-core.test.ts`
  - `README.md`
  - `docs/architecture.md`
- Excluded: public extension command, score profile change, package version bump.
- [x] Define the prompt as a thin alias that loads the skill and treats project metadata as untrusted data.
- [x] Require inspection, explicit unresolved reporting, user-visible diff, minimal append-only edits, and post-edit verification.
- [x] Document unit-only projects as valid but score-inconclusive when no truthful E2E gate exists.
- [x] Add packed-artifact discovery and resource-roster checks for the new public skill, prompt, script, reference, and shared source.

**Checkpoint A2:** run the focused tests plus `npm run test:runtime`. Stop if the skill is not package-origin, any maintainer-only resource enters npm, or the old public roster contracts drift unexpectedly.

### W3: Add the maintainer release state machine and ordinary-command guard

- Scope:
  - `.pi/skills/pi-forge-release/SKILL.md`
  - `.pi/skills/pi-forge-release/references/recovery.md`
  - `.pi/extensions/pi-forge-release-guard.ts`
  - `scripts/check-release.mjs`
  - `scripts/lib/release-policy.mjs`
  - `tests/release-workflow.test.ts`
  - `scripts/check-package.mjs`
  - `scripts/check-runtime-resources.mjs`
  - `tests/engineering-core.test.ts`
  - `README.md`
  - `docs/architecture.md`
- Excluded: npm publication, tag creation, tag push, automatic commit, public lifecycle changes, release receipt state.
- [x] Implement strict argument parsing and pure phase validation with injected command results for deterministic tests.
- [x] Execute only documented read-only Git/GitHub/registry queries, pack or isolated-temp probes, and the fixed Pi Forge E2E, pinned-upgrade, and audit commands required by the phase; classify command absence, auth, network, timeout, malformed output, and nonzero results without guessing.
- [x] Check exact package/lock/README version agreement and add the missing package-lock root version invariant to package checks.
- [x] Require both named GitHub workflows green for exact HEAD, not merely the latest branch run.
- [x] Define `reconcile` state combinations and recovery guidance, including registry conflicts and bad releases.
- [x] Add a trusted project extension that narrowly recognizes ordinary Bash-tool local tag creation and npm publish, confirms in UI, and blocks headless. Document parser and user-shell limitations.
- [x] Prove project-only discovery and npm exclusion.

**Checkpoint B:** run release fixtures, package checks, project-resource discovery, and packed-artifact exclusion. Stop if the helper can call a mutating command, the guard blocks read-only commands, or any phase treats unavailable remote evidence as green.

### W4: Version and align telemetry event semantics

- Scope:
  - `src/session-telemetry.js`
  - `extensions/telemetry.ts`
  - `skills/session-telemetry/scripts/extract-session-trace.mjs`
  - `tests/telemetry.test.ts`
  - `docs/telemetry.md`
- Excluded: cohort aggregation until schema-v2 fixtures pass.
- [x] Refactor one pure tool-result classifier for errors, source mutations, protected writer mutations, and successful recognized verification.
- [x] Emit schema-v2 runtime snapshots and event traces with explicit documentation of the v1 semantic change.
- [x] Preserve historical raw Pi session v2/v3 input compatibility and all exclusion tests.
- [x] Add ordered fixtures proving final mutation and later verification behavior for edit/write, protected writer success, launched-writer error, failed verification, no mutation, and abandoned branches.

**Checkpoint C1:** run telemetry and lifecycle tests. Stop if v2 emits any excluded field or direct/protected writer classifiers disagree.

### W5: Add cohort aggregation and the harness-audit contract

- Scope:
  - `skills/session-telemetry/scripts/aggregate-session-traces.mjs`
  - `skills/session-telemetry/SKILL.md`
  - `.pi/skills/pi-forge-harness-audit/SKILL.md`
  - `.pi/skills/pi-forge-harness-audit/references/change-contract-template.md`
  - `tests/telemetry.test.ts`
  - `tests/engineering-core.test.ts`
  - `scripts/check-package.mjs`
  - `scripts/check-runtime-resources.mjs`
  - `README.md`
  - `docs/telemetry.md`
  - `docs/architecture.md`
- Excluded: raw-session model review, automatic session discovery, semantic cohort classification, source mutation.
- [x] Parse repeated explicit inputs, enforce 5 to 100 distinct sessions and cumulative size, and deduplicate internally by filesystem identity and header ID without emitting either.
- [x] Reuse the hardened single-session reader and safe output path logic rather than creating weaker duplicate code.
- [x] Compute locked aggregate totals, medians, session counts/rates, and final-mutation verification from schema-v2 events.
- [x] Add secret-rich fixtures and assert the complete exclusion vocabulary over stdout, safe files, errors, and runtime custom entries.
- [x] Define the audit workflow, comparability assertion, insufficient-evidence behavior, change-contract fields, evaluation cohort, approval, and rollback.
- [x] Prove source-only skill discovery and npm exclusion.

**Checkpoint C2:** run telemetry, project discovery, and pack tests. Stop if fewer than five sessions produce a cohort, duplicate inputs count twice, any output exposes identifiers/content, or the audit skill can be interpreted as edit authorization.

### W6: Integrate documentation, parity status, Behavior Map review, and final evidence

- Scope:
  - `docs/parity.md`
  - all documentation already named above
  - `.pi/skills/pi-forge-handbook/references/behaviors/protected-agent-policy.md` only if navigation changed
  - `.pi/skills/pi-forge-handbook/references/fingerprints.json` after explicit source/card review
- Excluded: new Behavior Map workflows/registers, package release metadata, Git side effects.
- [x] Reclassify parity rows as implemented, reused, deferred, or not applicable, and add the three implemented capabilities only after their checkpoints pass.
- [x] Reopen the protected-agent telemetry locator, verify the current declaration and behavior card, and update prose only if navigation or contract changed.
- [x] Run structural check before explicit fingerprint refresh, refresh only after review, then rerun structure and freshness.
- [x] Build the final redacted review artifact and complete routed independent review.
- [x] Fix verified blockers within budget and rerun all affected and final commands after the last edit.

## Verification matrix

| # | Surface/path | Scenario | Expected evidence | Depth |
|---|---|---|---|---|
| 1 | `src/makefile-policy.js` | Current valid literal fixtures | Exact existing `/score` target sets and verdicts remain unchanged | behavior+edge+error |
| 2 | shared Make policy | Conditional, continuation, escaped, whitespace, dynamic, and duplicate required target rules | Stable unsupported or duplicate result, never a safe-edit proposal | behavior+edge+error |
| 3 | project inspector | One fixture for each of five ecosystems | Correct markers and evidence labels without command execution | behavior+edge+error |
| 4 | project inspector | Mixed ecosystems and conflicting JS lockfiles | Deterministic combined result or explicit ambiguity | behavior+edge+error |
| 5 | project inspector | Malformed, oversized, symlinked, and escaping metadata | Rejected before outside-root read or proposal | behavior+edge+error |
| 6 | project inspector | Real E2E script present versus unit-only project | Observed E2E candidate only in first case; unresolved in second | behavior+edge+error |
| 7 | existing Makefile | Existing one/both targets, duplicate definitions, unsupported syntax | Never overwrite; append proposal only for a uniquely missing target in supported syntax | behavior+edge+error |
| 8 | packed package | Public project-checks prompt/skill/helper/reference | Package-origin discovery and exact required roster | behavior+edge+error |
| 9 | npm package | Project release/audit skills and release guard | No `.pi/` path in pack output | behavior+edge+error |
| 10 | release parser | Missing, extra, prerelease, malformed, and valid stable version arguments | Only exact stable version and known phase accepted | behavior+edge+error |
| 11 | release `prepare` | Package/lock/README drift and version already present | Failing checks with no mutation command | behavior+edge+error |
| 12 | release `tag` | Dirty tree, wrong branch, ahead/behind/diverged upstream, red or missing exact-head CI | Gate fails or is indeterminate; no tag command | behavior+edge+error |
| 13 | release `publish` | Tag type/target mismatch, registry race, dry-run pack drift | Gate blocks and directs reconcile | behavior+edge+error |
| 14 | release `verify` | Correct and incorrect remote tag, dist-tag, registry, integrity, and discovery | Exact state report with no corrective mutation | behavior+edge+error |
| 15 | release `reconcile` | Local-only, remote-only, registry-only, dist-tag drift, network unavailable, all-consistent | Stable state classification and recovery path | behavior+edge+error |
| 16 | release project guard | Ordinary tag create, npm publish, read-only commands, quoted prose, headless mode | Confirm risky calls, allow reads/prose, block risky headless calls | behavior+edge+error |
| 17 | telemetry v2 | Direct edit/write and protected writer results | Both produce ordered mutation events from one classifier | behavior+edge+error |
| 18 | telemetry v2 | Historical Pi v2/v3 sessions and active/abandoned branches | Existing extraction compatibility and active-branch-only semantics | behavior+edge+error |
| 19 | cohort inputs | 4, 5, 100, and 101 valid sessions | Reject below/above bound; accept boundaries | behavior+edge+error |
| 20 | cohort dedup | Same path, symlink/hardlink alias, copied session with same header ID | Duplicate rejected without emitting ID | behavior+edge+error |
| 21 | cohort resources | Oversized line/file/cumulative bytes, malformed JSON/tree | Bounded deterministic failure | behavior+edge+error |
| 22 | final verification metric | Verification before and after final direct/protected mutation, failed verification, no mutation | Correct numerator and eligible denominator | behavior+edge+error |
| 23 | cohort privacy | Secret-rich prompts, paths, commands, findings, models, session IDs, timestamps | None appears in JSON, errors, or file output | behavior+edge+error |
| 24 | cohort output safety | New file, existing file, `--force`, symlink, hardlink, any input/output identity | Existing no-follow, 0600, no implicit overwrite semantics preserved | behavior+edge+error |
| 25 | harness audit skill | Insufficient, malformed, non-comparable, and valid aggregate artifacts | Refuse pattern claim until valid evidence; emit contract-ready analysis only | behavior+edge+error |
| 26 | change contract | Missing hypothesis, invariant, falsification, cohort, approval, rollback, or result | Workflow refuses promotion and records gap | behavior+edge+error |
| 27 | project discovery | Source checkout under project trust | Handbook, release, and harness-audit skills discovered in project scope; no model call | behavior+edge+error |
| 28 | Behavior Map | Telemetry source change stales protected card fingerprint | Direct source/card review precedes explicit refresh; final freshness green | behavior+edge+error |
| 29 | integrated repository | Final tree | E2E, upgrade, audit, pack discovery, freshness, diff check, and review all green | behavior+edge+error |

**Coverage:** 29 scenario groups cover the union of Make policy, five ecosystem markers, unsupported and ambiguous onboarding, release phase/state transitions, project-only guard behavior, telemetry schema migration, cohort input/privacy/output boundaries, audit governance, package/project discovery, Behavior Map maintenance, and final repository gates. No identified behavior path is intentionally omitted.

**Exhaustiveness rationale:** Fixture matrices parameterize ecosystem, Make syntax, Git state, network state, release phase, mutation ordering, cohort cardinality, duplicate identity, malformed input, and output-path safety. This exercises each independent decision dimension without multiplying every ecosystem by every release or telemetry condition.

## Review plan

- Routed agents:
  - `pi-forge.architecture-reviewer` for public/project boundaries, shared policy ownership, schema migration, and workstream cohesion;
  - `pi-forge.security-reviewer` for untrusted metadata reads, path/symlink handling, release side effects, command parsing, telemetry privacy, and output identity;
  - `pi-forge.test-reviewer` for state-machine, matrix, failure-mode, regression, and package/runtime coverage;
  - `pi-forge.dx-reviewer` for onboarding usefulness, unresolved evidence, release recovery, diagnostics, and maintenance cost.
- Review artifact: goal, locked decisions, complete changed-file roster, focused diff/source excerpts, inspector schema, Make policy, release phase table, guard parser and limitations, telemetry v1-to-v2 contract, cohort schema, privacy exclusion assertions, package/project discovery output, final commands, and declared exclusions. Remove absolute local paths, raw sessions, command output that may contain environment data, registry credentials, and unrelated source.
- Critical/Major evidence gate: parent reopens every cited source path, reproduces parser/state/fixture claims, distinguishes unreachable or theoretical concerns, fixes verified blockers only, and reruns affected checks after the final fix. Reviewers have no filesystem and their reports are claims until verified.

## Budget

- Fix rounds: maximum 3 review-to-fix rounds after the final integrated review; each checkpoint may use one local correction pass before escalation.
- Delegated launches: maximum 7, up to 3 sequential writer launches and 4 final reviewers. No parallel writers in this checkout.
- Writer concurrency: 1.
- Checkpoint rule: a red checkpoint stops later workstreams; do not hide a partial result behind completion language.
- Final evidence:
  - focused test commands recorded during each checkpoint;
  - `npm run check:behavior-map`
  - explicit reviewed `npm run refresh:behavior-map` only if fingerprints are stale after W4/W5
  - `npm run check:behavior-map:freshness`
  - `npm run test:e2e`
  - `npm run test:pi-subagents-upgrade -- 0.37.2 --force`
  - `npm audit --omit=dev --audit-level=moderate`
  - `git diff --check`
  - exact `git status --short --branch`
  - independent review with no unresolved Critical or Major.

## Risks and rollback

- Risk: project-checks recommends a command that exists syntactically but is not the project's intended gate. Mitigation: evidence labels, no execution, parent inspection, user-visible diff, and conventional commands never presented as observed.
- Risk: appending targets changes Make's default target or interacts with includes. Mitigation: the helper emits no file; the skill preserves existing target order, refuses unsupported syntax, and requires diff review. New Makefiles place an explicit documented default only after user choice.
- Risk: unit-only projects perceive inconclusive score as failure. Mitigation: document that `/score` intentionally requires real E2E evidence and that project-checks does not manufacture it.
- Risk: a release helper appears authoritative while local or network evidence is stale. Mitigation: the preflight itself runs the fixed verification commands for the requested phase, every remote check records exact HEAD/version and phase, network errors are indeterminate, and publish rechecks immediately before authorization.
- Risk: the project release guard misses wrappers, aliases, custom tools, user shell, or external terminals. Mitigation: document it as an ordinary Pi Bash-tool defense only; the release skill and explicit authorization remain the workflow boundary.
- Risk: a concurrent maintainer publishes the same version after preflight. Mitigation: npm immutable-version conflict, immediate absence recheck, no blind retry, and reconcile before any next action.
- Risk: a bad package is successfully published. Mitigation: verify immediately; preserve tags; separately authorize dist-tag correction/deprecation and publish a fixed patch; never automate unpublish.
- Risk: schema v2 breaks an undocumented consumer. Mitigation: explicit version bump, schema fixtures, documentation, and continued raw Pi session input compatibility. No current repository consumer parses emitted v1 output.
- Risk: aggregate metrics are mistaken for causality or task comparability. Mitigation: no semantic labels, explicit operator assertion, observation warnings, one-hypothesis contracts, and normal source-first planning.
- Risk: five-session aggregates still expose behavioral extremes. Mitigation: no extrema, rows, timestamps, or identifiers; output remains local and provider disclosure requires exact-artifact consent.
- Risk: internal deduplication misses a byte-for-byte copied session with changed header identity. Mitigation: reject duplicate filesystem identity and header ID, document that hostile rewritten duplicates remain outside proof, and treat cohort selection as operator responsibility.
- Risk: Behavior Map freshness encourages mechanical refresh. Mitigation: stop on stale card, localize from source, review the card, refresh only explicitly, and do not expand pilot scope.
- Rollback W1/W2: remove the project-check skill/prompt/helper/shared policy, restore the score-local parser, and restore package discovery roster. No project Makefile has been changed by package code.
- Rollback W3: remove the project-only release skill/guard and source-only scripts/tests, and revert the added version invariant. No Git or npm state has been mutated.
- Rollback W4/W5: restore telemetry v1 files, remove aggregator/audit resources and cohort tests/docs, then review and refresh the existing Behavior Map fingerprint. No automatic telemetry artifact or migration exists.
- Rollback W6: restore docs/parity and any reviewed card prose; never restore stale fingerprints without matching source review.

## External side effects

- Draft plan file creation: authorized by the `/plan-forge` request.
- Expert Panel disclosure: exact prepared roadmap brief was disclosed with interactive consent in run `0b918e95-afad-44d5-96a4-ed010c88fa2e`; the run failed before synthesis and was not retried.
- Implementation source edits and local verification: authorized by Max on 2026-07-31.
- Commit, push, local or remote tag, npm publication, branch change, issue/PR mutation, deployment, release, telemetry disclosure to another provider: not authorized.
- Authorization status: implementation and local verification only.

## Progress

- [x] Analyze current source, tests, package boundaries, release evidence, Pi extension mechanics, and telemetry privacy
- [x] Run and record the green local baseline
- [x] Attempt independent Expert Panel review and record failure before synthesis
- [x] Resolve roadmap decisions and write draft ExecPlan
- [x] User approval
- [x] W1/W2 public project-checks checkpoint
- [x] W3 maintainer release checkpoint
- [x] W4/W5 telemetry and harness-audit checkpoint
- [x] W6 final integration, verification, and review

## Surprises and discoveries

- `src/session-telemetry.js` is already a fingerprinted protected-agent Behavior Map surface because it recognizes the protected writer. Cohort work can leave the map partial, but the source change must follow stale-card review and explicit refresh.
- The current score parser returns an empty target set for any unsupported syntax anywhere in the Makefile. Appending valid targets cannot make such a project scoreable, so project-checks must refuse a misleading merge rather than merely append.
- Ordinary local tag creation is intentionally invisible to the package lifecycle guard, while npm publication is not classified at all. A project-only extension is the smallest Pi-native defense that does not widen every package consumer's policy.
- The failed Expert Panel run produced no synthesis because one critic violated its structured schema. Automatic retry would add provider cost and is unnecessary because the plan can remain sound with explicit reduced confidence and mandatory final review.
- Small cohort aggregates can approximate per-session values even without rows. The cohort floor therefore belongs in the deterministic aggregator, not only in the model-authored audit skill.
- The existing telemetry aggregate/event mismatch is not just an aggregator concern. It is a schema semantic change and must be resolved before any ordered verification metric is exposed.
- On the default case-insensitive macOS filesystem, `Makefile` and `makefile` can resolve to the same inode. The inspector now deduplicates Makefile name candidates by filesystem identity so one physical file is not misreported as an ambiguous pair.
- A release phase can contain both definite failure and unavailable evidence. The state machine gives a definite failure precedence in the phase verdict while preserving every indeterminate check, so a known version or CI defect is not obscured by an unrelated network gap.
- The source-project guard deliberately confirms only ordinary tag creation and npm publication. Tag push remains covered by the existing package lifecycle remote-mutation confirmation, avoiding duplicate prompts and public policy changes.
- Raw Pi session format versions and sanitized telemetry schema versions are independent. Historical raw v2/v3 files remain accepted while runtime snapshots and extracted events move to sanitized schema v2.
- Sharing the extractor's file-descriptor reader made non-symlink input enforcement atomic for both single-session and cohort paths. The shared writer now checks identity against every cohort input before chmod or truncation.
- The Behavior Map lexical checker recognizes the protected writer's literal identity in any discovered test. Telemetry fixtures construct that already-tested identity without adding a new mapped surface; source/card review confirmed `writerInInput` remains the correct locator and no card prose change was needed.
- A JavaScript manifest without a lock or versioned `packageManager` does not establish npm. Parent inspection removed the initial npm default and made missing or conflicting manager evidence unresolved.
- A Makefile `include` can hide a required target even when `/score` preserves its historical literal parser behavior. Project onboarding now freezes imported Makefiles without changing existing score compatibility.
- The first release implementation ran fixed npm scripts before proving the checkout was clean and synchronized. Security review correctly identified that npm script bodies are arbitrary project code; final preflight validates static state first, strips credentials and HOME for script execution, then recollects every invariant.
- Holding every cohort entry tree would amplify the 1 GiB input allowance through object overhead. The final aggregator projects and releases one session at a time.
- Reviewer artifacts that summarize rather than embed full source can produce false DX findings. The parent verified the actual README already used `/project-checks`; a minimal `/skill:pi-forge-harness-audit` invocation was still added to remove any discovery ambiguity.

## Execution decisions

| # | Decision | Evidence | Effect |
|---|---|---|---|
| 1 | Begin implementation in the current `main` checkout | Max approved implementation on 2026-07-31; Git and remote side effects remain unauthorized | Execute W1 through W6 sequentially with one writer and stop on a red capability gate. |
| 2 | Treat duplicate required Make targets as statically inconclusive | A duplicate rule can merge recipes or prerequisites and is unsafe for automatic onboarding | Shared Make policy reports duplicates; `/score` does not execute either gate; project-checks freezes proposals. |
| 3 | Deduplicate Makefile name aliases by inode | Case-insensitive filesystems expose one `Makefile` under multiple candidate spellings | Preserve score's first-match behavior while still rejecting multiple distinct root Makefiles. |
| 4 | Keep release preflight non-publishing and guard only ordinary project-source commands | W3 tests inject every command result; the helper's fixed commands contain no Git or registry mutation, while existing lifecycle already confirms tag push | Add project-only tag/npm confirmation without release receipts or public lifecycle changes. |
| 5 | Require launch identity for protected-writer mutation observation | A result without `runId` or `asyncId` does not prove a writer process launched; launched failures still represent an uncertain source-mutation boundary | Schema v2 summary and events share one conservative classifier. |
| 6 | Bound cohorts at 1 GiB cumulative input | The existing 250 MiB single-file cap multiplied by 100 would permit excessive work; one cumulative bound keeps explicit-input aggregation finite | Public docs and deterministic runner enforce 5 to 100 files, 2 MiB lines, 250 MiB files, and 1 GiB total. |
| 7 | Reuse no-follow file descriptors for input and output | Path prechecks alone are race-prone and duplicate output code could weaken extractor guarantees | One shared reader rejects symbolic links atomically; one writer checks single-link and every input identity before mutation. |
| 8 | Require explicit JavaScript package-manager evidence | A bare `package.json` does not prove npm and can produce the wrong wrapper | Only known locks or a versioned supported `packageManager` field enable observed JS candidates. |
| 9 | Freeze Makefile imports for onboarding only | Imported files may already define required targets, while changing `/score` would break its locked historical parser behavior | Shared policy reports include directives; project-checks freezes, score behavior remains unchanged. |
| 10 | Project telemetry one session at a time | Retaining every parsed entry tree made the cumulative byte limit an unsafe memory proxy | Cohort execution stores only small metrics/signals projections after each input. |
| 11 | Gate and isolate release project code | Security review proved `npm run` script bodies can mutate state or read ambient credentials despite `shell: false` | Static evidence gates execution, temp HOME and minimal env remove release/provider credentials, and post-execution state is recollected. |
| 12 | Add real Git release integration | Test review found pure snapshots and injected command results did not prove production Git parsing | A disposable repository and bare remote exercise production Git commands, sync/divergence, and ref non-mutation. |
| 13 | Keep concurrent root replacement as an explicit trusted-project residual risk | Portable Node APIs used here provide final-component no-follow but no directory-relative `openat` contract | Document the local concurrent rename limitation rather than claim filesystem containment. |

## Outcomes and retrospective

All three capability gates completed without a package version bump or external release effect.

- Project checks: one shared literal-Make policy now serves `/score` and the public inspector. The packed package discovers `/project-checks` and `skill:project-checks`. The inspector supports five ecosystems, requires explicit JS manager evidence, freezes imported or ambiguous Makefiles, and leaves missing E2E evidence inconclusive.
- Release: trusted source discovery exposes `skill:pi-forge-release`; the non-publishing helper implements prepare, tag, publish, verify, and reconcile with exact-head CI, tag provenance, local/registry integrity, three-state verdicts, recovery guidance, and a project-only ordinary-command guard. Fixed project scripts run only after static gates, with stripped credentials, and all state is rechecked afterward.
- Telemetry and harness evolution: runtime entries and traces use schema v2 with one ordered classifier. The public cohort aggregator enforces 5 to 100 explicit distinct sessions and emits aggregate projections only. `skill:pi-forge-harness-audit` remains project-only and can create one falsifiable draft contract without raw-session access, automatic edits, or provider fan-out.
- Parity and Behavior Map: parity now distinguishes implemented, reused, deferred, and not-applicable surfaces. Direct source/card review kept the two-workflow map unchanged; explicit refresh restored freshness for 34 canonical files.

Final evidence after the last source edit:

- `npm run test:e2e`: passed, 110/110 tests plus packed-artifact Pi discovery;
- `npm run test:pi-subagents-upgrade -- 0.37.2 --force`: compatible, isolated RPC probe passed, consent declined before spawn;
- `npm audit --omit=dev --audit-level=moderate`: zero vulnerabilities;
- `npm run check:behavior-map:freshness`: passed for 34 canonical files;
- `git diff --check`: passed.

Architecture review reported no findings. Security and test reviews each found one Major; both were reproduced and fixed. Their focused re-reviews reported no remaining Critical or Major. DX findings were checked against source: the command was already plural, and a concrete harness-audit invocation was added. The residual security risk is concurrent trusted-project root replacement during metadata inspection; this workflow is not an OS containment boundary.

No commit, staging, push, branch change, tag, npm publication, issue/PR mutation, deployment, live release preflight, real cohort disclosure, or additional-provider review occurred. The initial planning Expert Panel remained failed before synthesis and was not retried.
