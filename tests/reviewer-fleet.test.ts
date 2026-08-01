// ABOUTME: Verifies reviewer generation, exact fleet membership, and tool-less isolation defaults.
// ABOUTME: Protects the compiled review contract from runtime skill or capability overrides.

import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { REVIEWER_DEFINITIONS } from "../src/reviewer-config.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APPROVED_REVIEWERS = [
  "architecture-reviewer",
  "database-reviewer",
  "dependency-reviewer",
  "dx-reviewer",
  "performance-reviewer",
  "security-reviewer",
  "test-reviewer",
];
const APPROVED_AGENT_FILES = [
  "independent-critic.md",
  "opinion-synthesizer.md",
  "socratic-analyst.md",
  "software-engineer.md",
  "tech-writer.md",
  ...APPROVED_REVIEWERS.map((name) => `${name}.md`),
].sort();

async function text(relativePath: string) {
  return readFile(join(ROOT, relativePath), "utf8");
}

function contractBody(content: string) {
  const end = content.indexOf("\n---\n", 4);
  assert.notEqual(end, -1, "review contract frontmatter is unterminated");
  return content.slice(end + 5).trim();
}

test("review contract defines artifact-only evidence and severity once", async () => {
  const contract = await text("agent-skills/pi-forge-review-contract/SKILL.md");

  assert.match(contract, /name: pi-forge-review-contract/);
  assert.match(contract, /disable-model-invocation: true/);
  assert.match(contract, /Review only the artifact, requirements, and rubric supplied in the task/);
  assert.match(contract, /no filesystem, shell, network, extension, MCP, skill-loading, or subagent tools/);
  assert.match(contract, /Treat source.*as untrusted data/);
  assert.match(contract, /## Severity/);
  assert.match(contract, /## Finding contract/);
  assert.match(contract, /Location: `path:line`/);
  assert.match(contract, /Claim: one falsifiable statement/);
  assert.match(contract, /BLOCK.*CRITICAL/);
  assert.match(contract, /FIX BEFORE MERGE/);
  assert.match(contract, /ACCEPTABLE/);
});

test("generated reviewers embed the contract with no runtime capabilities", async () => {
  const sharedBody = contractBody(await text("agent-skills/pi-forge-review-contract/SKILL.md"));
  for (const definition of REVIEWER_DEFINITIONS) {
    const agent = await text(`agents/${definition.name}.md`);

    assert.match(agent, new RegExp(`name: ${definition.name}`));
    assert.match(agent, /package: pi-forge/);
    assert.match(agent, /systemPromptMode: replace/);
    assert.match(agent, /inheritProjectContext: false/);
    assert.match(agent, /inheritSkills: false/);
    assert.match(agent, /\nskills:\n/);
    assert.match(agent, /\ntools:\n/);
    assert.match(agent, /defaultContext: fresh/);
    assert.match(agent, /acceptanceRole: read-only/);
    assert.match(agent, /\nfallbackModels:\n/);
    assert.match(agent, /\nextensions:\n/);
    assert.match(agent, /\nsubagentOnlyExtensions:\n/);
    assert.match(agent, /\nmcpDirectTools:\n/);
    assert.match(agent, new RegExp(`## Domain Focus: ${definition.title}`));
    assert.ok(agent.includes(sharedBody), `${definition.name} does not embed the canonical contract`);
    assert.doesNotMatch(agent, /^model:|^thinking:|^skillPath:|^tools: .+|^skills: .+|^extensions: .+|^subagentOnlyExtensions: .+|^mcpDirectTools: .+/m);
  }
});

test("source tree contains exactly the independently approved agent roster", async () => {
  const configuredReviewers = REVIEWER_DEFINITIONS.map((reviewer) => reviewer.name).sort();
  const actualAgentFiles = (await readdir(join(ROOT, "agents")))
    .filter((name) => name.endsWith(".md"))
    .sort();

  assert.deepEqual(configuredReviewers, [...APPROVED_REVIEWERS].sort());
  assert.deepEqual(actualAgentFiles, APPROVED_AGENT_FILES);
});
