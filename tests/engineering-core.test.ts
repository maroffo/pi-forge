// ABOUTME: Verifies Pi-native engineering skills, commit alias, and writer-agent safety contracts.
// ABOUTME: Prevents package discovery and Git authorization semantics from drifting.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  CLAUDE_CONFLICTING_ENVIRONMENT_VARIABLES,
  CLAUDE_LAUNCH_POLICY,
  CLAUDE_REQUIRED_HELP_FLAGS,
  CLAUDE_ROLE_ARGUMENT_TAILS,
} from "../skills/herdr-orchestrator/scripts/prepare-claude-launch.mjs";

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
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.equal(lock.version, manifest.version);
  assert.equal(lock.packages[""].version, manifest.version);
  const piSubagentsVersion = manifest.dependencies?.["pi-subagents"];
  assert.match(piSubagentsVersion, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  const escapedPiSubagentsVersion = piSubagentsVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedPackageVersion = manifest.version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(readme, new RegExp(`pi install npm:pi-subagents@${escapedPiSubagentsVersion}`));
  assert.match(readme, new RegExp(`pi install npm:@maroffo/pi-forge@${escapedPackageVersion}`));
  assert.match(readme, /execute extensions with the current user's permissions/);
});

test("optional Herdr overlay is packaged, documented, and dependency-free", async () => {
  const manifest = JSON.parse(await text("package.json"));
  const packageCheck = await text("scripts/check-package.mjs");
  const runtimeCheck = await text("scripts/check-runtime-resources.mjs");
  const releaseCheck = await text("scripts/check-release.mjs");
  const readme = await text("README.md");
  const architecture = await text("docs/architecture.md");
  const workingAgreement = await text("AGENTS.md.example");

  assert.equal(manifest.dependencies?.["@ogulcancelik/pi-herdr"], undefined);
  for (const resource of [
    "prompts/herdr-orchestrator.md",
    "skills/herdr-orchestrator/SKILL.md",
    "skills/herdr-orchestrator/scripts/prepare-claude-launch.mjs",
  ]) {
    const escaped = resource.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(packageCheck, new RegExp(escaped));
    assert.match(runtimeCheck, new RegExp(escaped));
    assert.match(releaseCheck, new RegExp(escaped));
  }
  assert.match(runtimeCheck, /\["herdr-orchestrator", "prompt"\]/);
  assert.match(runtimeCheck, /\["skill:herdr-orchestrator", "skill"\]/);
  assert.match(runtimeCheck, /assertHerdrOrchestratorPromptExpansion/);
  assert.match(runtimeCheck, /capturePromptBeforeProvider/);
  assert.match(runtimeCheck, /expanded-with-both-skills-and-aborted-before-provider/);
  assert.match(runtimeCheck, /ordinary-and-plain-prompt-text-did-not-explicitly-select-herdr/);

  assert.match(readme, /pi install npm:@ogulcancelik\/pi-herdr@0\.4\.0/);
  assert.match(readme, /Herdr 0\.7\.5 or newer/);
  assert.match(readme, /Herdr support is optional and is not a Pi Forge dependency/);
  assert.match(readme, /never silently falls back/);
  assert.match(readme, /Generic advisory helpers receive only `read`, `grep`, `find`, and `ls`/);
  assert.match(readme, /Peer exchange is parent-mediated only/);
  assert.match(readme, /potentially mutating.*shares the sole writer lease/s);
  assert.match(readme, /does not resend.*inspects the recorded pane once/s);
  assert.match(readme, /writer's `bash` tool can invoke installed Herdr or agent CLIs/);
  assert.match(readme, /does not claim enforcement or path confinement/);
  assert.match(readme, /Automatic pane retirement is the default only for exact workflow-created panes that retain continuous exclusive workflow custody/);
  assert.match(readme, /Users may preserve all created panes or exact created IDs, overriding automatic retirement/);
  assert.match(readme, /freshly resolves the recorded current canonical ID with exact `herdr_pane get`/);
  assert.match(readme, /agent panes also require exact-name `herdr_agent get`/);
  assert.match(readme, /revalidation and close stay adjacent with no unrelated call or user round/);
  assert.match(readme, /move, alias\/canonical-ID change, rename, replacement, reuse, repurposing, external interaction, unexpected foreground\/cwd, or possible concurrent mutation permanently disables automatic close/);
  assert.match(readme, /narrows but cannot eliminate TOCTOU/);
  assert.match(readme, /ambiguous close is never retried and is checked once with exact `herdr_pane get`, never workspace-list absence/);
  assert.match(readme, /Closing never stops work or releases a lease/);
  assert.match(readme, /`no workflow panes remain`/);
  assert.match(readme, /Every package-qualified Pi Forge writer, reviewer, technical writer, or analyst, plus Socratic Analysis, Second Opinion, and Expert Panel, stays on its existing pi-subagents or guarded route/);
  assert.match(architecture, /## Optional Herdr control plane/);
  assert.match(architecture, /active Herdr environment or installed adapter never selects this mode automatically/);
  assert.match(architecture, /Peer coordination is exceptional and parent-mediated only/);
  assert.match(architecture, /potentially mutating.*retains the lease until confirmed stopped/s);
  assert.match(architecture, /prompt-level non-selection by ordinary `\/orchestrator` and plain requests/);
  assert.match(architecture, /do not claim to observe model compliance or runtime tool choice/);
  assert.match(architecture, /invocation-local registry containing each original returned pane ID and aliases, expected current canonical ID, exact workspace\/tab/);
  assert.match(architecture, /caller and foreign panes never enter the cleanup set/);
  assert.match(architecture, /focus, names, globs, broad pane matching, and workspace sweeps never discover targets/);
  assert.match(architecture, /pane moves change the workspace-qualified canonical ID while old IDs can remain aliases/);
  assert.match(architecture, /alias is not durable ownership proof/);
  assert.match(architecture, /permanently ends custody and disables automatic close/);
  assert.match(architecture, /Retirement follows usefulness, evidence, and fresh identity, not historical registry state or terminal lifecycle labels/);
  assert.match(architecture, /exact `herdr_pane get` must return the expected canonical pane, workspace, and every exposed occupant field/);
  assert.match(architecture, /recorded tab is audit-only when the structured result does not expose it/);
  assert.match(architecture, /agent also requires exact-name `herdr_agent get`/);
  assert.match(architecture, /close call follows those checks without an unrelated tool call or user round/);
  assert.match(architecture, /narrows but cannot eliminate TOCTOU/);
  assert.match(architecture, /no generation\/ownership-conditional close/);
  assert.match(architecture, /automatic cleanup assumes a trusted environment with no concurrent local mutation/);
  assert.match(architecture, /Closing is terminal resource lifecycle, not cancellation or lease release/);
  assert.match(architecture, /one exact `herdr_pane get` on the pre-close canonical ID/);
  assert.match(architecture, /Workspace `pane_list` absence is never closure proof/);
  assert.match(architecture, /interactive closure discards context only after the parent owns the complete evidence/);
  assert.match(architecture, /Every package-qualified Pi Forge writer, reviewer, technical writer, and analyst remains on the normal guarded `subagent` path/);
  assert.match(workingAgreement, /Use Herdr only when the user explicitly selects it/);
  assert.match(workingAgreement, /Potentially mutating Herdr process panes share that lease/);
  assert.match(workingAgreement, /peer exchanges.*relayed by the parent only/);
  assert.match(workingAgreement, /Automatically retire only exact workflow-created panes with continuous exclusive custody/);
  assert.match(workingAgreement, /fresh exact canonical `herdr_pane get` revalidation/);
  assert.match(workingAgreement, /agent panes also require exact-name `herdr_agent get`/);
  assert.match(workingAgreement, /Keep revalidation and the one close attempt adjacent/);
  assert.match(workingAgreement, /move, alias\/canonical-ID change, replacement, reuse, repurposing, external interaction, or possible concurrent mutation disables automatic close/);
  assert.match(workingAgreement, /Preserve caller, foreign, user-preserved, active, uncertain, or incomplete panes/);
  assert.match(workingAgreement, /closing never stops work or releases a lease, and it is not atomic ownership enforcement/);
  assert.match(workingAgreement, /trusted writer's shell can invoke installed agent CLIs/);
});

test("direct Claude support stays optional, executable, exact, and route-truthful", async () => {
  const manifest = JSON.parse(await text("package.json"));
  const overlay = await text("skills/herdr-orchestrator/SKILL.md");
  const preflight = await text("skills/herdr-orchestrator/scripts/prepare-claude-launch.mjs");
  const fixtureTests = await text("tests/herdr-claude.test.ts");
  const readme = await text("README.md");
  const architecture = await text("docs/architecture.md");
  const workingAgreement = await text("AGENTS.md.example");

  assert.equal(manifest.dependencies?.["@anthropic-ai/claude-code"], undefined);
  assert.equal(manifest.dependencies?.["claude-code"], undefined);
  assert.match(readme, /canonical Claude Code executable at version 2\.1\.226 or newer, installed and authenticated separately/);
  assert.match(readme, /Pi Forge neither depends on nor installs or authenticates Claude Code/);
  for (const model of CLAUDE_LAUNCH_POLICY.models) assert.ok(readme.includes(model));
  assert.match(readme, /never `fable`, `opus`, another model, or a fallback/);
  assert.match(readme, /capability-read-only helper uses safe mode, `permission-mode plan`, and only `Read,Grep,Glob`/);
  assert.match(readme, /trusted generic writer uses safe mode, `permission-mode acceptEdits`, and only `Read,Grep,Glob,Edit,Write,Bash`/);
  assert.match(readme, /explicit consent is required for every launch/i);
  assert.match(readme, /interactive-session persistence/);
  assert.match(readme, /never emits environment values, raw auth JSON, identity fields, exception details, executable paths, or local paths/);
  assert.match(readme, /no alias, retry, resume, fallback, Pi substitution, or transport switch/);
  assert.match(readme, /direct Claude session is never a protected Pi Forge agent or protected-review substitute/);
  assert.match(readme, /not independent or cryptographic endpoint proof/);
  assert.match(readme, /Never silently fall back to Pi/);
  assert.match(readme, /Propose exact model claude-fable-5 as one capability-read-only helper/);
  assert.match(readme, /Propose exact model claude-opus-5 as the sole trusted generic writer/);
  assert.match(readme, /requests select a proposal only.*do not waive the later disclosure confirmation/s);

  assert.match(preflight, /spawnSync\("claude", args/);
  assert.match(preflight, /shell: false/);
  assert.match(preflight, /stdio: \["ignore", "pipe", "pipe"\]/);
  assert.match(preflight, /timeout: CLAUDE_COMMAND_TIMEOUT_MS/);
  assert.match(preflight, /maxBuffer: CLAUDE_COMMAND_MAX_BUFFER_BYTES/);
  assert.match(preflight, /runClaude\(CLAUDE_PREFLIGHT_INVOCATIONS\.version/);
  assert.match(preflight, /runClaude\(CLAUDE_PREFLIGHT_INVOCATIONS\.help/);
  assert.match(preflight, /runClaude\(CLAUDE_PREFLIGHT_INVOCATIONS\.auth/);
  for (const flag of CLAUDE_REQUIRED_HELP_FLAGS) assert.ok(preflight.includes(flag));
  for (const name of CLAUDE_CONFLICTING_ENVIRONMENT_VARIABLES) assert.ok(preflight.includes(name));
  assert.deepEqual(CLAUDE_ROLE_ARGUMENT_TAILS["read-only"], [
    "--safe-mode", "--permission-mode", "plan", "--strict-mcp-config", "--no-chrome",
    "--disable-slash-commands", "--tools", "Read,Grep,Glob",
  ]);
  assert.deepEqual(CLAUDE_ROLE_ARGUMENT_TAILS.writer, [
    "--safe-mode", "--permission-mode", "acceptEdits", "--strict-mcp-config", "--no-chrome",
    "--disable-slash-commands", "--tools", "Read,Grep,Glob,Edit,Write,Bash",
  ]);
  assert.match(fixtureTests, /temporary fake claude executable/);
  assert.match(fixtureTests, /never performs a network or model call/);
  assert.match(fixtureTests, /exactly three calls/);
  assert.match(fixtureTests, /every routing and proxy variable conflicts by presence before spawn/);

  assert.match(architecture, /only direct non-Pi contract is the canonical `claude` executable with `kind: "claude"`/);
  assert.match(architecture, /structured source for the direct-Claude model, role, argument, readiness, environment-conflict, error, and route-evidence policy/);
  assert.match(architecture, /not cryptographic endpoint attestation or independent network proof/);
  assert.match(architecture, /not an atomic preflight-to-start binding/);
  assert.match(architecture, /Consent, same-pane continuity, Herdr start, and lifecycle remain parent workflow contracts/);
  assert.match(architecture, /admin-managed policy and current-user environment behavior may remain/);
  assert.match(architecture, /without network or model access/);
  assert.match(architecture, /package adds no orchestration runtime, adapter dependency, or Claude Code dependency/);

  assert.match(workingAgreement, /Pi remains the default Herdr agent/);
  assert.match(workingAgreement, /exact `claude-fable-5` or `claude-opus-5`/);
  assert.match(workingAgreement, /package-owned same-pane descriptor, its CLI-declared route limitation, and explicit disclosure consent/);
  assert.match(workingAgreement, /Never expose raw Claude authentication JSON, identity fields, environment values, or child-process failure details/);
  assert.match(workingAgreement, /not cryptographic endpoint attestation/);
  assert.match(overlay, /No alias such as `fable` or `opus`/);
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

test("source-control defines narrow standing delivery authorization", async () => {
  const skill = await text("skills/source-control/SKILL.md");

  assert.match(skill, /name: source-control/);
  assert.match(skill, /atomically create and switch to one fresh non-primary branch at the current `HEAD`/);
  assert.match(skill, /git -c core\.hooksPath= -c core\.fsmonitor=false worktree add -b <new-branch> <absolute-nonexistent-path> HEAD/);
  assert.match(skill, /ordinary staged or unstaged task changes may remain/);
  assert.match(skill, /worktree form requires a clean current checkout/);
  assert.match(skill, /authorizes coherent local commits on the resulting or already-current non-primary branch/);
  assert.match(skill, /Treat an existing index as protected/);
  assert.match(skill, /file containing mixed task and unrelated hunks/);
  assert.match(skill, /git apply --cached --check/);
  assert.match(skill, /never use `git add -A`, `git add \.`/);
  assert.match(skill, /scripts\/commit-gate\.sh/);
  assert.match(skill, /invoking `git commit` directly does not satisfy this workflow/);
  assert.match(skill, /hook bypasses such as `--no-verify`/);
  assert.match(skill, /ordinary same-name branch push and opening one pull request/);
  assert.match(skill, /push only `refs\/heads\/<current>:refs\/heads\/<current>`/);
  assert.match(skill, /push\.followTags=false.*push\.gpgSign=false.*push\.pushOption=.*push\.recurseSubmodules=no.*push\.useForceIfIncludes=false/s);
  assert.match(skill, /explicit `--repo <owner\/name>`.*nonempty inline `--body` of at most 10,000 characters/s);
  assert.match(skill, /Do not use `--body-file`/);
  assert.match(skill, /worktree and index must be clean/);
  assert.match(skill, /existing-branch switch, PR update\/close\/merge, worktree removal/);
  assert.match(skill, /`dev`, `main`, or `master`/);
  assert.doesNotMatch(skill, /\bMax\b|Development\/private|make check/);
});

test("commit prompt is a thin source-control alias", async () => {
  const prompt = await text("prompts/commit.md");

  assert.match(prompt, /Load and follow the `source-control` skill/);
  assert.match(prompt, /Create exactly one local commit/);
  assert.match(prompt, /\$\{ARGUMENTS:-/);
  assert.match(prompt, /exact `git -c core\.hooksPath= -c core\.fsmonitor=false switch -c <fresh-non-primary-branch>` preparation form is standing-authorized/);
  assert.match(prompt, /standing authorization for the exact same-name branch push and one PR creation/);
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
  assert.match(contract, /coherent task commit is standing-authorized on a branch other than `dev`, `main`, or `master`/);
  assert.match(contract, /exact same-name ordinary branch push and opening one PR are likewise standing-authorized/);
  assert.match(contract, /A stale, failed, or pre-edit result is not evidence/);
});
