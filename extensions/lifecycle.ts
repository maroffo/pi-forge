// ABOUTME: Enforces common Git, sensitive-path, and post-edit verification lifecycle boundaries.
// ABOUTME: Uses exact tool events and one bounded follow-up without treating prose as computational evidence.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { lstatSync, realpathSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  dangerousCommandReason,
  findGitMutations,
  isSourcePath,
  isStandingAuthorizedBranchPush,
  parseStandingAuthorizedBranchCreate,
  parseStandingAuthorizedPullRequestCreate,
  parseStandingAuthorizedWorktreeCreate,
  isVerificationCommand,
  sensitivePathReason,
} from "../src/lifecycle-policy.js";

export const LIFECYCLE_ENTRY = "pi-forge.lifecycle.v1";
const WRITER_AGENT = "pi-forge.software-engineer";

type LifecycleState = {
  version: 1;
  sequence: number;
  lastSourceMutation: number;
  lastSuccessfulVerification: number;
  nudgedForMutation: number;
};

function emptyState(): LifecycleState {
  return {
    version: 1,
    sequence: 0,
    lastSourceMutation: 0,
    lastSuccessfulVerification: 0,
    nudgedForMutation: 0,
  };
}

function parseState(value: unknown): LifecycleState | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const candidate = value as Record<string, unknown>;
  const fields = ["sequence", "lastSourceMutation", "lastSuccessfulVerification", "nudgedForMutation"] as const;
  if (candidate.version !== 1 || fields.some((field) => !Number.isSafeInteger(candidate[field]) || Number(candidate[field]) < 0)) {
    return undefined;
  }
  return {
    version: 1,
    sequence: Number(candidate.sequence),
    lastSourceMutation: Number(candidate.lastSourceMutation),
    lastSuccessfulVerification: Number(candidate.lastSuccessfulVerification),
    nudgedForMutation: Number(candidate.nudgedForMutation),
  };
}

function restoreState(entries: readonly unknown[]): LifecycleState {
  let restored = emptyState();
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const value = entry as { type?: unknown; customType?: unknown; data?: unknown };
    if (value.type !== "custom" || value.customType !== LIFECYCLE_ENTRY) continue;
    const parsed = parseState(value.data);
    if (parsed) restored = parsed;
  }
  return restored;
}

function canonicalPath(rawPath: string, cwd: string): string {
  const cleaned = rawPath.startsWith("@") ? rawPath.slice(1) : rawPath;
  const absolute = isAbsolute(cleaned) ? resolve(cleaned) : resolve(cwd, cleaned);
  try {
    return realpathSync(absolute);
  } catch {}

  const suffix: string[] = [];
  let current = absolute;
  while (true) {
    try {
      return join(realpathSync(current), ...suffix);
    } catch {}
    const parent = dirname(current);
    if (parent === current) return absolute;
    suffix.unshift(relative(parent, current));
    current = parent;
  }
}

function containsWriter(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  if (input.agent === WRITER_AGENT) return true;
  for (const key of ["tasks", "chain"] as const) {
    if (Array.isArray(input[key]) && input[key].some(containsWriter)) return true;
  }
  if (Array.isArray(input.parallel) && input.parallel.some(containsWriter)) return true;
  if (input.parallel && !Array.isArray(input.parallel) && containsWriter(input.parallel)) return true;
  return false;
}

function isWriterExecution(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value) || !containsWriter(value)) return false;
  const input = value as Record<string, unknown>;
  if (typeof input.action !== "string") return true;
  const action = input.action.toLowerCase();
  return action === "single" && (input.agent !== undefined || input.task !== undefined)
    || (action === "parallel" || action === "tasks") && Array.isArray(input.tasks) && input.tasks.length > 0;
}

function safeDisplay(value: string): string {
  const printable = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return printable.length <= 800 ? printable : `${printable.slice(0, 797)}...`;
}

type GitDeliveryState = {
  currentBranch: string;
  existingLocalBranch: boolean;
  cleanWorktree: boolean;
};

async function inspectGitDeliveryState(pi: ExtensionAPI, cwd: string): Promise<GitDeliveryState> {
  try {
    const branchResult = await pi.exec("git", ["symbolic-ref", "--quiet", "--short", "HEAD"], { cwd, timeout: 5_000 });
    const currentBranch = branchResult.code === 0 ? branchResult.stdout.trim() : "";
    if (!currentBranch) return { currentBranch: "", existingLocalBranch: false, cleanWorktree: false };
    const refResult = await pi.exec(
      "git",
      ["show-ref", "--verify", "--quiet", `refs/heads/${currentBranch}`],
      { cwd, timeout: 5_000 },
    );
    const statusResult = await pi.exec(
      "git",
      ["-c", "core.fsmonitor=false", "status", "--porcelain=v1", "--untracked-files=all"],
      { cwd, timeout: 5_000 },
    );
    return {
      currentBranch,
      existingLocalBranch: refResult.code === 0,
      cleanWorktree: statusResult.code === 0 && statusResult.stdout.length === 0,
    };
  } catch {
    return { currentBranch: "", existingLocalBranch: false, cleanWorktree: false };
  }
}

async function isNewLocalBranch(pi: ExtensionAPI, cwd: string, branch: string): Promise<boolean> {
  try {
    const valid = await pi.exec("git", ["check-ref-format", "--branch", branch], { cwd, timeout: 5_000 });
    if (valid.code !== 0) return false;
    const existing = await pi.exec(
      "git",
      ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`],
      { cwd, timeout: 5_000 },
    );
    return existing.code === 1;
  } catch {
    return false;
  }
}

function pathExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? (error as NodeJS.ErrnoException).code
      : undefined;
    return code !== "ENOENT";
  }
}

function isStrictDescendant(root: string, target: string): boolean {
  const candidate = relative(root, target);
  return candidate !== ""
    && candidate !== ".."
    && !candidate.startsWith(`..${sep}`)
    && !isAbsolute(candidate);
}

function effectivePiAgentDirectory(): string {
  return resolve(process.env.PI_CODING_AGENT_DIR?.trim() || join(homedir(), ".pi", "agent"));
}

async function isEligibleWorktreeTarget(
  pi: ExtensionAPI,
  cwd: string,
  targetPath: string,
): Promise<boolean> {
  if (pathExists(targetPath)) return false;
  let projectRoot: string;
  try {
    const rootResult = await pi.exec("git", ["rev-parse", "--show-toplevel"], { cwd, timeout: 5_000 });
    if (rootResult.code !== 0 || !rootResult.stdout.trim()) return false;
    projectRoot = realpathSync(rootResult.stdout.trim());
  } catch {
    return false;
  }
  const canonicalTarget = canonicalPath(targetPath, cwd);
  if (sensitivePathReason(canonicalTarget, homedir(), effectivePiAgentDirectory())) return false;
  if (canonicalTarget === projectRoot || isStrictDescendant(projectRoot, canonicalTarget)) return false;
  let temporaryRoot: string;
  try {
    temporaryRoot = realpathSync(tmpdir());
  } catch {
    return false;
  }
  const eligibleRoot = isStrictDescendant(dirname(projectRoot), canonicalTarget)
    || isStrictDescendant(temporaryRoot, canonicalTarget);
  if (!eligibleRoot) return false;
  const adjacentCanonicalTarget = canonicalPath(targetPath, cwd);
  return adjacentCanonicalTarget === canonicalTarget
    && !pathExists(targetPath)
    && !pathExists(adjacentCanonicalTarget);
}

async function confirmRisk(ctx: any, title: string, detail: string): Promise<{ block: true; reason: string } | undefined> {
  if (!ctx.hasUI) return { block: true, reason: `${title} requires interactive confirmation.` };
  const approved = await ctx.ui.confirm(title, detail);
  return approved ? undefined : { block: true, reason: `${title} was not approved.` };
}

export default function lifecycleExtension(pi: ExtensionAPI): void {
  let state = emptyState();

  const persist = () => pi.appendEntry(LIFECYCLE_ENTRY, { ...state });
  const advanceMutation = () => {
    state.sequence += 1;
    state.lastSourceMutation = state.sequence;
    persist();
  };
  const advanceVerification = () => {
    state.sequence += 1;
    state.lastSuccessfulVerification = state.sequence;
    persist();
  };

  pi.on("session_start", (_event, ctx) => {
    state = restoreState(ctx.sessionManager.getBranch());
  });

  pi.on("session_tree", (_event, ctx) => {
    state = restoreState(ctx.sessionManager.getBranch());
  });

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "write" || event.toolName === "edit") {
      const rawPath = (event.input as { path?: unknown }).path;
      if (typeof rawPath !== "string" || !rawPath) return;
      let absolutePath: string;
      try {
        absolutePath = canonicalPath(rawPath, ctx.cwd);
      } catch {
        return { block: true, reason: "Pi Forge could not canonicalize the write target." };
      }
      const sensitive = sensitivePathReason(absolutePath, homedir(), effectivePiAgentDirectory());
      if (!sensitive) return;
      return confirmRisk(
        ctx,
        "Sensitive path mutation",
        `${sensitive}: ${safeDisplay(absolutePath)}\n\nAllow this one ${event.toolName} call?`,
      );
    }

    if (event.toolName !== "bash") return;
    const command = (event.input as { command?: unknown }).command;
    if (typeof command !== "string") return { block: true, reason: "Pi Forge received an invalid bash command." };

    const mutations = findGitMutations(command);
    if (mutations.some((mutation) => mutation.kind === "commit")) {
      return {
        block: true,
        reason: "Direct git commit is blocked. Use the source-control skill and commit-gate.sh under its branch-aware authorization contract.",
      };
    }

    const remoteActions = [...new Set(mutations.filter((mutation) => mutation.kind === "remote").map((mutation) => mutation.action))];
    if (remoteActions.length > 0) {
      const gitState = await inspectGitDeliveryState(pi, ctx.cwd);
      const prCreate = remoteActions[0] === "pr-create"
        ? parseStandingAuthorizedPullRequestCreate(command, gitState.currentBranch)
        : undefined;
      const standingAuthorized = gitState.existingLocalBranch && gitState.cleanWorktree && remoteActions.length === 1 && (
        remoteActions[0] === "push" && isStandingAuthorizedBranchPush(command, gitState.currentBranch)
        || remoteActions[0] === "pr-create" && prCreate !== undefined
      );
      if (standingAuthorized) return;
      return confirmRisk(
        ctx,
        "Remote Git mutation",
        `This command performs: ${remoteActions.join(", ")}\n\n${safeDisplay(command)}\n\nAllow this one call?`,
      );
    }

    const destructiveActions = [...new Set(
      mutations.filter((mutation) => mutation.kind === "destructive").map((mutation) => mutation.action),
    )];
    if (destructiveActions.length > 0) {
      const branchCreate = destructiveActions.length === 1
        ? parseStandingAuthorizedBranchCreate(command)
        : undefined;
      const worktreeCreate = destructiveActions.length === 1
        ? parseStandingAuthorizedWorktreeCreate(command)
        : undefined;
      if (branchCreate || worktreeCreate) {
        const gitState = await inspectGitDeliveryState(pi, ctx.cwd);
        const branch = branchCreate?.branch ?? worktreeCreate?.branch;
        const standingAuthorized = Boolean(
          branch
          && gitState.existingLocalBranch
          && (branchCreate || gitState.cleanWorktree)
          && await isNewLocalBranch(pi, ctx.cwd, branch)
          && (!worktreeCreate || await isEligibleWorktreeTarget(pi, ctx.cwd, worktreeCreate.targetPath)),
        );
        if (standingAuthorized) return;
      }
      return confirmRisk(
        ctx,
        "Git state mutation",
        `This command performs: ${destructiveActions.join(", ")}\n\n${safeDisplay(command)}\n\nAllow this one call?`,
      );
    }

    const dangerous = dangerousCommandReason(command);
    if (dangerous) {
      return confirmRisk(
        ctx,
        "Dangerous shell command",
        `${dangerous}:\n\n${safeDisplay(command)}\n\nAllow this one call?`,
      );
    }
  });

  pi.on("tool_result", (event: any, ctx: ExtensionContext) => {
    if ((event.toolName === "write" || event.toolName === "edit") && !event.isError) {
      const path = event.input?.path;
      if (isSourcePath(path, ctx.cwd)) advanceMutation();
      return;
    }
    if (event.toolName === "subagent" && isWriterExecution(event.input)) {
      const runId = event.details?.runId ?? event.details?.asyncId;
      if (!event.isError || (typeof runId === "string" && runId.length > 0)) {
        // A launched writer can mutate before returning an error, so its canonical run id is enough to invalidate prior verification.
        advanceMutation();
      }
      return;
    }
    if (event.toolName === "bash" && !event.isError && isVerificationCommand(event.input?.command)) {
      advanceVerification();
    }
  });

  pi.on("agent_end", () => {
    if (
      state.lastSourceMutation <= state.lastSuccessfulVerification
      || state.lastSourceMutation <= state.nudgedForMutation
    ) return;

    state.nudgedForMutation = state.lastSourceMutation;
    persist();
    pi.sendMessage({
      customType: "pi-forge.lifecycle.verification",
      content: "Pi Forge lifecycle gate: source changed after the latest successful verification. Before finalizing, run the relevant test, lint, type, or build checks after the last edit. If no check applies or the work is intentionally incomplete, state that explicitly with the unchecked risk. Do not claim completion from stale or failed evidence.",
      display: true,
    }, { deliverAs: "followUp", triggerTurn: true });
  });
}
