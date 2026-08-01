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

test("Socratic escalation uses one-shot standing consent or preserves the manual reviewed fallback", async () => {
  const [skill, docs] = await Promise.all([
    text("skills/socratic-analysis/SKILL.md"),
    text("docs/socratic-analysis.md"),
  ]);

  assert.match(skill, /one local eligibility call to `convene_opt_in_expert_panel`/);
  assert.match(skill, /separate unused standing grant created interactively with `\/auto-panel enable`/);
  assert.match(skill, /complete `recommend` result/);
  assert.match(skill, /truthfully classified as sanitized/);
  assert.match(skill, /call `convene_opt_in_expert_panel` exactly once/);
  assert.match(skill, /if the tool launches or reports an unknown outcome, stop and never retry/);
  assert.match(skill, /disabled, consumed, headless, or payload-policy rejection/);
  assert.match(skill, /ask one separate yes-or-no question about using the manual reviewed Second Opinion path/);
  assert.match(skill, /Never call the automatic tool from a panel result/);
  assert.match(skill, /Only an unambiguous yes after the manual fallback question/);
  assert.match(skill, /editable payload and digest-bound multi-provider consent remain mandatory/);

  assert.match(docs, /`\/auto-panel enable` offers a separate interactive standing-consent dialog/);
  assert.match(docs, /exactly one automatic provider-launch attempt/);
  assert.match(docs, /scanner is a heuristic, not proof/);
  assert.match(docs, /consumed before preflight/);
  assert.match(docs, /intentionally skips the per-run editor and digest confirmation/);
  assert.match(docs, /Manual `\/second-opinion` and `\/expert-panel` behavior does not use or weaken/);
});
