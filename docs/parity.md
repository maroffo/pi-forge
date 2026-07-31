# Functional Parity

| Capability | Claude Forge source | Pi Forge mechanism | Status |
|---|---|---|---|
| Working agreement | `CLAUDE.md.example` | `AGENTS.md.example` | Initial template |
| Second opinion | `skills/second-opinion/` | parent brief-building skill, guarded panel tool, immediate `/expert-panel`, agents, and chain | Implemented and live-validated |
| Source control | `skills/source-control/`, `skills/commit/` | canonical skill plus `/commit` prompt alias | Implemented |
| Requirements refinement | `skills/refine-requirements/` | conversational Pi skill | Implemented |
| Implementation writer | `agents/software-engineer/` | scoped package agent plus internal contract skill | Implemented |
| Technical writer | `agents/tech-writer/` | protected artifact-only package agent plus compiled private contract | Implemented |
| Scoring | `skills/score/`, score hooks | deterministic extension command with Git-local history | Implemented |
| Orchestration | `skills/orchestrator/` | bounded parent protocol plus protected writer and artifact-only reviewers | Implemented |
| Implementation planning | `skills/plan-forge/` | evidence-backed ExecPlan and `/orchestrator` handoff | Implemented |
| Pull-request review | `skills/pr-review/` | throwaway clone, commit narrative, protected review fleet, and execution consent gate | Implemented |
| Review fleet | `agents/*-reviewer/` | seven thin package agents plus one private evidence contract | Implemented |
| Enforcement hooks | `hooks/` | Pi lifecycle extension for Git, sensitive paths, and fresh verification | Implemented |
| Session telemetry | `harness-trace` | sanitized custom-entry metrics plus active-branch JSONL extractor | Implemented |

Parity means equivalent outcomes and safety invariants. It does not require identical files, commands, or runtime APIs.
