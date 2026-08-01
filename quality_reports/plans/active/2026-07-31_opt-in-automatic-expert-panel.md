# Session-Scoped Opt-In Automatic Expert Panel

**Status:** completed
**Origin:** In-session Socratic risk analysis and delegated design choice approved by Max on 2026-07-31
**Base:** `main` at `dff20c8c770eaeb158463c4b8448bf9052818ce0`, preserving all current uncommitted roadmap and Socratic work
**Goal:** Add a default-off, one-shot, session-memory opt-in that lets an evidence-bound Socratic escalation launch one sanitized Expert Panel payload without per-run editing or confirmation, while preserving all existing manual panel paths and preventing recursion, retry, or silent standing consent.

## Analysis (verified 2026-07-31, do not re-derive without new evidence)

### Current behavior

- `convene_expert_panel` accepts a six-field prepared brief under `PREPARED_BRIEF_SCHEMA` at `extensions/second-opinion.ts:69-103`, renders it through `buildSecondOpinionBrief` at `extensions/second-opinion.ts:173`, opens an editor, and uses `confirmDisclosure` at `extensions/second-opinion.ts:439` before the shared launcher emits spawn.
- `launchExpertPanel` at `extensions/second-opinion.ts:462` owns chain integrity, runtime pinning, preflight, ping, confirmation, repeated preflight, RPC spawn, and launched/cancelled/unknown classification. Both the prepared tool and `/expert-panel` command call this launcher at `extensions/second-opinion.ts:530-570`.
- The Socratic skill currently states that invocation does not authorize provider disclosure at `skills/socratic-analysis/SKILL.md:10-14` and requires a separate yes, editable payload, and digest-bound consent at `skills/socratic-analysis/SKILL.md:64-78`.
- Runtime discovery freezes extension commands at `scripts/check-runtime-resources.mjs:324`; focused launcher, cancellation, preflight-drift, and unknown-outcome behavior is exercised in `tests/second-opinion.test.ts`.
- The newly completed Socratic workflow and universal adversarial chain pass 116 repository tests, packed runtime discovery, pinned pi-subagents 0.37.2 compatibility, zero audit vulnerabilities, and Behavior Map structure/freshness.

### Root cause or design gap

The current boundary can only authorize each exact payload immediately before spawn. It has no explicit representation of bounded standing consent, no session-scoped automatic-launch state, no one-shot budget, and no separate automatic tool contract. A model could therefore only approximate automation by violating the documented consent flow. This is falsifiable because the extension registers no automatic command or tool, and the Socratic skill always stops for a separate yes.

### Scope

- In: one `/auto-panel` extension command; one `convene_opt_in_expert_panel` tool; memory-only state reset at session start/reload; one automatic attempt per opt-in; sanitized-payload attestation plus conservative local deny scan; shared launcher reuse; Socratic fallback; docs, runtime discovery, tests, and Behavior Map review.
- Out: persistent user/project settings, multiple automatic calls per opt-in, configurable budgets, recursive escalation, background retry, automatic enablement, exact-payload editor/confirmation in automatic mode, provider/model changes, dependency/version changes, live provider calls, and any claim that local scanning proves privacy.

### Candidate approaches

| Approach | Decision | Evidence and trade-off |
|---|---|---|
| Keep exact-payload confirmation only | Rejected by requested behavior | Safest existing boundary, but does not let a qualifying Socratic recommendation start providers automatically. |
| Unrestricted automatic launch from model judgment | Rejected | Prompt injection, unknown payloads, unbounded cost, and recursion would make a probabilistic classification an unlimited disclosure authority. |
| Persistent project/user auto policy | Rejected | Easy to forget, inherited by future contexts, and difficult to revoke safely. |
| Session-memory, explicit one-shot standing consent | Chosen | Provides true automatic provider spawn after opt-in, but bounds disclosure to one attempt and resets on session start or extension reload. |
| Modify existing manual tool with a skip-confirm flag | Rejected | Invocation parameters could bypass consent and weaken every caller. |
| Separate gated automatic tool reusing the shared launcher | Chosen | Manual contracts remain unchanged; automatic behavior has an explicit capability and independently testable state machine. |

### Independent opinion

Not run. This plan changes the provider-disclosure mechanism itself and no multi-provider planning disclosure was authorized. Fresh local architecture, security, test, and DX reviewers will receive a self-contained artifact after implementation.

## Locked decisions

| # | Decision | Choice | Evidence/rationale | Revisit if |
|---|---|---|---|---|
| 1 | Automation mode | True provider launch without per-run confirmation after explicit standing opt-in | Max clarified that automatic means provider calls and delegated the bounded design choice | Product requirement changes back to guarded preflight only |
| 2 | Default | Disabled | No standing consent may be inferred | Never |
| 3 | Lifetime | In-memory current Pi session/extension instance; reset on session start and `/reload` | Minimizes forgotten authorization and avoids config writes | Pi exposes a stronger expiring consent primitive |
| 4 | Budget | One automatic attempt per successful enable | Bounds calls, recursion, and uncertain outcomes | Measured demand justifies a separately reviewed budget design |
| 5 | Enablement | User invokes `/auto-panel enable` and accepts a disclosure explaining unknown future payload, five calls, fixed providers, no editor, heuristic scanning, and irrevocability after spawn | Standing consent must be explicit and interactive | Pi adds native scoped capability grants |
| 6 | Disable/status | `/auto-panel disable` and `/auto-panel status` | Reversible before spawn and observable | None |
| 7 | Data class | Automatic tool requires literal `classification: sanitized` | Makes the parent's claim explicit without pretending it is proof | A deterministic provenance/classification system exists |
| 8 | Local guard | Reject obvious credentials, private keys, personal email, and private absolute paths before consuming the one-shot grant | Reduces clear mistakes; documented as incomplete heuristic | A reviewed data-loss-prevention engine replaces it |
| 9 | State consumption | Consume grant before entering shared launch; any attempted launch, failure, cancellation, or unknown outcome requires explicit re-enable | Prevents retry after uncertain spawn and concurrent duplicate calls | Launcher exposes atomic pre-spawn/post-spawn receipts |
| 10 | Recursion | No automatic re-enable and one-shot state prevents recursive panel chains | Hard budget is stronger than prompt instruction alone | None |
| 11 | Manual paths | `/second-opinion`, `convene_expert_panel`, and `/expert-panel` remain byte-for-byte consent-equivalent | Automation must not weaken existing users | A separate approved migration changes manual consent |
| 12 | Socratic fallback | After a recommendation, try automatic tool only when standing mode is enabled; disabled/rejected mode returns to the current separate-yes manual flow | Preserves safe usability without silent downgrade to disclosure | None |
| 13 | External effects | Development and tests never enable a live provider call | User authorized source work, not provider disclosure | Separate exact live-test consent is given |

## Acceptance criteria

- [x] `/auto-panel status`, `enable`, and `disable` are strict commands; unknown or extra arguments fail visibly.
- [x] Enablement requires interactive confirmation that names all fixed providers, OpenAI synthesis, five calls, one-shot scope, no per-run editor/confirmation, heuristic scan limitations, and inability to stop already emitted calls.
- [x] Decline, headless mode, new session, and extension reload leave automatic mode disabled.
- [x] One accepted enable grants exactly one automatic attempt; state changes to consumed before launcher work and cannot be reused after success, failure, cancellation, abort, or unknown acknowledgement.
- [x] `convene_opt_in_expert_panel` uses the same substantive prepared-brief validation and exact generated adversarial chain as manual paths but requires `classification: sanitized`.
- [x] Disabled, consumed, headless, malformed, or locally rejected payloads emit no spawn. A locally rejected payload does not disclose its rejected content in errors.
- [x] The deny scanner is bounded and rejects obvious private keys, credential assignments/tokens, personal email addresses, and private absolute paths; docs state that passing does not prove sanitization.
- [x] Automatic mode performs the same runtime validation, chain digest check, ping, and two isolation preflights as manual mode, but skips editor and per-run confirmation only after the one-shot grant.
- [x] Manual `convene_expert_panel` and `/expert-panel` retain existing editor/confirmation and cancellation behavior without consulting automatic state.
- [x] The Socratic skill still treats analyst recommendation as non-authorizing unless the separate standing grant is enabled; automatic rejection falls back to a separately approved manual path rather than retrying.
- [x] No automatic panel can recursively authorize or trigger another automatic panel.
- [x] Runtime/package checks discover `/auto-panel` and both tools without invoking models; no new persistent file or project setting is created.
- [x] README and contracts explain that automatic launch trades exact-payload consent for bounded standing consent and that the scanner is not a privacy guarantee.
- [x] Behavior Map cards and fingerprints are reviewed and explicitly refreshed after source changes.
- [x] `npm run test:e2e`, pinned 0.37.2 compatibility, audit, freshness, and diff checks pass after the final source edit.
- [x] Independent architecture, security, test, and DX review has no unresolved Critical or Major.

## Workstreams

### W1: Automatic consent state and launcher separation
- Scope: `extensions/second-opinion.ts`, `tests/second-opinion.test.ts`.
- [x] Add a small explicit disabled/enabled/consumed state machine reset on session start.
- [x] Add strict command parsing, interactive standing-consent disclosure, status, disable, and one-shot consumption.
- [x] Refactor the shared launcher so only the new gated path can skip interactive confirmation.

### W2: Payload gate and Socratic integration
- Scope: `extensions/second-opinion.ts`, `skills/socratic-analysis/SKILL.md`, `docs/socratic-analysis.md`, focused tests.
- [x] Require sanitized attestation and bounded deny scan without echoing rejected content.
- [x] Add automatic-tool behavior after a complete recommendation and preserve manual fallback.
- [x] Prove disabled/rejected/consumed paths never spawn and unknown outcome consumes the grant.

### W3: Discovery, docs, Behavior Map, and review
- Scope: `README.md`, `docs/architecture.md`, `docs/second-opinion.md`, runtime/package checks, mapped cards/manifest/fingerprints.
- [x] Discover `/auto-panel` and both tools from the packed artifact without a model call.
- [x] Document standing-consent risks, one-shot semantics, reset, limitations, and manual-path preservation.
- [x] Review mapped source/cards, update locators only if needed, and explicitly refresh fingerprints.
- [x] Run final tests and fresh architecture, security, test, and DX review; fix verified blockers within budget.

## Verification matrix

| # | Surface | Scenario | Expected evidence | Depth |
|---|---|---|---|---|
| 1 | `/auto-panel` | status before enable | disabled, no launch | behavior |
| 2 | `/auto-panel enable` | interactive accept/decline/headless | enabled only after accept | behavior+edge+error |
| 3 | command parser | unknown/extra args | visible failure, unchanged state | edge+error |
| 4 | automatic tool | disabled/consumed | fail closed, zero RPC spawn | behavior+error |
| 5 | automatic tool | safe sanitized brief after enable | exact shared chain, no editor/confirm, one spawn attempt | behavior |
| 6 | one-shot state | second call/concurrent call | rejected before launcher | edge+error |
| 7 | uncertain outcome | spawn ack timeout/abort/error | grant consumed, no retry | edge+error |
| 8 | deny scanner | private key/token/email/private path and safe brief | unsafe rejected without payload echo; safe accepted | behavior+edge+error |
| 9 | session lifecycle | session_start/reload equivalent | reset disabled | behavior |
| 10 | manual tool | edit, confirm, decline, headless | unchanged existing behavior | regression |
| 11 | immediate command | direct artifact | unchanged digest confirmation | regression |
| 12 | Socratic skill | recommend with mode enabled/disabled/rejected | automatic call only with standing grant; otherwise separate yes | behavior+edge+error |
| 13 | packed runtime | extension command/tool discovery | exact origin, no model call | integration |
| 14 | Behavior Map | canonical source drift | mapped structure and explicit freshness | behavior+error |
| 15 | compatibility | pinned runtime | E2E and isolated consent cancellation remain green | integration |

**Coverage:** 15/15 identified paths. Gap: no provider-backed automatic call is executed; local tests stop at RPC spawn acknowledgement or cancellation.

**Exhaustiveness rationale:** The matrix crosses state (disabled, enabled, consumed), entry (manual prepared, manual direct, automatic), payload (safe, malformed, rejected), UI (interactive, declined, headless), and outcome (pre-spawn failure, launched, unknown) without multiplying equivalent string fixtures.

## Review plan

- Routed agents: `pi-forge.architecture-reviewer`, `pi-forge.security-reviewer`, `pi-forge.test-reviewer`, `pi-forge.dx-reviewer` on the current provider.
- Artifact: exact state machine and command/tool source; scanner patterns and bounds; launcher refactor; Socratic contract; focused tests and final outputs; explicit no-live-call gap.
- Gate: parent verifies every Critical/Major against source and executable evidence before fixing.

## Budget

- Fix rounds: 3.
- Delegated launches: 4 final reviewers; parent remains sole writer after the prior writer timeout.
- Writer concurrency: 1.
- Final evidence: `npm run test:e2e`; `npm run test:pi-subagents-upgrade -- 0.37.2 --force`; `npm audit --omit=dev --audit-level=moderate`; Behavior Map structure/freshness; `git diff --check`; status.

## Risks and rollback

- Risk: standing consent is less informed than exact-payload consent. Mitigation: default off, memory-only, explicit warning, sanitized-only attestation, one shot.
- Risk: scanner false negatives. Mitigation: never call it proof; keep patterns bounded and fail closed for obvious indicators.
- Risk: model mislabels sensitive data as sanitized. Mitigation: explicit prompt contract and standing-consent warning; residual cannot be eliminated without exact review.
- Risk: duplicate calls after uncertainty. Mitigation: consume before launcher and require explicit re-enable.
- Risk: manual boundary regression. Mitigation: separate tool plus complete existing regression matrix.
- Rollback: remove automatic command/tool and restore Socratic separate-yes wording; retain manual panel implementation and all unrelated dirty-tree work.

## External side effects

- Source edits and local tests only.
- No provider call, commit, staging, push, branch change, tag, publication, deployment, or persistent setting authorized.

## Progress

- [x] Requirements and bounded design
- [x] User delegated design and implementation
- [x] W1 automatic state and launcher separation
- [x] W2 payload gate and Socratic integration
- [x] W3 discovery, docs, Behavior Map, final review

## Surprises and discoveries

- Exact-payload consent cannot coexist with true automatic provider launch. The chosen mode explicitly replaces it with one-shot standing consent rather than hiding that trade-off.
- A grant flag alone was insufficient provenance. Architecture review showed that a complete recommendation could become sticky and later authorize an unrelated brief. The final design mints a separate receipt from the exact protected tool-result input plus task/output digest.
- Receipt lifetime also needed a parent-run boundary. Pi's `input` event is the correct delimiter: it fires on a new user prompt but not between internal LLM turns after tool results, so automatic launch can follow the analyst while stale recommendations cannot cross user turns.
- Sequential one-shot tests were insufficient evidence. The final harness pauses the first real preflight, invokes the automatic tool concurrently, and proves the second call sees consumed before any spawn.
- Payload-policy rejection intentionally leaves the standing grant enabled but consumes the recommendation receipt. Correcting a rejected brief therefore requires a new protected Socratic recommendation, preventing a stale result from authorizing arbitrary redrafts.

## Execution decisions

| # | Decision | Evidence | Effect |
|---|---|---|---|
| 1 | Keep automatic state in extension memory only | Persistent standing consent would be easy to forget and inherit | New session and `/reload` reset to disabled; no settings file is written. |
| 2 | Require a direct protected Socratic result, not a model-supplied trigger label | The automatic tool is globally visible to the parent model | Tool-result input must match the exact safe protected invocation and output must contain heading-level complete/recommend. |
| 3 | Replace readiness boolean with a one-attempt receipt | Architecture review found stale/unrelated brief authorization | Exact task and result are digested; receipt is consumed on the first tool attempt and joined to final payload digest in a launch binding. |
| 4 | Clear receipt on Pi `input` | Internal tool follow-up needs the receipt, but a new user turn must not | The current agent run can auto-launch; later prompts require a fresh analysis. |
| 5 | Consume grant synchronously before first launcher await | Test review found sequential tests could miss duplicate concurrency | Overlapping second calls observe consumed; uncertain and known failures require explicit re-enable. |
| 6 | Keep scanner rejection pre-launch but consume receipt | Scanner false positives should not spend provider budget, while sticky recommendation is unsafe | Grant remains enabled, no RPC occurs, and a corrected automatic attempt needs a new protected recommendation. |
| 7 | Preserve manual entry points unchanged | Automatic consent is deliberately weaker and must not become a hidden flag | Manual tool still edits and confirms; direct command still confirms exact digest and providers. |

## Outcomes and retrospective

The default-off automatic mode is implemented without a live provider call.

- `/auto-panel enable` presents a native one-shot standing-consent disclosure for one future sanitized payload, fixed providers, five calls, scanner limitations, no per-run editor/confirmation, pre-attempt consumption, reset, and irrevocability after spawn.
- `/auto-panel status` reports actionable disabled, awaiting recommendation, current-run pending, or consumed state. `/auto-panel disable` revokes an unused grant.
- Only an exact direct package-qualified protected Socratic result produced while enabled can mint a receipt. Wrong tools, aliases, extra invocation fields, prose near-misses, errors, needs-evidence, and do-not-recommend results cannot mint or preserve one.
- The receipt is valid only in the current parent agent run, is consumed by the first automatic attempt, and is bound with the final brief digest for local audit. The standing grant is consumed synchronously before shared launcher work, preventing concurrent reuse and retry after unknown state.
- The automatic path uses the same canonical adversarial chain, runtime pin, ping, and two isolation preflights as manual paths. It intentionally skips only exact-payload editing and confirmation under standing consent.
- The local scanner rejects obvious private keys, credentials/tokens, personal emails, and private home paths without echoing content. Documentation explicitly states that it and the model's sanitized classification are not privacy guarantees.
- Manual `/second-opinion`, `convene_expert_panel`, and `/expert-panel` retain their existing consent behavior.

Final evidence after the last source edit:

- `npm run test:e2e`: passed, 124/124 tests plus packed runtime discovery;
- `npm run test:pi-subagents-upgrade -- 0.37.2 --force`: compatible, isolated RPC consent probe passed without provider spawn;
- `npm audit --omit=dev --audit-level=moderate`: zero vulnerabilities;
- Behavior Map structure: 2 behaviors and 41 discovered surfaces;
- Behavior Map freshness: 38 canonical files;
- `git diff --check`: passed.

Architecture review found sticky and cross-turn receipt defects; both were fixed and re-reviewed with no remaining Critical/Major. Test review found concurrency, provenance near-miss, freshness, and confirmation-exception gaps; all received executable tests and focused re-review reported no Critical/Major. Security review reported no implementation finding and explicitly retained scanner false negatives, weaker future-payload consent, semantic prompt injection, and no post-spawn revocation as accepted residuals. DX review's status clarity Minor was fixed; re-review reported no finding.

No provider call, commit, staging, push, branch change, tag, publication, deployment, or persistent setting occurred. The principal remaining risk is intentional: one standing grant can disclose sensitive content that both the parent model and heuristic scanner misclassify as sanitized.
