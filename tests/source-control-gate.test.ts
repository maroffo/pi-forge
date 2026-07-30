// ABOUTME: Exercises the source-control commit gate in disposable Git repositories.
// ABOUTME: Proves protected-branch refusal, normal commits, and unsafe-argument rejection.

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

test("commit gate refuses protected branches and unsafe commit modes", () => {
  const repository = mkdtempSync(join(tmpdir(), "pi-forge-commit-gate-"));
  try {
    git(repository, "init", "-b", "main");
    git(repository, "config", "user.name", "Pi Forge Test");
    git(repository, "config", "user.email", "pi-forge@example.invalid");
    writeFileSync(join(repository, "change.txt"), "first\n");
    git(repository, "add", "change.txt");

    const protectedAttempt = run(repository, "bash", [GATE, "--", "-m", "test: blocked on main"]);
    assert.equal(protectedAttempt.status, 1);
    assert.match(protectedAttempt.stderr, /protected branch: main/);
    assert.equal(git(repository, "diff", "--cached", "--name-only"), "change.txt");

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
      assert.equal(git(repository, "rev-list", "--count", "HEAD"), "1");
      assert.equal(git(repository, "diff", "--cached", "--name-only"), "second.txt");
      assert.equal(git(repository, "diff", "--name-only"), "change.txt");
    }
  } finally {
    rmSync(repository, { recursive: true, force: true });
  }
});
