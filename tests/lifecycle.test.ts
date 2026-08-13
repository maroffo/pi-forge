// ABOUTME: Verifies lifecycle Git/path guards and the bounded post-edit verification follow-up.
// ABOUTME: Exercises exact Pi event payload shapes without executing mutations or shell commands.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import lifecycleExtension from "../extensions/lifecycle.ts";
import {
  dangerousCommandReason,
  findGitMutations,
  isPrimaryBranch,
  isSourcePath,
  isStandingAuthorizedBranchPush,
  isStandingAuthorizedPullRequestCreate,
  isVerificationCommand,
  sensitivePathReason,
} from "../src/lifecycle-policy.js";

test("verification recognition is conservative and rejects masked shell results", () => {
  for (const command of [
    "make check",
    "npm run test:e2e",
    "cd app && make check && npm test",
    "uv run pytest tests/unit",
    "node --experimental-strip-types --test tests/*.test.ts",
    "cargo clippy",
  ]) assert.equal(isVerificationCommand(command), true, command);

  for (const command of [
    "echo make check",
    "rg 'npm test' README.md",
    "make check | tee result.log",
    "make check; true",
    "make check || true",
    "printf x\nmake check",
    "git commit -m test",
  ]) assert.equal(isVerificationCommand(command), false, command);

  assert.equal(isSourcePath("src/index.ts"), true);
  assert.equal(isSourcePath("web/index.html"), true);
  assert.equal(isSourcePath("ui/App.svelte"), true);
  assert.equal(isSourcePath("package.json"), true);
  assert.equal(isSourcePath("Makefile"), true);
  assert.equal(isSourcePath("docs/index.md"), false);
  assert.equal(isSourcePath("node_modules/pkg/index.ts"), false);
  assert.equal(isSourcePath("/repo/src/build/tool.ts", "/repo"), true);
  assert.equal(isSourcePath("/tmp/build/project/src/index.ts", "/tmp/build/project"), true);
  assert.equal(isSourcePath("/repo/build/generated.ts", "/repo"), false);
});

test("Git command classification catches common wrappers without matching quoted prose", () => {
  for (const command of [
    "git commit -m x",
    "git -C /tmp/repo commit -m x",
    "env FOO=bar /usr/bin/git -c user.name=test commit -m x",
    "sh -c 'git commit -m x'",
    "eval 'git commit -m x'",
  ]) assert.deepEqual(findGitMutations(command).map((item) => item.kind), ["commit"], command);

  assert.deepEqual(findGitMutations("git push origin HEAD").map((item) => item.kind), ["remote"]);
  assert.deepEqual(findGitMutations("gh pr create --repo owner/repo --base main --head feat/x --title x --body body").map((item) => item.action), ["pr-create"]);
  assert.deepEqual(findGitMutations("gh -R owner/repo pr create --base main --head feat/x --title x --body body").map((item) => item.action), ["pr-create"]);
  assert.deepEqual(findGitMutations("git reset --hard HEAD").map((item) => item.kind), ["destructive"]);
  for (const command of [
    "git branch --delete topic",
    "git branch -df topic",
    "git branch --move old new",
    "git tag -dtopic",
    "git tag --delete=topic",
    "git worktree remove /tmp/w",
  ]) assert.deepEqual(findGitMutations(command).map((item) => item.kind), ["destructive"], command);
  assert.deepEqual(findGitMutations("git status --short"), []);
  assert.deepEqual(findGitMutations("git worktree list"), []);
  assert.deepEqual(findGitMutations("echo 'git commit is blocked'"), []);

  assert.equal(dangerousCommandReason("sudo rm file"), "privilege escalation");
  assert.equal(dangerousCommandReason("rm -rf build"), "recursive deletion");
});

test("sensitive path classification is exact enough for credentials and Git controls", () => {
  assert.equal(sensitivePathReason(join(homedir(), ".ssh", "config"), homedir()), "credential store");
  assert.equal(sensitivePathReason("/repo/.git", homedir()), "Git control or credential file");
  assert.equal(sensitivePathReason("/repo/.git/hooks/pre-commit", homedir()), "Git control or credential file");
  assert.equal(sensitivePathReason("/repo/.git/config.worktree", homedir()), "Git control or credential file");
  assert.equal(sensitivePathReason("/repo/.env.local", homedir()), "environment or credential file");
  assert.equal(sensitivePathReason("/repo/src/config.ts", homedir()), undefined);
});

function harness(options: { confirm?: boolean; cwd?: string; branch?: string; existingBranch?: boolean; cleanWorktree?: boolean } = {}) {
  const handlers = new Map<string, (...args: any[]) => any>();
  const entries: Array<{ type: string; data: any }> = [];
  const messages: any[] = [];
  const branch = options.branch ?? "feat/test";
  lifecycleExtension({
    on(name: string, handler: (...args: any[]) => any) { handlers.set(name, handler); },
    appendEntry(type: string, data: any) { entries.push({ type, data }); },
    sendMessage(message: any, sendOptions: any) { messages.push({ message, sendOptions }); },
    exec(command: string, args: string[]) {
      assert.equal(command, "git");
      if (args[0] === "symbolic-ref") {
        assert.deepEqual(args, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
        return { stdout: `${branch}\n`, stderr: "", code: branch ? 0 : 1, killed: false };
      }
      if (args[0] === "show-ref") {
        assert.deepEqual(args, ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]);
        return { stdout: "", stderr: "", code: options.existingBranch === false ? 1 : 0, killed: false };
      }
      assert.deepEqual(args, ["status", "--porcelain=v1", "--untracked-files=all"]);
      return { stdout: options.cleanWorktree === false ? " M src/index.ts\n" : "", stderr: "", code: 0, killed: false };
    },
  } as any);
  const context = {
    cwd: options.cwd ?? "/tmp/pi-forge-lifecycle",
    hasUI: options.confirm !== undefined,
    ui: { confirm: async () => options.confirm },
    sessionManager: { getBranch: () => [] },
  };
  handlers.get("session_start")?.({}, context);
  return { handlers, entries, messages, context };
}

test("standing authorization accepts only exact non-primary push and PR-create forms", async () => {
  assert.equal(isPrimaryBranch("dev"), true);
  assert.equal(isPrimaryBranch("main"), true);
  assert.equal(isPrimaryBranch("master"), true);
  assert.equal(isPrimaryBranch("feat/test"), false);

  const push = "git -c push.followTags=false -c push.gpgSign=false -c push.pushOption= -c push.recurseSubmodules=no -c push.useForceIfIncludes=false push -u origin refs/heads/feat/test:refs/heads/feat/test";
  assert.equal(isStandingAuthorizedBranchPush(push, "feat/test"), true);
  for (const command of [
    "git push origin HEAD",
    "git push origin refs/heads/feat/test:refs/heads/feat/test",
    "git -C ../other push origin refs/heads/feat/test:refs/heads/feat/test",
    "git -c push.followTags=true -c push.gpgSign=false -c push.pushOption= -c push.recurseSubmodules=no -c push.useForceIfIncludes=false push origin refs/heads/feat/test:refs/heads/feat/test",
    "git push --force origin refs/heads/feat/test:refs/heads/feat/test",
    "git push origin refs/heads/feat/test:refs/heads/other",
    "git push origin refs/tags/v1:refs/tags/v1",
    `${push} && echo sent`,
  ]) assert.equal(isStandingAuthorizedBranchPush(command, "feat/test"), false, command);
  assert.equal(isStandingAuthorizedBranchPush(push, "main"), false);

  const pr = "gh pr create --repo owner/repo --base main --head feat/test --title change --body summary";
  assert.equal(isStandingAuthorizedPullRequestCreate(pr, "feat/test"), true);
  for (const command of [
    "gh pr create --base main --head feat/test --title change --body summary",
    "gh pr create --repo owner/repo --base main --title change --body summary",
    "gh pr create --repo owner/repo --base main --head other --title change --body summary",
    "gh pr create --repo owner/repo --base main --head feat/test --title change --body '$USER'",
    "gh pr create --repo owner/repo --base main --head feat/test --title '$USER' --body summary",
    "gh pr create --repo owner/repo --base main --head feat/test --title change --body-file /tmp/private",
    "gh pr create --repo owner/repo --base main --head feat/test --title change --body summary --draft",
    "gh -R owner/other pr create --base main --head feat/test --title change --body summary",
    `${pr} && gh pr merge`,
  ]) assert.equal(isStandingAuthorizedPullRequestCreate(command, "feat/test"), false, command);
  assert.equal(isStandingAuthorizedPullRequestCreate(pr, "dev"), false);
});

test("lifecycle blocks direct commits and gates remote or destructive mutations", async () => {
  const headless = harness();
  const call = headless.handlers.get("tool_call")!;
  assert.match((await call({ toolName: "bash", input: { command: "git commit -m x" } }, headless.context)).reason, /commit-gate\.sh/);
  assert.equal(await call({
    toolName: "bash",
    input: { command: "skills/source-control/scripts/commit-gate.sh -- --message 'feat: x'" },
  }, headless.context), undefined);
  assert.equal(await call({
    toolName: "bash",
    input: { command: "git -c push.followTags=false -c push.gpgSign=false -c push.pushOption= -c push.recurseSubmodules=no -c push.useForceIfIncludes=false push -u origin refs/heads/feat/test:refs/heads/feat/test" },
  }, headless.context), undefined);
  assert.equal(await call({
    toolName: "bash",
    input: { command: "gh pr create --repo owner/repo --base main --head feat/test --title change --body summary" },
  }, headless.context), undefined);
  assert.match((await call({ toolName: "bash", input: { command: "git push origin HEAD" } }, headless.context)).reason, /interactive confirmation/);
  assert.match((await call({ toolName: "bash", input: { command: "git reset --hard HEAD" } }, headless.context)).reason, /interactive confirmation/);

  assert.match((await call({
    toolName: "bash",
    input: { command: `gh pr create --repo owner/repo --base main --head feat/test --title change --body-file ${homedir()}/.ssh/id_rsa` },
  }, headless.context)).reason, /interactive confirmation/);

  const unborn = harness({ existingBranch: false });
  assert.match((await unborn.handlers.get("tool_call")!({
    toolName: "bash",
    input: { command: "gh pr create --repo owner/repo --base main --head feat/test --title change --body summary" },
  }, unborn.context)).reason, /interactive confirmation/);

  const dirty = harness({ cleanWorktree: false });
  assert.match((await dirty.handlers.get("tool_call")!({
    toolName: "bash",
    input: { command: "gh pr create --repo owner/repo --base main --head feat/test --title change --body summary" },
  }, dirty.context)).reason, /interactive confirmation/);

  const primary = harness({ branch: "main" });
  assert.match((await primary.handlers.get("tool_call")!({
    toolName: "bash",
    input: { command: "git push origin refs/heads/main:refs/heads/main" },
  }, primary.context)).reason, /interactive confirmation/);

  const approved = harness({ confirm: true });
  assert.equal(await approved.handlers.get("tool_call")!({
    toolName: "bash",
    input: { command: "git push origin HEAD" },
  }, approved.context), undefined);

  const denied = harness({ confirm: false });
  assert.match((await denied.handlers.get("tool_call")!({
    toolName: "bash",
    input: { command: "rm -rf build" },
  }, denied.context)).reason, /not approved/);
});

test("lifecycle confirms sensitive writes, including symlinked Git controls", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-forge-lifecycle-path-"));
  try {
    await mkdir(join(root, ".git"));
    await writeFile(join(root, ".git", "config.worktree"), "fixture");
    await symlink(join(root, ".git"), join(root, "git-alias"));
    const runtime = harness({ cwd: root });
    const call = runtime.handlers.get("tool_call")!;
    assert.match((await call({ toolName: "write", input: { path: ".env" } }, runtime.context)).reason, /interactive confirmation/);
    assert.match((await call({ toolName: "edit", input: { path: "git-alias/config.worktree" } }, runtime.context)).reason, /interactive confirmation/);
    assert.equal(await call({ toolName: "edit", input: { path: "src/index.ts" } }, runtime.context), undefined);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("lifecycle sends one follow-up after unverified source mutation", () => {
  const runtime = harness();
  const result = runtime.handlers.get("tool_result")!;
  const end = runtime.handlers.get("agent_end")!;

  result({ toolName: "edit", input: { path: "src/index.ts" }, isError: false }, runtime.context);
  end({});
  end({});
  assert.equal(runtime.messages.length, 1);
  assert.equal(runtime.messages[0].sendOptions.triggerTurn, true);
  assert.match(runtime.messages[0].message.content, /source changed after the latest successful verification/);
  assert.doesNotMatch(JSON.stringify(runtime.entries), /index\.ts/);
});

test("fresh successful verification suppresses follow-up while failed checks do not", () => {
  const verified = harness();
  verified.handlers.get("tool_result")!({ toolName: "write", input: { path: "src/a.ts" }, isError: false }, verified.context);
  verified.handlers.get("tool_result")!({ toolName: "bash", input: { command: "npm test" }, isError: false }, verified.context);
  verified.handlers.get("agent_end")!({});
  assert.equal(verified.messages.length, 0);

  const failed = harness();
  failed.handlers.get("tool_result")!({ toolName: "write", input: { path: "src/a.ts" }, isError: false }, failed.context);
  failed.handlers.get("tool_result")!({ toolName: "bash", input: { command: "npm test" }, isError: true }, failed.context);
  failed.handlers.get("agent_end")!({});
  assert.equal(failed.messages.length, 1);
});

test("only an actually launched protected writer invalidates verification", () => {
  const management = harness();
  management.handlers.get("tool_result")!({
    toolName: "subagent",
    input: { action: "get", agent: "pi-forge.software-engineer" },
    isError: false,
    details: {},
  }, management.context);
  management.handlers.get("agent_end")!({});
  assert.equal(management.messages.length, 0);

  const blocked = harness();
  blocked.handlers.get("tool_result")!({
    toolName: "subagent",
    input: { agent: "pi-forge.software-engineer" },
    isError: true,
    details: {},
  }, blocked.context);
  blocked.handlers.get("agent_end")!({});
  assert.equal(blocked.messages.length, 0);

  const launched = harness();
  launched.handlers.get("tool_result")!({
    toolName: "subagent",
    input: { agent: "pi-forge.software-engineer" },
    isError: true,
    details: { runId: "writer-run" },
  }, launched.context);
  launched.handlers.get("agent_end")!({});
  assert.equal(launched.messages.length, 1);
});
