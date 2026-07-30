// ABOUTME: Verifies fixed provider fanout, blind synthesis, isolation metadata, and target selection.
// ABOUTME: Protects the four-provider contract without making live model calls.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import secondOpinionExtension, {
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

test("runtime validation accepts an explicitly loaded pi-subagents extension", () => {
  validatePiSubagentsRuntime({
    getCommands: () => [{
      name: "subagents-doctor",
      source: "extension",
      sourceInfo: { path: join(ROOT, "node_modules", "pi-subagents", "index.ts") },
    }],
  } as any);
});

test("command launches the isolated async chain through pi-subagents RPC", async () => {
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
    registerCommand(name: string, options: { handler: typeof commandHandler }) {
      assert.equal(name, "second-opinion");
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
  assert.match(confirmations[0] ?? "", /receives the target again plus all four reports/);
  assert.deepEqual(notifications.at(-1), { message: "Second opinion launched: run-1", level: "info" });
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
