# Functional Parity

Pi Forge targets equivalent outcomes and safety invariants through Pi-native mechanisms. It does not copy Claude Code files, hooks, runtime APIs, personal workflows, or domain catalogs merely to increase a parity count.

## Implemented

| Capability | Claude Forge source | Pi Forge mechanism | Status |
|---|---|---|---|
| Working agreement | `CLAUDE.md.example` | installable `AGENTS.md.example` | Initial portable template |
| Socratic analysis | `skills/refine-requirements/`, `skills/second-opinion/` | parent-owned one-question workflow, protected artifact-only analyst, manual fallback, one-shot session consent, and persistent trusted-project panel autonomy | Implemented |
| Second opinion | `skills/second-opinion/` | parent brief-building skill, guarded and persistent panel tools, correlated await, proof-gated retry, immediate `/expert-panel`, common adversarial role, agents, and chain | Implemented and locally validated |
| Source control | `skills/source-control/`, `skills/commit/` | canonical skill plus `/commit` prompt alias | Implemented |
| Requirements refinement | `skills/refine-requirements/` | conversational Pi skill | Implemented |
| Implementation writer | `agents/software-engineer/` | scoped package agent plus internal contract skill | Implemented |
| Technical writer | `agents/tech-writer/` | protected artifact-only package agent plus compiled private contract | Implemented |
| Scoring | `skills/score/`, score hooks | deterministic extension command with Git-local history | Implemented |
| Project quality-gate onboarding | `skills/project-checks/` | public read-only metadata inspector plus parent-reviewed Make proposal | Implemented |
| Orchestration | `skills/orchestrator/` | bounded parent protocol plus protected writer and artifact-only reviewers | Implemented |
| Implementation planning | `skills/plan-forge/` | evidence-backed ExecPlan and `/orchestrator` handoff | Implemented |
| Pull-request review | `skills/pr-review/` | throwaway clone, commit narrative, protected review fleet, execution consent gate, and idempotent full `COMMENT` review with verified inline findings | Implemented |
| Review fleet | `agents/*-reviewer/` | seven thin package agents plus one private evidence contract | Implemented |
| Enforcement hooks | `hooks/` | Pi lifecycle extension for Git, sensitive paths, and fresh verification | Implemented |
| Session telemetry | `harness-trace` | sanitized schema-v2 custom-entry metrics, active-branch extraction, and explicit-input cohort aggregation | Implemented |
| Harness evolution | `harness-mechanic` | project-only aggregate-first audit and falsifiable change contract, without automatic mutation | Implemented |
| Release workflow | `skills/releasing-software/` | project-only phased preflight, ordinary-command guard, reconciliation, and recovery | Implemented for Pi Forge maintainers |

## Reused rather than bundled

| Capability | Source of capability | Pi Forge decision | Status |
|---|---|---|---|
| Language and framework guidance | Compatible external skill directories | Load the relevant skill separately instead of duplicating a broad catalog in Pi Forge | Reused |
| Generic research and repository reconnaissance | Pi built-in `researcher`, `scout`, and `context-builder` agents | Use runtime roles rather than package-qualified copies | Reused |
| ADR, writing, and specialist workflows | Portable project or user skills where their tool assumptions hold | Keep them independent from the engineering harness core | Reused selectively |

## Deferred pending evidence

| Capability | Reason for deferral | Revisit condition | Status |
|---|---|---|---|
| Whole-harness Behavior Map | Current project-only pilot maps two workflows and lexical discovery cannot prove semantic completeness | At least three documented planning uses show acceptable recall, navigation cost, and maintenance effort | Deferred |
| Deterministic reviewer routing or launch-budget guard | Current orchestrator already declares routing and budgets; no repeated miss is measured | Cohort or review evidence shows skipped domains, unjoined reviewers, or recurring budget overruns | Deferred |
| Edit freeze boundary | One-writer plans and scoped tasks already reduce spill, while a focus guard would not be a security boundary | Repeated out-of-scope edits demonstrate value | Deferred |
| Browser-driven frontend verification | Requires project-specific browser/runtime tooling and real UI flows | A portable Pi execution boundary and representative projects are available | Deferred |
| Rich semantic telemetry | Paths, commands, findings, or workflow labels would weaken the current privacy contract | A concrete evaluation cannot be falsified with aggregate fields and a separately reviewed disclosure design exists | Deferred |

## Not applicable to the package core

| Claude Forge surface | Reason | Status |
|---|---|---|
| Personal vault, email, publishing, image, and task integrations | User-specific product workflows, credentials, and data are outside a portable coding harness | Not applicable |
| Claude Code hook file parity | Pi extensions provide different lifecycle and trust APIs | Not applicable |
| Claude-specific context watcher and compact-resume hooks | Pi owns session compaction and lifecycle semantics; copying the hook protocol would duplicate runtime behavior | Not applicable |
| File-for-file agent and rule catalogs | Pi Forge packages roles only when they add a distinct protected contract or workflow outcome | Not applicable |
