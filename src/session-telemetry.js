// ABOUTME: Builds sanitized Pi session telemetry from active-branch entries without retaining prompts or tool payloads.
// ABOUTME: Defines the local trace schema shared by the runtime extension and offline extractor.

import { isSourcePath, isVerificationCommand } from "./lifecycle-policy.js";

export const TELEMETRY_ENTRY = "pi-forge.telemetry.v2";
export const TRACE_VERSION = 2;

const TOOL_BUCKETS = new Set(["bash", "edit", "find", "grep", "ls", "read", "subagent", "write"]);

export function toolBucket(value) {
  return typeof value === "string" && TOOL_BUCKETS.has(value) ? value : "other";
}

export function emptyMetrics() {
  return {
    version: TRACE_VERSION,
    userTurns: 0,
    assistantMessages: 0,
    toolCalls: { bash: 0, edit: 0, find: 0, grep: 0, ls: 0, other: 0, read: 0, subagent: 0, write: 0 },
    toolErrors: 0,
    sourceMutations: 0,
    successfulVerifications: 0,
    subagentLaunches: 0,
    compactions: 0,
    modelChanges: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalTokens: 0,
    costTotal: 0,
  };
}

function nonnegativeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

function usageProjection(usage) {
  return {
    inputTokens: nonnegativeNumber(usage?.input),
    outputTokens: nonnegativeNumber(usage?.output),
    cacheReadTokens: nonnegativeNumber(usage?.cacheRead),
    cacheWriteTokens: nonnegativeNumber(usage?.cacheWrite),
    totalTokens: nonnegativeNumber(usage?.totalTokens),
    costTotal: Number(nonnegativeNumber(usage?.cost?.total).toFixed(8)),
  };
}

function addUsage(metrics, usage) {
  if (!usage || typeof usage !== "object") return;
  metrics.inputTokens += nonnegativeNumber(usage.input);
  metrics.outputTokens += nonnegativeNumber(usage.output);
  metrics.cacheReadTokens += nonnegativeNumber(usage.cacheRead);
  metrics.cacheWriteTokens += nonnegativeNumber(usage.cacheWrite);
  metrics.totalTokens += nonnegativeNumber(usage.totalTokens);
  metrics.costTotal += nonnegativeNumber(usage.cost?.total);
}

function contentBlocks(message) {
  return Array.isArray(message?.content) ? message.content : [];
}

function writerInInput(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (value.agent === "pi-forge.software-engineer") return true;
  for (const key of ["tasks", "chain"]) {
    if (Array.isArray(value[key]) && value[key].some(writerInInput)) return true;
  }
  if (Array.isArray(value.parallel) && value.parallel.some(writerInInput)) return true;
  return value.parallel && !Array.isArray(value.parallel) ? writerInInput(value.parallel) : false;
}

function isWriterExecution(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !writerInInput(value)) return false;
  if (typeof value.action !== "string") return true;
  const action = value.action.toLowerCase();
  return action === "single" && (value.agent !== undefined || value.task !== undefined)
    || (action === "parallel" || action === "tasks") && Array.isArray(value.tasks) && value.tasks.length > 0;
}

function hasLaunchIdentity(message) {
  const runId = message?.details?.runId ?? message?.details?.asyncId;
  return typeof runId === "string" && runId.length > 0;
}

export function classifyToolResult(call, message) {
  const tool = toolBucket(message?.toolName ?? call?.name);
  const isError = message?.isError === true;
  const directMutation = !isError
    && (tool === "write" || tool === "edit")
    && isSourcePath(call?.input?.path);
  const protectedWriterMutation = tool === "subagent"
    && isWriterExecution(call?.input)
    && hasLaunchIdentity(message);
  return {
    tool,
    isError,
    sourceMutation: directMutation || protectedWriterMutation,
    successfulVerification: !isError
      && tool === "bash"
      && isVerificationCommand(call?.input?.command),
  };
}

export function activeBranch(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  const withIds = entries.filter((entry) => entry && typeof entry === "object" && typeof entry.id === "string");
  if (withIds.length === 0) return [...entries];
  const byId = new Map(withIds.map((entry) => [entry.id, entry]));
  const branch = [];
  let current = withIds[withIds.length - 1];
  const seen = new Set();
  while (current && !seen.has(current.id)) {
    branch.push(current);
    seen.add(current.id);
    current = typeof current.parentId === "string" ? byId.get(current.parentId) : undefined;
  }
  return branch.reverse();
}

export function deriveMetrics(entries) {
  const metrics = emptyMetrics();
  const calls = new Map();

  for (const entry of activeBranch(entries)) {
    if (!entry || typeof entry !== "object") continue;
    if (entry.type === "compaction") {
      metrics.compactions += 1;
      addUsage(metrics, entry.usage);
      continue;
    }
    if (entry.type === "branch_summary") {
      addUsage(metrics, entry.usage);
      continue;
    }
    if (entry.type === "model_change") {
      metrics.modelChanges += 1;
      continue;
    }
    if (entry.type !== "message" || !entry.message || typeof entry.message !== "object") continue;
    const message = entry.message;
    if (message.role === "user") {
      metrics.userTurns += 1;
      continue;
    }
    if (message.role === "assistant") {
      metrics.assistantMessages += 1;
      addUsage(metrics, message.usage);
      for (const block of contentBlocks(message)) {
        if (block?.type !== "toolCall" || typeof block.id !== "string") continue;
        const name = toolBucket(block.name);
        metrics.toolCalls[name] += 1;
        if (name === "subagent") metrics.subagentLaunches += 1;
        calls.set(block.id, { name, input: block.arguments ?? {} });
      }
      continue;
    }
    if (message.role !== "toolResult") continue;
    const call = calls.get(message.toolCallId);
    const result = classifyToolResult(call, message);
    if (result.isError) metrics.toolErrors += 1;
    if (result.sourceMutation) metrics.sourceMutations += 1;
    if (result.successfulVerification) metrics.successfulVerifications += 1;
    addUsage(metrics, message.usage);
  }

  metrics.costTotal = Number(metrics.costTotal.toFixed(8));
  return metrics;
}

export function isCanonicalTimestamp(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  try {
    return new Date(value).toISOString() === value;
  } catch {
    return false;
  }
}

function safeTimestamp(value) {
  return isCanonicalTimestamp(value) ? value : undefined;
}

function safeStopReason(value) {
  return ["aborted", "error", "length", "stop", "toolUse"].includes(value) ? value : "unknown";
}

function safeScore(value) {
  if (!value || typeof value !== "object") return undefined;
  if (!Number.isInteger(value.score) || value.score < 0 || value.score > 100) return undefined;
  if (!Number.isInteger(value.threshold) || value.threshold < 0 || value.threshold > 100) return undefined;
  if (!["commit", "pr", "excellence"].includes(value.target)) return undefined;
  return { score: value.score, threshold: value.threshold, target: value.target };
}

export function extractTrace(entries) {
  const trace = [];
  const calls = new Map();
  let sequence = 0;
  const emit = (kind, entry, data = {}) => {
    sequence += 1;
    trace.push({
      v: TRACE_VERSION,
      sequence,
      kind,
      ...(safeTimestamp(entry?.timestamp) ? { timestamp: entry.timestamp } : {}),
      data,
    });
  };

  for (const entry of activeBranch(entries)) {
    if (!entry || typeof entry !== "object") continue;
    if (entry.type === "compaction") {
      emit("compaction", entry, {
        tokensBefore: nonnegativeNumber(entry.tokensBefore),
        usage: usageProjection(entry.usage),
      });
      continue;
    }
    if (entry.type === "branch_summary") {
      emit("branch_summary", entry, { usage: usageProjection(entry.usage) });
      continue;
    }
    if (entry.type === "model_change") {
      emit("model_change", entry);
      continue;
    }
    if (entry.type === "thinking_level_change") {
      emit("thinking_change", entry);
      continue;
    }
    if (entry.type === "custom" && entry.customType === "pi-forge.score.v1") {
      const score = safeScore(entry.data);
      if (score) emit("score", entry, score);
      continue;
    }
    if (entry.type !== "message" || !entry.message || typeof entry.message !== "object") continue;
    const message = entry.message;
    if (message.role === "user") {
      emit("user_turn", entry);
      continue;
    }
    if (message.role === "assistant") {
      emit("assistant", entry, {
        stopReason: safeStopReason(message.stopReason),
        usage: usageProjection(message.usage),
      });
      for (const block of contentBlocks(message)) {
        if (block?.type !== "toolCall" || typeof block.id !== "string") continue;
        const name = toolBucket(block.name);
        calls.set(block.id, { name, input: block.arguments ?? {} });
        emit("tool_call", entry, { tool: name });
      }
      continue;
    }
    if (message.role !== "toolResult") continue;
    const call = calls.get(message.toolCallId);
    emit("tool_result", entry, classifyToolResult(call, message));
  }
  return trace;
}

export function summarizeTrace(entries) {
  return {
    v: TRACE_VERSION,
    kind: "summary",
    data: deriveMetrics(entries),
  };
}
