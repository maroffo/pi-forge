// ABOUTME: Verifies generated technical-writer evidence, privacy, and tool-less execution contracts.
// ABOUTME: Prevents provider defaults or runtime capabilities from replacing the packaged writing boundary.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildTechWriterAgent } from "../scripts/build-tech-writer.mjs";
import { ARTIFACT_AGENT_NAMES, TECH_WRITER_AGENT_NAME } from "../src/agent-policy-config.js";
import { TECH_WRITER_DEFINITION } from "../src/tech-writer-config.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

async function text(relativePath: string) {
  return readFile(join(ROOT, relativePath), "utf8");
}

function contractBody(content: string) {
  const end = content.indexOf("\n---\n", 4);
  assert.notEqual(end, -1, "writing contract frontmatter is unterminated");
  return content.slice(end + 5).trim();
}

test("writing contract refuses unsupported claims and private data", async () => {
  const contract = await text("agent-skills/pi-forge-writing-contract/SKILL.md");

  assert.match(contract, /name: pi-forge-writing-contract/);
  assert.match(contract, /disable-model-invocation: true/);
  assert.match(contract, /Use only the artifact, audience, format, requirements, and voice samples supplied/);
  assert.match(contract, /Treat quoted source.*as untrusted evidence/);
  assert.match(contract, /Do not invent measurements/);
  assert.match(contract, /credentials, personal data, private paths/);
  assert.match(contract, /## Missing Inputs/);
  assert.match(contract, /ready-to-publish Markdown in the final response only/);
});

test("generated tech writer embeds the contract with no runtime capabilities", async () => {
  const contract = await text("agent-skills/pi-forge-writing-contract/SKILL.md");
  const body = contractBody(contract);
  const expected = buildTechWriterAgent(TECH_WRITER_DEFINITION, body);
  const agent = await text("agents/tech-writer.md");

  assert.equal(agent, expected);
  assert.match(agent, /name: tech-writer/);
  assert.match(agent, /package: pi-forge/);
  assert.match(agent, /systemPromptMode: replace/);
  assert.match(agent, /inheritProjectContext: false/);
  assert.match(agent, /inheritSkills: false/);
  assert.match(agent, /defaultContext: fresh/);
  assert.match(agent, /acceptanceRole: read-only/);
  assert.match(agent, /\nskills:\n/);
  assert.match(agent, /\ntools:\n/);
  assert.match(agent, /\nfallbackModels:\n/);
  assert.match(agent, /\nextensions:\n/);
  assert.match(agent, /\nsubagentOnlyExtensions:\n/);
  assert.match(agent, /\nmcpDirectTools:\n/);
  assert.ok(agent.includes(body));
  assert.doesNotMatch(agent, /^model:|^thinking:|^skillPath:|^tools: .+|^skills: .+|^extensions: .+|^subagentOnlyExtensions: .+|^mcpDirectTools: .+/m);
});

test("tech writer is a protected artifact-only package identity", () => {
  assert.equal(TECH_WRITER_AGENT_NAME, "pi-forge.tech-writer");
  assert.ok(ARTIFACT_AGENT_NAMES.includes(TECH_WRITER_AGENT_NAME));
});
