#!/usr/bin/env node
// ABOUTME: Aggregates sanitized active-branch metrics from an explicit cohort of distinct Pi session files.
// ABOUTME: Emits cohort totals, medians, rates, counts, and fixed interpretation warnings without session rows or identifiers.

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { deriveMetrics, extractTrace, TRACE_VERSION } from "../../../src/session-telemetry.js";
import {
  MAX_SESSION_BYTES,
  readSessionFileSafely,
  writeOutputSafely,
} from "./extract-session-trace.mjs";

export const MIN_COHORT_SESSIONS = 5;
export const MAX_COHORT_SESSIONS = 100;
export const MAX_COHORT_BYTES = 1024 * 1024 * 1024;
export const COHORT_SCHEMA_VERSION = 1;

const METRIC_FIELDS = [
  "userTurns",
  "assistantMessages",
  "toolErrors",
  "sourceMutations",
  "successfulVerifications",
  "subagentLaunches",
  "compactions",
  "modelChanges",
  "inputTokens",
  "outputTokens",
  "cacheReadTokens",
  "cacheWriteTokens",
  "totalTokens",
  "costTotal",
];
const TOOL_BUCKETS = ["bash", "edit", "find", "grep", "ls", "other", "read", "subagent", "write"];
const WARNINGS = [
  "Cohort comparability is asserted by the operator, not inferred from telemetry.",
  "Observed events do not prove causality, absence, quality, security, or completion.",
  "Shell and custom-tool mutations may remain unobserved.",
];

function usage() {
  return "Usage: aggregate-session-traces.mjs --input <session.jsonl> [--input <session.jsonl> ...] [--output <file>] [--force]";
}

export function parseAggregateArguments(argv) {
  const inputPaths = [];
  let outputPath;
  let force = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--input") {
      const inputPath = argv[index + 1];
      if (!inputPath || inputPath.startsWith("-")) throw new Error(usage());
      inputPaths.push(resolve(inputPath));
      index += 1;
    } else if (argument === "--output") {
      if (outputPath) throw new Error(usage());
      outputPath = argv[index + 1];
      if (!outputPath || outputPath.startsWith("-")) throw new Error(usage());
      outputPath = resolve(outputPath);
      index += 1;
    } else if (argument === "--force") {
      force = true;
    } else {
      throw new Error(usage());
    }
  }
  if (inputPaths.length < MIN_COHORT_SESSIONS || inputPaths.length > MAX_COHORT_SESSIONS) {
    throw new Error(`cohort requires ${MIN_COHORT_SESSIONS} to ${MAX_COHORT_SESSIONS} explicit session inputs`);
  }
  if (force && !outputPath) throw new Error("--force requires --output");
  return {
    inputPaths,
    ...(outputPath ? { outputPath } : {}),
    force,
  };
}

function rounded(value, digits = 8) {
  return Number(value.toFixed(digits));
}

function median(values) {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  const value = ordered.length % 2 === 1
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
  return rounded(value);
}

function sum(values) {
  return rounded(values.reduce((total, value) => total + value, 0));
}

function rate(numerator, denominator) {
  return denominator === 0 ? 0 : rounded(numerator / denominator, 6);
}

function projectMetrics(metricsList, reducer) {
  const projection = {
    toolCalls: Object.fromEntries(TOOL_BUCKETS.map((tool) => [
      tool,
      reducer(metricsList.map((metrics) => metrics.toolCalls[tool])),
    ])),
  };
  for (const field of METRIC_FIELDS) {
    projection[field] = reducer(metricsList.map((metrics) => metrics[field]));
  }
  return projection;
}

function orderedSignals(trace) {
  const toolResults = trace.filter((event) => event.kind === "tool_result");
  const mutationEvents = toolResults.filter((event) => event.data.sourceMutation === true);
  if (mutationEvents.length === 0) {
    return { hasMutation: false, verificationAfterFinalMutation: false };
  }
  const finalMutationSequence = mutationEvents[mutationEvents.length - 1].sequence;
  return {
    hasMutation: true,
    verificationAfterFinalMutation: toolResults.some((event) => (
      event.sequence > finalMutationSequence && event.data.successfulVerification === true
    )),
  };
}

function sessionProjection(entries) {
  const metrics = deriveMetrics(entries);
  const trace = extractTrace(entries);
  const scoreEvents = trace.filter((event) => event.kind === "score");
  const latestScore = scoreEvents.at(-1)?.data;
  return {
    metrics,
    signals: orderedSignals(trace),
    hasScore: latestScore !== undefined,
    scoreAtOrAboveThreshold: latestScore !== undefined && latestScore.score >= latestScore.threshold,
  };
}

function aggregateProjections(projections) {
  if (!Array.isArray(projections) || projections.length < MIN_COHORT_SESSIONS || projections.length > MAX_COHORT_SESSIONS) {
    throw new Error(`cohort requires ${MIN_COHORT_SESSIONS} to ${MAX_COHORT_SESSIONS} distinct sessions`);
  }
  const metricsList = projections.map(({ metrics }) => metrics);
  const withToolErrors = metricsList.filter((metrics) => metrics.toolErrors > 0).length;
  const withSourceMutations = projections.filter(({ signals }) => signals.hasMutation).length;
  const withSuccessfulVerifications = metricsList.filter((metrics) => metrics.successfulVerifications > 0).length;
  const withCompactions = metricsList.filter((metrics) => metrics.compactions > 0).length;
  const withSubagents = metricsList.filter((metrics) => metrics.subagentLaunches > 0).length;
  const withScore = projections.filter((projection) => projection.hasScore).length;
  const scoreAtOrAboveThreshold = projections.filter((projection) => projection.scoreAtOrAboveThreshold).length;
  const verifiedAfterFinalMutation = projections.filter(({ signals }) => signals.verificationAfterFinalMutation).length;
  const count = projections.length;
  return {
    schemaVersion: COHORT_SCHEMA_VERSION,
    traceSchemaVersion: TRACE_VERSION,
    kind: "cohort_summary",
    totals: projectMetrics(metricsList, sum),
    medians: projectMetrics(metricsList, median),
    sessionCounts: {
      total: count,
      withToolErrors,
      withSourceMutations,
      withSuccessfulVerifications,
      withCompactions,
      withSubagents,
      withScore,
      scoreAtOrAboveThreshold: {
        eligible: withScore,
        passing: scoreAtOrAboveThreshold,
      },
      verificationAfterFinalMutation: {
        eligible: withSourceMutations,
        passing: verifiedAfterFinalMutation,
      },
    },
    sessionRates: {
      withToolErrors: rate(withToolErrors, count),
      withSourceMutations: rate(withSourceMutations, count),
      withSuccessfulVerifications: rate(withSuccessfulVerifications, count),
      withCompactions: rate(withCompactions, count),
      withSubagents: rate(withSubagents, count),
      withScore: rate(withScore, count),
      scoreAtOrAboveThreshold: rate(scoreAtOrAboveThreshold, withScore),
      verificationAfterFinalMutation: rate(verifiedAfterFinalMutation, withSourceMutations),
    },
    warnings: [...WARNINGS],
  };
}

export function aggregateSessions(sessions) {
  if (!Array.isArray(sessions)) throw new Error("cohort sessions must be an array");
  return aggregateProjections(sessions.map(({ entries }) => sessionProjection(entries)));
}

export async function runAggregation(options, dependencies = {}) {
  if (!Array.isArray(options?.inputPaths)
    || options.inputPaths.length < MIN_COHORT_SESSIONS
    || options.inputPaths.length > MAX_COHORT_SESSIONS) {
    throw new Error(`cohort requires ${MIN_COHORT_SESSIONS} to ${MAX_COHORT_SESSIONS} explicit session inputs`);
  }
  const readSession = dependencies.readSessionFileSafely ?? readSessionFileSafely;
  const writeOutput = dependencies.writeOutputSafely ?? writeOutputSafely;
  const filesystemIdentities = new Set();
  const headerIds = new Set();
  const projections = [];
  const inputStats = [];
  let cumulativeBytes = 0;
  for (const inputPath of options.inputPaths) {
    const remainingBytes = MAX_COHORT_BYTES - cumulativeBytes;
    if (remainingBytes <= 0) throw new Error("cohort cumulative input exceeds the 1GiB safety limit");
    let session;
    try {
      session = await readSession(inputPath, Math.min(MAX_SESSION_BYTES, remainingBytes));
    } catch (error) {
      if (remainingBytes < MAX_SESSION_BYTES && /active byte safety limit/.test(error?.message ?? "")) {
        throw new Error("cohort cumulative input exceeds the 1GiB safety limit");
      }
      throw error;
    }
    const identity = `${session.inputStats.dev}:${session.inputStats.ino}`;
    if (filesystemIdentities.has(identity)) throw new Error("cohort contains duplicate filesystem identity");
    filesystemIdentities.add(identity);
    if (headerIds.has(session.headerId)) throw new Error("cohort contains duplicate session header identity");
    headerIds.add(session.headerId);
    cumulativeBytes += session.bytes;
    if (cumulativeBytes > MAX_COHORT_BYTES) throw new Error("cohort cumulative input exceeds the 1GiB safety limit");
    inputStats.push(session.inputStats);
    projections.push(sessionProjection(session.entries));
  }
  const output = `${JSON.stringify(aggregateProjections(projections))}\n`;
  if (options.outputPath) {
    await writeOutput(inputStats, options.outputPath, output, options.force === true);
  }
  return output;
}

async function main() {
  try {
    const options = parseAggregateArguments(process.argv.slice(2));
    const output = await runAggregation(options);
    if (!options.outputPath) process.stdout.write(output);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "cohort aggregation failed"}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
