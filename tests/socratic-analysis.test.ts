// ABOUTME: Verifies the public Socratic workflow, artifact-only analyst contract, and explicit escalation boundary.
// ABOUTME: Protects one-question clarification and prevents child-owned Expert Panel disclosure.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  ARTIFACT_AGENT_NAMES,
  SOCRATIC_ANALYST_AGENT_NAME,
  SOCRATIC_ANALYST_LOCAL_NAME,
} from "../src/agent-policy-config.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

async function text(relativePath: string) {
  return readFile(join(ROOT, relativePath), "utf8");
}

test("Socratic prompt is a thin alias for the parent-owned public skill", async () => {
  const [prompt, skill] = await Promise.all([
    text("prompts/socratic-analysis.md"),
    text("skills/socratic-analysis/SKILL.md"),
  ]);

  assert.match(prompt, /Load and follow the `socratic-analysis` skill/);
  assert.match(prompt, /\$\{ARGUMENTS:-/);
  assert.match(prompt, /parent in control/);
  assert.match(skill, /name: socratic-analysis/);
  assert.match(skill, /ask exactly one focused question and stop the turn/);
  assert.match(skill, /Call `subagent` once/);
  assert.match(skill, /pi-forge\.socratic-analyst/);
  assert.match(skill, /`context`: `fresh`/);
  assert.match(skill, /`artifacts`: `false`/);
  assert.match(skill, /`acceptance`: `false`/);
  assert.match(skill, /`agentContract`: `\{ "version": 1 \}`/);
  assert.match(skill, /Never shorten the identity to unqualified `socratic-analyst`/);
  assert.match(skill, /protected policy rejects that ambiguous alias before discovery/);
  assert.doesNotMatch(skill, /agent.*invoke[s]? `\/second-opinion`/i);
});

test("Socratic analyst is one protected artifact-only package identity", async () => {
  const agent = await text("agents/socratic-analyst.md");

  assert.equal(SOCRATIC_ANALYST_LOCAL_NAME, "socratic-analyst");
  assert.equal(SOCRATIC_ANALYST_AGENT_NAME, "pi-forge.socratic-analyst");
  assert.ok(ARTIFACT_AGENT_NAMES.includes(SOCRATIC_ANALYST_AGENT_NAME));
  assert.equal(ARTIFACT_AGENT_NAMES.filter((name) => name === SOCRATIC_ANALYST_AGENT_NAME).length, 1);
  assert.match(agent, /name: socratic-analyst/);
  assert.match(agent, /package: pi-forge/);
  assert.match(agent, /systemPromptMode: replace/);
  assert.match(agent, /inheritProjectContext: false/);
  assert.match(agent, /inheritSkills: false/);
  assert.match(agent, /defaultContext: fresh/);
  assert.match(agent, /acceptanceRole: read-only/);
  for (const emptyCapability of [
    "skills", "tools", "fallbackModels", "extensions", "subagentOnlyExtensions", "mcpDirectTools",
  ]) assert.match(agent, new RegExp(`^${emptyCapability}:$`, "m"));
  assert.doesNotMatch(agent, /^model:|^thinking:|^skillPath:|^tools: .+|^skills: .+/m);
});

test("Socratic output contract separates evidence and permits only one material question", async () => {
  const agent = await text("agents/socratic-analyst.md");
  for (const heading of [
    "Thesis",
    "Supplied facts",
    "Inferences",
    "Assumptions",
    "Constraints",
    "Strongest alternative",
    "Falsifiers and discriminating evidence",
    "Reconstructed conclusion",
    "Confidence",
    "Unresolved evidence",
    "Material question",
    "Second Opinion",
  ]) assert.ok(agent.includes(`\`${heading}\``), `missing output heading ${heading}`);
  assert.match(agent, /exactly one focused question/);
  assert.match(agent, /`Status: needs-evidence`/);
  assert.match(agent, /`Status: complete`/);
  assert.match(agent, /`recommend` or `do-not-recommend`/);
  assert.match(agent, /recommendation is not authorization/);
  assert.match(agent, /Never claim to invoke `\/second-opinion`/);
});

test("Socratic escalation uses session or persistent consent and preserves the manual reviewed fallback", async () => {
  const [skill, docs] = await Promise.all([
    text("skills/socratic-analysis/SKILL.md"),
    text("docs/socratic-analysis.md"),
  ]);

  assert.match(skill, /one local eligibility call to `convene_opt_in_expert_panel`/);
  assert.match(skill, /separate unused session grant from `\/auto-panel enable` or persistent trusted-project consent from `\/auto-panel enable persistent`/);
  assert.match(skill, /complete `recommend` result/);
  assert.match(skill, /truthfully classified as sanitized/);
  assert.match(skill, /call `convene_opt_in_expert_panel` exactly once/);
  assert.match(skill, /call `await_expert_panel` with the exact returned `operationId`/);
  assert.match(skill, /model never retries or launches a replacement/);
  assert.match(skill, /launch acknowledgement is unknown, stop/);
  assert.match(skill, /disabled, consumed, blocked after an unknown launch, stale, invalid, untrusted, missing receipt, or payload-policy rejection/);
  assert.match(skill, /ask one separate yes-or-no question about using the manual reviewed Second Opinion path/);
  assert.match(skill, /Never call the automatic tool from a panel result/);
  assert.match(skill, /Only an unambiguous yes after the manual fallback question/);
  assert.match(skill, /editable payload and digest-bound multi-provider consent remain mandatory/);

  assert.match(docs, /`\/auto-panel enable` retains the separate in-memory one-shot session grant/);
  assert.match(docs, /`\/auto-panel enable persistent` is a separate user-level grant/);
  assert.match(docs, /works headlessly/);
  assert.match(docs, /scanner and the model's classification are heuristics, not proof/);
  assert.match(docs, /intentionally skipping per-run editing and digest confirmation/);
  assert.match(docs, /parent calls `await_expert_panel`/);
  assert.match(docs, /stale-reconciled, malformed, unknown, or session-changed outcomes never retry/);
});
