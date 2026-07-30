// ABOUTME: Verifies deterministic score computation, missing-gate refusal, local history, and command output.
// ABOUTME: Uses disposable repositories and process fakes without invoking project build code.

import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import scoreExtension, {
  computeStaticScore,
  discoverLiteralMakeTargets,
  formatScoreReport,
  parseScoreTarget,
  runLocalProcess,
  runScore,
} from "../extensions/score.ts";

async function fixture(withMakefile = true) {
  const root = await mkdtemp(join(tmpdir(), "pi-forge-score-"));
  await mkdir(join(root, ".git"), { recursive: true });
  if (withMakefile) {
    await writeFile(join(root, "Makefile"), "check:\n\t@true\n\ntest-e2e:\n\t@true\n");
  }
  return root;
}

function fakePi(root: string, gateResults: Record<string, { code: number | null; stdout?: string; stderr?: string; killed?: boolean; signal?: NodeJS.Signals | null; error?: string }>) {
  const calls: Array<{ command: string; args: string[] }> = [];
  const runProcess = async (command: string, args: string[]) => {
    calls.push({ command, args });
    return gateResults[args[0]!] ?? { code: 2, stderr: "unexpected target" };
  };
  return {
    calls,
    runProcess,
    api: {
      async exec(command: string, args: string[]) {
        calls.push({ command, args });
        if (command === "git" && args.join(" ") === "rev-parse --show-toplevel") {
          return { code: 0, stdout: `${root}\n`, stderr: "" };
        }
        if (command === "git" && args.join(" ") === "rev-parse --git-common-dir") {
          return { code: 0, stdout: ".git\n", stderr: "" };
        }
        if (command === "git" && args.join(" ") === "branch --show-current") {
          return { code: 0, stdout: "feat/score\n", stderr: "" };
        }
        return { code: 1, stderr: "unexpected command" };
      },
    } as any,
  };
}

test("score target parser is narrow and defaults to commit", () => {
  assert.equal(parseScoreTarget(""), "commit");
  assert.equal(parseScoreTarget(" PR "), "pr");
  assert.equal(parseScoreTarget("excellence"), "excellence");
  assert.throws(() => parseScoreTarget("release"), /Usage: \/score/);
});

test("Make target discovery accepts only literal root definitions", () => {
  const targets = discoverLiteralMakeTargets([
    ".PHONY: check test-e2e",
    "check other:",
    "\t@true",
    "test-e2e: check",
    "dynamic-%:",
    "NAME := ignored",
  ].join("\n"));
  assert.deepEqual([...targets].sort(), [".PHONY", "check", "other", "test-e2e"]);
});

test("escaped and conditional Make rules cannot fabricate gate discovery", async () => {
  const root = await fixture(false);
  try {
    const fake = fakePi(root, {});
    await writeFile(join(root, "Makefile"), "check:\n\t@true\nignored\\ test-e2e:\n\t@true\n");
    await writeFile(join(root, "test-e2e"), "not a gate\n");
    const makeFalsePass = await runLocalProcess("make", ["test-e2e"], {
      cwd: root,
      timeout: 10_000,
      sanitizeMakeEnvironment: true,
    });
    assert.equal(makeFalsePass.code, 0, "fixture must reproduce Make's existing-file false pass");
    const escapedResult = await runScore(fake.api, root, "commit");
    assert.equal(escapedResult.score, null);
    assert.deepEqual(escapedResult.gates.map((gate) => gate.status), ["not-run", "missing"]);

    await rm(join(root, "test-e2e"), { force: true });
    await writeFile(
      join(root, "Makefile"),
      "check:\n\t@true\nifeq (1,0)\ntest-e2e:\n\t@true\nendif\n",
    );
    const inactiveResult = await runScore(fake.api, root, "commit");
    assert.equal(inactiveResult.score, null);
    assert.match(inactiveResult.gates[0]?.evidence ?? "", /not statically scoreable/);

    await writeFile(join(root, "Makefile"), "check:\n\t@true\n# continued comment \\\ntest-e2e:\n");
    await writeFile(join(root, "test-e2e"), "not a gate\n");
    const commentFalsePass = await runLocalProcess("make", ["test-e2e"], {
      cwd: root,
      timeout: 10_000,
      sanitizeMakeEnvironment: true,
    });
    assert.equal(commentFalsePass.code, 0, "fixture must reproduce continued-comment false pass");
    const commentResult = await runScore(fake.api, root, "commit");
    assert.equal(commentResult.score, null);
    assert.match(commentResult.gates[0]?.evidence ?? "", /continuation syntax/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("static score is 100 only when both gates pass", () => {
  assert.equal(computeStaticScore([
    { name: "check", command: "make check", status: "pass" },
    { name: "e2e", command: "make test-e2e", status: "pass" },
  ]), 100);
  assert.equal(computeStaticScore([
    { name: "check", command: "make check", status: "fail" },
    { name: "e2e", command: "make test-e2e", status: "pass" },
  ]), 0);
  assert.equal(computeStaticScore([
    { name: "check", command: "make check", status: "missing" },
    { name: "e2e", command: "make test-e2e", status: "pass" },
  ]), null);
});

test("passing gates produce a measured score and append Git-local history", async () => {
  const root = await fixture();
  try {
    const fake = fakePi(root, { check: { code: 0 }, "test-e2e": { code: 0 } });
    const result = await runScore(fake.api, root, "pr", { runProcess: fake.runProcess });

    assert.equal(result.score, 100);
    assert.deepEqual(result.gates.map((gate) => gate.status), ["pass", "pass"]);
    assert.equal(result.history.written, true);
    assert.match(formatScoreReport(result), /Ready to open PR: yes/);
    assert.match(formatScoreReport(result), /static repository gates only/);

    const rows = (await readFile(join(root, ".git", "pi-forge", "score-history.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].score, 100);
    assert.equal(rows[0].target, "pr");
    assert.equal(rows[0].branch, "feat/score");
    assert.deepEqual(
      fake.calls.filter((call) => call.command === "make").map((call) => call.args),
      [["check"], ["test-e2e"]],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a failing gate forces score zero and preserves failure evidence", async () => {
  const root = await fixture();
  try {
    const fake = fakePi(root, {
      check: { code: 2, stderr: "lint failed" },
      "test-e2e": { code: 0 },
    });
    const result = await runScore(fake.api, root, "commit", { runProcess: fake.runProcess });
    const report = formatScoreReport(result);

    assert.equal(result.score, 0);
    assert.deepEqual(result.gates.map((gate) => gate.status), ["fail", "not-run"]);
    assert.equal(fake.calls.filter((call) => call.command === "make").length, 1);
    assert.match(report, /Score: 0\/100/);
    assert.match(report, /lint failed/);
    assert.match(report, /Ready to commit:  no/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("missing make targets refuse to score instead of reporting zero or 100", async () => {
  const root = await fixture();
  try {
    await writeFile(join(root, "Makefile"), "other:\n\t@true\n");
    const fake = fakePi(root, {});
    const result = await runScore(fake.api, root, "commit", { runProcess: fake.runProcess });
    const report = formatScoreReport(result);

    assert.equal(result.score, null);
    assert.deepEqual(result.gates.map((gate) => gate.status), ["missing", "missing"]);
    assert.equal(fake.calls.some((call) => call.command === "make"), false);
    assert.equal(result.history.written, false);
    assert.match(report, /Score: inconclusive/);
    assert.match(report, /Ready to commit:  inconclusive/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("killed gate is inconclusive rather than a fabricated failure score", async () => {
  const root = await fixture();
  try {
    const fake = fakePi(root, { check: { code: null, killed: true, signal: "SIGTERM" } });
    const result = await runScore(fake.api, root, "commit", { runProcess: fake.runProcess });
    assert.equal(result.score, null);
    assert.deepEqual(result.gates.map((gate) => gate.status), ["error", "not-run"]);
    assert.equal(result.history.written, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("spawn errors are inconclusive rather than definite gate failures", async () => {
  const root = await fixture();
  try {
    const fake = fakePi(root, { check: { code: null, error: "spawn make ENOENT" } });
    const result = await runScore(fake.api, root, "commit", { runProcess: fake.runProcess });
    assert.equal(result.score, null);
    assert.deepEqual(result.gates.map((gate) => gate.status), ["error", "not-run"]);
    assert.match(result.gates[0]?.evidence ?? "", /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("missing Makefile does not execute make", async () => {
  const root = await fixture(false);
  try {
    const fake = fakePi(root, {});
    const result = await runScore(fake.api, root, "commit", { runProcess: fake.runProcess });
    assert.equal(result.score, null);
    assert.equal(fake.calls.some((call) => call.command === "make"), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("local runner strips inherited Make controls and preserves process signals", async () => {
  const root = await fixture(false);
  const previousMakeflags = process.env.MAKEFLAGS;
  try {
    await writeFile(join(root, "Makefile"), "check:\n\t@printf ran > marker\n");
    process.env.MAKEFLAGS = "-n";
    const makeResult = await runLocalProcess("make", ["check"], {
      cwd: root,
      timeout: 10_000,
      sanitizeMakeEnvironment: true,
    });
    assert.equal(makeResult.code, 0);
    assert.equal(await readFile(join(root, "marker"), "utf8"), "ran");

    const signalResult = await runLocalProcess(process.execPath, ["-e", "process.kill(process.pid, 'SIGTERM')"], {
      cwd: root,
      timeout: 10_000,
    });
    assert.equal(signalResult.signal, "SIGTERM");
    assert.equal(signalResult.killed, true);

    const missingResult = await runLocalProcess("pi-forge-command-that-does-not-exist", [], {
      cwd: root,
      timeout: 10_000,
    });
    assert.equal(missingResult.code, null);
    assert.match(missingResult.error ?? "", /ENOENT/);
  } finally {
    if (previousMakeflags === undefined) delete process.env.MAKEFLAGS;
    else process.env.MAKEFLAGS = previousMakeflags;
    await rm(root, { recursive: true, force: true });
  }
});

test("registered command emits the deterministic report without a model turn", async () => {
  const root = await fixture();
  try {
    const fake = fakePi(root, { check: { code: 0 }, "test-e2e": { code: 0 } });
    let handler: ((args: string, ctx: any) => Promise<void>) | undefined;
    const entries: any[] = [];
    const statuses: Array<string | undefined> = [];
    const notifications: Array<{ message: string; level: string }> = [];
    scoreExtension({
      ...fake.api,
      registerCommand(name: string, options: { handler: typeof handler }) {
        assert.equal(name, "score");
        handler = options.handler;
      },
      appendEntry(type: string, data: unknown) { entries.push({ type, data }); },
    } as any, { runProcess: fake.runProcess });

    await handler?.("commit", {
      cwd: root,
      hasUI: true,
      isProjectTrusted: () => false,
      ui: {
        notify(message: string, level: string) { notifications.push({ message, level }); },
        setStatus() {},
      },
    });
    assert.equal(entries.length, 0);
    assert.match(notifications[0]?.message ?? "", /requires a trusted project/);

    await handler?.("excellence", {
      cwd: root,
      hasUI: true,
      isProjectTrusted: () => true,
      ui: {
        notify(message: string, level: string) { notifications.push({ message, level }); },
        setStatus(_name: string, value: string | undefined) { statuses.push(value); },
      },
    });

    assert.equal(entries[0]?.type, "pi-forge.score.v1");
    assert.equal(entries[0]?.data.gates[0].evidence, undefined);
    assert.match(notifications.at(-1)?.message ?? "", /Target: excellence \(threshold 95\)/);
    assert.deepEqual(statuses, ["Running quality gates...", undefined]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
