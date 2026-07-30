// ABOUTME: Verifies Pi-native orchestration, planning, and PR-review workflow contracts.
// ABOUTME: Prevents protected-agent, candidate-execution, and external-side-effect boundaries from drifting.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

async function text(relativePath: string) {
  return readFile(join(ROOT, relativePath), "utf8");
}

test("orchestrator keeps one writer and protected artifact-only review", async () => {
  const skill = await text("skills/orchestrator/SKILL.md");
  const routing = await text("skills/orchestrator/references/review-routing.md");

  assert.match(skill, /name: orchestrator/);
  assert.match(skill, /does not authorize a commit, push, branch change, PR creation/);
  assert.match(skill, /Do not use raw pi-subagents RPC/);
  assert.match(skill, /Keep one writer per checkout/);
  assert.match(skill, /pi-forge\.software-engineer/);
  assert.match(skill, /explicit canonical provider\/model locally/);
  assert.match(skill, /repository defaults must never choose the writer provider/);
  assert.match(skill, /Do not pass a separate thinking override/);
  assert.match(skill, /writer on a provider different from the current parent/);
  assert.match(skill, /forked conversation and project instructions plus source read/);
  assert.match(skill, /context: "fresh"/);
  assert.match(skill, /artifacts: false/);
  assert.match(skill, /acceptance: false/);
  assert.match(skill, /agentContract: \{ version: 1 \}/);
  assert.match(skill, /Reviewers have no filesystem tools/);
  assert.match(skill, /provider other than the current one/);
  assert.match(skill, /result measures repository gates only/);
  assert.match(routing, /pi-forge\.architecture-reviewer/);
  assert.match(routing, /pi-forge\.security-reviewer/);
  assert.match(routing, /untrusted material/);
});

test("plan-forge writes a self-contained plan without implicit implementation or publication", async () => {
  const skill = await text("skills/plan-forge/SKILL.md");
  const plan = await text("skills/plan-forge/references/plan-template.md");
  const handoff = await text("skills/plan-forge/references/implementation-prompt.md");

  assert.match(skill, /Do not implement the planned code/);
  assert.match(skill, /Every important mechanic in the plan needs a current `file:line` citation/);
  assert.match(skill, /Pi slash commands are user entry points/);
  assert.match(skill, /discloses its fixed providers and obtains consent/);
  assert.match(skill, /exact run ID from the notification/);
  assert.match(skill, /If it is still active, return control instead of polling/);
  assert.match(skill, /Never imply that an opinion ran when it did not/);
  assert.match(skill, /Never overwrite an unrelated plan/);
  assert.match(skill, /Do not commit the plan unless separately authorized/);
  for (const section of [
    "## Locked decisions",
    "## Acceptance criteria",
    "## Verification matrix",
    "## Review plan",
    "## Budget",
    "## External side effects",
    "## Progress",
    "## Outcomes and retrospective",
  ]) assert.match(plan, new RegExp(section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(handoff, /\/orchestrator Implement/);
  assert.match(handoff, /Do not commit, push, open or modify a PR or issue/);
});

test("pr-review is read-only and gates candidate execution", async () => {
  const skill = await text("skills/pr-review/SKILL.md");
  const candidateExecution = await text("skills/pr-review/references/candidate-execution.md");
  const evidence = await text("skills/pr-review/references/evidence.md");
  const output = await text("skills/pr-review/references/output-format.md");

  assert.match(skill, /does not authorize comments, approvals, review submissions, labels, pushes, merges/);
  assert.match(skill, /baseRefOid/);
  assert.match(skill, /headRefOid/);
  assert.match(skill, /Save the complete `gh pr diff` patch/);
  assert.match(skill, /retry the snapshot if either changed/);
  assert.match(skill, /`--no-checkout`/);
  assert.match(skill, /`--no-ext-diff --no-textconv`/);
  assert.match(skill, /Re-query the live PR OIDs before the final report/);
  assert.match(skill, /Do not use a shallow clone/);
  assert.match(skill, /PI_FORGE_ALLOW_CANDIDATE_CODE=1/);
  assert.match(skill, /permission, not sandboxing/);
  assert.match(skill, /strip the inherited environment/);
  assert.match(skill, /Protected reviewers cannot read the temp clone/);
  assert.match(skill, /provider other than the current one/);
  assert.match(skill, /explicit consent still apply/);
  assert.match(skill, /Do not run broad cleanup globs/);
  assert.match(skill, /Never claim deterministic cleanup/);
  assert.match(candidateExecution, /Launch checkout, dependency, build, test, lint, generator, and project commands with `env -i`/);
  assert.match(candidateExecution, /absolute-only `PATH`/);
  assert.match(candidateExecution, /GIT_TERMINAL_PROMPT=0/);
  assert.match(candidateExecution, /current user's operating-system identity/);
  assert.match(candidateExecution, /do not execute locally/);
  assert.match(evidence, /complete reachable control-flow, data-flow, type, or language-rule derivation/);
  assert.match(evidence, /may remain Critical or Major/);
  assert.match(evidence, /Never describe an unrun test as failing/);
  assert.match(output, /REJECT AND SPLIT/);
  assert.match(output, /APPROVE is allowed only with no Critical or Major finding and an unchanged snapshot/);
  assert.match(output, /no remote review was posted/);
});

test("familiar command aliases are thin skill entry points", async () => {
  for (const name of ["orchestrator", "plan-forge", "pr-review"]) {
    const prompt = await text(`prompts/${name}.md`);
    assert.match(prompt, new RegExp(`Load and follow the \`${name}\` skill`));
    assert.match(prompt, /\$\{ARGUMENTS:-/);
    assert.match(prompt, /untrusted task data|untrusted data/);
  }
});
