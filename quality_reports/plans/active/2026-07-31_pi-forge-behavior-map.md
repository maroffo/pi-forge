# Pilot a Source-Grounded Pi Forge Behavior Map

**Status:** completed
**Origin:** In-session review of “Harness Handbook: Making Evolving Agent Harnesses Readable, Navigable, and Editable”
**Base:** `main` at `8b3935b43de2e7fed076bc623ba4f927825f953f`
**Goal:** Add a project-only, source-grounded Behavior Map for two distributed Pi Forge workflows, with deterministic structural validation, explicit pilot coverage, advisory freshness reporting, and no change to the public package behavior or current planning workflow.

## Analysis (verified 2026-07-31, do not re-derive without new evidence)

### Current behavior

- Pi Forge publishes and discovers package skills from `./skills`; its npm file allowlist includes `skills/` but not `.pi/`, so a project skill can remain maintainer-only without entering the package catalog (`package.json:18`, `package.json:51`). Pi 0.83 documentation confirms that trusted projects discover `.pi/skills/` and that skill metadata is always present while the full body is loaded on demand. A real Pi discovery probe is still required as acceptance evidence.
- The architecture document explains principles, resource boundaries, isolation, delivery workflows, lifecycle enforcement, telemetry, and scoring, but it does not provide a behavior-to-source locator index or a cross-workflow register (`docs/architecture.md:3`, `docs/architecture.md:15`, `docs/architecture.md:81`).
- `plan-forge` already requires current repository evidence and a `file:line` citation for each important mechanic (`skills/plan-forge/SKILL.md:20`). `orchestrator` independently reopens real code before editing and requires the intended file set to be stated (`skills/orchestrator/SKILL.md:31`). The map must therefore guide localization only; it must never become source authority.
- Existing source checks enumerate required package resources, scan public text, and run deterministic `--check` modes for generated chains, reviewers, and the technical writer (`scripts/check-package.mjs:18`, `scripts/check-package.mjs:70`, `scripts/check-package.mjs:134`, `scripts/check-package.mjs:143`). There is no equivalent structural or freshness check for behavior-oriented documentation.
- The Expert Panel workflow is distributed across canonical model/runtime configuration, chain generation and integrity binding, extension launch logic, prompt and skill preparation, package/runtime probes, tests, and documentation. The core launcher validates chain disclosure and runtime contracts before registering the tool and command (`extensions/second-opinion.ts:217`, `extensions/second-opinion.ts:254`, `extensions/second-opinion.ts:317`, `extensions/second-opinion.ts:462`, `extensions/second-opinion.ts:530`, `extensions/second-opinion.ts:554`). Models and the pinned runtime are defined separately (`src/second-opinion-config.js:4`), while the chain and digest are generated and checked elsewhere (`scripts/build-second-opinion.mjs:140`, `scripts/build-second-opinion.mjs:171`, `src/second-opinion-integrity.js:4`).
- The protected-agent policy is similarly distributed. Agent identities are canonicalized in configuration (`src/agent-policy-config.js:10`, `src/agent-policy-config.js:16`, `src/agent-policy-config.js:20`); invocation shapes, effective launch contracts, run attestations, and resume rules are enforced by the extension (`extensions/agent-policy.ts:195`, `extensions/agent-policy.ts:303`, `extensions/agent-policy.ts:357`, `extensions/agent-policy.ts:546`, `extensions/agent-policy.ts:579`); unit tests exercise direct, parallel, chain, override, attestation, reload, and resume cases (`tests/agent-policy.test.ts:18`, `tests/agent-policy.test.ts:88`, `tests/agent-policy.test.ts:151`, `tests/agent-policy.test.ts:195`, `tests/agent-policy.test.ts:280`).
- A repository-wide term scan for the two candidate workflows currently returns files from `extensions`, `src`, `scripts`, `tests`, `skills`, `prompts`, `chains`, `agents`, `docs`, and the root README. This confirms that a code-only function graph would omit declarative behavior, but the exact discovery vocabulary remains a pilot heuristic and cannot prove semantic completeness.

### Root cause or design gap

Pi Forge documents architecture by concern and protects individual generated resources, but it has no source-validated representation that starts from a runtime behavior and exposes its code, declarative resources, generated artifacts, tests, state, and invariants together. An agent must reconstruct those relationships with repeated searches. This is most error-prone for cross-file policy, fallback, consent, generated, and cold resume paths. The gap is behavior localization, not missing source documentation: the real source remains authoritative, and any map that becomes mandatory or silently stale would worsen the problem.

### Scope

- In:
  - a trusted-project skill under `.pi/skills/pi-forge-handbook/`;
  - overview, direct index, register index, two behavior cards, a typed manifest, and generated fingerprint snapshot;
  - pilot behaviors for Expert Panel and protected-agent launch/resume policy;
  - pilot registers for the pinned `pi-subagents` version, Expert Panel chain digest, protected agent identities/capability ceilings, and run attestation state;
  - deterministic discovery of the pilot coverage universe from fixed source roots and workflow terms outside the hand-authored manifest;
  - hard structural validation and a separate advisory freshness command;
  - actual trusted-project Pi skill discovery verification without a model call;
  - focused documentation and tests.
- Out:
  - public package skill exposure or inclusion of `.pi/` in the npm artifact;
  - mandatory `plan-forge` routing or changes to the ExecPlan template;
  - mapping lifecycle, telemetry, scoring, source control, PR review, or every Pi Forge workflow;
  - semantic prose validation, LLM-generated cards, automatic semantic resynchronization, source-body copies, call-graph construction, blind edit execution, and autonomous self-modification;
  - any claim that fingerprints prove documentation correctness or that the pilot has whole-harness coverage.
- Recover excluded context from:
  - `docs/architecture.md` for the whole harness;
  - `skills/plan-forge/SKILL.md` and `skills/orchestrator/SKILL.md` for current planning and implementation contracts;
  - the pilot manifest's explicit `unmapped` and `excluded` entries for discovered but unmodeled surfaces;
  - a future plan after at least three real planning uses if public packaging or workflow integration becomes justified.

### Candidate approaches

| Approach | Decision | Evidence and trade-off |
|---|---|---|
| Full LLM-built handbook with automatic resynchronization | rejected | It adds provider cost, semantic drift, a new generation pipeline, and no deterministic proof that prose matches source. The current repository is small enough for a bounded authored pilot. |
| Public package skill under `skills/` | rejected for pilot | Package skill metadata would be exposed to every package user (`package.json:51`) even though the map is for maintainers changing Pi Forge itself. Keep the layout mechanically movable later. |
| Project-only map under `.pi/skills/` | chosen | Pi's trust-gated project discovery matches the maintainer boundary and `.pi/` is outside the current npm file allowlist (`package.json:18`). Runtime discovery and package exclusion must be tested. |
| Custom start/end anchors with region SHA-256 as a build gate | rejected | Anchors are fragile across TS, JS, Markdown, and JSON; region hashes can miss dependency changes, and hard failure encourages mechanical hash bumping. |
| Typed native locators plus advisory whole-file fingerprints | chosen for pilot | File paths, code declarations, Markdown headings, skill names, and JSON pointers can be checked deterministically. Whole-file fingerprints conservatively over-invalidate, but only freeze or flag a card during map use and do not fail the standard source check. |
| Immediate mandatory `plan-forge` integration | rejected for pilot | The map is partial and its token, latency, localization, and maintenance effects are unmeasured. Existing source-first behavior remains unchanged (`skills/plan-forge/SKILL.md:20`, `skills/orchestrator/SKILL.md:31`). |
| Two representative workflow cards | chosen | Expert Panel exercises extension, skill, prompt, JSON chain, generator, config, integrity, runtime probes, tests, and docs. Protected-agent policy exercises extension state, config identities, package agents, private contracts, preflight, attestations, resume, and tests. |

### Independent opinion

Expert Panel run `b8f56c8d-9bef-426b-be1e-21e2fe22d794` completed with verdict `revise` and high confidence. Accepted findings:

- resolve the project-only and planning-integration questions rather than leaving them both committed and open;
- cite repository premises;
- use a typed locator grammar for heterogeneous artifacts;
- define a coverage universe independently of the manifest;
- make structural defects hard failures but treat fingerprint drift as a review signal, not proof;
- defer mandatory `plan-forge` and ExecPlan integration;
- retain one or two representative workflows while making unmapped scope visible;
- keep operational launch instructions outside future review artifacts.

The implementation-completion rejection from one panelist was discarded by the synthesis because the reviewed artifact was explicitly a pre-plan architecture proposal, not a completed change. No panel claim is treated as source evidence.

## Locked decisions

Append only. Reverse a decision with a new row that names the superseded row.

| # | Decision | Choice | Evidence/rationale | Revisit if |
|---|---|---|---|---|
| 1 | Audience and discovery boundary | Project-only skill at `.pi/skills/pi-forge-handbook/` | Maintainer-only scope avoids adding unrelated skill metadata to all package users; Pi trust-gates project skill discovery. | Three real uses show package consumers need the map. |
| 2 | Pilot breadth | Map exactly Expert Panel and protected-agent launch/resume | Together they cover runtime and declarative surfaces without claiming full coverage. | Either workflow cannot exercise the locator/checker design or maintenance is excessive. |
| 3 | Source authority | Cards are location indexes; agents must reopen current source | Existing Plan Forge and Orchestrator contracts already require current source evidence. | Never, unless Pi Forge's evidence contract changes explicitly. |
| 4 | Locator grammar | Typed `file`, `code-declaration`, `markdown-heading`, `skill-name`, and `json-pointer` locators | Native artifact concepts are more portable than custom comment anchors. Every locator must resolve uniquely where uniqueness applies. | A type cannot be validated without adding a heavy parser or produces repeated false results. |
| 5 | Coverage universe | Checker-owned roots and workflow vocabularies discover candidate files; every discovered path must be mapped, explicitly unmapped, or excluded with rationale | This prevents the manifest from defining its own complete universe. It remains a lexical pilot heuristic, not semantic completeness proof. | A deterministic import/resource graph becomes available and demonstrably improves recall. |
| 6 | Structural gate | Standard `npm run check` fails on invalid schema, unsafe paths, missing or ambiguous locators, duplicate IDs, broken references, unclassified discovered paths, and invalid generated-from relationships | These are objective defects with deterministic outcomes. | A rule proves unstable across supported platforms. |
| 7 | Freshness | Generated whole-file SHA-256 snapshot is checked only by a separate freshness command; drift marks affected cards stale and excludes them from trusted routing until source is reverified and the snapshot is explicitly refreshed | Conservative over-invalidation is acceptable as an advisory pilot signal. A digest does not establish semantic correctness. | Measured false-positive cost is excessive or a reliable narrower locator fingerprint becomes available. |
| 8 | Generated artifacts | Fingerprint canonical configuration/generator inputs, not generated outputs; list generated outputs and validate their provenance | Existing generators already check output equality (`scripts/check-package.mjs:143`), so duplicate freshness hashes add churn without new evidence. | A generated output lacks an existing deterministic source check. |
| 9 | Planning integration | Do not modify `plan-forge`, `orchestrator`, or the ExecPlan template in this MVP | The partial map must prove usefulness before entering a required workflow. | At least three real plans record useful localization evidence with acceptable context and maintenance cost. |
| 10 | Automation boundary | No model generation or automatic semantic resynchronization | The pilot tests localization and structural maintenance before adding an expensive trust boundary. | Manual card maintenance is valuable but demonstrably unsustainable. |
| 11 | Publication boundary | `.pi/` remains absent from the npm tarball | The pilot is repository-maintainer tooling, not package runtime behavior. | Decision 1 is explicitly reversed. |

## Acceptance criteria

- [x] A trusted Pi process opened at the Pi Forge repository discovers `skill:pi-forge-handbook` as a project skill without invoking a model.
- [x] `npm pack --json` contains no `.pi/` Behavior Map paths, and the public package skill roster remains unchanged.
- [x] The skill supports direct progressive disclosure: read the index first, then only the named behavior cards and registers; reading the overview is optional when whole-system orientation is unnecessary.
- [x] The two behavior cards name purpose, triggers, inputs, outputs, state transitions, exceptional paths, source-of-truth files, generated artifacts, tests, registers, and typed source locators without copying source bodies.
- [x] The register view covers pinned runtime version, chain digest, protected identities/capability ceilings, and run attestations with all mapped definitions and consumers.
- [x] A checker-owned lexical discovery scope finds current pilot surfaces, and each is classified as mapped, unmapped, or excluded with a non-empty rationale where required.
- [x] Structural validation fails closed for duplicate IDs, path escape, non-regular or missing files, malformed cards/manifests, missing or ambiguous typed locators, broken behavior/register/card links, generated artifacts without canonical provenance, and unclassified discovered paths.
- [x] Structural validation passes for the committed pilot map and runs from the standard source `check` command.
- [x] Freshness validation detects a changed canonical mapped file, identifies affected cards, and does not claim semantic invalidity; it is not part of the standard build gate.
- [x] Explicit fingerprint refresh refuses structurally invalid input and updates only the fixed project snapshot path after successful structural validation.
- [x] The skill treats stale cards as frozen: it directs the agent to fall back to direct repository search and source verification rather than trusting stale prose.
- [x] Tests cover every locator type, coverage classification, path containment, symlink/non-regular handling where practical, structural error class, freshness state, generated provenance, project discovery, and package exclusion.
- [x] `npm run test:e2e`, the pinned pi-subagents upgrade gate, `npm audit`, and `git diff --check` pass after the final source edit.

## Workstreams

### W1: Define the project skill and pilot map

- Scope:
  - `.pi/skills/pi-forge-handbook/SKILL.md`
  - `.pi/skills/pi-forge-handbook/references/overview.md`
  - `.pi/skills/pi-forge-handbook/references/index.md`
  - `.pi/skills/pi-forge-handbook/references/registers.md`
  - `.pi/skills/pi-forge-handbook/references/manifest.json`
  - `.pi/skills/pi-forge-handbook/references/fingerprints.json`
  - `.pi/skills/pi-forge-handbook/references/behaviors/expert-panel.md`
  - `.pi/skills/pi-forge-handbook/references/behaviors/protected-agent-policy.md`
- Excluded: public `skills/`, `prompts/`, and runtime extensions; recover from this plan's locked decisions 1, 9, and 11.
- [x] Define schema version 1 with behavior, register, card, surface classification, typed locator, relation, canonical input, generated artifact, and test references.
- [x] Keep behavior prose concise and navigational. Do not include source bodies or static line numbers.
- [x] Make `SKILL.md` require structural/freshness inspection before use, direct index routing, current source verification, and stale-card fallback.
- [x] Describe the map as a two-workflow pilot and enumerate known unmapped harness workflows without implying complete coverage.

### W2: Build deterministic structural and freshness validation

- Scope:
  - `scripts/lib/behavior-map.mjs`
  - `scripts/check-behavior-map.mjs`
  - `package.json`
  - `scripts/check-package.mjs`
- Excluded: runtime extension hooks, lifecycle follow-ups, auto-generated prose, and package publication resources.
- [x] Keep checker-owned discovery roots and fixed workflow vocabularies outside the hand-authored manifest.
- [x] Resolve repository-relative paths with containment checks; reject absolute paths, `..` escapes, symlink escapes, missing files, and unsupported file types.
- [x] Implement the typed locator grammar:
  - `file`: regular file existence;
  - `code-declaration`: one supported JS/TS declaration for an identifier;
  - `markdown-heading`: one exact Markdown heading;
  - `skill-name`: one frontmatter skill name;
  - `json-pointer`: an existing RFC 6901 value in valid JSON.
- [x] Validate unique IDs, card links, behavior/register relationships, tests, canonical-input/generated-artifact edges, and complete classification of the discovered pilot universe.
- [x] Add a structural mode used by `npm run check:behavior-map` and the standard `npm run check`.
- [x] Add a separate freshness mode that compares canonical mapped regular files with the generated snapshot and reports affected behavior IDs.
- [x] Add explicit snapshot refresh mode. It may write only the fixed fingerprint file, must refuse structural errors, and must state that refresh is review attestation rather than semantic proof.

### W3: Prove behavior, discovery, and package boundaries

- Scope:
  - `tests/behavior-map.test.ts`
  - `tests/engineering-core.test.ts`
  - `scripts/check-runtime-resources.mjs`
  - `docs/architecture.md`
- Excluded: provider calls and changes to current public skill discovery.
- [x] Add fixture-based unit tests for successful extraction and each structural/freshness failure mode.
- [x] Test checker-owned discovery by adding a matching fixture file that is absent from manifest classification and proving rejection.
- [x] Test that changed canonical input marks only related pilot cards stale and that generated outputs rely on their existing generator checks.
- [x] Add a real Pi RPC probe, with project trust and no model invocation, that discovers the project-only skill from the source checkout.
- [x] Extend the pack check to prove `.pi/` is absent and the existing package skill roster is unchanged.
- [x] Document the maintainer-only pilot, source-authority rule, advisory freshness semantics, and promotion criteria in `docs/architecture.md`.
- [x] Record that promotion requires evidence from at least three real planning tasks: surfaced sites, missed sites, stale false positives, navigation/token cost, and maintenance work.

## Verification matrix

| # | Surface/path | Scenario | Expected evidence | Depth |
|---|---|---|---|---|
| 1 | `.pi/skills/pi-forge-handbook/SKILL.md` | Trusted Pi source checkout | `get_commands` reports `skill:pi-forge-handbook` with project origin and no model request | behavior+edge+error |
| 2 | npm tarball | Pack source project | No `.pi/` entries; existing public skill list unchanged | behavior+edge+error |
| 3 | Manifest schema | Valid pilot map | All behavior, register, surface, locator, card, test, and provenance references resolve | behavior+edge+error |
| 4 | IDs and references | Duplicate or missing IDs and card/register links | Structural command exits nonzero with stable diagnostic category | behavior+edge+error |
| 5 | Filesystem containment | Absolute path, `..`, symlink escape, missing/non-regular path | Rejected before reading outside the repository | behavior+edge+error |
| 6 | `code-declaration` | Missing, unique, and duplicate declaration | Only exactly one supported declaration passes | behavior+edge+error |
| 7 | Markdown and skill locators | Exact heading/frontmatter name present or absent | Correct resolution or deterministic failure | behavior+edge+error |
| 8 | JSON locator | Valid/invalid JSON pointer and malformed JSON | Correct resolution or deterministic failure | behavior+edge+error |
| 9 | Coverage discovery | New term-matching file not classified | Standard structural check fails as an unclassified pilot surface | behavior+edge+error |
| 10 | Coverage status | Explicit unmapped/excluded file | Accepted only with valid status and rationale; never advertised as mapped | behavior+edge+error |
| 11 | Freshness | Canonical mapped file changed after snapshot | Freshness command reports stale card IDs; standard structural check still passes | behavior+edge+error |
| 12 | Snapshot refresh | Invalid structure or valid reviewed map | Invalid input writes nothing; valid input updates only fixed snapshot | behavior+edge+error |
| 13 | Generated resources | Generator/config and generated output relation | Canonical input participates in freshness; output has provenance and existing `--check` coverage | behavior+edge+error |
| 14 | Repository suite | Final integrated tree | E2E, upgrade compatibility, audit, and diff checks pass | behavior+edge+error |

**Coverage:** two mapped workflows and four mapped registers out of the explicitly larger Pi Forge harness. Every file discovered by the pilot's independent lexical scope is classified. Semantic behavior outside that vocabulary remains a documented gap.

**Exhaustiveness rationale:** The matrix is the union of discovery boundary, manifest graph, locator types, path safety, coverage classification, freshness lifecycle, generated provenance, Pi runtime discovery, package exclusion, and repository gates. Parameterized fixture tests cover variants without multiplying one test per production file.

## Review plan

- Routed agents:
  - `pi-forge.architecture-reviewer` for boundary, schema, and source-authority design;
  - `pi-forge.security-reviewer` for path containment, symlink handling, and fixed-output refresh;
  - `pi-forge.test-reviewer` for failure-mode and runtime-probe coverage;
  - `pi-forge.dx-reviewer` for navigation cost, diagnostics, and maintenance workflow.
- Review artifact: goal, locked decisions, complete changed-file roster, manifest/schema excerpts, checker logic, project-skill cards, relevant diff, fixture cases, Pi discovery output, pack roster, freshness diagnostics, and final commands. Remove local absolute paths and unrelated source.
- Critical/Major evidence gate: parent reopens every cited source and reproduces checker/runtime claims. Findings about semantic completeness remain risks unless backed by a concrete missing surface or failing fixture.

## Budget

- Fix rounds: 3
- Delegated launches: maximum 5, one optional implementation writer plus four final reviewers
- Writer concurrency: 1
- Final evidence:
  - `npm run check:behavior-map`
  - `npm run check:behavior-map:freshness`
  - `npm run test:e2e`
  - `npm run test:pi-subagents-upgrade -- 0.37.2 --force`
  - `npm audit --omit=dev --audit-level=moderate`
  - `git diff --check`
  - exact `git status --short --branch`

## Risks and rollback

- Risk: lexical discovery misses a new implementation that uses none of the registered workflow vocabulary. Mitigation: document this as a pilot limitation, map canonical entry points and dependency edges, and inspect misses during three real planning tasks.
- Risk: file-level fingerprints create frequent stale cards for unrelated edits. Mitigation: advisory-only freshness, affected-card reporting, and promotion metrics before narrowing or gating.
- Risk: maintainers mechanically refresh hashes without reviewing cards. Mitigation: refresh is never presented as correctness evidence; source verification remains mandatory and reviews inspect source/card changes together.
- Risk: project skill adds navigation context or is selected for unrelated repositories. Mitigation: specific skill description, project-only discovery, and direct-index loading rather than mandatory sequential traversal.
- Risk: custom declaration matching becomes a partial parser. Mitigation: deliberately narrow supported declaration grammar, fixture tests, no language-general claim, and `file` fallback only when explicitly justified.
- Risk: a manifest path attempts to read outside the repository or refresh a symlink. Mitigation: canonical containment, regular-file checks, no arbitrary output path, and security review.
- Rollback: remove `.pi/skills/pi-forge-handbook/`, behavior-map scripts/tests/check wiring, runtime probe, and the architecture section. No runtime package or persisted data migration is involved.

## External side effects

- Draft plan file creation: authorized by `/plan-forge` request.
- Expert Panel disclosure: authorized through run `b8f56c8d-9bef-426b-be1e-21e2fe22d794` and its interactive provider consent.
- Branch creation and switch to `feat/behavior-map-pilot`: authorized and completed.
- Commit, push, issue or PR mutation, deployment, publication, tag, or release: not authorized.
- Authorization status: implementation and local verification require plan approval; all Git and remote effects require separate explicit authorization.

## Progress

- [x] Analyze the paper and current Pi Forge implementation
- [x] Verify Pi skill/package mechanics against Pi 0.83 documentation
- [x] Obtain and resolve Expert Panel feedback
- [x] Write draft ExecPlan
- [x] User approval
- [x] Authorize and create/switch to implementation branch
- [x] Implement W1 through W3
- [x] Final verification and review

## Surprises and discoveries

- The first review artifact mixed operational instructions with the material under review. The panel correctly treated those instructions as untrusted. Future review artifacts must contain only the review subject.
- One critic applied an implementation acceptance contract to the pre-plan proposal. The synthesizer discarded that claim while preserving its valid request for source citations and a deterministic coverage universe.
- The package file allowlist excludes both `.pi/` and development scripts, so source-only checker wiring does not alter the npm artifact unless the manifest is deliberately changed (`package.json:18`).
- Exact workflow surface counts vary with search vocabulary. The pilot must report its fixed lexical discovery terms and must not present the resulting count as semantic completeness.
- The implemented checker-owned vocabulary currently discovers 37 surfaces; 34 canonical authored files participate in advisory fingerprints. These counts are observations of the pilot configuration, not completeness claims.
- Pi 0.83 reports the source skill as `scope: project` and `origin: top-level`; the runtime probe verifies those fields and requests no provider.

## Execution decisions

Append-only during implementation.

| # | Decision | Evidence | Effect |
|---|---|---|---|
| 1 | Start implementation on `feat/behavior-map-pilot` | Max approved the plan and branch change on 2026-07-31 | Execute W1 through W3 without commit or remote side effects. |
| 2 | Use one structural validator with separate freshness and refresh modes | Locked decisions 6 and 7 require different failure semantics | `npm run check` blocks structural defects; freshness remains an explicit review gate. |
| 3 | Verify project discovery against Pi RPC command metadata | Pi exposes `sourceInfo.scope` and `sourceInfo.origin` without a model call | Runtime verification proves maintainer-only discovery while pack inspection proves exclusion. |
| 4 | Reject locator fields not defined by the selected locator type | Parent inspection found the initial union schema accepted irrelevant fields | Typed locator objects now fail closed on type-inapplicable data. |
| 5 | Harden fingerprint refresh output identity | Parent inspection found direct-symlink coverage did not address parent containment or multi-hardlink output | Refresh now verifies the fixed parent and destination realpaths and rejects non-regular, symlink, or multi-hardlink output. |
| 6 | Validate register and unmapped-workflow navigation links | The acceptance contract requires all mapped register consumers and visible unmapped scope | Structural validation and fixtures now require register locator IDs and unmapped workflow IDs in their reader-facing documents. |

## Outcomes and retrospective

The pilot now maps `expert-panel` and `protected-agent-policy`, with four shared registers, 37 lexically discovered surfaces, and 34 advisory canonical-file fingerprints. Pi discovers the map only from the trusted source checkout; the npm artifact contains no `.pi/` resources and retains the existing public skill roster.

Final evidence after the last source edit:

- `npm run check:behavior-map`: passed;
- `npm run check:behavior-map:freshness`: passed;
- `npm run test:e2e`: passed, 78 tests plus package/runtime probes;
- `npm run test:pi-subagents-upgrade -- 0.37.2 --force`: compatible, consent cancelled before spawn;
- `npm audit --omit=dev --audit-level=moderate`: zero vulnerabilities;
- `git diff --check`: passed.

Architecture, security, test, and DX reviewers reported no Critical, Major, or Minor findings. Their artifact-only contract means they did not inspect the filesystem; the parent independently read the complete validator, manifest, cards, and tests and fixed type-schema, output-identity, and navigation-reference gaps before the final verification.

The map remains a pilot. It should not be expanded or integrated into mandatory planning until at least three real uses measure surfaced and missed sites, stale false positives, navigation cost, and maintenance effort. The main residual risk is lexical false negatives outside the fixed workflow vocabulary.
