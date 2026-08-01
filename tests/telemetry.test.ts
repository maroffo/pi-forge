// ABOUTME: Verifies schema-v2 active-branch telemetry, cohort aggregation, and content-free output safety.
// ABOUTME: Guards against leaking prompts, source, paths, commands, outputs, findings, identifiers, or model identities.

import assert from "node:assert/strict";
import { chmod, link, mkdtemp, readFile, rm, stat, symlink, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import telemetryExtension from "../extensions/telemetry.ts";
import {
  activeBranch,
  classifyToolResult,
  deriveMetrics,
  extractTrace,
  summarizeTrace,
} from "../src/session-telemetry.js";
import {
  parseArguments,
  parseSessionText,
  runExtraction,
} from "../skills/session-telemetry/scripts/extract-session-trace.mjs";
import {
  aggregateSessions,
  MAX_COHORT_BYTES,
  parseAggregateArguments,
  runAggregation,
} from "../skills/session-telemetry/scripts/aggregate-session-traces.mjs";

const PROTECTED_WRITER = ["pi-forge", "software-engineer"].join(".");

const usage = {
  input: 10,
  output: 5,
  cacheRead: 3,
  cacheWrite: 2,
  totalTokens: 20,
  cost: { total: 0.0123456789 },
};

function fixtureEntries() {
  return [
    {
      type: "message", id: "a", parentId: null, timestamp: "2026-01-01T00:00:00.000Z",
      message: { role: "user", content: "PRIVATE PROMPT" },
    },
    {
      type: "message", id: "abandoned", parentId: "a", timestamp: "2026-01-01T00:00:00.500Z",
      message: { role: "user", content: "ABANDONED SECRET" },
    },
    {
      type: "message", id: "b", parentId: "a", timestamp: "2026-01-01T00:00:01.000Z",
      message: {
        role: "assistant",
        provider: "private-provider",
        model: "private-model",
        stopReason: "toolUse",
        usage,
        content: [
          { type: "text", text: "PRIVATE RESPONSE" },
          { type: "thinking", thinking: "PRIVATE THINKING" },
          { type: "toolCall", id: "edit-1", name: "edit", arguments: { path: "src/private.ts", edits: [] } },
          { type: "toolCall", id: "bash-1", name: "bash", arguments: { command: "npm test", token: "SECRET_TOKEN" } },
        ],
      },
    },
    {
      type: "message", id: "c", parentId: "b", timestamp: "2026-01-01T00:00:02.000Z",
      message: {
        role: "toolResult", toolCallId: "edit-1", toolName: "edit", isError: false,
        content: [{ type: "text", text: "PRIVATE DIFF" }],
      },
    },
    {
      type: "message", id: "d", parentId: "c", timestamp: "2026-01-01T00:00:03.000Z",
      message: {
        role: "toolResult", toolCallId: "bash-1", toolName: "bash", isError: false,
        content: [{ type: "text", text: "PRIVATE TEST OUTPUT" }],
      },
    },
    {
      type: "compaction", id: "e", parentId: "d", timestamp: "2026-01-01T00:00:04.000Z",
      summary: "PRIVATE COMPACTION",
      tokensBefore: 100,
      usage: { input: 2, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 3, cost: { total: 0.001 } },
    },
    {
      type: "branch_summary", id: "f", parentId: "e", timestamp: "2026-01-01T00:00:05.000Z",
      summary: "PRIVATE BRANCH SUMMARY",
      usage: { input: 4, output: 2, cacheRead: 1, cacheWrite: 0, totalTokens: 7, cost: { total: 0.002 } },
    },
    {
      type: "custom", id: "g", parentId: "f", timestamp: "2026-01-01T00:00:06.000Z",
      customType: "pi-forge.score.v1",
      data: { score: 100, threshold: 90, target: "pr", gates: [{ evidence: "PRIVATE EVIDENCE" }] },
    },
  ];
}

function orderedToolEntries(events: any[]) {
  const entries: any[] = [
    {
      type: "message", id: "root", parentId: null, timestamp: "2026-02-01T00:00:00.000Z",
      message: { role: "user", content: "ORDERED PRIVATE PROMPT" },
    },
    {
      type: "message", id: "calls", parentId: "root", timestamp: "2026-02-01T00:00:01.000Z",
      message: {
        role: "assistant",
        provider: "ORDERED PRIVATE PROVIDER",
        model: "ORDERED PRIVATE MODEL",
        stopReason: "toolUse",
        content: events.map((event, index) => ({
          type: "toolCall",
          id: `call-${index}`,
          name: event.tool,
          arguments: event.input,
        })),
      },
    },
  ];
  let parentId = "calls";
  events.forEach((event, index) => {
    const id = `result-${index}`;
    entries.push({
      type: "message",
      id,
      parentId,
      timestamp: `2026-02-01T00:00:${String(index + 2).padStart(2, "0")}.000Z`,
      message: {
        role: "toolResult",
        toolCallId: `call-${index}`,
        toolName: event.tool,
        isError: event.isError === true,
        details: event.details ?? {},
        content: [{ type: "text", text: "ORDERED PRIVATE OUTPUT" }],
      },
    });
    parentId = id;
  });
  return entries;
}

function sessionText(headerId: string, entries: any[] = fixtureEntries(), version = 3) {
  return `${[
    JSON.stringify({
      type: "session",
      version,
      id: headerId,
      cwd: "/PRIVATE/SESSION/PATH",
      timestamp: "2026-01-01T00:00:00.000Z",
    }),
    ...entries.map((entry) => JSON.stringify(entry)),
  ].join("\n")}\n`;
}

async function writeCohort(root: string, entriesBySession: any[][]) {
  const paths = [];
  for (let index = 0; index < entriesBySession.length; index += 1) {
    const path = join(root, `session-${index}.jsonl`);
    await writeFile(path, sessionText(`PRIVATE-HEADER-${index}`, entriesBySession[index]));
    paths.push(path);
  }
  return paths;
}

function allKeys(value: unknown, result = new Set<string>()) {
  if (!value || typeof value !== "object") return result;
  for (const [key, nested] of Object.entries(value)) {
    result.add(key);
    allKeys(nested, result);
  }
  return result;
}

test("telemetry follows only the active branch and derives schema-v2 counters", () => {
  const entries = fixtureEntries();
  assert.deepEqual(activeBranch(entries).map((entry: any) => entry.id), ["a", "b", "c", "d", "e", "f", "g"]);
  const metrics = deriveMetrics(entries);
  assert.equal(metrics.version, 2);
  assert.equal(metrics.userTurns, 1);
  assert.equal(metrics.assistantMessages, 1);
  assert.equal(metrics.toolCalls.edit, 1);
  assert.equal(metrics.toolCalls.bash, 1);
  assert.equal(metrics.sourceMutations, 1);
  assert.equal(metrics.successfulVerifications, 1);
  assert.equal(metrics.toolErrors, 0);
  assert.equal(metrics.compactions, 1);
  assert.equal(metrics.totalTokens, 30);
  assert.equal(metrics.costTotal, 0.01534568);
});

test("one pure result classifier aligns direct, launched-writer, error, and verification events", () => {
  const direct = classifyToolResult(
    { name: "edit", input: { path: "src/file.ts" } },
    { toolName: "edit", isError: false },
  );
  assert.equal(direct.sourceMutation, true);

  const writer = { name: "subagent", input: { agent: PROTECTED_WRITER } };
  assert.equal(classifyToolResult(writer, { toolName: "subagent", isError: false, details: { runId: "run" } }).sourceMutation, true);
  assert.equal(classifyToolResult(writer, { toolName: "subagent", isError: true, details: { asyncId: "async" } }).sourceMutation, true);
  assert.equal(classifyToolResult(writer, { toolName: "subagent", isError: true, details: {} }).sourceMutation, false);
  assert.equal(classifyToolResult(writer, { toolName: "subagent", isError: false, details: {} }).sourceMutation, false);
  assert.equal(classifyToolResult(
    { name: "subagent", input: { action: "get", agent: PROTECTED_WRITER } },
    { toolName: "subagent", isError: false, details: { runId: "management-result" } },
  ).sourceMutation, false);

  assert.equal(classifyToolResult(
    { name: "bash", input: { command: "npm test" } },
    { toolName: "bash", isError: false },
  ).successfulVerification, true);
  assert.equal(classifyToolResult(
    { name: "bash", input: { command: "npm test" } },
    { toolName: "bash", isError: true },
  ).successfulVerification, false);
});

test("trace schema v2 excludes raw content and shares result classification", () => {
  const trace = extractTrace(fixtureEntries());
  assert.ok(trace.every((entry) => entry.v === 2));
  assert.ok(trace.some((entry) => entry.kind === "score" && entry.data.score === 100));
  assert.ok(trace.some((entry) => entry.kind === "tool_result" && entry.data.sourceMutation === true));
  assert.ok(trace.some((entry) => entry.kind === "tool_result" && entry.data.successfulVerification === true));
  const serialized = JSON.stringify(trace);
  for (const secret of [
    "PRIVATE", "SECRET_TOKEN", "src/private.ts", "npm test", "private-provider", "private-model", "evidence",
  ]) assert.doesNotMatch(serialized, new RegExp(secret, "i"), secret);

  const summary = summarizeTrace(fixtureEntries());
  assert.equal(summary.v, 2);
  assert.equal(summary.data.version, 2);
  assert.equal(summary.kind, "summary");

  const malformed = fixtureEntries();
  malformed[2] = {
    ...malformed[2],
    timestamp: "2026-01-01 (PRIVATE TIMESTAMP)",
    message: { ...malformed[2].message, stopReason: "PRIVATE RAW STOP REASON" },
  };
  const malformedTrace = JSON.stringify(extractTrace(malformed));
  assert.doesNotMatch(malformedTrace, /PRIVATE TIMESTAMP|PRIVATE RAW STOP REASON/);
  assert.match(malformedTrace, /"stopReason":"unknown"/);
});

test("historical Pi v2/v3 parsers fail closed on ambiguity, trees, lines, and malformed data", () => {
  assert.deepEqual(parseArguments(["session.jsonl", "--summary"], {}), {
    sessionPath: join(process.cwd(), "session.jsonl"),
    summary: true,
    force: false,
  });
  assert.equal(parseArguments([], { PI_SESSION_FILE: "/tmp/session.jsonl" }).sessionPath, "/tmp/session.jsonl");
  assert.throws(() => parseArguments([], {}), /Usage/);
  assert.throws(() => parseArguments(["a", "b"], {}), /Usage/);
  assert.throws(() => parseArguments(["a", "--force"], {}), /requires --output/);
  assert.throws(() => parseSessionText("not json\n"), /not valid JSON/);
  assert.throws(() => parseSessionText(`${JSON.stringify({ type: "message" })}\n`), /valid version 2 or 3 header/);
  assert.equal(parseSessionText(sessionText("v2-session", [], 2)).length, 0);
  assert.equal(parseSessionText(sessionText("v3-session", [], 3)).length, 0);
  const header = JSON.stringify({
    type: "session", version: 3, id: "session", cwd: "/tmp/project", timestamp: "2026-01-01T00:00:00.000Z",
  });
  const root = JSON.stringify({
    type: "message", id: "root", parentId: null, timestamp: "2026-01-01T00:00:01.000Z", message: { role: "user", content: "x" },
  });
  const dangling = JSON.stringify({
    type: "message", id: "child", parentId: "missing", timestamp: "2026-01-01T00:00:02.000Z", message: { role: "user", content: "x" },
  });
  assert.throws(() => parseSessionText(`${header}\n${root}\n${root}\n`), /duplicate entry id/);
  assert.throws(() => parseSessionText(`${header}\n${dangling}\n`), /dangling/);
  assert.throws(() => parseSessionText(`${header}\n${"x".repeat(2 * 1024 * 1024 + 1)}\n`), /2MB safety limit/);
});

test("single-session extractor writes mode-safe JSONL and refuses links, aliases, and implicit overwrite", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-forge-telemetry-"));
  try {
    const session = join(root, "session.jsonl");
    const output = join(root, "trace.jsonl");
    await writeFile(session, sessionText("PRIVATE-SESSION-ID"));
    await runExtraction({ sessionPath: session, outputPath: output, summary: true, force: false });
    const written = await readFile(output, "utf8");
    assert.match(written, /"kind":"summary"/);
    assert.doesNotMatch(written, /private/i);
    assert.equal((await stat(output)).mode & 0o777, 0o600);
    await assert.rejects(
      runExtraction({ sessionPath: session, outputPath: output, summary: true, force: false }),
      /already exists/,
    );

    await chmod(output, 0o644);
    await runExtraction({ sessionPath: session, outputPath: output, summary: true, force: true });
    assert.equal((await stat(output)).mode & 0o777, 0o600);

    const symlinkPath = join(root, "trace-link.jsonl");
    const symlinkTarget = join(root, "trace-target.jsonl");
    await writeFile(symlinkTarget, "do not overwrite");
    await symlink(symlinkTarget, symlinkPath);
    await assert.rejects(
      runExtraction({ sessionPath: session, outputPath: symlinkPath, summary: true, force: true }),
      /symbolic link|opened safely/i,
    );
    assert.equal(await readFile(symlinkTarget, "utf8"), "do not overwrite");

    const inputLink = join(root, "session-link.jsonl");
    await symlink(session, inputLink);
    await assert.rejects(
      runExtraction({ sessionPath: inputLink, summary: true, force: false }),
      /regular non-symlink/,
    );

    const hardlinkTarget = join(root, "hardlink-target.jsonl");
    const hardlinkPath = join(root, "hardlink-output.jsonl");
    await writeFile(hardlinkTarget, "do not overwrite");
    await link(hardlinkTarget, hardlinkPath);
    await assert.rejects(
      runExtraction({ sessionPath: session, outputPath: hardlinkPath, summary: true, force: true }),
      /multiple hard links/,
    );
    assert.equal(await readFile(hardlinkTarget, "utf8"), "do not overwrite");

    await assert.rejects(
      runExtraction({ sessionPath: session, outputPath: session, summary: true, force: true }),
      /resolves to an input session file/,
    );
    assert.match(await readFile(session, "utf8"), /"type":"session"/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runtime telemetry stores only sanitized schema-v2 custom snapshots", async () => {
  const handlers = new Map<string, (...args: any[]) => any>();
  const commands = new Map<string, any>();
  const snapshots: any[] = [];
  const notices: string[] = [];
  let branch = fixtureEntries().slice(0, 1);
  telemetryExtension({
    on(name: string, handler: (...args: any[]) => any) { handlers.set(name, handler); },
    registerCommand(name: string, options: any) { commands.set(name, options); },
    appendEntry(type: string, data: any) { snapshots.push({ type, data }); },
  } as any);
  const context = {
    hasUI: true,
    ui: { notify: (message: string) => notices.push(message) },
    sessionManager: { getBranch: () => branch },
  };
  handlers.get("session_start")?.({}, context);
  branch = fixtureEntries();
  handlers.get("agent_settled")?.({}, context);
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].type, "pi-forge.telemetry.v2");
  assert.equal(snapshots[0].data.version, 2);
  handlers.get("session_tree")?.({}, context);
  assert.equal(snapshots.length, 2);
  const serialized = JSON.stringify(snapshots[0]);
  assert.doesNotMatch(serialized, /PRIVATE|SECRET|src\/private|npm test|private-provider|private-model/i);

  assert.ok(commands.has("forge-telemetry"));
  await commands.get("forge-telemetry").handler("", context);
  assert.match(notices[0], /local, sanitized/);
  assert.match(notices[0], /excludes prompts/);
});

test("cohort parser enforces repeated explicit inputs and 5-to-100 boundaries", () => {
  const five = Array.from({ length: 5 }, (_, index) => ["--input", `session-${index}.jsonl`]).flat();
  assert.equal(parseAggregateArguments(five).inputPaths.length, 5);
  assert.throws(() => parseAggregateArguments(five.slice(0, 8)), /5 to 100/);
  assert.throws(() => parseAggregateArguments([...five, "positional.jsonl"]), /Usage/);
  assert.throws(() => parseAggregateArguments([...five, "--force"]), /requires --output/);
  const hundred = Array.from({ length: 100 }, (_, index) => ["--input", `session-${index}.jsonl`]).flat();
  assert.equal(parseAggregateArguments(hundred).inputPaths.length, 100);
  assert.throws(
    () => parseAggregateArguments([...hundred, "--input", "session-100.jsonl"]),
    /5 to 100/,
  );
  assert.equal(aggregateSessions(Array.from({ length: 100 }, () => ({ entries: [] }))).sessionCounts.total, 100);
  assert.throws(() => aggregateSessions(Array.from({ length: 4 }, () => ({ entries: [] }))), /5 to 100/);
});

test("cohort runner accepts the 100-session upper boundary", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-forge-cohort-boundary-"));
  try {
    const inputPaths = await writeCohort(root, Array.from({ length: 100 }, () => []));
    const aggregate = JSON.parse(await runAggregation({ inputPaths, force: false }));
    assert.equal(aggregate.sessionCounts.total, 100);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("cohort final-mutation verification uses ordered direct and protected-writer results", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-forge-cohort-order-"));
  try {
    const cohorts = [
      orderedToolEntries([
        { tool: "edit", input: { path: "src/private.ts" } },
        { tool: "bash", input: { command: "npm test" } },
      ]),
      orderedToolEntries([
        { tool: "subagent", input: { agent: PROTECTED_WRITER }, details: { runId: "PRIVATE-RUN" } },
        { tool: "bash", input: { command: "npm test" } },
      ]),
      orderedToolEntries([
        { tool: "subagent", input: { agent: PROTECTED_WRITER }, isError: true, details: { runId: "PRIVATE-FAILED-RUN" } },
        { tool: "bash", input: { command: "npm test" }, isError: true },
      ]),
      orderedToolEntries([
        { tool: "subagent", input: { agent: PROTECTED_WRITER }, isError: true },
        { tool: "bash", input: { command: "npm test" } },
      ]),
      orderedToolEntries([
        { tool: "bash", input: { command: "npm test" } },
        { tool: "write", input: { path: "src/private.ts" } },
      ]),
    ];
    const inputPaths = await writeCohort(root, cohorts);
    const output = await runAggregation({ inputPaths, force: false });
    const aggregate = JSON.parse(output);
    assert.equal(aggregate.schemaVersion, 1);
    assert.equal(aggregate.traceSchemaVersion, 2);
    assert.equal(aggregate.sessionCounts.total, 5);
    assert.deepEqual(aggregate.sessionCounts.verificationAfterFinalMutation, { eligible: 4, passing: 2 });
    assert.equal(aggregate.sessionRates.verificationAfterFinalMutation, 0.5);
    assert.equal(aggregate.totals.sourceMutations, 4);
    assert.equal(aggregate.totals.successfulVerifications, 4);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("cohort output contains only aggregate projections and no secret-rich session content", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-forge-cohort-privacy-"));
  try {
    const inputPaths = await writeCohort(root, Array.from({ length: 5 }, () => fixtureEntries()));
    const outputPath = join(root, "privacy-cohort.json");
    const output = await runAggregation({ inputPaths, outputPath, force: false });
    const aggregate = JSON.parse(output);
    assert.equal(await readFile(outputPath, "utf8"), output);
    assert.deepEqual(Object.keys(aggregate), [
      "schemaVersion", "traceSchemaVersion", "kind", "totals", "medians", "sessionCounts", "sessionRates", "warnings",
    ]);
    const forbiddenKeys = new Set([
      "id", "hash", "timestamp", "path", "prompt", "response", "thinking", "summary", "source", "command",
      "arguments", "output", "error", "finding", "environment", "secret", "provider", "model", "sessions", "rows", "min", "max",
    ]);
    for (const key of allKeys(aggregate)) assert.equal(forbiddenKeys.has(key.toLowerCase()), false, key);
    for (const secret of [
      "PRIVATE", "SECRET_TOKEN", "src/private.ts", "npm test", "private-provider", "private-model", "ABANDONED", inputPaths[0],
    ]) assert.doesNotMatch(output, new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), secret);
    assert.equal(aggregate.sessionCounts.withCompactions, 5);
    assert.deepEqual(aggregate.sessionCounts.scoreAtOrAboveThreshold, { eligible: 5, passing: 5 });
    assert.equal(aggregate.sessionRates.withScore, 1);
    assert.equal(aggregate.warnings.length, 3);
    assert.equal(Array.isArray((aggregate as any).sessions), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("cohort inputs reject duplicate identity, header copies, symlinks, malformed trees, and oversized resources", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-forge-cohort-input-"));
  try {
    const inputPaths = await writeCohort(root, Array.from({ length: 5 }, () => []));
    await assert.rejects(
      runAggregation({ inputPaths: [inputPaths[0], inputPaths[0], ...inputPaths.slice(1, 4)], force: false }),
      /duplicate filesystem identity/,
    );

    const hardlinkPath = join(root, "hardlink-session.jsonl");
    await link(inputPaths[0], hardlinkPath);
    await assert.rejects(
      runAggregation({ inputPaths: [inputPaths[0], hardlinkPath, ...inputPaths.slice(1, 4)], force: false }),
      /duplicate filesystem identity/,
    );

    const copiedPath = join(root, "copied-session.jsonl");
    await writeFile(copiedPath, await readFile(inputPaths[0]));
    await assert.rejects(
      runAggregation({ inputPaths: [inputPaths[0], copiedPath, ...inputPaths.slice(1, 4)], force: false }),
      /duplicate session header identity/,
    );

    const symlinkPath = join(root, "linked-session.jsonl");
    await symlink(inputPaths[0], symlinkPath);
    await assert.rejects(
      runAggregation({ inputPaths: [symlinkPath, ...inputPaths.slice(1)], force: false }),
      /regular non-symlink/,
    );

    const malformedPath = join(root, "malformed.jsonl");
    await writeFile(malformedPath, "PRIVATE-MALFORMED-CONTENT");
    await assert.rejects(
      runAggregation({ inputPaths: [malformedPath, ...inputPaths.slice(1)], force: false }),
      (error: Error) => /not valid JSON/.test(error.message) && !/PRIVATE-MALFORMED-CONTENT/.test(error.message),
    );

    const malformedTreePath = join(root, "malformed-tree.jsonl");
    await writeFile(malformedTreePath, `${JSON.stringify({
      type: "session", version: 3, id: "PRIVATE-TREE-ID", cwd: "/PRIVATE/TREE", timestamp: "2026-01-01T00:00:00.000Z",
    })}\n${JSON.stringify({
      type: "message", id: "child", parentId: "missing", timestamp: "2026-01-01T00:00:01.000Z", message: { role: "user", content: "PRIVATE TREE" },
    })}\n`);
    await assert.rejects(
      runAggregation({ inputPaths: [malformedTreePath, ...inputPaths.slice(1)], force: false }),
      (error: Error) => /dangling/.test(error.message) && !/PRIVATE-TREE-ID|PRIVATE TREE/.test(error.message),
    );

    const oversizedPath = join(root, "oversized.jsonl");
    await writeFile(oversizedPath, "");
    await truncate(oversizedPath, 250 * 1024 * 1024 + 1);
    await assert.rejects(
      runAggregation({ inputPaths: [oversizedPath, ...inputPaths.slice(1)], force: false }),
      /byte safety limit/,
    );

    let index = 0;
    await assert.rejects(
      runAggregation({ inputPaths: ["a", "b", "c", "d", "e"], force: false }, {
        readSessionFileSafely: async () => {
          index += 1;
          return {
            entries: [],
            headerId: `internal-${index}`,
            inputStats: { dev: 1, ino: index },
            bytes: Math.floor(MAX_COHORT_BYTES / 3),
          };
        },
      }),
      /cumulative input exceeds the 1GiB safety limit/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("cohort safe output refuses overwrite, links, and every input alias while enforcing mode 0600", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-forge-cohort-output-"));
  try {
    const inputPaths = await writeCohort(root, Array.from({ length: 5 }, () => []));
    const outputPath = join(root, "cohort.json");
    await runAggregation({ inputPaths, outputPath, force: false });
    assert.equal((await stat(outputPath)).mode & 0o777, 0o600);
    assert.match(await readFile(outputPath, "utf8"), /"kind":"cohort_summary"/);
    await assert.rejects(runAggregation({ inputPaths, outputPath, force: false }), /already exists/);
    await chmod(outputPath, 0o644);
    await runAggregation({ inputPaths, outputPath, force: true });
    assert.equal((await stat(outputPath)).mode & 0o777, 0o600);

    const target = join(root, "target.json");
    const outputLink = join(root, "output-link.json");
    await writeFile(target, "PRIVATE TARGET MUST SURVIVE");
    await symlink(target, outputLink);
    await assert.rejects(
      runAggregation({ inputPaths, outputPath: outputLink, force: true }),
      /symbolic link|opened safely/,
    );
    assert.equal(await readFile(target, "utf8"), "PRIVATE TARGET MUST SURVIVE");

    const hardlinkTarget = join(root, "hardlink-target.json");
    const hardlinkOutput = join(root, "hardlink-output.json");
    await writeFile(hardlinkTarget, "PRIVATE HARDLINK MUST SURVIVE");
    await link(hardlinkTarget, hardlinkOutput);
    await assert.rejects(
      runAggregation({ inputPaths, outputPath: hardlinkOutput, force: true }),
      /multiple hard links/,
    );
    assert.equal(await readFile(hardlinkTarget, "utf8"), "PRIVATE HARDLINK MUST SURVIVE");

    await assert.rejects(
      runAggregation({ inputPaths, outputPath: inputPaths[3], force: true }),
      /resolves to an input session file/,
    );
    assert.match(await readFile(inputPaths[3], "utf8"), /"type":"session"/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
