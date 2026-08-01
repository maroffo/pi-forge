// ABOUTME: Verifies project-checks metadata detection, Make compatibility, and fail-closed evidence labels.
// ABOUTME: Uses disposable roots and never executes discovered project commands.

import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  inspectProject,
  parseArguments,
} from "../skills/project-checks/scripts/inspect-project-checks.mjs";

async function fixture() {
  return mkdtemp(join(tmpdir(), "pi-forge-project-checks-"));
}

async function withFixture(run: (root: string) => Promise<void>) {
  const root = await fixture();
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("project-checks arguments require one explicit root", () => {
  assert.deepEqual(parseArguments(["--root", "."]), { root: process.cwd() });
  assert.throws(() => parseArguments([]), /Usage/);
  assert.throws(() => parseArguments(["--root", ".", "extra"]), /Usage/);
  assert.throws(() => parseArguments(["--other", "."]), /Usage/);
});

test("JavaScript scripts are observed without relabelling unit or integration tests as E2E", async () => {
  await withFixture(async (root) => {
    await writeFile(join(root, "package.json"), `${JSON.stringify({
      scripts: {
        check: "eslint .",
        test: "node --test",
        "test:integration": "node integration.mjs",
        "test:e2e": "playwright test",
      },
    })}\n`);
    await writeFile(join(root, "package-lock.json"), "{}\n");
    const result = await inspectProject(root);

    assert.deepEqual(result.ecosystems.map((item) => item.name), ["javascript-typescript"]);
    assert.deepEqual(result.candidates.check.map((item) => item.command), ["npm run check"]);
    assert.deepEqual(result.candidates.testE2E.map((item) => item.command), ["npm run test:e2e"]);
    assert.ok(result.candidates.check.every((item) => item.evidence === "observed"));
    assert.ok(result.candidates.testE2E.every((item) => item.evidence === "observed"));
    assert.equal(result.safeToPropose.check, true);
    assert.equal(result.safeToPropose.testE2E, true);
    assert.ok(result.unresolved.some((item) => item.code === "integration-is-not-e2e"));
    assert.doesNotMatch(JSON.stringify(result.candidates.testE2E), /npm (?:run )?test(?:"|\s)/);
  });
});

test("unit-only projects keep E2E unresolved and score-inconclusive", async () => {
  await withFixture(async (root) => {
    await writeFile(join(root, "package.json"), `${JSON.stringify({
      packageManager: "npm@10.0.0",
      scripts: { check: "eslint .", test: "node --test" },
    })}\n`);
    const result = await inspectProject(root);

    assert.equal(result.candidates.testE2E.length, 0);
    assert.equal(result.safeToPropose.testE2E, false);
    assert.ok(result.unresolved.some((item) => item.code === "missing-e2e-evidence"));
    assert.doesNotMatch(JSON.stringify(result.candidates), /(?:^|["\s])true(?:["\s]|$)/);
  });
});

test("five supported ecosystems remain evidence-labelled in a mixed project", async () => {
  await withFixture(async (root) => {
    await writeFile(join(root, "package.json"), `${JSON.stringify({
      packageManager: "npm@10.0.0",
      scripts: { lint: "eslint ." },
    })}\n`);
    await writeFile(join(root, "pyproject.toml"), "[tool.ruff]\n[tool.pytest.ini_options]\n");
    await writeFile(join(root, "go.mod"), "module example.test/project\n");
    await writeFile(join(root, "Gemfile"), "gem 'rubocop'\ngem 'rspec'\n");
    await writeFile(join(root, "Cargo.toml"), "[package]\nname = 'fixture'\nversion = '0.1.0'\n");
    const result = await inspectProject(root);

    assert.deepEqual(result.ecosystems.map((item) => item.name), [
      "javascript-typescript", "python", "go", "ruby", "rust",
    ]);
    assert.ok(result.candidates.check.some((item) => item.evidence === "observed" && item.command === "npm run lint"));
    for (const ecosystem of ["python", "go", "ruby", "rust"]) {
      assert.ok(result.candidates.check.some((item) => item.ecosystem === ecosystem && item.evidence === "conventional"));
    }
    assert.equal(result.candidates.testE2E.length, 0);
  });
});

test("existing targets and ambiguous Make syntax freeze proposals without overwriting", async () => {
  await withFixture(async (root) => {
    await writeFile(join(root, "package.json"), `${JSON.stringify({
      packageManager: "npm@10.0.0",
      scripts: { check: "eslint .", "test:e2e": "playwright test" },
    })}\n`);
    await writeFile(join(root, "Makefile"), "check:\n\t@npm run check\n");
    const existing = await inspectProject(root);
    assert.equal(existing.makefile.status, "supported");
    assert.equal(existing.safeToPropose.check, false);
    assert.equal(existing.safeToPropose.testE2E, true);

    await writeFile(join(root, "Makefile"), "check:\n\t@npm run check\ncheck:\n\t@npm run lint\ntest-e2e:\n\t@npm run test:e2e\n");
    const duplicate = await inspectProject(root);
    assert.equal(duplicate.makefile.status, "unsupported");
    assert.deepEqual(duplicate.makefile.duplicateRequiredTargets, ["check"]);
    assert.equal(duplicate.safeToPropose.check, false);
    assert.equal(duplicate.safeToPropose.testE2E, false);

    await writeFile(join(root, "Makefile"), "ifeq (1,1)\ncheck:\n\t@npm run check\nendif\n");
    const conditional = await inspectProject(root);
    assert.equal(conditional.makefile.status, "unsupported");
    assert.match(conditional.makefile.reason, /conditional/);
    assert.deepEqual(conditional.safeToPropose, { check: false, testE2E: false });

    await writeFile(join(root, "Makefile"), "include checks.mk\ncheck:\n\t@npm run check\n");
    const included = await inspectProject(root);
    assert.equal(included.makefile.status, "unsupported");
    assert.match(included.makefile.reason, /imports another Makefile/);
    assert.deepEqual(included.safeToPropose, { check: false, testE2E: false });
  });
});

test("package manager evidence must be explicit and consistent", async () => {
  await withFixture(async (root) => {
    await writeFile(join(root, "package.json"), `${JSON.stringify({ scripts: { check: "eslint .", "test:e2e": "playwright test" } })}\n`);
    const missing = await inspectProject(root);
    assert.ok(missing.unresolved.some((item) => item.code === "missing-package-manager-evidence"));
    assert.deepEqual(missing.safeToPropose, { check: false, testE2E: false });
    assert.equal(missing.candidates.check.length, 0);

    await writeFile(join(root, "package.json"), `${JSON.stringify({
      packageManager: "pnpm@9.0.0",
      scripts: { check: "eslint .", "test:e2e": "playwright test" },
    })}\n`);
    await writeFile(join(root, "package-lock.json"), "{}\n");
    const conflict = await inspectProject(root);
    assert.ok(conflict.unresolved.some((item) => item.code === "ambiguous-package-manager"));
    assert.deepEqual(conflict.safeToPropose, { check: false, testE2E: false });
    assert.equal(conflict.candidates.check.length, 0);
  });
});

test("ambiguous package managers and unsupported build systems are explicit", async () => {
  await withFixture(async (root) => {
    await writeFile(join(root, "package.json"), `${JSON.stringify({ scripts: { check: "eslint .", "test:e2e": "playwright test" } })}\n`);
    await writeFile(join(root, "package-lock.json"), "{}\n");
    await writeFile(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    await writeFile(join(root, "WORKSPACE.bazel"), "\n");
    const result = await inspectProject(root);

    assert.ok(result.unresolved.some((item) => item.code === "ambiguous-package-manager"));
    assert.ok(result.unresolved.some((item) => item.code === "unsupported-build-system"));
    assert.deepEqual(result.safeToPropose, { check: false, testE2E: false });
    assert.equal(result.candidates.check.length, 0);
  });
});

test("malformed, oversized, and symlinked metadata fail before inspection", async () => {
  await withFixture(async (root) => {
    await writeFile(join(root, "package.json"), "not json\n");
    await assert.rejects(inspectProject(root), /not valid JSON/);

    await writeFile(join(root, "package.json"), "x".repeat(1024 * 1024 + 1));
    await assert.rejects(inspectProject(root), /1MB metadata limit/);

    const outside = join(tmpdir(), `pi-forge-project-checks-outside-${process.pid}.json`);
    await writeFile(outside, "{}\n");
    await rm(join(root, "package.json"));
    await symlink(outside, join(root, "package.json"));
    try {
      await assert.rejects(inspectProject(root), /must not be a symbolic link/);
    } finally {
      await rm(outside, { force: true });
    }
  });
});

test("unsupported projects report no ecosystem and emit no Makefile body", async () => {
  await withFixture(async (root) => {
    await mkdir(join(root, "src"));
    const result = await inspectProject(root);
    assert.equal(result.ecosystems.length, 0);
    assert.ok(result.unresolved.some((item) => item.code === "unsupported-ecosystem"));
    assert.equal(Object.hasOwn(result, "makefileText"), false);
    assert.deepEqual(result.safeToPropose, { check: false, testE2E: false });
  });
});
