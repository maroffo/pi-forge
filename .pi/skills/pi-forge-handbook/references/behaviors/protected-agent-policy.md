# Protected Agent Policy

## Purpose

Prevent shadowed, capability-modified, delayed, or unsafely resumed launches of Pi Forge writers and artifact-only agents before the subagent tool can execute them.

## Triggers

The policy observes parent `subagent` tool calls and results. Immediate single, parallel, and chain inputs may contain protected agents. Resume calls consume prior run attestations. Session start restores sanitized attestations from custom entries.

## Inputs

Launch inputs include agent identity, task, discovery root, context, model, execution mode, capability fields, and persistence fields. Effective-contract preflight supplies resolved package source, model candidates, prompt mode, skills, tools, extensions, MCP state, and runtime protocol version.

## Outputs

Unsafe launches return a blocking reason before spawn. Accepted launch calls remain pending until a correlated tool result supplies a canonical foreground or async run identity. Safe generic resume may proceed; protected, mixed, stale, prefix-like, directory-addressed, or otherwise unattested resume fails closed.

## State transitions

`protected-launch-collector` normalizes supported invocation shapes. `protected-launch-validator` checks invocation fields and compares effective contracts with the package baseline. `agent-policy-extension` records pending classifications, persists results, restores entries, and routes resume through `protected-resume-validator`.

## Exceptional paths

Runtime configuration read failure, forced top-level async, missing model, modified package source, fallback candidates, inherited skills, added tools or extensions, custom destinations, output persistence, the unqualified Socratic alias, delayed execution, and unsafe resume block. A true protected resume remains unavailable until the upstream atomic contract exists.

## Source of truth

Identity definitions live at `reviewer-agent-names`, `tech-writer-agent-name`, `socratic-analyst-agent-name`, `artifact-agent-names`, and `writer-agent-name`. `socratic-analyst-agent` is an authored artifact-only definition, while `socratic-analysis-skill` owns its safe parent launch contract. Effective enforcement lives at `protected-launch-collector`, `protected-launch-validator`, `protected-resume-validator`, and `agent-policy-extension`. `lifecycle-writer-agent` and `telemetry-writer-input` are coupled literal consumers that require review when the writer identity changes.

## Generated artifacts

Reviewer agents are generated from canonical reviewer definitions and the private review contract. The technical writer is generated from its canonical definition and private writing contract. Existing generator checks remain authoritative. The Socratic analyst, implementation writer, and implementation private contract are canonical authored inputs.

## Tests

Agent-policy tests cover input shapes, Socratic identity and override rejection, package baselines, runtime configuration, attestations, reload, async source identity, and resume. Socratic, engineering, reviewer, technical-writer, lifecycle, orchestration, and runtime probes cover coupled contracts and package discovery.

## Registers

- `pi-subagents-version`
- `protected-agent-identities`
- `run-attestations`

## Locators

- `reviewer-agent-names`
- `tech-writer-agent-name`
- `socratic-analyst-agent-name`
- `socratic-analyst-agent`
- `socratic-analysis-skill`
- `artifact-agent-names`
- `writer-agent-name`
- `protected-launch-collector`
- `protected-launch-validator`
- `protected-resume-validator`
- `agent-policy-extension`
- `run-attestation-entry`
- `lifecycle-writer-agent`
- `telemetry-writer-input`
- `reviewer-definitions`
- `tech-writer-definition`
- `implementation-contract-skill`
- `review-contract-skill`
- `writing-contract-skill`
- `protected-review-contract`
- `package-runtime-version`
- `lock-runtime-version`
