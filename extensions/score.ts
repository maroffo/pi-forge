// ABOUTME: Registers a deterministic /score command backed by the repository's real Make gates.
// ABOUTME: Reports readiness only from fresh process results and stores local trend data under Git metadata.

import { spawn } from "node:child_process";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import {
  discoverLiteralMakeTargets,
  inspectLiteralMakeTargets,
} from "../src/makefile-policy.js";

export { discoverLiteralMakeTargets, inspectLiteralMakeTargets };

const GATES = Object.freeze([
  { name: "check", target: "check", command: "make check" },
  { name: "test-e2e", target: "test-e2e", command: "make test-e2e" },
]);
const THRESHOLDS = Object.freeze({ commit: 80, pr: 90, excellence: 95 });
const GATE_TIMEOUT_MS = 20 * 60 * 1000;
const MAX_FAILURE_CHARS = 4_000;

type ScoreTarget = keyof typeof THRESHOLDS;
type ExecResult = { stdout?: string; stderr?: string; code?: number | null; killed?: boolean };
type ProcessResult = ExecResult & {
  signal?: NodeJS.Signals | null;
  timedOut?: boolean;
  error?: string;
};
type ProcessRunner = (
  command: string,
  args: string[],
  options: { cwd: string; timeout: number; sanitizeMakeEnvironment?: boolean },
) => Promise<ProcessResult>;
type GateResult = {
  name: string;
  command: string;
  status: "pass" | "fail" | "missing" | "error" | "not-run";
  exitCode?: number | null;
  evidence?: string;
};
type ScoreHistory = {
  written: boolean;
  message: string;
  previousScore?: number;
};
export type ScoreResult = {
  projectRoot: string;
  target: ScoreTarget;
  threshold: number;
  score: number | null;
  gates: GateResult[];
  history: ScoreHistory;
};

type ScoreDependencies = {
  now: () => string;
  readFile: typeof readFile;
  mkdir: typeof mkdir;
  appendFile: typeof appendFile;
  runProcess: ProcessRunner;
};

function appendTail(current: Buffer, chunk: Buffer): Buffer {
  const combined = Buffer.concat([current, chunk]);
  const limit = MAX_FAILURE_CHARS * 2;
  return combined.length <= limit ? combined : combined.subarray(combined.length - limit);
}

export const runLocalProcess: ProcessRunner = (command, args, options) => new Promise((resolveResult) => {
  const env = { ...process.env };
  if (options.sanitizeMakeEnvironment) {
    for (const name of [
      "BASH_ENV",
      "ENV",
      "GNUMAKEFLAGS",
      "MAKEFILES",
      "MAKEFLAGS",
      "MAKELEVEL",
      "MAKEOVERRIDES",
      "MFLAGS",
      "SHELLOPTS",
    ]) delete env[name];
  }
  let stdout = Buffer.alloc(0);
  let stderr = Buffer.alloc(0);
  let timedOut = false;
  let settled = false;
  let killTimer: ReturnType<typeof setTimeout> | undefined;
  const detached = process.platform !== "win32";
  const child = spawn(command, args, {
    cwd: options.cwd,
    env,
    detached,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk: Buffer) => { stdout = appendTail(stdout, chunk); });
  child.stderr.on("data", (chunk: Buffer) => { stderr = appendTail(stderr, chunk); });

  const finish = (result: ProcessResult) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    if (killTimer) clearTimeout(killTimer);
    resolveResult({
      ...result,
      stdout: stdout.toString("utf8"),
      stderr: stderr.toString("utf8"),
    });
  };
  const kill = (signal: NodeJS.Signals) => {
    try {
      if (detached && child.pid) process.kill(-child.pid, signal);
      else child.kill(signal);
    } catch {
      child.kill(signal);
    }
  };
  const timer = setTimeout(() => {
    timedOut = true;
    kill("SIGTERM");
    killTimer = setTimeout(() => kill("SIGKILL"), 2_000);
    killTimer.unref();
  }, options.timeout);
  timer.unref();

  child.on("error", (error) => finish({ code: null, signal: null, error: error.message }));
  child.on("close", (code, signal) => finish({
    code,
    signal,
    timedOut,
    killed: timedOut || signal !== null,
  }));
});

const DEFAULT_DEPENDENCIES: ScoreDependencies = {
  now: () => new Date().toISOString(),
  readFile,
  mkdir,
  appendFile,
  runProcess: runLocalProcess,
};

function cleanOutput(value: string): string {
  const withoutAnsi = value.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "").trim();
  if (withoutAnsi.length <= MAX_FAILURE_CHARS) return withoutAnsi;
  return `[truncated to final ${MAX_FAILURE_CHARS.toLocaleString()} characters]\n${withoutAnsi.slice(-MAX_FAILURE_CHARS)}`;
}

export function parseScoreTarget(args: string): ScoreTarget {
  const target = args.trim().toLowerCase() || "commit";
  if (target === "commit" || target === "pr" || target === "excellence") return target;
  throw new Error("Usage: /score [commit|pr|excellence]");
}

async function git(
  pi: ExtensionAPI,
  cwd: string,
  args: string[],
): Promise<ExecResult> {
  try {
    return await pi.exec("git", args, { cwd, timeout: 10_000 }) as ExecResult;
  } catch (error) {
    return { code: 1, stderr: error instanceof Error ? error.message : String(error) };
  }
}

async function projectRoot(pi: ExtensionAPI, cwd: string): Promise<string> {
  const result = await git(pi, cwd, ["rev-parse", "--show-toplevel"]);
  const candidate = result.code === 0 ? result.stdout?.trim() : "";
  return candidate ? resolve(candidate) : resolve(cwd);
}

async function readMakefile(root: string, dependencies: ScoreDependencies): Promise<string | undefined> {
  for (const name of ["GNUmakefile", "Makefile", "makefile"]) {
    try {
      return await dependencies.readFile(join(root, name), "utf8");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") throw error;
    }
  }
  return undefined;
}

async function runGate(
  root: string,
  gate: typeof GATES[number],
  dependencies: ScoreDependencies,
): Promise<GateResult> {
  const result = await dependencies.runProcess("make", [gate.target], {
    cwd: root,
    timeout: GATE_TIMEOUT_MS,
    sanitizeMakeEnvironment: true,
  });

  if (result.error) {
    return {
      name: gate.name,
      command: gate.command,
      status: "error",
      evidence: cleanOutput(result.error),
    };
  }
  if (result.killed || result.signal || result.timedOut) {
    return {
      name: gate.name,
      command: gate.command,
      status: "error",
      exitCode: result.code,
      evidence: result.timedOut
        ? "Gate process timed out before a verdict was available."
        : `Gate process ended from signal ${result.signal ?? "unknown"}.`,
    };
  }
  if (result.code === 0) {
    return { name: gate.name, command: gate.command, status: "pass", exitCode: result.code };
  }
  if (typeof result.code !== "number") {
    return {
      name: gate.name,
      command: gate.command,
      status: "error",
      exitCode: result.code,
      evidence: "Gate process ended without a numeric exit code.",
    };
  }
  const output = cleanOutput([result.stdout, result.stderr].filter(Boolean).join("\n"));
  return {
    name: gate.name,
    command: gate.command,
    status: "fail",
    exitCode: result.code,
    ...(output ? { evidence: output } : {}),
  };
}

export function computeStaticScore(gates: readonly GateResult[]): number | null {
  if (gates.some((gate) => gate.status === "fail")) return 0;
  return gates.every((gate) => gate.status === "pass") ? 100 : null;
}

async function writeHistory(
  pi: ExtensionAPI,
  result: Omit<ScoreResult, "history">,
  dependencies: ScoreDependencies,
): Promise<ScoreHistory> {
  if (result.score === null) {
    return { written: false, message: "not written because required gates are missing" };
  }
  const gitDirResult = await git(pi, result.projectRoot, ["rev-parse", "--git-common-dir"]);
  const rawGitDir = gitDirResult.code === 0 ? gitDirResult.stdout?.trim() : "";
  if (!rawGitDir) return { written: false, message: "not written because no Git metadata directory was found" };

  const branchResult = await git(pi, result.projectRoot, ["branch", "--show-current"]);
  const branch = branchResult.code === 0 && branchResult.stdout?.trim()
    ? branchResult.stdout.trim()
    : "detached";
  const gitDir = isAbsolute(rawGitDir) ? rawGitDir : resolve(result.projectRoot, rawGitDir);
  const historyPath = join(gitDir, "pi-forge", "score-history.jsonl");

  try {
    await dependencies.mkdir(dirname(historyPath), { recursive: true });
    let previousScore: number | undefined;
    try {
      const previousLines = (await dependencies.readFile(historyPath, "utf8"))
        .split("\n")
        .filter(Boolean);
      for (let index = previousLines.length - 1; index >= 0; index -= 1) {
        try {
          const parsed = JSON.parse(previousLines[index]!) as { score?: unknown };
          if (typeof parsed.score === "number") {
            previousScore = parsed.score;
            break;
          }
        } catch {
          // Ignore malformed local history rows and preserve the new measured run.
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }

    const row = {
      schemaVersion: 1,
      timestamp: dependencies.now(),
      branch,
      target: result.target,
      threshold: result.threshold,
      score: result.score,
      gates: result.gates.map(({ name, command, status, exitCode }) => ({
        name,
        command,
        status,
        ...(exitCode !== undefined ? { exitCode } : {}),
      })),
    };
    await dependencies.appendFile(historyPath, `${JSON.stringify(row)}\n`, "utf8");
    return {
      written: true,
      message: previousScore === undefined
        ? "first local run recorded"
        : `recorded locally, delta ${result.score - previousScore >= 0 ? "+" : ""}${result.score - previousScore}`,
      ...(previousScore !== undefined ? { previousScore } : {}),
    };
  } catch (error) {
    return {
      written: false,
      message: `not written: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function runScore(
  pi: ExtensionAPI,
  cwd: string,
  target: ScoreTarget,
  dependencyOverrides: Partial<ScoreDependencies> = {},
): Promise<ScoreResult> {
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...dependencyOverrides };
  const root = await projectRoot(pi, cwd);
  let gates: GateResult[];
  const makefile = await readMakefile(root, dependencies);
  if (makefile === undefined) {
    gates = GATES.map((gate) => ({
      name: gate.name,
      command: gate.command,
      status: "missing" as const,
      evidence: "No GNUmakefile, Makefile, or makefile was found at the project root.",
    }));
  } else {
    const inspection = inspectLiteralMakeTargets(makefile);
    const discovered = inspection.targets;
    const duplicateRequired = GATES.filter((gate) => inspection.duplicateTargets.has(gate.target));
    const missing = GATES.filter((gate) => !discovered.has(gate.target));
    const unsupportedReason = inspection.unsupportedReason
      ?? (duplicateRequired.length > 0
        ? `literal Make target '${duplicateRequired[0]!.target}' has multiple definitions`
        : undefined);
    if (unsupportedReason || missing.length > 0) {
      gates = GATES.map((gate) => ({
        name: gate.name,
        command: gate.command,
        status: discovered.has(gate.target) ? "not-run" as const : "missing" as const,
        evidence: unsupportedReason
          ? `Root Makefile is not statically scoreable: ${unsupportedReason}.`
          : discovered.has(gate.target)
            ? "Gate was not run because the required Make target pair is incomplete."
            : `Literal Make target '${gate.target}' is missing from the root Makefile.`,
      }));
    } else {
      const first = await runGate(root, GATES[0], dependencies);
      gates = [first];
      if (first.status === "pass") {
        gates.push(await runGate(root, GATES[1], dependencies));
      } else {
        gates.push({
          name: GATES[1].name,
          command: GATES[1].command,
          status: "not-run",
          evidence: `${GATES[0].command} did not pass, so fail-fast execution stopped.`,
        });
      }
    }
  }

  const partial = {
    projectRoot: root,
    target,
    threshold: THRESHOLDS[target],
    score: computeStaticScore(gates),
    gates,
  };
  return { ...partial, history: await writeHistory(pi, partial, dependencies) };
}

function readiness(score: number | null, threshold: number): string {
  return score === null ? "inconclusive" : score >= threshold ? "yes" : "no";
}

export function formatScoreReport(result: ScoreResult): string {
  const scoreText = result.score === null ? "inconclusive" : `${result.score}/100`;
  const gateLabel = result.score === null || result.score < 80
    ? "BLOCKED"
    : result.score >= 95
      ? "excellence"
      : result.score >= 90
        ? "PR-ready"
        : "commit-ready";
  const lines = [
    `Score: ${scoreText}`,
    `Gate:  ${gateLabel}`,
    `Target: ${result.target} (threshold ${result.threshold})`,
    "",
    "Breakdown:",
    ...result.gates.map((gate) => `  ${gate.command.padEnd(19)} ${gate.status.toUpperCase()}`),
    "  Major findings:     not evaluated",
    "  Minor findings:     not evaluated",
    "",
    `Ready to commit:  ${readiness(result.score, THRESHOLDS.commit)}`,
    `Ready to open PR: ${readiness(result.score, THRESHOLDS.pr)}`,
    `Excellence:       ${readiness(result.score, THRESHOLDS.excellence)}`,
    "",
    "Scope: static repository gates only; independent review deductions are not included.",
    `History: ${result.history.message}`,
  ];
  for (const gate of result.gates) {
    if (gate.status === "pass" || !gate.evidence) continue;
    lines.push("", `${gate.command} ${gate.status}:`, gate.evidence);
  }
  return lines.join("\n");
}

export default function scoreExtension(
  pi: ExtensionAPI,
  dependencyOverrides: Partial<ScoreDependencies> = {},
): void {
  pi.registerCommand("score", {
    description: "Run make check and make test-e2e, then report deterministic readiness",
    handler: async (args, ctx: ExtensionCommandContext) => {
      let target: ScoreTarget;
      try {
        target = parseScoreTarget(args);
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
        return;
      }

      if (!ctx.isProjectTrusted()) {
        ctx.ui.notify("Score refused: running repository gates requires a trusted project.", "error");
        return;
      }
      if (ctx.hasUI) ctx.ui.setStatus("pi-forge-score", "Running quality gates...");
      try {
        const result = await runScore(pi, ctx.cwd, target, dependencyOverrides);
        pi.appendEntry("pi-forge.score.v1", {
          ...result,
          gates: result.gates.map(({ evidence: _evidence, ...gate }) => gate),
        });
        const report = formatScoreReport(result);
        if (ctx.hasUI) ctx.ui.notify(report, result.score === null ? "warning" : result.score === 0 ? "error" : "info");
        else process.stdout.write(`${report}\n`);
      } catch (error) {
        ctx.ui.notify(`Score failed: ${error instanceof Error ? error.message : String(error)}`, "error");
      } finally {
        if (ctx.hasUI) ctx.ui.setStatus("pi-forge-score", undefined);
      }
    },
  });
}
