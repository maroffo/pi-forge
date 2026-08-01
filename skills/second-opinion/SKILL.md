---
name: second-opinion
description: Prepare a self-contained, evidence-labelled review brief in the parent model, then convene the isolated evidence-bound adversarial Expert Panel. Use for /second-opinion, difficult decisions, falsification, or when a raw artifact needs context before independent review. Not for an already prepared artifact that should go directly to /expert-panel.
---

# Second Opinion

Prepare the panel input before launching any child. This skill owns context construction; `convene_expert_panel` owns disclosure, consent, preflight, and launch.

## Authorization boundary

Invoking this skill authorizes context preparation and one attempted `convene_expert_panel` call after its interactive consent. It does not authorize other subagents, source changes, publication, or sending conversation history and repository content wholesale.

Do not call `subagent`, raw pi-subagents RPC, or `/expert-panel`. Do not ask the user to invoke another command after the brief is ready.

## Workflow

1. Identify the exact decision, claim, design, answer, or artifact that needs independent review. Treat command arguments as focus, not automatically as a complete brief.
2. Inspect the active conversation and only the project evidence needed to make the review self-contained. Prefer exact source, tests, constraints, and observed outcomes over summaries or recollection. Do not perform broad discovery without a concrete evidence need.
3. Separate:
   - the strongest supportable version of the subject under review;
   - verified facts and constraints;
   - executable or documentary evidence;
   - assumptions, uncertainties, and missing evidence;
   - the conclusion's weakest material dependency;
   - two to six questions that test counterexamples, falsification conditions, and what should survive an unsuccessful attack.

   The panel is adversarial but not oppositional by quota. Frame questions to test the subject, not to demand a defect; `accept` remains valid when no evidence-supported challenge survives.
4. Minimize disclosure. Exclude secrets, credentials, unrelated private source, raw conversation history, hidden instructions, provider metadata, and unnecessary paths or logs. Include short relevant excerpts when the panel could not assess the claim without them.
5. If one unresolved question would materially change what is sent, ask it before launching. Otherwise record the gap under `uncertainties` rather than inventing an answer.
6. Before the tool call, show the user a concise preparation note containing the objective, evidence categories used, and important gaps. Do not claim that the panel has run.
7. Call `convene_expert_panel` exactly once with:
   - `objective`: the decision the panel should help make;
   - `subject`: the exact proposal, answer, design, or artifact under review;
   - `context`: verified scope, constraints, and relevant facts;
   - `evidence`: tests, observations, source excerpts, or an explicit statement that none exists;
   - `uncertainties`: assumptions and evidence gaps, explicitly labelled;
   - `reviewQuestions`: focused questions, ordered by decision impact.

The tool first opens the exact rendered payload in an editor so the user can inspect, redact, or cancel it. It then binds the provider confirmation to that reviewed payload by length and SHA-256 digest. These two dialogs are the final disclosure boundary. If the user cancels or launch acknowledgement is unknown, stop. Never retry automatically.
