// ABOUTME: Verifies Pi Forge release phase validation, non-publishing command plans, reconciliation, and guard behavior.
// ABOUTME: Uses injected network results plus disposable real Git repositories, never live GitHub/npm or project Git state.

import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import releaseGuard from "../.pi/extensions/pi-forge-release-guard.ts";
import {
  classifyReconcileState,
  classifyReleaseCommand,
  parseReleaseArguments,
  validateReleaseSnapshot,
} from "../scripts/lib/release-policy.mjs";
import { runCommand, runReleaseCheck } from "../scripts/check-release.mjs";

const VERSION = "0.3.0";
const HEAD = "0123456789abcdef0123456789abcdef01234567";
const EARLIER_RUN = "2026-07-31T08:00:00.000Z";
const LATEST_RUN = "2026-07-31T09:00:00.000Z";
const known = (value: unknown) => ({ status: "known", value });
const unavailable = (detail = "fixture unavailable") => ({ status: "unavailable", detail });

function snapshot(options: any = {}) {
  const tag = { exists: true, annotated: true, target: HEAD };
  return {
    versions: {
      package: known(VERSION), lock: known(VERSION), lockRoot: known(VERSION), readme: known(VERSION),
    },
    git: { clean: known(true), branch: known("main"), head: known(HEAD), originMain: known(HEAD) },
    tags: { local: known(tag), remote: known(tag) },
    registry: { version: known({ exists: false }), distTags: known({ latest: VERSION }) },
    ci: known([
      { databaseId: 1, workflowName: "CI", headSha: HEAD, status: "completed", conclusion: "success", createdAt: LATEST_RUN },
      { databaseId: 2, workflowName: "pi-subagents upgrade compatibility", headSha: HEAD, status: "completed", conclusion: "success", createdAt: LATEST_RUN },
    ]),
    verification: { e2e: known(true), upgrade: known(true), audit: known(true), runtime: known(true) },
    pack: {
      local: known({ name: "@maroffo/pi-forge", version: VERSION, integrity: "sha512-fixture", rosterValid: true, hasProjectPi: false }),
      registry: known({ name: "@maroffo/pi-forge", version: VERSION, integrity: "sha512-fixture", rosterValid: true, hasProjectPi: false }),
    },
    ...options,
  };
}

function withAbsentTags(value = snapshot()) {
  return { ...value, tags: { local: known({ exists: false }), remote: known({ exists: false }) } };
}

test("release arguments accept only one strict stable phase/version pair", () => {
  assert.deepEqual(parseReleaseArguments(["--phase", "tag", "--version", VERSION]), { phase: "tag", version: VERSION });
  for (const args of [
    [],
    ["--version", VERSION, "--phase", "tag"],
    ["--phase", "deploy", "--version", VERSION],
    ["--phase", "tag", "--version", "v0.3.0"],
    ["--phase", "tag", "--version", "0.3.0-beta.1"],
    ["--phase", "tag", "--version", "01.3.0"],
  ]) assert.throws(() => parseReleaseArguments(args), /Usage/);
});

test("prepare, tag, publish, and verify require their exact evidence", () => {
  assert.equal(validateReleaseSnapshot("prepare", VERSION, withAbsentTags()).verdict, "pass");
  assert.equal(validateReleaseSnapshot("tag", VERSION, withAbsentTags()).verdict, "pass");
  assert.equal(validateReleaseSnapshot("publish", VERSION, snapshot()).verdict, "pass");
  const published = snapshot({ registry: { version: known({ exists: true, version: VERSION }), distTags: known({ latest: VERSION }) } });
  assert.equal(validateReleaseSnapshot("verify", VERSION, published).verdict, "pass");

  const wrongVersions = snapshot({
    versions: { package: known(VERSION), lock: known("0.2.0"), lockRoot: known(VERSION), readme: known(VERSION) },
  });
  assert.equal(validateReleaseSnapshot("prepare", VERSION, wrongVersions).verdict, "fail");
  assert.ok(validateReleaseSnapshot("prepare", VERSION, wrongVersions).checks.some((item) => item.name === "lock-version" && item.status === "fail"));

  const redCi = withAbsentTags(snapshot({
    ci: known([
      { databaseId: 3, workflowName: "CI", headSha: HEAD, status: "completed", conclusion: "failure", createdAt: LATEST_RUN },
      { databaseId: 4, workflowName: "pi-subagents upgrade compatibility", headSha: HEAD, status: "completed", conclusion: "success", createdAt: LATEST_RUN },
    ]),
  }));
  assert.equal(validateReleaseSnapshot("tag", VERSION, redCi).verdict, "fail");

  const missingExactHead = withAbsentTags(snapshot({ ci: known([
    { databaseId: 5, workflowName: "CI", headSha: "other", status: "completed", conclusion: "success", createdAt: LATEST_RUN },
    { databaseId: 6, workflowName: "pi-subagents upgrade compatibility", headSha: HEAD, status: "completed", conclusion: "success", createdAt: LATEST_RUN },
  ]) }));
  assert.equal(validateReleaseSnapshot("tag", VERSION, missingExactHead).verdict, "fail");

  const lightweight = snapshot({ tags: {
    local: known({ exists: true, annotated: false, target: HEAD }),
    remote: known({ exists: true, annotated: false, target: HEAD }),
  } });
  assert.equal(validateReleaseSnapshot("publish", VERSION, lightweight).verdict, "fail");

  const registryDrift = published;
  registryDrift.registry.distTags = known({ latest: "0.2.0" });
  assert.equal(validateReleaseSnapshot("verify", VERSION, registryDrift).verdict, "fail");

  const rerun = withAbsentTags(snapshot({ ci: known([
    { databaseId: 7, workflowName: "CI", headSha: HEAD, status: "completed", conclusion: "failure", createdAt: EARLIER_RUN },
    { databaseId: 8, workflowName: "CI", headSha: HEAD, status: "completed", conclusion: "success", createdAt: LATEST_RUN },
    { databaseId: 9, workflowName: "pi-subagents upgrade compatibility", headSha: HEAD, status: "completed", conclusion: "success", createdAt: LATEST_RUN },
  ]) }));
  assert.equal(validateReleaseSnapshot("tag", VERSION, rerun).verdict, "pass");

  const integrityDrift = snapshot({
    registry: { version: known({ exists: true, version: VERSION }), distTags: known({ latest: VERSION }) },
  });
  integrityDrift.pack.registry = known({
    ...integrityDrift.pack.registry.value,
    integrity: "sha512-different",
  });
  assert.equal(validateReleaseSnapshot("verify", VERSION, integrityDrift).verdict, "fail");
});

test("unavailable, malformed, stale, or failed evidence never becomes pass", () => {
  const cases = [
    withAbsentTags(snapshot({ ci: unavailable("gh missing") })),
    withAbsentTags(snapshot({ git: { ...snapshot().git, originMain: unavailable("network") } })),
    snapshot({ verification: { ...snapshot().verification, e2e: known(false) } }),
    snapshot({ pack: {
      ...snapshot().pack,
      local: known({ name: "wrong", version: VERSION, integrity: "", rosterValid: false, hasProjectPi: true }),
    } }),
  ];
  assert.equal(validateReleaseSnapshot("tag", VERSION, cases[0]).verdict, "indeterminate");
  assert.equal(validateReleaseSnapshot("tag", VERSION, cases[1]).verdict, "indeterminate");
  assert.equal(validateReleaseSnapshot("publish", VERSION, cases[2]).verdict, "fail");
  assert.equal(validateReleaseSnapshot("publish", VERSION, cases[3]).verdict, "fail");
});

test("reconcile classifies supported local, remote, registry, dist-tag, unavailable, and consistent states", () => {
  const tag = (exists: boolean) => exists
    ? { exists: true, annotated: true, target: HEAD }
    : { exists: false };
  const reconcile = (local: boolean, remote: boolean, registry: boolean, latest = registry, missing = false) => classifyReconcileState({
    git: { head: known(HEAD) },
    tags: { local: missing ? unavailable() : known(tag(local)), remote: known(tag(remote)) },
    registry: {
      version: known(registry ? { exists: true, version: VERSION } : { exists: false }),
      distTags: known({ latest: latest ? VERSION : "0.2.0" }),
    },
  }, VERSION);
  assert.deepEqual(reconcile(true, true, true), { status: "pass", state: "consistent" });
  assert.deepEqual(reconcile(true, false, false), { status: "fail", state: "local-only-tag" });
  assert.deepEqual(reconcile(false, true, false), { status: "fail", state: "remote-only-tag" });
  assert.deepEqual(reconcile(false, false, true), { status: "fail", state: "registry-only-publication" });
  assert.deepEqual(reconcile(true, true, true, false), { status: "fail", state: "dist-tag-drift" });
  assert.deepEqual(reconcile(false, false, false, false, true), { status: "indeterminate", state: "unavailable" });
  assert.deepEqual(reconcile(true, false, true), { status: "fail", state: "inconsistent" });
  const wrongTag = snapshot({ registry: {
    version: known({ exists: true, version: VERSION }),
    distTags: known({ latest: VERSION }),
  } });
  wrongTag.tags.local = known({ exists: true, annotated: false, target: HEAD });
  assert.deepEqual(classifyReconcileState(wrongTag, VERSION), { status: "fail", state: "inconsistent" });
});

async function releaseFixture() {
  const root = await mkdtemp(join(tmpdir(), "pi-forge-release-"));
  await writeFile(join(root, "package.json"), `${JSON.stringify({ name: "@maroffo/pi-forge", version: VERSION })}\n`);
  await writeFile(join(root, "package-lock.json"), `${JSON.stringify({ version: VERSION, packages: { "": { version: VERSION } } })}\n`);
  await writeFile(join(root, "README.md"), `pi install npm:@maroffo/pi-forge@${VERSION}\n`);
  return root;
}

test("injected prepare preflight checks both tag locations without running verification", async () => {
  const root = await releaseFixture();
  const calls: string[] = [];
  try {
    const result = await runReleaseCheck({ phase: "prepare", version: VERSION }, {
      root,
      run: async (id: string) => {
        calls.push(id);
        if (id === "git-status") return { code: 0, stdout: "", stderr: "" };
        if (id === "git-branch") return { code: 0, stdout: "main\n", stderr: "" };
        if (id === "git-head") return { code: 0, stdout: `${HEAD}\n`, stderr: "" };
        if (["git-local-tag", "git-remote-tag"].includes(id)) return { code: 0, stdout: "", stderr: "" };
        if (id === "npm-version") return { code: 1, stdout: "", stderr: "npm ERR! code E404" };
        throw new Error(`unexpected command id ${id}`);
      },
    });
    assert.equal(result.verdict, "pass");
    assert.ok(calls.includes("git-local-tag"));
    assert.ok(calls.includes("git-remote-tag"));
    assert.equal(calls.some((id) => id.startsWith("verification-")), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("injected tag preflight uses only fixed non-mutating commands and exact-head workflow evidence", async () => {
  const root = await releaseFixture();
  const calls: Array<{ id: string; command: string; args: string[] }> = [];
  const resultFor = (id: string) => {
    if (id === "git-status") return { code: 0, stdout: "", stderr: "" };
    if (id === "git-branch") return { code: 0, stdout: "main\n", stderr: "" };
    if (["git-head", "git-origin-main"].includes(id)) return { code: 0, stdout: `${HEAD}\n`, stderr: "" };
    if (["git-local-tag", "git-remote-tag"].includes(id)) return { code: 0, stdout: "", stderr: "" };
    if (id === "npm-version") return { code: 1, stdout: "", stderr: "npm ERR! code E404" };
    if (id === "github-ci") return { code: 0, stdout: JSON.stringify([
      { databaseId: 10, workflowName: "CI", headSha: HEAD, status: "completed", conclusion: "success", createdAt: LATEST_RUN },
      { databaseId: 11, workflowName: "pi-subagents upgrade compatibility", headSha: HEAD, status: "completed", conclusion: "success", createdAt: LATEST_RUN },
    ]), stderr: "" };
    if (id.startsWith("verification-")) return id === "verification-audit"
      ? { code: 0, stdout: JSON.stringify({ metadata: { vulnerabilities: {} } }), stderr: "" }
      : { code: 0, stdout: "passed", stderr: "" };
    throw new Error(`unexpected command id ${id}`);
  };
  try {
    const result = await runReleaseCheck({ phase: "tag", version: VERSION }, {
      root,
      run: async (id: string, command: string, args: string[]) => {
        calls.push({ id, command, args });
        return resultFor(id);
      },
    });
    assert.equal(result.verdict, "pass");
    assert.ok(calls.some((call) => call.id === "github-ci"));
    const serialized = calls.map((call) => `${call.command} ${call.args.join(" ")}`).join("\n");
    assert.doesNotMatch(serialized, /\bgit\s+(?:tag|push|commit)\b|\bnpm\s+publish\b|dist-tag|deprecate|unpublish/);
    assert.ok(calls.some((call) => call.id === "verification-e2e"));
    assert.ok(calls.some((call) => call.id === "verification-upgrade"));
    assert.ok(calls.some((call) => call.id === "verification-audit"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("static release failures block project scripts and post-script drift invalidates evidence", async () => {
  const root = await releaseFixture();
  const staticResult = (id: string, dirty: boolean) => {
    if (id === "git-status") return { code: 0, stdout: dirty ? " M package.json\n" : "", stderr: "" };
    if (id === "git-branch") return { code: 0, stdout: "main\n", stderr: "" };
    if (["git-head", "git-origin-main"].includes(id)) return { code: 0, stdout: `${HEAD}\n`, stderr: "" };
    if (["git-local-tag", "git-remote-tag"].includes(id)) return { code: 0, stdout: "", stderr: "" };
    if (id === "npm-version") return { code: 1, stdout: "", stderr: "npm ERR! code E404" };
    if (id === "github-ci") return { code: 0, stdout: JSON.stringify([
      { databaseId: 20, workflowName: "CI", headSha: HEAD, status: "completed", conclusion: "success", createdAt: LATEST_RUN },
      { databaseId: 21, workflowName: "pi-subagents upgrade compatibility", headSha: HEAD, status: "completed", conclusion: "success", createdAt: LATEST_RUN },
    ]), stderr: "" };
    return undefined;
  };
  try {
    let verificationCalled = false;
    const dirty = await runReleaseCheck({ phase: "tag", version: VERSION }, {
      root,
      run: async (id: string) => {
        if (id.startsWith("verification-")) verificationCalled = true;
        return staticResult(id, true) ?? { code: 0, stdout: "passed", stderr: "" };
      },
    });
    assert.equal(dirty.verdict, "fail");
    assert.equal(verificationCalled, false);

    let statusCalls = 0;
    const isolatedEnvironments: any[] = [];
    const previousToken = process.env.NPM_TOKEN;
    process.env.NPM_TOKEN = "PRIVATE_RELEASE_TOKEN";
    try {
      const drifted = await runReleaseCheck({ phase: "tag", version: VERSION }, {
        root,
        run: async (id: string, _command: string, _args: string[], options: any) => {
          if (id === "git-status") {
            statusCalls += 1;
            return staticResult(id, statusCalls > 1);
          }
          if (id === "verification-audit") {
            return { code: 0, stdout: JSON.stringify({ metadata: { vulnerabilities: {} } }), stderr: "" };
          }
          if (id.startsWith("verification-")) {
            isolatedEnvironments.push(options.env);
            return { code: 0, stdout: "passed", stderr: "" };
          }
          return staticResult(id, false);
        },
      });
      assert.equal(drifted.verdict, "fail");
      assert.equal(statusCalls, 2);
      assert.equal(isolatedEnvironments.length, 2);
      for (const environment of isolatedEnvironments) {
        assert.equal(environment.NPM_TOKEN, undefined);
        assert.equal(environment.GITHUB_TOKEN, undefined);
        assert.ok(environment.HOME.includes("pi-forge-release-check-"));
        assert.equal(environment.GIT_TERMINAL_PROMPT, "0");
      }
    } finally {
      if (previousToken === undefined) delete process.env.NPM_TOKEN;
      else process.env.NPM_TOKEN = previousToken;
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("release preflight reads real disposable Git and bare-remote state without mutating refs", async () => {
  const root = await releaseFixture();
  const remote = await mkdtemp(join(tmpdir(), "pi-forge-release-remote-"));
  const git = async (args: string[], cwd = root) => {
    const result = await runCommand("git", args, { cwd, timeout: 10_000 });
    assert.equal(result.code, 0, result.stderr || result.stdout);
    return result.stdout.trim();
  };
  try {
    await git(["init", "--bare", remote], tmpdir());
    await git(["init", "-b", "main"]);
    await git(["config", "user.name", "Pi Forge Test"]);
    await git(["config", "user.email", "pi-forge@example.invalid"]);
    await git(["add", "package.json", "package-lock.json", "README.md"]);
    await git(["commit", "-m", "fixture"]);
    await git(["remote", "add", "origin", remote]);
    await git(["push", "-u", "origin", "main"]);
    const head = await git(["rev-parse", "HEAD"]);
    const localRefsBefore = await git(["show-ref"]);
    const remoteRefsBefore = await git(["--git-dir", remote, "show-ref"], tmpdir());
    const calls: string[] = [];
    const result = await runReleaseCheck({ phase: "tag", version: VERSION }, {
      root,
      run: async (id: string, command: string, args: string[], options: any) => {
        calls.push(id);
        if (command === "git") return runCommand(command, args, options);
        if (id === "npm-version") return { code: 1, stdout: "", stderr: "npm ERR! code E404" };
        if (id === "github-ci") return { code: 0, stdout: JSON.stringify([
          { databaseId: 30, workflowName: "CI", headSha: head, status: "completed", conclusion: "success", createdAt: LATEST_RUN },
          { databaseId: 31, workflowName: "pi-subagents upgrade compatibility", headSha: head, status: "completed", conclusion: "success", createdAt: LATEST_RUN },
        ]), stderr: "" };
        if (id === "verification-audit") return { code: 0, stdout: JSON.stringify({ metadata: { vulnerabilities: {} } }), stderr: "" };
        if (id.startsWith("verification-")) return { code: 0, stdout: "passed", stderr: "" };
        throw new Error(`unexpected command ${id}: ${command} ${args.join(" ")}`);
      },
    });
    assert.equal(result.verdict, "pass");
    assert.equal(await git(["show-ref"]), localRefsBefore);
    assert.equal(await git(["--git-dir", remote, "show-ref"], tmpdir()), remoteRefsBefore);

    await writeFile(join(root, "README.md"), `pi install npm:@maroffo/pi-forge@${VERSION}\nlocal divergence\n`);
    await git(["add", "README.md"]);
    await git(["commit", "-m", "diverge"]);
    calls.length = 0;
    const diverged = await runReleaseCheck({ phase: "tag", version: VERSION }, {
      root,
      run: async (id: string, command: string, args: string[], options: any) => {
        calls.push(id);
        if (command === "git") return runCommand(command, args, options);
        if (id === "npm-version") return { code: 1, stdout: "", stderr: "npm ERR! code E404" };
        if (id === "github-ci") return { code: 0, stdout: "[]", stderr: "" };
        throw new Error(`execution evidence must not run after divergent Git state: ${id}`);
      },
    });
    assert.equal(diverged.verdict, "fail");
    assert.equal(calls.some((id) => id.startsWith("verification-")), false);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(remote, { recursive: true, force: true });
  }
});

test("missing CLI and malformed remote output are indeterminate through the injected runner", async () => {
  const root = await releaseFixture();
  try {
    const result = await runReleaseCheck({ phase: "tag", version: VERSION }, {
      root,
      run: async (id: string) => {
        if (id === "git-status") return { code: 0, stdout: "", stderr: "" };
        if (id === "git-branch") return { code: 0, stdout: "main\n", stderr: "" };
        if (["git-head", "git-origin-main"].includes(id)) return { code: 0, stdout: `${HEAD}\n`, stderr: "" };
        if (["git-local-tag", "git-remote-tag"].includes(id)) return { code: 0, stdout: "", stderr: "" };
        if (id === "npm-version") return { code: 1, stdout: "", stderr: "network unavailable" };
        if (id === "github-ci") return { code: 0, stdout: "not json", stderr: "" };
        return { code: null, error: "spawn ENOENT", stdout: "", stderr: "" };
      },
    });
    assert.equal(result.verdict, "indeterminate");
    assert.ok(result.checks.some((item) => item.status === "indeterminate"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("release subprocess runner bounds captured output", async () => {
  const result = await runCommand(process.execPath, [
    "-e",
    "process.stdout.write('x'.repeat(2 * 1024 * 1024)); process.stdout.write('TAIL')",
  ], { timeout: 10_000 });
  assert.equal(result.code, 0);
  assert.ok(Buffer.byteLength(result.stdout) <= 1024 * 1024);
  assert.match(result.stdout, /TAIL$/);
});

test("ordinary release command classifier catches creation/publication but allows reads and quoted prose", () => {
  assert.deepEqual(classifyReleaseCommand("git tag --force v0.3.0"), ["git-tag-force"]);
  for (const command of [
    "git tag v0.3.0",
    "git tag -a v0.3.0 -m v0.3.0",
    "git -C /tmp/repo tag -s v0.3.0 -m signed",
    "npm publish --access public --tag latest",
    "env FOO=bar npm publish",
    "sh -c 'npm publish --access public'",
  ]) assert.ok(classifyReleaseCommand(command).length > 0, command);
  for (const command of [
    "git tag",
    "git tag --list 'v*'",
    "git tag -n10",
    "git tag -v v0.3.0",
    "git tag -d v0.3.0",
    "npm view @maroffo/pi-forge version",
    "npm pack --dry-run --json",
    "echo 'npm publish and git tag v0.3.0'",
  ]) assert.deepEqual(classifyReleaseCommand(command), [], command);
});

function guardHarness(confirm?: boolean) {
  const handlers = new Map<string, (...args: any[]) => any>();
  releaseGuard({ on(name: string, handler: (...args: any[]) => any) { handlers.set(name, handler); } } as any);
  return {
    call: handlers.get("tool_call")!,
    context: { hasUI: confirm !== undefined, ui: { confirm: async () => confirm } },
  };
}

test("project release guard confirms risky Bash calls and blocks them headless", async () => {
  const headless = guardHarness();
  assert.match((await headless.call({ toolName: "bash", input: { command: "npm publish" } }, headless.context)).reason, /interactive confirmation/);
  assert.equal(await headless.call({ toolName: "bash", input: { command: "npm view x version" } }, headless.context), undefined);
  const approved = guardHarness(true);
  assert.equal(await approved.call({ toolName: "bash", input: { command: "git tag -a v0.3.0 -m v0.3.0" } }, approved.context), undefined);
  const denied = guardHarness(false);
  assert.match((await denied.call({ toolName: "bash", input: { command: "git tag v0.3.0" } }, denied.context)).reason, /not approved/);
  assert.match((await approved.call({ toolName: "bash", input: { command: "git tag --force v0.3.0" } }, approved.context)).reason, /unsupported/);
});
