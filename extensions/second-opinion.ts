// ABOUTME: Registers the guarded expert-panel tool and immediate /expert-panel command over one RPC launcher.
// ABOUTME: Sends only the prepared brief or explicit artifact, with fresh children and no inherited capabilities.

import { createHash, randomUUID } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  CRITIC_AGENT,
  OPINION_MODELS,
  PI_SUBAGENTS_VERSION,
  SYNTHESIZER_AGENT,
  SYNTHESIZER_MODEL,
} from "../src/second-opinion-config.js";
import { SECOND_OPINION_CHAIN_SHA256 } from "../src/second-opinion-integrity.js";

const RPC_REQUEST_EVENT = "subagents:rpc:v1:request";
const RPC_REPLY_PREFIX = "subagents:rpc:v1:reply:";
const RPC_PING_TIMEOUT_MS = 10_000;
const RPC_SPAWN_ACK_TIMEOUT_MS = 60_000;
const RUN_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_TARGET_CHARS = 200_000;

type RpcReply = {
  version?: number;
  requestId?: string;
  success?: boolean;
  data?: unknown;
  error?: { code?: string; message?: string };
};

type ResolveLaunchContract = (input: Record<string, unknown>) => Promise<{
  ok: boolean;
  message?: string;
  contract?: {
    agent: { source: string; filePath: string };
    context: string;
    model?: string;
    modelCandidates: string[];
    systemPromptMode?: string;
    inheritProjectContext: boolean;
    inheritSkills: boolean;
    skills: { requested: string[]; resolved: unknown[]; missing: string[] };
    tools: {
      effectiveAllowlist: string[];
      internalTools: string[];
      configuredExtensions: string[];
      disableAmbientExtensions: boolean;
    };
    diagnostics: Array<{ severity: string; message: string }>;
  };
}>;

type ChainDefinition = {
  name: string;
  package?: string;
  description: string;
  chain: Array<Record<string, unknown>>;
};

type ExtensionDependencies = {
  resolveLaunchContract: ResolveLaunchContract;
  pingTimeoutMs: number;
  spawnAckTimeoutMs: number;
};

type PreparedBrief = {
  objective: string;
  subject: string;
  context: string;
  evidence: string;
  uncertainties: string;
  reviewQuestions: string[];
};

type LaunchOutcome =
  | { status: "launched"; runId?: string }
  | { status: "cancelled" }
  | { status: "unknown"; message: string };

const QUESTION_COLLATOR = new Intl.Collator("und", {
  usage: "search",
  sensitivity: "base",
  ignorePunctuation: true,
});

const PREPARED_BRIEF_SCHEMA = Type.Object({
  objective: Type.String({ minLength: 20, maxLength: 2_000 }),
  subject: Type.String({ minLength: 40, maxLength: 120_000 }),
  context: Type.String({ minLength: 40, maxLength: 35_000 }),
  evidence: Type.String({ minLength: 20, maxLength: 20_000 }),
  uncertainties: Type.String({ minLength: 20, maxLength: 10_000 }),
  reviewQuestions: Type.Array(Type.String({ minLength: 15, maxLength: 2_000 }), {
    minItems: 2,
    maxItems: 6,
  }),
}, { additionalProperties: false });

async function resolveWithBundledPreflight(input: Record<string, unknown>) {
  const imported = await import("pi-subagents/preflight");
  const module = (imported.default ?? imported) as { resolveSubagentLaunchContract?: ResolveLaunchContract };
  if (typeof module.resolveSubagentLaunchContract !== "function") {
    throw new Error("Bundled pi-subagents preflight API is unavailable.");
  }
  return module.resolveSubagentLaunchContract(input);
}

const DEFAULT_DEPENDENCIES: ExtensionDependencies = {
  resolveLaunchContract: resolveWithBundledPreflight,
  pingTimeoutMs: RPC_PING_TIMEOUT_MS,
  spawnAckTimeoutMs: RPC_SPAWN_ACK_TIMEOUT_MS,
};

class RpcCancelledError extends Error {}
class RpcOutcomeUnknownError extends Error {}

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .filter((block): block is { type: string; text: string } => {
      return Boolean(block)
        && typeof block === "object"
        && (block as { type?: unknown }).type === "text"
        && typeof (block as { text?: unknown }).text === "string";
    })
    .map((block) => block.text)
    .join("\n")
    .trim();
}

export function extractLatestAssistantText(entries: readonly unknown[]): string {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as { type?: unknown; message?: { role?: unknown; content?: unknown } };
    if (candidate.type !== "message" || candidate.message?.role !== "assistant") continue;
    const text = textFromContent(candidate.message.content);
    if (text) return text;
  }
  return "";
}

export function resolveTarget(args: string, entries: readonly unknown[]): string {
  const explicit = args.trim();
  const target = explicit || extractLatestAssistantText(entries);
  if (!target) {
    throw new Error("No target supplied and no previous assistant response is available.");
  }
  if (target.length > MAX_TARGET_CHARS) {
    throw new Error(
      `Target is ${target.length.toLocaleString()} characters; the limit is ${MAX_TARGET_CHARS.toLocaleString()}. Supply a smaller, explicit artifact.`,
    );
  }
  return target;
}

function requiredBriefText(value: unknown, field: string, minimumCharacters: number): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Prepared brief ${field} is empty.`);
  const text = value.trim();
  const informationCharacters = text.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
  if (informationCharacters < minimumCharacters) {
    throw new Error(`Prepared brief ${field} is too short to be substantive.`);
  }
  if (/^(?:x+|n\/?a|none|unknown|tbd|todo|placeholder|test)[\s.!?_-]*$/i.test(text)) {
    throw new Error(`Prepared brief ${field} is a placeholder.`);
  }
  return text;
}

export function buildSecondOpinionBrief(input: PreparedBrief): string {
  const objective = requiredBriefText(input.objective, "objective", 15);
  const subject = requiredBriefText(input.subject, "subject", 30);
  const context = requiredBriefText(input.context, "context", 30);
  const evidence = requiredBriefText(input.evidence, "evidence", 15);
  const uncertainties = requiredBriefText(input.uncertainties, "uncertainties", 15);
  if (!Array.isArray(input.reviewQuestions)) throw new Error("Prepared brief reviewQuestions is missing.");
  const questions: string[] = [];
  const questionKeys: string[] = [];
  for (const rawQuestion of input.reviewQuestions) {
    const question = requiredBriefText(rawQuestion, "reviewQuestions item", 12);
    const key = question
      .normalize("NFKC")
      .replace(/[\p{P}\p{S}\p{M}\p{Cf}\s]+/gu, "");
    if (questionKeys.some((existing) => QUESTION_COLLATOR.compare(existing, key) === 0)) continue;
    questionKeys.push(key);
    questions.push(question);
  }
  if (questions.length < 2) throw new Error("Prepared brief requires at least two distinct reviewQuestions.");
  const numberedQuestions = questions
    .map((question, index) => `${index + 1}. ${question.replaceAll("\n", "\n   ")}`)
    .join("\n");
  const brief = [
    "# Review objective",
    objective,
    "",
    "# Subject under review",
    subject,
    "",
    "# Verified context and constraints",
    context,
    "",
    "# Evidence",
    evidence,
    "",
    "# Assumptions, uncertainties, and evidence gaps",
    uncertainties,
    "",
    "# Questions for the expert panel",
    numberedQuestions,
  ].join("\n");
  return resolveTarget(brief, []);
}

export function validateChainDisclosure(parsed: ChainDefinition): readonly string[] {
  const rendered = `${JSON.stringify(parsed, null, 2)}\n`;
  const digest = createHash("sha256").update(rendered).digest("hex");
  if (digest !== SECOND_OPINION_CHAIN_SHA256) {
    throw new Error("Second-opinion chain content does not match the reviewed disclosure contract.");
  }
  if (parsed.name !== "second-opinion" || parsed.package !== "pi-forge" || parsed.chain.length !== 2) {
    throw new Error("Second-opinion chain identity or step count does not match its disclosure contract.");
  }

  const first = parsed.chain[0] as { parallel?: Array<{ agent?: unknown; model?: unknown }> };
  const synthesis = parsed.chain[1] as { agent?: unknown; model?: unknown };
  const tasks = first.parallel;
  if (!Array.isArray(tasks) || tasks.length !== OPINION_MODELS.length) {
    throw new Error("Second-opinion chain must contain exactly four independent critics.");
  }

  const actualModels = tasks.map((task) => task.model);
  const modelsMatch = actualModels.every((model, index) => model === OPINION_MODELS[index]);
  if (!modelsMatch || tasks.some((task) => task.agent !== CRITIC_AGENT)) {
    throw new Error("Second-opinion critic agents or models do not match the disclosed provider list.");
  }
  if (synthesis.agent !== SYNTHESIZER_AGENT || synthesis.model !== SYNTHESIZER_MODEL) {
    throw new Error("Second-opinion synthesizer does not match the disclosed synthesis stage.");
  }
  return OPINION_MODELS;
}

function loadChain(): ChainDefinition {
  const extensionDir = dirname(fileURLToPath(import.meta.url));
  const chainPath = join(extensionDir, "..", "chains", "second-opinion.chain.json");
  const parsed = JSON.parse(readFileSync(chainPath, "utf8")) as ChainDefinition;
  if (!Array.isArray(parsed.chain)) throw new Error(`Invalid second-opinion chain at ${chainPath}`);
  validateChainDisclosure(parsed);
  return parsed;
}

export async function preflightSecondOpinion(
  definition: ChainDefinition,
  ctx: ExtensionContext,
  resolveLaunchContract: ResolveLaunchContract,
): Promise<void> {
  const extensionDir = dirname(fileURLToPath(import.meta.url));
  const packageRoot = join(extensionDir, "..");
  const first = definition.chain[0] as { parallel: Array<Record<string, unknown>> };
  const steps = [...first.parallel, definition.chain[1]!];

  for (const [index, step] of steps.entries()) {
    const agent = String(step.agent);
    const model = String(step.model);
    const expectedFile = realpathSync(join(
      packageRoot,
      "agents",
      agent === CRITIC_AGENT ? "independent-critic.md" : "opinion-synthesizer.md",
    ));
    const result = await resolveLaunchContract({
      agent,
      cwd: ctx.cwd,
      task: "pi-forge second-opinion preflight",
      context: "fresh",
      model,
      outputSchema: step.outputSchema,
      artifacts: false,
      parentSessionFile: ctx.sessionManager.getSessionFile(),
      runId: `pi-forge-preflight-${index}`,
    });
    if (!result.ok || !result.contract) {
      throw new Error(`Second-opinion isolation preflight failed for ${agent}: ${result.message ?? "unknown error"}`);
    }

    const contract = result.contract;
    const actualFile = realpathSync(contract.agent.filePath);
    const effectiveTools = [...contract.tools.effectiveAllowlist].sort();
    const isolationHolds = contract.agent.source === "package"
      && actualFile === expectedFile
      && contract.context === "fresh"
      && contract.model?.startsWith(model) === true
      && contract.modelCandidates.length === 1
      && contract.modelCandidates[0] === contract.model
      && contract.systemPromptMode === "replace"
      && contract.inheritProjectContext === false
      && contract.inheritSkills === false
      && contract.skills.requested.length === 0
      && contract.skills.resolved.length === 0
      && contract.skills.missing.length === 0
      && effectiveTools.length === 1
      && effectiveTools[0] === "structured_output"
      && contract.tools.internalTools.includes("structured_output")
      && contract.tools.configuredExtensions.length === 0
      && contract.tools.disableAmbientExtensions === true
      && !contract.diagnostics.some((diagnostic) => diagnostic.severity === "error");

    if (!isolationHolds) {
      throw new Error(
        `Second-opinion isolation preflight rejected the effective ${agent} contract. Remove user/project overrides or shadowing agents, then retry.`,
      );
    }
  }
}

export function validatePiSubagentsRuntime(pi: ExtensionAPI): void {
  const command = pi.getCommands().find((candidate) => {
    return candidate.name === "subagents-doctor" && candidate.source === "extension";
  });
  const sourceInfo = command?.sourceInfo as { baseDir?: string; path?: string } | undefined;
  const baseDir = sourceInfo?.baseDir ?? (sourceInfo?.path ? dirname(sourceInfo.path) : undefined);
  if (!baseDir) {
    throw new Error(`pi-subagents ${PI_SUBAGENTS_VERSION} is required and must be enabled.`);
  }
  const packageJson = JSON.parse(readFileSync(join(baseDir, "package.json"), "utf8")) as {
    name?: unknown;
    version?: unknown;
  };
  if (packageJson.name !== "pi-subagents") {
    throw new Error("The active subagents RPC responder is not the reviewed pi-subagents package.");
  }
  if (packageJson.version !== PI_SUBAGENTS_VERSION) {
    throw new Error(
      `pi-subagents runtime ${String(packageJson.version ?? "unknown")} does not match the reviewed ${PI_SUBAGENTS_VERSION} contract.`,
    );
  }
}

function runIdFromData(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const value = data as {
    runId?: unknown;
    id?: unknown;
    asyncId?: unknown;
    details?: { asyncId?: unknown; runId?: unknown; id?: unknown };
  };
  for (const candidate of [
    value.runId,
    value.id,
    value.asyncId,
    value.details?.runId,
    value.details?.id,
    value.details?.asyncId,
  ]) {
    if (typeof candidate === "string" && candidate) return candidate;
  }
  return undefined;
}

async function rpcRequest(
  pi: ExtensionAPI,
  method: string,
  params: Record<string, unknown>,
  timeoutMs: number,
  timeoutError: () => Error,
  signal?: AbortSignal,
  abortError: () => Error = () => new RpcCancelledError("Expert-panel launch cancelled."),
): Promise<unknown> {
  if (signal?.aborted) throw new RpcCancelledError("Expert-panel launch cancelled before RPC emission.");
  const requestId = randomUUID();
  const replyEvent = `${RPC_REPLY_PREFIX}${requestId}`;

  return new Promise((resolve, reject) => {
    let settled = false;
    let emitted = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe = () => {};
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      unsubscribe();
    };
    const settle = (error?: Error, data?: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(data);
    };
    const onAbort = () => settle(
      emitted ? abortError() : new RpcCancelledError("Expert-panel launch cancelled before RPC emission."),
    );

    unsubscribe = pi.events.on(replyEvent, (rawReply) => {
      const reply = rawReply as RpcReply;
      if (reply.success) {
        settle(undefined, reply.data);
        return;
      }
      settle(new Error(reply.error?.message || reply.error?.code || "pi-subagents RPC request failed"));
    });
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) {
      onAbort();
      return;
    }

    timer = setTimeout(() => settle(timeoutError()), timeoutMs);

    emitted = true;
    pi.events.emit(RPC_REQUEST_EVENT, {
      version: 1,
      requestId,
      method,
      params,
    });
  });
}

async function reviewPreparedBrief(
  target: string,
  ctx: ExtensionContext,
  signal?: AbortSignal,
): Promise<string | undefined> {
  if (!ctx.hasUI) {
    throw new Error("The prepared second-opinion brief requires interactive review before disclosure.");
  }
  if (signal?.aborted) return undefined;
  const reviewed = await ctx.ui.editor(
    "Review exact expert-panel payload (edit or redact before accepting)",
    target,
    { signal },
  );
  if (reviewed === undefined || signal?.aborted) return undefined;
  return resolveTarget(reviewed, []);
}

async function confirmDisclosure(
  target: string,
  models: readonly string[],
  ctx: ExtensionContext,
  signal?: AbortSignal,
): Promise<boolean> {
  if (!ctx.hasUI) {
    throw new Error("The expert panel requires interactive confirmation before sending data to multiple providers.");
  }

  const providerList = models.map((provider) => `  - ${provider}`).join("\n");
  const digest = createHash("sha256").update(target).digest("hex");
  return ctx.ui.confirm(
    "Four-provider expert panel",
    `The exact reviewed payload is ${target.length.toLocaleString()} characters (SHA-256 ${digest}).\n\nIndependent panelists receive it:\n${providerList}\n\nSynthesis: ${SYNTHESIZER_MODEL} receives the payload again plus all four reports.\n\nConversation history, project instructions, skills, ambient extensions, and filesystem, shell, or network tools are excluded. The internal structured-output tool remains enabled.`,
    { signal },
  );
}

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new RpcCancelledError("Expert-panel launch cancelled before spawn.");
}

async function launchExpertPanel(
  pi: ExtensionAPI,
  dependencies: ExtensionDependencies,
  target: string,
  ctx: ExtensionContext,
  signal?: AbortSignal,
): Promise<LaunchOutcome> {
  try {
    throwIfCancelled(signal);
    const definition = loadChain();
    const models = validateChainDisclosure(definition);
    validatePiSubagentsRuntime(pi);
    await preflightSecondOpinion(definition, ctx, dependencies.resolveLaunchContract);
    throwIfCancelled(signal);
    await rpcRequest(
      pi,
      "ping",
      {},
      dependencies.pingTimeoutMs,
      () => new Error("pi-subagents did not answer within 10 seconds. Install and enable pi-subagents, then retry."),
      signal,
    );
    throwIfCancelled(signal);
    if (!(await confirmDisclosure(target, models, ctx, signal))) return { status: "cancelled" };
    throwIfCancelled(signal);

    await preflightSecondOpinion(definition, ctx, dependencies.resolveLaunchContract);
    throwIfCancelled(signal);

    const unknownOutcome = () => new RpcOutcomeUnknownError(
      "Expert-panel launch was emitted but acknowledgement is unavailable. The run may already be active; do not retry until you inspect /subagents-fleet.",
    );
    const data = await rpcRequest(
      pi,
      "spawn",
      {
        task: target,
        chain: definition.chain,
        context: "fresh",
        async: true,
        artifacts: false,
        timeoutMs: RUN_TIMEOUT_MS,
      },
      dependencies.spawnAckTimeoutMs,
      unknownOutcome,
      signal,
      unknownOutcome,
    );
    return { status: "launched", runId: runIdFromData(data) };
  } catch (error) {
    if (error instanceof RpcCancelledError) return { status: "cancelled" };
    if (error instanceof RpcOutcomeUnknownError) return { status: "unknown", message: error.message };
    throw error;
  }
}

function launchOutcomeText(outcome: LaunchOutcome): string {
  if (outcome.status === "cancelled") return "Expert panel cancelled before disclosure.";
  if (outcome.status === "unknown") return outcome.message;
  return outcome.runId
    ? `Expert panel launched: ${outcome.runId}`
    : "Expert panel launched. Use /subagents-fleet to inspect progress.";
}

export default function secondOpinionExtension(
  pi: ExtensionAPI,
  dependencies: ExtensionDependencies = DEFAULT_DEPENDENCIES,
): void {
  pi.registerTool({
    name: "convene_expert_panel",
    label: "Convene Expert Panel",
    description: "Launch the isolated four-provider expert panel only after preparing a self-contained, evidence-labelled, redacted review brief. The tool asks for interactive disclosure consent before sending anything.",
    parameters: PREPARED_BRIEF_SCHEMA,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const prepared = params as PreparedBrief;
      const draft = buildSecondOpinionBrief(prepared);
      const target = await reviewPreparedBrief(draft, ctx, signal);
      const outcome = target
        ? await launchExpertPanel(pi, dependencies, target, ctx, signal)
        : { status: "cancelled" } as const;
      return {
        content: [{ type: "text", text: launchOutcomeText(outcome) }],
        details: {
          status: outcome.status,
          runId: outcome.status === "launched" ? outcome.runId : undefined,
          targetChars: target?.length ?? 0,
        },
        terminate: true,
      };
    },
  });

  pi.registerCommand("expert-panel", {
    description: "Immediately send a prepared artifact to four isolated providers, then synthesize",
    handler: async (args, ctx) => {
      try {
        const target = resolveTarget(args, ctx.sessionManager.getBranch());
        const outcome = await launchExpertPanel(pi, dependencies, target, ctx);
        ctx.ui.notify(
          launchOutcomeText(outcome),
          outcome.status === "unknown" ? "warning" : "info",
        );
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
    },
  });
}
