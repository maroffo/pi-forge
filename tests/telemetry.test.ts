// ABOUTME: Verifies active-branch, content-free session metrics and offline trace extraction.
// ABOUTME: Guards against leaking prompts, source, paths, commands, outputs, findings, or model identities.

import assert from "node:assert/strict";
import { chmod, link, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import telemetryExtension from "../extensions/telemetry.ts";
import {
  activeBranch,
  deriveMetrics,
  extractTrace,
  summarizeTrace,
} from "../src/session-telemetry.js";
import {
  parseArguments,
  parseSessionText,
  runExtraction,
} from "../skills/session-telemetry/scripts/extract-session-trace.mjs";

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

test("telemetry follows only the active branch and derives aggregate counters", () => {
  const entries = fixtureEntries();
  assert.deepEqual(activeBranch(entries).map((entry: any) => entry.id), ["a", "b", "c", "d", "e", "f", "g"]);
  const metrics = deriveMetrics(entries);
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

test("trace schema excludes all raw content, paths, commands, findings, and model identities", () => {
  const trace = extractTrace(fixtureEntries());
  assert.ok(trace.some((entry) => entry.kind === "score" && entry.data.score === 100));
  assert.ok(trace.some((entry) => entry.kind === "tool_result" && entry.data.sourceMutation === true));
  assert.ok(trace.some((entry) => entry.kind === "tool_result" && entry.data.successfulVerification === true));
  const serialized = JSON.stringify(trace);
  for (const secret of [
    "PRIVATE", "SECRET_TOKEN", "src/private.ts", "npm test", "private-provider", "private-model", "evidence",
  ]) assert.doesNotMatch(serialized, new RegExp(secret, "i"), secret);

  const summary = summarizeTrace(fixtureEntries());
  assert.equal(summary.v, 1);
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

test("offline argument and session parsers fail closed on ambiguity or malformed data", () => {
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
});

test("offline extractor writes mode-safe JSONL and refuses implicit overwrite", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-forge-telemetry-"));
  try {
    const session = join(root, "session.jsonl");
    const output = join(root, "trace.jsonl");
    const lines = [
      JSON.stringify({
        type: "session", version: 3, id: "session", cwd: "/private/project", timestamp: "2026-01-01T00:00:00.000Z",
      }),
      ...fixtureEntries().map((entry) => JSON.stringify(entry)),
    ].join("\n");
    await writeFile(session, `${lines}\n`);
    await runExtraction({ sessionPath: session, outputPath: output, summary: true, force: false });
    const written = await readFile(output, "utf8");
    assert.match(written, /"kind":"summary"/);
    assert.doesNotMatch(written, /private/i);
    assert.equal((await stat(output)).mode & 0o777, 0o600);
    await assert.rejects(
      runExtraction({ sessionPath: session, outputPath: output, summary: true, force: false }),
      /EEXIST/,
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
      /ELOOP|symbolic link/i,
    );
    assert.equal(await readFile(symlinkTarget, "utf8"), "do not overwrite");

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
      /resolves to the input session file/,
    );
    assert.match(await readFile(session, "utf8"), /"type":"session"/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runtime telemetry stores only sanitized custom snapshots", async () => {
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
  assert.equal(snapshots[0].type, "pi-forge.telemetry.v1");
  handlers.get("session_tree")?.({}, context);
  assert.equal(snapshots.length, 2);
  const serialized = JSON.stringify(snapshots[0]);
  assert.doesNotMatch(serialized, /PRIVATE|SECRET|src\/private|npm test|private-provider|private-model/i);

  assert.ok(commands.has("forge-telemetry"));
  await commands.get("forge-telemetry").handler("", context);
  assert.match(notices[0], /local, sanitized/);
  assert.match(notices[0], /excludes prompts/);
});
