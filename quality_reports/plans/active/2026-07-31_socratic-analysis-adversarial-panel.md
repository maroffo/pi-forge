# Socratic Analysis and Evidence-Bound Adversarial Expert Panel

**Status:** completed
**Origin:** In-session requirements refinement approved by Max on 2026-07-31
**Base:** `main` at `dff20c8c770eaeb158463c4b8448bf9052818ce0`, with the existing uncommitted capability-roadmap work preserved
**Goal:** Add a public Socratic analysis workflow backed by one protected artifact-only agent, and make the shared Expert Panel used by both `/second-opinion` and `/expert-panel` structurally adversarial without forcing unsupported dissent.

## Analysis (verified 2026-07-31, do not re-derive without new evidence)

### Current behavior

- Pi Forge publishes prompts, skills, agents, and chains from package roots declared in `package.json:47-63`; no Socratic analysis prompt, skill, or agent currently exists.
- The current panel generator gives every critic the same generic correctness, assumptions, counterexample, and recommendation rubric at `scripts/build-second-opinion.mjs:22-32`. Its output schema requires only verdict, summary, findings, and uncertainties at `scripts/build-second-opinion.mjs:34-61`; it cannot prove that a critic steelmanned the subject, named its weakest dependency, built a concrete counterexample, proposed a falsification test, or reported what survived.
- Both prepared and immediate entry points use the one generated chain described at `docs/second-opinion.md:38-61`. The chain digest is generated from canonical source at `scripts/build-second-opinion.mjs:170-181` and checked before disclosure by the existing extension.
- `independent-critic` and `opinion-synthesizer` already have replacement prompts, fresh context, no inherited project context or skills, and no declared tools at `agents/independent-critic.md:2-17` and `agents/opinion-synthesizer.md:2-17`.
- Protected artifact-only launches derive from `ARTIFACT_AGENT_NAMES` at `src/agent-policy-config.js:16-20`. The policy recognizes those identities at `extensions/agent-policy.ts:61-100` and enforces fresh context, explicit model, no artifacts, no acceptance commands, no output persistence, replacement prompt, no inherited project context, no skills, and no tools at `extensions/agent-policy.ts:357-496`.
- Pack/runtime verification owns explicit resource lists, public command discovery, exact agent roster, and effective artifact-agent preflight at `scripts/check-runtime-resources.mjs:17-164`, `scripts/check-runtime-resources.mjs:432-540`, and `scripts/check-runtime-resources.mjs:978-1055`. Source tests also freeze the exact agent roster at `tests/reviewer-fleet.test.ts:21-31` and `tests/reviewer-fleet.test.ts:80-87`.
- The Behavior Map treats Expert Panel and protected-agent policy as mapped pilot behaviors. Its Expert Panel card names the generated-chain and entry-point contracts, while the manifest explicitly enumerates locators, fingerprints, surfaces, and generated provenance. New Socratic resources that mention Expert Panel or become protected identities must be mapped rather than hidden from lexical discovery.

### Root cause or design gap

There is no entry point that turns a decision into an explicit Socratic claim map before independent review, and the existing Expert Panel's adversarial intent is prompt-level and incomplete. This is falsifiable by inspecting the published command/agent roster and generated critic schema: no Socratic resource is discoverable, and a schema-valid critic result can omit every agreed adversarial move. Adding prose only would not close the second gap because structured output could still succeed without the role-play contract.

### Scope

- In: `agents/socratic-analyst.md`; `prompts/socratic-analysis.md`; `skills/socratic-analysis/SKILL.md`; `docs/socratic-analysis.md`; protected artifact-agent identity/configuration; the canonical Expert Panel generator, critic and synthesizer prompts, generated chain and digest; public docs; package/runtime discovery; Behavior Map localization; focused and integrated tests.
- In: a parent-owned conversational workflow that asks one material question at a time, launches only a fresh artifact-only analyst with explicit evidence, and recommends but never autonomously discloses a Second Opinion payload.
- Out: project-aware tools, inherited conversation or project context in the child, source mutation, automatic provider escalation, differentiated or rotating panel roles, raw trace skill distillation, RL training, synthetic task generation, model/provider changes, pi-subagents version changes, and package version changes.
- Recover excluded context from: `skills/session-telemetry/`, `.pi/skills/pi-forge-harness-audit/`, and arXiv `2606.07412v1` if trace-derived curriculum work is reconsidered later.

### Candidate approaches

| Approach | Decision | Evidence and trade-off |
|---|---|---|
| Parent-only Socratic skill | Rejected | Simplest UX, but does not provide the independently isolated agent explicitly requested and cannot attest a separate evidence boundary. |
| Direct project-aware Socratic agent | Rejected | More autonomous, but expands filesystem and project-context disclosure and weakens evidence traceability. |
| Public parent workflow plus protected artifact-only Socratic agent | Chosen | The parent can converse and gather exact evidence; the child remains fresh, tool-less, and independently preflighted through the existing artifact-agent policy. |
| Prompt-only adversarial panel wording | Rejected | A schema-valid result could omit the agreed reasoning moves. |
| Shared adversarial role plus required structured fields for all four critics | Chosen | Keeps provider outputs comparable, avoids role-provider confounding, and makes the role contract testable. |
| Four distinct or rotating panel roles | Rejected | Wider nominal coverage, but ties lenses to providers or complicates deterministic chain disclosure and integrity. |
| Automatic Socratic escalation | Rejected | Conflicts with explicit conversational authorization and multi-provider disclosure boundaries. |

### Independent opinion

Not run. The change intentionally modifies the Expert Panel contract that would be used for this opinion, and no additional-provider disclosure was authorized for planning. Confidence is recovered through source-grounded acceptance criteria, deterministic chain/schema tests, package runtime probes, and fresh architecture, security, test, and DX review on the current provider after implementation.

## Locked decisions

Append only. Reverse a decision with a new row that names the superseded row.

| # | Decision | Choice | Evidence/rationale | Revisit if |
|---|---|---|---|---|
| 1 | Panel scope | The common chain used by both `/second-opinion` and `/expert-panel` is adversarial | Max selected universal option A; both entry points currently share one chain | A neutral panel becomes a separate product requirement |
| 2 | Critic role | Every provider uses the same evidence-bound adversarial examiner contract | Comparable outputs avoid confounding role with provider | Reliable role rotation with disclosure binding is designed |
| 3 | Required critic moves | Steelman, weakest dependency, concrete counterexample, falsification test, and surviving judgment | These moves distinguish useful falsification from generic critique | Executable evidence shows a different minimal contract |
| 4 | Honest acceptance | `accept` and an empty findings array remain valid | Adversarial review must not manufacture dissent | None; this is a safety invariant |
| 5 | Socratic architecture | Public parent workflow backed by `pi-forge.socratic-analyst` | A child cannot invoke slash commands or own user dialogs; the parent owns interaction and tools | Pi adds a safe interactive child contract |
| 6 | Analyst boundary | Artifact-only, fresh, no tools, no inherited project context or skills | Max selected option 1; matches existing protected artifact ceilings | Explicit project-aware access is separately approved |
| 7 | Interaction | Ask one material question at a time | Max requested Socratic assistance rather than a one-shot generic memo | The user requests batch analysis |
| 8 | Escalation | Recommend, explain, and wait for explicit conversational approval before preparing Second Opinion | Max selected option 1; provider editor and digest-bound consent still follow | A deterministic user-owned policy replaces the dialog |
| 9 | Invocation semantics | The workflow calls `convene_expert_panel` through the Second Opinion contract after approval, never a slash command from a child | Pi skills and child agents cannot invoke slash commands directly | Pi exposes an equivalent first-class guarded API |
| 10 | Existing worktree | Preserve and build on current uncommitted capability-roadmap changes | The checkout is intentionally dirty and contains accepted work | Max authorizes a clean isolation strategy |
| 11 | Runtime and release | Keep package `0.2.0` and pi-subagents `0.37.2` | No release or dependency change was requested | Separate release/version approval is given |

## Acceptance criteria

- [x] `/socratic-analysis` and `skill:socratic-analysis` are discovered from the packed package and resolve the optional focus without invoking a model during runtime discovery.
- [x] `pi-forge.socratic-analyst` is packaged, package-qualified, read-only, replacement-prompted, fresh, and has no inherited project context, skills, tools, fallback model, extension, MCP tool, persistence, or sharing capability.
- [x] Protected-agent policy rejects Socratic analyst shadowing and invocation-time changes to context, skills, tools, output schema, persistence, acceptance, thinking, reads, sharing, or destination.
- [x] The Socratic workflow separates thesis, facts, inferences, assumptions, strongest alternative, falsifiers, reconstruction, confidence, and unresolved evidence; it asks at most one material user question per turn.
- [x] The analyst may return `recommend` or `do-not-recommend` for escalation with evidence, but never claims to invoke Second Opinion or disclose data itself.
- [x] The parent skill requires an explicit user yes after an escalation recommendation before it prepares the Second Opinion brief or calls `convene_expert_panel`; cancellation or no answer launches nothing.
- [x] Both `/second-opinion` and `/expert-panel` use the same generated adversarial chain and fixed provider/model assignments.
- [x] Every critic receives the same explicit examiner role and schema requiring steelman, weakest dependency, concrete counterexample, falsification test, and surviving judgment.
- [x] Critic output may accept the artifact and return no findings when challenges do not survive evidence review.
- [x] The synthesizer distinguishes supported surviving challenges from discarded attacks, does not treat agreement as proof, preserves uncertainty, and does not reward performative dissent.
- [x] Generated chain and SHA-256 integrity output are regenerated only from canonical source and pass the stale-resource check.
- [x] Existing editable payload, fixed-provider disclosure, preflight repetition, fresh contexts, capability ceiling, cancellation, and unknown-spawn behavior remain unchanged.
- [x] README, architecture, Second Opinion docs, Socratic docs, and parity docs describe the real entry points, role contract, consent sequence, and limitations without claiming debate proves correctness.
- [x] The Behavior Map structurally maps all newly discovered Expert Panel and protected-agent surfaces; source/card review precedes an explicit fingerprint refresh; structure and freshness pass afterward.
- [x] `npm run test:e2e`, `npm run test:pi-subagents-upgrade -- 0.37.2 --force`, `npm audit --omit=dev --audit-level=moderate`, `npm run check:behavior-map:freshness`, and `git diff --check` pass after the final source edit.
- [x] Independent architecture, security, test, and DX review has no unresolved Critical or Major finding.

## Workstreams

### W1: Socratic analyst contract and parent workflow

- Scope: `agents/socratic-analyst.md`, `prompts/socratic-analysis.md`, `skills/socratic-analysis/SKILL.md`, `docs/socratic-analysis.md`, `src/agent-policy-config.js`, agent-policy and workflow tests.
- Excluded: project tools, automatic escalation, child resume, source changes by the analyst.
- [x] Define one strict artifact-only agent prompt with an evidence-bound output protocol and no instruction to access absent context.
- [x] Define the parent skill as the conversational owner: clarify one material point at a time, construct a self-contained artifact, invoke a protected analyst with the exact safe fields, relay results, and wait for explicit escalation approval.
- [x] Add a thin prompt alias with optional focus and no hidden automatic action.
- [x] Protect the new identity through the existing artifact-agent ceiling and verify malicious overrides fail closed.

### W2: Universal adversarial Expert Panel contract

- Scope: `scripts/build-second-opinion.mjs`, `agents/independent-critic.md`, `agents/opinion-synthesizer.md`, `skills/second-opinion/SKILL.md`, generated `chains/second-opinion.chain.json` and `src/second-opinion-integrity.js`, focused tests.
- Excluded: provider roster, model assignments, fanout count, immediate/prepared launcher mechanics.
- [x] Replace generic critique wording with the shared evidence-bound adversarial examiner role.
- [x] Require the five adversarial moves structurally while retaining verdict, findings, uncertainties, and valid acceptance with no findings.
- [x] Instruct synthesis to retain only evidence-supported challenges, explain discarded attacks, preserve dissent, and allow acceptance.
- [x] Regenerate chain and integrity output through `scripts/build-second-opinion.mjs`; never hand-edit generated files.

### W3: Package, runtime, documentation, and Behavior Map integration

- Scope: `scripts/check-package.mjs`, `scripts/check-runtime-resources.mjs`, `tests/reviewer-fleet.test.ts`, `tests/engineering-core.test.ts`, `README.md`, `docs/architecture.md`, `docs/second-opinion.md`, `docs/parity.md`, `.pi/skills/pi-forge-handbook/` manifests/cards/fingerprints.
- Excluded: package version, dependencies, release tooling, unrelated roadmap files.
- [x] Add exact source and packed-artifact rosters for the prompt, skill, agent, and docs.
- [x] Probe real package prompt/skill discovery and effective Socratic artifact-agent preflight with no model call.
- [x] Update public documentation and parity classification without overstating guarantees.
- [x] Reopen both mapped behavior cards, add typed locators and coupled surfaces, run structure, explicitly refresh only after source/card review, then run structure and freshness again.

### W4: Final verification and review

- Scope: full current tree, preserving all prior uncommitted work.
- [x] Run focused Socratic, panel, agent-policy, package, and runtime tests after implementation.
- [x] Run the complete final command set after the final source edit.
- [x] Build a self-contained redacted review artifact and route fresh architecture, security, test, and DX reviews on the current provider.
- [x] Verify every Critical or Major against source and executable evidence, fix confirmed blockers within budget, and rerun affected plus final checks.

## Verification matrix

| # | Surface/path | Scenario | Expected evidence | Depth |
|---|---|---|---|---|
| 1 | Socratic prompt and skill | Explicit focus and no focus | Prompt loads the public skill and preserves focus; skill owns conversation | behavior+edge |
| 2 | Socratic skill | Missing material evidence | Exactly one focused question, no child or provider launch until answered | behavior+edge+error |
| 3 | Socratic agent | Complete artifact | Structured claim map, strongest alternative, falsifiers, reconstruction, confidence | behavior |
| 4 | Socratic escalation | Recommend, do-not-recommend, user yes/no | Only explicit yes can enter Second Opinion preparation; no/cancel stops | behavior+edge+error |
| 5 | Agent frontmatter | Package discovery | Fresh replacement prompt, read-only role, no inherited context/skills/capabilities | behavior+error |
| 6 | Protected policy | Valid Socratic launch | Package identity and empty capability ceiling accepted | behavior |
| 7 | Protected policy | Context, skill, schema, output, acceptance, sharing, reads, thinking, destination, shadow overrides | Each rejected before launch | edge+error |
| 8 | Critic generator | Four provider tasks | Identical role text and required five-move schema for all models | behavior |
| 9 | Critic schema | Strong artifact survives attack | `accept`, five reasoned moves, empty findings accepted by schema | edge |
| 10 | Critic schema | Unsupported attack | Evidence and falsification fields expose gap; finding is not promoted by synthesis | behavior+error |
| 11 | Synthesizer | Agreement, disagreement, unsupported majority | Evidence wins over vote; survivors and discarded attacks remain distinct | behavior+edge |
| 12 | Generated resources | Canonical source changes | Builder regenerates deterministic chain and matching digest; `--check` passes | behavior+error |
| 13 | Prepared panel path | Edit, consent, cancellation, preflight drift, unknown acknowledgement | Existing fail-closed behavior remains green | behavior+edge+error |
| 14 | Immediate panel path | Self-contained artifact | Uses exact same adversarial chain and disclosure | behavior |
| 15 | Pack artifact | Installed package | New resources and exact agent roster present; `.pi/` remains absent | behavior+error |
| 16 | Runtime discovery | Isolated Pi config | Public prompt/skill and protected agent resolve from package; no model invocation | integration |
| 17 | Behavior Map | New lexical surfaces and changed canonical files | No unclassified surface; cards reviewed; explicit refresh restores freshness | behavior+error |
| 18 | Compatibility | Pinned pi-subagents runtime | E2E, isolated RPC consent cancellation, and package contract remain compatible | integration |

**Coverage:** 18/18 identified behavior paths. Gaps: no live provider output is required because that would disclose data and incur external model calls; schema, chain generation, runtime preflight, consent cancellation, and packed-artifact discovery are exercised locally.

**Exhaustiveness rationale:** The paths are the union of entry mode (Socratic, prepared panel, immediate panel), trust boundary (parent, protected child, external panel), result state (needs evidence, complete, recommend, accept, revise, inconclusive, cancelled, unknown), and artifact state (source, generated chain, packed package). Parameterized policy tests cover override classes without multiplying every field by every entry mode.

## Review plan

- Routed agents: `pi-forge.architecture-reviewer`, `pi-forge.security-reviewer`, `pi-forge.test-reviewer`, `pi-forge.dx-reviewer`.
- Review artifact: goal and locked decisions; changed-file roster; Socratic and panel contracts; relevant generator/schema/policy/diff excerpts; focused and final command output; declared live-provider gap.
- Critical/Major evidence gate: the parent reproduces each claim against current source or a focused executable test before fixing it. Unsupported remedies are rejected; verified root causes are fixed and re-reviewed when material.

## Budget

- Fix rounds: 3.
- Delegated launches: 1 protected writer plus 4 fresh artifact reviewers; one additional focused re-review per confirmed blocker is allowed within the three fix rounds.
- Writer concurrency: 1 in the current checkout.
- Final evidence: `npm run test:e2e`; `npm run test:pi-subagents-upgrade -- 0.37.2 --force`; `npm audit --omit=dev --audit-level=moderate`; `npm run check:behavior-map`; `npm run check:behavior-map:freshness`; `git diff --check`; `git status --short --branch`.

## Risks and rollback

- Risk: explicit adversarial fields cause performative objections. Mitigation: require steelman first, evidence and falsification, allow `accept`, permit empty findings, and make synthesis discard unsupported attacks.
- Risk: the Socratic workflow accidentally implies provider authorization. Mitigation: the child can only recommend; the parent must receive a separate explicit yes before following Second Opinion, whose editor and digest-bound consent remain intact.
- Risk: adding a protected identity without updating every roster or collision test creates a policy gap. Mitigation: one canonical identity export feeds policy; exact source and packed rosters plus runtime preflight and shadow fixtures fail closed.
- Risk: schema change breaks panel synthesis. Mitigation: generator tests inspect all four task schemas, generated equality is checked, and the pinned isolated compatibility probe cancels before provider spawn.
- Risk: new lexical surfaces make the Behavior Map structurally incomplete. Mitigation: add explicit typed locators and surfaces before refresh; structural defects block refresh.
- Risk: implementation mixes with existing uncommitted roadmap work. Mitigation: preserve all existing modifications, limit edits to listed paths, inspect the combined diff, and never reset, clean, stage, or commit.
- Rollback: revert only this plan's source and generated-resource edits while retaining the pre-existing dirty tree; no Git command is authorized by this statement.

## External side effects

- No commit, staging, push, branch change, tag, issue/PR mutation, publication, deployment, or provider disclosure is authorized.
- Local package packing, temporary Pi runtime probes, tests, and pinned compatibility installation in temporary directories are authorized.
- Authorization status: source implementation and local verification approved by Max on 2026-07-31; every external side effect remains unauthorized.

## Progress

- [x] Analyze current source, tests, package boundaries, protected-agent policy, generated chain, and Behavior Map
- [x] Refine and lock Socratic, adversarial-role, isolation, and escalation decisions
- [x] User approval
- [x] W1 Socratic analyst and parent workflow
- [x] W2 universal adversarial Expert Panel
- [x] W3 package, runtime, docs, and Behavior Map integration
- [x] W4 final verification and review

## Surprises and discoveries

- The requested child cannot literally invoke `/second-opinion`: slash commands are parent entry points. The safe equivalent is a recommendation returned to the parent, followed by separate conversational approval and the existing `convene_expert_panel` bridge.
- The current critic prompt already mentions assumptions and counterexamples, but the output schema cannot demonstrate the agreed role-play. Canonical generator and schema changes are therefore required, not only documentation edits.
- Adding the Socratic analyst to `ARTIFACT_AGENT_NAMES` extends the strict protected-agent policy automatically, but packed-artifact and malicious-shadow fixtures maintain separate explicit rosters and must be updated together.
- The new public skill is a coupled surface of both mapped pilot behaviors: it can escalate to Expert Panel and launches a protected artifact-only identity. The Behavior Map maps that coupling without creating a third behavior card.
- The protected writer completed W1 and W2 but timed out before W3. Canonical status showed the run failed and acceptance was rejected, so it was not resumed; the parent inspected every partial change and became the sole writer for completion.
- Review found that package-qualified shadow rejection did not cover an unqualified `socratic-analyst` request. The parent reproduced the gap from policy matching and added a pre-discovery block for direct, tasks, and nested chain inputs plus a packed malicious-project fixture.
- Review also found that entry-point tests captured the spawned chain without proving exact equality. Both the prepared tool and immediate command now compare the full RPC chain to `buildSecondOpinionChain().chain`.
- A successful provider-backed Socratic child was not launched. Inspection of pinned pi-subagents 0.37.2 showed foreground execution builds arguments, tools, extensions, MCP selection, inheritance, and launch binding from the same resolved `AgentConfig`; reviewers accepted the missing live child as an external-runtime integration gap rather than a reachable product blocker.

## Execution decisions

| # | Decision | Evidence | Effect |
|---|---|---|---|
| 1 | Do not resume the timed-out protected writer | Canonical run `f8133972` was failed with exit 1 and rejected acceptance | Parent inspected partial work and continued as the sole writer. |
| 2 | Map Socratic resources into the two existing Behavior Map cards | The skill couples optional Expert Panel escalation with a protected artifact-only identity | Added typed locators, surfaces, tests, register identity, card prose, and explicit refresh without a third behavior. |
| 3 | Reject the unqualified Socratic alias before discovery | A project-local agent could otherwise capture a model-emitted unqualified name outside the qualified protected identity | Direct, tasks, nested chain, and packed malicious fixture paths now fail closed and name the canonical identity. |
| 4 | Assert full chain equality at both launch entry points | Merely asserting an array could miss stale or divergent schemas | Prepared and immediate harness tests compare the exact canonical generated chain. |
| 5 | Keep no-provider child launch as a declared gap | Pinned source consumes the same resolved agent fields, while a real model launch would cross an external provider boundary | Rely on packed preflight, runtime source trace, version pin, compatibility probe, and explicit residual risk. |

## Outcomes and retrospective

The feature is implemented in the uncommitted current tree.

- `/socratic-analysis` and `skill:socratic-analysis` are discovered from the packed package. The parent owns conversation and one-question clarification; `pi-forge.socratic-analyst` is a protected artifact-only identity with fresh context and no inherited project context, skills, tools, persistence, sharing, extensions, or MCP capability.
- The child produces a testable claim map with facts, inferences, assumptions, strongest alternative, falsifiers, reconstructed conclusion, confidence, and at most one material question. Its Second Opinion recommendation is explicitly non-authorizing.
- Socratic escalation requires a separate unambiguous yes after the recommendation. Existing editable payload, digest binding, fixed-provider disclosure, final consent, repeated preflight, cancellation, and unknown-spawn behavior remain intact.
- `/second-opinion` and `/expert-panel` now spawn the exact same generated adversarial chain. All four critics must return steelman, weakest dependency, concrete counterexample, falsification test, and surviving judgment. `accept` with no findings remains schema-valid, and synthesis discards unsupported attacks.
- Behavior Map remains two behaviors, now with 41 discovered surfaces and 38 canonical fingerprints after direct source/card review and explicit refresh.

Final evidence after the last source edit:

- `npm run test:e2e`: passed, 116/116 tests plus packed Pi discovery and malicious-shadow probes;
- `npm run test:pi-subagents-upgrade -- 0.37.2 --force`: compatible, isolated RPC probe passed, consent declined before spawn;
- `npm audit --omit=dev --audit-level=moderate`: zero vulnerabilities;
- `npm run check:behavior-map:freshness`: passed for 38 canonical files;
- `git diff --check`: passed.

Architecture and security reviews reported no findings. Test review reported three Majors: exact entry-chain equality and unqualified alias hardening were fixed and re-reviewed; the no-live-child concern was traced through pinned runtime source and accepted as a residual external integration gap. DX review's direct-consent ambiguity and panel non-proof disclaimer were fixed; its concrete-example finding did not reproduce against the actual README. Focused test and DX re-reviews reported no remaining Critical or Major.

No live Expert Panel or Socratic child provider call, commit, staging, push, branch change, tag, issue/PR mutation, publication, or deployment occurred. The main remaining risk is probabilistic model compliance and the absence of one provider-backed Socratic child launch; deterministic prompts, schemas, policy, package preflight, and pinned runtime checks cannot prove live model behavior.
