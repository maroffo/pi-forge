// ABOUTME: Exercises the source-control commit gate in disposable Git repositories.
// ABOUTME: Proves all primary-branch refusals, normal commits, and unsafe-argument rejection.

import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GATE = join(ROOT, "skills", "source-control", "scripts", "commit-gate.sh");

function run(cwd: string, command: string, args: string[]) {
  return spawnSync(command, args, { cwd, encoding: "utf8" });
}

function git(cwd: string, ...args: string[]) {
  const result = run(cwd, "git", args);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

test("commit gate refuses primary branches and unsafe commit modes", () => {
  const repository = mkdtempSync(join(tmpdir(), "pi-forge-commit-gate-"));
  try {
    git(repository, "init", "-b", "main");
    git(repository, "config", "user.name", "Pi Forge Test");
    git(repository, "config", "user.email", "pi-forge@example.invalid");
    writeFileSync(join(repository, "initial.txt"), "initial\n");
    git(repository, "add", "initial.txt");
    git(repository, "commit", "-m", "test: initial commit");
    writeFileSync(join(repository, "change.txt"), "first\n");
    git(repository, "add", "change.txt");

    for (const branch of ["main", "dev", "master"]) {
      if (branch !== "main") git(repository, "switch", "-c", branch);
      const protectedAttempt = run(repository, "bash", [GATE, "--", "-m", `test: blocked on ${branch}`]);
      assert.equal(protectedAttempt.status, 1);
      assert.match(protectedAttempt.stderr, new RegExp(`protected branch: ${branch}`));
      assert.equal(git(repository, "diff", "--cached", "--name-only"), "change.txt");
    }

    const unborn = mkdtempSync(join(tmpdir(), "pi-forge-commit-gate-unborn-"));
    try {
      git(unborn, "init", "-b", "feat/unborn");
      git(unborn, "config", "user.name", "Pi Forge Test");
      git(unborn, "config", "user.email", "pi-forge@example.invalid");
      writeFileSync(join(unborn, "first.txt"), "first\n");
      git(unborn, "add", "first.txt");
      const unbornAttempt = run(unborn, "bash", [GATE, "--", "-m", "test: refuse branch creation"]);
      assert.equal(unbornAttempt.status, 1);
      assert.match(unbornAttempt.stderr, /unborn branch: feat\/unborn/);
    } finally {
      rmSync(unborn, { recursive: true, force: true });
    }

    git(repository, "switch", "-c", "test/commit-gate");
    const commit = run(repository, "bash", [GATE, "--", "-m", "test: exercise commit gate"]);
    assert.equal(commit.status, 0, commit.stderr || commit.stdout);
    assert.equal(git(repository, "log", "-1", "--format=%s"), "test: exercise commit gate");

    writeFileSync(join(repository, "second.txt"), "second\n");
    writeFileSync(join(repository, "change.txt"), "first\nunrelated\n");
    git(repository, "add", "second.txt");
    const hook = join(repository, ".git", "hooks", "pre-commit");
    writeFileSync(hook, "#!/usr/bin/env bash\nexit 1\n");
    chmodSync(hook, 0o755);

    const bypasses = [
      ["-am", "test: implicit staging"],
      ["-nm", "test: clustered hook bypass"],
      ["--no-ver", "-m", "test: abbreviated hook bypass"],
      ["-m", "test: positional pathspec", "change.txt"],
    ];
    for (const arguments_ of bypasses) {
      const attempt = run(repository, "bash", [GATE, "--", ...arguments_]);
      assert.equal(attempt.status, 2, attempt.stderr || attempt.stdout);
      assert.match(attempt.stderr, /unsupported git commit argument/);
      assert.equal(git(repository, "rev-list", "--count", "HEAD"), "2");
      assert.equal(git(repository, "diff", "--cached", "--name-only"), "second.txt");
      assert.equal(git(repository, "diff", "--name-only"), "change.txt");
    }
  } finally {
    rmSync(repository, { recursive: true, force: true });
  }
});
