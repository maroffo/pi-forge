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

test("behavior map remains a project-only source navigator", async () => {
  const manifest = JSON.parse(await text("package.json"));
  const skill = await text(".pi/skills/pi-forge-handbook/SKILL.md");

  assert.ok(manifest.files.every((path: string) => !path.startsWith(".pi")));
  assert.deepEqual(manifest.pi.skills, ["./skills"]);
  assert.match(skill, /location index, not source authority/);
  assert.match(skill, /npm run check:behavior-map:freshness/);
  assert.match(skill, /freeze that card for localization/);
  assert.match(skill, /Never refresh fingerprints automatically/);
  assert.match(skill, /at least three real planning uses/);
});

test("npm release metadata and installation instructions stay explicit", async () => {
  const manifest = JSON.parse(await text("package.json"));
  const lock = JSON.parse(await text("package-lock.json"));
  const readme = await text("README.md");

  assert.equal(manifest.repository.url, "git+https://github.com/maroffo/pi-forge.git");
  assert.equal(manifest.publishConfig.access, "public");
  assert.equal(lock.version, manifest.version);
  assert.equal(lock.packages[""].version, manifest.version);
  const piSubagentsVersion = manifest.dependencies?.["pi-subagents"];
  assert.match(piSubagentsVersion, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  const escapedPiSubagentsVersion = piSubagentsVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(readme, new RegExp(`pi install npm:pi-subagents@${escapedPiSubagentsVersion}`));
  assert.match(readme, /pi install npm:@maroffo\/pi-forge@0\.2\.0/);
  assert.match(readme, /execute extensions with the current user's permissions/);
});

test("Pi Forge release workflow stays project-only, phased, and non-publishing", async () => {
  const manifest = JSON.parse(await text("package.json"));
  const skill = await text(".pi/skills/pi-forge-release/SKILL.md");
  const recovery = await text(".pi/skills/pi-forge-release/references/recovery.md");
  const guard = await text(".pi/extensions/pi-forge-release-guard.ts");
  const helper = await text("scripts/check-release.mjs");

  assert.ok(manifest.files.every((path: string) => !path.startsWith(".pi") && path !== "scripts/"));
  assert.match(skill, /name: pi-forge-release/);
  for (const phase of ["Prepare", "Tag", "Publish", "Verify", "Reconcile"]) {
    assert.match(skill, new RegExp(`## \\d?\\.? ?${phase}`, "i"));
  }
  assert.match(skill, /separate explicit user authorizations|authorization.*independently/is);
  assert.match(skill, /do not retry/i);
  assert.match(recovery, /Never automatically unpublish/);
  assert.match(recovery, /dist-tag/);
  assert.match(recovery, /corrected patch/);
  assert.match(guard, /classifyReleaseCommand/);
  assert.match(guard, /requires interactive confirmation/);
  assert.match(helper, /validateReleaseSnapshot/);
  assert.match(helper, /shell: false/);
});

test("harness audit stays project-only and requires one falsifiable privacy-preserving contract", async () => {
  const manifest = JSON.parse(await text("package.json"));
  const skill = await text(".pi/skills/pi-forge-harness-audit/SKILL.md");
  const template = await text(".pi/skills/pi-forge-harness-audit/references/change-contract-template.md");
  const publicSkill = await text("skills/session-telemetry/SKILL.md");
  const aggregator = await text("skills/session-telemetry/scripts/aggregate-session-traces.mjs");

  assert.ok(manifest.files.every((path: string) => !path.startsWith(".pi")));
  assert.match(skill, /name: pi-forge-harness-audit/);
  assert.match(skill, /5 through 100/);
  assert.match(skill, /assert explicitly.*comparable/is);
  assert.match(skill, /Observations:[\s\S]*Hypotheses:[\s\S]*Evidence gaps:/);
  assert.match(skill, /One contract proposes one harness mutation/);
  assert.match(skill, /Do not read raw Pi session files/);
  assert.match(skill, /Do not edit source/);
  assert.match(skill, /Do not refresh or expand the Behavior Map/);
  assert.match(skill, /proof of causality|Do not claim that.*caused/is);
  assert.match(skill, /Do not expose the artifact to another provider/);
  assert.match(skill, /route it through a separately approved `plan-forge` or orchestrator plan/);
  for (const heading of [
    "Baseline cohort", "Primary hypothesis", "Proposed mutation", "Predicted effect", "Protected invariants",
    "Evidence gaps", "Measurement protocol", "Falsification threshold", "Evaluation cohort", "Rollback", "Approval", "Result",
  ]) assert.match(template, new RegExp(`## ${heading}`));
  assert.match(publicSkill, /5 to 100 regular non-symlink/);
  assert.match(publicSkill, /never emitted or hashed/);
  assert.match(aggregator, /MIN_COHORT_SESSIONS = 5/);
  assert.match(aggregator, /MAX_COHORT_SESSIONS = 100/);
  assert.match(aggregator, /--input/);
});

test("project-checks is a truthful read-only onboarding workflow", async () => {
  const skill = await text("skills/project-checks/SKILL.md");
  const reference = await text("skills/project-checks/references/detection-contract.md");
  const prompt = await text("prompts/project-checks.md");
  const inspector = await text("skills/project-checks/scripts/inspect-project-checks.mjs");

  assert.match(skill, /name: project-checks/);
  assert.match(skill, /untrusted data/);
  assert.match(skill, /Never generate `true`/);
  assert.match(skill, /leave `test-e2e` unresolved/);
  assert.match(skill, /Show the exact proposed diff/);
  assert.match(reference, /evidence: observed/);
  assert.match(reference, /`test` and `test:integration` are not relabelled as E2E/);
  assert.match(prompt, /Load and follow the `project-checks` skill/);
  assert.match(prompt, /Do not execute project code during inspection/);
  assert.match(inspector, /inspectLiteralMakeTargets/);
  assert.doesNotMatch(skill, /git add|git commit|npm install/);
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
