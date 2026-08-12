// ABOUTME: Verifies Pi-native orchestration, planning, and PR-review workflow contracts.
// ABOUTME: Prevents protected-agent, candidate-execution, and external-side-effect boundaries from drifting.

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

test("Herdr orchestration is explicit, bounded, lifecycle-safe, and preserves protected routes", async () => {
  const overlay = await text("skills/herdr-orchestrator/SKILL.md");
  const base = await text("skills/orchestrator/SKILL.md");
  const prompt = await text("prompts/herdr-orchestrator.md");
  const runtime = await text("scripts/check-runtime-resources.mjs");

  assert.match(overlay, /name: herdr-orchestrator/);
  assert.match(overlay, /only when the user invoked `\/herdr-orchestrator` or the request or approved plan explicitly selected Herdr/);
  assert.match(overlay, /`HERDR_ENV=1`.*is not selection/);
  assert.match(overlay, /structured `herdr_layout`, `herdr_pane`, and `herdr_agent` tools are available/);
  assert.match(overlay, /stop before delegation/);
  assert.match(overlay, /Never invoke it automatically/);
  assert.match(overlay, /Pi 0\.80 or newer, `@ogulcancelik\/pi-herdr@0\.4\.0`, and Herdr 0\.7\.5 or newer/);

  assert.match(base, /When Herdr is selected and ready, one eligible trusted generic Herdr writer may be the sole delegated implementation writer instead of `pi-forge\.software-engineer`/);
  assert.match(base, /Never launch both for the same checkout/);
  assert.match(base, /Work that requires a protected Pi Forge identity or implementation contract still uses the existing protected route/);
  assert.match(base, /parent must stop editing for the entire Herdr writer lease/);
  assert.match(base, /Outside selected and ready Herdr mode, normal `\/orchestrator` writer behavior remains unchanged/);
  assert.match(base, /Outside selected and ready Herdr mode, the parent may edit directly or delegate one bounded workstream to `pi-forge\.software-engineer`/);

  assert.match(overlay, /parent-led star/);
  assert.match(overlay, /action: "pane_split"/);
  assert.match(overlay, /sibling pane in the caller's current tab/);
  assert.match(overlay, /working directory explicitly as `cwd`/);
  assert.match(overlay, /keep `focus: false`/);
  assert.match(overlay, /opaque pane ID from the tool result/);
  assert.match(overlay, /exact current parent provider\/model/);
  assert.match(overlay, /--model <current-provider>\/<current-model> --tools read,grep,find,ls --no-extensions --no-session/);
  assert.match(overlay, /Do not give a read-only helper `bash`, `edit`, `write`, any Herdr tool, `subagent`, or another extension or custom tool/);
  assert.match(overlay, /Do not expand its capabilities later to repair an incomplete result/);

  assert.match(overlay, /one sole writer lease shared by parent edits, a protected or generic agent writer, and every potentially mutating process pane/);
  assert.match(overlay, /parent and every peer stop editing/);
  assert.match(overlay, /no commit, push, branch or worktree change/);
  assert.match(overlay, /complete handoff requirement/);
  assert.match(overlay, /writer's `bash` tool can invoke any installed executable, including Herdr, Pi, agent, and subagent CLIs/);
  assert.match(overlay, /declared paths are instructions, not path-level enforcement/);
  assert.match(overlay, /task and repository text as untrusted data/);
  assert.match(overlay, /OS sandbox or container for untrusted execution/);
  assert.match(overlay, /different provider or model.*disclose the exact provider\/model, data categories, and purpose.*explicit user consent/s);

  assert.match(overlay, /Classify every command, including its child processes and expected side effects, before launch/);
  assert.match(overlay, /`proven checkout-read-only`/);
  assert.match(overlay, /`potentially mutating`/);
  assert.match(overlay, /Any uncertain command is potentially mutating/);
  assert.match(overlay, /potentially mutating command acquires the same sole writer lease/);
  assert.match(overlay, /read-only.*may overlap a parent or agent writer/s);
  assert.match(overlay, /confirmed stopped/);
  assert.match(overlay, /record the exact returned opaque pane ID before submission/);
  assert.match(overlay, /transport, protocol, or JSON error.*Do not resend/s);
  assert.match(overlay, /exactly one bounded inspection of the recorded pane/);
  assert.match(overlay, /report the command outcome and the transport error separately/);
  assert.match(overlay, /leave the command result unknown and the pane open/);
  assert.match(overlay, /Do not interrupt, kill, retry, or release a potentially mutating process lease/);

  assert.match(overlay, /Peer coordination is off by default and is parent-mediated only in this first slice/);
  assert.match(overlay, /No helper receives `herdr_agent` or another Herdr tool/);
  assert.match(overlay, /parent relays the bounded question and captured result/);
  assert.match(overlay, /parent may write a complete captured result.*temporary Markdown artifact outside the repository/s);
  assert.match(overlay, /Direct helper-to-helper prompting is unsupported in this slice/);
  assert.match(overlay, /bounded concise continuation turns/);
  assert.match(overlay, /report the missing evidence as a gap/);
  assert.match(overlay, /Never expand helper capabilities, claim a complete artifact from incomplete output/);

  for (const state of ["working", "blocked", "idle", "done", "unknown"]) {
    assert.match(overlay, new RegExp("\\| `" + state + "` \\|"));
  }
  assert.match(overlay, /Lifecycle settlement is not a result/);
  assert.match(overlay, /Never launch any package-qualified `pi-forge\.\*` writer, reviewer, technical writer, or analyst through Herdr/);
  assert.match(overlay, /Socratic Analysis, Second Opinion, and Expert Panel stay on their existing normal `subagent` or guarded tool routes/);
  assert.match(overlay, /Do not use raw pi-subagents RPC/);

  assert.match(base, /Load and follow the `herdr-orchestrator` overlay.*only when.*explicitly selects Herdr/s);
  assert.match(base, /Environment variables, installed Herdr tools.*do not count as selection/);
  assert.match(base, /Do not silently continue/);
  assert.match(base, /Every protected Pi Forge agent, Socratic, Second Opinion, and Expert Panel route remains on its existing supported path/);

  assert.match(runtime, /"\/orchestrator runtime-ordinary-marker"/);
  assert.match(runtime, /"runtime-plain-marker"/);
  assert.match(runtime, /ordinary\.prompt\.includes\("`herdr-orchestrator`"\)/);
  assert.match(runtime, /plain\.prompt\.includes\("Load and follow the `orchestrator` skill"\)/);
  assert.match(runtime, /herdrNegativePromptIsolation/);

  assert.match(prompt, /Load and follow both the `herdr-orchestrator` and `orchestrator` skills/);
  assert.match(prompt, /This command explicitly selects Herdr/);
  assert.match(prompt, /never continue through a different transport/);
  assert.match(prompt, /\$\{ARGUMENTS:-/);
  assert.match(prompt, /untrusted task data/);
});

test("Herdr pane retirement is automatic only after exact evidence-backed eligibility", async () => {
  const overlay = await text("skills/herdr-orchestrator/SKILL.md");

  assert.match(overlay, /Automatic retirement is the default only for eligible panes that remain under continuous exclusive custody of this invocation/);
  assert.match(overlay, /initialize an invocation-local registry/);
  for (const field of [
    "expected current canonical pane ID", "original returned ID and any observed aliases",
    "exact workspace and tab IDs", "owner", "expected role, foreground class, and cwd",
    "exact unique live agent name when applicable", "agent or process classification", "writer-lease status",
    "lifecycle and result state", "whether a follow-up remains", "preservation state",
    "continuous exclusive workflow-custody state",
  ]) assert.ok(overlay.includes(field));
  assert.match(overlay, /Immediately after each successful split, call `herdr_pane` `get` on the exact returned opaque pane ID/);
  assert.match(overlay, /If initial canonical identity is missing or ambiguous, mark automatic retirement ineligible/);
  assert.match(overlay, /Never add the caller\/current parent pane or a pane created outside this invocation to the registry/);
  assert.match(overlay, /Never discover cleanup targets from focus, an agent or pane name, a glob, a broad pane list match, a workspace sweep, or topology inference/);
  assert.match(overlay, /preserve all workflow-created panes or exact recorded created-pane IDs/);
  assert.match(overlay, /preservation overrides automatic retirement/);
  assert.match(overlay, /normal workflow must never move, swap, rename, reassign, or reuse a cleanup candidate/);
  assert.match(overlay, /Only expected parent-workflow operations recorded for that entry preserve custody/);
  assert.match(overlay, /observed or suspected user or external input to the pane or terminal, pane move, swap, rename, manual close or recreation/);
  assert.match(overlay, /pane-ID alias or canonical-ID change, agent replacement or expected-name loss, unexpected foreground process or cwd/);
  assert.match(overlay, /permanently ends exclusive custody and disables automatic close/);
  assert.match(overlay, /intentionally changes any such identity or assignment, retain and report the pane/);
  assert.match(overlay, /Historical IDs and aliases remain audit evidence only and are never substituted for the expected current canonical close target/);
  assert.match(overlay, /cannot affirm continuous exclusive custody from creation through retirement, retain and report/);
  assert.doesNotMatch(overlay, /do not automate pane cleanup/i);

  assert.match(overlay, /read-only agent pane is eligible only after the complete promised result is captured by the parent, inspected, and no bounded follow-up or parent-mediated peer relay remains/);
  assert.match(overlay, /`idle` alone is insufficient, and `done` alone is insufficient/);
  assert.match(overlay, /writer pane remains useful through implementation, protected review, and every accepted fix round/);
  assert.match(overlay, /complete final handoff confirms editing stopped, the sole writer lease is released, the parent captured all needed evidence, and no fix or clarification turn is planned/);
  assert.match(overlay, /one-shot process pane is eligible only after the unique exit marker and exit status are verified, substantive output is captured, no child, server, or watcher remains, and any potentially mutating lease is released/);
  assert.match(overlay, /server or watcher pane is eligible only after a separately authorized stop action and confirmed termination/);
  assert.match(overlay, /Never close a pane to stop a process or to release a lease/);

  for (const state of ["working", "blocked", "unknown"]) {
    assert.match(overlay, new RegExp("Never automatically close[^.]*`" + state + "`", "s"));
  }
  assert.match(overlay, /active permission question/);
  assert.match(overlay, /`idle` or `done` but incomplete result evidence/);
  assert.match(overlay, /timeout.*truncated, incomplete, or missing output or handoff/s);
  assert.match(overlay, /ambiguous pane submission or command outcome/);
  assert.match(overlay, /active or uncertain server, watcher, or child/);
  assert.match(overlay, /writer or potentially mutating process lease is active or uncertain/);
  assert.match(overlay, /bounded follow-up, peer relay, fix, or clarification remains/);
  assert.match(overlay, /entry without continuous exclusive workflow custody/);
  assert.match(overlay, /Leave that exact pane open and record the reason/);

  assert.match(overlay, /Closing a completed interactive agent discards its live terminal context/);
  assert.match(overlay, /parent must already possess the complete promised handoff and all evidence needed later/);
  assert.match(overlay, /Do not assume a transcript persists anywhere outside the pane/);
  assert.match(overlay, /As soon as a helper or one-shot process becomes eligible.*retire it rather than waiting for final handoff/s);
  assert.match(overlay, /Keep the writer pane registered through the complete protected review and fix loop/);

  assert.match(overlay, /Historical eligibility is necessary but never sufficient/);
  assert.match(overlay, /perform this fresh sequence in one parent turn/);
  assert.match(overlay, /Call structured `herdr_pane` `get` on the registry's exact expected current canonical pane ID/);
  assert.match(overlay, /canonical pane ID, workspace, and every exposed expected occupant field such as role or foreground class and cwd to match the registry exactly/);
  assert.match(overlay, /recorded tab is audit evidence unless the structured result exposes it; never invent a tab match/);
  assert.match(overlay, /alias that now resolves to a different canonical ID.*permanently disable automatic close/s);
  assert.match(overlay, /never close a replacement or newly reused ID/);
  assert.match(overlay, /call structured `herdr_agent` `get` with the exact recorded unique live agent name/);
  assert.match(overlay, /same freshly matched canonical pane with the expected role, a settled non-`working`\/non-`blocked`\/non-`unknown` state/);
  assert.match(overlay, /Name loss, replacement, pane mismatch, new work, or ambiguity retains the pane/);
  assert.match(overlay, /Keep revalidation and close adjacent/);
  assert.match(overlay, /make no unrelated tool call and allow no user round before close/);
  assert.match(overlay, /only intervening call permitted is the required exact-name `herdr_agent` `get`/);

  assert.equal((overlay.match(/"action": "close"/g) ?? []).length, 1);
  assert.match(overlay, /call the structured `herdr_pane` tool exactly once with the same freshly revalidated canonical pane ID/);
  assert.match(overlay, /\{ "action": "close", "pane": "<freshly-revalidated-canonical-pane-id>" \}/);
  assert.match(overlay, /Never send exit keys, terminal input, or raw Herdr CLI/);
  assert.match(overlay, /never infer closure from an agent lifecycle state/);
  assert.match(overlay, /narrows but does not eliminate time-of-check\/time-of-use risk/);
  assert.match(overlay, /no generation-aware or ownership-conditional close/);
  assert.match(overlay, /trusted assumption that no concurrent local actor can mutate or repurpose the pane/);
  assert.match(overlay, /concurrent user or external interaction is possible.*disable automatic close.*retain or ask rather than closing/s);
  assert.match(overlay, /transport, protocol, JSON, or other ambiguous error, do not retry/);
  assert.match(overlay, /exactly one structured read-only `herdr_pane` `get` using the same exact pre-close canonical pane ID/);
  assert.match(overlay, /returns the same live canonical pane, leave a cleanup gap/);
  assert.match(overlay, /conclusively reports that exact pane does not exist, report cleanup confirmed separately from the transport error/);
  assert.match(overlay, /resolves to a moved, reused, or different canonical pane.*do not infer closure.*never close again/s);
  assert.match(overlay, /Workspace pane-list absence is not closure proof/);
  assert.doesNotMatch(overlay, /action: "pane_list"|`pane_list`/);

  assert.match(overlay, /final handoff, make one safe retirement pass over only the remaining registry entries/);
  assert.match(overlay, /Report only exact created panes intentionally preserved, unsafe to close, or failed or ambiguous to retire/);
  assert.match(overlay, /`no workflow panes remain`/);
  assert.match(overlay, /Readiness failure before any pane was created has nothing to retire/);
  assert.match(overlay, /User cancellation applies these same per-entry evidence and eligibility rules; it never authorizes a blanket close/);
  assert.match(overlay, /Retirement is terminal resource lifecycle after evidence capture/);
  assert.match(overlay, /not writer authority, protected policy, sandboxing, lifecycle settlement, process cancellation/);
  assert.match(overlay, /protected review, Socratic, Second Opinion, or Expert Panel step through its unchanged supported path/);
});

test("direct Claude in Herdr is executable, exact, per-launch, and never protected", async () => {
  const overlay = await text("skills/herdr-orchestrator/SKILL.md");
  const modelIds = [...new Set(overlay.match(/\bclaude-[a-z0-9]+(?:-[a-z0-9]+)*-\d+(?:\.\d+)*\b/g) ?? [])].sort();

  assert.deepEqual(modelIds, [...CLAUDE_LAUNCH_POLICY.models]);
  assert.match(overlay, /Pi remains the default/);
  assert.match(overlay, /only supported non-Pi exception is the exact direct Claude Code contract/);
  assert.match(overlay, /No alias such as `fable` or `opus`, other Claude model, fallback model, or repository-selected model is supported/);
  assert.doesNotMatch(overlay, /--model (?:fable|opus)(?:\s|$)/m);
  assert.match(overlay, /Do not infer or build a generic multi-backend abstraction/);

  assert.match(overlay, /canonical Claude Code's CLI-declared `apiProvider: "firstParty"` route evidence for the current same-pane environment/);
  assert.match(overlay, /not cryptographic endpoint attestation, independent network proof/);
  assert.match(overlay, /appropriate OS and network boundary/);
  assert.match(overlay, /interactive Claude Code session may persist locally under Claude Code policy/);
  assert.match(overlay, /Obtain explicit consent for this one launch after showing the descriptor evidence and limitation/);
  assert.match(overlay, /request naming the model or role, prior installation, authentication, generic Herdr selection, earlier launch, or prior consent is insufficient/);
  assert.match(overlay, /precise source, artifact, and other data categories/);
  assert.match(overlay, /declined, absent, or ambiguous.*without switching to Pi or any model, alias, agent, provider, or transport/s);

  assert.match(overlay, /`skills\/herdr-orchestrator\/scripts\/prepare-claude-launch\.mjs` is the package-owned structured source of truth/);
  assert.match(overlay, /Resolve `scripts\/prepare-claude-launch\.mjs` relative to this loaded `SKILL\.md`/);
  assert.match(overlay, /Do not search for, copy, regenerate, replace, or let a model synthesize the probe or `agentArgs`/);
  assert.match(overlay, /future agent's normal sibling pane/);
  assert.match(overlay, /submit the resolved script exactly once through `herdr_pane`/);
  assert.match(overlay, /unique completion-marker and no-retry process contract/);
  assert.match(overlay, /proven checkout-read-only, no-model preflight/);
  assert.match(overlay, /`spawnSync`, `shell: false`, a five-second timeout, and a 64 KiB buffer/);
  assert.match(overlay, /`claude` command once each and only as `--version`, `--help`, and `auth status --json`/);
  assert.match(overlay, /Every failure prints exactly one fixed JSON error descriptor with an enumerated code/);
  assert.match(overlay, /accepts `authMethod` and `subscriptionType` only as short values from exported safe-token allowlists/);
  for (const flag of CLAUDE_REQUIRED_HELP_FLAGS) assert.ok(overlay.includes(flag));
  for (const name of CLAUDE_CONFLICTING_ENVIRONMENT_VARIABLES) assert.ok(overlay.includes(name));
  assert.match(overlay, /Captured stdio prevents ordinary child stdout and stderr from entering the pane/);
  assert.match(overlay, /hostile or replaced executable.*concurrent local mutation/s);
  assert.match(overlay, /Do not claim impossible redaction or atomic binding/);

  assert.match(overlay, /start `kind: "claude"` with a unique live name in the same recorded and unchanged pane/);
  assert.match(overlay, /no intervening command, environment mutation, pane replacement/);
  assert.match(overlay, /Pass the descriptor's `launch\.agentArgs` array byte-for-byte/);
  assert.match(overlay, /package owns the deterministic preflight and descriptor, not the Herdr runtime/);
  const readOnlyArgs = /Capability-read-only helper:\n\n```text\n([^\n]+)\n```/.exec(overlay)?.[1];
  const writerArgs = /Sole trusted generic writer:\n\n```text\n([^\n]+)\n```/.exec(overlay)?.[1];
  assert.equal(readOnlyArgs, `--model <exact-allowed-model-id> ${CLAUDE_ROLE_ARGUMENT_TAILS["read-only"].join(" ")}`);
  assert.equal(writerArgs, `--model <exact-allowed-model-id> ${CLAUDE_ROLE_ARGUMENT_TAILS.writer.join(" ")}`);
  assert.match(overlay, /do not reconstruct it from prose, append arguments, or use defaults/);
  for (const flag of [
    "--dangerously-skip-permissions", "--allow-dangerously-skip-permissions", "--fallback-model",
    "--resume", "--continue", "-r", "-c", "--mcp-config",
  ]) assert.match(overlay, new RegExp("`" + flag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "`"));
  assert.match(overlay, /extra directories, plugins, agents, `--mcp-config`, remote or cloud execution, background, worktree, or any other native argument/);

  assert.match(overlay, /not an OS sandbox/);
  assert.match(overlay, /admin-managed policy and current-user environment behavior may remain/);
  assert.match(overlay, /read-only role has no Bash, Edit, Write, Agent, Web, Herdr, or subagent capability/);
  assert.match(overlay, /writer uses the same sole checkout writer lease/);
  assert.match(overlay, /For a direct Claude writer, the shell prohibition also forbids invoking `claude` again/);
  assert.match(overlay, /`acceptEdits`.*does not authorize commits, shell bypass, permission expansion, or external side effects/s);
  assert.match(overlay, /permission prompt through the existing `blocked` lifecycle state/);
  assert.match(overlay, /Never retry, resume, continue, use an alias, select a fallback, or silently switch to Pi or another agent, model, provider, or transport/);

  assert.match(overlay, /direct Claude session is generic trusted work only/);
  assert.match(overlay, /never a package-qualified Pi Forge identity, protected reviewer, Socratic analyst, Second Opinion panelist, Expert Panel component/);
  assert.match(overlay, /Never launch any package-qualified `pi-forge\.\*` writer, reviewer, technical writer, or analyst through Herdr/);
});

test("plan-forge writes a self-contained plan without implicit implementation or publication", async () => {
  const skill = await text("skills/plan-forge/SKILL.md");
  const plan = await text("skills/plan-forge/references/plan-template.md");
  const handoff = await text("skills/plan-forge/references/implementation-prompt.md");

  assert.match(skill, /Do not implement the planned code/);
  assert.match(skill, /Every important mechanic in the plan needs a current `file:line` citation/);
  assert.match(skill, /Pi slash commands are user entry points/);
  assert.match(skill, /invoke `\/expert-panel` with that target/);
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

test("pr-review publishes an idempotent COMMENT review and gates candidate execution", async () => {
  const skill = await text("skills/pr-review/SKILL.md");
  const candidateExecution = await text("skills/pr-review/references/candidate-execution.md");
  const evidence = await text("skills/pr-review/references/evidence.md");
  const output = await text("skills/pr-review/references/output-format.md");
  const publication = await text("skills/pr-review/references/publication.md");
  const prompt = await text("prompts/pr-review.md");

  assert.match(skill, /publishing one resulting GitHub review with event `COMMENT`/);
  assert.match(skill, /does not authorize `APPROVE`, `REQUEST_CHANGES`, free-standing issue comments, labels, pushes, merges/);
  assert.match(skill, /completed review always publishes that full report, including when it has no findings/);
  assert.match(skill, /parent-verified Critical, Major, and Minor finding/);
  assert.match(skill, /mode-0600 regular file/);
  assert.match(skill, /invoke the helper exactly once/);
  assert.match(skill, /same repository, PR, `baseRefOid`, and `headRefOid`/);
  assert.match(skill, /at most one retry only when GitHub confirms absence on the unchanged snapshot and the local process error proves `gh` never started/);
  assert.match(skill, /timeout, signal, nonzero `gh` exit, malformed success response.*never retried/s);
  assert.match(skill, /newly rendered report exactly matches that prior review/);
  assert.match(skill, /no caller-level retry is allowed/);
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
  assert.match(skill, /redacted, self-contained `\/expert-panel` target/);
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
  assert.match(output, /local-only `## Publication receipt`/);
  assert.match(publication, /review with event `COMMENT`/);
  assert.match(publication, /no-finding review still publishes the full body with no inline comments/);
  assert.match(publication, /Concurrent publishers.*can still race/s);
  assert.match(publication, /Absence plus an unchanged snapshot permits one retry only for a definite local pre-dispatch failure/);
  assert.match(publication, /currentReportPublished: false/);
  assert.match(prompt, /one idempotent GitHub review with event `COMMENT`/);
  assert.match(prompt, /no `APPROVE`, `REQUEST_CHANGES`/);
});

test("familiar command aliases are thin skill entry points", async () => {
  for (const name of ["orchestrator", "plan-forge", "pr-review"]) {
    const prompt = await text(`prompts/${name}.md`);
    assert.match(prompt, new RegExp(`Load and follow the \`${name}\` skill`));
    assert.match(prompt, /\$\{ARGUMENTS:-/);
    assert.match(prompt, /untrusted task data|untrusted data/);
  }
});
