// ABOUTME: Verifies Pi-native engineering skills, commit alias, and writer-agent safety contracts.
// ABOUTME: Prevents package discovery and Git authorization semantics from drifting.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

async function text(relativePath: string) {
  return readFile(join(ROOT, relativePath), "utf8");
}

test("package exposes engineering skills and the commit prompt", async () => {
  const manifest = JSON.parse(await text("package.json"));

  assert.deepEqual(manifest.pi.skills, ["./skills"]);
  assert.deepEqual(manifest.pi.prompts, ["./prompts"]);
  assert.ok(manifest.files.includes("agent-skills/"));
  assert.ok(manifest.files.includes("agents/"));
  assert.ok(manifest.files.includes("skills/"));
  assert.ok(manifest.files.includes("prompts/"));
});

test("source-control defines narrow commit and push authorization", async () => {
  const skill = await text("skills/source-control/SKILL.md");

  assert.match(skill, /name: source-control/);
  assert.match(skill, /authorization for one local commit only/);
  assert.match(skill, /Treat an existing index as protected/);
  assert.match(skill, /file containing mixed task and unrelated hunks/);
  assert.match(skill, /git apply --cached --check/);
  assert.match(skill, /never use `git add -A`, `git add \.`/);
  assert.match(skill, /scripts\/commit-gate\.sh/);
  assert.match(skill, /invoking `git commit` directly does not satisfy this workflow/);
  assert.match(skill, /hook bypasses such as `--no-verify`/);
  assert.match(skill, /Do not push unless separately authorized/);
  assert.match(skill, /main` or `master`/);
  assert.doesNotMatch(skill, /\bMax\b|Development\/private|make check/);
});

test("commit prompt is a thin source-control alias", async () => {
  const prompt = await text("prompts/commit.md");

  assert.match(prompt, /Load and follow the `source-control` skill/);
  assert.match(prompt, /Create exactly one local commit/);
  assert.match(prompt, /\$\{ARGUMENTS:-/);
  assert.match(prompt, /does not authorize a push/);
  assert.match(prompt, /never stage a whole mixed file/);
  assert.match(prompt, /scripts\/commit-gate\.sh/);
  assert.match(prompt, /Never invoke `git commit` directly/);
  assert.doesNotMatch(prompt, /git add -A|--no-verify/);
});

test("requirements refinement uses conversational Pi semantics", async () => {
  const skill = await text("skills/refine-requirements/SKILL.md");

  assert.match(skill, /Bug fix or refactor \| Hold Scope silently/);
  assert.match(skill, /Feature \| Ask once: Hold Scope, Selective Expansion, or Reduction/);
  assert.match(skill, /Ask one focused question at a time/);
  assert.match(skill, /## Decisions/);
  assert.match(skill, /## Deferred Ideas/);
  assert.match(skill, /## Open Questions/);
  assert.doesNotMatch(skill, /AskUserQuestion|\bClaude\b|\bMax\b/);
});

test("software-engineer is the sole scoped writer and loads the shared contract", async () => {
  const agent = await text("agents/software-engineer.md");
  const contract = await text("agent-skills/pi-forge-implementation-contract/SKILL.md");

  assert.match(agent, /name: software-engineer/);
  assert.match(agent, /package: pi-forge/);
  assert.match(agent, /acceptanceRole: writer/);
  assert.match(agent, /inheritProjectContext: true/);
  assert.match(agent, /inheritSkills: false/);
  assert.match(agent, /skills: pi-forge-implementation-contract/);
  assert.match(agent, /skillPath: \.\.\/agent-skills\/pi-forge-implementation-contract/);
  assert.match(agent, /\nfallbackModels:\n/);
  assert.match(agent, /\nextensions:\n/);
  assert.match(agent, /\nsubagentOnlyExtensions:\n/);
  assert.match(agent, /\nmcpDirectTools:\n/);
  assert.match(agent, /Do not launch subagents/);
  assert.match(contract, /disable-model-invocation: true/);
  assert.match(contract, /sole writer/);
  assert.match(contract, /Do not commit or push unless the task explicitly authorizes it/);
  assert.match(contract, /A stale, failed, or pre-edit result is not evidence/);
});
