// ABOUTME: Verifies fixed provider fanout, blind synthesis, isolation metadata, and target selection.
// ABOUTME: Protects the four-provider contract without making live model calls.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import secondOpinionExtension, {
  buildSecondOpinionBrief,
  extractLatestAssistantText,
  resolveTarget,
  validateChainDisclosure,
  validatePiSubagentsRuntime,
} from "../extensions/second-opinion.ts";
import { buildSecondOpinionChain } from "../scripts/build-second-opinion.mjs";
import {
  CRITIC_AGENT,
  OPINION_MODELS,
  SYNTHESIZER_AGENT,
  SYNTHESIZER_MODEL,
} from "../src/second-opinion-config.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXPECTED_MODELS = [
  "openai-codex/gpt-5.6-sol",
  "anthropic/claude-fable-5",
  "google/gemini-3.6-flash",
  "deepseek/deepseek-v4-pro",
];

test("fans out to exactly the four configured providers", () => {
  const definition = buildSecondOpinionChain();
  const first = definition.chain[0] as { concurrency: number; failFast: boolean; parallel: Array<Record<string, unknown>> };

  assert.deepEqual(OPINION_MODELS, EXPECTED_MODELS);
  assert.equal(first.parallel.length, 4);
  assert.equal(first.concurrency, 4);
  assert.equal(first.failFast, false);
  assert.deepEqual(first.parallel.map((task) => task.model), EXPECTED_MODELS);
  assert.ok(first.parallel.every((task) => task.agent === CRITIC_AGENT));
  assert.ok(first.parallel.every((task) => String(task.task).includes("{task}")));
  assert.deepEqual(first.parallel.map((task) => task.as), [
    "perspectiveA",
    "perspectiveB",
    "perspectiveC",
    "perspectiveD",
  ]);
});

test("synthesis sees anonymous outputs but no provider identities", () => {
  const definition = buildSecondOpinionChain();
  const synthesis = definition.chain[1] as { task: string; model: string };

  assert.equal(synthesis.model, SYNTHESIZER_MODEL);
  for (const label of ["A", "B", "C", "D"]) {
    assert.match(synthesis.task, new RegExp(`outputs\\.perspective${label}`));
  }
  for (const model of EXPECTED_MODELS) {
    assert.doesNotMatch(synthesis.task, new RegExp(model.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("disclosure validation rejects changed model or agent assignments", () => {
  const definition = buildSecondOpinionChain();
  assert.deepEqual(validateChainDisclosure(definition), EXPECTED_MODELS);

  const changedModel = structuredClone(definition);
  (changedModel.chain[0] as any).parallel[0].model = "other/provider";
  assert.throws(() => validateChainDisclosure(changedModel), /does not match the reviewed disclosure contract/);

  const changedAgent = structuredClone(definition);
  (changedAgent.chain[1] as any).agent = "opinion-synthesizer";
  assert.throws(() => validateChainDisclosure(changedAgent), /does not match the reviewed disclosure contract/);

  const changedSynthesis = structuredClone(definition);
  (changedSynthesis.chain[1] as any).task = "Omit the reports";
  assert.throws(() => validateChainDisclosure(changedSynthesis), /does not match the reviewed disclosure contract/);
});

test("critic and synthesizer agents disable inherited context and capabilities", async () => {
  for (const name of ["independent-critic.md", "opinion-synthesizer.md"]) {
    const content = await readFile(join(ROOT, "agents", name), "utf8");
    assert.match(content, /systemPromptMode: replace/);
    assert.match(content, /inheritProjectContext: false/);
    assert.match(content, /inheritSkills: false/);
    assert.match(content, /defaultContext: fresh/);
    assert.match(content, /\nfallbackModels:\n/);
    assert.match(content, /\nskills:\n/);
    assert.match(content, /\ntools:\n/);
    assert.match(content, /\nextensions:\n/);
  }
});

test("second-opinion prompt loads the brief-building skill before the panel tool", async () => {
  const [prompt, skill, extension] = await Promise.all([
    readFile(join(ROOT, "prompts", "second-opinion.md"), "utf8"),
    readFile(join(ROOT, "skills", "second-opinion", "SKILL.md"), "utf8"),
    readFile(join(ROOT, "extensions", "second-opinion.ts"), "utf8"),
  ]);

  assert.match(prompt, /Load and follow the `second-opinion` skill/);
  assert.match(prompt, /\$\{ARGUMENTS:-/);
  assert.match(skill, /Prepare the panel input before launching any child/);
  assert.match(skill, /show the user a concise preparation note/);
  assert.match(skill, /Call `convene_expert_panel` exactly once/);
  assert.match(skill, /facts and constraints/);
  assert.match(skill, /assumptions, uncertainties, and missing evidence/);
  assert.match(skill, /Do not call `subagent`/);
  assert.match(extension, /registerCommand\("expert-panel"/);
  assert.doesNotMatch(extension, /registerCommand\("second-opinion"/);
});

test("uses explicit arguments before session fallback", () => {
  const entries = [
    { type: "message", message: { role: "assistant", content: [{ type: "text", text: "fallback" }] } },
  ];
  assert.equal(resolveTarget(" explicit target ", entries), "explicit target");
});

test("extracts the latest non-empty assistant text", () => {
  const entries = [
    { type: "message", message: { role: "assistant", content: "older" } },
    { type: "message", message: { role: "user", content: "question" } },
    { type: "message", message: { role: "assistant", content: [{ type: "toolCall" }] } },
    {
      type: "message",
      message: {
        role: "assistant",
        content: [
          { type: "text", text: "latest" },
          { type: "text", text: "answer" },
        ],
      },
    },
  ];
  assert.equal(extractLatestAssistantText(entries), "latest\nanswer");
});

test("rejects an empty target", () => {
  assert.throws(() => resolveTarget("", []), /No target supplied/);
});

test("prepared brief keeps evidence and uncertainty explicit", () => {
  const brief = buildSecondOpinionBrief({
    objective: "Choose whether to preserve this API shape.",
    subject: "Rename the response field from value to result.",
    context: "The API is public and has two documented clients.",
    evidence: "Contract tests currently assert the value field.",
    uncertainties: "Usage by unobserved clients is unknown.",
    reviewQuestions: ["Is the rename breaking?", "Is the rename breaking?", "What migration is proportionate?"],
  });

  assert.match(brief, /# Review objective/);
  assert.match(brief, /# Verified context and constraints/);
  assert.match(brief, /# Assumptions, uncertainties, and evidence gaps/);
  assert.match(brief, /1\. Is the rename breaking\?/);
  assert.match(brief, /2\. What migration is proportionate\?/);
  assert.doesNotMatch(brief, /3\. Is the rename breaking\?/);
  assert.throws(
    () => buildSecondOpinionBrief({
      objective: " ",
      subject: "subject",
      context: "context",
      evidence: "evidence",
      uncertainties: "unknown",
      reviewQuestions: ["question"],
    }),
    /objective is empty/,
  );
  assert.throws(
    () => buildSecondOpinionBrief({
      objective: "!!!!!!!!!!!!!!!!!!!!",
      subject: "Rename the documented response field from value to result.",
      context: "The API is public and currently has two documented clients.",
      evidence: "Contract tests currently assert the value field.",
      uncertainties: "Usage by unobserved external clients is unknown.",
      reviewQuestions: ["First material question?", "Second material question?"],
    }),
    /objective is too short to be substantive/,
  );
  assert.throws(
    () => buildSecondOpinionBrief({
      objective: "xxxxxxxxxxxxxxxxxxxx",
      subject: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      context: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      evidence: "xxxxxxxxxxxxxxxxxxxx",
      uncertainties: "xxxxxxxxxxxxxxxxxxxx",
      reviewQuestions: ["First material question?", "Second material question?"],
    }),
    /objective is a placeholder/,
  );
  const otherwiseValid = {
    objective: "Choose whether to preserve this public API shape.",
    subject: "Rename the documented response field from value to result.",
    context: "The API is public and currently has two documented clients.",
    evidence: "Contract tests currently assert the value field.",
    uncertainties: "Usage by unobserved external clients is unknown.",
  };
  for (const reviewQuestions of [
    ["Is this rename breaking?", "IS THIS RENAME BREAKING!!!"],
    ["Should we preserve API ΟΣ behavior?", "should we preserve api οσ behavior?"],
    ["Should we preserve ★ rendering?", "Should we preserve ★️ rendering?"],
    ["Should we preserve Straße handling?", "Should we preserve STRASSE handling?"],
  ]) {
    assert.throws(
      () => buildSecondOpinionBrief({ ...otherwiseValid, reviewQuestions }),
      /at least two distinct reviewQuestions/,
    );
  }
});

function isolatedContract(input: Record<string, unknown>) {
  const agent = String(input.agent);
  const fileName = agent === CRITIC_AGENT ? "independent-critic.md" : "opinion-synthesizer.md";
  return {
    ok: true,
    contract: {
      agent: { source: "package", filePath: join(ROOT, "agents", fileName) },
      context: "fresh",
      model: `${input.model}:medium`,
      modelCandidates: [`${input.model}:medium`],
      systemPromptMode: "replace",
      inheritProjectContext: false,
      inheritSkills: false,
      skills: { requested: [], resolved: [], missing: [] },
      tools: {
        effectiveAllowlist: ["structured_output"],
        internalTools: ["structured_output"],
        configuredExtensions: [],
        disableAmbientExtensions: true,
      },
      diagnostics: [],
    },
  };
}

function extensionHarness(options: {
  resolveLaunchContract?: (input: Record<string, unknown>) => Promise<any>;
  handleRequest?: (
    payload: Record<string, unknown>,
    reply: (data: unknown, success?: boolean, error?: { code?: string; message?: string }) => void,
  ) => void;
  spawnAckTimeoutMs?: number;
} = {}) {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const emitted: Array<{ name: string; payload: Record<string, unknown> }> = [];
  const commands = new Map<string, (args: string, ctx: any) => Promise<void>>();
  const tools = new Map<string, any>();
  const events = {
    on(name: string, handler: (payload: unknown) => void) {
      const handlers = listeners.get(name) ?? new Set();
      handlers.add(handler);
      listeners.set(name, handlers);
      return () => handlers.delete(handler);
    },
    emit(name: string, payload: Record<string, unknown>) {
      emitted.push({ name, payload });
      if (name !== "subagents:rpc:v1:request") return;
      const reply = (data: unknown, success = true, error?: { code?: string; message?: string }) => {
        const replyName = `subagents:rpc:v1:reply:${payload.requestId}`;
        queueMicrotask(() => {
          for (const handler of listeners.get(replyName) ?? []) {
            handler({ version: 1, requestId: payload.requestId, success, data, error });
          }
        });
      };
      if (options.handleRequest) {
        options.handleRequest(payload, reply);
        return;
      }
      reply(payload.method === "spawn" ? { runId: "run-1" } : { version: 1 });
    },
  };

  secondOpinionExtension({
    events,
    getCommands: () => [{
      name: "subagents-doctor",
      source: "extension",
      sourceInfo: { baseDir: join(ROOT, "node_modules", "pi-subagents") },
    }],
    registerTool(definition: any) {
      tools.set(definition.name, definition);
    },
    registerCommand(name: string, definition: { handler: (args: string, ctx: any) => Promise<void> }) {
      commands.set(name, definition.handler);
    },
  } as any, {
    resolveLaunchContract: options.resolveLaunchContract ?? (async (input) => isolatedContract(input)),
    pingTimeoutMs: 50,
    spawnAckTimeoutMs: options.spawnAckTimeoutMs ?? 50,
  });

  return { commands, emitted, tools };
}

const PREPARED_PARAMS = {
  objective: "Decide whether the public API can change safely.",
  subject: "Rename response.value to response.result.",
  context: "The API is documented and consumed by two known clients.",
  evidence: "Contract tests assert response.value.",
  uncertainties: "Unknown external clients may exist.",
  reviewQuestions: ["Is this rename breaking?", "What migration path is proportionate?"],
};

test("runtime validation accepts an explicitly loaded pi-subagents extension", () => {
  validatePiSubagentsRuntime({
    getCommands: () => [{
      name: "subagents-doctor",
      source: "extension",
      sourceInfo: { path: join(ROOT, "node_modules", "pi-subagents", "index.ts") },
    }],
  } as any);
});

test("expert-panel command launches the isolated async chain immediately", async () => {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const emitted: Array<{ name: string; payload: Record<string, unknown> }> = [];
  let commandHandler: ((args: string, ctx: any) => Promise<void>) | undefined;

  const events = {
    on(name: string, handler: (payload: unknown) => void) {
      const handlers = listeners.get(name) ?? new Set();
      handlers.add(handler);
      listeners.set(name, handlers);
      return () => handlers.delete(handler);
    },
    emit(name: string, payload: Record<string, unknown>) {
      emitted.push({ name, payload });
      if (name !== "subagents:rpc:v1:request") return;
      const replyName = `subagents:rpc:v1:reply:${payload.requestId}`;
      queueMicrotask(() => {
        const data = payload.method === "spawn" ? { runId: "run-1" } : { version: 1 };
        for (const handler of listeners.get(replyName) ?? []) {
          handler({ version: 1, requestId: payload.requestId, success: true, data });
        }
      });
    },
  };

  secondOpinionExtension({
    events,
    getCommands: () => [{
      name: "subagents-doctor",
      source: "extension",
      sourceInfo: { baseDir: join(ROOT, "node_modules", "pi-subagents") },
    }],
    registerTool() {},
    registerCommand(name: string, options: { handler: typeof commandHandler }) {
      assert.equal(name, "expert-panel");
      commandHandler = options.handler;
    },
  } as any, {
    resolveLaunchContract: async (input) => isolatedContract(input),
    pingTimeoutMs: 50,
    spawnAckTimeoutMs: 50,
  });

  const notifications: Array<{ message: string; level?: string }> = [];
  const confirmations: string[] = [];
  await commandHandler?.("explicit artifact", {
    hasUI: true,
    cwd: ROOT,
    sessionManager: { getBranch: () => [], getSessionFile: () => null },
    ui: {
      confirm: async (_title: string, message: string) => {
        confirmations.push(message);
        return true;
      },
      notify: (message: string, level?: string) => notifications.push({ message, level }),
    },
  });

  assert.equal(emitted.length, 2);
  assert.equal(emitted[0]?.payload.method, "ping");
  const request = emitted[1];
  assert.equal(request.name, "subagents:rpc:v1:request");
  assert.equal(request.payload.method, "spawn");
  const params = request.payload.params as Record<string, unknown>;
  assert.equal(params.task, "explicit artifact");
  assert.equal(params.context, "fresh");
  assert.equal(params.async, true);
  assert.equal(params.artifacts, false);
  assert.ok(Array.isArray(params.chain));
  assert.match(confirmations[0] ?? "", /anthropic\/claude-fable-5/);
  assert.match(confirmations[0] ?? "", /receives the payload again plus all four reports/);
  assert.deepEqual(notifications.at(-1), { message: "Expert panel launched: run-1", level: "info" });
});

test("prepared-brief tool formats context before launching the same chain", async () => {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const emitted: Array<{ name: string; payload: Record<string, unknown> }> = [];
  let tool: any;
  const events = {
    on(name: string, handler: (payload: unknown) => void) {
      const handlers = listeners.get(name) ?? new Set();
      handlers.add(handler);
      listeners.set(name, handlers);
      return () => handlers.delete(handler);
    },
    emit(name: string, payload: Record<string, unknown>) {
      emitted.push({ name, payload });
      if (name !== "subagents:rpc:v1:request") return;
      const replyName = `subagents:rpc:v1:reply:${payload.requestId}`;
      queueMicrotask(() => {
        const data = payload.method === "spawn" ? { runId: "prepared-run" } : { version: 1 };
        for (const handler of listeners.get(replyName) ?? []) {
          handler({ version: 1, requestId: payload.requestId, success: true, data });
        }
      });
    },
  };

  secondOpinionExtension({
    events,
    getCommands: () => [{
      name: "subagents-doctor",
      source: "extension",
      sourceInfo: { baseDir: join(ROOT, "node_modules", "pi-subagents") },
    }],
    registerTool(definition: any) {
      tool = definition;
    },
    registerCommand() {},
  } as any, {
    resolveLaunchContract: async (input) => isolatedContract(input),
    pingTimeoutMs: 50,
    spawnAckTimeoutMs: 50,
  });

  assert.equal(tool.name, "convene_expert_panel");
  const confirmations: string[] = [];
  const reviewedPayloads: string[] = [];
  const result = await tool.execute("tool-1", {
    objective: "Decide whether the public API can change safely.",
    subject: "Rename response.value to response.result.",
    context: "The API is documented and consumed by two known clients.",
    evidence: "Contract tests assert response.value.",
    uncertainties: "Unknown external clients may exist.",
    reviewQuestions: ["Is this breaking?", "What migration path is proportionate?"],
  }, undefined, undefined, {
    hasUI: true,
    cwd: ROOT,
    sessionManager: { getSessionFile: () => null },
    ui: {
      editor: async (_title: string, initial: string) => {
        reviewedPayloads.push(initial);
        return initial;
      },
      confirm: async (_title: string, message: string) => {
        confirmations.push(message);
        return true;
      },
    },
  });

  assert.equal(emitted.length, 2);
  const spawn = emitted[1]?.payload;
  assert.equal(spawn?.method, "spawn");
  const params = spawn?.params as Record<string, unknown>;
  const task = String(params.task);
  assert.equal(reviewedPayloads[0], task);
  assert.match(task, /# Review objective/);
  assert.match(task, /Decide whether the public API can change safely/);
  assert.match(task, /Rename response\.value to response\.result/);
  assert.match(task, /consumed by two known clients/);
  assert.match(task, /Contract tests assert response\.value/);
  assert.match(task, /Unknown external clients may exist/);
  assert.match(task, /What migration path is proportionate\?/);
  assert.match(confirmations[0] ?? "", /exact reviewed payload/);
  assert.match(confirmations[0] ?? "", /SHA-256 [a-f0-9]{64}/);
  assert.equal(result.terminate, true);
  assert.deepEqual(result.details, {
    status: "launched",
    runId: "prepared-run",
    targetChars: task.length,
  });
});

test("prepared tool cancellation and headless mode emit no spawn", async () => {
  const cancelled = extensionHarness();
  const cancelledTool = cancelled.tools.get("convene_expert_panel");
  const cancelledResult = await cancelledTool.execute(
    "cancelled",
    PREPARED_PARAMS,
    undefined,
    undefined,
    {
      hasUI: true,
      cwd: ROOT,
      sessionManager: { getSessionFile: () => null },
      ui: { editor: async () => undefined },
    },
  );
  assert.equal(cancelledResult.terminate, true);
  assert.equal(cancelledResult.details.status, "cancelled");
  assert.equal(cancelledResult.details.targetChars, 0);
  assert.equal(cancelled.emitted.length, 0);

  const headless = extensionHarness();
  const headlessTool = headless.tools.get("convene_expert_panel");
  await assert.rejects(
    () => headlessTool.execute(
      "headless",
      PREPARED_PARAMS,
      undefined,
      undefined,
      {
        hasUI: false,
        cwd: ROOT,
        sessionManager: { getSessionFile: () => null },
        ui: {},
      },
    ),
    /requires interactive review/,
  );
  assert.equal(headless.emitted.length, 0);

  const declined = extensionHarness();
  const declinedTool = declined.tools.get("convene_expert_panel");
  const declinedResult = await declinedTool.execute(
    "declined",
    PREPARED_PARAMS,
    undefined,
    undefined,
    {
      hasUI: true,
      cwd: ROOT,
      sessionManager: { getSessionFile: () => null },
      ui: {
        editor: async (_title: string, initial: string) => initial,
        confirm: async () => false,
      },
    },
  );
  assert.equal(declinedResult.details.status, "cancelled");
  assert.equal(declined.emitted.filter((event) => event.payload.method === "spawn").length, 0);
});

test("prepared tool propagates cancellation and treats post-spawn abort as unknown", async () => {
  const preAborted = extensionHarness();
  const preAbortedController = new AbortController();
  preAbortedController.abort();
  let editorOpened = false;
  const preAbortedResult = await preAborted.tools.get("convene_expert_panel").execute(
    "pre-aborted",
    PREPARED_PARAMS,
    preAbortedController.signal,
    undefined,
    {
      hasUI: true,
      cwd: ROOT,
      sessionManager: { getSessionFile: () => null },
      ui: {
        editor: async () => {
          editorOpened = true;
          return "should not open";
        },
      },
    },
  );
  assert.equal(editorOpened, false);
  assert.equal(preAbortedResult.details.status, "cancelled");
  assert.equal(preAborted.emitted.length, 0);

  const postSpawnController = new AbortController();
  const postSpawn = extensionHarness({
    handleRequest(payload, reply) {
      if (payload.method === "ping") {
        reply({ version: 1 });
        return;
      }
      if (payload.method === "spawn") postSpawnController.abort();
    },
  });
  const postSpawnResult = await postSpawn.tools.get("convene_expert_panel").execute(
    "post-spawn",
    PREPARED_PARAMS,
    postSpawnController.signal,
    undefined,
    {
      hasUI: true,
      cwd: ROOT,
      sessionManager: { getSessionFile: () => null },
      ui: {
        editor: async (_title: string, initial: string) => initial,
        confirm: async () => true,
      },
    },
  );
  assert.equal(postSpawnResult.terminate, true);
  assert.equal(postSpawnResult.details.status, "unknown");
  assert.match(postSpawnResult.content[0].text, /may already be active; do not retry/);
  assert.equal(postSpawn.emitted.filter((event) => event.payload.method === "spawn").length, 1);

  const timedOut = extensionHarness({
    spawnAckTimeoutMs: 5,
    handleRequest(payload, reply) {
      if (payload.method === "ping") reply({ version: 1 });
    },
  });
  const timedOutResult = await timedOut.tools.get("convene_expert_panel").execute(
    "timed-out",
    PREPARED_PARAMS,
    undefined,
    undefined,
    {
      hasUI: true,
      cwd: ROOT,
      sessionManager: { getSessionFile: () => null },
      ui: {
        editor: async (_title: string, initial: string) => initial,
        confirm: async () => true,
      },
    },
  );
  assert.equal(timedOutResult.terminate, true);
  assert.equal(timedOutResult.details.status, "unknown");
  assert.equal(timedOut.emitted.filter((event) => event.payload.method === "spawn").length, 1);
});

test("prepared tool refuses spawn when the consent-time preflight changes", async () => {
  let contractChecks = 0;
  const harness = extensionHarness({
    async resolveLaunchContract(input) {
      contractChecks += 1;
      if (contractChecks === 6) return { ok: false, message: "contract changed after consent" };
      return isolatedContract(input);
    },
  });

  await assert.rejects(
    () => harness.tools.get("convene_expert_panel").execute(
      "changed-contract",
      PREPARED_PARAMS,
      undefined,
      undefined,
      {
        hasUI: true,
        cwd: ROOT,
        sessionManager: { getSessionFile: () => null },
        ui: {
          editor: async (_title: string, initial: string) => initial,
          confirm: async () => true,
        },
      },
    ),
    /contract changed after consent/,
  );
  assert.equal(harness.emitted.filter((event) => event.payload.method === "spawn").length, 0);
});

test("preflight rejects an undisclosed fallback model", async () => {
  const definition = buildSecondOpinionChain();
  await assert.rejects(
    () => import("../extensions/second-opinion.ts").then(({ preflightSecondOpinion }) => preflightSecondOpinion(
      definition,
      { cwd: ROOT, sessionManager: { getSessionFile: () => null } } as any,
      async (input) => {
        const result = isolatedContract(input);
        result.contract.modelCandidates.push("undisclosed/provider:medium");
        return result;
      },
    )),
    /isolation preflight rejected/,
  );
});

test("preflight rejects a shadowed isolation agent", async () => {
  const definition = buildSecondOpinionChain();
  await assert.rejects(
    () => import("../extensions/second-opinion.ts").then(({ preflightSecondOpinion }) => preflightSecondOpinion(
      definition,
      { cwd: ROOT, sessionManager: { getSessionFile: () => null } } as any,
      async (input) => {
        const result = isolatedContract(input);
        result.contract.agent.filePath = join(ROOT, "agents", "opinion-synthesizer.md");
        return result;
      },
    )),
    /isolation preflight rejected/,
  );
});

test("spawn acknowledgement timeout warns that launch state is unknown", async () => {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  let commandHandler: ((args: string, ctx: any) => Promise<void>) | undefined;
  const notifications: Array<{ message: string; level?: string }> = [];
  const events = {
    on(name: string, handler: (payload: unknown) => void) {
      const handlers = listeners.get(name) ?? new Set();
      handlers.add(handler);
      listeners.set(name, handlers);
      return () => handlers.delete(handler);
    },
    emit(name: string, payload: Record<string, unknown>) {
      if (name !== "subagents:rpc:v1:request" || payload.method !== "ping") return;
      queueMicrotask(() => {
        const replyName = `subagents:rpc:v1:reply:${payload.requestId}`;
        for (const handler of listeners.get(replyName) ?? []) {
          handler({ success: true, data: { version: 1 } });
        }
      });
    },
  };
  secondOpinionExtension({
    events,
    getCommands: () => [{
      name: "subagents-doctor",
      source: "extension",
      sourceInfo: { baseDir: join(ROOT, "node_modules", "pi-subagents") },
    }],
    registerTool() {},
    registerCommand(_name: string, options: { handler: typeof commandHandler }) {
      commandHandler = options.handler;
    },
  } as any, {
    resolveLaunchContract: async (input) => isolatedContract(input),
    pingTimeoutMs: 50,
    spawnAckTimeoutMs: 5,
  });

  await commandHandler?.("artifact", {
    hasUI: true,
    cwd: ROOT,
    sessionManager: { getBranch: () => [], getSessionFile: () => null },
    ui: {
      confirm: async () => true,
      notify: (message: string, level?: string) => notifications.push({ message, level }),
    },
  });

  assert.equal(notifications.at(-1)?.level, "warning");
  assert.match(notifications.at(-1)?.message ?? "", /may already be active; do not retry/);
});

test("package-qualified runtime names protect isolation agents from unqualified shadowing", () => {
  assert.equal(CRITIC_AGENT, "pi-forge.independent-critic");
  assert.equal(SYNTHESIZER_AGENT, "pi-forge.opinion-synthesizer");
  const definition = buildSecondOpinionChain();
  const first = definition.chain[0] as any;
  const synthesis = definition.chain[1] as any;
  assert.ok(first.parallel.every((task: any) => task.agent.startsWith("pi-forge.")));
  assert.ok(synthesis.agent.startsWith("pi-forge."));
});
