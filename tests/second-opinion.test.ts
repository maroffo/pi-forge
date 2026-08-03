// ABOUTME: Verifies fixed provider fanout, blind synthesis, isolation metadata, and target selection.
// ABOUTME: Protects the four-provider contract without making live model calls.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import secondOpinionExtension, {
  automaticPanelPayloadRejection,
  buildSecondOpinionBrief,
  extractLatestAssistantText,
  isCompleteSocraticRecommendation,
  parseAutoPanelCommand,
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
  const roleTasks = first.parallel.map((task) => String(task.task));
  assert.ok(roleTasks.every((task) => task === roleTasks[0]));
  for (const requiredMove of [
    "Steelman",
    "Weakest dependency",
    "Concrete counterexample",
    "Falsification test",
    "Surviving judgment",
  ]) assert.ok(roleTasks.every((task) => task.includes(requiredMove)));
  assert.ok(roleTasks.every((task) => task.includes("Do not manufacture dissent")));
  assert.ok(roleTasks.every((task) => task.includes("verdict accept") && task.includes("empty findings array")));
  const requiredFields = [
    "verdict",
    "summary",
    "steelman",
    "weakestDependency",
    "counterexample",
    "falsificationTest",
    "survivingJudgment",
    "findings",
    "uncertainties",
  ];
  for (const task of first.parallel as any[]) {
    assert.deepEqual(task.outputSchema.required, requiredFields);
    assert.equal(task.outputSchema.properties.findings.minItems, undefined);
    assert.ok(task.outputSchema.properties.verdict.enum.includes("accept"));
  }
  assert.deepEqual(first.parallel.map((task) => task.as), [
    "perspectiveA",
    "perspectiveB",
    "perspectiveC",
    "perspectiveD",
  ]);
});

test("synthesis sees anonymous outputs but no provider identities", () => {
  const definition = buildSecondOpinionChain();
  const synthesis = definition.chain[1] as { task: string; model: string; outputSchema: any };

  assert.equal(synthesis.model, SYNTHESIZER_MODEL);
  assert.ok(synthesis.outputSchema.required.includes("steelman"));
  assert.equal(synthesis.outputSchema.properties.priorityFindings.minItems, undefined);
  assert.match(synthesis.task, /strongest supportable steelman/);
  assert.match(synthesis.task, /only when it survives/);
  assert.match(synthesis.task, /unsupported, performative, duplicate, or missing-context attacks/);
  assert.match(synthesis.task, /majority vote is not evidence/);
  assert.match(synthesis.task, /verdict accept with an empty priorityFindings array is valid/);
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
  assert.match(skill, /strongest supportable version/);
  assert.match(skill, /weakest material dependency/);
  assert.match(skill, /counterexamples, falsification conditions/);
  assert.match(skill, /adversarial but not oppositional by quota/);
  assert.match(skill, /Do not call `subagent`/);
  assert.match(extension, /name: "convene_expert_panel"/);
  assert.match(extension, /name: "convene_opt_in_expert_panel"/);
  assert.match(extension, /registerCommand\("auto-panel"/);
  assert.match(extension, /registerCommand\("expert-panel"/);
  assert.doesNotMatch(extension, /registerCommand\("second-opinion"/);
});

test("panel docs distinguish preparation from guarded disclosure and reject proof claims", async () => {
  const docs = await readFile(join(ROOT, "docs", "second-opinion.md"), "utf8");

  assert.match(docs, /immediately enters the guarded preflight/);
  assert.match(docs, /does not bypass provider confirmation/);
  assert.match(docs, /Both paths require the digest-bound confirmation before launch/);
  assert.match(docs, /does not independently verify facts or prove correctness or causality/);
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
  loadChain?: () => any;
} = {}) {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const emitted: Array<{ name: string; payload: Record<string, unknown> }> = [];
  const commands = new Map<string, (args: string, ctx: any) => Promise<void>>();
  const tools = new Map<string, any>();
  const lifecycleHandlers = new Map<string, (...args: any[]) => any>();
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
    on(name: string, handler: (...args: any[]) => any) {
      lifecycleHandlers.set(name, handler);
    },
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
    loadChain: options.loadChain,
  });

  return { commands, emitted, lifecycleHandlers, tools };
}

const PREPARED_PARAMS = {
  objective: "Decide whether the public API can change safely.",
  subject: "Rename response.value to response.result.",
  context: "The API is documented and consumed by two known clients.",
  evidence: "Contract tests assert response.value.",
  uncertainties: "Unknown external clients may exist.",
  reviewQuestions: ["Is this rename breaking?", "What migration path is proportionate?"],
};

const AUTOMATIC_PARAMS = {
  ...PREPARED_PARAMS,
  classification: "sanitized",
};

function emitSocraticRecommendation(
  harness: ReturnType<typeof extensionHarness>,
  toolCallId = "socratic-recommendation",
) {
  const input = {
    agent: "pi-forge.socratic-analyst",
    task: "Analyze a self-contained decision artifact.",
    model: "openai-codex/gpt-5.6-sol",
    context: "fresh",
    artifacts: false,
    acceptance: false,
    agentContract: { version: 1 },
  };
  harness.lifecycleHandlers.get("tool_result")?.({
    toolName: "subagent",
    toolCallId,
    input,
    isError: false,
    content: [{
      type: "text",
      text: "## Status\ncomplete\n\n## Second Opinion\nrecommend: unresolved high-impact assumption",
    }],
  });
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

test("extension snapshots the reviewed chain when it registers", async () => {
  let activeDefinition = buildSecondOpinionChain();
  let registeredSnapshot: any;
  let loads = 0;
  const harness = extensionHarness({
    loadChain() {
      loads += 1;
      registeredSnapshot = structuredClone(activeDefinition);
      return registeredSnapshot;
    },
  });
  assert.equal(loads, 1);
  assert.equal(Object.isFrozen(registeredSnapshot), true);
  assert.equal(Object.isFrozen(registeredSnapshot.chain[0].parallel[0]), true);
  assert.throws(() => {
    registeredSnapshot.chain[0].parallel[0].model = "mutated/provider";
  }, TypeError);

  activeDefinition = structuredClone(activeDefinition);
  (activeDefinition.chain[0] as any).parallel[0].model = "changed/provider";
  let confirmationReached = false;
  const notifications: Array<{ message: string; level?: string }> = [];
  await harness.commands.get("expert-panel")?.("artifact captured after registration", {
    hasUI: true,
    cwd: ROOT,
    sessionManager: { getBranch: () => [], getSessionFile: () => null },
    ui: {
      confirm: async () => {
        confirmationReached = true;
        return false;
      },
      notify: (message: string, level?: string) => notifications.push({ message, level }),
    },
  });

  assert.equal(loads, 1);
  assert.equal(confirmationReached, true);
  assert.deepEqual(notifications.at(-1), {
    message: "Expert panel cancelled before disclosure.",
    level: "info",
  });
  assert.equal(harness.emitted.filter((event) => event.payload.method === "spawn").length, 0);
});

test("automatic panel command parser and payload scanner fail closed", () => {
  assert.equal(parseAutoPanelCommand(""), "status");
  assert.equal(parseAutoPanelCommand(" STATUS "), "status");
  assert.equal(parseAutoPanelCommand("enable"), "enable");
  assert.equal(parseAutoPanelCommand("disable"), "disable");
  for (const invalid of ["enable now", "on", "disable extra", "status extra"]) {
    assert.throws(() => parseAutoPanelCommand(invalid), /Usage: \/auto-panel/);
  }

  assert.equal(automaticPanelPayloadRejection("A bounded sanitized design artifact."), undefined);
  assert.equal(isCompleteSocraticRecommendation("## Status\ncomplete\n## Second Opinion\nrecommend: review"), true);
  assert.equal(isCompleteSocraticRecommendation("## Status\ncomplete\n## Second Opinion\ndo-not-recommend"), false);
  assert.equal(isCompleteSocraticRecommendation("## Status\nneeds-evidence\n## Second Opinion\nrecommend"), false);
  for (const [payload, label] of [
    ["-----BEGIN PRIVATE KEY-----", "private-key material"],
    ["password=supersecretvalue", "credential-like assignment"],
    ["token ghp_abcdefghijklmnopqrstuvwxyz", "provider-token shape"],
    ["Contact person@example.com", "personal-email shape"],
    [`Read ${["", "Users", "example", "private", "source.ts"].join("/")}`, "private absolute path"],
  ]) {
    const rejection = automaticPanelPayloadRejection(payload);
    assert.match(rejection ?? "", new RegExp(label));
    assert.doesNotMatch(rejection ?? "", new RegExp(payload.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("automatic panel is default-off, explicitly enabled, one-shot, and reset by session start", async () => {
  const harness = extensionHarness();
  const command = harness.commands.get("auto-panel");
  const tool = harness.tools.get("convene_opt_in_expert_panel");
  assert.ok(command);
  assert.ok(tool);
  assert.equal(tool.parameters.properties.classification.const, "sanitized");
  assert.equal(tool.parameters.additionalProperties, false);

  const notifications: Array<{ message: string; level?: string }> = [];
  const confirmations: string[] = [];
  const commandContext = {
    hasUI: true,
    ui: {
      confirm: async (_title: string, message: string) => {
        confirmations.push(message);
        return true;
      },
      notify: (message: string, level?: string) => notifications.push({ message, level }),
    },
  };
  const toolContext = {
    hasUI: true,
    cwd: ROOT,
    sessionManager: { getSessionFile: () => null },
    ui: { notify: (message: string, level?: string) => notifications.push({ message, level }) },
  };

  const disabled = await tool.execute("disabled", AUTOMATIC_PARAMS, undefined, undefined, toolContext);
  assert.equal(disabled.details.status, "disabled");
  assert.equal(harness.emitted.length, 0);

  await command!("enable", commandContext);
  assert.match(confirmations[0] ?? "", /future payload labelled sanitized/);
  assert.match(confirmations[0] ?? "", /five model calls total/);
  assert.match(confirmations[0] ?? "", /no per-run editor or confirmation/);
  assert.match(confirmations[0] ?? "", /passing does not prove sanitization/);
  assert.match(confirmations[0] ?? "", /cannot stop calls after spawn/);

  const missingTrigger = await tool.execute("missing-trigger", AUTOMATIC_PARAMS, undefined, undefined, toolContext);
  assert.deepEqual(missingTrigger.details, {
    status: "rejected",
    reason: "missing-socratic-recommendation",
  });
  assert.equal(harness.emitted.length, 0);
  emitSocraticRecommendation(harness);

  const launched = await tool.execute("launched", AUTOMATIC_PARAMS, undefined, undefined, toolContext);
  assert.equal(launched.details.status, "launched");
  assert.equal(launched.details.automaticGrant, "consumed");
  assert.match(launched.details.recommendationReceipt, /^[a-f0-9]{64}$/);
  assert.match(launched.details.automaticBinding, /^[a-f0-9]{64}$/);
  assert.equal(harness.emitted.filter((event) => event.payload.method === "spawn").length, 1);
  assert.deepEqual(
    (harness.emitted.find((event) => event.payload.method === "spawn")?.payload.params as any).chain,
    buildSecondOpinionChain().chain,
  );
  assert.match(notifications.find((entry) => /one-shot grant consumed/.test(entry.message))?.message ?? "", /SHA-256 [a-f0-9]{64}/);

  const consumed = await tool.execute("consumed", AUTOMATIC_PARAMS, undefined, undefined, toolContext);
  assert.equal(consumed.details.status, "consumed");
  assert.equal(harness.emitted.filter((event) => event.payload.method === "spawn").length, 1);

  await command!("enable", commandContext);
  harness.lifecycleHandlers.get("session_start")?.({}, {});
  const reset = await tool.execute("reset", AUTOMATIC_PARAMS, undefined, undefined, toolContext);
  assert.equal(reset.details.status, "disabled");
  assert.equal(harness.emitted.filter((event) => event.payload.method === "spawn").length, 1);

  await command!("enable", commandContext);
  await command!("status", commandContext);
  assert.match(notifications.at(-1)?.message ?? "", /enabled \(awaiting direct Socratic recommendation\)/);
  await command!("disable", commandContext);
  assert.match(notifications.at(-1)?.message ?? "", /disabled for this session/);
  const revoked = await tool.execute("revoked", AUTOMATIC_PARAMS, undefined, undefined, toolContext);
  assert.equal(revoked.details.status, "disabled");
  assert.equal(harness.emitted.filter((event) => event.payload.method === "spawn").length, 1);
});

test("automatic panel readiness is fresh to the enabled grant and exact protected result", async () => {
  const harness = extensionHarness();
  const command = harness.commands.get("auto-panel")!;
  const tool = harness.tools.get("convene_opt_in_expert_panel");
  const ctx = {
    hasUI: true,
    cwd: ROOT,
    sessionManager: { getSessionFile: () => null },
    ui: { confirm: async () => true, notify() {} },
  };

  emitSocraticRecommendation(harness, "before-enable");
  await command("enable", ctx);
  assert.equal(
    (await tool.execute("pre-consent-result", AUTOMATIC_PARAMS, undefined, undefined, ctx)).details.reason,
    "missing-socratic-recommendation",
  );

  for (const [toolCallId, input, content, isError] of [
    ["wrong-tool", {
      agent: "pi-forge.socratic-analyst",
      task: "Analyze.", model: "openai-codex/gpt-5.6-sol", context: "fresh",
      artifacts: false, acceptance: false, agentContract: { version: 1 },
    }, "## Status\ncomplete\n## Second Opinion\nrecommend", false],
    ["unqualified", {
      agent: "socratic-analyst",
      task: "Analyze.", model: "openai-codex/gpt-5.6-sol", context: "fresh",
      artifacts: false, acceptance: false, agentContract: { version: 1 },
    }, "## Status\ncomplete\n## Second Opinion\nrecommend", false],
    ["extra-field", {
      agent: "pi-forge.socratic-analyst",
      task: "Analyze.", model: "openai-codex/gpt-5.6-sol", context: "fresh",
      artifacts: false, acceptance: false, agentContract: { version: 1 }, skill: false,
    }, "## Status\ncomplete\n## Second Opinion\nrecommend", false],
    ["prose-only", {
      agent: "pi-forge.socratic-analyst",
      task: "Analyze.", model: "openai-codex/gpt-5.6-sol", context: "fresh",
      artifacts: false, acceptance: false, agentContract: { version: 1 },
    }, "The analysis is complete but does not recommend automatic review.", false],
    ["error-result", {
      agent: "pi-forge.socratic-analyst",
      task: "Analyze.", model: "openai-codex/gpt-5.6-sol", context: "fresh",
      artifacts: false, acceptance: false, agentContract: { version: 1 },
    }, "## Status\ncomplete\n## Second Opinion\nrecommend", true],
  ] as const) {
    harness.lifecycleHandlers.get("tool_result")?.({
      toolName: toolCallId === "wrong-tool" ? "worker" : "subagent",
      toolCallId,
      input,
      content: [{ type: "text", text: content }],
      isError,
    });
    assert.equal(
      (await tool.execute(`reject-${toolCallId}`, AUTOMATIC_PARAMS, undefined, undefined, ctx)).details.reason,
      "missing-socratic-recommendation",
    );
  }

  emitSocraticRecommendation(harness, "ready-before-reset");
  harness.lifecycleHandlers.get("session_start")?.({}, {});
  await command("enable", ctx);
  assert.equal(
    (await tool.execute("reset-requires-fresh", AUTOMATIC_PARAMS, undefined, undefined, ctx)).details.reason,
    "missing-socratic-recommendation",
  );

  emitSocraticRecommendation(harness, "ready-before-new-input");
  harness.lifecycleHandlers.get("input")?.({ text: "new user turn" }, {});
  assert.equal(
    (await tool.execute("new-input-clears", AUTOMATIC_PARAMS, undefined, undefined, ctx)).details.reason,
    "missing-socratic-recommendation",
  );

  emitSocraticRecommendation(harness, "stale-positive");
  harness.lifecycleHandlers.get("tool_result")?.({
    toolName: "subagent",
    toolCallId: "later-do-not-recommend",
    input: {
      agent: "pi-forge.socratic-analyst",
      task: "Analyze again.",
      model: "openai-codex/gpt-5.6-sol",
      context: "fresh",
      artifacts: false,
      acceptance: false,
      agentContract: { version: 1 },
    },
    isError: false,
    content: [{ type: "text", text: "## Status\ncomplete\n## Second Opinion\ndo-not-recommend" }],
  });
  assert.equal(
    (await tool.execute("later-negative-clears", AUTOMATIC_PARAMS, undefined, undefined, ctx)).details.reason,
    "missing-socratic-recommendation",
  );
  assert.equal(harness.emitted.length, 0);
});

test("automatic panel decline, invalid command, headless call, and payload rejection emit no spawn", async () => {
  const harness = extensionHarness();
  const command = harness.commands.get("auto-panel")!;
  const tool = harness.tools.get("convene_opt_in_expert_panel");
  const notifications: Array<{ message: string; level?: string }> = [];
  let confirmation = false;
  const commandContext = {
    hasUI: true,
    ui: {
      confirm: async () => confirmation,
      notify: (message: string, level?: string) => notifications.push({ message, level }),
    },
  };
  const toolContext = {
    hasUI: true,
    cwd: ROOT,
    sessionManager: { getSessionFile: () => null },
    ui: { notify: (message: string, level?: string) => notifications.push({ message, level }) },
  };

  await command("enable extra", commandContext);
  assert.match(notifications.at(-1)?.message ?? "", /Usage: \/auto-panel/);
  await command("enable", commandContext);
  assert.match(notifications.at(-1)?.message ?? "", /remains disabled/);
  assert.equal((await tool.execute("declined", AUTOMATIC_PARAMS, undefined, undefined, toolContext)).details.status, "disabled");

  confirmation = true;
  await command("enable", commandContext);
  emitSocraticRecommendation(harness, "headless-recommendation");
  const headless = await tool.execute("headless", AUTOMATIC_PARAMS, undefined, undefined, { ...toolContext, hasUI: false });
  assert.deepEqual(headless.details, {
    status: "rejected",
    reason: "headless",
    recommendationReceipt: "consumed",
  });
  assert.equal(harness.emitted.length, 0);

  emitSocraticRecommendation(harness, "payload-recommendation");
  const rejected = await tool.execute("rejected", {
    ...AUTOMATIC_PARAMS,
    evidence: "Observed credential assignment password=supersecretvalue in the proposed evidence.",
  }, undefined, undefined, toolContext);
  assert.deepEqual(rejected.details, {
    status: "rejected",
    reason: "payload-policy",
    recommendationReceipt: "consumed",
  });
  assert.doesNotMatch(rejected.content[0].text, /supersecretvalue/);
  assert.match(rejected.content[0].text, /new protected Socratic recommendation is required/);
  assert.equal(harness.emitted.length, 0);

  const missingAfterRejection = await tool.execute("missing-after-rejection", AUTOMATIC_PARAMS, undefined, undefined, toolContext);
  assert.equal(missingAfterRejection.details.reason, "missing-socratic-recommendation");
  emitSocraticRecommendation(harness, "corrected-recommendation");
  const launched = await tool.execute("after-rejection", AUTOMATIC_PARAMS, undefined, undefined, toolContext);
  assert.equal(launched.details.status, "launched");
  assert.equal(harness.emitted.filter((event) => event.payload.method === "spawn").length, 1);
});

test("automatic panel consumes synchronously before a concurrent second call", async () => {
  let releaseFirstPreflight!: () => void;
  let markFirstPreflight!: () => void;
  const firstPreflightEntered = new Promise<void>((resolve) => { markFirstPreflight = resolve; });
  const firstPreflightGate = new Promise<void>((resolve) => { releaseFirstPreflight = resolve; });
  let resolverCalls = 0;
  const harness = extensionHarness({
    async resolveLaunchContract(input) {
      resolverCalls += 1;
      if (resolverCalls === 1) {
        markFirstPreflight();
        await firstPreflightGate;
      }
      return isolatedContract(input);
    },
  });
  const command = harness.commands.get("auto-panel")!;
  const tool = harness.tools.get("convene_opt_in_expert_panel");
  const ctx = {
    hasUI: true,
    cwd: ROOT,
    sessionManager: { getSessionFile: () => null },
    ui: { confirm: async () => true, notify() {} },
  };
  await command("enable", ctx);
  emitSocraticRecommendation(harness);

  const first = tool.execute("first", AUTOMATIC_PARAMS, undefined, undefined, ctx);
  await firstPreflightEntered;
  const second = await tool.execute("second", AUTOMATIC_PARAMS, undefined, undefined, ctx);
  assert.equal(second.details.status, "consumed");
  assert.equal(harness.emitted.filter((event) => event.payload.method === "spawn").length, 0);
  releaseFirstPreflight();
  const firstResult = await first;
  assert.equal(firstResult.details.status, "launched");
  assert.equal(harness.emitted.filter((event) => event.payload.method === "spawn").length, 1);
});

test("automatic panel consumes standing consent before an uncertain launch", async () => {
  const harness = extensionHarness({
    spawnAckTimeoutMs: 5,
    handleRequest(payload, reply) {
      if (payload.method === "ping") reply({ version: 1 });
    },
  });
  const command = harness.commands.get("auto-panel")!;
  const tool = harness.tools.get("convene_opt_in_expert_panel");
  const ctx = {
    hasUI: true,
    cwd: ROOT,
    sessionManager: { getSessionFile: () => null },
    ui: {
      confirm: async () => true,
      notify() {},
    },
  };
  await command("enable", ctx);
  emitSocraticRecommendation(harness);
  const unknown = await tool.execute("unknown", AUTOMATIC_PARAMS, undefined, undefined, ctx);
  assert.equal(unknown.details.status, "unknown");
  assert.equal(unknown.details.automaticGrant, "consumed");
  const consumed = await tool.execute("again", AUTOMATIC_PARAMS, undefined, undefined, ctx);
  assert.equal(consumed.details.status, "consumed");
  assert.equal(harness.emitted.filter((event) => event.payload.method === "spawn").length, 1);
});

test("automatic panel confirmation failure leaves no standing grant", async () => {
  const harness = extensionHarness();
  const command = harness.commands.get("auto-panel")!;
  const tool = harness.tools.get("convene_opt_in_expert_panel");
  const notifications: string[] = [];
  const ctx = {
    hasUI: true,
    cwd: ROOT,
    sessionManager: { getSessionFile: () => null },
    ui: {
      confirm: async () => { throw new Error("confirmation fixture aborted"); },
      notify: (message: string) => notifications.push(message),
    },
  };
  await command("enable", ctx);
  assert.match(notifications.at(-1) ?? "", /confirmation fixture aborted/);
  emitSocraticRecommendation(harness);
  const disabled = await tool.execute("after-confirmation-failure", AUTOMATIC_PARAMS, undefined, undefined, ctx);
  assert.equal(disabled.details.status, "disabled");
  assert.equal(harness.emitted.length, 0);
});

test("automatic panel consumes standing consent before a preflight failure", async () => {
  const harness = extensionHarness({
    resolveLaunchContract: async () => ({ ok: false, message: "fixture preflight failure" }),
  });
  const command = harness.commands.get("auto-panel")!;
  const tool = harness.tools.get("convene_opt_in_expert_panel");
  const ctx = {
    hasUI: true,
    cwd: ROOT,
    sessionManager: { getSessionFile: () => null },
    ui: { confirm: async () => true, notify() {} },
  };
  await command("enable", ctx);
  emitSocraticRecommendation(harness);
  await assert.rejects(
    () => tool.execute("preflight-failure", AUTOMATIC_PARAMS, undefined, undefined, ctx),
    /fixture preflight failure/,
  );
  const consumed = await tool.execute("after-failure", AUTOMATIC_PARAMS, undefined, undefined, ctx);
  assert.equal(consumed.details.status, "consumed");
  assert.equal(harness.emitted.length, 0);
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
    on() {},
    getCommands: () => [{
      name: "subagents-doctor",
      source: "extension",
      sourceInfo: { baseDir: join(ROOT, "node_modules", "pi-subagents") },
    }],
    registerTool() {},
    registerCommand(name: string, options: { handler: typeof commandHandler }) {
      if (name === "expert-panel") commandHandler = options.handler;
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
  assert.deepEqual(params.chain, buildSecondOpinionChain().chain);
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
    on() {},
    getCommands: () => [{
      name: "subagents-doctor",
      source: "extension",
      sourceInfo: { baseDir: join(ROOT, "node_modules", "pi-subagents") },
    }],
    registerTool(definition: any) {
      if (definition.name === "convene_expert_panel") tool = definition;
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
  assert.deepEqual(params.chain, buildSecondOpinionChain().chain);
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
    on() {},
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
