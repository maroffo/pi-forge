// ABOUTME: Registers /second-opinion and launches the bundled four-provider chain through pi-subagents RPC.
// ABOUTME: Sends only the explicit target, with fresh child context and no child tools or inherited project instructions.

import { createHash, randomUUID } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
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
  ctx: ExtensionCommandContext,
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
): Promise<unknown> {
  const requestId = randomUUID();
  const replyEvent = `${RPC_REPLY_PREFIX}${requestId}`;

  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = pi.events.on(replyEvent, (rawReply) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      unsubscribe();
      const reply = rawReply as RpcReply;
      if (reply.success) {
        resolve(reply.data);
        return;
      }
      reject(new Error(reply.error?.message || reply.error?.code || "pi-subagents RPC request failed"));
    });

    timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      unsubscribe();
      reject(timeoutError());
    }, timeoutMs);

    pi.events.emit(RPC_REQUEST_EVENT, {
      version: 1,
      requestId,
      method,
      params,
    });
  });
}

async function confirmDisclosure(
  target: string,
  models: readonly string[],
  ctx: ExtensionCommandContext,
): Promise<boolean> {
  if (!ctx.hasUI) {
    throw new Error("/second-opinion requires interactive confirmation before sending data to multiple providers.");
  }

  const providerList = models.map((provider) => `  - ${provider}`).join("\n");
  return ctx.ui.confirm(
    "Four-provider second opinion",
    `Independent critics receive ${target.length.toLocaleString()} characters:\n${providerList}\n\nSynthesis: ${SYNTHESIZER_MODEL} receives the target again plus all four reports.\n\nConversation history, project instructions, skills, ambient extensions, and filesystem, shell, or network tools are excluded. The internal structured-output tool remains enabled.`,
  );
}

export default function secondOpinionExtension(
  pi: ExtensionAPI,
  dependencies: ExtensionDependencies = DEFAULT_DEPENDENCIES,
): void {
  pi.registerCommand("second-opinion", {
    description: "Ask OpenAI, Anthropic, Gemini, and DeepSeek independently, then synthesize",
    handler: async (args, ctx) => {
      try {
        const target = resolveTarget(args, ctx.sessionManager.getBranch());
        const definition = loadChain();
        const models = validateChainDisclosure(definition);
        validatePiSubagentsRuntime(pi);
        await preflightSecondOpinion(definition, ctx, dependencies.resolveLaunchContract);
        await rpcRequest(
          pi,
          "ping",
          {},
          dependencies.pingTimeoutMs,
          () => new Error("pi-subagents did not answer within 10 seconds. Install and enable pi-subagents, then retry."),
        );
        if (!(await confirmDisclosure(target, models, ctx))) {
          ctx.ui.notify("Second opinion cancelled.", "info");
          return;
        }

        await preflightSecondOpinion(definition, ctx, dependencies.resolveLaunchContract);

        let data: unknown;
        try {
          data = await rpcRequest(
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
            () => new RpcOutcomeUnknownError(
              "Second-opinion launch acknowledgement timed out. The run may already be active; do not retry until you inspect /subagents-fleet.",
            ),
          );
        } catch (error) {
          if (error instanceof RpcOutcomeUnknownError) {
            ctx.ui.notify(error.message, "warning");
            return;
          }
          throw error;
        }
        const runId = runIdFromData(data);
        ctx.ui.notify(
          runId
            ? `Second opinion launched: ${runId}`
            : "Second opinion launched. Use /subagents-fleet to inspect progress.",
          "info",
        );
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
    },
  });
}
