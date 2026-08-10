#!/usr/bin/env node
// ABOUTME: Runs deterministic, non-publishing Pi Forge release phase preflights.
// ABOUTME: Uses only fixed verification commands and read-only Git, GitHub, and npm queries.

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  parseReleaseArguments,
  RELEASE_PACKAGE,
  validateReleaseSnapshot,
} from "./lib/release-policy.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const COMMAND_TIMEOUT_MS = 20 * 60 * 1000;
const MAX_COMMAND_OUTPUT_BYTES = 1024 * 1024;
const REQUIRED_PACK_PATHS = [
  "extensions/score.ts",
  "prompts/herdr-orchestrator.md",
  "prompts/project-checks.md",
  "skills/herdr-orchestrator/SKILL.md",
  "skills/herdr-orchestrator/scripts/prepare-claude-launch.mjs",
  "skills/orchestrator/SKILL.md",
  "skills/project-checks/SKILL.md",
  "skills/session-telemetry/SKILL.md",
  "src/makefile-policy.js",
];

function known(value) {
  return { status: "known", value };
}

function unavailable(detail) {
  return { status: "unavailable", detail };
}

function output(result) {
  return [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
}

function appendTail(current, chunk) {
  const combined = Buffer.concat([current, Buffer.from(chunk)]);
  return combined.length <= MAX_COMMAND_OUTPUT_BYTES
    ? combined
    : combined.subarray(combined.length - MAX_COMMAND_OUTPUT_BYTES);
}

export function runCommand(command, args, options = {}) {
  return new Promise((resolveResult) => {
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let settled = false;
    let timedOut = false;
    let killTimer;
    let timer;
    const detached = process.platform !== "win32";
    const child = spawn(command, args, {
      cwd: options.cwd ?? ROOT,
      env: options.env ?? process.env,
      detached,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      resolveResult({
        ...result,
        stdout: stdout.toString("utf8"),
        stderr: stderr.toString("utf8"),
        timedOut,
      });
    };
    const kill = (signal) => {
      try {
        if (detached && child.pid) process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch {
        child.kill(signal);
      }
    };
    child.stdout.on("data", (chunk) => { stdout = appendTail(stdout, chunk); });
    child.stderr.on("data", (chunk) => { stderr = appendTail(stderr, chunk); });
    child.on("error", (error) => finish({ code: null, signal: null, error: error.message }));
    child.on("close", (code, signal) => finish({ code, signal }));
    timer = setTimeout(() => {
      timedOut = true;
      kill("SIGTERM");
      killTimer = setTimeout(() => kill("SIGKILL"), 2_000);
      killTimer.unref();
    }, options.timeout ?? COMMAND_TIMEOUT_MS);
    timer.unref();
  });
}

async function execute(dependencies, id, command, args, executionOptions = {}) {
  try {
    return await dependencies.run(id, command, args, {
      cwd: dependencies.root,
      timeout: COMMAND_TIMEOUT_MS,
      ...executionOptions,
    });
  } catch (error) {
    return { code: null, error: error instanceof Error ? error.message : String(error), stdout: "", stderr: "" };
  }
}

function commandState(result, parse, label) {
  if (result?.error || result?.timedOut || result?.signal) {
    return unavailable(`${label} unavailable: ${result.error ?? (result.timedOut ? "timeout" : `signal ${result.signal}`)}`);
  }
  if (result?.code !== 0) return unavailable(`${label} failed: ${output(result) || `exit ${result?.code ?? "unknown"}`}`);
  try {
    return known(parse(result.stdout ?? ""));
  } catch (error) {
    return unavailable(`${label} returned malformed output: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function parseJson(text) {
  return JSON.parse(text);
}

function parseLocalTag(text) {
  if (!text.trim()) return { exists: false };
  const lines = text.trim().split("\n");
  if (lines.length !== 1) throw new Error("expected at most one local tag ref");
  const [objectType, objectName, peeled] = lines[0].split("\t");
  if (!objectType || !objectName) throw new Error("invalid local tag ref");
  return {
    exists: true,
    annotated: objectType === "tag" && Boolean(peeled),
    target: objectType === "tag" ? peeled : objectName,
  };
}

function parseRemoteTag(text, version) {
  if (!text.trim()) return { exists: false };
  const refs = new Map();
  for (const line of text.trim().split("\n")) {
    const [oid, ref] = line.split(/\s+/);
    if (!oid || !ref) throw new Error("invalid remote tag ref");
    refs.set(ref, oid);
  }
  const base = refs.get(`refs/tags/v${version}`);
  const peeled = refs.get(`refs/tags/v${version}^{}`);
  if (!base) throw new Error("remote returned no base tag ref");
  return { exists: true, annotated: Boolean(peeled), target: peeled ?? base };
}

function parsePack(text) {
  const parsed = parseJson(text);
  if (!Array.isArray(parsed) || parsed.length !== 1 || !parsed[0] || typeof parsed[0] !== "object") {
    throw new Error("expected one npm pack record");
  }
  const record = parsed[0];
  const paths = new Set(Array.isArray(record.files) ? record.files.map((file) => file?.path).filter(Boolean) : []);
  return {
    name: record.name,
    version: record.version,
    integrity: record.integrity,
    hasProjectPi: [...paths].some((path) => path === ".pi" || path.startsWith(".pi/")),
    rosterValid: REQUIRED_PACK_PATHS.every((path) => paths.has(path)),
  };
}

async function collectVersions(dependencies) {
  try {
    const [manifest, lock, readme] = await Promise.all([
      dependencies.read(join(dependencies.root, "package.json"), "utf8").then(JSON.parse),
      dependencies.read(join(dependencies.root, "package-lock.json"), "utf8").then(JSON.parse),
      dependencies.read(join(dependencies.root, "README.md"), "utf8"),
    ]);
    const readmeVersions = [...readme.matchAll(/pi install npm:@maroffo\/pi-forge@(\d+\.\d+\.\d+)/g)].map((match) => match[1]);
    const uniqueReadme = [...new Set(readmeVersions)];
    return {
      package: known(manifest.version),
      lock: known(lock.version),
      lockRoot: known(lock.packages?.[""]?.version),
      readme: known(uniqueReadme.length === 1 ? uniqueReadme[0] : undefined),
    };
  } catch (error) {
    const state = unavailable(`version files unavailable or malformed: ${error instanceof Error ? error.message : String(error)}`);
    return { package: state, lock: state, lockRoot: state, readme: state };
  }
}

async function collectGit(dependencies, includeRemote) {
  const status = await execute(dependencies, "git-status", "git", ["status", "--porcelain=v1", "--untracked-files=normal"]);
  const branch = await execute(dependencies, "git-branch", "git", ["branch", "--show-current"]);
  const head = await execute(dependencies, "git-head", "git", ["rev-parse", "HEAD"]);
  const originMain = includeRemote
    ? await execute(dependencies, "git-origin-main", "git", ["rev-parse", "origin/main"])
    : undefined;
  return {
    clean: commandState(status, (value) => value.trim() === "", "git status"),
    branch: commandState(branch, (value) => value.trim(), "git branch"),
    head: commandState(head, (value) => value.trim(), "git HEAD"),
    ...(includeRemote ? { originMain: commandState(originMain, (value) => value.trim(), "origin/main") } : {}),
  };
}

async function collectTags(dependencies, version, includeRemote) {
  const local = await execute(dependencies, "git-local-tag", "git", [
    "for-each-ref",
    "--format=%(objecttype)%09%(objectname)%09%(*objectname)",
    `refs/tags/v${version}`,
  ]);
  const output = { local: commandState(local, parseLocalTag, "local tag query") };
  if (includeRemote) {
    const remote = await execute(dependencies, "git-remote-tag", "git", [
      "ls-remote", "--tags", "origin", `refs/tags/v${version}`, `refs/tags/v${version}^{}`,
    ]);
    output.remote = commandState(remote, (value) => parseRemoteTag(value, version), "remote tag query");
  }
  return output;
}

async function collectRegistry(dependencies, version, includeDistTags) {
  const versionResult = await execute(dependencies, "npm-version", "npm", ["view", `${RELEASE_PACKAGE}@${version}`, "version", "--json"]);
  let versionState;
  if (versionResult.error || versionResult.timedOut || versionResult.signal) {
    versionState = unavailable(`npm version query unavailable: ${versionResult.error ?? "timeout or signal"}`);
  } else if (versionResult.code === 0) {
    versionState = commandState(versionResult, (value) => {
      const parsed = parseJson(value);
      if (typeof parsed !== "string") throw new Error("version must be a string");
      return { exists: true, version: parsed };
    }, "npm version query");
  } else if (/\bE404\b|is not in this registry|No match found/i.test(output(versionResult))) {
    versionState = known({ exists: false });
  } else {
    versionState = unavailable(`npm version query failed: ${output(versionResult) || `exit ${versionResult.code}`}`);
  }

  const registry = { version: versionState };
  if (includeDistTags) {
    const tags = await execute(dependencies, "npm-dist-tags", "npm", ["view", RELEASE_PACKAGE, "dist-tags", "--json"]);
    registry.distTags = commandState(tags, (value) => {
      const parsed = parseJson(value);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("dist-tags must be an object");
      return parsed;
    }, "npm dist-tags query");
  }
  return registry;
}

async function collectCi(dependencies) {
  const result = await execute(dependencies, "github-ci", "gh", [
    "run", "list", "--limit", "100", "--json", "databaseId,workflowName,headSha,status,conclusion,createdAt",
  ]);
  return commandState(result, (value) => {
    const parsed = parseJson(value);
    if (!Array.isArray(parsed)) throw new Error("workflow runs must be an array");
    return parsed;
  }, "GitHub workflow query");
}

function isolatedEnvironment(home, inherited = process.env) {
  const keep = ["PATH", "TMPDIR", "TMP", "TEMP", "LANG", "LC_ALL", "CI", "SYSTEMROOT", "WINDIR", "COMSPEC", "PATHEXT"];
  return {
    ...Object.fromEntries(keep.filter((name) => inherited[name] !== undefined).map((name) => [name, inherited[name]])),
    HOME: home,
    XDG_CACHE_HOME: join(home, ".cache"),
    XDG_CONFIG_HOME: join(home, ".config"),
    XDG_DATA_HOME: join(home, ".local", "share"),
    GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
    GIT_TERMINAL_PROMPT: "0",
    PI_OFFLINE: "1",
    npm_config_cache: join(home, ".npm"),
    npm_config_userconfig: join(home, ".npmrc"),
  };
}

async function executeIsolated(dependencies, id, command, args) {
  const home = await mkdtemp(join(tmpdir(), "pi-forge-release-check-"));
  try {
    return await execute(dependencies, id, command, args, { env: isolatedEnvironment(home) });
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}

async function collectVerification(dependencies, names) {
  const specs = {
    e2e: ["npm", ["run", "test:e2e"]],
    upgrade: ["npm", ["run", "test:pi-subagents-upgrade", "--", "0.37.2", "--force"]],
    runtime: ["npm", ["run", "test:runtime"]],
  };
  const outputStates = {};
  for (const name of names) {
    if (name === "audit") {
      const result = await execute(dependencies, "verification-audit", "npm", ["audit", "--omit=dev", "--audit-level=moderate", "--json"]);
      if (result.error || result.timedOut || result.signal) outputStates.audit = unavailable(`audit unavailable: ${result.error ?? "timeout or signal"}`);
      else if (result.code === 0) outputStates.audit = known(true);
      else {
        try {
          const parsed = parseJson(result.stdout ?? "");
          outputStates.audit = parsed?.metadata?.vulnerabilities ? known(false) : unavailable("audit failed without vulnerability metadata");
        } catch {
          outputStates.audit = unavailable(`audit returned malformed output: ${output(result) || `exit ${result.code}`}`);
        }
      }
      continue;
    }
    const [command, args] = specs[name];
    const result = await executeIsolated(dependencies, `verification-${name}`, command, args);
    outputStates[name] = result.error || result.timedOut || result.signal
      ? unavailable(`${name} unavailable: ${result.error ?? "timeout or signal"}`)
      : known(result.code === 0);
  }
  return outputStates;
}

async function collectPack(dependencies, version, fromRegistry) {
  const args = ["pack", ...(fromRegistry ? [`${RELEASE_PACKAGE}@${version}`] : []), "--dry-run", "--json"];
  const result = await executeIsolated(dependencies, fromRegistry ? "npm-pack-registry" : "npm-pack-local", "npm", args);
  return commandState(result, parsePack, fromRegistry ? "registry pack" : "local pack");
}

function releaseDependencies(dependencyOverrides) {
  return {
    root: ROOT,
    read: readFile,
    run: (_id, command, args, options) => runCommand(command, args, options),
    ...dependencyOverrides,
  };
}

export async function collectReleaseSnapshot(phase, version, dependencyOverrides = {}) {
  const dependencies = releaseDependencies(dependencyOverrides);
  const needRemoteTag = ["prepare", "tag", "publish", "verify", "reconcile"].includes(phase);
  const needOriginMain = ["tag", "publish", "verify"].includes(phase);
  return {
    versions: await collectVersions(dependencies),
    git: await collectGit(dependencies, needOriginMain),
    tags: await collectTags(dependencies, version, needRemoteTag),
    registry: await collectRegistry(dependencies, version, ["verify", "reconcile"].includes(phase)),
    ...(["tag", "publish"].includes(phase) ? { ci: await collectCi(dependencies) } : {}),
  };
}

async function collectExecutionEvidence(phase, version, dependencyOverrides) {
  const dependencies = releaseDependencies(dependencyOverrides);
  if (phase === "tag") {
    return { verification: await collectVerification(dependencies, ["e2e", "upgrade", "audit"]) };
  }
  if (phase === "publish") {
    return {
      verification: await collectVerification(dependencies, ["e2e", "upgrade", "audit"]),
      pack: { local: await collectPack(dependencies, version, false) },
    };
  }
  if (phase === "verify") {
    return {
      pack: {
        local: await collectPack(dependencies, version, false),
        registry: await collectPack(dependencies, version, true),
      },
      verification: await collectVerification(dependencies, ["runtime"]),
    };
  }
  return {};
}

function isExecutionEvidenceCheck(name) {
  return name.startsWith("verification-")
    || name.startsWith("local-pack-")
    || name.startsWith("registry-pack-")
    || name === "pack-integrity-match";
}

export async function runReleaseCheck(options, dependencyOverrides = {}) {
  const before = await collectReleaseSnapshot(options.phase, options.version, dependencyOverrides);
  const initial = validateReleaseSnapshot(options.phase, options.version, before);
  if (initial.checks.some((item) => !isExecutionEvidenceCheck(item.name) && item.status !== "pass")) {
    return initial;
  }

  const executionEvidence = await collectExecutionEvidence(options.phase, options.version, dependencyOverrides);
  if (Object.keys(executionEvidence).length === 0) return initial;

  const after = await collectReleaseSnapshot(options.phase, options.version, dependencyOverrides);
  return validateReleaseSnapshot(options.phase, options.version, { ...after, ...executionEvidence });
}

async function main() {
  try {
    const options = parseReleaseArguments(process.argv.slice(2));
    const result = await runReleaseCheck(options);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.verdict === "pass" ? 0 : result.verdict === "fail" ? 1 : 2;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
