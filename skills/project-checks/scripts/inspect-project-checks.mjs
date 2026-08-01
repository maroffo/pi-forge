#!/usr/bin/env node
// ABOUTME: Inspects fixed project metadata for truthful Pi Forge check-gate onboarding.
// ABOUTME: Never executes discovered commands, writes files, or follows symlinked metadata.

import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { inspectLiteralMakeTargets } from "../../../src/makefile-policy.js";

const MAX_METADATA_BYTES = 1024 * 1024;
const REQUIRED_TARGETS = ["check", "test-e2e"];
const MAKEFILE_NAMES = ["GNUmakefile", "Makefile", "makefile"];
const JS_LOCKS = [
  ["package-lock.json", "npm"],
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
];
const UNSUPPORTED_BUILD_MARKERS = [
  ["WORKSPACE", "Bazel"],
  ["WORKSPACE.bazel", "Bazel"],
  ["BUILD.bazel", "Bazel"],
  ["buck2.toml", "Buck2"],
  ["pom.xml", "Maven"],
  ["build.gradle", "Gradle"],
  ["build.gradle.kts", "Gradle"],
];

function usage() {
  return "Usage: inspect-project-checks.mjs --root <project-root>";
}

export function parseArguments(argv) {
  if (argv.length !== 2 || argv[0] !== "--root" || !argv[1]) throw new Error(usage());
  return { root: resolve(argv[1]) };
}

async function regularPath(root, name, options = {}) {
  const path = join(root, name);
  let stats;
  try {
    stats = await lstat(path);
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
  if (stats.isSymbolicLink()) throw new Error(`${name} must not be a symbolic link`);
  if (options.directory ? !stats.isDirectory() : !stats.isFile()) {
    throw new Error(`${name} must be a ${options.directory ? "directory" : "regular file"}`);
  }
  if (!options.directory && stats.size > MAX_METADATA_BYTES) {
    throw new Error(`${name} exceeds the 1MB metadata limit`);
  }
  return { path, stats };
}

async function textMetadata(root, name) {
  const candidate = await regularPath(root, name);
  if (!candidate) return undefined;
  if (typeof constants.O_NOFOLLOW !== "number") throw new Error("safe no-follow metadata reads are unsupported on this platform");
  let handle;
  try {
    handle = await open(candidate.path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const stats = await handle.stat();
    if (!stats.isFile()) throw new Error(`${name} must be a regular file`);
    if (stats.size > MAX_METADATA_BYTES) throw new Error(`${name} exceeds the 1MB metadata limit`);
    return await handle.readFile("utf8");
  } finally {
    await handle?.close();
  }
}

function packageCommand(manager, script) {
  if (manager === "yarn") return `yarn ${script}`;
  if (manager === "pnpm" || manager === "bun") return `${manager} run ${script}`;
  return `npm run ${script}`;
}

function declaredPackageManager(value) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("package.json packageManager must be a non-empty string when present");
  }
  const match = /^(npm|pnpm|yarn|bun)@[^\s]+$/.exec(value.trim());
  return match ? match[1] : null;
}

function candidate(evidence, ecosystem, command, source) {
  return { evidence, ecosystem, command, source };
}

async function inspectMakefile(root) {
  const present = [];
  const identities = new Set();
  for (const name of MAKEFILE_NAMES) {
    const candidate = await regularPath(root, name);
    if (!candidate) continue;
    const identity = `${candidate.stats.dev}:${candidate.stats.ino}`;
    if (identities.has(identity)) continue;
    identities.add(identity);
    present.push(name);
  }
  if (present.length === 0) {
    return {
      status: "missing",
      targets: [],
      duplicateRequiredTargets: [],
      proposalFrozen: false,
    };
  }
  if (present.length > 1) {
    return {
      status: "ambiguous",
      files: present,
      targets: [],
      duplicateRequiredTargets: [],
      proposalFrozen: true,
      reason: "multiple root Makefile names are present",
    };
  }

  const content = await textMetadata(root, present[0]);
  const inspection = inspectLiteralMakeTargets(content);
  const duplicates = REQUIRED_TARGETS.filter((target) => inspection.duplicateTargets.has(target));
  if (inspection.unsupportedReason || duplicates.length > 0 || inspection.includeDirectives.length > 0) {
    return {
      status: "unsupported",
      file: present[0],
      targets: [...inspection.targets].sort(),
      duplicateRequiredTargets: duplicates,
      proposalFrozen: true,
      reason: inspection.unsupportedReason
        ?? (duplicates.length > 0
          ? `required target '${duplicates[0]}' has multiple definitions`
          : `line ${inspection.includeDirectives[0].line} imports another Makefile`),
    };
  }
  return {
    status: "supported",
    file: present[0],
    targets: [...inspection.targets].sort(),
    duplicateRequiredTargets: [],
    proposalFrozen: false,
  };
}

async function inspectJavaScript(root, output) {
  const raw = await textMetadata(root, "package.json");
  if (raw === undefined) return;
  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch {
    throw new Error("package.json is not valid JSON");
  }
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("package.json must contain one object");
  }
  const locks = [];
  for (const [name, manager] of JS_LOCKS) {
    if (await regularPath(root, name)) locks.push({ name, manager });
  }
  const declaredManager = declaredPackageManager(manifest.packageManager);
  const managers = [...new Set([
    ...locks.map((lock) => lock.manager),
    ...(declaredManager ? [declaredManager] : []),
  ])];
  const scripts = manifest.scripts;
  if (scripts !== undefined && (!scripts || typeof scripts !== "object" || Array.isArray(scripts))) {
    throw new Error("package.json scripts must be an object when present");
  }

  output.ecosystems.push({
    name: "javascript-typescript",
    markers: ["package.json", ...locks.map((lock) => lock.name)],
    ...(declaredManager ? { declaredPackageManager: declaredManager } : {}),
  });
  if (declaredManager === null) {
    output.unresolved.push({
      code: "unsupported-package-manager",
      message: "package.json packageManager does not name a supported versioned npm, pnpm, Yarn, or Bun release",
    });
    return;
  }
  if (managers.length > 1) {
    output.unresolved.push({
      code: "ambiguous-package-manager",
      message: `JavaScript package-manager evidence conflicts: ${managers.join(", ")}`,
    });
    return;
  }
  if (managers.length === 0) {
    output.unresolved.push({
      code: "missing-package-manager-evidence",
      message: "package.json has no recognized lockfile or versioned packageManager field",
    });
    return;
  }
  const manager = managers[0];
  const observedScripts = scripts ?? {};
  for (const name of ["check", "lint", "typecheck", "build"]) {
    if (typeof observedScripts[name] === "string" && observedScripts[name].trim()) {
      output.candidates.check.push(candidate("observed", "javascript-typescript", packageCommand(manager, name), `package.json#/scripts/${name}`));
    }
  }
  for (const name of ["test:e2e", "e2e"]) {
    if (typeof observedScripts[name] === "string" && observedScripts[name].trim()) {
      output.candidates.testE2E.push(candidate("observed", "javascript-typescript", packageCommand(manager, name), `package.json#/scripts/${name}`));
    }
  }
  if (typeof observedScripts["test:integration"] === "string" && observedScripts["test:integration"].trim()) {
    output.unresolved.push({
      code: "integration-is-not-e2e",
      message: "package.json defines test:integration, but project evidence must establish whether it is a real E2E or user-flow gate",
    });
  }
}

async function inspectPython(root, output) {
  const pyproject = await textMetadata(root, "pyproject.toml");
  const setup = await textMetadata(root, "setup.py");
  if (pyproject === undefined && setup === undefined) return;
  output.ecosystems.push({
    name: "python",
    markers: [pyproject !== undefined ? "pyproject.toml" : undefined, setup !== undefined ? "setup.py" : undefined].filter(Boolean),
  });
  if (pyproject && /\[tool\.ruff(?:\.|\])/.test(pyproject)) {
    output.candidates.check.push(candidate("conventional", "python", "uv run ruff check .", "pyproject.toml ruff configuration"));
  }
  if (pyproject && /(?:\[tool\.pytest\.ini_options\]|pytest)/i.test(pyproject)) {
    output.candidates.check.push(candidate("conventional", "python", "uv run pytest", "pyproject.toml pytest configuration"));
  }
}

async function inspectGo(root, output) {
  if (await textMetadata(root, "go.mod") === undefined) return;
  output.ecosystems.push({ name: "go", markers: ["go.mod"] });
  output.candidates.check.push(candidate("conventional", "go", "go vet ./...", "Go standard toolchain"));
  output.candidates.check.push(candidate("conventional", "go", "go test ./...", "Go standard toolchain"));
}

async function inspectRuby(root, output) {
  const gemfile = await textMetadata(root, "Gemfile");
  if (gemfile === undefined) return;
  output.ecosystems.push({ name: "ruby", markers: ["Gemfile"] });
  if (/\bgem\s+["']rubocop["']/.test(gemfile)) {
    output.candidates.check.push(candidate("conventional", "ruby", "bundle exec rubocop", "Gemfile rubocop dependency"));
  }
  if (/\bgem\s+["']rspec(?:-rails)?["']/.test(gemfile)) {
    output.candidates.check.push(candidate("conventional", "ruby", "bundle exec rspec", "Gemfile rspec dependency"));
  }
}

async function inspectRust(root, output) {
  if (await textMetadata(root, "Cargo.toml") === undefined) return;
  output.ecosystems.push({ name: "rust", markers: ["Cargo.toml"] });
  output.candidates.check.push(candidate("conventional", "rust", "cargo fmt --check", "Rust standard toolchain"));
  output.candidates.check.push(candidate("conventional", "rust", "cargo clippy -- -D warnings", "Rust standard toolchain"));
}

export async function inspectProject(rootPath) {
  const rootInput = resolve(rootPath);
  const rootStats = await lstat(rootInput);
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) throw new Error("project root must be a real directory, not a symbolic link");
  const root = await realpath(rootInput);
  const output = {
    schemaVersion: 1,
    root,
    makefile: await inspectMakefile(root),
    ecosystems: [],
    unsupportedBuildSystems: [],
    candidates: { check: [], testE2E: [] },
    unresolved: [],
    safeToPropose: { check: false, testE2E: false },
  };

  for (const [name, system] of UNSUPPORTED_BUILD_MARKERS) {
    if (await regularPath(root, name)) output.unsupportedBuildSystems.push({ system, marker: name });
  }
  await inspectJavaScript(root, output);
  await inspectPython(root, output);
  await inspectGo(root, output);
  await inspectRuby(root, output);
  await inspectRust(root, output);

  if (output.ecosystems.length === 0) {
    output.unresolved.push({ code: "unsupported-ecosystem", message: "no supported ecosystem marker was found" });
  }
  if (output.unsupportedBuildSystems.length > 0) {
    output.unresolved.push({ code: "unsupported-build-system", message: "a detected build system is outside the supported project-checks contract" });
  }
  if (output.candidates.testE2E.length === 0) {
    output.unresolved.push({ code: "missing-e2e-evidence", message: "no observed project-owned E2E command was found; keep test-e2e unresolved" });
  }

  const blocked = output.makefile.proposalFrozen
    || output.unsupportedBuildSystems.length > 0
    || output.unresolved.some((item) => item.code === "ambiguous-package-manager");
  const targetExists = (target) => output.makefile.targets.includes(target);
  output.safeToPropose.check = !blocked
    && !targetExists("check")
    && output.candidates.check.some((item) => item.evidence === "observed");
  output.safeToPropose.testE2E = !blocked
    && !targetExists("test-e2e")
    && output.candidates.testE2E.some((item) => item.evidence === "observed");
  return output;
}

async function main() {
  try {
    const { root } = parseArguments(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(await inspectProject(root), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
